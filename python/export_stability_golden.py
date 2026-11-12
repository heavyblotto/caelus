#!/usr/bin/env python3
"""Regenerate packages/caelus/test/stability-golden.json from the Python
reference (astroengine.stability). The TypeScript port runs the same specs
and must report the same facts, values, and change instants.
Run: python3 export_stability_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import julian_day
from astroengine.stability import chart_stability

TAMPA = (27.95, -82.46)
CASES = [
    ("quarter-hour-tampa", julian_day(1990, 6, 10, 18, 30), TAMPA, {"half_width_seconds": 900}),
    ("six-hours-tampa", julian_day(1990, 6, 10, 18, 30), TAMPA, {"half_width_seconds": 21600}),
    ("no-place-hour", julian_day(1990, 6, 10, 18, 30), None, {"half_width_seconds": 3600}),
    ("whole-sign-sidereal", julian_day(2001, 2, 3, 4, 5), (51.5, -0.13),
     {"half_width_seconds": 1800, "house_system": "whole_sign", "zodiac": "sidereal:lahiri"}),
    ("rome-100-default-sigma", julian_day(100, 3, 1, 12, calendar="julian"), (41.9, 12.5), {}),
    ("modern-default-sigma", julian_day(2020, 12, 21, 18, 20), (51.48, 0.0), {}),
    ("coarse-step", julian_day(1975, 9, 1, 3, 0), (-33.87, 151.21),
     {"half_width_seconds": 7200, "step_seconds": 300.0}),
    ("zero-window", julian_day(1990, 6, 10, 18, 30), TAMPA, {"half_width_seconds": 0}),
]


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.stability (embedded VSOP, full moon)",
           "cases": []}
    for cid, jd, place, opts in CASES:
        lat, lon = place if place else (None, None)
        res = chart_stability(eng, jd, lat, lon, **opts)
        out["cases"].append({"id": cid, "jd": jd, "lat": lat, "lon": lon,
                             "options": opts, "result": res})
        print(f'{cid:26s} {res["summary"]["facts"]} facts, {res["summary"]["stable"]} stable')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "stability-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
