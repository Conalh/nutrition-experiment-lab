# Nutrition Experiment Lab — Roadmap

**Goal:** A private, trustworthy n-of-1 nutrition experiment tracker — safe enough for a non-clinical private beta, durable without the maintainer's laptop, and differentiated on an honest analysis layer that shows its work and refuses to overclaim.

**Live today:** local dev via `nutrition-lab-serve` (FastAPI on :8000) + `npm run dev` (Next.js on :3000) · **40 tests** green · `ruff` + `mypy` + frontend `tsc` clean.

Phases below are **sequenced, not scheduled**. Each ships something usable before the next starts.

---

## Shipped foundations

These were the plan; they are done. Kept here so the forward phases don't repeat solved problems.

| Area | What landed | Where |
| --- | --- | --- |
| **Experiment spine** | CRUD + lifecycle (draft → active → paused → completed/abandoned), date-window + transition validation | `experiments.py`, `routes/experiments.py` |
| **Protocol** | Interventions + outcome definitions, single-primary-outcome rule, outcome→metric mapping | `experiments.py`, `models.py` |
| **Daily logging** | Upsert log (one per experiment+date), derived phase, meals, confounders | `logging.py`, `routes/logging.py` |
| **Analysis engine** | Adherence trust tiers, baseline-vs-intervention comparison, confounder flags, confidence rating, neutral recommendation, snapshot persistence | `analysis.py` |
| **Safety guardrails** | Advisory protocol checks for restrictive / medical / multi-variable / too-short protocols | `safety.py` |
| **Report + PDF** | Plain-language readout + reportlab PDF export | `report.py`, `routes/analysis.py` |
| **Account controls** | Full JSON export; complete data wipe (keeps user identity) | `account.py`, `routes/account.py` |
| **Frontend** | Dashboard, builder (live safety warnings), daily log, detail (charts + analyze), report (PDF), account, privacy | `web/app/`, `web/components/` |
| **Repo hygiene** | README, LICENSE (MIT), `.gitignore`, this roadmap | repo root |

---

## Next up (recommended order)

Short horizon before chasing new surface area:

1. **Friend test** — one real person runs a full experiment end-to-end (see Phase 1).
2. **CI green on every push** — backend tests + lint + frontend typecheck in GitHub Actions.
3. **First-run onboarding** — zero-experiment empty states that guide builder → log → analyze.
4. **One-command run** — a dev script (or Docker Compose) that boots Postgres + API + web together.
5. **Seed/reset controls** — load and clear the demo experiment from the UI, not just the CLI.

---

## Phase 1 — Friend test

**Goal:** One real human (not the maintainer) designs an experiment, logs a week, and reads a report.

**What to watch for:** Is daily logging actually under a minute? Does the analysis readout feel honest and clear? Does any copy read as medical advice or pressure? Capture friction, don't fix it live.

**Exit:** One completed experiment from a real user, with a recorded keep/repeat/refine/discard decision and notes on what confused them.

## Phase 2 — Beta hardening

**Goal:** The repo is safe to hand to a few private testers.

- GitHub Actions CI: Postgres service, `pytest`, `ruff`, `mypy`, frontend `tsc`.
- First-run onboarding + empty states.
- Print-friendly report CSS as a fallback alongside the PDF.
- Basic error surfaces in the UI (API down, validation errors) instead of bare states.

**Exit:** A new machine can clone, follow the README, and reach a working app without tribal knowledge.

## Phase 3 — Deploy

**Goal:** It runs somewhere other than a laptop.

- Multi-stage Dockerfile (Node builds the web bundle; Python serves the API).
- Serve the built frontend from FastAPI for a single-process deploy, or host the two separately.
- Managed Postgres + connection-string config; backups/snapshots.
- A hosting target (Fly.io or similar) with a deploy runbook.

**Exit:** A reachable URL the maintainer can open from a phone.

## Phase 4 — Real auth / multi-user

**Goal:** More than one person, safely isolated.

- Email + password (bcrypt) + signed HttpOnly session cookie (`itsdangerous` is already a dependency).
- Replace the single `current_user_id` dependency with the authenticated user; scope every query.
- Login/logout UI; per-user data isolation tests.

**Exit:** Two users cannot see each other's experiments; an isolation regression suite proves it.

## Phase 5 — Product depth (pick by user demand)

Out of V1 scope on purpose; revisit only if testers ask:

- Lightweight protein/fiber/hydration lookup (neutral, source-linked — not a full nutrient DB).
- CSV / wearable import for sleep or body weight to reduce manual logging.
- Richer trend charts (per-day series, rolling means) beyond the baseline-vs-intervention bars.
- Experiment templates for common questions.

**Deliberately excluded indefinitely:** barcode scanning, a full nutrient database, AI meal generation, diet plans, and any medical-condition protocols — these conflict with the non-clinical positioning in [PLAN.md](PLAN.md).

---

## Safety posture (carries through every phase)

The product must never drift into medical territory: no diagnosis, treatment, dosing, or extreme-restriction guidance. Health-related data stays minimal, exportable, and fully deletable. Any feature that pulls from multiple health sources or fitness trackers triggers a review of FTC Health Breach Notification Rule obligations before it ships.
