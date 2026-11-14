# `data/samples` — Datos de ejemplo del reto

Los tres ficheros originales del Reto 3 (datos **ficticios** y anonimizados por la organización). Son la fuente de verdad de la demo: el sistema debe normalizarlos a un único registro canónico.

| Fichero | Paciente | Sistema de origen | Formato | Particularidades |
|---|---|---|---|---|
| `Clínica Veterinaria Vall del Sol.docx` | **Bruno** (Labrador, macho castrado) | Ficha manual de clínica | Word (tablas + texto) | Sin ids clínicos; PII del tutor; plan preventivo en tabla |
| `export_MAS-0004587_anonimizado.xlsx` | **Luna** (Beagle, hembra esterilizada) | Exportación de PMS | Excel (13 hojas) | Fragmentado por dominio; jerga de PMS; saldo pendiente |
| `historial.json` | **Kira** (Border Collie, hembra entera) | API VetNexo Cloud v3.2.1 | JSON anidado | Ids, SOAP, facturas, adjuntos, recordatorios, reacción adversa |
| `export_clinica_norte.csv` | **Nala** (sintético) | Export de una clínica con software desconocido | CSV con `;` y cabeceras no vistas | **4º formato de robustez:** prueba el mapeador asistido (peso en lb, columnas «tx»/«alergias» con baja confianza) |

## Reglas

- No modificar los originales.
- Cualquier dato añadido para la demo debe marcarse como `assumed` en el registro canónico.
- El botón **Cargar demo** de la aplicación reinicia los datos de ejemplo.
