"""Test fixtures. Runs against the dedicated ``nutrition_lab_test`` DB so
tests never touch real data. Each test gets a clean schema via a TRUNCATE
of every table between tests."""
from __future__ import annotations

import os

# Point every connection at the test DB before nutrition_lab.config reads it.
os.environ.setdefault(
    "NUTRITION_LAB_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/nutrition_lab_test",
)

import pytest  # noqa: E402

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
    return DEFAULT_USER_ID
