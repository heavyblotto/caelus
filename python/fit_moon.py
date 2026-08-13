#!/usr/bin/env python3
"""Fit the Moon's geocentric ecliptic-J2000 position -> Chebyshev JSON.

Source: JPL Horizons (public domain), geometric vectors of the Moon (301)
about the geocenter (500@399), ecliptic J2000, converted to km -- the exact
format of the shipped `moon_cheb.*.json` packs (scale 1000, i.e. thousands
of km), so the minted pack drops into `moon_cheb.full.json` and BOTH engines
pick it up with no code change: the loaders prefer the `full` tier and read
the covered span from the pack itself, so `moon_in_precise_range`,
`true_node_precise`, `osc_apogee_precise` (true Lilith), and a subsequent
`fit_intp_apog.py` refit all widen with it automatically.

Why: outside the precise tier the Moon falls back to the abridged Meeus
ch.47 series at book precision -- measured 10.74" at the 1000/3000 edges
(docs/range-expansion.md). A wide pack replaces that with the modern
ephemeris itself. Honesty note: at 1000 CE sigma(delta T) is ~55 s, which
smears the real-world Moon by ~30" no matter how good the engine is; a wide
precise-Moon tier is an accuracy claim in TT, and `Chart.warnings` already
says so per chart. Claims move only on validate_horizons.py measurements.

Volume: this is the largest mint in the repo. The Moon moves ~13.2 deg/day,
so the cache samples at 6 hours by default (linear-interpolation chord error
~160 km ~ 0.085", 25x under the Moon's 2.5" claim): the wide span is ~2.9M
rows (~150-200 MB cache file, fetched in Horizons-sized chunks and
checkpointed, resumable). `--step 0.125` (3 h) quarters the chord error to
~40 km ~ 0.02" at double the volume; the true-error bar tightens with it.
The pack itself lands in the 10-20 MB range (the Moon's harmonic content
needs ~13 coefficients per 27.3-day orbit, times ~26,750 orbits, times three
coordinates) -- it replaces the repo-only `moon_cheb.full.json` and does NOT
ship in the npm tarball (which carries the embedded 1920-2080 tier).

Run in an environment with outbound access to ssd.jpl.nasa.gov and numpy
installed. Afterwards: regenerate goldens, re-run validate_horizons.py
--wide, refit intp_apog if desired, and move claims on the measured numbers.

  python3 fit_moon.py                    # 1000-3000, 6 h sampling
  python3 fit_moon.py --step 0.125       # 3 h sampling, tighter bar
  python3 fit_moon.py --year0 1500 --year1 2500   # a smaller intermediate tier
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chebyshev import fit, max_error
from astroengine.core import julian_day
from horizons import HorizonsCache

KM_PER_AU = 149597870.7
HERE = os.path.dirname(__file__)
OUT_MONOREPO = os.path.join(HERE, "..", "packages", "caelus", "data",
                            "moon_cheb.full.json")
OUT_ENGINE = os.path.join(HERE, "astroengine", "data", "moon_cheb.full.json")

# Scan grid. The shipped 300-year pack settled at seg=32 d, degree 24
# (~1.2 lunar orbits per segment); the scan brackets that. The bar is TRUE
# error in km at epochs the fit never sampled (see fit_pluto.py), and is set
# by the sampling chord: ~160 km at 6 h, ~40 km at 3 h -- the polynomial
# cannot beat the cache it is fit to.
SEGS = (16, 32, 64)
DEGREES = {16: (12, 14, 16, 18), 32: (18, 20, 22, 24, 26), 64: (36, 40, 44)}
TRUE_TARGET_KM = {0.25: 200.0, 0.125: 60.0}


def _independent_epochs(cache, jd0, jd1, stride=37):
    jds = cache._jds
    m = (jds >= jd0) & (jds <= jd1)
    return (jds[m][::stride], cache._xs[m][::stride],
            cache._ys[m][::stride], cache._zs[m][::stride])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--year0", type=int, default=1000)
    ap.add_argument("--year1", type=int, default=3000)
    ap.add_argument("--step", type=float, default=0.25,
                    help="Horizons sampling step in days (0.25 = 6 h default, "
                         "0.125 = 3 h for the tighter bar)")
    args = ap.parse_args()
    target = TRUE_TARGET_KM.get(args.step)
    if target is None:
        print(f"ERROR: no true-error bar defined for step {args.step}; "
              f"use one of {sorted(TRUE_TARGET_KM)}")
        sys.exit(1)
    jd0 = julian_day(args.year0, 1, 1)
    jd1 = julian_day(args.year1, 1, 1)
    suffix = f"_{round(args.step * 24)}h"
    cache = HorizonsCache(
        os.path.join(HERE, f"moon_horizons_cache_{args.year0}_{args.year1}{suffix}.json"),
        command="301", label="301 Moon", center="500@399")
    cache.ensure(jd0, jd1, step=args.step, pad_days=max(SEGS))

    def moon_km(jds):
        x, y, z = cache.sample(jds)
        return x * KM_PER_AU, y * KM_PER_AU, z * KM_PER_AU

    tj, tx, ty, tz = _independent_epochs(cache, jd0, jd1)
    test = (tj, tx * KM_PER_AU, ty * KM_PER_AU, tz * KM_PER_AU)
    print(f"moon: scan seg_days, degree -> node resid, TRUE err "
          f"({len(tj)} independent epochs), size; bar {target:.0f} km")
    best = None
    for seg in SEGS:
        for deg in DEGREES[seg]:
            data, resid = fit(moon_km, jd0, jd1, seg, deg,
                              scale=1000.0, sig=9)
            size = len(json.dumps(data, separators=(",", ":")))
            true_err = max_error(data, *test)
            ok = "OK" if true_err < target else "  "
            print(f"  seg={seg:3d} deg={deg:2d}  node={resid:9.2f} km  "
                  f"true={true_err:9.2f} km ({true_err / 384400 * 206265:6.3f}\" "
                  f"at mean distance)  {size / 1048576:6.2f} MB {ok}")
            if true_err < target and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid, true_err)
    if best is None:
        print(f"ERROR: no (seg, degree) met the {target:.0f} km bar. A flat "
              f"floor across degrees is the sampling chord: refit with "
              f"--step 0.125.")
        sys.exit(1)

    seg, deg, size, data, resid, true_err = best
    data["provenance"] = {
        "source": "JPL Horizons",
        "body": "301 Moon",
        "center": "500@399 (geocentric)",
        "frame": "geocentric ecliptic J2000, km (scale 1000)",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{args.year0}-{args.year1}",
        "seg_days": seg,
        "degree": deg,
        "sample_step_days": args.step,
        "fit_residual_km": resid,
        "true_error_km": true_err,
        "true_error_basis":
            "max radial error vs raw Horizons samples inside the fitted span",
    }
    for path in (OUT_MONOREPO, OUT_ENGINE):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"\nchosen seg={seg} deg={deg}: "
              f"{os.path.getsize(path) / 1048576:.2f} MB\n  -> {path}")


if __name__ == "__main__":
    main()
