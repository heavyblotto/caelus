"""Measure astroengine.heliacal against Swiss Ephemeris 2.10 (pyswisseph,
Moshier mode). Swiss Ephemeris is the oracle here, never the source: the
visibility model in astroengine is implemented from Schaefer's published
equations (Sky & Telescope, May 1998) and Yallop's (NAO Technical Note 69),
and this script reports how its dates compare with swe_heliacal_ut, which
carries a later and more detailed version of Schaefer's model.

Both sides are given the same atmosphere, a total extinction coefficient of
0.25, and the stars are fed to the oracle from our own catalog rows through a
minted sefstars.txt. A date here is a whole local day, so the measure is the
difference in days between the two answers for the same event.

Usage: python3 validate_heliacal.py          # table to stdout
       python3 validate_heliacal.py --json   # the summary as JSON
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import swisseph as swe
from astroengine import heliacal as HL
from astroengine import stars as ST
from astroengine.chart import Engine
from astroengine.core import julian_day

FLG = swe.FLG_MOSEPH
K = 0.25
eng = Engine("full")

SITES = [("Babylon", 32.54, 44.42), ("Memphis", 29.85, 31.25),
         ("Athens", 37.98, 23.73), ("London", 51.5, -0.12),
         ("Cape Town", -33.92, 18.42)]
STARTS = [julian_day(-600, 3, 1, 0, 0, 0, "julian"), julian_day(139, 1, 1, 0, 0, 0, "julian"),
          julian_day(1000, 6, 1, 0, 0, 0, "julian"), julian_day(2020, 1, 1)]
STARS = ["Sirius", "Aldebaran", "Regulus", "Spica", "Antares", "Arcturus",
         "Procyon", "Pollux", "Fomalhaut", "Betelgeuse"]
SWE_KIND = {"morning_first": swe.HELIACAL_RISING, "evening_last": swe.HELIACAL_SETTING,
            "evening_first": swe.EVENING_FIRST, "morning_last": swe.MORNING_LAST}
GROUPS = [
    ("stars", STARS, ["morning_first", "evening_last"]),
    ("outer planets", ["mars", "jupiter", "saturn"], ["morning_first", "evening_last"]),
    ("venus", ["venus"], ["morning_first", "evening_last", "evening_first", "morning_last"]),
    ("mercury", ["mercury"], ["morning_first", "evening_last", "evening_first", "morning_last"]),
    ("moon", ["moon"], ["evening_first", "morning_last"]),
]

# feed the oracle our own star rows
cat = ST.catalog()["stars"]
tmp = tempfile.mkdtemp()
with open(os.path.join(tmp, "sefstars.txt"), "w") as f:
    for n in STARS:
        s = cat[n]
        rah = s["ra"] / 15.0
        hh = int(rah); mm = int((rah - hh) * 60); ss = ((rah - hh) * 60 - mm) * 60
        dd = s["dec"]; sg = "+" if dd >= 0 else "-"
        ad = abs(dd); D = int(ad); M = int((ad - D) * 60); S = ((ad - D) * 60 - M) * 60
        f.write(f"{n:<20s},xx ,ICRS,{hh:02d},{mm:02d},{ss:09.6f},{sg}{D:02d},{M:02d},{S:08.5f},"
                f"{s['pmra']},{s['pmdec']},{s['rv']},{s['plx']},{s['mag']},0.0\n")
swe.set_ephe_path(tmp)


def oracle(name, jd, lat, lon, kind):
    obj = name if name in STARS else name.capitalize()
    try:
        r = swe.heliacal_ut(jd, (lon, lat, 0.0), (1013.25, 15.0, 40.0, K),
                            (36.0, 1.0, 0, 0, 0, 0), obj, SWE_KIND[kind], FLG)
        return r[1]
    except swe.Error:
        return None


def main():
    summary = {}
    verbose = "--json" not in sys.argv
    for label, names, kinds in GROUPS:
        diffs = []
        only_ours = only_oracle = inside = 0
        for name in names:
            for kind in kinds:
                for si, (_site, lat, lon) in enumerate(SITES):
                    for ji, jd in enumerate(STARTS):
                        if label != "moon" and (si + ji) % 2:
                            continue  # half the grid is enough for the slow bodies
                        ours = HL.heliacal(eng, name, jd, lat, lon, kind, extinction=K)
                        ref = oracle(name, jd, lat, lon, kind)
                        if ours is None and ref is None:
                            continue
                        if ref is None:
                            only_ours += 1
                            continue
                        if ours is None:
                            only_oracle += 1
                            continue
                        d = HL.local_day(ours["jd"], lon) - HL.local_day(ref, lon)
                        if abs(d) > 40:
                            # the two picked different apparitions: one side
                            # judged a marginal one invisible
                            only_oracle += 1
                            continue
                        diffs.append(d)
                        lo, hi = ours["earliest"], ours["latest"]
                        if lo is not None and hi is not None and \
                                HL.local_day(lo, lon) <= HL.local_day(ref, lon) <= HL.local_day(hi, lon):
                            inside += 1
                        if verbose and abs(d) > 3:
                            print(f"  {name} {kind} {_site} {jd:.1f}: ours {ours['jd']:.2f} oracle {ref:.2f} ({d:+d} d)")
        n = len(diffs)
        ad = sorted(abs(d) for d in diffs)
        row = {
            "events": n,
            "same_day": sum(1 for d in diffs if d == 0),
            "within_1": sum(1 for d in diffs if abs(d) <= 1),
            "within_3": sum(1 for d in diffs if abs(d) <= 3),
            "median_abs": ad[n // 2] if n else None,
            "worst": ad[-1] if n else None,
            "mean": sum(diffs) / n if n else None,
            "oracle_in_window": inside,
            "apparition_mismatch": only_ours + only_oracle,
        }
        summary[label] = row
        if verbose:
            print(f"{label:14s} n={n:3d}  same day {row['same_day']:3d}  within 1 d {row['within_1']:3d}  "
                  f"within 3 d {row['within_3']:3d}  worst {row['worst']} d  mean {row['mean']:+.2f} d  "
                  f"oracle inside our window {inside:3d}  mismatched apparitions {row['apparition_mismatch']}")
    if not verbose:
        print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
