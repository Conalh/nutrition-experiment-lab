"""Auth: signup/login/logout/me, 401 gating, and per-user isolation."""
from __future__ import annotations

from fastapi.testclient import TestClient

from nutrition_lab.api import create_app


def _fresh_client() -> TestClient:
    return TestClient(create_app())


def test_unauthenticated_requests_are_rejected(conn):
    c = _fresh_client()
    assert c.get("/api/experiments").status_code == 401
    assert c.post("/api/demo").status_code == 401
    assert c.get("/api/account/export").status_code == 401


def test_signup_login_logout_me(conn):
    c = _fresh_client()
    r = c.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "password123"},
    )
    assert r.status_code == 201
    assert r.json()["email"] == "a@example.com"

    assert c.get("/api/auth/me").json()["email"] == "a@example.com"
    assert c.get("/api/experiments").status_code == 200

    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").status_code == 401
    assert c.get("/api/experiments").status_code == 401

    assert (
        c.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong"}).status_code
        == 401
    )
    assert (
        c.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "password123"},
        ).status_code
        == 200
    )


def test_logout_revokes_outstanding_tokens(conn):
    """A token captured before logout must stop working after logout
    (session-epoch revocation), not just be cleared from the browser."""
    c = _fresh_client()
    c.post("/api/auth/signup", json={"email": "rev@example.com", "password": "password123"})
    token = c.cookies.get("nl_session")
    assert token  # the signed session cookie
    assert c.get("/api/auth/me").status_code == 200

    c.post("/api/auth/logout")

    # Replay the captured token on a fresh client → rejected.
    stolen = _fresh_client()
    stolen.cookies.set("nl_session", token)
    assert stolen.get("/api/auth/me").status_code == 401
    assert stolen.get("/api/experiments").status_code == 401


def test_change_password(conn):
    c = _fresh_client()
    c.post("/api/auth/signup", json={"email": "pw@example.com", "password": "password123"})
    old_token = c.cookies.get("nl_session")

    # Wrong current password / too-short new password → 400.
    assert c.post("/api/auth/change-password", json={"current_password": "nope", "new_password": "newpassword1"}).status_code == 400
    assert c.post("/api/auth/change-password", json={"current_password": "password123", "new_password": "short"}).status_code == 400

    # Successful change keeps this session alive (cookie re-issued)…
    assert c.post("/api/auth/change-password", json={"current_password": "password123", "new_password": "newpassword1"}).status_code == 200
    assert c.get("/api/auth/me").status_code == 200

    # …revokes the pre-change token…
    stolen = _fresh_client()
    stolen.cookies.set("nl_session", old_token)
    assert stolen.get("/api/auth/me").status_code == 401

    # …and the new password is what works now.
    fresh = _fresh_client()
    assert fresh.post("/api/auth/login", json={"email": "pw@example.com", "password": "password123"}).status_code == 401
    assert fresh.post("/api/auth/login", json={"email": "pw@example.com", "password": "newpassword1"}).status_code == 200


def test_duplicate_email_rejected(conn):
    c = _fresh_client()
    body = {"email": "dup@example.com", "password": "password123"}
    assert c.post("/api/auth/signup", json=body).status_code == 201
    c2 = _fresh_client()
    assert c2.post("/api/auth/signup", json=body).status_code == 400


def test_short_password_rejected(conn):
    c = _fresh_client()
    r = c.post("/api/auth/signup", json={"email": "x@example.com", "password": "short"})
    assert r.status_code == 400


def test_users_are_isolated(conn):
    """One user's experiments are invisible to another."""
    alice = _fresh_client()
    alice.post("/api/auth/signup", json={"email": "alice@example.com", "password": "password123"})
    alice.post("/api/demo")  # seeds a demo experiment for Alice
    assert len(alice.get("/api/experiments").json()) == 1

    bob = _fresh_client()
    bob.post("/api/auth/signup", json={"email": "bob@example.com", "password": "password123"})
    assert bob.get("/api/experiments").json() == []  # Bob sees nothing of Alice's

    # Bob cannot fetch Alice's experiment by id.
    alice_exp_id = alice.get("/api/experiments").json()[0]["id"]
    assert bob.get(f"/api/experiments/{alice_exp_id}").status_code == 404


def test_cannot_modify_another_users_intervention_or_outcome(conn):
    """IDOR regression: PATCH on a sibling's intervention/outcome by id must
    not read or write across tenants."""
    alice = _fresh_client()
    alice.post("/api/auth/signup", json={"email": "alice2@example.com", "password": "password123"})
    exp = alice.post("/api/experiments", json={"title": "A", "question": "Q?"}).json()
    iv = alice.post(
        f"/api/experiments/{exp['id']}/interventions",
        json={"name": "secret rule", "rule_text": "private"},
    ).json()
    oc = alice.post(
        f"/api/experiments/{exp['id']}/outcomes",
        json={"name": "hunger", "metric": "hunger", "is_primary": True},
    ).json()

    bob = _fresh_client()
    bob.post("/api/auth/signup", json={"email": "bob2@example.com", "password": "password123"})

    # Cross-tenant write attempts → 404, not 200.
    assert bob.patch(f"/api/interventions/{iv['id']}", json={"name": "hacked"}).status_code == 404
    assert bob.patch(f"/api/outcomes/{oc['id']}", json={"name": "hacked"}).status_code == 404
    # Empty-body PATCH must not leak the row either.
    assert bob.patch(f"/api/outcomes/{oc['id']}", json={}).status_code == 404

    # Cross-tenant DELETE attempts → 404.
    assert bob.delete(f"/api/interventions/{iv['id']}").status_code == 404
    assert bob.delete(f"/api/outcomes/{oc['id']}").status_code == 404
    assert bob.delete(f"/api/experiments/{exp['id']}").status_code == 404

    # Alice's data is untouched.
    detail = alice.get(f"/api/experiments/{exp['id']}").json()
    assert detail["interventions"][0]["name"] == "secret rule"
    assert detail["outcomes"][0]["name"] == "hunger"
