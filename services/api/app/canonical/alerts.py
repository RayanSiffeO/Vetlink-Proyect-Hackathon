from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime

SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")
SEVERITY_RANK = {severity: index for index, severity in enumerate(SEVERITY_ORDER)}
NO_DUE_DATE = "9999-12-31"
RULES_ENGINE = "VetLink rules engine"

OPEN_REMINDER_STATUSES = frozenset({"PENDING", "DUE", "OVERDUE"})
ALLERGY_CATEGORIES = frozenset({"ALLERGY", "ADVERSE_REACTION"})
EXCLUDED_PROBLEM_CATEGORIES = frozenset({"NUTRITION"})
RISK_FLAG_SEVERITIES = frozenset({"INFO", "LOW", "MEDIUM"})

APPOINTMENT_WINDOW_DAYS = 7
MEDICATION_WINDOW_DAYS = 2
MEDICATION_GRACE_DAYS = 30
NSAID_WINDOW_DAYS = 30
PARASITE_HIGH_DAYS = 14
VACCINE_MEDIUM_DAYS = 30
VACCINE_INFO_DAYS = 90
WEIGHT_WINDOW_DAYS = 365
WEIGHT_CHANGE_PERCENT = 10.0
FRESHNESS_DAYS = 7
IDENTITY_CONFIDENCE_MIN = 0.8
BCS_OVERWEIGHT = 6
BCS_UNDERWEIGHT = 3

CERTAINTY_CONFIDENCE = {"CONFIRMED": 0.95, "SUSPECTED": 0.9, "REPORTED": 0.85}
DEFAULT_CONFIDENCE = 0.85
REACTION_LABELS = {"ADVERSE_REACTION": "Reacción adversa", "ALLERGY": "Alergia"}
PARASITE_LABELS = {"ENDO": "Desparasitación interna", "ECTO": "Desparasitación externa"}
NSAID_TERMS = (
    "meloxicam",
    "carprofeno",
    "firocoxib",
    "robenacoxib",
    "ketoprofeno",
    "deracoxib",
    "tolfenamico",
    "tolfenámico",
    "piroxicam",
    "aine",
)


@dataclass(frozen=True)
class _Context:
    canonical: dict
    patient: dict
    patient_id: str
    slug: str
    reference: date | None
    generated_at: str
    source_system: str
    fallback_ref: str


@dataclass(frozen=True)
class _AlertSpec:
    rule_id: str
    code: str
    severity: str
    category: str
    title: str
    message: str
    action: str
    evidence: list[dict]
    confidence: float
    due_date: str | None = None


def _slugify(value: object) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text.lower()).strip("_")
    return slug or "patient"


def _patient_id(canonical: dict, patient: dict) -> str:
    return str(patient.get("id") or canonical.get("record_id") or "")


def _canonical_source(canonical: dict) -> dict:
    return canonical.get("source") or {}


def _generated_at(canonical: dict, as_of: str | None) -> str:
    source = _canonical_source(canonical)
    candidates = (
        as_of,
        canonical.get("as_of"),
        source.get("source_as_of"),
        source.get("generated_at"),
        canonical.get("generated_at"),
    )
    for candidate in candidates:
        if candidate:
            return str(candidate)
    return ""


def _parse_date(raw: object) -> date | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw)[:10]).date()
    except ValueError:
        return None


def _format_date(raw: object) -> str:
    parsed = _parse_date(raw)
    if parsed is None:
        return "fecha no informada"
    return f"{parsed.day:02d}/{parsed.month:02d}/{parsed.year}"


def _format_number(value: object) -> str:
    return str(value).replace(".", ",")


def _days_until(raw: object, reference: date | None) -> int | None:
    target = _parse_date(raw)
    if target is None or reference is None:
        return None
    return (target - reference).days


def _context(canonical: dict, as_of: str | None) -> _Context:
    patient = canonical.get("patient") or {}
    patient_id = _patient_id(canonical, patient)
    generated_at = _generated_at(canonical, as_of)
    source = _canonical_source(canonical)
    return _Context(
        canonical=canonical,
        patient=patient,
        patient_id=patient_id,
        slug=_slugify(patient.get("name") or patient_id),
        reference=_parse_date(generated_at),
        generated_at=generated_at,
        source_system=str(source.get("system") or ""),
        fallback_ref=str(canonical.get("record_id") or source.get("file") or "record"),
    )


def _entity_meta(item: dict) -> dict:
    return item.get("_meta") or {}


def _evidence(ctx: _Context, entity: str, item: dict) -> dict:
    meta = _entity_meta(item)
    return {
        "entity": entity,
        "id": str(item.get("id") or ""),
        "source_system": str(meta.get("source_system") or ctx.source_system),
        "source_ref": str(meta.get("source_ref") or ctx.fallback_ref),
    }


def _flag_evidence(ctx: _Context, index: int) -> dict:
    meta = _entity_meta(ctx.patient)
    base = str(meta.get("source_ref") or ctx.fallback_ref)
    return {
        "entity": "Patient",
        "id": ctx.patient_id,
        "source_system": str(meta.get("source_system") or ctx.source_system),
        "source_ref": f"{base}/flags/{index}",
    }


def _alert_meta(ctx: _Context, spec: _AlertSpec) -> dict:
    return {
        "source_system": RULES_ENGINE,
        "source_format": "DERIVED",
        "source_ref": f"rules/{spec.rule_id}",
        "method": "derived",
        "confidence": spec.confidence,
        "extracted_at": ctx.generated_at,
    }


def _alert(ctx: _Context, spec: _AlertSpec, index: int) -> dict:
    return {
        "_type": "Alert",
        "id": f"alr_{ctx.slug}_{spec.rule_id}_{index}",
        "patient_id": ctx.patient_id,
        "code": spec.code,
        "rule_id": spec.rule_id,
        "severity": spec.severity,
        "category": spec.category,
        "title": spec.title,
        "message": spec.message,
        "evidence": spec.evidence,
        "action": spec.action,
        "due_date": spec.due_date,
        "confidence": spec.confidence,
        "generated_at": ctx.generated_at,
        "_meta": _alert_meta(ctx, spec),
    }


def _severity_rank(severity: object) -> int:
    return SEVERITY_RANK.get(str(severity or "").upper(), len(SEVERITY_ORDER))


def _sort_key(alert: dict) -> tuple[int, str, str]:
    return (
        _severity_rank(alert.get("severity")),
        str(alert.get("due_date") or NO_DUE_DATE),
        str(alert.get("id") or ""),
    )


def _ordered(alerts: list[dict]) -> list[dict]:
    return sorted(alerts, key=_sort_key)


def _item_severity(item: dict) -> str:
    return str(item.get("severity") or "").upper()


def _status_of(item: dict) -> str:
    return str(item.get("status") or "").upper()


def _category_of(item: dict) -> str:
    return str(item.get("category") or "").upper()


def _type_of(item: dict) -> str:
    return str(item.get("type") or "").upper()


def _is_active_problem(problem: dict) -> bool:
    return _status_of(problem) == "ACTIVE"


def _active_problems(canonical: dict) -> list[dict]:
    problems = canonical.get("problems") or []
    return [problem for problem in problems if _is_active_problem(problem)]


def _is_allergy_problem(problem: dict) -> bool:
    return _category_of(problem) in ALLERGY_CATEGORIES


def _is_high_flag(flag: dict) -> bool:
    return _item_severity(flag) in {"HIGH", "CRITICAL"}


def _allergy_evidence(ctx: _Context, problem: dict) -> list[dict]:
    evidence = [_evidence(ctx, "Problem", problem)]
    flags = [(index, flag) for index, flag in enumerate(ctx.patient.get("flags") or []) if _is_high_flag(flag)]
    if not flags:
        return evidence
    return evidence + [_flag_evidence(ctx, flags[0][0])]


def _allergy_message(problem: dict) -> str:
    label = REACTION_LABELS.get(_category_of(problem), "Alergia")
    parts = [f"{label} activa desde {_format_date(problem.get('onset_date'))}."]
    notes = problem.get("notes")
    if notes:
        parts.append(str(notes))
    return " ".join(parts)


def _allergy_problem_spec(ctx: _Context, problem: dict) -> _AlertSpec:
    category = _category_of(problem)
    return _AlertSpec(
        rule_id="R01",
        code="ALLERGY_ACTIVE",
        severity="CRITICAL" if category == "ADVERSE_REACTION" else "HIGH",
        category="ALLERGY",
        title=str(problem.get("label") or "Alergia o efecto adverso activo"),
        message=_allergy_message(problem),
        action="Registrar la alergia como campo crítico y comprobar la medicación antes de prescribir.",
        evidence=_allergy_evidence(ctx, problem),
        confidence=0.98,
    )


def _allergy_flag_spec(ctx: _Context, index: int, flag: dict) -> _AlertSpec:
    text = str(flag.get("text") or "Aviso de riesgo activo")
    return _AlertSpec(
        rule_id="R01",
        code="ALLERGY_ACTIVE",
        severity="HIGH",
        category="ALLERGY",
        title=text,
        message=f"Aviso de riesgo registrado el {_format_date(flag.get('since'))}: {text}",
        action="Comprobar el alérgeno y la medicación antes de prescribir.",
        evidence=[_flag_evidence(ctx, index)],
        confidence=0.9,
    )


def _rule_r01(ctx: _Context) -> list[dict]:
    problems = [problem for problem in _active_problems(ctx.canonical) if _is_allergy_problem(problem)]
    if problems:
        return [_alert(ctx, _allergy_problem_spec(ctx, problem), index) for index, problem in enumerate(problems, 1)]
    flags = [(index, flag) for index, flag in enumerate(ctx.patient.get("flags") or []) if _is_high_flag(flag)]
    return [_alert(ctx, _allergy_flag_spec(ctx, index, flag), order) for order, (index, flag) in enumerate(flags, 1)]


def _is_general_problem(problem: dict) -> bool:
    return not _is_allergy_problem(problem) and _category_of(problem) not in EXCLUDED_PROBLEM_CATEGORIES


def _problem_message(problem: dict) -> str:
    parts = [f"Problema activo: {problem.get('label') or 'sin etiqueta'}."]
    if problem.get("onset_date"):
        parts.append(f"Inicio {_format_date(problem.get('onset_date'))}.")
    if problem.get("notes"):
        parts.append(str(problem.get("notes")))
    return " ".join(parts)


def _problem_severity(problem: dict) -> str:
    if _item_severity(problem) == "MILD" and str(problem.get("certainty") or "").upper() == "REPORTED":
        return "LOW"
    return "MEDIUM"


def _problem_confidence(problem: dict) -> float:
    certainty = str(problem.get("certainty") or "").upper()
    return CERTAINTY_CONFIDENCE.get(certainty, DEFAULT_CONFIDENCE)


def _problem_spec(ctx: _Context, problem: dict) -> _AlertSpec:
    return _AlertSpec(
        rule_id="R02",
        code="ACTIVE_PROBLEM",
        severity=_problem_severity(problem),
        category="PROBLEM",
        title=str(problem.get("label") or "Problema activo"),
        message=_problem_message(problem),
        action="Explorar el problema en la visita y registrar la evolución.",
        evidence=[_evidence(ctx, "Problem", problem)],
        confidence=_problem_confidence(problem),
    )


def _rule_r02(ctx: _Context) -> list[dict]:
    problems = [problem for problem in _active_problems(ctx.canonical) if _is_general_problem(problem)]
    return [_alert(ctx, _problem_spec(ctx, problem), index) for index, problem in enumerate(problems, 1)]


def _prescription_label(prescription: dict) -> str:
    label = prescription.get("drug_name") or prescription.get("drug_name_raw")
    return str(label or "Medicación sin nombre")


def _date_range(started_on: object, ends_on: object) -> str:
    if started_on and ends_on:
        return f"del {_format_date(started_on)} al {_format_date(ends_on)}"
    if started_on:
        return f"desde {_format_date(started_on)}"
    if ends_on:
        return f"hasta {_format_date(ends_on)}"
    return "sin fechas registradas"


def _day_phrase(days: int | None) -> str:
    if days is None:
        return "sin fecha de fin"
    if days < 0:
        return f"vencida hace {-days} días"
    if days == 0:
        return "última dosis hoy"
    return f"en {days} días"


def _remaining_label(days: int | None) -> str:
    if days is None:
        return "Duración no informada."
    return f"Fin de pauta: {_day_phrase(days)}."


def _ending_message(prescription: dict, days: int | None) -> str:
    label = _prescription_label(prescription)
    dose = prescription.get("dose_text")
    header = f"Pauta activa de {label}" + (f" ({dose})" if dose else "")
    dates = _date_range(prescription.get("started_on"), prescription.get("ends_on"))
    return f"{header} {dates}. {_remaining_label(days)}"


def _ending_severity(days: int | None) -> str:
    if days is None:
        return "MEDIUM"
    if days <= 0:
        return "HIGH"
    return "MEDIUM"


def _medication_spec(ctx: _Context, prescription: dict) -> _AlertSpec:
    days = _days_until(prescription.get("ends_on"), ctx.reference)
    severity = _ending_severity(days)
    label = _prescription_label(prescription)
    return _AlertSpec(
        rule_id="R03",
        code="ACTIVE_MEDICATION_ENDING" if days is not None and days <= 0 else "ACTIVE_MEDICATION",
        severity=severity,
        category="MEDICATION",
        title=f"{label}: {_day_phrase(days)}",
        message=_ending_message(prescription, days),
        action="Confirmar cumplimiento y no prorrogar sin valorar la evolución.",
        evidence=[_evidence(ctx, "Prescription", prescription)],
        confidence=0.95 if severity == "HIGH" else 0.9,
        due_date=str(prescription.get("ends_on")) if prescription.get("ends_on") else None,
    )


def _is_open_prescription(prescription: dict) -> bool:
    return _status_of(prescription) == "ACTIVE"


def _ends_soon(prescription: dict, reference: date | None) -> bool:
    days = _days_until(prescription.get("ends_on"), reference)
    if days is None:
        return not prescription.get("ends_on")
    return -MEDICATION_GRACE_DAYS <= days <= MEDICATION_WINDOW_DAYS


def _rule_r03(ctx: _Context) -> list[dict]:
    prescriptions = [
        item
        for item in ctx.canonical.get("prescriptions") or []
        if _is_open_prescription(item) and _ends_soon(item, ctx.reference)
    ]
    return [_alert(ctx, _medication_spec(ctx, item), index) for index, item in enumerate(prescriptions, 1)]


def _is_nsaid(prescription: dict) -> bool:
    haystack = f"{prescription.get('drug_name') or ''} {prescription.get('drug_name_raw') or ''}".lower()
    return any(term in haystack for term in NSAID_TERMS)


def _is_recent_nsaid(prescription: dict, reference: date | None) -> bool:
    if reference is None or _is_open_prescription(prescription) or not _is_nsaid(prescription):
        return False
    ended = _parse_date(prescription.get("ends_on"))
    if ended is None:
        return False
    days = (reference - ended).days
    return 0 <= days <= NSAID_WINDOW_DAYS


def _nsaid_title(label: str, days: int) -> str:
    if days == 0:
        return f"{label} finalizado hoy"
    return f"{label} finalizado hace {days} días"


def _nsaid_message(prescription: dict, days: int) -> str:
    label = _prescription_label(prescription)
    duration = prescription.get("duration_days")
    duration_text = f" durante {duration} días" if duration else ""
    ended = _format_date(prescription.get("ends_on"))
    return f"Antiinflamatorio (AINE) {label}{duration_text}, terminado el {ended} (hace {days} días)."


def _nsaid_spec(ctx: _Context, prescription: dict) -> _AlertSpec:
    ended = _parse_date(prescription.get("ends_on"))
    days = (ctx.reference - ended).days if ended is not None and ctx.reference else 0
    label = _prescription_label(prescription)
    return _AlertSpec(
        rule_id="R04",
        code="NSAID_RECENT",
        severity="INFO",
        category="MEDICATION",
        title=_nsaid_title(label, days),
        message=_nsaid_message(prescription, days),
        action="Confirmar que no hay AINE activo antes de pautar uno nuevo.",
        evidence=[_evidence(ctx, "Prescription", prescription)],
        confidence=0.9,
    )


def _rule_r04(ctx: _Context) -> list[dict]:
    prescriptions = [item for item in ctx.canonical.get("prescriptions") or [] if _is_recent_nsaid(item, ctx.reference)]
    return [_alert(ctx, _nsaid_spec(ctx, item), index) for index, item in enumerate(prescriptions, 1)]


def _is_appointment_reminder(reminder: dict, reference: date | None) -> bool:
    if _type_of(reminder) == "PARASITE" or _status_of(reminder) not in OPEN_REMINDER_STATUSES:
        return False
    days = _days_until(reminder.get("due"), reference)
    return days is not None and days <= APPOINTMENT_WINDOW_DAYS


def _find_encounter(canonical: dict, encounter_ref: object) -> dict | None:
    if not encounter_ref:
        return None
    matches = [item for item in canonical.get("encounters") or [] if item.get("id") == encounter_ref]
    return matches[0] if matches else None


def _appointment_evidence(ctx: _Context, reminder: dict) -> list[dict]:
    evidence = [_evidence(ctx, "Reminder", reminder)]
    encounter = _find_encounter(ctx.canonical, reminder.get("origin_encounter_ref"))
    if encounter is None:
        return evidence
    return evidence + [_evidence(ctx, "Encounter", encounter)]


def _appointment_code(days: int) -> str:
    if days < 0:
        return "APPOINTMENT_OVERDUE"
    if days == 0:
        return "APPOINTMENT_DUE"
    return "APPOINTMENT_SOON"


def _appointment_relative(days: int) -> str:
    if days < -1:
        return f"vencida hace {-days} días."
    if days == -1:
        return "vencida ayer."
    if days == 0:
        return "vence hoy."
    if days == 1:
        return "dentro de 1 día."
    return f"dentro de {days} días."


def _appointment_title(text: str, days: int) -> str:
    if days < -1:
        return f"{text}: vencida hace {-days} días"
    if days == -1:
        return f"{text}: vencida ayer"
    if days == 0:
        return f"{text}: hoy"
    if days == 1:
        return f"{text}: en 1 día"
    return f"{text}: en {days} días"


def _appointment_spec(ctx: _Context, reminder: dict) -> _AlertSpec:
    days = _days_until(reminder.get("due"), ctx.reference)
    if days is None:
        days = 0
    text = str(reminder.get("text") or "Cita pendiente")
    due = str(reminder.get("due"))
    return _AlertSpec(
        rule_id="R05",
        code=_appointment_code(days),
        severity="HIGH" if days <= 0 else "MEDIUM",
        category="APPOINTMENT",
        title=_appointment_title(text, days),
        message=f"{text}. Fecha {_format_date(due)}; {_appointment_relative(days)}",
        action="Confirmar la cita o reprogramarla con la clínica.",
        evidence=_appointment_evidence(ctx, reminder),
        confidence=0.95,
        due_date=due,
    )


def _rule_r05(ctx: _Context) -> list[dict]:
    reminders = [item for item in ctx.canonical.get("reminders") or [] if _is_appointment_reminder(item, ctx.reference)]
    return [_alert(ctx, _appointment_spec(ctx, item), index) for index, item in enumerate(reminders, 1)]


def _bcs_text(bcs: int, scale: object) -> str:
    maximum = str(scale or "1-9").rsplit("-", 1)[-1]
    return f"BCS {bcs}/{maximum}"


def _latest_weight(canonical: dict) -> dict | None:
    weights = [item for item in canonical.get("weights") or [] if item.get("kg") is not None]
    if not weights:
        return None
    return max(weights, key=lambda item: str(item.get("measured_on") or ""))


def _bcs_spec(ctx: _Context) -> _AlertSpec | None:
    bcs = ctx.patient.get("bcs")
    if not isinstance(bcs, int) or BCS_UNDERWEIGHT < bcs < BCS_OVERWEIGHT:
        return None
    scale = ctx.patient.get("bcs_scale")
    label = "Sobrepeso" if bcs >= BCS_OVERWEIGHT else "Bajo peso"
    weight = ctx.patient.get("weight_current_kg")
    weight_text = f"{_format_number(weight)} kg y " if weight is not None else ""
    measured = ctx.patient.get("weight_current_on")
    measured_text = f" el {_format_date(measured)}" if measured else ""
    evidence = [_evidence(ctx, "Patient", ctx.patient)]
    latest = _latest_weight(ctx.canonical)
    if latest is not None:
        evidence.append(_evidence(ctx, "Weight", latest))
    return _AlertSpec(
        rule_id="R06",
        code="WEIGHT_RISK",
        severity="MEDIUM",
        category="WEIGHT",
        title=f"{label} ({_bcs_text(bcs, scale)})",
        message=f"{weight_text}{_bcs_text(bcs, scale)}{measured_text}. Valorar plan nutricional.",
        action="Revisar peso y condición corporal en la visita.",
        evidence=evidence,
        confidence=0.9,
    )


def _weight_window(ctx: _Context) -> list[dict]:
    if ctx.reference is None:
        return []
    points = []
    for item in ctx.canonical.get("weights") or []:
        measured = _parse_date(item.get("measured_on"))
        if measured is None or item.get("kg") is None:
            continue
        if 0 <= (ctx.reference - measured).days <= WEIGHT_WINDOW_DAYS:
            points.append(item)
    return sorted(points, key=lambda item: str(item.get("measured_on") or ""))


def _weight_trend_spec(ctx: _Context) -> _AlertSpec | None:
    points = _weight_window(ctx)
    if len(points) < 2:
        return None
    first, last = points[0], points[-1]
    change = (float(last["kg"]) - float(first["kg"])) / float(first["kg"]) * 100
    if abs(change) < WEIGHT_CHANGE_PERCENT:
        return None
    direction = "Ganancia" if change > 0 else "Pérdida"
    return _AlertSpec(
        rule_id="R06",
        code="WEIGHT_RISK",
        severity="LOW",
        category="WEIGHT",
        title=f"{direction} de peso del {abs(change):.1f}% en 12 meses",
        message=(
            f"Peso de {_format_number(first['kg'])} kg el {_format_date(first.get('measured_on'))} "
            f"y {_format_number(last['kg'])} kg el {_format_date(last.get('measured_on'))}."
        ),
        action="Revisar la tendencia de peso y descartar causa orgánica.",
        evidence=[_evidence(ctx, "Weight", first), _evidence(ctx, "Weight", last)],
        confidence=0.8,
    )


def _rule_r06(ctx: _Context) -> list[dict]:
    candidates = (_bcs_spec(ctx), _weight_trend_spec(ctx))
    specs = [spec for spec in candidates if spec is not None]
    return [_alert(ctx, spec, index) for index, spec in enumerate(specs, 1)]


def _overdue_parasites(canonical: dict, reference: date | None) -> list[tuple[dict, int]]:
    if reference is None:
        return []
    overdue = []
    for item in canonical.get("parasite_control") or []:
        due = _parse_date(item.get("next_due"))
        if due is None:
            continue
        days = (reference - due).days
        if days > 0:
            overdue.append((item, days))
    return overdue


def _parasite_label(items: list[tuple[dict, int]]) -> str:
    types = {_type_of(item) for item, _ in items}
    if "ENDO" in types and "ECTO" in types:
        return "Desparasitación interna y externa"
    if "ENDO" in types:
        return "Desparasitación interna"
    if "ECTO" in types:
        return "Desparasitación externa"
    return "Antiparasitario"


def _parasite_detail(item: dict, days: int) -> str:
    label = PARASITE_LABELS.get(_type_of(item), "Antiparasitario")
    detail = f"{label} con próxima fecha {_format_date(item.get('next_due'))} (vencida {days} días)"
    last_given = item.get("last_given")
    if last_given:
        return f"{detail}; última aplicación {_format_date(last_given)}"
    return detail


def _parasite_message(items: list[tuple[dict, int]], days: int, reference: date | None) -> str:
    details = [_parasite_detail(item, item_days) for item, item_days in items]
    return f"{'; '.join(details)}. Vencida {days} días a {_format_date(reference)}."


def _parasite_evidence(ctx: _Context, items: list[tuple[dict, int]]) -> list[dict]:
    evidence = [_evidence(ctx, "ParasiteControl", item) for item, _ in items]
    reminders = [
        item
        for item in ctx.canonical.get("reminders") or []
        if _type_of(item) == "PARASITE" and _status_of(item) == "OVERDUE"
    ]
    if not reminders:
        return evidence
    return evidence + [_evidence(ctx, "Reminder", reminders[0])]


def _parasite_spec(ctx: _Context, items: list[tuple[dict, int]]) -> _AlertSpec:
    days = max(item_days for _, item_days in items)
    due_date = min(str(item.get("next_due")) for item, _ in items)
    return _AlertSpec(
        rule_id="R07",
        code="PARASITE_OVERDUE",
        severity="HIGH" if days > PARASITE_HIGH_DAYS else "MEDIUM",
        category="PREVENTIVE",
        title=f"{_parasite_label(items)} vencida ({days} días)",
        message=_parasite_message(items, days, ctx.reference),
        action="Actualizar la pauta antiparasitaria y registrar la última dosis administrada.",
        evidence=_parasite_evidence(ctx, items),
        confidence=0.9,
        due_date=due_date,
    )


def _rule_r07(ctx: _Context) -> list[dict]:
    items = _overdue_parasites(ctx.canonical, ctx.reference)
    if not items:
        return []
    return [_alert(ctx, _parasite_spec(ctx, items), 1)]


def _vaccines_due_soon(canonical: dict, reference: date | None) -> list[dict]:
    if reference is None:
        return []
    selected = []
    for item in canonical.get("immunizations") or []:
        days = _days_until(item.get("due_on"), reference)
        if days is not None and 0 <= days < VACCINE_INFO_DAYS:
            selected.append(item)
    return selected


def _vaccine_spec(ctx: _Context, vaccine: dict) -> _AlertSpec:
    days = _days_until(vaccine.get("due_on"), ctx.reference) or 0
    label = vaccine.get("vaccine_label") or vaccine.get("vaccine_code") or "Vacuna"
    return _AlertSpec(
        rule_id="R08",
        code="VACCINE_DUE_SOON",
        severity="MEDIUM" if days <= VACCINE_MEDIUM_DAYS else "INFO",
        category="PREVENTIVE",
        title=f"{label} vence el {_format_date(vaccine.get('due_on'))}",
        message=f"Vacuna con vencimiento en {days} días ({_format_date(vaccine.get('due_on'))}).",
        action="Programar la vacunación y confirmar disponibilidad del producto.",
        evidence=[_evidence(ctx, "Immunization", vaccine)],
        confidence=0.9,
        due_date=str(vaccine.get("due_on")),
    )


def _rule_r08(ctx: _Context) -> list[dict]:
    vaccines = _vaccines_due_soon(ctx.canonical, ctx.reference)
    return [_alert(ctx, _vaccine_spec(ctx, vaccine), index) for index, vaccine in enumerate(vaccines, 1)]


def _microchip_gaps(patient: dict) -> list[str]:
    microchip = patient.get("microchip")
    if not microchip:
        return ["sin microchip"]
    if "X" in str(microchip).upper():
        return ["microchip enmascarado"]
    return []


def _identity_gaps(canonical: dict) -> list[str]:
    confidence = (canonical.get("identity") or {}).get("identity_confidence")
    if isinstance(confidence, (int, float)) and confidence < IDENTITY_CONFIDENCE_MIN:
        return [f"confianza de identidad {confidence:.2f}"]
    return []


def _freshness_gaps(ctx: _Context) -> list[str]:
    source = _canonical_source(ctx.canonical)
    source_date = _parse_date(source.get("source_as_of") or source.get("generated_at"))
    if source_date is None or ctx.reference is None:
        return []
    days = (ctx.reference - source_date).days
    if days <= FRESHNESS_DAYS:
        return []
    return [f"export de hace {days} días"]


def _contact_gaps(canonical: dict) -> list[str]:
    owners = canonical.get("owners") or []
    if not owners:
        return []
    if any(owner.get("phones") or owner.get("emails") for owner in owners):
        return []
    return ["tutor sin teléfono ni email"]


def _billing_gaps(canonical: dict) -> list[str]:
    if canonical.get("invoices") or canonical.get("documents"):
        return []
    return ["sin facturación ni adjuntos"]


def _format_gaps(canonical: dict) -> list[str]:
    if str(_canonical_source(canonical).get("format") or "").upper() == "DOCX":
        return ["origen Word: revisar campos críticos"]
    return []


def _record_gaps(ctx: _Context) -> list[str]:
    gaps = []
    gaps.extend(_microchip_gaps(ctx.patient))
    gaps.extend(_identity_gaps(ctx.canonical))
    gaps.extend(_freshness_gaps(ctx))
    gaps.extend(_contact_gaps(ctx.canonical))
    gaps.extend(_billing_gaps(ctx.canonical))
    gaps.extend(_format_gaps(ctx.canonical))
    return gaps


def _data_quality_spec(ctx: _Context, gaps: list[str]) -> _AlertSpec:
    evidence = [_evidence(ctx, "Patient", ctx.patient)]
    owners = ctx.canonical.get("owners") or []
    if owners:
        evidence.append(_evidence(ctx, "Owner", owners[0]))
    return _AlertSpec(
        rule_id="R09",
        code="DATA_QUALITY",
        severity="MEDIUM" if "sin microchip" in gaps else "LOW",
        category="DATA_QUALITY",
        title=f"Ficha a verificar: {gaps[0]}",
        message=f"Datos a verificar: {'; '.join(gaps)}.",
        action="Confirmar identidad, contacto y fechas con la clínica antes de la visita.",
        evidence=evidence,
        confidence=0.9,
    )


def _rule_r09(ctx: _Context) -> list[dict]:
    gaps = _record_gaps(ctx)
    if not gaps:
        return []
    return [_alert(ctx, _data_quality_spec(ctx, gaps), 1)]


def _risk_flags(patient: dict) -> list[tuple[int, dict]]:
    return [
        (index, flag)
        for index, flag in enumerate(patient.get("flags") or [])
        if _item_severity(flag) in RISK_FLAG_SEVERITIES
    ]


def _risk_flag_spec(ctx: _Context, index: int, flag: dict) -> _AlertSpec:
    text = str(flag.get("text") or "Aviso de riesgo")
    return _AlertSpec(
        rule_id="R10",
        code="RISK_FLAG",
        severity="INFO",
        category="RISK",
        title=text,
        message=f"Aviso registrado desde {_format_date(flag.get('since'))}: {text}",
        action="Revisar el aviso en la visita y actualizar la ficha si procede.",
        evidence=[_flag_evidence(ctx, index)],
        confidence=0.9,
    )


def _rule_r10(ctx: _Context) -> list[dict]:
    flags = _risk_flags(ctx.patient)
    return [_alert(ctx, _risk_flag_spec(ctx, index, flag), order) for order, (index, flag) in enumerate(flags, 1)]


def _negative_allergy_problems(canonical: dict) -> list[dict]:
    problems = canonical.get("problems") or []
    return [
        problem for problem in problems if _status_of(problem) == "RULED_OUT" and _category_of(problem) == "ALLERGY"
    ]


def _negative_allergy_spec(ctx: _Context, problem: dict) -> _AlertSpec:
    label = str(problem.get("label") or "Sin alergias conocidas")
    return _AlertSpec(
        rule_id="R11",
        code="ALLERGY_NKDA",
        severity="INFO",
        category="ALLERGY",
        title=label,
        message=f"Hallazgo negativo explícito: {label}. No debe tratarse como una alergia activa.",
        action="Registrar como negativo vigente y revaluar si aparece una reacción.",
        evidence=[_evidence(ctx, "Problem", problem)],
        confidence=0.95,
    )


def _rule_r11(ctx: _Context) -> list[dict]:
    problems = _negative_allergy_problems(ctx.canonical)
    return [_alert(ctx, _negative_allergy_spec(ctx, problem), index) for index, problem in enumerate(problems, 1)]


_RULE_BUILDERS = (
    _rule_r01,
    _rule_r02,
    _rule_r03,
    _rule_r04,
    _rule_r05,
    _rule_r06,
    _rule_r07,
    _rule_r08,
    _rule_r09,
    _rule_r10,
    _rule_r11,
)


def build_alerts(canonical: dict, *, as_of: str | None = None) -> list[dict]:
    ctx = _context(canonical, as_of)
    alerts = [alert for builder in _RULE_BUILDERS for alert in builder(ctx)]
    return _ordered(alerts)
