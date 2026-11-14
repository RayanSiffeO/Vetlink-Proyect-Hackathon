"""Engine SQLite, creación de tablas, sesión y auditoría."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings
from .models import Alert, AuditEvent, Patient, Record, Request, utcnow

settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.uploads_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)


def init_db() -> None:
    """Crea las tablas (idempotente) e importa los modelos para registrarlos."""
    from . import models  # noqa: F401  (registra las tablas en SQLModel.metadata)

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)


def reset_db() -> None:
    from . import models  # noqa: F401

    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def log_audit(
    session: Session,
    *,
    actor: str,
    role: str,
    entity_type: str,
    entity_id: str,
    action: str,
) -> AuditEvent:
    event = AuditEvent(
        id=new_id("aud"),
        actor=actor,
        role=str(role),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        created_at=utcnow(),
    )
    session.add(event)
    session.commit()
    return event


def audit_to_dict(event: AuditEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "actor": event.actor,
        "role": event.role,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "action": event.action,
        "created_at": event.created_at.isoformat(),
    }


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def loads_json(raw: Optional[str], default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


def dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


# --------------------------------------------------------- consultas frecuentes


def record_for_patient(session: Session, patient_id: str) -> Optional[Record]:
    return session.exec(
        select(Record).where(Record.patient_id == patient_id).order_by(Record.record_version.desc())
    ).first()


def alerts_for_patient(session: Session, patient_id: str) -> list[Alert]:
    return list(session.exec(select(Alert).where(Alert.patient_id == patient_id)).all())


def patient_or_none(session: Session, patient_id: str) -> Optional[Patient]:
    return session.get(Patient, patient_id)


def audit_events_for(session: Session, entity_type: str, entity_id: str) -> list[AuditEvent]:
    return list(
        session.exec(
            select(AuditEvent)
            .where(AuditEvent.entity_type == entity_type, AuditEvent.entity_id == entity_id)
            .order_by(AuditEvent.created_at.asc())
        ).all()
    )


def recent_audit_events(session: Session, limit: int = 50) -> list[AuditEvent]:
    return list(
        session.exec(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)).all()
    )
