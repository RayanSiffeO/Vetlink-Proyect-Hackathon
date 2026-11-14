"""Derivaciones (requests): creación, resumen no identificativo, briefing y estados."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..auth import CurrentUser, DbSession, is_participant, role_value, specialist_id_for_user
from ..briefing import build_briefing, build_patient_public, build_public_summary
from ..db import (
    alerts_for_patient,
    audit_events_for,
    audit_to_dict,
    log_audit,
    new_id,
    record_for_patient,
)
from ..models import (
    Appointment,
    Patient,
    Request,
    RequestStatus,
    Role,
    Specialist,
    utcnow,
)
from ..schemas import (
    AcceptIn,
    DeclineIn,
    RequestCreateIn,
    canonical_of,
    request_dict,
    specialist_dict,
)

router = APIRouter(prefix="/requests", tags=["requests"])

UNLOCKED_STATUSES = {
    RequestStatus.ACCEPTED,
    RequestStatus.SCHEDULED,
    RequestStatus.COMPLETED,
}
LOCKED_DETAIL = "La historia completa se desbloquea al aceptar la derivación"


def _load_request(session, request_id: str) -> Request:
    req = session.get(Request, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    return req


def _ensure_participant(user, req: Request) -> None:
    if not is_participant(user, req):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=LOCKED_DETAIL)


def _specialist_of(session, req: Request) -> Specialist | None:
    return session.get(Specialist, req.specialist_id)


def _patient_of(session, req: Request) -> Patient:
    patient = session.get(Patient, req.patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")
    return patient


def _canonical_of_request(session, req: Request) -> dict:
    record = record_for_patient(session, req.patient_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El paciente de la solicitud no tiene registro canónico",
        )
    return canonical_of(record)


@router.post("", summary="Crear una derivación")
def create_request(payload: RequestCreateIn, user: CurrentUser, session: DbSession) -> dict:
    if role_value(user) not in {Role.CLINIC.value, Role.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo la clínica puede crear derivaciones",
        )

    patient = session.get(Patient, payload.patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")
    specialist = session.get(Specialist, payload.specialist_id)
    if specialist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Especialista no encontrado")

    now = utcnow()
    req = Request(
        id=new_id("req"),
        patient_id=payload.patient_id,
        specialist_id=payload.specialist_id,
        created_by=user.id,
        status=RequestStatus.REQUESTED,
        motivo=payload.motivo,
        urgencia=payload.urgencia,
        share_level=payload.share_level,
        preferred=payload.preferred,
        created_at=now,
        updated_at=now,
    )
    session.add(req)
    session.commit()
    session.refresh(req)

    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Request",
        entity_id=req.id,
        action="REQUEST_CREATED",
    )
    return {"request": request_dict(req)}


@router.get("", summary="Solicitudes visibles según rol")
def list_requests(user: CurrentUser, session: DbSession) -> dict:
    role = role_value(user)
    stmt = select(Request).order_by(Request.created_at.desc())
    if role == Role.CLINIC.value:
        stmt = stmt.where(Request.created_by == user.id)
    elif role == Role.SPECIALIST.value:
        stmt = stmt.where(Request.specialist_id == specialist_id_for_user(user))
    reqs = list(session.exec(stmt).all())

    items = []
    for req in reqs:
        patient = session.get(Patient, req.patient_id)
        spec = _specialist_of(session, req)
        item = request_dict(req)
        item["patient_name"] = patient.name if patient else None
        item["patient_species"] = patient.species if patient else None
        item["specialist_name"] = spec.name if spec else None
        item["specialist_specialty"] = spec.specialty if spec else None
        items.append(item)

    return {"requests": items, "count": len(items), "scope": role}


@router.get("/{request_id}", summary="Detalle de la solicitud")
def get_request(request_id: str, user: CurrentUser, session: DbSession) -> dict:
    req = _load_request(session, request_id)
    _ensure_participant(user, req)
    patient = _patient_of(session, req)
    spec = _specialist_of(session, req)
    canonical = _canonical_of_request(session, req)
    briefing = build_briefing(canonical)
    return {
        "request": request_dict(req),
        "patient_summary": {
            "id": patient.id,
            "name": patient.name,
            "patient": build_patient_public(canonical),
            "headline": briefing["headline"],
            "alert_counts": briefing["alert_counts"],
        },
        "specialist": specialist_dict(spec) if spec else None,
    }


@router.get("/{request_id}/summary", summary="Resumen no identificativo pre/post aceptación")
def get_summary(request_id: str, user: CurrentUser, session: DbSession) -> dict:
    req = _load_request(session, request_id)
    _ensure_participant(user, req)
    canonical = _canonical_of_request(session, req)
    spec = _specialist_of(session, req)

    summary = build_public_summary(canonical, motivo=req.motivo, urgencia=req.urgencia)
    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Request",
        entity_id=req.id,
        action="VIEW_SUMMARY",
    )
    return {
        "request_id": req.id,
        "status": request_dict(req)["status"],
        "created_at": req.created_at.isoformat(),
        "urgencia": req.urgencia,
        "share_level": request_dict(req)["share_level"],
        "motivo": req.motivo,
        "preferred": req.preferred,
        **summary,
        "service": {
            "specialist_id": req.specialist_id,
            "specialist": spec.name if spec else None,
            "specialty": spec.specialty if spec else None,
            "zone": spec.zone if spec else None,
            "price_from": spec.price_from if spec else None,
            "next_slot": (specialist_dict(spec)["next_slot"] if spec else None),
        },
    }


@router.post("/{request_id}/accept", summary="Aceptar la derivación (opcionalmente con slot)")
def accept_request(
    request_id: str,
    user: CurrentUser,
    session: DbSession,
    payload: AcceptIn | None = None,
) -> dict:
    req = _load_request(session, request_id)
    if role_value(user) != Role.SPECIALIST.value or req.specialist_id != specialist_id_for_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el especialista asignado puede aceptar la derivación",
        )
    if req.status not in {RequestStatus.REQUESTED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La solicitud no está en estado REQUESTED (estado: {request_dict(req)['status']})",
        )

    spec = _specialist_of(session, req)
    slot_iso = payload.slot_iso if payload else None
    if slot_iso:
        try:
            datetime.fromisoformat(slot_iso)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="slot_iso debe ser una fecha ISO 8601 válida",
            )
        req.status = RequestStatus.SCHEDULED
        appointment = Appointment(
            id=new_id("apt"),
            request_id=req.id,
            when_iso=slot_iso,
            status="SCHEDULED",
        )
        session.add(appointment)
    else:
        req.status = RequestStatus.ACCEPTED
        appointment = None

    req.updated_at = utcnow()
    session.add(req)
    session.commit()
    session.refresh(req)

    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Request",
        entity_id=req.id,
        action="REQUEST_ACCEPTED" if appointment is None else "REQUEST_SCHEDULED",
    )
    if appointment is not None:
        log_audit(
            session,
            actor=user.username,
            role=role_value(user),
            entity_type="Appointment",
            entity_id=appointment.id,
            action="APPOINTMENT_CREATED",
        )
        session.refresh(appointment)

    return {
        "request": request_dict(req),
        "appointment": {
            "id": appointment.id,
            "request_id": appointment.request_id,
            "when_iso": appointment.when_iso,
            "status": appointment.status,
        }
        if appointment
        else None,
        "specialist": specialist_dict(spec) if spec else None,
    }


@router.post("/{request_id}/decline", summary="Rechazar la derivación")
def decline_request(
    request_id: str,
    user: CurrentUser,
    session: DbSession,
    payload: DeclineIn | None = None,
) -> dict:
    req = _load_request(session, request_id)
    if role_value(user) != Role.SPECIALIST.value or req.specialist_id != specialist_id_for_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el especialista asignado puede rechazar la derivación",
        )
    if req.status not in {RequestStatus.REQUESTED, RequestStatus.ACCEPTED, RequestStatus.SCHEDULED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede rechazar una solicitud en estado {request_dict(req)['status']}",
        )
    req.status = RequestStatus.DECLINED
    req.updated_at = utcnow()
    session.add(req)
    session.commit()
    session.refresh(req)
    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Request",
        entity_id=req.id,
        action="REQUEST_DECLINED",
    )
    return {
        "request": request_dict(req),
        "reason": payload.reason if payload else None,
        "detail": "Derivación rechazada. La clínica recupera el caso.",
    }


@router.post("/{request_id}/cancel", summary="Cancelar la derivación (clínica)")
def cancel_request(request_id: str, user: CurrentUser, session: DbSession) -> dict:
    req = _load_request(session, request_id)
    role = role_value(user)
    if role == Role.CLINIC.value and req.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo la clínica que creó la solicitud puede cancelarla",
        )
    if role not in {Role.CLINIC.value, Role.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo la clínica puede cancelar la derivación",
        )
    if req.status in {RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.DECLINED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede cancelar una solicitud en estado {request_dict(req)['status']}",
        )
    req.status = RequestStatus.CANCELLED
    req.updated_at = utcnow()
    session.add(req)
    for appt in session.exec(select(Appointment).where(Appointment.request_id == req.id)).all():
        appt.status = "CANCELLED"
        session.add(appt)
    session.commit()
    session.refresh(req)
    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Request",
        entity_id=req.id,
        action="REQUEST_CANCELLED",
    )
    return {"request": request_dict(req), "detail": "Derivación cancelada"}


@router.get("/{request_id}/briefing", summary="Briefing completo (solo tras aceptar)")
def get_briefing(request_id: str, user: CurrentUser, session: DbSession) -> dict:
    req = _load_request(session, request_id)
    if not is_participant(user, req):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=LOCKED_DETAIL)
    if req.status not in UNLOCKED_STATUSES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=LOCKED_DETAIL)

    canonical = _canonical_of_request(session, req)
    briefing = build_briefing(canonical)
    patient = _patient_of(session, req)
    record = record_for_patient(session, req.patient_id)
    alerts = alerts_for_patient(session, req.patient_id)
    spec = _specialist_of(session, req)

    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Request",
        entity_id=req.id,
        action="VIEW_BRIEFING",
    )
    session.refresh(req)
    events = audit_events_for(session, "Request", req.id)

    return {
        "request": request_dict(req),
        "briefing": briefing,
        "record": canonical,
        "record_meta": {
            "id": record.id if record else None,
            "source_system": record.source_system if record else None,
            "record_version": record.record_version if record else None,
            "imported_at": record.imported_at.isoformat() if record else None,
            "alerts_count": len(alerts),
        },
        "patient_summary": {
            "id": patient.id,
            "name": patient.name,
            "owner_display": patient.owner_display,
            "microchip": patient.microchip,
            "patient": build_patient_public(canonical),
        },
        "specialist": specialist_dict(spec) if spec else None,
        "audit": [audit_to_dict(e) for e in events],
        "unlocked_at": req.updated_at.isoformat(),
    }
