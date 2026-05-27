"""Pydantic v2 schemas and enums mirroring the data model in PLAN.md.

Three flavours per entity where it matters: a read model (what the API
returns), a ``*Create`` model (POST bodies), and a ``*Update`` model
(PATCH bodies, all-optional). Enums are plain str-enums so they serialise
as their value and match the TEXT/CHECK columns in db.py."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


# ─── Enums ───────────────────────────────────────────────────────────
class ExperimentStatus(str, Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"
    abandoned = "abandoned"


class Phase(str, Enum):
    baseline = "baseline"
    washout = "washout"
    intervention = "intervention"


class Adherence(str, Enum):
    yes = "yes"
    partial = "partial"
    no = "no"
    not_applicable = "not_applicable"


class InterventionCategory(str, Enum):
    protein = "protein"
    fiber = "fiber"
    hydration = "hydration"
    timing = "timing"
    caffeine = "caffeine"
    supplement = "supplement"
    meal_pattern = "meal_pattern"
    other = "other"


class OutcomeKind(str, Enum):
    rating = "rating"
    numeric = "numeric"
    boolean = "boolean"


class OutcomeDirection(str, Enum):
    higher_better = "higher_better"
    lower_better = "lower_better"
    target_range = "target_range"


class Metric(str, Enum):
    """Which daily_log column an outcome is measured from."""

    hunger = "hunger"
    energy = "energy"
    digestion = "digestion"
    sleep_quality = "sleep_quality"
    training_performance = "training_performance"
    body_weight = "body_weight"


class ConfounderKind(str, Enum):
    illness = "illness"
    travel = "travel"
    poor_sleep = "poor_sleep"
    alcohol = "alcohol"
    unusual_training = "unusual_training"
    high_stress = "high_stress"
    missed_log = "missed_log"
    other = "other"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Confidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


Rating = int  # constrained 1..5 at the DB layer and in field definitions below


# ─── Auth ────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserPublic(BaseModel):
    id: str
    email: str
    display_name: str


# ─── Experiment ──────────────────────────────────────────────────────
class ExperimentCreate(BaseModel):
    title: str
    question: str
    hypothesis: str | None = None
    baseline_start: date | None = None
    baseline_end: date | None = None
    washout_start: date | None = None
    washout_end: date | None = None
    intervention_start: date | None = None
    intervention_end: date | None = None
    primary_outcome: str | None = None


class ExperimentUpdate(BaseModel):
    title: str | None = None
    question: str | None = None
    hypothesis: str | None = None
    baseline_start: date | None = None
    baseline_end: date | None = None
    washout_start: date | None = None
    washout_end: date | None = None
    intervention_start: date | None = None
    intervention_end: date | None = None
    primary_outcome: str | None = None


class Experiment(BaseModel):
    id: str
    user_id: str
    title: str
    question: str
    hypothesis: str | None = None
    status: ExperimentStatus
    baseline_start: date | None = None
    baseline_end: date | None = None
    washout_start: date | None = None
    washout_end: date | None = None
    intervention_start: date | None = None
    intervention_end: date | None = None
    primary_outcome: str | None = None
    stop_reason: str | None = None
    created_at: datetime
    updated_at: datetime


# ─── Intervention ────────────────────────────────────────────────────
class InterventionCreate(BaseModel):
    name: str
    rule_text: str
    category: InterventionCategory = InterventionCategory.other
    expected_effect: str | None = None
    safety_note: str | None = None


class InterventionUpdate(BaseModel):
    name: str | None = None
    rule_text: str | None = None
    category: InterventionCategory | None = None
    expected_effect: str | None = None
    safety_note: str | None = None


class Intervention(BaseModel):
    id: str
    experiment_id: str
    name: str
    rule_text: str
    category: InterventionCategory
    expected_effect: str | None = None
    safety_note: str | None = None


# ─── Outcome definition ──────────────────────────────────────────────
class OutcomeCreate(BaseModel):
    name: str
    kind: OutcomeKind = OutcomeKind.rating
    direction: OutcomeDirection = OutcomeDirection.higher_better
    metric: Metric | None = None
    target_min: float | None = None
    target_max: float | None = None
    unit: str | None = None
    is_primary: bool = False


class OutcomeUpdate(BaseModel):
    name: str | None = None
    kind: OutcomeKind | None = None
    direction: OutcomeDirection | None = None
    metric: Metric | None = None
    target_min: float | None = None
    target_max: float | None = None
    unit: str | None = None
    is_primary: bool | None = None


class OutcomeDefinition(BaseModel):
    id: str
    experiment_id: str
    name: str
    kind: OutcomeKind
    direction: OutcomeDirection
    metric: Metric | None = None
    target_min: float | None = None
    target_max: float | None = None
    unit: str | None = None
    is_primary: bool


# ─── Daily log ───────────────────────────────────────────────────────
class DailyLogUpsert(BaseModel):
    """POST body. Keyed on (experiment_id, date): writing the same date
    twice updates the existing row rather than creating a duplicate."""

    experiment_id: str
    date: date
    adherence: Adherence | None = None
    hunger: int | None = Field(default=None, ge=1, le=5)
    energy: int | None = Field(default=None, ge=1, le=5)
    digestion: int | None = Field(default=None, ge=1, le=5)
    sleep_quality: int | None = Field(default=None, ge=1, le=5)
    training_performance: int | None = Field(default=None, ge=1, le=5)
    body_weight: float | None = None
    notes: str | None = None


class DailyLogUpdate(BaseModel):
    adherence: Adherence | None = None
    hunger: int | None = Field(default=None, ge=1, le=5)
    energy: int | None = Field(default=None, ge=1, le=5)
    digestion: int | None = Field(default=None, ge=1, le=5)
    sleep_quality: int | None = Field(default=None, ge=1, le=5)
    training_performance: int | None = Field(default=None, ge=1, le=5)
    body_weight: float | None = None
    notes: str | None = None


class DailyLog(BaseModel):
    id: str
    user_id: str
    experiment_id: str
    date: date
    phase: Phase | None = None
    adherence: Adherence | None = None
    hunger: int | None = None
    energy: int | None = None
    digestion: int | None = None
    sleep_quality: int | None = None
    training_performance: int | None = None
    body_weight: float | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


# ─── Meal ────────────────────────────────────────────────────────────
class MealCreate(BaseModel):
    eaten_at: datetime | None = None
    description: str
    tags: list[str] = Field(default_factory=list)
    photo_url: str | None = None


class MealUpdate(BaseModel):
    eaten_at: datetime | None = None
    description: str | None = None
    tags: list[str] | None = None
    photo_url: str | None = None


class MealLog(BaseModel):
    id: str
    user_id: str
    daily_log_id: str
    eaten_at: datetime | None = None
    description: str
    tags: list[str]
    photo_url: str | None = None


# ─── Confounder ──────────────────────────────────────────────────────
class ConfounderCreate(BaseModel):
    date: date
    kind: ConfounderKind = ConfounderKind.other
    severity: Severity = Severity.low
    notes: str | None = None


class Confounder(BaseModel):
    id: str
    user_id: str
    experiment_id: str
    date: date
    kind: ConfounderKind
    severity: Severity
    notes: str | None = None


# ─── Safety ──────────────────────────────────────────────────────────
class SafetyWarning(BaseModel):
    code: str
    message: str
    severity: Severity


# ─── Aggregate read model ────────────────────────────────────────────
class ExperimentDetail(BaseModel):
    experiment: Experiment
    interventions: list[Intervention] = Field(default_factory=list)
    outcomes: list[OutcomeDefinition] = Field(default_factory=list)


# ─── Analysis (Phase 3) ──────────────────────────────────────────────
class AdherenceTrust(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class OutcomeResult(str, Enum):
    improved = "improved"
    worsened = "worsened"
    unchanged = "unchanged"
    inconclusive = "inconclusive"


class AdherenceResult(BaseModel):
    expected_days: int
    logged_days: int
    coverage: float  # fraction of expected days that were logged
    adherence_rate: float  # fraction of intervention days marked yes/partial
    trust: AdherenceTrust


class OutcomeComparison(BaseModel):
    outcome_id: str
    name: str
    metric: Metric | None = None
    kind: OutcomeKind
    direction: OutcomeDirection
    is_primary: bool
    baseline_mean: float | None = None
    intervention_mean: float | None = None
    baseline_n: int
    intervention_n: int
    absolute_change: float | None = None
    percent_change: float | None = None
    result: OutcomeResult


class ConfounderFlag(BaseModel):
    code: str
    message: str
    severity: Severity


class AnalysisResult(BaseModel):
    experiment_id: str
    generated_at: datetime
    adherence: AdherenceResult
    comparisons: list[OutcomeComparison] = Field(default_factory=list)
    confounder_flags: list[ConfounderFlag] = Field(default_factory=list)
    confidence: Confidence
    caveats: list[str] = Field(default_factory=list)
    recommendation: str


class ReportMealExample(BaseModel):
    phase: Phase
    description: str
    tags: list[str] = Field(default_factory=list)


class Report(BaseModel):
    experiment_id: str
    title: str
    question: str
    hypothesis: str | None = None
    status: ExperimentStatus
    baseline_start: date | None = None
    baseline_end: date | None = None
    intervention_start: date | None = None
    intervention_end: date | None = None
    adherence: AdherenceResult
    confidence: Confidence
    primary_outcome: OutcomeComparison | None = None
    secondary_outcomes: list[OutcomeComparison] = Field(default_factory=list)
    what_changed: list[str] = Field(default_factory=list)
    what_did_not_change: list[str] = Field(default_factory=list)
    confounders: list[Confounder] = Field(default_factory=list)
    confounder_flags: list[ConfounderFlag] = Field(default_factory=list)
    meal_examples: list[ReportMealExample] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    recommendation: str
    decision: str
