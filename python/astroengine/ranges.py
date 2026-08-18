"""Validated ranges + delta-T sigma -- mirror of packages/caelus/src/ranges.ts.

One source of truth for the measured per-body spans behind the headline
("validated, not asserted": the figures move only when the Horizons
measurement does) and the Morrison & Stephenson (2004) delta-T uncertainty,
consumed by chart warnings so both engines emit identical validity
statements (the canonical digest pins them equal cross-language).
"""
from .core import delta_t_sigma  # re-export site for symmetry with ranges.ts

HEADLINE = {"from": 1000, "to": 3000}  # mirror of ranges.ts; see its comment

MEASURED = {
    "pluto_pack": {"from": 1000, "to": 3000},
    "pluto_meeus": {"from": 1885, "to": 2099},
    "uranian": {"from": 1800, "to": 2149},
    # Small bodies are fitted/validated only where Horizons serves them
    # (~1600-2500); narrower than the headline (see ranges.ts).
    "small_bodies": {"from": 1600, "to": 2484},
}

VSOP_BODIES = {"sun", "mercury", "venus", "mars", "jupiter", "saturn",
               "uranus", "neptune"}

ANALYTIC_BODIES = {"mean_node", "true_node", "mean_lilith", "true_lilith"}


def jd_year(jd):
    """Approximate calendar year for a Julian Day."""
    return 2000 + (jd - 2451545.0) / 365.25


# Mirror of ranges.ts: the two clock-error rates and the display threshold
# behind the canonical epoch-sigma block.
ANGLE_SIGMA_DEG_PER_SECOND = 0.25 / 60   # sky rotation: 0.25 deg per minute
MOON_SIGMA_DEG_PER_SECOND = 0.55 / 3600  # Moon longitude: ~0.55 arcsec per second
EPOCH_SIGMA_DISPLAY_SECONDS = 10         # below this, canonical output carries no block


def validated_span_for(body, engine):
    """Measured validated span for a body under this engine's data, or None
    for analytic points with no stated bound (mirrors validatedSpanFor;
    intp_apog falls through to None deliberately -- a derived point pending
    the SE measurement)."""
    from .chart import ASTEROIDS, URANIANS
    if body in VSOP_BODIES or body == "moon":
        return HEADLINE
    if body == "pluto":
        return MEASURED["pluto_pack"] if engine._has_pluto_pack() \
            else MEASURED["pluto_meeus"]
    if body == "chiron" or body in ASTEROIDS:
        return MEASURED["small_bodies"]
    if body in URANIANS:
        return MEASURED["uranian"]
    return None


def _fmt(x):
    """Render a number the way a JS template literal does (2 not 2.0)."""
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x)


def chart_warnings(jd_ut, present_bodies, engine):
    """Validity statements for a chart -- mirrors chartWarnings in chart.ts,
    text for text (the canonical digest depends on byte equality)."""
    year = jd_year(jd_ut)
    warnings = []
    for body in present_bodies:
        span = validated_span_for(body, engine)
        if span and (year < span["from"] or year > span["to"]):
            warnings.append({
                "kind": "outside_validated_range", "body": body,
                "validated": span,
                "text": (f"{body} is outside its validated range "
                         f"({span['from']}-{span['to']}) at this instant: the "
                         "position is computed but not validated here"),
            })
    sigma = delta_t_sigma(year)
    if sigma >= 10:
        angle_smear = round_2(sigma / 60 * 0.25)
        moon_smear = round_2(sigma * 0.55 / 60)
        warnings.append({
            "kind": "delta_t_uncertain",
            "sigmaSeconds": js_round(sigma),
            "angleSmearDeg": angle_smear,
            "moonSmearArcmin": moon_smear,
            "text": (f"delta-T is uncertain by ~{js_round(sigma)} s at this "
                     "epoch (Morrison & Stephenson 2004): the Ascendant/MC "
                     f"smear ~{_fmt(angle_smear)} deg and the Moon "
                     f"~{_fmt(moon_smear)} arcmin, while the slow bodies are "
                     "unaffected"),
        })
    return warnings


def js_round(x):
    """JS Math.round (half toward +infinity), IEEE-guarded."""
    import math
    r = math.floor(x + 0.5)
    if r - x > 0.5:
        return int(r - 1)
    return int(r)


def round_2(x):
    """JS Math.round(x * 100) / 100."""
    return js_round(x * 100) / 100
