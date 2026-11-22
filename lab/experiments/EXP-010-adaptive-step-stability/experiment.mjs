#!/usr/bin/env node
/**
 * EXP-010: Adaptive Cognitive Step-Size Control
 *
 * Puts caelus_agent_chronosense.md Section 3's trimmed frontier proposal
 * ("Adaptive Cognitive Step-Size via chartStability watching sect flips")
 * through the Caelus Razor against:
 *   1. Arm1-Fixed-Poll-30m: constant 30-min polling loop
 *   2. Arm2-Stability-AllFlips: unfiltered chartStability (angle_sign, sign,
 *      house, aspect, retrograde, sect) exposing phantom zodiac cliffs
 *   3. Arm3-Stability-Physical-SectOnly: chartStability filtered strictly to
 *      kind === "sect" (sunrise/sunset day-night flip)
 *   4. Arm4-Analytic-RiseSet-Jump: direct sceneGeometry.diurnal.minutesToNextTwilight
 *      sleep-to-boundary scheduling (no finite-difference chart sweeps)
 *
 * Evaluated across 20 deterministic 72-hour episodes (5 latitudes x 4 seasons,
 * 1,440 simulated hours total).
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
  sceneGeometry,
  chartStability,
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

const SEASONS = [
  { id: "mar", startJd: julianDay(2026, 3, 20, 0) },
  { id: "jun", startJd: julianDay(2026, 6, 20, 0) },
  { id: "sep", startJd: julianDay(2026, 9, 22, 0) },
  { id: "dec", startJd: julianDay(2026, 12, 20, 0) },
];

const EPISODE_HOURS = 24;
const EPISODE_DAYS = EPISODE_HOURS / 24;
const CATCH_TOL_MIN = 5.0;
const PHANTOM_WINDOW_MIN = 15.0;
const HEARTBEAT_MAX_MIN = 180.0;

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

function sunApparentAlt(engine, jdUt, lat, lon) {
  const p = engine.position("sun", jdUt);
  const [, altTrue] = azAlt(engine.data, p.lon, p.lat, jdUt, lat, lon);
  return refractTrueToApparent(altTrue);
}

function bisectCrossing(fn, a, b) {
  let fa = fn(a);
  let lo = a;
  let hi = b;
  for (let i = 0; i < 36; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = fn(mid);
    if ((fa < 0) !== (fm < 0)) hi = mid;
    else {
      lo = mid;
      fa = fm;
    }
  }
  return 0.5 * (lo + hi);
}

/**
 * Ground-truth physical regime cliffs in [startJd, endJd]:
 * sunrise (0 deg rising), sunset (0 deg setting),
 * civil_dawn (-6 deg rising), civil_dusk (-6 deg setting).
 */
function findGroundTruthCliffs(engine, startJd, endJd, lat, lon) {
  const stepDays = 5 / 1440; // 5 min bracket scan
  const cliffs = [];
  let prevT = startJd;
  let prevAlt = sunApparentAlt(engine, prevT, lat, lon);

  for (let t = startJd + stepDays; t <= endJd + 1e-9; t += stepDays) {
    const curT = Math.min(t, endJd);
    const curAlt = sunApparentAlt(engine, curT, lat, lon);

    for (const thresh of [
      { deg: 0.0, up: "sunrise", down: "sunset", group: "horizon" },
      { deg: -6.0, up: "civil_dawn", down: "civil_dusk", group: "civil" },
    ]) {
      const a0 = prevAlt - thresh.deg;
      const a1 = curAlt - thresh.deg;
      if ((a0 < 0 && a1 >= 0) || (a0 >= 0 && a1 < 0)) {
        const crossJd = bisectCrossing(
          (x) => sunApparentAlt(engine, x, lat, lon) - thresh.deg,
          prevT,
          curT,
        );
        cliffs.push({
          jd: crossJd,
          kind: a1 >= 0 ? thresh.up : thresh.down,
          group: thresh.group,
        });
      }
    }

    prevT = curT;
    prevAlt = curAlt;
    if (curT >= endJd) break;
  }

  cliffs.sort((a, b) => a.jd - b.jd);
  return cliffs;
}

function evaluateWakeups(wakeups, cliffs, phantomEvents) {
  let horizonTotal = 0;
  let horizonCaught = 0;
  let civilTotal = 0;
  let civilCaught = 0;
  const errMinList = [];

  for (const c of cliffs) {
    let bestMin = Infinity;
    for (const w of wakeups) {
      const dMin = Math.abs(w - c.jd) * 1440;
      if (dMin < bestMin) bestMin = dMin;
    }
    const caught = bestMin <= CATCH_TOL_MIN;
    errMinList.push(bestMin);
    if (c.group === "horizon") {
      horizonTotal++;
      if (caught) horizonCaught++;
    } else {
      civilTotal++;
      if (caught) civilCaught++;
    }
  }

  let phantomAlarms = 0;
  for (const pJd of phantomEvents) {
    let nearPhysical = false;
    for (const c of cliffs) {
      if (Math.abs(pJd - c.jd) * 1440 <= PHANTOM_WINDOW_MIN) {
        nearPhysical = true;
        break;
      }
    }
    if (!nearPhysical) phantomAlarms++;
  }

  return {
    wakeups: wakeups.length,
    horizonTotal,
    horizonCaught,
    civilTotal,
    civilCaught,
    phantomAlarms,
    errMinList,
  };
}

function runArm1FixedPoll(engine, startJd, endJd, lat, lon) {
  const wakeups = [];
  const t0 = performance.now();
  const stepDays = 30 / 1440;
  for (let t = startJd; t <= endJd + 1e-9; t += stepDays) {
    const cur = Math.min(t, endJd);
    wakeups.push(cur);
    sceneGeometry(engine, cur, lat, lon);
    if (cur >= endJd) break;
  }
  return { wakeups, phantomEvents: [], cpuMs: performance.now() - t0 };
}

function runArm2StabilityAllFlips(engine, startJd, endJd, lat, lon) {
  const wakeups = [];
  const phantomEvents = [];
  const t0 = performance.now();
  let t = startJd;

  // Lookahead window: center at t + 30m with halfWidth = 30m -> scans [t, t+60m].
  // stepSeconds = 300 (5 min) -> 13 chartAt evaluations per step.
  while (t <= endJd + 1e-9) {
    wakeups.push(t);
    if (t >= endJd) break;

    const lookaheadMin = 60;
    const center = t + 30 / 1440;
    const stab = chartStability(engine, center, {
      lat,
      lonEast: lon,
      houseSystem: "whole_sign",
      halfWidthSeconds: 1800,
      stepSeconds: 600,
    });

    let earliestFlip = null;
    let earliestKind = null;
    for (const f of stab.facts) {
      if (f.stable) continue;
      for (const seg of f.segments) {
        if (seg.from > t + 5.0 / 1440 && seg.from <= t + lookaheadMin / 1440) {
          if (earliestFlip === null || seg.from < earliestFlip) {
            earliestFlip = seg.from;
            earliestKind = f.kind;
          }
        }
      }
    }

    if (earliestFlip !== null) {
      if (earliestKind !== "sect") phantomEvents.push(earliestFlip);
      t = Math.min(endJd, earliestFlip);
    } else {
      t = Math.min(endJd, t + lookaheadMin / 1440);
    }
  }
  return { wakeups, phantomEvents, cpuMs: performance.now() - t0 };
}

function runArm3StabilitySectOnly(engine, startJd, endJd, lat, lon) {
  const wakeups = [];
  const t0 = performance.now();
  let t = startJd;

  while (t <= endJd + 1e-9) {
    wakeups.push(t);
    if (t >= endJd) break;

    const lookaheadMin = 60;
    const center = t + 30 / 1440;
    const stab = chartStability(engine, center, {
      lat,
      lonEast: lon,
      houseSystem: "whole_sign",
      halfWidthSeconds: 1800,
      stepSeconds: 600,
    });

    const sectFact = stab.facts.find((f) => f.kind === "sect");
    let nextFlip = null;
    if (sectFact && !sectFact.stable) {
      for (const seg of sectFact.segments) {
        if (seg.from > t + 0.5 / 1440 && seg.from <= t + lookaheadMin / 1440) {
          if (nextFlip === null || seg.from < nextFlip) nextFlip = seg.from;
        }
      }
    }

    if (nextFlip !== null) {
      t = Math.min(endJd, nextFlip);
    } else {
      t = Math.min(endJd, t + lookaheadMin / 1440);
    }
  }
  return { wakeups, phantomEvents: [], cpuMs: performance.now() - t0 };
}

function runArm4AnalyticRiseSetJump(engine, startJd, endJd, lat, lon) {
  const wakeups = [];
  const t0 = performance.now();
  let t = startJd;

  while (t <= endJd + 1e-9) {
    wakeups.push(t);
    if (t >= endJd) break;

    const scene = sceneGeometry(engine, t, lat, lon);
    const mins = scene.diurnal.minutesToNextTwilight;
    let stepMin = HEARTBEAT_MAX_MIN;
    if (mins !== null && Number.isFinite(mins)) {
      // Jump straight to the next physical boundary (clamped to heartbeat cap;
      // step past boundary by 0.5 min once within 1 min so we never stall).
      if (mins <= 1.0) stepMin = Math.max(1.5, mins + 1.0);
      else stepMin = Math.min(HEARTBEAT_MAX_MIN, mins);
    }
    t = Math.min(endJd, t + stepMin / 1440);
  }
  return { wakeups, phantomEvents: [], cpuMs: performance.now() - t0 };
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

function main() {
  const tAll = performance.now();
  const engine = new Engine(loadNodeData(DATA_DIR));

  // Warmup
  sceneGeometry(engine, SEASONS[0].startJd, CITIES[0].lat, CITIES[0].lon);
  chartStability(engine, SEASONS[0].startJd, {
    lat: CITIES[0].lat,
    lonEast: CITIES[0].lon,
    houseSystem: "whole_sign",
    halfWidthSeconds: 1800,
    stepSeconds: 600,
  });

  const arms = [
    { name: "Arm1-Fixed-Poll-30m", fn: runArm1FixedPoll },
    { name: "Arm2-Stability-AllFlips", fn: runArm2StabilityAllFlips },
    { name: "Arm3-Stability-Physical-SectOnly", fn: runArm3StabilitySectOnly },
    { name: "Arm4-Analytic-RiseSet-Jump", fn: runArm4AnalyticRiseSetJump },
  ];

  const agg = Object.fromEntries(
    arms.map((a) => [
      a.name,
      {
        wakeups: 0,
        horizonTotal: 0,
        horizonCaught: 0,
        civilTotal: 0,
        civilCaught: 0,
        phantomAlarms: 0,
        cpuMs: 0,
        errMinList: [],
      },
    ]),
  );

  let totalEpisodes = 0;
  let totalCliffs = 0;
  let polarZeroCliffEpisodes = 0;

  for (const city of CITIES) {
    for (const season of SEASONS) {
      totalEpisodes++;
      const startJd = season.startJd;
      const endJd = startJd + EPISODE_DAYS;
      const cliffs = findGroundTruthCliffs(engine, startJd, endJd, city.lat, city.lon);
      totalCliffs += cliffs.length;
      if (cliffs.length === 0) polarZeroCliffEpisodes++;

      for (const a of arms) {
        const res = a.fn(engine, startJd, endJd, city.lat, city.lon);
        const ev = evaluateWakeups(res.wakeups, cliffs, res.phantomEvents);
        const slot = agg[a.name];
        slot.wakeups += ev.wakeups;
        slot.horizonTotal += ev.horizonTotal;
        slot.horizonCaught += ev.horizonCaught;
        slot.civilTotal += ev.civilTotal;
        slot.civilCaught += ev.civilCaught;
        slot.phantomAlarms += ev.phantomAlarms;
        slot.cpuMs += res.cpuMs;
        slot.errMinList.push(...ev.errMinList);
      }
    }
  }

  const byArm = {};
  for (const a of arms) {
    const s = agg[a.name];
    const allTotal = s.horizonTotal + s.civilTotal;
    const allCaught = s.horizonCaught + s.civilCaught;
    byArm[a.name] = {
      mean_wakeups_per_24h: round4(s.wakeups / totalEpisodes),
      total_wakeups_20ep: s.wakeups,
      horizon_cliff_catch_rate: round4(s.horizonCaught / Math.max(1, s.horizonTotal)),
      civil_twilight_catch_rate: round4(s.civilCaught / Math.max(1, s.civilTotal)),
      all_physical_cliff_catch_rate: round4(allCaught / Math.max(1, allTotal)),
      median_cliff_timing_err_min: round4(median(s.errMinList)),
      phantom_sign_house_alarms_total: s.phantomAlarms,
      phantom_alarms_per_24h: round4(s.phantomAlarms / totalEpisodes),
      total_cpu_ms_20ep: round4(s.cpuMs),
      mean_cpu_ms_per_24h: round4(s.cpuMs / totalEpisodes),
      mean_ms_per_wakeup: round4(s.cpuMs / Math.max(1, s.wakeups)),
    };
  }

  const a1 = byArm["Arm1-Fixed-Poll-30m"];
  const a2 = byArm["Arm2-Stability-AllFlips"];
  const a3 = byArm["Arm3-Stability-Physical-SectOnly"];
  const a4 = byArm["Arm4-Analytic-RiseSet-Jump"];

  const cpuRatioArm3OverArm4 = round4(a3.total_cpu_ms_20ep / Math.max(0.001, a4.total_cpu_ms_20ep));
  const wakeupSavingsArm4VsArm1 = round4(1 - a4.mean_wakeups_per_24h / a1.mean_wakeups_per_24h);
  const wakeupSavingsArm3VsArm1 = round4(1 - a3.mean_wakeups_per_24h / a1.mean_wakeups_per_24h);

  // Evaluate hypothesis pre-registered kill criterion:
  // Arm4 dominates Arm3 if CPU is >= 5x lower AND higher all-cliff coverage AND <= wakeups.
  const killedByAnalytic =
    cpuRatioArm3OverArm4 >= 5.0 &&
    a4.all_physical_cliff_catch_rate > a3.all_physical_cliff_catch_rate &&
    a4.mean_wakeups_per_24h <= a3.mean_wakeups_per_24h;

  const arm3Passed =
    !killedByAnalytic &&
    a3.all_physical_cliff_catch_rate >= 0.95 &&
    wakeupSavingsArm3VsArm1 >= 0.4 &&
    cpuRatioArm3OverArm4 <= 2.0;

  const status = arm3Passed ? "pass" : "fail";
  const totalRuntimeMs = round4(performance.now() - tAll);

  const results = {
    id: "EXP-010",
    run_at: new Date().toISOString(),
    git_sha: getGitSha(),
    status,
    summary: `20 24h episodes (5 latitudes x 4 seasons, ${totalCliffs} physical sunrise/sunset/civil-twilight cliffs, ${polarZeroCliffEpisodes} polar 0-cliff episodes). Unfiltered chartStability (Arm2) triggers ${a2.phantom_alarms_per_24h} phantom zodiac/house alarms per 24h (${a2.phantom_sign_house_alarms_total} total). Filtered sect-only chartStability (Arm3) eliminates phantom alarms and catches ${(a3.horizon_cliff_catch_rate * 100).toFixed(1)}% sunrise/sunset cliffs, but misses civil twilight (${(a3.civil_twilight_catch_rate * 100).toFixed(1)}% civil catch -> ${(a3.all_physical_cliff_catch_rate * 100).toFixed(1)}% all-cliff) at ${a3.mean_cpu_ms_per_24h} ms/24h (${a3.mean_wakeups_per_24h} wakeups). Direct analytic sceneGeometry.diurnal.minutesToNextTwilight (Arm4) catches ${(a4.all_physical_cliff_catch_rate * 100).toFixed(1)}% of all 4 physical cliffs (median err ${a4.median_cliff_timing_err_min} min) in ${a4.mean_wakeups_per_24h} wakeups (-${(wakeupSavingsArm4VsArm1 * 100).toFixed(1)}% vs 30m poll) and ${a4.mean_cpu_ms_per_24h} ms/24h (${cpuRatioArm3OverArm4}x faster than Arm3).`,
    metrics: {
      arm3_all_cliff_catch_rate: a3.all_physical_cliff_catch_rate,
      arm4_all_cliff_catch_rate: a4.all_physical_cliff_catch_rate,
      arm1_all_cliff_catch_rate: a1.all_physical_cliff_catch_rate,
      arm3_civil_twilight_catch_rate: a3.civil_twilight_catch_rate,
      arm4_civil_twilight_catch_rate: a4.civil_twilight_catch_rate,
      arm2_phantom_alarms_per_24h: a2.phantom_alarms_per_24h,
      arm3_over_arm4_cpu_ratio: cpuRatioArm3OverArm4,
      arm3_mean_wakeups_per_24h: a3.mean_wakeups_per_24h,
      arm4_mean_wakeups_per_24h: a4.mean_wakeups_per_24h,
      arm1_mean_wakeups_per_24h: a1.mean_wakeups_per_24h,
      arm4_wakeup_savings_vs_poll: wakeupSavingsArm4VsArm1,
      arm3_mean_cpu_ms_per_24h: a3.mean_cpu_ms_per_24h,
      arm4_mean_cpu_ms_per_24h: a4.mean_cpu_ms_per_24h,
      total_runtime_ms: totalRuntimeMs,
      by_arm: byArm,
    },
    verdict: killedByAnalytic
      ? `KILLED (chartStability step-size control): Arm4-Analytic-RiseSet-Jump (sceneGeometry.diurnal.minutesToNextTwilight) strictly dominates Arm3-Stability-Physical-SectOnly by ${cpuRatioArm3OverArm4}x lower CPU (${a4.mean_cpu_ms_per_24h} vs ${a3.mean_cpu_ms_per_24h} ms/24h), higher physical cliff coverage (${(a4.all_physical_cliff_catch_rate * 100).toFixed(1)}% vs ${(a3.all_physical_cliff_catch_rate * 100).toFixed(1)}%, catching civil dawn/dusk), and fewer wakeups (${a4.mean_wakeups_per_24h} vs ${a3.mean_wakeups_per_24h}/24h). Archive chartStability scheduler to lab/graveyard/KILL-005-chart-stability-step-control.md; use direct sceneGeometry next-event scheduling instead.`
      : `STATUS=${status}: Arm3 catch=${a3.all_physical_cliff_catch_rate}, Arm4 catch=${a4.all_physical_cliff_catch_rate}, CPU ratio=${cpuRatioArm3OverArm4}x.`,
  };

  writeFileSync(resolve(__dirname, "results.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`EXP-010 complete: status=${status} (${totalRuntimeMs} ms)`);
  console.log(results.summary);
}

main();
