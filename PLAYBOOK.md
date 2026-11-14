# PLAYBOOK · VetLink — Reto 3 · VIII Hackathon Boehringer Ingelheim España

> **Documento maestro de trabajo y ritmo del equipo.**  
> Ventana real: sábado 14/11/2026 01:00 → domingo 15/11/2026. **Trata el domingo 13:30 como deadline real** (el oficial lo anuncia la organización; asumimos 15:00 CET).  
> Versión 1.6 · 14/11/2026 02:25 · Lead (agente) para el equipo Joniha.  
> Cambios v1.6: **calendario oficial re-anclado** (CP1 sáb 12:00 · CP2 sáb 18:00 · CP3 dom 14:45, 15 min cada uno, cámara on, sala del jurado) y plan hora a hora reescrito (§8). H+0 ejecutado en local con agentes. **GitHub congelado por indicación del equipo: nada de push.**  
> Cambios v1.5: **organización real confirmada** — 2 personas en **pair programming** por Discord, decisiones conjuntas con IA como apoyo; Jose Miguel = frontend/producto/demo; compañero = backend/datos. Roles (§7) y modo de trabajo actualizados, nuevo [`docs/decisiones.md`](docs/decisiones.md) como registro de decisiones.  
> Cambios v1.4: **equipo real = 2 personas**; roles y liderazgos reescritos (§7), ritmo ajustado (§8.5) y paquete de **los 3 checkpoints oficiales** en `docs/checkpoints/` (§13).  
> Cambios v1.3: **stack rápido aprobado** — React + Vite + Tailwind + **DaisyUI** · FastAPI + **SQLModel + SQLite** · auth demo por cookie · **un solo proceso en demo** (FastAPI sirve la SPA). Sin Supabase, sin Docker en el camino crítico y sin LLM en la demo; Postgres-ready. Elimina ~4–6 h de infra.  
> Cambios v1.2: cierra las decisiones abiertas con Data (`docs/02-modelo-datos.md`): congelar nombres v1 + `fhir_profile`, gate de revisión con banner, alcance del resumen pre-aceptación y fixture CSV de robustez.  
> Cambios v1.1: integra el debate red-team (`docs/03-debate-diseno.md`) y la investigación (`docs/06-investigacion-mercado.md`): recorte a **C'** (5 pantallas), briefing determinista, resumen no identificativo antes de aceptar, demo local-first y reloj de congelaciones.

---

## 0. Resumen en 60 segundos

- **Qué es:** la VIII Hackathon de Boehringer Ingelheim España, virtual, del 13 al 15 de noviembre de 2026. Tres retos, premios de 3.000/2.500/2.000 € por reto, y un jurado que evalúa **viabilidad técnica y funcionamiento del prototipo** el domingo.
- **Nuestro reto (Reto 3):** *"Menos papeleo, más cuidado: los datos al servicio de la clínica"* — homogeneizar la historia clínica veterinaria que llega en Word/Excel/JSON, montar un marketplace de especialistas y conectar ambas piezas para que el especialista vea el caso antes de la visita.
- **Nuestra apuesta:** **VetLink** = la historia clínica en un formato único + la red de especialistas + el **briefing pre-visita**. Pitch: *"La historia clínica de tu paciente llega completa al especialista antes de la visita."*
- **Decisiones clave del debate:** alcance **C' recortado** (5 pantallas, ~40–48 h-persona), **briefing determinista** (la IA solo extrae), **resumen no identificativo antes de aceptar**, **demo local-first** con seed y vídeo.
- **Stack rápido (v1.3):** React + Vite + Tailwind + **DaisyUI** · FastAPI + **SQLModel + SQLite** · auth demo por cookie · **un solo proceso en demo** (FastAPI sirve la SPA). Sin Supabase, sin Docker en el camino crítico, sin LLM en la demo. Postgres-ready.
- **Estado:** repo con documentación, checkpoints y estructura (0 código de app), ~36 h de reloj, **equipo de 2 personas**. Plan por bloques con hitos demoables y congelación progresiva.

---

## 1. La hackathon: qué es y cómo se gana

| Dato | Valor |
|---|---|
| Organiza | Boehringer Ingelheim España (IT Hub España) · VIII edición |
| Lema | *"Arquitectos del futuro de la salud en España"* |
| Formato | Virtual, por equipos · **13–15 noviembre 2026** |
| Premios | **3.000 € / 2.500 € / 2.000 €** (uno por reto) |
| Evaluación | Jurado al cierre del domingo: **viabilidad técnica y funcionamiento de los prototipos** |
| Entrega | Solo por el repo del equipo: `github.com/HackathonBoehringerIT/Joniha` → **todo en `main`** antes del deadline |
| Nuestro reto | Reto 3: datos clínicos veterinarios + marketplace de especialistas + conexión entre ambos |

**Cómo se gana una hackathon (reglas no escritas):**
1. **Que la demo funcione.** El jurado recordará lo que vio funcionar; un botón muerto es peor que una feature ausente.
2. **Resolver el problema exacto que se pidió**, con los datos exactos que te dieron.
3. **Una historia de 60 segundos**: antes → después → impacto.
4. **Un "wow" diferencial** que nadie más tenga: el briefing pre-visita con procedencia y control de acceso.
5. **Rigor en salud:** datos sintéticos, minimización, consentimiento y auditoría visibles.
6. **Cero scope creep.** Cada minuto que no se ve en la demo es un minuto perdido.

**Nuestra ventaja:** los otros equipos tenderán a elegir el normalizador *o* el marketplace. Nosotros hacemos **el puente entre ambos**, que es el tercer requisito del dossier y el que más duele en la vida real.

**El jurado no evalúa la idea: evalúa si el prototipo aguanta que él lo toque.** En cuatro minutos pedirá: entrar, subir un fichero, preguntar "¿de dónde sale este dato?", "¿quién puede verlo?", "¿y con un formato que no es de los vuestros?", "¿esto es un dispositivo médico?" y pulsar "contratar". Esas seis respuestas van ensayadas.

---

## 2. El tema: qué nos piden de verdad

> Detalle completo en **[`docs/01-reto-analisis.md`](01-reto-analisis.md)**.

**Problema.** La información clínica existe, pero está incompleta, desordenada o infrautilizada. Laura (generalista) no tiene especialista a mano y no sabe a quién llamar; Marc (especialista ambulante) llega a la clínica y dedica los primeros minutos a reconstruir la historia que le ha llegado en Word, Excel o un JSON de otro sistema.

**Los 3 requisitos literales del reto:**
1. Subir la información clínica en **formatos distintos** y **homogeneizarla dinámicamente** en un único formato comprensible por cualquier veterinario. *(Matiz: "usarlos como guía, no como los únicos archivos"; cada clínica puede tener formatos distintos.)*
2. Ser un **marketplace**: clínicas encuentran/contratan especialistas; especialistas ofrecen servicios y organizan su agenda.
3. **Conectar ambas piezas**: la historia llega completa y ordenada, y el especialista puede **verla antes de ver al paciente**.

**Personas:** Laura (CLINIC), Marc (SPECIALIST). Tutora (Carmen) fuera del MVP, en el relato de roadmap.

**Datos de ejemplo (3 pacientes, 3 ontologías):** Bruno (Word clínico), Luna (Excel de PMS, 13 hojas), Kira (JSON de API) + **fixture CSV de robustez** (`data/samples/export_clinica_norte.csv`, paciente Nala) para demostrar homogeneización dinámica. Ver `docs/01-reto-analisis.md`, `docs/02-modelo-datos.md` y `data/samples/`. El modelo canónico ya está implementado y validado en `docs/ejemplos/canonico-*.json` (132 entidades, 1.785 campos, 22 alertas con evidencia).

**Datos de mercado que sostienen el pitch** (fuente: `docs/06-investigacion-mercado.md`): **7.032 clínicas** de animales de compañía en España; **~92% independientes**; **~70% con 1–2 veterinarios**; **~400 especialistas diplomados**, más de la mitad trabajando fuera; **64%** de los veterinarios encuestados por la FVE dice que el papeleo se ha duplicado; **>10 h/semana** en tareas administrativas de prescripción. El mercado de software/clínicas factura **3.069 M€**. No hay un estándar de intercambio veterinario operativo en España (VetXML es UK).

**Criterios de éxito medibles del MVP:** 3 fichas canónicas en <30 s · alertas correctas por paciente · búsqueda + solicitud de especialista · briefing antes de aceptar · calendario sincronizado · **4º formato desconocido (CSV) que no rompe** · métrica 10–15 min → 90 s.

---

## 3. Producto: VetLink

**Pitch de 30 segundos:**
> *"Cada clínica veterinaria pequeña trabaja con un software distinto y un papeleo distinto. Cuando necesita un especialista, llama, cruza los dedos y le manda la historia como puede. VetLink normaliza la historia clínica en un formato único, conecta a la clínica con el especialista que necesita y le entrega un informe que puede leer antes de ver al paciente. Menos papeleo, más cuidado."*

### Los 3 pilares (mapean 1:1 con los requisitos)

| Pilar | Qué es | Cómo se ve en la demo |
|---|---|---|
| **VetRecord (normalización)** | Ingesta Word/Excel/JSON/CSV → registro canónico con provenance y alertas | Subir 3 ficheros + un CSV con columnas raras → 4 fichas con alertas |
| **VetNetwork (marketplace)** | Directorio de especialistas por especialidad, zona, disponibilidad y tarifa; solicitud + agenda | Laura busca dermatología y solicita |
| **VetBriefing (puente)** | Briefing pre-visita determinista + resumen no identificativo antes de aceptar | Marc lo lee *antes* de aceptar y ve la historia al aceptar |

### Alcance MVP — versión C' (recortada, ver §4)

**Pantallas del MVP (5):**
1. **Login/rol** (clínica o especialista).
2. **Paciente + subida + revisión** (bandeja con los 3 pacientes, importador multi-fichero, panel de revisión con procedencia).
3. **Búsqueda + ficha de especialista** (servicio, precio, disponibilidad, solicitud).
4. **Reserva/agenda** (franjas, aceptación, cita confirmada).
5. **Informe/briefing** (resumen no identificativo antes de aceptar; historia completa después; auditoría de acceso).

| | Incluye |
|---|---|
| **Must** | Las 5 pantallas · 3 formatos + 1 CSV desconocido · registro canónico + provenance + confianza · alertas · solicitud/aceptación/cita · briefing con resumen no identificativo y control post-aceptación · seed + botón reset · README + vídeo |
| **Should** | Mapeador asistido de columnas · panel de auditoría de accesos · estados de error claros · "matriz de soporte de formatos" en README |
| **Could** | Chat del caso · cierre de visita del especialista · landing pública · área del dueño (solo mención) · exportar informe a PDF · teleconsulta (mencionar) |
| **Won't** | Pagos reales · OCR/PDF escaneado · integración directa con PMS/FHIR · estrellas/reseñas · notificaciones reales · app móvil nativa · IA diagnóstica · multi-idioma |

**Regla del red-team que se aplica:** "5 pantallas sin callejones sin salida valen más que 12 con 3 muertas".

### Modelo de negocio (slide, no código)

- **SaaS clínica:** 39 €/mes (hasta 200 historias/mes) → normalización + red de especialistas.
- **Comisión por derivación:** 12 % del importe del servicio (fase 2; en la demo solo se muestra el precio del servicio).
- **Plan especialista:** 19 €/mes o gratis hasta 3 visitas (efecto red).
- **Partner Boehringer:** datos agregados de prevención/adherencia (vacunas, desparasitación, revisiones) con consentimiento → encaje con su agenda de salud animal. *Nunca datos individuales sin consentimiento.*
- **TAM/SAM/SOM orientativo** (`docs/06`): TAM SaaS ≈ 4,2 M€/año; SOM año 1 realista 90–360 k€ ARR con 150–300 clínicas. No presentar el mercado de 3.069 M€ como "mercado de software".

### Por qué ganamos (y por qué no es otro PMS)

| Alternativa | Por qué VetLink no la sustituye |
|---|---|
| Software de gestión clínica (QVET, Wakyma, Provet, Winvet…) | No competimos: nos integramos por export/API; el pivot es la **red de especialistas** y el briefing |
| Marketplace genérico de servicios (Gobuddie, Vetyou) | No es un directorio muerto: el briefing es el **motivo de contratación** y la normalización es el foso técnico |
| Telemedicina (FirstVet, Joii, Vetster) | No operan en España o son virtuales puros; aquí se prepara la visita presencial, no se diagnostica |
| "Chat con IA que resume historias" | No basta con resumir: hay que **estructurar**, validar y llevar el caso a una **transacción** (visita) |

**Roadmap post-hackathon:** app del tutor con recordatorios · OCR/PDF · conectores PMS (API/exportadores) · pagos con Stripe Connect · matching inteligente · export FHIR R4 (`Patient-animal`) · métricas de prevención.

---

## 4. Debate y decisiones (brainstorm documentado)

> Debate completo con puntuaciones, falsadores y objeciones del jurado en **[`docs/03-debate-diseno.md`](03-debate-diseno.md)**.

### Opciones debatidas (nota /10 con pesos: encaje 35%, funciona 25%, viabilidad 20%, wow 10%, riesgo 10%)

| Opción | Nota | Esfuerzo | Veredicto |
|---|---:|---|---|
| A) Normalizador puro | 5,90 | 25–30 h | Plan B si no hay equipo; incumple el reto |
| B) Marketplace puro | 4,80 | 30–35 h | No: commodity, no usa los datos |
| C) Capa + marketplace + briefing (mi propuesta inicial) | 7,65 | 55–65 h | Dirección correcta, inviable tal cual |
| **C') C recortado** ✅ | **8,35** | **40–48 h** | **Recomendado:** 5 pantallas, +mapeador, briefing determinista |
| D) Solo briefing con IA | 5,20 | 15–20 h | No: riesgo de alucinación, incumple marketplace |

**Veredicto:** **C'**. No es una versión tímida de C: es C sin el ~40% de alcance que no puntúa (dueño, chat, reseñas, landing, notificaciones) y con dos cambios que sí puntúan (mapeador asistido + resumen no identificativo antes de aceptar).

### Decisiones cerradas

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Tres pilares** y el briefing como "wow" | Es el 3er requisito y el diferencial frente a otros equipos |
| D2 | **Sin pagos reales** (comisión como slide; precio de servicio sí visible) | Stripe/KYC/impuestos no caben; "contratar" se demuestra con estado |
| D3 | **Briefing determinista** (plantilla sobre el registro canónico); el LLM solo extrae texto libre | Es la pantalla que más mira el jurado y la de mayor riesgo legal |
| D4 | **Provenance + confidence por campo**, revisión humana obligatoria en campos críticos | Es salud; protege la demo y la credibilidad |
| D5 | **Resumen no identificativo antes de aceptar; historia completa después** | Minimización RGPD + la mejor demostración de "conectar" |
| D6 | **Dueño/tutor fuera de la demo** (fase 2) | El reto es clínica↔especialista |
| D7 | **Stack rápido (v1.3):** React + Vite + TS + Tailwind + **DaisyUI** · FastAPI + **SQLModel + SQLite** · auth demo por cookie · **un solo proceso en demo** (FastAPI sirve la SPA) · sin Supabase, sin Docker crítico, sin LLM en demo · **Postgres-ready** | Menos piezas = menos fallos y ~4–6 h menos de infra; migrar a Postgres es cambiar la URL de conexión |
| D8 | **Mapeador asistido** para tabulares + **4º formato CSV** con cabeceras no vistas | "Homogeneizar dinámicamente" ≠ 3 importadores hardcodeados |
| D9 | **Marca VetLink congelada**; tagline de pitch: "La historia clínica llega completa al especialista" | Hay prior art de "VetLink" en UK/UAE/IDEXX: no invertir en dominio; el nombre no puntúa, el mensaje sí |
| D10 | **Demo local-first** + seed/reset + vídeo + segundo portátil | El jurado evalúa funcionamiento; la wifi no puede decidir |
| D11 | **Congelaciones:** esquema sáb 18:00 · dependencias sáb 20:00 · features dom 10:00 · código dom 12:00 · repo verificado dom 13:30 | El buffer no es opcional |
| D12 | **Formato canónico inspirado en FHIR** (Patient, Encounter, Condition, MedicationStatement, AllergyIntolerance, Immunization, Observation, DocumentReference) + provenance | Es el idioma que un director de IT respeta y da respuesta a "¿de dónde sale este dato?" |
| D13 | **Congelar nombres v1 en los JSON** (`problems`, `documents`…) + `fhir_profile` 1:1; renombrar a v1.1 después de la demo | Renombrar a mitad rompe UI y contratos; el `fhir_profile` demuestra la equivalencia sin coste |
| D14 | **Gate de revisión con banner**, no bloqueo: el briefing se puede ver con "N campos críticos pendientes de revisión" y `reviewed_by` visible | La demo necesita enseñar el flujo completo; el banner demuestra rigor sin callejón sin salida |
| D15 | **Resumen pre-aceptación:** especie, raza, edad, sexo/esterilización, peso/BCS, motivo, 2–3 alertas, urgencia, servicio y **precio orientativo**. Se ocultan siempre PII del tutor, microchip completo, documentos y facturas | Fija el texto exacto de la pantalla y evita filtrar datos antes de contratar |

### Supuestos peligrosos (resumen del red-team)

| Supuesto | Falsador | Mitigación |
|---|---|---|
| "Con los 3 ficheros basta; el jurado no probará otro" | CSV sintético con cabeceras raras subido por alguien ajeno | Mapeador asistido + matriz de soporte en README |
| "El LLM extrae bien dosis y alergias" | 10–20 documentos sintéticos held-out; si acierto crítico <90%, cambiar discurso | Reglas para lo estructurado; LLM solo texto libre; revisión obligatoria |
| "La demo en vivo saldrá" | 3 ensayos con la red del evento, arranque en frío | Local-first, seed, vídeo, segundo portátil |
| "30 h alcanzan" | Burn-down sábado 20:00: ¿flujo end-to-end? Si no, recorta ese mismo día | Vertical slice; congelación de alcance |
| "El deadline es domingo 15:00" | Anuncio oficial | Tratar dom 13:30 como deadline real; versión enviable el sábado noche |
| "Los ficheros no tienen PII" | El Word trae nombre/DNI/teléfono ficticios del tutor | Demo con datos sintéticos; no enviar PII a LLM; aviso en UI |
| "El briefing puede decir cualquier cosa" | Revisión veterinaria del texto | Plantilla determinista, sin diagnóstico/dosis, disclaimer "no sustituye el juicio clínico" |

### Preguntas abiertas para el equipo/usuario

1. **Deadline exacto** (y zona horaria) — confirmar con la organización y anotarlo en `docs/00`.
2. **Composición real del equipo** (para mapear roles del §7 y validar las 40–48 h-persona de C').
3. ¿Confirmáis **SQLite para la demo** (recomendado, cero infra) o preferís Postgres/Supabase para el pitch? El modelo es Postgres-ready.
4. ¿Alguien ha aceptado la invitación a la org de GitHub y puede pushear? (probar hoy).
5. ¿Quién narra el pitch y quién hace la demo?
6. ¿Requisitos de entrega de la organización (vídeo, URL, README)?

---

## 5. Arquitectura y datos

> Detalle en **[`docs/05-arquitectura-mvp.md`](05-arquitectura-mvp.md)** y **[`docs/02-modelo-datos.md`](02-modelo-datos.md)**.

**Stack (cerrado, v1.3):** React + Vite + TS + Tailwind + **DaisyUI** · FastAPI (Python 3.12) + **SQLModel + SQLite** · auth demo por cookie firmada · **un solo proceso en demo** (FastAPI sirve la SPA compilada) · sin Supabase, sin Docker en el camino crítico, sin LLM en la demo · Postgres-ready. Detalle en [`docs/05-arquitectura-mvp.md`](05-arquitectura-mvp.md).

**Pipeline diferencial:** `upload → sniff de formato → adaptador (docx/xlsx/json/csv/generic-LLM) → validación de esquema → revisión humana de campos dudosos → normalización → matching de paciente → merge con provenance → registro canónico JSONB → alertas → briefing determinista`.

**Reglas:**
- El pipeline devuelve resultado parcial, nunca un error global.
- Añadir un formato = añadir un adaptador, no tocar el core.
- El **mapeador asistido** propone mapeo de columnas desconocidas y el usuario confirma.
- El **briefing es determinista**; el LLM no redacta el informe.
- Modelo canónico **versionado y FHIR-inspired** con `system`/`code`/`display` donde aplique (SNOMED VetSCT/VeNom como mapeo declarado, no como estándar propio).

**Estructura de repo (ya creada):**

```
Joniha/
├── README.md              # pitch, arranque, links, matriz de soporte de formatos
├── PLAYBOOK.md            # este documento
├── docs/                  # 00 contexto · 01 reto · 02 datos · 03 debate · 04 flujos · 05 arquitectura · 06 mercado
│   ├── diagramas/         # 4 diagramas HTML navegables (Archify)
│   └── ejemplos/          # registros canónicos JSON de ejemplo
├── apps/web/              # React + Vite + TS + Tailwind + DaisyUI (README con pantallas y rutas)
├── services/api/          # FastAPI + SQLModel + extractores + seed (README con estructura y contrato)
├── data/samples/          # los 3 ficheros del reto + CSV de robustez (copias)
├── data/vetlink.db        # SQLite de la demo (gitignored; se genera al arrancar)
└── scripts/               # demo:reset y utilidades (docker-compose opcional, fuera del camino crítico)
```

**Herramientas del equipo:** plugin **Archify** instalado en el perfil DSH (skill-only, sin UI propia) → genera los diagramas HTML navegables de `docs/diagramas/` (flujos, arquitectura, secuencia) y sirve para el pitch.

---

## 6. Flujos de usuario y de uso de la app

> Detalle en **[`docs/04-flujos-usuarios.md`](04-flujos-usuarios.md)**. Diagramas en `docs/diagramas/`:
> - `flujo-usuarios.html` — viaje completo Laura → VetLink → Marc (con ramas)
> - `flujo-uso-app.html` — recorrido pantalla a pantalla
> - `arquitectura-vetlink.html` — componentes y fronteras
> - `secuencia-importacion-briefing.html` — pipeline técnico y aceptación

**Pantallas:** S1 Landing · S2 Login · S3 Home clínica · S4 Importar · S5 Ficha canónica · S6 Marketplace · S7 Perfil especialista · S8 Solicitud · S9 Home especialista · S10 Briefing · S11 Calendario · S12 Chat · S13 Cierre · S14 Configuración.

**Recorte C' para la demo (importante):** se implementan **S2 · S4+S5 · S6+S7 · S8+S11 · S10** (agrupadas en 5 pantallas). S1/S12/S13/S14 quedan fuera del MVP; S3 se simplifica a bandeja de pacientes. El flujo completo (A–E) sigue documentado como referencia y para el roadmap.

**Flujos clave:** A) importar historias · B) buscar y solicitar especialista · C) recibir, leer briefing y aceptar · D) visita y cierre · E) recorrido de demo · F) tutor (fase 2).

**Estados:** solicitud `DRAFT → REQUESTED → ACCEPTED → SCHEDULED → COMPLETED` (+ `DECLINED`/`CANCELLED`/`EXPIRED`); importación `UPLOADING → PARSING → NEEDS_REVIEW → READY` (+ `FAILED`).

---

## 7. Estructura de trabajo: equipo, roles y reglas

### Roles y modo de trabajo (equipo real: 2 personas en pair programming)

| Persona | Fortaleza | Referente de | Entregable del día |
|---|---|---|---|
| **Jose Miguel** | Frontend / producto / UX | Coordinación general, pitch y demo; UI, 5 pantallas, marca VetLink, vídeo | 5 pantallas demoables + guion + vídeo |
| **[NOMBRE COMPAÑERO]** | Backend / datos | Arquitectura técnica y datos: API FastAPI, SQLite, extractores, modelo canónico, seed, integración | API viva + seed reproducible + 3 fichas normalizadas |

**Modo de trabajo (acordado 14/11 02:09):**
- **Pair programming** con **llamada de Discord en directo** toda la sesión; **driver/navigator** con rotación cada 45–60 min.
- **Decisiones por consenso**: cada área tiene referente (producto/frontend = Jose; backend/datos = compañero); si hay empate, decide el referente del área y se registra.
- **IA como tercer participante**: se usa para debatir alternativas técnicas y acelerar tareas; el humano verifica y firma.
- **Registro de decisiones** en [`docs/decisiones.md`](docs/decisiones.md): toda decisión de alcance, contrato, modelo o stack se anota el mismo día.
- **Revisión cruzada:** nadie acepta su cambio sin que el otro lo pruebe (5 min).
- **Bus factor:** todo lo que no esté en el repo no existe → playbook, decisiones, seed y vídeo siempre actualizados.

*Si en algún momento sois 3:* se añade un tercero a demo/QA. *Si queda 1 persona:* versión comprimida §8.3 con seed + vídeo.

### Reglas del repo (se votan y no se cambian el domingo)

1. `main` **siempre desplegable**. Commits pequeños; push al menos cada hora.
2. Ramas cortas `feat/...`, `fix/...`, `docs/...`; PR solo si toca código de otro dueño; merge rápido.
3. **Commits:** `feat:`, `fix:`, `docs:`, `data:`, `chore:`, `demo:` + descripción corta en español.
4. **Nada de secretos** (`.env`, claves); `.env.example` sí.
5. Los **4 ficheros de ejemplo** (3 del reto + 1 CSV de robustez) viven en `data/samples/`.
6. **Contrato API** de `docs/05` es la frontera front/back: si cambia, avisar en el canal.
7. No se toca el modelo canónico sin avisar a Data + Frontend.
8. `README.md` se actualiza **hoy**, no el domingo.
9. Toda decisión relevante se registra en [`docs/decisiones.md`](docs/decisiones.md): es la prueba de plan vivo y coordinado en los checkpoints.

### Gestión de tareas

- Tablero (GitHub Projects o Issues): **Backlog · En curso (WIP máx. 2/persona) · En revisión · Hecho**.
- Cada tarea con dueño, criterio de aceptación observable y marca 🏁 si entra en la demo.
- Revisión del tablero en cada checkpoint.
- **Definición de Hecho (DoD):** visible en la demo · estados vacío y error · sin secretos · commit en `main` · documentación tocada si aplica · 0 bugs P0.

---

## 8. Ritmo: plan hora a hora

> **Calendario oficial (recibido por correo, equipo nº 23 “Joñiha”):** **CP1 sábado 12:00 · CP2 sábado 18:00 · CP3 domingo 14:45**. Cada checkpoint: **15 minutos**, en la sala virtual del jurado, **cámara encendida** y conectarse **solo** a la hora del equipo. El plan de abajo está re-anclado a esos tres hitos.
>
> Ancla de trabajo: **ahora** = sábado 14/11 02:20; H+0 (scaffold + contrato + seed) se ejecuta con agentes en paralelo 02:20–03:00. El plan del red-team manda: vertical slice primero y recorte en el mismo día si el burn-down falla.

### 8.1 Sábado 14

| Franja | Bloque | Objetivo | Entregable/Hito | Checkpoint |
|---|---|---|---|---|
| 02:20–03:00 | **H+0 · Base** | Scaffold `apps/web` + `services/api`, contrato congelado, SQLite con seed de los 3 pacientes (agentes en paralelo) | Base levantando en local | — |
| 03:00–08:00 | **Descanso** | Dormir; los humanos no rinden a las 4 a.m. | — | — |
| 08:00–08:30 | Kickoff | Revisar H+0 en pareja, arrancar backend+frontend y validar `/api/health` y seed | Entorno verificado | Standup 10' |
| 08:30–11:15 | **B1 · Demo CP1** | Login+seed+import cache+ficha de paciente; repasar CP1 y plan | **H1 (11:15): demo mínima + CP1 listo** | Demo interna 1 |
| 11:15–11:45 | **Preparación CP1** | Cámara, audio, pantalla compartida, sala virtual, 3 mensajes clave | **11:45: demo congelada (solo hotfix)** | Ensayo 15' |
| **12:00–12:15** | **CP1 con el jurado** | Revisión de avance | **CP1 entregado** | — |
| 12:15–13:30 | **B2 · Normalizador real** | Extractores DOCX/XLSX/JSON/CSV + panel de revisión con procedencia | Import real de los 3 ficheros | — |
| 13:30–14:15 | Comida | — | — | — |
| 14:15–17:15 | **B3 · Marketplace + briefing** | Búsqueda/ficha, solicitud, aceptación, agenda y briefing con niveles de acceso | **H2 (17:15): flujo Laura→Marc end-to-end** | Demo interna 2 |
| 17:15–17:45 | **Preparación CP2** | Propuesta de solución + demo corta; repasar CP2 | **17:45: demo CP2 congelada** | Ensayo 15' |
| **18:00–18:15** | **CP2 con el jurado** | Propuesta de solución y avance | **CP2 entregado** | — |
| 18:15–20:00 | Cena + pulido | CSV desconocido, auditoría, estados de error | — | Demo interna 3 |
| 20:00–24:00 | **B4 · Demo completa + vídeo** | Reset/seed, responsive, vídeo de 3 min, README | **H4 (24:00): demo completa + vídeo grabado** | — |
| 00:00–08:00 | **Descanso obligatorio** | Dormir. El domingo se gana con cabeza fresca | — | — |

### 8.2 Domingo 15

| Franja | Bloque | Objetivo | Entregable/Hito | Checkpoint |
|---|---|---|---|---|
| 08:00–08:30 | Standup | Revisar bugs P0 y burn-down | Lista P0 | 10' |
| 08:30–10:00 | **B5 · QA final** | Repasar los 3 casos + CSV, ensayo del guion | **10:00: feature freeze** | Solo bugs |
| 10:00–12:00 | **B6 · Ensayo + README** | Ensayo cronometrado, README final, matriz de soporte, repo local verificado | **12:00: code freeze** | Ensayo |
| 12:00–13:30 | **B7 · Cierre y entrega** | Verificar repo/vídeo/checklist §11; decidir push a GitHub (hoy congelado) | **13:30: listo para entregar** | Checklist §11 |
| 13:30–14:15 | **Preparación CP3** | Cámara, sala, demo de respaldo, guion de 15 min | **14:15: demo final congelada** | Ensayo final |
| **14:45–15:00** | **CP3 con el jurado** | Solución y demo final | **CP3 entregado** | — |
| 15:00+ | Entrega final | Según instrucciones de la organización | — | — |

### 8.3 Si el equipo empieza más tarde (versión comprimida)

| Horas disponibles | Plan mínimo que SÍ se entrega |
|---|---|
| ≥ 16 h | Plan completo (B1–B7) |
| ~10 h | Login + paciente/subida/revisión + búsqueda/ficha + reserva + briefing + seed + vídeo; sin mapeador CSV ni auditoría |
| ~6 h | Normalizador + 3 fichas + briefing con datos reales; marketplace mock; vídeo grabado |
| < 6 h | Registro canónico de Bruno + ficha + briefing + vídeo; documentación y README |

**Nunca se recorta:** los tres ficheros de ejemplo, el briefing de Marc, el resumen no identificativo pre-aceptación y el vídeo.

### 8.4 Cadencia y rituales

- **Standup de 10 min** al inicio de cada bloque: qué hice / qué haré / qué me bloquea.
- **Demo interna de 10 min** al final de cada bloque: solo lo que funciona, en el orden del guion.
- **Regla de los 20 min:** bloqueado >20 min → pide ayuda.
- **Regla del corte:** si una feature no entra en la demo, se corta sin drama y se apunta como fase 2.
- **Congelaciones duras (re-ancladas a los checkpoints):** contrato API desde H+0 · modelo/esquema sáb 14:00 · demo CP1 sáb 11:45 · demo CP2 sáb 17:45 · funcionalidad dom 10:00 · código dom 12:00 · repo local verificado dom 13:30 · demo final dom 14:15.
- **Canal único** de coordinación + hilo con la organización. Decisiones y enlaces se pegan ahí.
- **Métrica de ritmo:** cada bloque acaba con algo enseñable a alguien ajeno al equipo.

---

### 8.5 Modo agentes (si la implementación la hacen agentes en paralelo, ~6 h)

**Condiciones no negociables:** contrato API congelado a los 30 min · 3 workstreams con ficheros disjuntos (backend / frontend / seed-demo) · 1 humano integrando y aceptando gates cada 60–90 min. Si dos agentes tocan el mismo fichero, los 6 h no se cumplen.

**Con 2 personas (situación real, pair programming + Discord):** Jose = frontend/producto/demo; compañero = backend/datos/integración. Los agentes trabajan en paralelo sobre ficheros disjuntos mientras el par humano revisa. Presupuestad **8 h** (6 h solo si ambos están a tiempo completo y sin bloqueos) y aplicad la tabla de recorte sin dudar. El material de los 3 checkpoints oficiales ya está en `docs/checkpoints/`.

| Reloj | Bloque | Entregable / gate |
|---|---|---|
| H+0:00–0:30 | Scaffold + contrato + seed (**ejecutado 02:20–03:00 con agentes**) | `uvicorn` + `pnpm dev` + `/api/health` + SQLite con los 3 pacientes |
| H+0:30–2:00 (paralelo) | A: API+DB+extractores+alertas · B: SPA shell + pantallas 1–3 con mock | `curl` importa los 3 ficheros; el frontend navega con mocks |
| H+2:00–3:30 | Integración E2E | importar → ficha → solicitar → aceptar → briefing |
| H+3:30–4:30 | Robustez: CSV + mapeador, reset/caché, 3 repeticiones | demo repetible y determinista (<2 s) |
| H+4:30–5:15 | Vídeo 3 min + README | repo clonable y levantable por alguien ajeno |
| H+5:15–6:00 | Ensayo + entrega | `main` pusheado, checklist §11 cumplido |

**Recorte si a H+3:30 no hay E2E:** fuera auditoría y cierre de visita → fuera mapeador UI (CSV en panel de revisión) → fuera agenda navegable (cita confirmada como estado + tarjeta). Se conservan sí o sí: importación de 3 formatos, ficha con alertas, briefing y solicitud/aceptación.

**Honestidad:** con 3 agentes en paralelo y gates cada 60–90 min, la demo vertical en 6 h es creíble (~60–70% de probabilidad); en 8 h, ~85%. Una sola persona orquestando no lo hace en 6 h (10–12 h). Los 40–48 h de C' son esfuerzo humano: con agentes se comprime la generación, **no la verificación**.

## 9. Plan de demo y pitch

### 9.1 Guion de 3 minutos (red-team, ensayado)

| Min | Qué se enseña |
|---|---|
| 0:00 | Laura entra; bandeja con Bruno (Word), Luna (Excel) y Kira (JSON); banner "Entorno de demostración — datos sin PII". |
| 0:30 | Sube un **CSV con cabeceras raras**; el mapeador propone columnas; Laura confirma; aparecen alertas y procedencia. |
| 1:15 | Busca especialista; ficha con precio y hueco; solicita derivación de Kira con **resumen no identificativo**. |
| 2:00 | Cambia a Marc; acepta; ve la **historia completa** y el briefing con badges de procedencia; audita el acceso. |
| 2:45 | Cierre: 3 pacientes, 3 formatos, 1 desconocido, 0 datos reales, todo trazable. |

**Versión 6 minutos (si el jurado da margen):** 0:00–0:20 problema · 0:20–2:20 importación 3 formatos + fichas + alertas · 2:20–3:20 marketplace/solicitud · 3:20–4:40 briefing + aceptación · 4:40–5:20 agenda/auditoría · 5:20–6:00 métricas, modelo y equipo.

**Métricas que se dicen en voz alta:** 3+1 formatos → 1 registro en <30 s · ~37 campos con provenance · 9 alertas detectadas · reconstrucción manual 10–15 min → briefing 90 s · 0 re-tecleo · 7.032 clínicas y 92% independientes esperando esto.

### 9.2 Plan B (cuando la demo en vivo falla)

1. **Botón "Cargar datos demo"** + reset (seed reproducible).
2. **Vídeo de 3 min** grabado el sábado noche / domingo 11:00 con el mismo recorrido.
3. **Un solo comando local** (`pnpm demo` → build de la SPA + `uvicorn` sirviendo todo) si la red del evento falla.
4. **README** con capturas y enlaces por si ni el vídeo se puede reproducir.
5. **Segundo portátil** con el entorno preparado.

### 9.3 Preguntas probables del jurado (respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| "¿Y si la clínica usa otro formato?" | Mapeador asistido + adaptadores enchufables + extracción parcial + revisión humana; hay matriz de soporte en el README. |
| "¿La IA inventa datos clínicos?" | No: esquema estricto, confidence por campo, provenance y confirmación del veterinario; el briefing es determinista. |
| "¿Mandáis datos clínicos a OpenAI?" | Demo con datos sintéticos; producción: DPA, endpoint UE, sin entrenamiento, minimización; el briefing no lo genera el LLM. |
| "¿De quién son los datos?" | De la clínica (responsable); VetLink encargado del tratamiento (DPA); consentimiento del tutor; auditoría y revocación. |
| "¿Sin pagos no es un marketplace?" | Hay oferta, servicio, precio, disponibilidad, solicitud, aceptación y cita; el pago es un rail posterior. |
| "¿No es otro PMS?" | No: capa de ingesta + derivación PMS-agnóstica; el sistema de registro sigue siendo el de la clínica. |
| "¿Y si el especialista cancela?" | Estados y reglas de reprogramación; alternativa sugerida. |
| "¿Por qué Boehringer?" | Prevención y adherencia (vacunas, desparasitación, revisiones) es su negocio; VetLink estructura justo esos datos (y el RD 986/2026 lo exigirá en 2027). |
| "¿Y el tutor?" | Fase 2: recordatorios y ficha compartida; ya previsto en el modelo (consentimiento, canal, idioma). |
| "¿Esto es un dispositivo médico?" | No: documenta y comunica entre profesionales; no diagnostica ni prescribe; disclaimer en el informe. |

---

## 10. Riesgos y mitigaciones (top 12)

| Riesgo | Prob. | Impacto | Mitigación | Dueño |
|---|---|---|---|---|
| No llegar a capa + marketplace en 20 h | Alta | Alto | C' recortado, vertical slice, hitos demoables, recorte sábado 20:00 | Capitán |
| LLM devuelve JSON inválido / inventa (solo si se usa) | Baja | Medio | **Fuera de la demo**: extractores deterministas; si se usa, solo texto libre con revisión humana | Data |
| Demo en directo se cae | Media | Alto | Local-first + seed + vídeo + segundo portátil | Demo/QA |
| Deadline antes de lo asumido | Media | Alto | Versión enviable en `main` el sábado noche; domingo = mejora | Capitán |
| Permisos de push en GitHub org | Media | Crítico | Verificar hoy; si falla, avisar a organización YA | Capitán |
| Fiebre de features (pagos, OCR, reviews, chat) | Alta | Medio | Scope killers §4 y regla del corte | Capitán |
| Formato desconocido delata el sistema | Media | Alto | Mapeador asistido + CSV en la demo + matriz de soporte | Data |
| IA en datos clínicos: mala extracción | Media | Alto | Umbral de confianza + revisión obligatoria + discurso "asistido" | Data/QA |
| PII de los ficheros en la demo | Baja | Alto | Datos sintéticos, banner, no enviar PII al LLM | Demo/QA |
| Privacidad mal contada en la UI | Baja | Alto | Matriz de permisos + auditoría + textos legales de `docs/03` §7 | Demo/QA |
| SQLite/deploy falla | Media | Medio | Demo 100% local con fichero SQLite + seed; Postgres es opcional, no camino crítico | Backend |
| Nombre "VetLink" con prior art | Media | Bajo | No invertir en dominio/registro; pitch de hackathon; tagline descriptivo | Capitán |

---

## 11. Checklist de entrega (domingo)

- [ ] Deadline exacto confirmado con la organización y anotado en `docs/00`.
- [ ] `main` actualizado, pusheado y **verificado abriéndolo en GitHub** (13:30).
- [ ] README con: pitch, stack, arranque en 3 pasos, enlaces a `docs/` y diagramas, vídeo, demo URL, **matriz de soporte de formatos**.
- [ ] `docs/00`–`06` completos y sin contradicciones.
- [ ] `docs/diagramas/` con los 4 HTML y abren en navegador.
- [ ] `data/samples/` con los 3 ficheros del reto + `export_clinica_norte.csv` (4º formato de robustez).
- [ ] Validación clínica de las reglas de alerta R01–R11 (textos y umbrales) por alguien con criterio veterinario del equipo antes del pitch.
- [ ] Sin secretos: buscar `supabase`, `sk-`, `password`, `postgres://` en el repo.
- [ ] Datos semilla reproducibles (`POST /api/demo/reset` o `pnpm demo`); SQLite autogenerada al arrancar.
- [ ] Banner de demo + aviso "no usar con datos reales".
- [ ] Vídeo de 3 min accesible + enlace en README.
- [ ] Copia local `.zip` del repo por si acaso.
- [ ] Aviso al canal de la organización de que la entrega está hecha (con enlace al repo).

---

## 12. Supuestos de este playbook (ajústalos y avísame)

| # | Supuesto | Si es distinto |
|---|---|---|
| 1 | Deadline domingo 15/11 ~15:00 CET; tratamos 13:30 como real | Confirmar y recomprimir §8 |
| 2 | **Equipo de 2 personas** (A: proyecto+backend; B: producto+frontend/demo) | Plan de 8 h (§8.5); si queda 1 persona, versión comprimida §8.3 con seed + vídeo |
| 3 | SQLite local basta para la demo; no hace falta Supabase | Si se pide Postgres, cambiar la URL de conexión (modelo portable) |
| 4 | Push a `HackathonBoehringerIT/Joniha` operativo | Probar hoy; si no, escalar a organización |
| 5 | Se mantiene marca VetLink; tagline de pitch descriptivo | Ya hay logo; no invertir en naming ni dominio |
| 6 | Demo en directo el domingo ante jurado | Si es vídeo obligatorio, invertir el orden: grabar antes |
| 7 | El jurado premia prototipo funcional | El guion cubre también narrativa de impacto para minimizar riesgo |

## 13. Checkpoints oficiales (los 3 del jurado)

| # | Criterio evaluado | Qué preparamos | Documento |
|---|---|---|---|
| 1 | **Organización del equipo:** roles claros, líderes identificados y plan de trabajo coordinado — **sáb 12:00** | Equipo de 2 con liderazgo A/B, reglas de decisión, cadencia de 90 min, reparto por bloques y plan de bus factor | [`docs/checkpoints/CP1-organizacion-equipo.md`](docs/checkpoints/CP1-organizacion-equipo.md) |
| 2 | **Propuesta de solución:** idea clara, alineada con el reto y lista para desarrollar — **sáb 18:00** | Pitch de 1 página + matriz requisito→cumplimiento→demo + alcance 5 pantallas + evidencias ya construidas | [`docs/checkpoints/CP2-propuesta-solucion.md`](docs/checkpoints/CP2-propuesta-solucion.md) |
| 3 | **Solución y demo:** resuelve, aporta valor y demo funcional con buen nivel técnico — **dom 14:45** | Guion de 3/6 min + dossier técnico + checklist pre-demo + preguntas del jurado + valor y métricas | [`docs/checkpoints/CP3-solucion-demo.md`](docs/checkpoints/CP3-solucion-demo.md) |

**Regla:** cada checkpoint se defiende en 2 minutos con su documento y el repo abierto; si es llamada, se usa la sección "Guion de 90 segundos"; si es formulario, se copia el bloque "Para copiar/pegar". **No se improvisa nada en la llamada.**

**Siguiente acción inmediata del Lead:** con el paquete de checkpoints listo y el equipo confirmado (2 personas), arrancar el bloque H+0 del §8.5 (scaffold + contrato congelado + seed) en cuanto se confirmen formato y fecha de los checkpoints.
