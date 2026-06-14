"""astroengine.releasing -- zodiacal releasing (aphesis), the Hellenistic
time-lord technique from Vettius Valens, released from a Lot (usually Spirit or
Fortune).

From the Lot's sign, periods release sign by sign in zodiacal order. A sign's
period length is the planetary "minor years" of its sign, with the two Saturn
signs and the luminaries taking their traditional sign-specific values:
Aries 15, Taurus 8, Gemini 20, Cancer 25, Leo 19, Virgo 20, Libra 8,
Scorpio 15, Sagittarius 12, Capricorn 27, Aquarius 30, Pisces 12.

Convention (the standard Valens/Schmidt reckoning used by the common
calculators): years of exactly 360 days, each level a twelfth of the one above
-- L1 a sign's period in 360-day years, L2 in 30-day months, L3 in 2.5-day
units, L4 in 5-hour units. Within a period the next level releases from the
same sign and fills it (the last sub-period truncates at the boundary). When a
sub-level's sequence returns to the sign it began on, it looses the bond:
instead of repeating, it jumps to the opposite sign (+6) once. That can only
happen inside an L1 sign long enough to contain a full twelve-sign sublevel
loop (211 months = 17.58 years), i.e. the Sun, Mercury, Moon, and Saturn signs.

Pure time arithmetic on the natal moment and the Lot's sign. The TS port
(releasing.ts) reproduces every value and the golden fixtures pin the two
together.
"""
from .chart import SIGNS
from .derived import is_day_chart
from .profections import SIGN_RULERS

# Period length in 360-day years for each sign, Aries..Pisces.
ZR_PERIODS = [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12]

# Days spanned by one period unit at each level (each a twelfth of the one above).
LEVEL_UNIT = {1: 360.0, 2: 30.0, 3: 2.5, 4: 2.5 / 12.0}

# One full L1 cycle through all twelve signs, in days (no human life reaches it,
# so L1 never looses the bond within a lifetime).
_FULL_CYCLE = sum(ZR_PERIODS) * 360.0
_EPS = 1e-9


def _release(out, level, max_level, start_sign, span_start, span_end, horizon):
    """Append the sub-periods at ``level`` that fill ``[span_start, span_end)``,
    recursing to ``max_level``. Releases from ``start_sign`` in zodiacal order,
    looses the bond (+6) once on return to ``start_sign``, and bounds output by
    ``horizon``."""
    unit = LEVEL_UNIT[level]
    sign = start_sign
    lb = False
    pending_lb = False
    cur = span_start
    while cur < span_end - _EPS and cur < horizon - _EPS:
        plen = ZR_PERIODS[sign] * unit
        sub_end = min(cur + plen, span_end, horizon)
        out.append({"level": level, "sign": SIGNS[sign], "lord": SIGN_RULERS[sign],
                    "start": cur, "end": sub_end, "lb": pending_lb})
        if level < max_level:
            _release(out, level + 1, max_level, sign, cur,
                     min(cur + plen, span_end), horizon)
        cur += plen
        pending_lb = False
        nxt = (sign + 1) % 12
        if nxt == start_sign and not lb:
            sign = (start_sign + 6) % 12
            lb = True
            pending_lb = True
        else:
            sign = nxt


def zr_release(lot_sign, natal_jd, max_level=2, horizon_years=100):
    """Flat timeline of releasing periods down to ``max_level`` over
    ``horizon_years`` (360-day years) from birth. Each period is
    ``{level, sign, lord, start, end, lb}``."""
    out = []
    horizon = natal_jd + horizon_years * 360.0
    _release(out, 1, max_level, lot_sign, natal_jd, natal_jd + _FULL_CYCLE, horizon)
    return out


def _sub_at(unit, start_sign, span_start, span_end, target):
    """The (sign, start, end) of the sub-period containing ``target`` within
    ``[span_start, span_end)``, releasing from ``start_sign`` with loosing of the
    bond. None if ``target`` is outside the span."""
    sign = start_sign
    lb = False
    cur = span_start
    while cur < span_end - _EPS:
        plen = ZR_PERIODS[sign] * unit
        sub_end = min(cur + plen, span_end)
        if cur <= target < sub_end:
            return sign, cur, sub_end
        cur += plen
        nxt = (sign + 1) % 12
        if nxt == start_sign and not lb:
            sign = (start_sign + 6) % 12
            lb = True
        else:
            sign = nxt
    return None


def zr_active(lot_sign, natal_jd, target_jd):
    """The L1..L4 releasing signs active at ``target_jd``. None before birth or
    beyond one full L1 cycle."""
    l1 = _sub_at(360.0, lot_sign, natal_jd, natal_jd + _FULL_CYCLE, target_jd)
    if l1 is None:
        return None
    s1, a1, b1 = l1
    s2, a2, b2 = _sub_at(30.0, s1, a1, b1, target_jd)
    s3, a3, b3 = _sub_at(2.5, s2, a2, b2, target_jd)
    s4, a4, b4 = _sub_at(2.5 / 12.0, s3, a3, b3, target_jd)
    return {"l1": SIGNS[s1], "l2": SIGNS[s2], "l3": SIGNS[s3], "l4": SIGNS[s4]}


def zr_at(engine, natal_jd, target_jd, lat, lon_east, lot="spirit",
          zodiac="tropical"):
    """Zodiacal releasing active at ``target_jd``, releasing from the Lot of
    Spirit (default) or Fortune of the natal chart. Returns
    ``{lot, lot_sign, day, l1, l2, l3, l4}``."""
    from .lots import lot_spirit, lot_fortune
    asc = engine.chart_at(natal_jd, lat, lon_east, zodiac=zodiac)["angles"]["asc"]
    day = is_day_chart(engine, natal_jd, lat, lon_east)
    sun = engine.longitude("sun", natal_jd, zodiac=zodiac)
    moon = engine.longitude("moon", natal_jd, zodiac=zodiac)
    lot_lon = (lot_spirit if lot == "spirit" else lot_fortune)(asc, sun, moon, day)
    lot_sign = int(lot_lon // 30) % 12
    active = zr_active(lot_sign, natal_jd, target_jd)
    return {"lot": lot, "lot_sign": SIGNS[lot_sign], "day": day, **(active or {})}
