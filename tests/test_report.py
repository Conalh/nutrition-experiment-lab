"""Phase 3: report generation and analysis routes over HTTP."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from nutrition_lab import experiments as exp_svc
from nutrition_lab import logging as log_svc
from nutrition_lab import report as report_svc
from nutrition_lab.api import create_app
from nutrition_lab.models import (
    DailyLogUpsert,
    ExperimentCreate,
    InterventionCreate,
    MealCreate,
    Metric,
    OutcomeCreate,
    OutcomeDirection,
    OutcomeKind,
)

B_START = date(2026, 1, 1)
B_END = date(2026, 1, 7)
I_START = date(2026, 1, 8)
I_END = date(2026, 1, 21)


def _populate(conn, user_id):
    exp = exp_svc.create_experiment(conn, user_id, ExperimentCreate(
        title="Protein breakfast", question="Does it cut afternoon hunger?",
        hypothesis="More protein, less hunger.",
        baseline_start=B_START, baseline_end=B_END,
        intervention_start=I_START, intervention_end=I_END))
    exp_svc.add_intervention(conn, user_id, exp.id,
                             InterventionCreate(name="40g protein", rule_text="40g am"))
    exp_svc.add_outcome(conn, user_id, exp.id, OutcomeCreate(
        name="Afternoon hunger", direction=OutcomeDirection.lower_better,
        kind=OutcomeKind.rating, metric=Metric.hunger, is_primary=True))
    exp_svc.start_experiment(conn, user_id, exp.id)

    day = B_START
    while day <= I_END:
        intervention = day >= I_START
        log = log_svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
            experiment_id=exp.id, date=day,
            hunger=2 if intervention else 4,
            adherence="yes" if intervention else None))
        log_svc.add_meal(conn, user_id, log.id, MealCreate(
            description="Yogurt + whey" if intervention else "Toast",
            tags=["breakfast"]))
        day += timedelta(days=1)
    exp_svc.complete_experiment(conn, user_id, exp.id)
    return exp


def test_report_contents(conn, user_id):
    exp = _populate(conn, user_id)
    report = report_svc.build_report(conn, user_id, exp.id)
    assert report.question
    assert report.primary_outcome is not None
    assert report.primary_outcome.result.value == "improved"
    assert report.what_changed  # hunger moved
    assert report.decision == "Completed."
    # Meal examples for both phases present.
    phases = {m.phase.value for m in report.meal_examples}
    assert {"baseline", "intervention"} <= phases
    assert any("single-person" in c for c in report.caveats)


@pytest.fixture
def client(conn):
    return TestClient(create_app())


def test_analysis_routes(client, conn, user_id):
    exp = _populate(conn, user_id)

    # No analysis yet → 404
    assert client.get(f"/api/experiments/{exp.id}/analysis").status_code == 404

    r = client.post(f"/api/experiments/{exp.id}/analyze")
    assert r.status_code == 200, r.text
    assert r.json()["confidence"] == "high"

    r = client.get(f"/api/experiments/{exp.id}/analysis")
    assert r.status_code == 200
    assert r.json()["adherence"]["trust"] == "high"

    r = client.get(f"/api/experiments/{exp.id}/report")
    assert r.status_code == 200, r.text
    assert r.json()["primary_outcome"]["result"] == "improved"
