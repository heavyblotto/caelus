"""astroengine.core -- clean-room ephemeris engine.

Pipeline (apparent geocentric ecliptic longitude, true equinox of date):
  UT -> TT via Delta T (IERS observations; Morrison et al. 2021 spline before 1948)
  VSOP87D heliocentric spherical of date for Earth + planet
  light-time + annual aberration: evaluate BOTH bodies at (t - tau), iterate
  VSOP dynamical -> FK5 frame correction (Meeus 32.3)
  nutation in longitude (IAU 1980, 63-term)
Moon: Meeus Ch.47 (ELP2000-82 abridged, 60+60 terms), mean equinox of date,
      + nutation. Sun: from Earth's heliocentric position + aberration.
Pluto: Meeus Ch.37 series (valid 1885-2099), J2000 -> precessed to date.
"""
import json, math, os
from functools import lru_cache

DATA = os.path.join(os.path.dirname(__file__), "data")
DEG = math.pi / 180.0
ARCSEC = DEG / 3600.0
J2000 = 2451545.0
LIGHT_TIME_AU = 0.0057755183  # days per AU

PLANET_NAMES = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]


def _load(name):
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)


# ---------------------------------------------------------------- timescale
def julian_day(y, mo, d, h=0.0, mi=0, s=0.0, calendar="gregorian"):
    """Calendar date (UT) -> Julian Day. `calendar` is "gregorian" (the
    default, proleptic before 1582) or "julian", the calendar historical
    dates before 1582-10-15 are given in. Years are astronomical: year 0 is
    1 BCE, year -99 is 100 BCE."""
    frac = (h + mi / 60.0 + s / 3600.0) / 24.0
    if mo <= 2:
        y -= 1
        mo += 12
    if calendar == "julian":
        b = 0
    elif calendar == "gregorian":
        a = y // 100
        b = 2 - a + a // 4
    else:
        raise ValueError(f"unknown calendar {calendar!r}")
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (mo + 1)) + d + b - 1524.5 + frac


def calendar_date(jd, calendar="gregorian"):
    """Julian Day -> calendar date, the inverse of julian_day (Meeus,
    Astronomical Algorithms, ch. 7). Returns {"year", "month", "day",
    "hour"} with `hour` a fraction of 24 and the year astronomical."""
    z = math.floor(jd + 0.5)
    f = jd + 0.5 - z
    if calendar == "julian":
        a = z
    elif calendar == "gregorian":
        alpha = math.floor((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - math.floor(alpha / 4)
    else:
        raise ValueError(f"unknown calendar {calendar!r}")
    b = a + 1524
    c = math.floor((b - 122.1) / 365.25)
    d = math.floor(365.25 * c)
    e = math.floor((b - d) / 30.6001)
    day = b - d - math.floor(30.6001 * e)
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    return {"year": year, "month": month, "day": day, "hour": f * 24.0}


# Observed Delta T (IERS), 5-year steps 1955-2025. Earth's rotation sped up
# after ~2016, so polynomial extrapolations (Espenak-Meeus 2006) badly
# overshoot; we interpolate observations and extrapolate gently.
_DT_OBS = [
    (1955, 31.1), (1960, 33.2), (1965, 35.7), (1970, 40.2), (1975, 45.5),
    (1980, 50.5), (1985, 54.3), (1990, 56.9), (1995, 60.8), (2000, 63.8),
    (2005, 64.7), (2010, 66.1), (2015, 67.6), (2020, 69.4), (2025, 69.2),
]


def delta_t_sigma(year):
    """One-sigma uncertainty of delta T in seconds at a calendar year.

    Breakpoints from Morrison & Stephenson (2004, J. Hist. Astron. 35),
    Table 1's sigma column; telescopic era tapers to the IERS span, future
    grows quadratically from the measured end (stated extrapolation).
    Mirrors ranges.ts deltaTSigma in the TS engine.
    """
    table = [(-1000, 640), (-500, 430), (0, 260), (500, 160), (1000, 55),
             (1200, 30), (1400, 20), (1600, 20), (1700, 5), (1750, 2),
             (1800, 1), (1850, 0.5), (1900, 0.1), (2025, 0.05)]
    if year <= table[0][0]:
        return table[0][1]
    last_y, last_s = table[-1]
    if year > last_y:
        t = (year - last_y) / 50
        return last_s + 2.0 * t * t
    for (y0, s0), (y1, s1) in zip(table, table[1:]):
        if year <= y1:
            return s0 + (s1 - s0) * (year - y0) / (y1 - y0)
    return last_s


# Historical Delta T: the cubic-spline fit of Morrison, Stephenson, Hohenkerk
# & Zawilski, "Addendum 2020 to 'Measurement of the Earth's rotation: 720 BC
# to AD 2015'" (Proc. R. Soc. A 477, 2021, doi:10.1098/rspa.2020.0776),
# Table S15 v.2020, rows 1-35. Each row is (K_i, K_i+1, a0, a1, a2, a3):
# with t = (Y - K_i) / (K_i+1 - K_i), DT = a0 + a1 t + a2 t^2 + a3 t^3 seconds.
# The original analysis is Stephenson, Morrison & Hohenkerk (Proc. R. Soc. A
# 472, 2016, doi:10.1098/rspa.2016.0404).
_DT_SPLINE = [
    (-720.0, -100.0, 20371.848, -9999.586, 776.247, 409.160),
    (-100.0, 400.0, 11557.668, -5822.270, 1303.151, -503.433),
    (400.0, 1000.0, 6535.116, -5671.519, -298.291, 1085.087),
    (1000.0, 1150.0, 1650.393, -753.210, 184.811, -25.346),
    (1150.0, 1300.0, 1056.647, -459.628, 108.771, -24.641),
    (1300.0, 1500.0, 681.149, -421.345, 61.953, -29.414),
    (1500.0, 1600.0, 292.343, -192.841, -6.572, 16.197),
    (1600.0, 1650.0, 109.127, -78.697, 10.505, 3.018),
    (1650.0, 1720.0, 43.952, -68.089, 38.333, -2.127),
    (1720.0, 1800.0, 12.068, 2.507, 41.731, -37.939),
    (1800.0, 1810.0, 18.367, -3.481, -1.126, 1.918),
    (1810.0, 1820.0, 15.678, 0.021, 4.629, -3.812),
    (1820.0, 1830.0, 16.516, -2.157, -6.806, 3.250),
    (1830.0, 1840.0, 10.804, -6.018, 2.944, -0.096),
    (1840.0, 1850.0, 7.634, -0.416, 2.658, -0.539),
    (1850.0, 1855.0, 9.338, 1.642, 0.261, -0.883),
    (1855.0, 1860.0, 10.357, -0.486, -2.389, 1.558),
    (1860.0, 1865.0, 9.040, -0.591, 2.284, -2.477),
    (1865.0, 1870.0, 8.255, -3.456, -5.148, 2.720),
    (1870.0, 1875.0, 2.371, -5.593, 3.011, -0.914),
    (1875.0, 1880.0, -1.126, -2.314, 0.269, -0.039),
    (1880.0, 1885.0, -3.210, -1.893, 0.152, 0.563),
    (1885.0, 1890.0, -4.388, 0.101, 1.842, -1.438),
    (1890.0, 1895.0, -3.884, -0.531, -2.474, 1.871),
    (1895.0, 1900.0, -5.017, 0.134, 3.138, -0.232),
    (1900.0, 1905.0, -1.977, 5.715, 2.443, -1.257),
    (1905.0, 1910.0, 4.923, 6.828, -1.329, 0.720),
    (1910.0, 1915.0, 11.142, 6.330, 0.831, -0.825),
    (1915.0, 1920.0, 17.479, 5.518, -1.643, 0.262),
    (1920.0, 1925.0, 21.617, 3.020, -0.856, 0.008),
    (1925.0, 1930.0, 23.789, 1.333, -0.831, 0.127),
    (1930.0, 1935.0, 24.418, 0.052, -0.449, 0.142),
    (1935.0, 1940.0, 24.164, -0.419, -0.022, 0.702),
    (1940.0, 1945.0, 24.426, 1.645, 2.086, -1.106),
    (1945.0, 1950.0, 27.050, 2.499, -1.232, 0.614),
]

# Where the spline hands over to the Espenak-Meeus 1941-1961 polynomial. The
# two sources agree to 3 ms at 1948, so the join needs no blend; through the
# 1800s they differ by 1-5 s, so an earlier join would leave a step.
DT_SPLINE_END = 1948.0

# Before the spline's first knot the same authors give a long-term parabola,
# DT = -320 + 32.5 ((Y - 1825) / 100)^2. It sits 358 s above the spline at
# -720, so a cubic Hermite bridge carries value and slope from the parabola at
# DT_BRIDGE_START to the spline at -720. The bridge is this engine's choice,
# not the authors'; sigma(DT) there is 400-900 s.
DT_SPLINE_START = -720.0
DT_BRIDGE_START = -1520.0


def _dt_parabola(y):
    u = (y - 1825.0) / 100.0
    return -320.0 + 32.5 * u * u


def _dt_spline(y):
    for k0, k1, a0, a1, a2, a3 in _DT_SPLINE:
        if y < k1:
            t = (y - k0) / (k1 - k0)
            return a0 + t * (a1 + t * (a2 + t * a3))
    raise ValueError(f"year {y} is past the delta-T spline")


def _dt_bridge(y):
    h = DT_SPLINE_START - DT_BRIDGE_START
    s = (y - DT_BRIDGE_START) / h
    p0 = _dt_parabola(DT_BRIDGE_START)
    m0 = 0.65 * ((DT_BRIDGE_START - 1825.0) / 100.0) * h
    k0, k1, a0, a1, _a2, _a3 = _DT_SPLINE[0]
    p1 = a0
    m1 = a1 / (k1 - k0) * h
    s2 = s * s
    s3 = s2 * s
    return ((2.0 * s3 - 3.0 * s2 + 1.0) * p0 + (s3 - 2.0 * s2 + s) * m0
            + (3.0 * s2 - 2.0 * s3) * p1 + (s3 - s2) * m1)


def delta_t(jd_ut):
    """TT - UT1 in seconds.

    Observed values 1955-2025 (linear interpolation) with a gentle
    extrapolation after; the Espenak & Meeus (2006) polynomial for 1948-1955;
    the Morrison, Stephenson, Hohenkerk & Zawilski (2021) spline from -720 to
    1948; a Hermite bridge and then the same authors' long-term parabola
    before -720.
    """
    y = 2000.0 + (jd_ut - J2000) / 365.25
    if 1955 <= y <= 2025:
        for (y0, d0), (y1, d1) in zip(_DT_OBS, _DT_OBS[1:]):
            if y0 <= y <= y1:
                return d0 + (d1 - d0) * (y - y0) / (y1 - y0)
    if y > 2025:
        # ΔT is flat-to-falling (69.4 -> 69.2 s over 2020-2025; Earth's spin
        # sped up post-2016). Continue the observed slope (-0.04 s/yr) plus
        # the long-term tidal quadratic (+32 s/cy²) so it rejoins the secular
        # rise. An 80-year ΔT forecast carries ~±37 s uncertainty (Huber
        # 2006); anything steeper is false precision.
        t = y - 2025
        return 69.2 - 0.04 * t + 32 * (t / 100) ** 2
    if y >= DT_SPLINE_END:
        t = y - 1950
        return 29.07 + 0.407 * t - t**2 / 233 + t**3 / 2547
    if y >= DT_SPLINE_START:
        return _dt_spline(y)
    if y >= DT_BRIDGE_START:
        return _dt_bridge(y)
    return _dt_parabola(y)


def jd_tt(jd_ut):
    return jd_ut + delta_t(jd_ut) / 86400.0


# ---------------------------------------------------------------- VSOP87D
class Vsop:
    _cache = {}

    def __init__(self, level="full"):
        self.level = level
        self.series = {}

    def _planet(self, name):
        key = (name, self.level)
        if key not in Vsop._cache:
            Vsop._cache[key] = _load(f"vsop87d_{name}.{self.level}.json")
        return Vsop._cache[key]

    def heliocentric(self, name, jde):
        """Heliocentric ecliptic spherical coords of date: (L rad, B rad, R au).

        Earth prefers an `earth_cheb.json` pack when one is on disk. This is
        the highest-leverage interception in the engine: Earth is never a chart
        body, but every geocentric direction is `body - earth`, so Earth's own
        error is a floor under every other body (amplified by 1/distance -- see
        range-expansion.md Tier C). Routing it here rather than at each call
        site means all five Earth consumers -- apparent planets, the Sun, the
        packed-body pipeline, light-time iteration, and the astrometric
        validator leg -- pick the pack up at once. Inert until a pack exists.
        """
        if name == "earth":
            pack = _earth_cheb()
            slabs = _earth_era_slabs()
            if pack is not None or slabs:
                # The covering slab wins: the default pack first, then the
                # era slabs (deep-time R1). None covering means the same
                # ValueError the single-pack path always raised.
                covering = None
                if pack is not None and pack.jd0 <= jde <= pack.jd1:
                    covering = pack
                else:
                    for slab in slabs:
                        if slab.jd0 <= jde <= slab.jd1:
                            covering = slab
                            break
                if covering is None:
                    if pack is None:
                        raise ValueError(
                            f"jd {jde} outside fitted range (no era slab covers it)")
                    covering = pack  # its xyz raises outside the span, as before
                x, y, z = covering.xyz(jde)
                L = math.atan2(y, x) % (2 * math.pi)
                B = math.atan2(z, math.hypot(x, y))
                R = math.sqrt(x * x + y * y + z * z)
                # The pack is ecliptic J2000; this method contracts to return
                # coordinates of date, as the VSOP series does.
                L, B = _precess_ecliptic(L, B, J2000, jde)
                return L % (2 * math.pi), B, R
        t = (jde - J2000) / 365250.0  # Julian millennia
        s = self._planet(name)
        out = []
        for var in ("L", "B", "R"):
            total, tn = 0.0, 1.0
            for order_terms in s[var]:
                acc = 0.0
                for A, B, C in order_terms:
                    acc += A * math.cos(B + C * t)
                total += acc * tn
                tn *= t
            out.append(total)
        L, B, R = out
        return L % (2 * math.pi), B, R


# ---------------------------------------------------------------- nutation
_NUT = None

def nutation(jde):
    """IAU 1980 nutation: (delta_psi, delta_eps) in radians."""
    global _NUT
    if _NUT is None:
        _NUT = _load("nutation_iau1980.json")
    T = (jde - J2000) / 36525.0
    D = (297.85036 + 445267.11148 * T - 0.0019142 * T * T + T**3 / 189474) * DEG
    M = (357.52772 + 35999.050340 * T - 0.0001603 * T * T - T**3 / 300000) * DEG
    N = (134.96298 + 477198.867398 * T + 0.0086972 * T * T + T**3 / 5620) * DEG
    F = (93.27191 + 483202.017538 * T - 0.0036825 * T * T + T**3 / 327270) * DEG
    Om = (125.04452 - 1934.136261 * T + 0.0020708 * T * T + T**3 / 450000) * DEG
    dpsi = deps = 0.0
    for d, m, n, f, om, s0, s1, c0, c1 in reversed(_NUT):
        arg = d * D + m * M + n * N + f * F + om * Om
        dpsi += math.sin(arg) * (s0 + s1 * T)
        deps += math.cos(arg) * (c0 + c1 * T)
    return dpsi * 1e-4 * ARCSEC, deps * 1e-4 * ARCSEC


def mean_obliquity(jde):
    """IAU 1980 mean obliquity, radians."""
    T = (jde - J2000) / 36525.0
    sec = 84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T**3
    return sec * ARCSEC


def true_obliquity(jde):
    return mean_obliquity(jde) + nutation(jde)[1]


# ---------------------------------------------------------------- frame fix
def _fk5_correction(L, B, jde):
    """VSOP dynamical ecliptic -> FK5 (Meeus 32.3). ~0.1 arcsec effect."""
    T = (jde - J2000) / 36525.0
    Lp = L - (1.397 + 0.00031 * T) * T * DEG
    dL = -0.09033 * ARCSEC + 0.03916 * ARCSEC * (math.cos(Lp) + math.sin(Lp)) * math.tan(B)
    dB = 0.03916 * ARCSEC * (math.cos(Lp) - math.sin(Lp))
    return L + dL, B + dB


# ---------------------------------------------------------------- planets
def _geo_vector(vsop, name, jde):
    """Geocentric rectangular ecliptic-of-date vector planet minus earth."""
    L0, B0, R0 = vsop.heliocentric("earth", jde)
    L, B, R = vsop.heliocentric(name, jde)
    x = R * math.cos(B) * math.cos(L) - R0 * math.cos(B0) * math.cos(L0)
    y = R * math.cos(B) * math.sin(L) - R0 * math.cos(B0) * math.sin(L0)
    z = R * math.sin(B) - R0 * math.sin(B0)
    return x, y, z


def planet_apparent(vsop, name, jde):
    """Apparent geocentric ecliptic lon/lat (true equinox of date), distance.

    Evaluating both Earth and planet at (t - tau) folds annual aberration
    into the light-time correction to first order (Meeus ch. 33)."""
    x, y, z = _geo_vector(vsop, name, jde)
    delta = math.sqrt(x * x + y * y + z * z)
    for _ in range(2):  # light-time iteration
        tau = LIGHT_TIME_AU * delta
        x, y, z = _geo_vector(vsop, name, jde - tau)
        delta = math.sqrt(x * x + y * y + z * z)
    lon = math.atan2(y, x) % (2 * math.pi)
    lat = math.atan2(z, math.sqrt(x * x + y * y))
    lon, lat = _fk5_correction(lon, lat, jde)
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat, delta


def sun_apparent(vsop, jde):
    """Apparent geocentric Sun (true equinox of date)."""
    L0, B0, R0 = vsop.heliocentric("earth", jde)
    lon = (L0 + math.pi) % (2 * math.pi)
    lat = -B0
    lon, lat = _fk5_correction(lon, lat, jde)
    lon -= 20.4898 * ARCSEC / R0          # annual aberration
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat, R0


# ---------------------------------------------------------------- moon
_MOON = None

def _moon_fundamental(T):
    Lp = (218.3164477 + 481267.88123421 * T - 0.0015786 * T * T
          + T**3 / 538841 - T**4 / 65194000) * DEG
    D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T
         + T**3 / 545868 - T**4 / 113065000) * DEG
    M = (357.5291092 + 35999.0502909 * T - 0.0001535 * T * T + T**3 / 24490000) * DEG
    Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T
          + T**3 / 69699 - T**4 / 14712000) * DEG
    F = (93.272095 + 483202.0175233 * T - 0.0036539 * T * T
         - T**3 / 3526000 + T**4 / 863310000) * DEG
    return Lp, D, M, Mp, F


def moon_geometric(jde):
    """Geocentric Moon, mean equinox of date (Meeus ch.47): lon, lat (rad), dist (km)."""
    global _MOON
    if _MOON is None:
        _MOON = _load("moon_meeus47.json")
    T = (jde - J2000) / 36525.0
    Lp, D, M, Mp, F = _moon_fundamental(T)
    A1 = (119.75 + 131.849 * T) * DEG
    A2 = (53.09 + 479264.29 * T) * DEG
    A3 = (313.45 + 481266.484 * T) * DEG
    E = 1 - 0.002516 * T - 0.0000074 * T * T
    E2 = E * E
    sl = 3958 * math.sin(A1) + 1962 * math.sin(Lp - F) + 318 * math.sin(A2)
    sr = 0.0
    sb = (-2235 * math.sin(Lp) + 382 * math.sin(A3) + 175 * math.sin(A1 - F)
          + 175 * math.sin(A1 + F) + 127 * math.sin(Lp - Mp) - 115 * math.sin(Lp + Mp))
    for d, m, mp, f, l_c, r_c in _MOON["ta"]:
        arg = d * D + m * M + mp * Mp + f * F
        e = E if abs(m) == 1 else (E2 if abs(m) == 2 else 1.0)
        sl += l_c * math.sin(arg) * e
        sr += r_c * math.cos(arg) * e
    for d, m, mp, f, b_c in _MOON["tb"]:
        arg = d * D + m * M + mp * Mp + f * F
        e = E if abs(m) == 1 else (E2 if abs(m) == 2 else 1.0)
        sb += b_c * math.sin(arg) * e
    lon = (Lp + sl * 1e-6 * DEG) % (2 * math.pi)
    lat = sb * 1e-6 * DEG
    dist = 385000.56 + sr * 1e-3
    return lon, lat, dist


def moon_apparent(jde):
    lon, lat, dist = moon_geometric(jde)
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat, dist


# ---------------------------------------------------------------- precise moon
_MOON_CHEB = None
C_KM_PER_DAY = 299792.458 * 86400.0


_EARTH_CHEB = None


def _earth_cheb():
    """Lazy-load the heliocentric Earth pack (fit_planet.py earth), or None.

    Kept separate from the chart-body pack loader because Earth is not a chart
    body -- it is the observer, consumed by Vsop.heliocentric.
    """
    global _EARTH_CHEB
    if _EARTH_CHEB is None:
        from .chebyshev import ChebSeries
        p = os.path.join(DATA, "earth_cheb.json")
        _EARTH_CHEB = ChebSeries.load(p) if os.path.exists(p) else False
    return _EARTH_CHEB or None


# Era slabs (deep-time R1): `{body}_cheb.{era}.json` beside the default packs,
# e.g. `earth_cheb.classical.json`. The slab whose span covers the instant
# wins, the default pack first. No slab on disk, no behaviour change.
ERA_SLABS = ("classical",)

_EARTH_ERA = None


def _earth_era_slabs():
    global _EARTH_ERA
    if _EARTH_ERA is None:
        from .chebyshev import ChebSeries
        out = []
        for era in ERA_SLABS:
            p = os.path.join(DATA, f"earth_cheb.{era}.json")
            if os.path.exists(p):
                out.append(ChebSeries.load(p))
        _EARTH_ERA = out
    return _EARTH_ERA


def _moon_cheb():
    """Lazy-load JPL-fit Chebyshev moon (full tier preferred)."""
    global _MOON_CHEB
    if _MOON_CHEB is None:
        from .chebyshev import ChebSeries
        for tier in ("full", "embedded"):
            p = os.path.join(DATA, f"moon_cheb.{tier}.json")
            if os.path.exists(p):
                _MOON_CHEB = ChebSeries.load(p)
                break
        else:
            _MOON_CHEB = False
    return _MOON_CHEB


_MOON_ERA = None


def _moon_era_slabs():
    """Lazy-load the Moon's era slabs (deep-time R1): `moon_cheb.{era}.json`
    beside the tiered packs."""
    global _MOON_ERA
    if _MOON_ERA is None:
        from .chebyshev import ChebSeries
        out = []
        for era in ERA_SLABS:
            p = os.path.join(DATA, f"moon_cheb.{era}.json")
            if os.path.exists(p):
                out.append(ChebSeries.load(p))
        _MOON_ERA = out
    return _MOON_ERA


def moon_pack_at(jde):
    """The Moon slab covering jde: the modern tier first, then the era slabs;
    None when none covers. The precise-Moon path needs light-time headroom,
    hence the 0.1-day margin both here and in the slab check."""
    cheb = _moon_cheb()
    if cheb and cheb.jd0 <= jde - 0.1 and jde + 0.1 <= cheb.jd1:
        return cheb
    for slab in _moon_era_slabs():
        if slab.jd0 <= jde - 0.1 and jde + 0.1 <= slab.jd1:
            return slab
    return None


def moon_apparent_precise(jde):
    """Apparent Moon from JPL-fit Chebyshev (ecliptic J2000 km).
    Light-time, precession to date, nutation. Raises outside fitted range."""
    cheb = moon_pack_at(jde)
    if not cheb:
        raise FileNotFoundError("moon_cheb data not built")
    x, y, z = cheb.xyz(jde)
    dist = math.sqrt(x * x + y * y + z * z)
    tau = dist / C_KM_PER_DAY  # ~1.3 light-seconds
    x, y, z = cheb.xyz(jde - tau)
    lon = math.atan2(y, x) % (2 * math.pi)
    lat = math.atan2(z, math.sqrt(x * x + y * y))
    lon, lat = _precess_ecliptic(lon, lat, J2000, jde)
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat, dist


def _ecl_j2000_to_ecl_date(v, jde):
    """Rotate a vector from the ecliptic-J2000 data frame (obliquity
    84381.448 arcsec, as used by Horizons/Meeus) to the mean ecliptic of
    date (Vondrak 2011)."""
    x, y, z = v
    s, c = math.sin(_EPS0_FRAME), math.cos(_EPS0_FRAME)
    e = (x, y * c - z * s, y * s + z * c)  # -> J2000 equatorial
    xt, yt, zt = _ltp_ecl_matrix(jde)
    return (sum(xt[i] * e[i] for i in range(3)),
            sum(yt[i] * e[i] for i in range(3)),
            sum(zt[i] * e[i] for i in range(3)))



def true_node_precise(jde):
    """Osculating node from JPL-fit moon state (analytic Chebyshev derivative).
    Angular momentum is rotated into the ecliptic-of-date frame first: the
    ecliptic pole moves ~47"/century, and the Moon's shallow 5.1-degree
    inclination amplifies any frame error by ~11x in node longitude."""
    cheb = moon_pack_at(jde)
    if not cheb:
        raise FileNotFoundError("moon_cheb data not built")
    (x, y, z), (vx, vy, vz) = cheb.xyz_vel(jde)
    h = (y * vz - z * vy, z * vx - x * vz, x * vy - y * vx)
    hx, hy, hz = _ecl_j2000_to_ecl_date(h, jde)
    node = math.atan2(hx, -hy) % (2 * math.pi)
    return (node + nutation(jde)[0]) % (2 * math.pi)


def moon_in_precise_range(jde):
    return moon_pack_at(jde) is not None


# ---------------------------------------------------------------- lunar node
def mean_node(jde):
    """Mean ascending lunar node, true equinox of date."""
    T = (jde - J2000) / 36525.0
    om = (125.0445479 - 1934.1362891 * T + 0.0020754 * T * T
          + T**3 / 467441 - T**4 / 60616000) * DEG
    return (om + nutation(jde)[0]) % (2 * math.pi)


def true_node(jde):
    """Osculating ascending node from Moon state vector (r x v)."""
    h = 0.01  # days, for numerical velocity
    def xyz(t):
        lon, lat, dist = moon_geometric(t)
        return (dist * math.cos(lat) * math.cos(lon),
                dist * math.cos(lat) * math.sin(lon),
                dist * math.sin(lat))
    x0, y0, z0 = xyz(jde - h)
    x1, y1, z1 = xyz(jde + h)
    x, y, z = xyz(jde)
    vx, vy, vz = (x1 - x0) / (2 * h), (y1 - y0) / (2 * h), (z1 - z0) / (2 * h)
    # angular momentum h = r x v; ascending node n = k x h
    hx = y * vz - z * vy
    hy = z * vx - x * vz
    # node vector in ecliptic plane: (-hy, hx)
    node = math.atan2(hx, -hy) % (2 * math.pi)
    return (node + nutation(jde)[0]) % (2 * math.pi)


# ---------------------------------------------------------------- chiron
_CHIRON = None


def chiron_apparent(vsop, jde):
    """Apparent geocentric Chiron from heliocentric Chebyshev fit (1850-2150)."""
    global _CHIRON
    if _CHIRON is None:
        from .chebyshev import ChebSeries
        _CHIRON = ChebSeries.load(os.path.join(DATA, "chiron_cheb.json"))
    return smallbody_apparent(vsop, _CHIRON, jde)


def smallbody_apparent(vsop, cheb, jde):
    """Apparent geocentric position from a heliocentric ecliptic-J2000
    Chebyshev fit (Chiron, Ceres, Pallas, Juno, Vesta, Pholus, ...).
    Same outer-body pipeline as Pluto: geocentric assembly in J2000,
    light-time, annual aberration, precession to date, nutation."""
    L0, B0, R0 = vsop.heliocentric("earth", jde)
    Lj, Bj = _precess_ecliptic(L0, B0, jde, J2000)
    ex = R0 * math.cos(Bj) * math.cos(Lj)
    ey = R0 * math.cos(Bj) * math.sin(Lj)
    ez = R0 * math.sin(Bj)

    def geo(t):
        cx, cy, cz = cheb.xyz(t)
        return cx - ex, cy - ey, cz - ez

    x, y, z = geo(jde)
    delta = math.sqrt(x * x + y * y + z * z)
    for _ in range(2):
        x, y, z = geo(jde - LIGHT_TIME_AU * delta)
        delta = math.sqrt(x * x + y * y + z * z)
    lon = math.atan2(y, x) % (2 * math.pi)
    lat = math.atan2(z, math.sqrt(x * x + y * y))
    # Precess the geometric direction to of-date FIRST, then apply annual
    # aberration: Meeus eq. 23.3 is an of-date formula and sun_lon (from the
    # of-date VSOP Earth) and pi_per are of-date arguments. Applying it to the
    # J2000 direction mixed frames -- the sun_lon - lon argument was off by
    # the accumulated general precession (~1.4 deg/century), rotating the
    # 20.5" aberration ellipse to the wrong phase: ~0.5" in 1850-2150,
    # ~5" at the 1000/3000 edges, phase-locked to the body's orbit. The star
    # path (stars.py) always had this order right.
    lon, lat = _precess_ecliptic(lon, lat, J2000, jde)
    # annual aberration (Meeus eq. 23.3) -- BOTH components. The latitude term
    # is not optional for inclined bodies: it scales with sin(beta), so Pallas
    # (inclination 34.8 deg, |beta| up to ~32 deg) was off by ~10" in latitude
    # against JPL while its longitude was under 1", and the error vanished at
    # the epochs where it crossed the ecliptic.
    T = (jde - J2000) / 36525.0
    sun_lon = (L0 + math.pi) % (2 * math.pi)
    k = 20.4898 * ARCSEC
    e = 0.016708634 - 0.000042037 * T
    pi_per = (102.93735 + 1.71946 * T) * DEG
    lon += (-k * math.cos(sun_lon - lon) + e * k * math.cos(pi_per - lon)) / math.cos(lat)
    lat += -k * math.sin(lat) * (
        math.sin(sun_lon - lon) - e * math.sin(pi_per - lon))
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat, delta


# ---------------------------------------------------------------- pluto
_PLUTO = None

def pluto_heliocentric(jde):
    """Meeus ch.37 heliocentric Pluto, ecliptic J2000: (l rad, b rad, r AU)."""
    global _PLUTO
    if _PLUTO is None:
        _PLUTO = _load("pluto_meeus37.json")
    T = (jde - J2000) / 36525.0
    J = (34.35 + 3034.9057 * T) * DEG
    S = (50.08 + 1222.1138 * T) * DEG
    P = (238.96 + 144.96 * T) * DEG
    l = b = r = 0.0
    for i, j, k, lA, lB, bA, bB, rA, rB in _PLUTO:
        a = i * J + j * S + k * P
        sa, ca = math.sin(a), math.cos(a)
        l += lA * sa + lB * ca
        b += bA * sa + bB * ca
        r += rA * sa + rB * ca
    l = (l + 238.958116 + 144.96 * T) * DEG  # lA etc. already deg in table
    b = (b - 3.908239) * DEG
    r += 40.7241346
    return l, b, r


def pluto_apparent(vsop, jde):
    """Meeus ch.37 Pluto (valid 1885-2099): heliocentric J2000 series,
    -> geocentric, light-time+aberration, precess J2000 -> date, nutation."""

    def helio_j2000(t_jde):
        return pluto_heliocentric(t_jde)

    def earth_j2000(t_jde):
        # VSOP87D is of-date; rotate ecliptic-of-date -> J2000 by -precession in longitude
        L, B, R = vsop.heliocentric("earth", t_jde)
        Lj, Bj = _precess_ecliptic(L, B, t_jde, J2000)
        return Lj, Bj, R

    def geo(t_jde):
        l, b, r = helio_j2000(t_jde)
        L0, B0, R0 = earth_j2000(jde)  # Earth at observation time t
        x = r * math.cos(b) * math.cos(l) - R0 * math.cos(B0) * math.cos(L0)
        y = r * math.cos(b) * math.sin(l) - R0 * math.cos(B0) * math.sin(L0)
        z = r * math.sin(b) - R0 * math.sin(B0)
        return x, y, z

    x, y, z = geo(jde)
    delta = math.sqrt(x * x + y * y + z * z)
    for _ in range(2):
        tau = LIGHT_TIME_AU * delta
        x, y, z = geo(jde - tau)
        delta = math.sqrt(x * x + y * y + z * z)
    lon = math.atan2(y, x) % (2 * math.pi)
    lat = math.atan2(z, math.sqrt(x * x + y * y))
    # precess J2000 -> mean of date FIRST (see smallbody_apparent: eq. 23.3 is
    # an of-date formula; applying it to the J2000 direction rotated the
    # aberration ellipse by the accumulated precession), then aberration, then
    # nutation.
    lon, lat = _precess_ecliptic(lon, lat, J2000, jde)
    # annual aberration (Meeus eq. 23.3), both components -- Pluto's
    # inclination (17.2 deg) makes the latitude term a real one, though
    # smaller than Pallas's.
    L0, B0, R0 = vsop.heliocentric("earth", jde)
    sun_lon = (L0 + math.pi) % (2 * math.pi)
    k = 20.4898 * ARCSEC
    e = 0.016708634 - 0.000042037 * ((jde - J2000) / 36525.0)
    pi_per = (102.93735 + 1.71946 * ((jde - J2000) / 36525.0)) * DEG
    dlon = (-k * math.cos(sun_lon - lon) + e * k * math.cos(pi_per - lon)) / math.cos(lat)
    lon += dlon
    lat += -k * math.sin(lat) * (
        math.sin(sun_lon - lon) - e * math.sin(pi_per - lon))
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat, delta


# ---------------------------------------------------------------- frames+
def equatorial(lon, lat, eps):
    """Ecliptic lon/lat -> right ascension, declination (all radians)."""
    ra = math.atan2(
        math.sin(lon) * math.cos(eps) - math.tan(lat) * math.sin(eps), math.cos(lon)
    ) % (2 * math.pi)
    dec = math.asin(
        math.sin(lat) * math.cos(eps) + math.cos(lat) * math.sin(eps) * math.sin(lon)
    )
    return ra, dec


# Mean ayanamsa at J2000.0 (degrees) per mode. Values are the standard
# epoch anchors (matched to Swiss Ephemeris 2.10 to 1e-9 deg); propagation
# uses Vondrak 2011 ecliptic precession, the same model Swiss Ephemeris
# uses: agreement over 1900-2099 is <=0.005 arcsec.
AYANAMSA_J2000 = {
    "lahiri": 23.857092325,
    "fagan_bradley": 24.740299966,
    "krishnamurti": 23.760240012,
    "raman": 22.410791012,
    "yukteshwar": 22.478803000,
}


def ayanamsa(jde, mode):
    """Mean ayanamsa in degrees. Sidereal longitude = (tropical true-equinox
    longitude - nutation in longitude) - ayanamsa: the sidereal zodiac is
    anchored to the mean equinox."""
    a0 = AYANAMSA_J2000[mode]
    lon, _ = _precess_ecliptic(a0 * DEG, 0.0, J2000, jde)
    return lon / DEG


def mean_lilith(jde):
    """Mean lunar apogee (Black Moon Lilith) on the inclined lunar orbit:
    apparent lon (true equinox) and orbital latitude, radians."""
    T = (jde - J2000) / 36525.0
    Lp, D, M, Mp, F = _moon_fundamental(T)
    apog = Lp - Mp + math.pi          # mean perigee + 180
    om = (125.0445479 - 1934.1362891 * T + 0.0020754 * T * T
          + T**3 / 467441 - T**4 / 60616000) * DEG
    inc = 5.145396374 * DEG
    u = apog - om
    lat = math.asin(math.sin(inc) * math.sin(u))
    lon = om + math.atan2(math.cos(inc) * math.sin(u), math.cos(u))
    lon = (lon + nutation(jde)[0]) % (2 * math.pi)
    return lon, lat


GM_EARTH_MOON = 403503.2356 * 86400.0**2  # km^3/day^2


def _osc_apogee_from_state(x, y, z, vx, vy, vz, jde, frame_j2000):
    """Osculating apogee point from a geocentric lunar state vector (km,
    km/day): apparent ecliptic lon/lat of date (rad) + distance (km).
    Hypersensitive to the lunar theory: the eccentricity vector amplifies
    position/velocity differences ~1/e (~18x). Swiss Ephemeris in Moshier
    mode differs from our DE423 fit by up to ~3 arcmin here; published
    'True Lilith' values disagree across software at that scale."""
    mu = GM_EARTH_MOON
    r = math.sqrt(x * x + y * y + z * z)
    v2 = vx * vx + vy * vy + vz * vz
    rv = x * vx + y * vy + z * vz
    ex = (v2 * x - rv * vx) / mu - x / r
    ey = (v2 * y - rv * vy) / mu - y / r
    ez = (v2 * z - rv * vz) / mu - z / r
    e = math.sqrt(ex * ex + ey * ey + ez * ez)
    a = 1.0 / (2.0 / r - v2 / mu)
    s = a * (1 + e) / e
    px, py, pz = -ex * s, -ey * s, -ez * s
    if frame_j2000:
        px, py, pz = _ecl_j2000_to_ecl_date((px, py, pz), jde)
    lon = (math.atan2(py, px) + nutation(jde)[0]) % (2 * math.pi)
    lat = math.atan2(pz, math.hypot(px, py))
    return lon, lat, math.sqrt(px * px + py * py + pz * pz)


def osc_apogee_precise(jde):
    """Osculating lunar apogee (True Lilith) from the Chebyshev moon."""
    cheb = moon_pack_at(jde)
    if not cheb:
        raise FileNotFoundError("moon_cheb data not built")
    (x, y, z), (vx, vy, vz) = cheb.xyz_vel(jde)
    return _osc_apogee_from_state(x, y, z, vx, vy, vz, jde, frame_j2000=True)


def osc_apogee_series(jde):
    """Series fallback outside the Chebyshev range (same finite-difference
    state as the true-node fallback)."""
    h = 0.01

    def xyz(t):
        lon, lat, dist = moon_geometric(t)
        return (dist * math.cos(lat) * math.cos(lon),
                dist * math.cos(lat) * math.sin(lon),
                dist * math.sin(lat))

    x0, y0, z0 = xyz(jde - h)
    x1, y1, z1 = xyz(jde + h)
    x, y, z = xyz(jde)
    return _osc_apogee_from_state(
        x, y, z, (x1 - x0) / (2 * h), (y1 - y0) / (2 * h), (z1 - z0) / (2 * h),
        jde, frame_j2000=False,
    )


class KeplerOrbit:
    """Constant-element two-body orbit with the same xyz(jde) interface as
    ChebSeries, so smallbody_apparent takes either. Used for the
    Hamburg-school (Uranian) fictitious bodies: heliocentric ecliptic
    J2000, elements fitted to the published constant-element orbits (see
    fit_uranian.py)."""

    def __init__(self, els, epoch=J2000):
        self.els = els
        self.epoch = epoch

    def xyz(self, jde):
        d = self.els
        a, e, i = d["a"], d["e"], d["i"]
        node, w = d["node"], d["peri"]
        M = d["M0"] + d["n"] * (jde - self.epoch)
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


EARTH_RADIUS_AU = 6378.14 / 149597870.7
EARTH_FLAT = 0.99664719  # 1 - f, IAU 1976 figure


def topocentric_ecl(lon, lat, dist_au, lst, obs_lat, alt_m, eps):
    """Diurnal parallax in ecliptic coordinates (Meeus ch. 11/40).
    lst = local apparent sidereal time (rad). Returns (lon, lat, dist_au)."""
    u = math.atan(EARTH_FLAT * math.tan(obs_lat))
    rs = EARTH_FLAT * math.sin(u) + alt_m / 6378140.0 * math.sin(obs_lat)
    rc = math.cos(u) + alt_m / 6378140.0 * math.cos(obs_lat)
    ox = EARTH_RADIUS_AU * rc * math.cos(lst)
    oy = EARTH_RADIUS_AU * rc * math.sin(lst)
    oz = EARTH_RADIUS_AU * rs
    ra, dec = equatorial(lon, lat, eps)
    bx = dist_au * math.cos(dec) * math.cos(ra)
    by = dist_au * math.cos(dec) * math.sin(ra)
    bz = dist_au * math.sin(dec)
    tx, ty, tz = bx - ox, by - oy, bz - oz
    ra2 = math.atan2(ty, tx)
    dec2 = math.atan2(tz, math.hypot(tx, ty))
    lon2 = math.atan2(
        math.sin(ra2) * math.cos(eps) + math.tan(dec2) * math.sin(eps), math.cos(ra2)
    ) % (2 * math.pi)
    lat2 = math.asin(
        math.sin(dec2) * math.cos(eps) - math.cos(dec2) * math.sin(eps) * math.sin(ra2)
    )
    return lon2, lat2, math.sqrt(tx * tx + ty * ty + tz * tz)


# ------------------------------------------------- Vondrak 2011 precession
# Long-term precession of the ecliptic and equator (Vondrak, Capitaine &
# Wallace 2011, A&A 534 A22; coefficient tables as carried by ERFA under
# BSD-3). Replaces the IAU 1976 angles: the ~0.3 arcsec range-edge residual
# vs Swiss Ephemeris (which uses the same model) collapses.
_PQ_POL = ((5851.607687, -0.1189000, -0.00028913, 0.000000101),
           (-1600.886300, 1.1689818, -0.00000020, -0.000000437))
_PQ_PER = ((708.15, -5486.751211, -684.661560, 667.666730, -5523.863691),
           (2309.00, -17.127623, 2446.283880, -2354.886252, -549.747450),
           (1620.00, -617.517403, 399.671049, -428.152441, -310.998056),
           (492.20, 413.442940, -356.652376, 376.202861, 421.535876),
           (1183.00, 78.614193, -186.387003, 184.778874, -36.776172),
           (622.00, -180.732815, -316.800070, 335.321713, -145.278396),
           (882.00, -87.676083, 198.296701, -185.138669, -34.744450),
           (547.00, 46.140315, 101.135679, -120.972830, 22.885731))
_XY_POL = ((5453.282155, 0.4252841, -0.00037173, -0.000000152),
           (-73750.930350, -0.7675452, -0.00018725, 0.000000231))
_XY_PER = ((256.75, -819.940624, 75004.344875, 81491.287984, 1558.515853),
           (708.15, -8444.676815, 624.033993, 787.163481, 7774.939698),
           (274.20, 2600.009459, 1251.136893, 1251.296102, -2219.534038),
           (241.45, 2755.175630, -1102.212834, -1257.950837, -2523.969396),
           (2309.00, -167.659835, -2660.664980, -2966.799730, 247.850422),
           (492.20, 871.855056, 699.291817, 639.744522, -846.485643),
           (396.10, 44.769698, 153.167220, 131.600209, -1393.124055),
           (288.90, -512.313065, -950.865637, -445.040117, 368.526116),
           (231.10, -819.415595, 499.754645, 584.522874, 749.045012),
           (1610.00, -538.071099, -145.188210, -89.756563, 444.704518),
           (620.00, -189.793622, 558.116553, 524.429630, 235.934465),
           (157.87, -402.922932, -23.923029, -13.549067, 374.049623),
           (220.30, 179.516345, -165.405086, -210.157124, -171.330180),
           (1200.00, -9.814756, 9.344131, -44.919798, -22.899655))
_EPS0_V = 84381.406 * ARCSEC   # J2000 obliquity used by the Vondrak model
_EPS0_FRAME = 84381.448 * ARCSEC  # obliquity defining our ecliptic-J2000 data


def _ltp_pecl(jde):
    """Unit vector of the ecliptic pole, J2000 equatorial frame."""
    t = (jde - J2000) / 36525.0
    p = q = 0.0
    w = 2.0 * math.pi * t
    for per, c1, c2, s1, s2 in _PQ_PER:
        a = w / per
        ca, sa = math.cos(a), math.sin(a)
        p += ca * c1 + sa * s1
        q += ca * c2 + sa * s2
    tn = 1.0
    for i in range(4):
        p += _PQ_POL[0][i] * tn
        q += _PQ_POL[1][i] * tn
        tn *= t
    p *= ARCSEC
    q *= ARCSEC
    z = math.sqrt(max(1.0 - p * p - q * q, 0.0))
    s, c = math.sin(_EPS0_V), math.cos(_EPS0_V)
    return (p, -q * c - z * s, -q * s + z * c)


def _ltp_pequ(jde):
    """Unit vector of the equator pole, J2000 equatorial frame."""
    t = (jde - J2000) / 36525.0
    x = y = 0.0
    w = 2.0 * math.pi * t
    for per, c1, c2, s1, s2 in _XY_PER:
        a = w / per
        ca, sa = math.cos(a), math.sin(a)
        x += ca * c1 + sa * s1
        y += ca * c2 + sa * s2
    tn = 1.0
    for i in range(4):
        x += _XY_POL[0][i] * tn
        y += _XY_POL[1][i] * tn
        tn *= t
    x *= ARCSEC
    y *= ARCSEC
    return (x, y, math.sqrt(max(1.0 - x * x - y * y, 0.0)))


def _ltp_ecl_matrix(jde):
    """Rows of the rotation J2000-equatorial -> mean ecliptic/equinox of
    date (ERFA eraLtecm): x = equinox, z = ecliptic pole, y = z cross x."""
    p = _ltp_pequ(jde)
    z = _ltp_pecl(jde)
    wx = (p[1] * z[2] - p[2] * z[1], p[2] * z[0] - p[0] * z[2],
          p[0] * z[1] - p[1] * z[0])
    n = math.sqrt(wx[0] ** 2 + wx[1] ** 2 + wx[2] ** 2)
    x = (wx[0] / n, wx[1] / n, wx[2] / n)
    y = (z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2],
         z[0] * x[1] - z[1] * x[0])
    return x, y, z


def _precess_ecliptic(lon, lat, jde_from, jde_to):
    """Precession of ecliptic coordinates between epochs (Vondrak 2011):
    ecliptic-of-from -> J2000 equatorial -> ecliptic-of-to."""
    cb = math.cos(lat)
    v = (cb * math.cos(lon), cb * math.sin(lon), math.sin(lat))
    xf, yf, zf = _ltp_ecl_matrix(jde_from)
    # transpose multiply: ecliptic-of-from -> J2000 equatorial
    e = tuple(xf[i] * v[0] + yf[i] * v[1] + zf[i] * v[2] for i in range(3))
    xt, yt, zt = _ltp_ecl_matrix(jde_to)
    u = (sum(xt[i] * e[i] for i in range(3)),
         sum(yt[i] * e[i] for i in range(3)),
         sum(zt[i] * e[i] for i in range(3)))
    return (math.atan2(u[1], u[0]) % (2 * math.pi),
            math.asin(max(-1.0, min(1.0, u[2]))))
