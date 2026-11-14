from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, Enum):
    CLINIC = "CLINIC"
    SPECIALIST = "SPECIALIST"
    ADMIN = "ADMIN"


class RequestStatus(str, Enum):
    REQUESTED = "REQUESTED"
    ACCEPTED = "ACCEPTED"
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class ShareLevel(str, Enum):
    CLINICAL = "CLINICAL"
    FULL = "FULL"


class ImportStatus(str, Enum):
    UPLOADING = "UPLOADING"
    PARSING = "PARSING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    READY = "READY"
    FAILED = "FAILED"


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: str = Field(primary_key=True)
    username: str = Field(index=True, unique=True)
    display_name: str
    role: Role = Field(default=Role.CLINIC)
    clinic_id: Optional[str] = Field(default=None)
    specialty: Optional[str] = Field(default=None)


class Patient(SQLModel, table=True):
    __tablename__ = "patient"

    id: str = Field(primary_key=True)
    name: str
    species: str
    breed: Optional[str] = Field(default=None)
    sex: Optional[str] = Field(default=None)
    birth_date: Optional[str] = Field(default=None)
    weight_current_kg: Optional[float] = Field(default=None)
    bcs: Optional[int] = Field(default=None)
    microchip: Optional[str] = Field(default=None)
    owner_display: Optional[str] = Field(default=None)
    identity_confidence: Optional[float] = Field(default=None)


class Record(SQLModel, table=True):
    __tablename__ = "record"

    id: str = Field(primary_key=True)
    patient_id: str = Field(foreign_key="patient.id", index=True)
    source_system: str = ""
    canonical_json: str = "{}"
    imported_at: datetime = Field(default_factory=utcnow)
    record_version: int = 1


class Alert(SQLModel, table=True):
    __tablename__ = "alert"

    id: str = Field(primary_key=True)
    patient_id: str = Field(foreign_key="patient.id", index=True)
    severity: str = "INFO"
    category: str = "OTHER"
    title: str = ""
    message: str = ""
    evidence_json: str = "[]"


class Specialist(SQLModel, table=True):
    __tablename__ = "specialist"

    id: str = Field(primary_key=True)
    name: str
    specialty: str
    zone: str
    price_from: int = 0
    bio: str = ""
    available_slots_json: str = "[]"


class Request(SQLModel, table=True):
    __tablename__ = "request"

    id: str = Field(primary_key=True)
    patient_id: str = Field(foreign_key="patient.id", index=True)
    specialist_id: str = Field(foreign_key="specialist.id", index=True)
    created_by: str = Field(foreign_key="user.id")
    status: RequestStatus = Field(default=RequestStatus.REQUESTED)
    motivo: str = ""
    urgencia: str = "MEDIA"
    share_level: ShareLevel = Field(default=ShareLevel.CLINICAL)
    preferred: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Appointment(SQLModel, table=True):
    __tablename__ = "appointment"

    id: str = Field(primary_key=True)
    request_id: str = Field(foreign_key="request.id", index=True)
    when_iso: str
    status: str = "SCHEDULED"


class AuditEvent(SQLModel, table=True):
    __tablename__ = "audit_event"

    id: str = Field(primary_key=True)
    actor: str
    role: str
    entity_type: str
    entity_id: str
    action: str
    created_at: datetime = Field(default_factory=utcnow)


class ImportJob(SQLModel, table=True):
    __tablename__ = "import_job"

    id: str = Field(primary_key=True)
    filename: str
    status: ImportStatus = Field(default=ImportStatus.UPLOADING)
    sha256: Optional[str] = Field(default=None)
    record_id: Optional[str] = Field(default=None)
    message: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)
