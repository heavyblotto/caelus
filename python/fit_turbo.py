#!/usr/bin/env python3
"""Mint a turbo pack: a fast Chebyshev representation of the engine's apparent
longitude, fit to the engine itself (no external source, no network).

Segment lengths resolve the ~13.7-day nutation term shared by every body, so
the planets reproduce the engine to <0.01" and the Moon to ~0.03" at degree 12.

A turbo pack is a "mint it for your range" artifact: pick the bodies, range,
and segment lengths you need. This writes a small reference pack (used by the
tests and as a worked example) to packages/caelus/data/turbo.json.

Usage: python3 fit_turbo.py            # reference pack (2000-2005)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import turbo as T

# Segment length (days) per body. Slow planets still need ~24-day segments to
# resolve the semi-monthly nutation; the Moon needs ~4-day for its own motion.
SEG_DAYS = {
    "sun": 24, "mercury": 14, "venus": 20, "mars": 24, "jupiter": 24,
    "saturn": 24, "uranus": 24, "neptune": 24, "pluto": 24, "moon": 4,
}
DEGREE = 12
RANGE = (julian_day(2000, 1, 1), julian_day(2005, 1, 1))

# The test gates (python/test_turbo.py) are 0.02" planets, 0.1" Moon; the
# fitter targets inside them with margin, tightening segments until measured.
TARGET = {"moon": 0.07}
TARGET_DEFAULT = 0.015
MIN_SEG_DAYS = {"moon": 0.5}  # planets default to a 1-day floor


def main():
    eng = Engine("full")
    jd0, jd1 = RANGE
    pack = T.fit(eng, list(SEG_DAYS), jd0, jd1, SEG_DAYS, degree=DEGREE)

    # Self-verifying: the pack's claim is reproducing the engine to a
    # tolerance, so the fitter measures the claim on a fixed grid and
    # tightens any body that misses (segment count doubles per round).
    # Deterministic: same engine in, same pack out.
    bodies = pack["bodies"]
    degree_of = {b: DEGREE for b in bodies}
    for body in list(bodies):
        target = TARGET.get(body, TARGET_DEFAULT)
        while True:
            worst = T.measure(eng, pack, body)
            if worst <= target:
                bodies[body]["fit_measured_arcsec"] = round(worst, 4)
                bodies[body]["fit_degree"] = degree_of[body]
                break
            seg = bodies[body]["seg_days"] / 2.0
            if seg >= MIN_SEG_DAYS.get(body, 1.0):
                bodies[body] = T.fit(eng, [body], jd0, jd1, {body: seg},
                                     degree=degree_of[body])["bodies"][body]
                bodies[body]["seg_days"] = seg
            elif degree_of[body] < 20:
                # At the segment floor the content is curvature, not cadence:
                # raise the fit degree (perigee passes are the Moon's case).
                degree_of[body] += 4
                bodies[body] = T.fit(eng, [body], jd0, jd1,
                                     {body: bodies[body]["seg_days"]},
                                     degree=degree_of[body])["bodies"][body]
            else:
                raise SystemExit(
                    f"turbo fit: {body} still off by {worst:.4f}\" "
                    f"at {bodies[body]['seg_days']}-day degree-{degree_of[body]}; "
                    "not writing")

    pack["fit"] = {
        "claim": "reproduces the engine's apparent longitude (no external source)",
        "degree": DEGREE, "samples_per_body": 4000,
        "targets_arcsec": {**{b: TARGET_DEFAULT for b in bodies}, **TARGET},
        "measured_arcsec": {b: bodies[b]["fit_measured_arcsec"] for b in bodies},
    }
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "data", "turbo.json")
    with open(path, "w") as f:
        json.dump(pack, f, separators=(",", ":"))
    size = os.path.getsize(path)
    nseg = sum(len(b["segments"]) for b in pack["bodies"].values())
    print(f"wrote {path} ({size // 1024} KB, {len(pack['bodies'])} bodies, "
          f"{nseg} segments, degree {DEGREE})")
    for b in pack["bodies"]:
        print(f"  {b}: seg {pack['bodies'][b]['seg_days']}d, "
              f"measured {pack['bodies'][b]['fit_measured_arcsec']}\"")


if __name__ == "__main__":
    main()
