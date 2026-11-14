"""Calidad: comprueba que la extracción es utilizable y reúne las advertencias."""
import re

from procesador.privacidad import buscar_residuos

# gravedad: error = el resultado no es fiable; aviso = revisar; info = a tener en cuenta
_MENSAJES_SECCION = {
    "ocr_no_disponible": ("error", "La página es un escaneo pero Tesseract (o su idioma) no está instalado: no se pudo leer."),
}


def comprobar(secciones, informe_privacidad, error_lectura=None):
    """Devuelve {'estado', 'metricas', 'advertencias'}. estado: ok | con_advertencias | error."""
    adv = []

    def add(gravedad, tipo, mensaje, seccion=None, linea=None):
        a = {"gravedad": gravedad, "tipo": tipo, "mensaje": mensaje}
        if seccion is not None: a["seccion"] = seccion
        if linea is not None: a["linea"] = linea
        adv.append(a)

    if error_lectura:
        add("error", "error_lectura", error_lectura)
        return {"estado": "error", "metricas": {}, "advertencias": adv}

    texto_total = "\n".join(s.texto for s in secciones)
    if not texto_total.strip():
        add("error", "sin_contenido", "No se ha extraído contenido del documento (¿vacío o escaneado sin OCR?).")

    for i, s in enumerate(secciones, 1):
        for cod in s.avisos:
            g, m = _MENSAJES_SECCION.get(cod, ("aviso", cod))
            add(g, cod, m, seccion=i)
        if not s.texto.strip() and "ocr_no_disponible" not in s.avisos:
            add("aviso", "seccion_vacia", "Sección sin texto legible.", seccion=i)
        elif s.metodo in ("ocr", "ocr_parcial") and s.texto.strip():
            add("info", "leido_por_ocr", "Contenido leído por OCR: puede haber errores en cifras y nombres; revisar valores clínicos.", seccion=i)
        if s.texto.strip():
            raros = len(re.findall(r"\ufffd|\(cid:\d+\)", s.texto))
            letras = sum(c.isalpha() for c in s.texto)
            if raros >= 3 or raros > 0.02 * len(s.texto):
                add("aviso", "texto_ilegible", "Caracteres de lectura errónea (codificación o fuente defectuosa).", seccion=i)
            elif len(s.texto) > 200 and letras < 0.3 * len(s.texto):
                add("aviso", "poco_texto_alfabetico", "Muy pocas letras para su longitud: posible contenido mal leído o puramente numérico.", seccion=i)

    # privacidad: avisos del anonimizador + comprobación de que no queda nada reconocible
    for a in informe_privacidad["avisos"]:
        add("aviso", a["tipo"], a["detalle"], seccion=a["seccion"], linea=a["linea"])
    residuos = buscar_residuos(texto_total)
    if residuos:
        add("error", "datos_personales_residuales",
            "Tras la protección aún hay patrones de datos personales ({}). No usar el TXT sin revisarlo.".format(
                ", ".join(f"{c}: {n}" for c, n in residuos.items())))
    if texto_total.strip() and not informe_privacidad["sustituciones"] and not informe_privacidad["avisos"]:
        add("aviso", "sin_datos_personales_detectados",
            "No se ha detectado ningún dato personal; en un historial clínico es poco habitual. Comprobar que no hay datos sin etiquetar.")

    estado = "error" if any(a["gravedad"] == "error" for a in adv) else \
             "con_advertencias" if any(a["gravedad"] == "aviso" for a in adv) else "ok"
    metricas = {"secciones": len(secciones), "caracteres": len(texto_total), "lineas": len(texto_total.splitlines()),
                "secciones_ocr": sum(s.metodo in ("ocr", "ocr_parcial") for s in secciones),
                "secciones_vacias": sum(not s.texto.strip() for s in secciones)}
    return {"estado": estado, "metricas": metricas, "advertencias": adv}
