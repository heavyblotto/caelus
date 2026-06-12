"""astroengine.pheno -- phase, elongation, apparent diameter, magnitude,
equation of time, horizontal coordinates, refraction.

Magnitude models: Mallama & Hilton 2018 for Mercury-Saturn (Saturn with
the ring term), constant-plus-distance for Sun and Pluto, the Mallama
secular ramp for Neptune, Allen's phase law for the Moon (valid to phase
angle ~140 deg; the Moon is invisible near conjunction anyway).
Validated against swe_pheno (Swiss Ephemeris 2.10, Moshier mode).
"""
import math
from .core import (DEG, J2000, jd_tt, nutation, true_obliquity, equatorial,
                   sun_apparent)
from . import houses as H

KM_PER_AU = 149597870.7

# Equatorial diameters, km (IAU values, as used by Swiss Ephemeris).
DIAMETER_KM = {
    "sun": 1392000.0, "moon": 3475.0, "mercury": 4878.8, "venus": 12103.6,
    "mars": 6779.0, "jupiter": 139822.0, "saturn": 116464.0,
    "uranus": 50724.0, "neptune": 49244.0, "pluto": 2376.6,
}

PHENO_BODIES = list(DIAMETER_KM.keys())


def _magnitude(body, a, r, dlt, jde, lon_deg, lat_deg):
    """Apparent magnitude. a = phase angle (deg), r = heliocentric dist
    (AU; sun-earth dist for the Moon), dlt = geocentric dist (AU)."""
    x = 5 * math.log10(r * dlt)
    if body == "sun":
        return -26.86 + 5 * math.log10(dlt)
    if body == "moon":
        # Allen phase law; constant solved against swe_pheno (a < 130).
        return 0.233431 + x + 0.026 * abs(a) + 4e-9 * a**4
    if body == "mercury":
        return (x - 0.613 + 6.3280e-2 * a - 1.6336e-3 * a**2 + 3.3644e-5 * a**3
                - 3.4265e-7 * a**4 + 1.6893e-9 * a**5 - 3.0334e-12 * a**6)
    if body == "venus":
        if a <= 163.7:
            return x - 4.384 - 1.044e-3 * a + 3.687e-4 * a**2 - 2.814e-6 * a**3 + 8.938e-9 * a**4
        return x + 236.05828 - 2.81914 * a + 8.39034e-3 * a**2
    if body == "mars":
        return x - 1.601 + 2.267e-2 * a - 1.302e-4 * a**2
    if body == "jupiter":
        return x - 9.395 - 3.7e-4 * a + 6.16e-4 * a**2
    if body == "saturn":
        # ring inclination (Meeus ch. 45)
        T = (jde - J2000) / 36525.0
        i = (28.075216 - 0.012998 * T + 0.000004 * T * T) * DEG
        om = (169.508470 + 1.394681 * T + 0.000412 * T * T) * DEG
        lam, bet = lon_deg * DEG, lat_deg * DEG
        sin_b = math.sin(i) * math.cos(bet) * math.sin(lam - om) - math.cos(i) * math.sin(bet)
        b = abs(math.asin(max(-1.0, min(1.0, sin_b))))
        return (x - 8.914 - 1.825 * math.sin(b) + 0.026 * a
                - 0.378 * math.sin(b) * math.exp(-2.25 * a))
    if body == "uranus":
        # constant absorbs Mallama's sub-solar-latitude term
        return x - 7.160 + 6.587e-3 * a + 1.045e-4 * a**2
    if body == "neptune":
        y = 2000.0 + (jde - J2000) / 365.25
        if y < 1980.0:
            base = -6.89
        elif y < 2000.0:
            base = -6.89 - 0.11 * (y - 1980.0) / 20.0
        else:
            base = -7.00
        return x + base + 7.944e-3 * a + 9.617e-5 * a**2
    if body == "pluto":
        return x - 1.01
    return None


def pheno(engine, body, jd_ut):
    """Phase angle (deg), illuminated fraction, elongation (deg), apparent
    diameter (deg), apparent magnitude."""
    if body not in PHENO_BODIES:
        raise ValueError(f"pheno not available for {body!r}")
    jde = jd_tt(jd_ut)
    p = engine.position(body, jd_ut)
    s = p if body == "sun" else engine.position("sun", jd_ut)
    dlt = p["dist"]
    a1, d1 = p["lon"] * DEG, p["lat"] * DEG
    a2, d2 = s["lon"] * DEG, s["lat"] * DEG
    elong = math.acos(max(-1.0, min(1.0,
        math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(a1 - a2))))
    if body == "sun":
        phase_angle = 0.0
        r = dlt
    elif body == "moon":
        r = s["dist"]  # sun-earth distance stands in for sun-moon
        R = s["dist"]
        phase_angle = math.atan2(R * math.sin(elong), dlt - R * math.cos(elong))
    else:
        r = engine.heliocentric(body, jd_ut)["dist"]
        cosi = (r * r + dlt * dlt - s["dist"] ** 2) / (2 * r * dlt)
        phase_angle = math.acos(max(-1.0, min(1.0, cosi)))
    a_deg = phase_angle / DEG
    diam = 2 * math.asin(DIAMETER_KM[body] / (2 * dlt * KM_PER_AU)) / DEG
    return {
        "phase_angle": a_deg,
        "phase": (1 + math.cos(phase_angle)) / 2,
        "elongation": elong / DEG,
        "diameter": diam,
        "magnitude": _magnitude(body, a_deg, r, dlt, jde, p["lon"], p["lat"]),
    }


def equation_of_time(engine, jd_ut):
    """Apparent minus mean solar time, minutes (Meeus ch. 28)."""
    jde = jd_tt(jd_ut)
    t = (jde - J2000) / 365250.0
    l0 = (280.4664567 + 360007.6982779 * t + 0.03032028 * t * t
          + t**3 / 49931 - t**4 / 15300 - t**5 / 2000000) % 360
    lon, lat, _ = sun_apparent(engine.vsop, jde)
    ra, _ = equatorial(lon, lat, true_obliquity(jde))
    e = ((l0 - 0.0057183 - ra / DEG + 180) % 360) - 180
    return e * 4.0  # degrees -> minutes


def az_alt(lon_deg, lat_deg, jd_ut, obs_lat, obs_lon_east):
    """Apparent ecliptic position -> azimuth (deg, from true north, east-
    positive) and true altitude (deg). No refraction."""
    jde = jd_tt(jd_ut)
    eps = true_obliquity(jde)
    ra, dec = equatorial(lon_deg * DEG, lat_deg * DEG, eps)
    lst = (H.gast(jd_ut) + obs_lon_east * DEG) % (2 * math.pi)
    ha = lst - ra
    phi = obs_lat * DEG
    alt = math.asin(math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.cos(ha))
    az_s = math.atan2(math.sin(ha), math.cos(ha) * math.sin(phi) - math.tan(dec) * math.cos(phi))
    return (az_s / DEG + 180.0) % 360.0, alt / DEG


def refract_true_to_apparent(alt_deg, pressure=1013.25, temp_c=15.0):
    """Saemundsson refraction, degrees. Returns the input unchanged when
    even the refracted altitude stays below the horizon (matches Swiss
    Ephemeris)."""
    if alt_deg < -2.0:
        return alt_deg
    r = 1.02 / math.tan((alt_deg + 10.3 / (alt_deg + 5.11)) * DEG)
    r *= (pressure / 1010.0) * (283.0 / (273.0 + temp_c))
    out = alt_deg + r / 60.0
    return alt_deg if out < 0.0 else out


def refract_apparent_to_true(alt_deg, pressure=1013.25, temp_c=15.0):
    """Bennett refraction, degrees."""
    if alt_deg < -2.0:
        return alt_deg
    r = 1.0 / math.tan((alt_deg + 7.31 / (alt_deg + 4.4)) * DEG)
    r *= (pressure / 1010.0) * (283.0 / (273.0 + temp_c))
    return alt_deg - r / 60.0
