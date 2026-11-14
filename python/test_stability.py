#!/usr/bin/env python3
"""Self-check for astroengine.stability.

The claims checked are the ones a reader would rely on: every reported change
is a real change (the fact differs a few seconds either side of it), a fact
reported stable really is (it holds at random instants in the window), the
segments tile the window, and the default window is the delta-T sigma of the
epoch. Run: python3 test_stability.py
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import julian_day
from astroengine.ranges import delta_t_sigma, jd_year
from astroengine.stability import KINDS, _state, chart_stability

eng = Engine("embedded")
checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def value_at(t, key, lat, lon):
    return _state(eng, t, lat, lon, "placidus", "tropical", None).get(key)


JD = julian_day(1990, 6, 10, 18, 30)
LAT, LON = 27.95, -82.46

# 1. A birth time good to the quarter hour.
res = chart_stability(eng, JD, LAT, LON, half_width_seconds=900)
facts = res["facts"]
ok(abs((res["to"] - res["from"]) * 86400 - 1800) < 1e-3, "window is 30 minutes")
ok(res["summary"]["facts"] == len(facts)
   and res["summary"]["stable"] == sum(f["stable"] for f in facts), "summary counts")
ok([KINDS.index(f["kind"]) for f in facts] == sorted(KINDS.index(f["kind"]) for f in facts),
   "facts come in kind order")
ok(all(f["stable"] for f in facts if f["kind"] == "sign" and f["subject"] != "moon"),
   "no planet changes sign in 30 minutes")
random.seed(5)
EPS = 3.0 / 86400.0
for f in facts:
    key = (f["kind"], f["subject"])
    segs = f["segments"]
    ok(segs[0]["from"] == res["from"] and segs[-1]["to"] == res["to"], f"{key}: segments span the window")
    ok(all(a["to"] == b["from"] for a, b in zip(segs, segs[1:])), f"{key}: segments are contiguous")
    ok(all(a["value"] != b["value"] for a, b in zip(segs, segs[1:])), f"{key}: neighbours differ")
    ok(f["stable"] == (len(segs) == 1), f"{key}: stable means one segment")
    ok(0.0 <= f["share"] <= 1.0 + 1e-12, f"{key}: share is a fraction")
    for a, b in zip(segs, segs[1:]):
        t = a["to"]
        ok(value_at(t - EPS, key, LAT, LON) == a["value"]
           and value_at(t + EPS, key, LAT, LON) == b["value"],
           f"{key}: the change at {t} is real")
    if f["stable"]:
        t = res["from"] + random.random() * (res["to"] - res["from"])
        ok(value_at(t, key, LAT, LON) == f["value"], f"{key}: stable fact holds at a random instant")
ok(value_at(JD, ("angle_sign", "asc"), LAT, LON)
   == next(f["value"] for f in facts if f["kind"] == "angle_sign" and f["subject"] == "asc"),
   "value is the fact at the stated instant")

# 2. A date with part of a day unknown: six hours either side.
wide = chart_stability(eng, JD, LAT, LON, half_width_seconds=6 * 3600)
asc = next(f for f in wide["facts"] if f["kind"] == "angle_sign" and f["subject"] == "asc")
ok(5 <= len(asc["segments"]) <= 8, f"the Ascendant crosses about six signs in 12 hours ({len(asc['segments'])})")
sun = next(f for f in wide["facts"] if f["kind"] == "sign" and f["subject"] == "sun")
ok(sun["stable"] and sun["share"] == 1.0, "the Sun keeps its sign for 12 hours in mid-June")
sect = next(f for f in wide["facts"] if f["kind"] == "sect")
ok(not sect["stable"], "a 12-hour window around 18:30 UT in Tampa crosses sunrise or sunset")
ok(wide["summary"]["stable"] < res["summary"]["stable"], "a wider window leaves fewer stable facts")
moon_house = next(f for f in wide["facts"] if f["kind"] == "house" and f["subject"] == "moon")
ok(abs(sum(s["to"] - s["from"] for s in moon_house["segments"]) - (wide["to"] - wide["from"])) < 1e-9,
   "house segments tile the window")

# 3. No place: positions only.
bare = chart_stability(eng, JD, half_width_seconds=3600)
kinds = {f["kind"] for f in bare["facts"]}
ok(kinds <= {"sign", "retrograde", "aspect"} and "sign" in kinds, f"no place, no angles or houses ({sorted(kinds)})")

# 4. The default window is the delta-T sigma of the epoch.
old = julian_day(100, 3, 1, 12, calendar="julian")
anc = chart_stability(eng, old, 41.9, 12.5)
ok(anc["half_width_seconds"] == delta_t_sigma(jd_year(old)) and anc["half_width_seconds"] > 100,
   f"ancient default half-width is sigma(delta T) ({anc['half_width_seconds']:.0f} s)")
now = chart_stability(eng, JD, LAT, LON)
ok(now["half_width_seconds"] < 1 and now["summary"]["stable"] >= now["summary"]["facts"] - 1,
   "modern default window is under a second, so nearly everything is stable")
zero = chart_stability(eng, JD, LAT, LON, half_width_seconds=0)
ok(all(f["stable"] and f["share"] == 1.0 for f in zero["facts"]), "a zero window is all stable")

# 5. Arguments.
for kwargs, why in (({"lat": 10.0}, "lat without lon"),
                    ({"half_width_seconds": -1}, "negative half-width"),
                    ({"half_width_seconds": 60, "step_seconds": 0}, "zero step")):
    try:
        chart_stability(eng, JD, **kwargs)
        ok(False, f"should reject: {why}")
    except ValueError:
        ok(True, why)

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
