#!/usr/bin/env python3
"""Cross-language golden for the interpolated ("natural") lunar apogee.

Records the Python reference's intp_apog positions at instants across the
fitted span, plus four stored apogee-passage instants (from the pack's own
provenance) where the pack must reproduce the engine's Moon longitude: at a
passage the apsis IS the Moon (the spline passes through the knots; the
Chebyshev refit adds only ~arcsec). packages/caelus/test/
intp-apog-golden.test.ts replays both through the TS engine -- the two sides
evaluate the SAME pack, so positions must agree to evaluator precision.

Usage: python3 export_intp_apog_golden.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine.chart import Engine
from astroengine.core import julian_day

# ~12 instants across the fitted span (the precise-Moon years, inset).
YEARS = [1851, 1875, 1900, 1925, 1950, 1975, 2000, 2025, 2050, 2075, 2100, 2145]


def main():
    eng = Engine("full")
    pack_path = os.path.join(os.path.dirname(__file__), "astroengine", "data",
                             "intp_apog_cheb.json")
    with open(pack_path) as f:
        prov = json.load(f)["provenance"]

    out = {"basis": "Python reference astroengine intp_apog "
                    "(fit_intp_apog.py pack; full VSOP, full moon)",
           "cases": [], "passages": []}
    for y in YEARS:
        jd = julian_day(y, 3, 15, 12)
        p = eng.position("intp_apog", jd)
        out["cases"].append({"jd": jd, "lon": p["lon"], "lat": p["lat"]})
        print(f"{y}: lon {p['lon']:.6f} lat {p['lat']:.6f}")

    # Passage invariant: pack longitude ~= the engine's Moon longitude at the
    # stored apogee instants (0.1 deg tolerance in the TS replay).
    for s in prov["passage_samples"]:
        jd = s["jd_ut"]
        moon_lon = eng.longitude("moon", jd)
        intp_lon = eng.longitude("intp_apog", jd)
        gap = abs((intp_lon - moon_lon + 180.0) % 360.0 - 180.0)
        print(f"passage jd {jd}: intp {intp_lon:.5f} moon {moon_lon:.5f} "
              f"gap {gap * 3600:.2f}\"")
        assert gap < 0.1, "pack does not pass through its own apogee knot"
        out["passages"].append({"jd": jd, "intp_lon": intp_lon,
                                "moon_lon": moon_lon})

    path = os.path.join(os.path.dirname(__file__), "..", "packages", "caelus",
                        "test", "intp-apog-golden.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("->", path)


if __name__ == "__main__":
    main()
