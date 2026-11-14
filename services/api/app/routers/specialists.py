from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
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


def _parse_slot(value: object) -> datetime:
    try:
        return datetime.fromisoformat(str(value))
    except ValueError as exc:
        raise HTTPException(
            status_code=UNPROCESSABLE,
            detail=f"Franja no válida: {value}",
        ) from exc


def _is_future(moment: datetime) -> bool:
    if moment.tzinfo is None:
        return moment > datetime.now()
    return moment > datetime.now(moment.tzinfo)


def _normalize_slot(value: object) -> str:
    moment = _parse_slot(value)
    ensure(_is_future(moment), f"La franja {value} ya ha pasado. Publica solo franjas futuras.", UNPROCESSABLE)
    if moment.tzinfo is not None:
        moment = moment.astimezone().replace(tzinfo=None)
    return moment.replace(microsecond=0).isoformat()


def _normalize_slots(slots: list[str]) -> list[str]:
    return sorted({_normalize_slot(slot) for slot in slots})


def _future_slots(spec: Specialist) -> list[str]:
    slots = loads_json(spec.available_slots_json, [])
    future: list[str] = []
    for slot in slots:
        try:
            moment = datetime.fromisoformat(str(slot))
        except ValueError:
            continue
        if _is_future(moment):
            future.append(str(slot))
    return future


def _specialist_payload(spec: Specialist) -> dict:
    payload = specialist_dict(spec)
    future = _future_slots(spec)
    payload["next_slot"] = future[0] if future else None
    return payload


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
        "specialists": [_specialist_payload(specialist) for specialist in filtered],
        "count": len(filtered),
        "filters": {"specialty": specialty, "zone": zone},
    }


@router.get("/{specialist_id}", summary="Ficha del especialista con slots")
def get_specialist(specialist_id: str, ctx: ApiCtx) -> dict:
    spec = require_found(ctx.session.get(Specialist, specialist_id), "Especialista no encontrado")
    slots = _future_slots(spec)
    return {
        "specialist": _specialist_payload(spec),
        "available_slots": slots,
        "slots_count": len(slots),
    }


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
    return {
        "specialist": _specialist_payload(spec),
        "available_slots": slots,
        "slots_count": len(slots),
    }
