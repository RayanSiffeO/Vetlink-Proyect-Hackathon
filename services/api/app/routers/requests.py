from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ..auth import is_participant, request_scope, role_value, specialist_id_for_user
from ..briefing import build_briefing, build_patient_public, build_public_summary
from ..context import ApiContext, ApiCtx
from ..db import (
    alerts_for_patient,
    audit_events_for,
    audit_to_dict,
    dumps_json,
    new_id,
    record_for_patient,
    request_or_404,
)
from ..errors import CONFLICT, UNPROCESSABLE, ensure, require_found
from ..models import (
    Appointment,
    Patient,
    Record,
    Request,
    RequestStatus,
    Role,
    Specialist,
    User,
    utcnow,
)
from ..schemas import (
    AcceptIn,
    CloseRequest,
    DeclineIn,
    RequestCreateIn,
    appointment_dict,
    canonical_of,
    patient_dict,
    record_dict,
    request_dict,
    request_status,
    specialist_dict,
)

router = APIRouter(prefix="/requests", tags=["requests"])

UNLOCKED_STATUSES = {
    RequestStatus.ACCEPTED,
    RequestStatus.SCHEDULED,
    RequestStatus.COMPLETED,
}
DECLINABLE_STATUSES = {
    RequestStatus.REQUESTED,
    RequestStatus.ACCEPTED,
    RequestStatus.SCHEDULED,
}
NON_CANCELLABLE_STATUSES = {
    RequestStatus.COMPLETED,
    RequestStatus.CANCELLED,
    RequestStatus.DECLINED,
}
CLOSABLE_STATUSES = {
    RequestStatus.ACCEPTED,
    RequestStatus.SCHEDULED,
}
LOCKED_DETAIL = "La historia completa se desbloquea al aceptar la derivación"
NOT_PARTICIPANT_DETAIL = "No participas en esta derivación"
PAST_SLOT_DETAIL = "La franja ya ha pasado. Elige una franja futura."
SLOT_BUSY_DETAIL = "La franja ya está ocupada. Elige otra franja."
ACCEPT_DETAIL = "Solo el especialista asignado puede aceptar la derivación"
DECLINE_DETAIL = "Solo el especialista asignado puede rechazar la derivación"
CLOSE_DETAIL = "Solo el especialista asignado puede cerrar la visita"
RECORD_MISSING_DETAIL = "El paciente de la solicitud no tiene registro canónico"
SPECIALIST_SOURCE_SYSTEM = "VetLink · especialista"
SPECIALIST_SOURCE_FORMAT = "VETLINK"


def _patient_of(session, req: Request) -> Patient:
    return require_found(session.get(Patient, req.patient_id), "Paciente no encontrado")


def _specialist_of(session, req: Request) -> Specialist | None:
    return session.get(Specialist, req.specialist_id)


def _record_of_request(session, req: Request) -> Record:
    return require_found(record_for_patient(session, req.patient_id), RECORD_MISSING_DETAIL, CONFLICT)


def _canonical_of_request(session, req: Request) -> dict:
    return canonical_of(_record_of_request(session, req))


def _ensure_assigned_specialist(user: User, req: Request, detail: str) -> None:
    assigned = role_value(user) == Role.SPECIALIST.value
    ensure(assigned and req.specialist_id == specialist_id_for_user(user), detail)


def _ensure_can_cancel(user: User, req: Request) -> None:
    role = role_value(user)
    ensure(
        role != Role.CLINIC.value or req.created_by == user.id,
        "Solo la clínica que creó la solicitud puede cancelarla",
    )
    ensure(role in {Role.CLINIC.value, Role.ADMIN.value}, "Solo la clínica puede cancelar la derivación")


def _ensure_unlocked(user: User, req: Request) -> None:
    ensure(is_participant(user, req), NOT_PARTICIPANT_DETAIL)
    ensure(req.status in UNLOCKED_STATUSES, LOCKED_DETAIL)


def _apply_status(ctx: ApiContext, req: Request, new_status: RequestStatus) -> None:
    req.status = new_status
    req.updated_at = utcnow()
    ctx.session.add(req)
    ctx.session.commit()
    ctx.session.refresh(req)


def _parse_slot(value: str) -> datetime:
    try:
        return datetime.fromisoformat(str(value))
    except ValueError as exc:
        raise HTTPException(
            status_code=UNPROCESSABLE,
            detail="slot_iso debe ser una fecha ISO 8601 válida",
        ) from exc


def _is_past(moment: datetime) -> bool:
    if moment.tzinfo is None:
        return moment < datetime.now()
    return moment < datetime.now(moment.tzinfo)


def _normalize_slot(moment: datetime) -> str:
    if moment.tzinfo is not None:
        moment = moment.astimezone().replace(tzinfo=None)
    return moment.replace(microsecond=0).isoformat()


def _ensure_slot_free(session, specialist_id: str, slot_iso: str) -> None:
    statement = (
        select(Appointment)
        .join(Request, Request.id == Appointment.request_id)
        .where(Request.specialist_id == specialist_id)
        .where(Appointment.status == "SCHEDULED")
    )
    for appointment in session.exec(statement).all():
        try:
            candidate = _normalize_slot(_parse_slot(appointment.when_iso))
        except HTTPException:
            continue
        ensure(candidate != slot_iso, SLOT_BUSY_DETAIL, CONFLICT)


def _new_request(payload: RequestCreateIn, user: User) -> Request:
    now = utcnow()
    return Request(
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


def _confirm_request(ctx: ApiContext, req: Request, payload: AcceptIn | None) -> Appointment | None:
    slot_iso = payload.slot_iso if payload else None
    if not slot_iso:
        _apply_status(ctx, req, RequestStatus.ACCEPTED)
        return None
    moment = _parse_slot(slot_iso)
    ensure(not _is_past(moment), PAST_SLOT_DETAIL, UNPROCESSABLE)
    slot_iso = _normalize_slot(moment)
    _ensure_slot_free(ctx.session, req.specialist_id, slot_iso)
    appointment = Appointment(
        id=new_id("apt"),
        request_id=req.id,
        when_iso=slot_iso,
        status="SCHEDULED",
    )
    ctx.session.add(appointment)
    _apply_status(ctx, req, RequestStatus.SCHEDULED)
    return appointment


def _cancel_appointments(session, req: Request) -> None:
    appointments = session.exec(select(Appointment).where(Appointment.request_id == req.id)).all()
    for appointment in appointments:
        appointment.status = "CANCELLED"
        session.add(appointment)


def _complete_appointments(session, req: Request) -> Appointment | None:
    appointments = session.exec(select(Appointment).where(Appointment.request_id == req.id)).all()
    for appointment in appointments:
        appointment.status = "COMPLETED"
        session.add(appointment)
    session.commit()
    return appointments[0] if appointments else None


def _close_encounter_meta(ctx: ApiContext, req: Request, now: datetime) -> dict:
    return {
        "source_system": SPECIALIST_SOURCE_SYSTEM,
        "source_format": SPECIALIST_SOURCE_FORMAT,
        "source_ref": f"request:{req.id}",
        "extracted_at": now.isoformat(),
        "extracted_by": f"specialist:{ctx.user.username}",
        "reviewed_by": None,
        "method": "direct",
        "confidence": 1.0,
    }


def _close_encounter(ctx: ApiContext, req: Request, payload: CloseRequest) -> dict:
    now = utcnow()
    spec = _specialist_of(ctx.session, req)
    return {
        "_type": "Encounter",
        "id": f"enc_vetlink_{req.id}",
        "patient_id": req.patient_id,
        "date": now.date().isoformat(),
        "type": "RECHECK",
        "reason": f"Cierre de visita · {spec.specialty if spec else 'especialista'}",
        "clinician_ref": ctx.user.display_name,
        "status": "SIGNED",
        "diagnosis_summary": payload.diagnosis or payload.note[:140],
        "note": payload.note,
        "soap": {"A": payload.diagnosis or "", "P": payload.note},
        "recommendations": payload.recommendations,
        "next_visit_date": payload.next_visit,
        "_meta": _close_encounter_meta(ctx, req, now),
    }


def _append_encounter(canonical: dict, encounter: dict) -> bool:
    encounters = canonical.setdefault("encounters", [])
    current = next((item for item in encounters if item.get("id") == encounter["id"]), None)
    if current is None:
        encounters.append(encounter)
        return True
    current.update(encounter)
    return False


def _bump_entities(canonical: dict, created: bool) -> None:
    if not created:
        return
    provenance = canonical.setdefault("provenance_summary", {})
    provenance["entities"] = int(provenance.get("entities") or 0) + 1


def _store_record(session, record: Record, canonical: dict) -> None:
    record.canonical_json = dumps_json(canonical)
    session.add(record)
    session.commit()
    session.refresh(record)


def _request_item(session, req: Request) -> dict:
    patient = session.get(Patient, req.patient_id)
    spec = session.get(Specialist, req.specialist_id)
    item = request_dict(req)
    item.update(
        {
            "patient_name": patient.name if patient else None,
            "patient_species": patient.species if patient else None,
            "specialist_name": spec.name if spec else None,
            "specialist_specialty": spec.specialty if spec else None,
        }
    )
    return item


def _service_summary(req: Request, spec: Specialist | None) -> dict:
    detail = specialist_dict(spec) if spec else {}
    return {
        "specialist_id": req.specialist_id,
        "specialist": detail.get("name"),
        "specialty": detail.get("specialty"),
        "zone": detail.get("zone"),
        "price_from": detail.get("price_from"),
        "next_slot": detail.get("next_slot"),
    }


def _record_meta(record, alerts_count: int) -> dict:
    if record is None:
        return {
            "id": None,
            "source_system": None,
            "record_version": None,
            "imported_at": None,
            "alerts_count": alerts_count,
        }
    return {
        "id": record.id,
        "source_system": record.source_system,
        "record_version": record.record_version,
        "imported_at": record.imported_at.isoformat(),
        "alerts_count": alerts_count,
    }


def _patient_summary(patient: Patient, canonical: dict) -> dict:
    return {
        "id": patient.id,
        "name": patient.name,
        "owner_display": patient.owner_display,
        "microchip": patient.microchip,
        "patient": build_patient_public(canonical),
    }


@router.post("", summary="Crear una derivación")
def create_request(payload: RequestCreateIn, ctx: ApiCtx) -> dict:
    ensure(
        role_value(ctx.user) in {Role.CLINIC.value, Role.ADMIN.value},
        "Solo la clínica puede crear derivaciones",
    )
    require_found(ctx.session.get(Patient, payload.patient_id), "Paciente no encontrado")
    require_found(ctx.session.get(Specialist, payload.specialist_id), "Especialista no encontrado")
    req = _new_request(payload, ctx.user)
    ctx.session.add(req)
    ctx.session.commit()
    ctx.session.refresh(req)
    ctx.audit("Request", req.id, "REQUEST_CREATED")
    return {"request": request_dict(req)}


@router.get("", summary="Solicitudes visibles según rol")
def list_requests(ctx: ApiCtx) -> dict:
    statement = request_scope(ctx.user).order_by(Request.created_at.desc())
    items = [_request_item(ctx.session, req) for req in ctx.session.exec(statement).all()]
    return {"requests": items, "count": len(items), "scope": role_value(ctx.user)}


@router.get("/{request_id}", summary="Detalle de la solicitud")
def get_request(request_id: str, ctx: ApiCtx) -> dict:
    req = request_or_404(ctx.session, request_id)
    ensure(is_participant(ctx.user, req), NOT_PARTICIPANT_DETAIL)
    patient = _patient_of(ctx.session, req)
    spec = _specialist_of(ctx.session, req)
    canonical = _canonical_of_request(ctx.session, req)
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
def get_summary(request_id: str, ctx: ApiCtx) -> dict:
    req = request_or_404(ctx.session, request_id)
    ensure(is_participant(ctx.user, req), NOT_PARTICIPANT_DETAIL)
    canonical = _canonical_of_request(ctx.session, req)
    spec = _specialist_of(ctx.session, req)
    summary = build_public_summary(canonical, motivo=req.motivo, urgencia=req.urgencia)
    ctx.audit("Request", req.id, "VIEW_SUMMARY")
    data = request_dict(req)
    return {
        "request_id": req.id,
        "status": data["status"],
        "created_at": req.created_at.isoformat(),
        "urgencia": req.urgencia,
        "share_level": data["share_level"],
        "motivo": req.motivo,
        "preferred": req.preferred,
        **summary,
        "service": _service_summary(req, spec),
    }


@router.post("/{request_id}/accept", summary="Aceptar la derivación (opcionalmente con slot)")
def accept_request(request_id: str, ctx: ApiCtx, payload: AcceptIn | None = None) -> dict:
    req = request_or_404(ctx.session, request_id)
    _ensure_assigned_specialist(ctx.user, req, ACCEPT_DETAIL)
    ensure(
        req.status in {RequestStatus.REQUESTED},
        f"La solicitud no está en estado REQUESTED (estado: {request_status(req)})",
        CONFLICT,
    )
    appointment = _confirm_request(ctx, req, payload)
    ctx.audit("Request", req.id, "REQUEST_SCHEDULED" if appointment else "REQUEST_ACCEPTED")
    if appointment is not None:
        ctx.audit("Appointment", appointment.id, "APPOINTMENT_CREATED")
    spec = _specialist_of(ctx.session, req)
    return {
        "request": request_dict(req),
        "appointment": appointment_dict(appointment) if appointment else None,
        "specialist": specialist_dict(spec) if spec else None,
    }


@router.post("/{request_id}/decline", summary="Rechazar la derivación")
def decline_request(request_id: str, ctx: ApiCtx, payload: DeclineIn | None = None) -> dict:
    req = request_or_404(ctx.session, request_id)
    _ensure_assigned_specialist(ctx.user, req, DECLINE_DETAIL)
    ensure(
        req.status in DECLINABLE_STATUSES,
        f"No se puede rechazar una solicitud en estado {request_status(req)}",
        CONFLICT,
    )
    _apply_status(ctx, req, RequestStatus.DECLINED)
    ctx.audit("Request", req.id, "REQUEST_DECLINED")
    return {
        "request": request_dict(req),
        "reason": payload.reason if payload else None,
        "detail": "Derivación rechazada. La clínica recupera el caso.",
    }


@router.post("/{request_id}/cancel", summary="Cancelar la derivación (clínica)")
def cancel_request(request_id: str, ctx: ApiCtx) -> dict:
    req = request_or_404(ctx.session, request_id)
    _ensure_can_cancel(ctx.user, req)
    ensure(
        req.status not in NON_CANCELLABLE_STATUSES,
        f"No se puede cancelar una solicitud en estado {request_status(req)}",
        CONFLICT,
    )
    _cancel_appointments(ctx.session, req)
    _apply_status(ctx, req, RequestStatus.CANCELLED)
    ctx.audit("Request", req.id, "REQUEST_CANCELLED")
    return {"request": request_dict(req), "detail": "Derivación cancelada"}


@router.post("/{request_id}/close", summary="Cerrar la visita y devolver la nota a la ficha clínica")
def close_request(request_id: str, payload: CloseRequest, ctx: ApiCtx) -> dict:
    req = request_or_404(ctx.session, request_id)
    _ensure_assigned_specialist(ctx.user, req, CLOSE_DETAIL)
    ensure(
        req.status in CLOSABLE_STATUSES,
        f"La solicitud no admite el cierre de visita (estado: {request_status(req)})",
        CONFLICT,
    )
    record = _record_of_request(ctx.session, req)
    canonical = canonical_of(record)
    created = _append_encounter(canonical, _close_encounter(ctx, req, payload))
    _bump_entities(canonical, created)
    _store_record(ctx.session, record, canonical)
    appointment = _complete_appointments(ctx.session, req)
    _apply_status(ctx, req, RequestStatus.COMPLETED)
    ctx.audit("Request", req.id, "REQUEST_CLOSED")
    ctx.audit("Record", record.id, "SPECIALIST_NOTE_ADDED")
    return {
        "request": request_dict(req),
        "appointment": appointment_dict(appointment) if appointment else None,
        "patient": patient_dict(_patient_of(ctx.session, req)),
        "record": record_dict(record),
    }


@router.get("/{request_id}/briefing", summary="Briefing completo (solo tras aceptar)")
def get_briefing(request_id: str, ctx: ApiCtx) -> dict:
    req = request_or_404(ctx.session, request_id)
    _ensure_unlocked(ctx.user, req)
    canonical = _canonical_of_request(ctx.session, req)
    briefing = build_briefing(canonical)
    patient = _patient_of(ctx.session, req)
    record = record_for_patient(ctx.session, req.patient_id)
    alerts = alerts_for_patient(ctx.session, req.patient_id)
    spec = _specialist_of(ctx.session, req)
    ctx.audit("Request", req.id, "VIEW_BRIEFING")
    ctx.session.refresh(req)
    events = audit_events_for(ctx.session, "Request", req.id)
    return {
        "request": request_dict(req),
        "briefing": briefing,
        "record": canonical,
        "record_meta": _record_meta(record, len(alerts)),
        "patient_summary": _patient_summary(patient, canonical),
        "specialist": specialist_dict(spec) if spec else None,
        "audit": [audit_to_dict(event) for event in events],
        "unlocked_at": req.updated_at.isoformat(),
    }
