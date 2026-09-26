#!/usr/bin/env python3
"""Cross-language golden for astroengine.draconic (draconic chart transform).

Runs a fixed set of draconic specs through the Python reference and records
the results. packages/caelus/test/draconic-golden.test.ts replays the same
specs through the TS port and must reproduce them. Embedded tier.

Usage: python3 export_draconic_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import draconic as DR

# Charts across a century, both hemispheres: Tampa, London, Sydney, Tokyo.
CHARTS = [
    {"tag": "1950", "date": [1950, 3, 21, 6, 45], "lat": 27.95, "lon": -82.46},
    {"tag": "1987", "date": [1987, 11, 2, 23, 10], "lat": 51.5, "lon": -0.12},
    {"tag": "2004", "date": [2004, 7, 14, 12, 0], "lat": -33.87, "lon": 151.21},
    {"tag": "2026", "date": [2026, 1, 5, 18, 30], "lat": 35.68, "lon": 139.69},
]


def jd(date):
    return julian_day(*date)


def build_cases():
    cases = []
    # pure transform: wrap below the node, at the node, near 360
    for lon, node_lon in [(10.0, 100.0), (100.0, 100.0), (350.0, 12.5),
                          (0.0, 359.99), (123.456, 77.7)]:
        cases.append({"id": f"lon-{lon}-{node_lon}", "type": "lon",
                      "lon": lon, "node_lon": node_lon})
    # dict transform, insertion order preserved
    cases.append({"id": "lons", "type": "lons", "node_lon": 214.3,
                  "lons": {"sun": 80.0, "moon": 214.3, "asc": 5.0}})
    # node longitudes and full charts (bodies + angles), both node options
    for c in CHARTS:
        for node in ["true", "mean"]:
            cases.append({"id": f"node-{node}-{c['tag']}", "type": "node_lon",
                          "date": c["date"], "node": node})
            cases.append({"id": f"chart-{node}-{c['tag']}", "type": "chart",
                          "date": c["date"], "node": node,
                          "lat": c["lat"], "lon": c["lon"]})
    # a chart without a place: no angles key
    cases.append({"id": "chart-noplace-1987", "type": "chart",
                  "date": CHARTS[1]["date"], "node": "true"})
    return cases


def compute(spec, eng):
    t = spec["type"]
    if t == "lon":
        return DR.draconic_longitude(spec["lon"], spec["node_lon"])
    if t == "lons":
        return DR.draconic_longitudes(spec["lons"], spec["node_lon"])
    if t == "node_lon":
        return DR.node_longitude(eng, jd(spec["date"]), spec["node"])
    if t == "chart":
        return DR.draconic_chart(eng, jd(spec["date"]), node=spec["node"],
                                 lat=spec.get("lat"), lon_east=spec.get("lon"))
    raise ValueError(spec["type"])


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.draconic (embedded VSOP, "
                    "full moon); tropical, true/mean node", "cases": []}
    for c in build_cases():
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
    print(f'{len(out["cases"])} cases')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "draconic-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
