#!/usr/bin/env python3
"""Self-check for astroengine.datesky and the calendar helpers in core.

date_sky is checked four ways: against when() from astroengine.query, an
independent search that scans the whole range at one fine step; against
arcs built to be touched only briefly at a station, which a fixed-step scan
can miss; by round trip, describing a random instant by its signs and
searching for it; and on two historical horoscopes whose dates are known.
Run: python3 test_datesky.py
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine import events as EV
from astroengine import query as Q
from astroengine.chart import SIGNS
from astroengine.core import calendar_date, julian_day
from astroengine.datesky import date_sky

eng = Engine("full")
SEVEN = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def sign_of(body, jd, zodiac="tropical"):
    return SIGNS[int(eng.longitude(body, jd, zodiac=zodiac) // 30)]


# 1. Calendar helpers.
random.seed(7)
for cal in ("gregorian", "julian"):
    bad = 0
    for _ in range(4000):
        y, m, d = random.randint(-3000, 3000), random.randint(1, 12), random.randint(1, 28)
        h = random.random() * 24
        r = calendar_date(julian_day(y, m, d, h, calendar=cal), cal)
        if (r["year"], r["month"], r["day"]) != (y, m, d) or abs(r["hour"] - h) > 1e-4:
            bad += 1
    ok(bad == 0, f"{cal} calendar round trip: {bad} failures")
ok(julian_day(-4712, 1, 1, 12, calendar="julian") == 0.0, "JD 0 is -4712 Jan 1.5 Julian")
ok(julian_day(1582, 10, 15) == julian_day(1582, 10, 5, calendar="julian") == 2299160.5,
   "the Gregorian reform: 1582-10-15 follows Julian 1582-10-04")
ok(julian_day(2000, 1, 1, 12) == 2451545.0, "J2000")

# 2. Agreement with when() on short ranges. when() samples every predicate
#    at one fine step across the whole range, so it is slow and independent.
random.seed(11)
for case in range(6):
    year = random.choice([-2500, -700, 150, 1100, 1650, 1990])
    jd0 = julian_day(year, 1, 1) + random.random() * 300
    jd1 = jd0 + 3 * 365.25
    bodies = random.sample(["mercury", "venus", "mars", "jupiter", "saturn", "sun"], 3)
    mid = jd0 + random.random() * (jd1 - jd0)
    cons = [{"body": b, "sign": sign_of(b, mid)} for b in bodies]
    got = date_sky(eng, cons, jd0, jd1)["windows"]
    want = Q.when(eng, Q.all_(*[Q.in_sign(c["body"], c["sign"]) for c in cons]),
                  jd0, jd1, step=0.1)
    ok(len(got) == len(want), f"when() case {case} ({year}): {len(got)} windows vs {len(want)}")
    if len(got) == len(want):
        worst = max((abs(g["start"] - w[0]) + abs(g["end"] - w[1])
                     for g, w in zip(got, want)), default=0.0)
        ok(worst < 2e-3, f"when() case {case} ({year}): edges differ by {worst:.5f} d")
    ok(any(g["start"] <= mid <= g["end"] for g in got),
       f"when() case {case}: the seed instant is inside a window")

# 3. Brief touches at a station. Build an arc whose lower edge sits just
#    under the longitude a body reaches when it turns retrograde, so the body
#    is inside the arc only around the station.
for body, depth in (("mercury", 0.01), ("venus", 0.01), ("mars", 0.005),
                    ("jupiter", 0.002), ("saturn", 0.002)):
    jd0 = julian_day(1998, 1, 1)
    span = 800 if body in ("mercury", "venus", "mars") else 500
    sts = [t for t, kind in EV.stations(eng, body, jd0, jd0 + span) if kind == "retrograde"]
    ok(len(sts) > 0, f"{body}: a retrograde station exists in the span")
    for ts in sts[:2]:
        top = eng.longitude(body, ts)
        cons = [{"body": body, "from": top - depth, "to": top + 20.0}]
        got = date_sky(eng, cons, ts - 40, ts + 40)["windows"]
        hit = [g for g in got if g["start"] <= ts <= g["end"]]
        ok(len(hit) == 1, f"{body} station at {ts:.2f}: touch found ({len(got)} windows)")
        if hit:
            for edge in (hit[0]["start"], hit[0]["end"]):
                lon = eng.longitude(body, edge)
                ok(abs((lon - (top - depth) + 180) % 360 - 180) < 1e-6,
                   f"{body} station: window edge sits on the arc edge")

# 4. Round trip across the engine's range.
random.seed(23)
for _ in range(8):
    year = random.randint(-2900, 2900)
    t = julian_day(year, 1, 1) + random.random() * 365
    cons = [{"body": b, "sign": sign_of(b, t)} for b in SEVEN]
    res = date_sky(eng, cons, t - 60 * 365.25, t + 60 * 365.25)
    ok(any(w["start"] <= t <= w["end"] for w in res["windows"]),
       f"round trip {year}: instant not recovered")
    ok(all(w["end"] - w["start"] < 3.0 for w in res["windows"]),
       f"round trip {year}: a window with the Moon is under 3 days")
    ok(res["funnel"][0]["label"].startswith("saturn"), "the slowest body is scanned first")
    days = [f["days"] for f in res["funnel"]]
    ok(all(a >= b for a, b in zip(days, days[1:])), "the funnel never widens")

# 5. An elongation constraint: every window of a waning Moon lies between a
#    full Moon and the next new Moon.
jd0 = julian_day(2024, 1, 1)
res = date_sky(eng, [{"elongation": ["moon", "sun"], "from": 180, "to": 360}], jd0, jd0 + 120)
phases = EV.lunar_phases(eng, jd0 - 20, jd0 + 140)
fulls = [t for t, name in phases if name == "full"]
news = [t for t, name in phases if name == "new"]
for w in res["windows"]:
    if w["start"] > jd0 and w["end"] < jd0 + 120:
        ok(min(abs(w["start"] - f) for f in fulls) < 1e-3, "waning window opens at a full Moon")
        ok(min(abs(w["end"] - n) for n in news) < 1e-3, "waning window closes at a new Moon")
ok(3 <= len(res["windows"]) <= 5, "four lunations in 120 days")

# 6. Historical horoscopes. The signs are the ones usually quoted for each
#    text and have not been checked against the printed editions; the
#    accepted dates are from Neugebauer & Van Hoesen, Greek Horoscopes
#    (1959), no. L 76, and Sachs, "Babylonian Horoscopes", J. Cuneiform
#    Studies 6 (1952).
# Hadrian: the source gives signs in a zodiac that ran a few degrees ahead of
# the tropical one in the first century, so the search pads each sign.
hadrian = [{"body": "sun", "sign": "Aquarius"}, {"body": "moon", "sign": "Aquarius"},
           {"body": "jupiter", "sign": "Aquarius"}, {"body": "saturn", "sign": "Capricorn"},
           {"body": "mercury", "sign": "Capricorn"}, {"body": "venus", "sign": "Pisces"},
           {"body": "mars", "sign": "Pisces"}]
res = date_sky(eng, hadrian, julian_day(-200, 1, 1, calendar="julian"),
               julian_day(400, 1, 1, calendar="julian"), pad=6.0)
born = julian_day(76, 1, 24, 6, calendar="julian")
ok(len(res["windows"]) == 1, f"Hadrian: one window in 600 years ({len(res['windows'])})")
ok(any(w["start"] <= born <= w["end"] for w in res["windows"]), "Hadrian: 24 January 76 CE")
# The oldest Babylonian horoscope names four planets by sign.
babylon = [{"body": "jupiter", "sign": "Pisces"}, {"body": "venus", "sign": "Taurus"},
           {"body": "saturn", "sign": "Cancer"}, {"body": "mars", "sign": "Gemini"}]
res = date_sky(eng, babylon, julian_day(-499, 1, 1, calendar="julian"),
               julian_day(-299, 1, 1, calendar="julian"))
born = julian_day(-409, 4, 29, 18, calendar="julian")
ok(len(res["windows"]) == 1, f"Babylon: one window in 200 years ({len(res['windows'])})")
ok(any(w["start"] <= born <= w["end"] for w in res["windows"]), "Babylon: 29 April 410 BCE")

# 6b. keep_stages: each stage's spans are that stage's windows, the last
#     stage's spans are the result, and each stage lies inside the one before.
res = date_sky(eng, babylon, julian_day(-499, 1, 1, calendar="julian"),
               julian_day(-299, 1, 1, calendar="julian"), keep_stages=True)
ok(all(len(f["spans"]) == f["windows"] for f in res["funnel"]), "spans count matches windows")
ok([tuple(sp) for sp in res["funnel"][-1]["spans"]]
   == [(w["start"], w["end"]) for w in res["windows"]], "the last stage is the result")
for prev, cur in zip(res["funnel"], res["funnel"][1:]):
    ok(all(any(a <= s and e <= b for a, b in prev["spans"]) for s, e in cur["spans"]),
       "each stage lies inside the stage before")
ok("spans" not in date_sky(eng, babylon, julian_day(-499, 1, 1, calendar="julian"),
                           julian_day(-299, 1, 1, calendar="julian"))["funnel"][0],
   "no spans unless asked")

# 7. Arguments.
for bad, why in (([], "no constraints"),
                 ([{"body": "sun"}], "no arc"),
                 ([{"body": "sun", "sign": "Ophiuchus"}], "unknown sign"),
                 ([{"sign": "Leo"}], "no quantity"),
                 ([{"body": "sun", "from": 10, "to": 10}], "empty arc"),
                 ([{"body": "sun", "lon": 0, "orb": 175}], "arc too wide")):
    try:
        date_sky(eng, bad, jd0, jd0 + 10)
        ok(False, f"should reject: {why}")
    except ValueError:
        ok(True, why)
res = date_sky(eng, [{"body": "moon", "sign": 0}], jd0, jd0 + 400, max_windows=5)
ok(len(res["windows"]) == 5 and res["truncated"], "max_windows truncates and says so")
ok(res["funnel"][0]["label"] == "moon in Aries", "a sign may be given by index")

# 8. A first or last visibility as a constraint. Every window must lie on
#    the days of one event that heliacal() finds on its own, every event in
#    the range must have its window, and the constraint is taken last.
from astroengine import heliacal as HL

MEMPHIS = (29.85, 31.25)
a0 = julian_day(130, 1, 1, calendar="julian")
a1 = julian_day(145, 1, 1, calendar="julian")
sirius = {"visibility": {"target": "Sirius", "kind": "heliacal_rising",
                         "lat": MEMPHIS[0], "lon_east": MEMPHIS[1]}}
res = date_sky(eng, [sirius], a0, a1)
ok(len(res["windows"]) == 15, f"Sirius rises once a year: 15 windows in 15 years ({len(res['windows'])})")
ok(res["funnel"][0]["label"] == "Sirius morning_first at 29.85, 31.25", "the label names the event and the place")
t = a0
seen = 0
while True:
    ev = HL.heliacal(eng, "Sirius", t, *MEMPHIS)
    if ev is None or ev["jd"] >= a1:
        break
    d0 = HL.local_day(ev["earliest"], MEMPHIS[1]) - 0.5 - MEMPHIS[1] / 360.0
    d1 = HL.local_day(ev["latest"], MEMPHIS[1]) + 0.5 - MEMPHIS[1] / 360.0
    w = res["windows"][seen]
    ok(abs(w["start"] - d0) < 1e-9 and abs(w["end"] - d1) < 1e-9,
       f"window {seen} runs from the earliest local day to the end of the latest")
    ok(w["start"] <= ev["jd"] <= w["end"], f"window {seen} holds the event's own instant")
    seen += 1
    t = ev["jd"] + 1.0
ok(seen == 15, "every event in the range has its window")

wide = date_sky(eng, [dict(sirius, within=3)], a0, a1)
ok(all(abs((w2["end"] - w2["start"]) - (w1["end"] - w1["start"]) - 6.0) < 1e-9
       for w1, w2 in zip(res["windows"], wide["windows"])), "'within' widens each window by that many days a side")

# with positions: the visibility is scanned last, and the result is the
# intersection of the two searches run apart
both = date_sky(eng, [sirius, {"body": "moon", "sign": "Cancer"}], a0, a1)
ok([f["constraint"] for f in both["funnel"]] == [1, 0], "a visibility constraint is taken after the positions")
moon = date_sky(eng, [{"body": "moon", "sign": "Cancer"}], a0, a1)["windows"]
want = []
for w in res["windows"]:
    for m in moon:
        s, e = max(w["start"], m["start"]), min(w["end"], m["end"])
        if e > s:
            want.append((s, e))
got = [(w["start"], w["end"]) for w in both["windows"]]
ok(len(got) == len(want) and all(abs(g[0] - w[0]) < 1e-6 and abs(g[1] - w[1]) < 1e-6
                                 for g, w in zip(got, want)),
   f"the joint search is the intersection ({len(got)} vs {len(want)})")
ok(0 < len(got) < 15, "the Moon is in Cancer at some risings and not others")

# the Moon's crescent and the arcus method
cres = date_sky(eng, [{"visibility": {"target": "moon", "kind": "evening_first",
                                      "lat": 21.42, "lon_east": 39.83}}],
                julian_day(2025, 1, 1), julian_day(2026, 1, 1))
ok(12 <= len(cres["windows"]) <= 13, f"a first crescent every month ({len(cres['windows'])})")
ok(all(0.99 < w["end"] - w["start"] < 2.01 for w in cres["windows"][1:]), "each on one evening or two")
ok(cres["windows"][0]["start"] == julian_day(2025, 1, 1), "a window under way at the start is cut to the range")
arc = date_sky(eng, [{"visibility": {"target": "jupiter", "kind": "acronychal_rising", "lat": 32.54,
                                     "lon_east": 44.42, "method": "arcus", "arcus_visionis": 7.0}}],
               julian_day(2020, 1, 1), julian_day(2024, 1, 1))
ok(3 <= len(arc["windows"]) <= 4 and all(abs(w["end"] - w["start"] - 1.0) < 1e-9 for w in arc["windows"]),
   "the arcus method gives one day for each opposition")
never = date_sky(eng, [{"visibility": {"target": "Polaris", "kind": "morning_first",
                                       "lat": 51.5, "lon_east": -0.12}}],
                 julian_day(2020, 1, 1), julian_day(2023, 1, 1))
ok(never["windows"] == [] and never["funnel"][0]["windows"] == 0, "a star that never sets gives no window")

for bad, why in (
        ([{"visibility": {"target": "Sirius", "kind": "morning_first", "lat": 30.0}}], "no longitude"),
        ([{"visibility": {"target": "Sirius", "kind": "noon_first", "lat": 30.0, "lon_east": 31.0}}], "unknown kind"),
        ([{"visibility": {"target": "Nibiru", "kind": "morning_first", "lat": 30.0, "lon_east": 31.0}}], "unknown target"),
        ([{"visibility": {"target": "jupiter", "kind": "evening_first", "lat": 30.0, "lon_east": 31.0}}],
         "an event the target does not have"),
        ([{"visibility": {"target": "Sirius", "kind": "morning_first", "lat": 30.0, "lon_east": 31.0,
                          "method": "arcus"}}], "arcus without its angle"),
        ([{"visibility": {"target": "Sirius", "kind": "morning_first", "lat": 30.0, "lon_east": 31.0},
           "sign": "Leo"}], "a visibility with an arc"),
        ([{"visibility": {"target": "Sirius", "kind": "morning_first", "lat": 30.0, "lon_east": 31.0},
           "within": -1}], "negative within")):
    try:
        date_sky(eng, bad, jd0, jd0 + 10)
        ok(False, f"should reject: {why}")
    except ValueError:
        ok(True, why)

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
