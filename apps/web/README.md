# `apps/web` — Frontend VetLink

SPA de la demo de **VetLink** (equipo **Joniha**, Reto 3 · VIII Hackathon Boehringer Ingelheim España).

**Stack:** React 18 + Vite 5 + TypeScript + **Tailwind CSS 3.4** + **DaisyUI 4.12** (tema `vetlink`) + React Router 6 + TanStack Query 5 + `lucide-react` + `react-dropzone`.

## Arranque real

Requisitos: Node 20+ y pnpm. La API FastAPI se sirve en `http://localhost:8000` bajo `/api`.

```powershell
cd apps/web
pnpm install
pnpm dev          # Vite en http://127.0.0.1:5173 con proxy /api → :8000
```

En otra terminal, la API:

```powershell
cd services/api
uv run uvicorn app.main:app --reload --port 8000   # API + SQLite + seed
```

Reset de datos de demo (también hay botón en el login y en la cabecera):

```powershell
curl -X POST http://localhost:8000/api/demo/reset
```

### Compilar para la demo "un proceso"

```powershell
cd apps/web
pnpm build        # tsc --noEmit + vite build → apps/web/dist
```

FastAPI sirve `apps/web/dist` y la API bajo `/api` en `http://localhost:8000` (sin CORS, cookie de sesión en el mismo origen).

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo (puerto 5173, proxy `/api` → `localhost:8000`) |
| `pnpm build` | Typecheck estricto + build de producción en `dist/` |
| `pnpm preview` | Sirve `dist/` en el puerto 5173 |
| `pnpm typecheck` | Solo `tsc --noEmit` |

## Variable de entorno

`.env.example` → copia a `.env` si hace falta cambiar la base de la API:

```
VITE_API_URL=/api
```

Con el proxy de Vite y con la demo "un proceso" no hace falta tocar nada.

## Pantallas (rutas)

| Ruta | Pantalla | Rol |
|---|---|---|
| `/login` | Selección de rol demo: **Soy clínica (Laura)** / **Soy especialista (Marc)** | público |
| `/patients` | Lista de pacientes + zona de subida drag&drop (Word/Excel/JSON) | CLINIC |
| `/patients/:id` | Ficha canónica: cabecera, alertas por severidad, timeline de encuentros, provenance | CLINIC |
| `/specialists` | Marketplace: búsqueda por especialidad/zona | ambos |
| `/specialists/:id` | Perfil, franjas disponibles y CTA "Solicitar derivación" | ambos |
| `/requests` | Lista de solicitudes | ambos |
| `/requests/new` | Nueva solicitud (motivo, urgencia, `CLINICAL`/`FULL`, franjas) | CLINIC |
| `/requests/:id` | Detalle: estado, resumen no identificativo, aceptar/rechazar/cancelar, briefing y auditoría | ambos |
| `/calendar` | Citas confirmadas | ambos |

Los tabs de `/requests/:id` se reflejan en la URL (`?tab=briefing`, `?tab=audit`).

## Estructura

```
apps/web
├── index.html
├── vite.config.ts            # proxy /api → http://localhost:8000, puerto 5173
├── tailwind.config.js        # tema DaisyUI `vetlink` (navy #1D2B4F, teal #1E8E82)
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
└── src
    ├── main.tsx              # QueryClientProvider + App
    ├── App.tsx               # rutas + redirección por rol
    ├── index.css             # Tailwind + clases base (vl-card, vl-label…)
    ├── api
    │   ├── client.ts         # fetch con credentials:'include' y ApiError normalizada
    │   ├── types.ts          # contrato de API tipado
    │   └── hooks.ts          # hooks React Query
    ├── components
    │   ├── Layout.tsx        # shell autenticado (redirige a /login sin sesión)
    │   ├── Nav.tsx           # cabecera: logo VL, chip de rol, enlaces, logout, reset demo
    │   ├── AlertCard.tsx     # alerta clínica con color por severidad + evidencia
    │   ├── ProvenanceBadge.tsx
    │   ├── EmptyState.tsx    # estados vacío y error (con reintento)
    │   └── Loading.tsx       # spinner y skeletons
    ├── lib
    │   ├── format.ts         # fechas es-ES, edad, severidades, roles, slots
    │   └── routes.ts         # pantalla de aterrizaje por rol
    └── pages
        ├── Login.tsx  Patients.tsx  PatientRecord.tsx
        ├── Specialists.tsx  SpecialistDetail.tsx
        ├── Requests.tsx  RequestNew.tsx  RequestDetail.tsx
        └── Calendar.tsx
```

## Notas de contrato (verificado contra `services/api`)

- Sesión por cookie: `POST /api/auth/demo {user:"laura"|"marc"}`, `GET /api/me` → `{user}` (`user.role` = `CLINIC`/`SPECIALIST`, más `clinic_id` y `specialty`), `POST /api/auth/logout`.
- `POST /api/requests` envía `{patient_id, specialist_id, motivo, urgencia, share_level, preferred}` con:
  - `urgencia ∈ BAJA | MEDIA | ALTA` (por defecto `MEDIA`);
  - `share_level ∈ CLINICAL | FULL` (por defecto `CLINICAL`);
  - `preferred` como **texto libre** (`"Mañanas de lunes a jueves"`), no como array.
- `POST /api/requests/{id}/accept` envía `{slot_iso}` en ISO 8601 (`toISOString()`); con slot → estado `SCHEDULED` + cita; sin slot → `ACCEPTED`.
- Estados: `REQUESTED → ACCEPTED | SCHEDULED → COMPLETED`, más `DECLINED`, `CANCELLED`, `EXPIRED`. La UI desbloquea briefing en `ACCEPTED`, `SCHEDULED` y `COMPLETED`.
- `GET /api/specialists/{id}` devuelve `available_slots` como **array de strings ISO** (`2026-11-16T09:30:00`); el frontend acepta también objetos por si cambia.
- `GET /api/requests/{id}/briefing` responde **403** hasta aceptar: la UI lo muestra como estado bloqueado (candado + explicación RGPD) y no reintenta. Cuando está desbloqueado devuelve `{briefing, record, record_meta, patient_summary, audit, unlocked_at}`.
- `GET /api/requests/{id}/summary` devuelve el resumen no identificativo (`patient` público, `headline`, `alert_counts`, `alerts`, `priority_actions`, `data_gaps`, `privacy`).
- `GET /api/requests/{id}` → `{request, patient_summary:{id,name,patient,headline,alert_counts}, specialist}`.
- `GET /api/appointments` enriquece cada cita con `patient_name`, `specialist_name`, `specialty`, `motivo`, `urgencia`, `request_status`.
- Errores: se muestra el `detail` de FastAPI (`string` o `[{loc, msg}]`) en un `alert` de DaisyUI. Sin backend (`fetch` falla) el mensaje explica cómo arrancar la API; ninguna pantalla queda en blanco.
- `alerts[].evidence` es un array de objetos `{entity,id,source_system,source_ref}`; se muestra plegado en cada alerta.

## Reglas

- **Selector de rol demo** (Laura/Marc) en el login, sin contraseñas: el jurado ve los dos lados en 2 clics.
- **Estados obligatorios:** vacío, carga, error y éxito en cada pantalla.
- **Móvil primero en el briefing**: es el escenario real del especialista.
- Textos de UI en español, identificadores de código en inglés.
- No añadir librerías de UI pesadas: DaisyUI + lucide-react es todo el sistema de diseño.
