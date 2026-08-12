"""Canonical mode -- integer, hashable, precision-honest output.

Mirror of packages/caelus/src/canonical.ts (read its header for the full
rationale). The engine is deterministic run-to-run; canonical mode adds what
floats cannot give: cross-platform bit-stability (libm transcendentals differ
in the last ulp between runtimes), stable serialization, and boundary
coherence. Every continuous quantity quantizes to an integer on a declared
grid under ONE rounding rule (round half toward +infinity, IEEE-guarded);
sign, sign-degree, house, dignities, retrograde, and the aspect list are
re-derived from the quantized values in integer arithmetic; the canonical
encoding rejects any non-integer number, so a digest proves full
quantization. The canonical-golden pins TS and Python digests EQUAL -- a
tolerance-free cross-language check.
"""
import hashlib
import math

from .chart import SIGNS, DEFAULT_ORBS, ASPECTS, NOT_ASPECTABLE
from .derived import dignities
from .spherical import angular_separation_3d

# ------------------------------------------------------------------ rounding

def round_half_up(x):
    """floor(x + 0.5) with the IEEE guard (ties toward +infinity), matching
    the TS roundHalfUp / the skyview _js_round bridge exactly."""
    r = math.floor(x + 0.5)
    if r - x > 0.5:
        return r - 1
    return int(r)


def quantize_unit(x, scale):
    """Quantize to integer units of 1/scale (scale 3600: degrees->arcsec)."""
    return round_half_up(x * scale)


# -------------------------------------------------------------------- grids

UNITS_PER_DEG = {"arcsec": 3600, "milliarcsec": 3_600_000, "centideg": 100,
                 "dms": 3600, "accuracy": 3600}

# Per-body accuracy quantum (arcsec) for the "accuracy" grid; mirrors
# accuracy.json's measured bounds rounded up (see canonical.ts).
ACCURACY_QUANTUM_ARCSEC = {
    "moon": 3, "uranus": 2, "neptune": 5, "pluto": 4, "chiron": 1,
    "true_node": 60, "mean_lilith": 2, "true_lilith": 180, "intp_apog": 3600,
    "cupido": 3, "hades": 3, "zeus": 3, "kronos": 3,
    "apollon": 3, "admetos": 3, "vulkanus": 3, "poseidon": 3,
}

UNIT_NAMES = {
    "arcsec": "arcsec", "milliarcsec": "milliarcsec", "centideg": "centidegree",
    "dms": "arcsec (rendered [deg,min,sec])",
    "accuracy": "arcsec (per-body accuracy quantum)",
}


def _quantum(grid, body):
    if grid != "accuracy" or body is None:
        return 1
    return ACCURACY_QUANTUM_ARCSEC.get(body, 1)


def _q_angle(grid, deg, body=None):
    scale = UNITS_PER_DEG[grid]
    quantum = _quantum(grid, body)
    q = round_half_up((deg * scale) / quantum) * quantum
    full = 360 * scale
    return q % full


def _q_signed(grid, value, body=None):
    scale = UNITS_PER_DEG[grid]
    quantum = _quantum(grid, body)
    return round_half_up((value * scale) / quantum) * quantum


def canonical_time_ms(jd_ut):
    """Integer milliseconds since J2000.0 (JD 2451545.0 UT)."""
    return round_half_up((jd_ut - 2451545.0) * 86_400_000)


def _dms_triple(arcsec_total):
    neg = arcsec_total < 0
    s = abs(arcsec_total)
    d, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    return [-d, -m, -s] if neg else [d, m, s]


def _render(grid, units_val):
    return _dms_triple(units_val) if grid == "dms" else units_val


# -------------------------------------------------------------- encode + hash

def canonical_encode(value):
    """Canonical JSON: sorted keys, no whitespace, only ints / strings /
    bools / None / lists / dicts. Raises on any non-integer number."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        raise ValueError(f"canonical_encode: non-integer number {value} (quantize first)")
    if isinstance(value, str):
        import json
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_encode(v) for v in value) + "]"
    if isinstance(value, dict):
        import json
        parts = []
        for k in sorted(value.keys()):
            if value[k] is not None or True:  # undefined has no Python analogue
                parts.append(json.dumps(k, ensure_ascii=False) + ":" + canonical_encode(value[k]))
        return "{" + ",".join(parts) + "}"
    raise ValueError(f"canonical_encode: unsupported type {type(value)}")


def canonical_digest(value):
    """sha256 hex over the canonical encoding."""
    return hashlib.sha256(canonical_encode(value).encode("utf-8")).hexdigest()


# ------------------------------------------------------------ canonical chart

def _house_of_q(lon_q, cusps_q, full):
    for i in range(12):
        span = (cusps_q[(i + 1) % 12] - cusps_q[i]) % full
        off = (lon_q - cusps_q[i]) % full
        if off < span:
            return i + 1
    return 12


def _strength_per_mille(orb_units, limit_units):
    return (2000 * (limit_units - orb_units) + limit_units) // (2 * limit_units)


def canonical_chart(chart, grid="arcsec", orbs=None, aspects=None,
                    separation="longitude"):
    """Project a chart dict (Engine.chart_at output) into canonical integer
    form. Mirrors canonicalChart in canonical.ts field for field."""
    scale = UNITS_PER_DEG[grid]
    full = 360 * scale
    sign_span = 30 * scale

    cusps_q = [_q_angle(grid, c) for c in chart["cusps"]]
    bodies = {}
    lon_q = {}
    lat_q = {}
    speed_q = {}

    for body_id, p in chart["bodies"].items():
        if p is None:
            continue
        lon_q[body_id] = _q_angle(grid, p["lon"], body_id)
        lat_q[body_id] = _q_signed(grid, p["lat"], body_id)
        speed_q[body_id] = _q_signed(grid, p["speed"], body_id)
        lat_speed = p.get("lat_speed")
        sign_idx = (lon_q[body_id] // sign_span) % 12
        bodies[body_id] = {
            "lon": _render(grid, lon_q[body_id]),
            "lat": _render(grid, lat_q[body_id]),
            "speed": speed_q[body_id],
            "latSpeed": None if lat_speed is None else _q_signed(grid, lat_speed, body_id),
            "distMicroAu": None if p["dist"] is None else round_half_up(p["dist"] * 1e6),
            "ra": _render(grid, _q_angle(grid, p["ra"], body_id)),
            "dec": _render(grid, _q_signed(grid, p["dec"], body_id)),
            "sign": SIGNS[sign_idx],
            "signDeg": _render(grid, lon_q[body_id] - sign_idx * sign_span),
            "house": _house_of_q(lon_q[body_id], cusps_q, full),
            "retrograde": speed_q[body_id] < 0,
            "dignities": dignities(body_id, sign_idx),
        }

    table = aspects if aspects is not None else ASPECTS
    if aspects is not None:
        orb_source = orbs or {}
    else:
        orb_source = {**DEFAULT_ORBS, **(orbs or {})}
    spatial = separation == "spatial"
    names = [b for b in bodies if b not in NOT_ASPECTABLE]
    out_aspects = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if spatial:
                sep = angular_separation_3d(lon_q[a] / scale, lat_q[a] / scale,
                                            lon_q[b] / scale, lat_q[b] / scale)
                sep_units = quantize_unit(sep, scale)
            else:
                e = (lon_q[a] - lon_q[b] + full // 2) % full - full // 2
                sep_units = abs(e)
            for asp, angle_deg in table.items():
                limit_deg = orb_source.get(asp)
                if limit_deg is None:
                    continue
                angle_units = round_half_up(angle_deg * scale)
                limit_units = round_half_up(limit_deg * scale)
                orb_units = abs(sep_units - angle_units)
                if orb_units <= limit_units:
                    signed_orb = sep_units - angle_units
                    if signed_orb == 0:
                        phase = "exact"
                    else:
                        e = (lon_q[a] - lon_q[b] + full // 2) % full - full // 2
                        d = ((1 if signed_orb >= 0 else -1) * (1 if e >= 0 else -1)
                             * (speed_q[a] - speed_q[b]))
                        phase = "applying" if d < 0 else "separating"
                    out_aspects.append({
                        "a": a, "b": b, "aspect": asp, "orb": orb_units,
                        "phase": phase,
                        "strengthPerMille": _strength_per_mille(orb_units, limit_units),
                    })

    warnings = []
    for w in chart.get("warnings", []):
        if w.get("kind") == "delta_t_uncertain":
            warnings.append({
                "kind": w["kind"], "text": w["text"],
                "sigmaSeconds": w["sigmaSeconds"],
                "angleSmearCentideg": round_half_up(w["angleSmearDeg"] * 100),
                "moonSmearCentiarcmin": round_half_up(w["moonSmearArcmin"] * 100),
            })
        else:
            warnings.append({"kind": w["kind"], "body": w.get("body"),
                             "validated": w.get("validated"), "text": w["text"]})

    return {
        "format": "caelus-canonical",
        "version": 1,
        "grid": grid,
        "units": {
            "angle": UNIT_NAMES[grid], "speed": f"{UNIT_NAMES[grid]}/day",
            "time": "ms since J2000.0 (JD 2451545.0 UT)", "dist": "micro-AU",
            "strength": "per-mille",
        },
        "timeMs": canonical_time_ms(chart["jd_ut"]),
        "zodiac": chart["zodiac"],
        "houseSystem": chart["house_system"],
        "houseSystemRequested": chart["house_system_requested"],
        "bodies": bodies,
        "unavailable": sorted(chart.get("unavailable", [])),
        "angles": {
            "asc": _render(grid, _q_angle(grid, chart["angles"]["asc"])),
            "mc": _render(grid, _q_angle(grid, chart["angles"]["mc"])),
            "vertex": _render(grid, _q_angle(grid, chart["angles"]["vertex"])),
            "eastPoint": _render(grid, _q_angle(grid, chart["angles"]["east_point"])),
        },
        "cusps": [_render(grid, c) for c in cusps_q],
        "aspects": out_aspects,
        "warnings": warnings,
    }


def chart_digest(chart, grid="arcsec", orbs=None, aspects=None,
                 separation="longitude"):
    """Content address of a chart at the grid's resolution."""
    return canonical_digest(canonical_chart(chart, grid=grid, orbs=orbs,
                                            aspects=aspects,
                                            separation=separation))


def canonical_times_ms(jds):
    """Quantize event instants (JD UT, None passes through) to integer ms."""
    return [None if jd is None else canonical_time_ms(jd) for jd in jds]
