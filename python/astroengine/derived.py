"""astroengine.derived -- standard chart derivations built on the validated
primitives.

These are constructions on top of apparent positions (already checked against
Swiss Ephemeris), so this layer is time-mapping and arithmetic, not new
ephemeris. First slice: returns, secondary progressions, solar arc directions,
composite charts, Davison charts.

Conventions:
- Secondary progressions and solar arc use the mean tropical year for the
  day-for-a-year mapping.
- Solar arc is the *true* arc (the secondary-progressed Sun's motion), applied
  forward to every natal point.
- Composite is the midpoint method (the shorter-arc midpoint of each pair of
  longitudes).
- Davison is a real chart at the midpoint in time and place.
"""
import math

from .events import crossings

TROPICAL_YEAR = 365.24219  # mean tropical year, days


def _wrap360(x):
    return x % 360.0


def midpoint_lon(a, b):
    """Shorter-arc midpoint of two longitudes (degrees)."""
    d = ((b - a + 180.0) % 360.0) - 180.0  # signed shortest a -> b
    return (a + d / 2.0) % 360.0


# ----------------------------------------------------------------- returns
def returns(engine, body, natal_jd, jd_start, jd_end, zodiac="tropical",
            max_hits=60):
    """UT JDs in [jd_start, jd_end] when `body` returns to its natal longitude.
    Outer-planet returns can show three crossings around a retrograde loop;
    all are returned in time order."""
    natal_lon = engine.longitude(body, natal_jd, zodiac=zodiac)
    return crossings(engine, body, natal_lon, jd_start, jd_end,
                     zodiac=zodiac, max_hits=max_hits)


def solar_return(engine, natal_jd, jd_start, jd_end, zodiac="tropical"):
    return returns(engine, "sun", natal_jd, jd_start, jd_end, zodiac=zodiac)


def lunar_return(engine, natal_jd, jd_start, jd_end, zodiac="tropical"):
    return returns(engine, "moon", natal_jd, jd_start, jd_end, zodiac=zodiac)


# ------------------------------------------------- secondary progressions
def progressed_jd(natal_jd, target_jd, year_length=TROPICAL_YEAR):
    """The JD whose *real* positions are the secondary-progressed positions for
    the age (target_jd - natal_jd): one day of motion per year of life."""
    age_years = (target_jd - natal_jd) / year_length
    return natal_jd + age_years


def progressed_longitude(engine, body, natal_jd, target_jd,
                         year_length=TROPICAL_YEAR, zodiac="tropical"):
    return engine.longitude(body, progressed_jd(natal_jd, target_jd, year_length),
                            zodiac=zodiac)


# ----------------------------------------------------------- solar arc
def solar_arc(engine, natal_jd, target_jd, year_length=TROPICAL_YEAR,
              zodiac="tropical"):
    """The solar-arc direction angle (degrees, forward): how far the secondary-
    progressed Sun has moved from the natal Sun. Add it to any natal longitude
    to direct that point."""
    pjd = progressed_jd(natal_jd, target_jd, year_length)
    natal_sun = engine.longitude("sun", natal_jd, zodiac=zodiac)
    prog_sun = engine.longitude("sun", pjd, zodiac=zodiac)
    return (prog_sun - natal_sun) % 360.0  # Sun only moves forward


def directed_longitude(engine, body, natal_jd, target_jd,
                       year_length=TROPICAL_YEAR, zodiac="tropical"):
    arc = solar_arc(engine, natal_jd, target_jd, year_length, zodiac)
    return (engine.longitude(body, natal_jd, zodiac=zodiac) + arc) % 360.0


# ----------------------------------------------------------- composite
def composite_longitudes(engine, jd_a, jd_b, bodies, zodiac="tropical"):
    """Midpoint-method composite: the shorter-arc midpoint of each body's two
    longitudes. Angles (ASC/MC) compose the same way via midpoint_lon on the
    two charts' angles."""
    out = {}
    for body in bodies:
        la = engine.longitude(body, jd_a, zodiac=zodiac)
        lb = engine.longitude(body, jd_b, zodiac=zodiac)
        out[body] = midpoint_lon(la, lb)
    return out


# ----------------------------------------------------------- davison
def davison_params(jd_a, jd_b, lat_a, lon_east_a, lat_b, lon_east_b):
    """Time and place for a Davison relationship chart: the temporal midpoint
    and the geographic midpoint (mean latitude, shorter-arc mean longitude).
    Compute a normal chart at these to get the Davison chart."""
    mid_jd = 0.5 * (jd_a + jd_b)
    mid_lat = 0.5 * (lat_a + lat_b)
    mid_lon = midpoint_lon(lon_east_a % 360.0, lon_east_b % 360.0)
    if mid_lon > 180.0:
        mid_lon -= 360.0  # back to (-180, 180] east-longitude
    return mid_jd, mid_lat, mid_lon
