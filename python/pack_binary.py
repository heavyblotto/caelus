#!/usr/bin/env python3
"""Mint the binary (CPK1) form of the large Chebyshev packs.

Reads `{stem}.json` from packages/caelus/data, writes `{stem}.cpk` beside it
and into python/astroengine/data, and measures what the quantization cost:
the largest difference between any coefficient and its stored value, and the
largest difference between the two series evaluated at random points, both
against the pack's own fit residual.

    python3 pack_binary.py            # convert every pack in PACKS that has a JSON
    python3 pack_binary.py mars_cheb  # convert the named stems only
    python3 pack_binary.py --check    # decode every .cpk and verify it is well-formed

The small packs the browser imports as JSON (the asteroids, Chiron, the
interpolated apogee, the embedded Moon) are left as they are.
"""
import gzip
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import packbin
from astroengine.chebyshev import _clenshaw

HERE = os.path.dirname(os.path.abspath(__file__))
TS_DATA = os.path.join(HERE, "..", "packages", "caelus", "data")
PY_DATA = os.path.join(HERE, "astroengine", "data")

PACKS = [
    "mercury_cheb", "venus_cheb", "earth_cheb", "mars_cheb", "jupiter_cheb",
    "saturn_cheb", "uranus_cheb", "neptune_cheb", "pluto_cheb",
    "moon_cheb.full",
    "earth_cheb.classical", "moon_cheb.classical", "mercury_cheb.classical",
    "venus_cheb.classical", "mars_cheb.classical", "jupiter_cheb.classical",
    "saturn_cheb.classical",
]


# The Moon's packs take a finer quantum than the rest. The true node and the
# osculating apogee are derived from the Moon's velocity, which is the
# derivative of a degree-18 or degree-36 series and amplifies coefficient
# rounding by orders of magnitude. At the default factor the true node moved
# 1.4" on the golden grid; at 4096 it moves 0.14", against a stated accuracy
# of 1'.
FACTORS = {"moon_cheb.full": 4096.0, "moon_cheb.classical": 4096.0}


def convert(stem):
    src = os.path.join(TS_DATA, stem + ".json")
    with open(src, "rb") as f:
        raw = f.read()
    pack = json.loads(raw)
    qexp = packbin.quantum_exponent(pack, FACTORS.get(stem, packbin.RESIDUAL_FACTOR))
    blob = packbin.encode_pack(pack, qexp=qexp, source_sha256=packbin.sha256_file(src))
    back = packbin.decode_pack(blob)
    q = math.ldexp(1.0, back["quantum_exponent"])
    resid = packbin.residual_units(pack)

    worst_coef = 0.0
    for a, b in zip(pack["segments"], back["segments"]):
        for ca, cb in zip(a, b):
            for x, y in zip(ca, cb):
                worst_coef = max(worst_coef, abs(x - y))
    if worst_coef > q / 2 * (1 + 1e-12):
        raise SystemExit(f"{stem}: a coefficient moved {worst_coef}, more than half a quantum")

    rng = random.Random(20261113)
    worst_eval = 0.0
    nseg, nch = len(pack["segments"]), len(pack["segments"][0])
    for _ in range(4000):
        s, c, x = rng.randrange(nseg), rng.randrange(nch), rng.uniform(-1.0, 1.0)
        worst_eval = max(worst_eval, abs(_clenshaw(pack["segments"][s][c], x)
                                         - _clenshaw(back["segments"][s][c], x)))

    for d in (TS_DATA, PY_DATA):
        with open(os.path.join(d, stem + ".cpk"), "wb") as f:
            f.write(blob)
    return {
        "stem": stem, "json": len(raw), "json_gz": len(gzip.compress(raw, 6)),
        "cpk": len(blob), "cpk_gz": len(gzip.compress(blob, 6)),
        "qexp": back["quantum_exponent"], "eval_over_resid": worst_eval / resid,
    }


def check():
    bad = 0
    n = 0
    for d in (TS_DATA, PY_DATA):
        for name in sorted(os.listdir(d)):
            if not name.endswith(".cpk"):
                continue
            n += 1
            try:
                pack = packbin.load_pack(os.path.join(d, name))
                assert len(pack["segments"]) > 0
            except Exception as e:  # noqa: BLE001 - report every failure
                bad += 1
                print(f"FAIL {d}/{name}: {e}")
    # the two data directories must hold the same bytes
    for name in sorted(os.listdir(TS_DATA)):
        if name.endswith(".cpk"):
            a = os.path.join(TS_DATA, name)
            b = os.path.join(PY_DATA, name)
            if not os.path.exists(b) or packbin.sha256_file(a) != packbin.sha256_file(b):
                bad += 1
                print(f"FAIL {name}: the two data directories differ")
    print(f"{n} packs checked, {bad} failures")
    return 1 if bad else 0


def main():
    if "--check" in sys.argv:
        sys.exit(check())
    stems = [a for a in sys.argv[1:] if not a.startswith("-")] or PACKS
    rows = []
    for stem in stems:
        if not os.path.exists(os.path.join(TS_DATA, stem + ".json")):
            print(f"skip {stem}: no JSON source on disk")
            continue
        rows.append(convert(stem))
        r = rows[-1]
        print(f"{r['stem']:26s} json {r['json'] // 1024:6d}K  cpk {r['cpk'] // 1024:6d}K  "
              f"gz {r['cpk_gz'] // 1024:6d}K  quantum 2^{r['qexp']}  "
              f"worst {r['eval_over_resid'] * 100:.2f}% of residual")
    if rows:
        tot = {k: sum(r[k] for r in rows) for k in ("json", "json_gz", "cpk", "cpk_gz")}
        print(f"{'total':26s} json {tot['json'] // 1024:6d}K  cpk {tot['cpk'] // 1024:6d}K  "
              f"gz {tot['cpk_gz'] // 1024:6d}K  (json gz {tot['json_gz'] // 1024}K)")
        print(f"worst rounding: {max(r['eval_over_resid'] for r in rows) * 100:.2f}% of a pack's fit residual")


if __name__ == "__main__":
    main()
