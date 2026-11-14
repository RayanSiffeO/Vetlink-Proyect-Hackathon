# 00 · Contexto: VIII Hackathon Boehringer Ingelheim España

> Documento de contexto del equipo. Fuente primaria: dossier del reto (`.docx`) + notas de prensa oficiales. Verificado el 14/11/2026, 01:00 (Europe/Madrid).

## Qué es esta hackathon

| Dato | Valor |
|---|---|
| Organiza | **Boehringer Ingelheim España** (IT Hub España) |
| Edición | **VIII Hackathon** |
| Lema | *"Arquitectos del futuro de la salud en España"* |
| Formato | **Virtual**, por equipos, del **13 al 15 de noviembre de 2026** |
| Inscripción | Gratuita; cerrada el 5/11 |
| Premios | **3.000 € / 2.500 € / 2.000 €** (uno por reto; 7.500 € en total) |
| Evaluación | Jurado al terminar el domingo: **viabilidad técnica y funcionamiento de los prototipos** |
| Referencia | Ferran Urgelés, Director de IT de Boehringer Ingelheim España (declaraciones de prensa) |

**Qué es una hackathon, en la práctica:** un fin de semana para convertir un problema real de negocio en un **prototipo que funcione** y defenderlo ante un jurado. No se evalúa la presentación más bonita, sino que la demo no se rompa, que el problema se entienda y que la solución sea creíble. El reloj es el recurso escaso.

## Los tres retos de la edición

1. **Salud humana** — sistema de prevención cardiovascular en Atención Primaria que analice automáticamente la historia clínica.
2. **Salud animal · porcino** — optimizar rutas de desplazamiento de veterinarios y centralizar registros de bioseguridad.
3. **Salud animal · mascotas — el nuestro**: *"Menos papeleo, más cuidado: los datos al servicio de la clínica"*. Estructurar y homogeneizar datos clínicos veterinarios, seguimiento preventivo y comunicación con propietarios; el dossier añade además el **marketplace de especialistas** y la **conexión entre ambas piezas**.

## Reglas de entrega (leer dos veces)

- Repositorio del equipo: **https://github.com/HackathonBoehringerIT/Joniha** (privado, org `HackathonBoehringerIT`). No se entrega nada fuera de ahí.
- Antes del deadline, **todo el trabajo final debe estar commiteado y pusheado a `main`**. Si hay PR, mergeado. Lo que quede en otra rama o en un PR sin mergear puede no evaluarse.
- Se recomienda **commitear durante todo el finde**: el historial forma parte de la entrega.
- El deadline exacto lo anuncia la organización; **asumimos domingo 15/11 ~15:00 CET** y lo confirmamos con la organización por Discord/correo. Trabajo subido después del deadline **no se evalúa**.

## Estado real a las 01:00 del sábado 14/11

- Repo `Joniha`: solo `Initial commit` con el README de instrucciones. **Código: 0 líneas.**
- Dirección previa del equipo (notas Obsidian del 13/11): marca **VetLink**, stack **React + FastAPI + PostgreSQL (Supabase)**, páginas inicio/login/marketplace/área común.
- Ventana restante: **~36 h de reloj**, de las que caben ~20–24 h de trabajo real. De ahí el playbook por bloques y la regla de congelación del domingo.

## Implicaciones para nosotros

1. **La demo en vivo manda.** El jurado tiene que ver funcionar la subida de los tres ficheros reales y el flujo clínica → especialista.
2. **Foco brutal:** 3 casos de uso, 3 ficheros, 2 roles, 0 features que el reto no pida.
3. **La IA solo donde aporta y con validación** (provenance + revisión humana): en datos clínicos, "alucinar" hunde la credibilidad.
4. **Es salud:** datos ficticios, seudonimización, control de acceso y mensaje RGPD visible en la UI.
5. **Boehringer busca prevención y adherencia.** La capa de datos preventivos (vacunas, desparasitación, revisiones) es nuestro puente con su negocio.

## Enlaces

- Dossier del reto: `C:\Users\Usuario\Downloads\Reto 3 - Menos papeleo, más cuidado\...\Reto 3 - Menos papeleo, más cuidado.docx`
- Nota de prensa: <https://www.imveterinaria.es/noticia/15150/boehringer-ingelheim-busca-soluciones-digitales-para-mejorar-la-pract.html>
- Otra nota (premios y evaluación): <https://www.3tres3.com/es-mx/guia333/empresas/boehringer-ingelheim-animal-health-espana-s-a-u/posts/28419>
- Repo del equipo: <https://github.com/HackathonBoehringerIT/Joniha>
