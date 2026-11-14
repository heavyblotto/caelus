#!/usr/bin/env python3
"""Self-check for astroengine.uncertainty: the bound is claimed only inside
the span it was measured over, the clock term is the body's speed times the
delta-T sigma, and the two behave as the guide says across epochs.
Run: python3 test_uncertainty.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.canonical import ACCURACY_QUANTUM_ARCSEC
from astroengine.core import delta_t_sigma, julian_day
from astroengine.ranges import jd_year
from astroengine.uncertainty import bound_span, position_uncertainty

eng = Engine("embedded")
checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


J2000 = julian_day(2000, 1, 1, 12)
for body in ("sun", "moon", "mercury", "saturn", "neptune", "pluto", "true_node"):
    u = position_uncertainty(eng, body, J2000)
    ok(u["model_bound_arcsec"] == ACCURACY_QUANTUM_ARCSEC.get(body, 1), f"{body}: modern bound is the accuracy quantum")
    want = delta_t_sigma(jd_year(J2000)) * abs(u["speed"]) / 86400.0 * 3600.0
    ok(abs(u["clock_sigma_arcsec"] - want) < 1e-12, f"{body}: clock term is speed times sigma")
    ok(u["clock_sigma_arcsec"] < 0.1, f"{body}: modern clock term is negligible")

old = julian_day(100, 3, 1, 12, calendar="julian")
moon = position_uncertainty(eng, "moon", old)
saturn = position_uncertainty(eng, "saturn", old)
ok(moon["model_bound_arcsec"] is None and moon["bound_span"] == {"from": 1000, "to": 3000},
   "no bound is claimed for the Moon in 100 CE, and the span says why")
ok(moon["clock_sigma_arcsec"] > 60 and saturn["clock_sigma_arcsec"] < 1,
   "in 100 CE the clock smears the Moon by over an arcminute and Saturn by under an arcsecond")
ok(moon["delta_t_sigma_seconds"] == saturn["delta_t_sigma_seconds"], "one epoch, one sigma")

edge_in = position_uncertainty(eng, "mars", julian_day(1001, 1, 1, calendar="julian"))
edge_out = position_uncertainty(eng, "mars", julian_day(999, 1, 1, calendar="julian"))
ok(edge_in["model_bound_arcsec"] == 1 and edge_out["model_bound_arcsec"] is None,
   "the bound stops at the edge of its span")
ok(bound_span(eng, "ceres") == {"from": 1600, "to": 2484}, "small bodies carry their narrower span")
ok(bound_span(eng, "not_a_body") is None, "an unknown body has no span")
sid = position_uncertainty(eng, "moon", J2000, zodiac="sidereal:lahiri")
ok(abs(sid["clock_sigma_arcsec"] - position_uncertainty(eng, "moon", J2000)["clock_sigma_arcsec"]) < 1e-6,
   "the zodiac does not change the clock term")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
