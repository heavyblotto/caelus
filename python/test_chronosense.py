#!/usr/bin/env python3
"""Self-check for astroengine.chronosense (FACT-002 temporal middleware,
citation auditor, photoperiod phase vector, and stratified memory compaction).

Covers:
- Global cities: NYC, Oslo (winter & summer), Tromso (polar day & night),
  Svalbard (deep polar night), Tokyo, Sydney
- Exact clock_id parity with canonical_digest(canonical_chart(engine.chart_at))
- Explicit local solar-midnight night_crossed (including UTC-vs-local traps)
- All 5 twilight classes, 3 sun_trend states, 4 deadline states, 4 wavefront
  quadrants, and polar day_slot safety
- Header grammar, zero astrological/zodiac words, zero colliding minute labels,
  optional field omission, and <= 55 token budget
- All audit_chronosense_cursor drift flags, circular moon_lon_deg wrap, and
  deterministic corrective prompts
- 10-D photoperiod_vector unit norm, cosine symmetry, Oslo winter solstice
  alignment, NYC/Tokyo travel alignment, nocturnal arc progression, and
  unsupervised phase_stratum_key partitioning
- stratified_select balance, recency/score support, remainder fill, shuffle
  invariance, and input immutability
- < 2 ms runtime budgets for chronosense middleware primitives

Run: python3 python/test_chronosense.py
"""
import math
import os
import random
import re
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import (
    Engine,
    audit_chronosense_cursor,
    chronosense_envelope,
    phase_cosine_similarity,
    phase_stratum_key,
    photoperiod_vector,
    stratified_select,
)
from astroengine.canonical import canonical_chart, canonical_digest
from astroengine.core import julian_day
from astroengine.observe import scene_geometry

eng = Engine("embedded")

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def raises(fn, exc_type, msg):
    global checks, fails
    checks += 1
    try:
        fn()
    except exc_type:
        return
    except Exception as e:
        fails += 1
        print(f"FAIL {msg} (raised {type(e).__name__}: {e}, expected {exc_type.__name__})")
        return
    fails += 1
    print(f"FAIL {msg} (did not raise {exc_type.__name__})")


def assert_all_finite(obj, path="root"):
    if isinstance(obj, float):
        ok(math.isfinite(obj), f"{path} is finite ({obj})")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            assert_all_finite(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            assert_all_finite(v, f"{path}[{idx}]")


FORBIDDEN_ASTRO_WORDS = (
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
    "zodiac", "horoscope", "ascendant", "midheaven", "retrograde",
    "trine", "sextile", "conjunction", "opposition", "cazimi", "combust",
    "chaldean", "planetary", "ruler", "house",
)


def check_header_hygiene(header, label):
    ok(header.startswith("[CAELUS-CHRONO ") and header.endswith("]"),
       f"{label}: header bracketed properly: {header}")
    low = header.lower()
    for word in FORBIDDEN_ASTRO_WORDS:
        ok(re.search(rf"\b{word}\b", low) is None,
           f"{label}: zero astro word '{word}' in header")
    ok("night_crossed=true" in header or "night_crossed=false" in header,
       f"{label}: explicit night_crossed=true|false in header")
    # Token budget: approximate BPE token count (chars / 4) <= 55 and whitespace <= 15
    approx_tokens = len(header) / 4.0
    ok(approx_tokens <= 55.0,
       f"{label}: header <= 55 approx tokens ({approx_tokens:.1f}, len={len(header)})")
    ok(len(header.split()) <= 15,
       f"{label}: header <= 15 whitespace tokens ({len(header.split())})")


# ============================================================================
# 1. Core envelope invariants across global cities & seasons
# ============================================================================
jd_nyc = julian_day(2026, 11, 22, 14, 30, 0)
env_nyc = chronosense_envelope(
    eng,
    jd_nyc,
    40.7128,
    -74.0060,
    turn=14,
    prev_jd_ut=jd_nyc - 852.0 / 1440.0,
    deadline_jd_ut=jd_nyc + 42.0 / 1440.0,
    deadline_label="noon_cutoff",
    genesis_digest="0123456789abcdef",
)
assert_all_finite(env_nyc, "env_nyc")
check_header_hygiene(env_nyc["header"], "env_nyc")

# Exact clock_id parity with canonical_digest(canonical_chart(chart_at))
ref_digest = canonical_digest(canonical_chart(eng.chart_at(jd_nyc, 40.7128, -74.0060)))
ok(env_nyc["chart_digest"] == ref_digest, "env_nyc chart_digest exact match")
ok(env_nyc["clock_id"] == ref_digest[:8], "env_nyc clock_id == 8-char prefix")
ok(len(env_nyc["clock_id"]) == 8 and all(c in "0123456789abcdef" for c in env_nyc["clock_id"]),
   "clock_id is 8 lowercase hex chars")
ok(env_nyc["genesis_digest"] == "0123456789abcdef", "genesis_digest preserved")
ok(env_nyc["turn"] == 14, "turn preserved")
ok(env_nyc["utc_iso"] == "2026-11-22T14:30Z", f"utc_iso exact ({env_nyc['utc_iso']})")
ok(env_nyc["twilight"] == "daylight", f"NYC 14:30Z is daylight ({env_nyc['twilight']})")
ok(env_nyc["sun_trend"] == "rising", f"NYC 14:30Z is rising ({env_nyc['sun_trend']})")
ok(isinstance(env_nyc["day_slot"], int) and 1 <= env_nyc["day_slot"] <= 12,
   f"NYC day_slot in 1..12 ({env_nyc['day_slot']})")
ok(env_nyc["night_crossed"] is True, "NYC 852m span across local midnight crossed night")
ok(env_nyc["deadline_state"] == "applying", "42m future deadline is applying")
ok(abs(env_nyc["deadline_eta_min"] - 42.0) < 1e-6, "deadline_eta_min == 42.0")
ok(abs(env_nyc["dt_prev_min"] - 852.0) < 1e-6, "dt_prev_min == 852.0")
ok(0.0 <= env_nyc["moon_lon_deg"] < 360.0, "moon_lon_deg in [0, 360)")
ok(0.0 <= env_nyc["moon_illum_pct"] <= 100.0, "moon_illum_pct in [0, 100]")
ok("deadline=noon_cutoff(applying_42m)" in env_nyc["header"], "separated deadline token in header")
ok("dt_prev=+852m" in env_nyc["header"], "dt_prev token in header")
ok("next_sky=sunset(in_" in env_nyc["header"], "separated next_sky(in_Nm) token in header")

# Optional deadline and dt_prev omitted cleanly when None
env_minimal = chronosense_envelope(eng, jd_nyc, 40.7128, -74.0060)
check_header_hygiene(env_minimal["header"], "env_minimal")
ok(env_minimal["deadline_state"] == "none", "minimal deadline_state == none")
ok(env_minimal["deadline_label"] is None and env_minimal["deadline_eta_min"] is None,
   "minimal deadline fields None")
ok(env_minimal["dt_prev_min"] is None, "minimal dt_prev_min None")
ok(env_minimal["night_crossed"] is False, "minimal night_crossed False")
ok("deadline=" not in env_minimal["header"], "deadline omitted from header when None")
ok("dt_prev=" not in env_minimal["header"], "dt_prev omitted from header when None")
ok("night_crossed=false" in env_minimal["header"], "night_crossed=false always explicit")

# Label sanitization
env_lbl = chronosense_envelope(
    eng, jd_nyc, 40.7128, -74.0060,
    deadline_jd_ut=jd_nyc + 10.0 / 1440.0,
    deadline_label="  ship [v2](now)=ok  ",
)
ok(env_lbl["deadline_label"] == "ship_v2nowok", f"label sanitized ({env_lbl['deadline_label']})")
ok("deadline=ship_v2nowok(applying_10m)" in env_lbl["header"], "sanitized label in header")

# ============================================================================
# 2. Oslo winter & summer, Tromso polar day/night, Svalbard, Tokyo, Sydney
# ============================================================================
# Oslo winter solstice noon (59.91N, Dec 21 -> ~6.8 deg max sun alt, ~5.9h daylight)
jd_oslo_win = julian_day(2026, 12, 21, 11, 20, 0)
env_oslo_win = chronosense_envelope(
    eng, jd_oslo_win, 59.9139, 10.7522,
    turn=3, prev_jd_ut=julian_day(2026, 12, 20, 19, 0, 0),
    deadline_jd_ut=jd_oslo_win + 180.0 / 1440.0, deadline_label="sunset_cutoff",
)
assert_all_finite(env_oslo_win, "oslo_win")
check_header_hygiene(env_oslo_win["header"], "oslo_win")
ok(env_oslo_win["twilight"] == "daylight", "Oslo winter noon is daylight")
ok(5.0 < env_oslo_win["sun_alt_deg"] < 8.0, f"Oslo winter noon sun alt ~6.8 deg ({env_oslo_win['sun_alt_deg']:.2f})")
ok(env_oslo_win["sun_trend"] == "culminating", f"Oslo winter noon culminating ({env_oslo_win['sun_trend']})")
ok(env_oslo_win["wavefront_quadrant"] == "execute", "Oslo winter noon quadrant is execute")
ok(isinstance(env_oslo_win["day_slot"], int) and 1 <= env_oslo_win["day_slot"] <= 12,
   "Oslo winter noon has integer slot 1..12")

# Oslo summer solstice midnight twilight (59.91N, Jun 21 -> never reaches astro night)
jd_oslo_sum_mid = julian_day(2026, 6, 21, 22, 30, 0)
env_oslo_sum = chronosense_envelope(
    eng, jd_oslo_sum_mid, 59.9139, 10.7522,
    turn=5, prev_jd_ut=julian_day(2026, 6, 21, 20, 0, 0),
)
assert_all_finite(env_oslo_sum, "oslo_sum")
check_header_hygiene(env_oslo_sum["header"], "oslo_sum")
ok(env_oslo_sum["twilight"] in ("civil", "nautical"),
   f"Oslo summer near-midnight is twilight ({env_oslo_sum['twilight']})")
ok(isinstance(env_oslo_sum["day_slot"], int) and 1 <= env_oslo_sum["day_slot"] <= 12,
   f"Oslo summer night slot normalized to 1..12 ({env_oslo_sum['day_slot']})")

# Tromso polar day (69.65N, Jun 21)
jd_tromso_day = julian_day(2026, 6, 21, 12, 0, 0)
env_tromso_day = chronosense_envelope(eng, jd_tromso_day, 69.6492, 18.9553, turn=1)
assert_all_finite(env_tromso_day, "tromso_day")
check_header_hygiene(env_tromso_day["header"], "tromso_day")
ok(env_tromso_day["day_slot"] == "polar_day", f"Tromso Jun 21 slot is polar_day ({env_tromso_day['day_slot']})")
ok("slot=polar_day" in env_tromso_day["header"], "header renders slot=polar_day cleanly")
ok(env_tromso_day["horizon_event"] is None and env_tromso_day["horizon_eta_min"] is None,
   "Tromso Jun 21 has no twilight crossing")
ok("next_sky=polar" in env_tromso_day["header"], "header renders next_sky=polar")
ok(env_tromso_day["wavefront_quadrant"] == "execute", "Tromso polar noon quadrant is execute")

# Tromso polar day midnight sun (low-sun nadir -> consolidate!)
jd_tromso_nadir = julian_day(2026, 6, 21, 23, 0, 0)
env_tromso_nadir = chronosense_envelope(eng, jd_tromso_nadir, 69.6492, 18.9553, turn=2)
ok(env_tromso_nadir["day_slot"] == "polar_day", "Tromso midnight sun is polar_day")
ok(env_tromso_nadir["sun_alt_deg"] > 0.0, "Tromso midnight sun above horizon")
ok(env_tromso_nadir["wavefront_quadrant"] == "consolidate",
   f"Tromso midnight sun nadir rotates to consolidate ({env_tromso_nadir['wavefront_quadrant']})")

# Tromso polar night (69.65N, Dec 21)
jd_tromso_night = julian_day(2026, 12, 21, 11, 0, 0)
env_tromso_night = chronosense_envelope(
    eng, jd_tromso_night, 69.6492, 18.9553,
    turn=2, prev_jd_ut=julian_day(2026, 12, 20, 20, 0, 0),
)
assert_all_finite(env_tromso_night, "tromso_night")
check_header_hygiene(env_tromso_night["header"], "tromso_night")
ok(env_tromso_night["day_slot"] == "polar_night",
   f"Tromso Dec 21 slot is polar_night ({env_tromso_night['day_slot']})")
ok("slot=polar_night" in env_tromso_night["header"], "header renders slot=polar_night cleanly")
ok(env_tromso_night["night_crossed"] is True, "Tromso polar night still tracks solar midnight crossing")

# Svalbard deep polar night (78.22N, Dec 21)
env_sval = chronosense_envelope(eng, julian_day(2026, 12, 21, 0, 0, 0), 78.2232, 15.6267)
ok(env_sval["day_slot"] == "polar_night", "Svalbard deep winter slot is polar_night")
ok(env_sval["twilight"] == "night", f"Svalbard winter midnight is night ({env_sval['twilight']})")
ok(env_sval["wavefront_quadrant"] == "consolidate", "Svalbard polar night quadrant is consolidate")

# Tokyo morning with exact due deadline & UTC-midnight non-crossing trap
# 2026-03-20 23:00Z = 08:00 JST; 2026-03-21 01:00Z = 10:00 JST (UTC date changed, local night NOT crossed!)
jd_tok_prev = julian_day(2026, 3, 20, 23, 0, 0)
jd_tok_now = julian_day(2026, 3, 21, 1, 0, 0)
env_tok = chronosense_envelope(
    eng, jd_tok_now, 35.6762, 139.6503,
    turn=7, prev_jd_ut=jd_tok_prev,
    deadline_jd_ut=jd_tok_now + 0.3 / 1440.0, deadline_label="market_open",
)
assert_all_finite(env_tok, "tokyo")
check_header_hygiene(env_tok["header"], "tokyo")
ok(env_tok["night_crossed"] is False,
   "Tokyo 23:00Z->01:00Z crosses UTC midnight but NOT local solar midnight")
ok(env_tok["deadline_state"] == "due", "0.3m deadline is due")
ok("deadline=market_open(due)" in env_tok["header"], "header renders due state cleanly")

# Inverse UTC-vs-local trap in NYC: 03:00Z -> 07:00Z on same UTC date DOES cross NYC solar midnight (~05:00Z)
env_nyc_mid = chronosense_envelope(
    eng, julian_day(2026, 11, 22, 7, 0, 0), 40.7128, -74.0060,
    prev_jd_ut=julian_day(2026, 11, 22, 3, 0, 0),
)
ok(env_nyc_mid["night_crossed"] is True,
   "NYC 03:00Z->07:00Z (same UTC date) DOES cross local solar midnight")

# Sydney Southern Hemisphere summer afternoon with overdue deadline
jd_syd = julian_day(2026, 1, 15, 4, 0, 0)
env_syd = chronosense_envelope(
    eng, jd_syd, -33.8688, 151.2093,
    turn=9, deadline_jd_ut=jd_syd - 20.0 / 1440.0, deadline_label="deploy",
)
assert_all_finite(env_syd, "sydney")
check_header_hygiene(env_syd["header"], "sydney")
ok(env_syd["twilight"] == "daylight" and env_syd["sun_alt_deg"] > 50.0,
   "Sydney Jan afternoon has high summer Sun")
ok(env_syd["deadline_state"] == "overdue", "20m past deadline is overdue")
ok("deadline=deploy(overdue_20m)" in env_syd["header"], "header renders overdue state cleanly")

# Verify all 5 twilight classes and all 4 wavefront quadrants appear over a full NYC equinox day
seen_twilight = set()
seen_quads = set()
seen_trends = set()
seen_slots = set()
jd_eq0 = julian_day(2026, 3, 20, 0, 0, 0)
for step in range(96):  # every 15 min across 24h
    e = chronosense_envelope(eng, jd_eq0 + step * 15.0 / 1440.0, 40.7128, -74.0060)
    seen_twilight.add(e["twilight"])
    seen_quads.add(e["wavefront_quadrant"])
    seen_trends.add(e["sun_trend"])
    seen_slots.add(e["day_slot"])
    if e["wavefront_quadrant"] == "consolidate":
        ok(e["sun_alt_deg"] < -6.0, "EXP-009 nocturnal safety: consolidate only below -6 deg")
    else:
        ok(e["sun_alt_deg"] >= -6.0, "EXP-009 daylight alignment: interactive only >= -6 deg")

ok(seen_twilight == {"daylight", "civil", "nautical", "astronomical", "night"},
   f"all 5 twilight classes covered ({seen_twilight})")
ok(seen_quads == {"initiate", "execute", "review", "consolidate"},
   f"all 4 wavefront quadrants covered ({seen_quads})")
ok(seen_trends.issuperset({"rising", "setting"}), f"rising & setting covered ({seen_trends})")
ok(all(isinstance(s, int) and 1 <= s <= 12 for s in seen_slots) and len(seen_slots) == 12,
   f"all 12 diurnal/nocturnal slots covered ({sorted(seen_slots)})")


# ============================================================================
# 3. audit_chronosense_cursor: pass + every drift flag
# ============================================================================
clean_cursor = {
    "clock_id": env_nyc["clock_id"],
    "turn": env_nyc["turn"],
    "night_crossed_ack": True,
    "deadline_eta_min": 42.5,  # within default 5.0m tolerance
    "cited_facts": {
        "sun_alt_deg": round(env_nyc["sun_alt_deg"], 1),
        "moon_illum_pct": round(env_nyc["moon_illum_pct"], 1),
        "horizon_eta_min": round(env_nyc["horizon_eta_min"], 1),
        "twilight": env_nyc["twilight"],
        "wavefront_quadrant": env_nyc["wavefront_quadrant"],
    },
}
res_clean = audit_chronosense_cursor(env_nyc, clean_cursor)
ok(res_clean["ok"] is True, f"clean cursor passes ({res_clean})")
ok(res_clean["drift_flags"] == [], "clean cursor has zero drift_flags")
ok(res_clean["corrective_prompt"] is None, "clean cursor corrective_prompt is None")

# clock_id_mismatch
c_bad_clock = dict(clean_cursor, clock_id="deadbeef")
r = audit_chronosense_cursor(env_nyc, c_bad_clock)
ok(r["ok"] is False and r["drift_flags"] == ["clock_id_mismatch"], f"clock_id_mismatch ({r})")
ok(r["corrective_prompt"] is not None and env_nyc["clock_id"] in r["corrective_prompt"],
   "corrective_prompt quotes authoritative clock_id")

# turn_mismatch (stale turn and bool turn)
r_turn = audit_chronosense_cursor(env_nyc, dict(clean_cursor, turn=13))
ok(r_turn["ok"] is False and r_turn["drift_flags"] == ["turn_mismatch"], f"turn_mismatch ({r_turn})")
r_bool = audit_chronosense_cursor(env_minimal, {"clock_id": env_minimal["clock_id"], "turn": True})
ok("turn_mismatch" in r_bool["drift_flags"], "bool True rejected as turn=1")

# night_crossed_unacked
c_unacked = dict(clean_cursor, night_crossed_ack=False)
r_nc = audit_chronosense_cursor(env_nyc, c_unacked)
ok(r_nc["ok"] is False and r_nc["drift_flags"] == ["night_crossed_unacked"],
   f"night_crossed_unacked ({r_nc})")

# When night_crossed is False, omitting night_crossed_ack passes cleanly
r_min_ok = audit_chronosense_cursor(env_minimal, {"clock_id": env_minimal["clock_id"], "turn": 1})
ok(r_min_ok["ok"] is True, f"night_crossed=False does not require ack ({r_min_ok})")

# deadline_drift: off by > 5m, missing when active, hallucinated when none
r_dl_far = audit_chronosense_cursor(env_nyc, dict(clean_cursor, deadline_eta_min=10.0))
ok(r_dl_far["ok"] is False and r_dl_far["drift_flags"] == ["deadline_drift"],
   f"deadline_drift when off by 32m ({r_dl_far})")
c_dl_missing = dict(clean_cursor)
del c_dl_missing["deadline_eta_min"]
r_dl_miss = audit_chronosense_cursor(env_nyc, c_dl_missing)
ok("deadline_drift" in r_dl_miss["drift_flags"], "missing deadline_eta_min triggers deadline_drift")
r_dl_halluc = audit_chronosense_cursor(
    env_minimal,
    {"clock_id": env_minimal["clock_id"], "turn": 1, "deadline_eta_min": 30.0},
)
ok("deadline_drift" in r_dl_halluc["drift_flags"],
   "hallucinated deadline_eta_min when deadline_state==none triggers deadline_drift")

# cited_facts: numeric mismatch, discrete mismatch, unknown_fact, polar None mismatch
c_facts_bad = dict(
    clean_cursor,
    cited_facts={
        "sun_alt_deg": env_nyc["sun_alt_deg"] + 3.0,
        "twilight": "night",
        "astro_sign": "Aries",
    },
)
r_facts = audit_chronosense_cursor(env_nyc, c_facts_bad)
ok(r_facts["ok"] is False, "bad cited_facts fails audit")
ok(r_facts["drift_flags"] == [
    "unknown_fact:astro_sign",
    "fact_mismatch:sun_alt_deg",
    "fact_mismatch:twilight",
], f"deterministic sorted fact flags ({r_facts['drift_flags']})")

# Circular moon_lon_deg wrap across 0/360
env_wrap = dict(env_minimal, moon_lon_deg=359.85)
r_wrap_ok = audit_chronosense_cursor(
    env_wrap,
    {"clock_id": env_wrap["clock_id"], "turn": 1, "cited_facts": {"moon_lon_deg": 0.1}},
)
ok(r_wrap_ok["ok"] is True, f"circular moon_lon_deg wrap within 0.5 deg passes ({r_wrap_ok})")
r_wrap_bad = audit_chronosense_cursor(
    env_wrap,
    {"clock_id": env_wrap["clock_id"], "turn": 1, "cited_facts": {"moon_lon_deg": 1.0}},
)
ok(r_wrap_bad["drift_flags"] == ["fact_mismatch:moon_lon_deg"],
   f"circular moon_lon_deg wrap outside 0.5 deg fails ({r_wrap_bad})")

# Polar None horizon_eta_min cited as numeric fails, cited as None passes
r_polar_ok = audit_chronosense_cursor(
    env_tromso_day,
    {"clock_id": env_tromso_day["clock_id"], "turn": 1, "cited_facts": {"horizon_eta_min": None}},
)
ok(r_polar_ok["ok"] is True, "polar horizon_eta_min=None matches None")
r_polar_bad = audit_chronosense_cursor(
    env_tromso_day,
    {"clock_id": env_tromso_day["clock_id"], "turn": 1, "cited_facts": {"horizon_eta_min": 60.0}},
)
ok(r_polar_bad["drift_flags"] == ["fact_mismatch:horizon_eta_min"],
   "hallucinated numeric horizon_eta_min during polar day fails")

# Multi-failure combined audit & non-dict cursor
r_multi = audit_chronosense_cursor(env_nyc, "not-a-dict")
ok(r_multi["ok"] is False and len(r_multi["drift_flags"]) == 4,
   f"non-dict cursor safely produces all 4 structural flags ({r_multi['drift_flags']})")


# ============================================================================
# 4. photoperiod_vector, phase_stratum_key, phase_cosine_similarity
# ============================================================================
sc_oslo_win_noon = scene_geometry(eng, julian_day(2026, 12, 21, 11, 20, 0), 59.9139, 10.7522)
sc_oslo_eq_noon = scene_geometry(eng, julian_day(2026, 9, 22, 11, 10, 0), 59.9139, 10.7522)
sc_oslo_win_mid = scene_geometry(eng, julian_day(2026, 12, 21, 23, 20, 0), 59.9139, 10.7522)
sc_nyc_noon = scene_geometry(eng, julian_day(2026, 9, 22, 16, 50, 0), 40.7128, -74.0060)
sc_tok_noon = scene_geometry(eng, julian_day(2026, 9, 22, 2, 35, 0), 35.6762, 139.6503)
sc_tromso_day = scene_geometry(eng, jd_tromso_day, 69.6492, 18.9553)
sc_tromso_night = scene_geometry(eng, jd_tromso_night, 69.6492, 18.9553)

all_scenes = [
    ("oslo_win_noon", sc_oslo_win_noon),
    ("oslo_eq_noon", sc_oslo_eq_noon),
    ("oslo_win_mid", sc_oslo_win_mid),
    ("nyc_noon", sc_nyc_noon),
    ("tok_noon", sc_tok_noon),
    ("tromso_day", sc_tromso_day),
    ("tromso_night", sc_tromso_night),
]
vecs = {}
for name, sc in all_scenes:
    v = photoperiod_vector(sc)
    vecs[name] = v
    ok(len(v) == 10, f"{name} photoperiod_vector len == 10")
    ok(all(math.isfinite(x) for x in v), f"{name} photoperiod_vector all finite")
    nrm = math.sqrt(sum(x * x for x in v))
    ok(abs(nrm - 1.0) < 1e-12, f"{name} photoperiod_vector unit norm ({nrm})")
    ok(abs(phase_cosine_similarity(v, v) - 1.0) < 1e-12, f"{name} self cosine == 1.0")

# Symmetry
cos_ab = phase_cosine_similarity(vecs["oslo_win_noon"], vecs["oslo_eq_noon"])
cos_ba = phase_cosine_similarity(vecs["oslo_eq_noon"], vecs["oslo_win_noon"])
ok(abs(cos_ab - cos_ba) < 1e-15, "cosine similarity is symmetric")

# EXP-002 high-latitude winter alignment vs midnight opposition
cos_win_mid = phase_cosine_similarity(vecs["oslo_win_noon"], vecs["oslo_win_mid"])
ok(cos_ab > 0.85, f"Oslo winter noon aligns with Oslo equinox noon ({cos_ab:.4f})")
ok(cos_win_mid < -0.5, f"Oslo winter noon opposes Oslo winter midnight ({cos_win_mid:.4f})")
ok(cos_ab > cos_win_mid + 1.0, "strong day/night phase separation at 59.9N winter")

# Travel invariance: NYC noon vs Tokyo noon (14h UTC shift!)
cos_travel = phase_cosine_similarity(vecs["nyc_noon"], vecs["tok_noon"])
ok(cos_travel > 0.90, f"NYC noon aligns with Tokyo noon despite 14h UTC shift ({cos_travel:.4f})")

# Nocturnal arc progression (early night vs pre-dawn are distinct, fixing night-hour clamp)
sc_nyc_early_night = scene_geometry(eng, julian_day(2026, 3, 21, 1, 0, 0), 40.7128, -74.0060)
sc_nyc_predawn = scene_geometry(eng, julian_day(2026, 3, 21, 9, 0, 0), 40.7128, -74.0060)
cos_night_prog = phase_cosine_similarity(
    photoperiod_vector(sc_nyc_early_night),
    photoperiod_vector(sc_nyc_predawn),
)
ok(cos_night_prog < 0.75,
   f"early night vs pre-dawn are distinct in nocturnal arc ({cos_night_prog:.4f})")

# phase_stratum_key checks
ok(phase_stratum_key(sc_oslo_win_noon, 10.7522) == "day:dec_sol:lon3",
   f"Oslo winter noon stratum ({phase_stratum_key(sc_oslo_win_noon, 10.7522)})")
ok(phase_stratum_key(sc_oslo_win_mid, 10.7522) == "night:dec_sol:lon3",
   f"Oslo winter midnight stratum ({phase_stratum_key(sc_oslo_win_mid, 10.7522)})")
ok(phase_stratum_key(sc_nyc_noon, -74.0060) == "day:sep_eq:lon1",
   f"NYC equinox noon stratum ({phase_stratum_key(sc_nyc_noon, -74.0060)})")
ok(phase_stratum_key(sc_tok_noon, 139.6503) == "day:sep_eq:lon5",
   f"Tokyo equinox noon stratum ({phase_stratum_key(sc_tok_noon, 139.6503)})")
ok(phase_stratum_key(sc_tromso_night, 18.9553) == "twilight:dec_sol:lon3",
   f"Tromso polar noon civil twilight stratum ({phase_stratum_key(sc_tromso_night, 18.9553)})")
ok(phase_stratum_key(sc_nyc_noon) == phase_stratum_key(sc_nyc_noon, -74.0060),
   "phase_stratum_key defaults lon_east to scene['lon_east']")
ok(phase_stratum_key(sc_nyc_noon, -180.0) == phase_stratum_key(sc_nyc_noon, 180.0),
   "phase_stratum_key wraps cleanly across antimeridian")


# ============================================================================
# 5. stratified_select: balance, recency, remainder fill, determinism
# ============================================================================
# Dominant daytime stream (100 high-score entries) vs rare twilight/night/travel (5 each)
entries = []
for i in range(100):
    entries.append({"id": f"day-{i:03d}", "stratum": "day:jun_sol:lon3", "score": 100.0 + i})
for i in range(5):
    entries.append({"id": f"twi-{i:02d}", "stratum": "twilight:jun_sol:lon3", "score": 10.0 + i})
    entries.append({"id": f"ngt-{i:02d}", "stratum": "night:jun_sol:lon3", "score": 20.0 + i})
    entries.append({"id": f"tok-{i:02d}", "stratum": "day:jun_sol:lon5", "score": 30.0 + i})

snapshot_before = [dict(e) for e in entries]
picked20 = stratified_select(entries, 20)
ok(entries == snapshot_before, "stratified_select does not mutate input")
ok(len(picked20) == 20, f"stratified_select honors exact budget ({len(picked20)})")

counts = {}
for item in picked20:
    counts[item["stratum"]] = counts.get(item["stratum"], 0) + 1
ok(counts == {
    "day:jun_sol:lon3": 5,
    "twilight:jun_sol:lon3": 5,
    "night:jun_sol:lon3": 5,
    "day:jun_sol:lon5": 5,
}, f"perfectly balanced 5/5/5/5 retention across all 4 strata ({counts})")

# Top exemplars picked from dominant stratum (day-099..day-095)
day_ids = [item["id"] for item in picked20 if item["stratum"] == "day:jun_sol:lon3"]
ok(day_ids == ["day-099", "day-098", "day-097", "day-096", "day-095"],
   f"highest-scoring daytime exemplars retained ({day_ids})")

# Remainder fill when rare strata exhaust (budget=30 -> 5+5+5 + 15 day = 30)
picked30 = stratified_select(entries, 30)
ok(len(picked30) == 30, "remainder fill uses full budget when rare strata exhaust")
day_count_30 = sum(1 for item in picked30 if item["stratum"] == "day:jun_sol:lon3")
ok(day_count_30 == 15, f"dominant stratum receives remaining 15 slots ({day_count_30})")

# Shuffle invariance (deterministic regardless of input order)
rng = random.Random(20261122)
shuffled = list(entries)
rng.shuffle(shuffled)
ok(stratified_select(shuffled, 20) == picked20, "stratified_select is invariant to input order")

# Supports "recency" key when "score" absent
rec_entries = [
    {"id": "a1", "stratum": "s1", "recency": 1},
    {"id": "a2", "stratum": "s1", "recency": 9},
    {"id": "b1", "stratum": "s2", "recency": 5},
    {"id": "b2", "stratum": "s2", "recency": 2},
]
picked_rec = stratified_select(rec_entries, 2)
ok([x["id"] for x in picked_rec] == ["a2", "b1"],
   f"recency key supported cleanly ({[x['id'] for x in picked_rec]})")

# Budget edge cases
ok(stratified_select(entries, 0) == [], "budget=0 returns []")
ok(stratified_select([], 10) == [], "empty entries returns []")
ok(len(stratified_select(rec_entries, 10)) == 4, "budget > len(entries) keeps all")

# Budget < number of strata picks highest peak-score strata
picked2 = stratified_select(entries, 2)
ok([x["stratum"] for x in picked2] == ["day:jun_sol:lon3", "day:jun_sol:lon5"],
   f"budget < strata picks peak-score strata ({[x['stratum'] for x in picked2]})")


# ============================================================================
# 6. Validation errors
# ============================================================================
raises(lambda: chronosense_envelope(eng, float("nan"), 40.0, -74.0), ValueError, "NaN jd_ut rejected")
raises(lambda: chronosense_envelope(eng, jd_nyc, 40.0, -74.0, turn=0), ValueError, "turn=0 rejected")
raises(lambda: chronosense_envelope(eng, jd_nyc, 40.0, -74.0, turn=True), ValueError, "bool turn rejected")
raises(lambda: audit_chronosense_cursor(env_nyc, clean_cursor, deadline_tolerance_min=-1.0), ValueError, "negative deadline tol rejected")
raises(lambda: audit_chronosense_cursor(env_nyc, clean_cursor, fact_tolerance=-0.1), ValueError, "negative fact tol rejected")
raises(lambda: phase_cosine_similarity([1.0, 0.0], [1.0]), ValueError, "mismatched vector lengths rejected")
raises(lambda: phase_cosine_similarity([], []), ValueError, "empty vectors rejected")
raises(lambda: stratified_select(entries, -1), ValueError, "negative budget rejected")
raises(lambda: stratified_select(entries, True), ValueError, "bool budget rejected")


# ============================================================================
# 7. Runtime latency budgets (< 2 ms for pure chronosense middleware ops)
# ============================================================================
# Benchmark audit_chronosense_cursor
N_AUDIT = 500
t0 = time.perf_counter()
for _ in range(N_AUDIT):
    audit_chronosense_cursor(env_nyc, clean_cursor)
audit_ms = (time.perf_counter() - t0) / N_AUDIT * 1000.0
ok(audit_ms < 2.0, f"audit_chronosense_cursor < 2 ms ({audit_ms:.4f} ms)")

# Benchmark photoperiod_vector + phase_stratum_key + phase_cosine_similarity
N_VEC = 500
t0 = time.perf_counter()
for _ in range(N_VEC):
    va = photoperiod_vector(sc_oslo_win_noon)
    vb = photoperiod_vector(sc_nyc_noon)
    phase_stratum_key(sc_oslo_win_noon, 10.7522)
    phase_cosine_similarity(va, vb)
vec_ms = (time.perf_counter() - t0) / N_VEC * 1000.0
ok(vec_ms < 2.0, f"photoperiod_vector + stratum + cosine < 2 ms ({vec_ms:.4f} ms)")

# Benchmark stratified_select on 360 memories -> 90 budget (EXP-002 scale)
entries_360 = [
    {
        "id": f"m-{i:03d}",
        "stratum": f"{('day', 'twilight', 'night')[i % 3]}:{('mar_eq', 'jun_sol', 'sep_eq', 'dec_sol')[(i // 3) % 4]}:lon{(i // 12) % 6}",
        "score": float((i * 37) % 1000) / 10.0,
    }
    for i in range(360)
]
N_COMP = 200
t0 = time.perf_counter()
for _ in range(N_COMP):
    stratified_select(entries_360, 90)
comp_ms = (time.perf_counter() - t0) / N_COMP * 1000.0
ok(comp_ms < 2.0, f"stratified_select(360 -> 90) < 2 ms ({comp_ms:.4f} ms)")

# Measure full CPython envelope end-to-end latency (includes scene_geometry + chart_at)
t0 = time.perf_counter()
for _ in range(5):
    chronosense_envelope(eng, jd_nyc, 40.7128, -74.0060, turn=14)
env_ms = (time.perf_counter() - t0) / 5.0 * 1000.0
ok(env_ms < 500.0, f"CPython full chronosense_envelope finite & fast ({env_ms:.1f} ms)")

print(
    f"chronosense: {checks - fails}/{checks} checks passed "
    f"(audit={audit_ms:.4f}ms, vec+stratum+cos={vec_ms:.4f}ms, "
    f"stratified360={comp_ms:.4f}ms, py_envelope={env_ms:.1f}ms)"
)
if fails:
    sys.exit(1)
