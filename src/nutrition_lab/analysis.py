"""The analysis engine — conservative and transparent by design.

It never makes a medical claim and never reports p-values in V1 (per the
plan). It compares baseline and intervention windows, scores adherence and
data quality, flags confounders, and downgrades its own confidence whenever
the data is thin or noisy. The recommendation is drawn from a fixed set of
neutral, non-medical actions.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import mean

from psycopg.types.json import Json

from .db import DictConn, new_id, require
from .experiments import NotFoundError, get_experiment, list_outcomes
from .logging import list_confounders, list_daily_logs
from .models import (
    AdherenceResult,
    AdherenceTrust,
    AnalysisResult,
    Confidence,
    ConfounderFlag,
    DailyLog,
    Experiment,
    Metric,
    OutcomeComparison,
    OutcomeDefinition,
    OutcomeDirection,
    OutcomeKind,
    OutcomeResult,
    Severity,
)

# A rating change smaller than this (on the 1-5 scale) reads as noise.
RATING_MEANINGFUL_DELTA = 0.5
# A numeric change smaller than this (percent) reads as noise — body weight
# and similar metrics drift a little day to day.
NUMERIC_MEANINGFUL_PCT = 2.0
# Fewer than this many logged values in a phase is too little to compare.
MIN_PHASE_N = 3


# ─── Date helpers ────────────────────────────────────────────────────
def _window_days(start: date | None, end: date | None) -> int:
    if start is None or end is None:
        return 0
    return (end - start).days + 1


def _expected_days(exp: Experiment) -> int:
    """Days the user was meant to log: baseline + intervention windows."""
    return _window_days(exp.baseline_start, exp.baseline_end) + _window_days(
        exp.intervention_start, exp.intervention_end
    )


# ─── Adherence ───────────────────────────────────────────────────────
def score_adherence(exp: Experiment, logs: list[DailyLog]) -> AdherenceResult:
    expected = _expected_days(exp)
    in_window = [
        log
        for log in logs
        if log.phase is not None and log.phase.value in ("baseline", "intervention")
    ]
    logged = len(in_window)
    coverage = logged / expected if expected else 0.0

    # Adherence is only meaningful during the intervention: that's when the
    # user is following the rule. yes/partial count as adhering.
    intervention_logs = [
        log
        for log in in_window
        if log.phase is not None and log.phase.value == "intervention"
        and log.adherence is not None
        and log.adherence.value in ("yes", "partial", "no")
    ]
    if intervention_logs:
        adhering = sum(
            1
            for log in intervention_logs
            if log.adherence is not None and log.adherence.value in ("yes", "partial")
        )
        adherence_rate = adhering / len(intervention_logs)
    else:
        adherence_rate = 0.0

    if coverage >= 0.85 and adherence_rate >= 0.80:
        trust = AdherenceTrust.high
    elif coverage >= 0.70 and adherence_rate >= 0.65:
        trust = AdherenceTrust.medium
    else:
        trust = AdherenceTrust.low

    return AdherenceResult(
        expected_days=expected,
        logged_days=logged,
        coverage=round(coverage, 3),
        adherence_rate=round(adherence_rate, 3),
        trust=trust,
    )


# ─── Outcome comparison ──────────────────────────────────────────────
def _phase_values(logs: list[DailyLog], metric: Metric, phase: str) -> list[float]:
    out: list[float] = []
    for log in logs:
        if log.phase is None or log.phase.value != phase:
            continue
        value = getattr(log, metric.value)
        if value is not None:
            out.append(float(value))
    return out


def _classify(
    direction: OutcomeDirection,
    kind: OutcomeKind,
    baseline_mean: float,
    intervention_mean: float,
    outcome: OutcomeDefinition,
) -> OutcomeResult:
    delta = intervention_mean - baseline_mean

    if direction == OutcomeDirection.target_range:
        if outcome.target_min is None or outcome.target_max is None:
            return OutcomeResult.inconclusive
        midpoint = (outcome.target_min + outcome.target_max) / 2
        moved_closer = abs(intervention_mean - midpoint) < abs(baseline_mean - midpoint)
        if abs(abs(intervention_mean - midpoint) - abs(baseline_mean - midpoint)) < (
            RATING_MEANINGFUL_DELTA if kind != OutcomeKind.numeric else 0.0
        ):
            return OutcomeResult.unchanged
        return OutcomeResult.improved if moved_closer else OutcomeResult.worsened

    if kind == OutcomeKind.numeric:
        if baseline_mean == 0:
            meaningful = abs(delta) > 0
        else:
            meaningful = abs(delta / baseline_mean * 100) >= NUMERIC_MEANINGFUL_PCT
    else:
        meaningful = abs(delta) >= RATING_MEANINGFUL_DELTA

    if not meaningful:
        return OutcomeResult.unchanged

    improved = (direction == OutcomeDirection.higher_better and delta > 0) or (
        direction == OutcomeDirection.lower_better and delta < 0
    )
    return OutcomeResult.improved if improved else OutcomeResult.worsened


def compare_outcome(
    outcome: OutcomeDefinition, logs: list[DailyLog]
) -> OutcomeComparison:
    if outcome.metric is None:
        # No mapped metric — nothing measurable to compare.
        return OutcomeComparison(
            outcome_id=outcome.id,
            name=outcome.name,
            metric=None,
            kind=outcome.kind,
            direction=outcome.direction,
            is_primary=outcome.is_primary,
            baseline_n=0,
            intervention_n=0,
            result=OutcomeResult.inconclusive,
        )

    baseline = _phase_values(logs, outcome.metric, "baseline")
    intervention = _phase_values(logs, outcome.metric, "intervention")
    b_n, i_n = len(baseline), len(intervention)

    if b_n < MIN_PHASE_N or i_n < MIN_PHASE_N:
        return OutcomeComparison(
            outcome_id=outcome.id,
            name=outcome.name,
            metric=outcome.metric,
            kind=outcome.kind,
            direction=outcome.direction,
            is_primary=outcome.is_primary,
            baseline_mean=round(mean(baseline), 2) if baseline else None,
            intervention_mean=round(mean(intervention), 2) if intervention else None,
            baseline_n=b_n,
            intervention_n=i_n,
            result=OutcomeResult.inconclusive,
        )

    b_mean, i_mean = mean(baseline), mean(intervention)
    abs_change = i_mean - b_mean
    pct_change = (abs_change / b_mean * 100) if b_mean else None
    result = _classify(outcome.direction, outcome.kind, b_mean, i_mean, outcome)

    return OutcomeComparison(
        outcome_id=outcome.id,
        name=outcome.name,
        metric=outcome.metric,
        kind=outcome.kind,
        direction=outcome.direction,
        is_primary=outcome.is_primary,
        baseline_mean=round(b_mean, 2),
        intervention_mean=round(i_mean, 2),
        baseline_n=b_n,
        intervention_n=i_n,
        absolute_change=round(abs_change, 2),
        percent_change=round(pct_change, 1) if pct_change is not None else None,
        result=result,
    )


# ─── Confounders ─────────────────────────────────────────────────────
def flag_confounders(
    exp: Experiment, logs: list[DailyLog], confounders, primary: OutcomeComparison | None
) -> list[ConfounderFlag]:
    flags: list[ConfounderFlag] = []

    in_intervention = [
        c
        for c in confounders
        if exp.intervention_start
        and exp.intervention_end
        and exp.intervention_start <= c.date <= exp.intervention_end
    ]

    for c in in_intervention:
        if c.severity == Severity.high:
            flags.append(
                ConfounderFlag(
                    code="high_severity_in_intervention",
                    severity=Severity.high,
                    message=(
                        f"A high-severity '{c.kind.value}' confounder fell inside "
                        f"the intervention window ({c.date.isoformat()}). It may "
                        "explain the result more than the intervention does."
                    ),
                )
            )

    # Two or more medium confounders within any 7-day span.
    medium = sorted(c.date for c in confounders if c.severity == Severity.medium)
    for i, day in enumerate(medium):
        within = [d for d in medium[i:] if d - day < timedelta(days=7)]
        if len(within) >= 2:
            flags.append(
                ConfounderFlag(
                    code="medium_cluster",
                    severity=Severity.medium,
                    message=(
                        "Two or more medium confounders landed within one week "
                        f"(around {day.isoformat()})."
                    ),
                )
            )
            break

    # Missing primary outcome data on more than 25% of expected days.
    if primary is not None and primary.metric is not None:
        expected = _expected_days(exp)
        present = sum(
            1
            for log in logs
            if log.phase is not None
            and log.phase.value in ("baseline", "intervention")
            and getattr(log, primary.metric.value) is not None
        )
        if expected and (1 - present / expected) > 0.25:
            flags.append(
                ConfounderFlag(
                    code="primary_data_missing",
                    severity=Severity.medium,
                    message=(
                        f"The primary outcome was missing on more than 25% of "
                        f"days ({present}/{expected} logged)."
                    ),
                )
            )

    return flags


# ─── Confidence + recommendation ─────────────────────────────────────
def rate_confidence(
    adherence: AdherenceResult,
    flags: list[ConfounderFlag],
    primary: OutcomeComparison | None,
) -> Confidence:
    has_dominating = any(
        f.code in ("high_severity_in_intervention", "primary_data_missing")
        for f in flags
    )
    primary_inconclusive = primary is None or primary.result == OutcomeResult.inconclusive

    if has_dominating or primary_inconclusive:
        return Confidence.low
    if adherence.trust == AdherenceTrust.high and not flags:
        return Confidence.high
    if adherence.trust in (AdherenceTrust.high, AdherenceTrust.medium):
        return Confidence.medium
    return Confidence.low


def recommend(
    confidence: Confidence,
    primary: OutcomeComparison | None,
    flags: list[ConfounderFlag],
    n_interventions: int,
) -> str:
    """A neutral, non-medical next step from the allowed action set."""
    if confidence == Confidence.low:
        if any(f.code == "primary_data_missing" for f in flags):
            return (
                "Repeat the experiment and log the primary outcome more "
                "consistently before drawing any conclusion."
            )
        if any(f.code.startswith("medium") or "severity" in f.code for f in flags):
            return (
                "Confounders may have shaped this result. Repeat the experiment "
                "in a cleaner window before deciding."
            )
        return (
            "Adherence or data was too thin to trust this result. Repeat the "
            "experiment with cleaner adherence, or extend it by a week."
        )

    if primary is None:
        return "Add a primary outcome and re-run the analysis."

    if primary.result == OutcomeResult.improved:
        base = "The primary outcome improved. Keep this intervention if it feels sustainable."
    elif primary.result == OutcomeResult.worsened:
        base = "The primary outcome moved the wrong way. Consider discarding this intervention."
    else:
        base = "The primary outcome didn't move much. Consider discarding it or testing a stronger version."

    if n_interventions > 1:
        base += " Next time, reduce variables and test one change at a time."
    return base


# ─── Caveats ─────────────────────────────────────────────────────────
def build_caveats(
    adherence: AdherenceResult,
    comparisons: list[OutcomeComparison],
    flags: list[ConfounderFlag],
) -> list[str]:
    caveats: list[str] = []
    if adherence.trust != AdherenceTrust.high:
        caveats.append(
            f"Adherence trust is {adherence.trust.value} "
            f"({int(adherence.adherence_rate * 100)}% adhering, "
            f"{int(adherence.coverage * 100)}% of days logged)."
        )
    thin = [c for c in comparisons if c.result == OutcomeResult.inconclusive]
    if thin:
        caveats.append(
            "Some outcomes had too little data to compare: "
            + ", ".join(c.name for c in thin)
            + "."
        )
    caveats.extend(f.message for f in flags)
    caveats.append(
        "This is a single-person observation, not a controlled trial or "
        "medical advice."
    )
    return caveats


# ─── Orchestration + persistence ─────────────────────────────────────
def analyze(conn: DictConn, user_id: str, experiment_id: str) -> AnalysisResult:
    exp = get_experiment(conn, user_id, experiment_id)
    logs = list_daily_logs(conn, user_id, experiment_id)
    outcomes = list_outcomes(conn, experiment_id)
    confounders = list_confounders(conn, user_id, experiment_id)

    adherence = score_adherence(exp, logs)
    comparisons = [compare_outcome(o, logs) for o in outcomes]
    primary = next((c for c in comparisons if c.is_primary), None)
    flags = flag_confounders(exp, logs, confounders, primary)
    confidence = rate_confidence(adherence, flags, primary)
    caveats = build_caveats(adherence, comparisons, flags)
    recommendation = recommend(confidence, primary, flags, len(comparisons))

    result = AnalysisResult(
        experiment_id=experiment_id,
        generated_at=datetime.now(),
        adherence=adherence,
        comparisons=comparisons,
        confounder_flags=flags,
        confidence=confidence,
        caveats=caveats,
        recommendation=recommendation,
    )
    _persist(conn, result, comparisons)
    return result


def _summarise(comparisons: list[OutcomeComparison], side: str) -> dict:
    key = "baseline_mean" if side == "baseline" else "intervention_mean"
    n_key = "baseline_n" if side == "baseline" else "intervention_n"
    return {
        c.metric.value if c.metric else c.name: {
            "mean": getattr(c, key),
            "n": getattr(c, n_key),
        }
        for c in comparisons
    }


def _persist(
    conn: DictConn, result: AnalysisResult, comparisons: list[OutcomeComparison]
) -> None:
    conn.execute(
        """
        INSERT INTO analysis_snapshot (
            id, experiment_id, generated_at, adherence_rate,
            baseline_summary_json, intervention_summary_json,
            effect_summary_json, confidence, caveats
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            new_id("snap"),
            result.experiment_id,
            result.generated_at,
            result.adherence.adherence_rate,
            Json(_summarise(comparisons, "baseline")),
            Json(_summarise(comparisons, "intervention")),
            Json(result.model_dump(mode="json")),
            result.confidence.value,
            "\n".join(result.caveats),
        ),
    )
    conn.commit()


def latest_analysis(
    conn: DictConn, user_id: str, experiment_id: str
) -> AnalysisResult:
    get_experiment(conn, user_id, experiment_id)  # ownership check
    row = conn.execute(
        "SELECT effect_summary_json FROM analysis_snapshot "
        "WHERE experiment_id = %s ORDER BY generated_at DESC LIMIT 1",
        (experiment_id,),
    ).fetchone()
    if row is None:
        raise NotFoundError(
            f"No analysis yet for {experiment_id}. Run /analyze first."
        )
    return AnalysisResult.model_validate(require(row)["effect_summary_json"])
