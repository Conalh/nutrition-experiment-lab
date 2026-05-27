"""Safety guardrail tests — advisory text checks for the builder."""
from __future__ import annotations

from nutrition_lab.safety import check_protocol, count_variables


def _codes(warnings):
    return {w.code for w in warnings}


def test_clean_protocol_has_no_warnings():
    warnings = check_protocol(
        question="Does a higher-protein breakfast reduce afternoon hunger?",
        intervention_rule="Eat 40g protein at breakfast.",
        intervention_window_days=14,
        primary_outcome_kind="rating",
    )
    assert warnings == []


def test_restrictive_protocol_flagged():
    warnings = check_protocol(
        intervention_rule="Eat under 800 calories and fast for 36 hours.",
        intervention_window_days=14,
    )
    assert "restrictive_protocol" in _codes(warnings)


def test_medical_claim_flagged():
    warnings = check_protocol(
        question="Can this diet reverse my diabetes?",
        intervention_rule="Cut carbs to treat insulin resistance.",
        intervention_window_days=14,
    )
    assert "medical_claim" in _codes(warnings)


def test_too_many_variables_flagged():
    warnings = check_protocol(
        intervention_rule="More protein, more fiber, no caffeine, and earlier sleep.",
        intervention_window_days=14,
    )
    assert "too_many_variables" in _codes(warnings)
    assert count_variables(
        "More protein, more fiber, no caffeine, and earlier sleep."
    ) >= 3


def test_short_window_flagged():
    warnings = check_protocol(
        intervention_rule="Eat 40g protein at breakfast.",
        intervention_window_days=3,
    )
    assert "window_too_short" in _codes(warnings)
