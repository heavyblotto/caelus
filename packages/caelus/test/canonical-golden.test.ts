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
  canonicalChartWithRemainders, composeRemainders, nearBoundary,
  doubleBitsHex, doubleFromBitsHex, RefineRemainders,
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
    case "remainder-full": {
      const { remainders } = canonicalChartWithRemainders(chartFor(c.spec), { grid: c.spec.grid });
      deepEq(c.id, remainders, c.result);
      break;
    }
    case "near-boundary": {
      const { remainders } = canonicalChartWithRemainders(chartFor(c.spec), { grid: c.spec.grid });
      deepEq(c.id, nearBoundary(remainders as RefineRemainders,
        { maxMarginPerMille: c.spec.maxMarginPerMille }), c.result);
      break;
    }
    case "remainder-digests": {
      for (const spec of c.spec.charts) {
        const chart = chartFor(spec);
        for (const base of c.spec.bases as CanonicalGrid[]) {
          const want = c.result[`${spec.id}/${base}`];
          const { payload, remainders } = canonicalChartWithRemainders(chart, { grid: base });
          const rem = remainders as RefineRemainders;
          ok(rem.remainderGrid === want.remainderGrid,
            `remainder ${spec.id}/${base}: default target ${rem.remainderGrid} != ${want.remainderGrid}`);
          ok(canonicalDigest(rem) === want.sidecar,
            `remainder ${spec.id}/${base}: sidecar digest TS != Python`);
          const composed = composeRemainders(payload, rem);
          ok(canonicalDigest(composed) === want.composed,
            `remainder ${spec.id}/${base}: composed digest TS != Python`);
          // Telescoping: compose equals the finer grid computed directly.
          ok(canonicalDigest(composed) === chartDigest(chart, { grid: rem.remainderGrid }),
            `remainder ${spec.id}/${base}: compose != direct finer-grid chart`);
        }
      }
      break;
    }
    case "bits":
      deepEq(c.id, c.spec.values.map((v: number) => doubleBitsHex(v)), c.result);
      for (const [i, v] of (c.spec.values as number[]).entries()) {
        ok(Object.is(doubleFromBitsHex(c.result[i]), v),
          `bits round-trip [${i}]: ${c.result[i]} != ${v}`);
      }
      break;
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

  // ---- remainder sets ----

  // Requesting remainders never changes a byte of the base payload.
  const { payload, remainders } = canonicalChartWithRemainders(c0);
  ok(canonicalDigest(payload) === canonicalDigest(canonicalChart(c0)),
    "remainders leave the base payload untouched");
  const rem = remainders as RefineRemainders;
  ok(rem.for === canonicalDigest(payload), "sidecar binds to the payload digest");

  // Every residue is within half a quantum (arcsec base: quantum = 1000
  // sub-quanta everywhere, time/dist escrow included).
  ok(Object.values(rem.values).every((r) => Number.isInteger(r) && 2 * Math.abs(r) <= 1000),
    "all residues are integers within half a quantum");
  // The sidecar itself is canonical: encodable, digestable, float-free.
  ok(/^[0-9a-f]{64}$/.test(canonicalDigest(rem)), "sidecar digests cleanly");

  // Wrap-around: a longitude one hair under 360 must yield a SMALL modular
  // residue against its wrapped base of 0, not a full-circle one.
  const wrapped = {
    ...c0,
    bodies: { ...c0.bodies, sun: { ...c0.bodies.sun, lon: 359.99999999 } },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wr = canonicalChartWithRemainders(wrapped as any);
  ok((wr.payload.bodies.sun.lon as number) === 0, "wrap: base longitude quantizes to 0");
  const wrapRes = (wr.remainders as RefineRemainders).values["bodies.sun.lon"];
  ok(2 * Math.abs(wrapRes) <= 1000, `wrap: modular residue stays small (got ${wrapRes})`);
  ok(canonicalDigest(composeRemainders(wr.payload, wr.remainders as RefineRemainders))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    === chartDigest(wrapped as any, { grid: "milliarcsec" }),
    "wrap: telescoping still exact");

  // A value landing dead on a rounding boundary is flagged at margin 0.
  const onEdge = {
    ...c0,
    bodies: { ...c0.bodies, sun: { ...c0.bodies.sun, lon: 10 + 0.5 / 3600 } },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const er = canonicalChartWithRemainders(onEdge as any);
  const flags = nearBoundary(er.remainders as RefineRemainders);
  ok(flags.some((f) => f.path === "bodies.sun.lon" && f.marginPerMille === 0),
    "nearBoundary flags a value exactly on a rounding boundary");

  // A tampered binding refuses to compose.
  let refused = false;
  try {
    composeRemainders(payload, { ...rem, for: "0".repeat(64) });
  } catch { refused = true; }
  ok(refused, "composeRemainders refuses a sidecar bound to a different payload");

  // Bits mode: lossless escrow -- decode a leaf and requantize; it must
  // reproduce the payload's integer exactly.
  const bits = canonicalChartWithRemainders(c0, { remainder: "bits" });
  ok(bits.remainders.mode === "bits", "bits mode selected");
  const sunLonBack = doubleFromBitsHex(bits.remainders.values["bodies.sun.lon"] as string);
  ok(sunLonBack === c0.bodies.sun!.lon, "bits round-trip is exact");
  let bitsRefused = false;
  try { composeRemainders(bits.payload, bits.remainders); } catch { bitsRefused = true; }
  ok(bitsRefused, "bits sidecars do not compose to a grid");

  // No integer grid refines milliarcsec: the default must say so.
  let noFiner = false;
  try { canonicalChartWithRemainders(c0, { grid: "milliarcsec" }); }
  catch (e) { noFiner = String(e).includes("bits"); }
  ok(noFiner, "milliarcsec base without explicit remainder points at bits");
}

console.log(`\n${checks} checks, ${failures} failures (all exact equality)`);
process.exit(failures ? 1 : 0);
