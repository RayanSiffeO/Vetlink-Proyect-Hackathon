"""Pacientes y registro clínico canónico."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..auth import CurrentUser, DbSession, role_value
from ..briefing import build_briefing
from ..db import alerts_for_patient, log_audit, record_for_patient
from ..models import Alert, Patient
from ..schemas import alert_dict, canonical_of, patient_dict, record_dict

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", summary="Listado de pacientes con número de alertas")
def list_patients(user: CurrentUser, session: DbSession) -> dict:
    patients = list(session.exec(select(Patient).order_by(Patient.name)).all())
    counts: dict[str, int] = {}
    for alert in session.exec(select(Alert)).all():
        counts[alert.patient_id] = counts.get(alert.patient_id, 0) + 1
    return {
        "patients": [patient_dict(p, counts.get(p.id, 0)) for p in patients],
        "count": len(patients),
        "requested_by": user.username,
    }


@router.get("/{patient_id}/record", summary="Registro canónico completo + alertas")
def get_record(patient_id: str, user: CurrentUser, session: DbSession) -> dict:
    patient = session.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    record = record_for_patient(session, patient_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El paciente no tiene registro canónico importado",
        )

    canonical = canonical_of(record)
    alerts = alerts_for_patient(session, patient_id)
    provenance = canonical.get("provenance_summary") or {}
    briefing = build_briefing(canonical)

    log_audit(
        session,
        actor=user.username,
        role=role_value(user),
        entity_type="Record",
        entity_id=record.id,
        action="VIEW_RECORD",
    )

    return {
        "patient": patient_dict(patient, len(alerts)),
        "record": canonical,
        "alerts": [alert_dict(a) for a in alerts],
        "provenance_summary": {
            "entities": provenance.get("entities", 0),
            "fields_populated": provenance.get("fields_populated", 0),
            "alerts": provenance.get("alerts", {}),
            "source_system": record.source_system,
            "record_version": record.record_version,
            "imported_at": record.imported_at.isoformat(),
            "coverage": provenance.get("provenance", {}),
        },
        "briefing": briefing,
        "record_meta": record_dict(record),
    }
