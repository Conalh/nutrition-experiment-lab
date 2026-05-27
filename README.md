# Nutrition Experiment Lab

[![tests](https://github.com/Conalh/nutrition-experiment-lab/actions/workflows/tests.yml/badge.svg)](https://github.com/Conalh/nutrition-experiment-lab/actions/workflows/tests.yml)
[![python](https://img.shields.io/badge/python-3.11%2B-blue)](pyproject.toml)
[![next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](web/package.json)
[![fastapi](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white)](pyproject.toml)
[![postgres](https://img.shields.io/badge/Postgres-17-336791?logo=postgresql&logoColor=white)](src/nutrition_lab/db.py)
[![mypy](https://img.shields.io/badge/mypy-checked-2a6db2)](pyproject.toml)
[![ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/charliermarsh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**A private lab notebook for n-of-1 nutrition experiments.** Pick one clear question, run a bounded experiment with a baseline and an intervention window, log a small set of daily outcomes, and get a transparent readout: what changed, whether adherence was good enough to trust it, what confounders might explain it, and what to do next — without a single medical claim.

> Most food apps optimize for calorie guilt or macro compliance. This one optimizes for **learning**. It reads like a lab notebook, not a diet app — and it never diagnoses, treats, or prescribes.

```mermaid
flowchart LR
    Builder["Experiment builder<br/>question · hypothesis<br/>windows · intervention"] --> DB
    Log["Daily log<br/>hunger · energy · sleep<br/>digestion · training · weight"] --> DB
    Meals["Meals + confounders"] --> DB
    DB[("Experiments + logs<br/>(Postgres)")] --> Engine
    Engine["Analysis engine<br/>adherence · comparison<br/>confounders · confidence"] --> Dashboard["Dashboard<br/>(Next.js)"]
    Engine --> PDF["Report<br/>+ PDF export"]

    classDef box fill:#1e293b,stroke:#334155,color:#e2e8f0
    classDef store fill:#0f172a,stroke:#1e293b,color:#e2e8f0,stroke-width:2px
    classDef out fill:#0c4a6e,stroke:#0369a1,color:#e0f2fe
    class Builder,Log,Meals box
    class DB store
    class Engine,Dashboard,PDF out
```

Ships as a Next.js + Tailwind dashboard backed by a FastAPI service over Postgres. The analysis layer is rules-based and deliberately conservative — every readout shows its work and downgrades its own confidence when the data is thin.

**See also:** [PLAN.md](PLAN.md) for the full product thesis, scope boundaries, and the phased build · [ROADMAP.md](ROADMAP.md) for what's shipped and what's next.

## Screenshots

A calm, editorial instrument — Instrument Serif headlines, mono numerics, a single amber "signal" accent, lines over shadows.

![Sign in](docs/screenshots/login.png)

| Dashboard | First-run onboarding |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Onboarding](docs/screenshots/onboarding.png) |
| **Experiment detail (analysis)** | **Daily log** |
| ![Experiment detail](docs/screenshots/detail.png) | ![Daily log](docs/screenshots/daily-log.png) |
| **Experiment builder** | **Report (print theme)** |
| ![Builder](docs/screenshots/builder.png) | ![Report](docs/screenshots/report.png) |

> Captured with Playwright against a seeded demo — regenerate any time with `npm run screenshots` (from `web/`).

## Why this exists

A health-conscious person who wants to know whether a change actually helps — *does a higher-protein breakfast cut my afternoon hunger? does cutting late caffeine improve my sleep?* — has no good way to find out. Tracking apps pile on calorie counts and macro targets; they don't run an experiment, and they don't tell you whether the result is trustworthy.

Nutrition Experiment Lab models the experiment explicitly. You define one question and one intervention, log a handful of outcomes each day, and the engine compares your baseline window to your intervention window — but only after checking that you logged enough days, adhered well enough, and weren't derailed by confounders. If the data can't support a conclusion, it says so. No black boxes, no health claims.

## Core loop

1. Ask a question: *"Does a higher-protein breakfast reduce my afternoon hunger?"*
2. Choose a baseline window and an intervention window.
3. Define the intervention (one variable) and the outcomes to watch.
4. Log meals and daily outcomes — under a minute a day.
5. The system tracks adherence and flags confounders.
6. Run the analysis for a plain-language readout.
7. Decide: keep, repeat, refine, or discard.

## Run it

### Prerequisites

- **Python 3.11+** and **Node 20+**
- **PostgreSQL** running locally (the project was built against Postgres 17)

Create the app and test databases once:

```bash
createdb nutrition_lab
createdb nutrition_lab_test
```

The default connection string is `postgresql://postgres:postgres@localhost:5432/nutrition_lab`; override it with `NUTRITION_LAB_DATABASE_URL` if your setup differs. In any non-dev deployment also set `NUTRITION_LAB_SESSION_SECRET` (so session cookies survive restarts) and `NUTRITION_LAB_SESSION_SECURE=1` (HTTPS-only cookies).

### Backend

```bash
pip install -e ".[dev]"

# Schema + migrations apply automatically on startup.
nutrition-lab-serve          # FastAPI on :8000  (also: python -m nutrition_lab.serve)
```

Open http://localhost:8000/docs for the interactive API. The app is multi-user: sign up at `/login` (or load a demo from the dashboard once signed in). Every record is scoped to the signed-in account.

> Port 8000 in use? Set `NUTRITION_LAB_PORT=8077` (and point the frontend at it — see below).

### Frontend (two-process hot reload)

```bash
cd web
npm install
npm run dev                  # Next.js on :3000
```

Open http://localhost:3000. The dev server calls the FastAPI on :8000 with CORS enabled. If the backend runs on a different port, set it:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8077 npm run dev
```

## Data model

In [`src/nutrition_lab/db.py`](src/nutrition_lab/db.py) and [`models.py`](src/nutrition_lab/models.py):

| Entity | What it is |
| --- | --- |
| `app_user` | A registered account (email + bcrypt `password_hash`); every other row is scoped to its `user_id` |
| `experiment` | The question, hypothesis, status, and the baseline / washout / intervention windows |
| `intervention` | The one thing being changed, its rule text, and category (protein, fiber, timing, …) |
| `outcome_definition` | A measured outcome: kind, direction (higher/lower/target), and the `metric` it maps to |
| `daily_log` | One row per experiment per day: adherence + 1–5 ratings (hunger, energy, digestion, sleep, training), body weight, notes |
| `meal_log` | Meals attached to a day, with free-form tags |
| `confounder` | Things that could explain the result away (illness, travel, alcohol, poor sleep, …) graded low/medium/high |
| `analysis_snapshot` | A stored analysis run: adherence, baseline/intervention summaries, effect, confidence, caveats |

**Modeling choices worth flagging:**

- `daily_log` carries a `UNIQUE (experiment_id, date)` constraint and is written via upsert — logging the same day twice revises the row instead of duplicating it.
- The `phase` (baseline / washout / intervention) is derived from the date against the experiment's windows **at write time**, so analysis can group days without re-deriving.
- Each `outcome_definition` has a `metric` column naming which `daily_log` field it reads. The primary outcome's metric drives the directional result; this is what lets a free-form outcome name map onto a logged number.
- Only one primary outcome per experiment — setting a new primary demotes the old one, enforcing the "one clear question" discipline.
- Enums are modeled as `TEXT` + `CHECK` constraints (not native PG enums) so adding a value is a code change, not a migration. A tiny additive migration runner handles the columns introduced after a DB already exists.
- IDs are readable, app-generated strings (`exp_…`, `log_…`, `snap_…`).

## The analysis engine

Rules-based, not ML, and conservative by design. For a single person's n-of-1 data, **honest beats clever**. The engine ([`src/nutrition_lab/analysis.py`](src/nutrition_lab/analysis.py)) never makes a medical claim and never reports p-values in V1 — it prefers plain-language effect sizes and explicit caveats.

```
Adherence ─── coverage = logged days / expected days
               adherence rate = yes|partial / intervention days logged
   high  : coverage ≥ 85%  AND  adherence ≥ 80%
   medium: coverage ≥ 70%  AND  adherence ≥ 65%
   low   : anything below

Outcome   ─── baseline mean vs intervention mean, per outcome
   < 3 values either side                      → inconclusive
   rating change < 0.5  /  numeric change < 2% → unchanged
   else, by direction                          → improved | worsened

Confounders ─ high-severity confounder in intervention window → flag
              ≥ 2 medium confounders within one week          → flag
              primary outcome missing > 25% of days           → flag

Confidence ── starts from adherence trust, then downgrades:
   dominating confounder OR primary inconclusive → low
   high adherence + no flags                      → high
   otherwise                                      → medium
```

Every analysis is stored as an `analysis_snapshot`, so a report reflects exactly what the user last saw. The recommendation is drawn from a fixed set of neutral, non-medical actions — *repeat with cleaner adherence, extend by a week, keep if sustainable, discard, reduce variables* — and never suggests dosages, treatments, or restriction.

The protocol guardrails ([`safety.py`](src/nutrition_lab/safety.py)) are a separate, advisory layer: as you write an experiment, they flag restrictive or medical-sounding language and warn when an intervention changes too many variables or runs too short to trust.

## The dashboard

Next.js App Router + a Tailwind v4 design system: an `@theme` token palette
(warm ink on near-black, a single amber "signal" accent, semantic
improved/worsened/neutral colors, small radii, lines over shadows),
Instrument Serif / Instrument Sans / JetBrains Mono typography, and a
component library under `web/components/` (`ui` primitives, `viz`
charts — `ComparisonBar`, confidence/adherence meters — `brand`, and a
left `nav` rail). Screens share the same chrome:

- **`/`** — Dashboard: active/draft experiments and the completed library.
- **`/experiments/new`** — Builder: question, hypothesis, windows (with an optional washout period), intervention, and outcomes, with **live safety warnings** as you type.
- **`/log`** — Daily log: fast 1–5 rating buttons, adherence chips, weight, notes, and meals; pre-loads any existing entry for the date.
- **`/experiments/[id]`** — Detail: protocol, lifecycle actions, **Run analysis** with confidence/adherence badges, baseline-vs-intervention bar charts, confounder flags, recommendation, and an add-confounder form.
- **`/reports/[id]`** — Report: the shareable readout — outcomes, what changed / didn't, confounders, meal examples, recommendation, caveats, and a **Download PDF** button.

Plus an **`/account`** page (export your data as JSON, download the report PDF, or permanently delete everything) and a **`/privacy`** page describing the non-clinical positioning.

Grouped controls (rating and adherence buttons) use a `role="group"` with
per-button `aria-label`s rather than a wrapping `<label>`, so screen readers
announce each option correctly.

## API surface

Mounted in [`src/nutrition_lab/api.py`](src/nutrition_lab/api.py); browse it at `/docs`.

```
Auth          POST /api/auth/{signup|login|logout} · GET /api/auth/me
Experiments   GET/POST /api/experiments · GET/PATCH /api/experiments/{id}
              POST /api/experiments/{id}/{start|pause|resume|complete|abandon}
              POST /api/experiments/check-safety
Protocol      POST /api/experiments/{id}/interventions · PATCH /api/interventions/{id}
              POST /api/experiments/{id}/outcomes      · PATCH /api/outcomes/{id}
Logging       GET/POST /api/daily-log · PATCH /api/daily-log/{id}
              POST /api/daily-log/{id}/meals · PATCH /api/meals/{id}
              GET/POST /api/experiments/{id}/confounders
Analysis      POST /api/experiments/{id}/analyze · GET /api/experiments/{id}/analysis
              GET /api/experiments/{id}/report · GET /api/experiments/{id}/report.pdf
Account       GET /api/account/export · DELETE /api/account/data
```

## Tests

```bash
pip install -e ".[dev]"
pytest -q                    # runs against nutrition_lab_test

cd web && npm run e2e        # Playwright: boots API + web, drives the loop
```

40 backend tests covering invalid date windows and illegal lifecycle transitions, the single-primary-outcome rule, the daily-log upsert (one row per experiment+date), meals and confounders, the safety guardrails, the analysis engine across clean / messy / missing / confounded experiments, snapshot persistence, the "no p-values" guarantee, report generation, PDF export, account export, and the data-wipe (which keeps the user identity row). A **Playwright e2e** drives a real browser through the whole loop (dashboard → builder → log → analyze → report) against an isolated stack. `ruff` and `mypy` run clean; the frontend passes `tsc --noEmit`. All of it runs in [GitHub Actions](.github/workflows/tests.yml) on every push — backend on Python 3.11 & 3.12, frontend typecheck, and the e2e.

## Safety & privacy

This is a personal learning tool, not a medical service. It does not diagnose, treat, or manage any medical condition, and it avoids extreme-restriction and eating-disorder language by design. All meal, weight, symptom, and supplement data is treated as sensitive: there are no third-party analytics, the user can export everything as JSON, and account deletion removes all of it. See the in-app `/privacy` page and the [boundaries section of PLAN.md](PLAN.md).

## Project layout

```
nutrition-experiment-lab/
├── src/nutrition_lab/
│   ├── api.py            FastAPI app factory
│   ├── db.py             Postgres schema, connection helper, migrations
│   ├── models.py         Pydantic schemas + enums
│   ├── experiments.py    CRUD + lifecycle + validation
│   ├── logging.py        daily logs, meals, confounders
│   ├── analysis.py       the comparison engine
│   ├── safety.py         advisory protocol guardrails
│   ├── report.py         report builder + reportlab PDF
│   ├── account.py        data export + deletion
│   ├── demo.py           seeds a worked example
│   └── routes/           experiments · interventions · logging · analysis · account
├── tests/                pytest suite (against nutrition_lab_test)
├── web/                  Next.js 16 + Tailwind 4 + TanStack Query
│   ├── app/              dashboard · builder · log · detail · report · account · privacy
│   ├── components/       cards, charts, confounder list, safety notice, states, nav
│   ├── e2e/              Playwright core-loop test
│   └── lib/api.ts        typed client
└── PLAN.md               product thesis + phased build
```

## Status

V1 complete — all five phases of [PLAN.md](PLAN.md) shipped: experiment spine, daily logging, analysis engine, frontend, and export/safety polish. Now **multi-user** with email/password auth (bcrypt + a signed HttpOnly session cookie); every record is scoped to its owner and isolation is regression-tested.

Deliberately **out of scope**: barcode scanning, a full nutrient database, wearable integrations, AI meal generation, diet plans, and any medical-condition protocols.

## License

MIT.
