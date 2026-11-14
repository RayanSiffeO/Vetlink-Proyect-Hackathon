"""Smoke tests del H+0 (sin red externa, misma BD de demo)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def login(client: TestClient, user: str) -> None:
    r = client.post("/api/auth/demo", json={"user": user})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["username"] == user


def test_health(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["db"] == "sqlite" and body["seeded"] is True


def test_auth_and_patients(client: TestClient) -> None:
    assert client.get("/api/patients").status_code == 401
    login(client, "laura")
    me = client.get("/api/me").json()["user"]
    assert me["role"] == "CLINIC"
    patients = client.get("/api/patients").json()["patients"]
    ids = {p["id"] for p in patients}
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
    with sample.open("rb") as fh:
        r = client.post("/api/imports", files={"files": ("historial.json", fh, "application/json")})
    assert r.status_code == 200
    entry = r.json()["files"][0]
    assert entry["status"] == "READY"
    assert entry["record_id"] == "pat_kira"

    csv_path = settings.samples_dir / "export_clinica_norte.csv"
    with csv_path.open("rb") as fh:
        r = client.post("/api/imports", files={"files": (csv_path.name, fh, "text/csv")})
    entry = r.json()["files"][0]
    assert entry["status"] == "NEEDS_REVIEW"
    assert entry["message"] == "mapeo asistido pendiente"


def test_request_summary_locked_then_briefing(client: TestClient) -> None:
    login(client, "laura")
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
    rid = created.json()["request"]["id"]
    assert created.json()["request"]["status"] == "REQUESTED"

    summary = client.get(f"/api/requests/{rid}/summary")
    assert summary.status_code == 200
    raw = summary.text
    assert "9410000" not in raw and "TUTOR_" not in raw and "Carmen" not in raw

    locked = client.get(f"/api/requests/{rid}/briefing")
    assert locked.status_code == 403
    assert locked.json()["detail"] == "La historia completa se desbloquea al aceptar la derivación"

    login(client, "marc")
    accepted = client.post(f"/api/requests/{rid}/accept", json={"slot_iso": "2026-11-16T09:30:00"})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["request"]["status"] == "SCHEDULED"

    unlocked = client.get(f"/api/requests/{rid}/briefing")
    assert unlocked.status_code == 200
    briefing = unlocked.json()["briefing"]
    assert set(briefing["alert_counts"]) == {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}
    assert 1 <= len(briefing["alerts_rendered"]) <= 7

    appts = client.get("/api/appointments").json()["appointments"]
    assert any(a["request_id"] == rid for a in appts)
