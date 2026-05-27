"""Text guardrails for experiment protocols.

This module never emits medical advice. It only *flags* protocol text that
reads as restrictive, unsafe, or like a medical claim, and counts how many
variables an intervention seems to change at once. Warnings are advisory
(non-blocking) — the builder surfaces them so the user can reconsider.
"""
from __future__ import annotations

import re

from .models import SafetyWarning, Severity

# Phrases suggesting extreme restriction or disordered-eating patterns.
_RESTRICTIVE_PATTERNS = [
    r"\bfast(?:ing)?\b.*\b(\d{2,})\s*(?:hours?|hrs?|days?)",
    r"\b(?:zero|no)\s+(?:carb|fat|food|calorie)",
    r"\bunder\s*\d{3,}\s*(?:kcal|calories?)\b",
    r"\b(\d{3,})\s*(?:kcal|calories?)\s*(?:per day|/day|a day)",
    r"\bstarv",
    r"\bpurg",
    r"\bskip(?:ping)?\s+all\s+meals?\b",
    r"\bcut\s+to\s+\d",
]

# Language that drifts into medical treatment / diagnosis territory.
_MEDICAL_PATTERNS = [
    r"\bcure\b",
    r"\btreat(?:ment|s|ing)?\b",
    r"\bdiagnos",
    r"\breverse\s+(?:diabetes|disease|insulin)",
    r"\bheal\s+my\b",
    r"\bmedication\b",
    r"\bprescri",
    r"\bdisease\b",
    r"\binsulin resistance\b",
    r"\bblood pressure\b",
]

# Crude "how many things are you changing?" detector. Each hit is one lever.
_VARIABLE_PATTERNS = [
    r"\bprotein\b",
    r"\bfiber\b",
    r"\bcarb",
    r"\bfat\b",
    r"\bcaffeine\b|\bcoffee\b",
    r"\balcohol\b",
    r"\bsleep\b",
    r"\bfast(?:ing)?\b",
    r"\bhydrat|\bwater\b",
    r"\bsupplement\b|\bcreatine\b|\bvitamin\b",
    r"\bcalorie|\bkcal\b",
    r"\bmeal timing\b|\bbreakfast\b|\bdinner\b|\bsnack\b",
]


def _matches(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, flags=re.IGNORECASE) for p in patterns)


def count_variables(text: str) -> int:
    """Approximate count of distinct nutrition levers mentioned."""
    return sum(
        1 for p in _VARIABLE_PATTERNS if re.search(p, text, flags=re.IGNORECASE)
    )


def check_protocol(
    *,
    question: str = "",
    hypothesis: str = "",
    intervention_rule: str = "",
    intervention_window_days: int | None = None,
    primary_outcome_kind: str | None = None,
) -> list[SafetyWarning]:
    """Return advisory warnings about a proposed protocol. Empty list means
    nothing flagged. Designed to be called from the experiment builder."""
    warnings: list[SafetyWarning] = []
    combined = " ".join([question, hypothesis, intervention_rule]).strip()

    if _matches(combined, _RESTRICTIVE_PATTERNS):
        warnings.append(
            SafetyWarning(
                code="restrictive_protocol",
                severity=Severity.high,
                message=(
                    "This protocol reads as restrictive. The lab is for "
                    "learning, not for extreme restriction — consider a "
                    "gentler change you can sustain."
                ),
            )
        )

    if _matches(combined, _MEDICAL_PATTERNS):
        warnings.append(
            SafetyWarning(
                code="medical_claim",
                severity=Severity.high,
                message=(
                    "This sounds like a medical goal. The lab does not "
                    "diagnose, treat, or manage medical conditions. Reframe "
                    "around a non-medical outcome like energy, hunger, or "
                    "training, and talk to a clinician for medical questions."
                ),
            )
        )

    n_vars = count_variables(intervention_rule)
    if n_vars >= 3:
        warnings.append(
            SafetyWarning(
                code="too_many_variables",
                severity=Severity.medium,
                message=(
                    f"This intervention seems to change about {n_vars} things "
                    "at once. Change one variable so you can trust the result."
                ),
            )
        )

    # An intervention window too short to show a slow-moving outcome.
    if intervention_window_days is not None and intervention_window_days < 7:
        warnings.append(
            SafetyWarning(
                code="window_too_short",
                severity=Severity.medium,
                message=(
                    f"The intervention window is {intervention_window_days} "
                    "days. Most outcomes need at least a week to show a "
                    "trend you can trust."
                ),
            )
        )
    if (
        intervention_window_days is not None
        and primary_outcome_kind == "numeric"
        and intervention_window_days < 14
    ):
        warnings.append(
            SafetyWarning(
                code="numeric_window_short",
                severity=Severity.low,
                message=(
                    "Numeric outcomes like body weight are noisy. Two weeks "
                    "or more gives a steadier trend."
                ),
            )
        )

    return warnings
