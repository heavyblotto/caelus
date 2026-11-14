#!/usr/bin/env python3
"""Self-check for astroengine.heliacal.

The claims checked are the ones a reader would rely on: the sky model behaves
as a sky does (brighter in twilight, dimmer through more air), an event's day
is the first or last on which the body can be seen and the day beside it is
not, a clearer sky never delays a first visibility, the arcus visionis an
event implies gives the same day back through the geometric method, and the
crescent test passes its threshold on the evening reported and not the one
before. Needs no network and no oracle; validate_heliacal.py measures the
dates against Swiss Ephemeris. Run: python3 test_heliacal.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine import heliacal as HL
from astroengine.core import calendar_date, julian_day

eng = Engine("full")
checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def raises(fn, msg):
    try:
        fn()
    except ValueError:
        ok(True, msg)
    else:
        ok(False, msg)


# 1. The sky model.
parts = HL.extinction_parts(0.25)
ok(abs(parts[0] - 0.25) < 1e-12 and abs(sum(parts[1:]) - 0.25) < 1e-12, "extinction parts sum to the total")
ok(HL.extinction_parts(0.05)[3] == 0.0 and HL.extinction_parts(0.05)[0] > 0.13,
   "a total below the gas floor is raised to it")
ok(HL.extinction_parts(0.25, 2000.0)[1] < parts[1], "Rayleigh extinction thins with height")
dark = HL.sky_brightness(90.0, -40.0, 120.0, 0.25)
ok(50.0 < dark < 120.0, f"the dark zenith is {dark:.0f} nanolamberts")
lim = HL.threshold_magnitude(dark) - HL.extinction_mag(90.0, parts)
ok(5.8 < lim < 6.6, f"the dark zenith limit is magnitude {lim:.2f}")
prev = 0.0
mono = True
for sun_alt in (-18, -15, -12, -9, -6, -3, -1):
    b = HL.sky_brightness(10.0, float(sun_alt), 30.0, 0.25)
    if b <= prev:
        mono = False
    prev = b
ok(mono, "the sky brightens as the Sun climbs")
ok(HL.sky_brightness(10.0, -8.0, 20.0, 0.25) > HL.sky_brightness(10.0, -8.0, 90.0, 0.25),
   "twilight is brighter toward the Sun")
ok(HL.sky_brightness(30.0, -30.0, 120.0, 0.25, 40.0, 30.0, 0.0)
   > 10.0 * HL.sky_brightness(30.0, -30.0, 120.0, 0.25), "a full Moon floods the night sky")
ok(HL.sky_brightness(30.0, -30.0, 120.0, 0.25, -5.0, 30.0, 0.0)
   == HL.sky_brightness(30.0, -30.0, 120.0, 0.25), "a Moon below the horizon adds nothing")
ext = [HL.extinction_mag(a, parts) for a in (90.0, 30.0, 10.0, 5.0, 2.0, 0.5)]
ok(all(x < y for x, y in zip(ext, ext[1:])), "extinction grows toward the horizon")
ok(abs(ext[0] - 0.25) < 0.01, "extinction at the zenith is the coefficient")
ok(abs(HL.threshold_magnitude(1499.999) - HL.threshold_magnitude(1500.001)) < 0.1,
   "the day and night branches of the threshold meet within 0.1 mag")

# 2. One instant.
v = HL.visibility(eng, "Sirius", julian_day(2025, 1, 15, 21), 30.05, 31.25)
ok(v["visible"] and v["margin"] > 5.0 and v["sun_altitude"] < -18.0, "Sirius on a January night is plainly visible")
v = HL.visibility(eng, "Sirius", julian_day(2025, 1, 15, 10), 30.05, 31.25)
ok(not v["visible"], "Sirius at midday is not")
v = HL.visibility(eng, "Sirius", julian_day(2025, 7, 1, 0), 30.05, 31.25)
ok(v["limiting_magnitude"] is None and v["margin"] is None and not v["visible"],
   "a body below the horizon has no limiting magnitude")
raises(lambda: HL.visibility(eng, "moon", julian_day(2025, 1, 15, 21), 30.0, 31.0), "visibility refuses the Moon")
raises(lambda: HL.visibility(eng, "Nibiru", julian_day(2025, 1, 15, 21), 30.0, 31.0), "visibility refuses an unknown name")

# 3. Events by the visibility model: the day is an edge.
CASES = [
    ("Sirius", "morning_first", 29.85, 31.25, julian_day(139, 1, 1, 0, 0, 0, "julian")),
    ("Sirius", "evening_last", 29.85, 31.25, julian_day(139, 1, 1, 0, 0, 0, "julian")),
    ("Regulus", "morning_first", 32.54, 44.42, julian_day(-600, 3, 1, 0, 0, 0, "julian")),
    ("venus", "evening_first", 32.54, 44.42, julian_day(2020, 1, 1)),
    ("venus", "morning_last", 32.54, 44.42, julian_day(2020, 1, 1)),
    ("mercury", "morning_first", 37.98, 23.73, julian_day(2020, 1, 1)),
    ("jupiter", "evening_last", -33.92, 18.42, julian_day(1000, 6, 1, 0, 0, 0, "julian")),
]
for target, kind, lat, lon, jd0 in CASES:
    r = HL.heliacal(eng, target, jd0, lat, lon, kind)
    tag = f"{target} {kind}"
    ok(r is not None, f"{tag}: found")
    if r is None:
        continue
    first = kind in ("morning_first", "evening_first")
    half = "morning" if kind.startswith("morning") else "evening"
    star = target not in HL.PLANETS
    day = HL.local_day(r["jd"], lon)
    here = HL._Night(eng, target, star, day, half, lat, lon).best(parts)
    beside = HL._Night(eng, target, star, day - 1 if first else day + 1, half, lat, lon).best(parts)
    ok(here is not None and here[0] > 0.0 and abs(here[0] - r["margin"]) < 1e-12, f"{tag}: visible on the day")
    ok(beside is None or beside[0] <= 0.0, f"{tag}: not visible on the day beside it")
    ok(r["jd"] >= jd0, f"{tag}: at or after the start")
    ok(r["sun_altitude"] < HL.SUN_DOWN_DEG and r["altitude"] > 0.0, f"{tag}: Sun down, body up")
    ok((r["azimuth"] < 180.0) == (half == "morning"), f"{tag}: on the right side of the sky")
    ok(r["earliest"] is not None and r["latest"] is not None
       and r["earliest"] <= r["jd"] + 1e-9 <= r["latest"] + 2e-9, f"{tag}: the window brackets the date")
    ok(r["extinction"] == 0.25 and r["spread"] == 0.05, f"{tag}: echoes its atmosphere")
    # the same instant through the exact path agrees with the sampled night
    exact = HL.visibility(eng, target, r["jd"], lat, lon)
    ok(abs(exact["margin"] - r["margin"]) < 0.05, f"{tag}: the sampled night matches the exact instant "
       f"({exact['margin']:.3f} vs {r['margin']:.3f})")
    # the implied arcus visionis reproduces the day by the geometric rule
    a = HL.heliacal(eng, target, jd0, lat, lon, kind, method="arcus",
                    arcus_visionis=r["arcus_visionis"] - 1e-6)
    ok(a is not None and HL.local_day(a["jd"], lon) == day, f"{tag}: the arcus method gives the same day back")

# 4. A clearer sky never delays a first visibility, nor hastens a last one.
for target, kind, lat, lon, jd0 in CASES[:3]:
    days = [HL.local_day(HL.heliacal(eng, target, jd0, lat, lon, kind, extinction=k)["jd"], lon)
            for k in (0.18, 0.25, 0.35)]
    if kind == "morning_first":
        ok(days[0] <= days[1] <= days[2], f"{target} {kind}: later under haze {days}")
    else:
        ok(days[0] >= days[1] >= days[2], f"{target} {kind}: earlier under haze {days}")

# 5. Sirius at Memphis in 139 CE: Censorinus puts the rising in the third week
#    of July; the model's date, in the Julian calendar, is 19 July.
r = HL.heliacal(eng, "Sirius", julian_day(139, 1, 1, 0, 0, 0, "julian"), 29.85, 31.25)
d = calendar_date(r["jd"], "julian")
ok((d["year"], d["month"], d["day"]) == (139, 7, 19), f"Sirius rises heliacally on 19 July 139 (got {d})")
ok(8.0 < r["arcus_visionis"] < 11.0, f"its implied arcus visionis is {r['arcus_visionis']:.1f} degrees")
ok(2.0 < r["altitude"] < 7.0 and -9.0 < r["sun_altitude"] < -4.0, "it is first seen low, in bright twilight")

# 6. The arcus method.
jd0 = julian_day(2020, 1, 1)
a = HL.heliacal(eng, "jupiter", jd0, 32.54, 44.42, "acronychal_rising", method="arcus", arcus_visionis=7.0)
c = HL.heliacal(eng, "jupiter", jd0, 32.54, 44.42, "cosmical_setting", method="arcus", arcus_visionis=7.0)
ok(a is not None and c is not None and a["conjunction"] == c["conjunction"], "both opposition events share the opposition")
ok(a["jd"] < a["conjunction"] < c["jd"] and c["jd"] - a["jd"] < 40.0,
   "the acronychal rising precedes opposition and the cosmical setting follows")
ok(a["sun_depression"] >= 7.0 and c["sun_depression"] >= 7.0, "the Sun is at least the arcus down on both days")
n = HL._Night(eng, "jupiter", False, HL.local_day(a["jd"], 44.42) + 1, "evening", 32.54, 44.42).horizon(True)
ok(n is not None and n[1] < 7.0, "the evening after the acronychal rising the Sun is not far enough down")
n = HL._Night(eng, "jupiter", False, HL.local_day(c["jd"], 44.42) - 1, "morning", 32.54, 44.42).horizon(False)
ok(n is not None and n[1] < 7.0, "the morning before the cosmical setting it is not either")
lo = HL.heliacal(eng, "Sirius", jd0, 29.85, 31.25, method="arcus", arcus_visionis=8.0)
hi = HL.heliacal(eng, "Sirius", jd0, 29.85, 31.25, method="arcus", arcus_visionis=11.0)
ok(lo["jd"] < hi["jd"], "a larger arcus visionis is a later rising")

# 7. The Moon.
for lat, lon in ((32.54, 44.42), (21.42, 39.83), (51.5, -0.12)):
    r = HL.heliacal(eng, "moon", julian_day(2025, 3, 1), lat, lon, "evening_first")
    tag = f"crescent at {lat},{lon}"
    ok(r is not None and r["method"] == "crescent", f"{tag}: found")
    age = r["jd"] - r["conjunction"]
    ok(0.5 < age < 3.5, f"{tag}: {age:.2f} days after conjunction")
    ok(r["q"] > HL.Q_VISIBLE and r["zone"] in ("A", "B"), f"{tag}: passes the test")
    day = HL.local_day(r["jd"], lon)
    before = HL.crescent(eng, day - 1, lat, lon)
    ok(before is None or before["q"] <= HL.Q_VISIBLE, f"{tag}: fails it the evening before")
    ok(r["latest"] is not None and r["latest"] >= r["jd"] and r["earliest"] == r["jd"],
       f"{tag}: easily visible no sooner")
    ok(r["lag_minutes"] > 20.0 and r["arcv"] > 4.0 and r["width"] > 0.0, f"{tag}: geometry is a real crescent")
    old = HL.heliacal(eng, "moon", julian_day(2025, 3, 1), lat, lon, "morning_last")
    ok(old is not None and 0.5 < old["conjunction"] - old["jd"] < 3.5, f"{tag}: the old crescent precedes conjunction")
    after = HL.crescent(eng, HL.local_day(old["jd"], lon) + 1, lat, lon, "morning")
    ok(after is None or after["q"] <= HL.Q_VISIBLE, f"{tag}: and is gone the next morning")
zones = [HL.crescent(eng, HL.local_day(julian_day(2025, 3, 29, 12), 39.83) + i, 21.42, 39.83) for i in range(3)]
ok(zones[0]["zone"] == "F" and zones[1]["zone"] == "A", "29 March 2025 at Mecca is below the limit, 30 March easy")
ok(zones[0]["q"] < zones[1]["q"] < zones[2]["q"], "q grows with the Moon's age")

# 8. What each target has.
raises(lambda: HL.heliacal(eng, "moon", jd0, 30.0, 31.0, "morning_first"), "the Moon has no morning first")
raises(lambda: HL.heliacal(eng, "jupiter", jd0, 30.0, 31.0, "evening_first"), "Jupiter has no evening first")
raises(lambda: HL.heliacal(eng, "venus", jd0, 30.0, 31.0, "cosmical_setting", method="arcus", arcus_visionis=6.0),
       "Venus has no opposition")
raises(lambda: HL.heliacal(eng, "Sirius", jd0, 30.0, 31.0, "acronychal_rising"),
       "the opposition events need the arcus method")
raises(lambda: HL.heliacal(eng, "Sirius", jd0, 30.0, 31.0, method="arcus"), "the arcus method needs its angle")
raises(lambda: HL.heliacal(eng, "Sirius", jd0, 30.0, 31.0, "noon_first"), "an unknown kind is refused")
raises(lambda: HL.heliacal(eng, "Sirius", jd0, 30.0, 31.0, method="guess"), "an unknown method is refused")
same = HL.heliacal(eng, "Sirius", jd0, 29.85, 31.25, "heliacal_rising")
ok(same["kind"] == "morning_first", "heliacal_rising is morning_first")
ok(HL.heliacal(eng, "Polaris", jd0, 51.5, -0.12) is None, "a star that never sets has no heliacal rising")

# 9. span and kinds_for.
r0 = HL.heliacal(eng, "Sirius", julian_day(139, 1, 1, 0, 0, 0, "julian"), 29.85, 31.25)
ok(HL.heliacal(eng, "Sirius", julian_day(139, 1, 1, 0, 0, 0, "julian"), 29.85, 31.25, span=120.0) is None,
   "an event past the span is not returned")
ok(HL.heliacal(eng, "Sirius", julian_day(139, 1, 1, 0, 0, 0, "julian"), 29.85, 31.25, span=220.0) == r0,
   "an event inside the span is the same event")
raises(lambda: HL.heliacal(eng, "Sirius", jd0, 30.0, 31.0, span=0.0), "a span must be positive")
ok(HL.kinds_for(eng, "Sirius") == ["morning_first", "evening_last"], "a star has a rising and a setting")
ok(len(HL.kinds_for(eng, "mercury")) == 4 and HL.kinds_for(eng, "moon") == ["evening_first", "morning_last"],
   "Mercury has four events and the Moon two")
ok("cosmical_setting" in HL.kinds_for(eng, "saturn", "arcus") and HL.kinds_for(eng, "moon", "arcus") == [],
   "the arcus method adds the opposition events and has none for the Moon")
for target in ("Sirius", "venus", "moon", "jupiter"):
    for method in HL.METHODS:
        for kind in HL.KINDS:
            try:
                HL._check(eng, target, kind, method)
                allowed = True
            except ValueError:
                allowed = False
            ok(allowed == (kind in HL.kinds_for(eng, target, method)),
               f"kinds_for agrees with heliacal on {target} {kind} {method}")
raises(lambda: HL.kinds_for(eng, "Nibiru"), "an unknown target has no kinds")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
