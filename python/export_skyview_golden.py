#!/usr/bin/env python3
"""Cross-language golden for astroengine.skyview (SkyView's numeric spine).

packages/caelus/test/skyview-golden.test.ts replays these specs through the
TS side (resolveLens, skyPlacer, twilightStage/limitingMag, extinctionMag,
and the full skyView body loop) and must reproduce them. Embedded tier, to
match the TS engine.

Usage: python3 export_skyview_golden.py
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day
from astroengine import skyview as SV


# A fixed direction grid: in-frame points, off-frame points on every side,
# horizon grazers, and behind-camera points (x/y null for rectilinear).
GRID = [
    [270.0, 5.0], [270.0, 45.0], [270.0, -1.0], [275.0, 10.0],
    [250.0, 2.0], [300.0, 30.0], [315.0, 60.0], [90.0, 10.0],
    [90.0, -5.0], [180.0, 5.0], [0.0, 40.0], [269.0, 0.4],
]

# Near-zenith points for the aim-at-zenith cases (basis fallback pinning).
ZGRID = [
    [0.0, 85.0], [180.0, 85.0], [90.0, 80.0], [0.0, 89.9],
    [45.0, 30.0], [270.0, 88.0],
]

# Directions for the sky-brightness grid: zenith down to the horizon, spread
# in azimuth so the Moon-distance falloff is exercised.
BGRID = [
    [90.0, 0.0], [45.0, 180.0], [20.0, 180.0], [10.0, 90.0],
    [5.0, 315.0], [0.0, 270.0],
]

# Sun/Moon/Bortle states for the brightness grid (TS-shaped ctx dicts):
# deep night pristine, full Moon up, astronomical twilight with a half Moon,
# nautical city sky with a thin Moon, civil twilight, and full day.
BCTXS = [
    {"sunAltDeg": -30.0, "sunAzDeg": 0.0, "moonAltDeg": -10.0,
     "moonAzDeg": 0.0, "moonIllum": 0.0, "bortle": 1},
    {"sunAltDeg": -25.0, "sunAzDeg": 10.0, "moonAltDeg": 40.0,
     "moonAzDeg": 180.0, "moonIllum": 1.0, "bortle": 1},
    {"sunAltDeg": -15.0, "sunAzDeg": 290.0, "moonAltDeg": 20.0,
     "moonAzDeg": 120.0, "moonIllum": 0.5, "bortle": 4},
    {"sunAltDeg": -9.0, "sunAzDeg": 300.0, "moonAltDeg": 60.0,
     "moonAzDeg": 90.0, "moonIllum": 0.25, "bortle": 9},
    {"sunAltDeg": -4.0, "sunAzDeg": 270.0, "moonAltDeg": -5.0,
     "moonAzDeg": 80.0, "moonIllum": 0.9},
    {"sunAltDeg": 30.0, "sunAzDeg": 180.0, "moonAltDeg": 25.0,
     "moonAzDeg": 300.0, "moonIllum": 0.1, "bortle": 6},
]

# The radial family across its landmarks (gnomonic, stereographic,
# equidistant, equal-area, orthographic) plus near-zero shapes pinning the
# continuity of the two branches, over thetas that cross the gnomonic-side
# horizon (Infinity in TS, null here) and the orthographic fold.
RADIAL_SHAPES = [-1.0, -0.5, -0.25, -0.01, 0.0, 0.01, 0.25, 0.5, 1.0]
RADIAL_THETAS = [0.0, 15.0, 30.0, 45.0, 60.0, 89.0, 90.0, 120.0, 150.0, 180.0]

# Vector-mode grid: the placer grid plus below-horizon and far-hemisphere
# directions (the exterior view sees the whole sphere).
PGRID = GRID + [[90.0, -40.0], [0.0, -60.0], [270.0, -89.0], [180.0, -10.0]]

# An unsorted skyline with a wrap-around segment (350 -> 20 across north).
SKYLINE = [
    {"azDeg": 270.0, "altDeg": 25.0}, {"azDeg": 20.0, "altDeg": 2.0},
    {"azDeg": 350.0, "altDeg": 12.0}, {"azDeg": 90.0, "altDeg": 0.0},
    {"azDeg": 200.5, "altDeg": 6.0},
]

CASES = (
    # every lens preset, plus custom hfov and custom focal/sensor specs
    [{"id": f"lens-{name}", "type": "lens", "lens": name,
      "width": 1024, "height": 683} for name in SV.LENS_PRESETS]
    + [
        {"id": "lens-custom-hfov", "type": "lens",
         "lens": {"hfovDeg": 100.0, "projection": "fisheye"},
         "width": 1024, "height": 683},
        {"id": "lens-custom-focal", "type": "lens",
         "lens": {"focalLengthMm": 32.0, "sensorWidthMm": 23.5},
         "width": 1024, "height": 683},
        # the placer over both projections, including behind-camera points
        {"id": "place-grid-rect", "type": "place", "aim": [270.0, 5.0],
         "lens": "normal", "width": 1024, "height": 683,
         "refraction": True, "points": GRID},
        {"id": "place-grid-fisheye", "type": "place", "aim": [270.0, 5.0],
         "lens": "ultrawide", "width": 1024, "height": 683,
         "refraction": True, "points": GRID},
        # aim near the zenith (normal basis path, right on the 89.9 edge) ...
        {"id": "place-zenith-near", "type": "place", "aim": [0.0, 89.9],
         "lens": "wide", "width": 1024, "height": 683,
         "refraction": True, "points": ZGRID},
        # ... and at the exact zenith, where cross(F, z) degenerates and the
        # up reference falls back to north
        {"id": "place-zenith-exact", "type": "place", "aim": [0.0, 90.0],
         "lens": "wide", "width": 1024, "height": 683,
         "refraction": True, "points": ZGRID},
        {"id": "place-norefract", "type": "place", "aim": [270.0, 5.0],
         "lens": "normal", "width": 1024, "height": 683,
         "refraction": False, "points": GRID},
        # twilight stage x Moon x Bortle grid for the limiting magnitude
        {"id": "twilight-limiting", "type": "twilight",
         "sun_alts": [-20.0, -15.0, -10.0, -4.0, 3.0],
         "moons": [None, [30.0, 0.9]],
         "bortles": [None, 1, 6, 9]},
        {"id": "extinction-curve", "type": "extinction",
         "alts": [0.0, 1.0, 2.0, 5.0, 10.0, 20.0, 45.0, 90.0]},
        # full body loops against the embedded ephemeris
        {"id": "bodies-tampa-sunset", "type": "bodies",
         "jd": [1990, 6, 10, 23, 30, 0],
         "observer": {"lat": 27.95, "lon_east": -82.46, "alt_m": 3},
         "aim": {"azimuth": "W", "altitude": 5},
         "lens": "normal", "image": {"width": 1024, "height": 683}},
        {"id": "bodies-london-night", "type": "bodies",
         "jd": [2024, 3, 20, 22, 0, 0],
         "observer": {"lat": 51.5, "lon_east": -0.12, "alt_m": 11},
         "aim": {"azimuth": "SE", "altitude": 20},
         "lens": "wide", "image": {"width": 800, "height": 600},
         "bortle": 4},
        # aimed at the bodies: pins the in-frame row (pixel, size, photometry)
        # for the Sun (day sky) with Jupiter also in frame but not naked-eye
        {"id": "bodies-tampa-sun-wnw", "type": "bodies",
         "jd": [1990, 6, 10, 23, 30, 0],
         "observer": {"lat": 27.95, "lon_east": -82.46, "alt_m": 3},
         "aim": {"azimuth": "WNW", "altitude": 15},
         "lens": "wide", "image": {"width": 1024, "height": 683}},
        # ... and for the Moon (illum + bright-limb great-circle angle)
        {"id": "bodies-london-moon-aim", "type": "bodies",
         "jd": [2024, 3, 20, 22, 0, 0],
         "observer": {"lat": 51.5, "lon_east": -0.12, "alt_m": 11},
         "aim": {"azimuth": 202.5, "altitude": 55},
         "lens": "normal", "image": {"width": 1024, "height": 683},
         "bortle": 4},
        # the radial family, function-level
        {"id": "radial-family", "type": "radial",
         "shapes": RADIAL_SHAPES, "thetas": RADIAL_THETAS},
        # vector-mode projection at the family's landmarks: gnomonic with a
        # narrow frame (behind-horizon points), equidistant and orthographic
        # full-sphere, a mid-pullback shape with hfov past 180, and the
        # zenith basis fallback
        {"id": "project-gnomonic", "type": "project", "aim": [270.0, 5.0],
         "shape": -1.0, "hfov_deg": 40.0, "points": PGRID},
        {"id": "project-stereographic", "type": "project", "aim": [180.0, 30.0],
         "shape": -0.5, "hfov_deg": 150.0, "points": PGRID},
        {"id": "project-equidistant", "type": "project", "aim": [270.0, 5.0],
         "shape": 0.0, "hfov_deg": 180.0, "points": PGRID},
        {"id": "project-mid-pullback", "type": "project", "aim": [270.0, 30.0],
         "shape": 0.55, "hfov_deg": 200.0, "points": PGRID},
        {"id": "project-orthographic", "type": "project", "aim": [270.0, 5.0],
         "shape": 1.0, "hfov_deg": 180.0, "points": PGRID},
        {"id": "project-zenith", "type": "project", "aim": [0.0, 90.0],
         "shape": 0.5, "hfov_deg": 180.0, "points": ZGRID},
        # sky-brightness gradient: every ctx x every direction
        {"id": "brightness-grid", "type": "brightness",
         "points": BGRID, "ctxs": BCTXS},
        # skyline interpolation: unsorted profile, wrap-around across 360/0,
        # on-node queries, and out-of-range azimuths
        {"id": "horizon-interp", "type": "horizon", "profile": SKYLINE,
         "queries": [0.0, 5.0, 10.0, 20.0, 55.0, 90.0, 145.25, 200.5, 235.0,
                     270.0, 310.0, 350.0, 355.0, 359.9, 720.5, -30.0]},
        # the Tampa aimed-at-Sun case with a skyline that occludes the Sun
        # (alt 10.5 at az 290.7, below the 14-deg wall) but not Jupiter
        # (alt 33.6 at az 280.0)
        {"id": "bodies-tampa-skyline", "type": "bodies",
         "jd": [1990, 6, 10, 23, 30, 0],
         "observer": {"lat": 27.95, "lon_east": -82.46, "alt_m": 3},
         "aim": {"azimuth": "WNW", "altitude": 15},
         "lens": "wide", "image": {"width": 1024, "height": 683},
         "horizon_profile": [
             {"azDeg": 0.0, "altDeg": 2.0}, {"azDeg": 250.0, "altDeg": 3.0},
             {"azDeg": 280.5, "altDeg": 14.0}, {"azDeg": 300.0, "altDeg": 14.0},
             {"azDeg": 320.0, "altDeg": 3.0}]},
    ]
)


def compute(spec, eng):
    t = spec["type"]
    if t == "lens":
        return SV.resolve_lens(spec["lens"], spec["width"], spec["height"])
    if t == "place":
        lens = SV.resolve_lens(spec["lens"], spec["width"], spec["height"])
        return [SV.place(spec["aim"][0], spec["aim"][1], lens,
                         spec["width"], spec["height"], az, alt,
                         refraction=spec["refraction"])
                for az, alt in spec["points"]]
    if t == "radial":
        rows = []
        for shape in spec["shapes"]:
            fn = SV.radial_scale(shape)
            rows.append([
                v if math.isfinite(v) else None
                for v in (fn(math.radians(th)) for th in spec["thetas"])
            ])
        return rows
    if t == "project":
        return [SV.sky_project(spec["aim"][0], spec["aim"][1], az, alt,
                               shape=spec["shape"], hfov_deg=spec["hfov_deg"])
                for az, alt in spec["points"]]
    if t == "twilight":
        rows = []
        for sun_alt in spec["sun_alts"]:
            stage = SV.twilight_stage(sun_alt)
            for moon in spec["moons"]:
                moon_alt = None if moon is None else moon[0]
                moon_illum = None if moon is None else moon[1]
                for bortle in spec["bortles"]:
                    rows.append({
                        "stage": stage,
                        "limit": SV.limiting_mag(stage, moon_alt, moon_illum,
                                                 bortle),
                    })
        return rows
    if t == "extinction":
        return [SV.extinction_mag(alt) for alt in spec["alts"]]
    if t == "brightness":
        return [[SV.sky_brightness(alt, az, ctx) for alt, az in spec["points"]]
                for ctx in spec["ctxs"]]
    if t == "horizon":
        return [SV.horizon_alt_at(spec["profile"], az)
                for az in spec["queries"]]
    if t == "bodies":
        j = julian_day(*spec["jd"])
        view = {
            "observer": spec["observer"],
            "aim": spec["aim"],
            "lens": spec["lens"],
            "image": spec["image"],
        }
        return SV.sky_bodies(eng, j, view, bortle=spec.get("bortle"),
                             horizon_profile=spec.get("horizon_profile"))
    raise ValueError(t)


def main():
    eng = Engine("embedded")
    out = {"basis": "Python reference astroengine.skyview (embedded VSOP, full moon)",
           "cases": []}
    for c in CASES:
        out["cases"].append({"id": c["id"], "spec": c, "result": compute(c, eng)})
        print(f'{c["id"]:22s} ok')
    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "skyview-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
