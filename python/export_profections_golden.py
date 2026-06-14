#!/usr/bin/env python3
"""Cross-language golden for astroengine.profections.

Runs a fixed set of profection specs through the Python reference and records
the results. packages/caelus/test/profections-golden.test.ts replays the same
specs through the TS port and must reproduce them. Embedded tier.

Usage: python3 export_profections_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import profections as P

NATAL = [1990, 6, 10, 14, 30]
TAMPA = (27.95, -82.46)


def jd(date):
    return julian_day(*date)


def build_cases():
    return [
        # pure: explicit Ascendant sign, various ages and months, and a 12-year wrap
        {"id": "prof-age0", "type": "profection", "asc_sign": 6,
         "natal": NATAL, "target": [1990, 6, 10, 14, 30]},
        {"id": "prof-age1", "type": "profection", "asc_sign": 6,
         "natal": NATAL, "target": [1991, 6, 11, 0, 0]},
        {"id": "prof-age1-month", "type": "profection", "asc_sign": 6,
         "natal": NATAL, "target": [1992, 1, 1, 0, 0]},
        {"id": "prof-age12-wrap", "type": "profection", "asc_sign": 6,
         "natal": NATAL, "target": [2002, 9, 1, 0, 0]},
        {"id": "prof-age29-saturn", "type": "profection", "asc_sign": 0,
         "natal": NATAL, "target": [2019, 12, 1, 0, 0]},
        # chart: Ascendant sign taken from the natal chart, tropical and sidereal
        {"id": "prof-chart-tampa", "type": "profection_at",
         "natal": NATAL, "target": [2025, 6, 10, 0, 0],
         "lat": TAMPA[0], "lon": TAMPA[1], "zodiac": "tropical"},
        {"id": "prof-chart-sidereal", "type": "profection_at",
         "natal": NATAL, "target": [2025, 6, 10, 0, 0],
         "lat": TAMPA[0], "lon": TAMPA[1], "zodiac": "sidereal:lahiri"},
    ]


def compute(spec, eng):
    t = spec["type"]
    if t == "profection":
        return P.profection(spec["asc_sign"], jd(spec["natal"]), jd(spec["target"]))
    if t == "profection_at":
        return P.profection_at(eng, jd(spec["natal"]), jd(spec["target"]),
                               spec["lat"], spec["lon"],
                               spec.get("zodiac", "tropical"))
    raise ValueError(spec["type"])


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.profections (embedded VSOP, full moon)",
           "cases": []}
    for c in build_cases():
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:22s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "profections-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
