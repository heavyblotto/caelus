#!/usr/bin/env python3
"""Cross-language golden for astroengine.canonical -- the tolerance-free pin.

Unlike every other golden (which compares within a tolerance), canonical mode
is pinned by EQUALITY: the TS digests must equal these byte for byte, which
is the whole promise of the mode. packages/caelus/test/canonical-golden.test.ts
replays each spec and compares with ===.

Usage: python3 export_canonical_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import canonical as C

GRIDS = ["arcsec", "milliarcsec", "centideg", "dms", "accuracy"]

CHARTS = [
    {"id": "tampa-1990", "jd": [1990, 6, 10, 14, 30, 0], "lat": 27.95,
     "lon": -82.46, "hs": "placidus", "zodiac": "tropical"},
    {"id": "london-2024", "jd": [2024, 3, 20, 3, 6, 0], "lat": 51.5,
     "lon": -0.12, "hs": "whole_sign", "zodiac": "tropical"},
    {"id": "sydney-sidereal", "jd": [1995, 9, 15, 3, 20, 0], "lat": -33.87,
     "lon": 151.21, "hs": "equal", "zodiac": "sidereal:lahiri"},
    {"id": "svalbard-polar", "jd": [1985, 12, 1, 9, 0, 0], "lat": 78.2,
     "lon": 15.6, "hs": "placidus", "zodiac": "tropical"},
    # Edge of the validated band: exercises identical warnings both sides.
    {"id": "edge-1852", "jd": [1852, 2, 2, 2, 2, 2], "lat": 48.85,
     "lon": 2.35, "hs": "porphyry", "zodiac": "tropical"},
]


def main():
    eng = Engine("embedded")  # embedded VSOP + full moon, matching the TS engine
    out = {"basis": "Python reference astroengine.canonical; equality, not tolerance",
           "cases": []}

    # 1. The rounding rule, pinned value by value (incl. half-up ties).
    round_cases = [0.5, -0.5, 1.5, 2.5, -1.5, 0.49999999999999994,
                   1.0000000000000002, -2.5, 12.499999999999998]
    out["cases"].append({
        "id": "round-half-up", "type": "round",
        "spec": {"values": round_cases},
        "result": [C.round_half_up(v) for v in round_cases],
    })

    # 2. sha256 implementation vectors (pins the dependency-free TS sha256,
    #    including the multi-byte UTF-8 path).
    import hashlib
    sha_inputs = ["", "abc", "The quick brown fox jumps over the lazy dog",
                  "caelus-canonical ☉☽"]
    out["cases"].append({
        "id": "sha256-vectors", "type": "sha256",
        "spec": {"inputs": sha_inputs},
        "result": [hashlib.sha256(s.encode("utf-8")).hexdigest()
                   for s in sha_inputs],
    })

    # 3. Canonical encoding: byte-exact string, and the float rejection.
    enc_value = {"b": 2, "a": [1, "two", None, True, {"z": 0, "y": -3}]}
    out["cases"].append({
        "id": "encode-shape", "type": "encode",
        "spec": {"value": enc_value},
        "result": C.canonical_encode(enc_value),
    })

    # 4. Time quantization with nulls (derived surfaces).
    times = [2451545.0, 2451545.5, 2447892.10428, None, 2466154.0]
    out["cases"].append({
        "id": "times-ms", "type": "times",
        "spec": {"jds": times},
        "result": C.canonical_times_ms(times),
    })

    # 5. Charts: the full canonical structure for one case per grid, digests
    #    for every (chart x grid) pair.
    digests = {}
    for spec in CHARTS:
        chart = eng.chart_at(julian_day(*spec["jd"]), spec["lat"], spec["lon"],
                             spec["hs"], zodiac=spec["zodiac"])
        for grid in GRIDS:
            cc = C.canonical_chart(chart, grid=grid)
            digests[f'{spec["id"]}/{grid}'] = C.canonical_digest(cc)
            if spec["id"] == "tampa-1990":
                out["cases"].append({
                    "id": f"chart-structure-{grid}", "type": "chart",
                    "spec": {**spec, "grid": grid},
                    "result": cc,
                })
    out["cases"].append({
        "id": "chart-digests", "type": "digests",
        "spec": {"charts": CHARTS, "grids": GRIDS},
        "result": digests,
    })

    # 6. Remainder sets: sidecar digests and the telescoping property for
    #    every (chart x base grid) pair at the default refinement target,
    #    with the full sidecar pinned value-for-value for one chart. The
    #    compose digest must equal the finer grid's own chart digest -- the
    #    residues are PROVABLY the difference between two grids.
    rem_bases = ["arcsec", "centideg", "dms", "accuracy"]
    rem_digests = {}
    for spec in CHARTS:
        chart = eng.chart_at(julian_day(*spec["jd"]), spec["lat"], spec["lon"],
                             spec["hs"], zodiac=spec["zodiac"])
        for base in rem_bases:
            payload, rem = C.canonical_chart_with_remainders(chart, grid=base)
            composed = C.compose_remainders(payload, rem)
            rem_digests[f'{spec["id"]}/{base}'] = {
                "remainderGrid": rem["remainderGrid"],
                "sidecar": C.canonical_digest(rem),
                "composed": C.canonical_digest(composed),
            }
            if spec["id"] == "tampa-1990" and base == "arcsec":
                out["cases"].append({
                    "id": "remainder-sidecar-full", "type": "remainder-full",
                    "spec": {**spec, "grid": base},
                    "result": rem,
                })
                out["cases"].append({
                    "id": "near-boundary-full", "type": "near-boundary",
                    "spec": {**spec, "grid": base, "maxMarginPerMille": 1000},
                    "result": C.near_boundary(rem, max_margin_per_mille=1000),
                })
    out["cases"].append({
        "id": "remainder-digests", "type": "remainder-digests",
        "spec": {"charts": CHARTS, "bases": rem_bases},
        "result": rem_digests,
    })

    # 7. Bits encoding vectors: pins the TS DataView hex against Python
    #    struct for fixed doubles (identical literals in both languages),
    #    including -0.0, a subnormal, and the rationals that expose repr
    #    differences.
    bits_values = [0.0, -0.0, 1.0, -1.0, 0.1, 0.5, 2.0, 1e9,
                   5e-324, 3.141592653589793, 359.99999999999997]
    out["cases"].append({
        "id": "bits-vectors", "type": "bits",
        "spec": {"values": bits_values},
        "result": [C.double_bits_hex(v) for v in bits_values],
    })

    for c in out["cases"]:
        print(f'{c["id"]:28s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "canonical-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
