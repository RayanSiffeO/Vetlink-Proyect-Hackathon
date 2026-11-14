"""Seed reproducible de la demo + cache de importación por sha256.

Los 3 registros canónicos de `docs/ejemplos/` producen los pacientes
`pat_bruno`, `pat_luna` y `pat_kira`. La cache de importación mapea el sha256
de los 3 ficheros de `data/samples/` a su `record_id`, de modo que volver a
subirlos en la demo devuelve `READY` al instante.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlmodel import Session, SQLModel, select

from .briefing import build_briefing
from .config import settings
from .db import dumps_json, loads_json, reset_db
from .models import (
    Alert,
    Appointment,
    AuditEvent,
    ImportJob,
    ImportStatus,
    Patient,
    Record,
    Request,
    RequestStatus,
    Role,
    ShareLevel,
    Specialist,
    User,
    utcnow,
)

# (slug, fichero canónico, id estable de paciente)
SEED_PATIENTS: tuple[tuple[str, str, str], ...] = (
    ("bruno", "canonico-bruno.json", "pat_bruno"),
    ("luna", "canonico-luna.json", "pat_luna"),
    ("kira", "canonico-kira.json", "pat_kira"),
)

# Ficheros de muestra que la cache de importación reconoce al instante.
SAMPLE_FILES: tuple[str, ...] = (
    "Clínica Veterinaria Vall del Sol.docx",
    "export_MAS-0004587_anonimizado.xlsx",
    "historial.json",
)

NEEDS_REVIEW_MESSAGE = "mapeo asistido pendiente"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_canonical(filename: str) -> dict:
    path = settings.canonical_dir / filename
    return json.loads(path.read_text(encoding="utf-8"))


def build_import_cache() -> dict[str, str]:
    """sha256 del fichero de muestra -> record_id del registro canónico."""
    cache: dict[str, str] = {}
    for _slug, canonical_file, patient_id in SEED_PATIENTS:
        canonical = load_canonical(canonical_file)
        source_file = (canonical.get("source") or {}).get("file")
        if not source_file or source_file not in SAMPLE_FILES:
            continue
        sample_path = settings.samples_dir / source_file
        if sample_path.exists():
            cache[sha256_of(sample_path)] = patient_id
    return cache


def _specialist_slots(days: int = 4) -> list[str]:
    """Slots ISO de los próximos días (deterministas respecto a hoy)."""
    base = date.today() + timedelta(days=1)
    hours = (time(9, 30), time(11, 0), time(16, 30))
    slots: list[str] = []
    for offset in range(days):
        day = base + timedelta(days=offset)
        if day.weekday() >= 5:  # sin fines de semana
            continue
        for hour in hours:
            slots.append(datetime.combine(day, hour).isoformat())
    return slots


def _next_slot(slots: list[str]) -> Optional[str]:
    now = datetime.now()
    for slot in slots:
        try:
            if datetime.fromisoformat(slot) > now:
                return slot
        except ValueError:
            continue
    return slots[0] if slots else None


def seed_specialists(session: Session) -> dict[str, Specialist]:
    catalogue = [
        Specialist(
            id="spc_marc",
            name="Dr. Marc Vidal",
            specialty="Cardiología",
            zone="Barcelona",
            price_from=120,
            bio="Cardiólogo veterinario, 12 años en referencia. Ecocardiografía y manejo de cardiopatías crónicas en perro y gato.",
            available_slots_json=dumps_json(_specialist_slots()),
        ),
        Specialist(
            id="spc_elena",
            name="Dra. Elena Serra",
            specialty="Dermatología",
            zone="Barcelona",
            price_from=95,
            bio="Dermatología veterinaria y alergias. Protocolos de otitis recurrente y prurito estacional.",
            available_slots_json=dumps_json(_specialist_slots()),
        ),
        Specialist(
            id="spc_javier",
            name="Dr. Javier Ortiz",
            specialty="Traumatología",
            zone="Sant Cugat",
            price_from=110,
            bio="Traumatología y ortopedia. Valoración de cojeras y rehabilitación postquirúrgica.",
            available_slots_json=dumps_json(_specialist_slots()),
        ),
    ]
    out: dict[str, Specialist] = {}
    for spec in catalogue:
        session.add(spec)
        out[spec.id] = spec
    session.commit()
    return out


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


def seed_patients(session: Session) -> None:
    for _slug, canonical_file, patient_id in SEED_PATIENTS:
        canonical = load_canonical(canonical_file)
        patient_data = canonical.get("patient") or {}
        owners = canonical.get("owners") or []
        owner_display = owners[0].get("display_name") if owners else None
        identity = canonical.get("identity") or {}
        source = canonical.get("source") or {}

        patient = Patient(
            id=patient_id,
            name=patient_data.get("name") or patient_id,
            species=patient_data.get("species_label") or patient_data.get("species_code") or "no consta",
            breed=patient_data.get("breed_label"),
            sex=patient_data.get("sex"),
            birth_date=patient_data.get("birth_date"),
            weight_current_kg=patient_data.get("weight_current_kg"),
            bcs=patient_data.get("bcs"),
            microchip=patient_data.get("microchip"),
            owner_display=owner_display,
            identity_confidence=identity.get("identity_confidence"),
        )
        session.add(patient)

        record = Record(
            id=f"rec_{patient_id.removeprefix('pat_')}",
            patient_id=patient_id,
            source_system=source.get("system") or "desconocido",
            canonical_json=dumps_json(canonical),
            imported_at=utcnow(),
            record_version=1,
        )
        session.add(record)

        for alert in canonical.get("alerts") or []:
            session.add(
                Alert(
                    id=alert.get("id") or f"alr_{patient_id}_{len(alert)}",
                    patient_id=patient_id,
                    severity=str(alert.get("severity") or "INFO").upper(),
                    category=alert.get("category") or "OTHER",
                    title=alert.get("title") or "",
                    message=alert.get("message") or "",
                    evidence_json=dumps_json(alert.get("evidence") or []),
                )
            )
    session.commit()


def seed_import_cache(session: Session) -> None:
    """Precarga ImportJob READY para los ficheros reconocidos (demo instantánea)."""
    for canonical_file, patient_id in (
        (SEED_PATIENTS[0][1], SEED_PATIENTS[0][2]),
        (SEED_PATIENTS[1][1], SEED_PATIENTS[1][2]),
        (SEED_PATIENTS[2][1], SEED_PATIENTS[2][2]),
    ):
        canonical = load_canonical(canonical_file)
        source_file = (canonical.get("source") or {}).get("file")
        sample_path = settings.samples_dir / source_file if source_file else None
        if not sample_path or not sample_path.exists():
            continue
        session.add(
            ImportJob(
                id=f"imp_seed_{patient_id.removeprefix('pat_')}",
                filename=source_file,
                status=ImportStatus.READY,
                sha256=sha256_of(sample_path),
                record_id=patient_id,
                message="Ficha reconocida en la cache de importación",
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
    """Seed idempotente al arrancar. Devuelve True si ha sembrado ahora."""
    if is_seeded(session):
        return False
    seed_all(session)
    return True


def reset_and_seed(session: Session) -> None:
    """Reinicia la BD y limpia uploads; vuelve a sembrar todo."""
    session.commit()  # libera la transacción de lectura antes del DDL
    reset_db()
    uploads = settings.uploads_dir
    if uploads.exists():
        for item in uploads.iterdir():
            if item.is_file():
                item.unlink(missing_ok=True)
            elif item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
    uploads.mkdir(parents=True, exist_ok=True)
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
