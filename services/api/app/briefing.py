from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")
SEVERITY_LABEL_PLURAL = {
    "CRITICAL": ("crítica", "críticas"),
    "HIGH": ("alta", "altas"),
    "MEDIUM": ("media", "medias"),
    "LOW": ("baja", "bajas"),
    "INFO": ("informativa", "informativas"),
}
MAX_ALERTS_RENDERED = 7
MAX_PRIORITY_ACTIONS = 3
MAX_SUMMARY_ALERTS = 3

SEX_LABEL = {"MALE": "macho", "FEMALE": "hembra", "UNKNOWN": "sexo no consta"}


def _parse_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw)[:10]).date()
    except ValueError:
        return None


def _months_between(birth: date, today: date) -> int:
    months = (today.year - birth.year) * 12 + (today.month - birth.month)
    if today.day < birth.day:
        months -= 1
    return max(months, 0)


def _format_age(years: int, remainder: int) -> str:
    if years and remainder:
        return f"{years}a {remainder}m"
    if years:
        return f"{years}a"
    return f"{remainder}m"


def _age_label(birth: Optional[str], today: date) -> str:
    start = _parse_date(birth)
    if not start:
        return "edad no consta"
    years, remainder = divmod(_months_between(start, today), 12)
    return _format_age(years, remainder)


def _severity_rank(severity: str) -> int:
    try:
        return SEVERITY_ORDER.index(str(severity).upper())
    except ValueError:
        return len(SEVERITY_ORDER)


def _alert_sort_key(alert: dict) -> tuple[int, str]:
    return _severity_rank(alert.get("severity", "INFO")), alert.get("title", "")


def _sort_alerts(alerts: list[dict]) -> list[dict]:
    return sorted(alerts, key=_alert_sort_key)


def data_freshness_days(canonical: dict, today: Optional[date] = None) -> int:
    current = today or date.today()
    source = canonical.get("source") or {}
    reference = _parse_date(source.get("source_as_of")) or _parse_date(canonical.get("as_of"))
    if not reference:
        return 0
    return max((current - reference).days, 0)


def _microchip_gaps(patient: dict) -> list[str]:
    microchip = patient.get("microchip")
    if not microchip:
        return ["microchip ausente"]
    if "X" in str(microchip):
        return ["microchip enmascarado en el origen"]
    return []


def _identity_gaps(patient: dict, identity: dict) -> list[str]:
    gaps: list[str] = []
    if not _parse_date(patient.get("birth_date")):
        gaps.append("fecha de nacimiento no fiable")
    confidence = identity.get("identity_confidence")
    if isinstance(confidence, (int, float)) and confidence < 0.85:
        gaps.append(f"identidad con confianza {confidence:.2f}")
    return gaps


def _history_gaps(canonical: dict, patient: dict, review: dict) -> list[str]:
    gaps: list[str] = []
    if not patient.get("breed_label"):
        gaps.append("raza no informada")
    if (canonical.get("source") or {}).get("format") == "DOCX":
        gaps.append("origen Word: sin verificación de campos críticos")
    for item in (review.get("critical_fields") or [])[:2]:
        field = item.get("field") if isinstance(item, dict) else None
        if field:
            gaps.append(f"revisión humana pendiente: {field}")
    return gaps


def _data_gaps(canonical: dict) -> list[str]:
    patient = canonical.get("patient") or {}
    identity = canonical.get("identity") or {}
    review = canonical.get("review") or {}
    gaps = (
        _microchip_gaps(patient)
        + _identity_gaps(patient, identity)
        + _history_gaps(canonical, patient, review)
    )
    return gaps[:5]


def _sex_label(sex: str, neutered: Any) -> str:
    if sex not in {"hembra", "macho"}:
        return sex
    if neutered is True:
        return f"{sex} {'esterilizada' if sex == 'hembra' else 'esterilizado'}"
    if neutered is False:
        return "hembra entera" if sex == "hembra" else "macho entero"
    return sex


def _patient_label(canonical: dict, today: date) -> str:
    patient = canonical.get("patient") or {}
    name = patient.get("name") or "Paciente"
    breed = patient.get("breed_label") or "raza no consta"
    sex = SEX_LABEL.get(str(patient.get("sex") or "UNKNOWN").upper(), "sexo no consta")
    age = _age_label(patient.get("birth_date"), today)
    sex_label = _sex_label(sex, patient.get("neutered"))
    return f"{name} · {breed} · {age} · {sex_label}"


def _counted_severity(raw: Any) -> str:
    severity = str(raw).upper()
    if severity not in SEVERITY_ORDER:
        return "INFO"
    return severity


def alert_counts(alerts: list[dict]) -> dict[str, int]:
    counts = {severity: 0 for severity in SEVERITY_ORDER}
    for alert in alerts:
        counts[_counted_severity(alert.get("severity", "INFO"))] += 1
    return counts


def _severity_parts(counts: dict[str, int]) -> list[str]:
    parts: list[str] = []
    for severity in SEVERITY_ORDER:
        count = counts[severity]
        if not count:
            continue
        singular, plural = SEVERITY_LABEL_PLURAL[severity]
        parts.append(f"{count} {singular if count == 1 else plural}")
    return parts


def _headline(label: str, counts: dict[str, int]) -> str:
    total = sum(counts.values())
    if total == 0:
        return f"{label} — sin alertas activas"
    noun = "alerta" if total == 1 else "alertas"
    return f"{label} — {total} {noun} ({', '.join(_severity_parts(counts))})"


def _priority_actions(alerts: list[dict]) -> list[dict]:
    return [
        {
            "severity": str(alert.get("severity", "INFO")).upper(),
            "title": alert.get("title") or "",
            "action": alert.get("action") or alert.get("message") or "",
        }
        for alert in alerts[:MAX_PRIORITY_ACTIONS]
    ]


def _rendered_alerts(alerts: list[dict]) -> list[dict]:
    return [
        {
            "id": alert.get("id"),
            "severity": str(alert.get("severity", "INFO")).upper(),
            "category": alert.get("category"),
            "title": alert.get("title") or "",
            "message": alert.get("message") or "",
            "action": alert.get("action"),
        }
        for alert in alerts[:MAX_ALERTS_RENDERED]
    ]


def build_briefing(canonical: dict, today: Optional[date] = None) -> dict[str, Any]:
    current = today or date.today()
    alerts = list(canonical.get("alerts") or [])
    ordered = _sort_alerts(alerts)
    counts = alert_counts(alerts)
    label = _patient_label(canonical, current)
    return {
        "headline": _headline(label, counts),
        "patient_label": label,
        "alert_counts": counts,
        "priority_actions": _priority_actions(ordered),
        "data_freshness_days": data_freshness_days(canonical, current),
        "data_gaps": _data_gaps(canonical),
        "alerts_rendered": _rendered_alerts(ordered),
        "alerts_total": len(alerts),
    }


def _is_chronic(problem: Any) -> bool:
    if not isinstance(problem, dict):
        return False
    return str(problem.get("status", "")).upper() in {"ACTIVE", "CHRONIC"}


def _chronic_conditions(canonical: dict) -> list:
    problems = canonical.get("problems") or []
    return [problem.get("label") for problem in problems if _is_chronic(problem)][:4]


def build_patient_public(canonical: dict, today: Optional[date] = None) -> dict[str, Any]:
    current = today or date.today()
    patient = canonical.get("patient") or {}
    sex = str(patient.get("sex") or "UNKNOWN").upper()
    return {
        "species": patient.get("species_label") or patient.get("species_code") or "no consta",
        "species_code": patient.get("species_code"),
        "breed": patient.get("breed_label") or "no consta",
        "age": _age_label(patient.get("birth_date"), current),
        "sex": SEX_LABEL.get(sex, "no consta"),
        "neutered": patient.get("neutered"),
        "weight_kg": patient.get("weight_current_kg"),
        "bcs": patient.get("bcs"),
        "bcs_scale": patient.get("bcs_scale"),
        "chronic_conditions": _chronic_conditions(canonical),
    }


def _summary_alerts(alerts: list[dict]) -> list[dict]:
    return [
        {
            "severity": str(alert.get("severity", "INFO")).upper(),
            "category": alert.get("category"),
            "title": alert.get("title") or "",
        }
        for alert in alerts[:MAX_SUMMARY_ALERTS]
    ]


def build_public_summary(canonical: dict, *, motivo: str, urgencia: str) -> dict[str, Any]:
    today = date.today()
    briefing = build_briefing(canonical, today)
    alerts = _sort_alerts(list(canonical.get("alerts") or []))
    return {
        "patient": build_patient_public(canonical, today),
        "headline": briefing["headline"],
        "alert_counts": briefing["alert_counts"],
        "priority_actions": briefing["priority_actions"],
        "alerts": _summary_alerts(alerts),
        "alerts_total": len(alerts),
        "motivo": motivo,
        "urgencia": urgencia,
        "data_freshness_days": briefing["data_freshness_days"],
        "data_gaps": briefing["data_gaps"],
        "privacy": {
            "level": "NON_IDENTIFYING",
            "excluded": ["datos del tutor", "microchip completo", "documentos", "facturas", "contacto"],
            "note": (
                "Resumen clínico sin datos identificativos. La historia completa se "
                "desbloquea al aceptar la derivación."
            ),
        },
    }
