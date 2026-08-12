#!/usr/bin/env python3
"""Cross-language golden for astroengine.synthetic.

packages/caelus/test/synthetic-golden.test.ts replays these specs through the
TS port (packages/caelus/src/synthetic.ts) and must reproduce them. Pure math
(Kepler solver + vector frames), no ephemeris data needed.

Usage: python3 export_synthetic_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import synthetic as S

TWIN_MOONS = {
    "id": "twin-moons",
    "bodies": [
        {"id": "fast", "mode": "periodic", "periodDays": 20, "phaseDeg": 0},
        {"id": "slow", "mode": "periodic", "periodDays": 80, "phaseDeg": 90},
        {"id": "pole-star", "mode": "placement", "lonDeg": 123.4},
    ],
}

OBSERVED = {
    "id": "observed-world",
    "observer": "home",
    "bodies": [
        {"id": "home", "mode": "periodic", "periodDays": 365, "phaseDeg": 0},
        {"id": "outer", "mode": "periodic", "periodDays": 1200, "phaseDeg": 40},
        {"id": "comet", "mode": "kepler", "a": 8.0, "e": 0.6, "i": 12.0,
         "node": 30.0, "peri": 100.0, "M0": 0.0, "periodDays": 3000,
         "epoch": 100},
    ],
}

BROKEN = {
    "id": "broken",
    "observer": "ghost",
    "bodies": [
        {"id": "a", "mode": "periodic", "periodDays": 0, "phaseDeg": 0},
        {"id": "a", "mode": "kepler", "a": -1, "e": 1.5, "i": 0, "node": 0,
         "peri": 0, "M0": 0, "periodDays": 10},
    ],
}

CASES = [
    # validation diagnoses, message for message
    {"id": "validate-sound", "type": "validate", "sys": TWIN_MOONS},
    {"id": "validate-broken", "type": "validate", "sys": BROKEN},
    # world-frame positions: heliocentric (no observer) and observed
    {"id": "positions-helio-t0", "type": "positions", "sys": TWIN_MOONS, "t": 0},
    {"id": "positions-helio-t5", "type": "positions", "sys": TWIN_MOONS, "t": 5},
    {"id": "positions-helio-t123", "type": "positions", "sys": TWIN_MOONS, "t": 123.456},
    {"id": "positions-observed-t0", "type": "positions", "sys": OBSERVED, "t": 0},
    {"id": "positions-observed-t500", "type": "positions", "sys": OBSERVED, "t": 500},
    # opposition window: the outer body should show apparent retrograde from
    # the inner observer somewhere in this sweep (the ephemeris tier's whole
    # point) -- pinned as position rows including speed and the flag
    {"id": "ephemeris-observed-sweep", "type": "ephemeris", "sys": OBSERVED,
     "body": "outer", "ts": [0, 100, 200, 300, 400, 500, 600]},
    {"id": "ephemeris-comet-sweep", "type": "ephemeris", "sys": OBSERVED,
     "body": "comet", "ts": [0, 750, 1500, 2250]},
]


def compute(spec):
    t = spec["type"]
    if t == "validate":
        return S.validate_synthetic_system(spec["sys"])
    if t == "positions":
        return S.synthetic_positions(spec["sys"], spec["t"])
    if t == "ephemeris":
        eph = S.synthetic_ephemeris(spec["sys"])
        return [eph["position"](spec["body"], tt) for tt in spec["ts"]]
    raise ValueError(t)


def main():
    out = {"basis": "Python reference astroengine.synthetic (pure math)",
           "cases": []}
    for c in CASES:
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c)})
        print(f'{c["id"]:26s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "synthetic-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
