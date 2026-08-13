#!/usr/bin/env python3
"""Validate the engine directly against JPL Horizons apparent positions.

The standing validation chain terminates at Swiss Ephemeris; this script
makes the claims stand on JPL itself: it fetches geocentric APPARENT
RA/Dec (Horizons OBSERVER quantity 2, airless — light-time, aberration,
precession, and nutation applied by JPL) for the major bodies at sampled
epochs, compares engine.position()'s ra/dec, and writes
horizons-accuracy.json. Needs ssd.jpl.nasa.gov — run locally; the sample
cache (~1 MB) is committed for reproducibility.

Usage: python3 validate_horizons.py
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day, jd_tt, delta_t

HERE = os.path.dirname(__file__)
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE = os.path.join(HERE, "horizons_apparent_cache.json")

# Horizons COMMAND per body. Mars and the giants use their SYSTEM BARYCENTER
# (4, 5, 6, 7, 8) rather than the planet center (499, 599, 699, 799, 899):
# the center-of-body ephemerides are bounded by their satellite solutions and
# return "No ephemeris for target ... prior to A.D. 1600" (verified per body),
# while the barycenters run across the full DE441 span. This is the same
# distinction already made for Pluto (9, not 999) -- there for smoothness,
# here for reach.
#
# Measured effect of the switch (engine vs Horizons, sampled 1900/2000/2100):
# Mars is identical to 4 decimals (its moons are negligible); Uranus improves
# markedly (0.32" -> 0.07" at 1900, 0.31" -> 0.02" at 2100) and Neptune and
# Jupiter improve slightly, consistent with VSOP87D being a barycentric theory
# for the giants. Saturn is the one body that reads slightly WORSE against the
# barycenter (~0.02-0.04"), still far inside its published bound.
#
# So this is not a free relabelling: it shifts the measured per-body numbers at
# the hundredth-arcsecond level. It is the correct comparison (like body to
# like) and it is what makes the pre-1600 bands measurable at all, but any
# accuracy figure regenerated after this change must be re-read, not assumed
# unchanged.
#
# Mercury, Venus, the Moon (301), and the Sun (10) have no such bound and are
# requested directly.
BODIES = {
    "sun": "10", "moon": "301", "mercury": "199", "venus": "299",
    "mars": "4", "jupiter": "5", "saturn": "6", "uranus": "7",
    "neptune": "8", "pluto": "9", "chiron": "2060", "ceres": "1;",
    "pallas": "2;", "juno": "3;", "vesta": "4;", "pholus": "5145;",
}
# Bodies measured out to the 1800/2200 edges. The asteroid + Chiron Chebyshev
# packs span only 1850-2150, so they are not exercised past that; the majors
# (VSOP87D) and Pluto (1700-2212 pack) and the Moon (series fallback outside the
# 1850-2150 cheb tier) are.
EDGE_BODIES = {"sun", "moon", "mercury", "venus", "mars", "jupiter",
               "saturn", "uranus", "neptune", "pluto"}

# Spread the time-of-day across the day (golden-ratio fractions) so epochs
# aren't all at the same clock time.
def _band_epochs(years):
    return [jd_tt(julian_day(y, (k * 5) % 12 + 1, (k * 7) % 27 + 1)
                  + (k * 0.6180339887) % 1.0) for k, y in enumerate(years)]


# Core band (unchanged: keeps the committed cache valid). Years 1900-2092.
EPOCHS_TT = [jd_tt(julian_day(1900 + k * 8, (k * 5) % 12 + 1, 11)
                   + (k * 0.6180339887) % 1.0) for k in range(25)]
# Extended band: inside the Moon/asteroid/Chiron pack envelope (1850-2150), so
# every body is measured here -- this is the band we want to publish as widened.
EXT_EPOCHS = _band_epochs(list(range(1855, 1900, 5)) + list(range(2105, 2150, 5)))
# Edge band: just outside that envelope. Majors + Pluto + Moon only.
EDGE_EPOCHS = _band_epochs(list(range(1800, 1850, 5)) + list(range(2155, 2200, 5)))
# Wide band (--wide): the 1000-3000 CE lazy tier's measurement, sampled every
# ~40 years across both wings. The headline moves only on these numbers, never
# on a theory's published envelope ("validated, not asserted") -- run AFTER
# minting the wide packs (fit_pluto.py --wide, fit_smallbody.py --wide), so
# every packed body is exercised across the span; bodies whose loaded pack
# does not cover an epoch are skipped per-sample and simply not measured there.
WIDE_EPOCHS = _band_epochs(list(range(1005, 1795, 40)) + list(range(2205, 2995, 40)))


def _band_of(year):
    if 1900 <= year <= 2099:
        return "1900-2099"
    if 1850 <= year < 1900 or 2099 < year <= 2150:
        return "1850-2150"
    if 1800 <= year < 1850 or 2150 < year <= 2200:
        return "1800-2200 edges"
    return "1000-3000 wide"


def fetch(command, jds):
    tlist = ",".join(f"'{jd:.9f}'" for jd in jds)
    params = {
        "format": "text", "COMMAND": f"'{command}'", "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES", "EPHEM_TYPE": "OBSERVER", "CENTER": "'500@399'",
        "QUANTITIES": "'2'", "REF_SYSTEM": "'ICRF'", "CAL_FORMAT": "'JD'",
        "ANG_FORMAT": "'DEG'", "EXTRA_PREC": "'YES'",
        "APPARENT": "'AIRLESS'", "TIME_TYPE": "'TT'", "TLIST": tlist,
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=180) as resp:
        text = resp.read().decode()
    if "$$SOE" not in text:
        raise RuntimeError(text[:1500])
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].splitlines():
        parts = line.split()
        if len(parts) >= 3:
            rows.append((float(parts[0]), float(parts[1]), float(parts[2])))
    return rows


J1900 = julian_day(1900, 1, 1)
# Horizons' small-body ephemeris window (see _needed and fit_smallbody.py).
SMALLBODY_FLOOR_JD = julian_day(1600, 1, 1)
SMALLBODY_CEILING_JD = julian_day(2500, 1, 1)
BAND_ORDER = ["1850-2150", "1900-2099", "1800-2200 edges", "1000-3000 wide"]
WIDE = "--wide" in sys.argv


def _needed(name):
    """TT epochs a body is sampled at: core+extended for all, plus the 1800/2200
    edges for the majors/Pluto/Moon (the asteroid/Chiron packs end at 2150),
    plus the 1000-3000 wide band when --wide is set -- but only over epochs the
    SOURCE can serve. Horizons has no small-body ephemeris outside ~1600-2500
    (their SPK solutions integrate orbits fit to 19th-century-onward
    observations), so asking for Chiron at 1005 CE is not an out-of-pack sample
    to be skipped after the fact, it is an error that aborts the run. The
    majors and the Pluto barycenter run on DE441 across the whole span."""
    jds = list(EPOCHS_TT) + list(EXT_EPOCHS)
    if name in EDGE_BODIES:
        jds += list(EDGE_EPOCHS)
    if WIDE:
        wide = WIDE_EPOCHS
        if name not in EDGE_BODIES:  # i.e. the small bodies
            wide = [jd for jd in wide
                    if SMALLBODY_FLOOR_JD <= jd <= SMALLBODY_CEILING_JD]
        jds += list(wide)
    return jds


def _save(cache):
    """Write the sample cache atomically.

    The fetch loop checkpoints after every request so a long run is resumable,
    but writing in place meant a mid-run failure (a Horizons range error, a
    dropped connection) left the *committed* cache truncated or half-updated.
    Write to a sibling temp file and rename: the cache is either the old one
    or the new one, never a partial.
    """
    tmp = CACHE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(cache, f)
    os.replace(tmp, CACHE)


def main():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    # Pluto moved from body center (999) to barycenter (9) to match the engine's
    # Chebyshev pack (the 6.39-day Charon wobble of 999 is not in the pack); drop
    # any pre-switch rows so Pluto refetches against the barycenter.
    if cache.get("_pluto_center") != "9":
        cache.pop("pluto", None)
        cache["_pluto_center"] = "9"
    # Same reasoning for Mars and the giants (499->4, 599->5, 699->6, 799->7,
    # 899->8): rows fetched against the planet centers are a different target
    # and must not be mixed with barycenter rows, so drop them once.
    if cache.get("_planet_center") != "barycenter":
        for _n in ("mars", "jupiter", "saturn", "uranus", "neptune"):
            cache.pop(_n, None)
        cache["_planet_center"] = "barycenter"

    # incremental fetch: only pull (body, epoch) pairs not already cached
    for name, cmd in BODIES.items():
        rows = cache.get(name, [])
        have = {round(jd, 3) for jd, _, _ in rows}
        miss = [jd for jd in _needed(name) if round(jd, 3) not in have]
        if miss:
            for i in range(0, len(miss), 40):  # keep TLIST requests modest
                rows.extend(fetch(cmd, miss[i:i + 40]))
                _save(cache | {name: rows})
                time.sleep(0.2)
            cache[name] = rows
            _save(cache)

    eng = Engine("full")
    worst = {}   # (band, body) -> worst arcsec
    for name in BODIES:
        for (jd, ra_h, dec_h) in cache.get(name, []):
            band = _band_of(int(1900 + (jd - J1900) / 365.25))
            jd_ut = jd - delta_t(jd) / 86400.0  # engine takes UT
            try:
                p = eng.position(name, jd_ut)
            except ValueError:
                continue  # epoch outside a body's pack range; not measured here
            dra = abs(((p["ra"] - ra_h + 180) % 360 - 180)) * \
                math.cos(math.radians(dec_h)) * 3600
            ddec = abs(p["dec"] - dec_h) * 3600
            worst[(band, name)] = max(worst.get((band, name), 0.0),
                                      math.hypot(dra, ddec))

    out = {"basis": "JPL Horizons apparent geocentric RA/Dec (airless), TT epochs; "
                    "Pluto vs barycenter (9)",
           "bands": {}}
    counts = {"1900-2099": len(EPOCHS_TT), "1850-2150": len(EXT_EPOCHS),
              "1800-2200 edges": len(EDGE_EPOCHS),
              "1000-3000 wide": len(WIDE_EPOCHS)}
    for band in BAND_ORDER:
        bodies = {n: round(w, 3) for (b, n), w in worst.items() if b == band}
        if not bodies:
            continue
        print(f"\n=== {band}  ({counts[band]} epochs) ===")
        for n in BODIES:
            if n in bodies:
                print(f"  {n:9s} worst vs JPL {bodies[n]:8.3f}\"")
        out["bands"][band] = {"epochs": counts[band],
                              "bodies": {n: bodies[n] for n in BODIES if n in bodies}}
    with open(os.path.join(HERE, "..", "packages", "caelus",
                           "horizons-accuracy.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n-> packages/caelus/horizons-accuracy.json")


if __name__ == "__main__":
    main()
