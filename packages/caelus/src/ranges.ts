/**
 * astroengine validated ranges -- the measured spans behind the headline, and
 * the delta-T uncertainty that bounds what any ephemeris can say about ancient
 * dates.
 *
 * The engine's analytic series (VSOP87D, Meeus Moon/Pluto, the Kepler pack)
 * return numbers at any epoch; what is *validated* is narrower and per body.
 * This module is the one source of truth for those spans (mirroring
 * `docs/range-expansion.md` and `accuracy.json` -- "validated, not asserted":
 * the figures move only when the Horizons measurement does), consumed by
 * {@link engineCapabilities} for introspection and by chart assembly for
 * per-chart warnings.
 *
 * It is a leaf module (imports only core types) so both `chart.ts` and
 * `capabilities.ts` can use it without an import cycle.
 */
import type { EngineData, ChebData } from "./core.js";

/** A calendar-year span, inclusive. */
export interface BodySpan {
  from: number;
  to: number;
}

/** The measured headline band. The label is registry-pinned to accuracy.json.
 *  1000-3000: every body is packed across the span and measures sub-arcsecond
 *  on the frame-free basis (range-expansion.md Tier C); the ~3.3" uniform
 *  apparent floor is the IAU76/80-vs-Vondrak2011 frame term, not position
 *  error. The small bodies are fitted 1600-2484 (Horizons serves them only
 *  ~1600-2500) and report that narrower span via engineCapabilities. */
export const HEADLINE: BodySpan = { from: 1000, to: 3000 };
export const HEADLINE_LABEL = "1000-3000";

/** Measured spans that are narrower or wider than the headline
 *  (docs/range-expansion.md's table). */
export const MEASURED: Record<string, BodySpan> = {
  pluto_pack: { from: 1000, to: 3000 },
  pluto_meeus: { from: 1885, to: 2099 },
  uranian: { from: 1800, to: 2149 },
  // Small bodies are fitted and validated only where Horizons serves them
  // (~1600-2500); the fitted packs run 1600-2484. This is NARROWER than the
  // headline: an asteroid at 1200 is outside its pack and lands in
  // Chart.unavailable, so it must not claim the 1000-3000 headline.
  small_bodies: { from: 1600, to: 2484 },
};

export const VSOP_BODIES = new Set([
  "sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
]);

/** Analytic points with no stated range bound (docs/range-expansion.md). */
export const ANALYTIC_BODIES = new Set([
  "mean_node", "true_node", "mean_lilith", "true_lilith",
]);

/** Approximate calendar year for a Julian Day (for reporting spans). */
export function jdYear(jd: number): number {
  return 2000 + (jd - 2451545.0) / 365.25;
}

/** The sky's rotation rate: rotation-anchored quantities (angles, houses,
 *  rise and set) move 0.25 deg per minute of clock error. The chart warnings
 *  and the canonical epoch-sigma block both derive from this. */
export const ANGLE_SIGMA_DEG_PER_SECOND = 0.25 / 60;

/** The Moon's mean rate: ~0.55 arcsec per second of clock error, so a
 *  UT-tagged instant's Moon carries sigma(deltaT) at this rate. The slow
 *  bodies carry none -- planet-to-planet geometry lives in uniform time. */
export const MOON_SIGMA_DEG_PER_SECOND = 0.55 / 3600;

/** The threshold at which the epoch's clock-error uncertainty becomes
 *  visible at the app's display scale: 10 s of sigma is ~2.5 arcmin of
 *  angle smear, the point a reading would show. Below it, canonical output
 *  carries no epoch-sigma block, so modern charts' digests are unchanged. */
export const EPOCH_SIGMA_DISPLAY_SECONDS = 10;

/** A pack's fitted span in calendar years (`jd0 + segments * seg_days`). */
export function packSpan(pack: ChebData): BodySpan {
  return {
    from: Math.ceil(jdYear(pack.jd0)),
    to: Math.floor(jdYear(pack.jd0 + pack.segments.length * pack.seg_days)),
  };
}

/**
 * The measured validated span for a body under the given engine data, or
 * `null` for analytic points with no stated bound and unknown (synthetic)
 * bodies. Packed bodies report the headline: outside their *fitted* span
 * they are not computed at all (they land in `Chart.unavailable`), so the
 * validated question only arises inside it.
 */
export function validatedSpanFor(body: string, data: EngineData): BodySpan | null {
  // intp_apog falls through to null deliberately: a derived point (its own
  // EngineData field, not a chebPacks entry) with no measured span yet --
  // validate_swiss.py measures it against SE_INTP_APOG where pyswisseph
  // exists, and degree-scale differences are expected by construction.
  let span: BodySpan | null;
  if (VSOP_BODIES.has(body) || body === "moon") span = HEADLINE;
  else if (body === "pluto") {
    span = data.chebPacks?.pluto ? MEASURED.pluto_pack : MEASURED.pluto_meeus;
  } else if (body === "chiron" || body in (data.chebPacks ?? {})) {
    span = HEADLINE;
  } else if (body in (data.keplerPack?.bodies ?? {})) span = MEASURED.uranian;
  else span = null;

  // Era slabs extend the validated span (deep-time R1): a slab's span is
  // measured against its source at pack build, and the classical slab
  // adjoins the headline's earlier edge. The Moon's slabs live in their own
  // field beside its tiered packs; the Sun's geocentric position derives
  // from Earth's heliocentric one, so Earth's era slabs are the Sun's.
  const eras = body === "moon" ? data.moonEraPacks
    : body === "sun" ? data.earthEraPacks
    : data.eraPacks?.[body];
  if (eras?.length) {
    const from = Math.min(...eras.map((s) => packSpan(s).from));
    const to = Math.max(...eras.map((s) => packSpan(s).to));
    span = span
      ? { from: Math.min(span.from, from), to: Math.max(span.to, to) }
      : { from, to };
  }
  return span;
}

/** [year, sigma seconds]; see {@link deltaTSigma}. */
const DT_SIGMA: ReadonlyArray<readonly [number, number]> = [
  [-2000, 2520], [-1900, 2520], [-1800, 2160], [-1700, 2160], [-1600, 2160],
  [-1500, 1800], [-1400, 1800], [-1300, 1800], [-1200, 1440], [-1100, 1440],
  [-1000, 1440], [-900, 1440], [-800, 1080], [-720, 180], [-700, 170],
  [-600, 160], [-500, 150], [-400, 134], [-300, 120], [-200, 110],
  [-100, 100], [0, 129], [100, 155], [200, 145], [300, 114],
  [400, 65], [500, 40], [600, 52], [700, 100], [800, 153],
  [900, 180], [1000, 180], [1100, 153], [1200, 115], [1300, 51],
  [1400, 15], [1500, 15], [1600, 19], [1650, 20], [1700, 5],
  [1750, 2], [1800, 1], [1850, 0.5], [1900, 0.1], [2025, 0.05],
];

/**
 * One-sigma uncertainty of delta T (TT - UT1) in seconds at a calendar year.
 *
 * Before 1700 each century knot is the larger of two published numbers. The
 * first is the standard error HM Nautical Almanac Office tabulates with
 * Stephenson, Morrison & Hohenkerk's 2016 values (the "error" column of the
 * delta T table for -2000 to 2016, reproduced by the IERS Earth Orientation
 * Centre). The second is the amount by which the same authors' 2020 revision,
 * the spline `deltaT()` evaluates, moved the value at that epoch. Between 700
 * and 1300 the revision moved it by 100 to 180 s where the 2016 table states
 * 15 to 30 s, so the revision sets the figure there. Before -720 the
 * published values are themselves extrapolations and their errors are 1080 s
 * and up.
 *
 * From 1700 on the knots are this engine's own, a little wider than the
 * published errors because `deltaT()` interpolates observations at five-year
 * steps. Earlier than -2000 the table is extended at its slope over the last
 * thousand years (stated extrapolation), and the future grows quadratically
 * from the end of the measured tables. Linear between knots.
 *
 * This is what bounds ancient charts: at year 150 the position theories are
 * fine but sigma(deltaT) is minutes, which smears the fast movers -- the
 * Ascendant/MC rotate 0.25 deg per minute of clock error and the Moon moves
 * 0.55 arcsec per second -- while Jupiter barely notices. Chart warnings
 * report exactly that split.
 */
export function deltaTSigma(year: number): number {
  const TABLE = DT_SIGMA;
  if (year < TABLE[0][0]) {
    const [y0, s0] = TABLE[0];
    const [y1, s1] = TABLE[10];
    return s0 + (s0 - s1) / (y1 - y0) * (y0 - year);
  }
  const last = TABLE[TABLE.length - 1];
  if (year > last[0]) {
    // Future extrapolation: the long-term deltaT forecasts spread by a few
    // seconds per generation; grow quadratically from the measured end.
    const t = (year - last[0]) / 50;
    return last[1] + 2.0 * t * t;
  }
  for (let i = 1; i < TABLE.length; i++) {
    const [y1, s1] = TABLE[i];
    if (year <= y1) {
      const [y0, s0] = TABLE[i - 1];
      return s0 + (s1 - s0) * ((year - y0) / (y1 - y0));
    }
  }
  return last[1];
}
