#!/usr/bin/env python3
"""Cross-language golden for astroengine.compiler's loss math (the pure part).

The optimizer itself is validated by behaviour, not pinned cross-language; what
must match bit-for-bit is form_loss / constraint_loss over explicit longitudes.

Usage: python3 export_compiler_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import compiler as C

CASES = [
    {"id": "aspect-exact", "lons": {"a": 10.0, "b": 70.0},
     "constraints": [{"kind": "aspect", "a": "a", "b": "b", "angle": 60.0}]},
    {"id": "aspect-off", "lons": {"a": 10.0, "b": 100.0},
     "constraints": [{"kind": "aspect", "a": "a", "b": "b", "angle": 60.0}]},
    {"id": "aspect-wrap", "lons": {"a": 350.0, "b": 10.0},
     "constraints": [{"kind": "aspect", "a": "a", "b": "b", "angle": 20.0}]},
    {"id": "sign-inside", "lons": {"v": 45.0},
     "constraints": [{"kind": "sign", "body": "v", "sign": 1}]},
    {"id": "sign-outside", "lons": {"v": 75.0},
     "constraints": [{"kind": "sign", "body": "v", "sign": 1}]},
    {"id": "sign-wrap", "lons": {"v": 5.0},
     "constraints": [{"kind": "sign", "body": "v", "sign": 11}]},
    {"id": "degree", "lons": {"v": 200.0},
     "constraints": [{"kind": "degree", "body": "v", "degree": 185.0}]},
    {"id": "weighted-combo", "lons": {"venus": 44.0, "mars": 46.0, "pluto": 220.0},
     "constraints": [
         {"kind": "aspect", "a": "venus", "b": "pluto", "angle": 180.0, "weight": 0.9},
         {"kind": "aspect", "a": "venus", "b": "mars", "angle": 0.0, "weight": 0.8},
         {"kind": "sign", "body": "venus", "sign": 1, "weight": 0.95},
     ]},
    # latitude-aware kinds: positions carry {lon, lat}; the legacy numeric
    # shape stays valid (lat 0) and both are pinned here.
    {"id": "declination-on-ecliptic", "lons": {"v": 90.0},
     "constraints": [{"kind": "declination", "body": "v", "degree": 23.4392911}]},
    {"id": "declination-with-lat",
     "lons": {"v": {"lon": 90.0, "lat": 5.0}},
     "constraints": [{"kind": "declination", "body": "v", "degree": 20.0}]},
    {"id": "parallel-held",
     "lons": {"a": {"lon": 45.0, "lat": 2.0}, "b": {"lon": 135.0, "lat": 2.0}},
     "constraints": [{"kind": "parallel", "a": "a", "b": "b"}]},
    {"id": "contraparallel",
     "lons": {"a": {"lon": 45.0, "lat": 2.0}, "b": {"lon": 225.0, "lat": -2.0}},
     "constraints": [{"kind": "parallel", "a": "a", "b": "b", "contra": True}]},
    {"id": "separation3d-vs-aspect",
     "lons": {"a": {"lon": 0.0, "lat": 8.0}, "b": {"lon": 60.0, "lat": -8.0}},
     "constraints": [
         {"kind": "separation3d", "a": "a", "b": "b", "angle": 60.0},
         {"kind": "aspect", "a": "a", "b": "b", "angle": 60.0},
     ]},
    {"id": "mixed-weighted-lat",
     "lons": {"venus": {"lon": 44.0, "lat": 1.0},
              "jupiter": {"lon": 132.0, "lat": 1.1}, "moon": 200.0},
     "constraints": [
         {"kind": "parallel", "a": "venus", "b": "jupiter", "weight": 0.9},
         {"kind": "declination", "body": "moon", "degree": -15.0, "weight": 0.5},
         {"kind": "aspect", "a": "venus", "b": "jupiter", "angle": 90.0, "weight": 0.7},
     ]},
]


def compute(spec):
    return C.form_loss(spec["lons"], spec["constraints"])


def main():
    out = {"basis": "Python reference astroengine.compiler.form_loss", "cases": []}
    for c in CASES:
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c)})
        print(f'{c["id"]:16s} ok  loss={compute(c):.6f}')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "compiler-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
