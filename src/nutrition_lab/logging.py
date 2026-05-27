"""Daily logs, meals, and confounders.

The daily log is an *upsert* keyed on (experiment_id, date): logging the
same day twice updates the row instead of creating a duplicate, so a user
can revise the day without thinking about it. The phase (baseline / washout
/ intervention) is derived from the date against the experiment's windows
at write time, so analysis can group days without re-deriving.
"""
from __future__ import annotations

from datetime import date

from .db import DictConn, new_id, require
from .experiments import NotFoundError, get_experiment
from .models import (
    Confounder,
    ConfounderCreate,
    DailyLog,
    DailyLogUpdate,
    DailyLogUpsert,
    MealCreate,
    MealLog,
    MealUpdate,
    Phase,
)


def derive_phase(exp, day: date) -> Phase | None:
    """Which phase a date falls in, or None if outside every window."""
    if exp.baseline_start and exp.baseline_end and exp.baseline_start <= day <= exp.baseline_end:
        return Phase.baseline
    if exp.washout_start and exp.washout_end and exp.washout_start <= day <= exp.washout_end:
        return Phase.washout
    if (
        exp.intervention_start
        and exp.intervention_end
        and exp.intervention_start <= day <= exp.intervention_end
    ):
        return Phase.intervention
    return None


# ─── Daily log ───────────────────────────────────────────────────────
def upsert_daily_log(
    conn: "DictConn", user_id: str, data: DailyLogUpsert
) -> DailyLog:
    exp = get_experiment(conn, user_id, data.experiment_id)
    phase = derive_phase(exp, data.date)
    log_id = new_id("log")
    row = conn.execute(
        """
        INSERT INTO daily_log (
            id, user_id, experiment_id, date, phase, adherence,
            hunger, energy, digestion, sleep_quality, training_performance,
            body_weight, notes
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (experiment_id, date) DO UPDATE SET
            phase = EXCLUDED.phase,
            adherence = EXCLUDED.adherence,
            hunger = EXCLUDED.hunger,
            energy = EXCLUDED.energy,
            digestion = EXCLUDED.digestion,
            sleep_quality = EXCLUDED.sleep_quality,
            training_performance = EXCLUDED.training_performance,
            body_weight = EXCLUDED.body_weight,
            notes = EXCLUDED.notes,
            updated_at = now()
        RETURNING *
        """,
        (
            log_id,
            user_id,
            data.experiment_id,
            data.date,
            phase.value if phase else None,
            data.adherence.value if data.adherence else None,
            data.hunger,
            data.energy,
            data.digestion,
            data.sleep_quality,
            data.training_performance,
            data.body_weight,
            data.notes,
        ),
    ).fetchone()
    conn.commit()
    return DailyLog(**require(row))


def get_daily_log(
    conn: "DictConn", user_id: str, experiment_id: str, day: date
) -> DailyLog | None:
    row = conn.execute(
        "SELECT * FROM daily_log WHERE user_id = %s AND experiment_id = %s AND date = %s",
        (user_id, experiment_id, day),
    ).fetchone()
    return DailyLog(**row) if row else None


def list_daily_logs(
    conn: "DictConn", user_id: str, experiment_id: str
) -> list[DailyLog]:
    rows = conn.execute(
        "SELECT * FROM daily_log WHERE user_id = %s AND experiment_id = %s ORDER BY date",
        (user_id, experiment_id),
    ).fetchall()
    return [DailyLog(**r) for r in rows]


def update_daily_log(
    conn: "DictConn", user_id: str, log_id: str, data: DailyLogUpdate
) -> DailyLog:
    fields = data.model_dump(exclude_unset=True)
    if "adherence" in fields and fields["adherence"] is not None:
        fields["adherence"] = fields["adherence"].value
    if not fields:
        row = conn.execute(
            "SELECT * FROM daily_log WHERE id = %s AND user_id = %s",
            (log_id, user_id),
        ).fetchone()
    else:
        sets = ", ".join(f"{k} = %s" for k in fields)
        row = conn.execute(
            f"UPDATE daily_log SET {sets}, updated_at = now() "
            "WHERE id = %s AND user_id = %s RETURNING *",
            list(fields.values()) + [log_id, user_id],
        ).fetchone()
        conn.commit()
    if row is None:
        raise NotFoundError(f"Daily log {log_id} not found.")
    return DailyLog(**row)


# ─── Meals ───────────────────────────────────────────────────────────
def add_meal(
    conn: "DictConn", user_id: str, daily_log_id: str, data: MealCreate
) -> MealLog:
    owns = conn.execute(
        "SELECT 1 FROM daily_log WHERE id = %s AND user_id = %s",
        (daily_log_id, user_id),
    ).fetchone()
    if owns is None:
        raise NotFoundError(f"Daily log {daily_log_id} not found.")
    meal_id = new_id("meal")
    row = conn.execute(
        """
        INSERT INTO meal_log (id, user_id, daily_log_id, eaten_at, description, tags, photo_url)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """,
        (
            meal_id,
            user_id,
            daily_log_id,
            data.eaten_at,
            data.description,
            data.tags,
            data.photo_url,
        ),
    ).fetchone()
    conn.commit()
    return MealLog(**require(row))


def list_meals(conn: "DictConn", daily_log_id: str) -> list[MealLog]:
    rows = conn.execute(
        "SELECT * FROM meal_log WHERE daily_log_id = %s ORDER BY eaten_at NULLS LAST",
        (daily_log_id,),
    ).fetchall()
    return [MealLog(**r) for r in rows]


def update_meal(
    conn: "DictConn", user_id: str, meal_id: str, data: MealUpdate
) -> MealLog:
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        row = conn.execute(
            "SELECT * FROM meal_log WHERE id = %s AND user_id = %s", (meal_id, user_id)
        ).fetchone()
    else:
        sets = ", ".join(f"{k} = %s" for k in fields)
        row = conn.execute(
            f"UPDATE meal_log SET {sets} WHERE id = %s AND user_id = %s RETURNING *",
            list(fields.values()) + [meal_id, user_id],
        ).fetchone()
        conn.commit()
    if row is None:
        raise NotFoundError(f"Meal {meal_id} not found.")
    return MealLog(**row)


# ─── Confounders ─────────────────────────────────────────────────────
def add_confounder(
    conn: "DictConn", user_id: str, experiment_id: str, data: ConfounderCreate
) -> Confounder:
    get_experiment(conn, user_id, experiment_id)  # ownership + existence
    cf_id = new_id("cf")
    row = conn.execute(
        """
        INSERT INTO confounder (id, user_id, experiment_id, date, kind, severity, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """,
        (
            cf_id,
            user_id,
            experiment_id,
            data.date,
            data.kind.value,
            data.severity.value,
            data.notes,
        ),
    ).fetchone()
    conn.commit()
    return Confounder(**require(row))


def list_confounders(
    conn: "DictConn", user_id: str, experiment_id: str
) -> list[Confounder]:
    rows = conn.execute(
        "SELECT * FROM confounder WHERE user_id = %s AND experiment_id = %s ORDER BY date",
        (user_id, experiment_id),
    ).fetchall()
    return [Confounder(**r) for r in rows]
