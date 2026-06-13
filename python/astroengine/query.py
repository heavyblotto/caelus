"""astroengine.query -- declarative time queries ("when is ...?").

The engine answers "where is the body?"; this answers "when is the
configuration true?" over a time range. A *predicate* is a continuous
"margin" function m(engine, t) that is true exactly where m >= 0 (e.g.
aspect-within-orb -> orb minus angular distance from exact). A boolean
combination is then itself a margin function -- AND is the min of the
parts, OR the max, NOT the negation -- so any query reduces to a single
continuous function, and `when()` returns the time intervals where it is
true using the same coarse-scan-then-bisect root finder as events.crossings.

    from astroengine.query import when, all_, not_, aspect, in_sign, retrograde
    when(engine, all_(aspect("saturn", "square", natal_moon_lon),
                      not_(retrograde("mercury")),
                      in_sign("venus", "Taurus")),
         jd_start, jd_end)
"""
import math

from .chart import SIGNS

ASPECTS = {
    "conjunction": 0.0, "semisextile": 30.0, "sextile": 60.0, "square": 90.0,
    "trine": 120.0, "quincunx": 150.0, "opposition": 180.0,
}

# Bodies whose longitude can change fast enough to enter and leave a
# condition within a day; they force a finer scan step.
_FAST = {"moon", "mean_node", "true_node", "mean_lilith", "true_lilith"}


def _wrap180(d):
    return (d + 180.0) % 360.0 - 180.0


# --------------------------------------------------------------- predicates
def aspect(body, kind, target, orb=1.0, zodiac="tropical"):
    """True while `body` is within `orb` degrees of an exact `kind` aspect to
    `target` -- a fixed ecliptic longitude (degrees) or another body name."""
    ang = ASPECTS[kind]
    is_lon = isinstance(target, (int, float))

    def margin(engine, t):
        lon = engine.longitude(body, t, zodiac=zodiac)
        tl = target if is_lon else engine.longitude(target, t, zodiac=zodiac)
        sep = lon - tl
        # aspects are symmetric about 0: the body may be ahead or behind
        return orb - min(abs(_wrap180(sep - ang)), abs(_wrap180(sep + ang)))

    margin._bodies = {body} if is_lon else {body, target}
    return margin


def in_sign(body, sign, zodiac="tropical"):
    """True while `body` is in `sign` (index 0=Aries..11=Pisces, or name)."""
    idx = sign if isinstance(sign, int) else SIGNS.index(sign)
    lo = idx * 30.0

    def margin(engine, t):
        d = (engine.longitude(body, t, zodiac=zodiac) - lo) % 360.0
        # signed distance to the nearest 30-deg band edge, positive inside
        return min(d, 30.0 - d) if d <= 30.0 else -min(d - 30.0, 360.0 - d)

    margin._bodies = {body}
    return margin


def retrograde(body, zodiac="tropical"):
    """True while `body` is in apparent retrograde motion (longitude
    decreasing). Sun and Moon never satisfy it."""
    h = 0.25

    def margin(engine, t):
        l0 = engine.longitude(body, t - h, zodiac=zodiac)
        l1 = engine.longitude(body, t + h, zodiac=zodiac)
        return -_wrap180(l1 - l0) / (2.0 * h)  # >= 0 when moving backwards

    margin._bodies = {body}
    return margin


def not_retrograde(body, zodiac="tropical"):
    """True while `body` is direct or stationary."""
    return not_(retrograde(body, zodiac=zodiac))


# --------------------------------------------------------------- combinators
def _combine(op, preds):
    bodies = set()
    for p in preds:
        bodies |= getattr(p, "_bodies", set())

    def margin(engine, t):
        return op(p(engine, t) for p in preds)

    margin._bodies = bodies
    return margin


def all_(*preds):
    """True where every predicate is true (interval intersection)."""
    return _combine(min, preds)


def any_(*preds):
    """True where any predicate is true (interval union)."""
    return _combine(max, preds)


def not_(pred):
    """True where `pred` is false (interval complement)."""
    def margin(engine, t):
        return -pred(engine, t)

    margin._bodies = getattr(pred, "_bodies", set())
    return margin


# --------------------------------------------------------------- solver
def _bisect(f, engine, a, b, tol=1e-6):
    fa = f(engine, a)
    for _ in range(60):
        m = 0.5 * (a + b)
        fm = f(engine, m)
        if abs(b - a) < tol:
            return m
        if (fa < 0) != (fm < 0):
            b = m
        else:
            a, fa = m, fm
    return 0.5 * (a + b)


def when(engine, predicate, jd_start, jd_end, step=None, max_intervals=500):
    """Time intervals (jd_start_ut, jd_end_ut) in [jd_start, jd_end] where
    `predicate` is true. Endpoints touching the range bounds are clamped.

    The scan step defaults to 0.125 d when a fast body (Moon, nodes, Lilith)
    is involved and 1 d otherwise; pass `step` to override.
    """
    if step is None:
        bodies = getattr(predicate, "_bodies", set())
        step = 0.125 if bodies & _FAST else 1.0

    def f(eng, t):
        return predicate(eng, t)

    intervals = []
    t0 = jd_start
    prev = f(engine, t0)
    open_start = t0 if prev >= 0 else None
    t = jd_start + step
    while t <= jd_end + 1e-9 and len(intervals) < max_intervals:
        t = min(t, jd_end)
        cur = f(engine, t)
        if (prev < 0) != (cur < 0):
            edge = _bisect(f, engine, t - step, t)
            if cur >= 0:          # rising edge: condition turns on
                open_start = edge
            else:                 # falling edge: condition turns off
                if open_start is not None:
                    intervals.append((open_start, edge))
                    open_start = None
        prev = cur
        if t >= jd_end:
            break
        t += step
    if open_start is not None:
        intervals.append((open_start, jd_end))
    return intervals
