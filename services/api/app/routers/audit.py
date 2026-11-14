"""Trazabilidad: eventos de auditoría por solicitud y globales."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import select

from ..auth import CurrentUser, DbSession, is_participant
from ..db import audit_events_for, audit_to_dict, recent_audit_events, record_for_patient
from ..models import Appointment, Request

router = APIRouter(tags=["audit"])


@router.get("/requests/{request_id}/audit", summary="Eventos de auditoría de la solicitud")
def request_audit(request_id: str, user: CurrentUser, session: DbSession) -> dict:
    req = session.get(Request, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    if not is_participant(user, req):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No participas en esta derivación",
        )

    events = audit_events_for(session, "Request", req.id)

    record = record_for_patient(session, req.patient_id)
    if record is not None:
        events += audit_events_for(session, "Record", record.id)

    appointments = session.exec(select(Appointment).where(Appointment.request_id == req.id)).all()
    for appt in appointments:
        events += audit_events_for(session, "Appointment", appt.id)

    events.sort(key=lambda e: e.created_at)
    return {
        "events": [audit_to_dict(e) for e in events],
        "count": len(events),
        "request_id": req.id,
    }


@router.get("/audit", summary="Últimos eventos de auditoría")
def global_audit(
    user: CurrentUser,
    session: DbSession,
    limit: int = Query(default=50, ge=1, le=200, description="Máximo de eventos"),
) -> dict:
    events = recent_audit_events(session, limit)
    return {"events": [audit_to_dict(e) for e in events], "count": len(events), "limit": limit}
