#!/usr/bin/env python3
"""Fit Pluto heliocentric ecliptic-J2000 position -> Chebyshev JSON.

Source: JPL Horizons (public domain). Geometric vectors only -- no light-time
baked in -- so the geocentric pipeline applies it once, the same contract as
fit_chiron.py / fit_smallbody.py.

Why: the embedded engine computes Pluto from the Meeus ch.37 series, which is
valid only over 1885-2099. A Chebyshev pack fit to Horizons extends Pluto to a
wide range at full precision; when present it is loaded into `chebPacks.pluto`
(node-loader.ts) and supersedes the Meeus series. Pluto is slow (≈248-yr
period), so long segments resolve it cheaply.

Run in an environment with outbound access to ssd.jpl.nasa.gov and numpy
installed; the data mint and validation cannot run in a sandbox without egress.
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chebyshev import fit, max_error
from astroengine.core import julian_day
from horizons import HorizonsCache

AU_KM = 149597870.7  # for reporting fit error in kilometres
OUT_MONOREPO = os.path.join(
    os.path.dirname(__file__), "..", "packages", "caelus", "data", "pluto_cheb.json"
)
OUT_ENGINE = os.path.join(
    os.path.dirname(__file__), "astroengine", "data", "pluto_cheb.json"
)

# Default fit window. The Pluto *body* center (999) wobbles around the
# Pluto-Charon barycenter every 6.39 d at ~1.4e-5 AU (~2130 km) -- a
# high-frequency signal no multi-year Chebyshev can absorb, so 999 floors the
# fit at ~1.4e-5 AU. We fit the *barycenter* (command "9"): it is smooth
# (Charon averaged out), matches the Meeus ch.37 series this pack supersedes
# (also barycenter, no Charon term), and Horizons serves it across the full
# DE441 span. The 999-vs-barycenter offset is <= ~0.1" geocentric, below the
# engine's other Pluto error terms.
#
# The wide tier (--wide, 1000-3000 CE) runs the identical pipeline over the
# span the tradition's own era needs; DE441 covers it. Pluto is slow, so the
# pack grows roughly linearly with the window (~4x the 1700-2200 pack).
YEAR0, YEAR1 = 1700, 2200

# Scan grids. The default window keeps its original grid so the shipped
# 1700-2200 pack stays byte-identical on a refit; the wide tier scans finer
# segments because long segments hit a noise floor there (see below).
SEGS_DEFAULT = (5844, 11688, 23376)   # 16, 32, 64 yr
SEGS_WIDE = (1461, 2922, 5844)        # 4, 8, 16 yr
DEGREES = (10, 12, 14, 16, 18, 20, 24)

# Selection bar for the wide tier, measured as *true* error at epochs the fit
# never saw (fit()'s own residual is node-only and understates it -- the
# shipped 1700-2200 pack quotes 4.1e-6 AU and measures 9.6e-6 AU that way).
#
# 1e-6 AU is ~0.007" at 30 AU: far below astrological resolution and far
# under Pluto's 4" canonical accuracy quantum, but chosen so the pack has real
# headroom rather than squeaking under the bar. At seg=5844 the residual
# plateaus near 5e-6 AU regardless of degree -- that is the 1-day linear
# interpolation in HorizonsCache.sample(), not polynomial truncation, so more
# degrees cannot fix it and shorter segments must.
WIDE_TRUE_TARGET_AU = 1e-6


def _independent_epochs(cache, jd0, jd1, stride=37):
    """Raw cached Horizons rows inside the fitted span.

    These are epochs the fit never sampled (it uses Chebyshev-Gauss-Lobatto
    nodes), so evaluating against them measures the error *between* nodes --
    the honest figure. Thinned by `stride` to keep the scan quick.
    """
    jds = cache._jds
    m = (jds >= jd0) & (jds <= jd1)
    return (jds[m][::stride], cache._xs[m][::stride],
            cache._ys[m][::stride], cache._zs[m][::stride])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--year0", type=int, default=YEAR0)
    ap.add_argument("--year1", type=int, default=YEAR1)
    ap.add_argument("--wide", action="store_true",
                    help="shorthand for --year0 1000 --year1 3000 (the lazy wide tier)")
    args = ap.parse_args()
    year0 = 1000 if args.wide else args.year0
    year1 = 3000 if args.wide else args.year1
    cache_path = os.path.join(
        os.path.dirname(__file__),
        "pluto_horizons_cache.json" if (year0, year1) == (1700, 2200)
        else f"pluto_horizons_cache_{year0}_{year1}.json")
    jd0, jd1 = julian_day(year0, 1, 1), julian_day(year1, 1, 1)
    # Pluto barycenter (9): smooth (Charon wobble averaged out), full DE441 range.
    cache = HorizonsCache(cache_path, command="9", label="9 Pluto barycenter")
    # pad past jd1: Chebyshev segments sample up to jd0 + nseg*seg_days > jd1.
    cache.ensure(jd0, jd1, step=1.0, pad_days=23376)
    pluto_helio = cache.sample

    # The wide tier selects on true error at independent epochs; the default
    # window keeps the original node-residual rule so a refit reproduces the
    # shipped pack byte for byte.
    segs = SEGS_WIDE if args.wide else SEGS_DEFAULT
    if args.wide:
        test = _independent_epochs(cache, jd0, jd1)
        print(f"scan: seg_days, degree -> node resid, TRUE err "
              f"({len(test[0])} independent epochs), size")
    else:
        test = None
        print("scan: seg_days, degree -> residual AU, size")

    best = None
    for seg in segs:
        for deg in DEGREES:
            data, resid = fit(pluto_helio, jd0, jd1, seg, deg, scale=1.0, sig=10)
            size = len(json.dumps(data, separators=(",", ":")))
            if test is None:
                ok = "OK" if resid < 5e-6 else "  "
                print(f"  seg={seg:5d} deg={deg:2d}  resid={resid:.2e} AU  "
                      f"{size / 1024:6.1f} KB {ok}")
                if resid < 5e-6 and (best is None or size < best[2]):
                    best = (seg, deg, size, data, resid, None)
            else:
                true_err = max_error(data, *test)
                ok = "OK" if true_err < WIDE_TRUE_TARGET_AU else "  "
                print(f"  seg={seg:5d} deg={deg:2d}  node={resid:.2e}  "
                      f"true={true_err:.2e} AU ({true_err * AU_KM:7.1f} km)  "
                      f"{size / 1024:6.1f} KB {ok}")
                # Smallest pack that meets the true-error bar.
                if true_err < WIDE_TRUE_TARGET_AU and (best is None or size < best[2]):
                    best = (seg, deg, size, data, resid, true_err)

    if best is None:
        bar = (f"{WIDE_TRUE_TARGET_AU:.0e} AU true error" if test is not None
               else "5e-6 AU residual")
        print(f"ERROR: no (seg, degree) met the {bar} target")
        sys.exit(1)

    seg, deg, size, data, resid, true_err = best
    data["provenance"] = {
        "source": "JPL Horizons",
        "body": "9 Pluto barycenter",
        "center": "@sun",
        "frame": "heliocentric ecliptic J2000",
        "correction": "geometric (VEC_CORR=NONE)",
        "range": f"{year0}-{year1}",
        "seg_days": seg,
        "degree": deg,
        "fit_residual_au": resid,
    }
    if true_err is not None:
        # The honest error: measured at epochs the fit never sampled, unlike
        # fit_residual_au which is node-only.
        data["provenance"]["true_error_au"] = true_err
        data["provenance"]["true_error_basis"] = (
            "max radial error vs raw Horizons samples inside the fitted span"
        )

    for path in (OUT_MONOREPO, OUT_ENGINE):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"\nchosen seg={seg} deg={deg}: {os.path.getsize(path) / 1024:.1f} KB")
        print(f"  -> {path}")


if __name__ == "__main__":
    main()
