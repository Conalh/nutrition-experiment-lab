"""User accounts: creation and credential checks."""
from __future__ import annotations

from .auth import hash_password, verify_password
from .db import DictConn, new_id
from .models import UserPublic


class AuthError(ValueError):
    """Bad credentials or duplicate email — maps to HTTP 400/401."""


def _public(row: dict) -> UserPublic:
    return UserPublic(id=row["id"], email=row["email"], display_name=row["display_name"])


def create_user(
    conn: DictConn, email: str, password: str, display_name: str | None = None
) -> UserPublic:
    email = email.strip().lower()
    if not email or "@" not in email:
        raise AuthError("Enter a valid email address.")
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.")

    exists = conn.execute(
        "SELECT 1 FROM app_user WHERE email = %s", (email,)
    ).fetchone()
    if exists:
        raise AuthError("An account with that email already exists.")

    row = conn.execute(
        """
        INSERT INTO app_user (id, email, display_name, password_hash)
        VALUES (%s, %s, %s, %s) RETURNING *
        """,
        (new_id("u"), email, display_name or email.split("@")[0], hash_password(password)),
    ).fetchone()
    conn.commit()
    assert row is not None
    return _public(row)


def authenticate(conn: DictConn, email: str, password: str) -> UserPublic:
    row = conn.execute(
        "SELECT * FROM app_user WHERE email = %s", (email.strip().lower(),)
    ).fetchone()
    if row is None or not row.get("password_hash"):
        raise AuthError("Incorrect email or password.")
    if not verify_password(password, row["password_hash"]):
        raise AuthError("Incorrect email or password.")
    return _public(row)


def get_user(conn: DictConn, user_id: str) -> UserPublic | None:
    row = conn.execute(
        "SELECT * FROM app_user WHERE id = %s", (user_id,)
    ).fetchone()
    return _public(row) if row else None


def current_epoch(conn: DictConn, user_id: str) -> int:
    """The user's current session epoch (0 for a fresh account)."""
    row = conn.execute(
        "SELECT session_epoch FROM app_user WHERE id = %s", (user_id,)
    ).fetchone()
    return int(row["session_epoch"]) if row else 0


def revoke_sessions(conn: DictConn, user_id: str) -> None:
    """Bump the session epoch, invalidating every outstanding signed cookie
    for this user (used on logout)."""
    conn.execute(
        "UPDATE app_user SET session_epoch = session_epoch + 1 WHERE id = %s",
        (user_id,),
    )
    conn.commit()
