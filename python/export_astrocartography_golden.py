#!/usr/bin/env python3
"""Cross-language golden for astroengine.astrocartography.

packages/caelus/test/astrocartography-golden.test.ts replays these specs through
the TS port and must reproduce them. Embedded tier, coarse latitude step to keep
the fixture small.

Usage: python3 export_astrocartography_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import astrocartography as AC


def jd(date):
    return julian_day(*date)


CASES = [
    # pure planet_lines: explicit ra/dec/gast
    {"id": "lines-equator", "type": "lines", "ra": 0.0, "dec": 0.0,
     "gast": 0.0, "step": 15.0},
    {"id": "lines-north-dec", "type": "lines", "ra": 120.0, "dec": 20.0,
     "gast": 90.0, "step": 15.0},
    {"id": "lines-south-dec", "type": "lines", "ra": 300.0, "dec": -23.0,
     "gast": 200.0, "step": 15.0},
    # engine astrocartography: real bodies at a moment
    {"id": "acg-natal", "type": "acg",
     "bodies": ["sun", "moon", "mars", "saturn"],
     "jd": [1990, 6, 10, 18, 30], "step": 15.0},
    {"id": "acg-2024", "type": "acg",
     "bodies": ["sun", "venus", "jupiter"],
     "jd": [2024, 3, 20, 3, 0], "step": 20.0},
]


def compute(spec, eng):
    t = spec["type"]
    if t == "lines":
        return AC.planet_lines(spec["ra"], spec["dec"], spec["gast"],
                               lat_step=spec["step"])
    if t == "acg":
        return AC.astrocartography(eng, jd(spec["jd"]), spec["bodies"],
                                   lat_step=spec["step"])
    raise ValueError(t)


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.astrocartography (embedded VSOP, full moon)",
           "cases": []}
    for c in CASES:
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:16s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "astrocartography-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
