from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query
from sqlmodel import select

from ..auth import specialist_id_for_user
from ..context import ApiCtx
from ..db import dumps_json, loads_json
from ..errors import UNPROCESSABLE, ensure, require_found
from ..models import Role, Specialist
from ..schemas import AvailabilityIn, role_value, specialist_dict

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


def _normalize_slots(slots: list[str]) -> list[str]:
    values: set[str] = set()
    for slot in slots:
        try:
            moment = datetime.fromisoformat(str(slot))
        except ValueError:
            ensure(False, f"Franja no válida: {slot}", UNPROCESSABLE)
        values.add(moment.isoformat())
    return sorted(values)


@router.patch("/{specialist_id}/availability", summary="Actualizar la disponibilidad del especialista")
def update_availability(specialist_id: str, payload: AvailabilityIn, ctx: ApiCtx) -> dict:
    ensure(role_value(ctx.user) == Role.SPECIALIST.value, "Solo el especialista puede editar su agenda")
    ensure(specialist_id_for_user(ctx.user) == specialist_id, "Solo puedes editar tu propia disponibilidad")
    spec = require_found(ctx.session.get(Specialist, specialist_id), "Especialista no encontrado")
    slots = _normalize_slots(payload.slots)
    spec.available_slots_json = dumps_json(slots)
    ctx.session.add(spec)
    ctx.session.commit()
    ctx.session.refresh(spec)
    ctx.audit("Specialist", spec.id, "UPDATE_AVAILABILITY")
    return {"specialist": specialist_dict(spec), "available_slots": slots, "slots_count": len(slots)}
