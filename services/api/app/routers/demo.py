from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import Session

from ..config import settings
from ..context import ApiCtx
from ..db import AuditEntry, engine, write_audit
from ..schemas import role_value
from ..seed import build_import_cache, patient_counts, reset_and_seed

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset", summary="Borra y reseeda la base de datos demo")
def reset_demo(ctx: ApiCtx) -> dict:
    actor, role = ctx.user.username, role_value(ctx.user)
    ctx.session.rollback()
    with Session(engine) as fresh:
        reset_and_seed(fresh)
        write_audit(
            fresh,
            AuditEntry(
                actor=actor,
                role=role,
                entity_type="Database",
                entity_id="data/vetlink.db",
                action="DEMO_RESET",
            ),
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
def demo_state(ctx: ApiCtx) -> dict:
    counts = patient_counts(ctx.session)
    return {
        "seeded": counts["patients"] > 0,
        "counts": counts,
        "import_cache_entries": len(build_import_cache()),
        "canonical_dir": str(settings.canonical_dir),
        "samples_dir": str(settings.samples_dir),
    }
