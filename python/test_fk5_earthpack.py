#!/usr/bin/env python3
"""Regression checks for issue #20: fk5Correction applies only to VSOP87D, not Horizons earthPack.

Run: python3 python/test_fk5_earthpack.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine, core
from astroengine.core import ARCSEC, DEG, J2000

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def wrap_arcsec(a_deg, b_deg):
    return (((a_deg - b_deg + 180.0) % 360.0) - 180.0) * 3600.0


# 1. Exact reproduction from issue #20 (1985-11-03 05:25:00 UTC, TT = JD 2446372.726333148)
JD_TT = 2446372.726333148
HORIZONS_LTS_XYZ = (-7.493296385024389e-1, -6.499307199215022e-1, -2.000051510337879e-5)
hx, hy, hz = HORIZONS_LTS_XYZ
h_lon = math.degrees(math.atan2(hy, hx)) % 360.0
h_lat = math.degrees(math.asin(hz / math.sqrt(hx * hx + hy * hy + hz * hz)))

eng = Engine("full")
ok(core._earth_uses_pack(), "earth_cheb pack is active in default full Python engine")

pub_lon, pub_lat, _ = core.sun_apparent(eng.vsop, JD_TT)
dpsi, _ = core.nutation(JD_TT)
j2_lon, j2_lat = core._precess_ecliptic(pub_lon - dpsi, pub_lat, JD_TT, J2000)
dlon_arcsec = wrap_arcsec(math.degrees(j2_lon) % 360.0, h_lon)
dlat_arcsec = (math.degrees(j2_lat) - h_lat) * 3600.0
ok(abs(dlon_arcsec) < 0.005, f"earthPack Sun matches Horizons LT+S lon within 0.005\" (got {dlon_arcsec:.4f}\")")
ok(abs(dlat_arcsec) < 0.001, f"earthPack Sun matches Horizons LT+S lat within 0.001\" (got {dlat_arcsec:.4f}\")")

# 2. Unpacked VSOP87D fallback MUST still apply _fk5_correction (agreement without -0.09" bias)
orig_cheb = core._earth_cheb
orig_era = core._earth_era_slabs
try:
    core._earth_cheb = lambda: None
    core._earth_era_slabs = lambda: []
    ok(not core._earth_uses_pack(), "VSOP87D fallback reports _earth_uses_pack() == False")

    vsop_lon, vsop_lat, vsop_r = core.sun_apparent(eng.vsop, JD_TT)
    diff_fallback_arcsec = abs(wrap_arcsec(math.degrees(vsop_lon), math.degrees(pub_lon)))
    ok(diff_fallback_arcsec < 0.15, f"VSOP87D fallback with FK5 agrees with earthPack Sun within 0.15\" (got {diff_fallback_arcsec:.4f}\")")

    # Verify _fk5_correction actually ran on the fallback path
    L0, B0, R0 = eng.vsop.heliocentric("earth", JD_TT)
    raw_lon = (L0 + math.pi) % (2 * math.pi) - 20.4898 * ARCSEC / R0 + dpsi
    fk5_delta_arcsec = wrap_arcsec(math.degrees(vsop_lon), math.degrees(raw_lon))
    ok(abs(fk5_delta_arcsec + 0.09033) < 0.002, f"VSOP87D fallback applies -0.09033\" FK5 shift (got {fk5_delta_arcsec:.5f}\")")
finally:
    core._earth_cheb = orig_cheb
    core._earth_era_slabs = orig_era

# 3. Classical-era-only slab (no modern pack) also counts as _earth_uses_pack()
try:
    core._earth_cheb = lambda: None
    slabs = orig_era()
    ok(bool(slabs), "classical earth era slab exists on disk")
    ok(core._earth_uses_pack(), "classical-era-only earth slab reports _earth_uses_pack() == True")
    jd_class = core.julian_day(500, 6, 15, 12, calendar="julian")
    cl_lon, _, _ = core.sun_apparent(eng.vsop, jd_class)
    L0c, B0c, R0c = eng.vsop.heliocentric("earth", jd_class)
    raw_cl = (L0c + math.pi) % (2 * math.pi) - 20.4898 * ARCSEC / R0c + core.nutation(jd_class)[0]
    ok(abs(wrap_arcsec(math.degrees(cl_lon), math.degrees(raw_cl))) < 1e-6,
       "classical earth era slab skips _fk5_correction")
finally:
    core._earth_cheb = orig_cheb
    core._earth_era_slabs = orig_era

# 4. Mixed-tier planet_apparent: packed Earth + unpacked VSOP87D Mars vs packed Mars
packed_mars_lon = eng.longitude("mars", core.julian_day(1985, 11, 3, 5, 25, 0))
mixed_mars_lon, _, _ = core.planet_apparent(eng.vsop, "mars", JD_TT)
mixed_diff = abs(wrap_arcsec(math.degrees(mixed_mars_lon), packed_mars_lon))
ok(mixed_diff < 0.5, f"mixed-tier VSOP Mars + earthPack agrees with packed Mars within 0.5\" (got {mixed_diff:.4f}\")")

# Compare pure VSOP87D Mars (both Earth & Mars VSOP) against mixed-tier Mars
try:
    core._earth_cheb = lambda: None
    core._earth_era_slabs = lambda: []
    pure_vsop_mars, _, _ = core.planet_apparent(eng.vsop, "mars", JD_TT)
    pure_vsop_diff = abs(wrap_arcsec(math.degrees(mixed_mars_lon), math.degrees(pure_vsop_mars)))
    ok(pure_vsop_diff < 0.15, f"mixed-tier Mars avoids FK5 frame skew vs pure VSOP87D (diff {pure_vsop_diff:.4f}\")")
finally:
    core._earth_cheb = orig_cheb
    core._earth_era_slabs = orig_era

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
