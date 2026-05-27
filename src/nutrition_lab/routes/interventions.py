"""Intervention and outcome-definition routes."""
from __future__ import annotations

from ..db import DictConn
from fastapi import APIRouter

from .. import experiments as svc
from ..models import (
    Intervention,
    InterventionCreate,
    InterventionUpdate,
    OutcomeCreate,
    OutcomeDefinition,
    OutcomeUpdate,
)
from .deps import ConnDep, UserDep, to_http

router = APIRouter(prefix="/api", tags=["interventions"])


@router.post(
    "/experiments/{experiment_id}/interventions",
    response_model=Intervention,
    status_code=201,
)
def add_intervention(
    experiment_id: str,
    data: InterventionCreate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.add_intervention(conn, user_id, experiment_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.patch("/interventions/{intervention_id}", response_model=Intervention)
def update_intervention(
    intervention_id: str,
    data: InterventionUpdate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.update_intervention(conn, intervention_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.post(
    "/experiments/{experiment_id}/outcomes",
    response_model=OutcomeDefinition,
    status_code=201,
)
def add_outcome(
    experiment_id: str,
    data: OutcomeCreate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.add_outcome(conn, user_id, experiment_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.patch("/outcomes/{outcome_id}", response_model=OutcomeDefinition)
def update_outcome(
    outcome_id: str,
    data: OutcomeUpdate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.update_outcome(conn, outcome_id, data)
    except Exception as exc:
        raise to_http(exc)
