#!/usr/bin/env python3
"""Cross-language golden for astroengine.directions (primary directions).

Runs a fixed set of direction specs through the Python reference and records the
results. packages/caelus/test/directions-golden.test.ts replays the same specs
through the TS port and must reproduce them. Embedded tier.

Usage: python3 export_directions_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import directions as D

NATAL = [1990, 6, 10, 14, 30]
TAMPA = (27.95, -82.46)


def jd(date):
    return julian_day(*date)


def build_cases():
    return [
        # pure arcs: normal, a meridian-on case (arc to MC = 0), and circumpolar
        {"id": "arcs-normal", "type": "arcs", "alpha": 100.0, "delta": 20.0, "ramc": 50.0, "phi": 40.0},
        {"id": "arcs-south", "type": "arcs", "alpha": 10.0, "delta": -15.0, "ramc": 200.0, "phi": 51.5},
        {"id": "arcs-on-mc", "type": "arcs", "alpha": 50.0, "delta": 0.0, "ramc": 50.0, "phi": 40.0},
        {"id": "arcs-circumpolar", "type": "arcs", "alpha": 80.0, "delta": 60.0, "ramc": 30.0, "phi": 60.0},
        # full directions of the natal chart, both time keys
        {"id": "dir-tampa-naibod", "type": "directions", "natal": NATAL,
         "lat": TAMPA[0], "lon": TAMPA[1], "key": "naibod"},
        {"id": "dir-tampa-ptolemy", "type": "directions", "natal": NATAL,
         "lat": TAMPA[0], "lon": TAMPA[1], "key": "ptolemy"},
    ]


def compute(spec, eng):
    t = spec["type"]
    if t == "arcs":
        return D.direction_arcs(spec["alpha"], spec["delta"], spec["ramc"], spec["phi"])
    if t == "directions":
        return D.primary_directions(eng, jd(spec["natal"]), spec["lat"], spec["lon"],
                                    key=spec["key"])
    raise ValueError(spec["type"])


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.directions (embedded VSOP, full moon); "
                    "Placidus semi-arc to the angles, direct, Naibod/Ptolemy keys",
           "cases": []}
    for c in build_cases():
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:20s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "directions-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
