#!/usr/bin/env python3
"""Regenerate packages/caelus/test/chronosense-golden.json from the Python
reference (astroengine.chronosense).

The TypeScript port (packages/caelus/src/chronosense.ts) replays these specs
in packages/caelus/test/chronosense-golden.test.ts and must match tightly
(exact strings/flags/digests and <= 1e-6 float parity).
Uses embedded ephemeris tier to match the TS engine.

Run: python3 python/export_chronosense_golden.py
"""
import json
import os
import sys

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
from astroengine.core import julian_day
from astroengine.observe import scene_geometry


def build_cases(eng):
    jd_nyc = julian_day(2026, 11, 22, 14, 30, 0)
    jd_oslo_win = julian_day(2026, 12, 21, 11, 20, 0)
    jd_oslo_win_mid = julian_day(2026, 12, 21, 23, 20, 0)
    jd_oslo_eq = julian_day(2026, 9, 22, 11, 10, 0)
    jd_oslo_sum = julian_day(2026, 6, 21, 22, 30, 0)
    jd_tromso_day = julian_day(2026, 6, 21, 12, 0, 0)
    jd_tromso_nadir = julian_day(2026, 6, 21, 23, 0, 0)
    jd_tromso_night = julian_day(2026, 12, 21, 11, 0, 0)
    jd_tok = julian_day(2026, 3, 21, 1, 0, 0)
    jd_tok_prev = julian_day(2026, 3, 20, 23, 0, 0)
    jd_syd = julian_day(2026, 1, 15, 4, 0, 0)
    jd_nyc_eq = julian_day(2026, 9, 22, 16, 50, 0)
    jd_tok_eq = julian_day(2026, 9, 22, 2, 35, 0)

    cases = []
    envs = {}

    def add_envelope(cid, jd, lat, lon, opts=None):
        opts = opts or {}
        res = chronosense_envelope(eng, jd, lat, lon, **opts)
        envs[cid] = res
        cases.append({
            "id": cid,
            "type": "envelope",
            "spec": {"jd_ut": jd, "lat": lat, "lon_east": lon, "options": opts},
            "result": res,
        })

    def add_audit(cid, env_id, cursor, opts=None):
        opts = opts or {}
        env = envs[env_id]
        res = audit_chronosense_cursor(env, cursor, **opts)
        cases.append({
            "id": cid,
            "type": "audit",
            "spec": {"envelope_id": env_id, "cursor": cursor, "options": opts},
            "result": res,
        })

    def add_phase(cid, a_spec, b_spec):
        sc_a = scene_geometry(eng, a_spec["jd_ut"], a_spec["lat"], a_spec["lon_east"])
        sc_b = scene_geometry(eng, b_spec["jd_ut"], b_spec["lat"], b_spec["lon_east"])
        vec_a = photoperiod_vector(sc_a)
        vec_b = photoperiod_vector(sc_b)
        stratum_a = phase_stratum_key(sc_a, a_spec["lon_east"])
        stratum_b = phase_stratum_key(sc_b, b_spec["lon_east"])
        cos_sim = phase_cosine_similarity(vec_a, vec_b)
        cases.append({
            "id": cid,
            "type": "phase",
            "spec": {"a": a_spec, "b": b_spec},
            "result": {
                "vector_a": vec_a,
                "vector_b": vec_b,
                "stratum_a": stratum_a,
                "stratum_b": stratum_b,
                "cosine_similarity": cos_sim,
            },
        })

    def add_select(cid, entries, budget):
        res = stratified_select(entries, budget)
        cases.append({
            "id": cid,
            "type": "stratified_select",
            "spec": {"entries": entries, "budget": budget},
            "result": res,
        })

    # --- 1. chronosense_envelope (8 cases)
    add_envelope("env-nyc-autumn-applying", jd_nyc, 40.7128, -74.0060, {
        "turn": 14,
        "prev_jd_ut": jd_nyc - 852.0 / 1440.0,
        "deadline_jd_ut": jd_nyc + 42.0 / 1440.0,
        "deadline_label": "noon_cutoff",
        "genesis_digest": "0123456789abcdef",
    })
    add_envelope("env-oslo-winter-solstice-noon", jd_oslo_win, 59.9139, 10.7522, {
        "turn": 3,
        "prev_jd_ut": julian_day(2026, 12, 20, 19, 0, 0),
        "deadline_jd_ut": jd_oslo_win + 180.0 / 1440.0,
        "deadline_label": "sunset_cutoff",
    })
    add_envelope("env-oslo-summer-midnight-twilight", jd_oslo_sum, 59.9139, 10.7522, {
        "turn": 5,
        "prev_jd_ut": julian_day(2026, 6, 21, 20, 0, 0),
    })
    add_envelope("env-tromso-polar-day-noon", jd_tromso_day, 69.6492, 18.9553, {
        "turn": 1,
    })
    add_envelope("env-tromso-polar-day-nadir", jd_tromso_nadir, 69.6492, 18.9553, {
        "turn": 2,
    })
    add_envelope("env-tromso-polar-night-civil", jd_tromso_night, 69.6492, 18.9553, {
        "turn": 2,
        "prev_jd_ut": julian_day(2026, 12, 20, 20, 0, 0),
    })
    add_envelope("env-tokyo-equinox-due-utc-trap", jd_tok, 35.6762, 139.6503, {
        "turn": 7,
        "prev_jd_ut": jd_tok_prev,
        "deadline_jd_ut": jd_tok + 0.3 / 1440.0,
        "deadline_label": "market_open",
    })
    add_envelope("env-sydney-summer-overdue-elevated", jd_syd, -33.8688, 151.2093, {
        "turn": 9,
        "elevation_m": 58.0,
        "deadline_jd_ut": jd_syd - 20.0 / 1440.0,
        "deadline_label": "deploy",
    })

    # --- 2. audit_chronosense_cursor (6 cases)
    e_nyc = envs["env-nyc-autumn-applying"]
    e_oslo = envs["env-oslo-winter-solstice-noon"]
    e_polar = envs["env-tromso-polar-day-noon"]

    add_audit("audit-clean-pass", "env-nyc-autumn-applying", {
        "clock_id": e_nyc["clock_id"],
        "turn": e_nyc["turn"],
        "night_crossed_ack": True,
        "deadline_eta_min": 42.4,
        "cited_facts": {
            "sun_alt_deg": round(e_nyc["sun_alt_deg"], 1),
            "moon_illum_pct": round(e_nyc["moon_illum_pct"], 1),
            "horizon_eta_min": round(e_nyc["horizon_eta_min"], 1),
            "twilight": e_nyc["twilight"],
            "wavefront_quadrant": e_nyc["wavefront_quadrant"],
        },
    })
    add_audit("audit-stale-clock-and-turn", "env-nyc-autumn-applying", {
        "clock_id": "deadbeef",
        "turn": 13,
        "night_crossed_ack": True,
        "deadline_eta_min": 42.0,
    })
    add_audit("audit-night-crossed-unacked", "env-oslo-winter-solstice-noon", {
        "clock_id": e_oslo["clock_id"],
        "turn": e_oslo["turn"],
        "night_crossed_ack": False,
        "deadline_eta_min": 180.0,
    })
    add_audit("audit-deadline-drift", "env-nyc-autumn-applying", {
        "clock_id": e_nyc["clock_id"],
        "turn": e_nyc["turn"],
        "night_crossed_ack": True,
        "deadline_eta_min": 10.0,
    })
    add_audit("audit-cited-facts-mismatch-and-unknown", "env-nyc-autumn-applying", {
        "clock_id": e_nyc["clock_id"],
        "turn": e_nyc["turn"],
        "night_crossed_ack": True,
        "deadline_eta_min": 42.0,
        "cited_facts": {
            "sun_alt_deg": round(e_nyc["sun_alt_deg"] + 3.0, 2),
            "twilight": "night",
            "astro_sign": "Aries",
        },
    })
    add_audit("audit-polar-hallucinated-horizon-and-deadline", "env-tromso-polar-day-noon", {
        "clock_id": e_polar["clock_id"],
        "turn": e_polar["turn"],
        "deadline_eta_min": 30.0,
        "cited_facts": {
            "horizon_eta_min": 60.0,
        },
    })

    # --- 3. photoperiod_vector + phase_stratum_key + phase_cosine_similarity (4 cases)
    add_phase(
        "phase-oslo-winter-vs-equinox",
        {"jd_ut": jd_oslo_win, "lat": 59.9139, "lon_east": 10.7522},
        {"jd_ut": jd_oslo_eq, "lat": 59.9139, "lon_east": 10.7522},
    )
    add_phase(
        "phase-oslo-winter-day-vs-night",
        {"jd_ut": jd_oslo_win, "lat": 59.9139, "lon_east": 10.7522},
        {"jd_ut": jd_oslo_win_mid, "lat": 59.9139, "lon_east": 10.7522},
    )
    add_phase(
        "phase-nyc-vs-tokyo-travel",
        {"jd_ut": jd_nyc_eq, "lat": 40.7128, "lon_east": -74.0060},
        {"jd_ut": jd_tok_eq, "lat": 35.6762, "lon_east": 139.6503},
    )
    add_phase(
        "phase-tromso-polar-day-vs-night",
        {"jd_ut": jd_tromso_day, "lat": 69.6492, "lon_east": 18.9553},
        {"jd_ut": jd_tromso_night, "lat": 69.6492, "lon_east": 18.9553},
    )

    # --- 4. stratified_select (2 cases)
    dominant_entries = [
        {"id": f"day-{i:02d}", "stratum": "day:jun_sol:lon3", "score": float(100 + i)}
        for i in range(12)
    ] + [
        {"id": "twi-00", "stratum": "twilight:jun_sol:lon3", "score": 10.0},
        {"id": "twi-01", "stratum": "twilight:jun_sol:lon3", "score": 15.0},
        {"id": "ngt-00", "stratum": "night:jun_sol:lon3", "score": 20.0},
        {"id": "ngt-01", "stratum": "night:jun_sol:lon3", "score": 25.0},
        {"id": "tok-00", "stratum": "day:jun_sol:lon5", "score": 30.0},
        {"id": "tok-01", "stratum": "day:jun_sol:lon5", "score": 35.0},
    ]
    add_select("select-dominant-daytime-compaction", dominant_entries, 8)

    recency_entries = [
        {"id": "oslo-1", "stratum": "day:dec_sol:lon3", "recency": 10},
        {"id": "oslo-2", "stratum": "day:dec_sol:lon3", "recency": 50},
        {"id": "oslo-3", "stratum": "day:dec_sol:lon3", "recency": 30},
        {"id": "oslo-4", "stratum": "day:dec_sol:lon3", "recency": 50},
        {"id": "oslo-5", "stratum": "day:dec_sol:lon3", "recency": 20},
        {"id": "night-1", "stratum": "night:dec_sol:lon3", "recency": 40},
        {"id": "tokyo-1", "stratum": "day:dec_sol:lon5", "recency": 45},
    ]
    add_select("select-recency-and-remainder-fill", recency_entries, 5)

    return cases


def main():
    eng = Engine("embedded")
    cases = build_cases(eng)
    out = {
        "basis": "Python reference astroengine.chronosense (embedded VSOP, full moon)",
        "cases": cases,
    }
    path = os.path.join(
        os.path.dirname(__file__), "..", "packages", "caelus", "test",
        "chronosense-golden.json",
    )
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    for c in cases:
        print(f'{c["id"]:46s} ({c["type"]}) ok')
    print(f"-> {path} ({len(cases)} cases)")


if __name__ == "__main__":
    main()
