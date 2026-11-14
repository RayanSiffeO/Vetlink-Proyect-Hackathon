from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any, Iterator, Optional

from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings
from .errors import require_found
from .models import Alert, AuditEvent, Record, Request, utcnow

settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.uploads_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)


def init_db() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)


def reset_db() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


@dataclass(frozen=True)
class AuditEntry:
    actor: str
    role: str
    entity_type: str
    entity_id: str
    action: str


def write_audit(session: Session, entry: AuditEntry) -> AuditEvent:
    event = AuditEvent(
        id=new_id("aud"),
        actor=entry.actor,
        role=entry.role,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        action=entry.action,
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


def loads_json(raw: Optional[str], default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


def dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def record_for_patient(session: Session, patient_id: str) -> Optional[Record]:
    statement = (
        select(Record).where(Record.patient_id == patient_id).order_by(Record.record_version.desc())
    )
    return session.exec(statement).first()


def alerts_for_patient(session: Session, patient_id: str) -> list[Alert]:
    return list(session.exec(select(Alert).where(Alert.patient_id == patient_id)).all())


def alert_counts_by_patient(session: Session) -> dict[str, int]:
    counts: dict[str, int] = {}
    for alert in session.exec(select(Alert)).all():
        counts[alert.patient_id] = counts.get(alert.patient_id, 0) + 1
    return counts


def audit_events_for(session: Session, entity_type: str, entity_id: str) -> list[AuditEvent]:
    statement = (
        select(AuditEvent)
        .where(AuditEvent.entity_type == entity_type, AuditEvent.entity_id == entity_id)
        .order_by(AuditEvent.created_at.asc())
    )
    return list(session.exec(statement).all())


def recent_audit_events(session: Session, limit: int = 50) -> list[AuditEvent]:
    statement = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    return list(session.exec(statement).all())


def request_or_404(session: Session, request_id: str) -> Request:
    return require_found(session.get(Request, request_id), "Solicitud no encontrada")
