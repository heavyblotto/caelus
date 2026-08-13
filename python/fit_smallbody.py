#!/usr/bin/env python3
"""Fit small-body heliocentric ecliptic-J2000 positions -> Chebyshev JSON.

Generalizes fit_chiron.py to the Tier 2 bodies. Source: JPL Horizons
(public domain), geometric vectors (no light-time baked in) so the
geocentric pipeline applies it once. Needs ssd.jpl.nasa.gov reachable;
run locally if the sandbox egress policy blocks it, then commit the JSON.

Usage:
  python3 fit_smallbody.py                       # all five Tier 2 bodies, 1850-2150
  python3 fit_smallbody.py ceres pholus
  python3 fit_smallbody.py --wide                # the 1000-3000 CE lazy tier
  python3 fit_smallbody.py --year0 1000 --year1 3000 chiron
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chebyshev import fit, max_error
from astroengine.core import julian_day
from horizons import HorizonsCache

AU_KM = 149597870.7  # for reporting fit error in kilometres

# Horizons COMMAND: a trailing semicolon selects the small-body database.
BODIES = {
    "ceres": ("1;", "1 Ceres"),
    "pallas": ("2;", "2 Pallas"),
    "juno": ("3;", "3 Juno"),
    "vesta": ("4;", "4 Vesta"),
    "pholus": ("5145;", "5145 Pholus"),
    # Chiron joins here for wide-window refits; its default 1850-2150 pack
    # came from fit_chiron.py and stays byte-identical unless refit.
    "chiron": ("2060;", "2060 Chiron"),
}

HERE = os.path.dirname(__file__)
RANGE = (1850, 2150)
RESID_TARGET = 5e-6  # AU, same bar as the Chiron fit (~1 km at 1 AU)

# Horizons serves the small bodies only over ~1600-2500, both ends. Their SPK
# solutions are numerical integrations of orbits fit to observations that begin
# with the 19th-century discoveries, so JPL neither extends them back past the
# telescopic era nor forward indefinitely:
#   "No ephemeris for target '1 Ceres (A801 AA)' prior to A.D. 1599-DEC-11"
#   "No ephemeris for target '1 Ceres (A801 AA)' after A.D. 2501-JAN-01"
# Bisected per body: ceres, pallas, juno, vesta, pholus and chiron all report
# exactly 1600-2500.
#
# This is a source limit, not a fit limit, and it is what bounds the wide tier:
# the major planets and the Pluto barycenter run on DE441 across 1000-3000, but
# these six cannot. A wide run is therefore clamped to this window at BOTH ends
# -- the ceiling was found the expensive way, 330 requests into a run that had
# already been clamped at the floor.
SMALLBODY_EPOCH_FLOOR = 1600
SMALLBODY_EPOCH_CEILING = 2500

# The fit samples past the requested end: Chebyshev segments run up to
# jd0 + nseg*seg_days, so HorizonsCache.ensure() pads by one maximum segment
# (5844 d = 16 yr). That padding must also land inside the source window, so a
# --wide run stops 16 years short of the ceiling rather than at it. (Learned
# the same expensive way as the ceiling itself: a run clamped exactly to 2500
# still died at request 330/335, in the pad.)
PAD_YEARS = 16
SMALLBODY_WIDE_END = SMALLBODY_EPOCH_CEILING - PAD_YEARS  # 2484

# Sampling step per body, in days.
#
# HorizonsCache.sample() interpolates LINEARLY between cached rows, so the
# sampling step -- not the Chebyshev grid -- sets the accuracy floor for a fast
# body. Measured on the 1600-2484 caches: the chord error across a 2-day gap is
# 3.2-3.8e-5 AU for Pallas/Juno/Vesta (~5000 km), which is ~1.2e-5 AU at 1-day
# spacing, and that is exactly where their fits plateaued -- no (seg, degree),
# however fine, went below ~8e-6 AU. The packs were faithfully reproducing a
# limited input.
#
# Quartering the step cuts that chord error ~16x (it scales with the square of
# the spacing), which clears the 5e-6 AU bar with room. Ceres is slower and
# already passes at 1 day; Pholus and Chiron are distant and slower still
# (Chiron's 1-day interpolation error is 317 km, an order below the asteroids').
STEP_DAYS = {
    "pallas": 0.25, "juno": 0.25, "vesta": 0.25,
    "ceres": 1.0, "pholus": 1.0, "chiron": 1.0,
}


def fit_body(name, year0=RANGE[0], year1=RANGE[1]):
    command, label = BODIES[name]
    jd0, jd1 = julian_day(year0, 1, 1), julian_day(year1, 1, 1)
    step = STEP_DAYS.get(name, 1.0)
    # The step is part of the cache identity: a 6-hour cache is a different
    # (and larger) artifact than a 1-day one for the same span.
    suffix = "" if step == 1.0 else f"_{round(step * 24)}h"
    cache_name = (f"{name}_horizons_cache.json"
                  if (year0, year1) == RANGE and step == 1.0
                  else f"{name}_horizons_cache_{year0}_{year1}{suffix}.json")
    cache = HorizonsCache(os.path.join(HERE, cache_name), command, label)
    cache.ensure(jd0, jd1, step=step, pad_days=5844)

    # Independent epochs: raw cached rows inside the span, which the fit never
    # sampled (it uses Chebyshev-Gauss-Lobatto nodes). See chebyshev.max_error.
    m = (cache._jds >= jd0) & (cache._jds <= jd1)
    test = (cache._jds[m][::37], cache._xs[m][::37],
            cache._ys[m][::37], cache._zs[m][::37])

    print(f"--- {label}: scan seg_days, degree -> node resid, TRUE err "
          f"({len(test[0])} independent epochs), size")
    best = None
    for seg in (1461, 2922, 5844):  # 4, 8, 16 years
        for deg in (8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32):
            data, resid = fit(cache.sample, jd0, jd1, seg, deg, scale=1.0, sig=10)
            size = len(json.dumps(data, separators=(",", ":")))
            true_err = max_error(data, *test)
            ok = "OK" if true_err < RESID_TARGET else "  "
            print(f"  seg={seg:5d} deg={deg:2d}  node={resid:.2e}  "
                  f"true={true_err:.2e} AU ({true_err * AU_KM:7.1f} km)  "
                  f"{size / 1024:6.1f} KB {ok}")
            if true_err < RESID_TARGET and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid, true_err)
    if best is None:
        print(f"ERROR: {name}: no (seg, degree) met {RESID_TARGET} AU "
              f"true error")
        return False

    seg, deg, size, data, resid, true_err = best
    data["provenance"] = {
        "source": "JPL Horizons",
        "body": label,
        "center": "@sun",
        "frame": "heliocentric ecliptic J2000",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{year0}-{year1}",
        "sample_step_days": step,
        "seg_days": seg,
        "degree": deg,
        "fit_residual_au": resid,
        # The honest error: measured at epochs the fit never sampled, unlike
        # fit_residual_au which is node-only.
        "true_error_au": true_err,
        "true_error_basis":
            "max radial error vs raw Horizons samples inside the fitted span",
    }
    for path in (
        os.path.join(HERE, "..", "packages", "caelus", "data", f"{name}_cheb.json"),
        os.path.join(HERE, "astroengine", "data", f"{name}_cheb.json"),
    ):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"  seg={seg} deg={deg}: {os.path.getsize(path) / 1024:.1f} KB -> {path}")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("bodies", nargs="*", help=f"subset of {list(BODIES)}")
    ap.add_argument("--year0", type=int, default=RANGE[0])
    ap.add_argument("--year1", type=int, default=RANGE[1])
    ap.add_argument("--wide", action="store_true",
                    help="shorthand for --year0 1000 --year1 3000 (the lazy wide tier)")
    args = ap.parse_args()
    # --wide means "as wide as the source allows": for small bodies that is
    # 1600-2500, not the 1000-3000 the majors reach. Clamping (with a stated
    # reason) beats a Horizons stack trace hundreds of requests in.
    year0 = SMALLBODY_EPOCH_FLOOR if args.wide else args.year0
    year1 = SMALLBODY_WIDE_END if args.wide else args.year1
    # An explicit window is checked against the *padded* reach, not the bare
    # end year, for the same reason --wide stops short.
    if year0 < SMALLBODY_EPOCH_FLOOR or year1 + PAD_YEARS > SMALLBODY_EPOCH_CEILING:
        print(f"ERROR: Horizons serves small bodies only over "
              f"{SMALLBODY_EPOCH_FLOOR}-{SMALLBODY_EPOCH_CEILING} "
              f"(asked for {year0}-{year1}).\n"
              f"       Their SPK solutions integrate orbits fit to\n"
              f"       19th-century-onward observations, and JPL publishes\n"
              f"       neither earlier nor later epochs.\n"
              f"       The fit also samples {PAD_YEARS} years past --year1 to\n"
              f"       cover its last segment, so the usable end is "
              f"{SMALLBODY_WIDE_END}.\n"
              f"       Use --year0 >= {SMALLBODY_EPOCH_FLOOR} and "
              f"--year1 <= {SMALLBODY_WIDE_END}.")
        sys.exit(2)
    # chiron only refits on an explicit request or a widened window: the
    # default five keep the Tier 2 default behaviour byte-identical.
    default = [b for b in BODIES if b != "chiron"] if (year0, year1) == RANGE \
        else list(BODIES)
    names = args.bodies or default
    bad = [n for n in names if n not in BODIES]
    if bad:
        print(f"unknown bodies: {bad}; known: {list(BODIES)}")
        sys.exit(2)
    results = {n: fit_body(n, year0, year1) for n in names}
    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
