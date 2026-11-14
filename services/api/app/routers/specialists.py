"""Directorio de especialistas y slots disponibles."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import select

from ..auth import CurrentUser, DbSession
from ..db import loads_json
from ..models import Specialist
from ..schemas import specialist_dict

router = APIRouter(prefix="/specialists", tags=["specialists"])


@router.get("", summary="Buscar especialistas por especialidad y zona")
def list_specialists(
    user: CurrentUser,
    session: DbSession,
    specialty: Optional[str] = Query(default=None, description="Filtro por especialidad"),
    zone: Optional[str] = Query(default=None, description="Filtro por zona"),
) -> dict:
    specs = list(session.exec(select(Specialist).order_by(Specialist.specialty, Specialist.name)).all())

    def match(value: str, needle: Optional[str]) -> bool:
        return not needle or needle.strip().lower() in (value or "").lower()

    filtered = [s for s in specs if match(s.specialty, specialty) and match(s.zone, zone)]
    return {
        "specialists": [specialist_dict(s) for s in filtered],
        "count": len(filtered),
        "filters": {"specialty": specialty, "zone": zone},
    }


@router.get("/{specialist_id}", summary="Ficha del especialista con slots")
def get_specialist(specialist_id: str, user: CurrentUser, session: DbSession) -> dict:
    spec = session.get(Specialist, specialist_id)
    if spec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Especialista no encontrado")
    slots = loads_json(spec.available_slots_json, [])
    return {
        "specialist": specialist_dict(spec),
        "available_slots": slots,
        "slots_count": len(slots),
    }
