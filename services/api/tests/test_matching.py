from __future__ import annotations

import json

import pytest

from app.canonical.matching import is_full_microchip, match_patient, normalize_name
from app.config import settings

BRUNO_FILE = "canonico-bruno.json"
KIRA_FILE = "canonico-kira.json"
LUNA_FILE = "canonico-luna.json"


def load_canonical_patient(filename: str) -> dict:
    path = settings.canonical_dir / filename
    return json.loads(path.read_text(encoding="utf-8"))["patient"]


@pytest.fixture(scope="module")
def bruno() -> dict:
    return load_canonical_patient(BRUNO_FILE)


@pytest.fixture(scope="module")
def kira() -> dict:
    return load_canonical_patient(KIRA_FILE)


@pytest.fixture(scope="module")
def luna() -> dict:
    return load_canonical_patient(LUNA_FILE)


@pytest.fixture(scope="module")
def candidates(bruno: dict, kira: dict, luna: dict) -> list[dict]:
    return [bruno, luna, kira]


def test_normalize_name_removes_accents_and_collapses_spaces() -> None:
    assert normalize_name("  Roldán   Puig ") == "roldan puig"
    assert normalize_name("LUNA") == "luna"
    assert normalize_name("Mª áNGELA") == "ma angela"


def test_is_full_microchip_accepts_only_fifteen_digits() -> None:
    assert is_full_microchip("941000012345678") is True
    assert is_full_microchip("9410 0001 2345 678") is True
    assert is_full_microchip("9410000XXXXX207") is False
    assert is_full_microchip("94100001234567") is False
    assert is_full_microchip(None) is False


def test_formatted_bruno_microchip_matches_with_full_confidence(bruno: dict, candidates: list[dict]) -> None:
    incoming = {**bruno, "id": "pat_bruno_v2", "microchip": "9410 0001 2345 678"}
    match = match_patient(incoming, candidates)
    assert match is not None
    assert match["patient_id"] == bruno["id"]
    assert match["method"] == "microchip"
    assert match["confidence"] == 1.0
    assert match["requires_review"] is False


def test_luna_reimport_updates_instead_of_duplicating(luna: dict, candidates: list[dict]) -> None:
    incoming = {
        "id": "pat_luna_v2",
        "name": "LUNA",
        "birth_date": "2019-03-14",
        "species_code": "CAN",
        "microchip": None,
        "external_ids": [{"system": "PMS MAS", "id": "MAS-0004587"}],
    }
    by_external_id = match_patient(incoming, candidates)
    by_name_and_birth = match_patient({**incoming, "external_ids": []}, candidates)
    assert by_external_id is not None
    assert by_external_id["patient_id"] == luna["id"]
    assert by_external_id["confidence"] == 0.95
    assert by_external_id["requires_review"] is False
    assert by_name_and_birth is not None
    assert by_name_and_birth["patient_id"] == luna["id"]
    assert by_name_and_birth["confidence"] == 0.90
    assert by_name_and_birth["requires_review"] is False


def test_masked_kira_microchip_never_exceeds_review_limit(kira: dict, candidates: list[dict]) -> None:
    incoming = {
        "id": "pat_kira_v2",
        "name": "Kira",
        "birth_date": "2021-06-14",
        "species_code": "CAN",
        "microchip": "9410000XXXXX207",
        "external_ids": [],
    }
    match = match_patient(incoming, candidates)
    assert match is not None
    assert match["patient_id"] == kira["id"]
    assert match["method"] == "masked_microchip"
    assert match["confidence"] <= 0.60
    assert match["requires_review"] is True


def test_unrelated_patient_has_no_match(candidates: list[dict]) -> None:
    incoming = {
        "id": "pat_rocky",
        "name": "Rocky",
        "birth_date": "2022-05-05",
        "species_code": "CAN",
        "microchip": None,
        "external_ids": [{"system": "PMS MAS", "id": "MAS-9999999"}],
    }
    assert match_patient(incoming, candidates) is None


def test_exact_microchip_beats_similar_candidates(bruno: dict, candidates: list[dict]) -> None:
    decoy = {**bruno, "id": "pat_bruno_dup", "microchip": "9410000XXXXX999", "external_ids": []}
    incoming = {**bruno, "id": "pat_bruno_v2", "microchip": "941 0000 1234 5678"}
    winner = match_patient(incoming, [decoy, *candidates])
    decoy_only = match_patient(incoming, [decoy])
    assert winner is not None
    assert winner["patient_id"] == bruno["id"]
    assert winner["confidence"] == 1.0
    assert decoy_only is not None
    assert decoy_only["confidence"] < winner["confidence"]


def test_other_species_is_not_the_same_patient(luna: dict) -> None:
    incoming = {**luna, "id": "pat_luna_fel", "species_code": "FEL"}
    assert match_patient(incoming, [luna]) is None


def test_birth_date_alone_requires_review(bruno: dict) -> None:
    incoming = {
        "id": "pat_wanda",
        "name": "Wanda",
        "birth_date": "2024-02-02",
        "species_code": "CAN",
        "microchip": None,
        "external_ids": [],
    }
    match = match_patient(incoming, [bruno])
    assert match is not None
    assert match["method"] == "weak_identity"
    assert match["confidence"] == 0.50
    assert match["requires_review"] is True
