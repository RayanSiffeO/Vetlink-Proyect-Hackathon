# Registro de decisiones (decision log)

> **Equipo:** Joniha (2 personas, pair programming). **Fuente de verdad** de las decisiones técnicas y de producto.  
> Cada decisión se debate en voz (Discord) y con apoyo de IA; se registra aquí con fecha, alternativas y consecuencias.  
> Formato: `id · fecha · decisión · por qué · alternativas descartadas · consecuencias · quién`.

| ID | Fecha | Decisión | Por qué | Alternativas descartadas | Consecuencias |
|---|---|---|---|---|---|
| D-01 | 14/11 01:30 | **Alcance C' recortado:** 5 pantallas y los 3 requisitos conectados (normalización + marketplace + briefing) | C completo son 55–65 h y no cabe; C' puntúa 8,35/10 y sí cabe | A (normalizador puro), B (marketplace puro), D (solo briefing con IA) | Fuera: pagos, chat, reseñas, landing, área del dueño, OCR |
| D-02 | 14/11 01:50 | **Stack rápido:** React + Vite + Tailwind + DaisyUI · FastAPI + SQLModel + SQLite · un solo proceso en demo (FastAPI sirve la SPA) · auth demo por cookie | Quita 4–6 h de infra y elimina dependencias externas en la demo | Supabase/Postgres + Docker; Next.js full-stack; FastAPI+HTMX; Streamlit | Sin Supabase/Docker/LLM en el camino crítico; Postgres-ready |
| D-03 | 14/11 02:00 | **Equipo de 2 con pair programming** en Discord, roles por fortaleza (Jose: frontend/producto/demo; compañero: backend/datos) y decisiones por consenso | Dos perfiles complementarios + IA como apoyo maximizan velocidad y reducen riesgo | Reparto rígido de tareas sin pair; una persona sola | Plan de 8 h; checkpoint interno cada 90 min; bus factor mitigado con seed + vídeo |
| D-04 | 14/11 02:05 | **Briefing determinista** (plantilla sobre el registro canónico); el LLM solo extrae texto libre y nunca redacta el informe | Es la pantalla con más riesgo legal y la que más mira el jurado | Briefing generado por LLM; resumen libre | Credibilidad y reproducibilidad; sin alucinaciones en demo |
| D-05 | 14/11 02:05 | **Resumen no identificativo antes de aceptar; historia completa después** | Minimización RGPD + demostración del "puente" entre las dos piezas | Historia completa desde el primer clic | Dos niveles de acceso y auditoría en la UI |
| D-06 | 14/11 02:55 | **Reglas de código obligatorias:** DRY, clean code sin comentarios ni docstrings explicativos, cero `ifs` imbricados (guard clauses), una función un propósito (≤25 líneas, ≤3 parámetros) y sin funciones complejas (complejidad ≤8) | El equipo lo exige para que el prototipo sea legible y revisable en pareja; se valida en cada bloque | Comentarios explicativos, estilos informales, funciones largas | Gate `scripts\check-code.ps1` + `ruff`/`eslint` en la revisión de 5 min |
| D-07 | 14/11 03:15 | **La pasada E2E de navegador y el vídeo de demo se dejan para el bloque de cierre**, con las features ya congeladas | Evita repetir QA y grabación tras cada cambio; el flujo ya está validado por API (smoke 9/9) y el build de la SPA está al día | Grabar ahora / E2E incremental en cada bloque | El cierre concentra E2E + vídeo + README final; reservar un bloque fijo el sábado noche para no llegar justos al domingo |

## Plantilla para nuevas decisiones

| Campo | Contenido |
|---|---|
| **ID** | D-0X |
| **Fecha/hora** | 14/11/2026 HH:MM |
| **Decisión** | una frase en negrita |
| **Por qué** | 1–2 razones medibles (horas, riesgo, criterio del checkpoint) |
| **Alternativas descartadas** | qué se consideró y por qué no |
| **Consecuencias** | qué se recorta, qué se compromete, qué hay que vigilar |
| **Quién** | referente del área + consenso del par |

## Reglas

- Toda decisión que cambie alcance, contrato de API, modelo canónico, stack o guion de demo **se registra aquí el mismo día**.
- No se registran decisiones triviales (nombres de variables, estilos).
- En los checkpoints, este archivo es la prueba de que el plan es **vivo** y coordinado.
