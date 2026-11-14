from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.auth import get_current_user
from app.db import dumps_json, get_session
from app.main import app
from app.models import (
    Appointment,
    Patient,
    Request,
    RequestStatus,
    Role,
    Specialist,
    User,
)

CLINIC_USER = User(
    id="usr_agenda_clinica",
    username="laura",
    display_name="Dra. Laura Puig",
    role=Role.CLINIC,
    clinic_id="Clínica Vall del Sol",
)
ASSIGNED_SPECIALIST = User(
    id="usr_agenda_marc",
    username="marc",
    display_name="Dr. Marc Vidal",
    role=Role.SPECIALIST,
    specialty="Cardiología",
)
OTHER_SPECIALIST = User(
    id="usr_agenda_elena",
    username="elena",
    display_name="Dra. Elena Serra",
    role=Role.SPECIALIST,
    specialty="Dermatología",
)

PATIENT_ID = "pat_agenda"
SPECIALIST_ID = "spc_marc"
OTHER_SPECIALIST_ID = "spc_elena"
REQUEST_ONE = "req_agenda_uno"
REQUEST_TWO = "req_agenda_dos"
PAST_SLOT = (datetime.now() - timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
FUTURE_SLOT = (datetime.now() + timedelta(days=30)).replace(hour=10, minute=0, second=0, microsecond=0)
PAST_ISO = PAST_SLOT.isoformat()
FUTURE_ISO = FUTURE_SLOT.isoformat()


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    engine.dispose()


@pytest.fixture()
def seeded(session: Session) -> Session:
    session.add(Patient(id=PATIENT_ID, name="Nala", species="Perro"))
    session.add(
        Specialist(
            id=SPECIALIST_ID,
            name="Dr. Marc Vidal",
            specialty="Cardiología",
            zone="Barcelona",
            available_slots_json=dumps_json([PAST_ISO, FUTURE_ISO]),
        )
    )
    session.add(
        Specialist(
            id=OTHER_SPECIALIST_ID,
            name="Dra. Elena Serra",
            specialty="Dermatología",
            zone="Barcelona",
        )
    )
    session.add_all(
        [
            Request(
                id=REQUEST_ONE,
                patient_id=PATIENT_ID,
                specialist_id=SPECIALIST_ID,
                created_by=CLINIC_USER.id,
                status=RequestStatus.REQUESTED,
                motivo="Soplo cardíaco",
            ),
            Request(
                id=REQUEST_TWO,
                patient_id=PATIENT_ID,
                specialist_id=SPECIALIST_ID,
                created_by=CLINIC_USER.id,
                status=RequestStatus.REQUESTED,
                motivo="Control cardiológico",
            ),
        ]
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


def appointments_for(session: Session, request_id: str) -> list[Appointment]:
    return list(session.exec(select(Appointment).where(Appointment.request_id == request_id)).all())


def test_accept_rejects_past_slot(specialist_client: TestClient, session: Session) -> None:
    response = specialist_client.post(
        f"/api/requests/{REQUEST_ONE}/accept",
        json={"slot_iso": PAST_ISO},
    )
    assert response.status_code == 422, response.text
    assert response.json()["detail"] == "La franja ya ha pasado. Elige una franja futura."
    assert session.get(Request, REQUEST_ONE).status == RequestStatus.REQUESTED
    assert appointments_for(session, REQUEST_ONE) == []


def test_accept_rejects_occupied_slot(specialist_client: TestClient, session: Session) -> None:
    first = specialist_client.post(
        f"/api/requests/{REQUEST_ONE}/accept",
        json={"slot_iso": FUTURE_ISO},
    )
    assert first.status_code == 200, first.text
    assert first.json()["request"]["status"] == "SCHEDULED"

    second = specialist_client.post(
        f"/api/requests/{REQUEST_TWO}/accept",
        json={"slot_iso": FUTURE_ISO},
    )
    assert second.status_code == 409, second.text
    assert second.json()["detail"] == "La franja ya está ocupada. Elige otra franja."
    assert session.get(Request, REQUEST_TWO).status == RequestStatus.REQUESTED
    assert len(appointments_for(session, REQUEST_TWO)) == 0


def test_specialist_detail_and_list_hide_past_slots(clinic_client: TestClient) -> None:
    detail = clinic_client.get(f"/api/specialists/{SPECIALIST_ID}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["available_slots"] == [FUTURE_ISO]
    assert body["slots_count"] == 1
    assert body["specialist"]["next_slot"] == FUTURE_ISO

    listing = clinic_client.get("/api/specialists")
    assert listing.status_code == 200
    marc = next(item for item in listing.json()["specialists"] if item["id"] == SPECIALIST_ID)
    assert marc["next_slot"] == FUTURE_ISO


def test_availability_rejects_past_slots(specialist_client: TestClient, session: Session) -> None:
    rejected = specialist_client.patch(
        f"/api/specialists/{SPECIALIST_ID}/availability",
        json={"slots": [PAST_ISO]},
    )
    assert rejected.status_code == 422, rejected.text
    assert "ha pasado" in rejected.json()["detail"]

    accepted = specialist_client.patch(
        f"/api/specialists/{SPECIALIST_ID}/availability",
        json={"slots": [FUTURE_ISO]},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["available_slots"] == [FUTURE_ISO]
    assert accepted.json()["specialist"]["next_slot"] == FUTURE_ISO


def test_non_participant_gets_permission_error(
    other_specialist_client: TestClient,
) -> None:
    detail = other_specialist_client.get(f"/api/requests/{REQUEST_ONE}")
    assert detail.status_code == 403
    assert detail.json()["detail"] == "No participas en esta derivación"

    summary = other_specialist_client.get(f"/api/requests/{REQUEST_ONE}/summary")
    assert summary.status_code == 403
    assert summary.json()["detail"] == "No participas en esta derivación"

    briefing = other_specialist_client.get(f"/api/requests/{REQUEST_ONE}/briefing")
    assert briefing.status_code == 403
    assert briefing.json()["detail"] == "No participas en esta derivación"
