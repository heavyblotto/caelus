/**
 * astroengine ephemeris -- a time series of one value per body over a range, the
 * data behind a graphic ephemeris. A thin collector over the validated
 * positions (longitude, latitude, declination, right ascension, or speed), so
 * there is no new math here; the underlying values are the ones the conformance
 * suite already pins. Pair it with caelus-wheel's EphemerisGraph to draw it.
 */
import { Engine, BodyId, Zodiac } from "./chart.js";

export type EphemerisValue =
  | "longitude" | "latitude" | "declination" | "rightAscension" | "speed";

export interface EphemerisOptions {
  /** First instant, UT Julian Day (inclusive). */
  start: number;
  /** Last instant, UT Julian Day (inclusive). */
  end: number;
  /** Spacing between samples, days. Must be positive. */
  step: number;
  /** Which quantity to sample (default longitude). */
  value?: EphemerisValue;
  zodiac?: Zodiac;
}

export interface EphemerisPoint {
  jd: number;
  value: number;
}

/** Sample `value` for each body across [start, end], returning per-body series
 *  in time order. */
export function ephemeris(
  engine: Engine, bodies: BodyId[], opts: EphemerisOptions,
): Record<string, EphemerisPoint[]> {
  if (opts.step <= 0) throw new Error("ephemeris step must be positive");
  const value = opts.value ?? "longitude";
  const zodiac = opts.zodiac ?? "tropical";
  const out: Record<string, EphemerisPoint[]> = {};
  for (const b of bodies) out[b] = [];
  const total = Math.floor((opts.end - opts.start) / opts.step + 1e-9) + 1;
  for (let i = 0; i < total; i++) {
    const jd = opts.start + i * opts.step;
    for (const b of bodies) {
      let v: number;
      if (value === "longitude") {
        v = engine.longitude(b, jd, { zodiac });
      } else {
        const p = engine.position(b, jd, { zodiac });
        v = value === "latitude" ? p.lat
          : value === "declination" ? p.dec
            : value === "rightAscension" ? p.ra
              : p.speed;
      }
      out[b].push({ jd, value: v });
    }
  }
  return out;
}
