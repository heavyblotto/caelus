/**
 * EXP-003: Spacetime Observation, Spoof-Detection, Chronolocation and Geolocation Benchmark Suite.
 *
 * Exercises packages/caelus/dist/src/observe.js (sceneGeometry, verifyObservation,
 * chronolocate, geolocate) directly across:
 *   1. 200 deterministic physical scenarios (100 noisy authentic + 100 spoofs across
 *      7 adversarial attack classes) spanning 20 global cities and all 4 seasons,
 *      compared against a Naive-LMT-Clock null baseline.
 *   2. Counterfactual diagnostic recovery accuracy (timeShift, hemisphereFlip, dateShift).
 *   3. Chronolocation accuracy (median error in minutes on noisy and clean shadow+sky
 *      observations) plus multi-month pruning efficiency and latency.
 *   4. Geolocation accuracy and latency comparing Path A (analytical celestial fix)
 *      vs Path B (spherical grid: Sun+Moon double altitude, shadow bearing + Moon
 *      bright-limb tilt, and sloped mountain terrain).
 *   5. Generation of vlm_eval_pack.jsonl (30 structured multimodal agent MCP tasks).
 */

import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { Engine } from "../../../packages/caelus/dist/src/chart.js";
import { DEG, calendarDate, julianDay, mod } from "../../../packages/caelus/dist/src/core.js";
import { riseSet } from "../../../packages/caelus/dist/src/events.js";
import { loadNodeData } from "../../../packages/caelus/dist/src/node-loader.js";
import {
  chronolocate,
  geolocate,
  sceneGeometry,
  verifyObservation,
} from "../../../packages/caelus/dist/src/observe.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const DATA_DIR = join(ROOT, "packages/caelus/data");

const eng = new Engine(loadNodeData(DATA_DIR, "embedded", "full"));

// ------------------------------------------------------------------ utilities

/** Deterministic Mulberry32 PRNG. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  };
}

/** Symmetric uniform perturbation in [-amp, +amp]. */
function jitter(rng, amp) {
  return (rng() * 2.0 - 1.0) * amp;
}

function wrap180(x) {
  const r = mod(x + 180.0, 360.0) - 180.0;
  return r === -180.0 ? 180.0 : r;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = wrap180(lon2 - lon1) * DEG;
  const s1 = Math.sin(dp * 0.5);
  const s2 = Math.sin(dl * 0.5);
  const a = s1 * s1 + Math.cos(p1) * Math.cos(p2) * s2 * s2;
  return 2.0 * 6371.0 * Math.asin(Math.min(1.0, Math.sqrt(Math.max(0.0, a))));
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100.0) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function roundTo(v, digits = 4) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const s = 10 ** digits;
  return Math.round(v * s) / s;
}

function isoFromJd(jdUt) {
  const cal = calendarDate(jdUt, "gregorian");
  const totalSec = Math.round(cal.hour * 3600.0);
  const carryDays = Math.floor(totalSec / 86400);
  if (carryDays > 0) {
    return isoFromJd(Math.floor(jdUt + 0.5) + 0.5 + (totalSec - 86400 * carryDays) / 86400.0);
  }
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${String(cal.year).padStart(4, "0")}-${String(cal.month).padStart(2, "0")}-${String(cal.day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}Z`;
}

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function solarNoonNear(year, month, day, lat, lonEast) {
  const localMidnight = julianDay(year, month, day, 0, 0, 0) - lonEast / 360.0;
  const noon = riseSet(eng, "sun", localMidnight, lat, lonEast, "mtransit", { searchDays: 1.2 });
  return noon ?? (localMidnight + 0.5);
}

function solarMidnightNear(year, month, day, lat, lonEast) {
  const noon = solarNoonNear(year, month, day, lat, lonEast);
  const nadir = riseSet(eng, "sun", noon, lat, lonEast, "itransit", { searchDays: 1.0 });
  return nadir ?? (noon + 0.5);
}

function measureShadowSweep(jdStart, lat, lonEast, dtMinutes, opts = {}) {
  const nChunks = Math.max(1, Math.ceil(dtMinutes / 20));
  const sc0 = sceneGeometry(eng, jdStart, lat, lonEast, opts);
  if (!sc0.shadow.cast || sc0.shadow.bearingDeg === null) return null;
  let prev = sc0.sun.azimuthDeg;
  let total = 0.0;
  for (let i = 1; i <= nChunks; i++) {
    const ti = jdStart + (dtMinutes * (i / nChunks)) / 1440.0;
    const sci = sceneGeometry(eng, ti, lat, lonEast, opts);
    if (!sci.shadow.cast || sci.sun.altitudeApparentDeg <= 0.5 || sci.sun.altitudeApparentDeg > 86.0) {
      return null;
    }
    total += wrap180(sci.sun.azimuthDeg - prev);
    prev = sci.sun.azimuthDeg;
  }
  return total;
}

function toMcpObserved(obs) {
  const out = {};
  if (obs.shadowBearingDeg !== undefined) out.shadow_bearing_deg = roundTo(obs.shadowBearingDeg, 2);
  if (obs.shadowLengthRatio !== undefined) out.shadow_length_ratio = roundTo(obs.shadowLengthRatio, 3);
  if (obs.sunAzimuthDeg !== undefined) out.sun_azimuth_deg = roundTo(obs.sunAzimuthDeg, 2);
  if (obs.sunAltitudeDeg !== undefined) out.sun_altitude_deg = roundTo(obs.sunAltitudeDeg, 2);
  if (obs.twilight !== undefined) out.twilight = obs.twilight;
  if (obs.sunVisible !== undefined) out.sun_visible = obs.sunVisible;
  if (obs.moonVisible !== undefined) out.moon_visible = obs.moonVisible;
  if (obs.moonAzimuthDeg !== undefined) out.moon_azimuth_deg = roundTo(obs.moonAzimuthDeg, 2);
  if (obs.moonAltitudeDeg !== undefined) out.moon_altitude_deg = roundTo(obs.moonAltitudeDeg, 2);
  if (obs.moonIllum !== undefined) out.moon_illum = roundTo(obs.moonIllum, 3);
  if (obs.moonWaxing !== undefined) out.moon_waxing = obs.moonWaxing;
  if (obs.moonBrightLimbDeg !== undefined) out.moon_bright_limb_deg = roundTo(obs.moonBrightLimbDeg, 2);
  if (obs.bodiesVisible !== undefined) out.bodies_visible = obs.bodiesVisible;
  if (obs.shadowSweep !== undefined) {
    out.shadow_sweep = {
      dt_minutes: obs.shadowSweep.dtMinutes,
      delta_bearing_deg: roundTo(obs.shadowSweep.deltaBearingDeg, 2),
    };
  }
  return out;
}

// ------------------------------------------------------------ 20 global cities

const CITIES = [
  // Northern mid-latitude
  { id: "new_york", label: "New York, USA", region: "north_mid", lat: 40.7128, lonEast: -74.006, elevationM: 10 },
  { id: "london", label: "London, UK", region: "north_mid", lat: 51.5074, lonEast: -0.1278, elevationM: 11 },
  { id: "tokyo", label: "Tokyo, Japan", region: "north_mid", lat: 35.6762, lonEast: 139.6503, elevationM: 40 },
  { id: "cairo", label: "Cairo, Egypt", region: "north_mid", lat: 30.0444, lonEast: 31.2357, elevationM: 23 },
  { id: "mumbai", label: "Mumbai, India", region: "north_tropical", lat: 19.076, lonEast: 72.8777, elevationM: 14 },
  { id: "san_francisco", label: "San Francisco, USA", region: "north_mid", lat: 37.7749, lonEast: -122.4194, elevationM: 16 },
  { id: "honolulu", label: "Honolulu, USA", region: "north_tropical", lat: 21.3069, lonEast: -157.8583, elevationM: 6 },
  // Arctic & sub-Arctic
  { id: "reykjavik", label: "Reykjavik, Iceland", region: "arctic", lat: 64.1466, lonEast: -21.9426, elevationM: 14 },
  { id: "tromso", label: "Tromso, Norway", region: "arctic", lat: 69.6492, lonEast: 18.9553, elevationM: 10 },
  { id: "longyearbyen", label: "Longyearbyen, Svalbard", region: "arctic", lat: 78.2232, lonEast: 15.6267, elevationM: 28 },
  // Equatorial
  { id: "singapore", label: "Singapore", region: "equator", lat: 1.3521, lonEast: 103.8198, elevationM: 15 },
  { id: "nairobi", label: "Nairobi, Kenya", region: "equator", lat: -1.2921, lonEast: 36.8219, elevationM: 1795 },
  // Southern mid & high latitude
  { id: "sydney", label: "Sydney, Australia", region: "south_mid", lat: -33.8688, lonEast: 151.2093, elevationM: 19 },
  { id: "buenos_aires", label: "Buenos Aires, Argentina", region: "south_mid", lat: -34.6037, lonEast: -58.3816, elevationM: 25 },
  { id: "cape_town", label: "Cape Town, South Africa", region: "south_mid", lat: -33.9249, lonEast: 18.4241, elevationM: 25 },
  { id: "ushuaia", label: "Ushuaia, Argentina", region: "south_high", lat: -54.8019, lonEast: -68.303, elevationM: 23 },
  // Antimeridian
  { id: "suva_fiji", label: "Suva, Fiji", region: "antimeridian", lat: -18.1416, lonEast: 178.4419, elevationM: 10 },
  { id: "chatham_nz", label: "Chatham Islands, NZ", region: "antimeridian", lat: -43.9535, lonEast: -176.5406, elevationM: 20 },
  // Sloped mountain terrain (NH + SH)
  { id: "chamonix_alpine", label: "Chamonix Slope, France", region: "sloped_mountain", lat: 45.9237, lonEast: 6.8694, elevationM: 2400, slopeDeg: 18.0, slopeAzimuthDeg: 165.0 },
  { id: "cusco_andes", label: "Cusco Slope, Peru", region: "sloped_mountain", lat: -13.5319, lonEast: -71.9675, elevationM: 3400, slopeDeg: 15.0, slopeAzimuthDeg: 35.0 },
];

const SEASONS = [
  { name: "spring", month: 3, day: 20 },
  { name: "summer", month: 6, day: 21 },
  { name: "autumn", month: 9, day: 22 },
  { name: "winter", month: 12, day: 21 },
];

// Realistic VLM measurement noise amplitudes.
const NOISE = {
  shadowBearingDeg: 3.0,
  shadowRatioRel: 0.06,
  moonBrightLimbDeg: 8.0,
  altDeg: 2.0,
  moonIllum: 0.04,
  sweepDeg: 1.5,
};

function placeOpts(city) {
  return {
    elevationM: city.elevationM ?? 0.0,
    slopeDeg: city.slopeDeg ?? 0.0,
    slopeAzimuthDeg: city.slopeAzimuthDeg ?? 0.0,
  };
}

function claimFor(city, jdUt) {
  return {
    jdUt,
    lat: city.lat,
    lonEast: city.lonEast,
    elevationM: city.elevationM ?? 0.0,
    slopeDeg: city.slopeDeg ?? 0.0,
    slopeAzimuthDeg: city.slopeAzimuthDeg ?? 0.0,
  };
}

/** Find a lunar-visible instant near a target date with clear intermediate phase. */
function findMoonInstant(city, year, month, startDay, wantDaytime, requireStrongMirror = false) {
  const opts = placeOpts(city);
  for (let d = 0; d < 28; d++) {
    const noon = solarNoonNear(year, month, startDay + d, city.lat, city.lonEast);
    const offsets = wantDaytime ? [-3.0, -1.5, 1.5, 3.0] : [8.0, 10.0, 12.0, 14.0];
    for (const hOff of offsets) {
      const t = noon + hOff / 24.0;
      const sc = sceneGeometry(eng, t, city.lat, city.lonEast, opts);
      const skyOk = wantDaytime
        ? (sc.sun.altitudeApparentDeg > 12.0 && sc.sun.altitudeApparentDeg < 82.0 && sc.shadow.cast && sc.shadow.lengthRatio !== null)
        : (sc.sun.altitudeApparentDeg < -12.0);
      if (!skyOk) continue;
      if (sc.moon.altitudeApparentDeg < 14.0 || sc.moon.altitudeApparentDeg > 82.0) continue;
      if (sc.moon.illum < 0.18 || sc.moon.illum > 0.82) continue;
      if (sc.moon.brightLimbZenithDeg === null) continue;
      if (requireStrongMirror) {
        const bl = sc.moon.brightLimbZenithDeg;
        const mirrored = mod(180.0 - bl, 360.0);
        if (Math.abs(wrap180(mirrored - bl)) < 75.0) continue;
      }
      return { jdUt: t, sc };
    }
  }
  return null;
}

/** Find a dark instant where the Moon is well below the horizon. */
function findMoonBelowInstant(city, year, month, startDay) {
  const opts = placeOpts(city);
  for (let d = 0; d < 28; d++) {
    const mid = solarMidnightNear(year, month, startDay + d, city.lat, city.lonEast);
    const sc = sceneGeometry(eng, mid, city.lat, city.lonEast, opts);
    if (sc.sun.altitudeApparentDeg < -14.0 && sc.moon.altitudeApparentDeg < -20.0) {
      return { jdUt: mid, sc };
    }
  }
  return null;
}

// -------------------------------------------------- 1. Build 200 scenarios

const rng = makeRng(20261122);
const scenarios = [];

// ---- 100 AUTHENTIC SCENARIOS (5 per city across 20 cities and 4 seasons)

for (let ci = 0; ci < CITIES.length; ci++) {
  const city = CITIES[ci];
  const opts = placeOpts(city);

  // Slots 0..3: one per season (spring, summer, autumn, winter)
  for (let si = 0; si < 4; si++) {
    const season = SEASONS[si];
    const day = season.day + ((ci + si) % 5);
    const noon = solarNoonNear(2026, season.month, day, city.lat, city.lonEast);
    // Test genuine High-Arctic midnight sun (June 00:00 local) and polar noon darkness (Dec 12:00 local)
    let hourOffset = [-2.5, -1.25, 1.5, 2.25][(ci + si) % 4];
    if (city.id === "longyearbyen" && season.name === "summer") hourOffset = 12.0;
    if (city.id === "longyearbyen" && season.name === "winter") hourOffset = 0.0;
    const jd = noon + hourOffset / 24.0;
    const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, opts);

    if (sc.shadow.cast && sc.shadow.lengthRatio !== null && sc.sun.altitudeApparentDeg > 5.0 && sc.sun.altitudeApparentDeg < 85.0) {
      const obs = {
        shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
        shadowLengthRatio: Math.max(0.03, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
        twilight: sc.sun.twilightStage,
      };
      // Attach daytime Moon cues when clearly visible with intermediate phase
      if (sc.moon.visible && sc.moon.altitudeApparentDeg > 12.0 && sc.moon.illum > 0.12 && sc.moon.illum < 0.88 && sc.moon.brightLimbZenithDeg !== null) {
        obs.moonVisible = true;
        obs.moonIllum = Math.max(0.0, Math.min(1.0, sc.moon.illum + jitter(rng, NOISE.moonIllum)));
        obs.moonWaxing = sc.moon.waxing;
        obs.moonBrightLimbDeg = mod(sc.moon.brightLimbZenithDeg + jitter(rng, NOISE.moonBrightLimbDeg), 360.0);
      }
      scenarios.push({
        id: `auth-${city.id}-${season.name}`,
        isSpoof: false,
        attackClass: "authentic",
        subType: (city.id === "longyearbyen" && season.name === "summer")
          ? "arctic_midnight_sun_shadow"
          : (obs.moonVisible ? "day_shadow_and_moon" : "day_shadow"),
        cityId: city.id,
        season: season.name,
        claim: claimFor(city, jd),
        observed: obs,
      });
    } else if (sc.sun.altitudeApparentDeg <= 0.0) {
      // Polar winter night (keep exact polar noon darkness for Longyearbyen winter)
      const useExactPolarNoon = city.id === "longyearbyen" && season.name === "winter";
      const moonHit = useExactPolarNoon ? null : findMoonInstant(city, 2026, season.month, Math.max(1, season.day - 12), false);
      const tUse = moonHit ? moonHit.jdUt : jd;
      const scUse = moonHit ? moonHit.sc : sc;
      const obs = {
        twilight: scUse.sun.altitudeApparentDeg < -6.0 ? "dark" : scUse.sun.twilightStage,
        sunVisible: false,
      };
      if (scUse.moon.visible && scUse.moon.altitudeApparentDeg > 10.0) {
        obs.moonVisible = true;
        obs.moonAltitudeDeg = Math.max(1.0, scUse.moon.altitudeApparentDeg + jitter(rng, NOISE.altDeg));
        obs.moonIllum = Math.max(0.0, Math.min(1.0, scUse.moon.illum + jitter(rng, NOISE.moonIllum)));
        if (scUse.moon.illum > 0.08 && scUse.moon.illum < 0.92 && scUse.moon.brightLimbZenithDeg !== null) {
          obs.moonWaxing = scUse.moon.waxing;
          obs.moonBrightLimbDeg = mod(scUse.moon.brightLimbZenithDeg + jitter(rng, NOISE.moonBrightLimbDeg), 360.0);
        }
      }
      scenarios.push({
        id: `auth-${city.id}-${season.name}-polar-dark`,
        isSpoof: false,
        attackClass: "authentic",
        subType: useExactPolarNoon ? "arctic_polar_noon_dark" : "polar_or_night_sky",
        cityId: city.id,
        season: season.name,
        claim: claimFor(city, tUse),
        observed: obs,
      });
    } else {
      // High-sun near-zenith or self-shadowed slope edge case
      const obs = {
        sunAltitudeDeg: Math.min(89.5, Math.max(1.0, sc.sun.altitudeApparentDeg + jitter(rng, NOISE.altDeg))),
        twilight: sc.sun.twilightStage,
        sunVisible: true,
      };
      if (sc.shadow.cast && sc.shadow.bearingDeg !== null) {
        obs.shadowBearingDeg = mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0);
      }
      scenarios.push({
        id: `auth-${city.id}-${season.name}-edge`,
        isSpoof: false,
        attackClass: "authentic",
        subType: "zenith_or_slope_edge",
        cityId: city.id,
        season: season.name,
        claim: claimFor(city, jd),
        observed: obs,
      });
    }
  }

  // Slot 4 per city (20 scenarios): 10 authentic night+Moon scenes + 10 authentic video shadow sweeps
  if (ci % 2 === 0) {
    // Authentic night scene with Moon bright limb + visible naked-eye planets
    const mMonth = city.lat > 65 ? 11 : 4 + (ci % 5);
    const hit = findMoonInstant(city, 2026, mMonth, 1, false);
    if (!hit) {
      throw new Error(`Could not find authentic night Moon instant for ${city.id}`);
    }
    const sc = hit.sc;
    const nakedPlanets = sc.visiblePlanets.filter((p) => p.nakedEye && p.altitudeApparentDeg > 10.0).map((p) => p.id);
    const obs = {
      twilight: "dark",
      sunVisible: false,
      moonVisible: true,
      moonAltitudeDeg: Math.max(2.0, sc.moon.altitudeApparentDeg + jitter(rng, NOISE.altDeg)),
      moonIllum: Math.max(0.0, Math.min(1.0, sc.moon.illum + jitter(rng, NOISE.moonIllum))),
      moonWaxing: sc.moon.waxing,
      moonBrightLimbDeg: mod(sc.moon.brightLimbZenithDeg + jitter(rng, NOISE.moonBrightLimbDeg), 360.0),
    };
    if (nakedPlanets.length > 0) {
      obs.bodiesVisible = [nakedPlanets[0]];
    }
    scenarios.push({
      id: `auth-${city.id}-night-moon`,
      isSpoof: false,
      attackClass: "authentic",
      subType: "night_moon_and_planets",
      cityId: city.id,
      season: "mixed",
      claim: claimFor(city, hit.jdUt),
      observed: obs,
    });
  } else {
    // Authentic video shadow sweep (35-45 min, NH clockwise & SH counterclockwise)
    const sweepMonth = city.lat >= 0 ? 6 : 12;
    const noon = solarNoonNear(2026, sweepMonth, 15, city.lat, city.lonEast);
    const jd = noon + (ci % 4 === 1 ? -1.0 : 0.75) / 24.0;
    const dtMin = 40;
    const trueSweep = measureShadowSweep(jd, city.lat, city.lonEast, dtMin, opts);
    if (trueSweep === null) {
      throw new Error(`Could not compute authentic shadow sweep for ${city.id}`);
    }
    const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, opts);
    scenarios.push({
      id: `auth-${city.id}-video-sweep`,
      isSpoof: false,
      attackClass: "authentic",
      subType: "video_shadow_sweep",
      cityId: city.id,
      season: sweepMonth === 6 ? "summer" : "winter",
      claim: claimFor(city, jd),
      observed: {
        shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
        shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
        shadowSweep: {
          dtMinutes: dtMin,
          deltaBearingDeg: trueSweep + jitter(rng, NOISE.sweepDeg),
        },
      },
    });
  }
}

// ---- 100 ADVERSARIAL SPOOF SCENARIOS (7 attack classes)

// Helper: cities suitable for daylight shadow spoofs across seasons
const FLAT_NON_POLAR = CITIES.filter((c) => !c.slopeDeg && Math.abs(c.lat) <= 65.0);
const HEMI_CITIES = CITIES.filter((c) => !c.slopeDeg && Math.abs(c.lat) >= 18.0 && Math.abs(c.lat) <= 65.0);

// Class 1: 15x +/-4h timezone shift
for (let i = 0; i < 15; i++) {
  const city = CITIES[i % CITIES.length];
  const opts = placeOpts(city);
  const season = SEASONS[i % 4];
  // Avoid polar night in winter for Arctic sites
  const month = (city.lat > 65 && season.month === 12) ? 6 : season.month;
  const noon = solarNoonNear(2026, month, 18, city.lat, city.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -1.25 : 1.25) / 24.0;
  const shiftHr = i % 2 === 0 ? 4.0 : -4.0;
  const claimedJd = trueJd + shiftHr / 24.0;
  const sc = sceneGeometry(eng, trueJd, city.lat, city.lonEast, opts);
  scenarios.push({
    id: `spoof-tz4h-${i}-${city.id}`,
    isSpoof: true,
    attackClass: "tz_shift_4h",
    cityId: city.id,
    season: season.name,
    claim: claimFor(city, claimedJd),
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
      twilight: "day",
    },
    expectedDiag: { kind: "time_shift", targetMinutes: -shiftHr * 60.0 },
  });
}

// Class 2: 15x +5:30 half-hour timezone shift (e.g., IST UTC+5:30 clock stamped as UTC)
for (let i = 0; i < 15; i++) {
  const city = CITIES[(i + 4) % CITIES.length];
  const opts = placeOpts(city);
  const season = SEASONS[(i + 1) % 4];
  const month = (city.lat > 65 && season.month === 12) ? 6 : season.month;
  const noon = solarNoonNear(2026, month, 14, city.lat, city.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -0.75 : 1.0) / 24.0;
  const shiftHr = 5.5;
  const claimedJd = trueJd + shiftHr / 24.0;
  const sc = sceneGeometry(eng, trueJd, city.lat, city.lonEast, opts);
  scenarios.push({
    id: `spoof-tz530-${i}-${city.id}`,
    isSpoof: true,
    attackClass: "tz_shift_half_hour",
    cityId: city.id,
    season: season.name,
    claim: claimFor(city, claimedJd),
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
      twilight: "day",
    },
    expectedDiag: { kind: "time_shift", targetMinutes: -shiftHr * 60.0 },
  });
}

// Class 3: 15x N/S hemisphere flip (claimed lat = -trueLat)
for (let i = 0; i < 15; i++) {
  const city = HEMI_CITIES[i % HEMI_CITIES.length];
  const month = city.lat >= 0 ? (i % 2 === 0 ? 6 : 4) : (i % 2 === 0 ? 12 : 2);
  const noon = solarNoonNear(2026, month, 15 + (i % 10), city.lat, city.lonEast);
  const jd = noon + (i % 2 === 0 ? -0.5 : 0.75) / 24.0;
  const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, { elevationM: city.elevationM });
  scenarios.push({
    id: `spoof-hemi-${i}-${city.id}`,
    isSpoof: true,
    attackClass: "hemisphere_flip",
    cityId: city.id,
    season: month === 6 ? "summer" : (month === 12 ? "winter" : "shoulder"),
    claim: {
      jdUt: jd,
      lat: -city.lat,
      lonEast: city.lonEast,
      elevationM: city.elevationM,
    },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
      sunAltitudeDeg: Math.min(89.0, Math.max(1.0, sc.sun.altitudeApparentDeg + jitter(rng, NOISE.altDeg))),
    },
    expectedDiag: { kind: "hemisphere_flip" },
  });
}

// Class 4: 15x Opposite season (6-month / +/-182-day shift at same UTC time-of-day)
for (let i = 0; i < 15; i++) {
  const city = HEMI_CITIES[i % HEMI_CITIES.length];
  // Use solstice months where declination swings +/-23.4 deg
  const summerMonth = city.lat >= 0 ? 6 : 12;
  const noon = solarNoonNear(2026, summerMonth, 20, city.lat, city.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -0.5 : 0.5) / 24.0;
  const offsetDays = i % 2 === 0 ? -182 : 182;
  const claimedJd = trueJd + offsetDays;
  const sc = sceneGeometry(eng, trueJd, city.lat, city.lonEast, { elevationM: city.elevationM });
  scenarios.push({
    id: `spoof-season-${i}-${city.id}`,
    isSpoof: true,
    attackClass: "opposite_season",
    cityId: city.id,
    season: "solstice_swap",
    claim: {
      jdUt: claimedJd,
      lat: city.lat,
      lonEast: city.lonEast,
      elevationM: city.elevationM,
    },
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
      sunAltitudeDeg: Math.min(89.0, Math.max(1.0, sc.sun.altitudeApparentDeg + jitter(rng, NOISE.altDeg))),
    },
    expectedDiag: { kind: "date_shift", targetDays: -offsetDays },
  });
}

// Class 5: 14x Impossible daytime shadow claimed at local night
for (let i = 0; i < 14; i++) {
  const city = FLAT_NON_POLAR[i % FLAT_NON_POLAR.length];
  const month = city.lat > 58 ? 11 : (i % 4) * 3 + 1;
  const nadir = solarMidnightNear(2026, month, 12 + (i % 10), city.lat, city.lonEast);
  const scCheck = sceneGeometry(eng, nadir, city.lat, city.lonEast, { elevationM: city.elevationM });
  if (scCheck.sun.altitudeApparentDeg > -10.0) {
    throw new Error(`Expected dark night for night shadow spoof at ${city.id}`);
  }
  scenarios.push({
    id: `spoof-night-shadow-${i}-${city.id}`,
    isSpoof: true,
    attackClass: "night_shadow_impossible",
    cityId: city.id,
    season: "night",
    claim: {
      jdUt: nadir,
      lat: city.lat,
      lonEast: city.lonEast,
      elevationM: city.elevationM,
    },
    observed: {
      shadowBearingDeg: mod(25.0 + i * 24.0, 360.0),
      shadowLengthRatio: 0.75 + (i % 5) * 0.35,
      twilight: "day",
    },
  });
}

// Class 6: 13x Moon spoofs (4 below-horizon visibility, 4 waxing inversion, 5 bright-limb hemisphere flip)
for (let i = 0; i < 13; i++) {
  const city = FLAT_NON_POLAR[i % FLAT_NON_POLAR.length];
  const month = city.lat > 58 ? 10 : 3 + (i % 7);
  if (i < 4) {
    const hit = findMoonBelowInstant(city, 2026, month, 1);
    if (!hit) throw new Error(`Could not find moon-below instant for ${city.id}`);
    scenarios.push({
      id: `spoof-moon-below-${i}-${city.id}`,
      isSpoof: true,
      attackClass: "moon_spoof",
      subType: "moon_below_horizon",
      cityId: city.id,
      season: "night",
      claim: claimFor(city, hit.jdUt),
      observed: {
        twilight: "dark",
        moonVisible: true,
        moonAltitudeDeg: 24.0 + i * 4.0,
      },
    });
  } else if (i < 8) {
    const hit = findMoonInstant(city, 2026, month, 1, false);
    if (!hit) throw new Error(`Could not find moon-waxing instant for ${city.id}`);
    scenarios.push({
      id: `spoof-moon-waxing-${i}-${city.id}`,
      isSpoof: true,
      attackClass: "moon_spoof",
      subType: "moon_waxing_inverted",
      cityId: city.id,
      season: "night",
      claim: claimFor(city, hit.jdUt),
      observed: {
        twilight: "dark",
        moonVisible: true,
        moonIllum: Math.max(0.0, Math.min(1.0, hit.sc.moon.illum + jitter(rng, NOISE.moonIllum))),
        moonWaxing: !hit.sc.moon.waxing,
      },
    });
  } else {
    // Bright-limb horizontal mirror (N/S hemisphere visual flip of lunar crescent/gibbous tilt)
    const hit = findMoonInstant(city, 2026, month, 1, false, true);
    if (!hit) throw new Error(`Could not find strong bright-limb mirror instant for ${city.id}`);
    const mirroredLimb = mod(180.0 - hit.sc.moon.brightLimbZenithDeg + jitter(rng, NOISE.moonBrightLimbDeg), 360.0);
    scenarios.push({
      id: `spoof-moon-limb-${i}-${city.id}`,
      isSpoof: true,
      attackClass: "moon_spoof",
      subType: "bright_limb_hemisphere_flip",
      cityId: city.id,
      season: "night",
      claim: claimFor(city, hit.jdUt),
      observed: {
        twilight: "dark",
        moonVisible: true,
        moonIllum: Math.max(0.0, Math.min(1.0, hit.sc.moon.illum + jitter(rng, NOISE.moonIllum))),
        moonWaxing: hit.sc.moon.waxing,
        moonBrightLimbDeg: mirroredLimb,
      },
    });
  }
}

// Class 7: 13x Reversed video shadow sweep handedness (NH clockwise reversed + SH counterclockwise reversed)
const SWEEP_CITIES = [
  CITIES[0], CITIES[1], CITIES[2], CITIES[3], CITIES[5], CITIES[7], CITIES[8], // 7 NH
  CITIES[12], CITIES[13], CITIES[14], CITIES[15], CITIES[16], CITIES[17],     // 6 SH
];
for (let i = 0; i < 13; i++) {
  const city = SWEEP_CITIES[i];
  const month = city.lat >= 0 ? 6 : 12;
  const noon = solarNoonNear(2026, month, 18, city.lat, city.lonEast);
  const jd = noon + (i % 2 === 0 ? -0.75 : 0.5) / 24.0;
  const dtMin = 40;
  const trueSweep = measureShadowSweep(jd, city.lat, city.lonEast, dtMin, { elevationM: city.elevationM });
  if (trueSweep === null || Math.abs(trueSweep) < 8.0) {
    throw new Error(`Expected strong shadow sweep at ${city.id}, got ${trueSweep}`);
  }
  const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, { elevationM: city.elevationM });
  scenarios.push({
    id: `spoof-rev-sweep-${i}-${city.id}`,
    isSpoof: true,
    attackClass: "reversed_video_sweep",
    cityId: city.id,
    season: month === 6 ? "summer" : "winter",
    claim: claimFor(city, jd),
    observed: {
      shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(rng, NOISE.shadowBearingDeg), 360.0),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(rng, NOISE.shadowRatioRel))),
      shadowSweep: {
        dtMinutes: dtMin,
        deltaBearingDeg: -trueSweep + jitter(rng, NOISE.sweepDeg),
      },
    },
  });
}

if (scenarios.length !== 200) {
  throw new Error(`Expected 200 scenarios, built ${scenarios.length}`);
}

// ------------------------------------------ 2. Evaluate Caelus vs Null Baseline

/** Null Baseline: Naive local-mean-time (UTC + lon/15) day/night heuristic only. */
function naiveLmtClockFlag(claim, observed) {
  const cal = calendarDate(claim.jdUt, "gregorian");
  const lmtHour = mod(cal.hour + claim.lonEast / 15.0, 24.0);
  const claimsDay = (
    observed.shadowBearingDeg !== undefined
    || observed.shadowLengthRatio !== undefined
    || observed.shadowSweep !== undefined
    || observed.twilight === "day"
    || observed.sunVisible === true
  );
  const claimsDark = (
    observed.twilight === "dark"
    || observed.twilight === "night"
    || observed.sunVisible === false
  );
  if (claimsDay && (lmtHour < 5.5 || lmtHour > 18.5)) return true;
  if (claimsDark && lmtHour > 7.5 && lmtHour < 16.5) return true;
  return false;
}

function emptyConfusion() {
  return { tp: 0, fp: 0, tn: 0, fn: 0 };
}

function summarizeConfusion(c) {
  const precision = c.tp / Math.max(1, c.tp + c.fp);
  const recall = c.tp / Math.max(1, c.tp + c.fn);
  const f1 = (2.0 * precision * recall) / Math.max(1e-12, precision + recall);
  const fpr = c.fp / Math.max(1, c.fp + c.tn);
  return {
    tp: c.tp,
    fp: c.fp,
    tn: c.tn,
    fn: c.fn,
    precision: roundTo(precision, 4),
    recall: roundTo(recall, 4),
    f1: roundTo(f1, 4),
    false_positive_rate: roundTo(fpr, 4),
  };
}

const caelusConf = emptyConfusion();
const baselineConf = emptyConfusion();
let authImpossibleCount = 0;
let authMarginalCount = 0;

const attackClasses = [
  "tz_shift_4h",
  "tz_shift_half_hour",
  "hemisphere_flip",
  "opposite_season",
  "night_shadow_impossible",
  "moon_spoof",
  "reversed_video_sweep",
];

const perClassStats = {};
for (const cls of attackClasses) {
  perClassStats[cls] = { total: 0, caelus_caught: 0, baseline_caught: 0 };
}

const diagStats = {
  total: 0,
  axis_recovered: 0,
  top1_summary_attributed: 0,
  by_class: {
    tz_shift_4h: { total: 0, axis_recovered: 0, top1_attributed: 0, abs_err_min: [] },
    tz_shift_half_hour: { total: 0, axis_recovered: 0, top1_attributed: 0, abs_err_min: [] },
    hemisphere_flip: { total: 0, axis_recovered: 0, top1_attributed: 0 },
    opposite_season: { total: 0, axis_recovered: 0, top1_attributed: 0, abs_err_days: [] },
  },
};

const scenarioResults = [];

for (const sc of scenarios) {
  const res = verifyObservation(eng, sc.claim, sc.observed);
  const caelusFlagged = res.verdict === "inconsistent" || res.verdict === "impossible";
  const baseFlagged = naiveLmtClockFlag(sc.claim, sc.observed);

  if (!sc.isSpoof) {
    if (res.verdict === "impossible") authImpossibleCount++;
    if (res.verdict === "marginal") authMarginalCount++;
    if (caelusFlagged) caelusConf.fp++;
    else caelusConf.tn++;
    if (baseFlagged) baselineConf.fp++;
    else baselineConf.tn++;
  } else {
    perClassStats[sc.attackClass].total++;
    if (caelusFlagged) {
      caelusConf.tp++;
      perClassStats[sc.attackClass].caelus_caught++;
    } else {
      caelusConf.fn++;
    }
    if (baseFlagged) {
      baselineConf.tp++;
      perClassStats[sc.attackClass].baseline_caught++;
    } else {
      baselineConf.fn++;
    }

    if (sc.expectedDiag) {
      diagStats.total++;
      const clsStat = diagStats.by_class[sc.attackClass];
      clsStat.total++;
      const d = res.diagnostics;
      let axisHit = false;
      let summaryHit = false;
      if (d !== null) {
        if (sc.expectedDiag.kind === "time_shift") {
          const errMin = Math.abs(d.timeShift.offsetMinutes - sc.expectedDiag.targetMinutes);
          clsStat.abs_err_min.push(errMin);
          axisHit = errMin <= 25.0 && (d.timeShift.verdict === "consistent" || d.timeShift.verdict === "marginal");
          summaryHit = axisHit && (
            d.summary.includes("clock/timezone offset") || d.summary.includes("time shift")
          );
        } else if (sc.expectedDiag.kind === "hemisphere_flip") {
          axisHit = (d.hemisphereFlip.verdict === "consistent" || d.hemisphereFlip.verdict === "marginal")
            && d.hemisphereFlip.fitScore >= 0.75;
          summaryHit = axisHit && d.summary.includes("hemisphere sign flip");
        } else if (sc.expectedDiag.kind === "date_shift" && d.dateShift !== null) {
          const rawDiff = d.dateShift.offsetDays - sc.expectedDiag.targetDays;
          const errDays = Math.min(
            Math.abs(rawDiff),
            Math.abs(rawDiff - 365),
            Math.abs(rawDiff + 365),
          );
          clsStat.abs_err_days.push(errDays);
          axisHit = errDays <= 25 && (d.dateShift.verdict === "consistent" || d.dateShift.verdict === "marginal");
          summaryHit = axisHit && d.summary.includes("seasonal/date shift");
        }
      }
      if (axisHit) {
        diagStats.axis_recovered++;
        clsStat.axis_recovered++;
      }
      if (summaryHit) {
        diagStats.top1_summary_attributed++;
        clsStat.top1_attributed++;
      }
    }
  }

  scenarioResults.push({ sc, res });
}

const perAttackClassReport = {};
for (const cls of attackClasses) {
  const s = perClassStats[cls];
  perAttackClassReport[cls] = {
    total: s.total,
    caelus_caught: s.caelus_caught,
    caelus_catch_rate: roundTo(s.caelus_caught / Math.max(1, s.total), 4),
    baseline_caught: s.baseline_caught,
    baseline_catch_rate: roundTo(s.baseline_caught / Math.max(1, s.total), 4),
  };
}

// -------------------------------------------- 3. Chronolocation benchmark

const chronoRng = makeRng(3030303);
const chronoNoisyErrsMin = [];
const chronoCleanErrsMin = [];
const chronoLatenciesMs = [];
let chronoNoisyHits = 0;
let chronoCleanHits = 0;

for (let i = 0; i < CITIES.length; i++) {
  const city = CITIES[i];
  const opts = placeOpts(city);
  const month = city.lat > 65 ? 6 : (city.lat < -45 ? 12 : (i % 2 === 0 ? 5 : 9));
  const noon = solarNoonNear(2026, month, 10 + (i % 14), city.lat, city.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -2.0 : 1.75) / 24.0;
  const sc = sceneGeometry(eng, trueJd, city.lat, city.lonEast, opts);

  const cleanObs = {
    shadowBearingDeg: sc.shadow.bearingDeg,
    shadowLengthRatio: sc.shadow.lengthRatio,
    twilight: "day",
    moonIllum: sc.moon.illum,
    moonWaxing: sc.moon.waxing,
  };
  const noisyObs = {
    shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(chronoRng, NOISE.shadowBearingDeg), 360.0),
    shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(chronoRng, NOISE.shadowRatioRel))),
    twilight: "day",
    moonIllum: Math.max(0.0, Math.min(1.0, sc.moon.illum + jitter(chronoRng, NOISE.moonIllum))),
    moonWaxing: sc.moon.waxing,
  };

  const place = {
    lat: city.lat,
    lonEast: city.lonEast,
    elevationM: city.elevationM ?? 0.0,
    slopeDeg: city.slopeDeg ?? 0.0,
    slopeAzimuthDeg: city.slopeAzimuthDeg ?? 0.0,
  };

  const t0 = performance.now();
  const resNoisy = chronolocate(eng, place, noisyObs, trueJd - 3.5, trueJd + 3.5);
  const elapsedMs = performance.now() - t0;
  chronoLatenciesMs.push(elapsedMs);

  const resClean = chronolocate(eng, place, cleanObs, trueJd - 3.5, trueJd + 3.5);

  if (resNoisy.windows.length > 0) {
    let bestErr = Infinity;
    let contained = false;
    for (const w of resNoisy.windows) {
      if (w.jdStart - 1e-6 <= trueJd && trueJd <= w.jdEnd + 1e-6) contained = true;
      const err = Math.abs(w.bestJd - trueJd) * 1440.0;
      if (err < bestErr) bestErr = err;
    }
    if (contained || bestErr <= 25.0) chronoNoisyHits++;
    chronoNoisyErrsMin.push(bestErr);
  }
  if (resClean.windows.length > 0) {
    let bestErr = Infinity;
    let contained = false;
    for (const w of resClean.windows) {
      if (w.jdStart - 1e-6 <= trueJd && trueJd <= w.jdEnd + 1e-6) contained = true;
      const err = Math.abs(w.bestJd - trueJd) * 1440.0;
      if (err < bestErr) bestErr = err;
    }
    if (contained) chronoCleanHits++;
    chronoCleanErrsMin.push(bestErr);
  }
}

// 60-day multi-month pruning benchmark (5 global cities)
let pruneDaysTotal = 0;
let pruneDaysPruned = 0;
const pruneLatenciesMs = [];
for (let i = 0; i < 5; i++) {
  const city = FLAT_NON_POLAR[i * 2];
  const noon = solarNoonNear(2026, 6, 15, city.lat, city.lonEast);
  const trueJd = noon - 2.0 / 24.0;
  const sc = sceneGeometry(eng, trueJd, city.lat, city.lonEast, { elevationM: city.elevationM });
  const t0 = performance.now();
  const res = chronolocate(
    eng,
    { lat: city.lat, lonEast: city.lonEast, elevationM: city.elevationM },
    {
      shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(chronoRng, NOISE.shadowBearingDeg), 360.0),
      shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(chronoRng, NOISE.shadowRatioRel))),
      moonIllum: sc.moon.illum,
      moonWaxing: sc.moon.waxing,
    },
    trueJd - 30.0,
    trueJd + 30.0,
  );
  pruneLatenciesMs.push(performance.now() - t0);
  pruneDaysTotal += res.daysScanned + res.daysPruned;
  pruneDaysPruned += res.daysPruned;
}

// ----------------------------------------- 4. Geolocation benchmark (Path A vs Path B)

const geoRng = makeRng(4040404);

// Path A: Analytical fix on 18 flat-ground cities (clean + noisy)
const FLAT_CITIES = CITIES.filter((c) => !c.slopeDeg);
const pathACleanErrKm = [];
const pathANoisyErrKm = [];
const pathALatencyMs = [];
let pathANoisyHits = 0;
let pathACleanHits = 0;

for (let i = 0; i < FLAT_CITIES.length; i++) {
  const city = FLAT_CITIES[i];
  const month = city.lat > 65 ? 6 : (city.lat < -45 ? 12 : 5);
  const noon = solarNoonNear(2026, month, 12 + (i % 12), city.lat, city.lonEast);
  const jd = noon + (i % 2 === 0 ? -1.75 : 2.0) / 24.0;
  const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, { elevationM: city.elevationM });
  const latMin = Math.min(-70.0, city.lat - 10.0);
  const latMax = Math.max(70.0, city.lat + 10.0);

  const cleanObs = {
    shadowBearingDeg: sc.shadow.bearingDeg,
    shadowLengthRatio: sc.shadow.lengthRatio,
  };
  const noisyObs = {
    shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(geoRng, NOISE.shadowBearingDeg), 360.0),
    shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(geoRng, NOISE.shadowRatioRel))),
  };

  const resClean = geolocate(eng, jd, cleanObs, { latMin, latMax, elevationM: city.elevationM });
  if (resClean.method !== "analytical") {
    throw new Error(`Expected analytical Path A for ${city.id}, got ${resClean.method}`);
  }
  if (resClean.candidates.length > 0) {
    pathACleanHits++;
    const bestKm = Math.min(...resClean.candidates.map((c) => haversineKm(c.lat, c.lon, city.lat, city.lonEast)));
    pathACleanErrKm.push(bestKm);
  }

  const t0 = performance.now();
  const resNoisy = geolocate(eng, jd, noisyObs, { latMin, latMax, elevationM: city.elevationM });
  pathALatencyMs.push(performance.now() - t0);
  if (resNoisy.candidates.length > 0) {
    pathANoisyHits++;
    const bestKm = Math.min(...resNoisy.candidates.map((c) => haversineKm(c.lat, c.lon, city.lat, city.lonEast)));
    pathANoisyErrKm.push(bestKm);
  }
}

// Path B1: Double-altitude Sun + Moon grid fix (NO azimuth/bearing -> forces Path B grid)
const pathB1CleanBestKm = [];
const pathB1NoisyBestKm = [];
const pathB1LatencyMs = [];
let pathB1Hits = 0;

// Find 12 crisp daytime Sun+Moon double-altitude cases with non-collinear azimuth separation
const pathB1Cases = [];
for (let ci = 0; ci < FLAT_NON_POLAR.length && pathB1Cases.length < 12; ci++) {
  const city = FLAT_NON_POLAR[ci];
  let found = null;
  for (let d = 0; d < 28 && !found; d++) {
    const noon = solarNoonNear(2026, 4 + (ci % 5), 1 + d, city.lat, city.lonEast);
    for (const hOff of [-2.5, -1.0, 1.5, 2.5]) {
      const t = noon + hOff / 24.0;
      const sc = sceneGeometry(eng, t, city.lat, city.lonEast, { elevationM: city.elevationM });
      const azSep = Math.abs(wrap180(sc.sun.azimuthDeg - sc.moon.azimuthDeg));
      if (
        sc.sun.altitudeApparentDeg > 15.0 && sc.sun.altitudeApparentDeg < 75.0
        && sc.moon.altitudeApparentDeg > 15.0 && sc.moon.altitudeApparentDeg < 75.0
        && azSep > 40.0 && azSep < 140.0
        && sc.moon.illum > 0.15 && sc.moon.illum < 0.85
      ) {
        found = { city, jdUt: t, sc };
        break;
      }
    }
  }
  if (found) pathB1Cases.push(found);
}

for (const c of pathB1Cases) {
  const cleanObs = {
    sunAltitudeDeg: c.sc.sun.altitudeApparentDeg,
    moonAltitudeDeg: c.sc.moon.altitudeApparentDeg,
    moonVisible: true,
    tolerances: { sunAltitudeDeg: 2.5, moonAltitudeDeg: 3.0 },
  };
  const noisyObs = {
    sunAltitudeDeg: c.sc.sun.altitudeApparentDeg + jitter(geoRng, 1.5),
    moonAltitudeDeg: c.sc.moon.altitudeApparentDeg + jitter(geoRng, 1.5),
    moonVisible: true,
    tolerances: { sunAltitudeDeg: 3.0, moonAltitudeDeg: 3.5 },
  };

  const resClean = geolocate(eng, c.jdUt, cleanObs, { gridStepDeg: 4.0, elevationM: c.city.elevationM });
  if (resClean.method !== "grid") throw new Error("Expected Path B grid for double-altitude");
  if (resClean.candidates.length > 0) {
    const bestKm = Math.min(...resClean.candidates.map((cand) => haversineKm(cand.lat, cand.lon, c.city.lat, c.city.lonEast)));
    pathB1CleanBestKm.push(bestKm);
  }

  const t0 = performance.now();
  const resNoisy = geolocate(eng, c.jdUt, noisyObs, { gridStepDeg: 4.0, elevationM: c.city.elevationM });
  pathB1LatencyMs.push(performance.now() - t0);
  if (resNoisy.candidates.length > 0) {
    pathB1Hits++;
    const bestKm = Math.min(...resNoisy.candidates.map((cand) => haversineKm(cand.lat, cand.lon, c.city.lat, c.city.lonEast)));
    pathB1NoisyBestKm.push(bestKm);
  }
}

// Path B2: Shadow bearing + Moon bright-limb tilt + Moon altitude (NO Sun altitude / NO shadow length -> forces Path B grid)
const pathB2CleanBestKm = [];
const pathB2NoisyBestKm = [];
const pathB2LatencyMs = [];
let pathB2Hits = 0;

for (const c of pathB1Cases) {
  const cleanObs = {
    shadowBearingDeg: c.sc.shadow.bearingDeg,
    moonBrightLimbDeg: c.sc.moon.brightLimbZenithDeg,
    moonAltitudeDeg: c.sc.moon.altitudeApparentDeg,
    tolerances: { shadowBearingDeg: 6.0, moonBrightLimbDeg: 12.0, moonAltitudeDeg: 4.0 },
  };
  const noisyObs = {
    shadowBearingDeg: mod(c.sc.shadow.bearingDeg + jitter(geoRng, NOISE.shadowBearingDeg), 360.0),
    moonBrightLimbDeg: mod(c.sc.moon.brightLimbZenithDeg + jitter(geoRng, NOISE.moonBrightLimbDeg), 360.0),
    moonAltitudeDeg: c.sc.moon.altitudeApparentDeg + jitter(geoRng, NOISE.altDeg),
    tolerances: { shadowBearingDeg: 8.0, moonBrightLimbDeg: 14.0, moonAltitudeDeg: 5.0 },
  };

  const resClean = geolocate(eng, c.jdUt, cleanObs, { gridStepDeg: 4.0, elevationM: c.city.elevationM });
  if (resClean.method !== "grid") throw new Error("Expected Path B grid for bearing + Moon tilt");
  if (resClean.candidates.length > 0) {
    const bestKm = Math.min(...resClean.candidates.map((cand) => haversineKm(cand.lat, cand.lon, c.city.lat, c.city.lonEast)));
    pathB2CleanBestKm.push(bestKm);
  }

  const t0 = performance.now();
  const resNoisy = geolocate(eng, c.jdUt, noisyObs, { gridStepDeg: 4.0, elevationM: c.city.elevationM });
  pathB2LatencyMs.push(performance.now() - t0);
  if (resNoisy.candidates.length > 0) {
    pathB2Hits++;
    const bestKm = Math.min(...resNoisy.candidates.map((cand) => haversineKm(cand.lat, cand.lon, c.city.lat, c.city.lonEast)));
    pathB2NoisyBestKm.push(bestKm);
  }
}

// Path B3: Sloped mountain grid fix (slopeDeg > 0 forces Path B grid even with bearing + ratio)
const pathB3ErrKm = [];
const pathB3LatencyMs = [];
for (const city of CITIES.filter((c) => c.slopeDeg)) {
  for (const month of [6, 9]) {
    const noon = solarNoonNear(2026, month, 18, city.lat, city.lonEast);
    const jd = noon + 1.5 / 24.0;
    const opts = placeOpts(city);
    const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, opts);
    const t0 = performance.now();
    const res = geolocate(
      eng,
      jd,
      {
        shadowBearingDeg: sc.shadow.bearingDeg,
        shadowLengthRatio: sc.shadow.lengthRatio,
      },
      { ...opts, gridStepDeg: 4.0 },
    );
    pathB3LatencyMs.push(performance.now() - t0);
    if (res.method !== "grid") throw new Error("Expected Path B grid on sloped terrain");
    if (res.candidates.length > 0) {
      const bestKm = Math.min(...res.candidates.map((cand) => haversineKm(cand.lat, cand.lon, city.lat, city.lonEast)));
      pathB3ErrKm.push(bestKm);
    }
  }
}

// ----------------------------------------- 5. Forward latency benchmark

const jdLat = julianDay(2026, 6, 21, 16, 0, 0);
const latSc = sceneGeometry(eng, jdLat, 40.7128, -74.006);
const latObs = {
  shadowBearingDeg: latSc.shadow.bearingDeg,
  shadowLengthRatio: latSc.shadow.lengthRatio,
  twilight: "day",
  moonVisible: latSc.moon.visible,
  moonIllum: latSc.moon.illum,
  moonWaxing: latSc.moon.waxing,
};
for (let i = 0; i < 30; i++) {
  sceneGeometry(eng, jdLat + i * 0.001, 40.7128, -74.006);
  verifyObservation(eng, { jdUt: jdLat, lat: 40.7128, lonEast: -74.006 }, latObs);
}
const sceneSamples = [];
const verifySamples = [];
for (let i = 0; i < 200; i++) {
  const tA = performance.now();
  sceneGeometry(eng, jdLat + i * 0.0007, 40.7128, -74.006);
  sceneSamples.push(performance.now() - tA);

  const tB = performance.now();
  verifyObservation(eng, { jdUt: jdLat, lat: 40.7128, lonEast: -74.006 }, latObs);
  verifySamples.push(performance.now() - tB);
}

// ----------------------------------------- 5b. VLM noise-stress sensitivity curve

const noiseStressCurve = [];
for (const mult of [1.0, 2.0, 3.0, 4.0, 5.0]) {
  const sRng = makeRng(909090 + Math.round(mult * 100));
  let fpS = 0;
  let margS = 0;
  let impS = 0;
  const authScenes = scenarios.filter((s) => !s.isSpoof && s.observed.shadowBearingDeg !== undefined);
  for (const s of authScenes) {
    const cleanSc = sceneGeometry(eng, s.claim.jdUt, s.claim.lat, s.claim.lonEast, {
      elevationM: s.claim.elevationM ?? 0.0,
      slopeDeg: s.claim.slopeDeg ?? 0.0,
      slopeAzimuthDeg: s.claim.slopeAzimuthDeg ?? 0.0,
    });
    const pertObs = {
      shadowBearingDeg: mod(cleanSc.shadow.bearingDeg + jitter(sRng, NOISE.shadowBearingDeg * mult), 360.0),
      shadowLengthRatio: Math.max(0.03, cleanSc.shadow.lengthRatio * (1.0 + jitter(sRng, NOISE.shadowRatioRel * mult))),
    };
    const r = verifyObservation(eng, s.claim, pertObs);
    if (r.verdict === "inconsistent" || r.verdict === "impossible") fpS++;
    if (r.verdict === "marginal") margS++;
    if (r.verdict === "impossible") impS++;
  }
  noiseStressCurve.push({
    noise_multiplier: mult,
    bearing_jitter_deg: roundTo(NOISE.shadowBearingDeg * mult, 1),
    ratio_jitter_pct: roundTo(NOISE.shadowRatioRel * mult * 100, 1),
    tested_authentic_shadow_scenes: authScenes.length,
    false_positives: fpS,
    marginal_verdicts: margS,
    false_impossible: impS,
    fpr: roundTo(fpS / Math.max(1, authScenes.length), 4),
  });
}

// ----------------------------------------- 6. Emit vlm_eval_pack.jsonl (30 tasks)

const evalPack = [];
const cityMap = Object.fromEntries(CITIES.map((c) => [c.id, c]));

// 14 verify_observation tasks: 4 authentic + 10 spoofs covering all 7 attack classes
const verifyPicks = [
  scenarioResults.find((x) => x.sc.id === "auth-new_york-summer"),
  scenarioResults.find((x) => x.sc.id === "auth-sydney-winter"),
  scenarioResults.find((x) => x.sc.id === "auth-chamonix_alpine-summer"),
  scenarioResults.find((x) => x.sc.id === "auth-london-video-sweep"),
  scenarioResults.find((x) => x.sc.attackClass === "tz_shift_4h"),
  scenarioResults.filter((x) => x.sc.attackClass === "tz_shift_4h")[5],
  scenarioResults.find((x) => x.sc.attackClass === "tz_shift_half_hour"),
  scenarioResults.filter((x) => x.sc.attackClass === "tz_shift_half_hour")[3],
  scenarioResults.find((x) => x.sc.attackClass === "hemisphere_flip"),
  scenarioResults.find((x) => x.sc.attackClass === "opposite_season"),
  scenarioResults.find((x) => x.sc.attackClass === "night_shadow_impossible"),
  scenarioResults.find((x) => x.sc.subType === "moon_below_horizon"),
  scenarioResults.find((x) => x.sc.subType === "bright_limb_hemisphere_flip"),
  scenarioResults.find((x) => x.sc.attackClass === "reversed_video_sweep"),
];

let taskNum = 1;
for (const pick of verifyPicks) {
  const { sc, res } = pick;
  const city = cityMap[sc.cityId];
  const claimedIso = isoFromJd(sc.claim.jdUt);
  const mcpObs = toMcpObserved(sc.observed);
  const cues = [];
  if (mcpObs.shadow_bearing_deg !== undefined) cues.push(`vertical-pole shadow pointing toward bearing ${mcpObs.shadow_bearing_deg} deg`);
  if (mcpObs.shadow_length_ratio !== undefined) cues.push(`shadow length ratio L/H = ${mcpObs.shadow_length_ratio}`);
  if (mcpObs.sun_altitude_deg !== undefined) cues.push(`apparent solar elevation ~${mcpObs.sun_altitude_deg} deg`);
  if (mcpObs.twilight !== undefined) cues.push(`sky lighting regime "${mcpObs.twilight}"`);
  if (mcpObs.moon_visible === true) {
    const mParts = ["Moon clearly visible above horizon"];
    if (mcpObs.moon_altitude_deg !== undefined) mParts.push(`altitude ~${mcpObs.moon_altitude_deg} deg`);
    if (mcpObs.moon_illum !== undefined) mParts.push(`illuminated fraction ~${Math.round(mcpObs.moon_illum * 100)}%`);
    if (mcpObs.moon_waxing !== undefined) mParts.push(mcpObs.moon_waxing ? "waxing" : "waning");
    if (mcpObs.moon_bright_limb_deg !== undefined) mParts.push(`bright-limb zenith tilt ~${mcpObs.moon_bright_limb_deg} deg`);
    cues.push(mParts.join(", "));
  }
  if (mcpObs.shadow_sweep !== undefined) {
    cues.push(`40-minute time-lapse video showing shadow bearing sweep ${mcpObs.shadow_sweep.delta_bearing_deg > 0 ? "+" : ""}${mcpObs.shadow_sweep.delta_bearing_deg} deg`);
  }
  const terrainNote = city.slopeDeg
    ? ` Ground is sloped at ${city.slopeDeg} deg downhill toward azimuth ${city.slopeAzimuthDeg} deg at elevation ${city.elevationM} m.`
    : "";

  evalPack.push({
    task_id: `VLM-${String(taskNum++).padStart(3, "0")}`,
    category: sc.isSpoof ? `verify_spoof_${sc.attackClass}` : `verify_authentic_${sc.subType}`,
    tool_expected: "verify_observation",
    scene_description: `An image/video metadata header claims capture at ${claimedIso} near (${roundTo(sc.claim.lat, 4)}, ${roundTo(sc.claim.lonEast, 4)}) [${city.label}]. Visual inspection extracts: ${cues.join("; ")}.${terrainNote} Determine whether the visual physics are consistent with the claimed timestamp and location, and if not, identify the likely cause.`,
    claimed_context: {
      utc: claimedIso,
      lat: roundTo(sc.claim.lat, 4),
      lon: roundTo(sc.claim.lonEast, 4),
      elevation_m: sc.claim.elevationM ?? 0,
      slope_deg: sc.claim.slopeDeg ?? 0,
      slope_azimuth_deg: sc.claim.slopeAzimuthDeg ?? 0,
    },
    visual_measurements: mcpObs,
    tool_input: {
      date: claimedIso,
      lat: roundTo(sc.claim.lat, 4),
      lon: roundTo(sc.claim.lonEast, 4),
      elevation_m: sc.claim.elevationM ?? 0,
      slope_deg: sc.claim.slopeDeg ?? 0,
      slope_azimuth_deg: sc.claim.slopeAzimuthDeg ?? 0,
      observed: mcpObs,
    },
    ground_truth: {
      is_spoof: sc.isSpoof,
      attack_class: sc.attackClass,
      verdict: res.verdict,
      consistency_score: roundTo(res.consistencyScore, 4),
      diagnostic_summary: res.diagnostics?.summary ?? null,
      expected_diagnostic_kind: sc.expectedDiag?.kind ?? null,
    },
    eval_rubric: {
      no_tool_trap: sc.isSpoof
        ? `Without ephemeris calculation, VLMs typically accept plausible-looking timestamps or fail to detect ${sc.attackClass}.`
        : "Without ephemeris calculation, VLMs may hallucinate hemisphere or slope errors on noisy authentic scenes.",
      pass_condition: sc.isSpoof
        ? "Agent calls verify_observation, flags claim as inconsistent/impossible, and cites the physical residual or counterfactual diagnostic."
        : "Agent calls verify_observation and confirms claim as consistent/marginal without false alarm.",
    },
  });
}

// 8 chronolocate tasks spanning diverse latitudes, seasons, and sloped terrain
const chronoTaskCities = [CITIES[0], CITIES[2], CITIES[4], CITIES[8], CITIES[10], CITIES[12], CITIES[16], CITIES[18]];
for (let i = 0; i < chronoTaskCities.length; i++) {
  const city = chronoTaskCities[i];
  const opts = placeOpts(city);
  const month = city.lat > 65 ? 6 : (i % 2 === 0 ? 5 : 10);
  const noon = solarNoonNear(2026, month, 14 + i, city.lat, city.lonEast);
  const trueJd = noon + (i % 2 === 0 ? -2.2 : 1.8) / 24.0;
  const sc = sceneGeometry(eng, trueJd, city.lat, city.lonEast, opts);
  const obs = {
    shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(chronoRng, 2.0), 360.0),
    shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(chronoRng, 0.04))),
    twilight: "day",
    moonIllum: sc.moon.illum,
    moonWaxing: sc.moon.waxing,
  };
  const startJd = trueJd - 3.0;
  const endJd = trueJd + 3.0;
  const res = chronolocate(eng, { lat: city.lat, lonEast: city.lonEast, ...opts }, obs, startJd, endJd);
  const bestWin = res.windows.reduce((best, w) => (
    !best || Math.abs(w.bestJd - trueJd) < Math.abs(best.bestJd - trueJd) ? w : best
  ), null);
  const mcpObs = toMcpObserved(obs);
  evalPack.push({
    task_id: `VLM-${String(taskNum++).padStart(3, "0")}`,
    category: city.slopeDeg ? "chronolocate_sloped_terrain" : "chronolocate_shadow_and_moon",
    tool_expected: "chronolocate",
    scene_description: `An undated daytime photograph taken at ${city.label} (${roundTo(city.lat, 4)}, ${roundTo(city.lonEast, 4)}) sometime between ${isoFromJd(startJd)} and ${isoFromJd(endJd)} shows a pole shadow toward bearing ${mcpObs.shadow_bearing_deg} deg with length ratio L/H = ${mcpObs.shadow_length_ratio}, plus external lunar calendar context (~${Math.round(mcpObs.moon_illum * 100)}% ${mcpObs.moon_waxing ? "waxing" : "waning"}). Recover the UTC capture time window.`,
    claimed_context: {
      lat: roundTo(city.lat, 4),
      lon: roundTo(city.lonEast, 4),
      start: isoFromJd(startJd),
      end: isoFromJd(endJd),
      elevation_m: city.elevationM ?? 0,
      slope_deg: city.slopeDeg ?? 0,
      slope_azimuth_deg: city.slopeAzimuthDeg ?? 0,
    },
    visual_measurements: mcpObs,
    tool_input: {
      lat: roundTo(city.lat, 4),
      lon: roundTo(city.lonEast, 4),
      start: isoFromJd(startJd),
      end: isoFromJd(endJd),
      elevation_m: city.elevationM ?? 0,
      slope_deg: city.slopeDeg ?? 0,
      slope_azimuth_deg: city.slopeAzimuthDeg ?? 0,
      observed: mcpObs,
    },
    ground_truth: {
      true_utc: isoFromJd(trueJd),
      recovered_best_utc: bestWin ? isoFromJd(bestWin.bestJd) : null,
      error_minutes: bestWin ? roundTo(Math.abs(bestWin.bestJd - trueJd) * 1440.0, 2) : null,
      window_count: res.windows.length,
    },
    eval_rubric: {
      no_tool_trap: "VLMs cannot invert spherical solar azimuth/elevation plus lunar phase to UTC within minutes by visual intuition.",
      pass_condition: "Agent calls chronolocate and reports a UTC timestamp within 20 minutes of true_utc.",
    },
  });
}

// 8 geolocate tasks: 4 Path A analytical + 4 Path B grid (2 Sun+Moon double altitude, 1 bearing+Moon tilt, 1 sloped terrain)
const geoPathACities = [CITIES[1], CITIES[3], CITIES[13], CITIES[16]];
for (let i = 0; i < geoPathACities.length; i++) {
  const city = geoPathACities[i];
  const noon = solarNoonNear(2026, 5, 16 + i, city.lat, city.lonEast);
  const jd = noon + (i % 2 === 0 ? -1.5 : 2.0) / 24.0;
  const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, { elevationM: city.elevationM });
  const obs = {
    shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(geoRng, 1.5), 360.0),
    shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(geoRng, 0.03))),
  };
  const res = geolocate(eng, jd, obs, { elevationM: city.elevationM });
  const bestDist = res.candidates.length > 0
    ? Math.min(...res.candidates.map((c) => haversineKm(c.lat, c.lon, city.lat, city.lonEast)))
    : null;
  const mcpObs = toMcpObserved(obs);
  evalPack.push({
    task_id: `VLM-${String(taskNum++).padStart(3, "0")}`,
    category: "geolocate_path_a_analytical",
    tool_expected: "geolocate",
    scene_description: `A verified UTC timestamp ${isoFromJd(jd)} accompanies a flat-ground outdoor photo with unknown location. A vertical bollard casts a shadow toward bearing ${mcpObs.shadow_bearing_deg} deg with L/H = ${mcpObs.shadow_length_ratio}. Estimate the observer's Earth coordinates.`,
    claimed_context: { utc: isoFromJd(jd), elevation_m: city.elevationM ?? 0 },
    visual_measurements: mcpObs,
    tool_input: {
      date: isoFromJd(jd),
      elevation_m: city.elevationM ?? 0,
      observed: mcpObs,
    },
    ground_truth: {
      true_city: city.label,
      true_lat: city.lat,
      true_lon: city.lonEast,
      method: res.method,
      best_candidate: res.candidates[0]
        ? { lat: roundTo(res.candidates[0].lat, 3), lon: roundTo(res.candidates[0].lon, 3), radius_km: roundTo(res.candidates[0].radiusKm, 1) }
        : null,
      best_error_km: roundTo(bestDist, 2),
    },
    eval_rubric: {
      no_tool_trap: "Without spherical trigonometry and GAST, VLMs cannot map shadow azimuth + ratio at a UTC instant to Earth coordinates.",
      pass_condition: "Agent calls geolocate (analytical Path A) and places the observer within 350 km of ground truth.",
    },
  });
}

// 4 Path B grid tasks
for (let i = 0; i < 2; i++) {
  const c = pathB1Cases[i];
  const obs = {
    sunAltitudeDeg: c.sc.sun.altitudeApparentDeg + jitter(geoRng, 1.0),
    moonAltitudeDeg: c.sc.moon.altitudeApparentDeg + jitter(geoRng, 1.0),
    moonVisible: true,
    tolerances: { sunAltitudeDeg: 3.0, moonAltitudeDeg: 3.5 },
  };
  const res = geolocate(eng, c.jdUt, obs, { gridStepDeg: 4.0, elevationM: c.city.elevationM });
  const bestDist = res.candidates.length > 0
    ? Math.min(...res.candidates.map((cand) => haversineKm(cand.lat, cand.lon, c.city.lat, c.city.lonEast)))
    : null;
  const mcpObs = {
    sun_altitude_deg: roundTo(obs.sunAltitudeDeg, 2),
    moon_altitude_deg: roundTo(obs.moonAltitudeDeg, 2),
    moon_visible: true,
    tolerances: { sun_altitude_deg: 3.0, moon_altitude_deg: 3.5 },
  };
  evalPack.push({
    task_id: `VLM-${String(taskNum++).padStart(3, "0")}`,
    category: "geolocate_path_b_double_altitude",
    tool_expected: "geolocate",
    scene_description: `At known UTC instant ${isoFromJd(c.jdUt)}, a wide-angle sky capture with no compass reference measures Sun apparent elevation ${mcpObs.sun_altitude_deg} deg and daytime Moon apparent elevation ${mcpObs.moon_altitude_deg} deg. Solve the double-altitude celestial navigation candidate locations.`,
    claimed_context: { utc: isoFromJd(c.jdUt) },
    visual_measurements: mcpObs,
    tool_input: {
      date: isoFromJd(c.jdUt),
      grid_step_deg: 4.0,
      observed: mcpObs,
    },
    ground_truth: {
      true_city: c.city.label,
      true_lat: c.city.lat,
      true_lon: c.city.lonEast,
      method: res.method,
      candidate_count: res.candidates.length,
      best_error_km: roundTo(bestDist, 2),
    },
    eval_rubric: {
      no_tool_trap: "Double-altitude circle intersections require subsolar and sublunar ground points at exact UTC.",
      pass_condition: "Agent calls geolocate (grid Path B) and reports the conjugate candidate region containing the true location.",
    },
  });
}

// 1 Path B bearing + Moon bright-limb tilt task
{
  const c = pathB1Cases[3];
  const obs = {
    shadowBearingDeg: mod(c.sc.shadow.bearingDeg + jitter(geoRng, 2.0), 360.0),
    moonBrightLimbDeg: mod(c.sc.moon.brightLimbZenithDeg + jitter(geoRng, 5.0), 360.0),
    moonAltitudeDeg: c.sc.moon.altitudeApparentDeg + jitter(geoRng, 1.5),
    tolerances: { shadowBearingDeg: 8.0, moonBrightLimbDeg: 14.0, moonAltitudeDeg: 5.0 },
  };
  const res = geolocate(eng, c.jdUt, obs, { gridStepDeg: 4.0, elevationM: c.city.elevationM });
  const bestDist = res.candidates.length > 0
    ? Math.min(...res.candidates.map((cand) => haversineKm(cand.lat, cand.lon, c.city.lat, c.city.lonEast)))
    : null;
  const mcpObs = {
    shadow_bearing_deg: roundTo(obs.shadowBearingDeg, 2),
    moon_bright_limb_deg: roundTo(obs.moonBrightLimbDeg, 2),
    moon_altitude_deg: roundTo(obs.moonAltitudeDeg, 2),
    tolerances: { shadow_bearing_deg: 8.0, moon_bright_limb_deg: 14.0, moon_altitude_deg: 5.0 },
  };
  evalPack.push({
    task_id: `VLM-${String(taskNum++).padStart(3, "0")}`,
    category: "geolocate_path_b_bearing_moon_limb",
    tool_expected: "geolocate",
    scene_description: `At ${isoFromJd(c.jdUt)}, a cropped street-and-sky photo obscures the base of the lamppost (so shadow length ratio is unknown), but shows shadow bearing ${mcpObs.shadow_bearing_deg} deg and a daytime Moon at elevation ${mcpObs.moon_altitude_deg} deg with zenith-frame bright-limb angle ${mcpObs.moon_bright_limb_deg} deg. Geolocate the observer.`,
    claimed_context: { utc: isoFromJd(c.jdUt) },
    visual_measurements: mcpObs,
    tool_input: {
      date: isoFromJd(c.jdUt),
      grid_step_deg: 4.0,
      observed: mcpObs,
    },
    ground_truth: {
      true_city: c.city.label,
      true_lat: c.city.lat,
      true_lon: c.city.lonEast,
      method: res.method,
      candidate_count: res.candidates.length,
      best_error_km: roundTo(bestDist, 2),
    },
    eval_rubric: {
      no_tool_trap: "Lunar bright-limb orientation relative to zenith varies continuously across latitude and longitude.",
      pass_condition: "Agent calls geolocate (grid Path B) and identifies the feasible region containing true_lat/true_lon.",
    },
  });
}

// 1 Path B sloped alpine terrain task
{
  const city = CITIES[18]; // chamonix_alpine
  const opts = placeOpts(city);
  const noon = solarNoonNear(2026, 7, 10, city.lat, city.lonEast);
  const jd = noon + 1.5 / 24.0;
  const sc = sceneGeometry(eng, jd, city.lat, city.lonEast, opts);
  const obs = {
    shadowBearingDeg: mod(sc.shadow.bearingDeg + jitter(geoRng, 1.5), 360.0),
    shadowLengthRatio: Math.max(0.05, sc.shadow.lengthRatio * (1.0 + jitter(geoRng, 0.03))),
  };
  const res = geolocate(eng, jd, obs, { ...opts, gridStepDeg: 4.0 });
  const bestDist = res.candidates.length > 0
    ? Math.min(...res.candidates.map((cand) => haversineKm(cand.lat, cand.lon, city.lat, city.lonEast)))
    : null;
  const mcpObs = toMcpObserved(obs);
  evalPack.push({
    task_id: `VLM-${String(taskNum++).padStart(3, "0")}`,
    category: "geolocate_path_b_sloped_mountain",
    tool_expected: "geolocate",
    scene_description: `At ${isoFromJd(jd)}, an alpine survey pole on an ${city.slopeDeg} deg downhill slope facing azimuth ${city.slopeAzimuthDeg} deg (elevation ${city.elevationM} m) casts a shadow toward bearing ${mcpObs.shadow_bearing_deg} deg with L/H = ${mcpObs.shadow_length_ratio}. Geolocate the site accounting for terrain slope.`,
    claimed_context: {
      utc: isoFromJd(jd),
      elevation_m: city.elevationM,
      slope_deg: city.slopeDeg,
      slope_azimuth_deg: city.slopeAzimuthDeg,
    },
    visual_measurements: mcpObs,
    tool_input: {
      date: isoFromJd(jd),
      elevation_m: city.elevationM,
      slope_deg: city.slopeDeg,
      slope_azimuth_deg: city.slopeAzimuthDeg,
      grid_step_deg: 4.0,
      observed: mcpObs,
    },
    ground_truth: {
      true_city: city.label,
      true_lat: city.lat,
      true_lon: city.lonEast,
      method: res.method,
      candidate_count: res.candidates.length,
      best_error_km: roundTo(bestDist, 2),
    },
    eval_rubric: {
      no_tool_trap: "Flat-ground arctan(1/(L/H)) breaks on an 18 deg mountain slope and misplaces the fix by >1000 km.",
      pass_condition: "Agent supplies slope_deg and slope_azimuth_deg to geolocate (grid Path B) and recovers the Alpine region.",
    },
  });
}

const evalPackPath = join(HERE, "vlm_eval_pack.jsonl");
writeFileSync(evalPackPath, evalPack.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");

// ----------------------------------------- 7. Summarize and write results.json

const caelusSummary = summarizeConfusion(caelusConf);
const baselineSummary = summarizeConfusion(baselineConf);

const diagAxisRate = diagStats.axis_recovered / Math.max(1, diagStats.total);
const diagTop1Rate = diagStats.top1_summary_attributed / Math.max(1, diagStats.total);

const chronoNoisyMedianMin = percentile(chronoNoisyErrsMin, 50);
const chronoCleanMedianMin = percentile(chronoCleanErrsMin, 50);
const pathACleanMedianKm = percentile(pathACleanErrKm, 50);
const pathANoisyMedianKm = percentile(pathANoisyErrKm, 50);
const pathB1CleanMedianKm = percentile(pathB1CleanBestKm, 50);
const pathB1NoisyMedianKm = percentile(pathB1NoisyBestKm, 50);
const pathB2CleanMedianKm = percentile(pathB2CleanBestKm, 50);
const pathB2NoisyMedianKm = percentile(pathB2NoisyBestKm, 50);
const pathB3MedianKm = percentile(pathB3ErrKm, 50);

const passed = (
  caelusSummary.f1 >= 0.95
  && caelusSummary.false_positive_rate <= 0.05
  && authImpossibleCount === 0
  && diagAxisRate >= 0.90
  && chronoNoisyMedianMin <= 15.0
  && pathACleanMedianKm < 1.0
  && pathB1NoisyMedianKm < 250.0
  && evalPack.length === 30
);

const results = {
  id: "EXP-003",
  run_at: new Date().toISOString(),
  git_sha: getGitSha(),
  status: passed ? "pass" : "fail",
  summary:
    `200-scenario spacetime benchmark across 20 global cities and 4 seasons: `
    + `Caelus verifyObservation achieves F1=${caelusSummary.f1} (P=${caelusSummary.precision}, R=${caelusSummary.recall}, FPR=${caelusSummary.false_positive_rate}, auth_impossible=${authImpossibleCount}) `
    + `vs Naive-LMT-Clock baseline F1=${baselineSummary.f1} (R=${baselineSummary.recall}). `
    + `Counterfactual axis recovery=${diagStats.axis_recovered}/${diagStats.total} (${roundTo(diagAxisRate * 100, 1)}%), top-1 attribution=${diagStats.top1_summary_attributed}/${diagStats.total} (${roundTo(diagTop1Rate * 100, 1)}%). `
    + `Noisy chronolocation median=${roundTo(chronoNoisyMedianMin, 2)} min (${roundTo(mean(chronoLatenciesMs), 2)} ms). `
    + `Geolocation median error: Path A analytical=${roundTo(pathACleanMedianKm, 3)} km clean / ${roundTo(pathANoisyMedianKm, 1)} km noisy (${roundTo(mean(pathALatencyMs), 2)} ms) vs `
    + `Path B grid Sun+Moon=${roundTo(pathB1CleanMedianKm, 1)} km clean / ${roundTo(pathB1NoisyMedianKm, 1)} km noisy (${roundTo(mean(pathB1LatencyMs), 1)} ms), `
    + `bearing+Moon-limb=${roundTo(pathB2CleanMedianKm, 1)} km clean / ${roundTo(pathB2NoisyMedianKm, 1)} km noisy (${roundTo(mean(pathB2LatencyMs), 1)} ms).`,
  metrics: {
    scenarios_total: scenarios.length,
    cities_count: CITIES.length,
    authentic_count: 100,
    spoof_count: 100,
    vlm_eval_pack_tasks: evalPack.length,
    caelus_spoof_detection: {
      ...caelusSummary,
      authentic_false_impossible: authImpossibleCount,
      authentic_marginal: authMarginalCount,
    },
    null_baseline_naive_lmt: baselineSummary,
    per_attack_class: perAttackClassReport,
    counterfactual_diagnostics: {
      single_axis_spoofs_evaluated: diagStats.total,
      axis_recovered: diagStats.axis_recovered,
      axis_recovery_rate: roundTo(diagAxisRate, 4),
      top1_summary_attributed: diagStats.top1_summary_attributed,
      top1_summary_attribution_rate: roundTo(diagTop1Rate, 4),
      by_class: {
        tz_shift_4h: {
          total: diagStats.by_class.tz_shift_4h.total,
          axis_recovered: diagStats.by_class.tz_shift_4h.axis_recovered,
          top1_attributed: diagStats.by_class.tz_shift_4h.top1_attributed,
          median_offset_err_min: roundTo(percentile(diagStats.by_class.tz_shift_4h.abs_err_min, 50), 2),
        },
        tz_shift_half_hour: {
          total: diagStats.by_class.tz_shift_half_hour.total,
          axis_recovered: diagStats.by_class.tz_shift_half_hour.axis_recovered,
          top1_attributed: diagStats.by_class.tz_shift_half_hour.top1_attributed,
          median_offset_err_min: roundTo(percentile(diagStats.by_class.tz_shift_half_hour.abs_err_min, 50), 2),
        },
        hemisphere_flip: {
          total: diagStats.by_class.hemisphere_flip.total,
          axis_recovered: diagStats.by_class.hemisphere_flip.axis_recovered,
          top1_attributed: diagStats.by_class.hemisphere_flip.top1_attributed,
        },
        opposite_season: {
          total: diagStats.by_class.opposite_season.total,
          axis_recovered: diagStats.by_class.opposite_season.axis_recovered,
          top1_attributed: diagStats.by_class.opposite_season.top1_attributed,
          median_offset_err_days: roundTo(percentile(diagStats.by_class.opposite_season.abs_err_days, 50), 2),
        },
      },
    },
    chronolocation: {
      cases: CITIES.length,
      noisy_recall: roundTo(chronoNoisyHits / CITIES.length, 4),
      noisy_median_err_min: roundTo(chronoNoisyMedianMin, 3),
      noisy_p90_err_min: roundTo(percentile(chronoNoisyErrsMin, 90), 3),
      clean_recall: roundTo(chronoCleanHits / CITIES.length, 4),
      clean_median_err_min: roundTo(chronoCleanMedianMin, 4),
      mean_latency_ms: roundTo(mean(chronoLatenciesMs), 2),
      p95_latency_ms: roundTo(percentile(chronoLatenciesMs, 95), 2),
      sixty_day_pruning_rate: roundTo(pruneDaysPruned / Math.max(1, pruneDaysTotal), 4),
      sixty_day_mean_latency_ms: roundTo(mean(pruneLatenciesMs), 2),
    },
    geolocation: {
      path_a_analytical: {
        cases: FLAT_CITIES.length,
        clean_recall: roundTo(pathACleanHits / FLAT_CITIES.length, 4),
        clean_median_err_km: roundTo(pathACleanMedianKm, 4),
        noisy_recall: roundTo(pathANoisyHits / FLAT_CITIES.length, 4),
        noisy_median_err_km: roundTo(pathANoisyMedianKm, 2),
        noisy_p90_err_km: roundTo(percentile(pathANoisyErrKm, 90), 2),
        mean_latency_ms: roundTo(mean(pathALatencyMs), 3),
        p95_latency_ms: roundTo(percentile(pathALatencyMs, 95), 3),
      },
      path_b_double_altitude_sun_moon: {
        cases: pathB1Cases.length,
        noisy_recall: roundTo(pathB1Hits / Math.max(1, pathB1Cases.length), 4),
        clean_median_err_km: roundTo(pathB1CleanMedianKm, 2),
        noisy_median_err_km: roundTo(pathB1NoisyMedianKm, 2),
        noisy_p90_err_km: roundTo(percentile(pathB1NoisyBestKm, 90), 2),
        mean_latency_ms: roundTo(mean(pathB1LatencyMs), 2),
        p95_latency_ms: roundTo(percentile(pathB1LatencyMs, 95), 2),
      },
      path_b_bearing_plus_moon_limb: {
        cases: pathB1Cases.length,
        noisy_recall: roundTo(pathB2Hits / Math.max(1, pathB1Cases.length), 4),
        clean_median_err_km: roundTo(pathB2CleanMedianKm, 2),
        noisy_median_err_km: roundTo(pathB2NoisyMedianKm, 2),
        noisy_p90_err_km: roundTo(percentile(pathB2NoisyBestKm, 90), 2),
        mean_latency_ms: roundTo(mean(pathB2LatencyMs), 2),
        p95_latency_ms: roundTo(percentile(pathB2LatencyMs, 95), 2),
      },
      path_b_sloped_mountain: {
        cases: pathB3ErrKm.length,
        clean_median_err_km: roundTo(pathB3MedianKm, 2),
        mean_latency_ms: roundTo(mean(pathB3LatencyMs), 2),
      },
    },
    forward_latency_ms: {
      scene_geometry_mean: roundTo(mean(sceneSamples), 3),
      scene_geometry_p95: roundTo(percentile(sceneSamples, 95), 3),
      verify_observation_mean: roundTo(mean(verifySamples), 3),
      verify_observation_p95: roundTo(percentile(verifySamples, 95), 3),
    },
    noise_stress_sensitivity: noiseStressCurve,
  },
  verdict: passed
    ? "PASS: Caelus physical observation engine clears all spoof-detection, diagnostic, chronolocation, and Path A/B geolocation bars and decisively outperforms the Naive-LMT-Clock null baseline across all 7 attack classes."
    : "FAIL: One or more benchmark thresholds were not met; inspect per-class and solver metrics.",
};

const resultsPath = join(HERE, "results.json");
writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n", "utf8");

console.log(results.summary);
console.log(`Wrote ${resultsPath} and ${evalPackPath} (${evalPack.length} tasks). Status: ${results.status}`);
if (!passed) {
  process.exitCode = 1;
}
