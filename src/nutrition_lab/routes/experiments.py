"""Experiment CRUD + lifecycle routes."""
from __future__ import annotations

from ..db import DictConn
from fastapi import APIRouter, Body

from .. import experiments as svc
from ..models import (
    Experiment,
    ExperimentCreate,
    ExperimentDetail,
    ExperimentUpdate,
    SafetyWarning,
)
from ..safety import check_protocol
from .deps import ConnDep, UserDep, to_http

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


@router.get("", response_model=list[Experiment])
def list_experiments(conn: DictConn = ConnDep, user_id: str = UserDep):
    return svc.list_experiments(conn, user_id)


@router.post("", response_model=Experiment, status_code=201)
def create_experiment(
    data: ExperimentCreate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.create_experiment(conn, user_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.get("/{experiment_id}", response_model=ExperimentDetail)
def get_experiment(
    experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep
):
    try:
        return svc.get_experiment_detail(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.patch("/{experiment_id}", response_model=Experiment)
def update_experiment(
    experiment_id: str,
    data: ExperimentUpdate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.update_experiment(conn, user_id, experiment_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.post("/{experiment_id}/start", response_model=Experiment)
def start(experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep):
    try:
        return svc.start_experiment(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.post("/{experiment_id}/pause", response_model=Experiment)
def pause(experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep):
    try:
        return svc.pause_experiment(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.post("/{experiment_id}/resume", response_model=Experiment)
def resume(experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep):
    try:
        return svc.resume_experiment(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.post("/{experiment_id}/complete", response_model=Experiment)
def complete(experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep):
    try:
        return svc.complete_experiment(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.post("/{experiment_id}/abandon", response_model=Experiment)
def abandon(
    experiment_id: str,
    stop_reason: str = Body(..., embed=True),
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.abandon_experiment(conn, user_id, experiment_id, stop_reason)
    except Exception as exc:
        raise to_http(exc)


@router.post("/check-safety", response_model=list[SafetyWarning])
def check_safety(
    question: str = Body(""),
    hypothesis: str = Body(""),
    intervention_rule: str = Body(""),
    intervention_window_days: int | None = Body(None),
    primary_outcome_kind: str | None = Body(None),
):
    """Advisory protocol guardrails for the experiment builder."""
    return check_protocol(
        question=question,
        hypothesis=hypothesis,
        intervention_rule=intervention_rule,
        intervention_window_days=intervention_window_days,
        primary_outcome_kind=primary_outcome_kind,
    )
