from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from app.canonical.alerts import build_alerts

EXAMPLES_DIR = Path(__file__).resolve().parents[3] / "data" / "canonical"
SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")
ALERT_ID_PATTERN = re.compile(r"^alr_[a-z0-9_]+_R\d{2}_\d+$")


def load_record(name: str) -> dict:
    path = EXAMPLES_DIR / f"canonico-{name}.json"
    record = json.loads(path.read_text(encoding="utf-8"))
    record.pop("alerts", None)
    return record


def rule_ids(alerts: list[dict]) -> set[str]:
    return {alert["rule_id"] for alert in alerts}


def severity_counts(alerts: list[dict]) -> dict[str, int]:
    counts = Counter(alert["severity"] for alert in alerts)
    return {severity: counts.get(severity, 0) for severity in SEVERITIES}


def test_kira_flags_carprofen_as_critical() -> None:
    alerts = build_alerts(load_record("kira"))
    critical = [alert for alert in alerts if alert["severity"] == "CRITICAL"]
    assert len(alerts) >= 6
    assert any(
        alert["rule_id"] == "R01" and "carprofeno" in f"{alert['title']} {alert['message']}".lower()
        for alert in critical
    )


def test_bruno_flags_chicken_allergy_and_overdue_parasites() -> None:
    alerts = build_alerts(load_record("bruno"))
    allergy = next(alert for alert in alerts if alert["rule_id"] == "R01")
    assert allergy["severity"] == "HIGH"
    assert "pollo" in f"{allergy['title']} {allergy['message']}".lower()
    assert "R07" in rule_ids(alerts)


def test_luna_flags_overdue_parasites_problems_and_appointments() -> None:
    alerts = build_alerts(load_record("luna"))
    assert {"R02", "R05", "R07"} <= rule_ids(alerts)
    parasite = next(alert for alert in alerts if alert["rule_id"] == "R07")
    assert parasite["severity"] == "HIGH"
    assert parasite["due_date"] == "2026-09-01"
    assert any(alert["rule_id"] == "R05" and alert["severity"] == "HIGH" for alert in alerts)


def test_documented_alert_counts_per_patient() -> None:
    expected = {
        "kira": {"CRITICAL": 1, "HIGH": 3, "MEDIUM": 1, "LOW": 1, "INFO": 1},
        "bruno": {"CRITICAL": 0, "HIGH": 2, "MEDIUM": 3, "LOW": 1, "INFO": 1},
        "luna": {"CRITICAL": 0, "HIGH": 2, "MEDIUM": 4, "LOW": 1, "INFO": 1},
    }
    counts = {name: severity_counts(build_alerts(load_record(name))) for name in expected}
    assert counts == expected
    assert sum(sum(counts[name].values()) for name in expected) == 22


def test_alert_payload_shape_and_evidence() -> None:
    for name in ("kira", "bruno", "luna"):
        for alert in build_alerts(load_record(name)):
            assert alert["_type"] == "Alert"
            assert alert["patient_id"]
            assert alert["rule_id"] in {f"R{index:02d}" for index in range(1, 12)}
            assert alert["severity"] in SEVERITIES
            assert alert["category"]
            assert alert["code"]
            assert alert["title"] and alert["message"] and alert["action"]
            assert isinstance(alert["confidence"], float)
            assert alert["generated_at"]
            assert alert["evidence"]
            for evidence in alert["evidence"]:
                assert evidence["entity"]
                assert evidence["id"]
                assert evidence["source_system"]
                assert evidence["source_ref"]


def test_ids_are_unique_deterministic_and_prefixed() -> None:
    for name in ("kira", "bruno", "luna"):
        alerts = build_alerts(load_record(name))
        ids = [alert["id"] for alert in alerts]
        assert len(ids) == len(set(ids))
        assert all(ALERT_ID_PATTERN.match(alert_id) for alert_id in ids)
        assert all(alert_id.startswith(f"alr_{name}_") for alert_id in ids)


def test_two_calls_return_identical_alerts() -> None:
    for name in ("kira", "bruno", "luna"):
        record = load_record(name)
        assert build_alerts(record) == build_alerts(record)


def test_alerts_are_ordered_by_severity_then_due_date() -> None:
    for name in ("kira", "bruno", "luna"):
        alerts = build_alerts(load_record(name))
        keys = [
            (SEVERITIES.index(alert["severity"]), alert["due_date"] or "9999-12-31", alert["id"]) for alert in alerts
        ]
        assert keys == sorted(keys)


def test_as_of_override_sets_generated_at() -> None:
    alerts = build_alerts(load_record("kira"), as_of="2026-12-01")
    assert alerts
    assert {alert["generated_at"] for alert in alerts} == {"2026-12-01"}


def test_minimal_record_does_not_raise() -> None:
    minimal = {
        "patient": {"id": "pat_min", "name": "Nala"},
        "source": {"system": "origen", "format": "CSV"},
    }
    alerts = build_alerts(minimal)
    assert isinstance(alerts, list)
    assert all(alert["evidence"] for alert in alerts)
    assert isinstance(build_alerts({}), list)

