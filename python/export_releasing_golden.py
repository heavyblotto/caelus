#!/usr/bin/env python3
"""Cross-language golden for astroengine.releasing (zodiacal releasing).

Runs a fixed set of releasing specs through the Python reference and records the
results. packages/caelus/test/releasing-golden.test.ts replays the same specs
through the TS port and must reproduce them. Embedded tier.

Usage: python3 export_releasing_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import releasing as R

NATAL = [1990, 6, 10, 14, 30]
TAMPA = (27.95, -82.46)


def jd(date):
    return julian_day(*date)


def build_cases():
    natal = jd(NATAL)
    return [
        # release timeline (L1+L2): Cancer (period 25 > 17.58) contains an L2
        # loosing of the bond; Aries (15) does not.
        {"id": "release-cancer", "type": "release", "lot_sign": 3,
         "natal": NATAL, "max_level": 2, "horizon_years": 26},
        {"id": "release-aries", "type": "release", "lot_sign": 0,
         "natal": NATAL, "max_level": 2, "horizon_years": 24},
        # active L1..L4 lords at several ages, from a fixed Lot sign
        {"id": "active-5y", "type": "active", "lot_sign": 3,
         "natal": NATAL, "target": [1995, 6, 10, 0, 0]},
        {"id": "active-30y", "type": "active", "lot_sign": 3,
         "natal": NATAL, "target": [2020, 6, 10, 0, 0]},
        {"id": "active-aries-40y", "type": "active", "lot_sign": 0,
         "natal": NATAL, "target": [2030, 1, 1, 0, 0]},
        # engine path: release from the Lot of Spirit / Fortune of the chart
        {"id": "at-spirit", "type": "at", "natal": NATAL, "target": [2025, 6, 10, 0, 0],
         "lat": TAMPA[0], "lon": TAMPA[1], "lot": "spirit"},
        {"id": "at-fortune", "type": "at", "natal": NATAL, "target": [2025, 6, 10, 0, 0],
         "lat": TAMPA[0], "lon": TAMPA[1], "lot": "fortune"},
    ]


def compute(spec, eng):
    t = spec["type"]
    if t == "release":
        return R.zr_release(spec["lot_sign"], jd(spec["natal"]),
                            spec["max_level"], spec["horizon_years"])
    if t == "active":
        return R.zr_active(spec["lot_sign"], jd(spec["natal"]), jd(spec["target"]))
    if t == "at":
        return R.zr_at(eng, jd(spec["natal"]), jd(spec["target"]),
                       spec["lat"], spec["lon"], spec["lot"])
    raise ValueError(spec["type"])


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.releasing (embedded VSOP, full moon); "
                    "Valens/Schmidt 360-day-year convention",
           "cases": []}
    for c in build_cases():
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:18s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "releasing-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
