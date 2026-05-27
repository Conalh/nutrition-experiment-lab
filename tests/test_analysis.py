"""Phase 3: analysis engine — clean, messy, missing, and confounded cases."""
from __future__ import annotations

from datetime import date, timedelta

from nutrition_lab import analysis as svc
from nutrition_lab import experiments as exp_svc
from nutrition_lab import logging as log_svc
from nutrition_lab.models import (
    AdherenceTrust,
    Confidence,
    ConfounderCreate,
    ConfounderKind,
    DailyLogUpsert,
    ExperimentCreate,
    InterventionCreate,
    Metric,
    OutcomeCreate,
    OutcomeDirection,
    OutcomeKind,
    OutcomeResult,
    Severity,
)

B_START = date(2026, 1, 1)
B_END = date(2026, 1, 7)        # 7 baseline days
I_START = date(2026, 1, 8)
I_END = date(2026, 1, 21)       # 14 intervention days  (21 expected total)


def _experiment(conn, user_id):
    exp = exp_svc.create_experiment(conn, user_id, ExperimentCreate(
        title="Protein breakfast", question="Does it cut afternoon hunger?",
        baseline_start=B_START, baseline_end=B_END,
        intervention_start=I_START, intervention_end=I_END,
    ))
    exp_svc.add_intervention(conn, user_id, exp.id,
                             InterventionCreate(name="40g protein", rule_text="40g am"))
    exp_svc.add_outcome(conn, user_id, exp.id, OutcomeCreate(
        name="Afternoon hunger", kind=OutcomeKind.rating,
        direction=OutcomeDirection.lower_better, metric=Metric.hunger,
        is_primary=True))
    exp_svc.start_experiment(conn, user_id, exp.id)
    return exp


def _log_range(conn, user_id, exp_id, start, end, *, hunger, adherence):
    day = start
    while day <= end:
        log_svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
            experiment_id=exp_id, date=day, hunger=hunger,
            adherence=adherence if day >= I_START else None))
        day += timedelta(days=1)


# ─── Clean: full logging, good adherence, clear improvement ──────────
def test_clean_experiment_high_confidence(conn, user_id):
    exp = _experiment(conn, user_id)
    _log_range(conn, user_id, exp.id, B_START, B_END, hunger=4, adherence=None)
    _log_range(conn, user_id, exp.id, I_START, I_END, hunger=2, adherence="yes")

    result = svc.analyze(conn, user_id, exp.id)
    assert result.adherence.trust == AdherenceTrust.high
    assert result.adherence.coverage == 1.0
    primary = next(c for c in result.comparisons if c.is_primary)
    assert primary.baseline_mean == 4.0
    assert primary.intervention_mean == 2.0
    assert primary.result == OutcomeResult.improved  # lower hunger is better
    assert result.confidence == Confidence.high
    assert "Keep this intervention" in result.recommendation


# ─── Messy: poor adherence drops trust and confidence ────────────────
def test_messy_low_adherence(conn, user_id):
    exp = _experiment(conn, user_id)
    _log_range(conn, user_id, exp.id, B_START, B_END, hunger=4, adherence=None)
    _log_range(conn, user_id, exp.id, I_START, I_END, hunger=2, adherence="no")

    result = svc.analyze(conn, user_id, exp.id)
    assert result.adherence.trust == AdherenceTrust.low
    assert result.confidence == Confidence.low
    assert "adherence" in result.recommendation.lower()


# ─── Missing: sparse logging → inconclusive + low confidence ─────────
def test_missing_data_inconclusive(conn, user_id):
    exp = _experiment(conn, user_id)
    # Only two logged days total — below MIN_PHASE_N per phase.
    log_svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=B_START, hunger=4))
    log_svc.upsert_daily_log(conn, user_id, DailyLogUpsert(
        experiment_id=exp.id, date=I_START, hunger=2, adherence="yes"))

    result = svc.analyze(conn, user_id, exp.id)
    primary = next(c for c in result.comparisons if c.is_primary)
    assert primary.result == OutcomeResult.inconclusive
    assert result.confidence == Confidence.low
    codes = {f.code for f in result.confounder_flags}
    assert "primary_data_missing" in codes


# ─── Confounded: high-severity confounder dominates ──────────────────
def test_confounded_high_severity(conn, user_id):
    exp = _experiment(conn, user_id)
    _log_range(conn, user_id, exp.id, B_START, B_END, hunger=4, adherence=None)
    _log_range(conn, user_id, exp.id, I_START, I_END, hunger=2, adherence="yes")
    log_svc.add_confounder(conn, user_id, exp.id, ConfounderCreate(
        date=I_START + timedelta(days=3), kind=ConfounderKind.illness,
        severity=Severity.high, notes="flu"))

    result = svc.analyze(conn, user_id, exp.id)
    codes = {f.code for f in result.confounder_flags}
    assert "high_severity_in_intervention" in codes
    assert result.confidence == Confidence.low


def test_medium_confounder_cluster_flagged(conn, user_id):
    exp = _experiment(conn, user_id)
    _log_range(conn, user_id, exp.id, B_START, B_END, hunger=4, adherence=None)
    _log_range(conn, user_id, exp.id, I_START, I_END, hunger=2, adherence="yes")
    for offset in (2, 4):
        log_svc.add_confounder(conn, user_id, exp.id, ConfounderCreate(
            date=I_START + timedelta(days=offset), kind=ConfounderKind.alcohol,
            severity=Severity.medium))

    result = svc.analyze(conn, user_id, exp.id)
    assert "medium_cluster" in {f.code for f in result.confounder_flags}


# ─── Persistence ─────────────────────────────────────────────────────
def test_snapshot_persisted_and_retrieved(conn, user_id):
    exp = _experiment(conn, user_id)
    _log_range(conn, user_id, exp.id, B_START, B_END, hunger=4, adherence=None)
    _log_range(conn, user_id, exp.id, I_START, I_END, hunger=2, adherence="yes")

    produced = svc.analyze(conn, user_id, exp.id)
    stored = svc.latest_analysis(conn, user_id, exp.id)
    assert stored.confidence == produced.confidence
    assert stored.adherence.adherence_rate == produced.adherence.adherence_rate
    primary = next(c for c in stored.comparisons if c.is_primary)
    assert primary.result == OutcomeResult.improved


def test_no_pvalues_in_output(conn, user_id):
    exp = _experiment(conn, user_id)
    _log_range(conn, user_id, exp.id, B_START, B_END, hunger=4, adherence=None)
    _log_range(conn, user_id, exp.id, I_START, I_END, hunger=2, adherence="yes")
    result = svc.analyze(conn, user_id, exp.id)
    blob = result.model_dump_json().lower()
    assert "p_value" not in blob and "pvalue" not in blob
