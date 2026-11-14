from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.auth import get_current_user
from app.db import dumps_json, get_session
from app.main import app
from app.models import AuditEvent, Patient, Record, Role, User

CLINIC_USER = User(
    id="usr_revision_clinica",
    username="laura",
    display_name="Dra. Laura Puig",
    role=Role.CLINIC,
)
SPECIALIST_USER = User(
    id="usr_revision_especialista",
    username="marc",
    display_name="Dr. Marc Vidal",
    role=Role.SPECIALIST,
)
PATIENT_ID = "pat_revision"
RECORD_ID = "rec_revision"
REVIEW_URL = f"/api/patients/{PATIENT_ID}/record/review"


def canonical_fixture() -> dict:
    return {
        "record_id": "vlr_revision",
        "patient": {"name": "Nala"},
        "provenance_summary": {"entities": 4, "reviewed_fields": []},
        "review": {
            "policy": "Revisión humana de campos críticos con confianza baja",
            "critical_fields": [
                {"field": "patient.microchip", "type": "Patient", "review_required": True},
                {"field": "problem.label", "type": "Problem", "review_required": True},
            ],
            "pending_review": 2,
            "reviewed_by": None,
        },
    }


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    engine.dispose()


@pytest.fixture()
def record(session: Session) -> Record:
    patient = Patient(id=PATIENT_ID, name="Nala", species="Perro")
    stored = Record(id=RECORD_ID, patient_id=PATIENT_ID, canonical_json=dumps_json(canonical_fixture()))
    session.add(patient)
    session.add(stored)
    session.commit()
    session.refresh(stored)
    return stored


@pytest.fixture()
def client(session: Session, record: Record) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()
    test_client.close()


@pytest.fixture()
def clinic_client(client: TestClient) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: CLINIC_USER
    return client


@pytest.fixture()
def specialist_client(client: TestClient) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: SPECIALIST_USER
    return client


def stored_canonical(session: Session) -> dict:
    stored = session.get(Record, RECORD_ID)
    assert stored is not None
    return json.loads(stored.canonical_json)


def audit_actions(session: Session) -> list[str]:
    return [event.action for event in session.exec(select(AuditEvent)).all()]


def test_clinic_review_confirms_fields_and_audits(clinic_client: TestClient, session: Session) -> None:
    response = clinic_client.patch(
        REVIEW_URL,
        json={
            "reviewed_fields": ["patient.microchip", "problem.label"],
            "note": "Confirmado con la clínica",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["patient"]["id"] == PATIENT_ID
    assert body["record"]["id"] == RECORD_ID
    assert body["review"]["pending_review"] == 0
    assert body["review"]["critical_fields"] == []
    assert body["review"]["reviewed_by"] == "Dra. Laura Puig"
    assert body["review"]["reviewed_at"]
    assert body["review"]["note"] == "Confirmado con la clínica"
    assert body["review"]["reviewed_fields"] == ["patient.microchip", "problem.label"]
    canonical = stored_canonical(session)
    assert canonical["review"]["pending_review"] == 0
    assert canonical["provenance_summary"]["reviewed_fields"] == ["patient.microchip", "problem.label"]
    assert "REVIEW_RECORD" in audit_actions(session)


def test_specialist_cannot_review(specialist_client: TestClient, session: Session) -> None:
    response = specialist_client.patch(REVIEW_URL, json={"reviewed_fields": ["patient.microchip"]})
    assert response.status_code == 403
    assert "clínica" in response.json()["detail"]
    assert stored_canonical(session)["review"]["pending_review"] == 2
    assert audit_actions(session) == []


def test_review_requires_session(client: TestClient) -> None:
    response = client.patch(REVIEW_URL, json={})
    assert response.status_code == 401


def test_review_unknown_patient_or_record_returns_404(clinic_client: TestClient, session: Session) -> None:
    missing_patient = clinic_client.patch("/api/patients/pat_inexistente/record/review", json={})
    assert missing_patient.status_code == 404
    session.add(Patient(id="pat_sin_registro", name="Sin Registro", species="Gato"))
    session.commit()
    missing_record = clinic_client.patch("/api/patients/pat_sin_registro/record/review", json={})
    assert missing_record.status_code == 404
