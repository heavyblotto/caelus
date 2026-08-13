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
from astroengine.chebyshev import fit
from astroengine.core import julian_day
from horizons import HorizonsCache

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

# Horizons will not serve small bodies before this epoch: their SPK solutions
# are fit to observations that begin with the 19th-century discoveries, so JPL
# does not integrate them back past ~1600 (Ceres: "No ephemeris for target
# '1 Ceres (A801 AA)' prior to A.D. 1599-DEC-11"; verified by bisection).
#
# This is a source limit, not a fit limit, and it bounds the wide tier: the
# major planets and the Pluto barycenter run on DE441 across 1000-3000, but
# these six cannot. A wide run therefore starts here, not at 1000.
SMALLBODY_EPOCH_FLOOR = 1600


def fit_body(name, year0=RANGE[0], year1=RANGE[1]):
    command, label = BODIES[name]
    jd0, jd1 = julian_day(year0, 1, 1), julian_day(year1, 1, 1)
    cache_name = (f"{name}_horizons_cache.json" if (year0, year1) == RANGE
                  else f"{name}_horizons_cache_{year0}_{year1}.json")
    cache = HorizonsCache(os.path.join(HERE, cache_name), command, label)
    cache.ensure(jd0, jd1, step=1.0, pad_days=5844)

    print(f"--- {label}: scan seg_days, degree -> residual AU, size")
    best = None
    for seg in (1461, 2922, 5844):  # 4, 8, 16 years
        for deg in (8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32):
            data, resid = fit(cache.sample, jd0, jd1, seg, deg, scale=1.0, sig=10)
            size = len(json.dumps(data, separators=(",", ":")))
            ok = "OK" if resid < RESID_TARGET else "  "
            print(f"  seg={seg:5d} deg={deg:2d}  resid={resid:.2e} AU  "
                  f"{size / 1024:6.1f} KB {ok}")
            if resid < RESID_TARGET and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid)
    if best is None:
        print(f"ERROR: {name}: no (seg, degree) met {RESID_TARGET} AU")
        return False

    seg, deg, size, data, resid = best
    data["provenance"] = {
        "source": "JPL Horizons",
        "body": label,
        "center": "@sun",
        "frame": "heliocentric ecliptic J2000",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{year0}-{year1}",
        "seg_days": seg,
        "degree": deg,
        "fit_residual_au": resid,
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
    # the ~1600 SPK floor, not the 1000 the majors reach. Clamping (with a
    # stated reason) beats a Horizons stack trace 700 requests in.
    year0 = SMALLBODY_EPOCH_FLOOR if args.wide else args.year0
    year1 = 3000 if args.wide else args.year1
    if year0 < SMALLBODY_EPOCH_FLOOR:
        print(f"ERROR: Horizons has no small-body ephemeris before "
              f"{SMALLBODY_EPOCH_FLOOR} (asked for {year0}).\n"
              f"       Small-body SPK solutions are fit to 19th-century-onward\n"
              f"       observations; JPL does not integrate them back further.\n"
              f"       Use --year0 {SMALLBODY_EPOCH_FLOOR} or later.")
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
