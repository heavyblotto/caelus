"""astroengine.skyview -- Python reference for SkyView's numeric spine.

Mirrors the math of packages/caelus/src/skyview.ts exactly (IEEE doubles,
same operation order, same rounding): lens resolution, the camera basis and
projection (rectilinear and fisheye) with optional refraction, twilight
stages and the naked-eye limiting magnitude, airmass/extinction, Moon phase
naming and bright-limb orientation, and the per-body projection/photometry
loop (`sky_bodies`, the numeric core of the TS `skyView` body loop).

Prose, directives, star fields, overlays, and render-plan assembly stay
TS-side; the skyview-golden suite (export_skyview_golden.py ->
packages/caelus/test/skyview-golden.test.ts) pins the two implementations
against each other.

TS `Math.round` rounds half toward +Infinity; Python's built-in `round`
does not, so all rounding goes through `_js_round`. Behind a rectilinear
camera the TS placer yields x/y = NaN; here that is represented as None
(the exporter emits null).
"""
import math

from .core import DEG
from .pheno import DIAMETER_KM, az_alt, pheno, refract_true_to_apparent

__all__ = [
    "dir_from_az_alt", "compass_of", "parse_azimuth", "resolve_lens",
    "place", "twilight_stage", "limiting_mag", "moon_phase_name",
    "clock_of", "airmass", "extinction_mag", "sky_brightness",
    "horizon_alt_at", "sky_bodies",
    "LENS_PRESETS", "COMPASS16", "BORTLE_LIMIT", "STAGE_CEILING",
    "BORTLE_ZENITH_MAG",
]


def _js_round(x):
    """JS Math.round: half rounds toward +Infinity (Python round() does not)."""
    r = math.floor(x + 0.5)
    if r - x > 0.5:  # x + 0.5 rounded up across the half in IEEE
        r -= 1
    return int(r)


# ------------------------------------------------------------------ vectors

def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def _norm(a):
    return math.sqrt(_dot(a, a))


def _unit(a):
    n = _norm(a)
    return (a[0] / n, a[1] / n, a[2] / n)


def _clamp1(x):
    return max(-1.0, min(1.0, x))


def dir_from_az_alt(az_deg, alt_deg):
    """Direction (local horizontal frame: x east, y north, z up) for an
    azimuth (deg from true north, east positive) and altitude (deg)."""
    a = az_deg * DEG
    h = alt_deg * DEG
    return (math.cos(h) * math.sin(a), math.cos(h) * math.cos(a), math.sin(h))


COMPASS16 = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]


def compass_of(az_deg):
    return COMPASS16[_js_round((az_deg % 360.0) / 22.5) % 16]


def parse_azimuth(az):
    """Accept an azimuth as degrees or a compass point ("W", "WNW")."""
    if isinstance(az, (int, float)) and not isinstance(az, bool):
        return az % 360.0
    key = az.strip().upper()
    if key in COMPASS16:
        return COMPASS16.index(key) * 22.5
    try:
        n = float(key)
    except ValueError:
        raise ValueError(
            f"unknown azimuth '{az}' (degrees or a 16-point compass name)")
    if math.isfinite(n):
        return n % 360.0
    raise ValueError(
        f"unknown azimuth '{az}' (degrees or a 16-point compass name)")


# -------------------------------------------------------------------- lenses

# Focal length is 35 mm-equivalent (full-frame, 36 mm wide); the preset
# carries the projection, as real optics do. Mirrors LENS_PRESETS.
LENS_PRESETS = {
    "ultrawide": {"focalLengthMm": 14.0, "projection": "fisheye"},
    "wide": {"focalLengthMm": 24.0, "projection": "rectilinear"},
    "standard": {"focalLengthMm": 35.0, "projection": "rectilinear"},
    "normal": {"focalLengthMm": 50.0, "projection": "rectilinear"},
    "portrait": {"focalLengthMm": 85.0, "projection": "rectilinear"},
    "telephoto": {"focalLengthMm": 135.0, "projection": "rectilinear"},
    "supertele": {"focalLengthMm": 200.0, "projection": "rectilinear"},
}

SENSOR_MM = 36.0


def _hfov_from_focal(focal, sensor):
    return (2 * math.atan(sensor / (2 * focal))) / DEG


def _focal_from_hfov(hfov_deg, sensor):
    return sensor / (2 * math.tan((hfov_deg * DEG) / 2))


def resolve_lens(spec, width, height):
    """Mirror of resolveLens: a preset name, {"hfovDeg", "projection"?}, or
    {"focalLengthMm", "sensorWidthMm"?, "projection"?} (TS-shaped keys) to
    the resolved lens dict (snake_case keys, TS rounding)."""
    name = "custom"
    projection = "rectilinear"
    sensor = SENSOR_MM

    if isinstance(spec, str):
        p = LENS_PRESETS.get(spec)
        if p is None:
            raise ValueError(
                f"unknown lens '{spec}' (presets: {', '.join(LENS_PRESETS)})")
        name = spec
        focal = p["focalLengthMm"]
        projection = p["projection"]
        hfov_deg = _hfov_from_focal(focal, sensor)
    elif "hfovDeg" in spec:
        hfov_deg = spec["hfovDeg"]
        projection = spec.get("projection") or "rectilinear"
        focal = _focal_from_hfov(hfov_deg, sensor)
    else:
        sensor = spec.get("sensorWidthMm")
        if sensor is None:
            sensor = SENSOR_MM
        focal = spec["focalLengthMm"]
        projection = spec.get("projection") or "rectilinear"
        hfov_deg = _hfov_from_focal(focal, sensor)

    hfov_r = hfov_deg * DEG
    if projection == "fisheye":
        vfov_deg = hfov_deg * (height / width)
    else:
        vfov_deg = (2 * math.atan(math.tan(hfov_r / 2) * (height / width))) / DEG
    return {
        "name": name,
        "focal_length_mm": _js_round(focal * 10) / 10,
        "sensor_width_mm": sensor,
        "projection": projection,
        "hfov_deg": _js_round(hfov_deg * 100) / 100,
        "vfov_deg": _js_round(vfov_deg * 100) / 100,
    }


# ---------------------------------------------------------------- projection

def _camera_basis(aim_az_deg, aim_alt_deg):
    """Camera basis from the aim. `right` is horizontal (no roll); near the
    zenith the up reference falls back to north. Mirrors skyPlacer."""
    F = dir_from_az_alt(aim_az_deg, aim_alt_deg)
    right_raw = _cross(F, (0.0, 0.0, 1.0))
    if _norm(right_raw) < 1e-6:
        right_raw = _cross(F, (0.0, 1.0, 0.0))
    right = _unit(right_raw)
    up = _cross(right, F)  # unit: right and F are orthonormal
    return F, right, up


def place(aim_az_deg, aim_alt_deg, lens, width, height, az_deg, alt_true_deg,
          refraction=True, pressure=1013.25, temp_c=15.0):
    """Mirror of the placer returned by skyPlacer: map an (azimuth,
    true-altitude) direction to the image plane under the lens's projection.
    Behind a rectilinear camera TS yields x/y = NaN; here x/y are None."""
    F, right, up = _camera_basis(aim_az_deg, aim_alt_deg)
    hfov_r = lens["hfov_deg"] * DEG
    vfov_r = lens["vfov_deg"] * DEG
    tan_h = math.tan(hfov_r / 2)
    tan_v = math.tan(vfov_r / 2)

    if refraction:
        alt_app = refract_true_to_apparent(alt_true_deg, pressure, temp_c)
    else:
        alt_app = alt_true_deg
    V = dir_from_az_alt(az_deg, alt_app)
    f = _dot(V, F)
    rr = _dot(V, right)
    uu = _dot(V, up)
    if lens["projection"] == "rectilinear":
        if f > 1e-9:
            xn = (rr / f) / tan_h
            yn = (uu / f) / tan_v
            in_frame = abs(xn) <= 1 and abs(yn) <= 1
        else:
            xn = math.inf if rr >= 0 else -math.inf
            yn = math.inf if uu >= 0 else -math.inf
            in_frame = False
    else:
        theta = math.acos(_clamp1(f))
        psi = math.atan2(uu, rr)
        xn = (theta * math.cos(psi)) / (hfov_r / 2)
        yn = (theta * math.sin(psi)) / (vfov_r / 2)
        in_frame = abs(xn) <= 1 and abs(yn) <= 1
    delta_deg = math.acos(_clamp1(f)) / DEG
    side = "behind"
    if f > 0:
        if abs(xn) >= abs(yn):
            side = "right" if xn > 0 else "left"
        else:
            side = "above" if yn > 0 else "below"
    x = _js_round(((xn + 1) / 2) * width) if math.isfinite(xn) else None
    y = _js_round(((1 - yn) / 2) * height) if math.isfinite(yn) else None
    return {"alt_app": alt_app, "x": x, "y": y, "in_frame": in_frame,
            "delta_deg": delta_deg, "side": side}


def sky_camera(aim_az_deg, aim_alt_deg):
    """Mirror of skyCamera: the orthonormal camera basis as a dict of
    forward/right/up lists (local horizontal frame: x east, y north, z up)."""
    F, right, up = _camera_basis(aim_az_deg, aim_alt_deg)
    return {"forward": list(F), "right": list(right), "up": list(up)}


def radial_scale(shape):
    """Mirror of radialScale: the one-parameter azimuthal family r(theta).
    shape -1 gnomonic, -0.5 stereographic, 0 equidistant, +0.5 equal-area,
    +1 orthographic. Negative side diverges at theta = k pi/2 (returns
    math.inf); positive side folds past it."""
    if not (-1 <= shape <= 1):
        raise ValueError(f"radial_scale shape {shape} out of range [-1, 1]")
    if shape == 0:
        return lambda t: t
    if shape < 0:
        k = -1.0 / shape
        limit = k * math.pi / 2
        return lambda t: math.inf if t >= limit else k * math.tan(t / k)
    k = 1.0 / shape
    return lambda t: k * math.sin(t / k)


def sky_project(aim_az_deg, aim_alt_deg, az_deg, alt_deg,
                shape=0.0, hfov_deg=180.0):
    """Mirror of skyProjector().place: refraction-free vector-mode
    projection to normalized coordinates (magnitude 1 at hfov/2 from the
    aim, +x right, +y up, no aspect). Where TS yields signed Infinity
    (gnomonic-side horizon) xn/yn are None here."""
    radial = radial_scale(shape)
    F, right, up = _camera_basis(aim_az_deg, aim_alt_deg)
    r_edge = radial((hfov_deg * DEG) / 2)
    if not math.isfinite(r_edge) or r_edge <= 0:
        raise ValueError(
            f"sky_project: hfov_deg {hfov_deg} is outside the projectable "
            f"range for shape {shape}")
    V = dir_from_az_alt(az_deg, alt_deg)
    f = _dot(V, F)
    rr = _dot(V, right)
    uu = _dot(V, up)
    theta = math.acos(_clamp1(f))
    theta_deg = theta / DEG
    hemisphere = "near" if theta_deg <= 90 else "far"
    r = radial(theta)
    if not math.isfinite(r):
        return {"xn": None, "yn": None, "theta_deg": theta_deg,
                "hemisphere": hemisphere, "behind": True}
    psi = math.atan2(uu, rr)
    return {"xn": (r * math.cos(psi)) / r_edge,
            "yn": (r * math.sin(psi)) / r_edge,
            "theta_deg": theta_deg, "hemisphere": hemisphere,
            "behind": False}


# --------------------------------------------------------------- sky state

def twilight_stage(sun_alt_deg):
    if sun_alt_deg > 0:
        return "day"
    if sun_alt_deg > -6:
        return "civil"
    if sun_alt_deg > -12:
        return "nautical"
    if sun_alt_deg > -18:
        return "astronomical"
    return "night"


# Sky-brightness ceiling on the naked-eye limit by twilight stage. Night sets
# no ceiling of its own; there the site darkness (BORTLE_LIMIT) and the Moon
# decide the limit.
STAGE_CEILING = {
    "day": -4.0, "civil": 1.5, "nautical": 4.0, "astronomical": 5.5,
    "night": math.inf,
}

# Naked-eye limiting magnitude by Bortle dark-sky class (1 pristine, 9 inner
# city). Omitting the class keeps the legacy suburban default of 6.0.
BORTLE_LIMIT = {
    1: 7.6, 2: 7.4, 3: 7.0, 4: 6.5, 5: 6.0, 6: 5.5, 7: 5.0, 8: 4.5, 9: 4.0,
}


def limiting_mag(stage, moon_alt_deg, moon_illum, bortle):
    """Effective naked-eye limiting magnitude (mirror of limitingMag).
    bortle=None mirrors TS `undefined` (suburban default 6.0)."""
    if bortle is not None:
        bortle_limit = BORTLE_LIMIT.get(_js_round(bortle), 6.0)
    else:
        bortle_limit = 6.0
    lim = min(STAGE_CEILING[stage], bortle_limit)
    mi = moon_illum if moon_illum is not None else 0.0
    if lim > 0 and moon_alt_deg is not None and moon_alt_deg > 0 and mi > 0.3:
        lim -= 1.5 * mi
    return _js_round(lim * 10) / 10


def moon_phase_name(illum, waxing):
    if illum < 0.03:
        return "new moon"
    if illum > 0.97:
        return "full moon"
    if abs(illum - 0.5) < 0.06:
        return "first quarter" if waxing else "last quarter"
    if illum < 0.5:
        return "waxing crescent" if waxing else "waning crescent"
    return "waxing gibbous" if waxing else "waning gibbous"


def clock_of(angle_deg):
    """Image-plane angle (deg, 0 right, 90 up) to a clock position (12 up)."""
    h = _js_round((90 - angle_deg) / 30) % 12
    if h <= 0:
        h += 12
    return f"{h} o'clock"


def airmass(alt_app_deg):
    """Relative optical air mass at an apparent altitude (Kasten & Young
    1989); clamped at the horizon value below alt 0. Mirrors pheno.ts."""
    alt = max(0.0, alt_app_deg)
    z = 90 - alt
    return 1 / (math.cos(z * DEG) + 0.50572 * math.pow(6.07995 + alt, -1.6364))


def extinction_mag(alt_app_deg, k=0.2):
    """Atmospheric extinction in magnitudes: k mag per air mass."""
    return k * airmass(alt_app_deg)


# ------------------------------------------------------------ sky brightness

# Zenith V-band brightness of the moonless night sky by Bortle class,
# mag/arcsec^2 (Bortle 2001, Sky & Telescope; cf. Crumey 2014 MNRAS 442,
# 2600). Class 6 is the default when no class is given. Mirrors
# BORTLE_ZENITH_MAG in skyview.ts.
BORTLE_ZENITH_MAG = {
    1: 21.9, 2: 21.7, 3: 21.5, 4: 21.0, 5: 20.5, 6: 19.5, 7: 18.5, 8: 18.0,
    9: 17.5,
}

# The pristine night zenith the twilight ramp brightens relative to.
DARK_REF_MAG = 21.9

# Twilight zenith brightening vs Sun altitude (Patat, Ugolnikov &
# Postylyakov 2006, A&A 455, 385 for the shape), saturating at the clear
# daytime zenith of ~4 mag/arcsec^2. Mirrors TWILIGHT_RAMP in skyview.ts.
TWILIGHT_RAMP = [
    (-18.0, 0.0), (-12.0, 4.0), (-6.0, 9.0), (0.0, 14.0),
    (8.0, DARK_REF_MAG - 4.0),
]

# Airglow horizon brightening at a dark site, mag (Garstang 1989 PASP 101,
# 306; Roach & Gordon 1973).
AIRGLOW_HORIZON_MAG = 0.4


def _mag_to_flux(m):
    return math.pow(10, -0.4 * m)


def _flux_to_mag(f):
    return -2.5 * math.log10(f)


def _twilight_ramp_at(sun_alt_deg):
    pts = TWILIGHT_RAMP
    if sun_alt_deg <= pts[0][0]:
        return pts[0][1]
    last = pts[-1]
    if sun_alt_deg >= last[0]:
        return last[1]
    for i in range(1, len(pts)):
        if sun_alt_deg <= pts[i][0]:
            a0, m0 = pts[i - 1]
            a1, m1 = pts[i]
            return m0 + ((sun_alt_deg - a0) / (a1 - a0)) * (m1 - m0)
    return last[1]


def sky_brightness(alt_deg, az_deg, ctx):
    """Mirror of skyBrightness: approximate V-band sky surface brightness
    (mag/arcsec^2) at a direction -- a render cue, not precision photometry.
    Composes site sky (with airglow horizon brightening), twilight, and a
    Krisciunas & Schaefer-inspired moonlight term in linear flux space; see
    skyview.ts for the sourced constants. `ctx` carries the TS-shaped keys
    {"sunAltDeg", "sunAzDeg", "moonAltDeg", "moonAzDeg", "moonIllum",
    "bortle"?} (bortle absent or None means class 6)."""
    bortle = ctx.get("bortle")
    if bortle is not None:
        zenith_mag = BORTLE_ZENITH_MAG.get(_js_round(bortle),
                                           BORTLE_ZENITH_MAG[6])
    else:
        zenith_mag = BORTLE_ZENITH_MAG[6]
    # (a) site sky, brightened toward the horizon by airglow (the Kasten &
    # Young fit dips a hair under 1 at the zenith itself, hence the 0 floor)
    horiz_frac = min(1.0, max(0.0, (airmass(alt_deg) - 1) / (airmass(0) - 1)))
    flux = _mag_to_flux(zenith_mag - AIRGLOW_HORIZON_MAG * horiz_frac)
    # (b) twilight from the Sun's altitude
    ramp = _twilight_ramp_at(ctx["sunAltDeg"])
    if ramp > 0:
        flux += _mag_to_flux(DARK_REF_MAG - ramp)
    # (c) moonlight, falling off with angular distance from the Moon
    if ctx["moonAltDeg"] > 0 and ctx["moonIllum"] > 0:
        sep = math.acos(_clamp1(_dot(
            dir_from_az_alt(az_deg, alt_deg),
            dir_from_az_alt(ctx["moonAzDeg"], ctx["moonAltDeg"])))) / DEG
        s = max(sep, 10.0)  # inside ~10 deg is the Moon's own glare
        moon_mag = (17.5 + 0.04 * (s - 10) - 2.5 * math.log10(ctx["moonIllum"])
                    + 0.2 * (airmass(ctx["moonAltDeg"]) - 1))
        flux += _mag_to_flux(moon_mag)
    return _flux_to_mag(flux)


# ------------------------------------------------------- obstruction profile

def horizon_alt_at(profile, az_deg):
    """Mirror of horizonAltAt: skyline altitude at an azimuth from an
    obstruction profile (list of TS-shaped {"azDeg", "altDeg"} dicts),
    piecewise-linear on the circle. Unsorted input tolerated; wraps across
    360/0. An empty profile is the astronomical horizon (0 deg)."""
    if len(profile) == 0:
        return 0.0
    pts = sorted(((p["azDeg"] % 360.0, p["altDeg"]) for p in profile),
                 key=lambda p: p[0])
    if len(pts) == 1:
        return pts[0][1]
    az = az_deg % 360.0
    i = 0
    while i < len(pts) and pts[i][0] <= az:
        i += 1
    a = pts[(i - 1 + len(pts)) % len(pts)]
    b = pts[i % len(pts)]
    span = (b[0] - a[0]) % 360.0
    if span == 0:
        return a[1]  # coincident azimuths: take the first
    return a[1] + (((az - a[0]) % 360.0) / span) * (b[1] - a[1])


# ------------------------------------------------------------------- bodies

_DEFAULT_BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter",
                   "saturn"]


def sky_bodies(engine, jd_ut, view, bodies=None, refraction=True,
               pressure=1013.25, temp_c=15.0, bortle=None,
               horizon_profile=None):
    """The numeric core of the TS skyView body loop: project each body,
    apply the visibility rule, and emit the per-body numbers with the exact
    TS rounding, plus the sky-state summary and the near-off-frame list.

    `view` is {"observer": {"lat", "lon_east", "alt_m"?}, "aim": {"azimuth",
    "altitude"}, "lens": LensSpec, "image": {"width", "height"}}.

    `horizon_profile` mirrors opts.horizonProfile (a list of TS-shaped
    {"azDeg", "altDeg"} skyline samples): a body above the astronomical
    horizon but below the skyline at its azimuth moves to the result's
    "occluded" list (present only when a profile is given, so profile-less
    results keep their original shape).
    """
    obs = view["observer"]
    lat = obs["lat"]
    lon_east = obs["lon_east"]
    width = view["image"]["width"]
    height = view["image"]["height"]
    aim_az = parse_azimuth(view["aim"]["azimuth"])
    aim_alt = view["aim"]["altitude"]
    lens = resolve_lens(view["lens"], width, height)
    _, right, up = _camera_basis(aim_az, aim_alt)

    sun_pos = engine.position("sun", jd_ut)
    sun_az, sun_alt_true = az_alt(sun_pos["lon"], sun_pos["lat"], jd_ut,
                                  lat, lon_east)
    stage = twilight_stage(sun_alt_true)

    moon_pos = engine.position("moon", jd_ut)
    moon_az, moon_alt_true = az_alt(moon_pos["lon"], moon_pos["lat"], jd_ut,
                                    lat, lon_east)
    moon_illum = pheno(engine, "moon", jd_ut)["phase"]
    moon_waxing = (moon_pos["lon"] - sun_pos["lon"]) % 360.0 < 180
    moon_up = moon_alt_true > 0

    limit = limiting_mag(stage, moon_alt_true if moon_up else None,
                         moon_illum, bortle)

    body_ids = _DEFAULT_BODIES if bodies is None else bodies
    rows = []
    off_frame = []
    occluded = []
    for bid in body_ids:
        if bid == "sun":
            az, alt_true = sun_az, sun_alt_true
        elif bid == "moon":
            az, alt_true = moon_az, moon_alt_true
        else:
            pos = engine.position(bid, jd_ut)
            az, alt_true = az_alt(pos["lon"], pos["lat"], jd_ut, lat, lon_east)
        p = place(aim_az, aim_alt, lens, width, height, az, alt_true,
                  refraction, pressure, temp_c)

        # The Sun stays in view as it touches the horizon; every other body
        # must be above the horizon to appear.
        visible = p["alt_app"] > -1.0 if bid == "sun" else p["alt_app"] > 0
        if not visible:
            continue

        # The obstruction profile hides what clears the astronomical horizon
        # but not the skyline (the Sun's grace band is subject to it too).
        if horizon_profile is not None:
            skyline = horizon_alt_at(horizon_profile, az)
            if p["alt_app"] < skyline:
                occluded.append({
                    "id": bid,
                    "azimuth_deg": _js_round(az * 10) / 10,
                    "altitude_deg": _js_round(p["alt_app"] * 10) / 10,
                    "skyline_alt_deg": _js_round(skyline * 10) / 10,
                })
                continue

        magnitude = None
        extinction = None
        diam_deg = 0.0
        if bid in DIAMETER_KM:
            ph = pheno(engine, bid, jd_ut)
            magnitude = _js_round(ph["magnitude"] * 100) / 100
            extinction = _js_round(extinction_mag(p["alt_app"]) * 100) / 100
            diam_deg = ph["diameter"]
        size_px = max(1 if diam_deg > 0 else 0,
                      _js_round((diam_deg * width) / lens["hfov_deg"]))
        naked_eye = bid in ("sun", "moon") or (
            magnitude is not None and magnitude <= limit)

        if not p["in_frame"]:
            if naked_eye:
                off_frame.append({
                    "id": bid, "side": p["side"],
                    "delta_deg": _js_round(p["delta_deg"] * 10) / 10,
                    "azimuth_deg": _js_round(az * 10) / 10,
                    "altitude_deg": _js_round(p["alt_app"] * 10) / 10,
                    "magnitude": magnitude,
                })
            continue

        row = {
            "id": bid,
            "azimuth_deg": _js_round(az * 10) / 10,
            "altitude_deg": _js_round(p["alt_app"] * 10) / 10,
            "x": p["x"], "y": p["y"], "in_frame": True,
            "size_px": size_px,
            "angular_diameter_deg": _js_round(diam_deg * 1e4) / 1e4,
            "magnitude": magnitude,
            "extinction_mag": extinction,
            "naked_eye": naked_eye,
        }
        if bid == "moon":
            row["illum"] = _js_round(moon_illum * 1000) / 1000
            # Bright limb points along the great circle from Moon toward Sun.
            M = dir_from_az_alt(moon_az, moon_alt_true)
            S = dir_from_az_alt(sun_az, sun_alt_true)
            t = _unit((S[0] - _dot(S, M) * M[0],
                       S[1] - _dot(S, M) * M[1],
                       S[2] - _dot(S, M) * M[2]))
            angle = (math.atan2(_dot(t, up), _dot(t, right)) / DEG) % 360.0
            row["bright_limb_angle_deg"] = _js_round(angle * 10) / 10
        rows.append(row)

    # Keep "just out of frame" honest: only bodies in front and within one
    # field of the center, nearest first (stable sort, as in TS).
    off_max = max(lens["hfov_deg"], lens["vfov_deg"])
    off_near = sorted(
        (o for o in off_frame
         if o["side"] != "behind" and o["delta_deg"] <= off_max),
        key=lambda o: o["delta_deg"])

    out = {
        "summary": {
            "twilight": stage,
            "limiting_mag": limit,
            "sun_alt_true": _js_round(sun_alt_true * 10) / 10,
            "moon_alt_true": _js_round(moon_alt_true * 10) / 10,
            "moon_illum": _js_round(moon_illum * 1000) / 1000,
            "moon_waxing": moon_waxing,
        },
        "bodies": rows,
        "off_frame": off_near,
    }
    if horizon_profile is not None:
        out["occluded"] = occluded
    return out
