# Nutrition Experiment Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private nutrition experiment tracker for running structured n-of-1 experiments across food, training, sleep, symptoms, energy, digestion, weight, and adherence.

**Architecture:** A Next.js dashboard talks to a FastAPI API. Postgres stores experiments, interventions, daily logs, meals, outcome measures, and analysis snapshots. A rules and statistics layer compares baseline and intervention windows without making medical claims.

**Tech Stack:** Next.js, TypeScript, Tailwind, TanStack Query, FastAPI, Python, Pydantic, Postgres, pandas, scipy or statsmodels for simple comparisons, pytest, Playwright.

---

## Product Thesis

Most food tracking apps optimize for calorie guilt or macro compliance. This product should optimize for learning.

The user picks one clear nutrition question, runs a bounded experiment, tracks a small set of outcomes, and gets a transparent readout:

- What changed?
- Was adherence good enough to trust the result?
- Did the outcome move meaningfully?
- What confounders might explain the result?
- Should the user repeat, stop, or refine the experiment?

The product should feel like a lab notebook, not a diet app.

## Target Users

Primary user:

- Health-conscious person who wants to learn how food choices affect energy, training, digestion, sleep, hunger, weight trend, or recovery.

Secondary users:

- Athletes experimenting with meal timing or protein distribution.
- People working with a dietitian who need structured observations.
- Trainers or coaches who want non-medical nutrition adherence and outcome tracking.

## Boundaries

This product does not diagnose, treat, or prescribe for medical conditions. It should not market itself as managing diabetes, eating disorders, gastrointestinal disease, allergies, or chronic illness.

The app can track:

- Food patterns.
- Meal timing.
- Protein/fiber/hydration habits.
- Supplements entered by the user.
- Subjective outcomes.
- Body weight trends.
- Training performance markers.

The app must avoid:

- Medical treatment recommendations.
- Extreme restriction plans.
- Eating disorder language.
- Automated calorie cuts.
- Promises of fat loss, disease reversal, or hormone optimization.

## Core Product Loop

1. User creates a question: "Does higher-protein breakfast improve afternoon hunger?"
2. User chooses a baseline window and an intervention window.
3. User defines the intervention and success metrics.
4. User logs meals and daily outcomes.
5. System tracks adherence and confounders.
6. System produces an experiment readout.
7. User decides to keep, repeat, adjust, or discard the intervention.

## V1 Scope

Included:

- Single-user account.
- Manual experiment creation.
- Baseline and intervention windows.
- Meal logging with simple tags.
- Daily outcome logging.
- Habit/adherence tracking.
- Simple trend comparison.
- Confounder flags.
- Experiment report export.
- Demo data.

Excluded from V1:

- Barcode scanning.
- Full nutrient database.
- Wearable OAuth integrations.
- AI meal generation.
- Diet plans.
- Coach marketplace.
- Medical-condition protocols.

## Product Surfaces

### Experiment Dashboard

Purpose: Show all active and completed experiments.

Sections:

- Active experiment card.
- Current phase: baseline, washout, intervention, review.
- Adherence status.
- Outcome trend.
- Today log shortcut.
- Completed experiment library.

### Experiment Builder

Purpose: Help the user design one clean experiment.

Required fields:

- Question.
- Hypothesis.
- Baseline length.
- Intervention length.
- Optional washout length.
- Intervention rule.
- Primary outcome.
- Secondary outcomes.
- Confounders to watch.

Guardrails:

- Warn if the experiment changes too many variables.
- Warn if intervention window is too short for the selected outcome.
- Warn if the intervention sounds restrictive or unsafe.
- Require a neutral reason for stopping early.

### Daily Log

Purpose: Capture enough data without turning the app into a burden.

Fields:

- Meals: time, description, tags, optional photo.
- Intervention adherence: yes, partial, no.
- Hunger: 1 to 5.
- Energy: 1 to 5.
- Digestion comfort: 1 to 5.
- Sleep quality: 1 to 5.
- Training performance: 1 to 5 or skipped.
- Body weight: optional.
- Notes.

### Experiment Detail

Purpose: Make the experiment inspectable.

Sections:

- Protocol.
- Timeline.
- Adherence chart.
- Outcome charts.
- Confounder log.
- Meal examples.
- Analysis summary.
- Decision: keep, repeat, refine, discard.

### Report

Purpose: Produce a clean shareable summary.

Contents:

- Question and hypothesis.
- Dates.
- Baseline vs intervention averages.
- Adherence.
- Confounders.
- What changed.
- What did not change.
- User decision.

## Data Model

### User

- id
- email
- display_name
- timezone
- created_at

### Experiment

- id
- user_id
- title
- question
- hypothesis
- status: draft, active, paused, completed, abandoned
- baseline_start
- baseline_end
- washout_start
- washout_end
- intervention_start
- intervention_end
- primary_outcome
- created_at
- updated_at

### Intervention

- id
- experiment_id
- name
- rule_text
- category: protein, fiber, hydration, timing, caffeine, supplement, meal_pattern, other
- expected_effect
- safety_note

### OutcomeDefinition

- id
- experiment_id
- name
- kind: rating, numeric, boolean
- direction: higher_better, lower_better, target_range
- target_min
- target_max
- unit
- primary

### DailyLog

- id
- user_id
- experiment_id
- date
- phase: baseline, washout, intervention
- adherence: yes, partial, no, not_applicable
- hunger
- energy
- digestion
- sleep_quality
- training_performance
- body_weight
- notes

### MealLog

- id
- user_id
- daily_log_id
- eaten_at
- description
- tags
- photo_url

### Confounder

- id
- user_id
- experiment_id
- date
- kind: illness, travel, poor_sleep, alcohol, unusual_training, high_stress, missed_log, other
- severity: low, medium, high
- notes

### AnalysisSnapshot

- id
- experiment_id
- generated_at
- adherence_rate
- baseline_summary_json
- intervention_summary_json
- effect_summary_json
- confidence: low, medium, high
- caveats

## Analysis Engine

The analysis engine should be conservative and transparent.

### Adherence Check

Inputs:

- Daily logs.
- Intervention adherence.
- Missing days.

Rules:

- High trust: >= 85 percent logged days and >= 80 percent yes/partial adherence.
- Medium trust: >= 70 percent logged days and >= 65 percent yes/partial adherence.
- Low trust: anything below medium.

### Outcome Comparison

Inputs:

- Baseline values.
- Intervention values.
- Primary outcome direction.

Outputs:

- Baseline mean.
- Intervention mean.
- Absolute change.
- Percent change when numeric and meaningful.
- Directional result: improved, worsened, unchanged, inconclusive.

Rules:

- Do not present p-values in V1 unless sample size and measurement quality justify it.
- Prefer plain-language effect size and caveats.
- Mark result inconclusive if missing data or confounders dominate.

### Confounder Detection

Inputs:

- Confounder logs.
- Sleep/training/stress fields.
- Missing logs.

Rules:

- Flag any high-severity confounder inside the intervention window.
- Flag two or more medium confounders in one week.
- Flag missing primary outcome data on more than 25 percent of days.

### Recommendation Output

Allowed:

- Repeat experiment with cleaner adherence.
- Extend experiment by one week.
- Keep intervention if useful and sustainable.
- Discard intervention if no benefit or poor fit.
- Reduce variables and test one change at a time.

Not allowed:

- Diagnose nutrient deficiency.
- Recommend supplement dosage.
- Recommend treatment for disease.
- Recommend extreme restriction.

## API Surface

### Experiments

- `GET /api/experiments`
- `POST /api/experiments`
- `GET /api/experiments/{experiment_id}`
- `PATCH /api/experiments/{experiment_id}`
- `POST /api/experiments/{experiment_id}/start`
- `POST /api/experiments/{experiment_id}/complete`
- `POST /api/experiments/{experiment_id}/abandon`

### Intervention and Outcomes

- `POST /api/experiments/{experiment_id}/interventions`
- `PATCH /api/interventions/{intervention_id}`
- `POST /api/experiments/{experiment_id}/outcomes`
- `PATCH /api/outcomes/{outcome_id}`

### Logging

- `GET /api/daily-log?date=YYYY-MM-DD`
- `POST /api/daily-log`
- `PATCH /api/daily-log/{log_id}`
- `POST /api/daily-log/{log_id}/meals`
- `PATCH /api/meals/{meal_id}`
- `POST /api/experiments/{experiment_id}/confounders`

### Analysis

- `POST /api/experiments/{experiment_id}/analyze`
- `GET /api/experiments/{experiment_id}/analysis`
- `GET /api/experiments/{experiment_id}/report`

## Frontend Component Map

- `app/page.tsx`: experiment dashboard.
- `app/experiments/new/page.tsx`: experiment builder.
- `app/experiments/[id]/page.tsx`: experiment detail.
- `app/log/page.tsx`: daily log.
- `app/reports/[id]/page.tsx`: report view.
- `components/experiment-card.tsx`: active/completed cards.
- `components/protocol-editor.tsx`: question, hypothesis, intervention.
- `components/outcome-picker.tsx`: primary and secondary outcomes.
- `components/daily-log-form.tsx`: fast logging.
- `components/adherence-chart.tsx`: adherence visualization.
- `components/outcome-chart.tsx`: baseline vs intervention.
- `components/confounder-list.tsx`: caveat inspection.

## Backend Module Map

- `nutrition_lab/api.py`: FastAPI app.
- `nutrition_lab/models.py`: Pydantic schemas.
- `nutrition_lab/db.py`: database helpers.
- `nutrition_lab/experiments.py`: experiment lifecycle.
- `nutrition_lab/logging.py`: daily logs and meals.
- `nutrition_lab/analysis.py`: comparison engine.
- `nutrition_lab/safety.py`: text guardrails for unsafe protocols.
- `nutrition_lab/report.py`: report generation.
- `nutrition_lab/demo.py`: demo experiments.

## Implementation Phases

### Phase 1: Experiment Spine

- [ ] Create experiment schema.
- [ ] Create intervention schema.
- [ ] Create outcome definition schema.
- [ ] Add experiment CRUD.
- [ ] Add lifecycle transitions.
- [ ] Seed demo experiment.
- [ ] Test invalid date windows and invalid lifecycle transitions.

Exit criteria:

- A user can create a draft experiment, start it, complete it, and inspect it.

### Phase 2: Daily Logging

- [ ] Add daily log schema.
- [ ] Add meal log schema.
- [ ] Add confounder schema.
- [ ] Build fast daily log endpoint.
- [ ] Build meal add/edit endpoints.
- [ ] Build confounder endpoint.
- [ ] Test duplicate daily logs for one date and experiment.

Exit criteria:

- A user can log each day in under one minute.

### Phase 3: Analysis

- [ ] Implement adherence scoring.
- [ ] Implement baseline vs intervention summary.
- [ ] Implement confounder flags.
- [ ] Implement confidence rating.
- [ ] Store analysis snapshots.
- [ ] Add tests for clean, messy, missing, and confounded experiments.

Exit criteria:

- Every report explains what changed and why the result is trusted or not trusted.

### Phase 4: Frontend

- [ ] Build experiment dashboard.
- [ ] Build experiment builder.
- [ ] Build daily log.
- [ ] Build experiment detail.
- [ ] Build analysis report.
- [ ] Add demo flow.

Exit criteria:

- A user can create and complete a full experiment from the browser.

### Phase 5: Export and Safety Polish

- [ ] Add PDF or print-friendly report.
- [ ] Add account export.
- [ ] Add account deletion.
- [ ] Add protocol safety copy.
- [ ] Add privacy page.

Exit criteria:

- The product is safe enough for a private beta with non-clinical positioning.

## Safety and Privacy

Required controls:

- Encrypt session cookies.
- Store minimal personal data.
- Treat meal logs, body weight, symptoms, and supplement use as sensitive health-related data.
- Make exports user-controlled.
- Delete data completely on account deletion.
- Add clear non-medical positioning.
- Avoid third-party analytics in V1.

If the app can draw data from multiple health sources or fitness trackers, review FTC Health Breach Notification Rule obligations before launch.

## Success Metrics

- User creates one experiment with one primary outcome.
- User logs at least 80 percent of days during the experiment.
- User completes an experiment and records a decision.
- User says the report helped them learn something specific.
- User starts a second experiment.

## Risks

- Users may change too many variables at once.
- Food tracking can become obsessive.
- Health claims can drift into unsafe territory.
- Nutrient databases can consume months of work.
- Supplement tracking can create liability.

Mitigations:

- Make the experiment builder enforce one primary change.
- Use low-friction qualitative logs first.
- Put safety copy in protocol creation and reports.
- Defer nutrient database integration.
- Link supplement entries to neutral source-review notes, not recommendations.

## Reference Sources To Review During Build

- Dietary Guidelines for Americans, 2025-2030: https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines/current-dietary-guidelines
- NIH Office of Dietary Supplements fact sheets: https://ods.od.nih.gov/factsheets/
- NIH supplement and exercise performance fact sheet: https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/
- ACSM position stands: https://acsm.org/education-resources/pronouncements-scientific-communications/position-stands/
- HHS health app developer resources: https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html
- FTC Health Breach Notification Rule guidance: https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0
