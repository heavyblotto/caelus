#!/usr/bin/env python3
"""Regenerate packages/caelus/test/datesky-golden.json from the Python
reference (astroengine.datesky, plus the calendar helpers in core).

The TypeScript port runs the same specs and must return the same windows and
the same funnel. Run: python3 export_datesky_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import calendar_date, julian_day
from astroengine.datesky import date_sky

SEVEN = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]

HADRIAN = [
    {"body": "sun", "sign": "Aquarius"}, {"body": "moon", "sign": "Aquarius"},
    {"body": "jupiter", "sign": "Aquarius"}, {"body": "saturn", "sign": "Capricorn"},
    {"body": "mercury", "sign": "Capricorn"}, {"body": "venus", "sign": "Pisces"},
    {"body": "mars", "sign": "Pisces"},
]
BABYLON = [
    {"body": "jupiter", "sign": "Pisces"}, {"body": "venus", "sign": "Taurus"},
    {"body": "saturn", "sign": "Cancer"}, {"body": "mars", "sign": "Gemini"},
]

# (id, constraints, from, to, options); dates are (y, m, d, calendar)
CASES = [
    ("hadrian-tropical-pad6", HADRIAN, (-200, 1, 1, "julian"), (400, 1, 1, "julian"),
     {"pad": 6.0}),
    ("hadrian-fagan-bradley-pad4", HADRIAN, (-200, 1, 1, "julian"), (400, 1, 1, "julian"),
     {"zodiac": "sidereal:fagan_bradley", "pad": 4.0}),
    ("hadrian-six-millennia", HADRIAN, (-2990, 1, 1, "julian"), (2990, 1, 1, "gregorian"),
     {"pad": 6.0}),
    ("babylon-410bce", BABYLON, (-499, 1, 1, "julian"), (-299, 1, 1, "julian"), {}),
    ("babylon-800-years", BABYLON, (-800, 1, 1, "julian"), (0, 1, 1, "julian"), {}),
    ("outer-pair-modern",
     [{"body": "saturn", "sign": "Capricorn"}, {"body": "jupiter", "sign": 9}],
     (1700, 1, 1, "gregorian"), (2100, 1, 1, "gregorian"), {}),
    ("longitude-orb",
     [{"body": "mars", "lon": 112.5, "orb": 2.0}, {"body": "sun", "sign": "Leo"}],
     (1990, 1, 1, "gregorian"), (2030, 1, 1, "gregorian"), {}),
    ("arc-wraps-aries-point",
     [{"body": "venus", "from": 350, "to": 15}, {"body": "mercury", "from": 340, "to": 5}],
     (2000, 1, 1, "gregorian"), (2012, 1, 1, "gregorian"), {}),
    ("waning-moon-in-sign",
     [{"elongation": ["moon", "sun"], "from": 180, "to": 360},
      {"body": "moon", "sign": "Scorpio"}],
     (2024, 1, 1, "gregorian"), (2026, 1, 1, "gregorian"), {}),
    ("per-constraint-pad",
     [{"body": "jupiter", "sign": "Taurus", "pad": 3.0}, {"body": "mars", "sign": "Leo"}],
     (1950, 1, 1, "gregorian"), (2050, 1, 1, "gregorian"), {}),
    ("truncated",
     [{"body": "moon", "sign": "Aries"}],
     (2020, 1, 1, "gregorian"), (2022, 1, 1, "gregorian"), {"max_windows": 6}),
    ("no-match",
     [{"body": "sun", "sign": "Aries"}, {"body": "mercury", "sign": "Libra"}],
     (2000, 1, 1, "gregorian"), (2010, 1, 1, "gregorian"), {}),
    ("true-node",
     [{"body": "true_node", "sign": "Aries"}, {"body": "saturn", "sign": "Pisces"}],
     (1900, 1, 1, "gregorian"), (2100, 1, 1, "gregorian"), {}),
]

CALENDAR = [
    (-4712, 1, 1, 12.0, "julian"), (-2999, 3, 1, 0.0, "julian"),
    (-409, 4, 29, 18.0, "julian"), (-409, 4, 29, 18.0, "gregorian"),
    (0, 2, 29, 6.5, "julian"), (76, 1, 24, 6.0, "julian"),
    (1582, 10, 4, 23.0, "julian"), (1582, 10, 15, 0.0, "gregorian"),
    (1600, 2, 29, 12.0, "gregorian"), (1900, 3, 1, 0.0, "gregorian"),
    (2000, 1, 1, 12.0, "gregorian"), (2999, 12, 31, 23.75, "gregorian"),
]


def station_cases(eng):
    """Arcs a body touches only around a retrograde station."""
    from astroengine import events as EV
    out = []
    for body, depth in (("mercury", 0.01), ("mars", 0.005), ("saturn", 0.002)):
        jd0 = julian_day(1998, 1, 1)
        ts = [t for t, kind in EV.stations(eng, body, jd0, jd0 + 800)
              if kind == "retrograde"][0]
        top = eng.longitude(body, ts)
        out.append({
            "id": f"station-touch-{body}",
            "constraints": [{"body": body, "from": top - depth, "to": top + 20.0}],
            "jd0": ts - 40.0, "jd1": ts + 40.0, "options": {},
        })
    return out


def main():
    eng = Engine("embedded")
    specs = []
    for cid, cons, d0, d1, opts in CASES:
        specs.append({
            "id": cid, "constraints": cons,
            "jd0": julian_day(d0[0], d0[1], d0[2], calendar=d0[3]),
            "jd1": julian_day(d1[0], d1[1], d1[2], calendar=d1[3]),
            "options": opts,
        })
    specs.extend(station_cases(eng))

    out = {"basis": "Python reference astroengine.datesky (embedded VSOP, "
                    "full moon, era packs)",
           "cases": [], "calendar": []}
    for spec in specs:
        res = date_sky(eng, spec["constraints"], spec["jd0"], spec["jd1"],
                       **spec["options"])
        out["cases"].append(dict(spec, result=res))
        print(f'{spec["id"]:28s} {len(res["windows"])} windows')
    for y, m, d, h, cal in CALENDAR:
        jd = julian_day(y, m, d, h, calendar=cal)
        out["calendar"].append({"year": y, "month": m, "day": d, "hour": h,
                                "calendar": cal, "jd": jd,
                                "back": calendar_date(jd, cal)})
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "datesky-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
