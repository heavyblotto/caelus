#!/usr/bin/env python3
"""Cross-language golden for astroengine.ashtottari (Ashtottari dasha).

Runs a fixed set of ashtottari specs through the Python reference and records the
results. packages/caelus/test/ashtottari-golden.test.ts replays the same specs
through the TS port and must reproduce them. Embedded tier.

Usage: python3 export_ashtottari_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import ashtottari as A

NATAL = [1990, 6, 10, 14, 30]
MOON_LON = 45.0   # sidereal: Rohini (nak index 3) -> Venus lord


def jd(date):
    return julian_day(*date)


def build_cases():
    return [
        # lord mapping across a few nakshatra indices (incl. the Rahu wrap)
        {"id": "lord-0", "type": "lord", "nak": 0},
        {"id": "lord-3", "type": "lord", "nak": 3},
        {"id": "lord-6", "type": "lord", "nak": 6},
        {"id": "lord-13", "type": "lord", "nak": 13},
        {"id": "lord-26", "type": "lord", "nak": 26},
        # the dasha timeline from a fixed sidereal Moon
        {"id": "dashas", "type": "dashas", "moon_lon": MOON_LON, "natal": NATAL},
        # active maha/antar at several ages
        {"id": "active-5y", "type": "active", "moon_lon": MOON_LON,
         "natal": NATAL, "target": [1995, 6, 10, 0, 0]},
        {"id": "active-50y", "type": "active", "moon_lon": MOON_LON,
         "natal": NATAL, "target": [2040, 1, 1, 0, 0]},
        # engine path
        {"id": "at-tampa", "type": "at", "natal": NATAL, "target": [2025, 6, 10, 0, 0]},
    ]


def compute(spec, eng):
    t = spec["type"]
    if t == "lord":
        return {"lord": A.ashtottari_lord(spec["nak"])}
    if t == "dashas":
        return A.ashtottari_dashas(spec["moon_lon"], jd(spec["natal"]), levels=2)
    if t == "active":
        return A.ashtottari_active(spec["moon_lon"], jd(spec["natal"]), jd(spec["target"]))
    if t == "at":
        return A.ashtottari_at(eng, jd(spec["natal"]), jd(spec["target"]))
    raise ValueError(spec["type"])


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.ashtottari (embedded VSOP, full moon); "
                    "JHora/PVR Rao mapping, Lahiri ayanamsa, 365.25-day dasha year",
           "cases": []}
    for c in build_cases():
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:12s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "ashtottari-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
