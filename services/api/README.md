# `services/api` — API VetLink (H+0)

**Stack:** Python 3.12 · FastAPI · SQLModel · SQLite (`data/vetlink.db`) · auth demo por cookie firmada (`itsdangerous`). Sin JWT, sin Supabase, sin Docker. En la demo, FastAPI sirve también la SPA compilada si existe `apps/web/dist`.

Contrato congelado: `docs/contracts/openapi-v1.json` (autogenerado desde `/openapi.json`).

---

## 1. Arranque real (verificado)

Desde la raíz del repo `D:\hackaton\Programa\Joniha`:

```powershell
# 1) entorno (solo la primera vez)
C:\Users\Usuario\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe -m venv services/api/.venv
services/api/.venv/Scripts/python.exe -m pip install -r services/api/requirements.txt

# 2) arranque
cd services/api
..\..\services\api\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- API: <http://127.0.0.1:8000/api/health>
- Swagger: <http://127.0.0.1:8000/docs> · OpenAPI: <http://127.0.0.1:8000/openapi.json>
- La BD y los uploads se crean solos: `data/vetlink.db`, `data/uploads/`.
- Al arrancar, si la BD está vacía, se siembra automáticamente (idempotente). `POST /api/demo/reset` la recrea.
- CORS abierto para `http://localhost:5173` (Vite dev).
- `VETLINK_SECRET_KEY` (opcional) firma la cookie; por defecto usa una clave de demo.

## 2. Auth demo

```powershell
curl.exe -c cookies.txt -X POST http://127.0.0.1:8000/api/auth/demo `
  -H "Content-Type: application/json" -d '{"user":"laura"}'
# -> set-cookie: session=...; HttpOnly; SameSite=lax
curl.exe -b cookies.txt http://127.0.0.1:8000/api/me
```

| Usuario | Rol | Uso |
|---|---|---|
| `laura` | `CLINIC` — Clínica Vall del Sol | Sube fichas, ve pacientes, crea derivaciones |
| `marc` | `SPECIALIST` — Cardiología | Ve derivaciones asignadas, acepta con slot, desbloquea el briefing |

`POST /api/auth/logout` borra la cookie. Sesión válida 12 h.

## 3. Endpoints (prefijo `/api`)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/health` | `{status, db, seeded, counts}` |
| POST | `/auth/demo` | body `{user}` → cookie `session` |
| GET | `/me` | usuario de la sesión (401 sin cookie) |
| POST | `/auth/logout` | borra cookie |
| GET | `/patients` | 3 pacientes sembrados + `alerts_count` |
| GET | `/patients/{id}/record` | canónico completo + alertas + provenance · audita `VIEW_RECORD` |
| POST | `/imports` | multipart `files` → cache sha256: 3 READY, resto `NEEDS_REVIEW` |
| GET | `/imports/{job_id}` | estado de la importación |
| GET | `/specialists?specialty=&zone=` | directorio + `next_slot` |
| GET | `/specialists/{id}` | ficha + `available_slots` |
| POST | `/requests` | `{patient_id, specialist_id, motivo, urgencia, share_level, preferred}` |
| GET | `/requests` | CLINIC: las suyas · SPECIALIST: asignadas |
| GET | `/requests/{id}` | detalle + `patient_summary` no identificativo |
| GET | `/requests/{id}/summary` | resumen NO identificativo (antes y después de aceptar) |
| POST | `/requests/{id}/accept` | `{slot_iso}` → `SCHEDULED` + `Appointment` + auditoría |
| POST | `/requests/{id}/decline` · `/cancel` | estados `DECLINED` / `CANCELLED` |
| GET | `/requests/{id}/briefing` | 403 si no está aceptada; 200 con `{briefing, record, audit}` |
| GET | `/appointments?from=&to=` | agenda de las derivaciones visibles |
| GET | `/requests/{id}/audit` | trazabilidad de la derivación |
| POST | `/demo/reset` | borra y reseeda |

## 4. Demo de 60 segundos (verificada)

```powershell
$B = "http://127.0.0.1:8000/api"
curl.exe -s $B/health
curl.exe -s -c c.txt -X POST $B/auth/demo -H "Content-Type: application/json" -d '{"user":"laura"}'
curl.exe -s -b c.txt -F "files=@data/samples/historial.json" $B/imports   # READY -> pat_kira
curl.exe -s -b c.txt -F "files=@data/samples/export_clinica_norte.csv" $B/imports  # NEEDS_REVIEW
curl.exe -s -b c.txt $B/patients/pat_kira/record
curl.exe -s -b c.txt -X POST $B/requests -H "Content-Type: application/json" `
  -d '{"patient_id":"pat_kira","specialist_id":"spc_marc","motivo":"Soplo cardíaco","urgencia":"ALTA","share_level":"CLINICAL","preferred":"Mañanas"}'
curl.exe -s -b c.txt $B/requests/<id>/summary          # 200 sin datos del tutor
curl.exe -s -b c.txt $B/requests/<id>/briefing         # 403: se desbloquea al aceptar
curl.exe -s -c m.txt -X POST $B/auth/demo -H "Content-Type: application/json" -d '{"user":"marc"}'
curl.exe -s -b m.txt -X POST $B/requests/<id>/accept -H "Content-Type: application/json" -d '{"slot_iso":"2026-11-16T09:30:00"}'
curl.exe -s -b m.txt $B/requests/<id>/briefing         # 200: historia completa + briefing
curl.exe -s -b m.txt $B/appointments
```

## 5. Datos demo y cache de importación

- Los 3 canónicos de `docs/ejemplos/` se siembran como `pat_bruno`, `pat_luna`, `pat_kira` (registro completo, alertas proyectadas, `identity_confidence`).
- La cache de importación se construye en caliente con el **sha256** de `data/samples/` y los mapea a su `record_id`: subir esos 3 ficheros devuelve `READY` sin parsear (demo instantánea).
- Cualquier otro fichero (p. ej. `export_clinica_norte.csv`) devuelve `NEEDS_REVIEW` con `"mapeo asistido pendiente"`. El pipeline nunca falla en bloque.
- Especialistas: `spc_marc` (Cardiología, Barcelona, 120 €), `spc_elena` (Dermatología, Barcelona, 95 €), `spc_javier` (Traumatología, Sant Cugat, 110 €). Slots ISO reales de los próximos días laborables.

## 6. Briefing determinista (sin LLM)

`app/briefing.py` calcula desde el canónico: `headline`, `patient_label`, `alert_counts` (CRITICAL/HIGH/MEDIUM/LOW/INFO), `priority_actions` (3), `data_freshness_days` (desde `source.source_as_of`), `data_gaps` y `alerts_rendered` (máx. 7).

`build_public_summary()` reutiliza la misma función y **filtra**: especie, raza, edad, sexo/esterilización, peso/BCS, motivo, 3 alertas, urgencia y servicio/precio. Nunca tutor, microchip, documentos ni facturas.

## 7. Tests

```powershell
cd services/api
..\..\services\api\.venv\Scripts\python.exe -m pytest
```

## 8. Estructura

```
services/api/
├── app/
│   ├── main.py        # app, CORS, /api, SPA opcional
│   ├── config.py      # rutas y ajustes
│   ├── db.py          # engine SQLite, sesión, auditoría
│   ├── models.py      # 10 tablas SQLModel
│   ├── schemas.py     # entrada Pydantic + serializadores
│   ├── auth.py        # cookie firmada + RBAC por rol
│   ├── briefing.py    # briefing y resumen no identificativo
│   ├── seed.py        # seed idempotente + cache sha256
│   └── routers/       # auth, patients, imports, specialists,
│                      # requests, appointments, audit, demo
├── tests/
└── pyproject.toml / requirements.txt
```

## 9. Pendiente (fuera del H+0)

- Extracción real de docx/xlsx/json/csv (hoy: cache sha256 + `NEEDS_REVIEW`).
- Persistir la subida a `Record`/`Patient` nuevos cuando el mapeo esté revisado.
- `data/vetlink.db` y `data/uploads/` son artefactos locales: conviene añadirlos al `.gitignore` de la raíz.
