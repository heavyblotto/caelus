"""astroengine.compiler -- synthesize a chart form from geometric constraints.

The forward direction of caelus is (time, place) -> chart. This is the inverse:
given a set of weighted geometric constraints (aspects between bodies, sign or
degree placements, and the latitude-aware kinds below), find the body
positions that best satisfy them, and report how well they can be satisfied.
If the best fit is still poor, the form is geometrically impossible -- a valid
result, not an error.

A body's state is (longitude, latitude). The original three constraint kinds
(aspect / sign / degree) speak only about longitude; three latitude-aware
kinds place bodies on the sphere the tradition already measures in:

  - {"kind": "declination", "body", "degree"}: the body's declination equals
    a value. Declination derives from (lon, lat) through the J2000 mean
    obliquity -- a compiled form has no instant, so the obliquity is a fixed
    stated convention, not an ephemeris quantity.
  - {"kind": "parallel", "a", "b", "contra"?}: two bodies share a declination
    (or hold equal-and-opposite ones when contra is true).
  - {"kind": "separation3d", "a", "b", "angle"}: the true great-circle
    separation between two bodies equals an angle (spherical.
    angular_separation_3d -- the 3D analogue of the aspect constraint).

Positions passed to the loss functions may be bare longitudes (floats,
latitude 0 -- the legacy shape, bit-for-bit compatible) or {"lon", "lat"}
dicts. The solver varies latitude only for bodies that a latitude-sensitive
constraint touches, inside per-body bounds (planets default to generous
real-envelope bounds, anything unknown to +/-9 deg; pass lat_bounds to widen,
e.g. for fixed stars) -- so a longitude-only form compiles to exactly the
same answer as before, latitudes all zero.

The loss and constraint evaluation are pure and reference-first (the TS port
reproduces them, pinned by the golden). The optimizer is a deterministic
coordinate descent with fixed low-discrepancy restarts; it is validated by
behaviour (a satisfiable form solves, an impossible one is flagged), not by a
cross-language golden.
"""
import math

PHI = 0.6180339887498949  # low-discrepancy restart spread

# A compiled form has no instant, so declination constraints resolve through a
# fixed, stated convention: the J2000 mean obliquity, degrees.
OBLIQUITY_J2000_DEG = 23.4392911

# Generous per-body latitude envelopes (deg) for the solver's search bounds:
# roughly the maximum geocentric ecliptic latitude each real body reaches.
# Bounds, not assertions -- anything not named gets DEFAULT_LAT_BOUND, and
# lat_bounds overrides per body (a fixed star may need the full +/-90).
DEFAULT_LAT_BOUND = 9.0
BODY_LAT_BOUNDS = {
    "sun": 0.001, "moon": 6.0, "mercury": 8.0, "venus": 9.0, "mars": 7.0,
    "jupiter": 2.0, "saturn": 3.0, "uranus": 1.0, "neptune": 2.0,
    "pluto": 18.0, "chiron": 8.0,
}


def _lon(p):
    return p["lon"] if isinstance(p, dict) else p


def _lat(p):
    return p.get("lat", 0.0) if isinstance(p, dict) else 0.0


def declination_of(lon_deg, lat_deg, obliquity_deg=OBLIQUITY_J2000_DEG):
    """Declination (deg) of an ecliptic (lon, lat) under a fixed obliquity."""
    lam = math.radians(lon_deg)
    beta = math.radians(lat_deg)
    eps = math.radians(obliquity_deg)
    s = (math.sin(beta) * math.cos(eps)
         + math.cos(beta) * math.sin(eps) * math.sin(lam))
    return math.degrees(math.asin(max(-1.0, min(1.0, s))))


def _ang_dist(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


def _sign_loss(lon, sign):
    lo = (sign % 12) * 30.0
    d = (lon - lo) % 360.0
    if d < 30.0:
        return 0.0
    return min(d - 30.0, 360.0 - d)  # distance to the nearer band edge


def constraint_loss(positions, c):
    """Degrees by which a single constraint is unmet given the positions.
    Position values are bare longitudes (floats; latitude 0) or
    {"lon", "lat"} dicts."""
    k = c["kind"]
    if k == "aspect":
        return abs(_ang_dist(_lon(positions[c["a"]]), _lon(positions[c["b"]]))
                   - c["angle"])
    if k == "sign":
        return _sign_loss(_lon(positions[c["body"]]), c["sign"])
    if k == "degree":
        return _ang_dist(_lon(positions[c["body"]]), c["degree"])
    if k == "declination":
        p = positions[c["body"]]
        return abs(declination_of(_lon(p), _lat(p)) - c["degree"])
    if k == "parallel":
        pa = positions[c["a"]]
        pb = positions[c["b"]]
        da = declination_of(_lon(pa), _lat(pa))
        db = declination_of(_lon(pb), _lat(pb))
        return abs(da + db) if c.get("contra") else abs(da - db)
    if k == "separation3d":
        from .spherical import angular_separation_3d
        pa = positions[c["a"]]
        pb = positions[c["b"]]
        sep = angular_separation_3d(_lon(pa), _lat(pa), _lon(pb), _lat(pb))
        return abs(sep - c["angle"])
    raise ValueError(k)


def form_loss(positions, constraints):
    """Total weighted constraint loss for a set of body positions."""
    return sum(c.get("weight", 1.0) * constraint_loss(positions, c)
               for c in constraints)


LAT_KINDS = {"declination", "parallel", "separation3d"}


def _bodies(constraints):
    s = set()
    for c in constraints:
        for key in ("a", "b", "body"):
            if c.get(key) is not None:
                s.add(c[key])
    return sorted(s)


def _lat_bodies(constraints):
    """Bodies a latitude-sensitive constraint touches: only these get a
    latitude sweep; everything else stays exactly on the ecliptic, so a
    longitude-only form compiles bit-for-bit as before."""
    s = set()
    for c in constraints:
        if c["kind"] in LAT_KINDS:
            for key in ("a", "b", "body"):
                if c.get(key) is not None:
                    s.add(c[key])
    return s


def _body_loss(positions, body, constraints):
    total = 0.0
    for c in constraints:
        if body in (c.get("a"), c.get("b"), c.get("body")):
            total += c.get("weight", 1.0) * constraint_loss(positions, c)
    return total


def compile_form(constraints, restarts=12, iters=8, impossible_deg=5.0,
                 lat_bounds=None):
    """Find body positions minimizing the weighted constraint loss. Returns
    {longitudes, latitudes, residual, max_constraint_loss, impossible,
    constraints}. Latitude varies only for bodies that a latitude-sensitive
    constraint touches, within per-body bounds (BODY_LAT_BOUNDS /
    DEFAULT_LAT_BOUND, overridable per body via lat_bounds={body: bound})."""
    bodies = _bodies(constraints)
    lat_set = _lat_bodies(constraints)
    bound_of = {}
    for b in bodies:
        override = (lat_bounds or {}).get(b)
        bound_of[b] = override if override is not None else (
            BODY_LAT_BOUNDS.get(b, DEFAULT_LAT_BOUND))
    n = max(len(bodies), 1)
    best = None
    for r in range(restarts):
        pos = {b: {"lon": (((r * n + i + 1) * PHI) % 1.0) * 360.0, "lat": 0.0}
               for i, b in enumerate(bodies)}
        for _ in range(iters):
            for b in bodies:
                # longitude sweep at the current latitude
                best_l = pos[b]["lon"]
                best_e = _body_loss(pos, b, constraints)
                for i in range(360):  # coarse 1-degree sweep
                    pos[b]["lon"] = float(i)
                    e = _body_loss(pos, b, constraints)
                    if e < best_e:
                        best_e = e
                        best_l = float(i)
                for k in range(-20, 21):  # refine +/-1 degree at 0.05
                    cand = (best_l + k * 0.05) % 360.0
                    pos[b]["lon"] = cand
                    e = _body_loss(pos, b, constraints)
                    if e < best_e:
                        best_e = e
                        best_l = cand
                pos[b]["lon"] = best_l
                if b not in lat_set:
                    continue
                # latitude sweep within the body's bounds, same shape:
                # coarse 0.5-degree grid, then refine +/-0.5 at 0.025.
                bound = bound_of[b]
                best_t = pos[b]["lat"]
                best_e = _body_loss(pos, b, constraints)
                steps = int(math.floor((2 * bound) / 0.5))
                for k in range(steps + 1):
                    cand = -bound + k * 0.5
                    pos[b]["lat"] = cand
                    e = _body_loss(pos, b, constraints)
                    if e < best_e:
                        best_e = e
                        best_t = cand
                for k in range(-20, 21):
                    cand = best_t + k * 0.025
                    if cand < -bound or cand > bound:
                        continue
                    pos[b]["lat"] = cand
                    e = _body_loss(pos, b, constraints)
                    if e < best_e:
                        best_e = e
                        best_t = cand
                pos[b]["lat"] = best_t
        e = form_loss(pos, constraints)
        if best is None or e < best[0]:
            best = (e, {b: dict(p) for b, p in pos.items()})
    residual, pos = best
    max_loss = max((constraint_loss(pos, c) for c in constraints), default=0.0)
    return {
        "longitudes": {b: p["lon"] for b, p in pos.items()},
        "latitudes": {b: p["lat"] for b, p in pos.items()},
        "residual": residual,
        "max_constraint_loss": max_loss,
        "impossible": max_loss > impossible_deg,
        "constraints": [{**{k: v for k, v in c.items() if k != "weight"},
                         "loss": constraint_loss(pos, c)} for c in constraints],
    }
