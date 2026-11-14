"""Briefing determinista (sin LLM) calculado a partir del registro canónico.

- `build_briefing`: briefing completo (headline, contadores, acciones prioritarias,
  frescura del dato y lagunas de datos). Máximo 7 alertas en el render.
- `build_public_summary`: resumen NO identificativo para la derivación antes de
  aceptar (misma función, filtrada: sin PII del tutor, sin microchip ni documentos).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")
SEVERITY_LABEL = {
    "CRITICAL": "crítica",
    "HIGH": "alta",
    "MEDIUM": "media",
    "LOW": "baja",
    "INFO": "informativa",
}
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


def _age_label(birth: Optional[str], today: date) -> str:
    b = _parse_date(birth)
    if not b:
        return "edad no consta"
    months = (today.year - b.year) * 12 + (today.month - b.month)
    if today.day < b.day:
        months -= 1
    months = max(months, 0)
    years, rem = divmod(months, 12)
    if years and rem:
        return f"{years}a {rem}m"
    if years:
        return f"{years}a"
    return f"{rem}m"


def _severity_rank(sev: str) -> int:
    try:
        return SEVERITY_ORDER.index(str(sev).upper())
    except ValueError:
        return len(SEVERITY_ORDER)


def _sort_alerts(alerts: list[dict]) -> list[dict]:
    return sorted(alerts, key=lambda a: (_severity_rank(a.get("severity", "INFO")), a.get("title", "")))


def data_freshness_days(canonical: dict, today: Optional[date] = None) -> int:
    today = today or date.today()
    source = canonical.get("source") or {}
    reference = _parse_date(source.get("source_as_of")) or _parse_date(canonical.get("as_of"))
    if not reference:
        return 0
    return max((today - reference).days, 0)


def _data_gaps(canonical: dict) -> list[str]:
    gaps: list[str] = []
    patient = canonical.get("patient") or {}
    identity = canonical.get("identity") or {}
    review = canonical.get("review") or {}

    if not patient.get("microchip"):
        gaps.append("microchip ausente")
    elif "X" in str(patient.get("microchip")):
        gaps.append("microchip enmascarado en el origen")
    if not _parse_date(patient.get("birth_date")):
        gaps.append("fecha de nacimiento no fiable")
    confidence = identity.get("identity_confidence")
    if isinstance(confidence, (int, float)) and confidence < 0.85:
        gaps.append(f"identidad con confianza {confidence:.2f}")
    if not patient.get("breed_label"):
        gaps.append("raza no informada")
    if (canonical.get("source") or {}).get("format") == "DOCX":
        gaps.append("origen Word: sin verificación de campos críticos")
    for item in (review.get("critical_fields") or [])[:2]:
        field = item.get("field") if isinstance(item, dict) else None
        if field:
            gaps.append(f"revisión humana pendiente: {field}")
    return gaps[:5]


def _patient_label(canonical: dict, today: date) -> str:
    patient = canonical.get("patient") or {}
    name = patient.get("name") or "Paciente"
    breed = patient.get("breed_label") or "raza no consta"
    sex = SEX_LABEL.get(str(patient.get("sex") or "UNKNOWN").upper(), "sexo no consta")
    neutered = patient.get("neutered")
    if neutered is True and sex in {"hembra", "macho"}:
        sex_label = f"{sex} {'esterilizada' if sex == 'hembra' else 'esterilizado'}"
    elif neutered is False and sex in {"hembra", "macho"}:
        sex_label = "hembra entera" if sex == "hembra" else "macho entero"
    else:
        sex_label = sex
    return f"{name} · {breed} · {_age_label(patient.get('birth_date'), today)} · {sex_label}"


def alert_counts(alerts: list[dict]) -> dict[str, int]:
    counts = {sev: 0 for sev in SEVERITY_ORDER}
    for alert in alerts:
        sev = str(alert.get("severity", "INFO")).upper()
        if sev not in counts:
            sev = "INFO"
        counts[sev] += 1
    return counts


def _headline(label: str, counts: dict[str, int]) -> str:
    total = sum(counts.values())
    if total == 0:
        return f"{label} — sin alertas activas"
    parts: list[str] = []
    for sev in SEVERITY_ORDER:
        n = counts[sev]
        if not n:
            continue
        singular, plural_word = SEVERITY_LABEL_PLURAL[sev]
        parts.append(f"{n} {singular if n == 1 else plural_word}")
    plural = "alerta" if total == 1 else "alertas"
    return f"{label} — {total} {plural} ({', '.join(parts)})"


def build_briefing(canonical: dict, today: Optional[date] = None) -> dict[str, Any]:
    """Briefing completo y determinista a partir del registro canónico."""
    today = today or date.today()
    alerts = list(canonical.get("alerts") or [])
    sorted_alerts = _sort_alerts(alerts)
    counts = alert_counts(alerts)
    label = _patient_label(canonical, today)

    priority_actions = [
        {
            "severity": str(a.get("severity", "INFO")).upper(),
            "title": a.get("title") or "",
            "action": a.get("action") or a.get("message") or "",
        }
        for a in sorted_alerts[:MAX_PRIORITY_ACTIONS]
    ]

    shown = [
        {
            "id": a.get("id"),
            "severity": str(a.get("severity", "INFO")).upper(),
            "category": a.get("category"),
            "title": a.get("title") or "",
            "message": a.get("message") or "",
            "action": a.get("action"),
        }
        for a in sorted_alerts[:MAX_ALERTS_RENDERED]
    ]

    return {
        "headline": _headline(label, counts),
        "patient_label": label,
        "alert_counts": counts,
        "priority_actions": priority_actions,
        "data_freshness_days": data_freshness_days(canonical, today),
        "data_gaps": _data_gaps(canonical),
        "alerts_rendered": shown,
        "alerts_total": len(alerts),
    }


def build_patient_public(canonical: dict, today: Optional[date] = None) -> dict[str, Any]:
    """Ficha no identificativa del paciente (sin tutor, sin microchip, sin docs)."""
    today = today or date.today()
    patient = canonical.get("patient") or {}
    sex = str(patient.get("sex") or "UNKNOWN").upper()
    return {
        "species": patient.get("species_label") or patient.get("species_code") or "no consta",
        "species_code": patient.get("species_code"),
        "breed": patient.get("breed_label") or "no consta",
        "age": _age_label(patient.get("birth_date"), today),
        "sex": SEX_LABEL.get(sex, "no consta"),
        "neutered": patient.get("neutered"),
        "weight_kg": patient.get("weight_current_kg"),
        "bcs": patient.get("bcs"),
        "bcs_scale": patient.get("bcs_scale"),
        "chronic_conditions": [
            p.get("label")
            for p in (canonical.get("problems") or [])
            if isinstance(p, dict) and str(p.get("status", "")).upper() in {"ACTIVE", "CHRONIC"}
        ][:4],
    }


def build_public_summary(canonical: dict, *, motivo: str, urgencia: str) -> dict[str, Any]:
    """Resumen previo a la aceptación: útil clínicamente, no identificativo."""
    today = date.today()
    briefing = build_briefing(canonical, today)
    alerts = _sort_alerts(list(canonical.get("alerts") or []))
    return {
        "patient": build_patient_public(canonical, today),
        "headline": briefing["headline"],
        "alert_counts": briefing["alert_counts"],
        "priority_actions": briefing["priority_actions"],
        "alerts": [
            {
                "severity": str(a.get("severity", "INFO")).upper(),
                "category": a.get("category"),
                "title": a.get("title") or "",
            }
            for a in alerts[:MAX_SUMMARY_ALERTS]
        ],
        "alerts_total": len(alerts),
        "motivo": motivo,
        "urgencia": urgencia,
        "data_freshness_days": briefing["data_freshness_days"],
        "data_gaps": briefing["data_gaps"],
        "privacy": {
            "level": "NON_IDENTIFYING",
            "excluded": ["datos del tutor", "microchip completo", "documentos", "facturas", "contacto"],
            "note": "Resumen clínico sin datos identificativos. La historia completa se desbloquea al aceptar la derivación.",
        },
    }
