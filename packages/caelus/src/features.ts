/**
 * astroengine features -- a chart as a feature vector, similarity between
 * charts, and search for when the sky most resembles a target configuration.
 *
 * Each body's ecliptic longitude is circular, so it contributes a unit-circle
 * point (cos, sin), optionally weighted. Cosine similarity between two such
 * vectors is a weighted mean of cos(delta-longitude) per body: 1 when the
 * configurations coincide, falling off as bodies diverge. The deterministic
 * substrate for matching, retrieving, and searching chart configurations.
 * Mirrors the Python reference (astroengine/features.py); the golden pins them.
 */
import { DEG } from "./core.js";
import { Engine, BodyId, Zodiac } from "./chart.js";
import { rankMoments, RankedMoment } from "./scan.js";

export const DEFAULT_BODIES = ["sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto"];

/** Flat vector [w*cos(lon), w*sin(lon), ...] for the given (longitude, weight)
 *  pairs, in order. */
export function featureVector(weightedLons: [number, number][]): number[] {
  const out: number[] = [];
  for (const [lon, w] of weightedLons) {
    const r = lon * DEG;
    out.push(w * Math.cos(r), w * Math.sin(r));
  }
  return out;
}

/** Cosine similarity of two feature vectors, in [-1, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface FeatureOptions {
  bodies?: BodyId[];
  weights?: Record<string, number>;
  zodiac?: Zodiac;
}

/** Feature vector for the sky at jdUt over an ordered set of bodies. */
export function chartFeatures(engine: Engine, jdUt: number, opts: FeatureOptions = {}): number[] {
  const bodies = opts.bodies ?? (DEFAULT_BODIES as BodyId[]);
  const zodiac = opts.zodiac ?? "tropical";
  const wl: [number, number][] = bodies.map((b) => [
    engine.longitude(b, jdUt, { zodiac }),
    opts.weights?.[b] ?? 1.0,
  ]);
  return featureVector(wl);
}

/** Similarity between the sky at jdUt and a target feature vector. */
export function configurationFit(
  engine: Engine, jdUt: number, target: number[], opts: FeatureOptions = {},
): number {
  return cosineSimilarity(chartFeatures(engine, jdUt, opts), target);
}

export interface SearchConfigOptions extends FeatureOptions {
  start: number;
  end: number;
  step: number;
  limit?: number;
}

/** Rank the instants in [start, end] by how closely the sky resembles `target`
 *  (a feature vector), best first. Realization search over the feature space. */
export function searchConfigurations(
  engine: Engine, target: number[], opts: SearchConfigOptions,
): RankedMoment[] {
  return rankMoments(
    { start: opts.start, end: opts.end, step: opts.step, limit: opts.limit },
    (jd) => configurationFit(engine, jd, target, opts),
  );
}
