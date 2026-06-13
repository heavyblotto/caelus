/**
 * astroengine scan -- long-scan ergonomics over the engine: a batched scan with
 * progress, and rankMoments to find the best instants by a score, synchronously
 * or without blocking the event loop.
 *
 * This is control flow over the validated primitives, not new ephemeris. The
 * score function is yours: compose it from positions, aspects, or the electional
 * state. scan imposes no scoring model. Because the core engine does no I/O,
 * these helpers (and the engine calls inside your score) run unchanged inside a
 * Web Worker; rankMomentsAsync additionally yields to the event loop so a
 * main-thread scan of hundreds of charts keeps the UI responsive.
 */

export interface ScanOptions {
  /** First instant, UT Julian Day (inclusive). */
  start: number;
  /** Last instant, UT Julian Day (inclusive). */
  end: number;
  /** Spacing between samples, days. Must be positive. */
  step: number;
  /** Called with (done, total) sample counts during the scan. */
  onProgress?: (done: number, total: number) => void;
  /** Samples between progress callbacks (default 256). */
  progressEvery?: number;
}

/** Number of samples a scan of these options visits. */
export function sampleCount(start: number, end: number, step: number): number {
  if (step <= 0) throw new Error("scan step must be positive");
  if (end < start) return 0;
  return Math.floor((end - start) / step + 1e-9) + 1;
}

/** Evaluate fn at each sampled instant in [start, end], returning the results in
 *  time order. */
export function scan<T>(opts: ScanOptions, fn: (jd: number) => T): T[] {
  const total = sampleCount(opts.start, opts.end, opts.step);
  const every = opts.progressEvery ?? 256;
  const out: T[] = [];
  for (let i = 0; i < total; i++) {
    out.push(fn(opts.start + i * opts.step));
    if (opts.onProgress && (i + 1) % every === 0) opts.onProgress(i + 1, total);
  }
  if (opts.onProgress && total > 0) opts.onProgress(total, total);
  return out;
}

export interface RankOptions extends ScanOptions {
  /** Keep only the top N moments (default: all). */
  limit?: number;
  /** Drop moments scoring below this (default: keep all). */
  minScore?: number;
}

export interface RankedMoment {
  jd: number;
  score: number;
}

function rank(moments: RankedMoment[], limit: number): RankedMoment[] {
  // Highest score first; ties broken by earliest instant, so the order is
  // deterministic and identical between the sync and async paths.
  moments.sort((a, b) => b.score - a.score || a.jd - b.jd);
  return limit === Infinity ? moments : moments.slice(0, limit);
}

/** Score every sampled instant and return the best, highest score first. */
export function rankMoments(
  opts: RankOptions, score: (jd: number) => number,
): RankedMoment[] {
  const minScore = opts.minScore ?? -Infinity;
  const moments: RankedMoment[] = [];
  scan(opts, (jd) => {
    const s = score(jd);
    if (s >= minScore) moments.push({ jd, score: s });
    return s;
  });
  return rank(moments, opts.limit ?? Infinity);
}

/** rankMoments that yields to the event loop every `chunk` samples, so a long
 *  main-thread scan does not freeze the UI. Same result as rankMoments. */
export async function rankMomentsAsync(
  opts: RankOptions, score: (jd: number) => number, chunk = 256,
): Promise<RankedMoment[]> {
  const minScore = opts.minScore ?? -Infinity;
  const total = sampleCount(opts.start, opts.end, opts.step);
  const moments: RankedMoment[] = [];
  for (let i = 0; i < total; i++) {
    const jd = opts.start + i * opts.step;
    const s = score(jd);
    if (s >= minScore) moments.push({ jd, score: s });
    if ((i + 1) % chunk === 0) {
      if (opts.onProgress) opts.onProgress(i + 1, total);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  if (opts.onProgress && total > 0) opts.onProgress(total, total);
  return rank(moments, opts.limit ?? Infinity);
}
