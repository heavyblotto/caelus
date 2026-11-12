#!/usr/bin/env python3
"""Self-check for astroengine.core.delta_t.

The oracles (validate_swiss.py, validate_horizons.py) convert UT to TT with the
engine's own jd_tt before they compare, so neither one can see an error in
delta T. This file is the check that does: the spline rows must be a faithful
copy of the published table, the model must be continuous where its branches
meet, and it must return the published value at the published knots.

Source: Morrison, Stephenson, Hohenkerk & Zawilski, Table S15 v.2020
(doi:10.1098/rspa.2020.0776). Needs no network.
Run: python3 test_delta_t.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import core
from astroengine.core import J2000, delta_t

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def at(year):
    return delta_t(J2000 + (year - 2000.0) * 365.25)


# 1. Transcription. The published table is a continuous spline printed to
#    three decimals, so each row evaluated at its right edge must land on the
#    next row's a0 within rounding. A mistyped coefficient breaks this.
rows = core._DT_SPLINE
worst_knot = 0.0
for a, b in zip(rows, rows[1:]):
    ok(a[1] == b[0], f"rows adjoin at {a[1]}")
    gap = abs((a[2] + a[3] + a[4] + a[5]) - b[2])
    worst_knot = max(worst_knot, gap)
    ok(gap <= 0.0025, f"knot {a[1]}: rows disagree by {gap:.4f} s")
ok(rows[0][0] == core.DT_SPLINE_START, "first knot is the spline start")
ok(rows[-1][1] >= core.DT_SPLINE_END, "rows reach the handover year")

# 2. Published values at the knots (a0 of each row is DT at K_i).
for k0, _k1, a0, *_ in rows:
    if k0 < core.DT_SPLINE_END:
        ok(abs(at(k0) - a0) < 1e-6, f"DT({k0}) = {at(k0)} != published {a0}")

# 3. Continuity where the branches meet. The steps at 1948 and 1955 are the
#    measured disagreement between sources, not a tolerance to grow into.
EPS = 1e-7
BOUNDARIES = [
    ("parabola to bridge", core.DT_BRIDGE_START, 0.001),
    ("bridge to spline", core.DT_SPLINE_START, 0.001),
    ("spline to polynomial", core.DT_SPLINE_END, 0.005),
    ("polynomial to observations", 1955.0, 0.06),
]
steps = {}
for name, year, tol in BOUNDARIES:
    step = at(year + EPS) - at(year - EPS)
    steps[name] = step
    ok(abs(step) <= tol, f"{name} at {year}: step {step:+.4f} s exceeds {tol}")

# 4. No step anywhere else: walk the whole range in half-year strides and
#    bound the change by the steepest slope the model has (about 25 s/yr at
#    3000 BCE).
prev = at(-3000.0)
y = -3000.0
worst_stride = 0.0
while y < 2100.0:
    y += 0.5
    cur = at(y)
    worst_stride = max(worst_stride, abs(cur - prev))
    prev = cur
ok(worst_stride < 16.0, f"half-year stride moved DT by {worst_stride:.2f} s")

# 5. The bridge is monotone and keeps the parabola's slope at its far end.
b0 = core.DT_BRIDGE_START
slope_in = (at(b0 + 0.01) - at(b0)) / 0.01
slope_out = (at(b0) - at(b0 - 0.01)) / 0.01
ok(abs(slope_in - slope_out) < 0.01, "bridge leaves the parabola without a kink")
s0 = core.DT_SPLINE_START
slope_in = (at(s0 + 0.01) - at(s0)) / 0.01
slope_out = (at(s0) - at(s0 - 0.01)) / 0.01
ok(abs(slope_in - slope_out) < 0.01, "bridge meets the spline without a kink")
yy = b0
mono = True
while yy < s0:
    if at(yy + 10.0) >= at(yy):
        mono = False
    yy += 10.0
ok(mono, "bridge is monotone decreasing")

# 6. The modern era is untouched by the historical model.
for year, want in ((1955.0, 31.1), (2000.0, 63.8), (2025.0, 69.2)):
    ok(abs(at(year) - want) < 1e-9, f"DT({year}) moved off the observation")

if "--report" in sys.argv:
    print(f"worst knot mismatch: {worst_knot:.4f} s")
    for name, step in steps.items():
        print(f"step, {name}: {step:+.4f} s")
    print("year      DT (s)")
    for year in (-3000, -2000, -1000, -720, -500, 0, 500, 1000, 1200, 1300,
                 1500, 1600, 1700, 1800, 1850, 1900, 1948):
        print(f"{year:6d} {at(year):10.2f}")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
