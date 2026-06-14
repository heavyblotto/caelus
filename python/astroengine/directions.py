"""astroengine.directions -- primary directions to the angles.

Primary (mundane) directions carry a planet, by the diurnal rotation of the
sphere, to one of the four angles; the arc of rotation, converted by a time
key, gives the age of the direction. This module covers the well-defined
subset: direct directions of a body to the MC, IC, Ascendant, and Descendant.

A body at right ascension alpha and declination delta, for geographic latitude
phi and right ascension of the MC (ramc):
- reaches the MC when the rotation brings its RA onto the meridian:
  arc = alpha - ramc;
- the IC is the opposite meridian point: arc = alpha - ramc - 180;
- reaches the Ascendant when its oblique ascension (alpha - AD) meets that of
  the ascending degree (ramc + 90): arc = alpha - AD - ramc - 90;
- reaches the Descendant by oblique descension (alpha + AD): arc = alpha + AD
  - ramc + 90;
where AD = asin(tan phi * tan delta) is the ascensional difference. A
circumpolar body (|tan phi * tan delta| > 1) has no oblique ascension, so its
Ascendant/Descendant directions are undefined.

Time keys convert the arc (degrees) to years: Ptolemy's key is 1 deg = 1 year;
Naibod's is the Sun's mean daily motion, 0.9856473 deg = 1 year. Directions are
computed on the equatorial coordinates the engine already validates against
Swiss Ephemeris. The TS port (directions.ts) reproduces every value and the
golden fixtures pin the two together.
"""
import math

from . import houses as H

# Degrees of arc that equal one year of life, per time key.
KEYS = {"ptolemy": 1.0, "naibod": 0.9856473}
TRADITIONAL = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]
YEAR_DAYS = 365.2422


def direction_arcs(alpha, delta, ramc, phi):
    """Direct primary-direction arcs (degrees, [0, 360)) of a body at right
    ascension ``alpha`` and declination ``delta`` to the four angles, for
    latitude ``phi`` and right ascension of the MC ``ramc``. ``asc``/``dsc`` are
    None when the body is circumpolar (no oblique ascension)."""
    arc_mc = (alpha - ramc) % 360.0
    arc_ic = (alpha - ramc - 180.0) % 360.0
    t = math.tan(math.radians(phi)) * math.tan(math.radians(delta))
    if abs(t) > 1.0:
        return {"mc": arc_mc, "ic": arc_ic, "asc": None, "dsc": None}
    ad = math.degrees(math.asin(t))
    return {"mc": arc_mc, "ic": arc_ic,
            "asc": (alpha - ad - ramc - 90.0) % 360.0,
            "dsc": (alpha + ad - ramc + 90.0) % 360.0}


def direction_years(arc, key="naibod"):
    """Years of life corresponding to an arc of direction under a time key."""
    return arc / KEYS[key]


def primary_directions(engine, natal_jd, lat, lon_east, bodies=None,
                       key="naibod", max_years=90.0, year_length=YEAR_DAYS):
    """Direct primary directions of the bodies to the four angles within
    ``max_years``, by the given time key. Returns a list of
    ``{body, angle, arc, years, jd}`` sorted by years."""
    if bodies is None:
        bodies = TRADITIONAL
    _, _, armc, _ = H.angles(natal_jd, lat, lon_east)
    ramc = math.degrees(armc)
    out = []
    for b in bodies:
        p = engine.position(b, natal_jd)
        arcs = direction_arcs(p["ra"], p["dec"], ramc, lat)
        for angle in ("mc", "ic", "asc", "dsc"):
            arc = arcs[angle]
            if arc is None:
                continue
            years = direction_years(arc, key)
            if years <= max_years:
                out.append({"body": b, "angle": angle.upper(), "arc": arc,
                            "years": years, "jd": natal_jd + years * year_length})
    out.sort(key=lambda d: d["years"])
    return out
