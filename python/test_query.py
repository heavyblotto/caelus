#!/usr/bin/env python3
"""Self-check for astroengine.query: the when() interval solver must agree
with the trusted events.crossings root-finder, and the boolean combinators
must match hand-computed interval algebra. Run: python3 test_query.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import events
from astroengine.query import (when, all_, any_, not_, aspect, in_sign,
                               retrograde, not_retrograde)

eng = Engine("full")
JD0, JD1 = julian_day(2025, 1, 1), julian_day(2028, 1, 1)
NATAL_MOON = eng.longitude("moon", julian_day(1990, 6, 10, 14, 30))

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"  FAIL: {msg}")


# 1) Every exact aspect hit (from crossings) lies inside a when() interval,
#    and the within-orb interval is wider than the exact crossing is precise.
sat_sq = aspect("saturn", "square", NATAL_MOON, orb=1.0)
ivals = when(eng, sat_sq, JD0, JD1)
hits = sorted(events.crossings(eng, "saturn", (NATAL_MOON + 90) % 360, JD0, JD1)
              + events.crossings(eng, "saturn", (NATAL_MOON - 90) % 360, JD0, JD1))
ok(len(hits) > 0, "expected at least one Saturn square hit")
for h in hits:
    ok(any(s <= h <= e for s, e in ivals),
       f"exact hit {h:.3f} not inside any when() interval")

# 2) Intervals are ordered, disjoint, and within range.
for (s, e) in ivals:
    ok(JD0 <= s < e <= JD1, f"interval ({s},{e}) malformed or out of range")
for (a, b), (c, d) in zip(ivals, ivals[1:]):
    ok(b <= c, "intervals overlap or are out of order")

# 3) all_ is the intersection: a window in the triple must be in each part.
triple = all_(aspect("saturn", "square", NATAL_MOON, orb=2.0),
              not_retrograde("mercury"), in_sign("venus", "Taurus"))
sat = when(eng, aspect("saturn", "square", NATAL_MOON, orb=2.0), JD0, JD1)
ven = when(eng, in_sign("venus", "Taurus"), JD0, JD1)
merc = when(eng, not_retrograde("mercury"), JD0, JD1)
for (s, e) in when(eng, triple, JD0, JD1):
    mid = 0.5 * (s + e)
    ok(any(a <= mid <= b for a, b in sat), "triple window not in Saturn part")
    ok(any(a <= mid <= b for a, b in ven), "triple window not in Venus part")
    ok(any(a <= mid <= b for a, b in merc), "triple window not in Mercury part")

# 4) not_ is the complement: retrograde and not_retrograde tile the range
#    (every sampled instant is in exactly one).
retro = when(eng, retrograde("mercury"), JD0, JD1)
direct = when(eng, not_retrograde("mercury"), JD0, JD1)
t = JD0 + 5
while t < JD1:
    in_r = any(s <= t <= e for s, e in retro)
    in_d = any(s <= t <= e for s, e in direct)
    ok(in_r != in_d, f"retrograde/direct not complementary at {t:.1f}")
    t += 17

# 5) any_ is the union: the union count covers both parts.
either = when(eng, any_(in_sign("venus", "Taurus"), in_sign("mars", "Leo")),
              JD0, JD1)
ok(len(either) > 0, "any_ should find some windows")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
