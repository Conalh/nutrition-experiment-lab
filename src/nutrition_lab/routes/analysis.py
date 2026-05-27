"""Analysis and report routes (Phase 3)."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

from .. import analysis as analysis_svc
from .. import report as report_svc
from ..db import DictConn
from ..models import AnalysisResult, Report
from .deps import ConnDep, UserDep, to_http

router = APIRouter(prefix="/api/experiments", tags=["analysis"])


@router.post("/{experiment_id}/analyze", response_model=AnalysisResult)
def analyze(
    experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep
):
    """Recompute the analysis and store a fresh snapshot."""
    try:
        return analysis_svc.analyze(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.get("/{experiment_id}/analysis", response_model=AnalysisResult)
def get_analysis(
    experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep
):
    """Return the most recent stored analysis without recomputing."""
    try:
        return analysis_svc.latest_analysis(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.get("/{experiment_id}/report", response_model=Report)
def get_report(
    experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep
):
    try:
        return report_svc.build_report(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)


@router.get("/{experiment_id}/report.pdf")
def get_report_pdf(
    experiment_id: str, conn: DictConn = ConnDep, user_id: str = UserDep
):
    try:
        report = report_svc.build_report(conn, user_id, experiment_id)
    except Exception as exc:
        raise to_http(exc)
    pdf = report_svc.build_report_pdf(report)
    safe = "".join(c if c.isalnum() else "_" for c in report.title)[:50]
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe}.pdf"'},
    )
