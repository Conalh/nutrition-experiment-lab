"""Shared FastAPI dependencies and domain-error → HTTP mapping.

Every request opens a fresh psycopg connection and closes it on response.
``current_user_id`` resolves the authenticated user from the signed session
cookie and is the single chokepoint that scopes every request to its owner.
"""
from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, HTTPException, Request

from ..auth import COOKIE_NAME, read_session
from ..db import DictConn, connect
from ..experiments import NotFoundError, TransitionError, ValidationError


def get_conn() -> Iterator[DictConn]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def current_user_id(request: Request, conn: DictConn = Depends(get_conn)) -> str:
    """The authenticated user id from the signed session cookie. Verifies the
    signature/TTL, then checks the cookie's epoch against the stored one so a
    logged-out (revoked) token is rejected. 401 on any failure.

    ``conn`` reuses the request's cached get_conn dependency, so this adds one
    indexed lookup, not a second connection."""
    session = read_session(request.cookies.get(COOKIE_NAME))
    if session is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    user_id, epoch = session
    row = conn.execute(
        "SELECT session_epoch FROM app_user WHERE id = %s", (user_id,)
    ).fetchone()
    if row is None or row["session_epoch"] != epoch:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user_id


def to_http(exc: Exception) -> HTTPException:
    """Translate a domain error into the right HTTP status."""
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, TransitionError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=422, detail=str(exc))
    raise exc


ConnDep = Depends(get_conn)
UserDep = Depends(current_user_id)
