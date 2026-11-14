#!/usr/bin/env python3
"""Regenerate packages/caelus/test/minted-golden.json from the Python
reference (astroengine.minted). The fixture is a real mint, 433 Eros for 1990
to 2030 (packages/caelus/test/fixtures/minted, made by mint_body.py). The
TypeScript port must verify the same bytes, register the body, and return
the same positions; and both must refuse a pack with one bit changed.
Run: python3 export_minted_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import julian_day
from astroengine.minted import load_minted_body

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "..", "packages", "caelus", "test", "fixtures", "minted")

INSTANTS = [
    ("closest-approach", julian_day(2012, 1, 31, 11)),
    ("1991", julian_day(1991, 6, 1)),
    ("1995", julian_day(1995, 3, 3, 6)),
    ("near-shoemaker", julian_day(2000, 2, 14, 15, 33)),
    ("2005", julian_day(2005, 5, 5)),
    ("2019", julian_day(2019, 1, 15, 18)),
    ("2025", julian_day(2025, 11, 30)),
    ("span-start", julian_day(1990, 1, 2)),
    ("span-end", julian_day(2029, 12, 30)),
]
OUTSIDE = [("before", julian_day(1989, 6, 1)), ("after", julian_day(2031, 6, 1))]


def main():
    eng = Engine("embedded")
    cert = load_minted_body(eng, os.path.join(FIXTURE, "eros.cert.json"))
    out = {"basis": "Python reference astroengine.minted (embedded VSOP), "
                    "fixture 433 Eros 1990-2030",
           "certificate": "eros.cert.json", "id": cert["id"], "cases": [], "outside": []}
    for label, jd in INSTANTS:
        p = eng.position(cert["id"], jd)
        h = eng.heliocentric(cert["id"], jd)
        out["cases"].append({
            "id": label, "jd": jd,
            "position": {k: p[k] for k in ("lon", "lat", "dist", "speed", "ra", "dec")},
            "heliocentric": h,
        })
    for label, jd in OUTSIDE:
        try:
            eng.position(cert["id"], jd)
            raise SystemExit(f"{label}: expected a range error")
        except ValueError:
            out["outside"].append({"id": label, "jd": jd})
    path = os.path.join(HERE, "..", "packages", "caelus", "test", "minted-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print(f"{len(out['cases'])} positions, {len(out['outside'])} outside the span ->", path)


if __name__ == "__main__":
    main()
