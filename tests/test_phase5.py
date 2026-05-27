"""Phase 5: PDF export, account export, and account data deletion."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from nutrition_lab import account as account_svc
from nutrition_lab import experiments as exp_svc
from nutrition_lab import logging as log_svc
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
        title="Protein breakfast", question="Cut afternoon hunger?",
        baseline_start=B_START, baseline_end=B_END,
        intervention_start=I_START, intervention_end=I_END))
    exp_svc.add_intervention(conn, user_id, exp.id,
                             InterventionCreate(name="40g protein", rule_text="40g am"))
    exp_svc.add_outcome(conn, user_id, exp.id, OutcomeCreate(
        name="Hunger", direction=OutcomeDirection.lower_better,
        kind=OutcomeKind.rating, metric=Metric.hunger, is_primary=True))
    exp_svc.start_experiment(conn, user_id, exp.id)
    day = B_START
    while day <= I_END:
        intervention = day >= I_START
        log = log_svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
            experiment_id=exp.id, date=day,
            hunger=2 if intervention else 4,
            adherence="yes" if intervention else None))
        log_svc.add_meal(conn, user_id, log.id, MealCreate(description="Yogurt"))
        day += timedelta(days=1)
    exp_svc.complete_experiment(conn, user_id, exp.id)
    return exp


@pytest.fixture
def client(conn):
    return TestClient(create_app())


def test_pdf_endpoint_returns_pdf(client, conn, user_id):
    exp = _populate(conn, user_id)
    r = client.get(f"/api/experiments/{exp.id}/report.pdf")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    assert "attachment" in r.headers["content-disposition"]


def test_account_export_bundle(conn, user_id):
    exp = _populate(conn, user_id)
    bundle = account_svc.export_account(conn, user_id)
    assert bundle["user"]["id"] == user_id
    assert len(bundle["experiments"]) == 1
    assert bundle["experiments"][0]["id"] == exp.id
    assert len(bundle["daily_logs"]) == 21
    assert len(bundle["meals"]) == 21
    assert len(bundle["interventions"]) == 1
    assert len(bundle["outcomes"]) == 1
    # Dates are serialised to strings for portability.
    assert isinstance(bundle["daily_logs"][0]["date"], str)


def test_account_export_route(client, conn, user_id):
    _populate(conn, user_id)
    r = client.get("/api/account/export")
    assert r.status_code == 200
    assert r.json()["user"]["id"] == user_id


def test_delete_wipes_data_keeps_user(client, conn, user_id):
    _populate(conn, user_id)
    r = client.delete("/api/account/data")
    assert r.status_code == 200
    deleted = r.json()["deleted"]
    assert deleted["experiment"] == 1
    assert deleted["daily_log"] == 21

    # Everything is gone…
    assert exp_svc.list_experiments(conn, user_id) == []
    # …but the user identity row survives.
    row = conn.execute(
        "SELECT id FROM app_user WHERE id = %s", (user_id,)
    ).fetchone()
    assert row is not None


def test_delete_is_idempotent(client, conn, user_id):
    _populate(conn, user_id)
    client.delete("/api/account/data")
    r = client.delete("/api/account/data")
    assert r.status_code == 200
    assert r.json()["deleted"]["experiment"] == 0
