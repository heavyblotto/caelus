/**
 * Enrich an {@link interpretationContext} with diachronic and Vedic facts at a
 * target instant — transits, time-lords, nakshatras, vargas, yogas.
 */
import { BODIES, type BodyId, type Chart, type Engine, type Zodiac } from "./chart.js";
import type { ContextOptions } from "./interpretation.js";
import { firdariaAt } from "./firdaria.js";
import { profectionAt } from "./profections.js";
import { zrAt } from "./releasing.js";
import {
  activeLunations, activeReturns, compositeAspects, compositeFrame, compositePlacements, synastryAspects,
  synastryOverlays, transitAspects, transitHouses,
} from "./relational.js";
import { stations } from "./events.js";
import { vimshottariAt } from "./vedic.js";
import { yogasAt } from "./yogas.js";

export interface EnrichTarget {
  jd: number;
  lat: number;
  lonEast: number;
  zodiac?: Zodiac;
}

export interface EnrichFlags {
  /** Project transit-to-natal aspects. Default true. */
  transits?: boolean;
  /** Project profection, ZR, firdaria, dasha. Default true. */
  timelords?: boolean;
  /** Project nakshatras, D9, yogas. Default true when chart zodiac is sidereal. */
  vedic?: boolean;
  /** Max orb for transit aspects. Default 3. */
  transitOrb?: number;
  /** Project transiting bodies' natal-house positions. Default true. */
  transitHouses?: boolean;
  /** Project stations near the target instant. Default true. */
  stations?: boolean;
  /** Half-width of the station window in days (an editorial convention:
   *  a station colors roughly the week around it). Default 5. */
  stationWindowDays?: number;
  /** Project planetary returns in progress. Default true. */
  returns?: boolean;
  /** Max orb for a return (transiting body vs its natal longitude). Default 3. */
  returnOrb?: number;
  /** Project lunations (New/Full Moons, eclipses) near the target instant.
   *  Default true. */
  lunations?: boolean;
  /** Half-width of the lunation window in days (an editorial convention,
   *  like the station window). Default 3. */
  lunationWindowDays?: number;
}

/** Bodies that station (the Sun and Moon never do; nodes sit out). */
const STATION_BODIES: BodyId[] = [
  "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "chiron",
] as BodyId[];

/**
 * Build {@link ContextOptions} extras for a natal chart evaluated at `target`.
 * Merge the result into `interpretationContext(chart, { ...base, ...extras })`.
 */
export function enrichContextOptions(
  engine: Engine, chart: Chart, target: EnrichTarget,
  flags: EnrichFlags = {},
): Pick<ContextOptions,
  "transits" | "transitHouses" | "stations" | "returns" | "lunations" | "timelords" | "vedic"> {
  const zodiac = target.zodiac ?? chart.zodiac;
  const { lat, lonEast } = target;
  const out: Pick<ContextOptions,
    "transits" | "transitHouses" | "stations" | "returns" | "lunations" | "timelords" | "vedic"> = {};

  if (flags.transits !== false) {
    out.transits = transitAspects(chart, engine, target.jd, {
      maxOrb: flags.transitOrb ?? 3, zodiac,
    });
  }

  if (flags.transitHouses !== false) {
    out.transitHouses = transitHouses(chart, engine, target.jd, { zodiac })
      .map(({ body, house }) => ({ body, house }));
  }

  if (flags.stations !== false) {
    const win = flags.stationWindowDays ?? 5;
    const hits: { body: string; direction: "retrograde" | "direct"; daysFromExact: number }[] = [];
    for (const body of STATION_BODIES) {
      try {
        for (const [jd, direction] of stations(engine, body, target.jd - win, target.jd + win)) {
          hits.push({ body, direction, daysFromExact: jd - target.jd });
        }
      } catch {
        // a body outside its pack range simply contributes no station atoms
      }
    }
    out.stations = hits;
  }

  if (flags.returns !== false) {
    out.returns = activeReturns(chart, engine, target.jd, {
      maxOrb: flags.returnOrb ?? 3, zodiac,
    });
  }

  if (flags.lunations !== false) {
    out.lunations = activeLunations(chart, engine, target.jd, {
      windowDays: flags.lunationWindowDays ?? 3, zodiac,
    }).map(({ phase, eclipse, house, sign, daysFromExact, onNatal }) =>
      ({ phase, eclipse, house, sign, daysFromExact, onNatal }));
  }

  if (flags.timelords !== false) {
    const prof = profectionAt(engine, chart.jdUt, target.jd, lat, lonEast, zodiac);
    const zr = zrAt(engine, chart.jdUt, target.jd, lat, lonEast);
    const fir = firdariaAt(engine, chart.jdUt, target.jd, lat, lonEast);
    const dasha = vimshottariAt(engine, chart.jdUt, target.jd, "sidereal:lahiri");
    out.timelords = {
      profection: prof,
      zr: {
        l1: zr.l1!, l2: zr.l2!, l3: zr.l3!, l4: zr.l4!, lot: zr.lot,
      },
      firdaria: { major: fir.major, sub: fir.sub, day: fir.day },
      dasha: {
        maha: dasha.maha!, antar: dasha.antar ?? null,
        pratyantar: dasha.pratyantar ?? null, moon_nakshatra: dasha.moon_nakshatra,
      },
    };
  }

  const wantVedic = flags.vedic ?? zodiac.startsWith("sidereal");
  if (wantVedic) {
    out.vedic = {
      nakshatraBodies: ["moon", "sun", "mars", "mercury", "jupiter", "venus", "saturn"],
      vargas: [9],
      yogas: yogasAt(engine, chart.jdUt, lat, lonEast, "sidereal:lahiri"),
    };
  }

  return out;
}

/** Synastry and composite atoms for two natal charts (A is the projection base). */
export function enrichSynastryOptions(
  engine: Engine, chartA: Chart, chartB: Chart,
  opts: { orb?: number; zodiac?: Zodiac } = {},
): Pick<ContextOptions, "synastry" | "composite" | "compositeAspects"> {
  const orb = opts.orb ?? 4;
  const zodiac = opts.zodiac ?? chartA.zodiac;
  return {
    synastry: {
      aspects: synastryAspects(chartA, chartB, orb),
      overlays: synastryOverlays(chartA, chartB),
    },
    composite: compositePlacements(
      engine, chartA.jdUt, chartB.jdUt, BODIES as unknown as BodyId[], zodiac,
      compositeFrame(chartA, chartB) ?? undefined,
    ),
    compositeAspects: compositeAspects(
      engine, chartA.jdUt, chartB.jdUt, BODIES as unknown as BodyId[], { zodiac },
    ),
  };
}
