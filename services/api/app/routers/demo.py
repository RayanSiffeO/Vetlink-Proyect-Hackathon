"""Utilidades de demo: reset reproducible y estado."""

from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import Session

from ..auth import CurrentUser, DbSession, role_value
from ..config import settings
from ..db import engine, log_audit
from ..seed import build_import_cache, patient_counts, reset_and_seed

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset", summary="Borra y reseeda la base de datos demo")
def reset_demo(user: CurrentUser, session: DbSession) -> dict:
    # Se capturan los datos del actor antes del reset: la sesión de la petición
    # se descarta y el reset corre en una sesión nueva (las tablas se recrean).
    actor, role = user.username, role_value(user)
    session.rollback()
    with Session(engine) as fresh:
        reset_and_seed(fresh)
        log_audit(
            fresh,
            actor=actor,
            role=role,
            entity_type="Database",
            entity_id="data/vetlink.db",
            action="DEMO_RESET",
        )
        counts = patient_counts(fresh)
    return {
        "status": "ok",
        "detail": "Base de datos demo recreada con los 3 registros canónicos",
        "seeded": True,
        "counts": counts,
        "import_cache_entries": len(build_import_cache()),
        "db": str(settings.db_path),
    }


@router.get("/state", summary="Estado del dataset demo")
def demo_state(user: CurrentUser, session: DbSession) -> dict:
    return {
        "seeded": patient_counts(session)["patients"] > 0,
        "counts": patient_counts(session),
        "import_cache_entries": len(build_import_cache()),
        "canonical_dir": str(settings.canonical_dir),
        "samples_dir": str(settings.samples_dir),
    }
