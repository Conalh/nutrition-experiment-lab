"""Phase 2: daily logging, meals, confounders."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from nutrition_lab import experiments as exp_svc
from nutrition_lab import logging as svc
from nutrition_lab.models import (
    Adherence,
    ConfounderCreate,
    ConfounderKind,
    DailyLogUpdate,
    DailyLogUpsert,
    ExperimentCreate,
    MealCreate,
    MealUpdate,
    Phase,
    Severity,
)

TODAY = date(2026, 1, 1)


def _experiment(conn, user_id):
    return exp_svc.create_experiment(conn, user_id, ExperimentCreate(
        title="x", question="q?",
        baseline_start=TODAY, baseline_end=TODAY + timedelta(days=6),
        intervention_start=TODAY + timedelta(days=7),
        intervention_end=TODAY + timedelta(days=20),
    ))


def test_daily_log_upsert_is_idempotent_per_date(conn, user_id):
    exp = _experiment(conn, user_id)
    first = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY, hunger=4))
    second = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY, hunger=2))
    logs = svc.list_daily_logs(conn, user_id, exp.id)
    assert len(logs) == 1  # no duplicate row for same (experiment, date)
    assert logs[0].hunger == 2
    assert first.id == second.id


def test_phase_is_derived(conn, user_id):
    exp = _experiment(conn, user_id)
    baseline = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY, adherence=Adherence.not_applicable))
    intervention = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY + timedelta(days=10),
        adherence=Adherence.yes))
    outside = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY + timedelta(days=60)))
    assert baseline.phase == Phase.baseline
    assert intervention.phase == Phase.intervention
    assert outside.phase is None


def test_update_daily_log(conn, user_id):
    exp = _experiment(conn, user_id)
    log = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY, energy=2))
    updated = svc.update_daily_log(conn, user_id, log.id,
                                   DailyLogUpdate(energy=5, notes="felt great"))
    assert updated.energy == 5
    assert updated.notes == "felt great"


def test_meal_add_and_edit(conn, user_id):
    exp = _experiment(conn, user_id)
    log = svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=TODAY))
    meal = svc.add_meal(conn, user_id, log.id, MealCreate(
        eaten_at=datetime(2026, 1, 1, 8, 0),
        description="Oats", tags=["breakfast"]))
    assert meal.tags == ["breakfast"]
    edited = svc.update_meal(conn, user_id, meal.id,
                             MealUpdate(description="Oats + whey",
                                        tags=["breakfast", "high-protein"]))
    assert edited.description == "Oats + whey"
    assert edited.tags == ["breakfast", "high-protein"]
    assert len(svc.list_meals(conn, log.id)) == 1


def test_confounder_create_and_list(conn, user_id):
    exp = _experiment(conn, user_id)
    svc.add_confounder(conn, user_id, exp.id, ConfounderCreate(
        date=TODAY + timedelta(days=8), kind=ConfounderKind.alcohol,
        severity=Severity.medium, notes="wedding"))
    cfs = svc.list_confounders(conn, user_id, exp.id)
    assert len(cfs) == 1
    assert cfs[0].kind == ConfounderKind.alcohol
    assert cfs[0].severity == Severity.medium
