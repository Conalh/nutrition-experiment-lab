"""The load-demo endpoint that powers dashboard onboarding."""
from __future__ import annotations

from nutrition_lab import experiments as exp_svc


def test_seed_demo_creates_a_completed_experiment(client, conn, auth_user_id):
    assert exp_svc.list_experiments(conn, auth_user_id) == []

    r = client.post("/api/demo")
    assert r.status_code == 200, r.text
    exp_id = r.json()["experiment_id"]

    experiments = exp_svc.list_experiments(conn, auth_user_id)
    assert len(experiments) == 1
    exp = experiments[0]
    assert exp.id == exp_id
    assert exp.status == "completed"

    # It comes with a protocol and logged data so the report renders.
    detail = exp_svc.get_experiment_detail(conn, auth_user_id, exp_id)
    assert len(detail.interventions) >= 1
    assert any(o.is_primary for o in detail.outcomes)
