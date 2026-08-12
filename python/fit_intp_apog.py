#!/usr/bin/env python3
"""Fit the interpolated ("natural") lunar apogee -> Chebyshev JSON.

Concept (Swiss Ephemeris General Documentation, Dieter Koch): the osculating
lunar apogee swings ~30 deg back and forth each month -- an artifact of
fitting a two-body ellipse to a heavily perturbed orbit -- so the object
astrologers usually want is an *interpolation between the Moon's real
passages through apogee*, which Koch calls the interpolated or natural
apogee (SE_INTP_APOG). This is a clean-room construction from that concept:
no Swiss Ephemeris source code was read.

Construction (the passage-interpolated fitting recipe published with the
LibEphemeris methodology, kerykeion.net/libephemeris -- fit against a
DE-derived ground truth):
  1. find apogee passage times as maxima of the Moon's geocentric distance,
     from a DE-derived ephemeris (Caelus's own precise-Moon Chebyshev tier,
     a JPL fit; see moon_cheb provenance);
  2. at each passage the apsis coincides with the Moon itself, so take the
     Moon's apparent ecliptic (lon, lat) there;
  3. interpolate smoothly between passages: a natural cubic spline on the
     unwrapped longitude and on the latitude, knotted at the passages;
  4. refit the spline as a compact segmented Chebyshev pack (unit vectors on
     the ecliptic of date), evaluated by the same runtime as every other pack.

Honesty note (carried into provenance and docs/gap-analysis.md): Swiss
Ephemeris derives its variant from analytic lunar theory, so degree-scale
differences vs SE are expected -- LibEphemeris reports ~1.5 deg RMS against
SE for the same construction. The concept (a smoothed apsis advancing ~3 deg
per anomalistic month with no monthly oscillation) is the same.

The pack stores true-equinox-of-date coordinates (the engine's apparent-Moon
frame, nutation included), so the runtime applies NO precession/light-time/
aberration -- exactly like the Lilith points. Runs fully offline: every
input is the engine's own data.

Usage: python3 fit_intp_apog.py [--cache PATH]
  --cache: optional JSON scratch file for the passage march (the expensive
           step, ~4 min); reruns of the fit scan then start instantly.
"""
import argparse
import bisect
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import core
from astroengine.chart import Engine
from astroengine.chebyshev import fit
from astroengine.core import jd_tt

OUT_MONOREPO = os.path.join(
    os.path.dirname(__file__), "..", "packages", "caelus", "data",
    "intp_apog_cheb.json")
OUT_ENGINE = os.path.join(
    os.path.dirname(__file__), "astroengine", "data", "intp_apog_cheb.json")

ANOMALISTIC_MONTH = 27.5546  # days, mean apogee-to-apogee spacing
INV_PHI = (math.sqrt(5.0) - 1.0) / 2.0


def golden_max(f, a, b, tol=1e-4):
    """Golden-section search for the maximum of f on [a, b]."""
    c = b - INV_PHI * (b - a)
    d = a + INV_PHI * (b - a)
    fc, fd = f(c), f(d)
    while (b - a) > tol:
        if fc > fd:
            b, d, fd = d, c, fc
            c = b - INV_PHI * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + INV_PHI * (b - a)
            fd = f(d)
    return (a + b) / 2.0


class NaturalSpline:
    """Natural cubic spline (pure Python: standard tridiagonal solve)."""

    def __init__(self, xs, ys):
        n = len(xs)
        h = [xs[i + 1] - xs[i] for i in range(n - 1)]
        # Solve for interior second derivatives; natural ends are zero.
        # Thomas algorithm on the standard spline tridiagonal system.
        sub = [0.0] * n
        diag = [1.0] * n
        sup = [0.0] * n
        rhs = [0.0] * n
        for i in range(1, n - 1):
            sub[i] = h[i - 1]
            diag[i] = 2.0 * (h[i - 1] + h[i])
            sup[i] = h[i]
            rhs[i] = 6.0 * ((ys[i + 1] - ys[i]) / h[i]
                            - (ys[i] - ys[i - 1]) / h[i - 1])
        for i in range(1, n):
            w = sub[i] / diag[i - 1]
            diag[i] -= w * sup[i - 1]
            rhs[i] -= w * rhs[i - 1]
        m = [0.0] * n
        m[n - 1] = rhs[n - 1] / diag[n - 1]
        for i in range(n - 2, -1, -1):
            m[i] = (rhs[i] - sup[i] * m[i + 1]) / diag[i]
        self.xs, self.ys, self.m, self.h = xs, ys, m, h

    def __call__(self, x):
        i = bisect.bisect_right(self.xs, x) - 1
        i = max(0, min(i, len(self.xs) - 2))
        h = self.h[i]
        a = (self.xs[i + 1] - x) / h
        b = (x - self.xs[i]) / h
        return (a * self.ys[i] + b * self.ys[i + 1]
                + ((a ** 3 - a) * self.m[i] + (b ** 3 - b) * self.m[i + 1])
                * h * h / 6.0)


# The spline is C2 only -- its third derivative jumps at every passage knot
# (~27.55 d apart) -- which caps per-segment Chebyshev convergence near
# N^-3.5. Segments must therefore sit near the knot spacing, and ~4000 knots
# x 2 angles is the irreducible information content: the pack lands near a
# megabyte whatever the (seg, degree) split. The scan just finds the
# cheapest combination that clears the 5e-6 (~1") residual bar.
SCAN = {28: (6, 8, 10, 12), 46: (8, 10, 12, 14, 16),
        91: (14, 18, 22, 26, 30), 182: (18, 24, 30)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=None,
                    help="scratch JSON for the passage march (speeds reruns)")
    args = ap.parse_args()
    eng = Engine("full")
    moon = core._moon_cheb()
    if not moon:
        print("ERROR: no moon_cheb pack in astroengine/data -- the precise-Moon"
              " tier is the DE-derived ground truth this fit needs")
        sys.exit(1)
    tier = "full" if os.path.exists(
        os.path.join(core.DATA, "moon_cheb.full.json")) else "embedded"
    print(f"moon source: precise-Moon Chebyshev tier '{tier}' "
          f"(jd {moon.jd0}..{moon.jd1})")

    # Window: the precise-Moon span, inset so every sample (UT -> TT) stays
    # inside moon_in_precise_range and no analytic-fallback discontinuity can
    # leak into the distance march.
    lo, hi = moon.jd0 + 0.2, moon.jd1 - 0.2
    assert core.moon_in_precise_range(jd_tt(lo))
    assert core.moon_in_precise_range(jd_tt(hi))

    def dist(jd_ut):
        # Geocentric Moon distance, the same quantity engine.position("moon",
        # jd)["dist"] reports (going through _ecliptic directly skips
        # position()'s speed finite differences: a 3x cheaper march).
        return eng._ecliptic("moon", jd_tt(jd_ut))[2]

    # --- 1. apogee passages: maxima of geocentric distance ------------------
    cached = None
    if args.cache and os.path.exists(args.cache):
        with open(args.cache) as f:
            cached = json.load(f)
        passages = cached["passages"]
        print(f"loaded {len(passages)} passages from cache {args.cache}")
    else:
        print("marching daily for apogee brackets...")
        n_days = int(hi - lo)
        ts = [lo + i for i in range(n_days + 1)]
        ds = [dist(t) for t in ts]
        passages = []
        for i in range(1, len(ds) - 1):
            if ds[i - 1] < ds[i] >= ds[i + 1]:
                passages.append(
                    golden_max(dist, ts[i - 1], ts[i + 1], tol=1e-4))
        print(f"found {len(passages)} apogee passages")

    gaps = [passages[i + 1] - passages[i] for i in range(len(passages) - 1)]
    bad = [g for g in gaps if not (24.5 <= g <= 29.5)]
    if bad:
        print(f"ERROR: {len(bad)} passage gaps outside 24.5-29.5 d "
              f"(min {min(gaps):.2f}, max {max(gaps):.2f})")
        sys.exit(1)
    print(f"passage spacing {min(gaps):.2f}..{max(gaps):.2f} d "
          f"(mean {sum(gaps) / len(gaps):.4f}, anomalistic month "
          f"{ANOMALISTIC_MONTH})")

    # --- 2. the Moon IS the apsis at each passage ---------------------------
    if cached:
        lons, lats = cached["lons"], cached["lats"]
    else:
        print("sampling moon lon/lat at passages...")
        lons, lats = [], []
        for t in passages:
            p = eng.position("moon", t)
            lons.append(p["lon"])
            lats.append(p["lat"])
        if args.cache:
            with open(args.cache, "w") as f:
                json.dump({"passages": passages, "lons": lons, "lats": lats}, f)

    # --- 3. natural cubic splines on unwrapped lon + lat --------------------
    # Unwrap by minimal signed step: the apogee advances ~3 deg per cycle on
    # average (the 8.85-yr apsidal precession) but regresses on ~1 cycle in 5,
    # so cumulative-sum the wrapped deltas rather than assume forward motion.
    unwrapped = [lons[0]]
    for i in range(1, len(lons)):
        unwrapped.append(unwrapped[-1]
                         + ((lons[i] - lons[i - 1] + 180.0) % 360.0 - 180.0))
    # Knots in TT: the runtime evaluates the pack at jd_tt.
    knots = [jd_tt(t) for t in passages]
    spl_lon = NaturalSpline(knots, unwrapped)
    spl_lat = NaturalSpline(knots, lats)

    # --- 4. Chebyshev refit of the splines (ecliptic-of-date unit vectors) --
    def sample(jds):
        X, Y, Z = [], [], []
        for jd in np.atleast_1d(jds):
            L = math.radians(spl_lon(float(jd)))
            B = math.radians(spl_lat(float(jd)))
            cb = math.cos(B)
            X.append(cb * math.cos(L))
            Y.append(cb * math.sin(L))
            Z.append(math.sin(B))
        return np.array(X), np.array(Y), np.array(Z)

    jd0 = knots[0]
    print("scan: seg_days, degree -> residual (unit vector), size")
    best = None
    for seg, degrees in SCAN.items():
        # Clamp so the fit's last segment never samples past the last knot
        # (the spline is an interpolant, not an extrapolant).
        nseg = int((knots[-1] - jd0) / seg)
        jd1 = jd0 + nseg * seg
        for deg in degrees:
            data, resid = fit(sample, jd0, jd1, seg, deg, scale=1.0, sig=9)
            size = len(json.dumps(data, separators=(",", ":")))
            ok = "OK" if resid < 5e-6 else "  "
            print(f"  seg={seg:3d} deg={deg:2d}  resid={resid:.2e}  "
                  f"{size / 1024:6.1f} KB {ok}")
            if resid < 5e-6 and (best is None or size < best[2]):
                best = (seg, deg, size, data, resid, jd1)

    if best is None:
        print("ERROR: no (seg, degree) met the 5e-6 residual target")
        sys.exit(1)
    seg, deg, size, data, resid, jd1 = best

    # Invariant check: the pack at a passage must reproduce the Moon's
    # longitude there (the spline passes through the knots; the Chebyshev
    # refit adds only the fit residual, ~arcsec).
    from astroengine.chebyshev import ChebSeries
    series = ChebSeries(data)
    worst = 0.0
    step = max(1, len(passages) // 200)
    for i in range(0, len(passages), step):
        tau = knots[i]
        if not (series.jd0 <= tau <= series.jd1):
            continue
        x, y, z = series.xyz(tau)
        lon = math.degrees(math.atan2(y, x)) % 360.0
        worst = max(worst, abs((lon - lons[i] + 180.0) % 360.0 - 180.0))
    print(f"passage invariant: worst |pack lon - moon lon| = {worst * 3600:.2f}\"")

    # Four spread passages for the golden's invariant replay (UT instants;
    # both engines convert to TT internally).
    n = len(passages)
    samples = [{"jd_ut": round(passages[i], 6),
                "moon_lon": lons[i], "moon_lat": lats[i]}
               for i in (n // 8, n // 3, n // 2, (5 * n) // 6)]

    data["provenance"] = {
        "source": f"Caelus precise-Moon tier (DE-derived; moon_cheb.{tier})",
        "method": ("passage-interpolated natural apogee (Koch's concept, "
                   "Swiss Ephemeris General Documentation; passage-spline "
                   "construction per the LibEphemeris methodology, "
                   "kerykeion.net/libephemeris). Clean-room: degree-scale "
                   "differences vs SE's analytic variant are expected "
                   "(~1.5 deg RMS reported by LibEphemeris)."),
        "frame": "geocentric true ecliptic of date, unit vector",
        "range": f"jd {data['jd0']}..{jd1} (TT)",
        "seg_days": seg,
        "degree": deg,
        "fit_residual": resid,
        "passages": len(passages),
        "passage_samples": samples,
    }

    for path in (OUT_MONOREPO, OUT_ENGINE):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"chosen seg={seg} deg={deg}: "
              f"{os.path.getsize(path) / 1024:.1f} KB -> {path}")


if __name__ == "__main__":
    main()
