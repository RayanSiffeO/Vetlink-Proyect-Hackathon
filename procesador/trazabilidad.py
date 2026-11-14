"""Trazabilidad: de dónde sale cada trozo de contenido (archivo, formato, página, hoja o sección)."""
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class Seccion:
    """Un trozo de contenido extraído con su origen."""
    texto: str
    pagina: int | None = None      # PDF
    hoja: str | None = None        # XLSX
    seccion: str | None = None     # CSV, JSON, DOCX...: nombre genérico de la sección
    metodo: str = "texto"          # texto | ocr | ocr_parcial
    avisos: list = field(default_factory=list)  # códigos de problemas de lectura

    def origen(self):
        o = {"pagina": self.pagina, "hoja": self.hoja, "seccion": self.seccion}
        return {k: v for k, v in o.items() if v is not None}


def hash_archivo(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def datos_archivo(ruta, formato, nombre_seguro, nombre_omitido):
    """Datos básicos del archivo de origen. El nombre solo se guarda si no contiene datos personales."""
    ruta = Path(ruta)
    return {
        "nombre": nombre_seguro,
        "nombre_omitido_por_privacidad": nombre_omitido,
        "formato": formato,
        "tamano_bytes": ruta.stat().st_size,
        "sha256": hash_archivo(ruta),
    }


def trazas_secciones(secciones):
    """Una entrada por sección con su origen, método de extracción y tamaño."""
    return [
        {"indice": i, **s.origen(), "metodo_extraccion": s.metodo,
         "caracteres": len(s.texto), "lineas": len(s.texto.splitlines())}
        for i, s in enumerate(secciones, 1)
    ]


def ahora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
