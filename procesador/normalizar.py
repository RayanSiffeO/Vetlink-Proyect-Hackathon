"""Normalización: limpia el formato del texto sin tocar su contenido clínico.

Solo se cambian espacios, saltos de línea, caracteres invisibles o de control y repeticiones evidentes
(líneas idénticas seguidas, cabeceras/pies repetidos en cada página, numeración de página).
No se modifican valores, unidades, fechas, dosis ni diagnósticos.
"""
import re
import unicodedata
from collections import Counter
from dataclasses import replace

_INVISIBLES = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff\u00ad"), None)   # espacios de ancho cero, guion blando
_ESPACIOS = {ord(c): " " for c in "\u00a0\u2002\u2003\u2009\u202f\u3000"}               # espacios especiales -> espacio normal
_LIGADURAS = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}                # NO se usa NFKC: cambiaría 'µ' o '²'
_NUM_PAGINA = re.compile(r"(?i)^(?:p[áa]g(?:ina)?\.?\s*)?\d+\s*(?:/|de)\s*\d+$")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _limpiar_texto(t):
    t = unicodedata.normalize("NFC", t.replace("\r\n", "\n").replace("\r", "\n"))
    for a, b in _LIGADURAS.items(): t = t.replace(a, b)
    t = _CONTROL.sub("", t.translate(_INVISIBLES).translate(_ESPACIOS))
    lineas = [re.sub(r"[ \t]{2,}", " ", l).strip() for l in t.split("\n")]
    return "\n".join(lineas)


def _quitar_repetidas(texto):
    """Elimina líneas idénticas consecutivas y líneas que son solo 'página X de Y'."""
    out, quitadas, prev = [], 0, None
    for l in texto.split("\n"):
        if l and (l == prev or _NUM_PAGINA.match(l)):
            quitadas += 1; continue
        out.append(l)
        if l: prev = l
    return "\n".join(out), quitadas


def _clave_cabecera(l):
    return re.sub(r"\d+", "#", l.lower())


def _quitar_cabeceras_pies(secciones):
    """Si una misma línea abre o cierra la mayoría de las páginas, se deja solo en la primera. Devuelve (secciones, nº)."""
    paginas = [s for s in secciones if s.pagina is not None and s.texto]
    if len(paginas) < 3: return secciones, 0
    cuenta = Counter()
    for s in paginas:
        ls = [l for l in s.texto.split("\n") if l.strip()]
        for k in {_clave_cabecera(l) for l in ls[:2] + ls[-2:] if len(l) <= 120}: cuenta[k] += 1
    repetidas = {k for k, n in cuenta.items() if n >= max(3, 0.6 * len(paginas))}
    if not repetidas: return secciones, 0
    vistas, quitadas, nuevas = set(), 0, []
    for s in secciones:
        if s.pagina is None or not s.texto: nuevas.append(s); continue
        ls = s.texto.split("\n")
        zona = {i for i, l in enumerate(ls) if l.strip()}
        zona = set(sorted(zona)[:2] + sorted(zona)[-2:])
        salida = []
        for i, l in enumerate(ls):
            k = _clave_cabecera(l)
            if i in zona and k in repetidas and len(l) <= 120:
                if k in vistas: quitadas += 1; continue
                vistas.add(k)
            salida.append(l)
        nuevas.append(replace(s, texto="\n".join(salida)))
    return nuevas, quitadas


def normalizar(secciones):
    """Devuelve (secciones_normalizadas, info) con contadores de lo que se ha limpiado."""
    antes = sum(len(s.texto) for s in secciones)
    nuevas, repetidas = [], 0
    for s in secciones:
        t, q = _quitar_repetidas(_limpiar_texto(s.texto))
        t = re.sub(r"\n{3,}", "\n\n", t).strip("\n")
        nuevas.append(replace(s, texto=t)); repetidas += q
    nuevas, cab = _quitar_cabeceras_pies(nuevas)
    nuevas = [replace(s, texto=re.sub(r"\n{3,}", "\n\n", s.texto).strip("\n")) for s in nuevas]
    info = {"caracteres_antes": antes, "caracteres_despues": sum(len(s.texto) for s in nuevas),
            "lineas_repetidas_eliminadas": repetidas, "cabeceras_pies_eliminados": cab}
    return nuevas, info
