from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import select

from ..briefing import build_briefing
from ..context import ApiCtx
from ..db import alert_counts_by_patient, alerts_for_patient, dumps_json, record_for_patient
from ..errors import ensure, require_found
from ..models import Patient, Record, Role, User, utcnow
from ..schemas import ReviewRequest, alert_dict, canonical_of, patient_dict, record_dict, role_value

router = APIRouter(prefix="/patients", tags=["patients"])

REVIEW_ROLE_DETAIL = "Solo la clínica puede confirmar la revisión humana de la ficha"
PATIENT_NOT_FOUND = "Paciente no encontrado"
RECORD_NOT_FOUND = "El paciente no tiene registro canónico importado"


def _review_of(canonical: dict) -> dict:
    review = canonical.get("review")
    if isinstance(review, dict):
        return review
    canonical["review"] = {}
    return canonical["review"]


def _apply_review(review: dict, payload: ReviewRequest, user: User) -> None:
    review["pending_review"] = 0
    review["critical_fields"] = []
    review["reviewed_by"] = user.display_name
    review["reviewed_at"] = utcnow().isoformat()
    if payload.note is not None:
        review["note"] = payload.note
    if payload.reviewed_fields:
        review["reviewed_fields"] = list(payload.reviewed_fields)


def _sync_provenance(canonical: dict, reviewed_fields: list[str]) -> None:
    provenance = canonical.get("provenance_summary")
    if not isinstance(provenance, dict) or "reviewed_fields" not in provenance:
        return
    provenance["reviewed_fields"] = list(reviewed_fields)


def _provenance_summary(record: Record, provenance: dict) -> dict:
    return {
        "entities": provenance.get("entities", 0),
        "fields_populated": provenance.get("fields_populated", 0),
        "alerts": provenance.get("alerts", {}),
        "source_system": record.source_system,
        "record_version": record.record_version,
        "imported_at": record.imported_at.isoformat(),
        "coverage": provenance.get("provenance", {}),
    }


@router.get("", summary="Listado de pacientes con número de alertas")
def list_patients(ctx: ApiCtx) -> dict:
    patients = list(ctx.session.exec(select(Patient).order_by(Patient.name)).all())
    counts = alert_counts_by_patient(ctx.session)
    return {
        "patients": [patient_dict(patient, counts.get(patient.id, 0)) for patient in patients],
        "count": len(patients),
        "requested_by": ctx.user.username,
    }


@router.get("/{patient_id}/record", summary="Registro canónico completo + alertas")
def get_record(patient_id: str, ctx: ApiCtx) -> dict:
    patient = require_found(ctx.session.get(Patient, patient_id), "Paciente no encontrado")
    record = require_found(
        record_for_patient(ctx.session, patient_id),
        "El paciente no tiene registro canónico importado",
    )
    canonical = canonical_of(record)
    alerts = alerts_for_patient(ctx.session, patient_id)
    provenance = canonical.get("provenance_summary") or {}
    briefing = build_briefing(canonical)
    ctx.audit("Record", record.id, "VIEW_RECORD")
    return {
        "patient": patient_dict(patient, len(alerts)),
        "record": canonical,
        "alerts": [alert_dict(alert) for alert in alerts],
        "provenance_summary": _provenance_summary(record, provenance),
        "briefing": briefing,
        "record_meta": record_dict(record),
    }


@router.patch("/{patient_id}/record/review", summary="Confirmar la revisión humana de la ficha")
def review_record(patient_id: str, payload: ReviewRequest, ctx: ApiCtx) -> dict:
    ensure(role_value(ctx.user) == Role.CLINIC.value, REVIEW_ROLE_DETAIL)
    patient = require_found(ctx.session.get(Patient, patient_id), PATIENT_NOT_FOUND)
    record = require_found(record_for_patient(ctx.session, patient_id), RECORD_NOT_FOUND)
    canonical = canonical_of(record)
    review = _review_of(canonical)
    _apply_review(review, payload, ctx.user)
    _sync_provenance(canonical, payload.reviewed_fields)
    record.canonical_json = dumps_json(canonical)
    ctx.session.add(record)
    ctx.session.commit()
    ctx.session.refresh(record)
    ctx.audit("Record", record.id, "REVIEW_RECORD")
    return {"patient": patient_dict(patient), "record": record_dict(record), "review": review}
