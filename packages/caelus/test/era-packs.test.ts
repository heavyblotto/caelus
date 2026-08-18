/**
 * Era-pack plumbing (deep-time R1): synthetic slabs prove the chain — the
 * covering slab serves, the default slab wins a shared instant, the
 * uncovered instant refuses with the named error, and the span reports
 * extend to the union. Every shifted slab holds its control's vector rotated
 * +10 degrees, so a resolution mistake is the size of a planet, not a
 * rounding detail; shifted and control engines are identical but for the
 * slab. The fit-level boundary agreement of the real classical pack is
 * pinned by its own build (R5), not here.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ChebSeries, type ChebData, type EngineData } from "../src/core.js";
import { Engine } from "../src/chart.js";
import { loadNodeData } from "../src/node-loader.js";
import { validatedSpanFor } from "../src/ranges.js";
import { engineCapabilities } from "../src/capabilities.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = loadNodeData(join(here, "../../data"), "embedded", "full");

let checks = 0;
let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
};

const DEG = Math.PI / 180;
const mod360 = (x: number): number => ((x % 360) + 360) % 360;
const circDiff = (a: number, b: number): number =>
  Math.abs(mod360(a - b + 180) - 180);

/** A constant-position slab: `n` segments, one coefficient per channel,
 *  holding a fixed heliocentric vector over [jd0, jd0 + n*segDays). */
function constantSlab(
  xyz: [number, number, number], jd0: number, segDays: number, n: number,
): ChebData {
  const seg = xyz.map((v) => [v]);
  return {
    jd0, seg_days: segDays, scale: 1,
    segments: Array.from({ length: n }, () => seg),
  };
}

/** Rotate a heliocentric vector by +deg in ecliptic longitude. */
function shiftedLon(xyz: [number, number, number], deg: number): [number, number, number] {
  const r = deg * DEG;
  return [
    xyz[0] * Math.cos(r) - xyz[1] * Math.sin(r),
    xyz[0] * Math.sin(r) + xyz[1] * Math.cos(r),
    xyz[2],
  ];
}

/** Shifted-vs-control assertion: the era-slab engine's answer at the deep
 *  instant lands the marker's worth off the control's — not exactly 10,
 *  since a heliocentric rotation dilutes by |body|/|body−earth| in a
 *  geocentric frame, but unmistakably non-zero. */
function expectShift(
  shifted: Engine, control: Engine, body: string, jd: number, what: string,
  lo = 9, hi = 11,
): void {
  const a = shifted.position(body, jd).lon;
  const b = control.position(body, jd).lon;
  const d = circDiff(a, b);
  ok(d > lo && d < hi, `${what}: era slab served (expected ~10 deg off, got ${d.toFixed(4)})`);
}

// --- The generic pack chain (planet + observer) ---------------------------
const modern = data.chebPacks!.jupiter!;
const boundary = modern.jd0;
const seg = modern.seg_days;
const bodyConst = new ChebSeries(modern).xyz(boundary);
// The Earth slab is the observer's share of every geocentric position at
// depth: constant at Earth's real boundary value, identical in both engines.
const earthConst = new ChebSeries(data.earthPack!).xyz(boundary);
const earthSlab = constantSlab(earthConst, boundary - 4 * seg, seg, 4);

const deepJd = boundary - seg; // inside the slab, before the modern span
const sharedJd = boundary + seg / 2; // inside both
const modernJd = boundary + 2 * seg; // past the slab, inside the modern span

const engEra = new Engine({
  ...data,
  eraPacks: { jupiter: [constantSlab(shiftedLon(bodyConst, 10), boundary - 2 * seg, seg, 3)] },
  earthEraPacks: [earthSlab],
} as EngineData);
const engControl = new Engine({
  ...data,
  eraPacks: { jupiter: [constantSlab(bodyConst, boundary - 2 * seg, seg, 3)] },
  earthEraPacks: [earthSlab],
} as EngineData);
const engPlain = new Engine(data);

expectShift(engEra, engControl, "jupiter", deepJd, "planet chain at depth", 7, 13);

// The shared instant belongs to the default slab, so it matches the
// pack-only engine exactly; the modern span is unaffected by the slab.
const posSharedEra = engEra.position("jupiter", sharedJd).lon;
const posSharedPlain = engPlain.position("jupiter", sharedJd).lon;
ok(
  circDiff(posSharedEra, posSharedPlain) < 1e-9,
  `shared instant resolves to the default slab (${circDiff(posSharedEra, posSharedPlain).toExponential(2)} deg apart)`,
);
const posModernEra = engEra.position("jupiter", modernJd).lon;
const posModernPlain = engPlain.position("jupiter", modernJd).lon;
ok(
  circDiff(posModernEra, posModernPlain) < 1e-9,
  `modern span unaffected by the slab's presence`,
);

// The uncovered instant refuses with the named error; a chart there marks
// the body unavailable — and the era slab's chart computes it.
let threw = false;
try {
  engPlain.position("jupiter", deepJd);
} catch (e) {
  threw = e instanceof RangeError && /outside fitted range/.test((e as Error).message);
}
ok(threw, "position outside every slab throws the named RangeError");
ok(
  engPlain.chartAt(deepJd, 27.95, -82.46, "placidus").unavailable.includes("jupiter"),
  "uncovered body lands in chart.unavailable",
);
ok(
  !engEra.chartAt(deepJd, 27.95, -82.46, "placidus").unavailable.includes("jupiter"),
  "era slab keeps the body available",
);

// Spans report the union.
const spanData = {
  ...data,
  eraPacks: { jupiter: engEra.data.eraPacks!.jupiter },
} as EngineData;
const span = validatedSpanFor("jupiter", spanData)!;
ok(span !== null && span.from < 1000 && span.to >= 3000,
  `validated span extends to the slab (got ${span?.from}..${span?.to})`);
const jup = engineCapabilities(engEra).bodies.find((c) => c.body === "jupiter")!;
ok(
  jup.fitted !== undefined && jup.fitted.from < 1000,
  `capability report extends the fitted span (got ${JSON.stringify(jup.fitted)})`,
);

// --- The Moon chain (its own field, geocentric packs) ----------------------
const moonModern = new ChebSeries(data.moonCheb!);
const mBoundary = moonModern.jd0;
const mSeg = data.moonCheb!.seg_days;
const mConst = moonModern.xyz(mBoundary);
const mDeep = mBoundary - 2 * mSeg; // inside the slab, before the modern span
const engMoonEra = new Engine({
  ...data,
  moonEraPacks: [constantSlab(shiftedLon(mConst, 10), mBoundary - 3 * mSeg, mSeg, 4)],
} as EngineData);
const engMoonControl = new Engine({
  ...data,
  moonEraPacks: [constantSlab(mConst, mBoundary - 3 * mSeg, mSeg, 4)],
} as EngineData);
expectShift(engMoonEra, engMoonControl, "moon", mDeep, "moon chain at depth");

// --- The Earth chain ---------------------------------------------------------
// The witness is the Sun: geocentrically it is -Earth, so a 10-degree Earth
// slab moves its longitude by ~10 degrees, and the Sun needs no pack
// of its own.
const earthModern = new ChebSeries(data.earthPack!);
const eBoundary = earthModern.jd0;
const eSeg = data.earthPack!.seg_days;
const eDeep = eBoundary - eSeg;
const eConst = earthModern.xyz(eBoundary);
const engSunShifted = new Engine({
  ...data,
  earthEraPacks: [constantSlab(shiftedLon(eConst, 10), eBoundary - 3 * eSeg, eSeg, 4)],
} as EngineData);
const engSunControl = new Engine({
  ...data,
  earthEraPacks: [constantSlab(eConst, eBoundary - 3 * eSeg, eSeg, 4)],
} as EngineData);
expectShift(engSunShifted, engSunControl, "sun", eDeep, "earth chain at depth");

console.log(`era-packs: ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);


