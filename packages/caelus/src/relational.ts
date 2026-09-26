/**
 * astroengine relational -- diachronic and two-chart derivations for the
 * interpretation layer: transits vs natal, synastry, composite midpoints.
 *
 * Pure geometry on validated positions; no interpretation. Mirrors the MCP
 * transits/synastry/composite tools but returns structured hits the fact
 * projection can turn into citable atoms.
 */
import { mod } from "./core.js";
import {
  ASPECTS, BODIES, DEFAULT_ORBS, NOT_ASPECTABLE, SIGNS,
  type BodyId, type Chart, type Engine, type Zodiac,
} from "./chart.js";
import { aspectPhase, type AspectPhase } from "./electional.js";
import { compositeLongitudes, midpointLon } from "./derived.js";
import { lunarPhases } from "./events.js";
import { lunarEclipses, solarEclipses } from "./eclipses.js";

/** A transiting body aspecting a natal point. */
export interface TransitHit {
  transit: string;
  natal: string;
  aspect: string;
  orb: number;
  phase: AspectPhase;
  strength: number;
  /** Natal house the transiting body occupies (by natal cusps). */
  natalHouse: number;
}

/** An inter-chart aspect between person A's body and person B's body. */
export interface SynastryAspectHit {
  a: string;
  b: string;
  aspect: string;
  orb: number;
  strength: number;
}

export interface SynastryOverlays {
  /** Person A's bodies in person B's houses. */
  aInB: Record<string, number>;
  /** Person B's bodies in person A's houses. */
  bInA: Record<string, number>;
}

/** The composite chart's angles and houses.
 *
 *  A midpoint composite has no moment and no place, so its houses are a
 *  *convention*, not a computation: there is nothing to cast them from. The
 *  convention here is the common one -- the angles are the shorter-arc
 *  midpoints of the two charts' Ascendants and MCs, and the houses are equal
 *  from the composite Ascendant.
 *
 *  Two honest consequences, both of which callers should surface rather than
 *  hide. The composite MC does **not** generally land on the tenth cusp,
 *  because two independently averaged angles do not keep their quadrant
 *  relationship. And a different convention gives different houses for the
 *  same pair; `method` names which one produced these so a reading can say so
 *  and a later convention can be added beside it. */
export interface CompositeFrame {
  asc: number;
  mc: number;
  /** Twelve cusp longitudes, equal from the Ascendant. */
  cusps: number[];
  method: "equal-from-midpoint-asc";
}

/** A composite-chart body placement (midpoint method). */
export interface CompositePlacement {
  body: string;
  lon: number;
  sign: string;
  signDeg: number;
  /** House in the composite frame, when one was supplied. Absent when the
   *  composite has no frame, which is the case whenever either birth time is
   *  unknown. */
  house?: number;
}

function houseIndex(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    if (mod(lon - cusps[i], 360) < mod(cusps[(i + 1) % 12] - cusps[i], 360)) return i + 1;
  }
  return 12;
}

function aspectHits(
  lonA: number, speedA: number, labelA: string,
  lonB: number, speedB: number, labelB: string,
  maxOrb: number, orbs: Record<string, number>,
): Array<{ a: string; b: string; aspect: string; orb: number; phase: AspectPhase; strength: number }> {
  const sep = Math.abs(mod(lonA - lonB + 180, 360) - 180);
  const out: Array<{ a: string; b: string; aspect: string; orb: number; phase: AspectPhase; strength: number }> = [];
  for (const [name, angle] of Object.entries(ASPECTS)) {
    const limit = Math.min(maxOrb, orbs[name] ?? maxOrb);
    const orb = Math.abs(sep - angle);
    if (orb > limit) continue;
    const orbRounded = Math.round(orb * 100) / 100;
    out.push({
      a: labelA, b: labelB, aspect: name, orb: orbRounded,
      phase: aspectPhase(lonA, speedA, lonB, speedB, angle),
      strength: Math.max(0, 1 - orbRounded / limit),
    });
  }
  return out;
}

/**
 * Transiting bodies aspecting a natal chart at `transitJd`. Natal longitudes are
 * fixed; phase reflects the transiting body's motion toward the natal point.
 */
export function transitAspects(
  natal: Chart, engine: Engine, transitJd: number,
  opts: { maxOrb?: number; zodiac?: Zodiac; orbs?: Record<string, number>; bodies?: BodyId[] } = {},
): TransitHit[] {
  const maxOrb = opts.maxOrb ?? 3;
  const orbs = opts.orbs ?? DEFAULT_ORBS;
  const zodiac = opts.zodiac ?? natal.zodiac;
  const bodies = opts.bodies ?? (BODIES as unknown as BodyId[]);
  const natalBodies = bodies.filter((b) => natal.bodies[b] && !NOT_ASPECTABLE.has(b));
  // The node as a natal *target*: NOT_ASPECTABLE keeps it out of the pair
  // search (and out of the transiting set), but a transit to the natal node
  // is standard doctrine, so one node joins the target list explicitly --
  // the true node, or the mean node when it is the only one present, so a
  // chart carrying both does not double up.
  const node = natal.bodies.true_node ? "true_node"
    : natal.bodies.mean_node ? "mean_node" : null;
  if (node && bodies.includes(node)) natalBodies.push(node);
  const out: TransitHit[] = [];
  for (const tb of bodies) {
    if (NOT_ASPECTABLE.has(tb)) continue;
    const tp = engine.position(tb, transitJd, { zodiac });
    const natalHouse = houseIndex(tp.lon, natal.cusps);
    for (const nb of natalBodies) {
      const nLon = natal.bodies[nb]!.lon;
      for (const hit of aspectHits(tp.lon, tp.speed, tb, nLon, 0, nb, maxOrb, orbs)) {
        out.push({
          transit: hit.a, natal: hit.b, aspect: hit.aspect,
          orb: hit.orb, phase: hit.phase, strength: hit.strength, natalHouse,
        });
      }
    }
  }
  return out;
}

/**
 * Each transiting body's position in the natal houses at `transitJd` --
 * the "Saturn is moving through your 7th house" fact, independent of any
 * aspect being in orb. Bodies follow {@link transitAspects}' set (the
 * aspectable bodies by default).
 */
export function transitHouses(
  natal: Chart, engine: Engine, transitJd: number,
  opts: { zodiac?: Zodiac; bodies?: BodyId[] } = {},
): Array<{ body: string; house: number; lon: number }> {
  const zodiac = opts.zodiac ?? natal.zodiac;
  const bodies = opts.bodies ?? (BODIES as unknown as BodyId[]);
  const out: Array<{ body: string; house: number; lon: number }> = [];
  for (const tb of bodies) {
    if (NOT_ASPECTABLE.has(tb)) continue;
    const tp = engine.position(tb, transitJd, { zodiac });
    out.push({ body: tb, house: houseIndex(tp.lon, natal.cusps), lon: tp.lon });
  }
  return out;
}

/**
 * Inter-chart aspects between two natal charts (static snapshot; both speeds 0).
 */
export function synastryAspects(
  chartA: Chart, chartB: Chart, maxOrb = 4, orbs: Record<string, number> = DEFAULT_ORBS,
): SynastryAspectHit[] {
  const bodies = (BODIES as unknown as BodyId[]).filter(
    (b) => chartA.bodies[b] && chartB.bodies[b] && !NOT_ASPECTABLE.has(b),
  );
  const out: SynastryAspectHit[] = [];
  for (const ba of bodies) {
    const la = chartA.bodies[ba]!.lon;
    for (const bb of bodies) {
      const lb = chartB.bodies[bb]!.lon;
      for (const hit of aspectHits(la, 0, ba, lb, 0, bb, maxOrb, orbs)) {
        out.push({ a: hit.a, b: hit.b, aspect: hit.aspect, orb: hit.orb, strength: hit.strength });
      }
    }
  }
  return out;
}

/** House overlays both ways between two charts. */
export function synastryOverlays(chartA: Chart, chartB: Chart): SynastryOverlays {
  const bodies = (BODIES as unknown as BodyId[]).filter((b) => chartA.bodies[b] && chartB.bodies[b]);
  const aInB: Record<string, number> = {};
  const bInA: Record<string, number> = {};
  for (const b of bodies) {
    aInB[b] = houseIndex(chartA.bodies[b]!.lon, chartB.cusps);
    bInA[b] = houseIndex(chartB.bodies[b]!.lon, chartA.cusps);
  }
  return { aInB, bInA };
}

// ------------------------------------------------------------------ returns
/** A transiting body within orb of its own natal longitude -- a planetary
 *  return in progress. */
export interface ReturnHit {
  body: string;
  /** Which return this is (1 = first). From the elapsed time over the body's
   *  mean geocentric return interval, rounded -- exact whenever the body is
   *  actually in orb of its natal place. */
  nth: number;
  /** Orb from the natal longitude, degrees. */
  orb: number;
  /** Applying, separating, or exact, from the transiting motion. */
  phase: AspectPhase;
}

/** Mean geocentric zodiacal-return intervals, days. Inner planets circle the
 *  zodiac at the Sun's mean rate; the rest at their orbital periods; the
 *  node regresses in ~18.6 years. Used only to number a return that the
 *  longitude match has already found, so mean values are exact enough. */
const RETURN_PERIOD_DAYS: Record<string, number> = {
  sun: 365.2422, moon: 27.321582, mercury: 365.2422, venus: 365.2422,
  mars: 686.98, jupiter: 4332.59, saturn: 10759.22, uranus: 30688.5,
  chiron: 18409.0, true_node: 6798.38, mean_node: 6798.38,
};

/** Bodies whose returns recur within a human life (Neptune and Pluto never
 *  come back). One node joins per {@link transitAspects}' node rule. */
const RETURN_BODIES = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "chiron",
] as const;

/**
 * Planetary returns in progress at `transitJd`: each body of the natal chart
 * whose transiting position is within `orb` of its own natal longitude,
 * numbered by count. A newborn chart reports nothing (`nth >= 1`).
 */
export function activeReturns(
  natal: Chart, engine: Engine, transitJd: number,
  opts: { maxOrb?: number; zodiac?: Zodiac } = {},
): ReturnHit[] {
  const maxOrb = opts.maxOrb ?? 3;
  const zodiac = opts.zodiac ?? natal.zodiac;
  const node = natal.bodies.true_node ? "true_node"
    : natal.bodies.mean_node ? "mean_node" : null;
  const bodies: string[] = [...RETURN_BODIES];
  if (node) bodies.push(node);
  const out: ReturnHit[] = [];
  for (const body of bodies) {
    const np = natal.bodies[body];
    if (!np) continue;
    let tp: { lon: number; speed: number };
    try {
      tp = engine.position(body as BodyId, transitJd, { zodiac });
    } catch {
      continue; // a body outside its pack range contributes no return
    }
    const orb = Math.abs(mod(tp.lon - np.lon + 180, 360) - 180);
    if (orb > maxOrb) continue;
    const nth = Math.round((transitJd - natal.jdUt) / RETURN_PERIOD_DAYS[body]);
    if (nth < 1) continue;
    out.push({
      body, nth, orb: Math.round(orb * 100) / 100,
      phase: aspectPhase(tp.lon, tp.speed, np.lon, 0, 0),
    });
  }
  return out;
}

// ---------------------------------------------------------------- lunations
/** A principal syzygy (New or Full Moon) near an instant, located in the
 *  natal houses -- the "this lunation lands in your Nth house" fact. */
export interface LunationHit {
  /** Which syzygy: `"new"` or `"full"`. */
  phase: "new" | "full";
  /** The eclipse kind when the syzygy is eclipsed, else null. */
  eclipse: "solar" | "lunar" | null;
  /** Natal house the lunation's longitude falls in. */
  house: number;
  sign: string;
  /** Ecliptic longitude of the Moon at the syzygy (natal zodiac). */
  lon: number;
  /** Signed days from `transitJd` to the exact syzygy (positive = upcoming). */
  daysFromExact: number;
  /** Natal bodies conjunct the lunation within `onNatalOrb`. */
  onNatal: string[];
}

/**
 * New and Full Moons within `windowDays` of `transitJd`, each located in the
 * natal houses, flagged when eclipsed, and checked for conjunctions with
 * natal bodies. The window is an editorial convention, like the station
 * window: a lunation colors the days around it.
 */
export function activeLunations(
  natal: Chart, engine: Engine, transitJd: number,
  opts: { windowDays?: number; onNatalOrb?: number; zodiac?: Zodiac } = {},
): LunationHit[] {
  const win = opts.windowDays ?? 3;
  const onNatalOrb = opts.onNatalOrb ?? 3;
  const zodiac = opts.zodiac ?? natal.zodiac;
  const out: LunationHit[] = [];
  for (const [jd, name] of lunarPhases(engine, transitJd - win, transitJd + win)) {
    if (name !== "new" && name !== "full") continue;
    let eclipse: LunationHit["eclipse"] = null;
    if (name === "new") {
      if (solarEclipses(engine, jd - 1, jd + 1).length) eclipse = "solar";
    } else if (lunarEclipses(engine, jd - 1, jd + 1).length) eclipse = "lunar";
    const lon = engine.longitude("moon", jd, { zodiac });
    const onNatal = Object.entries(natal.bodies)
      .filter(([b, p]) => p && !NOT_ASPECTABLE.has(b)
        && Math.abs(mod(lon - p.lon + 180, 360) - 180) <= onNatalOrb)
      .map(([b]) => b)
      .sort();
    out.push({
      phase: name, eclipse, house: houseIndex(lon, natal.cusps),
      sign: SIGNS[Math.floor(mod(lon, 360) / 30)], lon,
      daysFromExact: jd - transitJd, onNatal,
    });
  }
  return out;
}

/**
 * Midpoint-composite placements for `bodies` from two birth instants.
 */
export function compositePlacements(
  engine: Engine, jdA: number, jdB: number,
  bodies: BodyId[] = BODIES as unknown as BodyId[], zodiac: Zodiac = "tropical",
  frame?: CompositeFrame,
): CompositePlacement[] {
  const lons = compositeLongitudes(engine, jdA, jdB, bodies, zodiac);
  return bodies.map((body) => {
    const lon = mod(lons[body], 360);
    const signIdx = Math.floor(lon / 30) % 12;
    return {
      body, lon, sign: SIGNS[signIdx], signDeg: mod(lon, 30),
      ...(frame ? { house: houseIndex(lon, frame.cusps) } : {}),
    };
  });
}

/**
 * The composite chart's frame: midpoint angles and equal houses from the
 * composite Ascendant. See {@link CompositeFrame} for what this is and is
 * not -- it is a convention over two charts' angles, not a chart cast for a
 * moment, and it needs both birth times to mean anything, which is why it
 * returns null when either chart has no real Ascendant to average.
 */
export function compositeFrame(
  chartA: Chart, chartB: Chart,
): CompositeFrame | null {
  const a = chartA.angles;
  const b = chartB.angles;
  if (!a || !b) return null;
  const asc = midpointLon(a.asc, b.asc);
  const mc = midpointLon(a.mc, b.mc);
  return {
    asc,
    mc,
    cusps: Array.from({ length: 12 }, (_, i) => mod(asc + i * 30, 360)),
    method: "equal-from-midpoint-asc",
  };
}

/** An aspect between two bodies of a composite chart.
 *
 *  Deliberately without a `phase`: a midpoint composite is a derived static
 *  figure, not a moment of sky, so it has no rate at which an orb closes and
 *  nothing in it applies or separates. */
export interface CompositeAspectHit {
  a: string;
  b: string;
  aspect: string;
  orb: number;
  strength: number;
}

/**
 * Aspects among the bodies of a midpoint-composite chart.
 *
 * Same aspect table, orb policy, and strength arithmetic as
 * {@link findAspects} on a real chart -- the only difference is that the
 * composite's bodies do not move, so no applying/separating phase is
 * reported. Pairs come back in body order with `a` before `b`.
 *
 * The node rule follows {@link transitAspects}: the non-aspecting points sit
 * out as they do natally, except that one node is admitted (`true_node` when
 * `bodies` carries it, otherwise `mean_node`), because the composite node is
 * read the same way the natal one is.
 */
export function compositeAspects(
  engine: Engine, jdA: number, jdB: number,
  bodies: BodyId[] = BODIES as unknown as BodyId[],
  opts: { orbs?: Record<string, number>; zodiac?: Zodiac } = {},
): CompositeAspectHit[] {
  const orbs = { ...DEFAULT_ORBS, ...(opts.orbs ?? {}) };
  const lons = compositeLongitudes(engine, jdA, jdB, bodies, opts.zodiac ?? "tropical");
  const node = bodies.includes("true_node" as BodyId) ? "true_node"
    : bodies.includes("mean_node" as BodyId) ? "mean_node" : null;
  const names = bodies.filter((b) =>
    (!NOT_ASPECTABLE.has(b) || b === node) && lons[b] !== undefined);
  const out: CompositeAspectHit[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const sep = Math.abs(mod(lons[a] - lons[b] + 180, 360) - 180);
      for (const [aspect, angle] of Object.entries(ASPECTS)) {
        const limit = orbs[aspect];
        if (limit === undefined) continue;
        const orb = Math.abs(sep - angle);
        if (orb > limit) continue;
        const orbRounded = Math.round(orb * 100) / 100;
        out.push({
          a, b, aspect, orb: orbRounded,
          strength: Math.max(0, 1 - orbRounded / limit),
        });
      }
    }
  }
  return out;
}
