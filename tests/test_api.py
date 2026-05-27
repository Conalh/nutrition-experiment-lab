"""Thin API-level smoke test through the FastAPI app via httpx."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from nutrition_lab.api import create_app

TODAY = date(2026, 1, 1)


@pytest.fixture
def client(conn):  # conn fixture truncates tables first
    return TestClient(create_app())


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_full_flow_over_http(client):
    payload = {
        "title": "Protein breakfast",
        "question": "Does protein breakfast reduce afternoon hunger?",
        "baseline_start": str(TODAY),
        "baseline_end": str(TODAY + timedelta(days=6)),
        "intervention_start": str(TODAY + timedelta(days=7)),
        "intervention_end": str(TODAY + timedelta(days=20)),
    }
    r = client.post("/api/experiments", json=payload)
    assert r.status_code == 201, r.text
    exp_id = r.json()["id"]

    client.post(f"/api/experiments/{exp_id}/interventions",
                json={"name": "40g protein", "rule_text": "40g at breakfast"})
    client.post(f"/api/experiments/{exp_id}/outcomes",
                json={"name": "Hunger", "direction": "lower_better", "is_primary": True})

    r = client.post(f"/api/experiments/{exp_id}/start")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "active"

    r = client.post("/api/daily-log",
                    json={"experiment_id": exp_id, "date": str(TODAY), "hunger": 4})
    assert r.status_code == 200, r.text

    r = client.get("/api/daily-log", params={"experiment_id": exp_id, "date": str(TODAY)})
    assert r.json()["hunger"] == 4

    r = client.post(f"/api/experiments/{exp_id}/complete")
    assert r.json()["status"] == "completed"


def test_illegal_transition_returns_409(client):
    r = client.post("/api/experiments", json={
        "title": "x", "question": "q?",
        "baseline_start": str(TODAY), "baseline_end": str(TODAY + timedelta(days=6)),
        "intervention_start": str(TODAY + timedelta(days=7)),
        "intervention_end": str(TODAY + timedelta(days=20)),
    })
    exp_id = r.json()["id"]
    # completing a draft is illegal
    assert client.post(f"/api/experiments/{exp_id}/complete").status_code == 409


def test_safety_endpoint(client):
    r = client.post("/api/experiments/check-safety", json={
        "intervention_rule": "Fast for 36 hours and eat under 800 calories.",
        "intervention_window_days": 3,
    })
    codes = {w["code"] for w in r.json()}
    assert "restrictive_protocol" in codes
