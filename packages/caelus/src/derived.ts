/**
 * astroengine derived -- standard chart derivations built on the validated
 * primitives: returns, secondary progressions, solar arc directions, composite
 * charts, Davison charts.
 *
 * These are constructions on top of apparent positions (already checked against
 * Swiss Ephemeris), so this layer is time-mapping and arithmetic, not new
 * ephemeris. Mirrors the Python reference (astroengine/derived.py); the
 * golden fixtures pin the two together.
 */
import { mod } from "./core.js";
import { Engine, BodyId, Zodiac } from "./chart.js";
import { crossings } from "./events.js";

export const TROPICAL_YEAR = 365.24219; // mean tropical year, days

/** Shorter-arc midpoint of two longitudes (degrees). */
export function midpointLon(a: number, b: number): number {
  const d = mod(b - a + 180, 360) - 180; // signed shortest a -> b
  return mod(a + d / 2, 360);
}

// ---------------------------------------------------------------- returns
/** UT JDs in [jdStart, jdEnd] when `body` returns to its natal longitude.
 *  Outer-planet returns can show three crossings around a retrograde loop. */
export function returns(
  engine: Engine, body: BodyId, natalJd: number,
  jdStart: number, jdEnd: number, zodiac: Zodiac = "tropical", maxHits = 60,
): number[] {
  const natalLon = engine.longitude(body, natalJd, { zodiac });
  return crossings(engine, body, natalLon, jdStart, jdEnd, zodiac, maxHits);
}

export function solarReturn(
  engine: Engine, natalJd: number, jdStart: number, jdEnd: number,
  zodiac: Zodiac = "tropical",
): number[] {
  return returns(engine, "sun", natalJd, jdStart, jdEnd, zodiac);
}

export function lunarReturn(
  engine: Engine, natalJd: number, jdStart: number, jdEnd: number,
  zodiac: Zodiac = "tropical",
): number[] {
  return returns(engine, "moon", natalJd, jdStart, jdEnd, zodiac);
}

// ----------------------------------------------- secondary progressions
/** The JD whose real positions are the secondary-progressed positions for the
 *  age (targetJd - natalJd): one day of motion per year of life. */
export function progressedJd(
  natalJd: number, targetJd: number, yearLength = TROPICAL_YEAR,
): number {
  return natalJd + (targetJd - natalJd) / yearLength;
}

export function progressedLongitude(
  engine: Engine, body: BodyId, natalJd: number, targetJd: number,
  yearLength = TROPICAL_YEAR, zodiac: Zodiac = "tropical",
): number {
  return engine.longitude(body, progressedJd(natalJd, targetJd, yearLength), { zodiac });
}

// ----------------------------------------------------------- solar arc
/** Solar-arc direction angle (degrees, forward): how far the secondary-
 *  progressed Sun has moved from the natal Sun. Add it to any natal longitude. */
export function solarArc(
  engine: Engine, natalJd: number, targetJd: number,
  yearLength = TROPICAL_YEAR, zodiac: Zodiac = "tropical",
): number {
  const pjd = progressedJd(natalJd, targetJd, yearLength);
  const natalSun = engine.longitude("sun", natalJd, { zodiac });
  const progSun = engine.longitude("sun", pjd, { zodiac });
  return mod(progSun - natalSun, 360); // Sun only moves forward
}

export function directedLongitude(
  engine: Engine, body: BodyId, natalJd: number, targetJd: number,
  yearLength = TROPICAL_YEAR, zodiac: Zodiac = "tropical",
): number {
  const arc = solarArc(engine, natalJd, targetJd, yearLength, zodiac);
  return mod(engine.longitude(body, natalJd, { zodiac }) + arc, 360);
}

// ----------------------------------------------------------- composite
/** Midpoint-method composite: the shorter-arc midpoint of each body's two
 *  longitudes. Angles compose the same way via midpointLon on the two ASC/MC. */
export function compositeLongitudes(
  engine: Engine, jdA: number, jdB: number, bodies: BodyId[],
  zodiac: Zodiac = "tropical",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const body of bodies) {
    const la = engine.longitude(body, jdA, { zodiac });
    const lb = engine.longitude(body, jdB, { zodiac });
    out[body] = midpointLon(la, lb);
  }
  return out;
}

// ----------------------------------------------------------- davison
/** Time and place for a Davison relationship chart: the temporal midpoint and
 *  the geographic midpoint (mean latitude, shorter-arc mean longitude). Compute
 *  a normal chart at these to get the Davison chart. Returns [jd, lat, lonEast]. */
export function davisonParams(
  jdA: number, jdB: number, latA: number, lonEastA: number,
  latB: number, lonEastB: number,
): [number, number, number] {
  const midJd = 0.5 * (jdA + jdB);
  const midLat = 0.5 * (latA + latB);
  let midLon = midpointLon(mod(lonEastA, 360), mod(lonEastB, 360));
  if (midLon > 180) midLon -= 360; // back to (-180, 180] east-longitude
  return [midJd, midLat, midLon];
}
