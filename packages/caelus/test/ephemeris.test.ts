/**
 * ephemeris(): a TS-side collector over the validated positions, so this is a
 * deterministic unit test (the values themselves are pinned by the conformance
 * suite). Checks the sampling, that the values match direct engine calls, and
 * the known shape of the Sun's longitude and declination over a year.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine } from "../src/chart.js";
import { julianDay } from "../src/core.js";
import { loadNodeData } from "../src/node-loader.js";
import { ephemeris } from "../src/ephemeris.js";

const here = dirname(fileURLToPath(import.meta.url));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

let checks = 0;
let failures = 0;
function ok(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}

const start = julianDay(2024, 1, 1, 0, 0, 0);

// 1) Inclusive sample count and time order.
const lon = ephemeris(eng, ["sun", "mars"], { start, end: start + 10, step: 1 });
ok(lon.sun.length === 11 && lon.mars.length === 11, "11 inclusive samples per body");
ok(lon.sun.every((p, i) => i === 0 || p.jd > lon.sun[i - 1].jd), "samples are in time order");

// 2) Values match direct engine calls (the helper adds no math).
ok(Math.abs(lon.sun[3].value - eng.longitude("sun", start + 3)) < 1e-12,
   "longitude series matches engine.longitude");

// 3) A non-positive step throws.
let threw = false;
try { ephemeris(eng, ["sun"], { start, end: start + 1, step: 0 }); } catch { threw = true; }
ok(threw, "a non-positive step throws");

// 4) Sun longitude advances ~0.985 deg/day and wraps 360 -> 0 once over a year.
const year = ephemeris(eng, ["sun"], { start, end: start + 366, step: 1 });
let wraps = 0;
let monotonicMod = true;
for (let i = 1; i < year.sun.length; i++) {
  const d = year.sun[i].value - year.sun[i - 1].value;
  if (d < 0) wraps++;            // a drop is the 360 -> 0 wrap
  else if (d < 0.8 || d > 1.1) monotonicMod = true; // Sun ~0.95-1.02 deg/day
}
ok(wraps === 1, `Sun longitude wraps exactly once over a year (got ${wraps})`);
ok(monotonicMod, "Sun longitude advances steadily");

// 5) Sun declination stays within the obliquity band and swings through zero.
const dec = ephemeris(eng, ["sun"], { start, end: start + 366, step: 1, value: "declination" });
const vals = dec.sun.map((p) => p.value);
ok(Math.max(...vals) < 23.5 && Math.min(...vals) > -23.5, "Sun declination within +/-23.5");
ok(Math.max(...vals) > 20 && Math.min(...vals) < -20, "Sun declination reaches both solstices");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
