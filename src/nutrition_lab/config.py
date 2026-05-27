"""Runtime configuration. All knobs are environment-driven so the same
code runs locally, in tests, and in a deployment without edits."""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv


@lru_cache(maxsize=1)
def load_env() -> None:
    """Load a .env file once if present. Idempotent; safe to call from
    any entrypoint (API, CLI, tests)."""
    load_dotenv()


def database_url() -> str:
    """Postgres connection string. Defaults to the locally-provisioned
    ``nutrition_lab`` database created during setup. Tests override this
    via ``NUTRITION_LAB_DATABASE_URL`` pointing at ``nutrition_lab_test``."""
    load_env()
    return os.environ.get(
        "NUTRITION_LAB_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/nutrition_lab",
    )


# Single-user app for V1: every request resolves to this user. The email
# matches the owner's so a future multi-user migration can link by email.
DEFAULT_USER_ID = os.environ.get("NUTRITION_LAB_DEFAULT_USER_ID", "u_default")
DEFAULT_USER_EMAIL = os.environ.get(
    "NUTRITION_LAB_DEFAULT_USER_EMAIL", "conal.hg@gmail.com"
)
DEFAULT_USER_NAME = os.environ.get("NUTRITION_LAB_DEFAULT_USER_NAME", "Conal")
DEFAULT_USER_TZ = os.environ.get("NUTRITION_LAB_DEFAULT_USER_TZ", "UTC")
