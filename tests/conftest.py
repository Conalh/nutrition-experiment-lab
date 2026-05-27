"""Test fixtures. Runs against the dedicated ``nutrition_lab_test`` DB so
tests never touch real data. Each test gets a clean schema via a TRUNCATE
of every table between tests."""
from __future__ import annotations

import os

# Point every connection at the test DB before nutrition_lab.config reads it,
# and pin a stable session secret so signed cookies validate within a run.
os.environ.setdefault(
    "NUTRITION_LAB_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/nutrition_lab_test",
)
os.environ.setdefault("NUTRITION_LAB_SESSION_SECRET", "test-session-secret")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from nutrition_lab.api import create_app  # noqa: E402
from nutrition_lab.config import DEFAULT_USER_ID  # noqa: E402
from nutrition_lab.db import connect, ensure_default_user, init_db  # noqa: E402

_TABLES = [
    "meal_log",
    "daily_log",
    "confounder",
    "analysis_snapshot",
    "outcome_definition",
    "intervention",
    "experiment",
    "app_user",
]


@pytest.fixture(scope="session", autouse=True)
def _schema():
    init_db()
    yield


@pytest.fixture
def conn():
    c = connect()
    c.execute("TRUNCATE " + ", ".join(_TABLES) + " RESTART IDENTITY CASCADE")
    ensure_default_user(c)
    c.commit()
    try:
        yield c
    finally:
        c.close()


@pytest.fixture
def user_id() -> str:
    """The default user, used by service-level tests that call modules
    directly (bypassing the HTTP/auth layer)."""
    return DEFAULT_USER_ID


@pytest.fixture
def client(conn) -> TestClient:
    """An authenticated TestClient: signs up a fresh user (the app_user table
    is truncated per test by the ``conn`` fixture) and carries the session
    cookie. Use this for route-level tests."""
    c = TestClient(create_app())
    r = c.post(
        "/api/auth/signup",
        json={"email": "tester@example.com", "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return c


@pytest.fixture
def auth_user_id(client: TestClient) -> str:
    """The id of the user the authenticated ``client`` is logged in as."""
    return client.get("/api/auth/me").json()["id"]
