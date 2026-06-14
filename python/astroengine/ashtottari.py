"""astroengine.ashtottari -- the Ashtottari dasha, a 108-year conditional dasha.

Eight lords rule in order -- Sun 6, Moon 15, Mars 8, Mercury 17, Saturn 10,
Jupiter 19, Rahu 12, Venus 21 years (totalling 108). Unlike Vimshottari, the
nakshatra-to-lord mapping is in irregular groups, and the elapsed portion of the
first period is measured across the lord's whole multi-nakshatra span, not a
single nakshatra.

Convention: the JHora/PVR Narasimha Rao mapping (the PyJHora implementation),
which the texts vary around -- the lord ranges below and the across-span balance
formula are reproduced from it. The alternate BPHS Ardra-start convention could
be added later as a variant. Validated against the named source in
`validate_jyotish` rather than asserted; deterministic time arithmetic on the
Moon's nakshatra (a 365.25-day dasha year by default). The TS port
(ashtottari.ts) reproduces every value and the golden fixtures pin the two.
"""
import math

from .vedic import nakshatra, NAK_SPAN, DASHA_YEAR

ASHTOTTARI_ORDER = ["sun", "moon", "mars", "mercury", "saturn", "jupiter",
                    "rahu", "venus"]
ASHTOTTARI_YEARS = {"sun": 6, "moon": 15, "mars": 8, "mercury": 17, "saturn": 10,
                    "jupiter": 19, "rahu": 12, "venus": 21}
ASHTOTTARI_TOTAL = 108
# Each lord's nakshatra group: (start nakshatra index 0-based, span in nakshatras).
# Rahu's group wraps past 27 (nakshatras 26, 0, 1, 2).
ASHTOTTARI_RANGES = {
    "sun": (6, 4), "moon": (10, 3), "mars": (13, 4), "mercury": (17, 3),
    "saturn": (20, 3), "jupiter": (23, 3), "rahu": (26, 4), "venus": (3, 3),
}


def ashtottari_lord(nak_index):
    """The Ashtottari dasha lord governing a nakshatra index (0-based)."""
    for lord, (start, span) in ASHTOTTARI_RANGES.items():
        if (nak_index - start) % 27 < span:
            return lord
    raise ValueError(f"no Ashtottari lord for nakshatra {nak_index}")


def ashtottari_dashas(moon_lon, natal_jd, levels=2, year_length=DASHA_YEAR,
                      count=8):
    """The Ashtottari dasha timeline from the Moon's sidereal longitude. Returns
    {start_lord, balance_years, dashas}. The elapsed portion of the first period
    is measured across the starting lord's whole nakshatra span."""
    nak_i = math.floor((moon_lon % 360.0) / NAK_SPAN) % 27
    start_lord = ashtottari_lord(nak_i)
    start_nak, span_nak = ASHTOTTARI_RANGES[start_lord]
    lord_start_deg = start_nak * NAK_SPAN
    span_deg = span_nak * NAK_SPAN
    elapsed = ((moon_lon % 360.0) - lord_start_deg) % 360.0 / span_deg
    y0 = ASHTOTTARI_YEARS[start_lord]
    li = ASHTOTTARI_ORDER.index(start_lord)
    t = natal_jd - elapsed * y0 * year_length
    dashas = []
    for k in range(count):
        lord = ASHTOTTARI_ORDER[(li + k) % 8]
        years = ASHTOTTARI_YEARS[lord]
        span = years * year_length
        maha = {"level": 1, "lord": lord, "years": years, "start": t, "end": t + span, "sub": []}
        if levels >= 2:
            sli = ASHTOTTARI_ORDER.index(lord)
            st = t
            for j in range(8):
                sl = ASHTOTTARI_ORDER[(sli + j) % 8]
                sub_span = (years * ASHTOTTARI_YEARS[sl] / ASHTOTTARI_TOTAL) * year_length
                maha["sub"].append({"lord": sl, "start": st, "end": st + sub_span})
                st += sub_span
        dashas.append(maha)
        t += span
    return {"start_lord": start_lord, "balance_years": (1.0 - elapsed) * y0,
            "dashas": dashas}


def ashtottari_active(moon_lon, natal_jd, target_jd, year_length=DASHA_YEAR):
    """The maha and antar lord active at target_jd. None before the first
    period begins."""
    timeline = ashtottari_dashas(moon_lon, natal_jd, levels=2,
                                 year_length=year_length, count=16)["dashas"]
    maha = next((p for p in timeline if p["start"] <= target_jd < p["end"]), None)
    if maha is None:
        return None
    antar = next((s for s in maha["sub"] if s["start"] <= target_jd < s["end"]), None)
    return {"maha": maha["lord"], "antar": antar["lord"] if antar else None}


def ashtottari_at(engine, natal_jd, target_jd, zodiac="sidereal:lahiri",
                  year_length=DASHA_YEAR):
    """Ashtottari dasha active at target_jd, from the natal Moon's nakshatra.
    Returns {moon_nakshatra, start_lord, maha, antar}."""
    moon_lon = engine.longitude("moon", natal_jd, zodiac=zodiac)
    nak = nakshatra(moon_lon)
    active = ashtottari_active(moon_lon, natal_jd, target_jd, year_length) or {}
    return {"moon_nakshatra": nak["name"],
            "start_lord": ashtottari_lord(nak["index"]), **active}
