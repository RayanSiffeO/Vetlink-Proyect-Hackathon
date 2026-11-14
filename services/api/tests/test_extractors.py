from __future__ import annotations

from pathlib import Path

import pytest

from app.config import settings
from app.extractors import get_extractor
from app.extractors.base import UnsupportedFormat
from app.extractors.csv_extractor import extract
from app.extractors.docx_extractor import extract as extract_docx
from app.extractors.json_extractor import extract as extract_json
from app.extractors.xlsx_extractor import extract as extract_xlsx

SAMPLE = settings.samples_dir / "export_clinica_norte.csv"
JSON_SAMPLE = settings.samples_dir / "historial.json"
XLSX_SAMPLE = settings.samples_dir / "export_MAS-0004587_anonimizado.xlsx"
DOCX_SAMPLE = settings.samples_dir / "Clínica Veterinaria Vall del Sol.docx"
HEADERS = "microchip;nombre_completo;tutor;fecha_visita;weight_lb;motivo;tratamiento;alergias\n"


def test_csv_extractor_is_registered() -> None:
    assert get_extractor(".csv") is extract
    assert get_extractor(".json") is extract_json
    assert get_extractor(".xlsx") is extract_xlsx
    assert get_extractor(".docx") is extract_docx


def test_json_sample_maps_to_canonical() -> None:
    record = extract_json(JSON_SAMPLE).record
    assert record["patient"]["name"] == "Kira"
    assert len(record["encounters"]) == 9
    assert len(record["problems"]) == 5
    assert record["owners"][0]["display_name"]


def test_xlsx_sample_maps_to_canonical() -> None:
    record = extract_xlsx(XLSX_SAMPLE).record
    assert record["patient"]["name"] == "Luna"
    assert len(record["encounters"]) == 6
    assert len(record["problems"]) >= 1


def test_docx_sample_maps_to_canonical() -> None:
    record = extract_docx(DOCX_SAMPLE).record
    assert record["patient"]["name"] == "Bruno"
    assert len(record["encounters"]) == 11
    assert record["problems"][0]["category"] == "ALLERGY"


def test_sample_csv_maps_to_canonical() -> None:
    result = extract(SAMPLE)
    record = result.record
    assert record["schema_version"] == "vetlink.record/1.0"
    assert record["patient"]["name"] == "Nala"
    assert record["patient"]["weight_current_kg"] == 11.97
    assert len(record["encounters"]) == 3
    assert record["encounters"][0]["date"] == "2026-11-10"
    assert record["owners"][0]["display_name"] == "TUTOR_9A1B"
    assert record["problems"][0]["category"] == "ALLERGY"
    assert result.needs_review is True


def test_variant_headers_are_recognized(tmp_path: Path) -> None:
    path = tmp_path / "variant.csv"
    path.write_text(
        HEADERS
        + "941000099887766;Nala;TUTOR_9A1B;10/11/2026;26,4;Cojera;Meloxicam;Ninguna conocida\n",
        encoding="utf-8",
    )
    record = extract(path).record
    assert record["patient"]["name"] == "Nala"
    assert record["patient"]["weight_current_kg"] == 11.97
    assert record["encounters"][0]["reason"] == "Cojera"


def test_non_clinical_csv_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "admin.csv"
    path.write_text("tutor;factura\nTUTOR_1;100\n", encoding="utf-8")
    with pytest.raises(UnsupportedFormat):
        extract(path)
