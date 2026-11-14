"""astroengine.heliacal -- first and last visibility: heliacal risings and
settings, the evening and morning apparitions of Mercury and Venus, the new
and old crescent of the Moon.

A star or planet near the Sun is lost in the glare for days or months. The
day it is first seen again before sunrise (its heliacal rising, "morning
first") and the day it is last seen after sunset (its heliacal setting,
"evening last") are what ancient records report, so they are computed here as
an observer would meet them: from how bright the sky is where the body
stands, how much the air dims it, and how faint a point the eye can pick out
against that sky.

Two methods.

"visibility" (the default) is a physical model. The sky's brightness at the
body is the sum of the night sky, twilight, and moonlight; the body's light
is dimmed by Rayleigh scattering, ozone, and aerosols along its own path; and
the eye's threshold against that background follows Hecht's fit to the Knoll,
Tousey and Hulburt data. The formulas are those Schaefer published for the
purpose (B. E. Schaefer, "To the Visual Limits", Sky & Telescope, May 1998,
p. 57; "Telescopic limiting magnitudes", PASP 102, 212, 1990; K. Krisciunas
& B. E. Schaefer, "A model of the brightness of moonlight", PASP 103, 1033,
1991), implemented from the published equations. The atmosphere is one
explicit number, the V-band extinction coefficient in magnitudes per air
mass; every result echoes the value used. Because nobody knows the haze on a
morning three thousand years ago, each event is computed three times, at the
stated coefficient and at that coefficient less and plus `spread`, and the
result carries the earliest and latest date as well as the nominal one.

"arcus" is the classical geometric rule: the event falls on the day the
Sun's depression below the horizon, at the moment the body stands on the
horizon with refraction disregarded, reaches a stated angle, the arcus
visionis (C. Schoch, MNRAS 84, 731, 1924). The angle must be given; the
engine has no table of them. This method also serves the two phenomena at
opposition, the acronychal rising (the last evening the body rises with the
Sun at least that far down) and the cosmical setting (the first morning it
sets so).

The Moon's first and last crescent use neither. They use Yallop's q test
(B. D. Yallop, "A method for predicting the first sighting of the new
crescent moon", NAO Technical Note 69, 1997), the Nautical Almanac Office's
fit to 295 recorded sightings.
"""
import math

from .core import DEG, equatorial, jd_tt, true_obliquity
from .events import rise_set
from .houses import gast
from .pheno import pheno, refract_true_to_apparent

TWO_PI = 2.0 * math.pi
EARTH_RADIUS_KM = 6378.14
KM_PER_AU = 149597870.7

KINDS = ["morning_first", "evening_last", "evening_first", "morning_last",
         "acronychal_rising", "cosmical_setting"]
ALIASES = {"heliacal_rising": "morning_first", "heliacal_setting": "evening_last"}
METHODS = ["visibility", "arcus"]
INNER = ("mercury", "venus")
PLANETS = ("mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto")

# The default atmosphere: a clear sea-level sky. Echoed in every result.
DEFAULT_EXTINCTION = 0.25
DEFAULT_SPREAD = 0.05

# Schaefer (1998), V band.
_MO = -11.05          # zero point
_MS = -26.74          # the Sun
_B0 = 1.0e-13         # night sky at the zenith, erg s^-1 cm^-2 um^-1 arcsec^-2
_NL = 1.11e-15        # that unit per nanolambert
K_RAYLEIGH = 0.1066   # at sea level; scale height 8200 m
K_OZONE = 0.031

SUN_DOWN_DEG = -0.8333  # the Sun's upper limb on the apparent horizon
_SID_RATE = 360.98564736629 * DEG  # rad per day
_STEP = 1.0 / 720.0     # two minutes
_GOLD = 0.6180339887498949

# Yallop's zones, by the lower bound of q.
YALLOP_ZONES = [("A", 0.216), ("B", -0.014), ("C", -0.160), ("D", -0.232),
                ("E", -0.293)]
Q_VISIBLE = -0.014   # zone B: visible under perfect conditions
Q_EASY = 0.216       # zone A: easily visible


# ---------------------------------------------------------------- the sky

def _x_gas(cz):
    return 1.0 / (cz + 0.0286 * math.exp(-10.5 * cz))


def _x_aerosol(cz):
    return 1.0 / (cz + 0.0123 * math.exp(-24.5 * cz))


def _x_ozone(sz):
    r = sz / (1.0 + 20.0 / 6378.0)
    return 1.0 / math.sqrt(1.0 - r * r)


def _x_sky(cz):
    return 1.0 / (cz + 0.025 * math.exp(-11.0 * cz))


def extinction_parts(extinction, alt_m=0.0):
    """Split a total V-band extinction coefficient into Rayleigh, ozone, and
    aerosol parts: (k_total, k_rayleigh, k_ozone, k_aerosol). Rayleigh falls
    off with the site's height, ozone is fixed, and the aerosol takes the
    rest. A total below the gas floor is raised to it."""
    kr = K_RAYLEIGH * math.exp(-alt_m / 8200.0)
    ka = extinction - kr - K_OZONE
    if ka < 0.0:
        ka = 0.0
    return (kr + K_OZONE + ka, kr, K_OZONE, ka)


def extinction_mag(alt_app_deg, parts):
    """Magnitudes lost by a point source at an apparent altitude, each
    component along its own air mass."""
    z = (90.0 - alt_app_deg) * DEG
    cz, sz = math.cos(z), math.sin(z)
    _, kr, ko, ka = parts
    return kr * _x_gas(cz) + ko * _x_ozone(sz) + ka * _x_aerosol(cz)


def sky_brightness(alt_app_deg, sun_alt_deg, sun_sep_deg, k,
                   moon_alt_deg=-90.0, moon_sep_deg=180.0, moon_phase_angle=180.0):
    """V-band sky brightness in nanolamberts at a point of apparent altitude
    `alt_app_deg`: night sky plus twilight (or daylight, whichever is
    fainter) plus moonlight when the Moon is up. Separations are the angles
    from the point to the Sun and to the Moon; `moon_phase_angle` is 0 at
    full Moon."""
    zd = 90.0 - alt_app_deg
    z = zd * DEG
    cz, sz = math.cos(z), math.sin(z)
    x = _x_sky(cz)
    scat = 1.0 - math.pow(10.0, -0.4 * k * x)
    bn = _B0 * (0.4 + 0.6 / math.sqrt(1.0 - 0.96 * sz * sz)) * math.pow(10.0, -0.4 * k * x)

    rs = max(sun_sep_deg, 1.0)
    bt = (math.pow(10.0, -0.4 * (_MS - _MO + 32.5 - sun_alt_deg - zd / (360.0 * k)))
          * (100.0 / rs) * scat)
    xs = _x_sky(math.cos((90.0 - sun_alt_deg) * DEG)) if sun_alt_deg > 0.0 else 40.0
    c4 = math.pow(10.0, -0.4 * k * xs)
    cr = math.cos(rs * DEG)
    fs = 6.2e7 / (rs * rs) + math.pow(10.0, 6.15 - rs / 40.0) + math.pow(10.0, 5.36) * (1.06 + cr * cr)
    bd = math.pow(10.0, -0.4 * (_MS - _MO + 43.27)) * scat * (fs * c4 + 440000.0 * (1.0 - c4))
    b = bn + (bd if bd < bt else bt)

    if moon_alt_deg > 0.0:
        am = abs(moon_phase_angle)
        mm = -12.73 + 0.026 * am + 4.0e-9 * am ** 4
        rm = max(moon_sep_deg, 1.0)
        xm = _x_sky(math.cos((90.0 - moon_alt_deg) * DEG))
        c3 = math.pow(10.0, -0.4 * k * xm)
        cm = math.cos(rm * DEG)
        fm = 6.2e7 / (rm * rm) + math.pow(10.0, 6.15 - rm / 40.0) + math.pow(10.0, 5.36) * (1.06 + cm * cm)
        b += math.pow(10.0, -0.4 * (mm - _MO + 43.27)) * scat * (fm * c3 + 440000.0 * (1.0 - c3))
    return b / _NL


def threshold_magnitude(brightness_nl):
    """The faintest point source the eye picks out against a background of
    `brightness_nl` nanolamberts, before extinction."""
    if brightness_nl < 1500.0:
        c1, c2 = math.pow(10.0, -9.8), math.pow(10.0, -1.9)
    else:
        c1, c2 = math.pow(10.0, -8.35), math.pow(10.0, -5.9)
    th = c1 * (1.0 + math.sqrt(c2 * brightness_nl)) ** 2
    return -16.57 - 2.5 * math.log10(th)


# ------------------------------------------------------------- geometry

def _clamp1(x):
    return -1.0 if x < -1.0 else (1.0 if x > 1.0 else x)


def _alt_az_ha(ra, dec, lst, phi):
    ha = (lst - ra + math.pi) % TWO_PI - math.pi
    alt = math.asin(_clamp1(math.sin(phi) * math.sin(dec)
                            + math.cos(phi) * math.cos(dec) * math.cos(ha)))
    az = math.atan2(math.sin(ha), math.cos(ha) * math.sin(phi) - math.tan(dec) * math.cos(phi))
    return alt, (az + math.pi) % TWO_PI, ha


def _sep(ra1, dec1, ra2, dec2):
    return math.acos(_clamp1(math.sin(dec1) * math.sin(dec2)
                             + math.cos(dec1) * math.cos(dec2) * math.cos(ra1 - ra2)))


def _is_star(engine, target):
    if target == "moon" or target in PLANETS:
        return False
    if target in engine.stars():
        return True
    raise ValueError(f"heliacal: {target!r} is not a planet, the Moon, or a catalog star")


def _ra_dec(engine, target, star, jd_ut):
    if star:
        fs = engine.fixed_star(target, jd_ut)
        return fs["ra"] * DEG, fs["dec"] * DEG
    p = engine.position(target, jd_ut)
    return equatorial(p["lon"] * DEG, p["lat"] * DEG, true_obliquity(jd_tt(jd_ut)))


def _lon(engine, target, star, jd_ut):
    if star:
        return engine.fixed_star(target, jd_ut)["lon"]
    return engine.longitude(target, jd_ut)


def _magnitude(engine, target, star, jd_ut):
    if star:
        return engine.fixed_star(target, jd_ut)["mag"]
    return pheno(engine, target, jd_ut)["magnitude"]


def local_day(jd_ut, lon_east):
    """The local mean civil day an instant falls in, as an integer; the day
    begins at the UT Julian Day `day - 0.5 - lon_east / 360`."""
    return math.floor(jd_ut + lon_east / 360.0 + 0.5)


def _day_start(day, lon_east):
    return day - 0.5 - lon_east / 360.0


# ----------------------------------------------------- one instant, exactly

def visibility(engine, target, jd_ut, lat, lon, extinction=DEFAULT_EXTINCTION,
               alt_m=0.0):
    """Whether a planet or catalog star can be seen with the naked eye at one
    instant from one place. Returns its apparent altitude and azimuth, the
    Sun's and Moon's altitudes, the sky brightness at the body
    (nanolamberts), the limiting magnitude there after extinction, the
    body's own magnitude, and `margin`, the limiting magnitude less the
    body's: positive means visible. A body below the horizon has no limiting
    magnitude and is not visible."""
    star = _is_star(engine, target)
    if target == "moon":
        raise ValueError("visibility: the Moon is an extended source; use crescent()")
    parts = extinction_parts(extinction, alt_m)
    phi = lat * DEG
    lst = (gast(jd_ut) + lon * DEG) % TWO_PI
    ra, dec = _ra_dec(engine, target, star, jd_ut)
    sra, sdec = _ra_dec(engine, "sun", False, jd_ut)
    mra, mdec = _ra_dec(engine, "moon", False, jd_ut)
    alt, az, _ = _alt_az_ha(ra, dec, lst, phi)
    salt, _, _ = _alt_az_ha(sra, sdec, lst, phi)
    malt, _, _ = _alt_az_ha(mra, mdec, lst, phi)
    mag = _magnitude(engine, target, star, jd_ut)
    out = {
        "target": target, "jd": jd_ut,
        "altitude": refract_true_to_apparent(alt / DEG), "azimuth": az / DEG,
        "sun_altitude": salt / DEG, "moon_altitude": malt / DEG,
        "magnitude": mag, "extinction": parts[0],
        "sky_brightness": None, "limiting_magnitude": None, "margin": None,
        "visible": False,
    }
    if out["altitude"] <= 0.0:
        return out
    b = sky_brightness(
        out["altitude"], salt / DEG, _sep(ra, dec, sra, sdec) / DEG, parts[0],
        malt / DEG, _sep(ra, dec, mra, mdec) / DEG,
        pheno(engine, "moon", jd_ut)["phase_angle"])
    lim = threshold_magnitude(b) - extinction_mag(out["altitude"], parts)
    out["sky_brightness"] = b
    out["limiting_magnitude"] = lim
    out["margin"] = lim - mag
    out["visible"] = lim > mag
    return out


# ------------------------------------------------- a half night, sampled

class _Night:
    """One half of a local night for one target: the morning half runs from
    local mean midnight to noon, the evening half from noon to midnight. The
    Sun, the target, and the Moon are placed at both ends and carried
    between them linearly; sidereal time advances at its mean rate."""

    def __init__(self, engine, target, star, day, half, lat, lon):
        self.half = half
        self.t0 = _day_start(day, lon) + (0.0 if half == "morning" else 0.5)
        self.t1 = self.t0 + 0.5
        self.phi = lat * DEG
        self.lst0 = (gast(self.t0) + lon * DEG) % TWO_PI
        self.track = []
        for name, is_star in ((target, star), ("sun", False), ("moon", False)):
            ra0, dec0 = _ra_dec(engine, name, is_star, self.t0)
            ra1, dec1 = _ra_dec(engine, name, is_star, self.t1)
            dra = (ra1 - ra0 + math.pi) % TWO_PI - math.pi
            self.track.append((ra0, dec0, dra, dec1 - dec0))
        tm = self.t0 + 0.25
        self.mag = _magnitude(engine, target, star, tm)
        self.moon_phase = pheno(engine, "moon", tm)["phase_angle"]

    def _place(self, i, t):
        ra0, dec0, dra, ddec = self.track[i]
        u = (t - self.t0) / 0.5
        return ra0 + dra * u, dec0 + ddec * u

    def state(self, t):
        """(altitude, azimuth, hour angle, Sun altitude) in radians, true."""
        lst = self.lst0 + _SID_RATE * (t - self.t0)
        ra, dec = self._place(0, t)
        sra, sdec = self._place(1, t)
        alt, az, ha = _alt_az_ha(ra, dec, lst, self.phi)
        salt, _, _ = _alt_az_ha(sra, sdec, lst, self.phi)
        return alt, az, ha, salt

    def margin(self, t, parts):
        """Limiting magnitude less the target's at instant t, or None when
        the Sun is up, the target is down, or the target is on the wrong
        side of the meridian for this half of the night."""
        lst = self.lst0 + _SID_RATE * (t - self.t0)
        sra, sdec = self._place(1, t)
        salt, _, _ = _alt_az_ha(sra, sdec, lst, self.phi)
        if salt / DEG >= SUN_DOWN_DEG:
            return None
        ra, dec = self._place(0, t)
        alt, _, ha = _alt_az_ha(ra, dec, lst, self.phi)
        if (ha > 0.0) if self.half == "morning" else (ha < 0.0):
            return None
        app = refract_true_to_apparent(alt / DEG)
        if app <= 0.0:
            return None
        mra, mdec = self._place(2, t)
        malt, _, _ = _alt_az_ha(mra, mdec, lst, self.phi)
        b = sky_brightness(app, salt / DEG, _sep(ra, dec, sra, sdec) / DEG, parts[0],
                           malt / DEG, _sep(ra, dec, mra, mdec) / DEG, self.moon_phase)
        return threshold_magnitude(b) - extinction_mag(app, parts) - self.mag

    def best(self, parts):
        """(margin, instant) at the moment of best visibility, or None when
        the target is never in view in this half of the night."""
        best_m, best_t = None, None
        for i in range(361):
            t = self.t0 + i * _STEP
            m = self.margin(t, parts)
            if m is not None and (best_m is None or m > best_m):
                best_m, best_t = m, t
        if best_m is None:
            return None
        # golden-section refinement between the neighbouring samples
        a, b = best_t - _STEP, best_t + _STEP

        def f(t):
            m = self.margin(t, parts)
            return -1.0e9 if m is None else m

        c = b - _GOLD * (b - a)
        d = a + _GOLD * (b - a)
        fc, fd = f(c), f(d)
        for _ in range(24):
            if fc > fd:
                b, d, fd = d, c, fc
                c = b - _GOLD * (b - a)
                fc = f(c)
            else:
                a, c, fc = c, d, fd
                d = a + _GOLD * (b - a)
                fd = f(d)
        t = (a + b) / 2.0
        m = f(t)
        if m > best_m:
            best_m, best_t = m, t
        return best_m, best_t

    def horizon(self, rising):
        """(instant, Sun depression in degrees) when the target crosses the
        geometric horizon in this half of the night, rising or setting, or
        None when it does not."""
        prev = self.state(self.t0)[0]
        for i in range(1, 361):
            t = self.t0 + i * _STEP
            cur = self.state(t)[0]
            if (prev < 0.0 <= cur) if rising else (prev > 0.0 >= cur):
                a, b = t - _STEP, t
                for _ in range(40):
                    mid = (a + b) / 2.0
                    if (self.state(mid)[0] < 0.0) == rising:
                        a = mid
                    else:
                        b = mid
                tc = (a + b) / 2.0
                return tc, -self.state(tc)[3] / DEG
            prev = cur
        return None


# ------------------------------------------------- conjunctions, the anchors

def _phase_events(engine, target, star, offset, jd_from, jd_to):
    """Instants in [jd_from, jd_to] when the target's longitude less the
    Sun's equals `offset` degrees (0 conjunction, 180 opposition)."""
    step = 0.5 if target == "moon" else 2.0

    def f(t):
        return (_lon(engine, target, star, t) - engine.longitude("sun", t) - offset + 180.0) % 360.0 - 180.0

    out = []
    prev = f(jd_from)
    t = jd_from + step
    while t <= jd_to + step:
        cur = f(t)
        if prev * cur < 0.0 and abs(cur - prev) < 180.0:
            a, b, fa = t - step, t, prev
            for _ in range(40):
                mid = (a + b) / 2.0
                fm = f(mid)
                if fa * fm <= 0.0:
                    b = mid
                else:
                    a, fa = mid, fm
            out.append((a + b) / 2.0)
        prev = cur
        t += step
    return out


def _anchors(engine, target, star, kind, jd_from, jd_to):
    if kind in ("acronychal_rising", "cosmical_setting"):
        return _phase_events(engine, target, star, 180.0, jd_from, jd_to)
    conj = _phase_events(engine, target, star, 0.0, jd_from, jd_to)
    if target not in INNER:
        return conj
    want_inferior = kind in ("morning_first", "evening_last")
    out = []
    for t in conj:
        inferior = engine.position(target, t)["dist"] < engine.position("sun", t)["dist"]
        if inferior == want_inferior:
            out.append(t)
    return out


def _walk_limit(target):
    if target == "mercury":
        return 70
    if target == "venus":
        return 150
    if target == "moon":
        return 6
    return 200


def _walk(holds, day0, first, limit):
    """The day a run of days on which `holds` is true begins (first=True) or
    ends (first=False), searched from day0: forward for a beginning and
    backward for an end when day0 is outside the run, the other way when it
    is inside. None when no edge lies within `limit` days."""
    fwd = 1 if first else -1
    if not holds(day0):
        for i in range(1, limit + 1):
            if holds(day0 + fwd * i):
                return day0 + fwd * i
        return None
    for i in range(1, limit + 1):
        if not holds(day0 - fwd * i):
            return day0 - fwd * (i - 1)
    return None


# ------------------------------------------------------------- the Moon

def crescent(engine, day, lat, lon, half="evening", alt_m=0.0):
    """Yallop's q test for the lunar crescent on one local day (an integer
    from `local_day`): the evening crescent after sunset, or with
    half="morning" the old crescent before sunrise. Returns q, its zone
    (A easily visible, B visible under perfect conditions, C may need
    optical aid to find, D optical aid only, E not visible with a telescope,
    F below the Danjon limit), the best time, the lag in minutes, and the
    geometry at the best time. None when the Sun or Moon does not rise or
    set that day, or the Moon is on the wrong side of the Sun."""
    noon = _day_start(day, lon) + 0.5
    if half == "evening":
        sun_t = rise_set(engine, "sun", noon, lat, lon, kind="set", alt_m=alt_m, search_days=0.75)
        if sun_t is None:
            return None
        moon_t = rise_set(engine, "moon", sun_t - 0.25, lat, lon, kind="set", alt_m=alt_m, search_days=1.0)
        if moon_t is None:
            return None
        lag = moon_t - sun_t
        best = sun_t + lag * 4.0 / 9.0
    else:
        sun_t = rise_set(engine, "sun", noon - 0.75, lat, lon, kind="rise", alt_m=alt_m, search_days=0.75)
        if sun_t is None:
            return None
        moon_t = rise_set(engine, "moon", sun_t - 0.75, lat, lon, kind="rise", alt_m=alt_m, search_days=1.0)
        if moon_t is None:
            return None
        lag = sun_t - moon_t
        best = sun_t - lag * 4.0 / 9.0
    if lag <= 0.0:
        return None
    phi = lat * DEG
    lst = (gast(best) + lon * DEG) % TWO_PI
    eps = true_obliquity(jd_tt(best))
    m = engine.position("moon", best)
    s = engine.position("sun", best)
    mra, mdec = equatorial(m["lon"] * DEG, m["lat"] * DEG, eps)
    sra, sdec = equatorial(s["lon"] * DEG, s["lat"] * DEG, eps)
    malt, maz, _ = _alt_az_ha(mra, mdec, lst, phi)
    salt, saz, _ = _alt_az_ha(sra, sdec, lst, phi)
    arcv = (malt - salt) / DEG
    arcl = _sep(mra, mdec, sra, sdec)
    daz = ((saz - maz) / DEG + 180.0) % 360.0 - 180.0
    sin_pi = EARTH_RADIUS_KM / (m["dist"] * KM_PER_AU)
    par = math.asin(sin_pi) / DEG * 60.0          # horizontal parallax, arcmin
    sd = 0.27245 * par * (1.0 + math.sin(malt) * sin_pi)
    w = sd * (1.0 - math.cos(arcl))
    q = (arcv - (11.8371 - 6.3226 * w + 0.7319 * w * w - 0.1018 * w ** 3)) / 10.0
    zone = "F"
    for name, floor in YALLOP_ZONES:
        if q > floor:
            zone = name
            break
    return {
        "q": q, "zone": zone, "jd": best, "lag_minutes": lag * 1440.0,
        "arcv": arcv, "arcl": arcl / DEG, "daz": daz, "width": w,
        "sun": sun_t, "moon": moon_t,
    }


def _moon_event(engine, kind, jd_start, lat, lon, alt_m):
    first = kind == "evening_first"
    half = "evening" if first else "morning"
    cache = {}

    def look(day):
        if day not in cache:
            cache[day] = crescent(engine, day, lat, lon, half, alt_m)
        return cache[day]

    def over(q_min):
        return lambda day: (look(day) is not None) and look(day)["q"] > q_min

    for conj in _phase_events(engine, "moon", False, 0.0, jd_start - 8.0, jd_start + 45.0):
        day0 = local_day(conj, lon)
        day = _walk(over(Q_VISIBLE), day0, first, 6)
        if day is None:
            continue
        c = look(day)
        if c["jd"] < jd_start:
            continue
        easy = _walk(over(Q_EASY), day0, first, 6)
        easy_jd = look(easy)["jd"] if easy is not None else None
        return {
            "target": "moon", "kind": kind, "method": "crescent",
            "jd": c["jd"], "conjunction": conj,
            "earliest": c["jd"] if first else easy_jd,
            "latest": easy_jd if first else c["jd"],
            "q": c["q"], "zone": c["zone"], "lag_minutes": c["lag_minutes"],
            "arcv": c["arcv"], "arcl": c["arcl"], "daz": c["daz"], "width": c["width"],
        }
    return None


# ------------------------------------------------------------- the events

def _half_of(kind):
    return "morning" if kind in ("morning_first", "morning_last", "cosmical_setting") else "evening"


def _is_first(kind):
    return kind in ("morning_first", "evening_first", "cosmical_setting")


def _check(engine, target, kind, method):
    kind = ALIASES.get(kind, kind)
    if kind not in KINDS:
        raise ValueError(f"heliacal: unknown kind {kind!r}")
    if method not in METHODS:
        raise ValueError(f"heliacal: unknown method {method!r}")
    star = _is_star(engine, target)
    if target == "moon":
        if kind not in ("evening_first", "morning_last"):
            raise ValueError("heliacal: the Moon has evening_first and morning_last only")
        if method != "visibility":
            raise ValueError("heliacal: the Moon's crescent has no arcus visionis method")
    elif target in INNER:
        if kind in ("acronychal_rising", "cosmical_setting"):
            raise ValueError(f"heliacal: {target} is never at opposition")
    else:
        if kind in ("evening_first", "morning_last"):
            raise ValueError(f"heliacal: {kind} applies to Mercury, Venus, and the Moon")
        if kind in ("acronychal_rising", "cosmical_setting") and method != "arcus":
            raise ValueError(f"heliacal: {kind} is offered by the arcus method only")
    return kind, star


def heliacal(engine, target, jd_start, lat, lon, kind="morning_first",
             method="visibility", extinction=DEFAULT_EXTINCTION,
             spread=DEFAULT_SPREAD, arcus_visionis=None, alt_m=0.0):
    """The next first or last visibility of a planet, a catalog star, or the
    Moon at or after jd_start (UT) from a place (lat, east lon in degrees).

    kind: morning_first (the heliacal rising), evening_last (the heliacal
    setting), evening_first and morning_last (Mercury, Venus, the Moon),
    acronychal_rising and cosmical_setting (arcus method only).

    Returns None when no event is found within the search span (about 830
    days; 45 for the Moon). Otherwise a dict: `jd` is the instant of best
    visibility on the day of the event (for the arcus method, the instant
    the body is on the horizon), `conjunction` the conjunction or
    opposition the event belongs to. The visibility method adds the body's
    altitude, azimuth, magnitude, and margin at that instant, the Sun's
    altitude, the implied arcus visionis, the extinction used, and
    `earliest` and `latest`, the same event under a sky clearer and hazier
    by `spread` (either may be None when that sky gives no event)."""
    kind, star = _check(engine, target, kind, method)
    if target == "moon":
        return _moon_event(engine, kind, jd_start, lat, lon, alt_m)
    if method == "arcus" and arcus_visionis is None:
        raise ValueError("heliacal: the arcus method needs arcus_visionis, in degrees")
    half = _half_of(kind)
    first = _is_first(kind)
    limit = _walk_limit(target)
    nights = {}

    def night(day):
        if day not in nights:
            nights[day] = _Night(engine, target, star, day, half, lat, lon)
        return nights[day]

    def seen_under(parts):
        memo = {}

        def best(day):
            if day not in memo:
                memo[day] = night(day).best(parts)
            return memo[day]

        return best

    rising = kind in ("morning_first", "morning_last", "acronychal_rising")

    crossings = {}

    def crossing(day):
        if day not in crossings:
            crossings[day] = night(day).horizon(rising)
        return crossings[day]

    for anchor in _anchors(engine, target, star, kind, jd_start - limit - 5.0, jd_start + 830.0):
        day0 = local_day(anchor, lon)
        if method == "arcus":
            def holds(day):
                c = crossing(day)
                return c is not None and c[1] >= arcus_visionis
            day = _walk(holds, day0, first, limit)
            if day is None:
                continue
            tc, dep = crossing(day)
            if tc < jd_start:
                continue
            return {
                "target": target, "kind": kind, "method": "arcus", "jd": tc,
                "conjunction": anchor, "arcus_visionis": arcus_visionis,
                "sun_depression": dep,
            }

        runs = []
        for k in (extinction, extinction - spread, extinction + spread):
            parts = extinction_parts(k, alt_m)
            best = seen_under(parts)

            def holds(day, best=best):
                # the body must rise (or set) in this half of the night, which
                # a circumpolar star never does, and be seen while it is up
                if crossing(day) is None:
                    return False
                b = best(day)
                return b is not None and b[0] > 0.0
            day = _walk(holds, day0, first, limit)
            runs.append((parts, day, best(day) if day is not None else None))
        parts, day, hit = runs[0]
        if day is None:
            continue
        margin, t = hit
        if t < jd_start:
            continue
        clear, hazy = runs[1][2], runs[2][2]
        clear_t = clear[1] if clear is not None else None
        hazy_t = hazy[1] if hazy is not None else None
        n = night(day)
        alt, az, _, salt = n.state(t)
        cross = crossing(day)
        return {
            "target": target, "kind": kind, "method": "visibility", "jd": t,
            "conjunction": anchor,
            "earliest": clear_t if first else hazy_t,
            "latest": hazy_t if first else clear_t,
            "margin": margin, "magnitude": n.mag,
            "altitude": refract_true_to_apparent(alt / DEG), "azimuth": az / DEG,
            "sun_altitude": salt / DEG,
            "arcus_visionis": cross[1],
            "extinction": parts[0], "spread": spread,
        }
    return None
