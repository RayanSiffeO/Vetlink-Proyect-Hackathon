from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.auth import get_current_user
from app.context import ApiContext
from app.db import get_session
from app.extractors import EXTRACTORS
from app.extractors.base import ExtractResult, UnsupportedFormat
from app.ingestion import ingest_canonical
from app.main import app
from app.models import Alert, AuditEvent, ImportStatus, Patient, Record, Role, User

EXAMPLES_DIR = Path(__file__).resolve().parents[3] / "data" / "canonical"
DEMO_USER = User(id="usr_ingesta", username="ingesta", display_name="Ingesta", role=Role.CLINIC)


def load_record(name: str) -> dict:
    path = EXAMPLES_DIR / f"canonico-{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    engine.dispose()


@pytest.fixture()
def context(session: Session) -> ApiContext:
    return ApiContext(user=DEMO_USER, session=session)


@pytest.fixture()
def client(session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: DEMO_USER
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()
    test_client.close()


def stored_patients(session: Session) -> list[Patient]:
    return list(session.exec(select(Patient)).all())


def stored_alerts(session: Session) -> list[Alert]:
    return list(session.exec(select(Alert)).all())


def audit_actions(session: Session) -> list[str]:
    return [event.action for event in session.exec(select(AuditEvent)).all()]


def upload(client: TestClient, filename: str, payload: bytes) -> dict:
    response = client.post("/api/imports", files=[("files", (filename, payload, "application/octet-stream"))])
    assert response.status_code == 200, response.text
    return response.json()


def test_luna_ingest_creates_patient_record_and_alerts(context: ApiContext, session: Session) -> None:
    canonical = load_record("luna")
    canonical["alerts"] = [{"id": "alerta_inventada", "title": "no debería persistir"}]
    job = ingest_canonical(context, canonical, "export_MAS-0004587_anonimizado.xlsx", "sha-luna")
    patient = session.get(Patient, "pat_luna")
    record = session.get(Record, job.record_id or "")
    rows = stored_alerts(session)
    assert job.status == ImportStatus.READY
    assert job.sha256 == "sha-luna" and job.filename == "export_MAS-0004587_anonimizado.xlsx"
    assert patient is not None and patient.name == "Luna" and patient.birth_date == "2019-03-14"
    assert record is not None and record.patient_id == "pat_luna" and record.record_version == 1
    assert rows and all(row.patient_id == "pat_luna" for row in rows)
    assert len(rows) == len(canonical["alerts"]) > 0
    assert "alerta_inventada" not in {row.id for row in rows}
    assert all(json.loads(row.evidence_json) for row in rows)
    assert json.loads(record.canonical_json)["alerts"] == canonical["alerts"]
    assert {"PATIENT_CREATED", "IMPORT_RECORD"} <= set(audit_actions(session))


def test_bruno_variant_keeps_patient_and_updates_record(context: ApiContext, session: Session) -> None:
    first = ingest_canonical(context, load_record("bruno"), "Clínica Veterinaria Vall del Sol.docx", "sha-1")
    variant = load_record("bruno")
    variant["patient"]["microchip"] = "9410 0001 2345 678"
    variant["patient"]["weight_current_kg"] = 33.1
    variant["record_id"] = "vlr_bruno_vs-2024-00387-v2"
    second = ingest_canonical(context, variant, "bruno-variante.docx", "sha-2")
    patient = session.get(Patient, "pat_bruno")
    record = session.get(Record, first.record_id or "")
    assert len(stored_patients(session)) == 1
    assert patient is not None and patient.weight_current_kg == 33.1
    assert second.record_id == first.record_id
    assert second.status == ImportStatus.READY and "actualizada" in (second.message or "")
    assert record is not None and record.record_version == 2
    assert json.loads(record.canonical_json)["record_id"] == "vlr_bruno_vs-2024-00387-v2"
    assert len(stored_alerts(session)) == len(variant["alerts"])
    assert "PATIENT_MATCHED" in audit_actions(session)


def test_kira_masked_microchip_links_for_review_without_duplicating(context: ApiContext, session: Session) -> None:
    first = ingest_canonical(context, load_record("kira"), "historial.json", "sha-kira-1")
    second = ingest_canonical(context, load_record("kira"), "historial-variante.json", "sha-kira-2")
    assert len(stored_patients(session)) == 1
    assert session.get(Patient, "pat_kira") is not None
    assert second.record_id == first.record_id
    assert second.status == ImportStatus.NEEDS_REVIEW
    assert "revisión" in (second.message or "") and "0.60" in (second.message or "")
    assert len(stored_alerts(session)) == len(load_record("kira")["alerts"])


def test_missing_extractor_falls_back_to_needs_review(client: TestClient) -> None:
    body = upload(client, "ficha.pdf", b"%PDF-1.4 contenido")
    entry = body["files"][0]
    assert entry["status"] == "NEEDS_REVIEW"
    assert entry["message"] == "mapeo asistido pendiente"
    assert body["summary"] == {"total": 1, "ready": 0, "needs_review": 1, "failed": 0}


def test_unsupported_format_from_extractor_falls_back_to_needs_review(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def extractor(path: Path) -> ExtractResult:
        raise UnsupportedFormat("pdf escaneado sin capa de texto")

    monkeypatch.setitem(EXTRACTORS, ".fake", extractor)
    entry = upload(client, "escaneo.fake", b"binario")["files"][0]
    assert entry["status"] == "NEEDS_REVIEW"
    assert "soportado" in entry["message"] and "pdf escaneado" in entry["message"]


def test_extractor_result_is_ingested(client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    canonical = load_record("luna")
    monkeypatch.setitem(EXTRACTORS, ".fake", lambda path: ExtractResult(record=canonical))
    entry = upload(client, "luna.fake", b"contenido-luna")["files"][0]
    assert entry["status"] == "READY"
    assert entry["record_id"] == "rec_luna"
    assert session.get(Patient, "pat_luna") is not None


def test_extractor_warnings_downgrade_job_to_needs_review(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    canonical = load_record("luna")
    warning = "columna 'tx' sin mapear"
    monkeypatch.setitem(EXTRACTORS, ".fake", lambda path: ExtractResult(record=canonical, warnings=[warning]))
    entry = upload(client, "luna.fake", b"contenido-luna-con-avisos")["files"][0]
    assert entry["status"] == "NEEDS_REVIEW"
    assert warning in entry["message"] and "revisión" in entry["message"]


def test_extractor_crash_does_not_break_the_batch(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def extractor(path: Path) -> ExtractResult:
        raise RuntimeError("hoja corrupta")

    canonical = load_record("luna")
    monkeypatch.setitem(EXTRACTORS, ".boom", extractor)
    monkeypatch.setitem(EXTRACTORS, ".fake", lambda path: ExtractResult(record=canonical))
    response = client.post(
        "/api/imports",
        files=[
            ("files", ("roto.boom", b"roto", "application/octet-stream")),
            ("files", ("bueno.fake", b"bueno", "application/octet-stream")),
        ],
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["files"][0]["status"] == "FAILED" and "hoja corrupta" in body["files"][0]["message"]
    assert body["files"][1]["status"] == "READY"
    assert body["summary"] == {"total": 2, "ready": 1, "needs_review": 0, "failed": 1}

