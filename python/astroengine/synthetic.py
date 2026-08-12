"""Synthetic ephemeris -- imaginary bodies as deterministic functions of time.

Mirror of the TS module (packages/caelus/src/synthetic.ts), the reference the
skyview/synthetic golden pins. Three tiers, increasing in physics:

  - placement: a fixed longitude on a very distant sphere (parity with
    compile_form; direction fixed and parallax-free from any vantage).
  - periodic: a circular, coplanar orbit (e=0, i=0) whose radius follows
    Kepler's third law in the system's units (a = periodDays^(2/3)), so an
    inner body both moves faster and orbits tighter -- outer bodies show
    apparent retrograde near opposition, like the real sky. Heliocentric
    longitude is exactly phaseDeg + 360*(t - epoch)/periodDays.
  - kepler: constant Keplerian elements solved each instant (KeplerOrbit).

Determinism is non-negotiable: every function here is pure in (system, t).

Bodies are dicts mirroring the TS SyntheticBody union:
  {"id", "mode": "placement", "lonDeg"}
  {"id", "mode": "periodic", "periodDays", "phaseDeg", "epoch"?}
  {"id", "mode": "kepler", "a", "e", "i", "node", "peri", "M0",
   "periodDays", "epoch"?}
A system is {"id", "bodies": [...], "observer"?: str}.
"""
import math

from .core import DEG, KeplerOrbit

TWO_PI = 2 * math.pi


def validate_synthetic_system(sys):
    """Diagnose an authored system: duplicate ids, dangling observer,
    non-positive periods, out-of-range eccentricity. Mirrors TS
    validateSyntheticSystem, message for message."""
    problems = []
    seen = set()
    for b in sys["bodies"]:
        if b["id"] in seen:
            problems.append(f"duplicate body id '{b['id']}'")
        seen.add(b["id"])
        if b["mode"] == "periodic" and not b["periodDays"] > 0:
            problems.append(
                f"body '{b['id']}': periodDays must be > 0 (got {_num(b['periodDays'])})")
        if b["mode"] == "kepler":
            if not b["periodDays"] > 0:
                problems.append(
                    f"body '{b['id']}': periodDays must be > 0 (got {_num(b['periodDays'])})")
            if not b["a"] > 0:
                problems.append(f"body '{b['id']}': a must be > 0 (got {_num(b['a'])})")
            if not (b["e"] >= 0 and b["e"] < 1):
                problems.append(f"body '{b['id']}': e must be in [0, 1) (got {_num(b['e'])})")
    observer = sys.get("observer")
    if observer is not None and observer not in seen:
        problems.append(f"observer '{observer}' is not a body in the system")
    return {"impossible": len(problems) > 0, "problems": problems}


def _num(x):
    """Render a number the way JS template literals do (5 not 5.0)."""
    if isinstance(x, float) and x.is_integer():
        return int(x)
    return x


class _Placement:
    def __init__(self, lon_deg):
        R = 1e9
        lam = lon_deg * DEG
        self._v = (R * math.cos(lam), R * math.sin(lam), 0.0)

    def xyz(self, _t):
        return self._v


def body_source(body):
    """Heliocentric xyz source for one authored body (mirrors TS bodySource)."""
    if body["mode"] == "placement":
        return _Placement(body["lonDeg"])
    if body["mode"] == "periodic":
        period = body["periodDays"]
        els = {
            "a": (period * period) ** (1.0 / 3.0),
            "e": 0.0, "i": 0.0, "node": 0.0, "peri": 0.0,
            "M0": body["phaseDeg"] * DEG, "n": TWO_PI / period,
        }
        return KeplerOrbit(els, body.get("epoch", 0))
    els = {
        "a": body["a"], "e": body["e"], "i": body["i"] * DEG,
        "node": body["node"] * DEG, "peri": body["peri"] * DEG,
        "M0": body["M0"] * DEG, "n": TWO_PI / body["periodDays"],
    }
    return KeplerOrbit(els, body.get("epoch", 0))


def synthetic_sources(sys):
    return {b["id"]: body_source(b) for b in sys["bodies"]}


def _vec_to_pos(v):
    # sqrt of the dot product, not math.hypot, to match the TS side exactly
    # (JS Math.hypot is not correctly rounded; the golden pins bit-for-bit).
    r = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return {
        "lonDeg": (math.atan2(v[1], v[0]) / DEG) % 360,
        "latDeg": 0.0 if r == 0 else math.asin(v[2] / r) / DEG,
        "r": r,
    }


def synthetic_positions(sys, t_days):
    """Positions of every body at one instant (mirrors TS syntheticPositions).
    With an observer, other bodies are seen from it (vector difference); the
    observer itself is reported at its heliocentric place."""
    sources = synthetic_sources(sys)
    observer = sys.get("observer")
    obs = sources[observer].xyz(t_days) if observer in sources else None
    out = {}
    for b in sys["bodies"]:
        v = sources[b["id"]].xyz(t_days)
        if obs is not None and observer != b["id"]:
            out[b["id"]] = _vec_to_pos((v[0] - obs[0], v[1] - obs[1], v[2] - obs[2]))
        else:
            out[b["id"]] = _vec_to_pos(v)
    return out


def synthetic_ephemeris(sys):
    """BodyPositionSource over a system (mirrors TS syntheticEphemeris):
    exposes bodies(), longitude(id, t), position(id, t) with a central-
    difference speed (h = 0.05 days) and retrograde flag, plus the
    impossible/problems diagnosis."""
    diag = validate_synthetic_system(sys)
    sources = synthetic_sources(sys)
    ids = [b["id"] for b in sys["bodies"]]
    observer = sys.get("observer")

    def apparent(body_id, t):
        v = sources[body_id].xyz(t)
        if observer is not None and observer != body_id:
            o = sources[observer].xyz(t)
            return _vec_to_pos((v[0] - o[0], v[1] - o[1], v[2] - o[2]))
        return _vec_to_pos(v)

    def position(body_id, t):
        p = apparent(body_id, t)
        h = 0.05  # days; central difference, matching Engine.position
        l0 = apparent(body_id, t - h)["lonDeg"]
        l1 = apparent(body_id, t + h)["lonDeg"]
        speed = ((l1 - l0 + 540) % 360 - 180) / (2 * h)
        return {**p, "speed": speed, "retrograde": speed < 0}

    return {
        "impossible": diag["impossible"],
        "problems": diag["problems"],
        "bodies": lambda: list(ids),
        "longitude": lambda body_id, t: apparent(body_id, t)["lonDeg"],
        "position": position,
    }
