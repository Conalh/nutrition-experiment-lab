"""Phase 1: experiment spine — windows, lifecycle, interventions, outcomes."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from nutrition_lab import experiments as svc
from nutrition_lab.experiments import TransitionError, ValidationError
from nutrition_lab.models import (
    ExperimentCreate,
    ExperimentStatus,
    InterventionCreate,
    OutcomeCreate,
    OutcomeDirection,
    OutcomeKind,
)

TODAY = date(2026, 1, 1)


def _windows(**over):
    base = dict(
        baseline_start=TODAY,
        baseline_end=TODAY + timedelta(days=6),
        intervention_start=TODAY + timedelta(days=7),
        intervention_end=TODAY + timedelta(days=20),
    )
    base.update(over)
    return base


def _make(conn, user_id, **over):
    data = ExperimentCreate(
        title="Protein breakfast",
        question="Does protein breakfast reduce afternoon hunger?",
        **_windows(**over),
    )
    return svc.create_experiment(conn, user_id, data)


def _ready(conn, user_id):
    """A draft with intervention + primary outcome, ready to start."""
    exp = _make(conn, user_id)
    svc.add_intervention(
        conn, user_id, exp.id,
        InterventionCreate(name="40g protein", rule_text="40g protein at breakfast"),
    )
    svc.add_outcome(
        conn, user_id, exp.id,
        OutcomeCreate(name="Hunger", kind=OutcomeKind.rating,
                      direction=OutcomeDirection.lower_better, is_primary=True),
    )
    return exp


# ─── Date windows ────────────────────────────────────────────────────
def test_valid_windows_accepted(conn, user_id):
    exp = _make(conn, user_id)
    assert exp.status == ExperimentStatus.draft


def test_reversed_window_rejected(conn, user_id):
    with pytest.raises(ValidationError):
        _make(conn, user_id, baseline_start=TODAY + timedelta(days=10),
              baseline_end=TODAY)


def test_overlapping_windows_rejected(conn, user_id):
    with pytest.raises(ValidationError):
        _make(conn, user_id, intervention_start=TODAY + timedelta(days=3))


def test_partial_window_rejected(conn, user_id):
    with pytest.raises(ValidationError):
        _make(conn, user_id, baseline_end=None)


def test_washout_without_neighbours_rejected(conn, user_id):
    with pytest.raises(ValidationError):
        svc.create_experiment(conn, user_id, ExperimentCreate(
            title="x", question="q?",
            washout_start=TODAY, washout_end=TODAY + timedelta(days=2),
        ))


# ─── Lifecycle ───────────────────────────────────────────────────────
def test_happy_path(conn, user_id):
    exp = _ready(conn, user_id)
    started = svc.start_experiment(conn, user_id, exp.id)
    assert started.status == ExperimentStatus.active
    completed = svc.complete_experiment(conn, user_id, exp.id)
    assert completed.status == ExperimentStatus.completed
    detail = svc.get_experiment_detail(conn, user_id, exp.id)
    assert len(detail.interventions) == 1
    assert len(detail.outcomes) == 1


def test_cannot_start_without_outcome(conn, user_id):
    exp = _make(conn, user_id)
    svc.add_intervention(conn, user_id, exp.id,
                         InterventionCreate(name="x", rule_text="y"))
    with pytest.raises(ValidationError):
        svc.start_experiment(conn, user_id, exp.id)


def test_cannot_complete_a_draft(conn, user_id):
    exp = _ready(conn, user_id)
    with pytest.raises(TransitionError):
        svc.complete_experiment(conn, user_id, exp.id)


def test_cannot_reactivate_completed(conn, user_id):
    exp = _ready(conn, user_id)
    svc.start_experiment(conn, user_id, exp.id)
    svc.complete_experiment(conn, user_id, exp.id)
    with pytest.raises(TransitionError):
        svc.resume_experiment(conn, user_id, exp.id)


def test_pause_and_resume(conn, user_id):
    exp = _ready(conn, user_id)
    svc.start_experiment(conn, user_id, exp.id)
    assert svc.pause_experiment(conn, user_id, exp.id).status == ExperimentStatus.paused
    assert svc.resume_experiment(conn, user_id, exp.id).status == ExperimentStatus.active


def test_abandon_requires_reason(conn, user_id):
    exp = _ready(conn, user_id)
    svc.start_experiment(conn, user_id, exp.id)
    with pytest.raises(ValidationError):
        svc.abandon_experiment(conn, user_id, exp.id, "   ")
    done = svc.abandon_experiment(conn, user_id, exp.id, "schedule changed")
    assert done.status == ExperimentStatus.abandoned
    assert done.stop_reason == "schedule changed"


# ─── Outcomes: single primary ────────────────────────────────────────
def test_only_one_primary_outcome(conn, user_id):
    exp = _make(conn, user_id)
    svc.add_outcome(conn, user_id, exp.id,
                    OutcomeCreate(name="A", is_primary=True))
    svc.add_outcome(conn, user_id, exp.id,
                    OutcomeCreate(name="B", is_primary=True))
    outcomes = svc.list_outcomes(conn, exp.id)
    assert sum(1 for o in outcomes if o.is_primary) == 1
    assert next(o for o in outcomes if o.is_primary).name == "B"


# ─── Delete ──────────────────────────────────────────────────────────
def test_delete_experiment_cascades(conn, user_id):
    exp = _ready(conn, user_id)
    svc.delete_experiment(conn, user_id, exp.id)
    with pytest.raises(svc.NotFoundError):
        svc.get_experiment(conn, user_id, exp.id)
    # children gone via cascade
    assert svc.list_interventions(conn, exp.id) == []
    assert svc.list_outcomes(conn, exp.id) == []


def test_delete_missing_experiment_raises(conn, user_id):
    with pytest.raises(svc.NotFoundError):
        svc.delete_experiment(conn, user_id, "exp_nope")


def test_delete_intervention_and_outcome(conn, user_id):
    exp = _make(conn, user_id)
    iv = svc.add_intervention(conn, user_id, exp.id,
                              InterventionCreate(name="x", rule_text="y"))
    oc = svc.add_outcome(conn, user_id, exp.id, OutcomeCreate(name="O"))
    svc.delete_intervention(conn, user_id, iv.id)
    svc.delete_outcome(conn, user_id, oc.id)
    assert svc.list_interventions(conn, exp.id) == []
    assert svc.list_outcomes(conn, exp.id) == []
