/**
 * astroengine directions -- primary directions to the angles.
 *
 * Primary (mundane) directions carry a planet, by the diurnal rotation of the
 * sphere, to one of the four angles; the arc of rotation, converted by a time
 * key, gives the age of the direction. This covers the well-defined subset:
 * direct directions of a body to the MC, IC, Ascendant, and Descendant.
 *
 * For a body at right ascension alpha and declination delta, latitude phi, and
 * right ascension of the MC (ramc): arc to MC = alpha - ramc; to IC = that
 * - 180; to the Ascendant = alpha - AD - ramc - 90; to the Descendant =
 * alpha + AD - ramc + 90, where AD = asin(tan phi * tan delta) is the
 * ascensional difference. A circumpolar body (|tan phi * tan delta| > 1) has no
 * oblique ascension, so its Ascendant/Descendant directions are undefined. Time
 * keys: Ptolemy 1 deg = 1 year, Naibod 0.9856473 deg = 1 year. Mirrors the
 * Python reference (astroengine/directions.py); the golden fixtures pin them.
 */
import { angles } from "./houses.js";
import { Engine, BodyId } from "./chart.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Degrees of arc that equal one year of life, per time key. */
export const KEYS: Record<string, number> = { ptolemy: 1.0, naibod: 0.9856473 };
export const TRADITIONAL: BodyId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
const YEAR_DAYS = 365.2422;

const mod360 = (x: number) => ((x % 360) + 360) % 360;

export interface DirectionArcs {
  mc: number;
  ic: number;
  asc: number | null;
  dsc: number | null;
}

/** Direct primary-direction arcs (degrees, [0, 360)) of a body at right
 *  ascension `alpha` and declination `delta` to the four angles, for latitude
 *  `phi` and right ascension of the MC `ramc`. `asc`/`dsc` are null when the
 *  body is circumpolar. */
export function directionArcs(alpha: number, delta: number, ramc: number, phi: number): DirectionArcs {
  const arcMc = mod360(alpha - ramc);
  const arcIc = mod360(alpha - ramc - 180);
  const t = Math.tan(phi * RAD) * Math.tan(delta * RAD);
  if (Math.abs(t) > 1) return { mc: arcMc, ic: arcIc, asc: null, dsc: null };
  const ad = Math.asin(t) * DEG;
  return {
    mc: arcMc, ic: arcIc,
    asc: mod360(alpha - ad - ramc - 90),
    dsc: mod360(alpha + ad - ramc + 90),
  };
}

/** Years of life corresponding to an arc of direction under a time key. */
export function directionYears(arc: number, key = "naibod"): number {
  return arc / KEYS[key];
}

export interface PrimaryDirection {
  body: string;
  angle: "MC" | "IC" | "ASC" | "DSC";
  arc: number;
  years: number;
  jd: number;
}

/** Direct primary directions of the bodies to the four angles within
 *  `maxYears`, by the given time key, sorted by years. */
export function primaryDirections(
  engine: Engine, natalJd: number, lat: number, lonEast: number,
  bodies: BodyId[] = TRADITIONAL, key = "naibod", maxYears = 90, yearLength = YEAR_DAYS,
): PrimaryDirection[] {
  const armc = angles(engine.data, natalJd, lat, lonEast)[2];
  const ramc = armc * DEG;
  const out: PrimaryDirection[] = [];
  const ANGLES = ["mc", "ic", "asc", "dsc"] as const;
  for (const b of bodies) {
    const p = engine.position(b, natalJd);
    const arcs = directionArcs(p.ra, p.dec, ramc, lat);
    for (const angle of ANGLES) {
      const arc = arcs[angle];
      if (arc === null) continue;
      const years = directionYears(arc, key);
      if (years <= maxYears) {
        out.push({ body: b, angle: angle.toUpperCase() as PrimaryDirection["angle"], arc, years, jd: natalJd + years * yearLength });
      }
    }
  }
  out.sort((a, b) => a.years - b.years);
  return out;
}
