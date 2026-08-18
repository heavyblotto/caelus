#!/usr/bin/env python3
"""Mint the classical era pack (deep-time R1): 3000 BCE to 1000 CE, adjoining
the shipped 1000-3000 tier.

The seven classical bodies only -- the Moon, the five visible planets, and
Earth (the observer, not a chart body). The tradition's sky is these seven;
the modern bodies stay uncomputed at classical dates, which is honest rather
than a gap.

Each slab ends EXACTLY where its body's modern pack begins (the shared
boundary instant), so the engine's covering-slab resolution hands over at
one point and the boundary test measures the two fits agreeing there.

Accuracy bars (R1): planets within 5 arcsec geocentric, Moon within 1
arcmin. The bars are distance-scaled to true-error-in-AU per body, with
margin for Earth's own contribution. Everything is measured at epochs the
fit never sampled; nothing ships on the fit's say-so.

Run with egress to ssd.jpl.nasa.gov and numpy installed. Pilot first:
  python3 fit_classical.py --bodies mars --year0 950   # a 50-year slice
Then the era:  python3 fit_classical.py
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chebyshev import fit, max_error
from astroengine.core import julian_day
from horizons import HorizonsCache

AU_KM = 149597870.7
MOON_KM = 384400.0
HERE = os.path.dirname(__file__)
DATA_MONOREPO = os.path.join(HERE, "..", "packages", "caelus", "data")
DATA_ENGINE = os.path.join(HERE, "astroengine", "data")

# The boundary every slab adjoins: the shared jd0 of the modern 1000-3000
# packs (verified identical for the seven classical bodies).
BOUNDARY = 2086302.5
ERA_YEAR0 = -2999  # 3000 BCE, astronomical year numbering

# The planet table mirrors the modern mints' source exactly (system
# barycenters for Mars/Jupiter/Saturn, centers for Mercury/Venus/Earth, all
# about @sun -- the boundary agreement depends on the same source, not just
# the same system). Steps are the classical-cadence choices the pilot
# measures; bars are the 5-arcsec geocentric target scaled by each body's
# closest-approach distance, with margin for Earth's own contribution.
#             command  step(d)  segs to scan        degrees           true bar (AU)
PLANETS = {
    "mercury": ("199",  0.5,   (16, 32, 64),      (12, 14, 16, 18), 6e-6),
    "venus":   ("299",  1.0,   (32, 64, 128),     (12, 14, 16),     3e-6),
    "earth":   ("399",  0.5,   (32, 64, 128),     (12, 14, 16, 18), 6e-6),
    "mars":    ("4",    1.0,   (32, 64, 128),     (12, 14, 16),     4e-6),
    "jupiter": ("5",    2.0,   (256, 512, 1024),  (10, 12, 14, 16), 5e-5),
    "saturn":  ("6",    2.0,   (512, 1024, 2048), (10, 12, 14),     8e-5),
}
# The Moon: geocentric, km, scale 1000 (the shipped moon pack's own format);
# the bar is 1 arcmin = ~112 km at mean distance.
MOON = {"command": "301", "center": "500@399", "step": 0.125,
        "segs": (32, 64, 128), "degrees": (18, 20, 22, 24),
        "bar_km": 112.0}


def independent_epochs(cache, jd0, jd1, stride=37):
    """Raw cached rows the fit never sampled (it fits at CGL nodes): the
    honest between-nodes error measure (see fit_pluto.py)."""
    jds = cache._jds
    m = (jds >= jd0) & (jds <= jd1)
    return (jds[m][::stride], cache._xs[m][::stride],
            cache._ys[m][::stride], cache._zs[m][::stride])


def cache_for(name, command, center, step, jd0, jd1):
    if step == 1.0:
        suffix = ""
    elif step * 24 == int(step * 24):
        suffix = f"_{int(step * 24)}h"
    else:
        suffix = f"_{round(step * 1440)}m"
    path = os.path.join(
        HERE, f"{name}_horizons_cache_classical{suffix}.json")
    cache = HorizonsCache(path, command=command, label=f"{command} {name}",
                          center=center)
    # Pad one day past jd1: the fit samples the last segment's endpoint (the
    # shared boundary instant) exactly, and a sample grid whose step does not
    # divide the span (jupiter/saturn at 2d) would otherwise end a day short
    # of it. Every seg length here is a multiple of its body's step, so the
    # +1 day keeps the grid aligned and guarantees a row at-or-past jd1.
    cache.ensure(jd0, jd1, step=step, pad_days=1.0)
    return cache


def mint_planet(name, year0_nominal):
    """Mint one classical slab: fit over [jd1 - n*seg, BOUNDARY] where n makes
    jd0 land just before the era's nominal start, so the pack's last segment
    ends exactly at the boundary it shares with the modern pack."""
    command, step, segs, degrees, bar = PLANETS[name]
    jd1 = BOUNDARY
    jd0_nominal = julian_day(year0_nominal, 1, 1)
    # The adjoint start (jd1 - n*seg) lands up to one longest segment BEFORE
    # the nominal start, so the cache pads low by that much.
    cache = cache_for(name, command, "@sun", step,
                      jd0_nominal - max(segs), BOUNDARY)
    test = independent_epochs(cache, jd0_nominal, BOUNDARY)
    print(f"{name}: scan seg_days, degree -> node resid, TRUE err "
          f"({len(test[0])} independent epochs), size; bar {bar:.0e} AU")
    best = None
    for seg in segs:
        n = math.ceil((jd1 - jd0_nominal) / seg)
        jd0 = jd1 - n * seg  # exact adjoint: the last segment ends at jd1
        for deg in degrees:
            data, resid = fit(cache.sample, jd0, jd1, seg, deg,
                              scale=1.0, sig=10)
            size = len(json.dumps(data, separators=(",", ":")))
            true_err = max_error(data, *test)
            ok = "OK" if true_err < bar else "  "
            print(f"  seg={seg:5d} deg={deg:2d}  node={resid:.2e}  "
                  f"true={true_err:.2e} AU  {size / 1048576:6.2f} MB {ok}")
            if true_err < bar and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid, true_err)
    if best is None:
        print(f"ERROR: {name}: no (seg, degree) met the {bar:.0e} AU bar; "
              "a flat floor across degrees is the sampling chord: refit with "
              "a finer step.")
        return None
    seg, deg, size, data, resid, true_err = best
    data["provenance"] = {
        "source": "JPL Horizons (DE441)", "license": "public domain",
        "body": f"{command} {name}" + (" barycenter" if command in "456" else ""),
        "center": "@sun", "frame": "heliocentric ecliptic J2000",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{year0_nominal}-1000 (adjoins the modern pack's jd0)",
        "seg_days": seg, "degree": deg, "sample_step_days": step,
        "fit_residual_au": resid, "true_error_au": true_err,
        "true_error_basis": "max radial error vs raw Horizons samples inside the fitted span",
        "deltaT_model": "Morrison & Stephenson 2004 (J. Hist. Astron. 35); "
                        "sigma per ranges.ts deltaTSigma",
        "era": "classical",
    }
    return name, data, true_err


def mint_moon(year0_nominal):
    """The Moon's classical slab, in the shipped moon pack's own format
    (geocentric, km, scale 1000)."""
    jd1 = BOUNDARY
    jd0_nominal = julian_day(year0_nominal, 1, 1)
    cache = cache_for("moon", MOON["command"], MOON["center"],
                      MOON["step"], jd0_nominal - max(MOON["segs"]), BOUNDARY)
    test = independent_epochs(cache, jd0_nominal, BOUNDARY)
    test = (test[0], test[1] * AU_KM, test[2] * AU_KM, test[3] * AU_KM)

    def moon_km(jds):
        x, y, z = cache.sample(jds)
        return x * AU_KM, y * AU_KM, z * AU_KM

    bar = MOON["bar_km"]
    print(f"moon: scan seg_days, degree -> node resid, TRUE err "
          f"({len(test[0])} independent epochs), size; bar {bar:.0f} km")
    best = None
    for seg in MOON["segs"]:
        n = math.ceil((jd1 - jd0_nominal) / seg)
        jd0 = jd1 - n * seg
        for deg in MOON["degrees"]:
            data, resid = fit(moon_km, jd0, jd1, seg, deg,
                              scale=1000.0, sig=9)
            size = len(json.dumps(data, separators=(",", ":")))
            true_err = max_error(data, *test)
            ok = "OK" if true_err < bar else "  "
            print(f"  seg={seg:3d} deg={deg:2d}  node={resid:9.2f} km  "
                  f"true={true_err:8.2f} km ({true_err / MOON_KM * 206265:6.2f}\")"
                  f"  {size / 1048576:6.2f} MB {ok}")
            if true_err < bar and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid, true_err)
    if best is None:
        print(f"ERROR: moon: no (seg, degree) met the {bar:.0f} km bar.")
        return None
    seg, deg, size, data, resid, true_err = best
    data["provenance"] = {
        "source": "JPL Horizons (DE441)", "license": "public domain",
        "body": "301 Moon", "center": "500@399 (geocentric)",
        "frame": "geocentric ecliptic J2000, km (scale 1000)",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{year0_nominal}-1000 (adjoins the modern pack's jd0)",
        "seg_days": seg, "degree": deg, "sample_step_days": MOON["step"],
        "fit_residual_km": resid, "true_error_km": true_err,
        "true_error_basis": "max radial error vs raw Horizons samples inside the fitted span",
        "deltaT_model": "Morrison & Stephenson 2004 (J. Hist. Astron. 35); "
                        "sigma per ranges.ts deltaTSigma",
        "era": "classical",
    }
    return "moon", data, true_err

    return cache


def boundary_check(name, data):
    """R1's boundary test: the classical slab's last instant and the modern
    pack's first must resolve the same position (same source, two fits).
    Reported in geocentric arcsec against the pack's own bar."""
    sys.path.insert(0, HERE)
    from astroengine.chebyshev import ChebSeries
    classical = ChebSeries(data)
    modern_path = ("moon_cheb.full.json" if name == "moon"
                   else f"{name}_cheb.json")
    with open(os.path.join(DATA_MONOREPO, modern_path)) as f:
        modern = ChebSeries(json.load(f))
    ca = classical.xyz(classical.jd1)
    mo = modern.xyz(modern.jd0)
    diff = math.dist(ca, mo)  # AU (planets) or km*scale (moon: thousands of km)
    if name == "moon":
        arcsec = diff * 1000 / MOON_KM * 206265
    else:
        arcsec = diff * 206265  # heliocentric, ~at 1 AU — conservative
    print(f"  boundary {name}: {arcsec:.2f}\" disagreement at the shared instant")
    return arcsec


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bodies", nargs="+",
                    choices=sorted(PLANETS) + ["moon"],
                    default=sorted(PLANETS) + ["moon"])
    ap.add_argument("--year0", type=int, default=ERA_YEAR0,
                    help="nominal era start (default -2999 = 3000 BCE); the "
                         "slab's actual start lands just before it so the "
                         "last segment ends exactly at the boundary")
    args = ap.parse_args()

    wrote = []
    for name in args.bodies:
        result = (mint_moon(args.year0) if name == "moon"
                  else mint_planet(name, args.year0))
        if result is None:
            print(f"FAILED: {name}")
            continue
        name, data, true_err = result
        arcsec = boundary_check(name, data)
        fname = f"{name}_cheb.classical.json"
        for root in (DATA_MONOREPO, DATA_ENGINE):
            path = os.path.join(root, fname)
            with open(path, "w") as f:
                json.dump(data, f, separators=(",", ":"))
        wrote.append((name, true_err, arcsec,
                      os.path.getsize(os.path.join(DATA_MONOREPO, fname))))
        print(f"wrote {fname}")

    if wrote:
        print("\nsummary (true error at unsampled epochs; boundary disagreement):")
        for name, true_err, arcsec, size in wrote:
            unit = "km" if name == "moon" else "AU"
            print(f"  {name}: true {true_err:.3g} {unit}, boundary "
                  f"{arcsec:.2f}\", {size / 1048576:.2f} MB")


if __name__ == "__main__":
    main()

