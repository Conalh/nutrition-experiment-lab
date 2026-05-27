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
