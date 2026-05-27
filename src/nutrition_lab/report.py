"""Build a clean, shareable report from the latest analysis snapshot.

The report is a plain-language readout: what changed, what didn't, how much
to trust it, and the user's own decision. It reuses the stored analysis
rather than recomputing, so the report matches what the user last saw.
"""
from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from .analysis import analyze, latest_analysis
from .db import DictConn
from .experiments import get_experiment
from .logging import list_confounders, list_daily_logs, list_meals
from .models import (
    ExperimentStatus,
    OutcomeResult,
    Phase,
    Report,
    ReportMealExample,
)


def _decision_text(status: ExperimentStatus, stop_reason: str | None) -> str:
    if status == ExperimentStatus.completed:
        return "Completed."
    if status == ExperimentStatus.abandoned:
        return f"Stopped early — reason: {stop_reason or 'not given'}."
    return f"Status: {status.value}."


def _meal_examples(conn: DictConn, user_id: str, experiment_id: str) -> list[ReportMealExample]:
    """One representative meal per phase, if logged."""
    logs = list_daily_logs(conn, user_id, experiment_id)
    seen: set[Phase] = set()
    examples: list[ReportMealExample] = []
    for log in logs:
        if log.phase is None or log.phase in seen:
            continue
        meals = list_meals(conn, log.id)
        if meals:
            examples.append(
                ReportMealExample(
                    phase=log.phase,
                    description=meals[0].description,
                    tags=meals[0].tags,
                )
            )
            seen.add(log.phase)
    return examples


def build_report(
    conn: DictConn, user_id: str, experiment_id: str, *, analyze_if_missing: bool = True
) -> Report:
    exp = get_experiment(conn, user_id, experiment_id)
    try:
        result = latest_analysis(conn, user_id, experiment_id)
    except Exception:
        if not analyze_if_missing:
            raise
        result = analyze(conn, user_id, experiment_id)

    primary = next((c for c in result.comparisons if c.is_primary), None)
    secondary = [c for c in result.comparisons if not c.is_primary]

    what_changed: list[str] = []
    what_did_not: list[str] = []
    for c in result.comparisons:
        if c.baseline_mean is None or c.intervention_mean is None:
            continue
        line = (
            f"{c.name}: {c.baseline_mean} → {c.intervention_mean}"
            + (f" ({c.percent_change:+.1f}%)" if c.percent_change is not None else "")
        )
        if c.result in (OutcomeResult.improved, OutcomeResult.worsened):
            what_changed.append(f"{line} — {c.result.value}")
        else:
            what_did_not.append(f"{line} — {c.result.value}")

    return Report(
        experiment_id=exp.id,
        title=exp.title,
        question=exp.question,
        hypothesis=exp.hypothesis,
        status=exp.status,
        baseline_start=exp.baseline_start,
        baseline_end=exp.baseline_end,
        intervention_start=exp.intervention_start,
        intervention_end=exp.intervention_end,
        adherence=result.adherence,
        confidence=result.confidence,
        primary_outcome=primary,
        secondary_outcomes=secondary,
        what_changed=what_changed,
        what_did_not_change=what_did_not,
        confounders=list_confounders(conn, user_id, experiment_id),
        confounder_flags=result.confounder_flags,
        meal_examples=_meal_examples(conn, user_id, experiment_id),
        caveats=result.caveats,
        recommendation=result.recommendation,
        decision=_decision_text(exp.status, exp.stop_reason),
    )


# ─── PDF export ──────────────────────────────────────────────────────
def build_report_pdf(report: Report) -> bytes:
    """Render a Report into a print-ready PDF. Deterministic and
    mechanical — the same report always produces the same document."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        title=report.title,
    )
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=18, spaceAfter=4)
    sub = ParagraphStyle(
        "sub", parent=ss["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=10
    )
    h2 = ParagraphStyle(
        "h2", parent=ss["Heading2"], fontSize=12, spaceBefore=12, spaceAfter=4
    )
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=10, leading=14)
    dim = ParagraphStyle(
        "dim", parent=body, textColor=colors.HexColor("#666666"), fontSize=9
    )

    def bullets(items: list[str], style: ParagraphStyle = body):
        return ListFlowable(
            [ListItem(Paragraph(i, style), leftIndent=10) for i in items],
            bulletType="bullet",
            start="•",
        )

    el: list = [Paragraph(report.title, h1), Paragraph(report.question, sub)]

    if report.hypothesis:
        el.append(Paragraph(f"<b>Hypothesis:</b> {report.hypothesis}", body))
    el.append(
        Paragraph(
            f"Baseline {report.baseline_start} → {report.baseline_end} · "
            f"Intervention {report.intervention_start} → {report.intervention_end}",
            dim,
        )
    )
    el.append(Spacer(1, 6))
    el.append(
        Paragraph(
            f"<b>Confidence:</b> {report.confidence.value} &nbsp;·&nbsp; "
            f"<b>Adherence:</b> {round(report.adherence.adherence_rate * 100)}% &nbsp;·&nbsp; "
            f"<b>Days logged:</b> {round(report.adherence.coverage * 100)}%",
            body,
        )
    )
    el.append(Spacer(1, 6))
    el.append(HRFlowable(width="100%", color=colors.HexColor("#dddddd")))

    el.append(Paragraph("Outcomes", h2))
    comparisons = (
        [report.primary_outcome] if report.primary_outcome else []
    ) + report.secondary_outcomes
    for c in comparisons:
        tag = " (primary)" if c.is_primary else ""
        change = ""
        if c.absolute_change is not None:
            change = f" — change {c.absolute_change:+}"
            if c.percent_change is not None:
                change += f" ({c.percent_change:+}%)"
        el.append(
            Paragraph(
                f"<b>{c.name}{tag}:</b> {c.baseline_mean} → {c.intervention_mean} "
                f"[{c.result.value}]{change}",
                body,
            )
        )

    if report.what_changed:
        el.append(Paragraph("What changed", h2))
        el.append(bullets(report.what_changed))
    if report.what_did_not_change:
        el.append(Paragraph("What did not change", h2))
        el.append(bullets(report.what_did_not_change))

    if report.confounders:
        el.append(Paragraph("Confounders", h2))
        el.append(
            bullets(
                [
                    f"{c.date} — {c.severity.value} {c.kind.replace('_', ' ')}"
                    + (f": {c.notes}" if c.notes else "")
                    for c in report.confounders
                ]
            )
        )

    if report.meal_examples:
        el.append(Paragraph("Meal examples", h2))
        el.append(
            bullets([f"[{m.phase.value}] {m.description}" for m in report.meal_examples])
        )

    el.append(Paragraph("Recommendation", h2))
    el.append(Paragraph(report.recommendation, body))
    el.append(Paragraph(f"Decision: {report.decision}", dim))

    el.append(Spacer(1, 10))
    el.append(HRFlowable(width="100%", color=colors.HexColor("#dddddd")))
    el.append(Paragraph("Caveats", h2))
    el.append(bullets(report.caveats, dim))

    doc.build(el)
    return buf.getvalue()
