/**
 * astroengine uncertainty -- how well a position is known.
 *
 * Two different things limit a position, and they are reported separately
 * because they are different kinds of number.
 *
 * The first is the model. The accuracy table states, for each body, the
 * largest error measured against JPL Horizons across the validated span. That
 * is a bound, not a sigma, and it exists only where it was measured.
 *
 * The second is the clock. A chart is cast for an instant in UT, positions
 * are computed in TT, and the difference between them, ΔT, is uncertain by a
 * known amount at each epoch. A body moving at v degrees per day turns a
 * clock error of s seconds into v·s/86400 degrees. For a modern chart this is
 * nothing. For an ancient one it is the larger term for the Moon and it is
 * negligible for Saturn.
 *
 * Mirrors the Python reference (astroengine/uncertainty.py).
 */
import { ACCURACY_QUANTUM_ARCSEC } from "./canonical.js";
import { Engine, type BodyId, type Zodiac } from "./chart.js";
import {
  ANALYTIC_BODIES, HEADLINE, MEASURED, VSOP_BODIES, deltaTSigma, jdYear,
  type BodySpan,
} from "./ranges.js";

const SMALL_BODIES = new Set(["chiron", "ceres", "pallas", "juno", "vesta", "pholus"]);
const URANIANS = new Set([
  "cupido", "hades", "zeus", "kronos", "apollon", "admetos", "vulkanus", "poseidon",
]);

/** The two limits on a body's longitude at an instant. */
export interface PositionUncertainty {
  body: string;
  /** Daily motion in longitude at the instant, degrees per day. */
  speed: number;
  /** The accuracy table's bound for the body in arcseconds: the largest
   *  error measured across the validated span. `null` when the instant lies
   *  outside the span the bound was measured over. */
  modelBoundArcsec: number | null;
  /** The span of years the bound was measured over, or `null` for a body the
   *  accuracy table does not cover. */
  boundSpan: BodySpan | null;
  /** One-sigma uncertainty of ΔT at the epoch, in seconds. */
  deltaTSigmaSeconds: number;
  /** One-sigma effect of the ΔT uncertainty on this body's longitude, in
   *  arcseconds. */
  clockSigmaArcsec: number;
}

/** The span of years over which the accuracy table states a bound for a body
 *  under this engine's data, or `null` for a body the table does not cover. */
export function boundSpan(engine: Engine, body: string): BodySpan | null {
  if (VSOP_BODIES.has(body) || body === "moon" || ANALYTIC_BODIES.has(body)) return HEADLINE;
  if (body === "pluto") {
    return engine.data.chebPacks?.pluto ? MEASURED.pluto_pack : MEASURED.pluto_meeus;
  }
  if (SMALL_BODIES.has(body)) return MEASURED.small_bodies;
  if (URANIANS.has(body)) return MEASURED.uranian;
  return null;
}

/**
 * How well a body's longitude is known at a UT instant: the accuracy table's
 * bound on the model, and the one-sigma effect of the ΔT uncertainty. The two
 * are different kinds of number and are not combined.
 *
 * The position is computed whether or not a bound applies. Outside the span a
 * bound was measured over, `modelBoundArcsec` is `null` and no bound is
 * claimed.
 *
 * @param engine The engine to compute the position with.
 * @param body Body id.
 * @param jdUt Julian Day (UT).
 * @param opts `zodiac`, as for {@link Engine.position}.
 * @returns The bound, its span, the ΔT sigma, and the clock term.
 * @example
 * ```ts
 * // The Moon in the year 100: no published bound that early, and the clock
 * // error of about 155 s moves it by more than a minute of arc.
 * positionUncertainty(engine, "moon", julianDay(100, 3, 1, 12, 0, 0, "julian"));
 * ```
 */
export function positionUncertainty(
  engine: Engine, body: BodyId, jdUt: number, opts: { zodiac?: Zodiac } = {},
): PositionUncertainty {
  const pos = engine.position(body, jdUt, { zodiac: opts.zodiac ?? "tropical" });
  const year = jdYear(jdUt);
  const sigma = deltaTSigma(year);
  const span = boundSpan(engine, body);
  const inside = span !== null && span.from <= year && year <= span.to;
  return {
    body,
    speed: pos.speed,
    modelBoundArcsec: inside ? ACCURACY_QUANTUM_ARCSEC[body] ?? 1 : null,
    boundSpan: span,
    deltaTSigmaSeconds: sigma,
    clockSigmaArcsec: sigma * Math.abs(pos.speed) / 86400.0 * 3600.0,
  };
}
