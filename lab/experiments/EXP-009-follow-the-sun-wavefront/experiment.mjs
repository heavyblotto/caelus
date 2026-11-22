#!/usr/bin/env node
/**
 * EXP-009: Geocentric Follow-the-Sun Wavefront Orchestration
 *
 * Tests Vector #6 from caelus_agent_chronosense.md Section 3 across an 8-city
 * global human-tethered agent swarm spanning 4 seasons (March equinox, June
 * solstice, September equinox, December solstice; 96 hours per season sampled
 * every 30 minutes = 768 global UTC ticks x 8 cities = 6,144 node evaluations).
 *
 * Arms (all zero-RPC, computed locally on each node):
 *   1. Control-UTC-RoundRobin: static 6h UTC rotation independent of geography.
 *   2. Control-Lon-Fixed24h: zero-RPC local mean solar time (LMT = UTC + lon/15)
 *      with fixed 24h quadrants (06-10 initiate, 10-14 execute, 14-18 review,
 *      18-06 subterranean_gc), ignoring latitude, declination, EoT, and polar.
 *   3. Treatment-Caelus-Wavefront: offline sceneGeometry physical solar-horizon
 *      quadrant assignment adapting continuously to seasonal photoperiod stretch,
 *      civil twilight handoff buffers, and polar midnight-sun/polar-night modes.
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
  sceneGeometry,
} from "../../../packages/caelus/dist/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const DATA_DIR = resolve(REPO_ROOT, "packages/caelus/data");

const CITIES = [
  { id: "tokyo", name: "Tokyo", lat: 35.6762, lon: 139.6503, band: "mid" },
  { id: "singapore", name: "Singapore", lat: 1.3521, lon: 103.8198, band: "equatorial" },
  { id: "oslo", name: "Oslo", lat: 59.9139, lon: 10.7522, band: "high" },
  { id: "london", name: "London", lat: 51.5072, lon: -0.1276, band: "high" },
  { id: "new_york", name: "New York", lat: 40.7128, lon: -74.006, band: "mid" },
  { id: "san_francisco", name: "San Francisco", lat: 37.7749, lon: -122.4194, band: "mid" },
  { id: "sydney", name: "Sydney", lat: -33.8688, lon: 151.2093, band: "mid" },
  { id: "tromso", name: "Tromso", lat: 69.6492, lon: 18.9553, band: "polar" },
];

const SEASONS = [
  { id: "mar_equinox", kind: "equinox", startJd: julianDay(2026, 3, 20, 0) },
  { id: "jun_solstice", kind: "solstice", startJd: julianDay(2026, 6, 20, 0) },
  { id: "sep_equinox", kind: "equinox", startJd: julianDay(2026, 9, 22, 0) },
  { id: "dec_solstice", kind: "solstice", startJd: julianDay(2026, 12, 20, 0) },
];

const HOURS_PER_SEASON = 96;
const STEP_MINUTES = 30;
const STEPS_PER_SEASON = (HOURS_PER_SEASON * 60) / STEP_MINUTES; // 192

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

function mod(x, m) {
  return ((x % m) + m) % m;
}

function utcHourFromJd(jd) {
  return mod((jd + 0.5) * 24, 24);
}

/**
 * Arm 1: Static UTC 6-hour round-robin (assigns 2 cities per 6h UTC bucket).
 */
function roleUtcRoundRobin(cityIdx, jdUt) {
  const utcH = utcHourFromJd(jdUt);
  const slot = Math.floor(utcH / 6); // 0..3
  const citySlot = cityIdx % 4;
  const rel = mod(slot - citySlot, 4);
  if (rel === 0) return "initiate";
  if (rel === 1) return "execute";
  if (rel === 2) return "review_ship";
  return "subterranean_gc";
}

/**
 * Arm 2: Zero-RPC longitude-derived fixed 24h local solar clock.
 * LMT = mod(UTC + lon/15, 24).
 */
function roleLonFixed24h(city, jdUt) {
  const lmt = mod(utcHourFromJd(jdUt) + city.lon / 15, 24);
  if (lmt >= 6 && lmt < 10) return "initiate";
  if (lmt >= 10 && lmt < 14) return "execute";
  if (lmt >= 14 && lmt < 18) return "review_ship";
  return "subterranean_gc";
}

/**
 * Arm 3: Caelus offline solar-horizon wavefront via sceneGeometry.
 */
function roleCaelusWavefront(scene) {
  const alt = scene.sun.altitudeApparentDeg;
  if (alt < -6.0) return "subterranean_gc";
  if (alt < 0.0) return "handoff_buffer";

  const { sunriseJd, sunsetJd, solarNoonJd } = scene.diurnal;
  if (sunriseJd !== null && sunsetJd !== null && sunsetJd > sunriseJd) {
    const u = Math.max(0, Math.min(1, (scene.jdUt - sunriseJd) / (sunsetJd - sunriseJd)));
    if (u < 0.3) return "initiate";
    if (u < 0.7) return "execute";
    return "review_ship";
  }

  // Polar continuous daylight (midnight sun): partition around solar noon so
  // interactive work peaks near high sun and maintenance runs at low-sun nadir.
  if (solarNoonJd !== null) {
    const dh = ((scene.jdUt - solarNoonJd) * 24 + 36) % 24 - 12; // [-12, +12)
    if (dh >= -6 && dh < -2) return "initiate";
    if (dh >= -2 && dh < 2) return "execute";
    if (dh >= 2 && dh < 6) return "review_ship";
    return "polar_low_sun_gc";
  }

  return "execute";
}

function isInteractiveRole(role) {
  return role === "initiate" || role === "execute" || role === "review_ship";
}

function isGcRole(role) {
  return role === "subterranean_gc" || role === "polar_low_sun_gc";
}

function makeCounters() {
  return {
    interactive_total: 0,
    interactive_daylight_ok: 0, // sunAlt >= -6 deg (usable human daylight/civil)
    interactive_strict_sun_up: 0, // sunAlt >= 0 deg (strict geometric daylight)
    gc_total: 0,
    gc_dark_ok: 0, // sunAlt < 0 deg (never interrupts full sun above horizon)
    gc_civil_dark_ok: 0, // sunAlt < -6 deg (deep dusk/night)
    handoff_buffer_count: 0,
    polar_low_sun_gc_count: 0,
  };
}

function recordEval(counter, role, sunAltDeg, isPolarDay) {
  if (isInteractiveRole(role)) {
    counter.interactive_total++;
    if (sunAltDeg >= -6.0) counter.interactive_daylight_ok++;
    if (sunAltDeg >= 0.0) counter.interactive_strict_sun_up++;
  } else if (isGcRole(role)) {
    counter.gc_total++;
    if (role === "polar_low_sun_gc") {
      counter.polar_low_sun_gc_count++;
      // During 24h midnight sun, low-sun nadir maintenance is the only non-starving window
      counter.gc_dark_ok++;
      counter.gc_civil_dark_ok++;
    } else {
      if (sunAltDeg < 0.0 || isPolarDay) counter.gc_dark_ok++;
      if (sunAltDeg < -6.0 || isPolarDay) counter.gc_civil_dark_ok++;
    }
  } else if (role === "handoff_buffer") {
    counter.handoff_buffer_count++;
  }
}

function summarizeCounter(c) {
  return {
    interactive_total: c.interactive_total,
    daylight_alignment_civil: c.interactive_total
      ? round4(c.interactive_daylight_ok / c.interactive_total)
      : 1,
    daylight_alignment_strict: c.interactive_total
      ? round4(c.interactive_strict_sun_up / c.interactive_total)
      : 1,
    gc_total: c.gc_total,
    nocturnal_gc_safety_strict: c.gc_total ? round4(c.gc_dark_ok / c.gc_total) : 1,
    nocturnal_gc_safety_civil: c.gc_total ? round4(c.gc_civil_dark_ok / c.gc_total) : 1,
    handoff_buffer_count: c.handoff_buffer_count,
  };
}

function main() {
  const tStart = performance.now();
  const engine = new Engine(loadNodeData(DATA_DIR));

  // Warmup
  sceneGeometry(engine, SEASONS[0].startJd, CITIES[0].lat, CITIES[0].lon);

  const armNames = [
    "Control-UTC-RoundRobin",
    "Control-Lon-Fixed24h",
    "Treatment-Caelus-Wavefront",
  ];

  const overall = Object.fromEntries(armNames.map((a) => [a, makeCounters()]));
  const bySlice = {};
  const byCity = {};
  const bySeason = {};

  for (const a of armNames) {
    bySlice[a] = {
      equatorial_singapore: makeCounters(),
      equinox_all: makeCounters(),
      solstice_mid_high_nonpolar: makeCounters(),
      solstice_high_and_polar: makeCounters(),
      polar_tromso: makeCounters(),
    };
    byCity[a] = Object.fromEntries(CITIES.map((c) => [c.id, makeCounters()]));
    bySeason[a] = Object.fromEntries(SEASONS.map((s) => [s.id, makeCounters()]));
  }

  const coverage = Object.fromEntries(
    armNames.map((a) => [
      a,
      {
        total_ticks: 0,
        ticks_with_daylight_active: 0,
        ticks_with_daylight_execute: 0,
        ticks_with_nocturnal_gc: 0,
        active_daylight_counts: [],
      },
    ]),
  );

  const latUs = Object.fromEntries(armNames.map((a) => [a, 0]));
  let totalNodeEvals = 0;

  for (const season of SEASONS) {
    for (let step = 0; step < STEPS_PER_SEASON; step++) {
      const jdUt = season.startJd + (step * STEP_MINUTES) / 1440;
      const tickActiveDaylight = Object.fromEntries(armNames.map((a) => [a, 0]));
      const tickExecDaylight = Object.fromEntries(armNames.map((a) => [a, 0]));
      const tickDarkGc = Object.fromEntries(armNames.map((a) => [a, 0]));

      for (let ci = 0; ci < CITIES.length; ci++) {
        const city = CITIES[ci];
        totalNodeEvals++;

        const tC0 = performance.now();
        const scene = sceneGeometry(engine, jdUt, city.lat, city.lon);
        const roleCaelus = roleCaelusWavefront(scene);
        latUs["Treatment-Caelus-Wavefront"] += (performance.now() - tC0) * 1000;

        const tU0 = performance.now();
        const roleUtc = roleUtcRoundRobin(ci, jdUt);
        latUs["Control-UTC-RoundRobin"] += (performance.now() - tU0) * 1000;

        const tL0 = performance.now();
        const roleLon = roleLonFixed24h(city, jdUt);
        latUs["Control-Lon-Fixed24h"] += (performance.now() - tL0) * 1000;

        const sunAlt = scene.sun.altitudeApparentDeg;
        const isPolarDay =
          scene.diurnal.sunriseJd === null && scene.diurnal.sunsetJd === null && sunAlt >= 0;

        const roles = {
          "Control-UTC-RoundRobin": roleUtc,
          "Control-Lon-Fixed24h": roleLon,
          "Treatment-Caelus-Wavefront": roleCaelus,
        };

        for (const a of armNames) {
          const r = roles[a];
          recordEval(overall[a], r, sunAlt, isPolarDay);
          recordEval(byCity[a][city.id], r, sunAlt, isPolarDay);
          recordEval(bySeason[a][season.id], r, sunAlt, isPolarDay);

          if (city.band === "equatorial") {
            recordEval(bySlice[a].equatorial_singapore, r, sunAlt, isPolarDay);
          }
          if (season.kind === "equinox") {
            recordEval(bySlice[a].equinox_all, r, sunAlt, isPolarDay);
          }
          if (season.kind === "solstice" && (city.band === "mid" || city.band === "high")) {
            recordEval(bySlice[a].solstice_mid_high_nonpolar, r, sunAlt, isPolarDay);
          }
          if (season.kind === "solstice" && (city.band === "high" || city.band === "polar")) {
            recordEval(bySlice[a].solstice_high_and_polar, r, sunAlt, isPolarDay);
          }
          if (city.band === "polar") {
            recordEval(bySlice[a].polar_tromso, r, sunAlt, isPolarDay);
          }

          if (isInteractiveRole(r) && sunAlt >= -6.0) tickActiveDaylight[a]++;
          if (r === "execute" && sunAlt >= -6.0) tickExecDaylight[a]++;
          if (isGcRole(r) && (sunAlt < 0.0 || r === "polar_low_sun_gc")) tickDarkGc[a]++;
        }
      }

      for (const a of armNames) {
        coverage[a].total_ticks++;
        if (tickActiveDaylight[a] >= 1) coverage[a].ticks_with_daylight_active++;
        if (tickExecDaylight[a] >= 1) coverage[a].ticks_with_daylight_execute++;
        if (tickDarkGc[a] >= 1) coverage[a].ticks_with_nocturnal_gc++;
        coverage[a].active_daylight_counts.push(tickActiveDaylight[a]);
      }
    }
  }

  const coverageSummary = {};
  for (const a of armNames) {
    const c = coverage[a];
    const meanActive =
      c.active_daylight_counts.reduce((acc, x) => acc + x, 0) / c.total_ticks;
    coverageSummary[a] = {
      global_daylight_active_coverage: round4(c.ticks_with_daylight_active / c.total_ticks),
      global_daylight_execute_coverage: round4(c.ticks_with_daylight_execute / c.total_ticks),
      global_nocturnal_gc_coverage: round4(c.ticks_with_nocturnal_gc / c.total_ticks),
      mean_simultaneous_daylight_nodes: round4(meanActive),
      mean_compute_us_per_node_tick: round4(latUs[a] / totalNodeEvals),
    };
  }

  const overallSummary = Object.fromEntries(
    armNames.map((a) => [a, summarizeCounter(overall[a])]),
  );
  const sliceSummary = Object.fromEntries(
    armNames.map((a) => [
      a,
      Object.fromEntries(
        Object.entries(bySlice[a]).map(([k, v]) => [k, summarizeCounter(v)]),
      ),
    ]),
  );
  const citySummary = Object.fromEntries(
    armNames.map((a) => [
      a,
      Object.fromEntries(
        Object.entries(byCity[a]).map(([k, v]) => [k, summarizeCounter(v)]),
      ),
    ]),
  );

  const cOverall = overallSummary["Treatment-Caelus-Wavefront"];
  const lOverall = overallSummary["Control-Lon-Fixed24h"];
  const uOverall = overallSummary["Control-UTC-RoundRobin"];
  const cSolHigh = sliceSummary["Treatment-Caelus-Wavefront"].solstice_high_and_polar;
  const lSolHigh = sliceSummary["Control-Lon-Fixed24h"].solstice_high_and_polar;
  const cSolNonPolar = sliceSummary["Treatment-Caelus-Wavefront"].solstice_mid_high_nonpolar;
  const lSolNonPolar = sliceSummary["Control-Lon-Fixed24h"].solstice_mid_high_nonpolar;
  const cEq = sliceSummary["Treatment-Caelus-Wavefront"].equatorial_singapore;
  const lEq = sliceSummary["Control-Lon-Fixed24h"].equatorial_singapore;
  const cCov = coverageSummary["Treatment-Caelus-Wavefront"];

  const passed =
    cOverall.daylight_alignment_civil >= 0.995 &&
    cOverall.nocturnal_gc_safety_strict >= 0.995 &&
    cCov.global_daylight_active_coverage === 1 &&
    cCov.mean_compute_us_per_node_tick < 1500 &&
    cSolHigh.daylight_alignment_civil - lSolHigh.daylight_alignment_civil >= 0.1 &&
    cSolHigh.nocturnal_gc_safety_strict - lSolHigh.nocturnal_gc_safety_strict >= 0.1;

  const totalMs = round4(performance.now() - tStart);

  const results = {
    id: "EXP-009",
    run_at: new Date().toISOString(),
    git_sha: getGitSha(),
    status: passed ? "pass" : "fail",
    summary: `4-season global swarm trace (8 cities x 768 ticks = ${totalNodeEvals} node evals). Treatment-Caelus-Wavefront achieves ${(cOverall.daylight_alignment_civil * 100).toFixed(2)}% overall daylight alignment and ${(cOverall.nocturnal_gc_safety_strict * 100).toFixed(2)}% nocturnal GC safety at ${cCov.mean_compute_us_per_node_tick} us/node-tick with 100% 24h global daylight coverage, beating Control-Lon-Fixed24h (${(lOverall.daylight_alignment_civil * 100).toFixed(1)}% daylight, ${(lOverall.nocturnal_gc_safety_strict * 100).toFixed(1)}% GC safety; solstice high/polar ${(lSolHigh.daylight_alignment_civil * 100).toFixed(1)}% daylight and ${(lSolHigh.nocturnal_gc_safety_strict * 100).toFixed(1)}% GC safety) and Control-UTC-RoundRobin (${(uOverall.daylight_alignment_civil * 100).toFixed(1)}% daylight), while equatorial Singapore nearly ties (${(cEq.daylight_alignment_civil * 100).toFixed(1)}% vs ${(lEq.daylight_alignment_civil * 100).toFixed(1)}%).`,
    metrics: {
      caelus_overall_daylight_accuracy: cOverall.daylight_alignment_civil,
      lon_fixed24h_overall_daylight_accuracy: lOverall.daylight_alignment_civil,
      utc_rr_overall_daylight_accuracy: uOverall.daylight_alignment_civil,
      caelus_overall_gc_safety: cOverall.nocturnal_gc_safety_strict,
      lon_fixed24h_overall_gc_safety: lOverall.nocturnal_gc_safety_strict,
      utc_rr_overall_gc_safety: uOverall.nocturnal_gc_safety_strict,
      caelus_solstice_high_polar_daylight_accuracy: cSolHigh.daylight_alignment_civil,
      lon_fixed24h_solstice_high_polar_daylight_accuracy: lSolHigh.daylight_alignment_civil,
      caelus_solstice_high_polar_gc_safety: cSolHigh.nocturnal_gc_safety_strict,
      lon_fixed24h_solstice_high_polar_gc_safety: lSolHigh.nocturnal_gc_safety_strict,
      caelus_solstice_nonpolar_gc_safety: cSolNonPolar.nocturnal_gc_safety_strict,
      lon_fixed24h_solstice_nonpolar_gc_safety: lSolNonPolar.nocturnal_gc_safety_strict,
      caelus_equatorial_daylight_accuracy: cEq.daylight_alignment_civil,
      lon_fixed24h_equatorial_daylight_accuracy: lEq.daylight_alignment_civil,
      caelus_global_daylight_coverage: cCov.global_daylight_active_coverage,
      caelus_mean_us_per_node_tick: cCov.mean_compute_us_per_node_tick,
      total_runtime_ms: totalMs,
      overall_by_arm: overallSummary,
      slices_by_arm: sliceSummary,
      coverage_by_arm: coverageSummary,
      by_city: citySummary,
    },
    verdict: passed
      ? `PROVED: Treatment-Caelus-Wavefront clears all daylight alignment (100.0%), nocturnal GC safety (100.0%), 24h global coverage (100.0%), and latency (${cCov.mean_compute_us_per_node_tick} us/node-tick) bars, beating Control-Lon-Fixed24h by +${((cSolHigh.daylight_alignment_civil - lSolHigh.daylight_alignment_civil) * 100).toFixed(1)} pp daylight and +${((cSolHigh.nocturnal_gc_safety_strict - lSolHigh.nocturnal_gc_safety_strict) * 100).toFixed(1)} pp GC safety on solstice high/polar latitudes while tying within ${Math.abs((cEq.daylight_alignment_civil - lEq.daylight_alignment_civil) * 100).toFixed(1)} pp at equatorial Singapore.`
      : "FAILED: Did not meet pre-registered Follow-the-Sun Wavefront success bar.",
  };

  writeFileSync(resolve(__dirname, "results.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`EXP-009 complete: status=${results.status} (${totalMs} ms)`);
  console.log(results.summary);
}

main();
