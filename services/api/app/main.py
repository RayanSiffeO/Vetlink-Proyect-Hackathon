from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from . import routers
from .config import API_TITLE, API_VERSION, settings
from .db import engine, init_db
from .models import Patient
from .seed import ensure_seed, patient_counts

logger = logging.getLogger("vetlink.api")

ASSETS_DIR = settings.web_dist / "assets"
SPA_INDEX = settings.web_dist / "index.html"


@asynccontextmanager
async def lifespan(_: FastAPI):
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


def spa_fallback(full_path: str):
    if full_path.startswith("api") or full_path in {"docs", "openapi.json"}:
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    candidate = settings.web_dist / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(SPA_INDEX)


def mount_spa_assets(application: FastAPI) -> None:
    if not ASSETS_DIR.is_dir():
        return
    application.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


if SPA_INDEX.is_file():
    mount_spa_assets(app)
    app.add_api_route("/{full_path:path}", spa_fallback, methods=["GET"], include_in_schema=False)
