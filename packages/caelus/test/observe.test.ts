/**
 * Unit invariants, edge-case physics, and 120-scenario empirical physical
 * reality benchmark for packages/caelus/src/observe.ts.
 *
 * Proves:
 * - Zero node:* imports and zero em-dashes in observe.ts
 * - Forward geometry invariants (flat/sloped 3D shadows, self-shadowing,
 *   grazing, polar midnight sun/night, Lahaina noon zenith, full/new Moon
 *   bright-limb guards, barometric elevation, camera glare, diurnal cycle)
 * - 120-scenario adversarial benchmark (60 authentic global scenes + 60 spoofs)
 *   asserting F1 >= 0.95, 0 false-impossible on authentic scenes, counterfactual
 *   diagnostic recovery, chronolocation minute accuracy, analytical geolocation
 *   accuracy (<5 km), and sub-2ms forward latency.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Engine } from "../src/chart.js";
import { DEG, julianDay, mod } from "../src/core.js";
import { planetaryHour } from "../src/electional.js";
import { lunarPhases, riseSet } from "../src/events.js";
import { loadNodeData } from "../src/node-loader.js";
import {
  DEFAULT_TOLERANCES,
  TWILIGHT_BANDS,
  sceneGeometry,
  verifyObservation,
  chronolocate,
  geolocate,
  type ObservedConstraints,
  type ObservationClaim,
} from "../src/observe.js";

const here = dirname(fileURLToPath(import.meta.url));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

let checks = 0;
let failures = 0;

function ok(cond: boolean, msg: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

function approx(a: number, b: number, tol: number, msg: string): void {
  const d = Math.abs(a - b);
  ok(Number.isFinite(a) && Number.isFinite(b) && d <= tol, `${msg} (${a} vs ${b}, diff ${d} > ${tol})`);
}

function wrap180(x: number): number {
  const r = mod(x + 180.0, 360.0) - 180.0;
  return r === -180.0 ? 180.0 : r;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = wrap180(lon2 - lon1) * DEG;
  const s1 = Math.sin(dp * 0.5);
  const s2 = Math.sin(dl * 0.5);
  const a = s1 * s1 + Math.cos(p1) * Math.cos(p2) * s2 * s2;
  return 2.0 * 6371.0 * Math.asin(Math.min(1.0, Math.sqrt(Math.max(0.0, a))));
}

/** Deterministic PRNG (Mulberry32) for repeatable measurement noise. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  };
}

/** Uniform noise in [-amp, +amp]. */
function jitter(rng: () => number, amp: number): number {
  return (rng() * 2.0 - 1.0) * amp;
}

// ================================================== 1. Runtime & source purity

const observeSrc = readFileSync(join(here, "../../src/observe.ts"), "utf8");
ok(!/from\s+["']node:/.test(observeSrc), "observe.ts has zero node:* imports");
ok(!/\bprocess\./.test(observeSrc), "observe.ts has zero process references");
ok(!observeSrc.includes("\u2014"), "observe.ts has zero em-dashes");
ok(DEFAULT_TOLERANCES.shadowBearingDeg === 10.0, "DEFAULT_TOLERANCES exported");
ok(TWILIGHT_BANDS.civil[0] === -6.0 && TWILIGHT_BANDS.civil[1] === 0.0, "TWILIGHT_BANDS exported");

// ================================================== 2. Unit physics invariants

{
  // Flat ground shadow equations + NH clockwise sweep
  const jdNyc = julianDay(2026, 6, 21, 18, 0, 0);
  const sc = sceneGeometry(eng, jdNyc, 40.7128, -74.006, {
    cameraAimAzDeg: 180,
    cameraAimAltDeg: 5,
    prevJdUt: jdNyc - 0.8,
    deadlineJdUt: jdNyc + 45 / 1440,
  });
  ok(sc.sun.isDay && sc.sun.twilightStage === "day", "NYC summer afternoon is day");
  ok(sc.shadow.cast && !sc.shadow.selfShadowed, "NYC casts flat shadow");
  approx(
    wrap180(sc.shadow.bearingDeg! - mod(sc.sun.azimuthDeg + 180, 360)),
    0, 1e-12, "shadow bearing is anti-solar",
  );
  approx(
    sc.shadow.lengthRatio!,
    1.0 / Math.tan(sc.sun.altitudeApparentDeg * DEG),
    1e-12, "flat shadow length_ratio = 1/tan(altApp)",
  );
  approx(sc.shadow.lengthRatio!, sc.shadow.horizontalLengthRatio!, 1e-12, "flat horiz == lengthRatio");
  ok(sc.shadow.rateBearingDegPerMin! > 0, "NH shadow sweeps clockwise (+)");
  ok(sc.lighting !== null && sc.lighting.glareRisk === "none", "camera lighting computed");
  ok(sc.diurnal.sunriseJd! < sc.diurnal.solarNoonJd! && sc.diurnal.solarNoonJd! < sc.diurnal.sunsetJd!,
    "diurnal sunrise < noon < sunset");
  ok(sc.chronosense.nightCrossed === true, "nightCrossed across 0.8d back-span");
  ok(sc.chronosense.deadline?.phase === "applying", "deadline +45m is applying");
  ok(sc.chronosense.line.length > 40 && sc.chronosense.line.length < 220, "chronosense line compact");
  ok(sc.chronosense.line.includes("+night") && sc.chronosense.line.includes("due +45m applying"),
    "chronosense line tags");

  // Exact & separating deadline phases
  const scExact = sceneGeometry(eng, jdNyc, 40.7128, -74.006, { deadlineJdUt: jdNyc + 0.5 / 1440 });
  const scSep = sceneGeometry(eng, jdNyc, 40.7128, -74.006, { deadlineJdUt: jdNyc - 10 / 1440 });
  ok(scExact.chronosense.deadline?.phase === "exact", "deadline within 1m is exact");
  ok(scSep.chronosense.deadline?.phase === "separating", "past deadline is separating");

  // Camera glare thresholds: direct / high / moderate / none
  const direct = sceneGeometry(eng, jdNyc, 40.7128, -74.006, {
    cameraAimAzDeg: sc.sun.azimuthDeg, cameraAimAltDeg: sc.sun.altitudeApparentDeg - 5,
  });
  const high = sceneGeometry(eng, jdNyc, 40.7128, -74.006, {
    cameraAimAzDeg: sc.sun.azimuthDeg, cameraAimAltDeg: sc.sun.altitudeApparentDeg - 25,
  });
  const modGlare = sceneGeometry(eng, jdNyc, 40.7128, -74.006, {
    cameraAimAzDeg: sc.sun.azimuthDeg, cameraAimAltDeg: sc.sun.altitudeApparentDeg - 50,
  });
  ok(direct.lighting?.glareRisk === "direct", "glare direct <= 15 deg");
  ok(high.lighting?.glareRisk === "high", "glare high <= 35 deg");
  ok(modGlare.lighting?.glareRisk === "moderate", "glare moderate <= 65 deg");

  // Sloped ground: uphill shortens, downhill lengthens, steep away self-shadows
  const jdLate = julianDay(2026, 3, 21, 22, 0, 0); // low west Sun (~12 deg)
  const scFlat = sceneGeometry(eng, jdLate, 40.7128, -74.006);
  const sunAz = scFlat.sun.azimuthDeg;
  // Ground facing the Sun (downhill toward Sun) -> shadow cast uphill -> shorter
  const scUphill = sceneGeometry(eng, jdLate, 40.7128, -74.006, {
    slopeDeg: 15, slopeAzimuthDeg: sunAz,
  });
  // Ground sloping away from Sun (downhill opposite Sun), still lit -> longer shadow
  const scDownhill = sceneGeometry(eng, jdLate, 40.7128, -74.006, {
    slopeDeg: 5, slopeAzimuthDeg: mod(sunAz + 180, 360),
  });
  // Steep slope facing away from low Sun -> self-shadowed (n . s <= 0)
  const scSelf = sceneGeometry(eng, jdLate, 40.7128, -74.006, {
    slopeDeg: 30, slopeAzimuthDeg: mod(sunAz + 180, 360),
  });
  ok(scUphill.shadow.cast && scUphill.shadow.lengthRatio! < scFlat.shadow.lengthRatio!,
    "uphill shadow shorter than flat");
  ok(scDownhill.shadow.cast && scDownhill.shadow.lengthRatio! > scFlat.shadow.lengthRatio!,
    "downhill shadow longer than flat");
  ok(scUphill.shadow.lengthRatio! >= scUphill.shadow.horizontalLengthRatio!,
    "3D sloped lengthRatio >= horizontalLengthRatio");
  ok(!scSelf.shadow.cast && scSelf.shadow.selfShadowed, "steep away slope is selfShadowed");

  // Barometric elevation reduces refraction near horizon
  const jdDen = julianDay(2026, 3, 21, 13, 15, 0);
  const scSea = sceneGeometry(eng, jdDen, 39.7392, -104.9903, { elevationM: 0 });
  const scMile = sceneGeometry(eng, jdDen, 39.7392, -104.9903, { elevationM: 1609 });
  ok(scMile.sun.altitudeApparentDeg < scSea.sun.altitudeApparentDeg,
    "higher elevation reduces horizon refraction");

  // Southern hemisphere counterclockwise shadow sweep
  const jdSyd = julianDay(2026, 1, 15, 2, 0, 0);
  const scSyd = sceneGeometry(eng, jdSyd, -33.8688, 151.2093);
  ok(scSyd.shadow.rateBearingDegPerMin! < 0, "SH shadow sweeps counterclockwise (-)");

  // Polar midnight sun & polar night: zero NaNs, clean nulls
  const jdPsun = julianDay(2026, 6, 21, 23, 0, 0);
  const scPsun = sceneGeometry(eng, jdPsun, 78.2, 15.6);
  ok(scPsun.sun.isDay && scPsun.diurnal.sunriseJd === null && scPsun.diurnal.sunsetJd === null,
    "polar midnight sun has no sunrise/sunset");
  ok(scPsun.diurnal.minutesToNextTwilight === null && scPsun.chronosense.line.includes("polar"),
    "polar midnight sun reports polar twilight");
  const jdPnight = julianDay(2026, 12, 21, 11, 0, 0);
  const scPnight = sceneGeometry(eng, jdPnight, 78.2, 15.6);
  ok(!scPnight.sun.isDay && !scPnight.shadow.cast && scPnight.diurnal.sunriseJd === null,
    "polar night has no shadow and no sunrise");
  ok(Number.isFinite(scPsun.sun.altitudeApparentDeg) && Number.isFinite(scPnight.sun.altitudeApparentDeg),
    "polar altitudes finite");

  // Unconstrained verification oracle
  const vOracle = verifyObservation(eng, { jdUt: jdNyc, lat: 40.7128, lonEast: -74.006 });
  ok(vOracle.verdict === "unconstrained" && vOracle.consistencyScore === null && vOracle.diagnostics === null,
    "unconstrained verification oracle");

  // Near-zenith Lahaina noon: shadow bearing marked indeterminate, no false failure
  const geoSub = geolocate(eng, jdNyc, {
    shadowBearingDeg: sc.shadow.bearingDeg!,
    shadowLengthRatio: sc.shadow.lengthRatio!,
  });
  const vZen = verifyObservation(
    eng,
    { jdUt: jdNyc, lat: geoSub.subsolar.lat, lonEast: geoSub.subsolar.lon },
    { shadowBearingDeg: 211.0, shadowLengthRatio: 0.01 },
  );
  ok(vZen.checks[0].status === "indeterminate" && vZen.verdict === "consistent",
    "near-zenith shadow bearing marked indeterminate");

  // Full Moon and New Moon indeterminate bright-limb/waxing guards
  const phases = lunarPhases(eng, julianDay(2026, 6, 1), julianDay(2026, 7, 15));
  const fullJd = phases.find(([, n]) => n === "full")![0];
  const newJd = phases.find(([, n]) => n === "new")![0];
  const subFull = geolocate(eng, fullJd, { twilight: "day" }).subsolar;
  const vFull = verifyObservation(
    eng,
    { jdUt: fullJd, lat: 0, lonEast: wrap180(subFull.lon + 180) },
    { moonBrightLimbDeg: 144, moonWaxing: true, twilight: "night" },
  );
  ok(vFull.checks.find((c) => c.field === "moonBrightLimbDeg")?.status === "indeterminate",
    "full Moon bright limb indeterminate");
  ok(vFull.checks.find((c) => c.field === "moonWaxing")?.status === "indeterminate",
    "full Moon waxing indeterminate");
  ok(vFull.verdict === "consistent", "full Moon indeterminate does not false-fail");

  const subNew = geolocate(eng, newJd, { twilight: "day" }).subsolar;
  const vNew = verifyObservation(
    eng,
    { jdUt: newJd, lat: subNew.lat, lonEast: subNew.lon },
    { moonBrightLimbDeg: 42, moonWaxing: false, twilight: "day" },
  );
  ok(vNew.checks.find((c) => c.field === "moonBrightLimbDeg")?.status === "indeterminate",
    "new Moon bright limb indeterminate");
  ok(vNew.verdict === "consistent", "new Moon indeterminate does not false-fail");

  // bodiesVisible daylight vs night
  const vSatDay = verifyObservation(
    eng,
    { jdUt: jdNyc, lat: 40.7128, lonEast: -74.006 },
    { bodiesVisible: ["saturn"] },
  );
  ok(vSatDay.verdict === "impossible", "Saturn naked-eye in broad daylight is impossible");

  // Moonlight shadow at night with bright Moon
  const jdLonNight = julianDay(2024, 3, 20, 22, 0, 0);
  const scLonNight = sceneGeometry(eng, jdLonNight, 51.5, -0.12, { bortle: 4 });
  ok(scLonNight.moon.shadowCast && scLonNight.moon.shadowBearingDeg !== null,
    "bright Moon at night casts moonlight shadow");

  // Chronolocate polar winter pruning (100% pruned) & midnight wrap
  const cPolar = chronolocate(
    eng,
    { lat: 78.2, lonEast: 15.6 },
    { shadowBearingDeg: 0, shadowLengthRatio: 2.0 },
    julianDay(2026, 12, 15, 0, 0, 0),
    julianDay(2026, 12, 25, 0, 0, 0),
  );
  ok(cPolar.daysPruned === 10 && cPolar.daysScanned === 0 && cPolar.windows.length === 0,
    "polar winter shadow 100% pruned");

  const jdLonMid = julianDay(2026, 3, 21, 0, 0, 0);
  const cMid = chronolocate(
    eng, { lat: 51.5, lonEast: 0 }, { twilight: "night" },
    jdLonMid - 0.5, jdLonMid + 0.5,
  );
  ok(cMid.windows.length === 1 && cMid.windows[0].jdStart < jdLonMid && cMid.windows[0].jdEnd > jdLonMid,
    "chronolocate merges midnight wrap into 1 window");

  // Geolocate antimeridian Fiji + wrap-around box + subsolar/sublunar zenith identity
  const jdFiji = julianDay(2026, 6, 21, 2, 0, 0);
  const scFiji = sceneGeometry(eng, jdFiji, -16.8, 179.9);
  const gFiji = geolocate(eng, jdFiji, {
    sunAltitudeDeg: scFiji.sun.altitudeApparentDeg,
    moonAltitudeDeg: scFiji.moon.altitudeApparentDeg,
    tolerances: { sunAltitudeDeg: 1.5, moonAltitudeDeg: 1.5 },
  });
  ok(gFiji.method === "grid" && gFiji.candidates.length >= 1, "Fiji grid geolocation found candidate");
  const fijiCand = gFiji.candidates.find((c) => haversineKm(c.lat, c.lon, -16.8, 179.9) < 30);
  ok(fijiCand !== undefined, "Fiji antimeridian candidate within 30 km");
  ok(fijiCand !== undefined && fijiCand.lonRange[0] > 170 && fijiCand.lonRange[1] < -170,
    "Fiji lonRange wraps across +/-180 cleanly");

  // Wrap-around longitude box (lonMin=170 > lonMax=-170)
  const gWrapBox = geolocate(
    eng, jdFiji,
    {
      sunAltitudeDeg: scFiji.sun.altitudeApparentDeg,
      moonAltitudeDeg: scFiji.moon.altitudeApparentDeg,
      tolerances: { sunAltitudeDeg: 1.5, moonAltitudeDeg: 1.5 },
    },
    { latMin: -30, latMax: 0, lonMin: 170, lonMax: -170 },
  );
  ok(gWrapBox.candidates.length === 1 && haversineKm(gWrapBox.candidates[0].lat, gWrapBox.candidates[0].lon, -16.8, 179.9) < 30,
    "geolocate supports wrap-around lonMin > lonMax box");

  // Subsolar/sublunar identity check
  const scAtSub = sceneGeometry(eng, jdFiji, gFiji.subsolar.lat, gFiji.subsolar.lon);
  const scAtSubM = sceneGeometry(eng, jdFiji, gFiji.sublunar.lat, gFiji.sublunar.lon);
  approx(scAtSub.sun.altitudeTrueDeg, 90.0, 1e-4, "subsolar point has Sun at zenith");
  approx(scAtSubM.moon.altitudeTrueDeg, 90.0, 1e-4, "sublunar point has Moon at zenith");

  // Fast diurnal spline & planetary hour exact parity against riseSet & planetaryHour
  const diurnalProbes: Array<[string, number, number, number, number]> = [
    ["NYC-pre-sunrise", julianDay(2026, 6, 21, 7, 30, 0), 40.7128, -74.006, 0],
    ["NYC-midday", julianDay(2026, 6, 21, 18, 0, 0), 40.7128, -74.006, 0],
    ["NYC-late-night", julianDay(2026, 6, 22, 3, 15, 0), 40.7128, -74.006, 0],
    ["Denver-elev", julianDay(2026, 3, 21, 13, 15, 0), 39.7392, -104.9903, 1609],
    ["Sydney-midday", julianDay(2026, 1, 15, 2, 0, 0), -33.8688, 151.2093, 0],
    ["Tromso-equinox", julianDay(2026, 3, 21, 11, 0, 0), 69.6492, 18.9553, 0],
    ["Svalbard-summer", julianDay(2026, 6, 21, 23, 0, 0), 78.2, 15.6, 0],
    ["Svalbard-winter", julianDay(2026, 12, 21, 11, 0, 0), 78.2, 15.6, 0],
  ];
  for (const [label, jdP, latP, lonP, elevP] of diurnalProbes) {
    const scP = sceneGeometry(eng, jdP, latP, lonP, { elevationM: elevP });
    const refPh = planetaryHour(eng, jdP, latP, lonP);
    if (refPh === null) {
      ok(scP.diurnal.planetaryHour === null, `${label}: planetaryHour null parity`);
    } else {
      ok(scP.diurnal.planetaryHour !== null, `${label}: planetaryHour non-null parity`);
      if (scP.diurnal.planetaryHour !== null) {
        ok(
          scP.diurnal.planetaryHour.ruler === refPh.ruler
          && scP.diurnal.planetaryHour.kind === refPh.kind
          && scP.diurnal.planetaryHour.hour === refPh.hour
          && scP.diurnal.planetaryHour.dayRuler === refPh.dayRuler,
          `${label}: planetaryHour metadata exact parity`,
        );
        approx(scP.diurnal.planetaryHour.start, refPh.start, 1e-8, `${label}: planetaryHour start parity`);
        approx(scP.diurnal.planetaryHour.end, refPh.end, 1e-8, `${label}: planetaryHour end parity`);
      }
    }
  }

  // Path B grid geolocation on sloped terrain (forces Path B even with bearing+length)
  const scSlopeGeo = sceneGeometry(eng, jdNyc, 40.7128, -74.006, {
    slopeDeg: 12, slopeAzimuthDeg: 210,
  });
  const gSlope = geolocate(
    eng, jdNyc,
    {
      shadowBearingDeg: scSlopeGeo.shadow.bearingDeg!,
      shadowLengthRatio: scSlopeGeo.shadow.lengthRatio!,
      tolerances: { shadowBearingDeg: 4, shadowLengthRatio: 0.08 },
    },
    { slopeDeg: 12, slopeAzimuthDeg: 210, latMin: 20, latMax: 60, lonMin: -100, lonMax: -50, gridStepDeg: 2 },
  );
  ok(gSlope.method === "grid" && gSlope.candidates.length >= 1, "sloped ground routes to Path B grid");
  ok(
    gSlope.candidates.some((c) => haversineKm(c.lat, c.lon, 40.7128, -74.006) < 35),
    "sloped Path B recovers NYC within 35 km",
  );

  // Adversarial regression 1: geolocate Path A fallback to Path B on low-Sun due-E/W
  {
    const jdLowA = julianDay(2026, 3, 25, 18, 0, 0);
    const obsLowA: ObservedConstraints = { sunAzimuthDeg: 270.0, sunAltitudeDeg: 0.0 };
    const gLowA = geolocate(eng, jdLowA, obsLowA);
    ok(gLowA.method === "grid" && gLowA.candidates.length >= 1,
      "low-Sun due-W falls back to Path B grid with valid candidates");
    if (gLowA.candidates.length >= 1) {
      const c0 = gLowA.candidates[0];
      const v0 = verifyObservation(eng, { jdUt: jdLowA, lat: c0.lat, lonEast: c0.lon }, obsLowA);
      ok(v0.verdict === "consistent", "low-Sun due-W Path B candidate verifies consistent");
    }

    const jdLowB = julianDay(2026, 4, 5, 18, 0, 0);
    const obsLowB: ObservedConstraints = { shadowBearingDeg: 90.0, sunAltitudeDeg: 1.0 };
    const gLowB = geolocate(eng, jdLowB, obsLowB);
    ok(gLowB.method === "grid" && gLowB.candidates.length >= 1,
      "low-Sun shadow due-E falls back to Path B grid with valid candidates");
    if (gLowB.candidates.length >= 1) {
      const c0 = gLowB.candidates[0];
      const v0 = verifyObservation(eng, { jdUt: jdLowB, lat: c0.lat, lonEast: c0.lon }, obsLowB);
      ok(v0.verdict === "consistent", "low-Sun shadow due-E Path B candidate verifies consistent");
    }

    // Truly impossible low-Sun combo with tight tolerances still yields empty candidates
    const gImp = geolocate(eng, julianDay(2026, 6, 21, 18, 0, 0), {
      sunAzimuthDeg: 270.0,
      sunAltitudeDeg: 0.0,
      tolerances: { sunAzimuthDeg: 0.2, sunAltitudeDeg: 0.2 },
    });
    ok(gImp.candidates.length === 0, "truly impossible tight low-Sun combo returns []");
  }

  // Adversarial regression 2: full/new Moon below horizon is impossible for moonBrightLimbDeg
  {
    const jdFullMar = julianDay(2026, 3, 3, 11, 33, 0);
    const subM = geolocate(eng, jdFullMar, { twilight: "day" }).sublunar;
    const antiLat = -subM.lat;
    const antiLon = wrap180(subM.lon + 180.0);
    const vBelow = verifyObservation(
      eng,
      { jdUt: jdFullMar, lat: antiLat, lonEast: antiLon },
      { moonBrightLimbDeg: 90.0 },
    );
    ok(vBelow.verdict === "impossible", "below-horizon full Moon bright-limb verdict is impossible");
    ok(vBelow.checks[0].status === "impossible", "below-horizon full Moon check status is impossible");
    ok(vBelow.checks[0].note?.includes("below horizon") === true, "below-horizon full Moon note explains horizon");
  }

  // Adversarial regression 3: shadowSweep catches mid-window sunset & mid-window slope self-shadowing
  {
    const jdSweepDay = julianDay(2026, 6, 21, 16, 0, 0);
    const vMidSunset = verifyObservation(
      eng,
      { jdUt: jdSweepDay, lat: 40.7128, lonEast: -74.006 },
      { shadowSweep: { dtMinutes: 1440, deltaBearingDeg: 360 } },
    );
    ok(vMidSunset.verdict === "impossible", "24h shadowSweep crossing night is impossible");
    ok(vMidSunset.checks[0].status === "impossible", "mid-window sunset check status is impossible");
    ok(vMidSunset.checks[0].note === "Sun sets during shadow_sweep window",
      "mid-window sunset reports exact note");

    // Sloped terrain lit at 19:00 UTC on steep east-facing slope, self-shadowed by 22:00 UTC while Sun still up
    const jdSlopeStart = julianDay(2026, 3, 21, 19, 0, 0);
    const scStart = sceneGeometry(eng, jdSlopeStart, 40.7128, -74.006, {
      slopeDeg: 35, slopeAzimuthDeg: 80,
    });
    const scEnd = sceneGeometry(eng, jdSlopeStart + 180 / 1440, 40.7128, -74.006, {
      slopeDeg: 35, slopeAzimuthDeg: 80,
    });
    ok(scStart.shadow.cast && scEnd.sun.isDay && scEnd.shadow.selfShadowed,
      "sloped sweep starts lit and enters self-shadowing while Sun is still above horizon");
    const vMidSelf = verifyObservation(
      eng,
      { jdUt: jdSlopeStart, lat: 40.7128, lonEast: -74.006, slopeDeg: 35, slopeAzimuthDeg: 80 },
      { shadowSweep: { dtMinutes: 180, deltaBearingDeg: 35 } },
    );
    ok(vMidSelf.verdict === "impossible", "sloped shadowSweep entering self-shadowing is impossible");
    ok(vMidSelf.checks[0].note === "terrain is self-shadowed during shadow_sweep window",
      "mid-window self-shadowing reports exact note");
  }

  // Input validation throws RangeError
  const badCalls: Array<[() => unknown, string]> = [
    [() => sceneGeometry(eng, jdNyc, 95, 0), "lat > 90"],
    [() => sceneGeometry(eng, jdNyc, 0, 0, { slopeDeg: 90 }), "slopeDeg === 90"],
    [() => verifyObservation(eng, { jdUt: jdNyc, lat: 40, lonEast: -74 }, { twilight: "bogus" as "day" }), "unknown twilight"],
    [() => verifyObservation(eng, { jdUt: jdNyc, lat: 40, lonEast: -74 }, { shadowLengthRatio: -1 }), "negative shadow length"],
    [() => verifyObservation(eng, { jdUt: jdNyc, lat: 40, lonEast: -74 }, { moonIllum: 1.2 }), "moonIllum > 1"],
    [() => verifyObservation(eng, { jdUt: jdNyc, lat: 40, lonEast: -74 }, { badKey: 1 } as ObservedConstraints), "unknown observed key"],
    [() => chronolocate(eng, { lat: 40, lonEast: -74 }, {}, jdNyc, jdNyc + 1), "chronolocate empty constraints"],
    [() => chronolocate(eng, { lat: 40, lonEast: -74 }, { twilight: "day" }, jdNyc + 1, jdNyc), "chronolocate jdEnd <= jdStart"],
    [() => geolocate(eng, jdNyc, {}), "geolocate empty constraints"],
  ];
  for (const [fn, label] of badCalls) {
    let threw = false;
    try { fn(); } catch (e) { threw = e instanceof RangeError; }
    ok(threw, `rejects invalid input: ${label}`);
  }
}

// ======================================= 3. 120-Scenario Physical Benchmark

interface SiteSpec {
  name: string;
  lat: number;
  lonEast: number;
  elevationM?: number;
  slopeDeg?: number;
  slopeAzimuthDeg?: number;
}

const GLOBAL_SITES: SiteSpec[] = [
  // Northern mid-latitudes
  { name: "NYC", lat: 40.7128, lonEast: -74.0060 },
  { name: "London", lat: 51.5074, lonEast: -0.1278 },
  { name: "Tokyo", lat: 35.6762, lonEast: 139.6503 },
  { name: "Cairo", lat: 30.0444, lonEast: 31.2357 },
  { name: "Denver-elev", lat: 39.7392, lonEast: -104.9903, elevationM: 1609 },
  { name: "NewDelhi", lat: 28.6139, lonEast: 77.2090 },
  { name: "Reykjavik", lat: 64.1466, lonEast: -21.9426 },
  { name: "Anchorage", lat: 61.2181, lonEast: -149.9003 },
  // Southern mid-latitudes
  { name: "Sydney", lat: -33.8688, lonEast: 151.2093 },
  { name: "BuenosAires", lat: -34.6037, lonEast: -58.3816 },
  { name: "CapeTown", lat: -33.9249, lonEast: 18.4241 },
  { name: "Auckland", lat: -36.8485, lonEast: 174.7633 },
  { name: "Santiago", lat: -33.4489, lonEast: -70.6693, elevationM: 570 },
  { name: "Ushuaia", lat: -54.8019, lonEast: -68.3030 },
  // Tropics & Equator & Antimeridian
  { name: "Singapore", lat: 1.3521, lonEast: 103.8198 },
  { name: "Quito-elev", lat: -0.1807, lonEast: -78.4678, elevationM: 2850 },
  { name: "Nairobi", lat: -1.2921, lonEast: 36.8219, elevationM: 1795 },
  { name: "Honolulu", lat: 21.3069, lonEast: -157.8583 },
  { name: "Manaus", lat: -3.1190, lonEast: -60.0217 },
  { name: "Fiji-antimeridian", lat: -16.8000, lonEast: 179.8500 },
  // Arctic
  { name: "Tromso", lat: 69.6492, lonEast: 18.9553 },
  { name: "Svalbard", lat: 78.2232, lonEast: 15.6267 },
];

/** Helper: find local solar noon near a UTC calendar day at (lat, lonEast). */
function solarNoonNear(year: number, month: number, day: number, lat: number, lonEast: number): number {
  const base = julianDay(year, month, day, 12, 0, 0) - lonEast / 360.0;
  const noon = riseSet(eng, "sun", base - 0.5, lat, lonEast, "mtransit", { searchDays: 1.1 });
  return noon ?? base;
}

/** Measure exact 30-min shadow sweep deltaBearingDeg starting at jdUt. */
function measureSweep(
  jdUt: number, lat: number, lonEast: number, dtMin: number,
  opts: { elevationM?: number; slopeDeg?: number; slopeAzimuthDeg?: number } = {},
): number {
  const s0 = sceneGeometry(eng, jdUt, lat, lonEast, opts);
  const nChunks = Math.max(1, Math.ceil(dtMin / 30));
  let prev = s0.shadow.bearingDeg!;
  let total = 0;
  for (let i = 1; i <= nChunks; i++) {
    const ti = jdUt + (dtMin * (i / nChunks)) / 1440.0;
    const si = sceneGeometry(eng, ti, lat, lonEast, opts);
    total += wrap180(si.shadow.bearingDeg! - prev);
    prev = si.shadow.bearingDeg!;
  }
  return total;
}

interface BenchmarkScenario {
  id: string;
  isSpoof: boolean;
  category: string;
  claim: ObservationClaim;
  observed: ObservedConstraints;
  expectedDiag?: {
    kind: "time_shift" | "hemisphere_flip" | "date_shift";
    targetMinutes?: number;
    targetDays?: number;
  };
}

const rng = makeRng(20261122);
const scenarios: BenchmarkScenario[] = [];

// ---- 60 AUTHENTIC SCENARIOS ----
// A. 32 diverse flat-ground daytime shadow/solar scenes across all 22 global sites & 4 seasons
const seasons: Array<[number, number, number]> = [
  [2026, 3, 21],
  [2026, 6, 21],
  [2026, 9, 22],
  [2026, 12, 21],
];
for (let i = 0; i < 32; i++) {
  const site = GLOBAL_SITES[i % GLOBAL_SITES.length];
  let [y, m, d] = seasons[i % seasons.length];
  // Avoid Arctic polar night for daytime shadow scenes.
  if (site.lat > 66 && m === 12) [y, m, d] = [2026, 6, 21];
  const noon = solarNoonNear(y, m, d, site.lat, site.lonEast);
  const hourOffsets = [-2.5, -1.75, 1.5, 2.25, -3.0, 2.75];
  const hr = site.lat > 66 && m !== 6 ? 0.5 : hourOffsets[i % hourOffsets.length];
  const jd = noon + hr / 24.0;
  const sc = sceneGeometry(eng, jd, site.lat, site.lonEast, { elevationM: site.elevationM ?? 0 });
  if (!sc.shadow.cast || sc.sun.altitudeApparentDeg < 8 || sc.sun.altitudeApparentDeg > 84) {
    // Fallback to noon +/- 1h if low/zenith
    const jdAlt = noon + 1.2 / 24.0;
    const scAlt = sceneGeometry(eng, jdAlt, site.lat, site.lonEast, { elevationM: site.elevationM ?? 0 });
    scenarios.push({
      id: `auth-flat-${i}-${site.name}`,
      isSpoof: false,
      category: "authentic_flat",
      claim: { jdUt: jdAlt, lat: site.lat, lonEast: site.lonEast, elevationM: site.elevationM },
      observed: {
        shadowBearingDeg: mod(scAlt.shadow.bearingDeg! + jitter(rng, 3.0), 360),
        shadowLengthRatio: Math.max(0.05, scAlt.shadow.lengthRatio! * (1 + jitter(rng, 0.05))),
        sunAltitudeDeg: Math.max(-89, Math.min(89, scAlt.sun.altitudeApparentDeg + jitter(rng, 1.5))),
        twilight: "day",
      },
    });
  } else {
    const obs: ObservedConstraints = {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 3.0), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.05))),
      sunAzimuthDeg: mod(sc.sun.azimuthDeg + jitter(rng, 2.5), 360),
      twilight: "day",
      sunVisible: true,
    };
    if (sc.moon.visible && sc.moon.illum > 0.12 && sc.moon.illum < 0.88 && sc.moon.altitudeApparentDeg > 8) {
      obs.moonVisible = true;
      obs.moonIllum = Math.max(0, Math.min(1, sc.moon.illum + jitter(rng, 0.04)));
      obs.moonWaxing = sc.moon.waxing;
      obs.moonBrightLimbDeg = mod(sc.moon.brightLimbZenithDeg! + jitter(rng, 5.0), 360);
    }
    scenarios.push({
      id: `auth-flat-${i}-${site.name}`,
      isSpoof: false,
      category: "authentic_flat",
      claim: { jdUt: jd, lat: site.lat, lonEast: site.lonEast, elevationM: site.elevationM },
      observed: obs,
    });
  }
}

// B. 10 sloped-terrain authentic scenes (slopes 8..22 deg, uphill & cross-slope)
for (let i = 0; i < 10; i++) {
  const site = GLOBAL_SITES[i];
  const noon = solarNoonNear(2026, 4 + (i % 5), 10 + i, site.lat, site.lonEast);
  const jd = noon + (i % 2 === 0 ? -1.5 : 1.75) / 24.0;
  const flatSc = sceneGeometry(eng, jd, site.lat, site.lonEast);
  const slopeDeg = 8 + (i % 4) * 4;
  // Orient slope uphill or cross-slope so terrain is well-lit (never self-shadowed).
  const slopeAz = mod(flatSc.sun.azimuthDeg + (i % 3) * 45, 360);
  const sc = sceneGeometry(eng, jd, site.lat, site.lonEast, { slopeDeg, slopeAzimuthDeg: slopeAz });
  scenarios.push({
    id: `auth-sloped-${i}-${site.name}`,
    isSpoof: false,
    category: "authentic_sloped",
    claim: {
      jdUt: jd, lat: site.lat, lonEast: site.lonEast,
      slopeDeg, slopeAzimuthDeg: slopeAz,
    },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 2.5), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.04))),
      twilight: "day",
    },
  });
}

// C. 10 authentic video shadow-sweep scenes (5 NH + 5 SH)
const sweepSites = [
  GLOBAL_SITES[0], GLOBAL_SITES[1], GLOBAL_SITES[2], GLOBAL_SITES[3], GLOBAL_SITES[5],
  GLOBAL_SITES[8], GLOBAL_SITES[9], GLOBAL_SITES[10], GLOBAL_SITES[11], GLOBAL_SITES[12],
];
for (let i = 0; i < 10; i++) {
  const site = sweepSites[i];
  const m = site.lat >= 0 ? 6 : 1;
  const noon = solarNoonNear(2026, m, 15, site.lat, site.lonEast);
  const jd = noon + (i % 2 === 0 ? -1.0 : 0.75) / 24.0;
  const dtMin = 35;
  const sc = sceneGeometry(eng, jd, site.lat, site.lonEast);
  const sweepDeg = measureSweep(jd, site.lat, site.lonEast, dtMin);
  scenarios.push({
    id: `auth-sweep-${i}-${site.name}`,
    isSpoof: false,
    category: "authentic_sweep",
    claim: { jdUt: jd, lat: site.lat, lonEast: site.lonEast },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 2.5), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.04))),
      shadowSweep: { dtMinutes: dtMin, deltaBearingDeg: sweepDeg + jitter(rng, 1.2) },
    },
  });
}

// D. 8 authentic night/lunar scenes (Moon visible with 0.18..0.82 illum + bright limb)
const nightSites = [
  GLOBAL_SITES[0], GLOBAL_SITES[1], GLOBAL_SITES[2], GLOBAL_SITES[8],
  GLOBAL_SITES[9], GLOBAL_SITES[10], GLOBAL_SITES[14], GLOBAL_SITES[17],
];
for (let i = 0; i < 8; i++) {
  const site = nightSites[i];
  // Scan days around equinox (so high-latitude London reaches dark night) to find
  // a clear night instant with Moon altitude > 15 deg and 0.2..0.8 illum.
  let chosenJd: number | null = null;
  for (let d = 0; d < 28 && chosenJd === null; d++) {
    const noon = solarNoonNear(2026, 3, 1 + d, site.lat, site.lonEast);
    for (const hr of [-11, -9, 9, 11, 12]) {
      const t = noon + hr / 24.0;
      const sc = sceneGeometry(eng, t, site.lat, site.lonEast);
      if (sc.sun.altitudeApparentDeg < -14 && sc.moon.altitudeApparentDeg > 15
        && sc.moon.illum > 0.2 && sc.moon.illum < 0.8) {
        chosenJd = t;
        break;
      }
    }
  }
  ok(chosenJd !== null, `auth-night-${i}-${site.name} found dark lunar instant`);
  const sc = sceneGeometry(eng, chosenJd!, site.lat, site.lonEast);
  scenarios.push({
    id: `auth-night-${i}-${site.name}`,
    isSpoof: false,
    category: "authentic_night_moon",
    claim: { jdUt: chosenJd!, lat: site.lat, lonEast: site.lonEast },
    observed: {
      twilight: "dark",
      sunVisible: false,
      moonVisible: true,
      moonAzimuthDeg: mod(sc.moon.azimuthDeg + jitter(rng, 3.0), 360),
      moonAltitudeDeg: sc.moon.altitudeApparentDeg + jitter(rng, 2.0),
      moonIllum: Math.max(0, Math.min(1, sc.moon.illum + jitter(rng, 0.04))),
      moonWaxing: sc.moon.waxing,
      moonBrightLimbDeg: mod(sc.moon.brightLimbZenithDeg! + jitter(rng, 5.0), 360),
    },
  });
}

// ---- 60 REALISTIC SPOOF SCENARIOS (6 x 10) ----

// 1. 10x +/-4h timezone / EXIF clock shift spoofs
for (let i = 0; i < 10; i++) {
  const site = GLOBAL_SITES[i];
  const noon = solarNoonNear(2026, 5, 10 + i, site.lat, site.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -1.5 : 1.5) / 24.0;
  const shiftHr = i % 2 === 0 ? 4.0 : -4.0;
  const claimedJd = trueJd + shiftHr / 24.0;
  const sc = sceneGeometry(eng, trueJd, site.lat, site.lonEast);
  scenarios.push({
    id: `spoof-tz4h-${i}-${site.name}`,
    isSpoof: true,
    category: "spoof_tz_4h",
    claim: { jdUt: claimedJd, lat: site.lat, lonEast: site.lonEast },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 1.5), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.03))),
    },
    expectedDiag: { kind: "time_shift", targetMinutes: -shiftHr * 60 },
  });
}

// 2. 10x +/-5.5h half-hour timezone offset spoofs (India UTC+5:30 etc.)
const halfHrSites = [
  GLOBAL_SITES[5], GLOBAL_SITES[0], GLOBAL_SITES[1], GLOBAL_SITES[2], GLOBAL_SITES[3],
  GLOBAL_SITES[8], GLOBAL_SITES[9], GLOBAL_SITES[10], GLOBAL_SITES[14], GLOBAL_SITES[16],
];
for (let i = 0; i < 10; i++) {
  const site = halfHrSites[i];
  const noon = solarNoonNear(2026, 3, 21 + i, site.lat, site.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -1.25 : 1.25) / 24.0;
  const shiftHr = i % 2 === 0 ? 5.5 : -5.5;
  const claimedJd = trueJd + shiftHr / 24.0;
  const sc = sceneGeometry(eng, trueJd, site.lat, site.lonEast);
  scenarios.push({
    id: `spoof-tz5h30-${i}-${site.name}`,
    isSpoof: true,
    category: "spoof_tz_halfhour",
    claim: { jdUt: claimedJd, lat: site.lat, lonEast: site.lonEast },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 1.5), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.03))),
    },
    expectedDiag: { kind: "time_shift", targetMinutes: -shiftHr * 60 },
  });
}

// 3. 10x Hemisphere sign-flip spoofs (lat -> -lat at |lat| >= 28 deg)
const hemiSites = [
  GLOBAL_SITES[0], GLOBAL_SITES[1], GLOBAL_SITES[2], GLOBAL_SITES[3], GLOBAL_SITES[5],
  GLOBAL_SITES[8], GLOBAL_SITES[9], GLOBAL_SITES[10], GLOBAL_SITES[11], GLOBAL_SITES[12],
];
for (let i = 0; i < 10; i++) {
  const site = hemiSites[i];
  const m = site.lat >= 0 ? 6 : 1;
  const noon = solarNoonNear(2026, m, 15 + i, site.lat, site.lonEast);
  const jd = noon + (i % 2 === 0 ? -0.5 : 0.75) / 24.0;
  const sc = sceneGeometry(eng, jd, site.lat, site.lonEast);
  scenarios.push({
    id: `spoof-hemi-${i}-${site.name}`,
    isSpoof: true,
    category: "spoof_hemisphere_flip",
    claim: { jdUt: jd, lat: -site.lat, lonEast: site.lonEast },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 1.5), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.03))),
      sunAltitudeDeg: sc.sun.altitudeApparentDeg + jitter(rng, 1.0),
    },
    expectedDiag: { kind: "hemisphere_flip" },
  });
}

// 4. 10x Opposite-season date shift spoofs (+/-182 days at same UTC time-of-day)
for (let i = 0; i < 10; i++) {
  const site = hemiSites[i];
  const summerMonth = site.lat >= 0 ? 6 : 12;
  const noon = solarNoonNear(2026, summerMonth, 20, site.lat, site.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -0.4 : 0.4) / 24.0;
  const offsetDays = i % 2 === 0 ? -182 : 182;
  const claimedJd = trueJd + offsetDays;
  const sc = sceneGeometry(eng, trueJd, site.lat, site.lonEast);
  scenarios.push({
    id: `spoof-season-${i}-${site.name}`,
    isSpoof: true,
    category: "spoof_opposite_season",
    claim: { jdUt: claimedJd, lat: site.lat, lonEast: site.lonEast },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg! + jitter(rng, 1.5), 360),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio! * (1 + jitter(rng, 0.03))),
      sunAltitudeDeg: sc.sun.altitudeApparentDeg + jitter(rng, 1.0),
    },
    expectedDiag: { kind: "date_shift", targetDays: -offsetDays },
  });
}

// 5. 10x Impossible night shadows (5) + Moon visibility/waxing/bright-limb spoofs (5)
for (let i = 0; i < 5; i++) {
  const site = GLOBAL_SITES[i];
  const noon = solarNoonNear(2026, 4, 15 + i, site.lat, site.lonEast);
  const nadir = riseSet(eng, "sun", noon, site.lat, site.lonEast, "itransit") ?? (noon + 0.5);
  scenarios.push({
    id: `spoof-night-shadow-${i}-${site.name}`,
    isSpoof: true,
    category: "spoof_impossible_night_shadow",
    claim: { jdUt: nadir, lat: site.lat, lonEast: site.lonEast },
    observed: {
      shadowBearingDeg: 35 + i * 25,
      shadowLengthRatio: 1.1 + i * 0.2,
    },
  });
}
for (let i = 0; i < 5; i++) {
  const site = nightSites[i];
  // Find an instant around equinox with clear Moon geometry to invert.
  let chosenJd: number | null = null;
  for (let d = 0; d < 28 && chosenJd === null; d++) {
    const noon = solarNoonNear(2026, 3, 1 + d, site.lat, site.lonEast);
    const t = noon + 10 / 24.0;
    const sc = sceneGeometry(eng, t, site.lat, site.lonEast);
    if (i < 2) {
      // Impossible Moon visibility: Moon well below horizon
      if (sc.sun.altitudeApparentDeg < -12 && sc.moon.altitudeApparentDeg < -18) {
        chosenJd = t;
      }
    } else {
      // Waxing inversion (i=2,3) or bright-limb 180 deg inversion (i=4)
      if (sc.sun.altitudeApparentDeg < -12 && sc.moon.altitudeApparentDeg > 15
        && sc.moon.illum > 0.25 && sc.moon.illum < 0.75) {
        chosenJd = t;
      }
    }
  }
  ok(chosenJd !== null, `spoof-moon-${i}-${site.name} found dark lunar instant`);
  const sc = sceneGeometry(eng, chosenJd!, site.lat, site.lonEast);
  if (i < 2) {
    scenarios.push({
      id: `spoof-moon-below-${i}-${site.name}`,
      isSpoof: true,
      category: "spoof_moon",
      claim: { jdUt: chosenJd!, lat: site.lat, lonEast: site.lonEast },
      observed: { twilight: "dark", moonVisible: true, moonAltitudeDeg: 28 },
    });
  } else if (i < 4) {
    scenarios.push({
      id: `spoof-moon-waxing-${i}-${site.name}`,
      isSpoof: true,
      category: "spoof_moon",
      claim: { jdUt: chosenJd!, lat: site.lat, lonEast: site.lonEast },
      observed: {
        twilight: "dark",
        moonVisible: true,
        moonIllum: sc.moon.illum,
        moonWaxing: !sc.moon.waxing,
      },
    });
  } else {
    scenarios.push({
      id: `spoof-moon-limb-flip-${i}-${site.name}`,
      isSpoof: true,
      category: "spoof_moon",
      claim: { jdUt: chosenJd!, lat: site.lat, lonEast: site.lonEast },
      observed: {
        twilight: "dark",
        moonVisible: true,
        moonBrightLimbDeg: mod(sc.moon.brightLimbZenithDeg! + 180, 360),
      },
    });
  }
}

// 6. 10x Reversed video shadow sweeps (5 NH + 5 SH)
for (let i = 0; i < 10; i++) {
  const site = sweepSites[i];
  const m = site.lat >= 0 ? 6 : 1;
  const noon = solarNoonNear(2026, m, 18, site.lat, site.lonEast);
  const jd = noon + (i % 2 === 0 ? -0.75 : 0.5) / 24.0;
  const dtMin = 40;
  const trueSweep = measureSweep(jd, site.lat, site.lonEast, dtMin);
  scenarios.push({
    id: `spoof-rev-sweep-${i}-${site.name}`,
    isSpoof: true,
    category: "spoof_reversed_sweep",
    claim: { jdUt: jd, lat: site.lat, lonEast: site.lonEast },
    observed: {
      shadowSweep: { dtMinutes: dtMin, deltaBearingDeg: -trueSweep },
    },
  });
}

ok(scenarios.length === 120, `benchmark has 120 scenarios (got ${scenarios.length})`);
ok(scenarios.filter((s) => !s.isSpoof).length === 60, "benchmark has 60 authentic scenarios");
ok(scenarios.filter((s) => s.isSpoof).length === 60, "benchmark has 60 spoof scenarios");

// Run all 120 scenarios and tabulate classification + diagnostic recovery.
let tp = 0;
let fp = 0;
let tn = 0;
let fn = 0;
let authImpossible = 0;
let diagTotal = 0;
let diagRecovered = 0;

for (const sc of scenarios) {
  const res = verifyObservation(eng, sc.claim, sc.observed);
  const flagged = res.verdict === "inconsistent" || res.verdict === "impossible";

  if (!sc.isSpoof) {
    if (res.verdict === "impossible") authImpossible++;
    if (flagged) {
      fp++;
      console.error(`FP ${sc.id}: verdict=${res.verdict} score=${res.consistencyScore}`);
    } else {
      tn++;
    }
  } else {
    if (flagged) {
      tp++;
    } else {
      fn++;
      console.error(`FN ${sc.id}: verdict=${res.verdict} score=${res.consistencyScore}`);
    }

    if (sc.expectedDiag) {
      diagTotal++;
      const d = res.diagnostics;
      let hit = false;
      if (d !== null) {
        if (sc.expectedDiag.kind === "time_shift") {
          const errMin = Math.abs(d.timeShift.offsetMinutes - sc.expectedDiag.targetMinutes!);
          hit = errMin <= 18.0 && (d.timeShift.verdict === "consistent" || d.timeShift.verdict === "marginal");
        } else if (sc.expectedDiag.kind === "hemisphere_flip") {
          hit = (d.hemisphereFlip.verdict === "consistent" || d.hemisphereFlip.verdict === "marginal")
            && d.hemisphereFlip.fitScore >= 0.85;
        } else if (sc.expectedDiag.kind === "date_shift" && d.dateShift !== null) {
          const rawDiff = d.dateShift.offsetDays - sc.expectedDiag.targetDays!;
          const errDays = Math.min(
            Math.abs(rawDiff),
            Math.abs(rawDiff - 365),
            Math.abs(rawDiff + 365),
          );
          hit = errDays <= 18 && (d.dateShift.verdict === "consistent" || d.dateShift.verdict === "marginal");
        }
      }
      if (hit) diagRecovered++;
      else console.error(`DIAG MISS ${sc.id}: ${d?.summary}`);
    }
  }
}

const precision = tp / Math.max(1, tp + fp);
const recall = tp / Math.max(1, tp + fn);
const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);
const diagRate = diagRecovered / Math.max(1, diagTotal);

ok(f1 >= 0.95, `benchmark F1 >= 0.95 (got ${f1.toFixed(4)})`);
ok(authImpossible === 0, `0 false-impossible on authentic scenes (got ${authImpossible})`);
ok(diagRate >= 0.90, `counterfactual diagnostic recovery >= 0.90 (got ${(diagRate * 100).toFixed(1)}%)`);

// ======================================= 4. Chronolocation accuracy benchmark

let chronoCount = 0;
let chronoHit = 0;
let chronoMaxErrMin = 0;
let chronoSumErrMin = 0;

for (let i = 0; i < 12; i++) {
  const site = GLOBAL_SITES[i];
  const noon = solarNoonNear(2026, 6, 15 + i, site.lat, site.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -2.0 : 1.75) / 24.0;
  const sc = sceneGeometry(eng, trueJd, site.lat, site.lonEast, { elevationM: site.elevationM ?? 0 });
  const obs: ObservedConstraints = {
    shadowBearingDeg: Number(sc.shadow.bearingDeg!.toFixed(4)),
    shadowLengthRatio: Number(sc.shadow.lengthRatio!.toFixed(4)),
    moonIllum: Number(sc.moon.illum.toFixed(4)),
    moonWaxing: sc.moon.waxing,
  };
  const res = chronolocate(
    eng,
    { lat: site.lat, lonEast: site.lonEast, elevationM: site.elevationM },
    obs,
    trueJd - 3.0,
    trueJd + 3.0,
  );
  chronoCount++;
  const win = res.windows.find((w) => w.jdStart - 1e-6 <= trueJd && trueJd <= w.jdEnd + 1e-6);
  if (win) {
    chronoHit++;
    const errMin = Math.abs(win.bestJd - trueJd) * 1440.0;
    chronoSumErrMin += errMin;
    if (errMin > chronoMaxErrMin) chronoMaxErrMin = errMin;
    ok(win.jdStart <= win.bestJd && win.bestJd <= win.jdEnd, `chrono-${i} window ordering`);
  } else {
    ok(false, `chrono-${i} (${site.name}) missed true instant`);
  }
}
const chronoMeanErrMin = chronoSumErrMin / Math.max(1, chronoHit);
ok(chronoHit === chronoCount, `chronolocate 100% recall (${chronoHit}/${chronoCount})`);
ok(chronoMaxErrMin < 2.0, `chronolocate max bestJd error < 2 min (got ${chronoMaxErrMin.toFixed(3)} min)`);

// ===================================== 5. Geolocation accuracy benchmark (<5km)

let geoCount = 0;
let geoMaxKm = 0;
let geoSumKm = 0;

for (let i = 0; i < 15; i++) {
  const site = GLOBAL_SITES[i];
  const noon = solarNoonNear(2026, 5, 10 + i, site.lat, site.lonEast);
  const jd = noon + (i % 2 === 0 ? -1.75 : 2.0) / 24.0;
  const sc = sceneGeometry(eng, jd, site.lat, site.lonEast, { elevationM: site.elevationM ?? 0 });
  const res = geolocate(
    eng,
    jd,
    {
      shadowBearingDeg: Number(sc.shadow.bearingDeg!.toFixed(4)),
      shadowLengthRatio: Number(sc.shadow.lengthRatio!.toFixed(4)),
    },
    { elevationM: site.elevationM ?? 0 },
  );
  geoCount++;
  ok(res.method === "analytical", `geo-${i} (${site.name}) uses analytical Path A`);
  ok(res.candidates.length >= 1, `geo-${i} (${site.name}) returned candidate`);
  if (res.candidates.length >= 1) {
    const bestDist = Math.min(...res.candidates.map((c) => haversineKm(c.lat, c.lon, site.lat, site.lonEast)));
    geoSumKm += bestDist;
    if (bestDist > geoMaxKm) geoMaxKm = bestDist;
    ok(bestDist < 5.0, `geo-${i} (${site.name}) analytical error ${bestDist.toFixed(3)} km < 5 km`);
  }
}
const geoMeanKm = geoSumKm / Math.max(1, geoCount);

// ======================================= 6. Sub-2ms forward latency benchmark

const jdBench = julianDay(2026, 6, 21, 18, 0, 0);
const benchSc = sceneGeometry(eng, jdBench, 40.7128, -74.006);
const benchObs: ObservedConstraints = {
  shadowBearingDeg: benchSc.shadow.bearingDeg!,
  shadowLengthRatio: benchSc.shadow.lengthRatio!,
  twilight: "day",
  moonVisible: true,
  moonIllum: benchSc.moon.illum,
  moonWaxing: benchSc.moon.waxing,
  moonBrightLimbDeg: benchSc.moon.brightLimbZenithDeg!,
};

// Warm up JIT
for (let i = 0; i < 25; i++) {
  sceneGeometry(eng, jdBench + i * 0.001, 40.7128, -74.006);
  verifyObservation(eng, { jdUt: jdBench, lat: 40.7128, lonEast: -74.006 }, benchObs);
}

const N_LAT = 200;
const t0 = performance.now();
for (let i = 0; i < N_LAT; i++) {
  sceneGeometry(eng, jdBench + i * 0.0007, 40.7128, -74.006);
}
const sceneMs = (performance.now() - t0) / N_LAT;

const t1 = performance.now();
for (let i = 0; i < N_LAT; i++) {
  verifyObservation(eng, { jdUt: jdBench, lat: 40.7128, lonEast: -74.006 }, benchObs);
}
const verifyMs = (performance.now() - t1) / N_LAT;

ok(sceneMs < 2.0, `sceneGeometry mean latency < 2.0 ms (got ${sceneMs.toFixed(3)} ms)`);
ok(verifyMs < 2.0, `verifyObservation authentic mean latency < 2.0 ms (got ${verifyMs.toFixed(3)} ms)`);

// Summary report
console.log(
  `observe benchmark (120 scenarios: 60 auth / 60 spoof): `
  + `TP=${tp} FP=${fp} TN=${tn} FN=${fn} | `
  + `P=${precision.toFixed(3)} R=${recall.toFixed(3)} F1=${f1.toFixed(3)} | `
  + `authImpossible=${authImpossible} | `
  + `diagRecovery=${diagRecovered}/${diagTotal} (${(diagRate * 100).toFixed(1)}%)`,
);
console.log(
  `observe solvers & latency: `
  + `chrono=${chronoHit}/${chronoCount} mean=${chronoMeanErrMin.toFixed(3)}m max=${chronoMaxErrMin.toFixed(3)}m | `
  + `geoAnalytical=${geoCount}/${geoCount} mean=${geoMeanKm.toFixed(3)}km max=${geoMaxKm.toFixed(3)}km | `
  + `scene=${sceneMs.toFixed(3)}ms verify=${verifyMs.toFixed(3)}ms`,
);
console.log(`observe: ${checks} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
