/**
 * Scan / rankMoments: TS-side ergonomics, so this is a deterministic unit test,
 * not a cross-language golden (there is no new ephemeris and the score is
 * user-supplied). Checks sample counts, ranking order, limit/minScore, the
 * sync/async equivalence, progress callbacks, and composition with the engine.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine } from "../src/chart.js";
import { loadNodeData } from "../src/node-loader.js";
import { separation } from "../src/electional.js";
import { scan, sampleCount, rankMoments, rankMomentsAsync } from "../src/scan.js";

let checks = 0;
let failures = 0;
function ok(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { failures++; console.error(`FAIL: ${msg}`); }
}
const approx = (a: number, b: number, t = 1e-9) => Math.abs(a - b) <= t;

// 1) Sample count is inclusive of both ends.
ok(sampleCount(0, 10, 1) === 11, "0..10 step 1 is 11 samples");
ok(sampleCount(5, 5, 1) === 1, "a zero-width range is one sample");
ok(sampleCount(10, 0, 1) === 0, "an inverted range is zero samples");
let threw = false;
try { sampleCount(0, 1, 0); } catch { threw = true; }
ok(threw, "a non-positive step throws");

// 2) scan visits every sample in time order.
const xs = scan({ start: 0, end: 4, step: 1 }, (jd) => jd * 2);
ok(xs.length === 5 && xs[0] === 0 && xs[4] === 8, "scan maps each sample in order");

// 3) rankMoments: a single-peaked score is ranked best-first, limited.
const target = 2451545.0;
const score = (jd: number) => -Math.abs(jd - target); // closer to target scores higher
const top3 = rankMoments(
  { start: target - 5, end: target + 5, step: 1, limit: 3 }, score,
);
ok(top3.length === 3, "limit caps the result length");
ok(approx(top3[0].jd, target), "the best moment is the peak");
ok(top3[0].score >= top3[1].score && top3[1].score >= top3[2].score,
   "results are sorted by score, highest first");

// 4) Deterministic tie-break: equal scores order by earliest instant.
const ties = rankMoments(
  { start: target - 1, end: target + 1, step: 1 }, () => 1.0,
);
ok(ties[0].jd < ties[1].jd && ties[1].jd < ties[2].jd,
   "tied scores break toward the earliest instant");

// 5) minScore drops everything below the floor.
const floored = rankMoments(
  { start: target - 5, end: target + 5, step: 1, minScore: -1.5 }, score,
);
ok(floored.every((m) => m.score >= -1.5), "minScore filters out low moments");
ok(floored.length === 3, "only |jd-target| <= 1 survives the floor");

// 6) Progress: the last callback reports completion.
let lastDone = -1; let lastTotal = -1;
scan({ start: 0, end: 9, step: 1, progressEvery: 4,
       onProgress: (d, t) => { lastDone = d; lastTotal = t; } }, (jd) => jd);
ok(lastDone === 10 && lastTotal === 10, "progress ends at (total, total)");

// 7) async matches sync exactly.
const wide = { start: target - 30, end: target + 30, step: 0.5 };
const sync = rankMoments({ ...wide, limit: 5 }, score);
const asyncTop = await rankMomentsAsync({ ...wide, limit: 5 }, score, 16);
ok(sync.length === asyncTop.length
   && sync.every((m, i) => approx(m.jd, asyncTop[i].jd) && approx(m.score, asyncTop[i].score)),
   "rankMomentsAsync returns the same ranking as rankMoments");

// 8) Composition with the engine: the best Sun-Moon conjunction in a lunation
//    really is a near-conjunction (small separation).
const here = dirname(fileURLToPath(import.meta.url));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));
const conj = rankMoments(
  { start: target, end: target + 30, step: 0.25, limit: 1 },
  (jd) => -separation(eng.longitude("sun", jd), eng.longitude("moon", jd)),
);
ok(conj.length === 1 && -conj[0].score < 0.5,
   `tightest Sun-Moon conjunction within a month is close (sep ${(-conj[0].score).toFixed(3)} deg)`);

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
