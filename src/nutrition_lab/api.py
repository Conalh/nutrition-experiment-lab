"""FastAPI app factory.

Mounts the route modules and wires cross-cutting concerns (CORS for the
Next.js dev server, schema init on startup). Analysis and report routes
are deferred to Phase 3.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import load_env
from .db import init_db
from .routes import account, analysis, experiments, interventions, logging

# Origins allowed to call the API in dev (Next.js runs cross-port). Override
# via NUTRITION_LAB_CORS_ORIGINS (comma-separated) — e.g. the e2e harness
# points the frontend at a different port.
_DEFAULT_CORS = "http://localhost:3000,http://127.0.0.1:3000"


def _cors_origins() -> list[str]:
    raw = os.environ.get("NUTRITION_LAB_CORS_ORIGINS", _DEFAULT_CORS)
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_env()
    init_db()  # idempotent: ensures schema + default user exist
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Nutrition Experiment Lab", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    app.include_router(experiments.router)
    app.include_router(interventions.router)
    app.include_router(logging.router)
    app.include_router(analysis.router)
    app.include_router(account.router)

    @app.get("/api/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
