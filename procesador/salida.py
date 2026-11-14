"""Salida: escribe el TXT (texto protegido y normalizado) y el _manifest.json (datos técnicos, sin datos personales)."""
import json
from pathlib import Path

NOTA = ("Los datos personales (propietario, teléfono, email, dirección, DNI, microchip...) "
        "se han sustituido por etiquetas entre corchetes, como [PROPIETARIO] o [TELEFONO].")


def _titulo(s):
    if s.pagina is not None:
        return f"Página {s.pagina}" + {"ocr": " (OCR)", "ocr_parcial": " (OCR parcial)"}.get(s.metodo, "")
    if s.hoja is not None: return f"Hoja: {s.hoja}"
    return s.seccion or "Contenido"


def construir_txt(secciones, formato):
    partes = ["# HISTORIAL CLÍNICO VETERINARIO", f"Formato de origen: {formato.upper()}", NOTA]
    for s in secciones:
        if s.texto.strip(): partes += ["", f"## {_titulo(s)}", s.texto]
    return "\n".join(partes) + "\n"


def guardar(carpeta, nombre_base, secciones, formato, manifest):
    """Escribe <nombre_base>.txt y <nombre_base>_manifest.json. Devuelve (ruta_txt, ruta_manifest)."""
    carpeta = Path(carpeta); carpeta.mkdir(parents=True, exist_ok=True)
    ruta_txt, ruta_man = carpeta / f"{nombre_base}.txt", carpeta / f"{nombre_base}_manifest.json"
    manifest["archivo_salida"] = {"txt": ruta_txt.name, "manifest": ruta_man.name}
    if any(s.texto.strip() for s in secciones):
        ruta_txt.write_text(construir_txt(secciones, formato), encoding="utf-8")
    else:
        ruta_txt = None   # sin contenido no se genera TXT
        manifest["archivo_salida"]["txt"] = None
    ruta_man.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return ruta_txt, ruta_man
