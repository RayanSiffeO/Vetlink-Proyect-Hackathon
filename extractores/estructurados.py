"""Aplana JSON, JSONL, XML o YAML a texto plano: una línea por objeto, con 'ruta: clave: valor; ...'.
Basado en el script aplanar_json.py: se conservan aplanar(), xml_a_dict() y cargar().
Uso suelto: python -m extractores.estructurados archivo.(json|jsonl|xml|yaml|yml) > salida.txt"""
import json, sys
import xml.etree.ElementTree as ET
from pathlib import Path

from extractores import leer_texto
from procesador.trazabilidad import Seccion

esc = lambda v: not isinstance(v, (dict, list))

def aplanar(o, ruta=""):
    if isinstance(o, dict):
        planos = "; ".join(f"{k}: {v}" for k, v in o.items() if esc(v) and v not in (None, ""))
        if planos: yield f"{ruta}: {planos}" if ruta else planos
        for k, v in o.items():
            if not esc(v): yield from aplanar(v, f"{ruta}.{k}" if ruta else k)
    elif isinstance(o, list):
        if all(esc(v) for v in o):
            if o: yield f"{ruta}: " + ", ".join(map(str, o))
        else:
            for i, v in enumerate(o): yield from aplanar(v, f"{ruta}[{i}]")
    elif o not in (None, ""): yield f"{ruta}: {o}"

def xml_a_dict(e):
    d, hijos = {f"@{k}": v for k, v in e.attrib.items()}, {}
    for c in e: hijos.setdefault(c.tag.split("}")[-1], []).append(xml_a_dict(c))
    d.update({k: v[0] if len(v) == 1 else v for k, v in hijos.items()})
    t = (e.text or "").strip()
    return (d | {"#text": t} if t else d) if d else t

def cargar(ruta):
    txt, ext = leer_texto(ruta), Path(ruta).suffix.lower()
    if ext == ".xml" or txt.lstrip().startswith("<"):
        r = ET.fromstring(txt); return {r.tag.split("}")[-1]: xml_a_dict(r)}
    if ext in (".yaml", ".yml"):
        import yaml
        docs = list(yaml.safe_load_all(txt)); return docs[0] if len(docs) == 1 else docs
    try: return json.loads(txt)
    except json.JSONDecodeError: return [json.loads(l) for l in txt.splitlines() if l.strip()]  # JSONL

def extraer(ruta, **_):
    """Devuelve una única Seccion con todo el contenido aplanado."""
    return [Seccion("\n".join(aplanar(cargar(ruta))), seccion="Contenido")]

if __name__ == "__main__":
    print("\n".join(aplanar(cargar(sys.argv[1]))))
