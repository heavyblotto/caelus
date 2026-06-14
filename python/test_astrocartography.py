#!/usr/bin/env python3
"""Self-check for astroengine.astrocartography. Run: python3 test_astrocartography.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day, DEG
from astroengine.houses import gast
from astroengine import astrocartography as AC

eng = Engine("full")
checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"  FAIL: {msg}")


def wrapped(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


# 1) MC and IC meridians are 180 degrees apart.
L = AC.planet_lines(120.0, 0.0, 30.0, lat_step=10.0)
ok(abs(wrapped(L["mc"], L["ic"]) - 180.0) < 1e-9, "MC and IC are 180 apart")

# 2) A body on the celestial equator rises and sets at every latitude sampled.
full = int((85.0 - (-85.0)) / 10.0 + 1e-9) + 1
ok(len(L["asc"]) == full and len(L["dsc"]) == full,
   "an equatorial body rises at every sampled latitude")

# 3) Longitudes stay in (-180, 180]; the latitudes are the sampled band.
ok(all(-180.0 < lon <= 180.0 for lon, _ in L["asc"] + L["dsc"]),
   "all line longitudes are in (-180, 180]")
ok(L["asc"][0][1] == -85.0 and L["asc"][-1][1] == 85.0, "latitudes span the band")

# 4) A high-declination body is circumpolar at high latitude: fewer rise points
#    than the full band.
H = AC.planet_lines(0.0, 23.0, 0.0, lat_min=-85.0, lat_max=85.0, lat_step=5.0)
full5 = int((85.0 - (-85.0)) / 5.0 + 1e-9) + 1
ok(len(H["asc"]) < full5, "a high-dec body does not rise near the poles")

# 5) Engine: the MC meridian is where the body's RA meets the sidereal time.
jd = julian_day(2000, 1, 1, 12, 0)
g = gast(jd) / DEG
ac = AC.astrocartography(eng, jd, ["sun", "moon"], lat_step=30.0)
for b in ("sun", "moon"):
    ra = eng.position(b, jd)["ra"]
    expect = ((ra - g + 180.0) % 360.0) - 180.0
    ok(wrapped(ac[b]["mc"], expect) < 1e-9, f"{b} MC meridian is RA - GAST")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
