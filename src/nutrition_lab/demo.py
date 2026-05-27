"""Seed one realistic completed experiment so the UI and reports have
data to render before any real logging happens.

Idempotent-ish: running it twice creates a second demo experiment. For a
clean reseed, delete experiments whose title starts with '[demo]'.
"""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

from .config import DEFAULT_USER_ID
from .db import DictConn, connect, ensure_default_user
from .experiments import (
    add_intervention,
    add_outcome,
    complete_experiment,
    create_experiment,
    start_experiment,
)
from .logging import add_confounder, add_meal, upsert_daily_log
from .models import (
    Adherence,
    ConfounderCreate,
    ConfounderKind,
    DailyLogUpsert,
    ExperimentCreate,
    InterventionCategory,
    InterventionCreate,
    MealCreate,
    Metric,
    OutcomeCreate,
    OutcomeDirection,
    OutcomeKind,
    Severity,
)

DEMO_TITLE = "[demo] Higher-protein breakfast vs afternoon hunger"


def seed_demo(conn: DictConn, user_id: str = DEFAULT_USER_ID) -> str:
    """Create and fully populate one completed demo experiment. Returns id."""
    ensure_default_user(conn)
    rng = random.Random(42)

    today = date.today()
    baseline_start = today - timedelta(days=21)
    baseline_end = baseline_start + timedelta(days=6)
    intervention_start = baseline_end + timedelta(days=1)
    intervention_end = intervention_start + timedelta(days=13)

    exp = create_experiment(
        conn,
        user_id,
        ExperimentCreate(
            title=DEMO_TITLE,
            question="Does a higher-protein breakfast reduce my afternoon hunger?",
            hypothesis=(
                "Eating 40g of protein at breakfast keeps me fuller, so my "
                "afternoon hunger rating drops compared with my usual breakfast."
            ),
            baseline_start=baseline_start,
            baseline_end=baseline_end,
            intervention_start=intervention_start,
            intervention_end=intervention_end,
            primary_outcome="Afternoon hunger (1-5, lower is better)",
        ),
    )

    add_intervention(
        conn,
        user_id,
        exp.id,
        InterventionCreate(
            name="40g protein breakfast",
            rule_text="Eat at least 40g of protein within an hour of waking.",
            category=InterventionCategory.protein,
            expected_effect="Lower afternoon hunger and steadier energy.",
        ),
    )

    add_outcome(
        conn,
        user_id,
        exp.id,
        OutcomeCreate(
            name="Afternoon hunger",
            kind=OutcomeKind.rating,
            direction=OutcomeDirection.lower_better,
            metric=Metric.hunger,
            is_primary=True,
        ),
    )
    add_outcome(
        conn,
        user_id,
        exp.id,
        OutcomeCreate(
            name="Afternoon energy",
            kind=OutcomeKind.rating,
            direction=OutcomeDirection.higher_better,
            metric=Metric.energy,
        ),
    )

    start_experiment(conn, user_id, exp.id)

    # Baseline: higher hunger (~4), lower energy (~3).
    # Intervention: lower hunger (~2.5), higher energy (~3.7). Add noise.
    day = baseline_start
    while day <= intervention_end:
        in_intervention = day >= intervention_start
        if in_intervention:
            hunger = max(1, min(5, round(rng.gauss(2.5, 0.7))))
            energy = max(1, min(5, round(rng.gauss(3.7, 0.6))))
            adherence = Adherence.yes if rng.random() > 0.15 else Adherence.partial
        else:
            hunger = max(1, min(5, round(rng.gauss(4.0, 0.6))))
            energy = max(1, min(5, round(rng.gauss(3.0, 0.6))))
            adherence = Adherence.not_applicable

        log = upsert_daily_log(
            conn,
            user_id,
            DailyLogUpsert(
                experiment_id=exp.id,
                date=day,
                adherence=adherence,
                hunger=hunger,
                energy=energy,
                digestion=max(1, min(5, round(rng.gauss(3.5, 0.6)))),
                sleep_quality=max(1, min(5, round(rng.gauss(3.5, 0.7)))),
                training_performance=max(1, min(5, round(rng.gauss(3.2, 0.9)))),
                body_weight=round(rng.gauss(78.0, 0.4), 1),
                notes="",
            ),
        )

        if in_intervention:
            add_meal(
                conn,
                user_id,
                log.id,
                MealCreate(
                    eaten_at=datetime.combine(day, time(7, 30)),
                    description="Greek yogurt, whey scoop, berries, oats",
                    tags=["breakfast", "high-protein"],
                ),
            )
        else:
            add_meal(
                conn,
                user_id,
                log.id,
                MealCreate(
                    eaten_at=datetime.combine(day, time(7, 45)),
                    description="Toast with jam and coffee",
                    tags=["breakfast"],
                ),
            )
        day += timedelta(days=1)

    # One confounder during the intervention window for realism.
    add_confounder(
        conn,
        user_id,
        exp.id,
        ConfounderCreate(
            date=intervention_start + timedelta(days=4),
            kind=ConfounderKind.poor_sleep,
            severity=Severity.medium,
            notes="Bad night's sleep, felt hungrier than usual.",
        ),
    )

    complete_experiment(conn, user_id, exp.id)
    return exp.id


def main() -> None:
    conn = connect()
    try:
        exp_id = seed_demo(conn)
        print(f"Seeded demo experiment: {exp_id}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
