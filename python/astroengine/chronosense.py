"""astroengine.chronosense -- zero-dependency temporal middleware and citation
auditor for LLM agents (FACT-002).

Four pure, stdlib-only primitives built directly on validated Caelus physics
(`observe.scene_geometry` and `canonical.canonical_chart` / `canonical_digest`):

1. `chronosense_envelope`: computes an unambiguous physical-horizon envelope,
   8-char canonical chart digest (`clock_id`), explicit local solar-midnight
   `night_crossed`, photoperiod-warped `day_slot` (`1..12` or `polar_day` /
   `polar_night`), separated horizon vs. deadline countdowns (zero adjacent
   colliding minute labels, per EXP-005), follow-the-sun `wavefront_quadrant`
   (per EXP-009), and a compact plain-text header with zero astrological words.
2. `audit_chronosense_cursor`: deterministic pre-tool write-back cursor and
   fact provenance auditor verifying `clock_id`, monotonic `turn`, explicit
   `night_crossed_ack`, active deadline drift, and `cited_facts` against the
   authoritative envelope.
3. `photoperiod_vector`, `phase_stratum_key`, `phase_cosine_similarity`:
   10-D normalized physical phase descriptor (EXP-002) and unsupervised
   horizon x season x longitude stratum key (EXP-007) for circadian-aware
   episodic memory retrieval and continual consolidation.
4. `stratified_select`: deterministic bucket-preserving compaction selector
   that retains balanced top exemplars across every distinct physical stratum
   up to `budget` so dominant daytime streams never evict nocturnal, seasonal,
   or travel strata.

Zero external dependencies; mirrors packages/caelus/src/chronosense.ts.
"""
import math

from .canonical import canonical_chart, canonical_digest
from .core import DEG
from .observe import _fmt_fixed, _format_iso_minute, scene_geometry
from .skyview import _js_round

__all__ = [
    "CHRONOSENSE_VERSION",
    "TWILIGHT_CLASSES",
    "WAVEFRONT_QUADRANTS",
    "AUDITABLE_NUMERIC_FACTS",
    "AUDITABLE_DISCRETE_FACTS",
    "chronosense_envelope",
    "audit_chronosense_cursor",
    "photoperiod_vector",
    "phase_stratum_key",
    "phase_cosine_similarity",
    "stratified_select",
]

CHRONOSENSE_VERSION = 1
TWO_PI = 2.0 * math.pi

TWILIGHT_CLASSES = (
    "daylight",
    "civil",
    "nautical",
    "astronomical",
    "night",
)

WAVEFRONT_QUADRANTS = (
    "initiate",
    "execute",
    "review",
    "consolidate",
)

_SEASON_QUADRANTS = (
    "mar_eq",
    "jun_sol",
    "sep_eq",
    "dec_sol",
)

# Authoritative numeric envelope fields accepted in `cursor["cited_facts"]`.
AUDITABLE_NUMERIC_FACTS = frozenset({
    "sun_alt_deg",
    "moon_illum_pct",
    "moon_lon_deg",
    "horizon_eta_min",
    "deadline_eta_min",
    "dt_prev_min",
    "lat",
    "lon_east",
    "elevation_m",
})

# Authoritative discrete envelope fields accepted in `cursor["cited_facts"]`.
AUDITABLE_DISCRETE_FACTS = frozenset({
    "clock_id",
    "turn",
    "utc_iso",
    "sun_trend",
    "twilight",
    "day_slot",
    "is_day",
    "night_crossed",
    "horizon_event",
    "deadline_label",
    "deadline_state",
    "moon_waxing",
    "wavefront_quadrant",
})

_CIRCULAR_FACTS = frozenset({"moon_lon_deg"})


# ------------------------------------------------------------------ helpers

def _clamp(x, lo, hi):
    return lo if x < lo else (hi if x > hi else x)


def _wrap180(x):
    """Signed angle in (-180, 180] degrees."""
    r = (x + 180.0) % 360.0 - 180.0
    return 180.0 if r == -180.0 else r


def _is_finite_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def _fmt_signed_fixed(x, decimals=1):
    s = _fmt_fixed(x, decimals)
    return s if s.startswith("-") else "+" + s


def _fmt_signed_int(x):
    n = _js_round(x)
    return f"+{n}" if n >= 0 else str(n)


def _sanitize_label(label):
    if label is None:
        return "deadline"
    s = "_".join(str(label).strip().split())
    cleaned = "".join(ch for ch in s if ch not in "()[]=")
    return cleaned if cleaned else "deadline"


def _normalize_twilight(stage):
    """Map skyview/observe 5-class twilight stage ('day' -> 'daylight')."""
    if stage == "day":
        return "daylight"
    return stage


def _normalize_sun_trend(trend):
    """Map observe sun trend ('nadir' -> 'culminating') to 3-state physical trend."""
    if trend == "nadir":
        return "culminating"
    return trend


def _approx_sun_lon_deg(jd_ut):
    """Pure closed-form apparent solar ecliptic longitude in [0, 360) degrees
    (~0.01 deg accuracy, Meeus Ch. 25). Zero engine dependency so
    `photoperiod_vector(scene)` and `phase_stratum_key(scene)` stay pure."""
    t = (jd_ut - 2451545.0) / 36525.0
    l0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360.0
    m = (357.52911 + t * (35999.05029 - 0.0001537 * t)) * DEG
    c = (
        (1.914602 - t * (0.004817 + 0.000014 * t)) * math.sin(m)
        + (0.019993 - 0.000101 * t) * math.sin(2.0 * m)
        + 0.000289 * math.sin(3.0 * m)
    )
    return (l0 + c) % 360.0


def _compute_day_slot(scene):
    """Photoperiod-warped 1..12 diurnal/nocturnal slot, or 'polar_day' /
    'polar_night' cleanly when the Sun does not rise and set on this day."""
    ph = scene["diurnal"]["planetary_hour"]
    if ph is not None:
        # planetary_hour.hour is 1..12 for day and 13..24 for night.
        return ((ph["hour"] - 1) % 12) + 1
    return "polar_day" if scene["sun"]["is_day"] else "polar_night"


def _compute_wavefront_quadrant(scene):
    """Offline solar-horizon follow-the-sun quadrant from proved EXP-009.

    Returns one of: 'initiate' | 'execute' | 'review' | 'consolidate'.
    Guarantees 100% civil daylight alignment (sun_alt >= -6 deg) for
    interactive quadrants and 100% nocturnal safety (sun_alt < -6 deg, or
    low-sun nadir during 24h polar midnight sun) for 'consolidate'.
    """
    alt = scene["sun"]["altitude_apparent_deg"]
    rate_alt = scene["sun"]["rate_alt_deg_per_min"]
    if alt < -6.0:
        return "consolidate"
    if alt < 0.0:
        return "initiate" if rate_alt >= 0.0 else "review"

    diurnal = scene["diurnal"]
    sr = diurnal["sunrise_jd"]
    ss = diurnal["sunset_jd"]
    if sr is not None and ss is not None and ss > sr:
        u = _clamp((scene["jd_ut"] - sr) / (ss - sr), 0.0, 1.0)
        if u < 0.3:
            return "initiate"
        if u < 0.7:
            return "execute"
        return "review"

    noon = diurnal["solar_noon_jd"]
    if noon is not None:
        dh = ((scene["jd_ut"] - noon) * 24.0 + 36.0) % 24.0 - 12.0
        if -6.0 <= dh < -2.0:
            return "initiate"
        if -2.0 <= dh < 2.0:
            return "execute"
        if 2.0 <= dh < 6.0:
            return "review"
        return "consolidate"

    return "execute"


def _build_header(
    clock_id,
    turn,
    utc_iso,
    sun_alt_deg,
    sun_trend,
    twilight,
    day_slot,
    night_crossed,
    horizon_event,
    horizon_eta_min,
    deadline_label,
    deadline_state,
    deadline_eta_min,
    dt_prev_min,
):
    """Build compact unambiguous plain-text header (zero astrological words).

    Separates `next_sky=<event>(in_<N>m)` from `deadline=<label>(<state>_<N>m)`
    per EXP-005 transcript findings and always renders `night_crossed=true|false`
    explicitly.
    """
    alt_s = _fmt_signed_fixed(sun_alt_deg, 1)
    slot_s = f"{day_slot}/12" if isinstance(day_slot, int) else day_slot
    nc_s = "true" if night_crossed else "false"
    if horizon_event is not None and horizon_eta_min is not None:
        eta_int = max(0, _js_round(horizon_eta_min))
        next_sky_s = f"next_sky={horizon_event}(in_{eta_int}m)"
    else:
        next_sky_s = "next_sky=polar"

    tokens = [
        "[CAELUS-CHRONO",
        f"clock={clock_id}",
        f"turn={turn}",
        f"utc={utc_iso}",
        f"sun_alt={alt_s}deg({sun_trend})",
        f"sky={twilight}",
        f"slot={slot_s}",
        f"night_crossed={nc_s}",
        next_sky_s,
    ]

    if deadline_state != "none" and deadline_label is not None:
        if deadline_state == "due":
            tokens.append(f"deadline={deadline_label}(due)")
        else:
            dl_min = max(0, _js_round(abs(deadline_eta_min)))
            tokens.append(f"deadline={deadline_label}({deadline_state}_{dl_min}m)")

    if dt_prev_min is not None:
        tokens.append(f"dt_prev={_fmt_signed_int(dt_prev_min)}m")

    return " ".join(tokens) + "]"


# ------------------------------------------------ Primitive 1: envelope

def chronosense_envelope(
    engine,
    jd_ut,
    lat,
    lon_east,
    *,
    turn=1,
    prev_jd_ut=None,
    deadline_jd_ut=None,
    deadline_label="deadline",
    elevation_m=0.0,
    genesis_digest=None,
):
    """Compute a deterministic physical-horizon chronosense envelope for an
    agent turn at `(jd_ut, lat, lon_east)`.

    Calls `scene_geometry` and computes an 8-char lowercase hex `clock_id` from
    `canonical_digest(canonical_chart(engine.chart_at(jd_ut, lat, lon_east)))`.
    Uses `scene_geometry.diurnal.minutes_to_next_twilight` directly for horizon
    countdowns (per KILL-005) and separates horizon vs. deadline formatting
    (per EXP-005).
    """
    if not _is_finite_number(jd_ut):
        raise ValueError(f"jd_ut must be finite, got {jd_ut!r}")
    if isinstance(turn, bool) or not isinstance(turn, int) or turn < 1:
        raise ValueError(f"turn must be an integer >= 1, got {turn!r}")
    if prev_jd_ut is not None and not _is_finite_number(prev_jd_ut):
        raise ValueError(f"prev_jd_ut must be finite or None, got {prev_jd_ut!r}")
    if deadline_jd_ut is not None and not _is_finite_number(deadline_jd_ut):
        raise ValueError(
            f"deadline_jd_ut must be finite or None, got {deadline_jd_ut!r}"
        )
    if genesis_digest is not None and not isinstance(genesis_digest, str):
        raise ValueError(
            f"genesis_digest must be str or None, got {genesis_digest!r}"
        )

    jd_f = float(jd_ut)
    lat_f = float(lat)
    lon_f = float(lon_east)
    elev_f = float(elevation_m)
    prev_f = None if prev_jd_ut is None else float(prev_jd_ut)
    dl_f = None if deadline_jd_ut is None else float(deadline_jd_ut)

    scene = scene_geometry(
        engine,
        jd_f,
        lat_f,
        lon_f,
        elevation_m=elev_f,
        prev_jd_ut=prev_f,
        deadline_jd_ut=dl_f,
    )
    chart = engine.chart_at(jd_f, lat_f, lon_f)
    full_digest = canonical_digest(canonical_chart(chart))
    clock_id = full_digest[:8]

    utc_iso = _format_iso_minute(jd_f)
    sun_alt_deg = scene["sun"]["altitude_apparent_deg"]
    sun_trend = _normalize_sun_trend(scene["sun"]["trend"])
    twilight = _normalize_twilight(scene["sun"]["twilight_stage"])
    is_day = bool(scene["sun"]["is_day"])
    day_slot = _compute_day_slot(scene)
    night_crossed = bool(scene["chronosense"]["night_crossed"])

    horizon_event = scene["diurnal"]["next_transition_kind"]
    horizon_eta_min = scene["diurnal"]["minutes_to_next_twilight"]

    if dl_f is not None:
        d_label = _sanitize_label(deadline_label)
        deadline_eta_min = (dl_f - jd_f) * 1440.0
        if abs(deadline_eta_min) <= 1.0:
            deadline_state = "due"
        elif deadline_eta_min > 1.0:
            deadline_state = "applying"
        else:
            deadline_state = "overdue"
    else:
        d_label = None
        deadline_eta_min = None
        deadline_state = "none"

    moon_lon_deg = scene["chronosense"]["moon_lon_deg"]
    moon_illum_pct = scene["moon"]["illum"] * 100.0
    moon_waxing = bool(scene["moon"]["waxing"])
    dt_prev_min = None if prev_f is None else (jd_f - prev_f) * 1440.0
    quadrant = _compute_wavefront_quadrant(scene)

    header = _build_header(
        clock_id=clock_id,
        turn=turn,
        utc_iso=utc_iso,
        sun_alt_deg=sun_alt_deg,
        sun_trend=sun_trend,
        twilight=twilight,
        day_slot=day_slot,
        night_crossed=night_crossed,
        horizon_event=horizon_event,
        horizon_eta_min=horizon_eta_min,
        deadline_label=d_label,
        deadline_state=deadline_state,
        deadline_eta_min=deadline_eta_min,
        dt_prev_min=dt_prev_min,
    )

    return {
        "clock_id": clock_id,
        "chart_digest": full_digest,
        "genesis_digest": genesis_digest,
        "turn": turn,
        "jd_ut": jd_f,
        "utc_iso": utc_iso,
        "lat": lat_f,
        "lon_east": lon_f,
        "elevation_m": elev_f,
        "sun_alt_deg": sun_alt_deg,
        "sun_trend": sun_trend,
        "twilight": twilight,
        "day_slot": day_slot,
        "is_day": is_day,
        "night_crossed": night_crossed,
        "horizon_event": horizon_event,
        "horizon_eta_min": horizon_eta_min,
        "deadline_label": d_label,
        "deadline_eta_min": deadline_eta_min,
        "deadline_state": deadline_state,
        "moon_lon_deg": moon_lon_deg,
        "moon_illum_pct": moon_illum_pct,
        "moon_waxing": moon_waxing,
        "dt_prev_min": dt_prev_min,
        "wavefront_quadrant": quadrant,
        "header": header,
    }


# ------------------------------------------------ Primitive 2: cursor auditor

def _discrete_equal(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    return a == b


def _build_corrective_prompt(envelope, drift_flags):
    if not drift_flags:
        return None
    parts = [
        f"Chronosense audit rejected cursor ({', '.join(drift_flags)}).",
    ]
    if "clock_id_mismatch" in drift_flags or "turn_mismatch" in drift_flags:
        parts.append(
            f"Sync cursor to clock_id={envelope['clock_id']} turn={envelope['turn']}."
        )
    if "night_crossed_unacked" in drift_flags:
        parts.append(
            "Local solar midnight was crossed since the previous turn; "
            "set night_crossed_ack=true and re-verify prior-day cached outputs."
        )
    if "deadline_drift" in drift_flags:
        if envelope["deadline_eta_min"] is not None:
            eta_s = _fmt_fixed(envelope["deadline_eta_min"], 1)
            parts.append(
                f"Update deadline_eta_min to {eta_s} ({envelope['deadline_state']})."
            )
        else:
            parts.append("Clear deadline_eta_min (no active deadline).")
    has_fact_issue = any(
        f.startswith("fact_mismatch:") or f.startswith("unknown_fact:")
        for f in drift_flags
    )
    if has_fact_issue:
        parts.append(
            f"Re-read cited_facts from the authoritative header: {envelope['header']}"
        )
    else:
        parts.append(f"Authoritative header: {envelope['header']}")
    return " ".join(parts)


def audit_chronosense_cursor(
    envelope,
    cursor,
    *,
    deadline_tolerance_min=5.0,
    fact_tolerance=0.5,
):
    """Deterministic pre-tool write-back cursor and citation auditor.

    Verifies:
      - `clock_id` digest match (`clock_id_mismatch`)
      - `turn` monotonicity (`turn_mismatch`)
      - `night_crossed_ack` whenever `envelope["night_crossed"] is True`
        (`night_crossed_unacked`)
      - `deadline_eta_min` within `deadline_tolerance_min` when a deadline is
        active, or absent/None when no deadline is active (`deadline_drift`)
      - optional `cited_facts` dict against authoritative envelope values
        within `fact_tolerance` (`fact_mismatch:<key>` / `unknown_fact:<key>`)

    Returns `{"ok": bool, "drift_flags": list[str], "corrective_prompt": str | None}`.
    """
    if not _is_finite_number(deadline_tolerance_min) or deadline_tolerance_min < 0.0:
        raise ValueError(
            f"deadline_tolerance_min must be finite >= 0, got {deadline_tolerance_min!r}"
        )
    if not _is_finite_number(fact_tolerance) or fact_tolerance < 0.0:
        raise ValueError(
            f"fact_tolerance must be finite >= 0, got {fact_tolerance!r}"
        )

    c = cursor if isinstance(cursor, dict) else {}
    drift_flags = []

    # 1. clock_id digest match
    c_clock = c.get("clock_id")
    if not isinstance(c_clock, str) or c_clock != envelope["clock_id"]:
        drift_flags.append("clock_id_mismatch")

    # 2. turn monotonicity
    c_turn = c.get("turn")
    if isinstance(c_turn, bool) or not isinstance(c_turn, int) or c_turn != envelope["turn"]:
        drift_flags.append("turn_mismatch")

    # 3. explicit night_crossed acknowledgment
    if envelope["night_crossed"] is True and c.get("night_crossed_ack") is not True:
        drift_flags.append("night_crossed_unacked")

    # 4. deadline drift check
    expected_dl = envelope.get("deadline_eta_min")
    deadline_active = (
        envelope.get("deadline_state") != "none" and expected_dl is not None
    )
    c_dl = c.get("deadline_eta_min")
    if deadline_active:
        if not _is_finite_number(c_dl):
            drift_flags.append("deadline_drift")
        elif abs(float(c_dl) - float(expected_dl)) > float(deadline_tolerance_min):
            drift_flags.append("deadline_drift")
    else:
        if c_dl is not None:
            drift_flags.append("deadline_drift")

    # 5. cited_facts provenance audit (sorted keys for deterministic output)
    cited_facts = c.get("cited_facts")
    if cited_facts is not None:
        if not isinstance(cited_facts, dict):
            drift_flags.append("unknown_fact:cited_facts")
        else:
            for key in sorted(cited_facts.keys()):
                val = cited_facts[key]
                if key in AUDITABLE_NUMERIC_FACTS:
                    expected = envelope.get(key)
                    if expected is None:
                        if val is not None:
                            drift_flags.append(f"fact_mismatch:{key}")
                    else:
                        if not _is_finite_number(val):
                            drift_flags.append(f"fact_mismatch:{key}")
                        else:
                            if key in _CIRCULAR_FACTS:
                                diff = abs(_wrap180(float(val) - float(expected)))
                            else:
                                diff = abs(float(val) - float(expected))
                            if diff > float(fact_tolerance):
                                drift_flags.append(f"fact_mismatch:{key}")
                elif key in AUDITABLE_DISCRETE_FACTS:
                    expected = envelope.get(key)
                    if not _discrete_equal(val, expected):
                        drift_flags.append(f"fact_mismatch:{key}")
                else:
                    drift_flags.append(f"unknown_fact:{key}")

    return {
        "ok": len(drift_flags) == 0,
        "drift_flags": drift_flags,
        "corrective_prompt": _build_corrective_prompt(envelope, drift_flags),
    }


# ----------------------------------------- Primitive 3: photoperiod vector

def photoperiod_vector(scene):
    """Pure 10-D L2-normalized physical phase descriptor from `scene_geometry`
    (proved EXP-002).

    Components (before L2 normalization):
      [0] 1.60 * cos(arc_angle)               photoperiod-warped circadian cos
      [1] 1.60 * sin(arc_angle)               photoperiod-warped circadian sin
      [2] 0.45 * tanh(sun_alt_deg / 12)       smooth normalized solar altitude
      [3] 0.75 * sign(rate_alt_deg_per_min)   rising (+1) vs setting (-1)
      [4] 0.90 * sect_sign                    diurnal (+1) vs nocturnal (-1)
      [5] 0.45 * exp(-(sun_alt_deg / 3)^2)    tight 3-deg horizon twilight band
      [6] 0.12 * cos(signed_lunar_elong)      synodic Moon cos
      [7] 0.12 * sin(signed_lunar_elong)      synodic Moon sin
      [8] 0.08 * cos(sun_lon_deg)             seasonal solar longitude cos
      [9] 0.08 * sin(sun_lon_deg)             seasonal solar longitude sin

    Handles polar latitudes cleanly via solar-noon hour-angle fallback.
    """
    jd_ut = float(scene["jd_ut"])
    sun = scene["sun"]
    sun_alt = float(sun["altitude_apparent_deg"])
    rate_alt = float(sun["rate_alt_deg_per_min"])
    is_day = bool(sun["is_day"])

    diurnal = scene["diurnal"]
    ph = diurnal.get("planetary_hour")
    solar_noon_jd = diurnal.get("solar_noon_jd")

    if ph is not None and ph["end"] > ph["start"]:
        frac_in_hour = _clamp((jd_ut - ph["start"]) / (ph["end"] - ph["start"]), 0.0, 1.0)
        slot_idx = (ph["hour"] - 1) % 12  # 0..11 for both day and night
        half_arc_frac = _clamp((slot_idx + frac_in_hour) / 12.0, 0.0, 1.0)
        if ph["kind"] == "day":
            arc_angle = half_arc_frac * math.pi
        else:
            arc_angle = math.pi + half_arc_frac * math.pi
    elif solar_noon_jd is not None:
        dh = ((jd_ut - solar_noon_jd) * 24.0 + 36.0) % 24.0 - 12.0
        arc_angle = (0.5 * math.pi + (dh / 12.0) * math.pi) % TWO_PI
    else:
        alt_norm = _clamp(sun_alt / 30.0, -1.0, 1.0)
        if rate_alt >= 0.0:
            arc_angle = (1.0 - alt_norm) * (0.5 * math.pi)
        else:
            arc_angle = math.pi - (1.0 - alt_norm) * (0.5 * math.pi)

    horizon_band = math.exp(-((sun_alt / 3.0) ** 2))
    sun_alt_norm = math.tanh(sun_alt / 12.0)
    sun_trend_sign = 1.0 if rate_alt >= 0.0 else -1.0
    sect_sign = 1.0 if is_day else -1.0

    moon = scene["moon"]
    elong_deg = float(moon["elongation_deg"])
    signed_elong_deg = elong_deg if moon["waxing"] else (360.0 - elong_deg)
    elong_rad = signed_elong_deg * DEG

    sun_lon_rad = _approx_sun_lon_deg(jd_ut) * DEG

    raw = [
        1.6 * math.cos(arc_angle),
        1.6 * math.sin(arc_angle),
        0.45 * sun_alt_norm,
        0.75 * sun_trend_sign,
        0.9 * sect_sign,
        0.45 * horizon_band,
        0.12 * math.cos(elong_rad),
        0.12 * math.sin(elong_rad),
        0.08 * math.cos(sun_lon_rad),
        0.08 * math.sin(sun_lon_rad),
    ]
    norm = math.sqrt(sum(v * v for v in raw))
    return [v / norm for v in raw]


def phase_stratum_key(scene, lon_east=None):
    """Unsupervised horizon x season x longitude physical stratum key (EXP-007).

    Returns `<horizon>:<season>:lon<0..5>` where:
      - `horizon`: `night` (< -6 deg) | `twilight` ([-6, +6] deg) | `day` (> +6 deg)
      - `season`: `mar_eq` | `jun_sol` | `sep_eq` | `dec_sol` (hemisphere-neutral)
      - `lon<0..5>`: 60-degree longitude sector (`lon0`..`lon5`, -180..+180E)
    """
    alt = float(scene["sun"]["altitude_apparent_deg"])
    if alt < -6.0:
        horizon = "night"
    elif alt <= 6.0:
        horizon = "twilight"
    else:
        horizon = "day"

    sun_lon_deg = _approx_sun_lon_deg(float(scene["jd_ut"]))
    s_bin = int(((sun_lon_deg + 45.0) % 360.0) // 90.0) % 4
    season = _SEASON_QUADRANTS[s_bin]

    lon = float(scene["lon_east"] if lon_east is None else lon_east)
    if not math.isfinite(lon):
        raise ValueError(f"lon_east must be finite, got {lon!r}")
    lon_norm = ((lon + 180.0) % 360.0) - 180.0
    lon_bin = int(((lon_norm + 180.0) % 360.0) // 60.0) % 6
    return f"{horizon}:{season}:lon{lon_bin}"


def phase_cosine_similarity(vec_a, vec_b):
    """Cosine similarity in [-1, 1] between two equal-length phase vectors."""
    if len(vec_a) == 0 or len(vec_a) != len(vec_b):
        raise ValueError(
            f"vectors must be non-empty and equal length, got {len(vec_a)} and {len(vec_b)}"
        )
    dot = 0.0
    na = 0.0
    nb = 0.0
    for a, b in zip(vec_a, vec_b):
        fa = float(a)
        fb = float(b)
        dot += fa * fb
        na += fa * fa
        nb += fb * fb
    if na == 0.0 or nb == 0.0:
        return 0.0
    return _clamp(dot / math.sqrt(na * nb), -1.0, 1.0)


# ----------------------------------------- Primitive 4: stratified compaction

def _entry_priority(entry):
    if "score" in entry and entry["score"] is not None:
        val = entry["score"]
    elif "recency" in entry and entry["recency"] is not None:
        val = entry["recency"]
    else:
        val = 0.0
    if not _is_finite_number(val):
        raise ValueError(f"entry score/recency must be finite, got {val!r}")
    return float(val)


def stratified_select(entries, budget):
    """Deterministic bucket-preserving compaction selector (EXP-002 / EXP-007).

    Given `entries` with `{"id", "stratum", "score"}` (or `"recency"`),
    partitions entries by `"stratum"`, ranks each bucket by descending score
    (ties broken by lexicographical `str(id)` then original index), orders
    strata by descending peak score (ties broken by lexicographical stratum
    key), and sweeps round-robin across distinct strata up to `budget`.

    Guarantees that dominant daytime streams cannot evict rare nocturnal,
    seasonal, or travel strata while filling the full budget cleanly when
    smaller strata exhaust.
    """
    if isinstance(budget, bool) or not isinstance(budget, int) or budget < 0:
        raise ValueError(f"budget must be an integer >= 0, got {budget!r}")
    if budget == 0 or not entries:
        return []

    buckets = {}
    for orig_idx, entry in enumerate(entries):
        if not isinstance(entry, dict) or "id" not in entry or "stratum" not in entry:
            raise ValueError(
                f"each entry must be a dict with 'id' and 'stratum', got {entry!r}"
            )
        stratum = str(entry["stratum"])
        prio = _entry_priority(entry)
        buckets.setdefault(stratum, []).append((prio, str(entry["id"]), orig_idx, entry))

    for stratum in buckets:
        buckets[stratum].sort(key=lambda item: (-item[0], item[1], item[2]))

    # Order strata by peak exemplar score descending, then stratum key ascending.
    ordered_strata = sorted(
        buckets.keys(),
        key=lambda k: (-buckets[k][0][0], k),
    )

    selected = []
    offsets = {k: 0 for k in ordered_strata}
    while len(selected) < budget:
        progressed = False
        for k in ordered_strata:
            if len(selected) >= budget:
                break
            idx = offsets[k]
            bucket = buckets[k]
            if idx < len(bucket):
                selected.append(bucket[idx][3])
                offsets[k] = idx + 1
                progressed = True
        if not progressed:
            break
    return selected
