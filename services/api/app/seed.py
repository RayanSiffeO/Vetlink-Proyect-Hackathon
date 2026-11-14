from __future__ import annotations

import hashlib
import json
import shutil
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Optional

from sqlmodel import Session, select

from .config import settings
from .db import dumps_json, reset_db
from .models import (
    Alert,
    Appointment,
    AuditEvent,
    ImportJob,
    ImportStatus,
    Patient,
    Record,
    Request,
    Role,
    Specialist,
    User,
    utcnow,
)

SEED_PATIENTS: tuple[tuple[str, str, str], ...] = (
    ("bruno", "canonico-bruno.json", "pat_bruno"),
    ("luna", "canonico-luna.json", "pat_luna"),
    ("kira", "canonico-kira.json", "pat_kira"),
)

SAMPLE_FILES: tuple[str, ...] = (
    "Clínica Veterinaria Vall del Sol.docx",
    "export_MAS-0004587_anonimizado.xlsx",
    "historial.json",
)

NEEDS_REVIEW_MESSAGE = "mapeo asistido pendiente"
READY_MESSAGE = "Ficha reconocida en la cache de importación"

SPECIALIST_SEED: tuple[dict, ...] = (
    {
        "id": "spc_marc",
        "name": "Dr. Marc Vidal",
        "specialty": "Cardiología",
        "zone": "Barcelona",
        "price_from": 120,
        "bio": (
            "Cardiólogo veterinario, 12 años en referencia. Ecocardiografía y manejo de "
            "cardiopatías crónicas en perro y gato."
        ),
    },
    {
        "id": "spc_elena",
        "name": "Dra. Elena Serra",
        "specialty": "Dermatología",
        "zone": "Barcelona",
        "price_from": 95,
        "bio": (
            "Dermatología veterinaria y alergias. Protocolos de otitis recurrente y "
            "prurito estacional."
        ),
    },
    {
        "id": "spc_javier",
        "name": "Dr. Javier Ortiz",
        "specialty": "Traumatología",
        "zone": "Sant Cugat",
        "price_from": 110,
        "bio": (
            "Traumatología y ortopedia. Valoración de cojeras y rehabilitación "
            "postquirúrgica."
        ),
    },
)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_canonical(filename: str) -> dict:
    path = settings.canonical_dir / filename
    return json.loads(path.read_text(encoding="utf-8"))


def _source_filename(canonical: dict) -> Optional[str]:
    return (canonical.get("source") or {}).get("file")


def _sample_file(canonical: dict) -> Optional[Path]:
    source_file = _source_filename(canonical)
    if not source_file:
        return None
    path = settings.samples_dir / source_file
    return path if path.exists() else None


def build_import_cache() -> dict[str, str]:
    cache: dict[str, str] = {}
    for _slug, canonical_file, patient_id in SEED_PATIENTS:
        canonical = load_canonical(canonical_file)
        source_file = _source_filename(canonical)
        sample_path = _sample_file(canonical)
        if source_file is None or source_file not in SAMPLE_FILES or sample_path is None:
            continue
        cache[sha256_of(sample_path)] = patient_id
    return cache


def _specialist_slots(days: int = 4) -> list[str]:
    base = date.today() + timedelta(days=1)
    hours = (time(9, 30), time(11, 0), time(16, 30))
    slots: list[str] = []
    for offset in range(days):
        day = base + timedelta(days=offset)
        if day.weekday() >= 5:
            continue
        for hour in hours:
            slots.append(datetime.combine(day, hour).isoformat())
    return slots


def _specialist_catalogue() -> list[Specialist]:
    slots = dumps_json(_specialist_slots())
    return [Specialist(**seed, available_slots_json=slots) for seed in SPECIALIST_SEED]


def seed_specialists(session: Session) -> None:
    for specialist in _specialist_catalogue():
        session.add(specialist)
    session.commit()


def seed_users(session: Session) -> None:
    session.add(
        User(
            id="usr_laura",
            username="laura",
            display_name="Dra. Laura Puig",
            role=Role.CLINIC,
            clinic_id="Clínica Vall del Sol",
            specialty=None,
        )
    )
    session.add(
        User(
            id="usr_marc",
            username="marc",
            display_name="Dr. Marc Vidal",
            role=Role.SPECIALIST,
            clinic_id=None,
            specialty="Cardiología",
        )
    )
    session.commit()


def _patient_from(canonical: dict, patient_id: str) -> Patient:
    patient_data = canonical.get("patient") or {}
    owners = canonical.get("owners") or []
    identity = canonical.get("identity") or {}
    return Patient(
        id=patient_id,
        name=patient_data.get("name") or patient_id,
        species=patient_data.get("species_label") or patient_data.get("species_code") or "no consta",
        breed=patient_data.get("breed_label"),
        sex=patient_data.get("sex"),
        birth_date=patient_data.get("birth_date"),
        weight_current_kg=patient_data.get("weight_current_kg"),
        bcs=patient_data.get("bcs"),
        microchip=patient_data.get("microchip"),
        owner_display=owners[0].get("display_name") if owners else None,
        identity_confidence=identity.get("identity_confidence"),
    )


def _record_from(canonical: dict, patient_id: str) -> Record:
    source = canonical.get("source") or {}
    return Record(
        id=f"rec_{patient_id.removeprefix('pat_')}",
        patient_id=patient_id,
        source_system=source.get("system") or "desconocido",
        canonical_json=dumps_json(canonical),
        imported_at=utcnow(),
        record_version=1,
    )


def _alerts_from(canonical: dict, patient_id: str) -> list[Alert]:
    return [
        Alert(
            id=alert.get("id") or f"alr_{patient_id}_{len(alert)}",
            patient_id=patient_id,
            severity=str(alert.get("severity") or "INFO").upper(),
            category=alert.get("category") or "OTHER",
            title=alert.get("title") or "",
            message=alert.get("message") or "",
            evidence_json=dumps_json(alert.get("evidence") or []),
        )
        for alert in canonical.get("alerts") or []
    ]


def seed_patients(session: Session) -> None:
    for _slug, canonical_file, patient_id in SEED_PATIENTS:
        canonical = load_canonical(canonical_file)
        session.add(_patient_from(canonical, patient_id))
        session.add(_record_from(canonical, patient_id))
        session.add_all(_alerts_from(canonical, patient_id))
    session.commit()


def seed_import_cache(session: Session) -> None:
    for _slug, canonical_file, patient_id in SEED_PATIENTS:
        canonical = load_canonical(canonical_file)
        source_file = _source_filename(canonical)
        sample_path = _sample_file(canonical)
        if source_file is None or sample_path is None:
            continue
        session.add(
            ImportJob(
                id=f"imp_seed_{patient_id.removeprefix('pat_')}",
                filename=source_file,
                status=ImportStatus.READY,
                sha256=sha256_of(sample_path),
                record_id=patient_id,
                message=READY_MESSAGE,
                created_at=utcnow(),
            )
        )
    session.commit()


def seed_all(session: Session) -> None:
    seed_users(session)
    seed_specialists(session)
    seed_patients(session)
    seed_import_cache(session)


def is_seeded(session: Session) -> bool:
    return session.exec(select(Patient)).first() is not None


def ensure_seed(session: Session) -> bool:
    if is_seeded(session):
        return False
    seed_all(session)
    return True


def _remove_item(item: Path) -> None:
    if item.is_file():
        item.unlink(missing_ok=True)
        return
    if item.is_dir():
        shutil.rmtree(item, ignore_errors=True)


def _clear_uploads() -> None:
    uploads = settings.uploads_dir
    if uploads.exists():
        for item in uploads.iterdir():
            _remove_item(item)
    uploads.mkdir(parents=True, exist_ok=True)


def reset_and_seed(session: Session) -> None:
    session.commit()
    reset_db()
    _clear_uploads()
    seed_all(session)


def patient_counts(session: Session) -> dict[str, int]:
    return {
        "patients": len(session.exec(select(Patient)).all()),
        "records": len(session.exec(select(Record)).all()),
        "alerts": len(session.exec(select(Alert)).all()),
        "specialists": len(session.exec(select(Specialist)).all()),
        "requests": len(session.exec(select(Request)).all()),
        "appointments": len(session.exec(select(Appointment)).all()),
        "audit_events": len(session.exec(select(AuditEvent)).all()),
        "import_jobs": len(session.exec(select(ImportJob)).all()),
    }
