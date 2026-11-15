#!/usr/bin/env python3
"""Convierte los muebles etiquetados en la página «Muebles de casa» en el
muebles.json que lee la app (se copia al robot en /mnt/data/muebles.json).

Uso: exportar.py <carpeta con un .json por documento> > muebles.json

Reglas:
- Solo cuentan los documentos con estado "mueble" (confirmados o propuestas).
- Los dibujados a mano mandan: una zona detectada que quede casi dentro de un
  mueble dibujado (patas, trozos) no se pinta aparte.
- La base del robot y los objetos diminutos no se pintan.
- La mesa del comedor lleva limpiarDebajo, que activa el botón en la app.
"""
import json
import pathlib
import sys

MIN_AREA = 600  # cm²: menos que un cuadrado de ~25 cm es ruido para la maqueta


def overlap(a, b):
    w = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
    h = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
    return max(0, w) * max(0, h)


def main(folder):
    docs = []
    for f in sorted(pathlib.Path(folder).glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        d = d.get("data", d)  # admite el documento tal cual o envuelto
        d["id"] = f.stem
        if d.get("estado") == "mueble" and d.get("w", 0) > 0 and d.get("h", 0) > 0:
            docs.append(d)

    drawn = [d for d in docs if d.get("origen") == "dibujado"]
    out = []
    for d in docs:
        nombre = d.get("nombre") or d.get("tipo") or ""
        if "base del robot" in nombre.lower():
            continue
        if d["w"] * d["h"] < MIN_AREA:
            continue
        if d.get("origen") == "auto" and any(overlap(d, o) > 0.3 * d["w"] * d["h"] for o in drawn):
            continue
        out.append({
            "id": d["id"],
            "tipo": d.get("tipo", ""),
            "nombre": nombre,
            "habitacion": d.get("room", ""),
            "x": round(d["x"]), "y": round(d["y"]), "w": round(d["w"]), "h": round(d["h"]),
            "limpiarDebajo": d.get("tipo") == "Mesa" and "comedor" in nombre.lower() and d.get("origen") == "dibujado",
            "confirmado": not d.get("propuesta", False),
        })
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    print()


if __name__ == "__main__":
    main(sys.argv[1])
