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


def current_user_id(request: Request) -> str:
    """The authenticated user id from the session cookie; 401 if absent."""
    user_id = read_session(request.cookies.get(COOKIE_NAME))
    if user_id is None:
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
