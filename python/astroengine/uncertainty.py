"""astroengine.uncertainty -- how well a position is known.

Two different things limit a position, and they are reported separately
because they are different kinds of number.

The first is the model. The accuracy table states, for each body, the largest
error measured against JPL Horizons across the validated span. That is a
bound, not a sigma, and it exists only where it was measured.

The second is the clock. A chart is cast for an instant in UT, positions are
computed in TT, and the difference between them, delta T, is uncertain by a
known amount at each epoch. A body moving at v degrees per day turns a clock
error of s seconds into v * s / 86400 degrees. For a modern chart this is
nothing. For an ancient one it is the larger term for the Moon and it is
negligible for Saturn.

Mirrors uncertainty.ts in the TypeScript engine.
"""
from .canonical import ACCURACY_QUANTUM_ARCSEC
from .ranges import (ANALYTIC_BODIES, HEADLINE, MEASURED, VSOP_BODIES,
                     delta_t_sigma, jd_year)

_SMALL_BODIES = {"chiron", "ceres", "pallas", "juno", "vesta", "pholus"}
_URANIANS = {"cupido", "hades", "zeus", "kronos", "apollon", "admetos",
             "vulkanus", "poseidon"}


def bound_span(engine, body):
    """The span of years over which the accuracy table states a bound for
    this body, or None for a body the table does not cover."""
    if body in VSOP_BODIES or body == "moon" or body in ANALYTIC_BODIES:
        return HEADLINE
    if body == "pluto":
        return (MEASURED["pluto_pack"] if engine._has_pluto_pack()
                else MEASURED["pluto_meeus"])
    if body in _SMALL_BODIES:
        return MEASURED["small_bodies"]
    if body in _URANIANS:
        return MEASURED["uranian"]
    return None


def position_uncertainty(engine, body, jd_ut, zodiac="tropical"):
    """The two limits on a body's longitude at a UT instant.

    Returns {"body", "speed", "model_bound_arcsec", "bound_span",
    "delta_t_sigma_seconds", "clock_sigma_arcsec"}. `model_bound_arcsec` is
    the accuracy table's bound for the body, or None when the instant lies
    outside the span the bound was measured over (the position is still
    computed; no bound is claimed for it). `clock_sigma_arcsec` is the
    one-sigma effect of the delta-T uncertainty on this body's longitude.
    """
    pos = engine.position(body, jd_ut, zodiac=zodiac)
    year = jd_year(jd_ut)
    sigma = delta_t_sigma(year)
    span = bound_span(engine, body)
    inside = span is not None and span["from"] <= year <= span["to"]
    return {
        "body": body,
        "speed": pos["speed"],
        "model_bound_arcsec": (ACCURACY_QUANTUM_ARCSEC.get(body, 1)
                               if inside else None),
        "bound_span": span,
        "delta_t_sigma_seconds": sigma,
        "clock_sigma_arcsec": sigma * abs(pos["speed"]) / 86400.0 * 3600.0,
    }
