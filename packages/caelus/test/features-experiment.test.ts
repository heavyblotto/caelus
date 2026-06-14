/**
 * Features experiment -- a preregistered test of one load-bearing claim:
 * the chart feature representation carries REAL, REPEATABLE, TUNABLE signal.
 *
 * It does NOT test whether the symbolic system maps to human meaning (that
 * needs a labelled corpus). It tests the necessary precondition: that the
 * representation + similarity + configuration search recover real structure far
 * better than a matched null, deterministically, and that a body-weighting knob
 * changes recovery precision in the predicted direction.
 *
 * Protocol (fixed before the run):
 *  - Pick K target instants at fixed pseudo-random times (seeded).
 *  - SIGNAL: from a target's feature vector, search +/-W days at step S for the
 *    best-matching instant; recovery error = |found - target| days.
 *  - NULL: shuffle the same vector's components (not a real sky state) and
 *    search the same window. A matched control.
 *  - Predictions: mean signal error << mean null error (Delta large); recovery
 *    is deterministic on rerun; Moon-weighted recovery is sharp and
 *    slow-planet-only recovery is broad (tunable).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine } from "../src/chart.js";
import { julianDay } from "../src/core.js";
import { loadNodeData } from "../src/node-loader.js";
import { chartFeatures, searchConfigurations, configurationFit, FeatureOptions } from "../src/features.js";

const here = dirname(fileURLToPath(import.meta.url));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

// Deterministic PRNG so the whole experiment is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE = julianDay(2000, 1, 1, 0, 0, 0);
const K = 30;        // targets
const W = 90;        // search half-window, days
const STEP = 0.5;    // search step, days
const rng = mulberry32(0xCAE1);

// Off-grid target instants spread across ~11 years.
const targets: number[] = [];
for (let i = 0; i < K; i++) targets.push(BASE + 200 + rng() * 3800 + rng());

function recover(t0: number, opts: FeatureOptions, target?: number[]): number {
  const tgt = target ?? chartFeatures(eng, t0, opts);
  const best = searchConfigurations(eng, tgt,
    { start: t0 - W, end: t0 + W, step: STEP, limit: 1, ...opts })[0];
  return Math.abs(best.jd - t0);
}

function shuffle(v: number[], r: () => number): number[] {
  const a = v.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

// --- run ---
const sig = targets.map((t) => recover(t, {}));
const nul = targets.map((t) => {
  const target = shuffle(chartFeatures(eng, t, {}), mulberry32(t | 0));
  return recover(t, {}, target);
});
const mSig = mean(sig), mNul = mean(nul);

// Tunability shows up as PEAK SHARPNESS, not the argmax location: how far the
// match falls a fixed offset off the target. Weighting the fast Moon sharpens
// the peak (fine time resolution); slow planets alone keep it broad.
const OFF = 5; // days
const moonOpts: FeatureOptions = { weights: { moon: 8 } };
const slowOpts: FeatureOptions = { bodies: ["jupiter", "saturn", "uranus", "neptune", "pluto"] };
const moonDrop = mean(targets.map((t) =>
  1 - configurationFit(eng, t + OFF, chartFeatures(eng, t, moonOpts), moonOpts)));
const slowDrop = mean(targets.map((t) =>
  1 - configurationFit(eng, t + OFF, chartFeatures(eng, t, slowOpts), slowOpts)));

console.log("\nchart-feature recovery experiment (K=" + K + ", window +/-" + W + "d, step " + STEP + "d)");
console.log(`  signal recovery error (all bodies):  ${mSig.toFixed(3)} days`);
console.log(`  null   recovery error (shuffled):    ${mNul.toFixed(3)} days`);
console.log(`  Delta  (null - signal):              ${(mNul - mSig).toFixed(3)} days`);
console.log(`  tunable peak sharpness, fit drop at +${OFF}d: Moon-weighted ${moonDrop.toFixed(4)}  slow-only ${slowDrop.toFixed(5)}`);

// --- preregistered assertions ---
let checks = 0, failures = 0;
const ok = (c: boolean, m: string) => { checks++; if (!c) { failures++; console.error(`FAIL ${m}`); } };

ok(mSig <= STEP * 2, `signal recovers to grid resolution (${mSig.toFixed(3)} <= ${STEP * 2})`);
ok(mNul > 10, `null recovery is poor (${mNul.toFixed(3)} > 10)`);
ok(mNul - mSig > 10, `Delta is large (${(mNul - mSig).toFixed(3)} > 10)`);
ok(moonDrop > slowDrop * 5, `Moon weighting sharpens the peak (tunable: ${moonDrop.toFixed(4)} > 5x ${slowDrop.toFixed(5)})`);

// repeatability: a rerun is bit-identical.
ok(recover(targets[0], {}) === sig[0], "recovery is deterministic on rerun");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
