# Integración de extractores R1 — encargo backend/data (Rayan)

> **Para:** Rayan (backend/data). **De:** Lead (Jose Miguel). **Fecha:** 14/11/2026, 10:45.
> **Objetivo:** cerrar el hueco R1 (extracción real multi-formato) **sin romper** la app, el contrato API ni la build congelada de CP2.
> **Plazo:** hoy **13:45** entrega de código + tests; **14:00** revisión y go/no-go. CP2 (18:00) no depende de esto.

## 0. Regla de oro

**Una fuente de verdad, una puerta, un modelo.**

- **Modelo:** el registro canónico de [`docs/02-modelo-datos.md`](02-modelo-datos.md) (estructura exacta en [`docs/ejemplos/canonico-bruno.json`](ejemplos/canonico-bruno.json), `canonico-luna.json`, `canonico-kira.json`).
- **Puerta:** `POST /api/imports` de la API actual (FastAPI + SQLModel + SQLite). Nada de BD nueva, nada de app paralela.
- **Sin LLM en R1:** JSON y Word son parseables de forma determinista. El LLM queda para prosa libre, fuera del camino crítico de la demo.

## 1. Dónde va el código (tu write scope)

```
services/api/app/extractors/
├── __init__.py        # registry: extensión -> extractor
├── base.py            # ExtractResult + UnsupportedFormat
├── csv_extractor.py   # CSV tabular + mapeador de columnas
├── xlsx_extractor.py  # Excel de PMS (13 hojas)
├── json_extractor.py  # JSON anidado (VetNexo)
└── docx_extractor.py  # Word con tablas + prosa
services/api/tests/test_extractors.py   # tests nuevos
```

**No toques** `routers/`, `seed.py`, `main.py`, `apps/web/**`, `docs/**`, raíz ni el cableado de la API: el registro se enchufa desde el Lead. No hagas git ni push (GitHub está congelado). Entrega los ficheros por ruta local o zip en Discord.

## 2. Interfaz exacta (la que voy a cablear)

```python
# services/api/app/extractors/base.py
from dataclasses import dataclass, field
from pathlib import Path


class UnsupportedFormat(Exception):
    pass


@dataclass
class ExtractResult:
    record: dict
    warnings: list[str] = field(default_factory=list)
    needs_review: bool = False


def extract(path: Path) -> ExtractResult:
    raise NotImplementedError


# services/api/app/extractors/__init__.py
EXTRACTORS: dict[str, callable] = {
    ".csv": csv_extractor.extract,
    ".xlsx": xlsx_extractor.extract,
    ".json": json_extractor.extract,
    ".docx": docx_extractor.extract,
}
```

- `record` = registro canónico con las claves de los ejemplos. **Mínimo obligatorio:** `schema_version`, `source`, `privacy`, `identity`, `patient`, `owners`, `encounters`, `problems`, `immunizations`, `parasite_control`, `weights`, `reminders`, `prescriptions`, `invoices`, `documents`, `provenance_summary`.
- **No hace falta calcular `alerts` ni `briefing`:** los calcula la API a partir del canónico. Si los incluyes, respeta el formato de los ejemplos.
- Cada entidad lleva su `_meta` de procedencia (`source_system`, `source_format`, `source_ref`, `extracted_at`, `extracted_by`, `method`, `confidence`, `assumed`). Los campos derivados/inferidos llevan `assumed: true`.
- Formato no soportado → `UnsupportedFormat` (la API lo convierte en `NEEDS_REVIEW`).

## 3. Mapeo por formato (corrige la taxonomía)

| Formato | Categoría real | Cómo se extrae | Destino |
|---|---|---|---|
| **CSV / XLSX** | tabular | stdlib `csv` + `openpyxl` (¡sin pandas en runtime!) + diccionario de sinónimos de columnas | `Patient`, `Encounter`, `Observation` (peso lb→kg), `Condition` (alergias), `MedicationStatement` |
| **JSON (VetNexo)** | estructurado anidado | `json.load` + rutas directas (`patient`, `encounters`, `immunizations`, `problem_list`, `invoice`…) | canónico completo |
| **DOCX (Vall del Sol)** | semiestructurado (tablas + prosa) | `python-docx`: tablas 1→tutor, 2→paciente, 3→visitas, 4→preventivo, 5→alertas; prosa → regex para diagnósticos/fechas | canónico completo |
| **Texto libre / PDF escaneado** | no estructurado | **fuera de este encargo** (LLM con esquema y revisión, fase posterior) | — |

**No uses pandas en el código final:** el venv de la API no lo tiene y no vamos a meter ~50 MB en plena hackathon. Para prototipar puede valer, pero el adaptador usa `csv` + `openpyxl` (ya instalados).

## 4. Casos que deben funcionar (tests)

Ficheros en [`data/samples/`](../data/samples/README.md):

| # | Entrada | Resultado esperado |
|---|---|---|
| 1 | `export_clinica_norte.csv` | paciente Nala, 3 visitas, peso 26,4 lb → 11,97 kg, `needs_review: true` con 2 columnas de baja confianza, 0 columnas perdidas |
| 2 | `export_MAS-0004587_anonimizado.xlsx` | paciente Luna + 6 visitas + preventivo; ignorar fila TOTAL; 13 hojas sin romper |
| 3 | `historial.json` | paciente Kira + 9 encuentros + facturas + documentos; ids originales conservados |
| 4 | `Clínica Veterinaria Vall del Sol.docx` | paciente Bruno + 11 visitas + vacunación + alergia al pollo; sin PII en campos clínicos |
| 5 | **variante CSV** (subconjunto renombrado) | el mapeador asigna por heurística o marca revisión; **nunca excepción no controlada** |
| 6 | `.pdf`/`.exe` | `UnsupportedFormat` → la API responde `NEEDS_REVIEW` |

**Gate obligatorio antes de entregar:**

```powershell
cd services/api
.venv\Scripts\python.exe -m ruff check app tests
.venv\Scripts\python.exe -m pytest -q          # los 5 existentes + los nuevos
cd ..\..
powershell -ExecutionPolicy Bypass -File scripts\check-code.ps1
```

Además, el E2E global debe seguir verde: `scripts\e2e-api.ps1` (27/27) y `scripts\e2e-browser.ps1` (10/10). Si tocas algo que rompa uno de los dos, vuelve atrás.

## 5. Reglas de código (las mismas que el resto del repo)

DRY, **cero comentarios y docstrings**, **cero ifs anidados** (guard clauses), funciones ≤25 líneas y ≤3 parámetros, complejidad ≤8, sin código muerto. Ver [`PLAYBOOK.md` §7.1](../PLAYBOOK.md). El gate `check-code.ps1` debe dar 0.

## 6. Plan de tiempo de hoy

| Hora | Qué |
|---|---|
| 11:00–11:45 | Leer este documento + ejemplos canónicos; esqueleto de `base.py`, CSV y XLSX |
| 12:15 | Sync de 10 min en Discord (dudas de contrato) |
| 12:15–13:45 | JSON + DOCX + tests + variantes |
| 13:45 | Entrega: rutas de ficheros + salida de ruff/pytest/check-code |
| 14:00 | Go/no-go del Lead. Si verde: entra en la build de CP3. Si no: queda como prototipo y CP3 va con lo congelado |

CP2 (18:00) se presenta con `releases/cp2`; tu trabajo **no** puede retrasarlo.

## 7. Mensaje para pegar en Discord

> Rayan, alineamos tu parte con el plan y te dejo el encargo escrito en `docs/extractores-integracion.md`.
> Resumen: el JSON es **estructurado anidado** (no LLM) y el Word son **tablas + prosa** (determinista). Tu trabajo es el que menos gente sabe hacer: mapear los 4 formatos al **registro canónico** de `docs/02` con procedencia y confianza.
> Entregable: `services/api/app/extractors/` (csv, xlsx, json, docx) + `tests/test_extractors.py`, sin tocar la API ni la BD. Sin pandas en runtime (csv + openpyxl), sin LLM, sin Supabase.
> Gate: `ruff` 0, `pytest` verde, `check-code` 0, y una **variante modificada** del CSV/XLSX no puede romper. Plazo: **hoy 13:45**, revisión 14:00. Si no llega, no pasa nada para CP2 (va con build congelada), pero entra para CP3.
> ¿Te paso los ficheros por aquí o los tienes ya en `data/samples/`?
