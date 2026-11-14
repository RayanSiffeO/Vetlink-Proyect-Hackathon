# 05 · Arquitectura del MVP (VetLink)

> Decisión de stack ya tomada por el equipo (notas 13/11): **React + FastAPI + PostgreSQL en Supabase**. Este documento la concreta para que backend y frontend trabajen en paralelo sin fricción. Ver debate y alternativas en `03-debate-diseno.md`.

## Decisiones v1.1 (del debate red-team)

1. **5 pantallas** en lugar de 13: login/rol, paciente+subida+revisión, búsqueda+ficha, reserva+agenda, briefing/informe (ver `04-flujos-usuarios.md`).
2. **Supabase solo como PostgreSQL.** Sin Supabase Auth, Storage ni Realtime: auth propia (JWT) en FastAPI y documentos en disco local/objeto. Menos servicios = menos fallos.
3. **Demo local-first** (Docker + seed + reset). La nube es un extra de credibilidad, nunca la columna vertebral.
4. **Briefing determinista** (plantilla sobre el registro canónico). El LLM solo extrae texto libre y nunca redacta el informe.
5. **Mapeador asistido** para tabulares con columnas desconocidas + **4º formato CSV** como prueba de homogeneización dinámica.
6. **Resumen no identificativo antes de aceptar** la derivación; historia completa después (minimización RGPD + demostración del "puente").
7. **Modelo canónico FHIR-inspired** (Patient, Encounter, Condition, MedicationStatement, AllergyIntolerance, Immunization, Observation, DocumentReference) con provenance por campo.
8. **Congelaciones:** esquema sábado 18:00 · dependencias 20:00 · features domingo 10:00 · código domingo 12:00.

## Principios

1. **Demo-first:** cada pieza existe porque se ve en la demo. Nada de infraestructura que no se demuestre.
2. **Un repo, dos despliegues:** frontend estático + API; base de datos gestionada.
3. **La IA propone, el veterinario confirma:** todo campo extraído lleva `provenance` y `confidence`; por debajo del umbral va a revisión.
4. **Datos de salud = mínimo privilegio:** roles, niveles de compartición y datos ficticios.
5. **Si falla algo, la demo no muere:** datos semilla, plan B en vídeo, modo local.

## Vista de componentes

```
┌──────────────────────────── USUARIO (web responsive) ────────────────────────────┐
│  React SPA (Vite + TypeScript + Tailwind + React Router + TanStack Query)        │
│  S1 Landing · S2 Login · S3 Home clínica · S4 Importar · S5 Ficha canónica       │
│  S6 Marketplace · S7 Perfil · S8 Solicitud · S9 Home especialista · S10 Briefing  │
│  S11 Calendario · S12 Chat · S13 Cierre                                           │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │ HTTPS · JWT (Supabase Auth)
┌───────────────────────────────────▼───────────────────────────────────────────────┐
│  API FastAPI (Python 3.12 · Pydantic v2 · SQLAlchemy async · Uvicorn)            │
│                                                                                   │
│  Auth/RBAC        Patients        Imports          Canonical        Marketplace  │
│  ·JWT verify      ·CRUD           ·upload           ·merge          ·search      │
│  ·roles           ·matching       ·format sniff     ·alerts         ·profiles    │
│                                                                                   │
│  ┌── Extractores (registry de adaptadores) ────────────────────────────────────┐  │
│  │ docx_extractor  xlsx_extractor  json_extractor  generic/llm_extractor        │  │
│  │  (python-docx)   (openpyxl)      (schema map)    (structured output + JSON  │  │
│  │                                                   Schema, confidence)       │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  Briefing builder: plantilla determinista (sin LLM; solo enlaces a la fuente)   │
└───────────────┬───────────────────────────────┬──────────────────────────────────┘
                │                               │
        ┌───────▼────────┐              ┌───────▼────────┐
        │  PostgreSQL    │              │  Supabase      │
        │  (Supabase)    │              │  Storage       │
        │  tablas + RLS  │              │  documentos    │
        └────────────────┘              └────────────────┘
```

## Pipeline de importación (el diferencial técnico)

```
Upload (1..N ficheros)
   │  sniff: extensión + magic bytes + heurística de hojas/claves
   ▼
Adaptador elegido (docx | xlsx | json | csv | generic)
   │  extracción → "partial record" + field provenance + confidence
   ▼
Mapeador asistido (solo tabulares): propone mapeo de columnas desconocidas → usuario confirma
   ▼
Validación contra JSON Schema del Registro Canónico
   │  si falla → NEEDS_REVIEW (campos dudosos marcados, nunca se pierde el dato)
   ▼
Normalización (fechas ISO-8601, unidades, códigos especie/sexo/estado, moneda)
   ▼
Matching de paciente (microchip → nombre+fecha nac.; si ambiguo, sugerencia)
   ▼
Merge al registro existente (provenance por campo; conflicto = conservar ambos)
   ▼
Persistencia (JSONB canónico + índices) + cálculo de alertas + briefing cache
   ▼
UI: S5 ficha canónica / S10 briefing
```

**Regla de oro:** el pipeline nunca devuelve un error global si puede devolver un resultado parcial. Los adaptadores son un registry: añadir un formato = añadir un módulo, no tocar el core. Esto responde al matiz del reto "cada clínica puede tener unos distintos".

## Modelo de datos (resumen)

Detalle completo y mapeo campo a campo en `docs/02-modelo-datos.md`. Entidades canónicas:

`Patient · Owner · Encounter · Problem · Immunization · ParasiteControl · Weight · Reminder · Document · Prescription · Invoice · Alert · ImportJob · Specialist · Request · Appointment · Message · AuditEvent`

Persistencia del MVP:
- Tablas relacionales mínimas: `patients`, `owners`, `specialists`, `requests`, `appointments`, `messages`, `import_jobs`, `audit_events`.
- `canonical_records` (JSONB) con el registro completo + `record_version`.
- `alerts` proyectadas (tabla) para listados rápidos.
- **Autorización en la API** (única puerta): cada clínica solo ve sus pacientes; el especialista solo ve lo de solicitudes donde participa; documentos servidos con URL firmada. RLS de Supabase opcional como defensa en profundidad, no como mecanismo principal (menos piezas que fallen en la demo).

## API (contrato MVP)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/session` | Intercambio/validación de sesión (Supabase JWT) |
| GET | `/me` | Usuario + rol + clínica/especialidad |
| GET | `/patients` | Lista de pacientes de la clínica |
| POST | `/imports` | Subida multipart (1..N ficheros) → `job_id` |
| GET | `/imports/{job_id}` | Estado por fichero + resumen del resultado |
| GET | `/patients/{id}/record` | Registro canónico + alertas + provenance |
| PATCH | `/patients/{id}/record/review` | Confirmar/corregir campos dudosos |
| GET | `/specialists?specialty=&lat=&lng=&radius=&date=` | Búsqueda marketplace |
| GET | `/specialists/{id}` | Perfil, servicios, zonas, tarifas, disponibilidad |
| POST | `/requests` | Crear solicitud (paciente, nivel de compartición, franjas) |
| GET | `/requests/{id}` | Detalle + estado (ambas partes) |
| POST | `/requests/{id}/accept` · `/decline` · `/cancel` | Transiciones |
| GET | `/requests/{id}/summary` | Resumen **no identificativo** pre-aceptación (especie, raza, edad, peso, motivo, alertas, servicio, precio) |
| GET | `/requests/{id}/briefing` | Briefing pre-visita + historia completa **solo tras aceptar** |
| GET | `/requests/{id}/audit` | Quién vio qué y cuándo (panel de auditoría) |
| GET | `/appointments?from=&to=` | Calendario |
| POST | `/requests/{id}/messages` · GET | Chat del caso |
| POST | `/requests/{id}/close` | Nota de cierre del especialista |
| GET | `/health` | Para el demo y el deploy |

OpenAPI autogenerado por FastAPI: **enseñarlo en el pitch** (viabilidad técnica).

## Frontend

- **Stack:** Vite + React 18/19 + TypeScript + Tailwind CSS + React Router + TanStack Query. Sin librería de componentes pesada: tarjetas y tokens propios (marca VetLink).
- **Marca:** navy `#1D2B4F` + teal `#1E8E82` + blanco; tipografía sans (Inter/Manrope); logo monograma "VL" (ya existe en `D:\hackaton\Ideas\Logo 5 · Monograma VL@2x.png`).
- **Estado servidor** con TanStack Query; estado de sesión con Context; sin Redux.
- **Mock-first:** el frontend puede arrancar con MSW/fixtures de la API mientras backend termina (contrato de este documento). Así front y back trabajan en paralelo desde el minuto 1.
- **Responsive:** la demo se hace en portátil; el briefing debe verse bien en móvil (es el escenario real de Marc).

## Deploy y entornos

| Pieza | Herramienta | Notas |
|---|---|---|
| PostgreSQL | **Supabase (solo como DB)** o Postgres en Docker | Sin Auth/Storage/Realtime de Supabase; migraciones + seed |
| API | **Render / Fly.io / Railway** (opcional) | `Dockerfile` en `services/api`; variables de entorno en el panel |
| Frontend | **Vercel / Netlify / GitHub Pages** (opcional) | `VITE_API_URL` por entorno |
| **Demo principal** | **`docker compose up` local** | **Local-first:** sin depender del WiFi del evento; la nube es extra |

**Regla:** el domingo 12:00 la demo debe funcionar **en local** aunque el deploy falle. El deploy es extra de credibilidad, no el único camino.

## Seguridad y RGPD (lo que el jurado puede preguntar)

- Todos los datos de demo son **ficticios y seudonimizados** (los ficheros del reto ya vienen así: Kira/Luna/Bruno, tutores anonimizados).
- **Roles** (`CLINIC`, `SPECIALIST`, `ADMIN`) + **RLS** en Supabase: la clínica es la responsable del dato; el especialista accede solo al caso y solo con nivel autorizado.
- **Niveles de compartición** (`CLINICAL` / `FULL`) y URL firmadas para documentos.
- **Auditoría**: tabla `audit_events` (quién vio qué y cuándo) — se enseña en la demo si preguntan.
- **Retención:** no se persisten datos reales; aviso en UI "entorno de demostración con datos ficticios".
- Secretos en variables de entorno; `.env` fuera del repo (`.gitignore`).
- Base legal para producción: consentimiento informado del tutor + contrato de encargado del tratamiento clínica↔VetLink.

## Riesgos técnicos y mitigación

| Riesgo | Mitigación |
|---|---|
| El LLM devuelve JSON inválido o inventa campos | JSON Schema estricto + validación + umbral de confianza + revisión humana + extractores deterministas para Excel/JSON |
| Supabase limita/falla en la demo | Modo local con PostgreSQL en Docker + datos semilla |
| Tiempo insuficiente para marketplace + datos | Contrato API cerrado desde hoy y mock-first en frontend; el marketplace es CRUD simple |
| Fusión de pacientes mal hecha | Nunca automática: sugerencia + confirmación |
| Demo en directo con subida de ficheros | Copias locales + botón "cargar datos demo" + vídeo de respaldo |

## Estructura de repo propuesta

```
Joniha/
├── README.md                 # pitch, arranque en 3 pasos, links
├── PLAYBOOK.md               # este plan de trabajo y ritmo
├── docs/                     # contexto, reto, modelo de datos, debate, flujos, arquitectura
│   ├── diagramas/            # HTML Archify
│   └── ejemplos/             # registros canónicos JSON
├── apps/web/                 # React + Vite + TS
├── services/api/             # FastAPI
│   ├── app/extractors/       # adaptadores docx/xlsx/json/generic
│   ├── app/canonical/        # schema, merge, alerts
│   ├── app/briefing/         # generador
│   ├── app/routers/          # endpoints
│   └── app/seed/             # datos demo + 3 ficheros originales
├── data/samples/             # los 3 ficheros del reto (copias)
└── docker-compose.yml        # postgres + api + web (fallback local)
```

## Non-goals técnicos (para no discutirlos el sábado a las 2 a.m.)

- Microservicios, colas, event bus, Kubernetes.
- OCR de PDFs (fase 2).
- Pagos reales (Stripe) — solo maqueta de comisión.
- Notificaciones push reales — email/campana mock.
- Multi-idioma completo: español + catalán en textos legales (fase 2).
