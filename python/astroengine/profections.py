"""astroengine.profections -- annual and monthly profections, a Hellenistic
time-lord technique.

The Ascendant advances one whole sign per year of life; the profected sign's
traditional (domicile) ruler is the lord of the year. Within the year the
monthly profection advances one further sign per 1/12 of the year. Pure
arithmetic on a date difference and the natal Ascendant sign -- no ephemeris
beyond the Ascendant the engine already computes. The TS port (profections.ts)
reproduces every value and the golden fixtures pin the two together.

Profections use whole-sign houses, their native frame: the sign N signs after
the Ascendant is the (N+1)th whole-sign house. The profection year is a fixed
length (the tropical year by default); birthday-exact profections would key off
the solar return, which the engine computes separately.
"""
import math

from .chart import SIGNS
from .derived import TROPICAL_YEAR

# Traditional (domicile) ruler of each sign, Aries..Pisces.
SIGN_RULERS = ["mars", "venus", "mercury", "moon", "sun", "mercury",
               "venus", "mars", "jupiter", "saturn", "saturn", "jupiter"]


def sign_ruler(sign):
    """Traditional (domicile) ruler of a sign index (0 = Aries)."""
    return SIGN_RULERS[sign % 12]


def profected_sign(asc_sign, steps):
    """The whole-sign profection ``steps`` signs after the Ascendant sign: its
    sign name, sign index, 1-based whole-sign house, and traditional lord."""
    sign = (asc_sign + steps) % 12
    return {"sign": SIGNS[sign], "sign_index": sign,
            "house": (steps % 12) + 1, "lord": sign_ruler(sign)}


def profection(asc_sign, natal_jd, target_jd, year_length=TROPICAL_YEAR):
    """Annual and monthly profection at ``target_jd`` for a natal Ascendant
    sign. age = (target - natal) / year_length; the annual profection uses the
    completed years, the monthly one advances a further sign per 1/12 year."""
    age = (target_jd - natal_jd) / year_length
    years = int(math.floor(age))
    month = int(math.floor((age - years) * 12.0))   # 0..11
    return {
        "age_years": years,
        "month": month + 1,                          # 1..12
        "annual": profected_sign(asc_sign, years),
        "monthly": profected_sign(asc_sign, years + month),
    }


def profection_at(engine, natal_jd, target_jd, lat, lon_east,
                  zodiac="tropical", year_length=TROPICAL_YEAR):
    """Profection from a natal chart: take the Ascendant sign from the natal
    chart, then profect to ``target_jd``."""
    asc = engine.chart_at(natal_jd, lat, lon_east, zodiac=zodiac)["angles"]["asc"]
    asc_sign = int(asc // 30) % 12
    return profection(asc_sign, natal_jd, target_jd, year_length)
