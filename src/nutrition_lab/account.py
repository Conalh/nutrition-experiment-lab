"""Account-level data controls for the private beta: a complete data
export and a complete data wipe.

Both treat the user's logs, weights, symptoms, and supplement notes as
sensitive health-related data — the export is user-initiated and the wipe
removes everything the user owns. The single user identity row is kept so
the single-user app keeps working; only their data is deleted.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from .db import DictConn

# Child tables in dependency order (children before parents) for the wipe.
# Experiment-owned rows cascade, but we delete explicitly so the operation
# is obvious and independent of FK cascade settings.
_OWNED_TABLES = [
    "meal_log",
    "daily_log",
    "confounder",
    "analysis_snapshot",
    "outcome_definition",
    "intervention",
    "experiment",
]


def _jsonable(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        clean: dict[str, Any] = {}
        for k, v in row.items():
            clean[k] = v.isoformat() if isinstance(v, (date, datetime)) else v
        out.append(clean)
    return out


def export_account(conn: DictConn, user_id: str) -> dict[str, Any]:
    """A complete, portable JSON bundle of everything the user owns."""
    user = conn.execute(
        "SELECT * FROM app_user WHERE id = %s", (user_id,)
    ).fetchone()

    def fetch(sql: str) -> list[dict]:
        return _jsonable(conn.execute(sql, (user_id,)).fetchall())

    experiments = fetch("SELECT * FROM experiment WHERE user_id = %s ORDER BY created_at")
    exp_ids = [e["id"] for e in experiments]

    def by_experiment(table: str) -> list[dict]:
        if not exp_ids:
            return []
        rows = conn.execute(
            f"SELECT * FROM {table} WHERE experiment_id = ANY(%s)", (exp_ids,)
        ).fetchall()
        return _jsonable(rows)

    return {
        "exported_at": datetime.now().isoformat(),
        "schema_version": 1,
        "user": _jsonable([user])[0] if user else None,
        "experiments": experiments,
        "interventions": by_experiment("intervention"),
        "outcomes": by_experiment("outcome_definition"),
        "daily_logs": fetch("SELECT * FROM daily_log WHERE user_id = %s ORDER BY date"),
        "meals": fetch("SELECT * FROM meal_log WHERE user_id = %s"),
        "confounders": fetch("SELECT * FROM confounder WHERE user_id = %s ORDER BY date"),
        "analysis_snapshots": by_experiment("analysis_snapshot"),
    }


def delete_account_data(conn: DictConn, user_id: str) -> dict[str, int]:
    """Delete every row the user owns. Returns per-table delete counts.
    Keeps the app_user identity row so the single-user app still works."""
    counts: dict[str, int] = {}
    for table in _OWNED_TABLES:
        if table in ("meal_log", "daily_log", "confounder"):
            cur = conn.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
        elif table == "experiment":
            cur = conn.execute("DELETE FROM experiment WHERE user_id = %s", (user_id,))
        else:
            # outcome_definition / intervention / analysis_snapshot are keyed by
            # experiment_id; remaining experiments are this user's, and they're
            # deleted last, so scope via the surviving experiment rows.
            cur = conn.execute(
                f"DELETE FROM {table} WHERE experiment_id IN "
                "(SELECT id FROM experiment WHERE user_id = %s)",
                (user_id,),
            )
        counts[table] = cur.rowcount
    conn.commit()
    return counts
