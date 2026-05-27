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
from ..models import LoginRequest, SignupRequest, UserPublic
from ..users import AuthError
from .deps import ConnDep

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session(response: Response, user_id: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=issue_session(user_id),
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
    _set_session(response, user.id)
    return user


@router.post("/login", response_model=UserPublic)
def login(
    data: LoginRequest, response: Response, conn: DictConn = ConnDep
) -> UserPublic:
    try:
        user = users_svc.authenticate(conn, data.email, data.password)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    _set_session(response, user.id)
    return user


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
def me(request: Request, conn: DictConn = ConnDep) -> UserPublic:
    user_id = read_session(request.cookies.get(COOKIE_NAME))
    user = users_svc.get_user(conn, user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user
