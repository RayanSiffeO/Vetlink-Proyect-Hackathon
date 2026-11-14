"""Agenda de citas derivadas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import select

from ..auth import CurrentUser, DbSession, role_value, specialist_id_for_user
from ..models import Appointment, Patient, Request, Role, Specialist

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _parse_bound(value: Optional[str], field: str) -> Optional[datetime]:
    if not value:
        return None
    for candidate in (value, f"{value}T00:00:00"):
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"'{field}' debe ser una fecha ISO 8601 (YYYY-MM-DD)",
    )


@router.get("", summary="Citas en un rango de fechas")
def list_appointments(
    user: CurrentUser,
    session: DbSession,
    from_: Optional[str] = Query(default=None, alias="from", description="Desde (YYYY-MM-DD)"),
    to: Optional[str] = Query(default=None, description="Hasta (YYYY-MM-DD)"),
) -> dict:
    start = _parse_bound(from_, "from")
    end = _parse_bound(to, "to")
    if end and end.hour == 0 and end.minute == 0 and len(str(to)) <= 10:
        end = end.replace(hour=23, minute=59, second=59)

    role = role_value(user)
    stmt = select(Request)
    if role == Role.CLINIC.value:
        stmt = stmt.where(Request.created_by == user.id)
    elif role == Role.SPECIALIST.value:
        stmt = stmt.where(Request.specialist_id == specialist_id_for_user(user))
    requests = list(session.exec(stmt).all())
    by_id = {r.id: r for r in requests}

    items: list[dict] = []
    for appt in session.exec(select(Appointment).order_by(Appointment.when_iso)).all():
        req = by_id.get(appt.request_id)
        if req is None:
            continue
        try:
            when = datetime.fromisoformat(appt.when_iso)
        except ValueError:
            continue
        if start and when < start:
            continue
        if end and when > end:
            continue
        patient = session.get(Patient, req.patient_id)
        spec = session.get(Specialist, req.specialist_id)
        items.append(
            {
                "id": appt.id,
                "request_id": appt.request_id,
                "when_iso": appt.when_iso,
                "status": appt.status,
                "patient_id": req.patient_id,
                "patient_name": patient.name if patient else None,
                "patient_species": patient.species if patient else None,
                "specialist_id": req.specialist_id,
                "specialist_name": spec.name if spec else None,
                "specialty": spec.specialty if spec else None,
                "motivo": req.motivo,
                "urgencia": req.urgencia,
                "request_status": str(req.status.value if hasattr(req.status, "value") else req.status),
            }
        )

    return {
        "appointments": items,
        "count": len(items),
        "range": {"from": from_, "to": to},
    }
