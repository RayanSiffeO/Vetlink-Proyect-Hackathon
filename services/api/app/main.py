"""VetLink API — H+0 (FastAPI + SQLModel + SQLite)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from .config import settings, API_TITLE, API_VERSION
from .db import engine, init_db
from .models import Patient
from .seed import ensure_seed, patient_counts
from . import routers

logger = logging.getLogger("vetlink.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Crea tablas y siembra la demo si la BD está vacía (idempotente)."""
    init_db()
    with Session(engine) as session:
        seeded_now = ensure_seed(session)
        counts = patient_counts(session)
    logger.info("VetLink API lista. seed=%s counts=%s", seeded_now, counts)
    yield


app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=(
        "API de VetLink — historia clínica unificada y derivaciones entre clínicas y "
        "especialistas. Demo de hackathon: autenticación por cookie firmada, SQLite y "
        "briefing determinista (sin LLM)."
    ),
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"], summary="Estado de la API")
def health() -> dict:
    init_db()
    with Session(engine) as session:
        seeded = session.get(Patient, "pat_kira") is not None
        counts = patient_counts(session)
    return {
        "status": "ok",
        "db": "sqlite",
        "seeded": seeded,
        "version": API_VERSION,
        "counts": counts,
    }


for router in routers.ALL_ROUTERS:
    app.include_router(router, prefix=settings.api_prefix)


# --- SPA compilada (solo si existe apps/web/dist); nunca intercepta /api ---
if settings.web_dist.exists() and (settings.web_dist / "index.html").exists():
    assets_dir = settings.web_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        if full_path.startswith("api") or full_path in {"docs", "openapi.json"}:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = settings.web_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(settings.web_dist / "index.html")
