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

/** The measured headline band. The label is registry-pinned to accuracy.json:
 *  1850-2150. */
export const HEADLINE: BodySpan = { from: 1850, to: 2150 };
export const HEADLINE_LABEL = "1850-2150";

/** Measured spans that are narrower or wider than the headline
 *  (docs/range-expansion.md's table). */
export const MEASURED: Record<string, BodySpan> = {
  pluto_pack: { from: 1700, to: 2212 },
  pluto_meeus: { from: 1885, to: 2099 },
  uranian: { from: 1800, to: 2149 },
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
  if (VSOP_BODIES.has(body) || body === "moon") return HEADLINE;
  if (body === "pluto") {
    return data.chebPacks?.pluto ? MEASURED.pluto_pack : MEASURED.pluto_meeus;
  }
  if (body === "chiron" || body in (data.chebPacks ?? {})) return HEADLINE;
  if (body in (data.keplerPack?.bodies ?? {})) return MEASURED.uranian;
  return null;
}

/**
 * One-sigma uncertainty of delta T (TT - UT1) in seconds at a calendar year.
 *
 * Breakpoints from Morrison & Stephenson, "Historical values of the Earth's
 * clock error deltaT and the calculation of eclipses" (J. Hist. Astron. 35,
 * 2004), Table 1's sigma column; the telescopic era tapers to the IERS
 * measured span (effectively exact), and the future grows quadratically from
 * the end of the measured tables (extrapolation, stated as such). Linear
 * interpolation between breakpoints.
 *
 * This is what bounds ancient charts: at year 150 the position theories are
 * fine but sigma(deltaT) is minutes, which smears the fast movers -- the
 * Ascendant/MC rotate 0.25 deg per minute of clock error and the Moon moves
 * 0.55 arcsec per second -- while Jupiter barely notices. Chart warnings
 * report exactly that split.
 */
export function deltaTSigma(year: number): number {
  // [year, sigma seconds]
  const TABLE: [number, number][] = [
    [-1000, 640], [-500, 430], [0, 260], [500, 160], [1000, 55],
    [1200, 30], [1400, 20], [1600, 20], [1700, 5], [1750, 2],
    [1800, 1], [1850, 0.5], [1900, 0.1], [2025, 0.05],
  ];
  if (year <= TABLE[0][0]) return TABLE[0][1];
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
