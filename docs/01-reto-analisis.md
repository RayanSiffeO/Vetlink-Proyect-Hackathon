# 01 · El reto entendido

## En una frase

La historia clínica de una mascota existe, pero está partida en formatos y softwares distintos. El especialista ambulante pierde los primeros minutos de cada visita reconstruyéndola, y la clínica generalista no tiene un sitio donde encontrar al especialista que necesita.

## Tres requisitos literales → tres capacidades

**R1. Ingesta y normalización.**
> "Subir la información clínica de los pacientes en los distintos formatos en los que hoy existe (Word, Excel, JSON…) y, dinámicamente, homogeneizarla y estandarizarla en un único formato, comprensible para cualquier veterinario."

→ Ingesta multi-formato + **registro canónico**. No es "convertir a PDF": es **estructurar** (entidades, códigos, unidades, fechas, estados).
Matiz del dossier: *"usarlos como guía, no como los únicos archivos… cada clínica puede tener unos distintos"* → prohibido hardcodear solo esas 3 plantillas. El sistema debe **degradar con elegancia**: formato desconocido → extracción parcial + revisión humana.

**R2. Marketplace de especialistas.**
> "Funcionar como un marketplace en el que las clínicas generalistas puedan encontrar y contratar a especialistas, y en el que los especialistas puedan ofrecer sus servicios y organizar su actividad."

→ Directorio + perfiles + búsqueda por especialidad/zona/disponibilidad/precio + solicitud + agenda/calendario.

**R3. El puente.**
> "Conectar ambas piezas, para que la historia de cada mascota llegue al especialista completa y ordenada, y pueda 'verla' antes de ver al paciente."

→ **Briefing pre-visita** generado del registro canónico, con control de qué datos se comparten y con quién.

## Personas

### Laura — veterinaria generalista
- Clínica pequeña (tipo Vall del Sol, Sant Cugat). 1–2 veterinarios, sin especialistas en plantilla, con un PMS del mercado.
- **Objetivos:** resolver casos fuera de su expertise; no perder al cliente; no dedicar la consulta a re-teclear historias.
- **Dolores:** contactos en el móvil, llamadas y WhatsApp; no sabe quién trabaja en su zona, qué ofrece, cuánto cuesta ni cuándo puede venir; el especialista llega sin contexto.
- **Éxito:** *"en 3 clics tengo un especialista confirmado y sé que mañana llega con el caso leído"*.

### Marc — especialista ambulante (cardiología, dermatología…)
- En la carretera, 4–6 clínicas por semana, cada una con un software y un formato distintos.
- **Objetivos:** llenar huecos de agenda; llegar preparado; facturar su trabajo; dejar constancia clínica.
- **Dolores:** historias incompletas o desordenadas; 10–15 min reconstruyendo el caso antes de cada visita; doble documentación.
- **Éxito:** *"abro el caso en el móvil y en 90 segundos sé qué le pasa, qué se ha probado, qué alergias hay y qué falta"*.

### (Secundario, fase 2) Tutora — Carmen
Quiere recordatorios (vacunas, parásitos, revisiones), instrucciones claras y poder compartir la historia con su veterinario. **No entra en la demo del MVP**; sí en el roadmap y en el relato de impacto.

## Los datos que nos dan (y lo que demuestran)

| Fuente | Paciente | Sistema de origen | Formato | Lo que demuestra |
|---|---|---|---|---|
| `Clínica Veterinaria Vall del Sol.docx` | **Bruno** (Labrador, 2 a 9 m) | Ficha manual de clínica | Tablas Word + texto libre | El caso "papeleo": sin ids ni códigos clínicos, con PII del tutor |
| `export_MAS-0004587_anonimizado.xlsx` | **Luna** (Beagle, 7 a) | Export de PMS genérico | 13 hojas por dominio | Datos estructurados pero **fragmentados** y con jerga de PMS |
| `historial.json` | **Kira** (Border Collie, 5 a) | API VetNexo Cloud v3.2.1 | JSON anidado rico | Lo que un PMS moderno puede exportar: ids, SOAP, facturas, adjuntos |

Ninguno se parece a otro: **mismo dominio, tres ontologías**. Ahí está el reto real.

## Qué evalúa el jurado (y cómo le hablamos)

| Criterio | Cómo lo cubrimos |
|---|---|
| **Viabilidad técnica** | Demo estable + arquitectura explicable en 2 min + IA con validación de esquema y provenance |
| **Funcionamiento** | Caso completo Laura → VetLink → Marc; 3 pacientes reales del reto; estados y errores controlados |
| **Impacto** | "Minutos ahorrados por visita" + prevención (vacunas/parásitos) alineada con BI |
| **Privacidad** | Datos ficticios, seudonimización, niveles de acceso, mensaje RGPD/LOPDGDD en UI |

## Criterios de éxito del MVP (observables, se prueban antes de enviar)

1. Subir los 3 ficheros y obtener **3 fichas canónicas coherentes** en menos de 30 s.
2. **Alertas correctas:**
   - Bruno → alergia alimentaria al pollo (evitar premios/snacks), sobrepeso 6/9, control cojera 17/11/2026.
   - Luna → otitis externa recurrente activa, prurito estacional, revisión ótica 13/11/2026, saldo pendiente (solo clínica).
   - Kira → reacción adversa a carprofeno (usar meloxicam), conjuntivitis OS activa, control ocular 14/11/2026, collar antiparasitario vencido.
3. Laura busca "dermatología · zona Barcelona · esta semana" y encuentra a Marc.
4. Marc ve el briefing **antes** de aceptar y acepta con fecha.
5. El estado de la solicitud se refleja en las dos sesiones (calendario).
6. Un **4º formato no previsto** se importa en modo revisión sin romper el sistema.
7. Métrica de pitch: reconstrucción manual ~10–15 min → briefing ~90 s.

## Lo que NO pide (explícito, para no dispersarse)

- Sustituir al PMS ni escribir en el sistema de origen (integración futura).
- Historia clínica legal certificada / firma electrónica.
- Pagos reales o facturación fiscal del marketplace.
- App móvil nativa (web responsive).
- Integración técnica con Boehringer (solo encaje estratégico en el relato).

## Riesgos de lectura

1. **Convertirlo en "otro gestor de clínica"** → mercado saturado y no es lo que piden.
2. **Convertirlo en "un chat que resume con IA"** → no resuelve marketplace ni normalización.
3. **Sobredimensionar el marketplace** (fotos, reviews, pagos) y no llegar al handoff, que es el diferencial.
4. **Ignorar el matiz multi-clínica** ("cada clínica tiene formatos distintos") y hacer un parser de 3 plantillas.

## Decisiones de producto derivadas

- Producto **C' recortado** (tras el debate de `docs/03-debate-diseno.md`): capa de interoperabilidad primero, marketplace segundo, **briefing como puente** (el "wow" que conecta los 3 bullets).
- **5 pantallas** en la demo: login/rol · paciente+subida+revisión · búsqueda+ficha · reserva+agenda · briefing/informe.
- **Sin pagos reales** en el MVP: solicitud + aceptación + calendario + comisión como modelo de negocio.
- **Resumen no identificativo antes de aceptar** la derivación; historia completa después (RGPD + confianza).
- **Briefing determinista**; la IA solo extrae texto libre, propone y marca confianza; el veterinario confirma.
- **Dueño/tutor** fuera de la demo (fase 2), pero mencionado en impacto.
- **Demo local-first** con seed/reset y vídeo de respaldo.
