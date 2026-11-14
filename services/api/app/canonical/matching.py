from __future__ import annotations

import re
import unicodedata

FULL_MICROCHIP_PATTERN = re.compile(r"\d{15}")
MICROCHIP_SEPARATOR_PATTERN = re.compile(r"[\s-]+")
MICROCHIP_MASK_CHARS = frozenset("X*")
MICROCHIP_MASK_PREFIX = 4
MICROCHIP_MASK_SUFFIX = 3
NESTED_NAME_MIN_LENGTH = 4

AUTO_MERGE_CONFIDENCE = 0.85
MICROCHIP_CONFIDENCE = 1.0
EXTERNAL_ID_CONFIDENCE = 0.95
NAME_BIRTH_CONFIDENCE = 0.90
NAME_EXACT_CONFIDENCE = 0.80
NAME_SHARED_TOKEN_CONFIDENCE = 0.72
NAME_FUZZY_CONFIDENCE = 0.65
MASKED_CONFIDENCE = 0.60
WEAK_IDENTITY_CONFIDENCE = 0.50

NAME_SIMILARITY_THRESHOLD = 0.92
WINKLER_SCALE = 0.1
WINKLER_MAX_PREFIX = 4


def normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_accents = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(without_accents.lower().split())


def is_full_microchip(value: str | None) -> bool:
    if not value:
        return False
    return FULL_MICROCHIP_PATTERN.fullmatch(_compact_microchip(value)) is not None


def match_patient(incoming: dict, candidates: list[dict]) -> dict | None:
    matches = [_candidate_match(incoming, candidate) for candidate in candidates]
    ranked = [match for match in matches if match is not None]
    if not ranked:
        return None
    return max(ranked, key=_match_rank)


def _match_rank(match: dict) -> tuple[float, str]:
    return match["confidence"], str(match["patient_id"])


def _candidate_match(incoming: dict, candidate: dict) -> dict | None:
    if not _comparable(incoming, candidate):
        return None
    if _microchips_conflict(incoming, candidate):
        return None
    score = _identity_score(incoming, candidate)
    masked = _has_masked_microchip(incoming, candidate)
    return _match(candidate.get("id"), _apply_mask_limit(score, masked))


def _match(patient_id: object, score: tuple[str, float] | None) -> dict | None:
    if score is None:
        return None
    method, confidence = score
    return {
        "patient_id": patient_id,
        "method": method,
        "confidence": round(confidence, 2),
        "requires_review": confidence < AUTO_MERGE_CONFIDENCE,
    }


def _identity_score(incoming: dict, candidate: dict) -> tuple[str, float] | None:
    if _same_full_microchip(incoming, candidate):
        return "microchip", MICROCHIP_CONFIDENCE
    if _shared_external_id(incoming, candidate):
        return "external_id", EXTERNAL_ID_CONFIDENCE
    name_confidence = _name_confidence(incoming.get("name"), candidate.get("name"))
    same_birth_date = _same_birth_date(incoming, candidate)
    if name_confidence is None:
        return _weak_identity_score(incoming, candidate, same_birth_date)
    if same_birth_date:
        return "name_birth_date", NAME_BIRTH_CONFIDENCE
    return "name", name_confidence


def _weak_identity_score(incoming: dict, candidate: dict, same_birth_date: bool) -> tuple[str, float] | None:
    if _masked_microchip_matches(incoming, candidate):
        return "masked_microchip", MASKED_CONFIDENCE
    if same_birth_date:
        return "weak_identity", WEAK_IDENTITY_CONFIDENCE
    return None


def _apply_mask_limit(score: tuple[str, float] | None, masked: bool) -> tuple[str, float] | None:
    if score is None or not masked:
        return score
    return "masked_microchip", min(score[1], MASKED_CONFIDENCE)


def _comparable(incoming: dict, candidate: dict) -> bool:
    incoming_species = incoming.get("species_code")
    candidate_species = candidate.get("species_code")
    if incoming_species and candidate_species:
        return incoming_species == candidate_species
    return True


def _compact_microchip(value: object) -> str:
    return MICROCHIP_SEPARATOR_PATTERN.sub("", str(value).strip())


def _full_microchip(value: object) -> str | None:
    if not value:
        return None
    compact = _compact_microchip(value)
    if not is_full_microchip(compact):
        return None
    return compact


def _same_full_microchip(incoming: dict, candidate: dict) -> bool:
    left = _full_microchip(incoming.get("microchip"))
    return left is not None and left == _full_microchip(candidate.get("microchip"))


def _microchips_conflict(incoming: dict, candidate: dict) -> bool:
    left = _full_microchip(incoming.get("microchip"))
    right = _full_microchip(candidate.get("microchip"))
    return left is not None and right is not None and left != right


def _has_masked_microchip(incoming: dict, candidate: dict) -> bool:
    return _is_masked(incoming.get("microchip")) or _is_masked(candidate.get("microchip"))


def _is_masked(value: object) -> bool:
    if not value:
        return False
    return any(char.upper() in MICROCHIP_MASK_CHARS for char in str(value))


def _masked_microchip_matches(incoming: dict, candidate: dict) -> bool:
    left = _mask_segments(incoming.get("microchip"))
    right = _mask_segments(candidate.get("microchip"))
    if left is None or right is None:
        return False
    return _segments_agree(left, right)


def _mask_segments(value: object) -> tuple[str, str] | None:
    if not _is_masked(value):
        return None
    compact = _compact_microchip(value).upper()
    masked = [index for index, char in enumerate(compact) if char in MICROCHIP_MASK_CHARS]
    return compact[: masked[0]], compact[masked[-1] + 1 :]


def _segments_agree(left: tuple[str, str], right: tuple[str, str]) -> bool:
    left_prefix, left_suffix = left
    right_prefix, right_suffix = right
    if min(len(left_prefix), len(right_prefix)) < MICROCHIP_MASK_PREFIX:
        return False
    if min(len(left_suffix), len(right_suffix)) < MICROCHIP_MASK_SUFFIX:
        return False
    prefix_agrees = left_prefix[:MICROCHIP_MASK_PREFIX] == right_prefix[:MICROCHIP_MASK_PREFIX]
    suffix_agrees = left_suffix[-MICROCHIP_MASK_SUFFIX:] == right_suffix[-MICROCHIP_MASK_SUFFIX:]
    return prefix_agrees and suffix_agrees


def _name_confidence(source: object, target: object) -> float | None:
    left = normalize_name(str(source or ""))
    right = normalize_name(str(target or ""))
    if not left or not right:
        return None
    if sorted(left.split()) == sorted(right.split()):
        return NAME_EXACT_CONFIDENCE
    if _shares_token(left, right):
        return NAME_SHARED_TOKEN_CONFIDENCE
    if _jaro_winkler(left, right) >= NAME_SIMILARITY_THRESHOLD:
        return NAME_FUZZY_CONFIDENCE
    return None


def _shares_token(source: str, target: str) -> bool:
    return bool(set(source.split()) & set(target.split())) or _is_nested(source, target)


def _is_nested(source: str, target: str) -> bool:
    shorter, longer = sorted((source, target), key=len)
    return len(shorter) >= NESTED_NAME_MIN_LENGTH and shorter in longer


def _jaro_winkler(source: str, target: str) -> float:
    base = _jaro(source, target)
    prefix = min(_common_prefix(source, target), WINKLER_MAX_PREFIX)
    return base + prefix * WINKLER_SCALE * (1.0 - base)


def _jaro(source: str, target: str) -> float:
    if source == target:
        return 1.0
    if not source or not target:
        return 0.0
    pairs = _jaro_pairs(source, target)
    if not pairs:
        return 0.0
    matched = len(pairs)
    transpositions = sum(1 for left, right in pairs if source[left] != target[right])
    return (matched / len(source) + matched / len(target) + (matched - transpositions / 2) / matched) / 3


def _jaro_pairs(source: str, target: str) -> list[tuple[int, int]]:
    window = _match_window(len(source), len(target))
    pairs: list[tuple[int, int]] = []
    used: set[int] = set()
    for index, char in enumerate(source):
        offsets = range(max(index - window, 0), min(index + window + 1, len(target)))
        hit = next((offset for offset in offsets if offset not in used and target[offset] == char), None)
        if hit is None:
            continue
        used.add(hit)
        pairs.append((index, hit))
    return pairs


def _match_window(length_a: int, length_b: int) -> int:
    return max(max(length_a, length_b) // 2 - 1, 0)


def _common_prefix(source: str, target: str) -> int:
    limit = min(len(source), len(target))
    return next((index for index in range(limit) if source[index] != target[index]), limit)


def _external_id_keys(patient: dict) -> set[str]:
    keys: set[str] = set()
    for item in patient.get("external_ids") or []:
        identifier = item.get("id") if isinstance(item, dict) else item
        if identifier:
            keys.add(str(identifier).strip().casefold())
    return keys


def _shared_external_id(incoming: dict, candidate: dict) -> bool:
    return bool(_external_id_keys(incoming) & _external_id_keys(candidate))


def _birth_key(value: object) -> str | None:
    if not value:
        return None
    return str(value)[:10]


def _same_birth_date(incoming: dict, candidate: dict) -> bool:
    left = _birth_key(incoming.get("birth_date"))
    return left is not None and left == _birth_key(candidate.get("birth_date"))
