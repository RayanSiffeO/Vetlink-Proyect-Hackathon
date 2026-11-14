from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import select

from ..briefing import build_briefing
from ..context import ApiCtx
from ..db import alert_counts_by_patient, alerts_for_patient, record_for_patient
from ..errors import require_found
from ..models import Patient, Record
from ..schemas import alert_dict, canonical_of, patient_dict, record_dict

router = APIRouter(prefix="/patients", tags=["patients"])


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
