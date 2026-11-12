"""astroengine.stability -- what a chart still says when its time is uncertain.

A chart is computed for one instant, but the instant is often not known that
well: a birth time rounded to the quarter hour, a date with no time at all, an
ancient observation whose clock error (delta T) runs to minutes. This module
takes a window of time around the stated instant and reports, for each fact
the chart asserts, whether it holds across the whole window and, where it does
not, the instants at which it changes.

A fact is one discrete statement: a body's sign, a body's house, the sign on
the Ascendant or Midheaven, whether the chart is by day or by night, whether a
body is retrograde, and which aspect (if any) a pair of bodies is in. The scan
samples the window, and wherever a fact differs between two neighbouring
samples it bisects for the instant of the change.

Pure search over the existing chart: no new astronomy and no new data.
Mirrors stability.ts in the TypeScript engine.
"""
import math

from .chart import BODIES, SIGNS, find_aspects
from .derived import is_day_chart
from .electional import house_of
from .ranges import delta_t_sigma, jd_year

# Kinds in the order they are reported.
KINDS = ["angle_sign", "sect", "sign", "house", "retrograde", "aspect"]

# Bodies whose direction is worth reporting. The Sun and Moon never turn
# retrograde, the mean node always is, and the true node flips every few days.
NO_RETROGRADE = {"sun", "moon", "mean_node", "true_node"}

_ANGLES = ["asc", "mc"]


def _sign(lon):
    return SIGNS[int(lon // 30) % 12]


def _state(engine, t, lat, lon_east, house_system, zodiac, orbs):
    """Every fact the chart asserts at t, as {(kind, subject): value}."""
    place = lat is not None
    if place:
        ch = engine.chart_at(t, lat, lon_east, house_system, zodiac=zodiac,
                             orbs=orbs)
        bodies = ch["bodies"]
        aspects = ch["aspects"]
    else:
        bodies = {}
        for b in BODIES:
            try:
                bodies[b] = engine.position(b, t, zodiac=zodiac)
            except ValueError:
                pass
        aspects = find_aspects(bodies, orbs)
    st = {}
    if place:
        for name in _ANGLES:
            st[("angle_sign", name)] = _sign(ch["angles"][name])
        st[("sect", "chart")] = ("day" if is_day_chart(engine, t, lat, lon_east)
                                 else "night")
    for b, p in bodies.items():
        st[("sign", b)] = _sign(p["lon"])
        if place:
            st[("house", b)] = house_of(p["lon"], ch["cusps"])
        if b not in NO_RETROGRADE:
            st[("retrograde", b)] = bool(p["retrograde"])
    for a in aspects:
        st[("aspect", a["a"] + "-" + a["b"])] = a["aspect"]
    return st


def _rank(key):
    """Sort key: kind order, then body order (pairs by both bodies)."""
    kind, subject = key

    def idx(name):
        if name in _ANGLES:
            return _ANGLES.index(name)
        return BODIES.index(name) if name in BODIES else len(BODIES)

    parts = subject.split("-") if kind == "aspect" else [subject]
    return (KINDS.index(kind), [idx(p) for p in parts], subject)


def chart_stability(engine, jd_ut, lat=None, lon_east=None,
                    half_width_seconds=None, house_system="placidus",
                    zodiac="tropical", orbs=None, step_seconds=120.0):
    """Which facts of a chart survive an uncertain time.

    The window is jd_ut plus and minus half_width_seconds. Left at None, the
    half-width is the one-sigma uncertainty of delta T at that epoch, which is
    under a second today and minutes in antiquity. Pass 900 for a birth time
    good to the quarter hour, or 43200 for a date with no time.

    Without a place (lat and lon_east both None) the angles, houses, and sect
    are left out and the rest is computed.

    Returns {"jd_ut", "from", "to", "half_width_seconds", "facts", "summary"}.
    Each fact is {"kind", "subject", "value", "stable", "share", "segments"}:
    `value` is the fact at jd_ut, `share` the fraction of the window in which
    it holds, and `segments` the window cut into runs of one value, so each
    boundary between segments is an instant the fact changes.
    """
    if (lat is None) != (lon_east is None):
        raise ValueError("chart_stability needs both lat and lon_east, or neither")
    if half_width_seconds is None:
        half_width_seconds = delta_t_sigma(jd_year(jd_ut))
    if half_width_seconds < 0:
        raise ValueError("half_width_seconds must not be negative")
    if not step_seconds > 0:
        raise ValueError("step_seconds must be positive")

    lo = jd_ut - half_width_seconds / 86400.0
    hi = jd_ut + half_width_seconds / 86400.0
    cache = {}

    def state(t):
        if t not in cache:
            cache[t] = _state(engine, t, lat, lon_east, house_system, zodiac, orbs)
        return cache[t]

    ref = state(jd_ut)
    keys = list(ref.keys())
    seen = set(keys)
    flips = {}   # key -> [(t, value after)]
    first = {}   # key -> value at the start of the window

    if hi > lo:
        n = max(1, math.ceil((hi - lo) * 86400.0 / step_seconds))
        iters = max(1, math.ceil(math.log2(step_seconds)))  # to about a second
        ts = [lo + (hi - lo) * k / n for k in range(n + 1)]
        s_lo = state(ts[0])
        for key in s_lo:
            if key not in seen:
                seen.add(key)
                keys.append(key)
        for key in keys:
            first[key] = s_lo.get(key)
        for i in range(n):
            s0 = state(ts[i])
            s1 = state(ts[i + 1])
            step_keys = list(s0.keys()) + [k for k in s1 if k not in s0]
            for key in step_keys:
                v0 = s0.get(key)
                v1 = s1.get(key)
                if v0 == v1:
                    continue
                if key not in seen:
                    seen.add(key)
                    keys.append(key)
                    first[key] = None
                a, b = ts[i], ts[i + 1]
                for _ in range(iters):
                    m = (a + b) / 2.0
                    if state(m).get(key) == v0:
                        a = m
                    else:
                        b = m
                flips.setdefault(key, []).append(((a + b) / 2.0, v1))
    else:
        for key in keys:
            first[key] = ref.get(key)

    facts = []
    width = hi - lo
    for key in sorted(keys, key=_rank):
        segments = []
        start = lo
        value = first.get(key)
        for t, after in flips.get(key, []):
            segments.append({"value": value, "from": start, "to": t})
            start = t
            value = after
        segments.append({"value": value, "from": start, "to": hi})
        at_ref = ref.get(key)
        if width > 0:
            share = sum(s["to"] - s["from"] for s in segments
                        if s["value"] == at_ref) / width
        else:
            share = 1.0
        facts.append({"kind": key[0], "subject": key[1], "value": at_ref,
                      "stable": len(segments) == 1, "share": share,
                      "segments": segments})

    return {
        "jd_ut": jd_ut, "from": lo, "to": hi,
        "half_width_seconds": half_width_seconds,
        "facts": facts,
        "summary": {"facts": len(facts),
                    "stable": sum(1 for f in facts if f["stable"])},
    }
