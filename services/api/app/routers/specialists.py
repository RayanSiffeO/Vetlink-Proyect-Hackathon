from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from sqlmodel import select

from ..context import ApiCtx
from ..db import loads_json
from ..errors import require_found
from ..models import Specialist
from ..schemas import specialist_dict

router = APIRouter(prefix="/specialists", tags=["specialists"])


def _matches(value: str, needle: Optional[str]) -> bool:
    if not needle:
        return True
    return needle.strip().lower() in (value or "").lower()


@router.get("", summary="Buscar especialistas por especialidad y zona")
def list_specialists(
    ctx: ApiCtx,
    specialty: Optional[str] = Query(default=None, description="Filtro por especialidad"),
    zone: Optional[str] = Query(default=None, description="Filtro por zona"),
) -> dict:
    statement = select(Specialist).order_by(Specialist.specialty, Specialist.name)
    specialists = list(ctx.session.exec(statement).all())
    filtered = [
        specialist
        for specialist in specialists
        if _matches(specialist.specialty, specialty) and _matches(specialist.zone, zone)
    ]
    return {
        "specialists": [specialist_dict(specialist) for specialist in filtered],
        "count": len(filtered),
        "filters": {"specialty": specialty, "zone": zone},
    }


@router.get("/{specialist_id}", summary="Ficha del especialista con slots")
def get_specialist(specialist_id: str, ctx: ApiCtx) -> dict:
    spec = require_found(ctx.session.get(Specialist, specialist_id), "Especialista no encontrado")
    slots = loads_json(spec.available_slots_json, [])
    return {
        "specialist": specialist_dict(spec),
        "available_slots": slots,
        "slots_count": len(slots),
    }
