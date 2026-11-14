# Checkpoint 1 · Organización del equipo

> **Criterio evaluado:** roles claros, líderes identificados y plan de trabajo coordinado.  
> **Cuándo:** sábado 14/11 **12:00** (15 min, sala virtual del jurado, cámara encendida).  
> **Equipo:** 2 personas, **pair programming** en llamada de Discord, decisiones conjuntas. **Repo:** <https://github.com/HackathonBoehringerIT/Joniha>. **Fecha:** 14/11/2026.

## Para copiar/pegar (resumen de 30 segundos)

> Somos un equipo de dos personas que trabaja en **pair programming** durante todo el finde, en llamada de Discord en directo, debatiendo y decidiendo todo en conjunto. **Jose Miguel** lleva producto, frontend y demo; **[NOMBRE COMPAÑERO]** lleva backend, datos e integración. Usamos la IA como un participante más para debatir decisiones técnicas, pero la decisión, la verificación y la entrega son humanas. Tenemos contrato de API congelado, registro de decisiones en el repo, checkpoints internos cada 90 minutos y entrega con vídeo de respaldo. El plan completo está en el `PLAYBOOK.md`.

## 1. Equipo, roles y liderazgo

| Persona | Fortaleza principal | Referente de | Entregable del día |
|---|---|---|---|
| **Jose Miguel** | Frontend / producto / UX | **Coordinación general, pitch y demo**: alcance, tiempos, GitHub/entrega, guion; UI, las 5 pantallas, marca VetLink, vídeo | 5 pantallas demoables + guion + vídeo |
| **[NOMBRE COMPAÑERO]** | Backend / datos | **Arquitectura técnica y datos**: API FastAPI, SQLite, extractores, modelo canónico, seed, integración y despliegue local | API viva + seed reproducible + 3 fichas normalizadas |

**Liderazgo compartido con referentes claros (no jerarquía rígida):**
- **Decisiones de producto/UX/narrativa:** referente Jose Miguel.
- **Decisiones de arquitectura/datos/seguridad:** referente [NOMBRE COMPAÑERO].
- **Alcance, prioridades y entrega:** se deciden **por consenso**; si hay empate, decide el referente del área implicada y se anota en el registro de decisiones.
- **Ninguno de los dos mergea solo una decisión que afecte al otro:** se debate en voz y se registra.
- **La IA es un participante de apoyo**, no un jefe: propone alternativas y acelera, pero el humano valida y firma.

> Sustituir `[NOMBRE COMPAÑERO]` por el nombre real antes de presentar el checkpoint.

## 2. Modo de trabajo: pair programming + IA

| Elemento | Cómo funciona |
|---|---|
| **Canal** | Llamada de **Discord en directo** durante toda la sesión + mensajes escritos para enlaces/decisiones |
| **Pair programming** | **Driver/navigator** con rotación cada 45–60 min: uno escribe y comparte pantalla, el otro revisa, busca y decide; se alternan por área (frontend/backend) y en la integración trabajan los dos |
| **Pair en los momentos críticos** | Importación de los 3 ficheros, contrato API, briefing y ensayo de demo: siempre a dos ojos |
| **Agentes de IA** | Tercer participante: generan código/documentación, proponen alternativas y debaten tecnología; se lanzan en paralelo sobre ficheros disjuntos mientras el par humano revisa |
| **Debate y decisión** | Cada decisión técnica se contrasta con la IA (ventajas, riesgos, coste en horas) y se cierra por consenso; queda registrada en [`docs/decisiones.md`](../decisiones.md) |
| **Revisión cruzada** | Nadie acepta su propio cambio sin que el otro lo haya probado (5 min) |
| **Comunicación asíncrona** | El repo es la fuente de verdad: `main` siempre desplegable, commits pequeños, push cada hora |

**Por qué pair programming en una hackathon:** dos personas con fortalezas complementarias (frontend/backend) evitan callejones sin salida, comparten contexto sin reuniones largas y permiten que cualquiera de los dos pueda presentar o recuperar la demo.

## 3. Plan de trabajo coordinado (2 personas + agentes)

**Cadencia:**
- **Checkpoint interno cada 90 min**: demo de lo que funciona + decisión de continuar o recortar (5 min, en voz).
- **Rotación de driver** cada 45–60 min o al terminar un hito.
- **Regla de los 20 minutos:** bloqueo >20 min → se comenta en voz, se busca alternativa o se recorta la feature.
- **Congelaciones:** esquema sábado 18:00 · dependencias 20:00 · funcionalidad domingo 10:00 · código 12:00 · repo verificado 13:30.

**Reparto por bloques (8 h realistas con 2 personas + agentes):**

| Reloj | Backend/Data ([NOMBRE COMPAÑERO]) | Frontend/Producto (Jose Miguel) | Gate conjunto (pair) |
|---|---|---|---|
| H+0:00–0:30 | Scaffold API + contrato + SQLite/seed | Scaffold SPA + tokens VetLink + router | `uvicorn` + `pnpm dev` + `/api/health` |
| H+0:30–2:30 | Extractores docx/xlsx/json/csv · canónico · alertas · endpoints | Pantallas 1–3 (login, bandeja/importación/revisión, marketplace) con mock | `curl` importa 3 ficheros; front navega |
| H+2:30–4:00 | Briefing determinista · resumen pre-aceptación · auditoría | Pantallas 4–5 (reserva/agenda, briefing) + integración API real | **E2E**: importar → ficha → solicitar → aceptar → briefing |
| H+4:00–5:00 | Reset/caché demo · CSV de robustez · pruebas de humo | Responsive del briefing · estados vacío/error · pulido | Demo repetible ×3 sin tocar código |
| H+5:00–6:00 | Vídeo (grabar) + README técnico | Guion y ensayo del pitch · capturas | Repo clonable + vídeo + ensayo cronometrado |
| H+6:00–8:00 | Buffer: bugs P0 y entrega | Buffer: ensayo y entrega | `main` verificado y aviso a organización |

**Reglas de coordinación en repo:**
- `main` siempre desplegable; commits pequeños y push al menos cada hora.
- Ramas cortas `feat/…`, `fix/…`; PR/merge inmediato; antes de retomar: `git pull --rebase`.
- **Ficheros de propiedad disjunta** para agentes y para trabajo individual: `services/api/**` (backend) y `apps/web/**` (frontend); `docs/` se toca en pareja o con aviso.
- **Contrato API congelado** a los 30 min; cualquier cambio se debate, se registra y se avisa.
- **Nada de secretos en el repo**; los datos de demo salen de `data/samples/` y `docs/ejemplos/`.

## 4. Riesgos de equipo y mitigación (bus factor)

| Riesgo | Mitigación |
|---|---|
| Una persona se cae (conexión, cansancio) | Todo está en el repo + seed + vídeo; la demo se puede hacer con una sola persona y el backend ya está arrancado |
| Bloqueo compartido (los dos atascados en lo mismo) | Regla de 20 min + agentes en paralelo + recorte de alcance con el plan de §3 |
| Pair programming se convierte en charla sin avanzar | Driver/navigator explícito, rotación cada 45–60 min y checkpoint de demo cada 90 min |
| Los agentes generan código que nadie revisa | Revisión cruzada obligatoria + gates verificables (`curl`, navegador, seed) |
| Cansancio el domingo | Descanso 00:00–08:00; congelación domingo 10:00; ensayo con antelación |

## 5. Mapa criterio → evidencia

| Lo que pide el checkpoint | Dónde está la evidencia |
|---|---|
| Roles claros | §1: referentes por área (producto/frontend vs backend/datos) y entregables |
| Líderes identificados | Jose Miguel (coordinación/pitch/demo) · [NOMBRE COMPAÑERO] (arquitectura/datos); decisiones por consenso con referente por área |
| Plan de trabajo coordinado | §2 (pair programming, Discord, rotación, IA como apoyo) y §3 (cadencia, bloques, gates) |
| Plan vivo, no de PowerPoint | Historial de commits en `main`, [registro de decisiones](../decisiones.md) y `PLAYBOOK.md` |

## 6. Guion de 90 segundos (si es una llamada)

1. "Somos dos, en pair programming y en llamada de Discord todo el finde: debatimos y decidimos en conjunto."
2. "Yo, Jose Miguel, llevo producto, frontend y demo; mi compañero lleva backend, datos e integración. Cada uno es referente de su área, pero el alcance y las prioridades los cerramos por consenso."
3. "Usamos la IA como tercer participante para debatir tecnología y acelerar; la verificación y la firma son nuestras."
4. "Cadencia: checkpoint interno cada 90 min con demo de lo que funciona, rotación driver/navigator y congelaciones progresivas hasta la entrega del domingo a las 13:30."
5. "Todo queda en el repo: playbook, registro de decisiones y commits. Si una persona cae, la otra puede hacer la demo con el seed y el vídeo."
