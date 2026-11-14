#!/usr/bin/env python3
"""Regenerate packages/caelus/test/uncertainty-golden.json from the Python
reference (astroengine.uncertainty). The TypeScript port must return the same
bound, span, delta-T sigma, and clock term for each body and instant.
Run: python3 export_uncertainty_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import julian_day
from astroengine.uncertainty import position_uncertainty

BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
          "uranus", "neptune", "pluto", "chiron", "mean_node", "true_node"]
INSTANTS = [
    ("2000", julian_day(2000, 1, 1, 12), "tropical"),
    ("1955", julian_day(1955, 7, 4, 3), "tropical"),
    ("1620", julian_day(1620, 11, 8, 10), "tropical"),
    ("1500-sidereal", julian_day(1500, 6, 1, 12, calendar="julian"), "sidereal:lahiri"),
    ("1000", julian_day(1000, 1, 2, 0, calendar="julian"), "tropical"),
    ("100", julian_day(100, 3, 1, 12, calendar="julian"), "tropical"),
    ("-1000", julian_day(-1000, 3, 1, 12, calendar="julian"), "tropical"),
    ("-2900", julian_day(-2900, 7, 1, 0, calendar="julian"), "tropical"),
    ("2900", julian_day(2900, 1, 1, 0), "tropical"),
]


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.uncertainty (embedded VSOP, "
                    "full moon, era packs)", "cases": []}
    for label, jd, zodiac in INSTANTS:
        for body in BODIES:
            try:
                u = position_uncertainty(eng, body, jd, zodiac=zodiac)
            except ValueError:
                u = None  # the body has no data at this instant
            out["cases"].append({"id": f"{label}-{body}", "jd": jd, "body": body,
                                 "zodiac": zodiac, "result": u})
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "uncertainty-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    n = sum(1 for c in out["cases"] if c["result"] is not None)
    print(f"{len(out['cases'])} cases, {n} computed ->", path)


if __name__ == "__main__":
    main()
