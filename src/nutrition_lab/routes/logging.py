"""Daily-log, meal, and confounder routes."""
from __future__ import annotations

from datetime import date

from ..db import DictConn
from fastapi import APIRouter, HTTPException, Query

from .. import logging as svc
from ..models import (
    Confounder,
    ConfounderCreate,
    DailyLog,
    DailyLogUpdate,
    DailyLogUpsert,
    MealCreate,
    MealLog,
    MealUpdate,
)
from .deps import ConnDep, UserDep, to_http

router = APIRouter(prefix="/api", tags=["logging"])


@router.get("/daily-log", response_model=DailyLog)
def get_daily_log(
    experiment_id: str = Query(...),
    date: date = Query(...),
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    log = svc.get_daily_log(conn, user_id, experiment_id, date)
    if log is None:
        raise HTTPException(status_code=404, detail="No log for that date.")
    return log


@router.post("/daily-log", response_model=DailyLog)
def upsert_daily_log(
    data: DailyLogUpsert, conn: DictConn = ConnDep, user_id: str = UserDep
):
    try:
        return svc.upsert_daily_log(conn, user_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.patch("/daily-log/{log_id}", response_model=DailyLog)
def update_daily_log(
    log_id: str,
    data: DailyLogUpdate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.update_daily_log(conn, user_id, log_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.post("/daily-log/{log_id}/meals", response_model=MealLog, status_code=201)
def add_meal(
    log_id: str,
    data: MealCreate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.add_meal(conn, user_id, log_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.patch("/meals/{meal_id}", response_model=MealLog)
def update_meal(
    meal_id: str,
    data: MealUpdate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.update_meal(conn, user_id, meal_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.post(
    "/experiments/{experiment_id}/confounders",
    response_model=Confounder,
    status_code=201,
)
def add_confounder(
    experiment_id: str,
    data: ConfounderCreate,
    conn: DictConn = ConnDep,
    user_id: str = UserDep,
):
    try:
        return svc.add_confounder(conn, user_id, experiment_id, data)
    except Exception as exc:
        raise to_http(exc)


@router.get(
    "/experiments/{experiment_id}/confounders", response_model=list[Confounder]
)
def list_confounders(
    experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep
):
    return svc.list_confounders(conn, user_id, experiment_id)
