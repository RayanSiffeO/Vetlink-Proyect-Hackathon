"""Privacidad: sustituye datos personales por etiquetas y avisa de lo dudoso.

- Los datos originales solo viven en memoria durante el proceso: nunca se escriben en el TXT ni en el manifest.
- Dos pasadas sobre todo el documento: la primera registra qué datos distintos hay; la segunda los sustituye.
  Así el mismo dato lleva siempre la misma etiqueta y, si hay varios del mismo tipo, se numeran
  ([PROPIETARIO_1], [PROPIETARIO_2]...).
- Si algo parece un dato personal pero no se puede asegurar, NO se borra: se genera un aviso (sin el dato).
"""
import re
import unicodedata
from collections import Counter
from dataclasses import replace

CATEGORIAS = ["PROPIETARIO", "TELEFONO", "EMAIL", "DIRECCION", "DNI", "IDENTIFICADOR_ANIMAL", "CUENTA_BANCARIA"]

_L = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñ"                      # letras
_TOK = rf"[A-ZÁÉÍÓÚÜÑ][{_L}'’-]+"                  # palabra que empieza en mayúscula
_PART = r"(?:de|del|de\s+la|de\s+los|de\s+las|y|i|da|di|van|von|dos|das)"
_NOMBRE = rf"{_TOK}(?:[ \t]+(?:{_PART}[ \t]+)?{_TOK}){{0,4}}"
_PARTICULAS = {"de", "del", "la", "las", "los", "y", "i", "da", "di", "van", "von", "dos", "das"}

# ---------------------------------------------------------------- patrones directos
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
IBAN_RE = re.compile(r"(?<![\w])[A-Z]{2}\d{2}(?:[ \t]?[A-Z0-9]{4}){4,7}(?:[ \t]?[A-Z0-9]{1,4})?(?![\w])")
DNI_RE = re.compile(r"(?<![\w])(?:\d{8}|[XYZxyz]\d{7})[ \t-]?[A-Za-z](?![\w])")
CHIP_RE = re.compile(r"(?<!\d)\d{3}(?:[ \t.-]?\d{3}){4}(?!\d)")  # 15 dígitos (ISO 11784), con o sin separadores
TEL_RE = re.compile(
    r"(?<![\d\w])(?:(?:\+|00)\d{1,3}[ \t.-]?)?[6-9](?:\d{2}[ \t.-]?\d{3}[ \t.-]?\d{3}|\d[ \t.-]?\d{3}[ \t.-]?\d{2}[ \t.-]?\d{2}"
    r"|\d{2}[ \t.-]?\d{2}[ \t.-]?\d{2}[ \t.-]?\d{2}|\d[ \t.-]?\d{7})(?!\d)"   # España (9 dígitos)
    r"|(?<![\d\w])\+\d{1,3}[ \t.-]?\d(?:[ \t.-]?\d){6,11}(?!\d)")            # internacional
_VIAS = (r"(?i:c/|calle|avda\.?|av\.|avenida|plaza|pza\.?|paseo|pº|camino|carretera|ctra\.?|ronda|"
         r"traves[ií]a|urbanizaci[oó]n|urb\.|pol[ií]gono|bulevar|glorieta|callej[oó]n|rambla)")
DIR_RE = re.compile(
    rf"(?<![\w]){_VIAS}[ \t]*[^;|\n]{{1,60}}?[ \t]*,?[ \t]*(?:n[ºo°.]?[ \t]*)?\d{{1,4}}\w?\b"
    r"(?:[ \t]*,?[ \t]*(?i:\d{1,2}[ºª°][ \t]*[A-Za-z]?|bajo|bj|ático|esc\w*\.?[ \t]*\w+|piso[ \t]*\w+|puerta[ \t]*\w+|portal[ \t]*\w+))*"
    r"(?:[ \t]*,?[ \t]*\d{5}(?:[ \t]+[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:[ \t]+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)?)?)?")

# ---------------------------------------------------------------- campos etiquetados
_SEP = r"[ \t]*[:=|][ \t]*"
_SIGUIENTE_CAMPO = re.compile(
    r"\s+(?i:tel[eé]fono|tel|tfno|tlf|m[oó]vil|e-?mail|correo|dni|nif|nie|direcci[oó]n|domicilio|fecha|especie|raza|"
    r"sexo|edad|peso|paciente|mascota|animal|chip|microchip|motivo|diagn[oó]stico|nombre|cp|c[oó]digo|localidad|"
    r"poblaci[oó]n|provincia|veterinari[oa]|vet|observaciones|historia|n[ºo°]|num|cliente|propietari[oa]|titular|phone|patient|weight|species|breed|address|date|treatment|owner|client|name)\b[^:\n]{0,25}:")

_ETIQUETADOS = [  # (categoría, regex con grupo v, validador del valor ya recortado)
    ("TELEFONO", re.compile(rf"(?<![\w])(?i:tel[eé]fono|tel|tfno|tlf|m[oó]vil|fax|phone|celular)\.?[ \t]*(?:n[ºo°.]?)?{_SEP}(?P<v>[^;|\n]{{3,40}})"),
     lambda v: sum(c.isdigit() for c in v) >= 6),
    ("DNI", re.compile(rf"(?<![\w])(?i:dni|nif|nie|documento[ \t]+de[ \t]+identidad)[ \t]*(?:n[ºo°.]?)?{_SEP}(?P<v>[^;|\n]{{3,30}})"),
     lambda v: sum(c.isdigit() for c in v) >= 6 and len(v) <= 14),
    ("IDENTIFICADOR_ANIMAL", re.compile(
        rf"(?<![\w])(?i:micro[ \t]*-?[ \t]*chip|chip|transponder|tatuaje|pasaporte(?:[ \t]+(?:europeo|de[ \t]+la[ \t]+mascota|animal))?|"
        rf"n[ºo°.]?[ \t]*(?:de[ \t]+)?(?:identificaci[oó]n|cartilla)|c[oó]digo[ \t]+de[ \t]+identificaci[oó]n|id[ \t]+animal|siaci?|riac)"
        rf"[ \t]*(?:n[ºo°.]?)?{_SEP}(?P<v>[^;|\n]{{3,40}})"),
     lambda v: sum(c.isdigit() for c in v) >= 4),
    ("DIRECCION", re.compile(rf"(?<![\w])(?i:direcci[oó]n(?:[ \t]+postal)?|domicilio|c[oó]digo[ \t]+postal|c\.?[ \t]?p\.?)[ \t]*{_SEP}(?P<v>[^;|\n]{{3,100}})"),
     lambda v: len(v) >= 3),
]
_PROP_RE = re.compile(
    r"(?<![\wÁ-ú])(?i:(?:nombre[ \t]+(?:y[ \t]+apellidos[ \t]+)?(?:del?[ \t]+|de[ \t]+la[ \t]+)?)?"
    r"(?:propietari[oa]s?|titular|due[ñn][oa]s?|clientes?|tutor(?:a)?|owner|client|responsable[ \t]+del[ \t]+(?:animal|paciente|mascota))"
    r"(?:[ \t]+(?:nombre|apellidos?|name|completo))?)"
    rf"(?:[ \t]*[.:][ \t]*(?i:nombre|apellidos?|name))?{_SEP}(?P<v>[^;|\n]{{2,80}})")
_CAMPO_NOMBRE_RE = re.compile(rf"(?<![\wÁ-ú.])(?i:nombre[ \t]+y[ \t]+apellidos|nombre(?:[ \t]+completo)?|apellidos?|apellido[12]|name|surname){_SEP}(?P<v>[^;|\n]{{2,60}})")
_NOMBRE_SUELTO_RE = re.compile(rf"(?<![\wÁ-ú.])(?i:nombre[ \t]+y[ \t]+apellidos|nombre[ \t]+completo|apellidos?){_SEP}(?P<v>[^;|\n]{{2,60}})")
_CABECERA_PROP = re.compile(r"^\s*(?:##\s*)?(?:[\w.\[\]]+:[ \t]*)?(?i:datos[ \t]+(?:del?[ \t]+)?)?(?i:propietari|titular|cliente|due[ñn]o|tutor)\w*[ \t]*:?[ \t]*$")
_RUTA_PROP = re.compile(r"^\s*(?:##\s*)?[^:;|\n]*?(?i:propietari|titular|due[ñn]o|cliente|tutor|owner|client)[^:;|\n]*:[ \t]*[\w.\[\]]+[ \t]*:")
_HONORIFICO_RE = re.compile(rf"(?<![\wÁ-ú])(?:Sr\.?|Sra\.?|Srta\.?|SR\.?|SRA\.?|D\.|Dña\.?|Doña|Don)[ \t]+(?P<n>{_NOMBRE})")
_PREFIJO_HON = re.compile(r"^(?:Sr\.?|Sra\.?|Srta\.?|D\.|Dña\.?|Doña|Don)\s+")
_LOTE_ANTES = re.compile(r"(?i:lote|lot|batch|serie|caducidad|ref)\b[^\d]{0,12}$")


def _sin_acentos(t):
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")

def _clave_nombre(t):
    return re.sub(r"[\s_\-]+", " ", _sin_acentos(t).casefold()).strip(" ,.")

def _clave(cat, v):
    if cat == "TELEFONO": return re.sub(r"\D", "", v)[-9:]
    if cat == "EMAIL": return v.lower()
    if cat in ("DNI", "IDENTIFICADOR_ANIMAL", "CUENTA_BANCARIA"): return re.sub(r"[^A-Za-z0-9]", "", v).upper()
    return _clave_nombre(v)

def _cortar(v):
    """Recorta un valor etiquetado hasta el siguiente campo ('Juan Pérez Teléfono: ...' -> 'Juan Pérez')."""
    v = v.split("[", 1)[0] if "[" in v and not v.startswith("[") else v
    m = _SIGUIENTE_CAMPO.search(" " + v)
    if m: v = (" " + v)[:m.start()].lstrip() if m.start() > 0 else ""
    return v.rstrip(" ,.-")

def _sub_valor(rx, linea, fn):
    """Aplica fn(valor_recortado) -> texto de sustitución | None a cada coincidencia, sustituyendo solo el valor."""
    out, pos = [], 0
    for m in rx.finditer(linea):
        if m.start("v") < pos: continue
        v = _cortar(m.group("v"))
        rep = fn(v) if v and not v.startswith("[") and "[" not in v else None
        if rep is None: continue
        ini = m.start("v")
        out.append(linea[pos:ini]); out.append(rep); pos = ini + len(v)
    out.append(linea[pos:])
    return "".join(out)

_CLASES = {"a": "aáàäâ", "e": "eéèëê", "i": "iíìïî", "o": "oóòöô", "u": "uúùüû", "n": "nñ"}

def _patron_flexible(texto):
    """Patrón que ignora acentos y acepta espacios, guiones o guiones bajos entre palabras."""
    out = []
    for c in _sin_acentos(texto).lower():
        if c.isspace(): out.append(r"[\s_\-]+")
        elif c in _CLASES: out.append(f"[{_CLASES[c]}]")
        else: out.append(re.escape(c))
    return "".join(out)

def _variantes(nombre):
    v = {nombre}
    if "," in nombre:
        ap, _, nom = nombre.partition(",")
        if ap.strip() and nom.strip(): v.add(f"{nom.strip()} {ap.strip()}")
    elif len(nombre.split()) >= 2:
        t = nombre.split(); v.add(f"{' '.join(t[1:])}, {t[0]}")
    return v


class Anonimizador:
    def __init__(self):
        self.fase = 1
        self.registro = {c: {} for c in CATEGORIAS}   # categoría -> {clave: nº}
        self.originales = {}                          # clave de propietario -> nombre tal cual (solo en memoria)
        self.alias = {}                               # clave de variante/parte -> clave canónica
        self.apariciones = Counter()
        self.avisos = []
        self._ubic = (0, 0)
        self._silencioso = False
        self._rx_nombres = None
        self._tokens = {}
        self._ultimo = None
        self._captura = False

    # ---------------------------------------------------------------- registro y etiquetas
    def _rep(self, cat, valor):
        clave = _clave(cat, valor)
        if cat == "PROPIETARIO": clave = self.alias.get(clave, clave)
        reg = self.registro[cat]
        if self.fase == 1:
            if cat == "PROPIETARIO": self.originales.setdefault(clave, valor.strip())
            reg.setdefault(clave, len(reg) + 1)
            return f"[{cat}]"
        n = reg.setdefault(clave, len(reg) + 1)
        self.apariciones[cat] += 1
        return f"[{cat}_{n}]" if len(reg) > 1 else f"[{cat}]"

    def _avisar(self, tipo, detalle):
        if self.fase == 2 and not self._silencioso:
            aviso = {"tipo": tipo, "detalle": detalle, "seccion": self._ubic[0], "linea": self._ubic[1]}
            if aviso not in self.avisos: self.avisos.append(aviso)

    def _cerrar_fase1(self):
        """Fusiona variantes de un mismo propietario y prepara la búsqueda de sus nombres en el resto del texto."""
        reg = self.registro["PROPIETARIO"]
        claves = list(reg)
        for k in claves:
            if k in self.alias: continue
            for var in _variantes(self.originales[k]):
                kv = _clave_nombre(var)
                if kv != k and kv in reg: self.alias[kv] = k
        canon = [k for k in claves if k not in self.alias]
        self.registro["PROPIETARIO"] = {k: i + 1 for i, k in enumerate(canon)}
        variantes = {}
        for k in canon:
            for var in _variantes(self.originales[k]):
                if len(var) >= 4: variantes[var] = k
            for t in self.originales[k].replace(",", " ").split():
                if len(t) >= 4 and t.lower() not in _PARTICULAS: self._tokens.setdefault(_clave_nombre(t), k)
        for var, k in variantes.items(): self.alias[_clave_nombre(var)] = k
        if variantes:
            alt = "|".join(_patron_flexible(v) for v in sorted(variantes, key=len, reverse=True))
            self._rx_nombres = re.compile(rf"(?<![\w])(?:{alt})(?![\w])", re.I)
        self.fase = 2

    # ---------------------------------------------------------------- una línea
    def _nombres_en_contexto(self, linea, modo):
        """Línea 'propietario: nombre: X; apellidos: Y' o bloque 'Datos del propietario': esos nombres son del propietario."""
        partes = [(m, _cortar(m.group("v"))) for m in _CAMPO_NOMBRE_RE.finditer(linea)]
        partes = [(m, v) for m, v in partes if v and "[" not in v and not re.search(r"\d", v)]
        if modo == 2:  # línea posterior al nombre: solo se aceptan apellidos
            partes = [(m, v) for m, v in partes if re.search(r"(?i)apellid", m.group(0)[:m.start("v") - m.start(0)])]
        if not partes: return linea
        completo = " ".join(v for _, v in partes)
        if modo == 2 and self._ultimo:      # apellidos en otra línea: se unen al nombre ya visto
            if self.fase == 1:
                self.originales[self._ultimo] = f"{self.originales[self._ultimo]} {completo}"
                tag = "[PROPIETARIO]"
            else:
                tag = self._rep("PROPIETARIO", self.originales[self._ultimo])
        else:
            k = _clave_nombre(completo)
            if self.fase == 1:
                self.originales.setdefault(k, completo)
                for _, v in partes:
                    if len(v) >= 4 and _clave_nombre(v) != k: self.alias.setdefault(_clave_nombre(v), k)
            tag = self._rep("PROPIETARIO", completo)
            self._ultimo = self.alias.get(k, k)
        self._captura = True
        for m, v in reversed(partes):
            ini = m.start("v"); linea = linea[:ini] + tag + linea[ini + len(v):]
        return linea

    def _nombre_etiquetado(self, v):
        v = _PREFIJO_HON.sub("", v)
        if re.search(r"\d", v):
            self._avisar("propietario_con_digitos", "Campo de propietario con un valor que contiene números; no se ha sustituido.")
            return None
        if len(v.split()) > 7:
            self._avisar("propietario_valor_largo", "Campo de propietario con un texto largo que no parece un nombre; no se ha sustituido.")
            return None
        return self._rep("PROPIETARIO", v)

    def _telefono(self, m):
        antes = m.string[max(0, m.start() - 18):m.start()]
        return m.group(0) if _LOTE_ANTES.search(antes) else self._rep("TELEFONO", m.group(0))

    def _honorifico(self, m):
        nombre = m.group("n")
        toks = {_clave_nombre(t) for t in nombre.split()}
        for t in toks:
            if t in self._tokens: return self._rep("PROPIETARIO", self.originales[self._tokens[t]])
        self._avisar("posible_nombre_persona", "Posible nombre de persona precedido de un tratamiento (Sr./Sra./D.), sin etiqueta clara; no se ha sustituido.")
        return m.group(0)

    def _linea(self, linea, en_ctx):
        t = linea
        t = EMAIL_RE.sub(lambda m: self._rep("EMAIL", m.group(0)), t)
        t = IBAN_RE.sub(lambda m: self._rep("CUENTA_BANCARIA", m.group(0)), t)
        t = DNI_RE.sub(lambda m: self._rep("DNI", m.group(0)), t)
        t = CHIP_RE.sub(lambda m: self._rep("IDENTIFICADOR_ANIMAL", m.group(0)), t)
        t = TEL_RE.sub(self._telefono, t)
        t = DIR_RE.sub(lambda m: self._rep("DIRECCION", m.group(0)), t)
        for cat, rx, valida in _ETIQUETADOS:
            t = _sub_valor(rx, t, lambda v, c=cat, f=valida: self._rep(c, v) if f(v) else None)
        if en_ctx: t = self._nombres_en_contexto(t, en_ctx)
        t = _sub_valor(_PROP_RE, t, self._nombre_etiquetado)
        if self._rx_nombres: t = self._rx_nombres.sub(lambda m: self._rep("PROPIETARIO", m.group(0)), t)
        t = _HONORIFICO_RE.sub(self._honorifico, t)
        if en_ctx != 1:
            for m in _NOMBRE_SUELTO_RE.finditer(t):
                v = _cortar(m.group("v"))
                if re.fullmatch(_NOMBRE, v) and len(v.split()) >= 2:
                    self._avisar("nombre_sin_contexto", "Campo 'nombre' con aspecto de nombre completo de persona, sin indicar si es el propietario; no se ha sustituido.")
        return t

    def procesar_seccion(self, texto, idx):
        salida, ctx, apell = [], 0, False   # ctx: líneas que quedan del bloque 'Datos del propietario'
        for n, linea in enumerate(texto.split("\n"), 1):
            self._ubic, self._captura = (idx, n), False
            if not linea.strip(): ctx, apell = 0, False
            if _CABECERA_PROP.match(linea): ctx, apell = 4, False
            ruta = bool(_RUTA_PROP.match(linea))
            modo = 1 if (ruta or ctx > 0) else 2 if apell else 0
            if self.fase == 2:
                # avisa de tablas con encabezados de datos personales (no se pueden emparejar con sus valores)
                if re.search(r"(?i)propietari|titular|tel[eé]fono|dni|direcci[oó]n", linea) and linea.count("|") >= 2 and not re.search(r"[:\d]", linea):
                    self._avisar("tabla_con_encabezados_personales", "Fila de tabla que parece una cabecera de datos personales; revisar las filas siguientes.")
            salida.append(self._linea(linea, modo))
            if self._captura and not ruta and modo == 1: ctx, apell = 0, True   # tras el nombre, solo apellidos en la línea siguiente
            else: apell = False
            if ctx: ctx -= 1
        return "\n".join(salida)

    def proteger_suelto(self, texto):
        """Para textos cortos (nombres de hoja, de archivo): aplica las mismas sustituciones sin avisos."""
        self._silencioso, ub = True, self._ubic
        r = "\n".join(self._linea(l, False) for l in texto.split("\n"))
        self._silencioso, self._ubic = False, ub
        return r


def anonimizar(secciones):
    """Devuelve (secciones_protegidas, informe, anonimizador). El informe no contiene datos originales."""
    an = Anonimizador()
    for i, s in enumerate(secciones, 1): an.procesar_seccion(s.texto, i)
    an._cerrar_fase1()
    nuevas = []
    for i, s in enumerate(secciones, 1):
        hoja = an.proteger_suelto(s.hoja) if s.hoja else s.hoja
        nuevas.append(replace(s, texto=an.procesar_seccion(s.texto, i), hoja=hoja))
    informe = {
        "sustituciones": {c: an.apariciones[c] for c in CATEGORIAS if an.apariciones[c]},
        "entidades_distintas": {c: len(an.registro[c]) for c in CATEGORIAS if an.apariciones[c]},
        "avisos": an.avisos,
    }
    return nuevas, informe, an


def buscar_residuos(texto):
    """Comprobación final: patrones de datos personales que siguen en el texto ya protegido."""
    pruebas = {"EMAIL": EMAIL_RE, "DNI": DNI_RE, "IDENTIFICADOR_ANIMAL": CHIP_RE, "CUENTA_BANCARIA": IBAN_RE}
    r = {c: len(rx.findall(texto)) for c, rx in pruebas.items()}
    # los números tipo teléfono precedidos de 'lote', 'serie'... son datos clínicos y no se tocan
    r["TELEFONO"] = sum(1 for m in TEL_RE.finditer(texto) if not _LOTE_ANTES.search(texto[max(0, m.start() - 18):m.start()]))
    return {c: n for c, n in r.items() if n}
