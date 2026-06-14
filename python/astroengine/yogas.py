"""astroengine.yogas -- classical Vedic yogas (planetary combinations) judged on
the sidereal rasi (D1) chart.

This module covers the well-defined, placement-based yogas whose rules carry no
textual variation:

- The five Pancha Mahapurusha yogas: a non-luminary in its own sign or
  exaltation AND in a kendra (house 1, 4, 7, or 10) from the Ascendant --
  Ruchaka (Mars), Bhadra (Mercury), Hamsa (Jupiter), Malavya (Venus),
  Shasha (Saturn).
- Gajakesari: Jupiter in a kendra from the Moon (same sign or the 4th/7th/10th).
- Budha-Aditya: the Sun and Mercury in the same sign.
- Chandra-Mangala: the Moon and Mars in the same sign.

Own-sign and exaltation use the engine's `dignities` (the seven classical
planets share these between the Western and Vedic traditions). Houses are
whole-sign from the Ascendant, the Vedic frame. The variant-laden yogas
(Kemadruma's planet set differs by text; lordship-based raja/dhana yogas) are
left to a later step. Pure combinatorial logic over the validated sidereal
positions. The TS port (yogas.ts) reproduces every value and the golden fixtures
pin the two together.
"""
import math

from .derived import dignities

# Pancha Mahapurusha: (yoga name, planet).
MAHAPURUSHA = [("Ruchaka", "mars"), ("Bhadra", "mercury"), ("Hamsa", "jupiter"),
               ("Malavya", "venus"), ("Shasha", "saturn")]
KENDRA = {1, 4, 7, 10}
YOGA_PLANETS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"]


def detect_yogas(signs, asc_sign):
    """The placement yogas present in a chart. ``signs`` maps each of the seven
    classical planets to its 0-based sign index; ``asc_sign`` is the Ascendant's
    sign index. Returns a list of {yoga, planets} in a fixed order."""
    def house(sign):
        return (sign - asc_sign) % 12 + 1

    out = []
    for name, p in MAHAPURUSHA:
        dig = dignities(p, signs[p])
        if ("domicile" in dig or "exaltation" in dig) and house(signs[p]) in KENDRA:
            out.append({"yoga": name, "planets": [p]})
    # Gajakesari: Jupiter in a kendra (offset 0/3/6/9) from the Moon.
    if (signs["jupiter"] - signs["moon"]) % 12 in (0, 3, 6, 9):
        out.append({"yoga": "Gajakesari", "planets": ["jupiter", "moon"]})
    if signs["sun"] == signs["mercury"]:
        out.append({"yoga": "Budha-Aditya", "planets": ["sun", "mercury"]})
    if signs["moon"] == signs["mars"]:
        out.append({"yoga": "Chandra-Mangala", "planets": ["moon", "mars"]})
    return out


def yogas_at(engine, natal_jd, lat, lon_east, zodiac="sidereal:lahiri"):
    """The placement yogas of a natal chart, from the sidereal rasi positions."""
    chart = engine.chart_at(natal_jd, lat, lon_east, zodiac=zodiac)
    asc_sign = math.floor(chart["angles"]["asc"] / 30.0) % 12
    signs = {b: math.floor(chart["bodies"][b]["lon"] / 30.0) % 12
             for b in YOGA_PLANETS}
    return detect_yogas(signs, asc_sign)
