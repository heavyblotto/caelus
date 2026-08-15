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
    # Earth is the highest-leverage pack in this table even though Earth is
    # never a chart body: every geocentric direction is `body - earth`, so
    # Earth's own error is a floor under every other body, amplified by
    # 1/distance. Measured against DE441, VSOP87D Earth is off by 2763 km at
    # 2965 (3.81" at 1 AU, 10.3" at Mars's perigee), which is exactly the
    # ~4" floor the unpacked bodies show and the reason the Mars pack alone
    # bought almost nothing. Command 399 is the Earth CENTER, matching what
    # VSOP87D's "earth" series represents (not the Earth-Moon barycenter, 3).
    # Its bar is the tightest here because the error is divided by the
    # distance to whatever body is being observed, not by 1 AU.
    #
    # The step is set by the interpolation chord, not the polynomial: Earth
    # moves fast enough that a 0.5-day cache floors any fit at ~1440 km
    # (measured, and the first mint failed on exactly that plateau -- flat
    # across every degree). The chord scales with h^2, so 3 hours gives ~90 km
    # = 0.124" at 1 AU, which sits at the same level as the Mars pack's own
    # 0.135" contribution. 90-minute sampling would reach 22 km, but that is
    # finer than the targets Earth is differenced against, so it buys nothing
    # for twice the fetch.
    "earth":   ("399", 0.125, (16, 32, 64),        7e-7),
    # Mercury and Venus join once Earth is packed. They looked fine before
    # (0.5" and 4.3" wide) because Earth's own VSOP error was partly
    # CANCELLING theirs -- same theory generation, correlated drift. Packing
    # Earth removed that accidental cancellation and exposed the real figures:
    # Venus's own heliocentric error is 1877 km at 2965 (9.24" at 0.28 AU,
    # matching the 8.79" it then measured), Mercury's 1105 km (2.50").
    #
    # 90-minute sampling, the finest step in this table, because these two are
    # the fastest bodies AND the closest: their error is divided by a small
    # geocentric distance, so the same kilometres buy fewer arcseconds. A
    # 3-hour cache floors Venus at 168 km (0.83" at 0.28 AU -- measured, the
    # first attempt failed on exactly that plateau) and Mercury near 307 km.
    # Halving the step quarters the chord: 42 km for Venus (0.21"), which
    # keeps them in line with the rest of the wide band rather than leaving
    # the inner planets as the outliers everything else no longer is.
    "mercury": ("199", 0.0625, (8, 16, 32),        3e-7),
    "venus":   ("299", 0.0625, (16, 32, 64),       3e-7),
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
    # The suffix must identify the step exactly. Rounding to whole hours
    # collides: 0.0625 d (90 min) and 0.0833 d (2 h) both round to "_2h", so
    # two different caches would share a filename. Minutes below an hour.
    if step == 1.0:
        suffix = ""
    elif step * 24 == int(step * 24):
        suffix = f"_{int(step * 24)}h"
    else:
        suffix = f"_{round(step * 1440)}m"
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
