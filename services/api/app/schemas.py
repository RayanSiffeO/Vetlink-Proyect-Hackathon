from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .db import loads_json
from .models import Alert, Appointment, ImportJob, Patient, Record, Request, Specialist, User


class DemoLoginIn(BaseModel):
    user: str = Field(description="Usuario demo: laura (clínica) o marc (especialista)")


class RequestCreateIn(BaseModel):
    patient_id: str
    specialist_id: str
    motivo: str = ""
    urgencia: Literal["BAJA", "MEDIA", "ALTA"] = "MEDIA"
    share_level: Literal["CLINICAL", "FULL"] = "CLINICAL"
    preferred: Optional[str] = None


class AcceptIn(BaseModel):
    slot_iso: Optional[str] = Field(default=None, description="Slot ISO ofrecido por el especialista")


class DeclineIn(BaseModel):
    reason: Optional[str] = None


class ReviewRequest(BaseModel):
    reviewed_fields: list[str] = Field(default_factory=list)
    note: Optional[str] = None


def enum_value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


def role_value(user: User) -> str:
    return str(enum_value(user.role))


def request_status(req: Request) -> str:
    return str(enum_value(req.status))


def user_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": role_value(user),
        "clinic_id": user.clinic_id,
        "specialty": user.specialty,
    }


def patient_dict(patient: Patient, alerts_count: int = 0) -> dict[str, Any]:
    return {
        "id": patient.id,
        "name": patient.name,
        "species": patient.species,
        "breed": patient.breed,
        "birth_date": patient.birth_date,
        "weight_current_kg": patient.weight_current_kg,
        "bcs": patient.bcs,
        "microchip": patient.microchip,
        "owner_display": patient.owner_display,
        "identity_confidence": patient.identity_confidence,
        "alerts_count": alerts_count,
    }


def alert_dict(alert: Alert) -> dict[str, Any]:
    return {
        "id": alert.id,
        "patient_id": alert.patient_id,
        "severity": alert.severity,
        "category": alert.category,
        "title": alert.title,
        "message": alert.message,
        "evidence": loads_json(alert.evidence_json, []),
    }


def record_dict(record: Record) -> dict[str, Any]:
    return {
        "id": record.id,
        "patient_id": record.patient_id,
        "source_system": record.source_system,
        "imported_at": record.imported_at.isoformat(),
        "record_version": record.record_version,
    }


def canonical_of(record: Record) -> dict[str, Any]:
    return loads_json(record.canonical_json, {})


def specialist_dict(spec: Specialist) -> dict[str, Any]:
    slots = loads_json(spec.available_slots_json, [])
    return {
        "id": spec.id,
        "name": spec.name,
        "specialty": spec.specialty,
        "zone": spec.zone,
        "price_from": spec.price_from,
        "bio": spec.bio,
        "next_slot": slots[0] if slots else None,
    }


def request_dict(req: Request) -> dict[str, Any]:
    return {
        "id": req.id,
        "patient_id": req.patient_id,
        "specialist_id": req.specialist_id,
        "created_by": req.created_by,
        "status": request_status(req),
        "motivo": req.motivo,
        "urgencia": req.urgencia,
        "share_level": str(enum_value(req.share_level)),
        "preferred": req.preferred,
        "created_at": req.created_at.isoformat(),
        "updated_at": req.updated_at.isoformat(),
    }


def appointment_dict(appt: Appointment) -> dict[str, Any]:
    return {
        "id": appt.id,
        "request_id": appt.request_id,
        "when_iso": appt.when_iso,
        "status": appt.status,
    }


def import_job_dict(job: ImportJob) -> dict[str, Any]:
    return {
        "job_id": job.id,
        "filename": job.filename,
        "status": str(enum_value(job.status)),
        "record_id": job.record_id,
        "message": job.message,
    }
