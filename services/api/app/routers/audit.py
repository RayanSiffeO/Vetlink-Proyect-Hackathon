from __future__ import annotations

from fastapi import APIRouter, Query
from sqlmodel import select

from ..auth import is_participant
from ..context import ApiCtx
from ..db import audit_events_for, audit_to_dict, recent_audit_events, record_for_patient, request_or_404
from ..errors import ensure
from ..models import Appointment, AuditEvent, Request

router = APIRouter(tags=["audit"])


def _request_events(session, req: Request) -> list[AuditEvent]:
    events = audit_events_for(session, "Request", req.id)
    record = record_for_patient(session, req.patient_id)
    if record is not None:
        events += audit_events_for(session, "Record", record.id)
    appointments = session.exec(select(Appointment).where(Appointment.request_id == req.id)).all()
    for appointment in appointments:
        events += audit_events_for(session, "Appointment", appointment.id)
    return sorted(events, key=lambda event: event.created_at)


@router.get("/requests/{request_id}/audit", summary="Eventos de auditoría de la solicitud")
def request_audit(request_id: str, ctx: ApiCtx) -> dict:
    req = request_or_404(ctx.session, request_id)
    ensure(is_participant(ctx.user, req), "No participas en esta derivación")
    events = _request_events(ctx.session, req)
    return {
        "events": [audit_to_dict(event) for event in events],
        "count": len(events),
        "request_id": req.id,
    }


@router.get("/audit", summary="Últimos eventos de auditoría")
def global_audit(
    ctx: ApiCtx,
    limit: int = Query(default=50, ge=1, le=200, description="Máximo de eventos"),
) -> dict:
    events = recent_audit_events(ctx.session, limit)
    return {"events": [audit_to_dict(event) for event in events], "count": len(events), "limit": limit}
