"""Postgres persistence layer (psycopg3).

No ORM: raw SQL against a thin connection helper. Enums are modelled as
``TEXT`` columns with ``CHECK`` constraints — simpler than native PG enum
types, which require a migration to extend. App-generated string ids
(``exp_…``, ``log_…``) keep rows human-readable in psql.

Connection lifecycle: callers (FastAPI deps, scripts, tests) open a
connection, do their work, and close it. We don't pool — at single-user
scale the per-request connect overhead is negligible.
"""
from __future__ import annotations

import secrets
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import (
    DEFAULT_USER_EMAIL,
    DEFAULT_USER_ID,
    DEFAULT_USER_NAME,
    DEFAULT_USER_TZ,
    database_url,
)

# Connections from connect() use dict_row, so rows are dicts. The alias lets
# the rest of the codebase annotate connections so ``Model(**row)`` type-checks.
DictConn = psycopg.Connection[dict[str, Any]]


def new_id(prefix: str) -> str:
    """Readable, collision-resistant id, e.g. ``exp_3f9a1c8e``."""
    return f"{prefix}_{secrets.token_hex(6)}"


def require(row: dict[str, Any] | None) -> dict[str, Any]:
    """Assert a row exists. Use after ``INSERT/UPDATE ... RETURNING``, which
    always yields a row — this narrows the Optional for the type checker."""
    assert row is not None, "expected a row from a RETURNING statement"
    return row


def connect() -> DictConn:
    """Open a connection with dict rows. Caller owns the lifecycle."""
    return psycopg.connect(database_url(), row_factory=dict_row, autocommit=False)


SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS app_user (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    timezone     TEXT NOT NULL DEFAULT 'UTC',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    question           TEXT NOT NULL,
    hypothesis         TEXT,
    status             TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','active','paused','completed','abandoned')),
    baseline_start     DATE,
    baseline_end       DATE,
    washout_start      DATE,
    washout_end        DATE,
    intervention_start DATE,
    intervention_end   DATE,
    primary_outcome    TEXT,
    stop_reason        TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experiment_user ON experiment(user_id);

CREATE TABLE IF NOT EXISTS intervention (
    id              TEXT PRIMARY KEY,
    experiment_id   TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    rule_text       TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'other'
        CHECK (category IN ('protein','fiber','hydration','timing','caffeine',
                            'supplement','meal_pattern','other')),
    expected_effect TEXT,
    safety_note     TEXT
);
CREATE INDEX IF NOT EXISTS idx_intervention_experiment ON intervention(experiment_id);

CREATE TABLE IF NOT EXISTS outcome_definition (
    id            TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'rating'
        CHECK (kind IN ('rating','numeric','boolean')),
    direction     TEXT NOT NULL DEFAULT 'higher_better'
        CHECK (direction IN ('higher_better','lower_better','target_range')),
    metric        TEXT,
    target_min    DOUBLE PRECISION,
    target_max    DOUBLE PRECISION,
    unit          TEXT,
    is_primary    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_outcome_experiment ON outcome_definition(experiment_id);

CREATE TABLE IF NOT EXISTS daily_log (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    experiment_id        TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
    date                 DATE NOT NULL,
    phase                TEXT
        CHECK (phase IS NULL OR phase IN ('baseline','washout','intervention')),
    adherence            TEXT
        CHECK (adherence IS NULL OR adherence IN ('yes','partial','no','not_applicable')),
    hunger               INTEGER CHECK (hunger IS NULL OR hunger BETWEEN 1 AND 5),
    energy               INTEGER CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
    digestion            INTEGER CHECK (digestion IS NULL OR digestion BETWEEN 1 AND 5),
    sleep_quality        INTEGER CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
    training_performance INTEGER CHECK (training_performance IS NULL OR training_performance BETWEEN 1 AND 5),
    body_weight          DOUBLE PRECISION,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (experiment_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_log_experiment ON daily_log(experiment_id);

CREATE TABLE IF NOT EXISTS meal_log (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    daily_log_id TEXT NOT NULL REFERENCES daily_log(id) ON DELETE CASCADE,
    eaten_at     TIMESTAMPTZ,
    description  TEXT NOT NULL,
    tags         TEXT[] NOT NULL DEFAULT '{}',
    photo_url    TEXT
);
CREATE INDEX IF NOT EXISTS idx_meal_daily_log ON meal_log(daily_log_id);

CREATE TABLE IF NOT EXISTS confounder (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    experiment_id TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'other'
        CHECK (kind IN ('illness','travel','poor_sleep','alcohol',
                        'unusual_training','high_stress','missed_log','other')),
    severity      TEXT NOT NULL DEFAULT 'low'
        CHECK (severity IN ('low','medium','high')),
    notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_confounder_experiment ON confounder(experiment_id);

CREATE TABLE IF NOT EXISTS analysis_snapshot (
    id                      TEXT PRIMARY KEY,
    experiment_id           TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    adherence_rate          DOUBLE PRECISION,
    baseline_summary_json   JSONB,
    intervention_summary_json JSONB,
    effect_summary_json     JSONB,
    confidence              TEXT
        CHECK (confidence IS NULL OR confidence IN ('low','medium','high')),
    caveats                 TEXT
);
CREATE INDEX IF NOT EXISTS idx_snapshot_experiment ON analysis_snapshot(experiment_id);
"""


def init_db(conn: DictConn | None = None) -> None:
    """Apply the schema and ensure the default single user exists.
    Idempotent. Opens its own connection if one isn't supplied."""
    own = conn is None
    conn = conn or connect()
    try:
        conn.execute(SCHEMA_DDL)
        _run_migrations(conn)
        ensure_default_user(conn)
        conn.commit()
    finally:
        if own:
            conn.close()


# Additive, idempotent migrations for columns introduced after a DB already
# exists. Each is safe to run on every startup. Plain ALTER … IF NOT EXISTS
# keeps this dependency-free (no Alembic needed at single-user scale).
_MIGRATIONS = [
    "ALTER TABLE outcome_definition ADD COLUMN IF NOT EXISTS metric TEXT",
    "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_hash TEXT",
]


def _run_migrations(conn: DictConn) -> None:
    for stmt in _MIGRATIONS:
        conn.execute(stmt)


def ensure_default_user(conn: DictConn) -> str:
    """Insert the V1 single user if missing; return its id."""
    conn.execute(
        """
        INSERT INTO app_user (id, email, display_name, timezone)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (DEFAULT_USER_ID, DEFAULT_USER_EMAIL, DEFAULT_USER_NAME, DEFAULT_USER_TZ),
    )
    return DEFAULT_USER_ID
