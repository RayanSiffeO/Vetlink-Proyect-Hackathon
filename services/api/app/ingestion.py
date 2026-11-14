from __future__ import annotations

import re
import uuid
from collections import Counter
from dataclasses import dataclass
from itertools import count

from sqlmodel import Session, delete, select

from .canonical.alerts import build_alerts
from .canonical.matching import AUTO_MERGE_CONFIDENCE, match_patient, normalize_name
from .context import ApiContext
from .db import dumps_json, record_for_patient
from .models import Alert, ImportJob, ImportStatus, Patient, Record, utcnow
from .schemas import canonical_of

CREATED_MESSAGE = "Ficha importada: paciente nuevo con alertas calculadas"
MATCHED_MESSAGE = "Ficha reconocida: historia actualizada y alertas recalculadas"
REVIEW_MESSAGE = "Ficha importada; identidad pendiente de revisión (confianza {confidence:.2f}, método {method})"
UNKNOWN_SOURCE = "desconocido"
NO_SPECIES_CODE = ""
NO_SPECIES_LABEL = "no consta"
NO_PATIENT_NAME = "Paciente sin nombre"
SPECIES_CODES = ("CAN", "FEL", "OTHER")
SPECIES_HINTS = (("can", "CAN"), ("fel", "FEL"))


@dataclass(frozen=True)
class IngestOutcome:
    patient: Patient
    record: Record
    created: bool
    match: dict | None


def _slug(value: object) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", normalize_name(str(value or ""))).strip("_")
    return slug or "paciente"


def _source_system(canonical: dict) -> str:
    return str((canonical.get("source") or {}).get("system") or UNKNOWN_SOURCE)


def _patient_ids(session: Session) -> set[str]:
    return set(session.exec(select(Patient.id)).all())


def _alert_ids(session: Session) -> set[str]:
    return set(session.exec(select(Alert.id)).all())


def _patient_id_for(session: Session, canonical: dict) -> str:
    data = canonical.get("patient") or {}
    base = f"pat_{_slug(data.get('name') or canonical.get('record_id'))}"
    taken = _patient_ids(session)
    if base not in taken:
        return base
    return next(f"{base}_{index}" for index in count(2) if f"{base}_{index}" not in taken)


def _species_code(patient: Patient, canonical_patient: dict) -> str:
    code = str(canonical_patient.get("species_code") or patient.species or "").upper()
    if code in SPECIES_CODES:
        return code
    label = str(patient.species or "").casefold()
    return next((value for hint, value in SPECIES_HINTS if hint in label), NO_SPECIES_CODE)


def _canonical_for(session: Session, patient_id: str) -> dict:
    record = record_for_patient(session, patient_id)
    return canonical_of(record) if record is not None else {}


def _candidate(session: Session, patient: Patient) -> dict:
    canonical_patient = _canonical_for(session, patient.id).get("patient") or {}
    return {
        "id": patient.id,
        "name": patient.name,
        "birth_date": patient.birth_date,
        "microchip": patient.microchip,
        "external_ids": canonical_patient.get("external_ids") or [],
        "species_code": _species_code(patient, canonical_patient),
    }


def _candidates(session: Session) -> list[dict]:
    return [_candidate(session, patient) for patient in session.exec(select(Patient)).all()]


def _apply_patient_fields(patient: Patient, canonical: dict) -> None:
    data = canonical.get("patient") or {}
    owners = canonical.get("owners") or []
    identity = canonical.get("identity") or {}
    patient.name = str(data.get("name") or patient.name or NO_PATIENT_NAME)
    patient.species = str(
        data.get("species_label") or data.get("species_code") or patient.species or NO_SPECIES_LABEL
    )
    patient.breed = data.get("breed_label")
    patient.sex = data.get("sex")
    patient.birth_date = data.get("birth_date")
    patient.weight_current_kg = data.get("weight_current_kg")
    patient.bcs = data.get("bcs")
    patient.microchip = data.get("microchip")
    patient.owner_display = (owners[0].get("display_name") if owners else None) or patient.owner_display
    patient.identity_confidence = identity.get("identity_confidence")


def _new_patient(session: Session, canonical: dict) -> Patient:
    patient = Patient(id=_patient_id_for(session, canonical), name=NO_PATIENT_NAME, species=NO_SPECIES_LABEL)
    _apply_patient_fields(patient, canonical)
    return patient


def _persist_patient(session: Session, canonical: dict, match: dict | None) -> tuple[Patient, bool]:
    existing = session.get(Patient, match["patient_id"]) if match else None
    if existing is not None:
        _apply_patient_fields(existing, canonical)
        session.add(existing)
        return existing, False
    patient = _new_patient(session, canonical)
    session.add(patient)
    return patient, True


def _clear_alerts(session: Session, patient_id: str) -> None:
    session.exec(delete(Alert).where(Alert.patient_id == patient_id))


def _alert_id(alert: dict, patient_id: str, taken: set[str]) -> str:
    alert_id = str(alert.get("id") or f"alr_{_slug(alert.get('rule_id'))}")
    return alert_id if alert_id not in taken else f"{alert_id}_{_slug(patient_id)}"


def _alert_row(alert: dict, patient_id: str, taken: set[str]) -> Alert:
    alert["id"] = _alert_id(alert, patient_id, taken)
    return Alert(
        id=alert["id"],
        patient_id=patient_id,
        severity=str(alert.get("severity") or "INFO").upper(),
        category=alert.get("category") or "OTHER",
        title=alert.get("title") or "",
        message=alert.get("message") or "",
        evidence_json=dumps_json(alert.get("evidence") or []),
    )


def _persist_alerts(session: Session, canonical: dict, patient_id: str) -> None:
    _clear_alerts(session, patient_id)
    taken = _alert_ids(session)
    rows = [_alert_row(alert, patient_id, taken) for alert in canonical.get("alerts") or []]
    session.add_all(rows)


def _persist_record(session: Session, canonical: dict, patient: Patient) -> Record:
    record = record_for_patient(session, patient.id)
    if record is None:
        record = Record(id=f"rec_{patient.id.removeprefix('pat_')}", patient_id=patient.id, record_version=1)
    else:
        record.record_version += 1
    record.source_system = _source_system(canonical)
    record.canonical_json = dumps_json(canonical)
    record.imported_at = utcnow()
    session.add(record)
    return record


def _persist(session: Session, canonical: dict) -> IngestOutcome:
    match = match_patient(canonical.get("patient") or {}, _candidates(session))
    patient, created = _persist_patient(session, canonical, match)
    _persist_alerts(session, canonical, patient.id)
    record = _persist_record(session, canonical, patient)
    return IngestOutcome(patient=patient, record=record, created=created, match=match)


def _audit(ctx: ApiContext, outcome: IngestOutcome) -> None:
    ctx.audit("Patient", outcome.patient.id, "PATIENT_CREATED" if outcome.created else "PATIENT_MATCHED")
    ctx.audit("Record", outcome.record.id, "IMPORT_RECORD")


def _auto_merged(outcome: IngestOutcome) -> bool:
    if outcome.created:
        return True
    return outcome.match is not None and outcome.match["confidence"] >= AUTO_MERGE_CONFIDENCE


def _message(outcome: IngestOutcome) -> str:
    match = outcome.match or {}
    if outcome.created:
        return CREATED_MESSAGE
    if _auto_merged(outcome):
        return MATCHED_MESSAGE
    return REVIEW_MESSAGE.format(confidence=match.get("confidence", 0.0), method=match.get("method", "sin método"))


def _job(filename: str, sha256: str, outcome: IngestOutcome) -> ImportJob:
    return ImportJob(
        id=f"imp_{uuid.uuid4().hex[:10]}",
        filename=filename,
        status=ImportStatus.READY if _auto_merged(outcome) else ImportStatus.NEEDS_REVIEW,
        sha256=sha256,
        record_id=outcome.record.id,
        message=_message(outcome),
        created_at=utcnow(),
    )


def _alert_summary(alerts: list[dict]) -> dict:
    counts = Counter(str(alert.get("severity") or "INFO").upper() for alert in alerts)
    return {"total": len(alerts), "by_severity": dict(counts)}


def _sync_provenance_alerts(canonical: dict, alerts: list[dict]) -> None:
    summary = canonical.get("provenance_summary")
    if isinstance(summary, dict):
        summary["alerts"] = _alert_summary(alerts)


def ingest_canonical(ctx: ApiContext, canonical: dict, filename: str, sha256: str) -> ImportJob:
    alerts = build_alerts(canonical)
    canonical["alerts"] = alerts
    _sync_provenance_alerts(canonical, alerts)
    outcome = _persist(ctx.session, canonical)
    ctx.session.commit()
    _audit(ctx, outcome)
    job = _job(filename, sha256, outcome)
    ctx.session.add(job)
    ctx.session.commit()
    ctx.session.refresh(job)
    return job
