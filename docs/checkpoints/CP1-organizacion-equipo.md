# Checkpoint 1 · Organización del equipo

> **Criterio evaluado:** roles claros, líderes identificados y plan de trabajo coordinado.  
> **Equipo:** 2 personas. **Repo:** <https://github.com/HackathonBoehringerIT/Joniha>. **Fecha:** 14/11/2026.

## Para copiar/pegar (resumen de 30 segundos)

> Somos un equipo de dos personas con liderazgo explícito y trabajo en paralelo: **Jose Miguel** lidera proyecto, backend y datos; **[NOMBRE B]** lidera producto, frontend y demo. Ambos usamos agentes de IA como equipo de apoyo, pero la aceptación y la verificación son humanas. Trabajamos con contrato de API congelado, ficheros de propiedad disjunta, `main` siempre desplegable, checkpoints internos cada 90 minutos y entrega con vídeo de respaldo. El plan completo, con hitos y recortes, está en el `PLAYBOOK.md` del repo.

## 1. Equipo, roles y liderazgo

| Persona | Rol y liderazgo | Es dueña de | Entregable del día |
|---|---|---|---|
| **A · Jose Miguel** | **Líder de proyecto + Backend/Data** | Alcance, tiempos, GitHub y entrega, pitch; API FastAPI, SQLite, extractores, modelo canónico, seed | API viva + seed reproducible + 3 fichas normalizadas |
| **B · [NOMBRE B]** | **Líder técnica de producto + Frontend/Demo/QA** | UI/UX, las 5 pantallas, marca VetLink, guion de demo, vídeo, QA cruzada | 5 pantallas demoables + vídeo + README |

**Reglas de decisión (sin ambigüedad):**
- **A cierra** alcance, prioridades, entrega y relaciones con la organización.
- **B cierra** UX, pantallas, narrativa y guion de demo.
- **Cambio del contrato de API o del modelo canónico:** consenso obligatorio de A y B; se anota en el canal del equipo.
- **Nadie mergea su propia pantalla/feature sin revisión del otro** (revisión de 5 minutos).
- **Los agentes IA no deciden:** generan código/documentación; el humano revisa, prueba y firma. Se usan para ganar velocidad, no para delegar la responsabilidad.

## 2. Plan de trabajo coordinado (2 personas)

**Cadencia:**
- **Standup de 10 min** cada mañana y tras cada bloque: qué hice / qué haré / qué me bloquea.
- **Checkpoint interno cada 90 min**: demo de lo que funciona (no de lo que se está programando) + decisión de continuar o recortar.
- **Canal único** (WhatsApp/Discord del equipo) para decisiones, enlaces y bloqueos. El repo es la fuente de verdad.
- **Regla de los 20 minutos:** si alguien está bloqueado 20 min, se pide ayuda o se recorta la feature.
- **Congelaciones:** esquema sábado 18:00 · dependencias 20:00 · funcionalidad domingo 10:00 · código 12:00 · repo verificado 13:30.

**Reparto por bloques (6–8 h realistas con agentes):**

| Reloj | Persona A (backend/datos) | Persona B (producto/frontend/demo) | Gate conjunto |
|---|---|---|---|
| H+0:00–0:30 | Scaffold API + contrato + SQLite/seed | Scaffold SPA + tokens VetLink + router | `docker` no: `uvicorn` + `pnpm dev` + `/api/health` |
| H+0:30–2:30 | Extractores docx/xlsx/json/csv · canónico · alertas · endpoints | Pantallas 1–3 (login, bandeja/importación/revisión, marketplace) con mock | `curl` importa 3 ficheros; front navega |
| H+2:30–4:00 | Briefing determinista · resumen pre-aceptación · auditoría | Pantallas 4–5 (reserva/agenda, briefing) + integración API real | E2E: importar → ficha → solicitar → aceptar → briefing |
| H+4:00–5:00 | Reset/caché demo · CSV de robustez · tests de humo | Responsive del briefing · estados vacío/error · pulido | Demo repetible ×3 sin tocar código |
| H+5:00–6:00 | Vídeo (grabar) + README técnico | Guion y ensayo del pitch · capturas | Repo clonable + vídeo + ensayo cronometrado |
| H+6:00–8:00 | Buffer: bugs P0 y entrega | Buffer: ensayo y entrega | `main` verificado y aviso a organización |

**Reglas de trabajo en repo (coordinación real, no teoria):**
- `main` siempre desplegable; commits pequeños y push al menos cada hora.
- Ramas cortas `feat/…`, `fix/…`; PR solo si toca ficheros del otro; merge inmediato.
- **Propiedad de ficheros disjunta:** A escribe `services/api/**` y `docs/02`; B escribe `apps/web/**` y `docs/04`; ambos pueden tocar `README`/`PLAYBOOK` solo con aviso.
- Antes de empezar un bloque: `git pull --rebase`. Si hay conflicto, se resuelve juntos en 10 min.
- **Nada de secretos en el repo.** Datos de demo = ficheros de `data/samples/` + `docs/ejemplos/`.

## 3. Riesgos de equipo y mitigación (bus factor)

| Riesgo | Mitigación |
|---|---|
| Solo 2 personas → una enferma o se cae la conexión | Todo está en el repo + seed + vídeo; A puede hacer la demo sin B y B puede levantar el backend con el contrato congelado |
| Una persona se convierte en cuello de botella | Checkpoint cada 90 min; si una tarea bloquea >20 min, se recorta o se reparte |
| Los agentes generan código que nadie revisa | Regla de revisión cruzada + gates verificables (`curl`, browser, seed) antes de aceptar |
| Merge conflicts | Ficheros disjuntos + contrato congelado + push cada hora |
| Cansancio el domingo | Descanso 00:00–08:00; congelación domingo 10:00; el pitch se gana con cabeza fresca |

## 4. Mapa criterio → evidencia

| Lo que pide el checkpoint | Dónde está la evidencia |
|---|---|
| Roles claros | Tabla §1 de este documento y [`PLAYBOOK.md` §7](../../PLAYBOOK.md) |
| Líderes identificados | A = Jose Miguel (proyecto/backend); B = líder técnica (producto/frontend/demo) |
| Plan de trabajo coordinado | §2 (cadencia, reparto, congelaciones) y [`PLAYBOOK.md` §8](../../PLAYBOOK.md) |
| Plan vivo, no de PowerPoint | Historial de commits reales en `main` + tablero/decisiones en el repo |

## 5. Guion de 90 segundos (si es una llamada)

1. "Somos dos personas, con dos liderazgos explícitos: yo proyecto y backend, mi compañera producto y frontend."
2. "Trabajamos en paralelo con contrato de API congelado y ficheros de propiedad disjunta; nos revisamos el trabajo antes de cada checkpoint."
3. "La cadencia es: standup de 10 min, checkpoint interno cada 90 min con demo de lo que funciona, y congelaciones progresivas hasta la entrega del domingo a las 13:30."
4. "Los agentes de IA nos aceleran, pero la verificación es humana: cada gate se prueba con el seed y los ficheros reales del reto."
5. "Todo el plan está en el PLAYBOOK del repo; el historial de commits demuestra el ritmo."

> **Pendiente del usuario:** sustituir `[NOMBRE B]` por el nombre real antes de presentar.
