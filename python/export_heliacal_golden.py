#!/usr/bin/env python3
"""Regenerate packages/caelus/test/heliacal-golden.json from the Python
reference (astroengine.heliacal). The TypeScript port must return the same
visibility at each instant, the same event for each search (or none where the
reference finds none), and the same crescent test for each evening and
morning.
Run: python3 export_heliacal_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine import heliacal as HL
from astroengine.core import julian_day

BABYLON = (32.54, 44.42)
MEMPHIS = (29.85, 31.25)
ATHENS = (37.98, 23.73)
LONDON = (51.5, -0.12)
CAPE_TOWN = (-33.92, 18.42)
MECCA = (21.42, 39.83)

Y_600BCE = julian_day(-600, 3, 1, 0, 0, 0, "julian")
Y_139 = julian_day(139, 1, 1, 0, 0, 0, "julian")
Y_1000 = julian_day(1000, 6, 1, 0, 0, 0, "julian")
Y_2020 = julian_day(2020, 1, 1)
Y_2025 = julian_day(2025, 3, 1)

INSTANTS = [
    ("sirius-dawn", "Sirius", julian_day(2025, 8, 5, 2, 35), MEMPHIS, {}),
    ("sirius-dawn-hazy", "Sirius", julian_day(2025, 8, 5, 2, 35), MEMPHIS, {"extinction": 0.4}),
    ("sirius-night", "Sirius", julian_day(2025, 1, 15, 21), MEMPHIS, {}),
    ("sirius-midday", "Sirius", julian_day(2025, 1, 15, 10), MEMPHIS, {}),
    ("sirius-below", "Sirius", julian_day(2025, 7, 1, 0), MEMPHIS, {}),
    ("venus-dusk", "venus", julian_day(2020, 5, 20, 16, 30), BABYLON, {}),
    ("mercury-dusk", "mercury", julian_day(2020, 2, 8, 15, 10), BABYLON, {}),
    ("jupiter-moonlit", "jupiter", julian_day(2020, 8, 2, 20), ATHENS, {}),
    ("spica-full-moon", "Spica", julian_day(2020, 4, 7, 21), ATHENS, {}),
    ("antares-south", "Antares", julian_day(2020, 12, 20, 2, 30), CAPE_TOWN, {}),
    ("regulus-mountain", "Regulus", julian_day(2020, 9, 5, 4, 20), LONDON, {"alt_m": 2500.0, "extinction": 0.18}),
    ("saturn-ancient", "saturn", julian_day(-567, 4, 22, 2, 30, 0, "julian"), BABYLON, {}),
    ("mars-classical", "mars", julian_day(139, 9, 1, 3, 0, 0, "julian"), MEMPHIS, {}),
]

EVENTS = [
    ("sirius-139-rising", "Sirius", Y_139, MEMPHIS, {}),
    ("sirius-139-setting", "Sirius", Y_139, MEMPHIS, {"kind": "evening_last"}),
    ("sirius-139-hazy", "Sirius", Y_139, MEMPHIS, {"extinction": 0.35, "spread": 0.1}),
    ("sirius-2020-alias", "Sirius", Y_2020, MEMPHIS, {"kind": "heliacal_rising"}),
    ("regulus-600bce", "Regulus", Y_600BCE, BABYLON, {}),
    ("aldebaran-600bce-setting", "Aldebaran", Y_600BCE, BABYLON, {"kind": "evening_last"}),
    ("arcturus-london", "Arcturus", Y_2020, LONDON, {}),
    ("fomalhaut-cape", "Fomalhaut", Y_1000, CAPE_TOWN, {"kind": "evening_last"}),
    ("antares-mountain", "Antares", Y_2020, ATHENS, {"alt_m": 2000.0, "extinction": 0.2}),
    ("polaris-never", "Polaris", Y_2020, LONDON, {}),
    ("venus-mf", "venus", Y_2020, BABYLON, {}),
    ("venus-el", "venus", Y_2020, BABYLON, {"kind": "evening_last"}),
    ("venus-ef", "venus", Y_2020, BABYLON, {"kind": "evening_first"}),
    ("venus-ml", "venus", Y_2020, BABYLON, {"kind": "morning_last"}),
    ("venus-600bce-ef", "venus", Y_600BCE, BABYLON, {"kind": "evening_first"}),
    ("mercury-mf", "mercury", Y_2020, ATHENS, {}),
    ("mercury-ef", "mercury", Y_2020, ATHENS, {"kind": "evening_first"}),
    ("mercury-ml-139", "mercury", Y_139, MEMPHIS, {"kind": "morning_last"}),
    ("mars-mf", "mars", Y_2020, BABYLON, {}),
    ("jupiter-el-1000", "jupiter", Y_1000, CAPE_TOWN, {"kind": "evening_last"}),
    ("saturn-mf-600bce", "saturn", Y_600BCE, BABYLON, {}),
    ("sirius-arcus", "Sirius", Y_139, MEMPHIS, {"method": "arcus", "arcus_visionis": 9.0}),
    ("venus-arcus-el", "venus", Y_2020, BABYLON, {"kind": "evening_last", "method": "arcus", "arcus_visionis": 5.5}),
    ("jupiter-acronychal", "jupiter", Y_2020, BABYLON, {"kind": "acronychal_rising", "method": "arcus", "arcus_visionis": 7.0}),
    ("jupiter-cosmical", "jupiter", Y_2020, BABYLON, {"kind": "cosmical_setting", "method": "arcus", "arcus_visionis": 7.0}),
    ("spica-acronychal", "Spica", Y_600BCE, BABYLON, {"kind": "acronychal_rising", "method": "arcus", "arcus_visionis": 8.0}),
    ("sirius-span-found", "Sirius", Y_139, MEMPHIS, {"span": 220.0}),
    ("sirius-span-short", "Sirius", Y_139, MEMPHIS, {"span": 120.0}),
    ("venus-span-arcus", "venus", Y_2020, BABYLON, {"kind": "evening_last", "method": "arcus",
                                                    "arcus_visionis": 5.5, "span": 60.0}),
    ("moon-span-short", "moon", Y_2025, BABYLON, {"kind": "morning_last", "span": 3.0}),
    ("moon-ef-babylon", "moon", Y_2025, BABYLON, {"kind": "evening_first"}),
    ("moon-ml-babylon", "moon", Y_2025, BABYLON, {"kind": "morning_last"}),
    ("moon-ef-mecca", "moon", Y_2025, MECCA, {"kind": "evening_first"}),
    ("moon-ef-london", "moon", Y_2025, LONDON, {"kind": "evening_first"}),
    ("moon-ef-600bce", "moon", Y_600BCE, BABYLON, {"kind": "evening_first"}),
    ("moon-ml-cape", "moon", Y_1000, CAPE_TOWN, {"kind": "morning_last"}),
]

CRESCENTS = [
    ("mecca-evening", julian_day(2025, 3, 29, 12), MECCA, "evening", 4),
    ("mecca-morning", julian_day(2025, 3, 25, 12), MECCA, "morning", 4),
    ("london-evening", julian_day(2025, 3, 29, 12), LONDON, "evening", 3),
    ("babylon-600bce", julian_day(-600, 3, 20, 12, 0, 0, "julian"), BABYLON, "evening", 4),
]


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.heliacal (embedded VSOP, "
                    "full moon, era packs)",
           "instants": [], "events": [], "crescents": []}
    for cid, target, jd, (lat, lon), opts in INSTANTS:
        out["instants"].append({
            "id": cid, "target": target, "jd": jd, "lat": lat, "lon": lon, "options": opts,
            "result": HL.visibility(eng, target, jd, lat, lon, **opts)})
    for cid, target, jd, (lat, lon), opts in EVENTS:
        out["events"].append({
            "id": cid, "target": target, "jd": jd, "lat": lat, "lon": lon, "options": opts,
            "result": HL.heliacal(eng, target, jd, lat, lon, **opts)})
    for cid, jd, (lat, lon), half, n in CRESCENTS:
        day0 = HL.local_day(jd, lon)
        for i in range(n):
            out["crescents"].append({
                "id": f"{cid}-{i}", "day": day0 + i, "lat": lat, "lon": lon, "half": half,
                "result": HL.crescent(eng, day0 + i, lat, lon, half)})
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "heliacal-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    found = sum(1 for c in out["events"] if c["result"] is not None)
    print(f"{len(out['instants'])} instants, {len(out['events'])} events ({found} found), "
          f"{len(out['crescents'])} crescent tests ->", path)


if __name__ == "__main__":
    main()
