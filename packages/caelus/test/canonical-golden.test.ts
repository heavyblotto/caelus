/**
 * Canonical-mode golden: the tolerance-free pin. Every other golden compares
 * within a tolerance; canonical mode's whole promise is that the TS and
 * Python outputs are EQUAL -- integer for integer, byte for byte, digest for
 * digest -- so every comparison here is ===.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { julianDay } from "../src/core.js";
import { Engine, Zodiac, HouseSystem } from "../src/chart.js";
import { loadNodeData } from "../src/node-loader.js";
import {
  roundHalfUp, sha256Hex, canonicalEncode, canonicalDigest,
  canonicalChart, chartDigest, canonicalTimesMs, CanonicalGrid,
} from "../src/canonical.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "../../test/canonical-golden.json"), "utf8"));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

let checks = 0;
let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
};

// Exact deep equality -- no tolerance anywhere, that is the point.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepEq(id: string, got: any, want: any): void {
  if (Array.isArray(want)) {
    ok(Array.isArray(got) && got.length === want.length, `${id}: array length ${got?.length} vs ${want.length}`);
    if (Array.isArray(got)) for (let i = 0; i < want.length; i++) deepEq(`${id}[${i}]`, got[i], want[i]);
  } else if (want !== null && typeof want === "object") {
    const wk = Object.keys(want).sort();
    const gk = got !== null && typeof got === "object" ? Object.keys(got).sort() : [];
    ok(JSON.stringify(gk) === JSON.stringify(wk), `${id}: keys [${gk}] vs [${wk}]`);
    for (const k of wk) deepEq(`${id}.${k}`, got?.[k], want[k]);
  } else {
    ok(got === want, `${id}: ${JSON.stringify(got)} !== ${JSON.stringify(want)}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chartFor(spec: any) {
  return eng.chartAt(
    julianDay(spec.jd[0], spec.jd[1], spec.jd[2], spec.jd[3], spec.jd[4], spec.jd[5]),
    spec.lat, spec.lon,
    { houseSystem: spec.hs as HouseSystem, zodiac: spec.zodiac as Zodiac },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const c of G.cases as any[]) {
  switch (c.type) {
    case "round":
      deepEq(c.id, c.spec.values.map((v: number) => roundHalfUp(v)), c.result);
      break;
    case "sha256":
      deepEq(c.id, c.spec.inputs.map((s: string) => sha256Hex(s)), c.result);
      break;
    case "encode":
      ok(canonicalEncode(c.spec.value) === c.result, `${c.id}: encoding differs`);
      ok(canonicalDigest(c.spec.value) === sha256Hex(c.result), `${c.id}: digest of encoding`);
      break;
    case "times":
      deepEq(c.id, canonicalTimesMs(c.spec.jds), c.result);
      break;
    case "chart":
      deepEq(c.id, canonicalChart(chartFor(c.spec), { grid: c.spec.grid }), c.result);
      break;
    case "digests": {
      for (const spec of c.spec.charts) {
        const chart = chartFor(spec);
        for (const grid of c.spec.grids as CanonicalGrid[]) {
          const want = c.result[`${spec.id}/${grid}`];
          ok(chartDigest(chart, { grid }) === want,
            `digest ${spec.id}/${grid}: TS != Python`);
        }
      }
      break;
    }
    default:
      ok(false, `unknown case type ${c.type}`);
  }
}

// Behavioural guarantees, beyond the fixture:
{
  // Float rejection: the enforcement that makes digests trustworthy.
  let threw = false;
  try { canonicalEncode({ x: 1.5 }); } catch { threw = true; }
  ok(threw, "canonicalEncode rejects non-integer numbers");

  // Boundary tie-break: a longitude quantizing exactly onto a sign boundary
  // belongs to the LATER sign, and signDeg restarts at 0.
  const c0 = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "whole_sign");
  const hacked = {
    ...c0,
    bodies: {
      ...c0.bodies,
      sun: { ...c0.bodies.sun, lon: 30.0 }, // exactly 0 Taurus
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cc = canonicalChart(hacked as any);
  ok(cc.bodies.sun.sign === "Taurus" && cc.bodies.sun.signDeg === 0,
    `boundary lon 30.0 belongs to Taurus at 0 (got ${cc.bodies.sun.sign} ${cc.bodies.sun.signDeg})`);

  // Determinism: same chart, same digest, twice.
  const d1 = chartDigest(c0);
  const d2 = chartDigest(c0);
  ok(d1 === d2 && /^[0-9a-f]{64}$/.test(d1), "chartDigest is stable and hex-shaped");

  // The dms grid digests differently from arcsec (the rendering is part of
  // the content) but the underlying arcsec values agree.
  const ccArc = canonicalChart(c0, { grid: "arcsec" });
  const ccDms = canonicalChart(c0, { grid: "dms" });
  const [d, m, s] = ccDms.bodies.sun.lon as [number, number, number];
  ok(d * 3600 + m * 60 + s === ccArc.bodies.sun.lon,
    "dms triple recomposes to the arcsec value");
}

console.log(`\n${checks} checks, ${failures} failures (all exact equality)`);
process.exit(failures ? 1 : 0);
