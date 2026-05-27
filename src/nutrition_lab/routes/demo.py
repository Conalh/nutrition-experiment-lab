"""Demo-seed route — powers the dashboard's one-click 'Load a demo'."""
from __future__ import annotations

from fastapi import APIRouter

from .. import demo as demo_svc
from ..db import DictConn
from .deps import ConnDep, UserDep

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("")
def seed_demo(conn: DictConn = ConnDep, user_id: str = UserDep) -> dict[str, str]:
    """Seed a fully-populated completed demo experiment for the user."""
    experiment_id = demo_svc.seed_demo(conn, user_id)
    return {"experiment_id": experiment_id}
