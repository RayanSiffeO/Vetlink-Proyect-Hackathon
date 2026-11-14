from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

LOCKED_DETAIL = "La historia completa se desbloquea al aceptar la derivación"


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, user: str) -> None:
    response = client.post("/api/auth/demo", json={"user": user})
    assert response.status_code == 200, response.text
    assert response.json()["user"]["username"] == user


def create_kira_request(client: TestClient) -> str:
    created = client.post(
        "/api/requests",
        json={
            "patient_id": "pat_kira",
            "specialist_id": "spc_marc",
            "motivo": "Soplo cardíaco",
            "urgencia": "ALTA",
            "share_level": "CLINICAL",
            "preferred": "Mañanas",
        },
    )
    assert created.status_code == 200, created.text
    request_body = created.json()["request"]
    assert request_body["status"] == "REQUESTED"
    return request_body["id"]


def assert_summary_has_no_identity(client: TestClient, request_id: str) -> None:
    summary = client.get(f"/api/requests/{request_id}/summary")
    assert summary.status_code == 200
    raw = summary.text
    assert "9410000" not in raw and "TUTOR_" not in raw and "Carmen" not in raw


def assert_briefing_locked(client: TestClient, request_id: str) -> None:
    locked = client.get(f"/api/requests/{request_id}/briefing")
    assert locked.status_code == 403
    assert locked.json()["detail"] == LOCKED_DETAIL


def accept_request(client: TestClient, request_id: str) -> None:
    accepted = client.post(
        f"/api/requests/{request_id}/accept",
        json={"slot_iso": "2026-11-16T09:30:00"},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["request"]["status"] == "SCHEDULED"


def assert_briefing_unlocked(client: TestClient, request_id: str) -> None:
    unlocked = client.get(f"/api/requests/{request_id}/briefing")
    assert unlocked.status_code == 200
    briefing = unlocked.json()["briefing"]
    assert set(briefing["alert_counts"]) == {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}
    assert 1 <= len(briefing["alerts_rendered"]) <= 7


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok" and body["db"] == "sqlite" and body["seeded"] is True


def test_auth_and_patients(client: TestClient) -> None:
    assert client.get("/api/patients").status_code == 401
    login(client, "laura")
    me = client.get("/api/me").json()["user"]
    assert me["role"] == "CLINIC"
    patients = client.get("/api/patients").json()["patients"]
    ids = {patient["id"] for patient in patients}
    assert {"pat_bruno", "pat_kira", "pat_luna"} <= ids


def test_record_has_canonical_and_alerts(client: TestClient) -> None:
    login(client, "laura")
    body = client.get("/api/patients/pat_kira/record").json()
    assert body["record"]["record_id"] == "vlr_kira_5d2e8b90"
    assert len(body["alerts"]) >= 5
    assert body["provenance_summary"]["entities"] > 0


def test_import_cache_and_csv_review(client: TestClient) -> None:
    login(client, "laura")
    sample = settings.samples_dir / "historial.json"
    with sample.open("rb") as handle:
        response = client.post(
            "/api/imports",
            files={"files": ("historial.json", handle, "application/json")},
        )
    assert response.status_code == 200
    entry = response.json()["files"][0]
    assert entry["status"] == "READY"
    assert entry["record_id"] == "pat_kira"

    csv_path = settings.samples_dir / "export_clinica_norte.csv"
    with csv_path.open("rb") as handle:
        response = client.post(
            "/api/imports",
            files={"files": (csv_path.name, handle, "text/csv")},
        )
    entry = response.json()["files"][0]
    assert entry["status"] == "NEEDS_REVIEW"
    assert entry["message"] == "mapeo asistido pendiente"


def test_request_summary_locked_then_briefing(client: TestClient) -> None:
    login(client, "laura")
    request_id = create_kira_request(client)
    assert_summary_has_no_identity(client, request_id)
    assert_briefing_locked(client, request_id)

    login(client, "marc")
    accept_request(client, request_id)
    assert_briefing_unlocked(client, request_id)

    appointments = client.get("/api/appointments").json()["appointments"]
    assert any(appointment["request_id"] == request_id for appointment in appointments)

def test_specialist_cannot_access_clinic_patients(client: TestClient) -> None:
    login(client, "marc")
    assert client.get("/api/patients").status_code == 403
    assert client.get("/api/patients/pat_kira/record").status_code == 403
