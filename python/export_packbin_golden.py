#!/usr/bin/env python3
"""Regenerate packages/caelus/test/packbin-golden.json: for every binary pack,
its header and 300 decoded coefficients at fixed positions. The TypeScript
decoder must return the same doubles, compared with ===, because a decoded
pack is exact in both languages by construction.
Run: python3 export_packbin_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import packbin

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "packages", "caelus", "data")
SAMPLES = 300


def positions(nseg, nch, ncoef):
    """SAMPLES positions spread over the block by a fixed stride, the same
    arithmetic the TypeScript test uses."""
    total = nseg * nch * ncoef
    out = []
    for i in range(SAMPLES):
        flat = (i * 7919 + 13) % total
        s, rest = divmod(flat, nch * ncoef)
        c, k = divmod(rest, ncoef)
        out.append((s, c, k))
    return out


def main():
    out = {"basis": "Python reference astroengine.packbin decode of each .cpk",
           "packs": []}
    for name in sorted(os.listdir(DATA)):
        if not name.endswith(".cpk"):
            continue
        path = os.path.join(DATA, name)
        with open(path, "rb") as f:
            buf = f.read()
        header, _ = packbin.decode_header(buf)
        pack = packbin.decode_pack(buf)
        nseg, nch, ncoef = header["nseg"], header["nch"], header["ncoef"]
        samples = [pack["segments"][s][c][k] for s, c, k in positions(nseg, nch, ncoef)]
        out["packs"].append({
            "file": name, "bytes": len(buf), "sha256": packbin.sha256_file(path),
            "jd0": header["jd0"], "seg_days": header["seg_days"],
            "scale": header["scale"], "nseg": nseg, "nch": nch, "ncoef": ncoef,
            "qexp": header["qexp"], "samples": samples,
        })
        print(f"{name:28s} {nseg} x {nch} x {ncoef}  quantum 2^{header['qexp']}")
    path = os.path.join(HERE, "..", "packages", "caelus", "test", "packbin-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
