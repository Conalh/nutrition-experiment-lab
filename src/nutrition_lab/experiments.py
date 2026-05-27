"""Experiment lifecycle, CRUD, interventions, and outcome definitions.

Validation lives here rather than in the route layer so the same rules
apply whether a caller comes through the API, a script, or a test.

Two domain errors are raised for the caller to map to HTTP:
- ``ValidationError`` for bad input (date windows, missing fields).
- ``TransitionError`` for illegal lifecycle moves.
"""
from __future__ import annotations

from datetime import date

from .db import DictConn, new_id, require
from .models import (
    Experiment,
    ExperimentCreate,
    ExperimentDetail,
    ExperimentStatus,
    ExperimentUpdate,
    Intervention,
    InterventionCreate,
    InterventionUpdate,
    OutcomeCreate,
    OutcomeDefinition,
    OutcomeUpdate,
)


class ValidationError(ValueError):
    """Bad input — maps to HTTP 422/400."""


class TransitionError(ValueError):
    """Illegal lifecycle transition — maps to HTTP 409."""


class NotFoundError(LookupError):
    """Missing row — maps to HTTP 404."""


# Allowed status transitions. A draft can be edited freely; once active the
# experiment can pause/resume, complete, or be abandoned. Terminal states
# (completed/abandoned) accept no further transitions.
_TRANSITIONS: dict[ExperimentStatus, set[ExperimentStatus]] = {
    ExperimentStatus.draft: {ExperimentStatus.active, ExperimentStatus.abandoned},
    ExperimentStatus.active: {
        ExperimentStatus.paused,
        ExperimentStatus.completed,
        ExperimentStatus.abandoned,
    },
    ExperimentStatus.paused: {
        ExperimentStatus.active,
        ExperimentStatus.completed,
        ExperimentStatus.abandoned,
    },
    ExperimentStatus.completed: set(),
    ExperimentStatus.abandoned: set(),
}


# ─── Date-window validation ──────────────────────────────────────────
def validate_windows(exp: Experiment | ExperimentCreate) -> None:
    """Ensure phase windows are internally ordered and don't overlap.
    Order: baseline → (optional washout) → intervention. Each window's
    start must precede its end; later windows must start after earlier
    windows end. Partial windows (one date missing) are rejected."""

    def pair(start: date | None, end: date | None, label: str) -> tuple[date, date] | None:
        if start is None and end is None:
            return None
        if start is None or end is None:
            raise ValidationError(f"{label} window needs both a start and an end date.")
        if start > end:
            raise ValidationError(f"{label} start must be on or before its end.")
        return (start, end)

    baseline = pair(exp.baseline_start, exp.baseline_end, "Baseline")
    washout = pair(exp.washout_start, exp.washout_end, "Washout")
    intervention = pair(exp.intervention_start, exp.intervention_end, "Intervention")

    ordered = [w for w in (baseline, washout, intervention) if w is not None]
    for (s1, e1), (s2, e2) in zip(ordered, ordered[1:]):
        if s2 <= e1:
            raise ValidationError(
                "Experiment phases must not overlap and must run in order: "
                "baseline, then washout, then intervention."
            )

    # A washout without surrounding phases is meaningless.
    if washout is not None and (baseline is None or intervention is None):
        raise ValidationError(
            "A washout window only makes sense between a baseline and an "
            "intervention window."
        )


# ─── Row → model ─────────────────────────────────────────────────────
def _experiment_from_row(row: dict | None) -> Experiment:
    return Experiment(**require(row))


# ─── Experiment CRUD ─────────────────────────────────────────────────
def create_experiment(
    conn: "DictConn", user_id: str, data: ExperimentCreate
) -> Experiment:
    if not data.title.strip():
        raise ValidationError("Title is required.")
    if not data.question.strip():
        raise ValidationError("A question is required.")
    validate_windows(data)

    exp_id = new_id("exp")
    row = conn.execute(
        """
        INSERT INTO experiment (
            id, user_id, title, question, hypothesis, status,
            baseline_start, baseline_end, washout_start, washout_end,
            intervention_start, intervention_end, primary_outcome
        ) VALUES (%s,%s,%s,%s,%s,'draft',%s,%s,%s,%s,%s,%s,%s)
        RETURNING *
        """,
        (
            exp_id,
            user_id,
            data.title.strip(),
            data.question.strip(),
            data.hypothesis,
            data.baseline_start,
            data.baseline_end,
            data.washout_start,
            data.washout_end,
            data.intervention_start,
            data.intervention_end,
            data.primary_outcome,
        ),
    ).fetchone()
    conn.commit()
    return _experiment_from_row(row)


def list_experiments(conn: "DictConn", user_id: str) -> list[Experiment]:
    rows = conn.execute(
        "SELECT * FROM experiment WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    return [_experiment_from_row(r) for r in rows]


def get_experiment(
    conn: "DictConn", user_id: str, experiment_id: str
) -> Experiment:
    row = conn.execute(
        "SELECT * FROM experiment WHERE id = %s AND user_id = %s",
        (experiment_id, user_id),
    ).fetchone()
    if row is None:
        raise NotFoundError(f"Experiment {experiment_id} not found.")
    return _experiment_from_row(row)


def get_experiment_detail(
    conn: "DictConn", user_id: str, experiment_id: str
) -> ExperimentDetail:
    experiment = get_experiment(conn, user_id, experiment_id)
    interventions = list_interventions(conn, experiment_id)
    outcomes = list_outcomes(conn, experiment_id)
    return ExperimentDetail(
        experiment=experiment, interventions=interventions, outcomes=outcomes
    )


def update_experiment(
    conn: "DictConn",
    user_id: str,
    experiment_id: str,
    data: ExperimentUpdate,
) -> Experiment:
    current = get_experiment(conn, user_id, experiment_id)
    if current.status in (ExperimentStatus.completed, ExperimentStatus.abandoned):
        raise TransitionError("A finished experiment can no longer be edited.")

    merged = current.model_copy(update=data.model_dump(exclude_unset=True))
    validate_windows(merged)

    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return current
    sets = ", ".join(f"{k} = %s" for k in fields)
    params = list(fields.values()) + [experiment_id, user_id]
    row = conn.execute(
        f"UPDATE experiment SET {sets}, updated_at = now() "
        "WHERE id = %s AND user_id = %s RETURNING *",
        params,
    ).fetchone()
    conn.commit()
    return _experiment_from_row(row)


def delete_experiment(conn: "DictConn", user_id: str, experiment_id: str) -> None:
    """Delete an experiment and (via FK cascade) all its logs, meals,
    interventions, outcomes, confounders, and snapshots. 404 if not owned."""
    cur = conn.execute(
        "DELETE FROM experiment WHERE id = %s AND user_id = %s",
        (experiment_id, user_id),
    )
    conn.commit()
    if cur.rowcount == 0:
        raise NotFoundError(f"Experiment {experiment_id} not found.")


# ─── Lifecycle ───────────────────────────────────────────────────────
def _transition(
    conn: "DictConn",
    user_id: str,
    experiment_id: str,
    target: ExperimentStatus,
    *,
    stop_reason: str | None = None,
) -> Experiment:
    current = get_experiment(conn, user_id, experiment_id)
    if target not in _TRANSITIONS[current.status]:
        raise TransitionError(
            f"Cannot move an experiment from '{current.status.value}' to "
            f"'{target.value}'."
        )
    row = conn.execute(
        "UPDATE experiment SET status = %s, stop_reason = %s, updated_at = now() "
        "WHERE id = %s AND user_id = %s RETURNING *",
        (target.value, stop_reason, experiment_id, user_id),
    ).fetchone()
    conn.commit()
    return _experiment_from_row(row)


def start_experiment(
    conn: "DictConn", user_id: str, experiment_id: str
) -> Experiment:
    exp = get_experiment(conn, user_id, experiment_id)
    # Starting requires a coherent baseline and intervention window and at
    # least one outcome to measure — otherwise there's nothing to learn.
    if exp.baseline_start is None or exp.intervention_start is None:
        raise ValidationError(
            "Set a baseline and an intervention window before starting."
        )
    if not list_outcomes(conn, experiment_id):
        raise ValidationError("Define at least one outcome before starting.")
    if not list_interventions(conn, experiment_id):
        raise ValidationError("Define the intervention before starting.")
    return _transition(conn, user_id, experiment_id, ExperimentStatus.active)


def pause_experiment(
    conn: "DictConn", user_id: str, experiment_id: str
) -> Experiment:
    return _transition(conn, user_id, experiment_id, ExperimentStatus.paused)


def resume_experiment(
    conn: "DictConn", user_id: str, experiment_id: str
) -> Experiment:
    return _transition(conn, user_id, experiment_id, ExperimentStatus.active)


def complete_experiment(
    conn: "DictConn", user_id: str, experiment_id: str
) -> Experiment:
    return _transition(conn, user_id, experiment_id, ExperimentStatus.completed)


def abandon_experiment(
    conn: "DictConn",
    user_id: str,
    experiment_id: str,
    stop_reason: str,
) -> Experiment:
    # The plan requires a neutral reason for stopping early, so we don't
    # nudge the user toward guilt or "failure" framing.
    if not stop_reason or not stop_reason.strip():
        raise ValidationError(
            "Add a short, neutral reason for stopping (e.g. 'schedule "
            "changed', 'lost interest', 'too hard to log')."
        )
    return _transition(
        conn,
        user_id,
        experiment_id,
        ExperimentStatus.abandoned,
        stop_reason=stop_reason.strip(),
    )


# ─── Interventions ───────────────────────────────────────────────────
def _ensure_experiment(conn: "DictConn", user_id: str, experiment_id: str) -> None:
    get_experiment(conn, user_id, experiment_id)  # raises NotFoundError


def add_intervention(
    conn: "DictConn",
    user_id: str,
    experiment_id: str,
    data: InterventionCreate,
) -> Intervention:
    _ensure_experiment(conn, user_id, experiment_id)
    iv_id = new_id("iv")
    row = conn.execute(
        """
        INSERT INTO intervention
            (id, experiment_id, name, rule_text, category, expected_effect, safety_note)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """,
        (
            iv_id,
            experiment_id,
            data.name,
            data.rule_text,
            data.category.value,
            data.expected_effect,
            data.safety_note,
        ),
    ).fetchone()
    conn.commit()
    return Intervention(**require(row))


def list_interventions(conn: "DictConn", experiment_id: str) -> list[Intervention]:
    rows = conn.execute(
        "SELECT * FROM intervention WHERE experiment_id = %s ORDER BY name",
        (experiment_id,),
    ).fetchall()
    return [Intervention(**r) for r in rows]


def update_intervention(
    conn: "DictConn", user_id: str, intervention_id: str, data: InterventionUpdate
) -> Intervention:
    # Ownership gate: the intervention must belong to an experiment owned by
    # this user. Treat "not yours" as 404 so we don't leak which ids exist.
    owns = conn.execute(
        "SELECT 1 FROM intervention i JOIN experiment e ON i.experiment_id = e.id "
        "WHERE i.id = %s AND e.user_id = %s",
        (intervention_id, user_id),
    ).fetchone()
    if owns is None:
        raise NotFoundError(f"Intervention {intervention_id} not found.")

    fields = data.model_dump(exclude_unset=True)
    if "category" in fields and fields["category"] is not None:
        fields["category"] = fields["category"].value
    if not fields:
        row = conn.execute(
            "SELECT * FROM intervention WHERE id = %s", (intervention_id,)
        ).fetchone()
    else:
        sets = ", ".join(f"{k} = %s" for k in fields)
        row = conn.execute(
            f"UPDATE intervention SET {sets} WHERE id = %s RETURNING *",
            list(fields.values()) + [intervention_id],
        ).fetchone()
        conn.commit()
    return Intervention(**require(row))


def delete_intervention(
    conn: "DictConn", user_id: str, intervention_id: str
) -> None:
    cur = conn.execute(
        "DELETE FROM intervention WHERE id = %s AND experiment_id IN "
        "(SELECT id FROM experiment WHERE user_id = %s)",
        (intervention_id, user_id),
    )
    conn.commit()
    if cur.rowcount == 0:
        raise NotFoundError(f"Intervention {intervention_id} not found.")


# ─── Outcome definitions ─────────────────────────────────────────────
def add_outcome(
    conn: "DictConn",
    user_id: str,
    experiment_id: str,
    data: OutcomeCreate,
) -> OutcomeDefinition:
    _ensure_experiment(conn, user_id, experiment_id)
    # Only one primary outcome per experiment: setting a new primary demotes
    # any existing one, keeping the "one clear question" discipline.
    if data.is_primary:
        conn.execute(
            "UPDATE outcome_definition SET is_primary = FALSE WHERE experiment_id = %s",
            (experiment_id,),
        )
    oc_id = new_id("oc")
    row = conn.execute(
        """
        INSERT INTO outcome_definition
            (id, experiment_id, name, kind, direction, metric,
             target_min, target_max, unit, is_primary)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """,
        (
            oc_id,
            experiment_id,
            data.name,
            data.kind.value,
            data.direction.value,
            data.metric.value if data.metric else None,
            data.target_min,
            data.target_max,
            data.unit,
            data.is_primary,
        ),
    ).fetchone()
    conn.commit()
    return OutcomeDefinition(**require(row))


def list_outcomes(conn: "DictConn", experiment_id: str) -> list[OutcomeDefinition]:
    rows = conn.execute(
        "SELECT * FROM outcome_definition WHERE experiment_id = %s "
        "ORDER BY is_primary DESC, name",
        (experiment_id,),
    ).fetchall()
    return [OutcomeDefinition(**r) for r in rows]


def update_outcome(
    conn: "DictConn", user_id: str, outcome_id: str, data: OutcomeUpdate
) -> OutcomeDefinition:
    # Ownership gate via the parent experiment's owner (404 if not yours).
    current = conn.execute(
        "SELECT o.experiment_id FROM outcome_definition o "
        "JOIN experiment e ON o.experiment_id = e.id "
        "WHERE o.id = %s AND e.user_id = %s",
        (outcome_id, user_id),
    ).fetchone()
    if current is None:
        raise NotFoundError(f"Outcome {outcome_id} not found.")

    fields = data.model_dump(exclude_unset=True)
    for enum_field in ("kind", "direction", "metric"):
        if enum_field in fields and fields[enum_field] is not None:
            fields[enum_field] = fields[enum_field].value
    if not fields:
        row = conn.execute(
            "SELECT * FROM outcome_definition WHERE id = %s", (outcome_id,)
        ).fetchone()
        return OutcomeDefinition(**require(row))

    if fields.get("is_primary"):
        conn.execute(
            "UPDATE outcome_definition SET is_primary = FALSE "
            "WHERE experiment_id = %s AND id <> %s",
            (current["experiment_id"], outcome_id),
        )
    sets = ", ".join(f"{k} = %s" for k in fields)
    row = conn.execute(
        f"UPDATE outcome_definition SET {sets} WHERE id = %s RETURNING *",
        list(fields.values()) + [outcome_id],
    ).fetchone()
    conn.commit()
    return OutcomeDefinition(**require(row))


def delete_outcome(conn: "DictConn", user_id: str, outcome_id: str) -> None:
    cur = conn.execute(
        "DELETE FROM outcome_definition WHERE id = %s AND experiment_id IN "
        "(SELECT id FROM experiment WHERE user_id = %s)",
        (outcome_id, user_id),
    )
    conn.commit()
    if cur.rowcount == 0:
        raise NotFoundError(f"Outcome {outcome_id} not found.")
