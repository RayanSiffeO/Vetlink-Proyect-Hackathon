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
from app.models import (
    Appointment,
    AuditEvent,
    Patient,
    Record,
    Request,
    RequestStatus,
    Role,
    Specialist,
    User,
    utcnow,
)

CLINIC_USER = User(
    id="usr_cierre_clinica",
    username="laura",
    display_name="Dra. Laura Puig",
    role=Role.CLINIC,
    clinic_id="Clínica Vall del Sol",
)
ASSIGNED_SPECIALIST = User(
    id="usr_cierre_especialista",
    username="marc",
    display_name="Dr. Marc Vidal",
    role=Role.SPECIALIST,
    specialty="Cardiología",
)
OTHER_SPECIALIST = User(
    id="usr_cierre_otro",
    username="elena",
    display_name="Dra. Elena Serra",
    role=Role.SPECIALIST,
    specialty="Dermatología",
)
PATIENT_ID = "pat_cierre"
RECORD_ID = "rec_cierre"
SPECIALIST_ID = "spc_marc"
REQUEST_ID = "req_cierre"
APPOINTMENT_ID = "apt_cierre"
CLOSE_URL = f"/api/requests/{REQUEST_ID}/close"
NOTE = "Soplo sistólico leve, sin cambios respecto a la revisión previa."
DIAGNOSIS = "Estenosis valvular leve"
NEXT_VISIT = "2027-05-14"


def canonical_fixture() -> dict:
    return {
        "record_id": "vlr_cierre",
        "patient": {"name": "Nala"},
        "encounters": [
            {
                "_type": "Encounter",
                "id": "vs-enc-2024-03-12",
                "date": "2024-03-12",
                "type": "FIRST_VISIT",
                "reason": "Primera visita",
                "_meta": {"source_ref": "docx#tabla3/fila1"},
            }
        ],
        "provenance_summary": {"entities": 4, "fields_populated": 20},
    }


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    engine.dispose()


@pytest.fixture()
def seeded(session: Session) -> Session:
    session.add(Patient(id=PATIENT_ID, name="Nala", species="Perro", owner_display="TUTOR_1"))
    session.add(Specialist(id=SPECIALIST_ID, name="Dr. Marc Vidal", specialty="Cardiología", zone="Barcelona"))
    session.add(Record(id=RECORD_ID, patient_id=PATIENT_ID, canonical_json=dumps_json(canonical_fixture())))
    session.add(
        Request(
            id=REQUEST_ID,
            patient_id=PATIENT_ID,
            specialist_id=SPECIALIST_ID,
            created_by=CLINIC_USER.id,
            status=RequestStatus.SCHEDULED,
            motivo="Soplo cardíaco",
        )
    )
    session.add(
        Appointment(
            id=APPOINTMENT_ID,
            request_id=REQUEST_ID,
            when_iso="2026-11-16T09:30:00",
            status="SCHEDULED",
        )
    )
    session.commit()
    return session


@pytest.fixture()
def client(seeded: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: seeded
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
    app.dependency_overrides[get_current_user] = lambda: ASSIGNED_SPECIALIST
    return client


@pytest.fixture()
def other_specialist_client(client: TestClient) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: OTHER_SPECIALIST
    return client


def stored_canonical(session: Session) -> dict:
    stored = session.get(Record, RECORD_ID)
    assert stored is not None
    return json.loads(stored.canonical_json)


def audit_actions(session: Session) -> list[str]:
    return [event.action for event in session.exec(select(AuditEvent)).all()]


def close_payload(**overrides: object) -> dict:
    payload = {
        "note": NOTE,
        "diagnosis": DIAGNOSIS,
        "recommendations": "Revisión en 6 meses con ecocardiografía",
        "next_visit": NEXT_VISIT,
    }
    payload.update(overrides)
    return payload


def test_assigned_specialist_closes_visit_and_writes_note(specialist_client: TestClient, session: Session) -> None:
    response = specialist_client.post(CLOSE_URL, json=close_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["request"]["status"] == "COMPLETED"
    assert body["appointment"]["id"] == APPOINTMENT_ID
    assert body["appointment"]["status"] == "COMPLETED"
    assert body["patient"]["id"] == PATIENT_ID
    assert body["record"]["id"] == RECORD_ID
    canonical = stored_canonical(session)
    assert len(canonical["encounters"]) == 2
    encounter = canonical["encounters"][-1]
    assert encounter["id"] == f"enc_vetlink_{REQUEST_ID}"
    assert encounter["date"] == utcnow().date().isoformat()
    assert encounter["type"] == "RECHECK"
    assert encounter["reason"] == "Cierre de visita · Cardiología"
    assert encounter["diagnosis_summary"] == DIAGNOSIS
    assert encounter["note"] == NOTE
    assert encounter["soap"] == {"A": DIAGNOSIS, "P": NOTE}
    assert encounter["recommendations"] == "Revisión en 6 meses con ecocardiografía"
    assert encounter["next_visit_date"] == NEXT_VISIT
    assert encounter["clinician_ref"] == "Dr. Marc Vidal"
    assert encounter["_meta"]["source_system"] == "VetLink · especialista"
    assert encounter["_meta"]["source_ref"] == f"request:{REQUEST_ID}"
    assert encounter["_meta"]["extracted_by"] == "specialist:marc"
    assert encounter["_meta"]["method"] == "direct"
    assert encounter["_meta"]["confidence"] == 1.0
    assert canonical["provenance_summary"]["entities"] == 5
    assert canonical["provenance_summary"]["fields_populated"] == 20
    assert "REQUEST_CLOSED" in audit_actions(session)
    assert "SPECIALIST_NOTE_ADDED" in audit_actions(session)


def test_note_without_diagnosis_uses_note_preview(specialist_client: TestClient, session: Session) -> None:
    response = specialist_client.post(CLOSE_URL, json={"note": NOTE})
    assert response.status_code == 200, response.text
    encounter = stored_canonical(session)["encounters"][-1]
    assert encounter["diagnosis_summary"] == NOTE
    assert encounter["note"] == NOTE
    assert encounter["soap"] == {"A": "", "P": NOTE}
    assert encounter["recommendations"] is None
    assert encounter["next_visit_date"] is None


def test_clinic_cannot_close_visit(clinic_client: TestClient, session: Session) -> None:
    response = clinic_client.post(CLOSE_URL, json=close_payload())
    assert response.status_code == 403
    assert "especialista" in response.json()["detail"]
    assert len(stored_canonical(session)["encounters"]) == 1
    assert stored_canonical(session)["provenance_summary"]["entities"] == 4
    assert audit_actions(session) == []


def test_unassigned_specialist_cannot_close_visit(other_specialist_client: TestClient, session: Session) -> None:
    response = other_specialist_client.post(CLOSE_URL, json=close_payload())
    assert response.status_code == 403
    assert len(stored_canonical(session)["encounters"]) == 1
    assert audit_actions(session) == []


def test_closing_completed_visit_returns_conflict(specialist_client: TestClient, session: Session) -> None:
    first = specialist_client.post(CLOSE_URL, json=close_payload())
    assert first.status_code == 200, first.text
    second = specialist_client.post(CLOSE_URL, json=close_payload())
    assert second.status_code == 409
    assert "COMPLETED" in second.json()["detail"]
    assert len(stored_canonical(session)["encounters"]) == 2


def test_empty_note_returns_unprocessable(specialist_client: TestClient, session: Session) -> None:
    response = specialist_client.post(CLOSE_URL, json={"note": ""})
    assert response.status_code == 422
    short = specialist_client.post(CLOSE_URL, json={"note": "ab"})
    assert short.status_code == 422
    blank = specialist_client.post(CLOSE_URL, json={"note": "   "})
    assert blank.status_code == 422
    assert len(stored_canonical(session)["encounters"]) == 1


def test_invalid_next_visit_returns_unprocessable(specialist_client: TestClient, session: Session) -> None:
    response = specialist_client.post(CLOSE_URL, json=close_payload(next_visit="2027-13-45"))
    assert response.status_code == 422
    assert len(stored_canonical(session)["encounters"]) == 1


def test_unknown_request_returns_not_found(specialist_client: TestClient) -> None:
    response = specialist_client.post("/api/requests/req_inexistente/close", json=close_payload())
    assert response.status_code == 404


def test_close_requires_session(client: TestClient) -> None:
    response = client.post(CLOSE_URL, json=close_payload())
    assert response.status_code == 401
