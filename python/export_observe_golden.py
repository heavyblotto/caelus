#!/usr/bin/env python3
"""Regenerate packages/caelus/test/observe-golden.json from the Python
reference (astroengine.observe).

The TypeScript port (packages/caelus/src/observe.ts) replays these specs in
packages/caelus/test/observe-golden.test.ts and must match tightly.
Uses embedded ephemeris tier to match the TS engine.

Run: python3 python/export_observe_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import julian_day
from astroengine import events as EV
from astroengine import observe as OB


def wrap180(x):
    r = (x + 180.0) % 360.0 - 180.0
    return 180.0 if r == -180.0 else r


def build_cases(eng):
    jd_nyc = julian_day(2026, 6, 21, 18, 0, 0)
    jd_syd = julian_day(2026, 1, 15, 2, 0, 0)
    jd_lon = julian_day(2024, 3, 20, 22, 0, 0)
    jd_late = julian_day(2026, 3, 21, 22, 0, 0)
    jd_den = julian_day(2026, 3, 21, 13, 15, 0)
    jd_psun = julian_day(2026, 6, 21, 23, 0, 0)
    jd_pnight = julian_day(2026, 12, 21, 11, 0, 0)
    jd_del = julian_day(2026, 3, 21, 4, 30, 0)
    jd_fiji = julian_day(2026, 6, 21, 2, 0, 0)
    jd_jun_noon = julian_day(2026, 6, 21, 17, 0, 0)

    # Pre-sample authentic observables for verify / chronolocate / geolocate specs.
    sc_nyc = OB.scene_geometry(eng, jd_nyc, 40.7128, -74.0060)
    sc_nyc_30 = OB.scene_geometry(eng, jd_nyc + 30.0 / 1440.0, 40.7128, -74.0060)
    sweep_nyc = wrap180(sc_nyc_30["shadow"]["bearing_deg"] - sc_nyc["shadow"]["bearing_deg"])

    sc_syd = OB.scene_geometry(eng, jd_syd, -33.8688, 151.2093)
    sc_syd_30 = OB.scene_geometry(eng, jd_syd + 30.0 / 1440.0, -33.8688, 151.2093)
    sweep_syd = wrap180(sc_syd_30["shadow"]["bearing_deg"] - sc_syd["shadow"]["bearing_deg"])

    sc_del = OB.scene_geometry(eng, jd_del, 28.6139, 77.2090)
    sc_jun = OB.scene_geometry(eng, jd_jun_noon, 40.7128, -74.0060)
    sc_fiji = OB.scene_geometry(eng, jd_fiji, -16.8, 179.9)

    nadir_nyc = EV.rise_set(
        eng, "sun", sc_nyc["diurnal"]["solar_noon_jd"], 40.7128, -74.0060, kind="itransit"
    )
    sub_nyc = OB.geolocate(eng, jd_nyc, {
        "shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
        "shadow_length_ratio": sc_nyc["shadow"]["length_ratio"],
    })["subsolar"]
    full_jd = [
        t for t, name in EV.lunar_phases(eng, julian_day(2026, 6, 1), julian_day(2026, 7, 15))
        if name == "full"
    ][0]
    sub_full = OB.geolocate(eng, full_jd, {"twilight": "day"})["subsolar"]
    full_night_lon = wrap180(sub_full["lon"] + 180.0)

    cases = []

    def add_scene(cid, jd, lat, lon, opts=None):
        opts = opts or {}
        res = OB.scene_geometry(eng, jd, lat, lon, **opts)
        cases.append({
            "id": cid,
            "type": "scene",
            "spec": {"jd_ut": jd, "lat": lat, "lon_east": lon, "options": opts},
            "result": res,
        })

    def add_verify(cid, claim, observed=None):
        res = OB.verify_observation(eng, claim, observed)
        cases.append({
            "id": cid,
            "type": "verify",
            "spec": {"claim": claim, "observed": observed},
            "result": res,
        })

    def add_chrono(cid, place, observed, jd0, jd1, opts=None):
        opts = opts or {}
        res = OB.chronolocate(eng, place, observed, jd0, jd1, **opts)
        cases.append({
            "id": cid,
            "type": "chronolocate",
            "spec": {"place": place, "observed": observed, "jd_start": jd0,
                     "jd_end": jd1, "options": opts},
            "result": res,
        })

    def add_geo(cid, jd, observed, opts=None):
        opts = opts or {}
        res = OB.geolocate(eng, jd, observed, **opts)
        cases.append({
            "id": cid,
            "type": "geolocate",
            "spec": {"jd_ut": jd, "observed": observed, "options": opts},
            "result": res,
        })

    # --- 1. scene_geometry (8 cases)
    add_scene("scene-nyc-summer-afternoon", jd_nyc, 40.7128, -74.0060, {
        "camera_aim_az_deg": 180.0,
        "camera_aim_alt_deg": 5.0,
        "prev_jd_ut": jd_nyc - 0.8,
        "deadline_jd_ut": jd_nyc + 45.0 / 1440.0,
    })
    add_scene("scene-sydney-summer-midday", jd_syd, -33.8688, 151.2093)
    add_scene("scene-london-night-moonlight", jd_lon, 51.5, -0.12, {"bortle": 4})
    add_scene("scene-nyc-sloped-uphill", jd_late, 40.7128, -74.0060, {
        "slope_deg": 15.0, "slope_azimuth_deg": 260.0,
    })
    add_scene("scene-nyc-sloped-self-shadowed", jd_late, 40.7128, -74.0060, {
        "slope_deg": 25.0, "slope_azimuth_deg": 80.0,
    })
    add_scene("scene-denver-elevated", jd_den, 39.7392, -104.9903, {
        "elevation_m": 1609.0,
        "prev_jd_ut": jd_den - 0.1,
        "deadline_jd_ut": jd_den - 15.0 / 1440.0,
    })
    add_scene("scene-polar-midnight-sun", jd_psun, 78.2, 15.6)
    add_scene("scene-polar-night", jd_pnight, 78.2, 15.6)

    # --- 2. verify_observation (10 cases)
    add_verify("verify-oracle-unconstrained",
               {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -74.0060}, None)
    add_verify("verify-authentic-nyc",
               {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -74.0060},
               {
                   "shadow_bearing_deg": round(sc_nyc["shadow"]["bearing_deg"], 4),
                   "shadow_length_ratio": round(sc_nyc["shadow"]["length_ratio"], 4),
                   "sun_azimuth_deg": round(sc_nyc["sun"]["azimuth_deg"], 4),
                   "sun_altitude_deg": round(sc_nyc["sun"]["altitude_apparent_deg"], 4),
                   "twilight": "day",
                   "sun_visible": True,
                   "moon_visible": True,
                   "moon_illum": round(sc_nyc["moon"]["illum"], 4),
                   "moon_waxing": sc_nyc["moon"]["waxing"],
                   "moon_bright_limb_deg": round(sc_nyc["moon"]["bright_limb_zenith_deg"], 4),
                   "shadow_sweep": {"dt_minutes": 30.0, "delta_bearing_deg": round(sweep_nyc, 4)},
               })
    add_verify("verify-widened-tolerances",
               {"jd_ut": jd_nyc + 35.0 / 1440.0, "lat": 40.7128, "lon_east": -74.0060,
                "time_tolerance_min": 40.0},
               {
                   "shadow_bearing_deg": round(sc_nyc["shadow"]["bearing_deg"], 4),
                   "shadow_length_ratio": round(sc_nyc["shadow"]["length_ratio"], 4),
               })
    add_verify("verify-lahaina-zenith",
               {"jd_ut": jd_nyc, "lat": sub_nyc["lat"], "lon_east": sub_nyc["lon"]},
               {"shadow_bearing_deg": 237.0, "shadow_length_ratio": 0.01})
    add_verify("verify-full-moon-indet",
               {"jd_ut": full_jd, "lat": 0.0, "lon_east": full_night_lon},
               {"moon_bright_limb_deg": 123.0, "moon_waxing": True, "twilight": "night"})
    add_verify("verify-impossible-night-shadow",
               {"jd_ut": nadir_nyc, "lat": 40.7128, "lon_east": -74.0060},
               {"shadow_bearing_deg": 45.0, "shadow_length_ratio": 1.2})
    add_verify("verify-reversed-sweep-sydney",
               {"jd_ut": jd_syd, "lat": -33.8688, "lon_east": 151.2093},
               {"shadow_sweep": {"dt_minutes": 30.0, "delta_bearing_deg": round(-sweep_syd, 4)}})
    add_verify("verify-spoof-india-halfhour",
               {"jd_ut": jd_del + 5.5 / 24.0, "lat": 28.6139, "lon_east": 77.2090},
               {
                   "shadow_bearing_deg": round(sc_del["shadow"]["bearing_deg"], 4),
                   "shadow_length_ratio": round(sc_del["shadow"]["length_ratio"], 4),
               })
    add_verify("verify-spoof-hemisphere-flip",
               {"jd_ut": jd_syd, "lat": 33.8688, "lon_east": 151.2093},
               {
                   "shadow_bearing_deg": round(sc_syd["shadow"]["bearing_deg"], 4),
                   "shadow_length_ratio": round(sc_syd["shadow"]["length_ratio"], 4),
               })
    add_verify("verify-spoof-seasonal-date",
               {"jd_ut": jd_jun_noon - 182.0, "lat": 40.7128, "lon_east": -74.0060},
               {
                   "sun_altitude_deg": round(sc_jun["sun"]["altitude_apparent_deg"], 4),
                   "shadow_length_ratio": round(sc_jun["shadow"]["length_ratio"], 4),
                   "shadow_bearing_deg": round(sc_jun["shadow"]["bearing_deg"], 4),
               })

    # --- 3. chronolocate (4 cases)
    add_chrono("chrono-nyc-30d-solar-lunar",
               {"lat": 40.7128, "lon_east": -74.0060},
               {
                   "shadow_bearing_deg": round(sc_nyc["shadow"]["bearing_deg"], 4),
                   "shadow_length_ratio": round(sc_nyc["shadow"]["length_ratio"], 4),
                   "moon_illum": round(sc_nyc["moon"]["illum"], 4),
                   "moon_waxing": sc_nyc["moon"]["waxing"],
               },
               jd_nyc - 15.0, jd_nyc + 15.0)
    jd_lon_mid = julian_day(2026, 3, 21, 0, 0, 0)
    add_chrono("chrono-london-midnight-wrap",
               {"lat": 51.5, "lon_east": 0.0},
               {"twilight": "night"},
               jd_lon_mid - 0.5, jd_lon_mid + 0.5)
    add_chrono("chrono-polar-winter-pruned",
               {"lat": 78.2, "lon_east": 15.6},
               {"shadow_bearing_deg": 0.0, "shadow_length_ratio": 2.0},
               julian_day(2026, 12, 15, 0, 0, 0), julian_day(2026, 12, 25, 0, 0, 0))
    add_chrono("chrono-narrow-rescue",
               {"lat": 40.7128, "lon_east": -74.0060},
               {"shadow_bearing_deg": round(sc_nyc["shadow"]["bearing_deg"], 4),
                "tolerances": {"shadow_bearing_deg": 1.0}},
               jd_nyc - 0.25, jd_nyc + 0.25,
               {"step_minutes": 15.0})

    # --- 4. geolocate (6 cases)
    add_geo("geo-analytical-nyc-shadow", jd_nyc, {
        "shadow_bearing_deg": round(sc_nyc["shadow"]["bearing_deg"], 4),
        "shadow_length_ratio": round(sc_nyc["shadow"]["length_ratio"], 4),
    })
    add_geo("geo-analytical-sydney-tight", jd_syd, {
        "sun_azimuth_deg": round(sc_syd["sun"]["azimuth_deg"], 4),
        "sun_altitude_deg": round(sc_syd["sun"]["altitude_apparent_deg"], 4),
        "tolerances": {"sun_azimuth_deg": 1.0, "sun_altitude_deg": 0.5},
    })
    add_geo("geo-analytical-two-roots", jd_nyc, {
        "sun_azimuth_deg": 290.0,
        "sun_altitude_deg": 20.0,
        "tolerances": {"sun_azimuth_deg": 1.0, "sun_altitude_deg": 1.0},
    }, {"lat_min": -85.0, "lat_max": 85.0})
    add_geo("geo-grid-fiji-antimeridian", jd_fiji, {
        "sun_altitude_deg": round(sc_fiji["sun"]["altitude_apparent_deg"], 4),
        "moon_altitude_deg": round(sc_fiji["moon"]["altitude_apparent_deg"], 4),
        "tolerances": {"sun_altitude_deg": 1.5, "moon_altitude_deg": 1.5},
    })
    add_geo("geo-grid-shadow-brightlimb", jd_nyc, {
        "shadow_bearing_deg": round(sc_nyc["shadow"]["bearing_deg"], 4),
        "moon_bright_limb_deg": round(sc_nyc["moon"]["bright_limb_zenith_deg"], 4),
        "moon_visible": True,
    })
    add_geo("geo-grid-noon-arc", jd_nyc, {
        "sun_azimuth_deg": 180.0,
        "twilight": "day",
        "tolerances": {"sun_azimuth_deg": 4.0},
    })

    return cases


def main():
    eng = Engine("embedded")
    cases = build_cases(eng)
    out = {
        "basis": "Python reference astroengine.observe (embedded VSOP, full moon)",
        "cases": cases,
    }
    path = os.path.join(
        os.path.dirname(__file__), "..", "packages", "caelus", "test",
        "observe-golden.json",
    )
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    for c in cases:
        print(f'{c["id"]:32s} ({c["type"]}) ok')
    print(f"-> {path} ({len(cases)} cases)")


if __name__ == "__main__":
    main()
