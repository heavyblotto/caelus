#!/usr/bin/env python3
"""One-off: extend the earth/jupiter classical caches one day past BOUNDARY.

The original run fetched with pad_days=0, so grids whose step does not divide
the span (jupiter, step 2d) ended one day short of the boundary instant the
fit samples exactly. fit_classical now passes pad_days=1.0, which makes the
reuse check demand jd1 >= BOUNDARY + 1. Rather than re-download 250 MB, fetch
the few missing tail rows and append them, keeping the uniform grid.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from horizons import _fetch_range

BOUNDARY = 2086302.5
TARGETS = [  # (cache file, Horizons command, step)
    ("earth_horizons_cache_classical_12h.json", "399", 0.5),
    ("jupiter_horizons_cache_classical_48h.json", "5", 2.0),
]

for fname, command, step in TARGETS:
    path = os.path.join(HERE, fname)
    with open(path) as f:
        d = json.load(f)
    assert d["step"] == step, (fname, d["step"])
    need = BOUNDARY + 1.0
    if d["jd1"] >= need:
        print(f"{fname}: already covers {need} (jd1 {d['jd1']})")
        continue
    jds, xs, ys, zs = _fetch_range(d["jd1"], need, step, command=command,
                                   center=d.get("center", "@sun"))
    seen = set(d["jds"])
    added = 0
    for j, x, y, z in zip(jds, xs, ys, zs):
        if float(j) in seen:
            continue
        d["jds"].append(float(j)); d["x"].append(float(x))
        d["y"].append(float(y)); d["z"].append(float(z))
        seen.add(float(j)); added += 1
    assert d["jds"] == sorted(d["jds"]), "grid order broken"
    d["jd1"] = float(d["jds"][-1])
    with open(path, "w") as f:
        json.dump(d, f, separators=(",", ":"))
    print(f"{fname}: +{added} rows -> jd1 {d['jd1']} "
          f"({os.path.getsize(path) / 1048576:.0f} MB)")
