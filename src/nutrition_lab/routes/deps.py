"""Shared FastAPI dependencies and domain-error → HTTP mapping.

Every request opens a fresh psycopg connection and closes it on response.
In V1 there's a single user, so ``current_user_id`` is a constant; when
real auth lands it becomes the only thing that needs to change here.
"""
from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, HTTPException

from ..config import DEFAULT_USER_ID
from ..db import DictConn, connect
from ..experiments import NotFoundError, TransitionError, ValidationError


def get_conn() -> Iterator[DictConn]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def current_user_id() -> str:
    return DEFAULT_USER_ID


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
