# 04 · Flujos de usuario y flujo de uso de la aplicación

> Fuente de verdad para los diagramas de `docs/diagramas/`. Todo flujo está descrito en pasos numerados y estados observables para poder testearlo y para que frontend/backend se alineen.

## Convenciones

- **Roles:** `CLINIC` (Laura y su equipo), `SPECIALIST` (Marc), `TUTOR` (fase 2).
- **Solicitud (Request) — estados:** `DRAFT → REQUESTED → ACCEPTED → SCHEDULED → COMPLETED`, con ramas `DECLINED`, `CANCELLED`, `EXPIRED`.
- **Importación — estados:** `UPLOADING → PARSING → NEEDS_REVIEW → READY` (rama `FAILED`).
- **Niveles de compartición:** `CLINICAL` (lo mínimo clínico sin PII), `FULL` (ficha completa + documentos; la clínica lo autoriza).

## Línea de corte MVP (decisión C' del debate)

La demo implementa **5 pantallas** (ver `PLAYBOOK.md` §3 y §4): **S2** login/rol · **S4+S5** paciente + subida + revisión · **S6+S7** búsqueda + ficha de especialista · **S8+S11** solicitud + agenda · **S10** briefing/informe. S1 landing, S3 home completa, S9 home completa, S12 chat, S13 cierre y S14 ajustes quedan documentados para el roadmap: solo se implementan si sobra tiempo. Los flujos A–F de este documento siguen siendo la referencia funcional completa.

## Mapa de pantallas

| ID | Pantalla | Rol | Objetivo |
|---|---|---|---|
| S1 | Landing pública | público | Entender la propuesta y elegir rol |
| S2 | Login / registro | ambos | Entrar con rol correcto |
| S3 | Home clínica | CLINIC | Pacientes, importaciones y solicitudes activas |
| S4 | Importar historia | CLINIC | Subir Word/Excel/JSON y ver progreso |
| S5 | Ficha canónica | CLINIC | Historia unificada + alertas + timeline |
| S6 | Marketplace | CLINIC | Buscar especialistas (especialidad, zona, fecha, precio) |
| S7 | Perfil de especialista | CLINIC | Servicios, zonas, tarifas, disponibilidad |
| S8 | Nueva solicitud | CLINIC | Motivo + paciente + nivel de compartición + franjas |
| S9 | Home especialista | SPECIALIST | Solicitudes pendientes + agenda |
| S10 | Briefing pre-visita | SPECIALIST | Entender el caso en 90 s antes de aceptar/visitar |
| S11 | Calendario | ambos | Ver/confirmar/reprogramar visitas |
| S12 | Chat del caso | ambos | Coordinación operativa |
| S13 | Cierre de visita | SPECIALIST → CLINIC | Nota del especialista devuelve el caso a la clínica |
| S14 | Configuración / perfil | ambos | Datos, zonas, servicios, privacidad |

---

## Flujo A — Laura importa la historia de un paciente (S3 → S4 → S5)

**Objetivo:** pasar del papeleo a una ficha única en menos de un minuto.

1. Laura entra en S3 (Home clínica). Ve "Importar historia" y la lista de pacientes ya normalizados.
2. Pulsa **Importar** → S4. Arrastra uno o varios ficheros (`.docx`, `.xlsx`, `.json`; también `.pdf` como fase 2).
3. El sistema detecta formato y origen (`manual_clinic`, `pms_export`, `api_export`) y muestra una barra por fichero con estado: `Subiendo → Interpretando → Listo / Revisar`.
4. Al terminar, el sistema:
   - crea/actualiza el **paciente** (matching por microchip + nombre + fecha de nacimiento),
   - construye el **registro canónico**,
   - calcula **alertas** (alergias, problemas activos, vencimientos, próximas citas),
   - marca con `confianza < 0.8` los campos dudosos.
5. S4 muestra el resultado: "Bruno · 1 visita importada · 37 campos · 3 alertas · 2 campos a revisar".
6. Laura abre **S5 Ficha canónica**: identidad, alertas en rojo/ámbar, timeline de visitas, plan preventivo, evolución de peso, documentos y facturación (pestañas).
7. Si hay campos en revisión, se abren en un panel lateral editable; al guardar, la ficha pasa a `READY`.
8. **Errores y ramas:**
   - Formato no reconocido → `FAILED` parcial: "No hemos podido interpretar este formato por completo. Hemos extraído 12 campos; revísalos." (nunca rompe la pantalla).
   - Mismo paciente con otro microchip → sugerencia de fusión, nunca automática.
   - Conflicto de datos (p. ej. dos pesos) → se conservan ambos con provenance y se muestra el más reciente como principal.
   - Fichero corrupto → error por fichero, el resto continúa.

**Criterio de aceptación:** los 3 ficheros del reto producen 3 fichas `READY` con las alertas esperadas de `docs/01-reto-analisis.md`.

---

## Flujo B — Laura encuentra especialista y solicita visita (S3 → S6 → S7 → S8)

1. Desde S3 o desde la ficha S5, Laura pulsa **Buscar especialista**.
2. **S6 Marketplace:** filtros por especialidad (dermatología), zona (a ≤ 30 km / provincia), fecha ("esta semana"), precio orientativo, tipo de visita (en clínica / teleconsulta). Lista de tarjetas: nombre, especialidad, distancia, próxima disponibilidad, precio desde, valoración (fase 2), botón **Ver perfil**.
3. Abre **S7 Perfil de Marc**: bio, servicios, zonas que cubre, tarifas, disponibilidad real de la semana, política de desplazamiento, CTA **Solicitar visita**.
4. **S8 Nueva solicitud:**
   - Paciente preseleccionado (Bruno) y resumen de lo que se compartirá (preview del briefing).
   - **Nivel de compartición:** `CLINICAL` (sin PII del tutor) o `FULL`. Por defecto `CLINICAL`; la clínica puede cambiarlo.
   - Motivo/observaciones, urgencia (normal / esta semana / urgente), franjas preferidas, adjuntos opcionales.
   - Enviar → estado `REQUESTED`.
5. Confirmación en S3: tarjeta "Solicitud enviada a Marc · esperando respuesta".
6. **Errores y ramas:**
   - Sin disponibilidad en la zona/fecha → sugerencias alternativas (otra fecha, otra zona, teleconsulta).
   - El especialista declina → `DECLINED` con motivo opcional → Laura ve "Buscar alternativa".
   - Laura cancela antes de aceptar → `CANCELLED` sin penalización.
   - La solicitud expira a las 48 h sin respuesta → `EXPIRED` y aviso.

---

## Flujo C — Marc recibe, revisa el briefing y acepta (S9 → S10 → S11)

1. Marc recibe aviso (campana + email mock) y entra en **S9 Home especialista**: lista de solicitudes con paciente, clínica, motivo, distancia, fecha propuesta y semáforo de urgencia.
2. Abre **S10 Briefing pre-visita** (el corazón del producto):
   - **"Lo que necesitas saber"** en 3–5 bullets generados: motivo actual, problemas activos, alertas críticas, medicación vigente, preventivo al día/vencido.
   - **Alertas críticas** arriba (alergias, reacción adversa a fármaco).
   - **Cronología** de episodios relevantes (últimas 3–5 visitas).
   - **Pruebas y documentos** disponibles.
   - **Qué falta / preguntas sugeridas** para la visita.
   - Botón **Ver ficha completa** (si la clínica autorizó `FULL`).
3. Marc **Acepta** con una fecha/hora de su disponibilidad → estado `ACCEPTED` → `SCHEDULED`; la cita aparece en **S11 Calendario** de ambos.
4. **Ramas:** Marc pide más info por **S12 Chat** (sin cambiar estado); declina con motivo; propone otra hora (contraoferta) → Laura confirma.
5. **Criterio de aceptación:** Marc ve el briefing antes de aceptar y el calendario de Laura se actualiza en < 2 s.

---

## Flujo D — Día de la visita y cierre (S11 → S13 → S5) — *should, si da tiempo*

> Prioridad C': el cierre del especialista (S13) es "should/could". Si el reloj aprieta, el MVP termina en la cita confirmada y el cierre se cuenta en el roadmap.

1. El día de la visita, Marc abre el caso desde S11 y tiene el briefing a mano (móvil).
2. Tras la visita, en **S13 Cierre** añade: nota clínica breve, diagnóstico, recomendaciones y próxima revisión.
3. Al guardar, el caso pasa a `COMPLETED` y la nota aparece en la ficha S5 de la clínica como **episodio del especialista** (provenance: `specialist`, `staff_id`).
4. La clínica puede marcar recordatorio derivado (p. ej. "control dermatológico en 30 días") → se crea en el plan preventivo.
5. **Ramas:** no-show (la clínica marca incidencia); cancelación con < 24 h (aviso); reprogramación.

---

## Flujo E — Uso de la aplicación: recorrido de la demo (pantalla a pantalla)

> Nota C': el recorrido de demo de los 3 minutos recorre S2 → S4/S5 → S6/S7 → S8 → S10. Los pasos 12 (chat) y 15 (cierre) son opcionales en función del tiempo.

> Este es el guion técnico de la demo. 6 minutos, sin callejones sin salida.

1. **S1 Landing** → "VetLink: salud animal, a un clic" → CTA *Soy clínica*.
2. **S2 Login** como Laura (clínica Vall del Sol) → sesión `CLINIC`.
3. **S3 Home clínica** → 3 pacientes demo ya cargados (estado limpio reproducible) + botón Importar.
4. **S4 Importar** → sube `Clínica Vall del Sol.docx`, `export_MAS-0004587.xlsx`, `historial.json` de una vez → estados por fichero → 3 resultados.
5. **S5 Ficha Bruno** → alertas (alergia pollo), timeline, preventivo → demo del registro canónico.
6. **S5 Ficha Luna** → pestañas del Excel (13 hojas → 1 ficha), otitis recurrente, recordatorio 13/11.
7. **S5 Ficha Kira** → reacción a carprofeno → meloxicam, collar vencido, control ocular 14/11.
8. **S6 Marketplace** → filtro dermatología + Barcelona + esta semana → aparece Marc.
9. **S7 Perfil Marc** → disponibilidad → **Solicitar visita**.
10. **S8 Solicitud** → paciente Bruno + nivel `CLINICAL` + franjas + enviar → toast "Solicitud enviada".
11. **Cambio de sesión a Marc** → **S9 Home especialista** → solicitud con briefing preview.
12. **S10 Briefing** → "lo que necesitas saber" + alertas + cronología.
13. **Aceptar** con fecha → **S11 Calendario** de Marc y de Laura actualizados.
14. **S12 Chat** → mensaje operativo ("llegaré a las 10:30, ¿tenéis la citología?").
15. **S13 Cierre** (si da tiempo) → nota del especialista → aparece en S5 de la clínica. Cierre del relato: *"la información existía; ahora llega a tiempo"*.

**Plan B de demo:** vídeo de 3 min grabado con este mismo recorrido + datos semilla cargados por script. La demo en vivo nunca depende de subir ficheros por WiFi del evento: se usan copias locales.

---

## Flujo F — Tutor (fase 2, no se implementa)

1. Carmen recibe recordatorio (vacuna/parásito/revisión) por su canal preferido (SMS/WhatsApp/email).
2. Abre un enlace seguro y ve la ficha resumida de Bruno: próximas citas, tratamiento activo, recomendaciones.
3. Puede autorizar compartir la historia con otro veterinario o pedir cita.

**Se menciona en el pitch como roadmap, no se demuestra.**

---

## Matriz de permisos (niveles de acceso)

| Dato | Clínica | Especialista antes de aceptar | Especialista tras aceptar | Tutor (fase 2) |
|---|---|---|---|---|
| Identidad del paciente (nombre, especie, raza, edad) | ✅ | ✅ | ✅ | ✅ |
| Datos clínicos (SOAP, problemas, pruebas) | ✅ | Briefing resumido | ✅ ficha completa | ✅ fase 2 |
| PII del tutor (nombre, teléfono, dirección) | ✅ | ❌ (seudónimo `TUTOR_8F2C`) | Solo contacto operativo si la clínica lo autoriza | ✅ |
| Facturación de la clínica | ✅ | ❌ | Solo su propia factura/servicio | ❌ |
| Documentos y adjuntos | ✅ | Solo los marcados por la clínica | ✅ | ✅ fase 2 |
| Notas del especialista | ✅ tras `COMPLETED` | ✅ suyas | ✅ | ❌ |

## Estados de la solicitud

```
DRAFT ──enviar──> REQUESTED ──aceptar──> ACCEPTED ──agendar──> SCHEDULED ──visita──> COMPLETED
                      │  │
                      │  └──declinar──> DECLINED
                      └──cancelar/expirar──> CANCELLED / EXPIRED
```

Reglas: expira a las 48 h sin respuesta; cancelación sin coste hasta 24 h antes; contraoferta de fecha vuelve a `REQUESTED` con propuesta.

## Trazabilidad a los diagramas

| Diagrama Archify | Contenido |
|---|---|
| `docs/diagramas/flujo-usuarios.html` | Flujos A–D: viaje completo Laura → VetLink → Marc, con actores y ramas |
| `docs/diagramas/flujo-uso-app.html` | Flujo E: recorrido pantalla a pantalla (S1–S13) |
| `docs/diagramas/arquitectura-vetlink.html` | Componentes y fronteras del sistema |
| `docs/diagramas/secuencia-importacion-briefing.html` | Pipeline técnico: subida → normalización → briefing → solicitud → aceptación |
