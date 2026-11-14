from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query
from sqlmodel import select

from ..auth import request_scope
from ..context import ApiCtx
from ..errors import UNPROCESSABLE, ensure
from ..models import Appointment, Patient, Request, Specialist
from ..schemas import request_status

router = APIRouter(prefix="/appointments", tags=["appointments"])


@dataclass(frozen=True)
class DateRange:
    start: Optional[datetime] = None
    end: Optional[datetime] = None

    def contains(self, moment: datetime) -> bool:
        if self.start and moment < self.start:
            return False
        if self.end and moment > self.end:
            return False
        return True


def _parse_datetime(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _parse_bound(value: Optional[str], field: str) -> Optional[datetime]:
    if not value:
        return None
    parsed = _parse_datetime(value) or _parse_datetime(f"{value}T00:00:00")
    ensure(parsed is not None, f"'{field}' debe ser una fecha ISO 8601 (YYYY-MM-DD)", UNPROCESSABLE)
    return parsed


def _inclusive_end(raw: Optional[str], parsed: Optional[datetime]) -> Optional[datetime]:
    if parsed is None:
        return None
    if len(str(raw)) > 10 or parsed.hour or parsed.minute:
        return parsed
    return parsed.replace(hour=23, minute=59, second=59)


def _visible_requests(session, user) -> list[Request]:
    return list(session.exec(request_scope(user)).all())


def _appointment_item(session, appointment: Appointment, req: Request) -> dict:
    patient = session.get(Patient, req.patient_id)
    spec = session.get(Specialist, req.specialist_id)
    return {
        "id": appointment.id,
        "request_id": appointment.request_id,
        "when_iso": appointment.when_iso,
        "status": appointment.status,
        "patient_id": req.patient_id,
        "patient_name": patient.name if patient else None,
        "patient_species": patient.species if patient else None,
        "specialist_id": req.specialist_id,
        "specialist_name": spec.name if spec else None,
        "specialty": spec.specialty if spec else None,
        "motivo": req.motivo,
        "urgencia": req.urgencia,
        "request_status": request_status(req),
    }


def _collect_appointments(session, requests_by_id: dict[str, Request], window: DateRange) -> list[dict]:
    appointments = session.exec(select(Appointment).order_by(Appointment.when_iso)).all()
    items: list[dict] = []
    for appointment in appointments:
        req = requests_by_id.get(appointment.request_id)
        moment = _parse_datetime(appointment.when_iso)
        if req is None or moment is None or not window.contains(moment):
            continue
        items.append(_appointment_item(session, appointment, req))
    return items


@router.get("", summary="Citas en un rango de fechas")
def list_appointments(
    ctx: ApiCtx,
    from_: Optional[str] = Query(default=None, alias="from", description="Desde (YYYY-MM-DD)"),
    to: Optional[str] = Query(default=None, description="Hasta (YYYY-MM-DD)"),
) -> dict:
    window = DateRange(_parse_bound(from_, "from"), _inclusive_end(to, _parse_bound(to, "to")))
    requests_by_id = {req.id: req for req in _visible_requests(ctx.session, ctx.user)}
    items = _collect_appointments(ctx.session, requests_by_id, window)
    return {
        "appointments": items,
        "count": len(items),
        "range": {"from": from_, "to": to},
    }
