"""Account data controls: export and wipe (Phase 5)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from .. import account as svc
from ..db import DictConn
from .deps import ConnDep, UserDep

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/export")
def export_account(conn: DictConn = ConnDep, user_id: str = UserDep) -> dict[str, Any]:
    return svc.export_account(conn, user_id)


@router.delete("/data")
def delete_account_data(
    conn: DictConn = ConnDep, user_id: str = UserDep
) -> dict[str, Any]:
    counts = svc.delete_account_data(conn, user_id)
    return {"deleted": counts}
