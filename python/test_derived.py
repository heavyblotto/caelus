#!/usr/bin/env python3
"""Self-check for astroengine.derived: the derivations must be internally
consistent with the primitives they sit on. Run: python3 test_derived.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import derived as D

eng = Engine("full")
NATAL = julian_day(1990, 6, 10, 14, 30)

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"  FAIL: {msg}")


def angdist(a, b):
    return abs(((a - b + 180) % 360) - 180)


# 1) A solar return lands on the natal Sun longitude.
natal_sun = eng.longitude("sun", NATAL)
rs = D.solar_return(eng, NATAL, NATAL + 300, NATAL + 430)
ok(len(rs) == 1, f"expected exactly one solar return in the window, got {len(rs)}")
for jd in rs:
    ok(angdist(eng.longitude("sun", jd), natal_sun) < 1e-4,
       "solar return Sun not at the natal longitude")
    ok(360 < (jd - NATAL) < 367, "solar return not ~one year out")

# 2) A lunar return lands on the natal Moon longitude (fast body).
natal_moon = eng.longitude("moon", NATAL)
rm = D.lunar_return(eng, NATAL, NATAL + 20, NATAL + 35)
ok(len(rm) >= 1, "expected a lunar return within ~a month")
for jd in rm:
    ok(angdist(eng.longitude("moon", jd), natal_moon) < 1e-3,
       "lunar return Moon not at the natal longitude")

# 3) Secondary progression: one tropical year of life maps to one day.
ok(abs(D.progressed_jd(NATAL, NATAL + D.TROPICAL_YEAR) - (NATAL + 1.0)) < 1e-9,
   "progressed_jd: one year of life should map to one day")

# 4) Solar arc is forward, and directing the natal Sun by it reproduces the
#    secondary-progressed Sun.
target = julian_day(2025, 6, 10)  # age ~35
arc = D.solar_arc(eng, NATAL, target)
ok(0 < arc < 60, f"solar arc for ~35y should be ~35 deg forward, got {arc:.2f}")
ok(angdist(D.directed_longitude(eng, "sun", NATAL, target),
           D.progressed_longitude(eng, "sun", NATAL, target)) < 1e-9,
   "directing the natal Sun by solar arc must equal the progressed Sun")

# 5) Composite midpoint is equidistant from both inputs (shorter arc).
jd_b = julian_day(1988, 2, 3, 9, 0)
comp = D.composite_longitudes(eng, NATAL, jd_b, ["sun", "moon", "venus", "mars"])
for body, mid in comp.items():
    la = eng.longitude(body, NATAL)
    lb = eng.longitude(body, jd_b)
    ok(abs(angdist(mid, la) - angdist(mid, lb)) < 1e-9,
       f"composite {body}: midpoint not equidistant from the two longitudes")
    ok(angdist(mid, la) <= 90 + 1e-9,
       f"composite {body}: midpoint should be on the shorter arc")

# 6) Davison: temporal midpoint is the mean; geographic midpoint well-formed.
mid_jd, mid_lat, mid_lon = D.davison_params(NATAL, jd_b, 27.95, -82.46, 51.5, -0.12)
ok(abs(mid_jd - 0.5 * (NATAL + jd_b)) < 1e-9, "Davison time is not the mean JD")
ok(abs(mid_lat - 0.5 * (27.95 + 51.5)) < 1e-9, "Davison latitude is not the mean")
ok(-180 < mid_lon <= 180, "Davison longitude out of range")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
