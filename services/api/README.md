# `services/api` — API VetLink (FastAPI)

**Stack:** Python 3.12 + FastAPI + Pydantic v2 + **SQLModel + SQLite** (`data/vetlink.db`). Sin Supabase ni PostgreSQL en la demo (Postgres-ready). En la demo, FastAPI sirve también la SPA compilada de `apps/web/dist`.

## Estructura prevista

```
services/api/
├── app/
│   ├── main.py               # FastAPI app + routers + StaticFiles(SPA)
│   ├── config.py             # variables de entorno
│   ├── db.py                 # engine SQLite + create_all + seed al arrancar
│   ├── models.py             # SQLModel (patients, records, requests, ...)
│   ├── auth.py               # cookie de sesión demo + RBAC
│   ├── extractors/           # registry de adaptadores
│   │   ├── base.py           # interfaz Extractor
│   │   ├── docx_extractor.py # python-docx (tablas + texto)
│   │   ├── xlsx_extractor.py # openpyxl (13 hojas → entidades)
│   │   ├── json_extractor.py # mapeo de esquema de API PMS
│   │   └── csv_extractor.py  # tabular + mapeador asistido
│   ├── canonical/            # schema, normalize, merge, alerts
│   ├── briefing/             # generador determinista de briefing
│   ├── routers/              # endpoints (contrato en docs/05)
│   └── seed/                 # datos demo reproducibles (3 JSON canónicos)
├── tests/
└── pyproject.toml
```

## Contrato API (MVP)

Ver tabla de endpoints en `docs/05-arquitectura-mvp.md` §API. OpenAPI autogenerado en `/docs` de FastAPI: **enseñarlo en el pitch** como prueba de viabilidad técnica.

## Reglas

- **El pipeline nunca devuelve error global** si puede devolver resultado parcial: `NEEDS_REVIEW` y campos problemáticos marcados.
- Cada campo extraído lleva `provenance` (`source_system`, `source_ref`, `confidence`).
- Adaptadores como registry: añadir formato = añadir módulo, no tocar el core.
- Datos demo: los 3 ficheros de `data/samples/` deben producir las fichas de `docs/01-reto-analisis.md`.
- Sin secretos en el repo; `.env.example` con las variables necesarias.
