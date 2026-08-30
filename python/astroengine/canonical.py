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
from .ranges import (
    jd_year, delta_t_sigma,
    ANGLE_SIGMA_DEG_PER_SECOND, MOON_SIGMA_DEG_PER_SECOND,
    EPOCH_SIGMA_DISPLAY_SECONDS,
)

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


def _quantize_chart(chart, grid):
    """Quantized-but-underived state: every frontier leaf as an integer in
    grid units. The seam the remainder machinery composes through --
    compose_remainders rebuilds a finer-grid state and feeds it to the SAME
    derivation as canonical_chart. Mirrors quantizeChart in canonical.ts."""
    bodies = {}
    for body_id, p in chart["bodies"].items():
        if p is None:
            continue
        lat_speed = p.get("lat_speed")
        bodies[body_id] = {
            "lon": _q_angle(grid, p["lon"], body_id),
            "lat": _q_signed(grid, p["lat"], body_id),
            "speed": _q_signed(grid, p["speed"], body_id),
            "latSpeed": None if lat_speed is None else _q_signed(grid, lat_speed, body_id),
            "distMicroAu": None if p["dist"] is None else round_half_up(p["dist"] * 1e6),
            "ra": _q_angle(grid, p["ra"], body_id),
            "dec": _q_signed(grid, p["dec"], body_id),
        }
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
        "timeMs": canonical_time_ms(chart["jd_ut"]),
        "zodiac": chart["zodiac"],
        "houseSystem": chart["house_system"],
        "houseSystemRequested": chart["house_system_requested"],
        "unavailable": sorted(chart.get("unavailable", [])),
        "warnings": warnings,
        "bodies": bodies,
        "angles": {
            "asc": _q_angle(grid, chart["angles"]["asc"]),
            "mc": _q_angle(grid, chart["angles"]["mc"]),
            "vertex": _q_angle(grid, chart["angles"]["vertex"]),
            "eastPoint": _q_angle(grid, chart["angles"]["east_point"]),
        },
        "cusps": [_q_angle(grid, c) for c in chart["cusps"]],
    }


def _build_canonical(state, grid, orbs=None, aspects=None,
                     separation="longitude"):
    """Derive the full canonical payload from quantized state -- pure integer
    arithmetic, shared by canonical_chart and compose_remainders."""
    scale = UNITS_PER_DEG[grid]
    full = 360 * scale
    sign_span = 30 * scale
    cusps_q = state["cusps"]

    bodies = {}
    for body_id, q in state["bodies"].items():
        sign_idx = (q["lon"] // sign_span) % 12
        bodies[body_id] = {
            "lon": _render(grid, q["lon"]),
            "lat": _render(grid, q["lat"]),
            "speed": q["speed"],
            "latSpeed": q["latSpeed"],
            "distMicroAu": q["distMicroAu"],
            "ra": _render(grid, q["ra"]),
            "dec": _render(grid, q["dec"]),
            "sign": SIGNS[sign_idx],
            "signDeg": _render(grid, q["lon"] - sign_idx * sign_span),
            "house": _house_of_q(q["lon"], cusps_q, full),
            "retrograde": q["speed"] < 0,
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
            qa = state["bodies"][a]
            qb = state["bodies"][b]
            if spatial:
                sep = angular_separation_3d(qa["lon"] / scale, qa["lat"] / scale,
                                            qb["lon"] / scale, qb["lat"] / scale)
                sep_units = quantize_unit(sep, scale)
            else:
                e = (qa["lon"] - qb["lon"] + full // 2) % full - full // 2
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
                        e = (qa["lon"] - qb["lon"] + full // 2) % full - full // 2
                        d = ((1 if signed_orb >= 0 else -1) * (1 if e >= 0 else -1)
                             * (qa["speed"] - qb["speed"]))
                        phase = "applying" if d < 0 else "separating"
                    out_aspects.append({
                        "a": a, "b": b, "aspect": asp, "orb": orb_units,
                        "phase": phase,
                        "strengthPerMille": _strength_per_mille(orb_units, limit_units),
                    })

    # Mirror of canonical.ts: the epoch-certainty block appears only where
    # the clock-error uncertainty crosses the display threshold, so modern
    # charts carry no block and keep their digests.
    jd_ut = 2451545.0 + state["timeMs"] / 86_400_000
    sigma_seconds = round_half_up(delta_t_sigma(jd_year(jd_ut)))
    epoch_sigma = None
    if sigma_seconds >= EPOCH_SIGMA_DISPLAY_SECONDS:
        epoch_sigma = {
            "sigmaSeconds": sigma_seconds,
            "angleSigma": _render(grid, _q_signed(grid, sigma_seconds * ANGLE_SIGMA_DEG_PER_SECOND)),
            "moonLongitudeSigma": _render(grid, _q_signed(grid, sigma_seconds * MOON_SIGMA_DEG_PER_SECOND)),
        }

    out = {
        "format": "caelus-canonical",
        "version": 1,
        "grid": grid,
        "units": {
            "angle": UNIT_NAMES[grid], "speed": f"{UNIT_NAMES[grid]}/day",
            "time": "ms since J2000.0 (JD 2451545.0 UT)", "dist": "micro-AU",
            "strength": "per-mille",
        },
        "timeMs": state["timeMs"],
        "zodiac": state["zodiac"],
        "houseSystem": state["houseSystem"],
        "houseSystemRequested": state["houseSystemRequested"],
        "bodies": bodies,
        "unavailable": state["unavailable"],
        "angles": {
            "asc": _render(grid, state["angles"]["asc"]),
            "mc": _render(grid, state["angles"]["mc"]),
            "vertex": _render(grid, state["angles"]["vertex"]),
            "eastPoint": _render(grid, state["angles"]["eastPoint"]),
        },
        "cusps": [_render(grid, c) for c in cusps_q],
        "aspects": out_aspects,
        "warnings": state["warnings"],
    }
    if epoch_sigma is not None:
        out["epochSigma"] = epoch_sigma
    return out


def canonical_chart(chart, grid="arcsec", orbs=None, aspects=None,
                    separation="longitude"):
    """Project a chart dict (Engine.chart_at output) into canonical integer
    form. Mirrors canonicalChart in canonical.ts field for field."""
    return _build_canonical(_quantize_chart(chart, grid), grid, orbs=orbs,
                            aspects=aspects, separation=separation)


def chart_digest(chart, grid="arcsec", orbs=None, aspects=None,
                 separation="longitude"):
    """Content address of a chart at the grid's resolution."""
    return canonical_digest(canonical_chart(chart, grid=grid, orbs=orbs,
                                            aspects=aspects,
                                            separation=separation))


def canonical_times_ms(jds):
    """Quantize event instants (JD UT, None passes through) to integer ms."""
    return [None if jd is None else canonical_time_ms(jd) for jd in jds]


# ------------------------------------------------------------ remainder sets
#
# Residual coding on top of canonical mode: the payload is the base layer,
# the remainder set the optional enhancement layer holding what quantization
# discarded. "refine" residues are INTEGERS in sub-quanta of a finer grid
# (sidecar itself canonical; grids telescope: compose = the finer payload
# exactly); "bits" is the pre-quantization IEEE 754 double per leaf as
# big-endian hex (lossless, platform-local, engine-API-only). Time residues
# are always integer microseconds, distance residues integer nano-AU. The
# frontier is exactly the set of independently quantized scalars; derived
# integers carry no residue by construction, warnings are excluded. See
# canonical.ts for the full rationale.

import struct

# "accuracy" is coarser than plain "arcsec" (per-body snap); "dms" IS arcsec.
_FINENESS = {"centideg": 0, "accuracy": 1, "dms": 2, "arcsec": 2,
             "milliarcsec": 3}

_DEFAULT_REMAINDER = {"centideg": "arcsec", "accuracy": "arcsec",
                      "dms": "milliarcsec", "arcsec": "milliarcsec"}

_ANGLE_KEY_TO_CHART = {"asc": "asc", "mc": "mc", "vertex": "vertex",
                       "eastPoint": "east_point"}


def double_bits_hex(x):
    """IEEE 754 binary64 bit pattern, big-endian, 16 hex chars."""
    return struct.pack(">d", x).hex()


def double_from_bits_hex(h):
    """Inverse of double_bits_hex -- exact round-trip, -0.0 included."""
    return struct.unpack(">d", bytes.fromhex(h))[0]


def _frontier_leaves(payload):
    """(path, kind, body) triples for the quantization frontier, in payload
    order. kind is one of angle | signed | time | dist."""
    leaves = [("timeMs", "time", None)]
    for body_id, b in payload["bodies"].items():
        leaves.append((f"bodies.{body_id}.lon", "angle", body_id))
        leaves.append((f"bodies.{body_id}.lat", "signed", body_id))
        leaves.append((f"bodies.{body_id}.speed", "signed", body_id))
        if b["latSpeed"] is not None:
            leaves.append((f"bodies.{body_id}.latSpeed", "signed", body_id))
        if b["distMicroAu"] is not None:
            leaves.append((f"bodies.{body_id}.distMicroAu", "dist", body_id))
        leaves.append((f"bodies.{body_id}.ra", "angle", body_id))
        leaves.append((f"bodies.{body_id}.dec", "signed", body_id))
    for k in payload["angles"]:
        leaves.append((f"angles.{k}", "angle", None))
    for i in range(len(payload["cusps"])):
        leaves.append((f"cusps.{i}", "angle", None))
    return leaves


def _as_units(v):
    """Base-grid integer for a rendered leaf ("dms" triples recompose)."""
    if isinstance(v, list):
        return v[0] * 3600 + v[1] * 60 + v[2]
    return v


def _leaf_value(payload, path):
    node = payload
    for p in path.split("."):
        node = node[int(p)] if isinstance(node, list) else node[p]
    return _as_units(node)


def _leaf_float(chart, path):
    """The pre-quantization double behind a frontier leaf."""
    if path == "timeMs":
        return (chart["jd_ut"] - 2451545.0) * 86_400_000
    parts = path.split(".")
    if parts[0] == "bodies":
        p = chart["bodies"][parts[1]]
        return {"lon": p["lon"], "lat": p["lat"], "speed": p["speed"],
                "latSpeed": p.get("lat_speed"),
                "distMicroAu": p["dist"],  # AU
                "ra": p["ra"], "dec": p["dec"]}[parts[2]]
    if parts[0] == "angles":
        return chart["angles"][_ANGLE_KEY_TO_CHART[parts[1]]]
    if parts[0] == "cusps":
        return chart["cusps"][int(parts[1])]
    raise KeyError(f"_leaf_float: unknown path {path}")


def _mod_signed(d, full):
    """Signed shortest modular distance, centered on zero: [-full/2, full/2)."""
    return (d + full // 2) % full - full // 2


def canonical_chart_with_remainders(chart, grid="arcsec", remainder=None,
                                    orbs=None, aspects=None,
                                    separation="longitude"):
    """Canonical payload plus its remainder set; mirrors
    canonicalChartWithRemainders in canonical.ts. remainder is a finer grid
    name, "bits", or None for one step finer than the base."""
    payload = canonical_chart(chart, grid=grid, orbs=orbs, aspects=aspects,
                              separation=separation)
    for_digest = canonical_digest(payload)
    leaves = _frontier_leaves(payload)

    mode = remainder if remainder is not None else _DEFAULT_REMAINDER.get(grid)
    if mode is None:
        raise ValueError(
            f'canonical_chart_with_remainders: no integer grid is finer than '
            f'"{grid}"; pass remainder="bits" for exact doubles')

    if mode == "bits":
        values = {path: double_bits_hex(_leaf_float(chart, path))
                  for path, _kind, _body in leaves}
        return payload, {
            "format": "caelus-remainders", "version": 1, "mode": "bits",
            "for": for_digest, "grid": grid,
            "units": {
                "encoding": "IEEE 754 binary64, big-endian hex",
                "angle": "deg", "speed": "deg/day",
                "time": "ms since J2000.0 (JD 2451545.0 UT)", "dist": "AU",
            },
            "values": values,
        }

    if _FINENESS[mode] <= _FINENESS[grid]:
        raise ValueError(
            f'canonical_chart_with_remainders: remainder grid "{mode}" is '
            f'not finer than base grid "{grid}"')
    fine_scale = UNITS_PER_DEG[mode]
    ratio = fine_scale // UNITS_PER_DEG[grid]
    full_f = 360 * fine_scale
    values = {}
    for path, kind, _body in leaves:
        base = _leaf_value(payload, path)
        x = _leaf_float(chart, path)
        if kind == "time":
            values[path] = round_half_up(x * 1000) - 1000 * base  # microseconds
        elif kind == "dist":
            values[path] = round_half_up(x * 1e9) - 1000 * base  # nano-AU
        elif kind == "angle":
            values[path] = _mod_signed(_q_angle(mode, x) - ratio * base, full_f)
        else:
            values[path] = _q_signed(mode, x) - ratio * base
    return payload, {
        "format": "caelus-remainders", "version": 1, "mode": "refine",
        "for": for_digest, "grid": grid, "remainderGrid": mode,
        "units": {
            "angle": UNIT_NAMES[mode], "speed": f"{UNIT_NAMES[mode]}/day",
            "time": "microsecond", "dist": "nano-AU",
        },
        "values": values,
    }


def compose_remainders(payload, remainders, orbs=None, aspects=None,
                       separation="longitude"):
    """Rebuild the finer-grid canonical payload from a base payload and its
    refinement remainder set; mirrors composeRemainders in canonical.ts.
    The result equals canonical_chart(chart, grid=remainderGrid) field for
    field -- the telescoping property the canonical-golden pins."""
    if remainders.get("mode") != "refine":
        raise ValueError("compose_remainders: bits remainders reconstruct "
                         "doubles, not a finer grid; decode with "
                         "double_from_bits_hex")
    if remainders["grid"] != payload["grid"]:
        raise ValueError(
            f'compose_remainders: sidecar grid "{remainders["grid"]}" != '
            f'payload grid "{payload["grid"]}"')
    if remainders["for"] != canonical_digest(payload):
        raise ValueError("compose_remainders: sidecar binds to a different "
                         "payload (digest mismatch)")
    r_grid = remainders["remainderGrid"]
    fine_scale = UNITS_PER_DEG[r_grid]
    ratio = fine_scale // UNITS_PER_DEG[payload["grid"]]
    full_f = 360 * fine_scale
    vals = remainders["values"]

    leaves = _frontier_leaves(payload)
    for path, _kind, _body in leaves:
        if path not in vals:
            raise ValueError(f"compose_remainders: sidecar missing frontier leaf {path}")
    if len(vals) != len(leaves):
        raise ValueError("compose_remainders: sidecar has keys outside the "
                         "payload's frontier")

    def angle_f(path):
        return (ratio * _leaf_value(payload, path) + vals[path]) % full_f

    def signed_f(path):
        return ratio * _leaf_value(payload, path) + vals[path]

    bodies = {}
    for body_id, b in payload["bodies"].items():
        bodies[body_id] = {
            "lon": angle_f(f"bodies.{body_id}.lon"),
            "lat": signed_f(f"bodies.{body_id}.lat"),
            "speed": signed_f(f"bodies.{body_id}.speed"),
            "latSpeed": (None if b["latSpeed"] is None
                         else signed_f(f"bodies.{body_id}.latSpeed")),
            "distMicroAu": b["distMicroAu"],
            "ra": angle_f(f"bodies.{body_id}.ra"),
            "dec": signed_f(f"bodies.{body_id}.dec"),
        }
    state = {
        "timeMs": payload["timeMs"],
        "zodiac": payload["zodiac"],
        "houseSystem": payload["houseSystem"],
        "houseSystemRequested": payload["houseSystemRequested"],
        "unavailable": payload["unavailable"],
        "warnings": payload["warnings"],
        "bodies": bodies,
        "angles": {
            "asc": angle_f("angles.asc"), "mc": angle_f("angles.mc"),
            "vertex": angle_f("angles.vertex"),
            "eastPoint": angle_f("angles.eastPoint"),
        },
        "cusps": [angle_f(f"cusps.{i}") for i in range(len(payload["cusps"]))],
    }
    return _build_canonical(state, r_grid, orbs=orbs, aspects=aspects,
                            separation=separation)


def near_boundary(remainders, max_margin_per_mille=10):
    """Fragility report from a refinement remainder set: frontier leaves near
    a base-grid rounding boundary; mirrors nearBoundary in canonical.ts."""
    if remainders.get("mode") != "refine":
        raise ValueError("near_boundary: needs a refinement remainder set "
                         "(bits carry no grid geometry)")
    ratio = (UNITS_PER_DEG[remainders["remainderGrid"]]
             // UNITS_PER_DEG[remainders["grid"]])
    out = []
    for path, r in remainders["values"].items():
        if path == "timeMs" or path.endswith(".distMicroAu"):
            quantum = 1000
        else:
            body = path.split(".")[1] if path.startswith("bodies.") else None
            quantum = _quantum(remainders["grid"], body) * ratio
        margin_per_mille = (1000 * (quantum - 2 * abs(r))) // quantum
        if margin_per_mille <= max_margin_per_mille:
            side = 0 if r == 0 else (1 if r > 0 else -1)
            out.append({"path": path, "residue": r, "quantum": quantum,
                        "marginPerMille": margin_per_mille, "side": side})
    out.sort(key=lambda e: (e["marginPerMille"], e["path"]))
    return out
