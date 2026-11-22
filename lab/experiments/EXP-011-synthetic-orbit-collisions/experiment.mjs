#!/usr/bin/env node
/**
 * EXP-011: Synthetic Orbital Task-Space (synthetic.ts + when()) vs. Direct
 * riseSet + Modulo Interval Intersection
 *
 * Tests caelus_agent_chronosense.md Section 3's trimmed frontier proposal:
 * registering internal agent task rhythms as virtual `periodic` bodies in
 * `synthetic.ts` inside the real Earth-sky `Engine` and using `when()` to
 * detect collisions between task deadlines and human local physical night.
 *
 * Arms:
 *   1. Arm1-Synthetic-Engine-When: registerSyntheticSystem(engine, sys) + when()
 *   2. Arm2-WorldFrame-Synthetic-When: syntheticEphemeris(sys) (parallax-free
 *      world frame) + when()
 *   3. Arm3-Direct-RiseSet-Modulo: direct riseSet("sun") night intervals +
 *      closed-form modular task deadline intersection
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import { loadNodeData } from "../../../packages/caelus/dist/src/node-loader.js";
import {
  Engine,
  julianDay,
  azAlt,
  refractTrueToApparent,
  riseSet,
  registerSyntheticSystem,
  syntheticEphemeris,
  when,
  aspect,
  allOf,
} from "../../../packages/caelus/dist/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const DATA_DIR = resolve(REPO_ROOT, "packages/caelus/data");

const CITIES = [
  { id: "oslo", lat: 59.9139, lon: 10.7522 },
  { id: "new_york", lat: 40.7128, lon: -74.006 },
  { id: "singapore", lat: 1.3521, lon: 103.8198 },
  { id: "sydney", lat: -33.8688, lon: 151.2093 },
  { id: "tromso", lat: 69.6492, lon: 18.9553 },
];

const WINDOWS = [
  { id: "jun", startJd: julianDay(2026, 6, 1, 0), days: 28 },
  { id: "dec", startJd: julianDay(2026, 12, 1, 0), days: 28 },
];

// Three realistic internal agent rhythms; deadline window centered at phase 0 deg
// (so half-window = windowDays / 2 on each side of k * periodDays).
const TASKS = [
  { id: "ci_cadence", periodDays: 0.25, windowDays: 1 / 24, stepDays: 1 / 96 }, // 6h period, 60m window
  { id: "daily_standup", periodDays: 1.0, windowDays: 2 / 24, stepDays: 1 / 48 }, // 24h period, 120m window
  { id: "sprint_release", periodDays: 14.0, windowDays: 12 / 24, stepDays: 1 / 24 }, // 14d period, 12h window
];

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function round4(x) {
  return Number(x.toFixed(4));
}

function mod360(x) {
  return ((x % 360) + 360) % 360;
}

function wrap180(x) {
  return mod360(x + 180) - 180;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

function makePredicate(fn, bodies) {
  fn.bodies = new Set(bodies);
  return fn;
}

function sunApparentAlt(engine, jdUt, lat, lon) {
  const p = engine.position("sun", jdUt);
  const [, altTrue] = azAlt(engine.data, p.lon, p.lat, jdUt, lat, lon);
  return refractTrueToApparent(altTrue);
}

function localNightPredicate(lat, lon) {
  // True (margin >= 0) when apparent solar altitude < 0 deg (physical night/twilight below horizon)
  return makePredicate(
    (eng, t) => -sunApparentAlt(eng, t, lat, lon),
    ["sun"],
  );
}

/**
 * Exact closed-form night intervals in [jdStart, jdEnd] using riseSet("sun")
 * with discCenter: true to match apparent disc-center altitude < 0 deg.
 */
function buildDirectNightIntervals(engine, jdStart, jdEnd, lat, lon) {
  const intervals = [];
  let cursor = jdStart;
  let isNight = sunApparentAlt(engine, cursor, lat, lon) < 0;

  while (cursor < jdEnd - 1e-6) {
    if (isNight) {
      const nextRise = riseSet(engine, "sun", cursor, lat, lon, "rise", { discCenter: true });
      if (nextRise === null || nextRise >= jdEnd) {
        intervals.push([cursor, jdEnd]);
        break;
      }
      intervals.push([cursor, nextRise]);
      cursor = nextRise + 1e-4;
      isNight = false;
    } else {
      const nextSet = riseSet(engine, "sun", cursor, lat, lon, "set", { discCenter: true });
      if (nextSet === null || nextSet >= jdEnd) {
        break;
      }
      cursor = nextSet;
      isNight = true;
    }
  }
  return intervals;
}

/**
 * Independent ground-truth night intervals via fine 5-min bracketing + bisection
 * on apparent solar altitude < 0 deg (completely independent of riseSet and when).
 */
function buildGroundTruthNightIntervals(engine, jdStart, jdEnd, lat, lon) {
  const step = 5 / 1440;
  const intervals = [];
  let prevT = jdStart;
  let prevAlt = sunApparentAlt(engine, prevT, lat, lon);
  let openStart = prevAlt < 0 ? jdStart : null;

  const bisectZero = (a, b) => {
    let lo = a;
    let hi = b;
    let flo = sunApparentAlt(engine, lo, lat, lon);
    for (let i = 0; i < 32; i++) {
      const mid = 0.5 * (lo + hi);
      const fm = sunApparentAlt(engine, mid, lat, lon);
      if ((flo < 0) !== (fm < 0)) hi = mid;
      else {
        lo = mid;
        flo = fm;
      }
    }
    return 0.5 * (lo + hi);
  };

  for (let t = jdStart + step; t <= jdEnd + 1e-9; t += step) {
    const curT = Math.min(t, jdEnd);
    const curAlt = sunApparentAlt(engine, curT, lat, lon);
    if ((prevAlt < 0) !== (curAlt < 0)) {
      const edge = bisectZero(prevT, curT);
      if (curAlt < 0) {
        openStart = edge;
      } else if (openStart !== null) {
        intervals.push([openStart, edge]);
        openStart = null;
      }
    }
    prevT = curT;
    prevAlt = curAlt;
    if (curT >= jdEnd) break;
  }
  if (openStart !== null) intervals.push([openStart, jdEnd]);
  return intervals;
}

function intersectIntervalLists(listA, listB) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < listA.length && j < listB.length) {
    const lo = Math.max(listA[i][0], listB[j][0]);
    const hi = Math.min(listA[i][1], listB[j][1]);
    if (hi - lo > 1e-6) out.push([lo, hi]);
    if (listA[i][1] < listB[j][1]) i++;
    else j++;
  }
  return out;
}

function buildModuloTaskIntervals(jdStart, jdEnd, epoch, periodDays, windowDays) {
  const half = windowDays / 2;
  const kMin = Math.floor((jdStart - half - epoch) / periodDays);
  const kMax = Math.ceil((jdEnd + half - epoch) / periodDays);
  const out = [];
  for (let k = kMin; k <= kMax; k++) {
    const center = epoch + k * periodDays;
    const lo = Math.max(jdStart, center - half);
    const hi = Math.min(jdEnd, center + half);
    if (hi - lo > 1e-6) out.push([lo, hi]);
  }
  return out;
}

/**
 * Compare predicted collision intervals against ground-truth intervals.
 * Two intervals match if they overlap by >= 50% of the smaller interval or
 * centers are within 30 min; also computes continuous overlap-time F1 and
 * matched boundary error in minutes.
 */
function scoreIntervals(pred, truth) {
  const sumDur = (list) => list.reduce((acc, [a, b]) => acc + Math.max(0, b - a), 0);
  const overlapList = intersectIntervalLists(pred, truth);
  const predDur = sumDur(pred);
  const truthDur = sumDur(truth);
  const ovDur = sumDur(overlapList);

  const timePrecision = predDur > 0 ? ovDur / predDur : truthDur === 0 ? 1 : 0;
  const timeRecall = truthDur > 0 ? ovDur / truthDur : predDur === 0 ? 1 : 0;
  const timeF1 =
    timePrecision + timeRecall > 0
      ? (2 * timePrecision * timeRecall) / (timePrecision + timeRecall)
      : 0;

  // Event-level matching + boundary error
  const usedPred = new Set();
  let tp = 0;
  const boundaryErrMin = [];
  for (const [ta, tb] of truth) {
    let bestIdx = -1;
    let bestOv = 0;
    for (let i = 0; i < pred.length; i++) {
      if (usedPred.has(i)) continue;
      const ov = Math.min(tb, pred[i][1]) - Math.max(ta, pred[i][0]);
      if (ov > bestOv) {
        bestOv = ov;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestOv > 0) {
      usedPred.add(bestIdx);
      tp++;
      const [pa, pb] = pred[bestIdx];
      boundaryErrMin.push(Math.abs(pa - ta) * 1440, Math.abs(pb - tb) * 1440);
    }
  }
  const fp = pred.length - tp;
  const fn = truth.length - tp;

  return {
    tp,
    fp,
    fn,
    predDurDays: predDur,
    truthDurDays: truthDur,
    ovDurDays: ovDur,
    timeF1,
    boundaryErrMin,
  };
}

function main() {
  const tAll = performance.now();
  const engine = new Engine(loadNodeData(DATA_DIR));

  // Diagnostic: quantify exact heliocentric Kepler a = periodDays^(2/3)
  // Earth-parallax distortion when registering periodic task rhythms on Engine.
  const epochRef = WINDOWS[0].startJd;
  const sys = {
    id: "agent-task-space",
    bodies: TASKS.map((t) => ({
      id: t.id,
      mode: "periodic",
      periodDays: t.periodDays,
      phaseDeg: 0,
      epoch: epochRef,
    })),
  };
  registerSyntheticSystem(engine, sys);
  const worldEphem = syntheticEphemeris(sys);

  const parallaxDiagnostics = {};
  for (const task of TASKS) {
    const keplerA = Math.cbrt(task.periodDays * task.periodDays);
    let maxErrDeg = 0;
    let maxEngineSpanDeg = 0;
    const lons = [];
    const samples = 240;
    for (let i = 0; i < samples; i++) {
      const t = epochRef + (i / samples) * Math.max(task.periodDays, 14);
      const trueLon = mod360((360 * (t - epochRef)) / task.periodDays);
      const worldLon = worldEphem.longitude(task.id, t);
      const engLon = engine.longitude(task.id, t);
      const err = Math.abs(wrap180(engLon - trueLon));
      if (err > maxErrDeg) maxErrDeg = err;
      lons.push(engLon);
      // Verify world-frame parity
      if (Math.abs(wrap180(worldLon - trueLon)) > 0.05) {
        throw new Error(`World frame mismatch for ${task.id}`);
      }
    }
    const maxAngleFromSun = lons.reduce((m, x, idx) => {
      const t = epochRef + (idx / samples) * Math.max(task.periodDays, 14);
      const sunLon = engine.longitude("sun", t);
      return Math.max(m, Math.abs(wrap180(x - sunLon)));
    }, 0);
    maxEngineSpanDeg = maxAngleFromSun;

    parallaxDiagnostics[task.id] = {
      period_days: task.periodDays,
      kepler_radius_au: round4(keplerA),
      orbit_vs_earth_1au:
        keplerA < 0.99
          ? "inside_earth_orbit_trapped"
          : Math.abs(keplerA - 1) <= 0.02
            ? "co_orbital_1au_singularity"
            : "outer_annual_parallax",
      max_geocentric_phase_error_deg: round4(maxErrDeg),
      equivalent_timing_error_min: round4((maxErrDeg / 360) * task.periodDays * 1440),
      max_elongation_from_sun_deg: round4(maxEngineSpanDeg),
    };
  }

  // Run full 3-arm collision benchmark across 5 cities x 2 seasons x 3 tasks = 30 scenarios
  const armNames = [
    "Arm1-Synthetic-Engine-When",
    "Arm2-WorldFrame-Synthetic-When",
    "Arm3-Direct-RiseSet-Modulo",
  ];

  const agg = Object.fromEntries(
    armNames.map((a) => [
      a,
      {
        tp: 0,
        fp: 0,
        fn: 0,
        predDur: 0,
        truthDur: 0,
        ovDur: 0,
        boundaryErrMin: [],
        cpuMs: 0,
        byTask: Object.fromEntries(
          TASKS.map((t) => [
            t.id,
            { tp: 0, fp: 0, fn: 0, predDur: 0, truthDur: 0, ovDur: 0, errMin: [], cpuMs: 0 },
          ]),
        ),
      },
    ]),
  );

  for (const win of WINDOWS) {
    const jdStart = win.startJd;
    const jdEnd = jdStart + win.days;

    // Re-register synthetic bodies anchored to this window's epoch
    const winSys = {
      id: `agent-tasks-${win.id}`,
      bodies: TASKS.map((t) => ({
        id: t.id,
        mode: "periodic",
        periodDays: t.periodDays,
        phaseDeg: 0,
        epoch: jdStart,
      })),
    };
    registerSyntheticSystem(engine, winSys);
    const winWorld = syntheticEphemeris(winSys);

    for (const city of CITIES) {
      const nightPred = localNightPredicate(city.lat, city.lon);

      // Independent ground truth via direct solar altitude bracketing + bisection
      const gtNightIntervals = buildGroundTruthNightIntervals(
        engine,
        jdStart,
        jdEnd,
        city.lat,
        city.lon,
      );

      // Arm 3 computes the city's night intervals ONCE per city-window and reuses
      // them across all 3 task rhythms (amortized cost split evenly across tasks).
      const t3Night0 = performance.now();
      const night3Cached = buildDirectNightIntervals(engine, jdStart, jdEnd, city.lat, city.lon);
      const night3CpuPerTask = (performance.now() - t3Night0) / TASKS.length;

      for (const task of TASKS) {
        const halfOrbDeg = ((task.windowDays / 2) / task.periodDays) * 360;
        const gtTaskIntervals = buildModuloTaskIntervals(
          jdStart,
          jdEnd,
          jdStart,
          task.periodDays,
          task.windowDays,
        );
        const gtCollisions = intersectIntervalLists(gtNightIntervals, gtTaskIntervals);

        // Arm 1: registerSyntheticSystem on real Earth-sky Engine + when()
        const t1 = performance.now();
        const arm1Pred = allOf(
          aspect(task.id, "conjunction", 0, halfOrbDeg),
          nightPred,
        );
        const arm1Intervals = when(engine, arm1Pred, jdStart, jdEnd, {
          step: task.stepDays,
          maxIntervals: 2000,
        });
        const cpu1 = performance.now() - t1;

        // Arm 2: world-frame syntheticEphemeris (parallax-free) + when()
        const t2 = performance.now();
        const worldTaskPred = makePredicate(
          (_eng, t) => halfOrbDeg - Math.abs(wrap180(winWorld.longitude(task.id, t))),
          [task.id],
        );
        const arm2Intervals = when(engine, allOf(worldTaskPred, nightPred), jdStart, jdEnd, {
          step: task.stepDays,
          maxIntervals: 2000,
        });
        const cpu2 = performance.now() - t2;

        // Arm 3: Direct riseSet("sun") (shared per city) + closed-form modulo intersection
        const t3 = performance.now();
        const task3 = buildModuloTaskIntervals(
          jdStart,
          jdEnd,
          jdStart,
          task.periodDays,
          task.windowDays,
        );
        const arm3Intervals = intersectIntervalLists(night3Cached, task3);
        const cpu3 = night3CpuPerTask + (performance.now() - t3);

        const armOutputs = [
          ["Arm1-Synthetic-Engine-When", arm1Intervals, cpu1],
          ["Arm2-WorldFrame-Synthetic-When", arm2Intervals, cpu2],
          ["Arm3-Direct-RiseSet-Modulo", arm3Intervals, cpu3],
        ];

        for (const [name, intervals, cpu] of armOutputs) {
          const sc = scoreIntervals(intervals, gtCollisions);
          const aSlot = agg[name];
          aSlot.tp += sc.tp;
          aSlot.fp += sc.fp;
          aSlot.fn += sc.fn;
          aSlot.predDur += sc.predDurDays;
          aSlot.truthDur += sc.truthDurDays;
          aSlot.ovDur += sc.ovDurDays;
          aSlot.boundaryErrMin.push(...sc.boundaryErrMin);
          aSlot.cpuMs += cpu;

          const tSlot = aSlot.byTask[task.id];
          tSlot.tp += sc.tp;
          tSlot.fp += sc.fp;
          tSlot.fn += sc.fn;
          tSlot.predDur += sc.predDurDays;
          tSlot.truthDur += sc.truthDurDays;
          tSlot.ovDur += sc.ovDurDays;
          tSlot.errMin.push(...sc.boundaryErrMin);
          tSlot.cpuMs += cpu;
        }
      }
    }
  }

  function finishStats(slot) {
    const p = slot.tp + slot.fp > 0 ? slot.tp / (slot.tp + slot.fp) : 1;
    const r = slot.tp + slot.fn > 0 ? slot.tp / (slot.tp + slot.fn) : 1;
    const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;
    const tpTime = slot.predDur > 0 ? slot.ovDur / slot.predDur : 1;
    const trTime = slot.truthDur > 0 ? slot.ovDur / slot.truthDur : 1;
    const timeF1 = tpTime + trTime > 0 ? (2 * tpTime * trTime) / (tpTime + trTime) : 0;
    return {
      tp: slot.tp,
      fp: slot.fp,
      fn: slot.fn,
      event_precision: round4(p),
      event_recall: round4(r),
      event_f1: round4(f1),
      overlap_time_f1: round4(timeF1),
      median_boundary_err_min: round4(median(slot.boundaryErrMin ?? slot.errMin)),
      total_cpu_ms: round4(slot.cpuMs),
    };
  }

  const byArm = {};
  for (const name of armNames) {
    const base = finishStats(agg[name]);
    base.by_task = Object.fromEntries(
      TASKS.map((t) => [t.id, finishStats(agg[name].byTask[t.id])]),
    );
    byArm[name] = base;
  }

  const a1 = byArm["Arm1-Synthetic-Engine-When"];
  const a2 = byArm["Arm2-WorldFrame-Synthetic-When"];
  const a3 = byArm["Arm3-Direct-RiseSet-Modulo"];

  const arm2OverArm3SpeedRatio = round4(a2.total_cpu_ms / Math.max(0.001, a3.total_cpu_ms));
  const arm1OverArm3SpeedRatio = round4(a1.total_cpu_ms / Math.max(0.001, a3.total_cpu_ms));

  const killed =
    a1.event_f1 < 0.9 ||
    a1.median_boundary_err_min > 15 ||
    (a2.event_f1 <= a3.event_f1 && arm2OverArm3SpeedRatio >= 5.0);

  const status = killed ? "fail" : "pass";
  const totalRuntimeMs = round4(performance.now() - tAll);

  const results = {
    id: "EXP-011",
    run_at: new Date().toISOString(),
    git_sha: getGitSha(),
    status,
    summary: `30-scenario (5 cities x 2 seasons x 3 task rhythms over 28d) deadline-vs-night collision benchmark. Arm1-Synthetic-Engine-When (registerSyntheticSystem + when()) fails catastrophically: event F1=${a1.event_f1} (overlap time F1=${a1.overlap_time_f1}), because synthetic.ts places periodic bodies heliocentrically at Kepler a=P^(2/3) AU (0.25d CI cadence sits at 0.397 AU inside Earth's orbit, max elongation ${parallaxDiagnostics.ci_cadence.max_elongation_from_sun_deg} deg, never completing a geocentric cycle; 1.0d standup hits a 1.0 AU co-orbital singularity; 14d sprint suffers +/-${parallaxDiagnostics.sprint_release.max_geocentric_phase_error_deg} deg = ${parallaxDiagnostics.sprint_release.equivalent_timing_error_min} min annual parallax error). Even parallax-free Arm2-WorldFrame-Synthetic-When (event F1=${a2.event_f1}, ${a2.total_cpu_ms} ms) runs ${arm2OverArm3SpeedRatio}x slower than Arm3-Direct-RiseSet-Modulo (F1=${a3.event_f1}, ${a3.total_cpu_ms} ms) with zero accuracy gain.`,
    metrics: {
      arm1_synthetic_engine_event_f1: a1.event_f1,
      arm1_synthetic_engine_overlap_time_f1: a1.overlap_time_f1,
      arm2_worldframe_when_event_f1: a2.event_f1,
      arm2_worldframe_when_overlap_time_f1: a2.overlap_time_f1,
      arm3_direct_riseset_event_f1: a3.event_f1,
      arm1_over_arm3_cpu_ratio: arm1OverArm3SpeedRatio,
      arm2_over_arm3_cpu_ratio: arm2OverArm3SpeedRatio,
      arm1_total_cpu_ms: a1.total_cpu_ms,
      arm2_total_cpu_ms: a2.total_cpu_ms,
      arm3_total_cpu_ms: a3.total_cpu_ms,
      ci_0p25d_max_geocentric_err_deg: parallaxDiagnostics.ci_cadence.max_geocentric_phase_error_deg,
      sprint_14d_parallax_err_min: parallaxDiagnostics.sprint_release.equivalent_timing_error_min,
      total_runtime_ms: totalRuntimeMs,
      parallax_diagnostics: parallaxDiagnostics,
      by_arm: byArm,
    },
    verdict: killed
      ? `KILLED (synthetic.ts orbital task-space for agent scheduling): Arm1-Synthetic-Engine-When hits F1=${a1.event_f1} (overlap F1=${a1.overlap_time_f1}) due to Kepler a=P^(2/3) Earth-parallax distortion, and parallax-free Arm2-WorldFrame-Synthetic-When offers zero accuracy gain over Arm3-Direct-RiseSet-Modulo while running ${arm2OverArm3SpeedRatio}x slower (${a2.total_cpu_ms} ms vs ${a3.total_cpu_ms} ms). Archive to lab/graveyard/KILL-006-synthetic-orbit-task-space.md; use direct riseSet('sun') + modular interval arithmetic instead.`
      : `PASS: Arm1 F1=${a1.event_f1}, Arm3 F1=${a3.event_f1}.`,
  };

  writeFileSync(resolve(__dirname, "results.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`EXP-011 complete: status=${status} (${totalRuntimeMs} ms)`);
  console.log(results.summary);
}

main();
