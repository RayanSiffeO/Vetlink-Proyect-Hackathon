"""Aplana Word (.docx) o PDF a texto plano, en orden de lectura.
Basado en el script aplanar_doc.py: se conservan docx(), ocr(), dentro(), zonas_escaneadas() y pdf().
Las tablas de Word salen como filas 'celda | celda'.
En PDF, las imágenes grandes sin texto encima (escaneos) se leen por OCR, incluso si la página
también tiene texto normal. Las páginas sin texto ni imágenes detectables se leen enteras por OCR.
Uso suelto: python -m extractores.documentos archivo.docx|archivo.pdf [idioma_ocr] > salida.txt
Idioma OCR por defecto: spa+eng (se usan los que haya instalados en Tesseract)"""
import sys
from pathlib import Path

from procesador.trazabilidad import Seccion

# Si Tesseract no está en el PATH (típico en Windows), pon aquí su ruta, por ejemplo:
# TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
TESSERACT_CMD = None

MIN_FRAC = 0.15   # una imagen cuenta si ocupa al menos esta fracción de la página (ignora logos e iconos)
MIN_CHARS = 30    # si hay menos caracteres de texto real sobre la imagen, se considera escaneada

def docx(ruta):
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    d = Document(ruta)
    for el in d.element.body.iterchildren():
        if el.tag.endswith("}p"):
            if t := Paragraph(el, d).text.strip(): yield t
        elif el.tag.endswith("}tbl"):
            for fila in Table(el, d).rows:
                celdas, prev = [], None
                for c in fila.cells:
                    if c._tc is not prev: celdas.append(c.text.strip().replace("\n", " "))
                    prev = c._tc
                if any(celdas): yield " | ".join(celdas)

def idioma_disponible(idioma):
    """Filtra el idioma pedido (p. ej. 'spa+eng') dejando solo los instalados. None si no hay OCR utilizable."""
    try:
        import pytesseract
        if TESSERACT_CMD: pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
        instalados = set(pytesseract.get_languages())
    except Exception:
        return None
    ok = [l for l in idioma.split("+") if l in instalados]
    return "+".join(ok) or None

def ocr(pagina, idioma):
    """Sirve para una página entera o para una zona recortada (crop)."""
    import pytesseract
    if TESSERACT_CMD: pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    img = pagina.to_image(resolution=300).original
    return pytesseract.image_to_string(img, lang=idioma).strip()

def dentro(o, b):
    """True si el centro del objeto cae dentro del rectángulo b = (x0, top, x1, bottom)."""
    cx, cy = (o["x0"] + o["x1"]) / 2, (o["top"] + o["bottom"]) / 2
    return b[0] <= cx <= b[2] and b[1] <= cy <= b[3]

def zonas_escaneadas(pg):
    """Rectángulos de imágenes grandes que no tienen texto real encima."""
    area_pg = pg.width * pg.height
    zonas = []
    for im in pg.images:
        b = (max(im["x0"], 0), max(im["top"], 0), min(im["x1"], pg.width), min(im["bottom"], pg.height))
        if b[2] <= b[0] or b[3] <= b[1]: continue
        if (b[2] - b[0]) * (b[3] - b[1]) < MIN_FRAC * area_pg: continue
        if sum(1 for c in pg.chars if dentro(c, b)) < MIN_CHARS: zonas.append(b)
    return zonas

def pdf(ruta, idioma):
    """Genera (pagina, metodo, texto, avisos) por cada página. metodo: texto | ocr | ocr_parcial."""
    import pdfplumber
    idioma = idioma_disponible(idioma)  # None si Tesseract o sus idiomas no están instalados
    with pdfplumber.open(ruta) as p:
        for i, pg in enumerate(p.pages, 1):
            zonas = zonas_escaneadas(pg)
            if zonas:
                if idioma is None:
                    yield i, "texto", (pg.extract_text() or "").strip(), ["ocr_no_disponible"]
                    continue
                # texto real de la página, sin los pocos caracteres que haya sobre las zonas escaneadas
                resto = pg.filter(lambda o: not (o["object_type"] == "char" and any(dentro(o, b) for b in zonas)))
                texto = (resto.extract_text() or "").strip()
                partes = []  # (posición vertical, texto) para respetar el orden de lectura
                if texto:
                    partes.append((min(c["top"] for c in resto.chars), texto))
                hay_ocr = False
                for b in zonas:
                    if t := ocr(pg.crop(b), idioma):
                        partes.append((b[1], t)); hay_ocr = True
                if partes:
                    partes.sort(key=lambda x: x[0])
                    metodo = "ocr_parcial" if texto and hay_ocr else "ocr" if hay_ocr else "texto"
                    yield i, metodo, "\n".join(t for _, t in partes), []
                else:
                    yield i, "ocr", "", []
                continue
            if t := (pg.extract_text() or "").strip():
                yield i, "texto", t, []
            elif idioma is None:
                yield i, "texto", "", ["ocr_no_disponible"]
            else:
                yield i, "ocr", ocr(pg, idioma), []

def extraer(ruta, idioma_ocr="spa+eng", **_):
    """Devuelve una Seccion por página (PDF) o una única Seccion con todo el documento (DOCX)."""
    if Path(ruta).suffix.lower() == ".docx":
        return [Seccion("\n".join(docx(ruta)), seccion="Contenido")]
    return [Seccion(t, pagina=i, metodo=m, avisos=a) for i, m, t, a in pdf(ruta, idioma_ocr)]

if __name__ == "__main__":
    f = sys.argv[1]
    idioma = sys.argv[2] if len(sys.argv) > 2 else "spa+eng"
    secs = extraer(f, idioma_ocr=idioma)
    out = "\n".join(s.texto if s.pagina is None else f"## Página {s.pagina}" + (" (OCR)" if s.metodo != "texto" else "") + "\n" + s.texto for s in secs)
    if not out.strip(): print("Aviso: no se obtuvo texto (ni directo ni por OCR).", file=sys.stderr)
    print(out)
