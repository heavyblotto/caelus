#!/usr/bin/env python3
"""Cross-language golden for astroengine.features.

packages/caelus/test/features-golden.test.ts replays these through the TS port
and must reproduce them. Embedded tier.

Usage: python3 export_features_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import features as F


def jd(date):
    return julian_day(*date)


CASES = [
    {"id": "vec-basic", "type": "vector",
     "items": [[0.0, 1.0], [90.0, 1.0], [180.0, 0.5]]},
    {"id": "vec-weighted", "type": "vector",
     "items": [[30.0, 2.0], [210.0, 1.5], [359.0, 1.0]]},
    {"id": "cos-identical", "type": "cosine",
     "a": [1.0, 0.0, 0.0, 1.0], "b": [1.0, 0.0, 0.0, 1.0]},
    {"id": "cos-orthogonal", "type": "cosine",
     "a": [1.0, 0.0], "b": [0.0, 1.0]},
    {"id": "cos-general", "type": "cosine",
     "a": [0.6, 0.8, 0.3], "b": [0.5, 0.5, 0.7]},
    {"id": "chart-2000", "type": "chart", "jd": [2000, 1, 1, 12, 0]},
    {"id": "chart-weighted", "type": "chart", "jd": [2000, 1, 1, 12, 0],
     "weights": {"moon": 5.0, "sun": 2.0}},
    {"id": "fit-self", "type": "fit", "jd": [2000, 1, 1, 12, 0],
     "target_jd": [2000, 1, 1, 12, 0]},
    {"id": "fit-month", "type": "fit", "jd": [2000, 2, 1, 12, 0],
     "target_jd": [2000, 1, 1, 12, 0]},
]


def compute(spec, eng):
    t = spec["type"]
    if t == "vector":
        return F.feature_vector([tuple(it) for it in spec["items"]])
    if t == "cosine":
        return F.cosine_similarity(spec["a"], spec["b"])
    if t == "chart":
        return F.chart_features(eng, jd(spec["jd"]), weights=spec.get("weights"))
    if t == "fit":
        target = F.chart_features(eng, jd(spec["target_jd"]))
        return F.configuration_fit(eng, jd(spec["jd"]), target)
    raise ValueError(t)


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.features (embedded VSOP, full moon)",
           "cases": []}
    for c in CASES:
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:16s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "features-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
