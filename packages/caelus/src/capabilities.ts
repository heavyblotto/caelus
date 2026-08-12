/**
 * astroengine capabilities -- what this engine instance can compute, over what
 * span, from which source.
 *
 * The valid range differs per body and per data tier (an embedded browser
 * bundle carries Meeus Pluto, 1885-2099; a Node install with the Chebyshev
 * pack reaches 1700-2212), and until this module a caller had no way to ask
 * which engine it got. {@link engineCapabilities} answers from the loaded
 * {@link EngineData} plus a static table of *measured* spans -- the figures
 * mirror `docs/range-expansion.md` and `accuracy.json` ("validated, not
 * asserted": these numbers move only when the Horizons measurement does).
 *
 * Fitted spans come from the packs themselves (`jd0 + segments * seg_days`),
 * so a wider future pack reports its true span with no code change.
 */
import type { Engine } from "./chart.js";
import { EXTRA_BODIES } from "./chart.js";

/** A calendar-year span, inclusive. */
export interface BodySpan {
  from: number;
  to: number;
}

/** The position source active for a body in a given engine's data. */
export type BodySource =
  | "vsop87d"        // the eight planets + Sun (Earth's orbit)
  | "moon_chebyshev" // precise-Moon Chebyshev tier
  | "meeus_ch47"     // analytic Moon fallback
  | "chebyshev_pack" // Horizons-fitted pack (Pluto wide, Chiron, asteroids)
  | "meeus_ch37"     // analytic Pluto fallback
  | "kepler_pack"    // Uranian / fictitious bodies
  | "analytic"       // nodes, Lilith points
  | "synthetic";     // runtime-registered synthetic systems

export interface BodyCapability {
  body: string;
  source: BodySource;
  /** Measured validated span (vs Swiss Ephemeris / JPL Horizons), or null
   *  for analytic series with no stated bound and synthetic bodies. */
  validated: BodySpan | null;
  /** The pack's fitted span for packed sources. Outside it the body is
   *  reported in `Chart.unavailable` rather than computed. */
  fitted?: BodySpan;
}

export interface EngineCapabilities {
  /** The measured headline range (every default body holds across it). */
  headline: BodySpan;
  /** The headline as prose, e.g. "1850-2150" (kept in lockstep with
   *  `accuracy.json` by the claims registry). */
  headlineLabel: string;
  /** Whether the precise-Moon Chebyshev tier is loaded. */
  moonTier: "chebyshev" | "analytic";
  /** Whether the wide-range Pluto pack supersedes the Meeus series. */
  plutoTier: "chebyshev" | "meeus";
  /** One entry per body this engine can compute (see {@link Engine.bodies}). */
  bodies: BodyCapability[];
}

/** The measured headline band. The label is registry-pinned to accuracy.json:
 *  1850-2150. */
const HEADLINE: BodySpan = { from: 1850, to: 2150 };
const HEADLINE_LABEL = "1850-2150";

/** Measured spans that are narrower or wider than the headline
 *  (docs/range-expansion.md's table). */
const MEASURED: Record<string, BodySpan> = {
  pluto_pack: { from: 1700, to: 2212 },
  pluto_meeus: { from: 1885, to: 2099 },
  uranian: { from: 1800, to: 2149 },
};

const VSOP_BODIES = new Set([
  "sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
]);
const ANALYTIC_BODIES = new Set(["mean_node", "true_node", ...EXTRA_BODIES]);

/** Approximate calendar year for a Julian Day (for reporting spans). */
function jdYear(jd: number): number {
  return 2000 + (jd - 2451545.0) / 365.25;
}

function packSpan(pack: { jd0: number; seg_days: number; segments: unknown[] }): BodySpan {
  return {
    from: Math.ceil(jdYear(pack.jd0)),
    to: Math.floor(jdYear(pack.jd0 + pack.segments.length * pack.seg_days)),
  };
}

/**
 * What this engine can compute, over what span, from which source -- derived
 * from the loaded {@link EngineData} plus the measured-range table. Use it to
 * distinguish tiers at runtime (browser embedded vs Node with packs) instead
 * of assuming the headline applies to every body.
 *
 * @param engine The engine to introspect.
 * @returns Per-body sources with validated and fitted spans.
 */
export function engineCapabilities(engine: Engine): EngineCapabilities {
  const data = engine.data;
  const caps: BodyCapability[] = [];
  const packs = data.chebPacks ?? {};
  const kepler = data.keplerPack?.bodies ?? {};

  for (const body of engine.bodies()) {
    if (VSOP_BODIES.has(body)) {
      caps.push({ body, source: "vsop87d", validated: HEADLINE });
    } else if (body === "moon") {
      caps.push(data.moonCheb
        ? {
          body, source: "moon_chebyshev", validated: HEADLINE,
          fitted: packSpan(data.moonCheb),
        }
        : { body, source: "meeus_ch47", validated: HEADLINE });
    } else if (body === "pluto") {
      caps.push(packs.pluto
        ? {
          body, source: "chebyshev_pack", validated: MEASURED.pluto_pack,
          fitted: packSpan(packs.pluto),
        }
        : { body, source: "meeus_ch37", validated: MEASURED.pluto_meeus });
    } else if (body === "chiron" && data.chiron) {
      caps.push({
        body, source: "chebyshev_pack", validated: HEADLINE,
        fitted: packSpan(data.chiron),
      });
    } else if (body in packs) {
      caps.push({
        body, source: "chebyshev_pack", validated: HEADLINE,
        fitted: packSpan(packs[body]),
      });
    } else if (body in kepler) {
      caps.push({ body, source: "kepler_pack", validated: MEASURED.uranian });
    } else if (ANALYTIC_BODIES.has(body)) {
      caps.push({ body, source: "analytic", validated: null });
    } else {
      // Anything else reachable through bodies() is a runtime-registered
      // synthetic system: imaginary, so no validated span by construction.
      caps.push({ body, source: "synthetic", validated: null });
    }
  }

  return {
    headline: HEADLINE,
    headlineLabel: HEADLINE_LABEL,
    moonTier: data.moonCheb ? "chebyshev" : "analytic",
    plutoTier: packs.pluto ? "chebyshev" : "meeus",
    bodies: caps,
  };
}
