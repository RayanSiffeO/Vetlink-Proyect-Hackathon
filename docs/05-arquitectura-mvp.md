# 05 · Arquitectura del MVP (VetLink) — stack rápido

> **Decisión v1.3 (14/11 01:45, Lead):** para un MVP de ~6 h con agentes en paralelo se mantiene el esqueleto React + FastAPI, pero se sustituye la infraestructura pesada por la más rápida: **SQLite en archivo**, **un solo proceso en la demo** y **DaisyUI** para la UI. Sin Supabase, sin Docker en el camino crítico y sin LLM en la demo. El modelo y el contrato son **Postgres-ready**: migrar es cambiar la URL de conexión.
>
> Antecedentes: decisión de stack del equipo (13/11, notas Obsidian: React + FastAPI + PostgreSQL/Supabase) y debate red-team en `03-debate-diseno.md`. Esta versión supersede a v1.0/v1.1 en lo relativo a infraestructura.

## Qué cambia y por qué

| Antes | Ahora (v1.3) | Ganancia |
|---|---|---|
| PostgreSQL + Supabase + RLS | **SQLite** (`data/vetlink.db`), SQLModel | −1–2 h de infra; demo offline y determinista |
| Docker Compose en el camino crítico | `uvicorn` + `pnpm dev`; **build estático servido por FastAPI** en la demo | −30–45 min y menos piezas que arrancar |
| Frontend y API en dos despliegues + CORS | En demo, **FastAPI sirve `apps/web/dist`** en `/`; API en `/api` | 1 proceso, 1 puerto, 1 URL |
| UI hecha a mano | **Tailwind + DaisyUI** + lucide-react | −2–3 h de CSS; componentes listos |
| Auth de Supabase | **Cookie firmada (itsdangerous) + selector de rol demo** | −2 h; roles visibles en 2 clics |
| Alembic/migraciones | `SQLModel.metadata.create_all` + seed al arrancar | −1 h; nada que migrar |
| LLM para extraer | **python-docx / openpyxl / json / csv deterministas** | −2 h y cero alucinación en la demo |

**Regla de oro:** el camino crítico de la demo no depende de red, contenedores ni servicios externos. Si algo se cae, la demo sigue en local.

## Decisiones de producto/arquitectura

1. **5 pantallas**: login/rol · paciente+subida+revisión · búsqueda+ficha · reserva+agenda · briefing/informe (ver `04-flujos-usuarios.md`).
2. **Sin Supabase** ni servicios gestionados para la demo. Postgres queda como camino de producción documentado.
3. **Un solo proceso en demo**: FastAPI sirve la SPA compilada; en desarrollo, Vite con proxy `/api`.
4. **Briefing determinista** (plantilla Jinja/Python sobre el registro canónico). El LLM no redacta el informe.
5. **Mapeador asistido** para tabulares con columnas desconocidas + **4º formato CSV**.
6. **Resumen no identificativo antes de aceptar**; historia completa después.
7. **Modelo canónico FHIR-inspired** con provenance por campo, persistido como JSON canónico.
8. **Congelaciones:** esquema sábado 18:00 · dependencias 20:00 · features domingo 10:00 · código 12:00.

## Vista de componentes (demo)

```
┌──────────────────────────── USUARIO (web responsive) ────────────────────────────┐
│  React SPA (Vite + TypeScript + Tailwind + DaisyUI + lucide-react)               │
│  React Router · TanStack Query · react-dropzone                                  │
│  S1 Login/rol · S2 Paciente+subida+revisión · S3 Búsqueda+ficha                  │
│  S4 Reserva+agenda · S5 Briefing/informe                                         │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │ HTTPS · cookie de sesión demo (rol)
┌───────────────────────────────────▼───────────────────────────────────────────────┐
│  FastAPI (Python 3.12 · Pydantic v2 · SQLModel · Uvicorn)                        │
│                                                                                   │
│  Auth demo (cookie firmada)   Patients   Imports      Canonical      Marketplace │
│  ·rol CLINIC/SPECIALIST       ·CRUD      ·upload      ·merge         ·search     │
│                               ·matching  ·sniff       ·alerts        ·profiles   │
│                                                                                   │
│  ┌── Extractores deterministas (registry de adaptadores) ──────────────────────┐  │
│  │ docx_extractor (python-docx)  xlsx_extractor (openpyxl)                     │  │
│  │ json_extractor (mapping)      csv_extractor + mapeador asistido             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  Briefing builder (plantilla determinista)   StaticFiles("/") → apps/web/dist    │
└───────────────┬───────────────────────────────┬──────────────────────────────────┘
                │                               │
        ┌───────▼────────┐              ┌───────▼────────┐
        │  SQLite        │              │  Disco local   │
        │  data/vetlink.db│             │ data/uploads/  │
        │  tablas + JSON │              │  documentos    │
        └────────────────┘              └────────────────┘

  (Postgres-ready: SQLModel + `canonical_json` portable a JSONB; sin cambios de contrato)
```

## Pipeline de importación

```
Upload (1..N ficheros: .docx/.xlsx/.json/.csv)
   │  sniff: extensión + magic bytes + heurística
   ▼
Adaptador elegido (docx | xlsx | json | csv)
   │  extracción → "partial record" + provenance + confidence
   ▼
Mapeador asistido (solo tabulares desconocidos): propone columnas → usuario confirma
   ▼
Validación contra el esquema canónico (Pydantic)
   │  si faltan campos → NEEDS_REVIEW (no se pierde nada)
   ▼
Normalización (fechas ISO-8601, unidades, códigos especie/sexo/estado, moneda)
   ▼
Matching de paciente (microchip → nombre+fecha nac.; ambiguo = sugerencia)
   ▼
Merge con provenance + cálculo de alertas (reglas Python R01–R11)
   ▼
Persistencia SQLite (tabla `records.canonical_json` + `alerts` proyectadas)
   ▼
UI: ficha canónica (S2) · briefing (S5)
```

**Regla:** el pipeline devuelve resultado parcial, nunca un error global. Añadir un formato = añadir un adaptador, no tocar el core. **Cache de importación** por hash de fichero para que la demo sea instantánea y repetible.

## Persistencia (SQLite en demo)

Tablas mínimas (SQLModel):

| Tabla | Contenido |
|---|---|
| `users` | Laura (CLINIC), Marc (SPECIALIST) y usuarios demo; `role`, `display_name`, `clinic_id`/`specialty` |
| `patients` | identidad canónica + `owner_json` + `species`, `breed`, `birth_date`, `microchip`, `identity_confidence` |
| `records` | `patient_id`, `canonical_json` (registro completo), `record_version`, `source_system`, `imported_at` |
| `alerts` | proyección de alertas (severity, category, due_date, evidence_json) para listados |
| `specialists` | perfil marketplace: especialidad, zonas, tarifa, disponibilidad |
| `requests` | solicitud de derivación: `status`, `share_level`, `patient_id`, `specialist_id`, `motivo`, `urgencia` |
| `appointments` | cita: fecha/hora, `request_id`, estado |
| `audit_events` | quién vio qué y cuándo (panel de auditoría) |
| `import_jobs` | estado por fichero (`UPLOADING/PARSING/NEEDS_REVIEW/READY/FAILED`) |

- `canonical_json` es el registro de `docs/02-modelo-datos.md` tal cual (los 3 ejemplos de `docs/ejemplos/` sirven de seed).
- Seed idempotente al arrancar si la base está vacía; endpoint `POST /api/demo/reset` para la demo.
- **Postgres-ready:** `canonical_json` pasa a `JSONB`, y SQLModel reutiliza las mismas clases.

## API (contrato MVP)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado (para demo y deploy) |
| POST | `/api/auth/demo` | Login demo por rol/usuario; set-cookie firmada |
| POST | `/api/auth/logout` | Cierra sesión demo |
| GET | `/api/me` | Usuario, rol, clínica/especialidad |
| GET | `/api/patients` | Pacientes de la clínica |
| POST | `/api/imports` | Subida multipart (1..N) → `job_id` |
| GET | `/api/imports/{job_id}` | Estado por fichero + resumen |
| POST | `/api/imports/{job_id}/confirm` | Confirmar mapeo de columnas (CSV) |
| PATCH | `/api/patients/{id}/record/review` | Confirmar/corregir campos dudosos |
| GET | `/api/patients/{id}/record` | Registro canónico completo + alertas |
| GET | `/api/specialists?specialty=&zone=&date=` | Búsqueda marketplace |
| GET | `/api/specialists/{id}` | Perfil, servicios, tarifas, disponibilidad |
| POST | `/api/requests` | Crear solicitud (share level, franjas) |
| GET | `/api/requests/{id}` | Detalle y estado (ambas partes) |
| GET | `/api/requests/{id}/summary` | **Resumen no identificativo** pre-aceptación |
| POST | `/api/requests/{id}/accept` · `/decline` · `/cancel` | Transiciones |
| GET | `/api/requests/{id}/briefing` | Briefing + historia completa **solo tras aceptar** |
| GET | `/api/requests/{id}/audit` | Quién vio qué y cuándo |
| GET | `/api/appointments?from=&to=` | Calendario |
| POST | `/api/demo/reset` | Reset + seed (solo demo) |
| GET | `/docs` | Swagger autogenerado (se enseña en el pitch) |

`GET /api/health` y OpenAPI no dependen de la base: si algo falla, la demo sigue mostrando el estado.

## Frontend

- **Stack:** React 18 + Vite + TypeScript + **Tailwind CSS + DaisyUI** + `lucide-react` + `react-dropzone` + **TanStack Query** + React Router.
- **Marca VetLink:** navy `#1D2B4F`, teal `#1E8E82`, blanco; logo monograma "VL" (origen `D:\hackaton\Ideas\Logo 5 · Monograma VL@2x.png`).
- **Roles demo:** selector Laura/Marc en la pantalla de login (sin passwords): el jurado puede ver los dos lados en 2 clics.
- **Mock-first:** el frontend arranca con fixtures de `docs/ejemplos/` mientras el backend termina; mismo contrato.
- **Responsive:** briefing legible en móvil (escenario real de Marc).

## Cómo se ejecuta

```powershell
# Desarrollo (2 terminales)
cd services/api;  uv run uvicorn app.main:app --reload --port 8000   # API + SQLite + seed
cd apps/web;      pnpm dev                                           # Vite (proxy /api → 8000)

# Demo "un proceso" (la que se enseña)
cd apps/web; pnpm build          # genera apps/web/dist
cd services/api; uv run uvicorn app.main:app --port 8000
# → http://localhost:8000  sirve la SPA y /api, sin CORS

# Reset de datos
curl -X POST http://localhost:8000/api/demo/reset
```

## Seguridad y RGPD (demo)

- Datos **sintéticos/ficticios** y banner visible: "Entorno de demostración — datos sin PII. No usar con datos reales."
- **Autorización en la API** (única puerta): la clínica solo ve sus pacientes; el especialista solo el caso donde participa; el resumen pre-aceptación no incluye PII del tutor, microchip completo, documentos ni facturas.
- **Auditoría** en `audit_events` (quién vio qué y cuándo) mostrada en el panel del caso.
- Sesión demo con cookie firmada (`itsdangerous`); en producción: JWT/sesión real + HTTPS + DPA + datos en la UE.
- Sin secretos en el repo; `.env.example` con lo mínimo (no hay servicio externo obligatorio).

## Riesgos técnicos y mitigación

| Riesgo | Mitigación |
|---|---|
| SQLite no escala / no es "arquitectura de producción" | Es demo: un fichero, seed, reset. El modelo es Postgres-ready y se dice en el pitch |
| Pérdida de la BD en un deploy | La demo es local; si se despliega, volumen persistente o seed al arrancar |
| Documentos con PII en el Word de Bruno | Demo con datos sintéticos y banner; no se envían a ningún LLM |
| Extracción DOCX frágil | Tablas con python-docx + revisión humana + cache de importación; nunca rompe la pantalla |
| Fricción front/back | Contrato congelado hoy + mock-first + un solo origen en demo (sin CORS) |
| Demo en directo | Seed + reset + build local + vídeo de respaldo |

## Estructura de repo

```
Joniha/
├── README.md                 # pitch, arranque en 3 pasos, links
├── PLAYBOOK.md               # plan de trabajo y ritmo
├── docs/                     # 00 contexto · 01 reto · 02 datos · 03 debate · 04 flujos · 05 arquitectura · 06 mercado
│   ├── diagramas/            # HTML Archify
│   └── ejemplos/             # 3 registros canónicos JSON (seed)
├── apps/web/                 # React + Vite + TS + Tailwind + DaisyUI
├── services/api/             # FastAPI + SQLModel + extractores + seed
│   ├── app/extractors/       # docx · xlsx · json · csv
│   ├── app/canonical/        # schema, merge, alerts
│   ├── app/briefing/         # plantilla determinista
│   ├── app/routers/
│   └── app/seed/
├── data/samples/             # 3 ficheros del reto + CSV de robustez
├── data/vetlink.db           # SQLite (gitignored; se genera al arrancar)
└── scripts/                  # demo:reset, capturas, utilidades
```

> `docker-compose.yml` queda **fuera del camino crítico**: solo si sobra tiempo y se quiere un envoltorio "un comando" para el jurado.

## Librerías que ahorran horas (usar sin dudar)

| Capa | Librería | Para qué |
|---|---|---|
| UI | `daisyui` | componentes listos (cards, badges, tabs, modals) |
| UI | `lucide-react` | iconografía |
| UI | `react-dropzone` | drag & drop de ficheros |
| UI | `@tanstack/react-query` | fetch/estados sin boilerplate |
| UI | `react-router-dom` | 5 rutas en minutos |
| UI | `recharts` (opcional) | curva de peso en la ficha |
| API | `sqlmodel` | modelos + validación en una clase |
| API | `python-docx` / `openpyxl` | extractores deterministas |
| API | `itsdangerous` | cookie de sesión demo |
| API | `uvicorn` | servidor |

## Non-goals técnicos (no se discuten el sábado a las 2 a.m.)

- Supabase, RLS, Docker, Kubernetes, microservicios, colas, Alembic.
- OCR/PDF escaneado, pagos reales, notificaciones push, WebSockets.
- LLM en el camino crítico de la demo (solo extracción de texto libre, fuera del guion si no es necesaria).
- App móvil nativa, multi-idioma completo.
