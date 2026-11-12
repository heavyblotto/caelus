"""astroengine.datesky -- sky dating: from a description of a sky to its dates.

The forward problem is a chart: an instant in, positions out. This module is
the inverse. Given constraints on where bodies stood ("Saturn in Libra,
Jupiter in Gemini, a waning Moon"), it returns every window inside a date
range in which all of them held at once. It is the computation behind dating
an undated horoscope.

Method: interval pruning from the slowest quantity to the fastest. The first
constraint is scanned across the whole range and yields the windows in which
it holds; each later constraint is scanned only inside the windows that
survive, so the work shrinks at every stage. A window's edges are the instants
the quantity crosses the edge of its arc, found by bisection.

A retrograde body can touch an arc briefly at a station, between two samples.
The scan therefore locates each turning point that could reach an edge and
adds it as a sample, which leaves every segment near an edge monotone, and a
monotone segment crosses an edge at most once.

when() in query.py answers the same kind of question for arbitrary predicates
by sampling every predicate at one step across the whole range. That is
general and is the right tool for years or decades; over millennia with the
Moon involved it is millions of evaluations per body. date_sky takes only
position constraints, and prunes.

Pure search over engine.longitude: no new astronomy and no new data. Results
inherit the engine's range, its delta-T model, and its zodiac handling.
Mirrors datesky.ts in the TypeScript engine.
"""

from .chart import SIGNS

_SIGN_INDEX = {name.lower(): i for i, name in enumerate(SIGNS)}

# Sampling step in days for each body: small enough that a body never makes
# two turning points inside one step and never moves 90 degrees in one step.
# The scan order follows these steps, largest first, so the slowest body is
# the one scanned across the whole range.
STEP_DAYS = {
    "pluto": 30.0, "neptune": 30.0, "uranus": 30.0,
    "saturn": 20.0, "chiron": 20.0, "mean_node": 20.0,
    "jupiter": 15.0,
    "mars": 5.0, "sun": 5.0,
    "venus": 3.0,
    "mercury": 2.0, "true_node": 2.0,
    "moon": 0.5,
}
DEFAULT_STEP_DAYS = 2.0

# Bodies whose longitude never turns back, so the turning-point pass is
# skipped for them.
MONOTONE = {"sun", "moon", "mean_node"}

# Half-width limit for an arc, degrees. An arc must leave room on the far side
# of the circle for the wrap of the signed distance.
MAX_HALF_WIDTH = 170.0

_BISECT_ITERS = 32
_GOLDEN_ITERS = 32
_INV_PHI = 0.6180339887498949


def _wrap180(x):
    """Signed angle in [-180, 180)."""
    return (x + 180.0) % 360.0 - 180.0


def _norm_constraint(c, index):
    """Normalize one constraint to (label, bodies, center, half, step,
    monotone). `bodies` is one name for a longitude, or (a, b) for the
    elongation a - b."""
    pad = float(c.get("pad", 0.0))
    if "elongation" in c:
        a, b = c["elongation"]
        bodies = (a, b)
        subject = f"{a}-{b}"
        step = min(STEP_DAYS.get(a, DEFAULT_STEP_DAYS),
                   STEP_DAYS.get(b, DEFAULT_STEP_DAYS))
        monotone = a == "moon" and b in MONOTONE
    elif "body" in c:
        bodies = c["body"]
        subject = bodies
        step = STEP_DAYS.get(bodies, DEFAULT_STEP_DAYS)
        monotone = bodies in MONOTONE
    else:
        raise ValueError(f"constraint {index}: needs 'body' or 'elongation'")

    if "sign" in c:
        if "elongation" in c:
            raise ValueError(f"constraint {index}: an elongation takes "
                             "'from'/'to' or 'lon'/'orb', not 'sign'")
        sign = c["sign"]
        if isinstance(sign, int) and not isinstance(sign, bool):
            idx = sign
        else:
            idx = _SIGN_INDEX.get(str(sign).lower(), -1)
        if not 0 <= idx < 12:
            raise ValueError(f"constraint {index}: unknown sign {sign!r}")
        center = idx * 30.0 + 15.0
        half = 15.0
        label = f"{subject} in {SIGNS[idx]}"
    elif "lon" in c:
        center = float(c["lon"]) % 360.0
        half = float(c.get("orb", 1.0))
        label = f"{subject} at {_fmt(center)} within {_fmt(half)}"
    elif "from" in c and "to" in c:
        lo = float(c["from"]) % 360.0
        width = (float(c["to"]) - lo) % 360.0
        if width == 0.0:
            raise ValueError(f"constraint {index}: 'from' and 'to' span no arc")
        center = (lo + width / 2.0) % 360.0
        half = width / 2.0
        label = f"{subject} from {_fmt(lo)} to {_fmt((lo + width) % 360.0)}"
    else:
        raise ValueError(f"constraint {index}: needs 'sign', 'lon', or "
                         "'from' and 'to'")

    half += pad
    if pad:
        label += f" pad {_fmt(pad)}"
    if not 0.0 < half <= MAX_HALF_WIDTH:
        raise ValueError(f"constraint {index}: arc half-width {half} is "
                         f"outside (0, {MAX_HALF_WIDTH}]")
    return {"index": index, "label": label, "bodies": bodies,
            "center": center, "half": half, "step": step,
            "monotone": monotone}


def _fmt(x):
    """A degree value as text, integers without a trailing '.0' (the label
    must print the same in Python and JS)."""
    return str(int(x)) if x == int(x) else repr(float(x))


def _quantity(engine, bodies, zodiac):
    """The scanned quantity as a function of UT Julian Day, degrees."""
    if isinstance(bodies, tuple):
        a, b = bodies
        return lambda t: (engine.longitude(a, t, zodiac=zodiac)
                          - engine.longitude(b, t, zodiac=zodiac))
    return lambda t: engine.longitude(bodies, t, zodiac=zodiac)


def _turning_point(g, t0, t1, t2, rising):
    """Golden-section search for the extremum of g on [t0, t2], where
    (t0, t1, t2) brackets a maximum (rising) or a minimum."""
    sign = 1.0 if rising else -1.0
    a, b = t0, t2
    c = b - (b - a) * _INV_PHI
    d = a + (b - a) * _INV_PHI
    fc = sign * g(c)
    fd = sign * g(d)
    for _ in range(_GOLDEN_ITERS):
        if fc > fd:
            b = d
            d = c
            fd = fc
            c = b - (b - a) * _INV_PHI
            fc = sign * g(c)
        else:
            a = c
            c = d
            fc = fd
            d = a + (b - a) * _INV_PHI
            fd = sign * g(d)
    return (a + b) / 2.0


def _edge_time(g, edge, lo, hi):
    """Bisect for the instant g crosses `edge` on [lo, hi]; g(lo) and g(hi)
    lie on opposite sides."""
    below = g(lo) - edge < 0.0
    for _ in range(_BISECT_ITERS):
        mid = (lo + hi) / 2.0
        if (g(mid) - edge < 0.0) == below:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def _arc_intervals(q, center, half, a, b, step, monotone):
    """Sub-intervals of [a, b] in which q lies in the arc
    [center - half, center + half)."""
    def g(t):
        return _wrap180(q(t) - center)

    # Samples across [a, b]. For a body that can turn back, one extra sample
    # each side gives the end segments a neighbour, so a turning point inside
    # the first or last step is still bracketed. The extra sample is dropped
    # where the engine has no data for it.
    ts = []
    if not monotone:
        try:
            g(a - step)
            ts.append(a - step)
        except ValueError:
            pass
    n = 0
    while True:
        t = a + n * step
        if t >= b:
            break
        ts.append(t)
        n += 1
    ts.append(b)
    if not monotone:
        try:
            g(b + step)
            ts.append(b + step)
        except ValueError:
            pass
    gs = [g(t) for t in ts]

    if not monotone:
        extra = []
        for i in range(len(ts) - 2):
            d0 = _wrap180(gs[i + 1] - gs[i])
            d1 = _wrap180(gs[i + 2] - gs[i + 1])
            if d0 * d1 < 0.0:
                # The middle sample is the extreme one. The true turning
                # point lies beyond it by less than the larger neighbouring
                # step, so it only matters when an edge sits in that margin.
                top = gs[i + 1]
                bound = max(abs(d0), abs(d1))
                rising = d0 > 0.0
                near = False
                for edge in (-half, half):
                    if rising and top < edge <= top + bound:
                        near = True
                    if not rising and top - bound <= edge < top:
                        near = True
                if not near:
                    continue

                # unwrap around the middle sample so the search sees a
                # continuous function
                def u(t, base=top):
                    return _wrap180(g(t) - base)
                tp = _turning_point(u, ts[i], ts[i + 1], ts[i + 2], rising)
                if tp != ts[i] and tp != ts[i + 1] and tp != ts[i + 2]:
                    extra.append(tp)
        if extra:
            known = dict(zip(ts, gs))
            ts = sorted(set(ts) | set(extra))
            gs = [known[t] if t in known else g(t) for t in ts]

    # Crossings of the two edges. inside means -half <= g < half.
    cross = []
    for i in range(len(ts) - 1):
        g0, g1 = gs[i], gs[i + 1]
        if abs(g1 - g0) >= 180.0:
            continue  # the segment wrapped through the far side of the circle
        for edge in (-half, half):
            if (g0 - edge < 0.0) != (g1 - edge < 0.0):
                cross.append(_edge_time(g, edge, ts[i], ts[i + 1]))
    cross.sort()

    out = []
    inside = -half <= gs[0] < half
    start = ts[0]
    for t in cross:
        if inside:
            out.append((start, t))
        else:
            start = t
        inside = not inside
    if inside:
        out.append((start, ts[-1]))
    if inside != (-half <= gs[-1] < half):
        raise RuntimeError("datesky: crossing parity is inconsistent")

    # clip to [a, b]
    clipped = []
    for s, e in out:
        s = max(s, a)
        e = min(e, b)
        if e > s:
            clipped.append((s, e))
    return clipped


def date_sky(engine, constraints, jd_start, jd_end, zodiac="tropical",
             pad=0.0, max_windows=1000, keep_stages=False):
    """Every window in [jd_start, jd_end] (UT Julian Days) in which all the
    constraints hold.

    Each constraint is a dict naming a quantity and an arc:
      {"body": "saturn", "sign": "Libra"}          a zodiac sign (name or 0-11)
      {"body": "mars", "lon": 112.5, "orb": 2.0}   a longitude within an orb
      {"body": "moon", "from": 30, "to": 75}       an arc, forward from..to
      {"elongation": ["moon", "sun"], "from": 180, "to": 360}   a waning Moon
    An optional "pad" (degrees) widens an arc on both sides, for a source
    whose sign boundaries are not the engine's. The `pad` argument applies to
    every constraint that does not set its own.

    Returns {"windows": [{"start", "end"}], "funnel": [...], "truncated"}.
    `funnel` lists the constraints in scan order with the number of windows
    and the total days that survive each one. With `keep_stages`, each funnel
    entry also carries `spans`, the [start, end] windows left after that
    constraint, for drawing where each constraint cut.
    """
    if not constraints:
        raise ValueError("date_sky needs at least one constraint")
    if not jd_end > jd_start:
        raise ValueError("date_sky needs jd_end after jd_start")
    norm = [_norm_constraint(c if "pad" in c else dict(c, pad=pad), i)
            for i, c in enumerate(constraints)]
    # slowest first; ties go to the narrower arc, then to input order
    order = sorted(norm, key=lambda c: (-c["step"], c["half"], c["index"]))

    windows = [(jd_start, jd_end)]
    funnel = []
    for c in order:
        q = _quantity(engine, c["bodies"], zodiac)
        nxt = []
        for a, b in windows:
            nxt.extend(_arc_intervals(q, c["center"], c["half"], a, b,
                                      c["step"], c["monotone"]))
        windows = nxt
        stage = {"constraint": c["index"], "label": c["label"],
                 "windows": len(windows),
                 "days": sum(e - s for s, e in windows)}
        if keep_stages:
            stage["spans"] = [[s, e] for s, e in windows]
        funnel.append(stage)
        if not windows:
            break
    for c in order[len(funnel):]:
        stage = {"constraint": c["index"], "label": c["label"],
                 "windows": 0, "days": 0.0}
        if keep_stages:
            stage["spans"] = []
        funnel.append(stage)

    truncated = len(windows) > max_windows
    return {
        "windows": [{"start": s, "end": e} for s, e in windows[:max_windows]],
        "funnel": funnel,
        "truncated": truncated,
    }
