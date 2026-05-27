"""Session-cookie auth.

A signed cookie carries the user id; FastAPI decodes it on every request
via ``current_user_id`` in routes/deps.py. Passwords are bcrypt-hashed.

Why itsdangerous over JWT: the only claim is ``user_id`` plus a server-side
max-age — ``URLSafeTimedSerializer`` signs and timestamps in one line. Why a
signed cookie over server-stored sessions: no session table to maintain at
this scale; the cookie carries the only state we need and its TTL is enforced
by the signature's embedded timestamp.

Security posture:
  - HttpOnly so client JS can't read it
  - SameSite=Lax so a third-party site can't ride an authenticated request
    (localhost:3000 → localhost:8000 is same-site, so dev still works)
  - Secure toggled by env (dev over http needs it off; prod over https on)
  - 14-day max age, refreshed on login
"""
from __future__ import annotations

import os
import secrets
import sys

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

COOKIE_NAME = "nl_session"
SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60

COOKIE_SECURE = os.environ.get("NUTRITION_LAB_SESSION_SECURE", "").strip() in {
    "1",
    "true",
    "yes",
}


def _session_secret() -> str:
    """Secret used to sign the session cookie. Prefers the env var so cookies
    survive a restart; falls back to a per-process random secret in dev (every
    restart invalidates sessions, which is fine locally). Resolved lazily so a
    test can set the env var before any session work."""
    secret = os.environ.get("NUTRITION_LAB_SESSION_SECRET", "").strip()
    if secret:
        return secret
    cached = getattr(_session_secret, "_cached", None)
    if cached:
        return cached
    fallback = secrets.token_urlsafe(32)
    print(
        "[nutrition_lab.auth] WARNING: NUTRITION_LAB_SESSION_SECRET not set; "
        "generated a per-process secret — sessions reset on restart. Set this "
        "env var in any non-dev deployment.",
        file=sys.stderr,
    )
    _session_secret._cached = fallback  # type: ignore[attr-defined]
    return fallback


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_session_secret(), salt="nl-session")


# ─── Passwords ───────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


# ─── Session token ───────────────────────────────────────────────────
def issue_session(user_id: str, epoch: int) -> str:
    """Sign a session token carrying the user id and their session epoch.
    The epoch lets logout revoke all of a user's tokens by bumping it."""
    return _serializer().dumps({"u": user_id, "e": epoch})


def read_session(token: str | None) -> tuple[str, int] | None:
    """Return (user_id, epoch) from a session token, or None if missing /
    invalid / expired / malformed. This only verifies the signature and TTL;
    the epoch is checked against the DB by the request dependency."""
    if not token:
        return None
    try:
        data = _serializer().loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(data, dict):
        return None
    uid = data.get("u")
    epoch = data.get("e")
    if not isinstance(uid, str) or not isinstance(epoch, int):
        return None
    return uid, epoch
