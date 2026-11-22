"""astroengine.observe -- physical spacetime observation, verification,
chronolocation, geolocation, and chronosense.

Forward model (`scene_geometry`): computes apparent solar and lunar horizontal
coordinates with barometric refraction, flat or sloped-ground 3D shadow
geometry and sweep rates, optional camera-relative lighting and glare risk,
lens-independent zenith-frame lunar bright-limb orientation, naked-eye planet
visibility, local diurnal cycle (sunrise/solar noon/sunset, next twilight
transition, planetary hour), and compact chronosense headers.

Inverse & verification solvers:
- `verify_observation`: checks any subset of physical observations against a
  claimed spacetime point with automatic time/place uncertainty widening,
  indeterminate handling for near-zenith shadows and full/new Moon bright limb,
  and counterfactual diagnostics (same-day clock/timezone shift, hemisphere
  sign flip, seasonal date shift).
- `chronolocate`: multi-day fast pruning (solar altitude bounds and lunar phase
  bounds), contiguous intra-day continuous signed-margin scan with narrow-peak
  rescue, <1 s edge bisection, and golden-section peak refinement.
- `geolocate`: Path A closed-form spherical celestial navigation fix with
  damped Gauss-Newton refinement and Jacobian covariance uncertainty; Path B
  precomputed pure-trig global spherical grid with antimeridian-wrapping
  connected-component clustering, local refinement, and region classification.

Zero external dependencies; mirrors packages/caelus/src/observe.ts.
"""
import math

from .core import (
    DEG,
    calendar_date,
    equatorial,
    jd_tt,
    true_obliquity,
)
from .electional import planetary_hour as _planetary_hour
from .events import rise_set
from .houses import angles as _house_angles
from .houses import gast
from .pheno import (
    DIAMETER_KM,
    az_alt,
    pheno,
    refract_apparent_to_true,
    refract_true_to_apparent,
)
from .skyview import (
    _js_round,
    airmass,
    clock_of,
    compass_of,
    dir_from_az_alt,
    extinction_mag,
    limiting_mag,
    moon_phase_name,
    twilight_stage,
)

__all__ = [
    "scene_geometry",
    "verify_observation",
    "chronolocate",
    "geolocate",
    "DEFAULT_TOLERANCES",
    "TWILIGHT_BANDS",
]

TWO_PI = 2.0 * math.pi
EARTH_RADIUS_KM = 6371.0
_INV_PHI = 0.6180339887498949
_DT_MIN = 1.0 / 1440.0  # 1 minute in days
_GRAZING_ALT_DEG = 0.05
_GRAZING_SIN = math.sin(_GRAZING_ALT_DEG * DEG)
_ZENITH_INDET_DEG = 88.0
_MOON_PHASE_INDET_LO = 0.03
_MOON_PHASE_INDET_HI = 0.97

VISIBLE_PLANETS = ("mercury", "venus", "mars", "jupiter", "saturn")
VALID_VISIBLE_BODIES = ("sun", "moon") + VISIBLE_PLANETS + ("uranus", "neptune")

DEFAULT_TOLERANCES = {
    "shadow_bearing_deg": 10.0,
    "shadow_length_ratio_rel": 0.15,
    "shadow_length_ratio_abs": 0.08,
    "sun_azimuth_deg": 8.0,
    "sun_altitude_deg": 5.0,
    "moon_azimuth_deg": 10.0,
    "moon_altitude_deg": 6.0,
    "moon_illum": 0.12,
    "moon_bright_limb_deg": 18.0,
    "shadow_sweep_deg": 5.0,
}

# Apparent solar altitude intervals [lo, hi] in degrees for each twilight key.
TWILIGHT_BANDS = {
    "day": (0.0, 90.0),
    "civil": (-6.0, 0.0),
    "nautical": (-12.0, -6.0),
    "astronomical": (-18.0, -12.0),
    "night": (-90.0, -18.0),
    "daylight": (-6.0, 90.0),
    "dark": (-90.0, -6.0),
}


# ------------------------------------------------------------------ math utils

def _clamp1(x):
    return -1.0 if x < -1.0 else (1.0 if x > 1.0 else x)


def _wrap180(x):
    """Signed angle in (-180, 180] degrees."""
    r = (x + 180.0) % 360.0 - 180.0
    return 180.0 if r == -180.0 else r


def _wrap_pi(x):
    """Signed angle in (-pi, pi] radians."""
    r = (x + math.pi) % TWO_PI - math.pi
    return math.pi if r == -math.pi else r


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _norm(a):
    return math.sqrt(_dot(a, a))


def _pressure_at_elevation(elevation_m):
    """Standard barometric pressure (hPa) at elevation_m; exact 1013.25 at 0."""
    if elevation_m == 0.0:
        return 1013.25
    h = max(-500.0, min(50000.0, float(elevation_m)))
    return 1013.25 * math.exp(-h / 8434.5)


def _fmt_fixed(x, decimals):
    """Deterministic fixed-decimal string matching JS Math.round parity."""
    scale = 10 ** decimals
    n = _js_round(x * scale)
    if n == 0:
        return "0" if decimals == 0 else "0." + ("0" * decimals)
    sign = "-" if n < 0 else ""
    a = abs(n)
    if decimals == 0:
        return f"{sign}{a}"
    whole, frac = divmod(a, scale)
    return f"{sign}{whole}.{frac:0{decimals}d}"


def _format_iso_minute(jd_ut):
    """Format UT Julian Day rounded to nearest minute as YYYY-MM-DDTHH:MMZ."""
    cal = calendar_date(jd_ut + 0.5 / 1440.0, "gregorian")
    total_min = int(math.floor(cal["hour"] * 60.0 + 1e-9))
    hh = min(23, total_min // 60)
    mm = total_min % 60
    yr = cal["year"]
    if yr < 0:
        yr_str = f"-{abs(yr):04d}"
    else:
        yr_str = f"{yr:04d}"
    return f"{yr_str}-{cal['month']:02d}-{cal['day']:02d}T{hh:02d}:{mm:02d}Z"


def _haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance on a sphere of radius EARTH_RADIUS_KM."""
    p1 = lat1 * DEG
    p2 = lat2 * DEG
    dp = (lat2 - lat1) * DEG
    dl = _wrap180(lon2 - lon1) * DEG
    s1 = math.sin(dp * 0.5)
    s2 = math.sin(dl * 0.5)
    a = s1 * s1 + math.cos(p1) * math.cos(p2) * s2 * s2
    return 2.0 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(max(0.0, a))))


def _validate_place(lat, lon_east, elevation_m=0.0, slope_deg=0.0,
                    slope_azimuth_deg=0.0):
    if not (math.isfinite(lat) and -90.0 <= lat <= 90.0):
        raise ValueError(f"lat must be finite in [-90, 90], got {lat!r}")
    if not math.isfinite(lon_east):
        raise ValueError(f"lon_east must be finite, got {lon_east!r}")
    if not math.isfinite(elevation_m):
        raise ValueError(f"elevation_m must be finite, got {elevation_m!r}")
    if not (math.isfinite(slope_deg) and 0.0 <= slope_deg < 90.0):
        raise ValueError(f"slope_deg must be in [0, 90), got {slope_deg!r}")
    if not math.isfinite(slope_azimuth_deg):
        raise ValueError(
            f"slope_azimuth_deg must be finite, got {slope_azimuth_deg!r}")


def _az_alt_from_eq(ra, dec, lst, lat_deg):
    """Equatorial (ra, dec rad) + local apparent sidereal time (rad) + lat (deg)
    -> (azimuth_deg in [0, 360), true_altitude_deg in [-90, 90])."""
    ha = lst - ra
    phi = lat_deg * DEG
    sin_phi = math.sin(phi)
    cos_phi = math.cos(phi)
    sin_dec = math.sin(dec)
    cos_dec = math.cos(dec)
    cos_ha = math.cos(ha)
    sin_alt = _clamp1(sin_phi * sin_dec + cos_phi * cos_dec * cos_ha)
    alt = math.asin(sin_alt)
    az_s = math.atan2(
        cos_dec * math.sin(ha),
        cos_dec * cos_ha * sin_phi - sin_dec * cos_phi,
    )
    return (az_s / DEG + 180.0) % 360.0, alt / DEG


def _eq_unit(ra, dec):
    cd = math.cos(dec)
    return (cd * math.cos(ra), cd * math.sin(ra), math.sin(dec))


def _ra_dec_from_unit(v):
    n = _norm(v)
    if n < 1e-15:
        return 0.0, 0.0
    x, y, z = v[0] / n, v[1] / n, v[2] / n
    return math.atan2(y, x) % TWO_PI, math.asin(_clamp1(z))


def _slope_normal(slope_deg, slope_azimuth_deg):
    """Upward unit normal of terrain tilted by slope_deg toward downhill
    azimuth slope_azimuth_deg (local horizontal frame: x east, y north, z up)."""
    if slope_deg == 0.0:
        return (0.0, 0.0, 1.0)
    sig = slope_deg * DEG
    alp = slope_azimuth_deg * DEG
    ss = math.sin(sig)
    return (ss * math.sin(alp), ss * math.cos(alp), math.cos(sig))


def _compute_shadow(az_deg, alt_app_deg, slope_deg, slope_azimuth_deg,
                    rate_az=None, rate_alt=None, penumbra_deg=None):
    """Exact 3D ray-plane shadow of a vertical unit pole P=(0,0,1) along -s
    onto flat or sloped ground with upward normal n."""
    slope_az_norm = slope_azimuth_deg % 360.0 if slope_deg > 0.0 else 0.0
    if alt_app_deg <= 0.0:
        return {
            "cast": False,
            "self_shadowed": False,
            "bearing_deg": None,
            "compass16": None,
            "length_ratio": None,
            "horizontal_length_ratio": None,
            "rate_bearing_deg_per_min": None,
            "rate_length_ratio_per_min": None,
            "penumbra_deg": None,
            "slope_deg": float(slope_deg),
            "slope_azimuth_deg": slope_az_norm,
        }

    s = dir_from_az_alt(az_deg, alt_app_deg)
    n = _slope_normal(slope_deg, slope_azimuth_deg)
    n_dot_s = _dot(n, s)

    if n_dot_s <= 0.0:
        return {
            "cast": False,
            "self_shadowed": True,
            "bearing_deg": None,
            "compass16": None,
            "length_ratio": None,
            "horizontal_length_ratio": None,
            "rate_bearing_deg_per_min": None,
            "rate_length_ratio_per_min": None,
            "penumbra_deg": None,
            "slope_deg": float(slope_deg),
            "slope_azimuth_deg": slope_az_norm,
        }

    bearing = (az_deg + 180.0) % 360.0
    comp = compass_of(bearing)

    # Check grazing angle to ground plane (matches alt_app < 0.05 deg on flat ground).
    if n_dot_s < _GRAZING_SIN or alt_app_deg < _GRAZING_ALT_DEG:
        return {
            "cast": True,
            "self_shadowed": False,
            "bearing_deg": bearing,
            "compass16": comp,
            "length_ratio": None,
            "horizontal_length_ratio": None,
            "rate_bearing_deg_per_min": rate_az,
            "rate_length_ratio_per_min": None,
            "penumbra_deg": penumbra_deg,
            "slope_deg": float(slope_deg),
            "slope_azimuth_deg": slope_az_norm,
        }

    t = n[2] / n_dot_s
    q = (-t * s[0], -t * s[1], 1.0 - t * s[2])
    length_ratio = _norm(q)
    horiz_ratio = math.hypot(q[0], q[1])

    # Analytical d(||Q||)/dt from (rate_az, rate_alt) in deg/min.
    rate_len = None
    if rate_az is not None and rate_alt is not None:
        if length_ratio < 1e-9:
            rate_len = 0.0
        else:
            a_r = az_deg * DEG
            h_r = alt_app_deg * DEG
            da = rate_az * DEG
            dh = rate_alt * DEG
            ca, sa = math.cos(a_r), math.sin(a_r)
            ch, sh = math.cos(h_r), math.sin(h_r)
            s_dot = (
                da * ch * ca - dh * sh * sa,
                -da * ch * sa - dh * sh * ca,
                dh * ch,
            )
            t_dot = -t * _dot(n, s_dot) / n_dot_s
            q_dot = (
                -t_dot * s[0] - t * s_dot[0],
                -t_dot * s[1] - t * s_dot[1],
                -t_dot * s[2] - t * s_dot[2],
            )
            rate_len = _dot(q, q_dot) / length_ratio

    return {
        "cast": True,
        "self_shadowed": False,
        "bearing_deg": bearing,
        "compass16": comp,
        "length_ratio": length_ratio,
        "horizontal_length_ratio": horiz_ratio,
        "rate_bearing_deg_per_min": rate_az,
        "rate_length_ratio_per_min": rate_len,
        "penumbra_deg": penumbra_deg,
        "slope_deg": float(slope_deg),
        "slope_azimuth_deg": slope_az_norm,
    }


def _moon_bright_limb(moon_az, moon_alt_true, sun_az, sun_alt_true):
    """Lens-independent zenith-frame bright-limb angle (deg in [0, 360)) and
    clock string in the Moon's own local tangent basis:
      e_M = (cos A_M, -sin A_M, 0)   (0 deg = right/east)
      u_M = e_M x M                  (90 deg = straight up/zenith)
    Matches skyview.clock_of convention. Returns (None, None) at exact syzygy."""
    M = dir_from_az_alt(moon_az, moon_alt_true)
    S = dir_from_az_alt(sun_az, sun_alt_true)
    s_dot_m = _dot(S, M)
    t = (S[0] - s_dot_m * M[0], S[1] - s_dot_m * M[1], S[2] - s_dot_m * M[2])
    if _norm(t) < 1e-12:
        return None, None
    a_r = moon_az * DEG
    e_m = (math.cos(a_r), -math.sin(a_r), 0.0)
    u_m = _cross(e_m, M)
    angle = (math.atan2(_dot(t, u_m), _dot(t, e_m)) / DEG) % 360.0
    return angle, clock_of(angle)


def _compute_lighting(sun_az, sun_alt_app, shadow, cam_az, cam_alt):
    """Camera-relative solar azimuth, shadow direction, and glare risk."""
    cam_az_n = cam_az % 360.0
    sun_rel = _wrap180(sun_az - cam_az_n)
    shd_rel = (
        _wrap180(shadow["bearing_deg"] - cam_az_n)
        if shadow["cast"] and shadow["bearing_deg"] is not None
        else None
    )
    cam_v = dir_from_az_alt(cam_az_n, cam_alt)
    sun_v = dir_from_az_alt(sun_az, sun_alt_app)
    sep = math.acos(_clamp1(_dot(cam_v, sun_v))) / DEG
    if sun_alt_app <= 0.0:
        risk = "none"
    elif sep <= 15.0:
        risk = "direct"
    elif sep <= 35.0:
        risk = "high"
    elif sep <= 65.0:
        risk = "moderate"
    else:
        risk = "none"
    return {
        "camera_aim_az_deg": cam_az_n,
        "camera_aim_alt_deg": float(cam_alt),
        "sun_relative_az_deg": sun_rel,
        "shadow_screen_az_deg": shd_rel,
        "sun_camera_angle_deg": sep,
        "glare_risk": risk,
    }


def _next_twilight_transition(engine, jd_ut, lat, lon_east, pressure):
    """Find the earliest crossing of sun_alt_app=0 (sunrise/sunset) or
    sun_alt_true=-6 (civil_dawn/civil_dusk) within the next 1.05 days.
    Returns (minutes_to_next, kind) or (None, None) in polar day/night."""
    # Exact true altitude where refract_true_to_apparent transitions across 0.0.
    lo_h, hi_h = -1.5, 0.0
    for _ in range(32):
        mid_h = 0.5 * (lo_h + hi_h)
        if refract_true_to_apparent(mid_h, pressure) > 0.0:
            hi_h = mid_h
        else:
            lo_h = mid_h
    h_rise = hi_h
    thresholds = (
        (h_rise, "sunrise", "sunset"),
        (-6.0, "civil_dawn", "civil_dusk"),
    )

    # Precompute Sun equatorial unit vectors at jd_ut and jd_ut + 1.05 for fast
    # 15-minute bracketing, then refine the first crossing with exact az_alt.
    span = 1.05
    p0 = engine.position("sun", jd_ut)
    p1 = engine.position("sun", jd_ut + span)
    jde0, jde1 = jd_tt(jd_ut), jd_tt(jd_ut + span)
    ra0, dec0 = equatorial(p0["lon"] * DEG, p0["lat"] * DEG, true_obliquity(jde0))
    ra1, dec1 = equatorial(p1["lon"] * DEG, p1["lat"] * DEG, true_obliquity(jde1))
    u0 = _eq_unit(ra0, dec0)
    u1 = _eq_unit(ra1, dec1)
    g0 = gast(jd_ut)
    g_rate = TWO_PI * 1.002737909350795  # rad/day

    def approx_alt(t):
        f = (t - jd_ut) / span
        v = (
            u0[0] + f * (u1[0] - u0[0]),
            u0[1] + f * (u1[1] - u0[1]),
            u0[2] + f * (u1[2] - u0[2]),
        )
        ra, dec = _ra_dec_from_unit(v)
        lst = (g0 + (t - jd_ut) * g_rate + lon_east * DEG) % TWO_PI
        _, alt = _az_alt_from_eq(ra, dec, lst, lat)
        return alt

    def exact_alt(t):
        ps = engine.position("sun", t)
        _, alt = az_alt(ps["lon"], ps["lat"], t, lat, lon_east)
        return alt

    step = 15.0 / 1440.0
    n_steps = int(math.ceil(span / step))
    t_prev = jd_ut
    a_prev = approx_alt(t_prev)

    best_t = None
    best_kind = None
    for i in range(1, n_steps + 1):
        t_cur = min(jd_ut + span, jd_ut + i * step)
        a_cur = approx_alt(t_cur)
        for thresh, up_kind, dn_kind in thresholds:
            d0 = a_prev - thresh
            d1 = a_cur - thresh
            if (d0 <= 0.0 < d1) or (d0 >= 0.0 > d1):
                kind = up_kind if d1 > d0 else dn_kind
                # Refine with exact az_alt bisection on slightly padded bracket.
                lo = max(jd_ut, t_prev - 2.0 / 1440.0)
                hi = min(jd_ut + span, t_cur + 2.0 / 1440.0)
                flo = exact_alt(lo) - thresh
                fhi = exact_alt(hi) - thresh
                if (flo <= 0.0 < fhi) or (flo >= 0.0 > fhi):
                    for _ in range(24):
                        mid = 0.5 * (lo + hi)
                        fm = exact_alt(mid) - thresh
                        if (flo <= 0.0 and fm <= 0.0) or (flo >= 0.0 and fm >= 0.0):
                            lo, flo = mid, fm
                        else:
                            hi, fhi = mid, fm
                    tc = 0.5 * (lo + hi)
                    if tc > jd_ut and (best_t is None or tc < best_t):
                        best_t = tc
                        best_kind = kind
        if best_t is not None:
            break
        t_prev, a_prev = t_cur, a_cur

    if best_t is None:
        return None, None
    return (best_t - jd_ut) * 1440.0, best_kind


def _night_crossed(engine, prev_jd_ut, jd_ut, lon_east):
    """True iff a local solar midnight (Sun hour angle crossing pi) occurred in
    (prev_jd_ut, jd_ut]. Works at all latitudes including polar regions."""
    if prev_jd_ut is None or prev_jd_ut >= jd_ut:
        return False
    if jd_ut - prev_jd_ut >= 1.0:
        return True

    def sun_midnight_phase(t):
        ps = engine.position("sun", t)
        jde = jd_tt(t)
        ra, _ = equatorial(ps["lon"] * DEG, ps["lat"] * DEG, true_obliquity(jde))
        lst = (gast(t) + lon_east * DEG) % TWO_PI
        ha = (lst - ra) % TWO_PI
        return (ha - math.pi) % TWO_PI  # 0 at solar midnight, advances to 2*pi

    h0 = sun_midnight_phase(prev_jd_ut)
    h1 = sun_midnight_phase(jd_ut)
    return h1 < h0


def _build_chronosense_line(jd_ut, lat, lon_east, sun, shadow, moon,
                            diurnal, night_crossed, deadline):
    """Compact ~35-token single-line spacetime header for agent injection."""
    ts = _format_iso_minute(jd_ut)
    lat_s = _fmt_fixed(lat, 2)
    lon_s = _fmt_fixed(lon_east, 2)
    sun_alt_s = _fmt_fixed(sun["altitude_apparent_deg"], 1)
    if shadow["cast"] and shadow["length_ratio"] is not None:
        shd_s = f"shd {_fmt_fixed(shadow['length_ratio'], 2)}x {shadow['compass16']}"
    elif shadow["self_shadowed"]:
        shd_s = "shd self-shadowed"
    elif shadow["cast"]:
        shd_s = f"shd grazing {shadow['compass16']}"
    else:
        shd_s = "shd none"
    m_pct = _js_round(moon["illum"] * 100.0)
    m_dir = "wax" if moon["waxing"] else "wan"
    m_alt = moon["altitude_apparent_deg"]
    m_sign = "+" if m_alt >= 0.0 else ""
    m_alt_s = f"{m_sign}{_fmt_fixed(m_alt, 1)}"
    if diurnal["next_transition_kind"] is not None:
        nxt_s = (
            f"next {diurnal['next_transition_kind']} "
            f"{_js_round(diurnal['minutes_to_next_twilight'])}m"
        )
    else:
        nxt_s = "polar"
    parts = [
        f"{ts} @{lat_s},{lon_s}",
        f"{sun['twilight_stage']} Sun {sun_alt_s}deg {sun['compass16']} {sun['trend']}",
        shd_s,
        f"Moon {m_pct}% {m_dir} {m_alt_s}deg",
        nxt_s,
    ]
    if deadline is not None:
        rem = _js_round(deadline["minutes_remaining"])
        d_sign = "+" if rem > 0 else ""
        parts.append(f"due {d_sign}{rem}m {deadline['phase']}")
    if night_crossed:
        parts.append("+night")
    return " | ".join(parts)


# ----------------------------------------------------------- scene_geometry

def scene_geometry(
    engine,
    jd_ut,
    lat,
    lon_east,
    *,
    elevation_m=0.0,
    slope_deg=0.0,
    slope_azimuth_deg=0.0,
    bortle=None,
    camera_aim_az_deg=None,
    camera_aim_alt_deg=0.0,
    prev_jd_ut=None,
    deadline_jd_ut=None,
):
    """Forward physical spacetime scene at (jd_ut, lat, lon_east).

    Computes apparent solar/lunar geometry, flat or sloped 3D shadow casting
    and sweep rates, optional camera lighting/glare, zenith-frame lunar bright
    limb, naked-eye visible planets, local diurnal cycle, and chronosense.
    """
    _validate_place(lat, lon_east, elevation_m, slope_deg, slope_azimuth_deg)
    pressure = _pressure_at_elevation(elevation_m)

    # --- Sun & +/-1 min rates
    sun_pos = engine.position("sun", jd_ut)
    sun_az, sun_alt_true = az_alt(sun_pos["lon"], sun_pos["lat"], jd_ut, lat, lon_east)
    sun_alt_app = refract_true_to_apparent(sun_alt_true, pressure)

    sun_pos_m = engine.position("sun", jd_ut - _DT_MIN)
    sun_pos_p = engine.position("sun", jd_ut + _DT_MIN)
    az_m, alt_m = az_alt(sun_pos_m["lon"], sun_pos_m["lat"], jd_ut - _DT_MIN, lat, lon_east)
    az_p, alt_p = az_alt(sun_pos_p["lon"], sun_pos_p["lat"], jd_ut + _DT_MIN, lat, lon_east)
    rate_alt = (alt_p - alt_m) * 0.5
    rate_az = _wrap180(az_p - az_m) * 0.5

    if abs(rate_alt) < 0.005:
        trend = "culminating" if sun_alt_app > 0.0 else "nadir"
    elif rate_alt > 0.0:
        trend = "rising"
    else:
        trend = "setting"

    sun_ph = pheno(engine, "sun", jd_ut)
    sun_diam = sun_ph["diameter"]
    sun_stage = twilight_stage(sun_alt_app)
    sun = {
        "azimuth_deg": sun_az,
        "compass16": compass_of(sun_az),
        "altitude_true_deg": sun_alt_true,
        "altitude_apparent_deg": sun_alt_app,
        "airmass": airmass(sun_alt_app),
        "extinction_mag": extinction_mag(sun_alt_app),
        "twilight_stage": sun_stage,
        "is_day": sun_alt_app > 0.0,
        "trend": trend,
        "rate_alt_deg_per_min": rate_alt,
        "rate_az_deg_per_min": rate_az,
        "angular_diameter_deg": sun_diam,
    }

    # --- Solar shadow (flat or sloped)
    shadow = _compute_shadow(
        sun_az, sun_alt_app, slope_deg, slope_azimuth_deg,
        rate_az=rate_az, rate_alt=rate_alt, penumbra_deg=sun_diam,
    )

    # --- Optional camera lighting
    lighting = (
        _compute_lighting(sun_az, sun_alt_app, shadow, camera_aim_az_deg,
                          camera_aim_alt_deg)
        if camera_aim_az_deg is not None
        else None
    )

    # --- Moon
    moon_pos = engine.position("moon", jd_ut)
    moon_az, moon_alt_true = az_alt(moon_pos["lon"], moon_pos["lat"], jd_ut, lat, lon_east)
    moon_alt_app = refract_true_to_apparent(moon_alt_true, pressure)
    moon_ph = pheno(engine, "moon", jd_ut)
    moon_illum = moon_ph["phase"]
    moon_waxing = ((moon_pos["lon"] - sun_pos["lon"]) % 360.0) < 180.0
    moon_visible = moon_alt_app > 0.0
    bl_deg, bl_clock = _moon_bright_limb(moon_az, moon_alt_true, sun_az, sun_alt_true)

    moon_shd_cast = False
    moon_shd_bearing = None
    moon_shd_length = None
    if sun_alt_app < -6.0 and moon_visible and moon_illum >= 0.5:
        m_shd = _compute_shadow(moon_az, moon_alt_app, slope_deg, slope_azimuth_deg)
        if m_shd["cast"]:
            moon_shd_cast = True
            moon_shd_bearing = m_shd["bearing_deg"]
            moon_shd_length = m_shd["length_ratio"]

    moon = {
        "visible": moon_visible,
        "azimuth_deg": moon_az,
        "compass16": compass_of(moon_az),
        "altitude_true_deg": moon_alt_true,
        "altitude_apparent_deg": moon_alt_app,
        "illum": moon_illum,
        "phase_name": moon_phase_name(moon_illum, moon_waxing),
        "waxing": moon_waxing,
        "elongation_deg": moon_ph["elongation"],
        "magnitude": moon_ph["magnitude"],
        "bright_limb_zenith_deg": bl_deg,
        "bright_limb_clock": bl_clock,
        "shadow_cast": moon_shd_cast,
        "shadow_bearing_deg": moon_shd_bearing,
        "shadow_length_ratio": moon_shd_length,
    }

    # --- Visible naked-eye planets
    lim = limiting_mag(sun_stage, moon_alt_true if moon_alt_true > 0.0 else None,
                       moon_illum, bortle)
    visible_planets = []
    for bid in VISIBLE_PLANETS:
        p = engine.position(bid, jd_ut)
        p_az, p_alt_true = az_alt(p["lon"], p["lat"], jd_ut, lat, lon_east)
        p_alt_app = refract_true_to_apparent(p_alt_true, pressure)
        if p_alt_app > 0.0:
            p_mag = pheno(engine, bid, jd_ut)["magnitude"]
            visible_planets.append({
                "id": bid,
                "azimuth_deg": p_az,
                "compass16": compass_of(p_az),
                "altitude_apparent_deg": p_alt_app,
                "magnitude": p_mag,
                "naked_eye": p_mag <= lim,
            })

    # --- Diurnal cycle (nearest local solar day)
    local_day_idx = math.floor(jd_ut + lon_east / 360.0 + 0.5)
    day_start = local_day_idx - 0.5 - lon_east / 360.0
    solar_noon_jd = rise_set(
        engine, "sun", day_start, lat, lon_east, kind="mtransit",
        alt_m=elevation_m, pressure=pressure, search_days=1.05,
    )
    if solar_noon_jd is not None and solar_noon_jd > day_start + 1.05:
        solar_noon_jd = None

    sunrise_jd = None
    sunset_jd = None
    if solar_noon_jd is not None:
        sr = rise_set(
            engine, "sun", solar_noon_jd - 0.55, lat, lon_east, kind="rise",
            alt_m=elevation_m, pressure=pressure, search_days=0.6,
        )
        if sr is not None and sr <= solar_noon_jd + 1e-6:
            sunrise_jd = sr
        ss = rise_set(
            engine, "sun", solar_noon_jd - 0.02, lat, lon_east, kind="set",
            alt_m=elevation_m, pressure=pressure, search_days=0.6,
        )
        if ss is not None and ss >= solar_noon_jd - 1e-6:
            sunset_jd = ss

    mins_twi, kind_twi = _next_twilight_transition(
        engine, jd_ut, lat, lon_east, pressure)
    phour = _planetary_hour(engine, jd_ut, lat, lon_east)

    diurnal = {
        "sunrise_jd": sunrise_jd,
        "solar_noon_jd": solar_noon_jd,
        "sunset_jd": sunset_jd,
        "minutes_to_next_twilight": mins_twi,
        "next_transition_kind": kind_twi,
        "planetary_hour": phour,
    }

    # --- Chronosense
    asc_rad, _, _, _ = _house_angles(jd_ut, lat, lon_east)
    asc_deg = (asc_rad / DEG) % 360.0
    nc = _night_crossed(engine, prev_jd_ut, jd_ut, lon_east)
    deadline_obj = None
    if deadline_jd_ut is not None:
        rem_min = (deadline_jd_ut - jd_ut) * 1440.0
        if abs(rem_min) <= 1.0:
            d_phase = "exact"
        elif rem_min > 1.0:
            d_phase = "applying"
        else:
            d_phase = "separating"
        deadline_obj = {
            "minutes_remaining": rem_min,
            "phase": d_phase,
        }
    line = _build_chronosense_line(
        jd_ut, lat, lon_east, sun, shadow, moon, diurnal, nc, deadline_obj)
    chronosense = {
        "moon_lon_deg": moon_pos["lon"],
        "asc_deg": asc_deg,
        "night_crossed": nc,
        "deadline": deadline_obj,
        "line": line,
    }

    return {
        "jd_ut": jd_ut,
        "lat": lat,
        "lon_east": lon_east,
        "elevation_m": float(elevation_m),
        "sun": sun,
        "shadow": shadow,
        "lighting": lighting,
        "moon": moon,
        "visible_planets": visible_planets,
        "diurnal": diurnal,
        "chronosense": chronosense,
    }


# ---------------------------------------------- fast snapshot & day cache

def _observed_needs(observed):
    """Determine which celestial bodies are referenced by `observed`."""
    if not observed:
        return False, ()
    need_moon = any(
        k in observed and observed[k] is not None
        for k in (
            "moon_visible", "moon_azimuth_deg", "moon_altitude_deg",
            "moon_illum", "moon_waxing", "moon_bright_limb_deg",
        )
    )
    extra_bodies = []
    bv = observed.get("bodies_visible")
    if bv:
        for b in bv:
            bl = b.lower()
            if bl == "moon":
                need_moon = True
            elif bl != "sun" and bl not in extra_bodies:
                extra_bodies.append(bl)
    # Moon also affects limiting_mag when planets are checked.
    if extra_bodies:
        need_moon = True
    return need_moon, tuple(extra_bodies)


def _validate_observed(observed):
    """Validate `observed` dict and return normalized copy (or {})."""
    if observed is None:
        return {}
    if not isinstance(observed, dict):
        raise ValueError("observed must be a dict or None")
    out = {}
    for k, v in observed.items():
        if v is None:
            continue
        if k == "twilight":
            if v not in TWILIGHT_BANDS:
                raise ValueError(
                    f"unknown twilight {v!r} (expected one of {sorted(TWILIGHT_BANDS)})")
            out[k] = v
        elif k == "shadow_length_ratio":
            val = float(v)
            if not (math.isfinite(val) and val >= 0.0):
                raise ValueError(f"shadow_length_ratio must be >= 0, got {v!r}")
            out[k] = val
        elif k in ("shadow_bearing_deg", "sun_azimuth_deg", "moon_azimuth_deg",
                   "moon_bright_limb_deg"):
            val = float(v)
            if not math.isfinite(val):
                raise ValueError(f"{k} must be finite, got {v!r}")
            out[k] = val % 360.0
        elif k in ("sun_altitude_deg", "moon_altitude_deg"):
            val = float(v)
            if not (math.isfinite(val) and -90.0 <= val <= 90.0):
                raise ValueError(f"{k} must be in [-90, 90], got {v!r}")
            out[k] = val
        elif k == "moon_illum":
            val = float(v)
            if not (math.isfinite(val) and 0.0 <= val <= 1.0):
                raise ValueError(f"moon_illum must be in [0, 1], got {v!r}")
            out[k] = val
        elif k in ("sun_visible", "moon_visible", "moon_waxing"):
            if not isinstance(v, bool):
                raise ValueError(f"{k} must be bool, got {v!r}")
            out[k] = v
        elif k == "bodies_visible":
            seen = []
            for b in v:
                bl = str(b).lower()
                if bl not in VALID_VISIBLE_BODIES:
                    raise ValueError(f"unknown body in bodies_visible: {b!r}")
                if bl not in seen:
                    seen.append(bl)
            if seen:
                out[k] = seen
        elif k == "shadow_sweep":
            if not isinstance(v, dict):
                raise ValueError("shadow_sweep must be a dict")
            dt_m = float(v["dt_minutes"])
            db = float(v["delta_bearing_deg"])
            if not (math.isfinite(dt_m) and dt_m > 0.0):
                raise ValueError("shadow_sweep.dt_minutes must be > 0")
            if not math.isfinite(db):
                raise ValueError("shadow_sweep.delta_bearing_deg must be finite")
            sw = {"dt_minutes": dt_m, "delta_bearing_deg": db}
            if v.get("tolerance_deg") is not None:
                tol = float(v["tolerance_deg"])
                if not (math.isfinite(tol) and tol > 0.0):
                    raise ValueError("shadow_sweep.tolerance_deg must be > 0")
                sw["tolerance_deg"] = tol
            out[k] = sw
        elif k == "tolerances":
            if not isinstance(v, dict):
                raise ValueError("tolerances must be a dict")
            tols = {}
            for tk, tv in v.items():
                if tv is not None:
                    fval = float(tv)
                    if not (math.isfinite(fval) and fval > 0.0):
                        raise ValueError(f"tolerance {tk} must be > 0, got {tv!r}")
                    tols[tk] = fval
            out[k] = tols
        else:
            raise ValueError(f"unknown observed key: {k!r}")
    return out


def _has_active_constraints(obs):
    return any(k != "tolerances" for k in obs)


def _snapshot_at(engine, jd_ut, need_moon=False, extra_bodies=(),
                 sweep_dt_min=None):
    """Precompute all geocentric equatorial coordinates at jd_ut ONCE so
    evaluating any (lat, lon) is pure trigonometry."""
    jde = jd_tt(jd_ut)
    eps = true_obliquity(jde)
    g = gast(jd_ut)
    sp = engine.position("sun", jd_ut)
    s_ra, s_dec = equatorial(sp["lon"] * DEG, sp["lat"] * DEG, eps)

    snap = {
        "jd_ut": jd_ut,
        "gast": g,
        "sun_ra": s_ra,
        "sun_dec": s_dec,
        "sun_lon": sp["lon"],
        "moon": None,
        "bodies": {},
        "sweep_steps": None,
    }

    if need_moon:
        mp = engine.position("moon", jd_ut)
        m_ra, m_dec = equatorial(mp["lon"] * DEG, mp["lat"] * DEG, eps)
        mph = pheno(engine, "moon", jd_ut)
        snap["moon"] = {
            "ra": m_ra,
            "dec": m_dec,
            "lon": mp["lon"],
            "illum": mph["phase"],
            "waxing": ((mp["lon"] - sp["lon"]) % 360.0) < 180.0,
            "mag": mph["magnitude"],
        }

    for bid in extra_bodies:
        bp = engine.position(bid, jd_ut)
        b_ra, b_dec = equatorial(bp["lon"] * DEG, bp["lat"] * DEG, eps)
        b_mag = pheno(engine, bid, jd_ut)["magnitude"] if bid in DIAMETER_KM else None
        snap["bodies"][bid] = {"ra": b_ra, "dec": b_dec, "mag": b_mag}

    if sweep_dt_min is not None:
        n_chunks = max(1, int(math.ceil(sweep_dt_min / 30.0)))
        steps = []
        for i in range(1, n_chunks + 1):
            ti = jd_ut + (sweep_dt_min * (i / n_chunks)) * _DT_MIN
            jde_i = jd_tt(ti)
            eps_i = true_obliquity(jde_i)
            psi = engine.position("sun", ti)
            ra_i, dec_i = equatorial(psi["lon"] * DEG, psi["lat"] * DEG, eps_i)
            steps.append((gast(ti), ra_i, dec_i))
        snap["sweep_steps"] = steps

    return snap


def _build_day_cache(engine, t0, t1, need_moon=False, extra_bodies=()):
    """Smooth equatorial unit-vector interpolation over a <=1.2 day span so
    dense intra-day scans run in pure trig while exact ephemeris refines edges."""
    span = t1 - t0
    if span <= 0.0:
        span = 1e-6

    # Sun: 3 knots (quadratic Lagrange -> <0.0001 deg error over 28h)
    tm = t0 + 0.5 * span
    sun_knots = []
    for t in (t0, tm, t1):
        jde = jd_tt(t)
        eps = true_obliquity(jde)
        p = engine.position("sun", t)
        ra, dec = equatorial(p["lon"] * DEG, p["lat"] * DEG, eps)
        sun_knots.append((_eq_unit(ra, dec), p["lon"]))

    g0 = gast(t0)
    g1 = gast(t1)
    # Unwrap g1 relative to g0 (gast advances ~2*pi*1.0027379 rad/day).
    g_expected = g0 + span * TWO_PI * 1.002737909350795
    g_end = g_expected + _wrap_pi(g1 - g_expected)
    g_rate = (g_end - g0) / span

    # Moon: 5 knots (4 x 6h quadratic/linear -> <0.003 deg error)
    moon_knots = None
    if need_moon:
        moon_knots = []
        for k in range(5):
            tk = t0 + (k / 4.0) * span
            jde = jd_tt(tk)
            eps = true_obliquity(jde)
            mp = engine.position("moon", tk)
            ra, dec = equatorial(mp["lon"] * DEG, mp["lat"] * DEG, eps)
            mph = pheno(engine, "moon", tk)
            moon_knots.append((_eq_unit(ra, dec), mp["lon"], mph["phase"], mph["magnitude"]))

    body_knots = {}
    for bid in extra_bodies:
        pts = []
        for t in (t0, t1):
            jde = jd_tt(t)
            eps = true_obliquity(jde)
            bp = engine.position(bid, t)
            ra, dec = equatorial(bp["lon"] * DEG, bp["lat"] * DEG, eps)
            b_mag = pheno(engine, bid, t)["magnitude"] if bid in DIAMETER_KM else None
            pts.append((_eq_unit(ra, dec), b_mag))
        body_knots[bid] = pts

    def _quad_vec(v0, v1, v2, s):
        # s in [0, 1]; knots at 0, 0.5, 1.0
        w0 = (1.0 - s) * (1.0 - 2.0 * s)
        w1 = 4.0 * s * (1.0 - s)
        w2 = s * (2.0 * s - 1.0)
        return (
            w0 * v0[0] + w1 * v1[0] + w2 * v2[0],
            w0 * v0[1] + w1 * v1[1] + w2 * v2[1],
            w0 * v0[2] + w1 * v1[2] + w2 * v2[2],
        )

    def _lerp_lon(l0, l1, f):
        return (l0 + f * _wrap180(l1 - l0)) % 360.0

    def snap_at(t, sweep_dt_min=None):
        s = (t - t0) / span
        sv = _quad_vec(sun_knots[0][0], sun_knots[1][0], sun_knots[2][0], s)
        s_ra, s_dec = _ra_dec_from_unit(sv)
        s_lon = _lerp_lon(sun_knots[0][1], sun_knots[2][1], s)
        g = (g0 + (t - t0) * g_rate) % TWO_PI

        moon_d = None
        if moon_knots is not None:
            sc = max(0.0, min(1.0, s))
            if sc <= 0.5:
                mv = _quad_vec(moon_knots[0][0], moon_knots[1][0], moon_knots[2][0], sc * 2.0)
                seg_f = sc * 4.0
            else:
                mv = _quad_vec(moon_knots[2][0], moon_knots[3][0], moon_knots[4][0], (sc - 0.5) * 2.0)
                seg_f = sc * 4.0
            idx = min(3, int(seg_f))
            f = seg_f - idx
            m_ra, m_dec = _ra_dec_from_unit(mv)
            m_lon = _lerp_lon(moon_knots[idx][1], moon_knots[idx + 1][1], f)
            m_illum = moon_knots[idx][2] + f * (moon_knots[idx + 1][2] - moon_knots[idx][2])
            m_mag = moon_knots[idx][3] + f * (moon_knots[idx + 1][3] - moon_knots[idx][3])
            moon_d = {
                "ra": m_ra,
                "dec": m_dec,
                "lon": m_lon,
                "illum": max(0.0, min(1.0, m_illum)),
                "waxing": ((m_lon - s_lon) % 360.0) < 180.0,
                "mag": m_mag,
            }

        bodies_d = {}
        for bid, (k0, k1) in body_knots.items():
            v0, m0 = k0
            v1, m1 = k1
            bv = (
                v0[0] + s * (v1[0] - v0[0]),
                v0[1] + s * (v1[1] - v0[1]),
                v0[2] + s * (v1[2] - v0[2]),
            )
            b_ra, b_dec = _ra_dec_from_unit(bv)
            b_mag = None if m0 is None else m0 + s * (m1 - m0)
            bodies_d[bid] = {"ra": b_ra, "dec": b_dec, "mag": b_mag}

        sweep_steps = None
        if sweep_dt_min is not None:
            n_chunks = max(1, int(math.ceil(sweep_dt_min / 30.0)))
            sweep_steps = []
            for i in range(1, n_chunks + 1):
                ti = t + (sweep_dt_min * (i / n_chunks)) * _DT_MIN
                si = (ti - t0) / span
                svi = _quad_vec(sun_knots[0][0], sun_knots[1][0], sun_knots[2][0], si)
                rai, deci = _ra_dec_from_unit(svi)
                gi = (g0 + (ti - t0) * g_rate) % TWO_PI
                sweep_steps.append((gi, rai, deci))

        return {
            "jd_ut": t,
            "gast": g,
            "sun_ra": s_ra,
            "sun_dec": s_dec,
            "sun_lon": s_lon,
            "moon": moon_d,
            "bodies": bodies_d,
            "sweep_steps": sweep_steps,
        }

    return snap_at


# -------------------------------------------- constraint evaluation & scoring

def _eval_snap_at_place(snap, lat, lon_east, observed, *,
                        elevation_m=0.0, slope_deg=0.0, slope_azimuth_deg=0.0,
                        time_tol=0.0, place_tol=0.0, bortle=None,
                        sun_rates=None, moon_rates=None, bl_rate=None,
                        sweep_time_spread=0.0, chronolocate_mode=False):
    """Evaluate all constraints in `observed` against a geocentric snapshot at
    (lat, lon_east). Returns (checks, verdict, score, max_norm_res, margin)."""
    pressure = _pressure_at_elevation(elevation_m)
    tol_map = observed.get("tolerances") or {}
    lst = (snap["gast"] + lon_east * DEG) % TWO_PI

    sun_az, sun_alt_true = _az_alt_from_eq(snap["sun_ra"], snap["sun_dec"], lst, lat)
    sun_alt_app = refract_true_to_apparent(sun_alt_true, pressure)
    sun_stage = twilight_stage(sun_alt_app)

    if sun_rates is not None:
        rate_alt, rate_az = sun_rates
    elif time_tol > 0.0:
        # Pure-trig +/-1 min Earth rotation rate (Sun orbital motion <0.001 deg/min).
        dlst = _DT_MIN * TWO_PI * 1.002737909350795
        az_m, alt_m = _az_alt_from_eq(snap["sun_ra"], snap["sun_dec"], (lst - dlst) % TWO_PI, lat)
        az_p, alt_p = _az_alt_from_eq(snap["sun_ra"], snap["sun_dec"], (lst + dlst) % TWO_PI, lat)
        rate_alt = (alt_p - alt_m) * 0.5
        rate_az = _wrap180(az_p - az_m) * 0.5
    else:
        rate_alt, rate_az = 0.0, 0.0

    shadow = _compute_shadow(
        sun_az, sun_alt_app, slope_deg, slope_azimuth_deg,
        rate_az=rate_az, rate_alt=rate_alt,
    )

    moon_d = snap["moon"]
    moon_az = moon_alt_true = moon_alt_app = None
    moon_illum = moon_waxing = bl_deg = None
    m_rate_alt = m_rate_az = 0.0
    if moon_d is not None:
        moon_az, moon_alt_true = _az_alt_from_eq(moon_d["ra"], moon_d["dec"], lst, lat)
        moon_alt_app = refract_true_to_apparent(moon_alt_true, pressure)
        moon_illum = moon_d["illum"]
        moon_waxing = moon_d["waxing"]
        bl_deg, _ = _moon_bright_limb(moon_az, moon_alt_true, sun_az, sun_alt_true)
        if moon_rates is not None:
            m_rate_alt, m_rate_az = moon_rates
        elif time_tol > 0.0:
            dlst = _DT_MIN * TWO_PI * 1.002737909350795
            maz_m, malt_m = _az_alt_from_eq(moon_d["ra"], moon_d["dec"], (lst - dlst) % TWO_PI, lat)
            maz_p, malt_p = _az_alt_from_eq(moon_d["ra"], moon_d["dec"], (lst + dlst) % TWO_PI, lat)
            m_rate_alt = (malt_p - malt_m) * 0.5
            m_rate_az = _wrap180(maz_p - maz_m) * 0.5

    def _az_place_widening(alt_deg):
        if place_tol <= 0.0:
            return 0.0
        return min(90.0, place_tol / max(0.1, math.cos(alt_deg * DEG)))

    checks = []
    active_res = []
    margins = []
    any_impossible = False
    any_inconsistent = False
    any_marginal = False

    def add_check(field, status, obs_v, exp_v, res, tol, norm_r, margin_v, note=None):
        nonlocal any_impossible, any_inconsistent, any_marginal
        checks.append({
            "field": field,
            "status": status,
            "observed": obs_v,
            "expected": exp_v,
            "residual": res,
            "tolerance": tol,
            "normalized_residual": norm_r,
            "note": note,
        })
        if status == "indeterminate":
            return
        active_res.append(norm_r)
        margins.append(margin_v)
        if status == "impossible":
            any_impossible = True
        elif status == "inconsistent":
            any_inconsistent = True
        elif status == "marginal":
            any_marginal = True

    def classify_numeric(norm_r):
        if norm_r <= 1.0:
            return "consistent"
        if norm_r <= 1.5:
            return "marginal"
        return "inconsistent"

    # 1. shadow_bearing_deg
    if "shadow_bearing_deg" in observed:
        obs_v = observed["shadow_bearing_deg"]
        tol_base = tol_map.get("shadow_bearing_deg", DEFAULT_TOLERANCES["shadow_bearing_deg"])
        tol = tol_base + abs(rate_az) * time_tol + _az_place_widening(sun_alt_app)
        if not shadow["cast"]:
            if shadow["self_shadowed"]:
                s_vec = dir_from_az_alt(sun_az, sun_alt_app)
                n_dot_s = _dot(_slope_normal(slope_deg, slope_azimuth_deg), s_vec)
                nr = 3.0 + abs(n_dot_s) / 0.1
                mv = -1.0 + n_dot_s / 0.1
                note = "terrain is self-shadowed at this slope and solar position"
            else:
                nr = 3.0 + abs(sun_alt_app) / 5.0
                mv = -1.0 + sun_alt_app / 5.0
                note = "Sun is below horizon; no solar shadow can be cast"
            add_check("shadow_bearing_deg", "impossible", obs_v, None, None, tol, nr, mv, note)
        elif sun_alt_app > _ZENITH_INDET_DEG:
            if chronolocate_mode and not (
                ("sun_altitude_deg" in observed and observed["sun_altitude_deg"] > _ZENITH_INDET_DEG)
                or ("shadow_length_ratio" in observed and observed["shadow_length_ratio"] < 0.04)
            ):
                add_check("shadow_bearing_deg", "inconsistent", obs_v, shadow["bearing_deg"],
                          None, tol, 2.0, -0.5,
                          "Sun near zenith during scan; bearing ill-conditioned")
            else:
                add_check("shadow_bearing_deg", "indeterminate", obs_v, shadow["bearing_deg"],
                          None, tol, None, 0.0,
                          "Sun is near zenith (>88 deg); shadow bearing is ill-conditioned")
        else:
            err = _wrap180(obs_v - shadow["bearing_deg"])
            nr = abs(err) / tol
            add_check("shadow_bearing_deg", classify_numeric(nr), obs_v,
                      shadow["bearing_deg"], err, tol, nr, 1.0 - nr)

    # 2. shadow_length_ratio
    if "shadow_length_ratio" in observed:
        obs_v = observed["shadow_length_ratio"]
        if not shadow["cast"]:
            tol_abs_fallback = tol_map.get(
                "shadow_length_ratio",
                tol_map.get("shadow_length_ratio_rel", DEFAULT_TOLERANCES["shadow_length_ratio_rel"]) * obs_v
                + tol_map.get("shadow_length_ratio_abs", DEFAULT_TOLERANCES["shadow_length_ratio_abs"]),
            )
            if shadow["self_shadowed"]:
                s_vec = dir_from_az_alt(sun_az, sun_alt_app)
                n_dot_s = _dot(_slope_normal(slope_deg, slope_azimuth_deg), s_vec)
                nr = 3.0 + abs(n_dot_s) / 0.1
                mv = -1.0 + n_dot_s / 0.1
                note = "terrain is self-shadowed; no solar shadow length exists"
            else:
                nr = 3.0 + abs(sun_alt_app) / 5.0
                mv = -1.0 + sun_alt_app / 5.0
                note = "Sun is below horizon; no solar shadow can be cast"
            add_check("shadow_length_ratio", "impossible", obs_v, None, None,
                      tol_abs_fallback, nr, mv, note)
        elif shadow["length_ratio"] is None:
            # Grazing (<0.05 deg): shadow stretches toward infinity.
            if obs_v >= 20.0:
                add_check("shadow_length_ratio", "indeterminate", obs_v, None, None,
                          None, None, 0.0, "Sun is grazing (<0.05 deg); shadow length diverges")
            else:
                nr = (20.0 - obs_v) / 5.0
                add_check("shadow_length_ratio", classify_numeric(nr), obs_v, None,
                          None, 5.0, nr, 1.0 - nr,
                          "Sun is grazing (<0.05 deg); shadow length far exceeds observation")
        else:
            exp_v = shadow["length_ratio"]
            if "shadow_length_ratio" in tol_map:
                tol_base = tol_map["shadow_length_ratio"]
            else:
                rel = tol_map.get("shadow_length_ratio_rel",
                                  DEFAULT_TOLERANCES["shadow_length_ratio_rel"])
                abs_f = tol_map.get("shadow_length_ratio_abs",
                                    DEFAULT_TOLERANCES["shadow_length_ratio_abs"])
                tol_base = rel * exp_v + abs_f
            rate_l = shadow["rate_length_ratio_per_min"] or 0.0
            s_vec = dir_from_az_alt(sun_az, sun_alt_app)
            n_dot_s = max(0.1, _dot(_slope_normal(slope_deg, slope_azimuth_deg), s_vec))
            place_w = (place_tol * DEG) / (n_dot_s * n_dot_s) if place_tol > 0.0 else 0.0
            tol = tol_base + abs(rate_l) * time_tol + place_w
            err = obs_v - exp_v
            nr = abs(err) / tol
            add_check("shadow_length_ratio", classify_numeric(nr), obs_v, exp_v,
                      err, tol, nr, 1.0 - nr)

    # 3. sun_azimuth_deg
    if "sun_azimuth_deg" in observed:
        obs_v = observed["sun_azimuth_deg"]
        tol_base = tol_map.get("sun_azimuth_deg", DEFAULT_TOLERANCES["sun_azimuth_deg"])
        tol = tol_base + abs(rate_az) * time_tol + _az_place_widening(sun_alt_app)
        if abs(sun_alt_app) > _ZENITH_INDET_DEG:
            if chronolocate_mode and not (
                "sun_altitude_deg" in observed and abs(observed["sun_altitude_deg"]) > _ZENITH_INDET_DEG
            ):
                add_check("sun_azimuth_deg", "inconsistent", obs_v, sun_az, None, tol,
                          2.0, -0.5, "Sun near zenith/nadir during scan")
            else:
                add_check("sun_azimuth_deg", "indeterminate", obs_v, sun_az, None, tol,
                          None, 0.0, "Sun is near zenith/nadir (>88 deg); azimuth ill-conditioned")
        else:
            err = _wrap180(obs_v - sun_az)
            nr = abs(err) / tol
            add_check("sun_azimuth_deg", classify_numeric(nr), obs_v, sun_az,
                      err, tol, nr, 1.0 - nr)

    # 4. sun_altitude_deg
    if "sun_altitude_deg" in observed:
        obs_v = observed["sun_altitude_deg"]
        tol_base = tol_map.get("sun_altitude_deg", DEFAULT_TOLERANCES["sun_altitude_deg"])
        tol = tol_base + abs(rate_alt) * time_tol + place_tol
        err = obs_v - sun_alt_app
        nr = abs(err) / tol
        add_check("sun_altitude_deg", classify_numeric(nr), obs_v, sun_alt_app,
                  err, tol, nr, 1.0 - nr)

    # 5. twilight
    if "twilight" in observed:
        obs_v = observed["twilight"]
        lo_b, hi_b = TWILIGHT_BANDS[obs_v]
        if lo_b <= sun_alt_app <= hi_b:
            inside_dist = min(sun_alt_app - lo_b, hi_b - sun_alt_app)
            mv = min(1.0, inside_dist / 1.5)
            add_check("twilight", "consistent", obs_v, sun_stage, 0.0, None, 0.0, mv)
        else:
            dist = (lo_b - sun_alt_app) if sun_alt_app < lo_b else (sun_alt_app - hi_b)
            b_tol = abs(rate_alt) * time_tol + place_tol + 1.5
            nr = dist / b_tol
            mv = -dist / b_tol
            if dist > 6.0 + abs(rate_alt) * time_tol + place_tol:
                st = "impossible"
                note = f"Sun at {sun_alt_app:.1f} deg is far outside {obs_v} band [{lo_b}, {hi_b}]"
            else:
                st = classify_numeric(nr)
                note = None
            add_check("twilight", st, obs_v, sun_stage, dist, b_tol, nr, mv, note)

    # 6. sun_visible
    if "sun_visible" in observed:
        obs_v = observed["sun_visible"]
        exp_v = sun_alt_app > 0.0
        margin_deg = abs(rate_alt) * time_tol + place_tol + 0.5
        if obs_v:
            if sun_alt_app > 0.0:
                add_check("sun_visible", "consistent", True, True, 0.0, margin_deg,
                          0.0, min(1.0, sun_alt_app / 1.0))
            else:
                d = -sun_alt_app
                nr = d / margin_deg
                mv = -d / margin_deg
                if d <= margin_deg:
                    st = "consistent"
                elif d <= margin_deg + 2.0:
                    st = "marginal"
                else:
                    st = "impossible"
                    nr = max(nr, 2.0 + d / 5.0)
                add_check("sun_visible", st, True, False, -d, margin_deg, nr, mv,
                          "Sun is below horizon" if st == "impossible" else None)
        else:
            if sun_alt_app <= 0.0:
                add_check("sun_visible", "consistent", False, False, 0.0, margin_deg,
                          0.0, min(1.0, (-sun_alt_app) / 1.0))
            else:
                d = sun_alt_app
                nr = d / margin_deg
                mv = -d / margin_deg
                if d <= margin_deg:
                    st = "consistent"
                elif d <= margin_deg + 2.0:
                    st = "marginal"
                elif d > 6.0 + margin_deg:
                    st = "impossible"
                    nr = max(nr, 2.0 + d / 5.0)
                else:
                    st = "inconsistent"
                add_check("sun_visible", st, False, True, d, margin_deg, nr, mv,
                          "Sun is well above horizon" if st == "impossible" else None)

    # 7. moon_visible
    if "moon_visible" in observed:
        obs_v = observed["moon_visible"]
        exp_v = moon_alt_app > 0.0
        margin_deg = abs(m_rate_alt) * time_tol + place_tol + 0.5
        if obs_v:
            if moon_alt_app > 0.0:
                add_check("moon_visible", "consistent", True, True, 0.0, margin_deg,
                          0.0, min(1.0, moon_alt_app / 1.0))
            else:
                d = -moon_alt_app
                nr = d / margin_deg
                mv = -d / margin_deg
                if d <= margin_deg:
                    st = "consistent"
                elif d <= margin_deg + 2.0:
                    st = "marginal"
                else:
                    st = "impossible"
                    nr = max(nr, 2.0 + d / 5.0)
                add_check("moon_visible", st, True, False, -d, margin_deg, nr, mv,
                          "Moon is below horizon" if st == "impossible" else None)
        else:
            if moon_alt_app <= 0.0:
                add_check("moon_visible", "consistent", False, False, 0.0, margin_deg,
                          0.0, min(1.0, (-moon_alt_app) / 1.0))
            else:
                d = moon_alt_app
                nr = d / margin_deg
                mv = -d / margin_deg
                if d <= margin_deg:
                    st = "consistent"
                elif d <= margin_deg + 2.0:
                    st = "marginal"
                elif d > 6.0 + margin_deg:
                    st = "impossible"
                    nr = max(nr, 2.0 + d / 5.0)
                else:
                    st = "inconsistent"
                add_check("moon_visible", st, False, True, d, margin_deg, nr, mv,
                          "Moon is well above horizon" if st == "impossible" else None)

    # 8. moon_azimuth_deg
    if "moon_azimuth_deg" in observed:
        obs_v = observed["moon_azimuth_deg"]
        tol_base = tol_map.get("moon_azimuth_deg", DEFAULT_TOLERANCES["moon_azimuth_deg"])
        tol = tol_base + abs(m_rate_az) * time_tol + _az_place_widening(moon_alt_app)
        vis_margin = abs(m_rate_alt) * time_tol + place_tol + 3.0
        if moon_alt_app < -vis_margin:
            nr = 2.5 + abs(moon_alt_app) / 5.0
            mv = moon_alt_app / 2.0
            add_check("moon_azimuth_deg", "impossible", obs_v, moon_az,
                      _wrap180(obs_v - moon_az), tol, nr, mv,
                      "Moon is below horizon; azimuth cannot be observed")
        elif abs(moon_alt_app) > _ZENITH_INDET_DEG:
            add_check("moon_azimuth_deg", "indeterminate", obs_v, moon_az, None,
                      tol, None, 0.0, "Moon is near zenith; azimuth ill-conditioned")
        else:
            err = _wrap180(obs_v - moon_az)
            nr = abs(err) / tol
            mv = 1.0 - nr
            if chronolocate_mode and moon_alt_app < 0.0:
                mv = min(mv, moon_alt_app / 2.0)
            add_check("moon_azimuth_deg", classify_numeric(nr), obs_v, moon_az,
                      err, tol, nr, mv)

    # 9. moon_altitude_deg
    if "moon_altitude_deg" in observed:
        obs_v = observed["moon_altitude_deg"]
        tol_base = tol_map.get("moon_altitude_deg", DEFAULT_TOLERANCES["moon_altitude_deg"])
        tol = tol_base + abs(m_rate_alt) * time_tol + place_tol
        err = obs_v - moon_alt_app
        nr = abs(err) / tol
        vis_margin = abs(m_rate_alt) * time_tol + place_tol + 3.0
        if obs_v > 3.0 and moon_alt_app < -vis_margin:
            st = "impossible"
            nr = max(nr, 2.5 + abs(moon_alt_app) / 5.0)
            note = "Moon is well below horizon"
        else:
            st = classify_numeric(nr)
            note = None
        add_check("moon_altitude_deg", st, obs_v, moon_alt_app, err, tol, nr, 1.0 - nr, note)

    # 10. moon_illum
    if "moon_illum" in observed:
        obs_v = observed["moon_illum"]
        tol_base = tol_map.get("moon_illum", DEFAULT_TOLERANCES["moon_illum"])
        tol = tol_base + 0.00005 * time_tol
        err = obs_v - moon_illum
        nr = abs(err) / tol
        if abs(err) > max(0.35, 3.0 * tol):
            st = "impossible"
            note = f"Lunar illumination {moon_illum:.2f} incompatible with {obs_v:.2f} on this date"
        else:
            st = classify_numeric(nr)
            note = None
        add_check("moon_illum", st, obs_v, moon_illum, err, tol, nr, 1.0 - nr, note)

    # 11. moon_waxing
    if "moon_waxing" in observed:
        obs_v = observed["moon_waxing"]
        if moon_illum > _MOON_PHASE_INDET_HI or moon_illum < _MOON_PHASE_INDET_LO:
            add_check("moon_waxing", "indeterminate", obs_v, moon_waxing, None,
                      None, None, 0.0,
                      "Moon is near full or new phase; waxing/waning visually indeterminate")
        else:
            elong_rad = (moon_d["lon"] - snap["sun_lon"]) * DEG
            sin_e = math.sin(elong_rad)
            signed_s = sin_e if obs_v else -sin_e
            mv = max(-2.0, min(1.0, signed_s / 0.087))
            if obs_v == moon_waxing:
                add_check("moon_waxing", "consistent", obs_v, moon_waxing, 0.0,
                          None, 0.0, max(0.0, mv))
            else:
                add_check("moon_waxing", "impossible", obs_v, moon_waxing, None,
                          None, 4.0, min(-0.5, mv),
                          "Observed waxing/waning side contradicts lunar elongation")

    # 12. moon_bright_limb_deg
    if "moon_bright_limb_deg" in observed:
        obs_v = observed["moon_bright_limb_deg"]
        tol_base = tol_map.get("moon_bright_limb_deg", DEFAULT_TOLERANCES["moon_bright_limb_deg"])
        br = abs(bl_rate) if bl_rate is not None else 0.25
        tol = tol_base + br * time_tol + place_tol
        vis_margin = abs(m_rate_alt) * time_tol + place_tol + 3.0
        if moon_alt_app < -vis_margin:
            nr = 2.5 + abs(moon_alt_app) / 5.0
            mv = moon_alt_app / 2.0
            res_bl = None if bl_deg is None else _wrap180(obs_v - bl_deg)
            add_check("moon_bright_limb_deg", "impossible", obs_v, bl_deg,
                      res_bl, tol, nr, mv,
                      "Moon is below horizon; bright limb cannot be observed")
        elif (moon_illum > _MOON_PHASE_INDET_HI
                or moon_illum < _MOON_PHASE_INDET_LO
                or bl_deg is None):
            if chronolocate_mode and not (
                "moon_illum" in observed
                and (observed["moon_illum"] > _MOON_PHASE_INDET_HI
                     or observed["moon_illum"] < _MOON_PHASE_INDET_LO)
            ):
                # Do not falsely match full/new Moon during chronolocation sweeps.
                add_check("moon_bright_limb_deg", "inconsistent", obs_v, bl_deg,
                          None, tol, 2.0, -0.5,
                          "Moon near full/new phase during scan")
            else:
                add_check("moon_bright_limb_deg", "indeterminate", obs_v, bl_deg,
                          None, tol, None, 0.0,
                          "Moon is near full or new phase; bright-limb tilt is indeterminate")
        else:
            err = _wrap180(obs_v - bl_deg)
            nr = abs(err) / tol
            mv = 1.0 - nr
            if chronolocate_mode and moon_alt_app < 0.0:
                mv = min(mv, moon_alt_app / 2.0)
            add_check("moon_bright_limb_deg", classify_numeric(nr), obs_v, bl_deg,
                      err, tol, nr, mv)

    # 13. bodies_visible
    if "bodies_visible" in observed:
        lim = limiting_mag(
            sun_stage,
            moon_alt_true if (moon_d is not None and moon_alt_true > 0.0) else None,
            moon_illum if moon_d is not None else None,
            bortle,
        )
        b_margin = 0.25 * time_tol + place_tol + 0.5
        for bid in observed["bodies_visible"]:
            field = f"body_visible:{bid}"
            if bid == "sun":
                b_alt_app = sun_alt_app
                b_mag = -26.74
            elif bid == "moon":
                b_alt_app = moon_alt_app
                b_mag = moon_d["mag"]
            else:
                bd = snap["bodies"][bid]
                _, b_alt_true = _az_alt_from_eq(bd["ra"], bd["dec"], lst, lat)
                b_alt_app = refract_true_to_apparent(b_alt_true, pressure)
                b_mag = bd["mag"]

            if b_alt_app < -(b_margin + 2.0):
                nr = 2.0 + abs(b_alt_app) / 5.0
                mv = b_alt_app / 2.0
                add_check(field, "impossible", True, False, b_alt_app, b_margin,
                          nr, mv, f"{bid} is {abs(b_alt_app):.1f} deg below horizon")
            elif bid in ("sun", "moon"):
                if b_alt_app > 0.0:
                    add_check(field, "consistent", True, True, 0.0, b_margin,
                              0.0, min(1.0, b_alt_app / 1.0))
                else:
                    d = -b_alt_app
                    nr = d / b_margin
                    st = "consistent" if nr <= 1.0 else "marginal"
                    add_check(field, st, True, False, -d, b_margin, nr, 1.0 - nr)
            else:
                alt_m_v = min(1.0, b_alt_app / 1.0)
                if b_alt_app <= 0.0:
                    d = -b_alt_app
                    nr = d / b_margin
                    st = "consistent" if nr <= 1.0 else "marginal"
                    add_check(field, st, True, False, -d, b_margin, nr,
                              min(1.0 - nr, alt_m_v))
                elif b_mag is None or b_mag <= lim:
                    mag_m_v = 1.0 if b_mag is None else min(1.0, (lim - b_mag) / 1.5)
                    add_check(field, "consistent", True, True,
                              0.0 if b_mag is None else b_mag - lim, 1.5, 0.0,
                              min(alt_m_v, mag_m_v))
                elif b_mag <= lim + 1.5:
                    excess = b_mag - lim
                    nr = 1.0 + excess / 3.0
                    add_check(field, "marginal", True, False, excess, 1.5, nr,
                              -excess / 1.5,
                              f"{bid} (mag {b_mag:.1f}) is faint against limit {lim:.1f}")
                elif b_mag > lim + 4.0:
                    excess = b_mag - lim
                    nr = max(3.0, excess / 1.5)
                    add_check(field, "impossible", True, False, excess, 1.5, nr,
                              -excess / 1.5,
                              f"{bid} (mag {b_mag:.1f}) cannot be seen naked-eye against limit {lim:.1f}")
                else:
                    excess = b_mag - lim
                    nr = excess / 1.5
                    add_check(field, "inconsistent", True, False, excess, 1.5, nr,
                              -excess / 1.5,
                              f"{bid} (mag {b_mag:.1f}) is fainter than sky limit {lim:.1f}")

    # 14. shadow_sweep
    if "shadow_sweep" in observed:
        sw = observed["shadow_sweep"]
        obs_delta = sw["delta_bearing_deg"]
        tol_base = sw.get(
            "tolerance_deg",
            tol_map.get("shadow_sweep_deg", DEFAULT_TOLERANCES["shadow_sweep_deg"]),
        )
        tol = tol_base + sweep_time_spread + place_tol * 0.5
        if not shadow["cast"]:
            nr = 3.0 + abs(sun_alt_app) / 5.0
            mv = -1.0 + min(0.0, sun_alt_app) / 5.0
            add_check("shadow_sweep", "impossible", obs_delta, None, None, tol,
                      nr, mv, "no shadow cast at claimed instant")
        elif sun_alt_app > _ZENITH_INDET_DEG:
            add_check("shadow_sweep", "indeterminate", obs_delta, None, None,
                      tol, None, 0.0, "Sun near zenith; shadow sweep ill-conditioned")
        else:
            prev_az = sun_az
            total_delta = 0.0
            min_alt_app = sun_alt_app
            near_zenith = False
            slope_n = _slope_normal(slope_deg, slope_azimuth_deg) if slope_deg > 0.0 else None
            self_shadowed_during = False
            min_n_dot_s = 1.0
            for g_i, ra_i, dec_i in snap["sweep_steps"]:
                lst_i = (g_i + lon_east * DEG) % TWO_PI
                az_i, alt_t_i = _az_alt_from_eq(ra_i, dec_i, lst_i, lat)
                alt_app_i = refract_true_to_apparent(alt_t_i, pressure)
                if alt_app_i < min_alt_app:
                    min_alt_app = alt_app_i
                if alt_app_i > _ZENITH_INDET_DEG:
                    near_zenith = True
                if slope_n is not None and alt_app_i > 0.0:
                    nds = _dot(slope_n, dir_from_az_alt(az_i, alt_app_i))
                    if nds < min_n_dot_s:
                        min_n_dot_s = nds
                    if nds <= 0.0:
                        self_shadowed_during = True
                total_delta += _wrap180(az_i - prev_az)
                prev_az = az_i
            if min_alt_app <= -0.5:
                nr = 3.0 + abs(min_alt_app) / 5.0
                add_check("shadow_sweep", "impossible", obs_delta, total_delta,
                          obs_delta - total_delta, tol, nr, -1.0 + min_alt_app / 5.0,
                          "Sun sets during shadow_sweep window")
            elif self_shadowed_during:
                nr = 3.0 + abs(min_n_dot_s) / 0.1
                add_check("shadow_sweep", "impossible", obs_delta, total_delta,
                          obs_delta - total_delta, tol, nr, -1.0 + min_n_dot_s / 0.1,
                          "terrain is self-shadowed during shadow_sweep window")
            elif near_zenith:
                add_check("shadow_sweep", "indeterminate", obs_delta, total_delta,
                          None, tol, None, 0.0,
                          "Sun passes near zenith during sweep window")
            else:
                err = obs_delta - total_delta
                nr = abs(err) / tol
                if (total_delta * obs_delta < 0.0
                        and abs(err) > max(2.0 * tol, 10.0)):
                    st = "impossible"
                    note = "shadow swept opposite to physical solar rotation (reversed video or wrong hemisphere)"
                else:
                    st = classify_numeric(nr)
                    note = None
                add_check("shadow_sweep", st, obs_delta, total_delta, err, tol,
                          nr, 1.0 - nr, note)

    if not active_res:
        return checks, "unconstrained", None, 0.0, -1.0

    max_nr = max(active_res)
    rms_sq = sum(r * r for r in active_res) / len(active_res)
    score = math.exp(-0.35 * rms_sq - 0.15 * max_nr * max_nr)
    if any_impossible:
        verdict = "impossible"
        score = min(score, 0.25)
    elif any_inconsistent:
        verdict = "inconsistent"
    elif any_marginal:
        verdict = "marginal"
    else:
        verdict = "consistent"

    return checks, verdict, score, max_nr, min(margins)


# ------------------------------------------------ verify_observation & diag

def _golden_max(f, a, b, iters=20):
    c = b - (b - a) * _INV_PHI
    d = a + (b - a) * _INV_PHI
    fc = f(c)
    fd = f(d)
    for _ in range(iters):
        if fc > fd:
            b, d, fd = d, c, fc
            c = b - (b - a) * _INV_PHI
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + (b - a) * _INV_PHI
            fd = f(d)
    mid = 0.5 * (a + b)
    return mid, f(mid)


def _run_diagnostics(engine, jd_ut, lat, lon_east, claim, observed, checks,
                     base_score):
    """Counterfactual diagnostics when verdict is inconsistent or impossible:
    same-day clock/timezone shift, N/S hemisphere sign flip, seasonal date shift."""
    elev = float(claim.get("elevation_m") or 0.0)
    slope = float(claim.get("slope_deg") or 0.0)
    slope_az = float(claim.get("slope_azimuth_deg") or 0.0)
    time_tol = float(claim.get("time_tolerance_min") or 0.0)
    place_tol = float(claim.get("place_tolerance_deg") or 0.0)
    bortle = claim.get("bortle")
    need_moon, extra_bodies = _observed_needs(observed)
    sweep_dt = observed["shadow_sweep"]["dt_minutes"] if "shadow_sweep" in observed else None

    def eval_at(t, la, lo, snap=None):
        s = snap if snap is not None else _snapshot_at(
            engine, t, need_moon=need_moon, extra_bodies=extra_bodies,
            sweep_dt_min=sweep_dt,
        )
        _, v, sc, _, _ = _eval_snap_at_place(
            s, la, lo, observed, elevation_m=elev, slope_deg=slope,
            slope_azimuth_deg=slope_az, time_tol=time_tol, place_tol=place_tol,
            bortle=bortle,
        )
        return sc if sc is not None else 0.0, v

    # 1. Time shift: sweep [-14h, +14h] every 10 minutes via day cache, then refine.
    t_lo = jd_ut - 14.0 / 24.0
    t_hi = jd_ut + 14.0 / 24.0
    cache_fn = _build_day_cache(engine, t_lo, t_hi, need_moon=need_moon,
                                extra_bodies=extra_bodies)
    step = 10.0 * _DT_MIN
    samples = []
    t = t_lo
    while t <= t_hi + 1e-9:
        sc, _ = eval_at(t, lat, lon_east, snap=cache_fn(t, sweep_dt_min=sweep_dt))
        samples.append((t, sc))
        t += step

    # Pick top 3 local peaks to refine with exact ephemeris.
    peaks = []
    for i, (ti, si) in enumerate(samples):
        left = samples[i - 1][1] if i > 0 else -1.0
        right = samples[i + 1][1] if i + 1 < len(samples) else -1.0
        if si >= left and si >= right:
            peaks.append((si, ti))
    peaks.sort(reverse=True)
    if not peaks:
        peaks = [(samples[0][1], samples[0][0])]

    best_ts_jd = jd_ut
    best_ts_score = -1.0
    for _, tp in peaks[:3]:
        a = max(t_lo, tp - step)
        b = min(t_hi, tp + step)
        cand_t, _ = _golden_max(
            lambda x: eval_at(x, lat, lon_east, snap=cache_fn(x, sweep_dt_min=sweep_dt))[0],
            a, b, iters=16,
        )
        sc_exact, _ = eval_at(cand_t, lat, lon_east)
        if sc_exact > best_ts_score:
            best_ts_score = sc_exact
            best_ts_jd = cand_t

    # Final exact refinement around winner.
    best_ts_jd, _ = _golden_max(
        lambda x: eval_at(x, lat, lon_east)[0],
        max(t_lo, best_ts_jd - 2.0 * _DT_MIN),
        min(t_hi, best_ts_jd + 2.0 * _DT_MIN),
        iters=10,
    )
    best_ts_score, best_ts_verdict = eval_at(best_ts_jd, lat, lon_east)
    offset_min = (best_ts_jd - jd_ut) * 1440.0
    nearest_hr = _js_round(offset_min / 60.0)
    time_shift = {
        "jd_ut": best_ts_jd,
        "offset_minutes": offset_min,
        "nearest_whole_hour_offset": nearest_hr,
        "fit_score": best_ts_score,
        "verdict": best_ts_verdict,
    }

    # 2. Hemisphere flip: (-lat, lon_east) at jd_ut.
    snap_now = _snapshot_at(engine, jd_ut, need_moon=need_moon,
                            extra_bodies=extra_bodies, sweep_dt_min=sweep_dt)
    hf_score, hf_verdict = eval_at(jd_ut, -lat, lon_east, snap=snap_now)
    hemisphere_flip = {
        "lat": -lat,
        "lon_east": lon_east,
        "fit_score": hf_score,
        "verdict": hf_verdict,
    }

    # 3. Seasonal date shift: sweep year at same UTC time-of-day if solar geometry failed.
    solar_failed = any(
        c["field"] in (
            "sun_altitude_deg", "shadow_length_ratio", "sun_azimuth_deg",
            "shadow_bearing_deg", "twilight", "sun_visible",
        )
        and c["status"] in ("inconsistent", "impossible")
        for c in checks
    )
    date_shift = None
    if solar_failed:
        coarse = []
        for d in range(-180, 181, 10):
            if d == 0:
                continue
            sc_d, _ = eval_at(jd_ut + d, lat, lon_east)
            coarse.append((sc_d, d))
        coarse.sort(reverse=True)
        radius = 15 if need_moon else 10
        best_d = coarse[0][1]
        best_ds_score = -1.0
        best_ds_verdict = "inconsistent"
        tested = set()
        for _, d_center in coarse[:2]:
            for d in range(max(-182, d_center - radius), min(183, d_center + radius + 1)):
                if d == 0 or d in tested:
                    continue
                tested.add(d)
                sc_d, vd = eval_at(jd_ut + d, lat, lon_east)
                if sc_d > best_ds_score:
                    best_ds_score = sc_d
                    best_ds_verdict = vd
                    best_d = d
        date_shift = {
            "jd_ut": jd_ut + best_d,
            "offset_days": best_d,
            "fit_score": best_ds_score,
            "verdict": best_ds_verdict,
        }

    # 4. Crisp one-line summary choosing best explanatory single-axis hypothesis.
    candidates = []
    if abs(lat) >= 2.0:
        candidates.append(("hemisphere_flip", hf_score, hf_verdict))
    candidates.append(("time_shift", best_ts_score, best_ts_verdict))
    if date_shift is not None:
        candidates.append(("date_shift", date_shift["fit_score"], date_shift["verdict"]))

    # Sort by (verdict quality, fit_score).
    rank_v = {"consistent": 3, "marginal": 2, "inconsistent": 1, "impossible": 0}
    candidates.sort(key=lambda x: (rank_v.get(x[2], 0), x[1]), reverse=True)
    top_kind, top_score, top_verdict = candidates[0]
    base_s = base_score if base_score is not None else 0.0

    if top_verdict in ("consistent", "marginal") or (
        top_score >= 0.65 and top_score > base_s + 0.25
    ):
        if top_kind == "hemisphere_flip":
            summary = (
                f"Likely hemisphere sign flip: lat {-lat:+.2f} fits at "
                f"score {hf_score:.2f} ({hf_verdict})."
            )
        elif top_kind == "time_shift":
            rem60 = abs(offset_min) % 60.0
            if abs(rem60 - 30.0) <= 8.0:
                summary = (
                    f"Likely half-hour clock/timezone offset of {offset_min:+.0f} min "
                    f"({offset_min / 60.0:+.1f}h), fit {best_ts_score:.2f} ({best_ts_verdict})."
                )
            elif abs(offset_min - nearest_hr * 60.0) <= 12.0 and nearest_hr != 0:
                summary = (
                    f"Likely clock/timezone offset of {offset_min:+.0f} min "
                    f"(nearest {nearest_hr:+d}h), fit {best_ts_score:.2f} ({best_ts_verdict})."
                )
            else:
                summary = (
                    f"Likely time shift of {offset_min:+.0f} min, "
                    f"fit {best_ts_score:.2f} ({best_ts_verdict})."
                )
        else:
            summary = (
                f"Likely seasonal/date shift of {date_shift['offset_days']:+d} days, "
                f"fit {date_shift['fit_score']:.2f} ({date_shift['verdict']})."
            )
    else:
        summary = (
            "No single-axis time, hemisphere, or seasonal shift resolves all "
            "observation conflicts."
        )

    return {
        "time_shift": time_shift,
        "hemisphere_flip": hemisphere_flip,
        "date_shift": date_shift,
        "summary": summary,
    }


def verify_observation(engine, claim, observed=None):
    """Verify physical observations against a claimed (jd_ut, lat, lon_east).

    When `observed` is omitted or empty, acts as a pure ground-truth physical
    scene/chronosense oracle (`verdict="unconstrained"`).
    """
    if not isinstance(claim, dict):
        raise ValueError("claim must be a dict")
    for req in ("jd_ut", "lat", "lon_east"):
        if req not in claim:
            raise ValueError(f"claim missing required key {req!r}")
    jd_ut = float(claim["jd_ut"])
    lat = float(claim["lat"])
    lon_east = float(claim["lon_east"])
    elev = float(claim.get("elevation_m") or 0.0)
    slope = float(claim.get("slope_deg") or 0.0)
    slope_az = float(claim.get("slope_azimuth_deg") or 0.0)
    time_tol = float(claim.get("time_tolerance_min") or 0.0)
    place_tol = float(claim.get("place_tolerance_deg") or 0.0)
    bortle = claim.get("bortle")
    if time_tol < 0.0:
        raise ValueError(f"time_tolerance_min must be >= 0, got {time_tol!r}")
    if place_tol < 0.0:
        raise ValueError(f"place_tolerance_deg must be >= 0, got {place_tol!r}")

    obs = _validate_observed(observed)

    scene = scene_geometry(
        engine, jd_ut, lat, lon_east,
        elevation_m=elev,
        slope_deg=slope,
        slope_azimuth_deg=slope_az,
        bortle=bortle,
        camera_aim_az_deg=claim.get("camera_aim_az_deg"),
        camera_aim_alt_deg=float(claim.get("camera_aim_alt_deg") or 0.0),
        prev_jd_ut=claim.get("prev_jd_ut"),
        deadline_jd_ut=claim.get("deadline_jd_ut"),
    )

    if not _has_active_constraints(obs):
        return {
            "verdict": "unconstrained",
            "consistency_score": None,
            "checks": [],
            "scene": scene,
            "diagnostics": None,
        }

    need_moon, extra_bodies = _observed_needs(obs)
    sweep_dt = obs["shadow_sweep"]["dt_minutes"] if "shadow_sweep" in obs else None
    snap = _snapshot_at(
        engine, jd_ut, need_moon=need_moon, extra_bodies=extra_bodies,
        sweep_dt_min=sweep_dt,
    )

    # Exact Moon / bright-limb rates when time_tol > 0.
    moon_rates = None
    bl_rate = None
    if time_tol > 0.0 and need_moon:
        mp_m = engine.position("moon", jd_ut - _DT_MIN)
        mp_p = engine.position("moon", jd_ut + _DT_MIN)
        maz_m, malt_m = az_alt(mp_m["lon"], mp_m["lat"], jd_ut - _DT_MIN, lat, lon_east)
        maz_p, malt_p = az_alt(mp_p["lon"], mp_p["lat"], jd_ut + _DT_MIN, lat, lon_east)
        moon_rates = ((malt_p - malt_m) * 0.5, _wrap180(maz_p - maz_m) * 0.5)
        if "moon_bright_limb_deg" in obs:
            sp_m = engine.position("sun", jd_ut - _DT_MIN)
            sp_p = engine.position("sun", jd_ut + _DT_MIN)
            saz_m, salt_m = az_alt(sp_m["lon"], sp_m["lat"], jd_ut - _DT_MIN, lat, lon_east)
            saz_p, salt_p = az_alt(sp_p["lon"], sp_p["lat"], jd_ut + _DT_MIN, lat, lon_east)
            bl_m, _ = _moon_bright_limb(maz_m, malt_m, saz_m, salt_m)
            bl_p, _ = _moon_bright_limb(maz_p, malt_p, saz_p, salt_p)
            if bl_m is not None and bl_p is not None:
                bl_rate = _wrap180(bl_p - bl_m) * 0.5

    sweep_spread = 0.0
    if time_tol > 0.0 and sweep_dt is not None:
        # Estimate sweep-angle spread across +/-time_tol.
        def _sweep_at(t_start):
            sp0 = engine.position("sun", t_start)
            az0, _ = az_alt(sp0["lon"], sp0["lat"], t_start, lat, lon_east)
            n_ch = max(1, int(math.ceil(sweep_dt / 30.0)))
            tot = 0.0
            prev = az0
            for i in range(1, n_ch + 1):
                ti = t_start + sweep_dt * (i / n_ch) * _DT_MIN
                spi = engine.position("sun", ti)
                azi, _ = az_alt(spi["lon"], spi["lat"], ti, lat, lon_east)
                tot += _wrap180(azi - prev)
                prev = azi
            return tot
        s0 = _sweep_at(jd_ut)
        sm = _sweep_at(jd_ut - time_tol * _DT_MIN)
        sp_v = _sweep_at(jd_ut + time_tol * _DT_MIN)
        sweep_spread = max(abs(sm - s0), abs(sp_v - s0))

    sun_rates = (scene["sun"]["rate_alt_deg_per_min"], scene["sun"]["rate_az_deg_per_min"])
    checks, verdict, score, _, _ = _eval_snap_at_place(
        snap, lat, lon_east, obs,
        elevation_m=elev, slope_deg=slope, slope_azimuth_deg=slope_az,
        time_tol=time_tol, place_tol=place_tol, bortle=bortle,
        sun_rates=sun_rates, moon_rates=moon_rates, bl_rate=bl_rate,
        sweep_time_spread=sweep_spread,
    )

    diagnostics = None
    if verdict in ("inconsistent", "impossible"):
        diagnostics = _run_diagnostics(
            engine, jd_ut, lat, lon_east, claim, obs, checks, score)

    return {
        "verdict": verdict,
        "consistency_score": score,
        "checks": checks,
        "scene": scene,
        "diagnostics": diagnostics,
    }


# --------------------------------------------------------------- chronolocate

def _can_prune_day(engine, dm, lat, observed, slope_deg):
    """Fast sound day-level pruning using exact solar/lunar declination and
    lunar phase bounds at midday `dm` with generous daily drift margins."""
    tol_map = observed.get("tolerances") or {}
    jde = jd_tt(dm)
    eps = true_obliquity(jde)
    sp = engine.position("sun", dm)
    _, s_dec_r = equatorial(sp["lon"] * DEG, sp["lat"] * DEG, eps)
    s_dec = s_dec_r / DEG

    h_max = min(90.0, 90.0 - abs(lat - s_dec) + 1.5)
    h_min = max(-90.0, -90.0 + abs(lat + s_dec) - 1.5)

    # Solar altitude / shadow / twilight pruning.
    if "sun_altitude_deg" in observed:
        tol = tol_map.get("sun_altitude_deg", DEFAULT_TOLERANCES["sun_altitude_deg"])
        obs_h = observed["sun_altitude_deg"]
        if obs_h + tol < h_min or obs_h - tol > h_max:
            return True

    if "sun_visible" in observed:
        if observed["sun_visible"] and h_max < -0.5:
            return True
        if (not observed["sun_visible"]) and h_min > 0.5:
            return True

    if "twilight" in observed:
        lo_b, hi_b = TWILIGHT_BANDS[observed["twilight"]]
        if h_max < lo_b - 0.5 or h_min > hi_b + 0.5:
            return True

    if "shadow_bearing_deg" in observed or "shadow_sweep" in observed:
        if h_max <= 0.0:
            return True

    if "shadow_length_ratio" in observed:
        if h_max <= 0.0:
            return True
        if slope_deg == 0.0:
            obs_l = observed["shadow_length_ratio"]
            rel = tol_map.get("shadow_length_ratio_rel",
                              DEFAULT_TOLERANCES["shadow_length_ratio_rel"])
            abs_f = tol_map.get("shadow_length_ratio_abs",
                                DEFAULT_TOLERANCES["shadow_length_ratio_abs"])
            h_hi = min(89.99, h_max)
            l_min = math.cos(h_hi * DEG) / math.sin(h_hi * DEG)
            tol_at_min = tol_map.get("shadow_length_ratio", rel * l_min + abs_f)
            if obs_l + tol_at_min + 0.05 < l_min:
                return True
            if h_min > 0.5:
                l_max = math.cos(h_min * DEG) / math.sin(h_min * DEG)
                tol_at_max = tol_map.get("shadow_length_ratio", rel * l_max + abs_f)
                if obs_l - tol_at_max - 0.05 > l_max:
                    return True

    # Lunar phase / altitude pruning.
    need_moon = any(
        k in observed for k in (
            "moon_illum", "moon_waxing", "moon_altitude_deg",
            "moon_visible", "moon_azimuth_deg", "moon_bright_limb_deg",
        )
    )
    if need_moon:
        mp = engine.position("moon", dm)
        mph = pheno(engine, "moon", dm)
        m_illum = mph["phase"]
        if "moon_illum" in observed:
            tol_i = tol_map.get("moon_illum", DEFAULT_TOLERANCES["moon_illum"])
            if abs(observed["moon_illum"] - m_illum) > tol_i + 0.08:
                return True
        if "moon_waxing" in observed:
            e_deg = _wrap180(mp["lon"] - sp["lon"])
            if observed["moon_waxing"] and (-170.0 < e_deg < -10.0):
                return True
            if (not observed["moon_waxing"]) and (10.0 < e_deg < 170.0):
                return True
        if any(k in observed for k in (
            "moon_altitude_deg", "moon_visible", "moon_azimuth_deg",
            "moon_bright_limb_deg",
        )):
            _, m_dec_r = equatorial(mp["lon"] * DEG, mp["lat"] * DEG, eps)
            m_dec = m_dec_r / DEG
            mh_max = min(90.0, 90.0 - abs(lat - m_dec) + 6.0)
            mh_min = max(-90.0, -90.0 + abs(lat + m_dec) - 6.0)
            if "moon_altitude_deg" in observed:
                tol_mh = tol_map.get("moon_altitude_deg", DEFAULT_TOLERANCES["moon_altitude_deg"])
                obs_mh = observed["moon_altitude_deg"]
                if obs_mh + tol_mh < mh_min or obs_mh - tol_mh > mh_max:
                    return True
            if observed.get("moon_visible") is True and mh_max < -1.0:
                return True
            if observed.get("moon_visible") is False and mh_min > 1.0:
                return True
            if ("moon_azimuth_deg" in observed or "moon_bright_limb_deg" in observed) and mh_max < -3.0:
                return True

    return False


def chronolocate(
    engine,
    place,
    observed,
    jd_start,
    jd_end,
    *,
    step_minutes=10.0,
    max_windows=64,
):
    """Find every time window in [jd_start, jd_end] at `place` where all
    observations in `observed` hold simultaneously."""
    if not isinstance(place, dict) or "lat" not in place or "lon_east" not in place:
        raise ValueError("place must be a dict with 'lat' and 'lon_east'")
    lat = float(place["lat"])
    lon_east = float(place["lon_east"])
    elev = float(place.get("elevation_m") or 0.0)
    slope = float(place.get("slope_deg") or 0.0)
    slope_az = float(place.get("slope_azimuth_deg") or 0.0)
    bortle = place.get("bortle")
    _validate_place(lat, lon_east, elev, slope, slope_az)

    jd_start = float(jd_start)
    jd_end = float(jd_end)
    if not (math.isfinite(jd_start) and math.isfinite(jd_end) and jd_end > jd_start):
        raise ValueError("chronolocate requires finite jd_end > jd_start")
    step_minutes = float(step_minutes)
    if not (math.isfinite(step_minutes) and step_minutes > 0.0):
        raise ValueError("step_minutes must be > 0")
    if max_windows < 1:
        raise ValueError("max_windows must be >= 1")

    obs = _validate_observed(observed)
    if not _has_active_constraints(obs):
        raise ValueError("chronolocate requires at least one observation constraint")

    need_moon, extra_bodies = _observed_needs(obs)
    sweep_dt = obs["shadow_sweep"]["dt_minutes"] if "shadow_sweep" in obs else None

    # Partition [jd_start, jd_end] into 1-day chunks and prune impossible days.
    days_scanned = 0
    days_pruned = 0
    surviving_spans = []
    cur = jd_start
    while cur < jd_end - 1e-12:
        nxt = min(jd_end, cur + 1.0)
        dm = 0.5 * (cur + nxt)
        if _can_prune_day(engine, dm, lat, obs, slope):
            days_pruned += 1
        else:
            days_scanned += 1
            if surviving_spans and abs(surviving_spans[-1][1] - cur) < 1e-9:
                surviving_spans[-1] = (surviving_spans[-1][0], nxt)
            else:
                surviving_spans.append((cur, nxt))
        cur = nxt

    def exact_eval(t):
        s = _snapshot_at(
            engine, t, need_moon=need_moon, extra_bodies=extra_bodies,
            sweep_dt_min=sweep_dt,
        )
        return _eval_snap_at_place(
            s, lat, lon_east, obs,
            elevation_m=elev, slope_deg=slope, slope_azimuth_deg=slope_az,
            bortle=bortle, chronolocate_mode=True,
        )

    def bisect_edge(lo, hi, rising):
        """Bisect exact margin M(t) = 0 to <0.01 s (22 iterations on 10 min)."""
        for _ in range(22):
            mid = 0.5 * (lo + hi)
            _, _, _, _, m_mid = exact_eval(mid)
            if (m_mid >= 0.0) == rising:
                hi = mid
            else:
                lo = mid
        return 0.5 * (lo + hi)

    dt = step_minutes * _DT_MIN
    windows = []
    truncated = False

    for span_a, span_b in surviving_spans:
        if len(windows) > max_windows:
            truncated = True
            break

        # Build per-day caches across [span_a, span_b] so coarse scan is pure trig.
        ts = []
        ms = []
        scs = []
        c_start = span_a
        while c_start < span_b - 1e-12:
            c_end = min(span_b, c_start + 1.0)
            cache_fn = _build_day_cache(
                engine, c_start, c_end, need_moon=need_moon,
                extra_bodies=extra_bodies,
            )
            t = c_start
            while t < c_end - 1e-12:
                snap = cache_fn(t, sweep_dt_min=sweep_dt)
                _, _, sc, _, mv = _eval_snap_at_place(
                    snap, lat, lon_east, obs,
                    elevation_m=elev, slope_deg=slope, slope_azimuth_deg=slope_az,
                    bortle=bortle, chronolocate_mode=True,
                )
                ts.append(t)
                ms.append(mv)
                scs.append(sc if sc is not None else 0.0)
                t += dt
            c_start = c_end

        # Always include right endpoint span_b.
        _, _, sc_end, _, mv_end = exact_eval(span_b)
        ts.append(span_b)
        ms.append(mv_end)
        scs.append(sc_end if sc_end is not None else 0.0)

        # Narrow-peak rescue: if an interior sample is a near-miss local max
        # (-1.0 < m_i < 0), golden-section check [t_{i-1}, t_{i+1}] for a
        # sub-step feasible window.
        rescued = []
        for i in range(1, len(ts) - 1):
            if -1.0 < ms[i] < 0.0 and ms[i] >= ms[i - 1] and ms[i] >= ms[i + 1]:
                tp, mp = _golden_max(lambda x: exact_eval(x)[4], ts[i - 1], ts[i + 1], iters=12)
                if mp >= 0.0:
                    _, _, scp, _, _ = exact_eval(tp)
                    rescued.append((tp, mp, scp if scp is not None else 0.0))
        if rescued:
            combined = list(zip(ts, ms, scs)) + rescued
            combined.sort(key=lambda r: r[0])
            ts = [r[0] for r in combined]
            ms = [r[1] for r in combined]
            scs = [r[2] for r in combined]

        # Extract contiguous feasible runs (m >= 0).
        i = 0
        n_pts = len(ts)
        while i < n_pts:
            if ms[i] < 0.0:
                i += 1
                continue
            j = i
            while j + 1 < n_pts and ms[j + 1] >= 0.0:
                j += 1

            w_start = span_a if i == 0 else bisect_edge(ts[i - 1], ts[i], rising=True)
            w_end = span_b if j == n_pts - 1 else bisect_edge(ts[j], ts[j + 1], rising=False)

            # Find best sample in [i, j] and golden-section refine best_jd.
            best_idx = i
            for k in range(i + 1, j + 1):
                if (scs[k], ms[k]) > (scs[best_idx], ms[best_idx]):
                    best_idx = k

            # If score is flat (e.g. pure boolean/twilight window), use midpoint.
            if all(scs[k] >= 0.999999 for k in range(i, j + 1)):
                best_jd = 0.5 * (w_start + w_end)
            else:
                ra = w_start if best_idx == i else max(w_start, ts[best_idx - 1])
                rb = w_end if best_idx == j else min(w_end, ts[best_idx + 1])
                best_jd, _ = _golden_max(
                    lambda x: (exact_eval(x)[2] or 0.0) + 1e-6 * exact_eval(x)[4],
                    ra, rb, iters=20,
                )

            _, _, best_score, best_max_nr, best_m = exact_eval(best_jd)
            # Confirm window genuinely feasible at exact peak.
            if best_m >= -1e-6 and w_end >= w_start:
                windows.append({
                    "jd_start": w_start,
                    "jd_end": w_end,
                    "best_jd": best_jd,
                    "duration_minutes": (w_end - w_start) * 1440.0,
                    "fit_score": best_score if best_score is not None else 0.0,
                    "max_normalized_residual": best_max_nr,
                })
                if len(windows) > max_windows:
                    truncated = True
                    break
            i = j + 1

    if len(windows) > max_windows:
        windows = windows[:max_windows]
        truncated = True

    return {
        "place": {
            "lat": lat,
            "lon_east": lon_east,
            "elevation_m": elev,
            "slope_deg": slope,
            "slope_azimuth_deg": slope_az % 360.0 if slope > 0.0 else 0.0,
        },
        "jd_start": jd_start,
        "jd_end": jd_end,
        "days_scanned": days_scanned,
        "days_pruned": days_pruned,
        "windows": windows,
        "truncated": truncated,
    }


# ----------------------------------------------------------------- geolocate

def _lon_in_bounds(lon, lon_min, lon_max, full_globe):
    if full_globe:
        return True
    if lon_min <= lon_max:
        return lon_min - 1e-9 <= lon <= lon_max + 1e-9
    # Wrap-around longitude box (e.g. lon_min=170, lon_max=-170).
    return lon >= lon_min - 1e-9 or lon <= lon_max + 1e-9


def _clamp_lon_to_bounds(lon, lon_min, lon_max, full_globe):
    lon = _wrap180(lon)
    if full_globe or _lon_in_bounds(lon, lon_min, lon_max, False):
        return lon
    d_lo = abs(_wrap180(lon - lon_min))
    d_hi = abs(_wrap180(lon - lon_max))
    return lon_min if d_lo <= d_hi else lon_max


def _classify_region(radius_km, major_km, minor_km):
    if radius_km <= 250.0:
        return "point"
    if major_km / max(1.0, minor_km) >= 2.5:
        return "arc"
    return "band"


def _pattern_refine(eval_obj, lat0, lon0, init_step, lat_min, lat_max,
                    lon_min, lon_max, full_globe, min_step=0.002):
    """Derivative-free 2D pattern search on the sphere handling +/-180 wrap."""
    lat, lon = lat0, _wrap180(lon0)
    best_val = eval_obj(lat, lon)
    step = init_step
    dirs = (
        (1, 0), (-1, 0), (0, 1), (0, -1),
        (0.70710678, 0.70710678), (0.70710678, -0.70710678),
        (-0.70710678, 0.70710678), (-0.70710678, -0.70710678),
    )
    while step >= min_step:
        improved = False
        for _ in range(4):
            cos_lat = max(0.15, math.cos(lat * DEG))
            cand_best = None
            for dy, dx in dirs:
                nlat = max(lat_min, min(lat_max, lat + dy * step))
                nlon = _clamp_lon_to_bounds(
                    lon + (dx * step) / cos_lat, lon_min, lon_max, full_globe)
                val = eval_obj(nlat, nlon)
                if val > best_val:
                    best_val = val
                    cand_best = (nlat, nlon)
            if cand_best is not None:
                lat, lon = cand_best
                improved = True
            else:
                break
        if not improved:
            step *= 0.5
        else:
            step *= 0.5
    return lat, lon, best_val


def _analytical_geolocate(snap, obs, pressure, lat_min, lat_max, lon_min,
                          lon_max, full_globe, elevation_m, bortle,
                          max_candidates):
    """Path A: Closed-form spherical navigation fix from solar direction +
    solar elevation, with 4-step damped Gauss-Newton refinement and Jacobian
    covariance uncertainty."""
    tol_map = obs.get("tolerances") or {}
    if "sun_azimuth_deg" in obs:
        az_obs = obs["sun_azimuth_deg"]
        sigma_az = tol_map.get("sun_azimuth_deg", DEFAULT_TOLERANCES["sun_azimuth_deg"])
    else:
        az_obs = (obs["shadow_bearing_deg"] + 180.0) % 360.0
        sigma_az = tol_map.get("shadow_bearing_deg", DEFAULT_TOLERANCES["shadow_bearing_deg"])

    if "sun_altitude_deg" in obs:
        h_app_obs = obs["sun_altitude_deg"]
        sigma_h = tol_map.get("sun_altitude_deg", DEFAULT_TOLERANCES["sun_altitude_deg"])
    else:
        l_obs = obs["shadow_length_ratio"]
        h_app_obs = math.atan2(1.0, l_obs) / DEG
        if "shadow_length_ratio" in tol_map:
            tol_l = tol_map["shadow_length_ratio"]
        else:
            rel = tol_map.get("shadow_length_ratio_rel",
                              DEFAULT_TOLERANCES["shadow_length_ratio_rel"])
            abs_f = tol_map.get("shadow_length_ratio_abs",
                                DEFAULT_TOLERANCES["shadow_length_ratio_abs"])
            tol_l = rel * l_obs + abs_f
        sigma_h = max(0.25, tol_l / ((1.0 + l_obs * l_obs) * DEG))

    # Near-zenith Sun: directly anchored to subsolar point.
    ra_s = snap["sun_ra"]
    dec_s = snap["sun_dec"]
    g = snap["gast"]
    subsolar_lat = dec_s / DEG
    subsolar_lon = _wrap180((ra_s - g) / DEG)

    if h_app_obs > _ZENITH_INDET_DEG:
        seeds = [(subsolar_lat, subsolar_lon)]
    else:
        h_true_r = refract_apparent_to_true(h_app_obs, pressure) * DEG
        az_r = az_obs * DEG
        a = math.sin(h_true_r)
        b = math.cos(h_true_r) * math.cos(az_r)
        c = math.sin(dec_s)
        R = math.hypot(a, b)
        if R < 1e-4:
            # Degenerate due-East/West horizon case: signal fallback to Path B.
            return None
        ratio = c / R
        if abs(ratio) > 1.05:
            # No exact root (e.g. noisy low-Sun due-E/W within tolerance): fall back to Path B.
            return None
        alpha = math.asin(_clamp1(ratio))
        gamma = math.atan2(b, a)
        raw_phis = [_wrap_pi(alpha - gamma), _wrap_pi((math.pi - alpha) - gamma)]
        seeds = []
        for phi in raw_phis:
            if abs(phi) >= math.pi * 0.5 - 1e-6:
                continue
            lat_c = phi / DEG
            if any(abs(lat_c - s[0]) < 1e-5 for s in seeds):
                continue
            ha = math.atan2(
                -math.cos(h_true_r) * math.sin(az_r),
                math.cos(phi) * math.sin(h_true_r) - math.sin(phi) * math.cos(h_true_r) * math.cos(az_r),
            )
            lon_c = _wrap180((ha + ra_s - g) / DEG)
            seeds.append((lat_c, lon_c))
        if not seeds:
            return None

    def sun_az_alt_app(la, lo):
        lst = (g + lo * DEG) % TWO_PI
        az, alt_t = _az_alt_from_eq(ra_s, dec_s, lst, la)
        return az, refract_true_to_apparent(alt_t, pressure)

    candidates = []
    eps_j = 1e-4
    for lat0, lon0 in seeds:
        la, lo = lat0, lon0
        # 4-step damped Gauss-Newton against exact refracted az_alt (skipped at zenith).
        if h_app_obs <= _ZENITH_INDET_DEG:
            for _ in range(4):
                az_c, h_c = sun_az_alt_app(la, lo)
                r0 = _wrap180(az_c - az_obs)
                r1 = h_c - h_app_obs
                if abs(r0) < 1e-8 and abs(r1) < 1e-8:
                    break
                az_lp, h_lp = sun_az_alt_app(min(89.99, la + eps_j), lo)
                az_lm, h_lm = sun_az_alt_app(max(-89.99, la - eps_j), lo)
                az_op, h_op = sun_az_alt_app(la, _wrap180(lo + eps_j))
                az_om, h_om = sun_az_alt_app(la, _wrap180(lo - eps_j))
                j00 = _wrap180(az_lp - az_lm) / (2.0 * eps_j)
                j01 = _wrap180(az_op - az_om) / (2.0 * eps_j)
                j10 = (h_lp - h_lm) / (2.0 * eps_j)
                j11 = (h_op - h_om) / (2.0 * eps_j)
                # Normal equations (J^T J + mu I) d = -J^T r
                a00 = j00 * j00 + j10 * j10 + 1e-6
                a01 = j00 * j01 + j10 * j11
                a11 = j01 * j01 + j11 * j11 + 1e-6
                b0 = -(j00 * r0 + j10 * r1)
                b1 = -(j01 * r0 + j11 * r1)
                det = a00 * a11 - a01 * a01
                if abs(det) < 1e-18:
                    break
                d_la = max(-10.0, min(10.0, (a11 * b0 - a01 * b1) / det))
                d_lo = max(-20.0, min(20.0, (-a01 * b0 + a00 * b1) / det))
                la = max(-89.99, min(89.99, la + d_la))
                lo = _wrap180(lo + d_lo)
                if math.hypot(d_la, d_lo) < 1e-8:
                    break

        if not (lat_min - 1e-6 <= la <= lat_max + 1e-6
                and _lon_in_bounds(lo, lon_min, lon_max, full_globe)):
            continue

        _, verdict, score, max_nr, margin_v = _eval_snap_at_place(
            snap, la, lo, obs, elevation_m=elevation_m, bortle=bortle,
        )

        # If extra constraints barely missed due to slight solar noise, allow a
        # small local joint refinement around the analytical root.
        if margin_v < 0.0 and max_nr <= 2.2:
            def _joint_obj(xla, xlo):
                _, _, xsc, _, xm = _eval_snap_at_place(
                    snap, xla, xlo, obs, elevation_m=elevation_m, bortle=bortle,
                )
                return (xm if xm < 0.0 else 1.0 + (xsc or 0.0))
            la_r, lo_r, _ = _pattern_refine(
                _joint_obj, la, lo, 1.5, lat_min, lat_max, lon_min, lon_max,
                full_globe, min_step=0.005,
            )
            _, v_r, sc_r, nr_r, m_r = _eval_snap_at_place(
                snap, la_r, lo_r, obs, elevation_m=elevation_m, bortle=bortle,
            )
            if m_r > margin_v:
                la, lo, verdict, score, max_nr, margin_v = la_r, lo_r, v_r, sc_r, nr_r, m_r

        if margin_v < 0.0 or verdict not in ("consistent",):
            continue

        # Jacobian covariance uncertainty ellipse in tangent km & lat/lon deg.
        if h_app_obs > _ZENITH_INDET_DEG:
            d_lat = min(90.0, sigma_h)
            d_lon = min(180.0, sigma_h / max(0.1, math.cos(la * DEG)))
            radius_km = sigma_h * DEG * EARTH_RADIUS_KM
            major_km = minor_km = radius_km
        else:
            az_lp, h_lp = sun_az_alt_app(min(89.99, la + eps_j), lo)
            az_lm, h_lm = sun_az_alt_app(max(-89.99, la - eps_j), lo)
            az_op, h_op = sun_az_alt_app(la, _wrap180(lo + eps_j))
            az_om, h_om = sun_az_alt_app(la, _wrap180(lo - eps_j))
            j00 = _wrap180(az_lp - az_lm) / (2.0 * eps_j)
            j01 = _wrap180(az_op - az_om) / (2.0 * eps_j)
            j10 = (h_lp - h_lm) / (2.0 * eps_j)
            j11 = (h_op - h_om) / (2.0 * eps_j)
            det = j00 * j11 - j01 * j10
            if abs(det) < 1e-8:
                d_lat = min(45.0, sigma_h * 2.0)
                d_lon = min(90.0, sigma_az * 2.0)
                radius_km = max(d_lat, d_lon * math.cos(la * DEG)) * DEG * EARTH_RADIUS_KM
                major_km, minor_km = radius_km, sigma_h * DEG * EARTH_RADIUS_KM
            else:
                inv00 = j11 / det
                inv01 = -j01 / det
                inv10 = -j10 / det
                inv11 = j00 / det
                sa2 = sigma_az * sigma_az
                sh2 = sigma_h * sigma_h
                cov_ll = inv00 * inv00 * sa2 + inv01 * inv01 * sh2
                cov_oo = inv10 * inv10 * sa2 + inv11 * inv11 * sh2
                cov_lo = inv00 * inv10 * sa2 + inv01 * inv11 * sh2
                d_lat = min(90.0, math.sqrt(max(0.0, cov_ll)))
                d_lon = min(180.0, math.sqrt(max(0.0, cov_oo)))
                # Convert covariance to local tangent km^2.
                ky = DEG * EARTH_RADIUS_KM
                kx = max(0.05, math.cos(la * DEG)) * DEG * EARTH_RADIUS_KM
                cyy = cov_ll * ky * ky
                cxx = cov_oo * kx * kx
                cxy = cov_lo * kx * ky
                tr = cxx + cyy
                disc = math.sqrt(max(0.0, (cxx - cyy) ** 2 + 4.0 * cxy * cxy))
                lam1 = 0.5 * (tr + disc)
                lam2 = max(0.0, 0.5 * (tr - disc))
                major_km = math.sqrt(lam1)
                minor_km = math.sqrt(lam2)
                radius_km = major_km

        lat_rng = [max(-90.0, la - d_lat), min(90.0, la + d_lat)]
        if d_lon >= 179.0:
            lon_rng = [-180.0, 180.0]
        else:
            lon_rng = [_wrap180(lo - d_lon), _wrap180(lo + d_lon)]

        candidates.append({
            "lat": la,
            "lon": lo,
            "fit_score": score if score is not None else 0.0,
            "max_normalized_residual": max_nr,
            "radius_km": radius_km,
            "lat_range": lat_rng,
            "lon_range": lon_rng,
            "region_kind": _classify_region(radius_km, major_km, minor_km),
        })

    candidates.sort(key=lambda c: (-c["fit_score"], c["max_normalized_residual"], c["lat"], c["lon"]))
    return candidates[:max_candidates]


def _grid_geolocate(snap, obs, lat_min, lat_max, lon_min, lon_max, full_globe,
                    grid_step_deg, max_candidates, elevation_m, slope_deg,
                    slope_azimuth_deg, bortle):
    """Path B: Precomputed pure-trig global spherical grid + antimeridian-safe
    8-connected clustering + local pattern refinement + region classification."""
    # Build latitude axis.
    lats = []
    v = lat_min
    while v < lat_max - 1e-9:
        lats.append(v)
        v += grid_step_deg
    lats.append(lat_max)
    n_lat = len(lats)

    # Build longitude axis (wrap across +/-180 when full globe).
    if full_globe:
        n_lon = max(4, _js_round(360.0 / grid_step_deg))
        lon_step = 360.0 / n_lon
        lons = [_wrap180(-180.0 + j * lon_step) for j in range(n_lon)]
        wrap_lon = True
    else:
        lons = []
        span_lon = (lon_max - lon_min) if lon_min <= lon_max else (360.0 - lon_min + lon_max)
        n_steps = max(1, int(math.floor(span_lon / grid_step_deg)))
        for j in range(n_steps + 1):
            lons.append(_wrap180(lon_min + min(span_lon, j * grid_step_deg)))
        if abs(_wrap180(lons[-1] - lon_max)) > 1e-6:
            lons.append(_wrap180(lon_max))
        n_lon = len(lons)
        wrap_lon = False

    def eval_pt(la, lo):
        _, verdict, sc, max_nr, mv = _eval_snap_at_place(
            snap, la, lo, obs,
            elevation_m=elevation_m, slope_deg=slope_deg,
            slope_azimuth_deg=slope_azimuth_deg, bortle=bortle,
        )
        return verdict, (sc if sc is not None else 0.0), max_nr, mv

    # Sweep grid in pure trig.
    margins = [[0.0] * n_lon for _ in range(n_lat)]
    scores = [[0.0] * n_lon for _ in range(n_lat)]
    feasible = [[False] * n_lon for _ in range(n_lat)]

    for i, la in enumerate(lats):
        for j, lo in enumerate(lons):
            v, sc, _, mv = eval_pt(la, lo)
            margins[i][j] = mv
            scores[i][j] = sc
            feasible[i][j] = (mv >= 0.0 and v == "consistent")

    # 8-connected BFS clustering with antimeridian wrap.
    visited = [[False] * n_lon for _ in range(n_lat)]
    clusters = []
    for i in range(n_lat):
        for j in range(n_lon):
            if not feasible[i][j] or visited[i][j]:
                continue
            comp = []
            stack = [(i, j)]
            visited[i][j] = True
            while stack:
                ci, cj = stack.pop()
                comp.append((ci, cj))
                for di in (-1, 0, 1):
                    ni = ci + di
                    if ni < 0 or ni >= n_lat:
                        continue
                    for dj in (-1, 0, 1):
                        if di == 0 and dj == 0:
                            continue
                        if wrap_lon:
                            nj = (cj + dj) % n_lon
                        else:
                            nj = cj + dj
                            if nj < 0 or nj >= n_lon:
                                continue
                        if feasible[ni][nj] and not visited[ni][nj]:
                            visited[ni][nj] = True
                            stack.append((ni, nj))
            clusters.append(comp)

    # Also locate isolated near-miss local maxima (for narrow fixes falling
    # between grid nodes, e.g. tight double-altitude intersections).
    rescue_seeds = []
    for i in range(n_lat):
        for j in range(n_lon):
            if feasible[i][j] or margins[i][j] < -1.2:
                continue
            m_ij = margins[i][j]
            is_local_max = True
            touches_feasible = False
            for di in (-1, 0, 1):
                ni = i + di
                if ni < 0 or ni >= n_lat:
                    continue
                for dj in (-1, 0, 1):
                    if di == 0 and dj == 0:
                        continue
                    if wrap_lon:
                        nj = (j + dj) % n_lon
                    else:
                        nj = j + dj
                        if nj < 0 or nj >= n_lon:
                            continue
                    if feasible[ni][nj]:
                        touches_feasible = True
                        break
                    if margins[ni][nj] > m_ij:
                        is_local_max = False
                if touches_feasible:
                    break
            if is_local_max and not touches_feasible:
                rescue_seeds.append((m_ij, i, j))
    rescue_seeds.sort(reverse=True)

    def _refine_obj(la, lo):
        v, sc, _, mv = eval_pt(la, lo)
        if mv < 0.0 or v != "consistent":
            return mv - 1.0
        return sc + 1e-5 * mv

    def _probe_extent(peak_la, peak_lo, cell_pts):
        """Measure cluster extent (radius_km, lat_range, lon_range, region_kind)
        from cluster cells plus 8-ray boundary probes around the refined peak."""
        pts = [(peak_la, peak_lo)] + list(cell_pts)

        # Probe 8 compass rays when cluster is small so narrow/single-cell fixes
        # get accurate sub-grid radii.
        if len(cell_pts) <= 9:
            cos_p = max(0.15, math.cos(peak_la * DEG))
            probe_dirs = (
                (1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0),
                (0.70710678, 0.70710678), (0.70710678, -0.70710678),
                (-0.70710678, 0.70710678), (-0.70710678, -0.70710678),
            )
            for dy, dx in probe_dirs:
                lo_d = 0.0
                hi_d = grid_step_deg * 2.0
                # Expand hi_d if still feasible at 2*step.
                tla = max(lat_min, min(lat_max, peak_la + dy * hi_d))
                tlo = _clamp_lon_to_bounds(
                    peak_lo + (dx * hi_d) / cos_p, lon_min, lon_max, full_globe)
                if eval_pt(tla, tlo)[3] >= 0.0:
                    pts.append((tla, tlo))
                else:
                    for _ in range(10):
                        mid = 0.5 * (lo_d + hi_d)
                        mla = max(lat_min, min(lat_max, peak_la + dy * mid))
                        mlo = _clamp_lon_to_bounds(
                            peak_lo + (dx * mid) / cos_p, lon_min, lon_max, full_globe)
                        if eval_pt(mla, mlo)[3] >= 0.0:
                            lo_d = mid
                        else:
                            hi_d = mid
                    if lo_d > 0.0:
                        fla = max(lat_min, min(lat_max, peak_la + dy * lo_d))
                        flo = _clamp_lon_to_bounds(
                            peak_lo + (dx * lo_d) / cos_p, lon_min, lon_max, full_globe)
                        pts.append((fla, flo))

        lat_lo = min(p[0] for p in pts)
        lat_hi = max(p[0] for p in pts)
        # Exact minimum circular bounding arc on S^1 for longitude range.
        u_lons = sorted(p[1] % 360.0 for p in pts)
        if len(u_lons) == 1 or (u_lons[-1] - u_lons[0]) < 1e-9:
            lon_rng = [_wrap180(u_lons[0]), _wrap180(u_lons[0])]
        else:
            best_gap = -1.0
            best_k = 0
            n_u = len(u_lons)
            for k in range(n_u):
                gap = (u_lons[(k + 1) % n_u] - u_lons[k]) % 360.0
                if gap > best_gap:
                    best_gap = gap
                    best_k = k
            if best_gap <= max(grid_step_deg * 1.5, 5.0):
                lon_rng = [-180.0, 180.0]
            else:
                lon_rng = [
                    _wrap180(u_lons[(best_k + 1) % n_u]),
                    _wrap180(u_lons[best_k]),
                ]
        dlons = [_wrap180(p[1] - peak_lo) for p in pts]

        radius_km = max(_haversine_km(peak_la, peak_lo, p[0], p[1]) for p in pts)

        # 2D tangent-plane PCA for elongation (arc vs band).
        cos_p = max(0.15, math.cos(peak_la * DEG))
        dxs = [dl * cos_p * DEG * EARTH_RADIUS_KM for dl in dlons]
        dys = [(p[0] - peak_la) * DEG * EARTH_RADIUS_KM for p in pts]
        mx = sum(dxs) / len(dxs)
        my = sum(dys) / len(dys)
        sxx = sum((x - mx) ** 2 for x in dxs) / len(dxs)
        syy = sum((y - my) ** 2 for y in dys) / len(dys)
        sxy = sum((x - mx) * (y - my) for x, y in zip(dxs, dys)) / len(dxs)
        tr = sxx + syy
        disc = math.sqrt(max(0.0, (sxx - syy) ** 2 + 4.0 * sxy * sxy))
        major = math.sqrt(max(0.0, 0.5 * (tr + disc)))
        minor = math.sqrt(max(0.0, 0.5 * (tr - disc)))
        return radius_km, [lat_lo, lat_hi], lon_rng, _classify_region(radius_km, major, minor)

    raw_candidates = []
    for comp in clusters:
        best_cell = max(comp, key=lambda ij: (scores[ij[0]][ij[1]], margins[ij[0]][ij[1]]))
        la0, lo0 = lats[best_cell[0]], lons[best_cell[1]]
        la, lo, _ = _pattern_refine(
            _refine_obj, la0, lo0, grid_step_deg * 0.5,
            lat_min, lat_max, lon_min, lon_max, full_globe,
        )
        v, sc, max_nr, mv = eval_pt(la, lo)
        if mv < 0.0 or v != "consistent":
            la, lo = la0, lo0
            v, sc, max_nr, mv = eval_pt(la, lo)
        cell_pts = [(lats[ci], lons[cj]) for ci, cj in comp]
        rad, lat_r, lon_r, rkind = _probe_extent(la, lo, cell_pts)
        raw_candidates.append({
            "lat": la,
            "lon": lo,
            "fit_score": sc,
            "max_normalized_residual": max_nr,
            "radius_km": rad,
            "lat_range": lat_r,
            "lon_range": lon_r,
            "region_kind": rkind,
        })

    for _, ri, rj in rescue_seeds[:16]:
        la, lo, _ = _pattern_refine(
            _refine_obj, lats[ri], lons[rj], grid_step_deg * 0.5,
            lat_min, lat_max, lon_min, lon_max, full_globe,
        )
        v, sc, max_nr, mv = eval_pt(la, lo)
        if mv >= 0.0 and v == "consistent":
            rad, lat_r, lon_r, rkind = _probe_extent(la, lo, [])
            raw_candidates.append({
                "lat": la,
                "lon": lo,
                "fit_score": sc,
                "max_normalized_residual": max_nr,
                "radius_km": rad,
                "lat_range": lat_r,
                "lon_range": lon_r,
                "region_kind": rkind,
            })

    # Deduplicate candidates whose refined peaks coincide (keeping best score).
    raw_candidates.sort(
        key=lambda c: (-c["fit_score"], c["max_normalized_residual"], c["lat"], c["lon"])
    )
    deduped = []
    min_sep_km = max(150.0, grid_step_deg * 1.1 * DEG * EARTH_RADIUS_KM)
    for cand in raw_candidates:
        if any(
            _haversine_km(cand["lat"], cand["lon"], prev["lat"], prev["lon"]) < min_sep_km
            and cand["radius_km"] <= prev["radius_km"] + min_sep_km
            for prev in deduped
        ):
            continue
        deduped.append(cand)
        if len(deduped) >= max_candidates:
            break

    return deduped


def geolocate(
    engine,
    jd_ut,
    observed,
    *,
    lat_min=-70.0,
    lat_max=70.0,
    lon_min=-180.0,
    lon_max=180.0,
    grid_step_deg=4.0,
    max_candidates=12,
    elevation_m=0.0,
    slope_deg=0.0,
    slope_azimuth_deg=0.0,
    bortle=None,
):
    """Estimate Earth locations compatible with `observed` at fixed `jd_ut`.

    Uses Path A (closed-form spherical navigation + Gauss-Newton) on flat
    ground whenever both solar direction and solar elevation are observed, and
    Path B (precomputed pure-trig global spherical grid + antimeridian-safe
    clustering + local refinement) otherwise.
    """
    jd_ut = float(jd_ut)
    lat_min = float(lat_min)
    lat_max = float(lat_max)
    lon_min = float(lon_min)
    lon_max = float(lon_max)
    grid_step_deg = float(grid_step_deg)
    if not (math.isfinite(lat_min) and math.isfinite(lat_max)
            and -90.0 <= lat_min < lat_max <= 90.0):
        raise ValueError("geolocate requires -90 <= lat_min < lat_max <= 90")
    if not (math.isfinite(lon_min) and math.isfinite(lon_max)):
        raise ValueError("geolocate requires finite lon_min and lon_max")
    if not (math.isfinite(grid_step_deg) and grid_step_deg > 0.0):
        raise ValueError("grid_step_deg must be > 0")
    if max_candidates < 1:
        raise ValueError("max_candidates must be >= 1")
    _validate_place(0.0, 0.0, elevation_m, slope_deg, slope_azimuth_deg)

    obs = _validate_observed(observed)
    if not _has_active_constraints(obs):
        raise ValueError("geolocate requires at least one observation constraint")

    _, extra_bodies = _observed_needs(obs)
    sweep_dt = obs["shadow_sweep"]["dt_minutes"] if "shadow_sweep" in obs else None
    # Always precompute Moon so sublunar point is always returned.
    snap = _snapshot_at(
        engine, jd_ut, need_moon=True, extra_bodies=extra_bodies,
        sweep_dt_min=sweep_dt,
    )

    g = snap["gast"]
    subsolar = {
        "lat": snap["sun_dec"] / DEG,
        "lon": _wrap180((snap["sun_ra"] - g) / DEG),
    }
    sublunar = {
        "lat": snap["moon"]["dec"] / DEG,
        "lon": _wrap180((snap["moon"]["ra"] - g) / DEG),
    }

    full_globe = (lon_max - lon_min) >= 360.0 - 1e-9
    pressure = _pressure_at_elevation(elevation_m)

    has_sun_dir = ("sun_azimuth_deg" in obs) or ("shadow_bearing_deg" in obs)
    has_sun_alt = ("sun_altitude_deg" in obs) or ("shadow_length_ratio" in obs)

    method = "grid"
    candidates = None
    if slope_deg == 0.0 and has_sun_dir and has_sun_alt:
        cands = _analytical_geolocate(
            snap, obs, pressure, lat_min, lat_max, lon_min, lon_max,
            full_globe, elevation_m, bortle, max_candidates,
        )
        if cands is not None:
            method = "analytical"
            candidates = cands

    if candidates is None:
        method = "grid"
        candidates = _grid_geolocate(
            snap, obs, lat_min, lat_max, lon_min, lon_max, full_globe,
            grid_step_deg, max_candidates, elevation_m, slope_deg,
            slope_azimuth_deg, bortle,
        )

    return {
        "jd_ut": jd_ut,
        "method": method,
        "subsolar": subsolar,
        "sublunar": sublunar,
        "candidates": candidates,
    }
