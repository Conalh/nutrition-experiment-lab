"""Auth routes: signup, login, logout, me."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from .. import users as users_svc
from ..auth import (
    COOKIE_NAME,
    COOKIE_SECURE,
    SESSION_MAX_AGE_SECONDS,
    issue_session,
    read_session,
)
from ..db import DictConn
from ..models import (
    ChangePasswordRequest,
    LoginRequest,
    SignupRequest,
    UserPublic,
)
from ..users import AuthError
from .deps import ConnDep, UserDep

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session(response: Response, user_id: str, epoch: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=issue_session(user_id, epoch),
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )


@router.post("/signup", response_model=UserPublic, status_code=201)
def signup(
    data: SignupRequest, response: Response, conn: DictConn = ConnDep
) -> UserPublic:
    try:
        user = users_svc.create_user(conn, data.email, data.password, data.display_name)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    _set_session(response, user.id, users_svc.current_epoch(conn, user.id))
    return user


@router.post("/login", response_model=UserPublic)
def login(
    data: LoginRequest, response: Response, conn: DictConn = ConnDep
) -> UserPublic:
    try:
        user = users_svc.authenticate(conn, data.email, data.password)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    _set_session(response, user.id, users_svc.current_epoch(conn, user.id))
    return user


@router.post("/logout")
def logout(request: Request, response: Response, conn: DictConn = ConnDep) -> dict[str, bool]:
    # Bump the session epoch so the outstanding token (and any copies of it)
    # can no longer authenticate — then clear the cookie. Tolerant of an
    # already-invalid cookie so logout always succeeds.
    session = read_session(request.cookies.get(COOKIE_NAME))
    if session is not None:
        users_svc.revoke_sessions(conn, session[0])
    response.delete_cookie(
        COOKIE_NAME, path="/", httponly=True, samesite="lax", secure=COOKIE_SECURE
    )
    return {"ok": True}


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    response: Response,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
) -> dict[str, bool]:
    try:
        users_svc.change_password(conn, user_id, data.current_password, data.new_password)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    # Changing the password revokes every other session; re-issue a fresh
    # cookie so the user who just changed it stays signed in here.
    users_svc.revoke_sessions(conn, user_id)
    _set_session(response, user_id, users_svc.current_epoch(conn, user_id))
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
def me(conn: DictConn = ConnDep, user_id: str = UserDep) -> UserPublic:
    # UserDep already validated the signature, TTL, and session epoch.
    user = users_svc.get_user(conn, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user
