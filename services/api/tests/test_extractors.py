from __future__ import annotations

from pathlib import Path

import pytest

from app.config import settings
from app.extractors import get_extractor
from app.extractors.base import UnsupportedFormat
from app.extractors.csv_extractor import extract
from app.extractors.docx_extractor import extract as extract_docx
from app.extractors.json_extractor import extract as extract_json
from app.extractors.mapping import clean_microchip, parse_bcs
from app.extractors.xlsx_extractor import extract as extract_xlsx

SAMPLE = settings.samples_dir / "export_clinica_norte.csv"
JSON_SAMPLE = settings.samples_dir / "historial.json"
XLSX_SAMPLE = settings.samples_dir / "export_MAS-0004587_anonimizado.xlsx"
DOCX_SAMPLE = settings.samples_dir / "Clínica Veterinaria Vall del Sol.docx"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
DOCX_VARIANTS = (("variant_bruno.docx", "Bruno Variante"), ("variant_vall.docx", "Bruno"))
XLSX_VARIANTS = (("variant_luna.xlsx", "Luna Variante"), ("variant_export.xlsx", "Luna"))
HEADERS = "microchip;nombre_completo;tutor;fecha_visita;weight_lb;motivo;tratamiento;alergias\n"


def test_csv_extractor_is_registered() -> None:
    assert get_extractor(".csv") is extract
    assert get_extractor(".json") is extract_json
    assert get_extractor(".xlsx") is extract_xlsx
    assert get_extractor(".docx") is extract_docx


def test_json_sample_maps_to_canonical() -> None:
    record = extract_json(JSON_SAMPLE).record
    assert record["patient"]["name"] == "Kira"
    assert record["patient"]["weight_current_kg"] == 17.8
    assert record["patient"]["weight_current_on"] == "2026-11-07"
    assert record["patient"]["bcs"] == 5
    assert len(record["encounters"]) == 9
    assert len(record["problems"]) == 5
    assert record["owners"][0]["display_name"]


def test_xlsx_sample_maps_to_canonical() -> None:
    record = extract_xlsx(XLSX_SAMPLE).record
    assert record["patient"]["name"] == "Luna"
    assert record["patient"]["weight_current_kg"] == 12.8
    assert record["patient"]["bcs"] == 5
    assert len(record["encounters"]) == 6
    assert len(record["problems"]) >= 1


def test_docx_sample_maps_to_canonical() -> None:
    record = extract_docx(DOCX_SAMPLE).record
    assert record["patient"]["name"] == "Bruno"
    assert record["patient"]["microchip"] == "941000012345678"
    assert record["patient"]["bcs"] == 6
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


def test_bcs_and_microchip_are_cleaned_centrally() -> None:
    assert parse_bcs("5/9") == 5
    assert parse_bcs("6/9 (ligero sobrepeso)") == 6
    assert parse_bcs("BCS 7/9") == 7
    assert parse_bcs(5) == 5
    assert parse_bcs(None) is None
    assert parse_bcs("sin dato") is None
    assert clean_microchip("941000012345678 (ficticio)") == "941000012345678"
    assert clean_microchip("9410 0001 2345 678") == "9410 0001 2345 678"
    assert clean_microchip("—") is None


def test_ordinal_microchip_header_and_bcs_are_recognized(tmp_path: Path) -> None:
    path = tmp_path / "ordinal.csv"
    path.write_text(
        "N.º de microchip;Nombre;Peso actual;Condición corporal\n"
        "941000012345678 (ficticio);Rex;12,5 kg;6/9 (ligero sobrepeso)\n",
        encoding="utf-8",
    )
    record = extract(path).record
    assert record["patient"]["microchip"] == "941000012345678"
    assert record["patient"]["weight_current_kg"] == 12.5
    assert record["patient"]["bcs"] == 6


@pytest.mark.parametrize(("filename", "expected_name"), DOCX_VARIANTS)
def test_docx_variant_keeps_microchip_and_bcs(filename: str, expected_name: str) -> None:
    result = extract_docx(FIXTURES / filename)
    record = result.record
    assert record["patient"]["name"] == expected_name
    assert record["patient"]["microchip"] == "941000012345678"
    assert record["patient"]["bcs"] == 6
    assert record["patient"]["weight_current_kg"] == 32.4
    assert len(record["encounters"]) == 11
    assert record["encounters"][0]["vitals"]["weight_kg"] == 4.1
    assert record["encounters"][-1]["vitals"]["weight_kg"] == 32.4
    assert "weight_kg" not in record["encounters"][4]["vitals"]
    assert len(record["weights"]) == 9
    assert record["weights"][0]["weight_kg"] == 4.1
    assert result.needs_review is True


def test_json_variant_uses_kg_weights_and_latest_bcs() -> None:
    record = extract_json(FIXTURES / "variant_historial.json").record
    assert record["patient"]["name"] == "Kira Variante"
    assert record["patient"]["microchip"] == "9410000XXXXX207"
    assert record["patient"]["weight_current_kg"] == 17.8
    assert record["patient"]["weight_current_on"] == "2026-11-07"
    assert record["patient"]["bcs"] == 5
    assert len(record["weights"]) == 7
    assert record["weights"][-1]["kg"] == 17.8


@pytest.mark.parametrize(("filename", "expected_name"), XLSX_VARIANTS)
def test_xlsx_variant_uses_current_weight_and_bcs(filename: str, expected_name: str) -> None:
    record = extract_xlsx(FIXTURES / filename).record
    assert record["patient"]["name"] == expected_name
    assert record["patient"]["weight_current_kg"] == 12.8
    assert record["patient"]["weight_current_on"] == "2026-11-06"
    assert record["patient"]["bcs"] == 5


def test_csv_variant_fixture_still_maps_reference_patient() -> None:
    record = extract(FIXTURES / "variant_export.csv").record
    assert record["patient"]["name"] == "Nala"
    assert record["patient"]["microchip"] == "941000099887766"
    assert record["patient"]["weight_current_kg"] == 11.97
    assert len(record["encounters"]) == 3
