#!/usr/bin/env python3
"""Fit the eight Hamburg-school (Uranian) fictitious bodies as a Kepler
element pack.

Swiss Ephemeris computes these bodies as unperturbed ellipses with
constant elements (the Hamburg school defines them that way:
Witte/Sieggruen). The mean motions are symbolic — NOT Kepler's third law
from a — so every element is recovered empirically from Swiss Ephemeris
heliocentric J2000 states (SE as calibration oracle, never as source):

  1. a, e, i, node, peri from one state vector at J2000 (consistent
     in-plane basis throughout; peri from the eccentricity vector).
  2. M0 and n from mean anomalies measured at ladder baselines
     (1/10/100/148 years), each rung resolving the winding count.
  3. For eccentric bodies the anomaly extraction (acos((1-r/a)/e)) is
     noise-limited near apsides, so n and M0 get a Theil-Sen refinement
     over 50 epochs.

Validation (printed): worst heliocentric arc vs the oracle, 1800-2149.
Expected: circular bodies exact (~0.005"), Cupido/Hades/Kronos <1",
Zeus ~25" (smallest eccentricity: fit is noise-floor-limited; Uranian
astrology works in arcminutes).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import swisseph as swe
from astroengine.core import julian_day, jd_tt, J2000

FLG = (swe.FLG_MOSEPH | swe.FLG_HELCTR | swe.FLG_TRUEPOS | swe.FLG_NONUT
       | swe.FLG_J2000 | swe.FLG_XYZ)
GM_SUN = 0.0002959122082855911  # AU^3/day^2 (only used for a from vis-viva)

URANIANS = {
    "cupido": swe.CUPIDO, "hades": swe.HADES, "zeus": swe.ZEUS,
    "kronos": swe.KRONOS, "apollon": swe.APOLLON, "admetos": swe.ADMETOS,
    "vulkanus": swe.VULKANUS, "poseidon": swe.POSEIDON,
}


def sample(ipl, jde):
    return swe.calc(jde, ipl, FLG)[0][:3]


def state(ipl, jde, h=0.05):
    r = sample(ipl, jde)
    r0 = sample(ipl, jde - h)
    r1 = sample(ipl, jde + h)
    return r, [(r1[k] - r0[k]) / (2 * h) for k in range(3)]


def kepler_xyz(d, jde):
    """Propagate an element dict -> heliocentric ecliptic-J2000 xyz (AU)."""
    a, e, i = d["a"], d["e"], d["i"]
    node, w = d["node"], d["peri"]
    M = d["M0"] + d["n"] * (jde - J2000)
    E = M
    for _ in range(30):
        E = E - (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
    xv = a * (math.cos(E) - e)
    yv = a * math.sqrt(1 - e * e) * math.sin(E)
    cw, sw = math.cos(w), math.sin(w)
    cn, sn = math.cos(node), math.sin(node)
    ci, si = math.cos(i), math.sin(i)
    xp = xv * cw - yv * sw
    yp = xv * sw + yv * cw
    return (xp * cn - yp * sn * ci, xp * sn + yp * cn * ci, yp * si)


def fit_body(ipl):
    r, v = state(ipl, J2000)
    rn = math.sqrt(sum(c * c for c in r))
    v2 = sum(c * c for c in v)
    a = 1.0 / (2.0 / rn - v2 / GM_SUN)
    hv = (r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2],
          r[0] * v[1] - r[1] * v[0])
    hn = math.sqrt(sum(c * c for c in hv))
    hu = tuple(c / hn for c in hv)
    inc = math.acos(hu[2])
    node = math.atan2(hu[0], -hu[1]) % (2 * math.pi)
    rv = sum(r[k] * v[k] for k in range(3))
    ev = [(v2 * r[k] - rv * v[k]) / GM_SUN - r[k] / rn for k in range(3)]
    e = math.sqrt(sum(c * c for c in ev))
    e1 = (math.cos(node), math.sin(node), 0.0)
    e2 = (hu[1] * e1[2] - hu[2] * e1[1], hu[2] * e1[0] - hu[0] * e1[2],
          hu[0] * e1[1] - hu[1] * e1[0])
    w = 0.0 if e < 1e-6 else math.atan2(
        sum(ev[k] * e2[k] for k in range(3)),
        sum(ev[k] * e1[k] for k in range(3)),
    ) % (2 * math.pi)

    def m_at(jde):
        rr, vv = state(ipl, jde)
        rrn = math.sqrt(sum(c * c for c in rr))
        if e < 1e-6:
            return math.atan2(sum(rr[k] * e2[k] for k in range(3)),
                              sum(rr[k] * e1[k] for k in range(3))) % (2 * math.pi)
        x = max(-1.0, min(1.0, (1 - rrn / a) / e))
        E = math.acos(x)
        if sum(rr[k] * vv[k] for k in range(3)) < 0:
            E = 2 * math.pi - E
        return E - e * math.sin(E)

    m0 = m_at(J2000) % (2 * math.pi)
    n = None
    for base in (365.25, 3652.5, 36525.0, 54000.0):
        m1 = m_at(J2000 + base) % (2 * math.pi)
        if n is None:
            n = ((m1 - m0) % (2 * math.pi)) / base
        else:
            k = round((m0 + n * base - m1) / (2 * math.pi))
            n = (m1 + 2 * math.pi * k - m0) / base
    d = dict(a=a, e=e, i=inc, node=node, peri=w, M0=m0, n=n)

    if e >= 1e-6:  # Theil-Sen refinement: anomaly extraction is noisy
        pts = []
        for k in range(50):
            jde = jd_tt(julian_day(1800 + k * 7, 3, 11))
            t = jde - J2000
            res = ((m_at(jde) - (m0 + n * t) + math.pi) % (2 * math.pi)) - math.pi
            pts.append((t, res))
        slopes = sorted((p2[1] - p1[1]) / (p2[0] - p1[0])
                        for i1, p1 in enumerate(pts) for p2 in pts[i1 + 1:])
        d["n"] += slopes[len(slopes) // 2]
        d["M0"] += sorted(res - d["n"] * t + n * t
                          for t, res in pts)[len(pts) // 2]
    return d


def main():
    out = {"epoch": J2000, "frame": "heliocentric ecliptic J2000",
           "provenance": ("Kepler elements fitted to Swiss Ephemeris 2.10's "
                          "built-in Hamburg-school orbits (constant-element "
                          "ellipses per Witte/Sieggruen, symbolic mean "
                          "motions); SE used as calibration oracle only"),
           "bodies": {}}
    for name, ipl in URANIANS.items():
        d = fit_body(ipl)
        out["bodies"][name] = d
        worst = 0.0
        for y in range(1800, 2150, 7):
            jde = jd_tt(julian_day(y, 3, 11))
            o = kepler_xyz(d, jde)
            rf = sample(ipl, jde)
            on = math.sqrt(sum(c * c for c in o))
            rn = math.sqrt(sum(c * c for c in rf))
            dot = sum(o[k] * rf[k] for k in range(3))
            worst = max(worst, math.acos(max(-1, min(1, dot / (on * rn)))) * 206265)
        period = 2 * math.pi / d["n"] / 365.25
        print(f"{name:9s} period={period:7.2f} yr  helio worst {worst:8.4f}\"")
    for path in (
        os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                     "data", "uranian_kepler.json"),
        os.path.join(os.path.dirname(__file__), "astroengine", "data",
                     "uranian_kepler.json"),
    ):
        with open(path, "w") as f:
            json.dump(out, f, separators=(",", ":"))
        print("->", path)


if __name__ == "__main__":
    main()
