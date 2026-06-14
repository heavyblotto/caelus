#!/usr/bin/env python3
"""Cross-language golden for astroengine.yogas (Vedic placement yogas).

Runs a fixed set of yoga specs through the Python reference and records the
results. packages/caelus/test/yogas-golden.test.ts replays the same specs
through the TS port and must reproduce them. Embedded tier.

The pure cases double as an oracle: each constructed chart is built to trigger
(or not) a specific yoga.

Usage: python3 export_yogas_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import yogas as Y

NATAL = [1990, 6, 10, 14, 30]
TAMPA = (27.95, -82.46)


def jd(date):
    return julian_day(*date)


def signs(**kw):
    """A full seven-planet sign map, defaulting unspecified planets to sign 0."""
    base = {b: 0 for b in Y.YOGA_PLANETS}
    base.update(kw)
    return base


def build_cases():
    return [
        # Ruchaka: Mars in Aries (own) in the 1st (asc Aries)
        {"id": "ruchaka", "type": "detect", "asc": 0,
         "signs": signs(mars=0, moon=2, sun=4, mercury=4)},
        # Hamsa: Jupiter exalted in Cancer in the 4th (asc Aries)
        {"id": "hamsa", "type": "detect", "asc": 0,
         "signs": signs(jupiter=3, moon=5, mars=7)},
        # Malavya: Venus in Libra (own) in the 7th (asc Aries)
        {"id": "malavya", "type": "detect", "asc": 0, "signs": signs(venus=6)},
        # own sign but NOT in a kendra -> no Mahapurusha
        {"id": "no-mahapurusha", "type": "detect", "asc": 0,
         "signs": signs(saturn=10)},  # Saturn in Aquarius (own) but house 11
        # Gajakesari: Jupiter 4th from the Moon
        {"id": "gajakesari", "type": "detect", "asc": 5,
         "signs": signs(moon=0, jupiter=3)},
        # Budha-Aditya + Chandra-Mangala together
        {"id": "budha-chandra", "type": "detect", "asc": 0,
         "signs": signs(sun=8, mercury=8, moon=10, mars=10)},
        # nothing
        {"id": "none", "type": "detect", "asc": 0,
         "signs": signs(sun=1, moon=4, mars=8, mercury=11, jupiter=10, venus=7, saturn=2)},
        # engine path: the natal chart's yogas
        {"id": "yogas-tampa", "type": "at", "natal": NATAL, "lat": TAMPA[0], "lon": TAMPA[1]},
        # Kemadruma: Moon isolated vs not, and the planet-set options
        {"id": "kema-present", "type": "kemadruma",
         "signs": {"sun": 8, "moon": 0, "mars": 3, "mercury": 4, "jupiter": 5, "venus": 6, "saturn": 7}},
        {"id": "kema-absent", "type": "kemadruma",
         "signs": {"sun": 8, "moon": 0, "mars": 3, "mercury": 4, "jupiter": 1, "venus": 6, "saturn": 7}},
        {"id": "kema-sun-default", "type": "kemadruma",
         "signs": {"sun": 1, "moon": 0, "mars": 3, "mercury": 4, "jupiter": 5, "venus": 6, "saturn": 7}},
        {"id": "kema-sun-include", "type": "kemadruma", "include_sun": True,
         "signs": {"sun": 1, "moon": 0, "mars": 3, "mercury": 4, "jupiter": 5, "venus": 6, "saturn": 7}},
        {"id": "kema-nodes-include", "type": "kemadruma", "include_nodes": True,
         "signs": {"sun": 8, "moon": 0, "mars": 3, "mercury": 4, "jupiter": 5, "venus": 6, "saturn": 7, "rahu": 1, "ketu": 7}},
    ]


def compute(spec, eng):
    t = spec["type"]
    if t == "detect":
        return Y.detect_yogas(spec["signs"], spec["asc"])
    if t == "at":
        return Y.yogas_at(eng, jd(spec["natal"]), spec["lat"], spec["lon"])
    if t == "kemadruma":
        return Y.kemadruma(spec["signs"], include_sun=spec.get("include_sun", False),
                           include_nodes=spec.get("include_nodes", False))
    raise ValueError(spec["type"])


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.yogas (embedded VSOP, full moon); "
                    "Lahiri ayanamsa, whole-sign houses", "cases": []}
    for c in build_cases():
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:16s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "yogas-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
