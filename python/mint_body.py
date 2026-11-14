#!/usr/bin/env python3
"""Mint a pack for one numbered asteroid, with a certificate of its error.

The engine ships packs for a handful of small bodies. This script makes one
for any other numbered asteroid on request: it samples the body's heliocentric
position from JPL Horizons, fits a Chebyshev pack to the samples, writes the
pack in the binary form (CPK1), and then measures the published bytes against
Horizons at epochs the fit never saw. What it measured goes into a
certificate beside the pack, with the pack's SHA-256, so a loader can check
that the bytes it fetched are the bytes that were measured.

    python3 mint_body.py 433                      # 433 Eros, 1800 to 2200
    python3 mint_body.py 16 --year0 1900 --year1 2100 --out minted/

Writes `{id}.cpk` and `{id}.cert.json` into --out. The id is the asteroid's
name in lower case (`eros`), or `asteroid_{number}` when it has none.

The target error is the smaller of 5e-6 AU (the bar the shipped asteroid
packs meet) and half an arcsecond at the body's closest approach to the
Earth in the span, so a near-Earth asteroid gets a tighter fit than a
main-belt one. The script samples at one day and, if the measured error
misses the target, again at six hours.

Horizons serves small bodies from 1600 to 2500 only. Needs ssd.jpl.nasa.gov
reachable.
"""
import argparse
import datetime
import hashlib
import json
import math
import os
import random
import re
import sys
import tempfile
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import horizons as HZ
from astroengine import packbin
from astroengine.chebyshev import ChebSeries, fit, max_error
from astroengine.core import julian_day
from astroengine.minted import CERT_FORMAT, CERT_VERSION

AU_KM = 149597870.7
ARCSEC = math.pi / 648000.0
EPOCH_FLOOR, EPOCH_CEILING = 1600, 2500
TARGET_AU = 5e-6
TARGET_ARCSEC = 0.5
STEPS = (1.0, 0.25)
SEG_DAYS = (366, 731, 1461, 2922)
DEGREES = (8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28)
CHECK_EPOCHS = 300
CHECK_BATCH = 50
# The quantum is the fit residual divided by this; the Moon's packs use the
# same factor, where the rounding had to stay far below the error.
QUANTUM_FACTOR = 4096.0


def target_header(number):
    """(name, orbit solution) as Horizons states them for a numbered body."""
    params = {
        "format": "text", "COMMAND": f"'{number};'", "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES", "EPHEM_TYPE": "VECTOR", "CENTER": "'@sun'",
        "REF_PLANE": "'ECLIPTIC'", "START_TIME": "'JD2451545.0'",
        "STOP_TIME": "'JD2451546.0'", "STEP_SIZE": "'1 d'", "VEC_TABLE": "2",
        "VEC_CORR": "'NONE'", "OUT_UNITS": "'AU-D'", "CAL_FORMAT": "JD",
    }
    text = HZ._get_with_retry(HZ.API + "?" + urllib.parse.urlencode(params), timeout=120)
    m = re.search(r"Target body name:\s*(.+?)\s*\{source:\s*([^}]+)\}", text)
    if not m:
        raise SystemExit(f"Horizons has no small body numbered {number}:\n{text[:400]}")
    return m.group(1).strip(), m.group(2).strip()


def body_id(number, name):
    """`433 Eros (A898 PA)` -> `eros`; a body with no name -> `asteroid_433`."""
    m = re.match(r"^\d+\s+([A-Za-z][A-Za-z' .-]*?)\s*(\(|$)", name)
    if not m:
        return f"asteroid_{number}"
    slug = re.sub(r"[^a-z0-9]+", "_", m.group(1).lower()).strip("_")
    return slug or f"asteroid_{number}"


def earth_series():
    return ChebSeries.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                        "astroengine", "data", "earth_cheb.cpk"))


def min_geocentric(cache, earth, jd0, jd1):
    """The body's least distance from the Earth in the span, AU, from the
    cached rows (both in heliocentric ecliptic J2000)."""
    best = float("inf")
    for jd, x, y, z in zip(cache._jds, cache._xs, cache._ys, cache._zs):
        jd = float(jd)
        if jd < jd0 or jd > jd1:
            continue
        ex, ey, ez = earth.xyz(jd)
        d = math.sqrt((x - ex) ** 2 + (y - ey) ** 2 + (z - ez) ** 2)
        if d < best:
            best = d
    return best


def check_epochs(number, jd0, jd1):
    """Epochs to measure at: random in the span, fixed by the body's number
    so a re-mint measures at the same instants."""
    rng = random.Random(number * 1000003 + 17)
    return sorted(round(rng.uniform(jd0 + 1.0, jd1 - 1.0), 6) for _ in range(CHECK_EPOCHS))


def fetch_truth(number, jds):
    xs, ys, zs = [], [], []
    for i in range(0, len(jds), CHECK_BATCH):
        x, y, z = HZ._fetch_vectors(jds[i:i + CHECK_BATCH], command=f"{number};")
        xs.extend(float(v) for v in x)
        ys.extend(float(v) for v in y)
        zs.extend(float(v) for v in z)
    return xs, ys, zs


def mint(number, year0, year1, out_dir, cache_dir, today=None):
    if year0 < EPOCH_FLOOR or year1 > EPOCH_CEILING or year1 <= year0:
        raise SystemExit(f"Horizons serves small bodies from {EPOCH_FLOOR} to {EPOCH_CEILING}; "
                         f"asked for {year0} to {year1}")
    name, solution = target_header(number)
    bid = body_id(number, name)
    jd0, jd1 = julian_day(year0, 1, 1), julian_day(year1, 1, 1)
    # the last segment may run past the span, and Horizons stops at 2500
    pad = min(max(SEG_DAYS), julian_day(EPOCH_CEILING, 12, 31) - jd1)
    segs = [s for s in SEG_DAYS if s <= pad]
    if not segs:
        raise SystemExit(f"no segment length fits inside the source window after {year1}")
    earth = earth_series()
    jds_check = check_epochs(number, jd0, jd1)
    print(f"{name}  [{solution}]  id {bid}  {year0} to {year1}")
    truth = fetch_truth(number, jds_check)

    result = None
    for step in STEPS:
        suffix = "" if step == 1.0 else f"_{round(step * 24)}h"
        cache = HZ.HorizonsCache(
            os.path.join(cache_dir, f"mint_{number}_{year0}_{year1}{suffix}.json"),
            f"{number};", name)
        cache.ensure(jd0, jd1, step=step, pad_days=max(segs))
        near = min_geocentric(cache, earth, jd0, jd1)
        target = min(TARGET_AU, TARGET_ARCSEC * ARCSEC * near)
        m = (cache._jds >= jd0) & (cache._jds <= jd1)
        rows = (cache._jds[m][::37], cache._xs[m][::37], cache._ys[m][::37], cache._zs[m][::37])
        print(f"  step {step} d: closest approach {near:.4f} AU, target {target:.2e} AU")

        best = None
        for seg in segs:
            for deg in DEGREES:
                data, resid = fit(cache.sample, jd0, jd1, seg, deg, scale=1.0, sig=13)
                err = max_error(data, *rows)
                size = (deg + 1) * 3 * len(data["segments"])
                # leave half the target for what the cached rows cannot show
                if err < target / 2 and (best is None or size < best[0]):
                    best = (size, seg, deg, data, resid)
        if best is None:
            print("    no fit met the target on the cached rows")
            continue
        _, seg, deg, data, resid = best
        data["provenance"] = {
            "source": "JPL Horizons", "body": name, "solution": solution,
            "center": "@sun", "frame": "heliocentric ecliptic J2000",
            "correction": "geometric (VEC_CORR=NONE)", "range": f"{year0}-{year1}",
            "sample_step_days": step, "seg_days": seg, "degree": deg,
            "fit_residual_au": max(resid, 1e-13),
        }
        qexp = packbin.quantum_exponent(data, QUANTUM_FACTOR)
        blob = packbin.encode_pack(data, qexp=qexp)
        # measure the bytes that will be published, at epochs the fit never saw
        published = packbin.decode_pack(blob)
        err = max_error(published, jds_check, *truth)
        print(f"    seg {seg} d, degree {deg}: {len(blob) / 1024:.1f} KB, "
              f"{err:.2e} AU ({err * AU_KM:.1f} km) against Horizons at {CHECK_EPOCHS} epochs")
        result = (step, seg, deg, resid, qexp, blob, err, near, target)
        if err < target:
            break
    if result is None:
        raise SystemExit(f"{name}: no fit met the target")
    step, seg, deg, resid, qexp, blob, err, near, target = result
    if not err < target:
        raise SystemExit(f"{name}: best fit measures {err:.2e} AU, over the target {target:.2e} AU")

    os.makedirs(out_dir, exist_ok=True)
    pack_file = f"{bid}.cpk"
    with open(os.path.join(out_dir, pack_file), "wb") as f:
        f.write(blob)
    cert = {
        "format": CERT_FORMAT, "version": CERT_VERSION,
        "id": bid, "number": number, "name": name,
        "source": {"service": "JPL Horizons", "solution": solution,
                   "frame": "heliocentric ecliptic J2000", "correction": "geometric"},
        "span": {"from": year0, "to": year1, "jd0": jd0, "jd1": jd1},
        "fit": {"sample_step_days": step, "seg_days": seg, "degree": deg,
                "node_residual_au": resid, "quantum_exponent": qexp},
        "error": {
            "max_au": err, "target_au": target, "epochs": CHECK_EPOCHS,
            "basis": "the published pack against JPL Horizons at epochs the fit never sampled",
            "min_geocentric_au": near,
            "angle_bound_arcsec": err / near / ARCSEC,
        },
        "pack": {"file": pack_file, "bytes": len(blob),
                 "sha256": hashlib.sha256(blob).hexdigest()},
        "minted": (today or datetime.date.today()).isoformat(),
    }
    cert_path = os.path.join(out_dir, f"{bid}.cert.json")
    with open(cert_path, "w") as f:
        json.dump(cert, f, indent=1)
        f.write("\n")
    print(f"  wrote {os.path.join(out_dir, pack_file)} ({len(blob)} bytes) and {cert_path}")
    print(f"  error {err:.2e} AU, at most {cert['error']['angle_bound_arcsec']:.3f}\" seen from the Earth")
    return cert


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("number", type=int, help="the asteroid's IAU number, e.g. 433")
    ap.add_argument("--year0", type=int, default=1800)
    ap.add_argument("--year1", type=int, default=2200)
    ap.add_argument("--out", default="minted", help="directory for the pack and certificate")
    ap.add_argument("--cache", default=None,
                    help="directory for the Horizons sample cache (default: a temporary one)")
    args = ap.parse_args()
    if args.number < 1:
        raise SystemExit("the number must be a positive integer")
    if args.cache:
        os.makedirs(args.cache, exist_ok=True)
        mint(args.number, args.year0, args.year1, args.out, args.cache)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            mint(args.number, args.year0, args.year1, args.out, tmp)


if __name__ == "__main__":
    main()
