#!/usr/bin/env python3
"""Fit a planet's heliocentric ecliptic-J2000 position -> Chebyshev JSON.

Source: JPL Horizons (public domain), geometric vectors of the planet's
SYSTEM BARYCENTER (Mars 4, Jupiter 5, Saturn 6, Uranus 7, Neptune 8) about
the Sun -- the same targets validate_horizons.py measures, running on DE441
across the full 1000-3000 span. Geometric only: the geocentric pipeline
applies light-time once, the same contract as fit_pluto.py.

Why: VSOP87 represents DE200 (1988, pre-Voyager outer-planet orbits) to 1"
over its published envelopes -- but being 1" from DE200 is not being 1" from
DE441 a millennium out. Measured against Horizons at the 1000/3000 edges the
VSOP87D-sourced planets drift to 10.75" (Mars), 3.02" (Saturn), 17.05"
(Uranus), 15.41" (Neptune) while every Chebyshev-packed body sits at the
frame-convention floor (docs/range-expansion.md, "What the wide-band error
actually is"). A pack fit to Horizons pins the modern source itself; when
`{body}_cheb.json` is on disk both engines route the planet through the
packed-body pipeline (node-loader.ts / chart.py) and VSOP87D becomes the
fallback. No pack, no behaviour change.

Sampling: the cache interpolates linearly between rows, and that chord error
-- not the Chebyshev grid -- floors a fast body (see fit_smallbody.py).
Mars moves ~0.52 deg/day heliocentric, so it samples at 3 hours
(chord error ~2.5e-7 AU); the giants are slow and sample daily. Mars is
therefore the expensive mint: ~5.8M cache rows over the wide span, and a
pack that lands in the megabytes -- the scan prints sizes, and whether the
Mars pack ships in the npm tarball or as an optional download is a decision
to make from the measured size at mint time.

Run in an environment with outbound access to ssd.jpl.nasa.gov and numpy
installed; the data mint cannot run in a sandbox without egress. Afterwards:
regenerate goldens (positions move by up to the drift above), re-run
validate_horizons.py --wide, and move claims only on the measured numbers.

  python3 fit_planet.py mars uranus neptune saturn   # the four that drift
  python3 fit_planet.py jupiter                      # optional (1.23" wide)
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chebyshev import fit, max_error
from astroengine.core import julian_day
from horizons import HorizonsCache

AU_KM = 149597870.7
HERE = os.path.dirname(__file__)
DATA_MONOREPO = os.path.join(HERE, "..", "packages", "caelus", "data")
DATA_ENGINE = os.path.join(HERE, "astroengine", "data")

# Per-body mint parameters. Segment grids scale with the orbital period
# (roughly P/40..P/10, the ratio the Pluto wide pack settled at); DEGREES is
# shared. step is the Horizons sampling interval in days (cache identity --
# see fit_smallbody.py). true_target is the selection bar, measured as TRUE
# error at epochs the fit never sampled: chosen so the worst-case geocentric
# contribution stays under ~0.3" (Mars's bar is tighter because at a close
# opposition it sits 0.37 AU away and angular error is 1/distance).
PLANETS = {
    #         command  step   segs (days)          true_target (AU)
    "mars":    ("4",   0.125, (16, 32, 64),        5e-7),
    "jupiter": ("5",   1.0,   (128, 256, 512),     1e-6),
    "saturn":  ("6",   1.0,   (256, 512, 1024),    1e-6),
    "uranus":  ("7",   1.0,   (731, 1461, 2922),   1e-6),
    "neptune": ("8",   1.0,   (1461, 2922, 5844),  1e-6),
}
DEGREES = (10, 12, 14, 16, 18, 20, 24)
YEAR0, YEAR1 = 1000, 3000  # the wide tier IS the point of these packs


def _independent_epochs(cache, jd0, jd1, stride=37):
    """Raw cached Horizons rows the fit never sampled (it uses Chebyshev-
    Gauss-Lobatto nodes): evaluating against them measures the error BETWEEN
    nodes -- the honest figure (see fit_pluto.py)."""
    jds = cache._jds
    m = (jds >= jd0) & (jds <= jd1)
    return (jds[m][::stride], cache._xs[m][::stride],
            cache._ys[m][::stride], cache._zs[m][::stride])


def mint(name, year0, year1, step_override=None):
    command, step, segs, target = PLANETS[name]
    if step_override is not None:
        step = step_override
        print(f"NOTE: --step {step} overrides the default; the {target:.0e} AU "
              "bar assumes the default sampling and may be unreachable at a "
              "coarser step (chord error scales with step^2).")
    jd0, jd1 = julian_day(year0, 1, 1), julian_day(year1, 1, 1)
    suffix = "" if step == 1.0 else f"_{round(step * 24)}h"
    cache_path = os.path.join(
        HERE, f"{name}_horizons_cache_{year0}_{year1}{suffix}.json")
    cache = HorizonsCache(cache_path, command=command,
                          label=f"{command} {name} barycenter")
    cache.ensure(jd0, jd1, step=step, pad_days=max(segs))

    test = _independent_epochs(cache, jd0, jd1)
    print(f"{name}: scan seg_days, degree -> node resid, TRUE err "
          f"({len(test[0])} independent epochs), size")
    best = None
    for seg in segs:
        for deg in DEGREES:
            data, resid = fit(cache.sample, jd0, jd1, seg, deg,
                              scale=1.0, sig=10)
            size = len(json.dumps(data, separators=(",", ":")))
            true_err = max_error(data, *test)
            ok = "OK" if true_err < target else "  "
            print(f"  seg={seg:5d} deg={deg:2d}  node={resid:.2e}  "
                  f"true={true_err:.2e} AU ({true_err * AU_KM:9.1f} km)  "
                  f"{size / 1024:7.1f} KB {ok}")
            if true_err < target and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid, true_err)
    if best is None:
        print(f"ERROR: {name}: no (seg, degree) met the {target:.0e} AU true-"
              f"error bar. If the floor is flat across degrees it is the "
              f"sampling chord, not the polynomial: refit with a finer --step.")
        return False

    seg, deg, size, data, resid, true_err = best
    data["provenance"] = {
        "source": "JPL Horizons",
        "body": f"{command} {name} barycenter",
        "center": "@sun",
        "frame": "heliocentric ecliptic J2000",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{year0}-{year1}",
        "seg_days": seg,
        "degree": deg,
        "sample_step_days": step,
        "fit_residual_au": resid,
        "true_error_au": true_err,
        "true_error_basis":
            "max radial error vs raw Horizons samples inside the fitted span",
    }
    for root in (DATA_MONOREPO, DATA_ENGINE):
        path = os.path.join(root, f"{name}_cheb.json")
        os.makedirs(root, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"  chosen seg={seg} deg={deg}: "
              f"{os.path.getsize(path) / 1024:.1f} KB -> {path}")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("bodies", nargs="+", choices=sorted(PLANETS),
                    help="planets to mint (mars saturn uranus neptune drift; "
                         "jupiter is optional)")
    ap.add_argument("--year0", type=int, default=YEAR0)
    ap.add_argument("--year1", type=int, default=YEAR1)
    ap.add_argument("--step", type=float, default=None,
                    help="override the per-body Horizons sampling step (days)")
    args = ap.parse_args()
    ok = True
    for name in args.bodies:
        ok = mint(name, args.year0, args.year1, args.step) and ok
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
