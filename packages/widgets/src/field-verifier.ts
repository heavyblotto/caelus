/**
 * caelus-widgets - Instrument I-05 (SHADOWPROOF / Field Verifier & Chronolocator), pure logic half.
 *
 * Zero React imports and zero Node-only dependencies so the same module runs
 * in browsers (on the embedded ephemeris tier) and in Node tests.
 *
 * Wraps `sceneGeometry`, `verifyObservation`, `chronolocate`, and `geolocate`
 * from `caelus`, plus a zero-dependency client-side JPEG EXIF parser, a 12x24
 * solar analemma feasibility grid, and deterministic SVG geometry builders
 * adhering to Tufte VDQI rules (FACT-001/tufte-notes.md).
 */
import {
  calendarDate,
  chronolocate,
  DEFAULT_TOLERANCES,
  dirFromAzAlt,
  gast,
  geolocate,
  julianDay,
  refractTrueToApparent,
  sceneGeometry,
  TWILIGHT_BANDS,
  verifyObservation,
  type ChronolocateResult,
  type Engine,
  type GeolocateResult,
  type ObservationClaim,
  type ObservationPlace,
  type ObservationVerification,
  type ObservedConstraints,
  type SceneGeometry,
  type TwilightObservation,
} from "caelus";

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const EARTH_RADIUS_KM = 6371.0;

/** Maximum Chronolocate search span in days for responsive browser execution. */
export const FIELD_VERIFIER_MAX_SPAN_DAYS = 370;

export type FieldVerifierMode = "verify" | "chronolocate" | "geolocate";

export interface FieldVerifierPlace {
  id: string;
  label: string;
  lat: number;
  lonEast: number;
  elevationM: number;
  slopeDeg: number;
  slopeAzimuthDeg: number;
}

export const FIELD_VERIFIER_PLACES: readonly FieldVerifierPlace[] = [
  { id: "new-york", label: "New York, USA", lat: 40.7128, lonEast: -74.006, elevationM: 10, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "london", label: "London, UK", lat: 51.5074, lonEast: -0.1278, elevationM: 11, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "sydney", label: "Sydney, Australia", lat: -33.8688, lonEast: 151.2093, elevationM: 19, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "cairo", label: "Cairo, Egypt", lat: 30.0444, lonEast: 31.2357, elevationM: 23, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "chamonix", label: "Chamonix Alpine, France", lat: 45.9237, lonEast: 6.8694, elevationM: 2400, slopeDeg: 20, slopeAzimuthDeg: 180 },
  { id: "tokyo", label: "Tokyo, Japan", lat: 35.6762, lonEast: 139.6503, elevationM: 40, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "reykjavik", label: "Reykjavik, Iceland", lat: 64.1466, lonEast: -21.9426, elevationM: 14, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "suva", label: "Suva, Fiji (Antimeridian)", lat: -18.1416, lonEast: 178.4419, elevationM: 10, slopeDeg: 0, slopeAzimuthDeg: 0 },
  { id: "buenos-aires", label: "Buenos Aires, Argentina", lat: -34.6037, lonEast: -58.3816, elevationM: 25, slopeDeg: 0, slopeAzimuthDeg: 0 },
] as const;

export interface FieldVerifierQuery {
  mode: FieldVerifierMode;
  /** Claimed or reference UTC timestamp as ISO-8601 string (YYYY-MM-DDTHH:MM:SSZ). */
  utc: string;
  /** Observer location and optional terrain slope. */
  place: {
    lat: number;
    lonEast: number;
    elevationM: number;
    slopeDeg: number;
    slopeAzimuthDeg: number;
  };
  /** Time uncertainty window (+/- minutes) for Verify mode. */
  timeToleranceMin: number;
  /** Place uncertainty radius (+/- degrees) for Verify mode. */
  placeToleranceDeg: number;
  /** Chronolocate UTC search start ISO string. */
  searchStartUtc: string;
  /** Chronolocate UTC search end ISO string (clamped <= 370 days from start). */
  searchEndUtc: string;
  /** Physical observations to verify or invert. */
  observed: ObservedConstraints;
  /** Geolocate spherical grid step in degrees (default 4). */
  gridStepDeg?: number;
}

export interface FieldVerifierPreset {
  id: string;
  label: string;
  shortLabel: string;
  summary: string;
  note: string;
  defaultMode: FieldVerifierMode;
  query: FieldVerifierQuery;
  calibration: {
    compassNorthDeg: number;
    skyTint: "day" | "twilight" | "night" | "alpine";
    groundSlopeDeg: number;
    caption: string;
  };
}

export const FIELD_VERIFIER_PRESETS: readonly FieldVerifierPreset[] = [
  {
    id: "nyc-summer-authentic",
    label: "NYC summer afternoon (authentic)",
    shortLabel: "NYC authentic",
    summary: "Authentic 2026-07-04 19:30 UTC flat-ground shadow in New York matching predicted azimuth and length ratio.",
    note: "New York City on 4 July 2026 at 19:30 UTC (3:30 PM EDT). A vertical bollard casts a shadow toward 71.8 deg (ENE) with length ratio L/H = 0.73, agreeing cleanly with solar ephemeris geometry.",
    defaultMode: "verify",
    query: {
      mode: "verify",
      utc: "2026-07-04T19:30:00Z",
      place: { lat: 40.7128, lonEast: -74.006, elevationM: 10, slopeDeg: 0, slopeAzimuthDeg: 0 },
      timeToleranceMin: 0,
      placeToleranceDeg: 0,
      searchStartUtc: "2026-07-01T00:00:00Z",
      searchEndUtc: "2026-07-08T00:00:00Z",
      observed: {
        shadowBearingDeg: 71.8,
        shadowLengthRatio: 0.73,
        twilight: "day",
      },
      gridStepDeg: 4,
    },
    calibration: {
      compassNorthDeg: 0,
      skyTint: "day",
      groundSlopeDeg: 0,
      caption: "Level urban plaza, vertical bollard, afternoon Sun in WSW.",
    },
  },
  {
    id: "tz-shift-spoof",
    label: "Timezone shift spoof (-4h claim)",
    shortLabel: "TZ spoof (-4h)",
    summary: "Same NYC afternoon shadow claimed 4 hours earlier (15:30 UTC); counterfactual time-shift recovers +240 min.",
    note: "A common metadata error or forgery stamps local EDT time as UTC (4 hours early). The claimed 15:30 UTC Sun sits in the southeast instead of the southwest, so counterfactual forensics recover a +240 min (+4h) clock shift.",
    defaultMode: "verify",
    query: {
      mode: "verify",
      utc: "2026-07-04T15:30:00Z",
      place: { lat: 40.7128, lonEast: -74.006, elevationM: 10, slopeDeg: 0, slopeAzimuthDeg: 0 },
      timeToleranceMin: 0,
      placeToleranceDeg: 0,
      searchStartUtc: "2026-07-01T00:00:00Z",
      searchEndUtc: "2026-07-08T00:00:00Z",
      observed: {
        shadowBearingDeg: 71.8,
        shadowLengthRatio: 0.73,
        twilight: "day",
      },
      gridStepDeg: 4,
    },
    calibration: {
      compassNorthDeg: 0,
      skyTint: "day",
      groundSlopeDeg: 0,
      caption: "Same physical shadow claimed 4 hours early (local EDT stamped as UTC).",
    },
  },
  {
    id: "hemisphere-moon-spoof",
    label: "Hemisphere Moon tilt spoof (N vs S)",
    shortLabel: "Moon flip",
    summary: "Southern Hemisphere waxing crescent tilt from Sydney claimed at +33.87 N; counterfactual flips latitude sign.",
    note: "A waxing crescent photographed from Sydney (-33.87 deg) has its sunlit limb tilted at 226.8 deg relative to local zenith. Claiming the image at +33.87 N contradicts the predicted 310.5 deg Northern tilt by 83.7 deg, triggering the hemisphere-flip counterfactual.",
    defaultMode: "verify",
    query: {
      mode: "verify",
      utc: "2026-05-21T09:00:00Z",
      place: { lat: 33.8688, lonEast: 151.2093, elevationM: 19, slopeDeg: 0, slopeAzimuthDeg: 0 },
      timeToleranceMin: 0,
      placeToleranceDeg: 0,
      searchStartUtc: "2026-05-18T00:00:00Z",
      searchEndUtc: "2026-05-24T00:00:00Z",
      observed: {
        moonVisible: true,
        moonIllum: 0.28,
        moonWaxing: true,
        moonBrightLimbDeg: 226.8,
      },
      gridStepDeg: 4,
    },
    calibration: {
      compassNorthDeg: 0,
      skyTint: "twilight",
      groundSlopeDeg: 0,
      caption: "Evening waxing crescent (28% lit) with Southern-Hemisphere bright-limb tilt.",
    },
  },
  {
    id: "night-shadow-impossible",
    label: "Night shadow (physically impossible)",
    shortLabel: "Night spoof",
    summary: "Crisp daytime solar shadow claimed at 05:04 UTC (00:04 EST) in New York during astronomical night.",
    note: "The claimed timestamp falls just after local midnight in winter New York with the Sun more than 60 deg below the horizon. A sharp solar shadow with L/H = 0.75 is physically impossible, and no single-axis shift reconciles every constraint.",
    defaultMode: "verify",
    query: {
      mode: "verify",
      utc: "2026-01-13T05:04:35Z",
      place: { lat: 40.7128, lonEast: -74.006, elevationM: 10, slopeDeg: 0, slopeAzimuthDeg: 0 },
      timeToleranceMin: 0,
      placeToleranceDeg: 0,
      searchStartUtc: "2026-01-10T00:00:00Z",
      searchEndUtc: "2026-01-16T00:00:00Z",
      observed: {
        shadowBearingDeg: 25.0,
        shadowLengthRatio: 0.75,
        twilight: "day",
      },
      gridStepDeg: 4,
    },
    calibration: {
      compassNorthDeg: 0,
      skyTint: "night",
      groundSlopeDeg: 0,
      caption: "Daytime bollard shadow claimed during winter astronomical night.",
    },
  },
  {
    id: "sloped-alpine",
    label: "Sloped alpine terrain (20 deg south)",
    shortLabel: "Alpine slope",
    summary: "Chamonix survey pole on a 20 deg south-facing slope at 2400 m elevation; flat-ground formulas overpredict length.",
    note: "At Chamonix (2400 m) on a 20 deg downhill slope facing due south (180 deg), a vertical pole casts a shadow of L/H = 0.640 instead of the flat-ground 0.707. Supplying terrain slope and elevation keeps both bearing and ratio consistent.",
    defaultMode: "verify",
    query: {
      mode: "verify",
      utc: "2026-06-25T13:50:00Z",
      place: { lat: 45.9237, lonEast: 6.8694, elevationM: 2400, slopeDeg: 20, slopeAzimuthDeg: 180 },
      timeToleranceMin: 0,
      placeToleranceDeg: 0,
      searchStartUtc: "2026-06-22T00:00:00Z",
      searchEndUtc: "2026-06-29T00:00:00Z",
      observed: {
        shadowBearingDeg: 61.8,
        shadowLengthRatio: 0.64,
        twilight: "day",
      },
      gridStepDeg: 4,
    },
    calibration: {
      compassNorthDeg: 0,
      skyTint: "alpine",
      groundSlopeDeg: 20,
      caption: "Vertical survey pole on a 20 deg south-facing alpine slope (2400 m).",
    },
  },
] as const;

export interface FieldVerifierResult {
  mode: FieldVerifierMode;
  jdUt: number;
  verify: ObservationVerification | null;
  chronolocate: ChronolocateResult | null;
  geolocate: GeolocateResult | null;
  elapsedMs: number;
}

// ------------------------------------------------------------------ formatting

/** Round SVG coordinate to 0.1 for cross-architecture byte determinism. */
export function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mod360(x: number): number {
  const m = x % 360;
  return m < 0 ? m + 360 : m;
}

function wrap180(x: number): number {
  const r = mod360(x + 180) - 180;
  return r === -180 ? 180 : r;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Parse ISO-8601 UTC string (YYYY-MM-DDTHH:MM[:SS]Z) to UT Julian Day. */
export function isoToJdUt(iso: string): number | null {
  if (typeof iso !== "string") return null;
  const trimmed = iso.trim();
  const m = trimmed.match(
    /^(-?\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z?$/i,
  );
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const min = Number(m[5]);
  const sec = m[6] ? Number(m[6]) : 0;
  if (
    !Number.isInteger(year) ||
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    min < 0 || min > 59 ||
    sec < 0 || sec > 59
  ) {
    return null;
  }
  const jd = julianDay(year, month, day, hour, min, sec, "gregorian");
  return Number.isFinite(jd) ? jd : null;
}

/** Format UT Julian Day as ISO-8601 UTC string (`YYYY-MM-DDTHH:MM:SSZ`). */
export function jdUtToIso(jdUt: number, includeSeconds = true): string {
  const roundBias = includeSeconds ? 0.5 / 86400 : 0.5 / 1440;
  const cal = calendarDate(jdUt + roundBias, "gregorian");
  const totalSec = Math.min(86399, Math.max(0, Math.floor(cal.hour * 3600 + 1e-6)));
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const yr = cal.year < 0
    ? `-${String(Math.abs(cal.year)).padStart(4, "0")}`
    : String(cal.year).padStart(4, "0");
  const base = `${yr}-${String(cal.month).padStart(2, "0")}-${String(cal.day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return includeSeconds ? `${base}:${String(ss).padStart(2, "0")}Z` : `${base}Z`;
}

/** Compact UT label for chart axes and tables: `YYYY-MM-DD HH:MM UT`. */
export function shortUtcLabel(jdUt: number): string {
  return jdUtToIso(jdUt, false).replace("T", " ").replace("Z", " UT");
}

/** Count how many physical observation fields are actively populated. */
export function countObservations(obs: ObservedConstraints): number {
  let n = 0;
  if (obs.shadowBearingDeg !== undefined) n++;
  if (obs.shadowLengthRatio !== undefined) n++;
  if (obs.sunAzimuthDeg !== undefined) n++;
  if (obs.sunAltitudeDeg !== undefined) n++;
  if (obs.twilight !== undefined) n++;
  if (obs.sunVisible !== undefined) n++;
  if (obs.moonVisible !== undefined) n++;
  if (obs.moonAzimuthDeg !== undefined) n++;
  if (obs.moonAltitudeDeg !== undefined) n++;
  if (obs.moonIllum !== undefined) n++;
  if (obs.moonWaxing !== undefined) n++;
  if (obs.moonBrightLimbDeg !== undefined) n++;
  if (obs.bodiesVisible && obs.bodiesVisible.length > 0) n++;
  if (obs.shadowSweep !== undefined) n++;
  return n;
}

/** Strip undefined fields from an ObservedConstraints object for clean engine calls. */
export function cleanObserved(obs: ObservedConstraints): ObservedConstraints {
  const out: ObservedConstraints = {};
  if (obs.shadowBearingDeg !== undefined && Number.isFinite(obs.shadowBearingDeg)) {
    out.shadowBearingDeg = mod360(obs.shadowBearingDeg);
  }
  if (obs.shadowLengthRatio !== undefined && Number.isFinite(obs.shadowLengthRatio) && obs.shadowLengthRatio >= 0) {
    out.shadowLengthRatio = obs.shadowLengthRatio;
  }
  if (obs.sunAzimuthDeg !== undefined && Number.isFinite(obs.sunAzimuthDeg)) {
    out.sunAzimuthDeg = mod360(obs.sunAzimuthDeg);
  }
  if (obs.sunAltitudeDeg !== undefined && Number.isFinite(obs.sunAltitudeDeg)) {
    out.sunAltitudeDeg = obs.sunAltitudeDeg;
  }
  if (obs.twilight !== undefined) out.twilight = obs.twilight;
  if (obs.sunVisible !== undefined) out.sunVisible = obs.sunVisible;
  if (obs.moonVisible !== undefined) out.moonVisible = obs.moonVisible;
  if (obs.moonAzimuthDeg !== undefined && Number.isFinite(obs.moonAzimuthDeg)) {
    out.moonAzimuthDeg = mod360(obs.moonAzimuthDeg);
  }
  if (obs.moonAltitudeDeg !== undefined && Number.isFinite(obs.moonAltitudeDeg)) {
    out.moonAltitudeDeg = obs.moonAltitudeDeg;
  }
  if (obs.moonIllum !== undefined && Number.isFinite(obs.moonIllum)) {
    out.moonIllum = clamp(obs.moonIllum, 0, 1);
  }
  if (obs.moonWaxing !== undefined) out.moonWaxing = obs.moonWaxing;
  if (obs.moonBrightLimbDeg !== undefined && Number.isFinite(obs.moonBrightLimbDeg)) {
    out.moonBrightLimbDeg = mod360(obs.moonBrightLimbDeg);
  }
  if (obs.bodiesVisible && obs.bodiesVisible.length > 0) {
    out.bodiesVisible = [...obs.bodiesVisible];
  }
  if (
    obs.shadowSweep !== undefined &&
    Number.isFinite(obs.shadowSweep.dtMinutes) &&
    obs.shadowSweep.dtMinutes > 0 &&
    Number.isFinite(obs.shadowSweep.deltaBearingDeg)
  ) {
    out.shadowSweep = { ...obs.shadowSweep };
  }
  if (obs.tolerances) {
    out.tolerances = { ...obs.tolerances };
  }
  return out;
}

/** Validate a FieldVerifierQuery before dispatching to the engine. */
export function fieldVerifierQueryOk(q: FieldVerifierQuery): { ok: boolean; issue: string | null } {
  const { lat, lonEast, elevationM, slopeDeg, slopeAzimuthDeg } = q.place;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, issue: "Latitude must be between -90 and +90 degrees." };
  }
  if (!Number.isFinite(lonEast) || lonEast < -180 || lonEast > 180) {
    return { ok: false, issue: "Longitude must be between -180 and +180 degrees." };
  }
  if (!Number.isFinite(elevationM) || elevationM < -500 || elevationM > 12000) {
    return { ok: false, issue: "Elevation must be between -500 m and 12000 m." };
  }
  if (!Number.isFinite(slopeDeg) || slopeDeg < 0 || slopeDeg >= 90) {
    return { ok: false, issue: "Ground slope must be between 0 and 89.9 degrees." };
  }
  if (!Number.isFinite(slopeAzimuthDeg)) {
    return { ok: false, issue: "Slope azimuth must be a finite number." };
  }
  if (q.mode === "verify" || q.mode === "geolocate") {
    const jd = isoToJdUt(q.utc);
    if (jd === null) {
      return { ok: false, issue: "Enter a valid UTC timestamp (YYYY-MM-DDTHH:MM:SSZ)." };
    }
  }
  if (q.mode === "chronolocate") {
    const s = isoToJdUt(q.searchStartUtc);
    const e = isoToJdUt(q.searchEndUtc);
    if (s === null || e === null) {
      return { ok: false, issue: "Enter valid start and end UTC timestamps." };
    }
    if (e <= s) {
      return { ok: false, issue: "Search end must be later than search start." };
    }
    if (e - s > FIELD_VERIFIER_MAX_SPAN_DAYS) {
      return { ok: false, issue: `Search span is limited to ${FIELD_VERIFIER_MAX_SPAN_DAYS} days in the browser.` };
    }
    if (countObservations(cleanObserved(q.observed)) === 0) {
      return { ok: false, issue: "Set at least one observation constraint to chronolocate." };
    }
  }
  if (q.mode === "geolocate") {
    if (countObservations(cleanObserved(q.observed)) === 0) {
      return { ok: false, issue: "Set at least one observation constraint to geolocate." };
    }
  }
  return { ok: true, issue: null };
}

/** Compute forward physical scene geometry for a query timestamp and place. */
export function previewSceneGeometry(engine: Engine, query: FieldVerifierQuery): SceneGeometry {
  const jdUt = isoToJdUt(query.utc) ?? julianDay(2026, 7, 4, 19, 30, 0);
  return sceneGeometry(engine, jdUt, query.place.lat, query.place.lonEast, {
    elevationM: query.place.elevationM,
    slopeDeg: query.place.slopeDeg,
    slopeAzimuthDeg: query.place.slopeAzimuthDeg,
  });
}

/** Run the active instrument mode synchronously against the provided Engine. */
export function runFieldVerifier(engine: Engine, query: FieldVerifierQuery): FieldVerifierResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const obs = cleanObserved(query.observed);
  const jdUt = isoToJdUt(query.utc) ?? julianDay(2026, 7, 4, 19, 30, 0);

  if (query.mode === "verify") {
    const claim: ObservationClaim = {
      jdUt,
      lat: query.place.lat,
      lonEast: query.place.lonEast,
      elevationM: query.place.elevationM,
      slopeDeg: query.place.slopeDeg,
      slopeAzimuthDeg: query.place.slopeAzimuthDeg,
      timeToleranceMin: Math.max(0, query.timeToleranceMin || 0),
      placeToleranceDeg: Math.max(0, query.placeToleranceDeg || 0),
    };
    const verify = verifyObservation(engine, claim, obs);
    const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    return { mode: "verify", jdUt, verify, chronolocate: null, geolocate: null, elapsedMs };
  }

  if (query.mode === "chronolocate") {
    const jdStart = isoToJdUt(query.searchStartUtc) ?? jdUt - 3;
    const rawEnd = isoToJdUt(query.searchEndUtc) ?? jdUt + 4;
    const jdEnd = Math.min(rawEnd, jdStart + FIELD_VERIFIER_MAX_SPAN_DAYS);
    const place: ObservationPlace = {
      lat: query.place.lat,
      lonEast: query.place.lonEast,
      elevationM: query.place.elevationM,
      slopeDeg: query.place.slopeDeg,
      slopeAzimuthDeg: query.place.slopeAzimuthDeg,
    };
    const chrono = chronolocate(engine, place, obs, jdStart, jdEnd, {
      stepMinutes: 10,
      maxWindows: 48,
    });
    const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    return { mode: "chronolocate", jdUt: jdStart, verify: null, chronolocate: chrono, geolocate: null, elapsedMs };
  }

  const geo = geolocate(engine, jdUt, obs, {
    gridStepDeg: query.gridStepDeg ?? 4,
    maxCandidates: 12,
    elevationM: query.place.elevationM,
    slopeDeg: query.place.slopeDeg,
    slopeAzimuthDeg: query.place.slopeAzimuthDeg,
  });
  const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { mode: "geolocate", jdUt, verify: null, chronolocate: null, geolocate: geo, elapsedMs };
}

// -------------------------------------------------- client-side JPEG EXIF parser

export interface ExifExtraction {
  /** Extracted UTC timestamp as ISO-8601 string (or local EXIF timestamp if offset absent). */
  utc: string | null;
  /** True when the timestamp carried an explicit UTC offset or GPS UTC stamp. */
  utcVerified: boolean;
  /** Latitude in decimal degrees, north positive. */
  lat: number | null;
  /** Longitude in decimal degrees, east positive. */
  lonEast: number | null;
  make: string | null;
  model: string | null;
  orientation: number | null;
}

function readAscii(view: DataView, offset: number, count: number): string | null {
  if (offset < 0 || count <= 0 || offset + count > view.byteLength) return null;
  let out = "";
  for (let i = 0; i < count; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    if (c >= 32 && c <= 126) out += String.fromCharCode(c);
  }
  const trimmed = out.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRational(view: DataView, offset: number, little: boolean): number | null {
  if (offset < 0 || offset + 8 > view.byteLength) return null;
  const num = view.getUint32(offset, little);
  const den = view.getUint32(offset + 4, little);
  if (den === 0) return null;
  return num / den;
}

function readDms(view: DataView, offset: number, little: boolean): number | null {
  const d = readRational(view, offset, little);
  const m = readRational(view, offset + 8, little);
  const s = readRational(view, offset + 16, little);
  if (d === null || m === null || s === null) return null;
  const val = d + m / 60 + s / 3600;
  return Number.isFinite(val) ? val : null;
}

function parseExifDateString(raw: string, offsetStr: string | null): { utc: string; utcVerified: boolean } | null {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const yr = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);
  const ss = Number(m[6]);
  let jd = julianDay(yr, mo, da, hh, mi, ss, "gregorian");
  let verified = false;
  if (offsetStr) {
    const om = offsetStr.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (om) {
      const sign = om[1] === "+" ? 1 : -1;
      const offMin = sign * (Number(om[2]) * 60 + Number(om[3]));
      jd -= offMin / 1440;
      verified = true;
    }
  }
  return { utc: jdUtToIso(jd, true), utcVerified: verified };
}

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
  rawValuePos: number;
}

function readIfdEntries(view: DataView, tiffStart: number, ifdOffset: number, little: boolean): IfdEntry[] {
  const pos = tiffStart + ifdOffset;
  if (pos < tiffStart || pos + 2 > view.byteLength) return [];
  const count = view.getUint16(pos, little);
  const entries: IfdEntry[] = [];
  const typeBytes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  for (let i = 0; i < count; i++) {
    const ep = pos + 2 + i * 12;
    if (ep + 12 > view.byteLength) break;
    const tag = view.getUint16(ep, little);
    const type = view.getUint16(ep + 2, little);
    const cnt = view.getUint32(ep + 4, little);
    const unitSize = typeBytes[type] ?? 1;
    const totalBytes = cnt * unitSize;
    const valueOffset = totalBytes <= 4 ? ep + 8 : tiffStart + view.getUint32(ep + 8, little);
    entries.push({ tag, type, count: cnt, valueOffset, rawValuePos: ep + 8 });
  }
  return entries;
}

/**
 * Minimal, zero-dependency, 100% client-side JPEG APP1 EXIF parser.
 * Extracts GPS latitude/longitude and DateTimeOriginal / GPSTimeStamp without
 * any network call or third-party library. Returns `null` gracefully for
 * non-JPEG, non-EXIF, or malformed buffers.
 */
export function parseJpegExif(input: ArrayBufferLike | Uint8Array): ExifExtraction | null {
  try {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.byteLength < 12) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // JPEG SOI marker 0xFFD8
    if (view.getUint16(0, false) !== 0xffd8) return null;

    let offset = 2;
    let tiffStart = -1;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      // Skip fill bytes 0xFF
      while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset++;
      if (offset >= view.byteLength) break;
      const marker = view.getUint8(offset);
      offset++;
      // SOS (0xDA) or EOI (0xD9): metadata headers are finished
      if (marker === 0xda || marker === 0xd9) break;
      // Standalone markers without length
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > view.byteLength) break;
      const segLen = view.getUint16(offset, false);
      if (segLen < 2 || offset + segLen > view.byteLength) break;

      if (marker === 0xe1 && segLen >= 16) {
        // Check "Exif\0\0"
        if (
          view.getUint8(offset + 2) === 0x45 &&
          view.getUint8(offset + 3) === 0x78 &&
          view.getUint8(offset + 4) === 0x69 &&
          view.getUint8(offset + 5) === 0x66 &&
          view.getUint8(offset + 6) === 0x00 &&
          view.getUint8(offset + 7) === 0x00
        ) {
          tiffStart = offset + 8;
          break;
        }
      }
      offset += segLen;
    }

    if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return null;
    const byteOrder = view.getUint16(tiffStart, false);
    const little = byteOrder === 0x4949;
    if (!little && byteOrder !== 0x4d4d) return null;
    if (view.getUint16(tiffStart + 2, little) !== 42) return null;

    const ifd0Offset = view.getUint32(tiffStart + 4, little);
    const ifd0 = readIfdEntries(view, tiffStart, ifd0Offset, little);

    let make: string | null = null;
    let model: string | null = null;
    let orientation: number | null = null;
    let dateTimeFallback: string | null = null;
    let exifSubIfd: number | null = null;
    let gpsSubIfd: number | null = null;

    for (const e of ifd0) {
      if (e.tag === 0x010f) make = readAscii(view, e.valueOffset, e.count);
      else if (e.tag === 0x0110) model = readAscii(view, e.valueOffset, e.count);
      else if (e.tag === 0x0112 && e.rawValuePos + 2 <= view.byteLength) {
        orientation = view.getUint16(e.rawValuePos, little);
      } else if (e.tag === 0x0132) {
        dateTimeFallback = readAscii(view, e.valueOffset, e.count);
      } else if (e.tag === 0x8769 && e.rawValuePos + 4 <= view.byteLength) {
        exifSubIfd = view.getUint32(e.rawValuePos, little);
      } else if (e.tag === 0x8825 && e.rawValuePos + 4 <= view.byteLength) {
        gpsSubIfd = view.getUint32(e.rawValuePos, little);
      }
    }

    let dateTimeOriginal: string | null = null;
    let offsetTimeOriginal: string | null = null;
    if (exifSubIfd !== null) {
      const exifEntries = readIfdEntries(view, tiffStart, exifSubIfd, little);
      for (const e of exifEntries) {
        if (e.tag === 0x9003) dateTimeOriginal = readAscii(view, e.valueOffset, e.count);
        else if (e.tag === 0x9004 && !dateTimeOriginal) dateTimeOriginal = readAscii(view, e.valueOffset, e.count);
        else if (e.tag === 0x9011) offsetTimeOriginal = readAscii(view, e.valueOffset, e.count);
      }
    }

    let latRef: string | null = null;
    let lonRef: string | null = null;
    let latDeg: number | null = null;
    let lonDeg: number | null = null;
    let gpsDate: string | null = null;
    let gpsTime: [number, number, number] | null = null;

    if (gpsSubIfd !== null) {
      const gpsEntries = readIfdEntries(view, tiffStart, gpsSubIfd, little);
      for (const e of gpsEntries) {
        if (e.tag === 0x0001) latRef = readAscii(view, e.valueOffset, e.count);
        else if (e.tag === 0x0002 && e.count >= 3) latDeg = readDms(view, e.valueOffset, little);
        else if (e.tag === 0x0003) lonRef = readAscii(view, e.valueOffset, e.count);
        else if (e.tag === 0x0004 && e.count >= 3) lonDeg = readDms(view, e.valueOffset, little);
        else if (e.tag === 0x0007 && e.count >= 3) {
          const h = readRational(view, e.valueOffset, little);
          const m = readRational(view, e.valueOffset + 8, little);
          const s = readRational(view, e.valueOffset + 16, little);
          if (h !== null && m !== null && s !== null) gpsTime = [h, m, s];
        } else if (e.tag === 0x001d) {
          gpsDate = readAscii(view, e.valueOffset, e.count);
        }
      }
    }

    let lat: number | null = null;
    if (latDeg !== null && latDeg >= 0 && latDeg <= 90) {
      lat = latRef?.toUpperCase().startsWith("S") ? -latDeg : latDeg;
      lat = Math.round(lat * 1e6) / 1e6;
    }
    let lonEast: number | null = null;
    if (lonDeg !== null && lonDeg >= 0 && lonDeg <= 180) {
      lonEast = lonRef?.toUpperCase().startsWith("W") ? -lonDeg : lonDeg;
      lonEast = Math.round(lonEast * 1e6) / 1e6;
    }

    let utc: string | null = null;
    let utcVerified = false;
    if (gpsDate && gpsTime) {
      const dm = gpsDate.match(/^(\d{4}):(\d{2}):(\d{2})$/);
      if (dm) {
        const jd = julianDay(
          Number(dm[1]),
          Number(dm[2]),
          Number(dm[3]),
          Math.floor(gpsTime[0]),
          Math.floor(gpsTime[1]),
          Math.round(gpsTime[2]),
          "gregorian",
        );
        if (Number.isFinite(jd)) {
          utc = jdUtToIso(jd, true);
          utcVerified = true;
        }
      }
    }
    if (!utc && (dateTimeOriginal || dateTimeFallback)) {
      const parsed = parseExifDateString((dateTimeOriginal ?? dateTimeFallback)!, offsetTimeOriginal);
      if (parsed) {
        utc = parsed.utc;
        utcVerified = parsed.utcVerified;
      }
    }

    if (utc === null && lat === null && lonEast === null && make === null && model === null) {
      return null;
    }
    return { utc, utcVerified, lat, lonEast, make, model, orientation };
  } catch {
    return null;
  }
}

// -------------------------------------------------- 12x24 Analemma Feasibility Heatmap

export interface AnalemmaCell {
  month: number; // 1..12
  hourUtc: number; // 0..23
  /** Normalized physical match score in [0, 1]; 1 = exact match, 0 = infeasible. */
  score: number;
  feasible: boolean;
  sunAltDeg: number;
  shadowBearingDeg: number | null;
  shadowLengthRatio: number | null;
}

export interface AnalemmaHeatmap {
  year: number;
  months: readonly string[];
  cells: AnalemmaCell[];
  feasibleCount: number;
  peak: { month: number; hourUtc: number; score: number } | null;
  /** Number of constraints evaluated by the fast solar/shadow kernel. */
  evaluatedConstraints: string[];
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function fastShadowAt(
  sunAzDeg: number,
  sunAltAppDeg: number,
  slopeDeg: number,
  slopeAzimuthDeg: number,
): { cast: boolean; bearingDeg: number | null; lengthRatio: number | null } {
  if (sunAltAppDeg <= 0.05) {
    return { cast: false, bearingDeg: null, lengthRatio: null };
  }
  const bearing = mod360(sunAzDeg + 180);
  if (slopeDeg === 0) {
    return { cast: true, bearingDeg: bearing, lengthRatio: 1 / Math.tan(sunAltAppDeg * DEG) };
  }
  const s = dirFromAzAlt(sunAzDeg, sunAltAppDeg);
  const sig = slopeDeg * DEG;
  const alp = slopeAzimuthDeg * DEG;
  const ss = Math.sin(sig);
  const n: [number, number, number] = [ss * Math.sin(alp), ss * Math.cos(alp), Math.cos(sig)];
  const nDotS = n[0] * s[0] + n[1] * s[1] + n[2] * s[2];
  if (nDotS <= Math.sin(0.05 * DEG)) {
    return { cast: false, bearingDeg: null, lengthRatio: null };
  }
  const t = n[2] / nDotS;
  const qx = -t * s[0];
  const qy = -t * s[1];
  const qz = 1 - t * s[2];
  return { cast: true, bearingDeg: bearing, lengthRatio: Math.hypot(qx, qy, qz) };
}

/**
 * Compute a fast 12-month x 24-hour UTC solar analemma feasibility grid for a
 * location and observation set. Uses mid-month solar equatorial coordinates
 * (12 engine calls total) and rotates Greenwich Apparent Sidereal Time across
 * all 24 hours, completing in < 2 ms in the browser.
 */
export function computeAnalemmaHeatmap(
  engine: Engine,
  place: ObservationPlace,
  observed: ObservedConstraints,
  year = 2026,
): AnalemmaHeatmap {
  const obs = cleanObserved(observed);
  const elev = place.elevationM ?? 0;
  const slopeDeg = place.slopeDeg ?? 0;
  const slopeAz = place.slopeAzimuthDeg ?? 0;
  const pressure = elev === 0 ? 1013.25 : 1013.25 * Math.exp(-clamp(elev, -500, 50000) / 8434.5);

  const tolBear = obs.tolerances?.shadowBearingDeg ?? DEFAULT_TOLERANCES.shadowBearingDeg;
  const tolRel = obs.tolerances?.shadowLengthRatioRel ?? DEFAULT_TOLERANCES.shadowLengthRatioRel;
  const tolAbs = obs.tolerances?.shadowLengthRatioAbs ?? DEFAULT_TOLERANCES.shadowLengthRatioAbs;
  const tolSunAz = obs.tolerances?.sunAzimuthDeg ?? DEFAULT_TOLERANCES.sunAzimuthDeg;
  const tolSunAlt = obs.tolerances?.sunAltitudeDeg ?? DEFAULT_TOLERANCES.sunAltitudeDeg;

  const evaluatedConstraints: string[] = [];
  if (obs.shadowBearingDeg !== undefined) evaluatedConstraints.push("shadowBearingDeg");
  if (obs.shadowLengthRatio !== undefined) evaluatedConstraints.push("shadowLengthRatio");
  if (obs.sunAzimuthDeg !== undefined) evaluatedConstraints.push("sunAzimuthDeg");
  if (obs.sunAltitudeDeg !== undefined) evaluatedConstraints.push("sunAltitudeDeg");
  if (obs.twilight !== undefined) evaluatedConstraints.push("twilight");
  if (obs.sunVisible !== undefined) evaluatedConstraints.push("sunVisible");

  const phi = place.lat * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const lonRad = place.lonEast * DEG;
  const SIDEREAL_RAD_PER_HOUR = (TWO_PI * 1.00273790935) / 24;

  const cells: AnalemmaCell[] = [];
  let feasibleCount = 0;
  let peak: { month: number; hourUtc: number; score: number } | null = null;

  for (let month = 1; month <= 12; month++) {
    const jd0 = julianDay(year, month, 15, 0, 0, 0, "gregorian");
    const sunMid = engine.position("sun", jd0 + 0.5);
    const ra = sunMid.ra * DEG;
    const dec = sunMid.dec * DEG;
    const sinDec = Math.sin(dec);
    const cosDec = Math.cos(dec);
    const gast0 = gast(engine.data, jd0);

    for (let hour = 0; hour < 24; hour++) {
      // Sample at :15 and :45 inside the hour bin so narrow shadow windows are not skipped
      let bestScore = -1;
      let bestFeasible = false;
      let bestAlt = 0;
      let bestBear: number | null = null;
      let bestRatio: number | null = null;

      for (const sub of [0.25, 0.75]) {
        const lst = gast0 + (hour + sub) * SIDEREAL_RAD_PER_HOUR + lonRad;
        const ha = lst - ra;
        const cosHa = Math.cos(ha);
        const sinAlt = clamp(sinPhi * sinDec + cosPhi * cosDec * cosHa, -1, 1);
        const altTrue = Math.asin(sinAlt) / DEG;
        const altApp = refractTrueToApparent(altTrue, pressure);
        const azS = Math.atan2(cosDec * Math.sin(ha), cosDec * cosHa * sinPhi - sinDec * cosPhi);
        const sunAz = mod360(azS / DEG + 180);
        const shd = fastShadowAt(sunAz, altApp, slopeDeg, slopeAz);

        let maxNorm = 0;
        let impossible = false;

        if (obs.sunVisible !== undefined) {
          const isVis = altApp > 0;
          if (isVis !== obs.sunVisible) impossible = true;
        }
        if (obs.twilight !== undefined) {
          const band = TWILIGHT_BANDS[obs.twilight as TwilightObservation];
          if (band) {
            if (altApp < band[0] - 2 || altApp > band[1] + 2) {
              impossible = true;
            } else if (altApp < band[0] || altApp > band[1]) {
              const d = altApp < band[0] ? band[0] - altApp : altApp - band[1];
              maxNorm = Math.max(maxNorm, d / 2);
            }
          }
        }
        if (obs.sunAzimuthDeg !== undefined) {
          const d = Math.abs(wrap180(sunAz - obs.sunAzimuthDeg));
          maxNorm = Math.max(maxNorm, d / tolSunAz);
        }
        if (obs.sunAltitudeDeg !== undefined) {
          const d = Math.abs(altApp - obs.sunAltitudeDeg);
          maxNorm = Math.max(maxNorm, d / tolSunAlt);
        }
        if (obs.shadowBearingDeg !== undefined) {
          if (!shd.cast || shd.bearingDeg === null) {
            impossible = true;
          } else {
            const d = Math.abs(wrap180(shd.bearingDeg - obs.shadowBearingDeg));
            maxNorm = Math.max(maxNorm, d / tolBear);
          }
        }
        if (obs.shadowLengthRatio !== undefined) {
          if (!shd.cast || shd.lengthRatio === null) {
            impossible = true;
          } else {
            const tol = obs.tolerances?.shadowLengthRatio ?? Math.max(tolAbs, tolRel * Math.max(obs.shadowLengthRatio, shd.lengthRatio));
            const d = Math.abs(shd.lengthRatio - obs.shadowLengthRatio);
            maxNorm = Math.max(maxNorm, d / tol);
          }
        }

        const score = impossible
          ? 0
          : evaluatedConstraints.length === 0
            ? altApp > 0 ? clamp(altApp / 90, 0.08, 0.5) : 0
            : Math.exp(-0.5 * maxNorm * maxNorm);
        const feasible = !impossible && evaluatedConstraints.length > 0 && maxNorm <= 1.0;

        if (score > bestScore) {
          bestScore = score;
          bestFeasible = feasible;
          bestAlt = altApp;
          bestBear = shd.bearingDeg;
          bestRatio = shd.lengthRatio;
        }
      }

      if (bestFeasible) feasibleCount++;
      if (bestScore > 0 && (!peak || bestScore > peak.score)) {
        peak = { month, hourUtc: hour, score: Math.round(bestScore * 1000) / 1000 };
      }

      cells.push({
        month,
        hourUtc: hour,
        score: Math.round(Math.max(0, bestScore) * 1000) / 1000,
        feasible: bestFeasible,
        sunAltDeg: r1(bestAlt),
        shadowBearingDeg: bestBear !== null ? r1(bestBear) : null,
        shadowLengthRatio: bestRatio !== null ? Math.round(bestRatio * 1000) / 1000 : null,
      });
    }
  }

  return {
    year,
    months: MONTH_SHORT,
    cells,
    feasibleCount,
    peak,
    evaluatedConstraints,
  };
}

// -------------------------------------------------- SVG Figure 1: Compass & Shadow Dial

export interface CompassDialGeometry {
  size: number;
  cx: number;
  cy: number;
  radius: number;
  /** Maximum radial scale for calibrated shadow vector inside the dial (`L/H = 4.0`). */
  radialScaleMax: number;
  sun: {
    x: number;
    y: number;
    labelX: number;
    labelY: number;
    azimuthDeg: number;
    altitudeDeg: number;
    aboveHorizon: boolean;
  };
  predictedShadow: {
    cast: boolean;
    bearingDeg: number | null;
    lengthRatio: number | null;
    /** Calibrated radial tip (r = min(ratio, 4) / 4 * R). */
    x: number;
    y: number;
    /** Rim point on outer ring along shadow bearing. */
    rimX: number;
    rimY: number;
    clipped: boolean;
  };
  observedShadow: {
    present: boolean;
    bearingDeg: number | null;
    toleranceDeg: number;
    x: number;
    y: number;
    wedgePath: string | null;
  };
  moon: {
    visible: boolean;
    x: number;
    y: number;
    labelX: number;
    labelY: number;
    azimuthDeg: number;
    altitudeDeg: number;
    illum: number;
    predictedLimbDeg: number | null;
    /** Small local bright-limb orientation arrow centered near Moon marker. */
    predLimbArrow: { x1: number; y1: number; x2: number; y2: number } | null;
    observedLimbDeg: number | null;
    obsLimbArrow: { x1: number; y1: number; x2: number; y2: number } | null;
  };
  /** Paired 1-D horizontal range-frame bar for shadow length ratio (Tufte B1 zero lie factor). */
  ratioBar: {
    show: boolean;
    domainMax: number;
    predicted: number | null;
    observed: number | null;
    tolLo: number | null;
    tolHi: number | null;
    clippedPred: boolean;
    clippedObs: boolean;
  };
}

function compassXY(cx: number, cy: number, radius: number, azDeg: number): [number, number] {
  const rad = azDeg * DEG;
  return [r1(cx + radius * Math.sin(rad)), r1(cy - radius * Math.cos(rad))];
}

function limbArrow(cx: number, cy: number, limbDeg: number, len = 14): { x1: number; y1: number; x2: number; y2: number } {
  // Zenith-frame bright-limb angle: 0 deg = right (+x), 90 deg = straight up (-y)
  const rad = limbDeg * DEG;
  return {
    x1: r1(cx),
    y1: r1(cy),
    x2: r1(cx + len * Math.cos(rad)),
    y2: r1(cy - len * Math.sin(rad)),
  };
}

/**
 * Build deterministic SVG geometry for Figure 1 (Compass & Shadow Dial + paired
 * 1-D shadow-ratio range-frame bar). All coordinates rounded to 0.1.
 */
export function compassDialGeometry(
  scene: SceneGeometry,
  observed: ObservedConstraints,
): CompassDialGeometry {
  const size = 240;
  const cx = 120;
  const cy = 120;
  const radius = 84;
  const radialScaleMax = 4.0;

  const [sunX, sunY] = compassXY(cx, cy, radius, scene.sun.azimuthDeg);
  const [sunLX, sunLY] = compassXY(cx, cy, radius + 16, scene.sun.azimuthDeg);

  const predCast = scene.shadow.cast && scene.shadow.bearingDeg !== null;
  const predBear = scene.shadow.bearingDeg;
  const predLen = scene.shadow.lengthRatio;
  const predClamped = predLen !== null ? Math.min(predLen, radialScaleMax) : 0;
  const predRadius = predCast
    ? (predLen !== null ? Math.max(14, (predClamped / radialScaleMax) * radius) : radius)
    : 0;
  const [psX, psY] = predCast && predBear !== null ? compassXY(cx, cy, predRadius, predBear) : [cx, cy];
  const [psRimX, psRimY] = predCast && predBear !== null ? compassXY(cx, cy, radius, predBear) : [cx, cy];

  const obsBear = observed.shadowBearingDeg !== undefined && Number.isFinite(observed.shadowBearingDeg)
    ? mod360(observed.shadowBearingDeg)
    : null;
  const tolBear = observed.tolerances?.shadowBearingDeg ?? DEFAULT_TOLERANCES.shadowBearingDeg;
  let obsX = cx;
  let obsY = cy;
  let wedgePath: string | null = null;
  if (obsBear !== null) {
    const obsRatio = observed.shadowLengthRatio;
    const obsR = obsRatio !== undefined && Number.isFinite(obsRatio)
      ? Math.max(14, (Math.min(obsRatio, radialScaleMax) / radialScaleMax) * radius)
      : radius * 0.88;
    [obsX, obsY] = compassXY(cx, cy, obsR, obsBear);
    const a1 = obsBear - tolBear;
    const a2 = obsBear + tolBear;
    const [wx1, wy1] = compassXY(cx, cy, radius, a1);
    const [wx2, wy2] = compassXY(cx, cy, radius, a2);
    const largeArc = tolBear * 2 > 180 ? 1 : 0;
    wedgePath = `M ${cx} ${cy} L ${wx1} ${wy1} A ${radius} ${radius} 0 ${largeArc} 1 ${wx2} ${wy2} Z`;
  }

  const [moonX, moonY] = compassXY(cx, cy, radius * 0.78, scene.moon.azimuthDeg);
  const moonLabelOff = Math.abs(wrap180(scene.moon.azimuthDeg - scene.sun.azimuthDeg)) < 22 ? 24 : 16;
  const [moonLX, moonLY] = compassXY(cx, cy, radius * 0.78 + moonLabelOff, scene.moon.azimuthDeg);
  const predLimb = scene.moon.visible ? scene.moon.brightLimbZenithDeg : null;
  const obsLimb = observed.moonBrightLimbDeg !== undefined && Number.isFinite(observed.moonBrightLimbDeg)
    ? mod360(observed.moonBrightLimbDeg)
    : null;

  // 1-D horizontal range-frame bar for shadow length ratio (L/H)
  const obsRatio = observed.shadowLengthRatio !== undefined && Number.isFinite(observed.shadowLengthRatio)
    ? observed.shadowLengthRatio
    : null;
  const showRatioBar = predLen !== null || obsRatio !== null;
  const relTol = observed.tolerances?.shadowLengthRatioRel ?? DEFAULT_TOLERANCES.shadowLengthRatioRel;
  const absTol = observed.tolerances?.shadowLengthRatioAbs ?? DEFAULT_TOLERANCES.shadowLengthRatioAbs;
  const tolBand = obsRatio !== null
    ? (observed.tolerances?.shadowLengthRatio ?? Math.max(absTol, relTol * obsRatio))
    : null;
  const tolLo = obsRatio !== null && tolBand !== null ? Math.max(0, obsRatio - tolBand) : null;
  const tolHi = obsRatio !== null && tolBand !== null ? obsRatio + tolBand : null;
  const rawMax = Math.max(1.5, predLen ?? 0, obsRatio ?? 0, tolHi ?? 0);
  const domainMax = Math.min(6.0, Math.ceil(rawMax * 2) / 2);

  return {
    size,
    cx,
    cy,
    radius,
    radialScaleMax,
    sun: {
      x: sunX,
      y: sunY,
      labelX: sunLX,
      labelY: sunLY,
      azimuthDeg: r1(scene.sun.azimuthDeg),
      altitudeDeg: r1(scene.sun.altitudeApparentDeg),
      aboveHorizon: scene.sun.altitudeApparentDeg > 0,
    },
    predictedShadow: {
      cast: predCast,
      bearingDeg: predBear !== null ? r1(predBear) : null,
      lengthRatio: predLen !== null ? Math.round(predLen * 1000) / 1000 : null,
      x: psX,
      y: psY,
      rimX: psRimX,
      rimY: psRimY,
      clipped: predLen !== null && predLen > radialScaleMax,
    },
    observedShadow: {
      present: obsBear !== null,
      bearingDeg: obsBear !== null ? r1(obsBear) : null,
      toleranceDeg: r1(tolBear),
      x: obsX,
      y: obsY,
      wedgePath,
    },
    moon: {
      visible: scene.moon.visible,
      x: moonX,
      y: moonY,
      labelX: moonLX,
      labelY: moonLY,
      azimuthDeg: r1(scene.moon.azimuthDeg),
      altitudeDeg: r1(scene.moon.altitudeApparentDeg),
      illum: Math.round(scene.moon.illum * 100) / 100,
      predictedLimbDeg: predLimb !== null ? r1(predLimb) : null,
      predLimbArrow: predLimb !== null ? limbArrow(moonX, moonY, predLimb, 16) : null,
      observedLimbDeg: obsLimb !== null ? r1(obsLimb) : null,
      obsLimbArrow: obsLimb !== null ? limbArrow(moonX, moonY, obsLimb, 16) : null,
    },
    ratioBar: {
      show: showRatioBar,
      domainMax,
      predicted: predLen !== null ? Math.round(predLen * 1000) / 1000 : null,
      observed: obsRatio !== null ? Math.round(obsRatio * 1000) / 1000 : null,
      tolLo: tolLo !== null ? Math.round(tolLo * 1000) / 1000 : null,
      tolHi: tolHi !== null ? Math.round(tolHi * 1000) / 1000 : null,
      clippedPred: predLen !== null && predLen > 6.0,
      clippedObs: obsRatio !== null && obsRatio > 6.0,
    },
  };
}

// -------------------------------------------------- SVG Figure 2: Chronolocate Timeline Track

export interface TimelineWindowGeom {
  index: number;
  x1: number;
  x2: number;
  width: number;
  peakX: number;
  isPointHit: boolean;
  fitScore: number;
  durationMinutes: number;
  peakLabel: string;
  jdStart: number;
  jdEnd: number;
  bestJd: number;
}

export interface TimelinePeakLabel {
  index: number;
  x: number;
  y: number;
  anchorX: number;
  text: string;
}

export interface TimelineGeometry {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotW: number;
  plotH: number;
  jdStart: number;
  jdEnd: number;
  startLabel: string;
  endLabel: string;
  ticks: Array<{ x: number; label: string }>;
  /** Solar altitude curve polyline points (or upper daily noon envelope for spans > 10d). */
  solarCurvePoints: string;
  /** Optional lower daily midnight envelope when span > 10 days. */
  solarLowerPoints: string | null;
  minAlt: number;
  maxAlt: number;
  horizonY: number | null;
  windows: TimelineWindowGeom[];
  hasPointHits: boolean;
  placedPeaks: TimelinePeakLabel[];
}

/**
 * Build deterministic SVG geometry for Figure 2 (Chronolocate Timeline Track
 * + solar altitude envelope). Separates sub-2px point hits from true-width
 * duration intervals (Tufte B1) and deconflicts peak labels (Tufte B4).
 */
export function timelineGeometry(
  engine: Engine,
  result: ChronolocateResult,
  width = 640,
  height = 200,
): TimelineGeometry {
  const padL = 44;
  const padR = 16;
  const padT = 28;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const spanDays = Math.max(1e-6, result.jdEnd - result.jdStart);

  const xOf = (jd: number): number => r1(padL + clamp((jd - result.jdStart) / spanDays, 0, 1) * plotW);

  // Sample solar altitude across the span
  const samples = 96;
  const phi = result.place.lat * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const lonRad = result.place.lonEast * DEG;
  const pressure = result.place.elevationM === 0
    ? 1013.25
    : 1013.25 * Math.exp(-clamp(result.place.elevationM, -500, 50000) / 8434.5);

  const isDailyEnvelope = spanDays > 10;
  const upperAlts: Array<{ x: number; alt: number }> = [];
  const lowerAlts: Array<{ x: number; alt: number }> = [];
  let minAlt = Infinity;
  let maxAlt = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const frac = i / samples;
    const jd = result.jdStart + frac * spanDays;
    const sunPos = engine.position("sun", jd);
    const dec = sunPos.dec * DEG;
    if (isDailyEnvelope) {
      // Exact diurnal solar max (meridian transit) and min (lower culmination)
      const hiTrue = Math.asin(clamp(sinPhi * Math.sin(dec) + cosPhi * Math.cos(dec), -1, 1)) / DEG;
      const loTrue = Math.asin(clamp(sinPhi * Math.sin(dec) - cosPhi * Math.cos(dec), -1, 1)) / DEG;
      const hi = refractTrueToApparent(hiTrue, pressure);
      const lo = loTrue;
      const x = r1(padL + frac * plotW);
      upperAlts.push({ x, alt: hi });
      lowerAlts.push({ x, alt: lo });
      if (lo < minAlt) minAlt = lo;
      if (hi > maxAlt) maxAlt = hi;
    } else {
      const ra = sunPos.ra * DEG;
      const lst = gast(engine.data, jd) + lonRad;
      const ha = lst - ra;
      const altTrue = Math.asin(clamp(sinPhi * Math.sin(dec) + cosPhi * Math.cos(dec) * Math.cos(ha), -1, 1)) / DEG;
      const alt = refractTrueToApparent(altTrue, pressure);
      const x = r1(padL + frac * plotW);
      upperAlts.push({ x, alt });
      if (alt < minAlt) minAlt = alt;
      if (alt > maxAlt) maxAlt = alt;
    }
  }

  if (!Number.isFinite(minAlt) || !Number.isFinite(maxAlt) || maxAlt - minAlt < 1) {
    minAlt = -30;
    maxAlt = 60;
  }
  const minAltR = Math.floor(minAlt);
  const maxAltR = Math.ceil(maxAlt);
  const yOf = (alt: number): number =>
    r1(padT + ((maxAltR - alt) / Math.max(1, maxAltR - minAltR)) * plotH);

  const horizonY = minAltR <= 0 && maxAltR >= 0 ? yOf(0) : null;
  const solarCurvePoints = upperAlts.map((p) => `${p.x},${yOf(p.alt)}`).join(" ");
  const solarLowerPoints = isDailyEnvelope
    ? lowerAlts.map((p) => `${p.x},${yOf(p.alt)}`).join(" ")
    : null;

  let hasPointHits = false;
  const windows: TimelineWindowGeom[] = result.windows.map((w, index) => {
    const x1 = xOf(w.jdStart);
    const x2 = xOf(w.jdEnd);
    const rawW = x2 - x1;
    const isPointHit = rawW < 2.0;
    if (isPointHit) hasPointHits = true;
    return {
      index,
      x1,
      x2,
      width: r1(Math.max(0, rawW)),
      peakX: xOf(w.bestJd),
      isPointHit,
      fitScore: Math.round(w.fitScore * 1000) / 1000,
      durationMinutes: r1(w.durationMinutes),
      peakLabel: shortUtcLabel(w.bestJd),
      jdStart: w.jdStart,
      jdEnd: w.jdEnd,
      bestJd: w.bestJd,
    };
  });

  // Top peak labels (up to 3 highest-scoring windows) with greedy horizontal deconfliction
  const topPeaks = [...windows]
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 3)
    .sort((a, b) => a.peakX - b.peakX);
  const placedPeaks: TimelinePeakLabel[] = [];
  let lastLabelRight = -Infinity;
  const labelW = 132;
  for (const w of topPeaks) {
    const idealX = clamp(w.peakX, padL + labelW / 2, width - padR - labelW / 2);
    const x = r1(Math.max(idealX, lastLabelRight + 8 + labelW / 2));
    if (x + labelW / 2 <= width - padR + 4) {
      placedPeaks.push({
        index: w.index,
        x,
        y: r1(padT - 10),
        anchorX: w.peakX,
        text: `#${w.index + 1} ${w.peakLabel.slice(5, 16)}`,
      });
      lastLabelRight = x + labelW / 2;
    }
  }

  // Range-frame axis ticks (exact start, 3 interior marks, exact end)
  const ticks: Array<{ x: number; label: string }> = [
    { x: r1(padL), label: jdUtToIso(result.jdStart, false).slice(0, 10) },
  ];
  for (const f of [0.25, 0.5, 0.75]) {
    const jd = result.jdStart + f * spanDays;
    const iso = jdUtToIso(jd, false);
    ticks.push({
      x: r1(padL + f * plotW),
      label: spanDays <= 3 ? iso.slice(5, 16).replace("T", " ") : iso.slice(5, 10),
    });
  }
  ticks.push({ x: r1(padL + plotW), label: jdUtToIso(result.jdEnd, false).slice(0, 10) });

  return {
    width,
    height,
    padL,
    padR,
    padT,
    padB,
    plotW,
    plotH,
    jdStart: result.jdStart,
    jdEnd: result.jdEnd,
    startLabel: shortUtcLabel(result.jdStart),
    endLabel: shortUtcLabel(result.jdEnd),
    ticks,
    solarCurvePoints,
    solarLowerPoints,
    minAlt: minAltR,
    maxAlt: maxAltR,
    horizonY,
    windows,
    hasPointHits,
    placedPeaks,
  };
}

// -------------------------------------------------- SVG Figure 3: Equirectangular Global Fix Plot

export interface FixMapCandidateGeom {
  index: number;
  lat: number;
  lon: number;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  radiusKm: number;
  fitScore: number;
  regionKind: string;
  /** True spherical equal-distance contour split into antimeridian-safe SVG polyline strings. */
  contourPolylines: string[];
  /** Bounding box segments (1 or 2 rects if crossing the antimeridian +/-180 deg). */
  bboxRects: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface FixMapGeometry {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotW: number;
  plotH: number;
  lonLines: Array<{ lon: number; x: number; label: string }>;
  latLines: Array<{ lat: number; y: number; label: string }>;
  subsolar: { lat: number; lon: number; x: number; y: number; labelX: number; labelY: number };
  sublunar: { lat: number; lon: number; x: number; y: number; labelX: number; labelY: number };
  /** Antimeridian-safe daylight terminator circle (90 deg from subsolar point). */
  terminatorPolylines: string[];
  candidates: FixMapCandidateGeom[];
}

/**
 * Compute destination (latDeg, lonDeg) on a sphere starting at (lat0, lon0)
 * moving distanceKm along initial bearing azRad.
 */
function sphereDestination(lat0Deg: number, lon0Deg: number, angularRad: number, azRad: number): [number, number] {
  const phi1 = lat0Deg * DEG;
  const lam1 = lon0Deg * DEG;
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinD = Math.sin(angularRad);
  const cosD = Math.cos(angularRad);
  const sinPhi2 = clamp(sinPhi1 * cosD + cosPhi1 * sinD * Math.cos(azRad), -1, 1);
  const phi2 = Math.asin(sinPhi2);
  const lam2 = lam1 + Math.atan2(Math.sin(azRad) * sinD * cosPhi1, cosD - sinPhi1 * sinPhi2);
  return [phi2 / DEG, wrap180(lam2 / DEG)];
}

/**
 * Project a closed spherical small circle around (centerLat, centerLon) with
 * angular radius `angularRad` into antimeridian-safe equirectangular polyline
 * strings (splitting whenever |deltaLon| > 180 deg so no line shoots across the map).
 */
export function sphericalCirclePolylines(
  centerLat: number,
  centerLon: number,
  angularRad: number,
  xOfLon: (lon: number) => number,
  yOfLat: (lat: number) => number,
  steps = 64,
): string[] {
  if (!(angularRad > 0) || !Number.isFinite(angularRad)) return [];
  const clampedAng = Math.min(Math.PI - 1e-4, angularRad);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const az = (i / steps) * TWO_PI;
    pts.push(sphereDestination(centerLat, centerLon, clampedAng, az));
  }
  const polylines: string[] = [];
  let run: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [lat, lon] = pts[i];
    if (i > 0 && Math.abs(lon - pts[i - 1][1]) > 180) {
      if (run.length > 1) polylines.push(run.join(" "));
      run = [];
    }
    run.push(`${xOfLon(lon)},${yOfLat(lat)}`);
  }
  if (run.length > 1) polylines.push(run.join(" "));
  return polylines;
}

/**
 * Build deterministic SVG geometry for Figure 3 (Equirectangular Global Fix Plot).
 * Projects true spherical equal-distance contours (zero cos(lat) lie factor)
 * and splits all contours and bounding boxes cleanly across the antimeridian.
 */
export function fixMapGeometry(
  result: GeolocateResult,
  width = 640,
  height = 310,
): FixMapGeometry {
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xOfLon = (lon: number): number => r1(padL + ((wrap180(lon) + 180) / 360) * plotW);
  const yOfLat = (lat: number): number => r1(padT + ((90 - clamp(lat, -90, 90)) / 180) * plotH);

  const lonLines = [-180, -120, -60, 0, 60, 120, 180].map((lon) => ({
    lon,
    x: r1(padL + ((lon + 180) / 360) * plotW),
    label: lon === 0 ? "0" : `${lon > 0 ? "+" : ""}${lon}`,
  }));
  const latLines = [90, 60, 30, 0, -30, -60, -90].map((lat) => ({
    lat,
    y: yOfLat(lat),
    label: lat === 0 ? "0" : `${lat > 0 ? "+" : ""}${lat}`,
  }));

  const ssX = xOfLon(result.subsolar.lon);
  const ssY = yOfLat(result.subsolar.lat);
  const slX = xOfLon(result.sublunar.lon);
  const slY = yOfLat(result.sublunar.lat);

  const terminatorPolylines = sphericalCirclePolylines(
    result.subsolar.lat,
    result.subsolar.lon,
    Math.PI / 2,
    xOfLon,
    yOfLat,
    96,
  );

  const candidates: FixMapCandidateGeom[] = result.candidates.map((c, index) => {
    const cx = xOfLon(c.lon);
    const cy = yOfLat(c.lat);
    const angularRad = Math.max(0.012, c.radiusKm / EARTH_RADIUS_KM);
    const contourPolylines = sphericalCirclePolylines(c.lat, c.lon, angularRad, xOfLon, yOfLat, 56);

    const [latLo, latHi] = c.latRange;
    const [lonLo, lonHi] = c.lonRange;
    const yTop = yOfLat(Math.max(latLo, latHi));
    const yBot = yOfLat(Math.min(latLo, latHi));
    const h = r1(Math.max(2, yBot - yTop));
    const bboxRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    if (lonLo <= lonHi) {
      const x1 = xOfLon(lonLo);
      const x2 = xOfLon(lonHi);
      bboxRects.push({ x: x1, y: yTop, width: r1(Math.max(2, x2 - x1)), height: h });
    } else {
      // Antimeridian wrap: [lonLo .. +180] and [-180 .. lonHi]
      const x1 = xOfLon(lonLo);
      const xEastEdge = r1(padL + plotW);
      const xWestEdge = r1(padL);
      const x2 = xOfLon(lonHi);
      bboxRects.push({ x: x1, y: yTop, width: r1(Math.max(2, xEastEdge - x1)), height: h });
      bboxRects.push({ x: xWestEdge, y: yTop, width: r1(Math.max(2, x2 - xWestEdge)), height: h });
    }

    const labelOnLeft = cx > padL + plotW - 76;
    const labelX = r1(labelOnLeft ? cx - 9 : cx + 9);
    const labelY = r1(cy < padT + 18 ? cy + 14 : cy - 8);

    return {
      index,
      lat: Math.round(c.lat * 1000) / 1000,
      lon: Math.round(c.lon * 1000) / 1000,
      x: cx,
      y: cy,
      labelX,
      labelY,
      radiusKm: r1(c.radiusKm),
      fitScore: Math.round(c.fitScore * 1000) / 1000,
      regionKind: c.regionKind,
      contourPolylines,
      bboxRects,
    };
  });

  const ssLabelX = r1(ssX > padL + plotW - 84 ? ssX - 9 : ssX + 9);
  const slLabelX = r1(slX > padL + plotW - 84 ? slX - 9 : slX + 9);
  const slLabelY = r1(Math.abs(slY - ssY) < 16 && Math.abs(slX - ssX) < 60 ? slY + 15 : slY - 8);

  return {
    width,
    height,
    padL,
    padR,
    padT,
    padB,
    plotW,
    plotH,
    lonLines,
    latLines,
    subsolar: {
      lat: Math.round(result.subsolar.lat * 100) / 100,
      lon: Math.round(result.subsolar.lon * 100) / 100,
      x: ssX,
      y: ssY,
      labelX: ssLabelX,
      labelY: r1(ssY < padT + 18 ? ssY + 14 : ssY - 8),
    },
    sublunar: {
      lat: Math.round(result.sublunar.lat * 100) / 100,
      lon: Math.round(result.sublunar.lon * 100) / 100,
      x: slX,
      y: slY,
      labelX: slLabelX,
      labelY: slLabelY,
    },
    terminatorPolylines,
    candidates,
  };
}

// -------------------------------------------------- copyable TS source & return value

function formatObservedLiteral(obs: ObservedConstraints): string {
  const cleaned = cleanObserved(obs);
  const parts: string[] = [];
  if (cleaned.shadowBearingDeg !== undefined) parts.push(`  shadowBearingDeg: ${cleaned.shadowBearingDeg},`);
  if (cleaned.shadowLengthRatio !== undefined) parts.push(`  shadowLengthRatio: ${cleaned.shadowLengthRatio},`);
  if (cleaned.sunAzimuthDeg !== undefined) parts.push(`  sunAzimuthDeg: ${cleaned.sunAzimuthDeg},`);
  if (cleaned.sunAltitudeDeg !== undefined) parts.push(`  sunAltitudeDeg: ${cleaned.sunAltitudeDeg},`);
  if (cleaned.twilight !== undefined) parts.push(`  twilight: "${cleaned.twilight}",`);
  if (cleaned.sunVisible !== undefined) parts.push(`  sunVisible: ${cleaned.sunVisible},`);
  if (cleaned.moonVisible !== undefined) parts.push(`  moonVisible: ${cleaned.moonVisible},`);
  if (cleaned.moonAltitudeDeg !== undefined) parts.push(`  moonAltitudeDeg: ${cleaned.moonAltitudeDeg},`);
  if (cleaned.moonIllum !== undefined) parts.push(`  moonIllum: ${cleaned.moonIllum},`);
  if (cleaned.moonWaxing !== undefined) parts.push(`  moonWaxing: ${cleaned.moonWaxing},`);
  if (cleaned.moonBrightLimbDeg !== undefined) parts.push(`  moonBrightLimbDeg: ${cleaned.moonBrightLimbDeg},`);
  if (cleaned.shadowSweep !== undefined) {
    parts.push(`  shadowSweep: { dtMinutes: ${cleaned.shadowSweep.dtMinutes}, deltaBearingDeg: ${cleaned.shadowSweep.deltaBearingDeg} },`);
  }
  return parts.length > 0 ? `{\n${parts.join("\n")}\n}` : "{}";
}

function jdCallLiteral(iso: string): string {
  const m = iso.trim().match(/^(-?\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return `julianDay(2026, 7, 4, 19, 30, 0)`;
  return `julianDay(${Number(m[1])}, ${Number(m[2])}, ${Number(m[3])}, ${Number(m[4])}, ${Number(m[5])}, ${m[6] ? Number(m[6]) : 0})`;
}

/** Generate a runnable TypeScript snippet reproducing the active query. */
export function fieldVerifierSource(query: FieldVerifierQuery): string {
  const obsLit = formatObservedLiteral(query.observed);
  const { lat, lonEast, elevationM, slopeDeg, slopeAzimuthDeg } = query.place;
  const terrain: string[] = [];
  if (elevationM !== 0) terrain.push(`elevationM: ${elevationM}`);
  if (slopeDeg > 0) {
    terrain.push(`slopeDeg: ${slopeDeg}`);
    terrain.push(`slopeAzimuthDeg: ${slopeAzimuthDeg}`);
  }

  if (query.mode === "verify") {
    const claimFields = [
      `  jdUt: ${jdCallLiteral(query.utc)},`,
      `  lat: ${lat},`,
      `  lonEast: ${lonEast},`,
      ...terrain.map((t) => `  ${t},`),
    ];
    if (query.timeToleranceMin > 0) claimFields.push(`  timeToleranceMin: ${query.timeToleranceMin},`);
    if (query.placeToleranceDeg > 0) claimFields.push(`  placeToleranceDeg: ${query.placeToleranceDeg},`);
    return [
      `import { Engine, julianDay, verifyObservation } from "caelus";`,
      `import { embeddedData } from "caelus/data-embedded";`,
      ``,
      `const engine = new Engine(embeddedData);`,
      `const result = verifyObservation(`,
      `  engine,`,
      `  {`,
      ...claimFields.map((l) => `  ${l}`),
      `  },`,
      `  ${obsLit.replace(/\n/g, "\n  ")},`,
      `);`,
      ``,
      `console.log(result.verdict, result.consistencyScore, result.diagnostics?.summary);`,
    ].join("\n");
  }

  if (query.mode === "chronolocate") {
    const placeFields = [`lat: ${lat}`, `lonEast: ${lonEast}`, ...terrain];
    return [
      `import { Engine, julianDay, chronolocate } from "caelus";`,
      `import { embeddedData } from "caelus/data-embedded";`,
      ``,
      `const engine = new Engine(embeddedData);`,
      `const res = chronolocate(`,
      `  engine,`,
      `  { ${placeFields.join(", ")} },`,
      `  ${obsLit.replace(/\n/g, "\n  ")},`,
      `  ${jdCallLiteral(query.searchStartUtc)},`,
      `  ${jdCallLiteral(query.searchEndUtc)},`,
      `);`,
      ``,
      `console.log(res.windows.length, res.daysPruned, res.windows[0]);`,
    ].join("\n");
  }

  const geoOpts = [`gridStepDeg: ${query.gridStepDeg ?? 4}`, ...terrain];
  return [
    `import { Engine, julianDay, geolocate } from "caelus";`,
    `import { embeddedData } from "caelus/data-embedded";`,
    ``,
    `const engine = new Engine(embeddedData);`,
    `const fix = geolocate(`,
    `  engine,`,
    `  ${jdCallLiteral(query.utc)},`,
    `  ${obsLit.replace(/\n/g, "\n  ")},`,
    `  { ${geoOpts.join(", ")} },`,
    `);`,
    ``,
    `console.log(fix.method, fix.candidates[0]);`,
  ].join("\n");
}

/** Format an abridged human-readable JSON summary of the engine return value. */
export function fieldVerifierReturned(result: FieldVerifierResult | null): string {
  if (!result) return "null";
  if (result.mode === "verify" && result.verify) {
    const v = result.verify;
    return JSON.stringify(
      {
        verdict: v.verdict,
        consistencyScore: v.consistencyScore !== null ? Number(v.consistencyScore.toFixed(4)) : null,
        checks: v.checks.map((c) => ({
          field: c.field,
          status: c.status,
          observed: c.observed,
          expected: typeof c.expected === "number" ? Number(c.expected.toFixed(3)) : c.expected,
          residual: c.residual !== null ? Number(c.residual.toFixed(3)) : null,
        })),
        diagnostics: v.diagnostics
          ? {
              summary: v.diagnostics.summary,
              timeShiftMin: Math.round(v.diagnostics.timeShift.offsetMinutes),
              hemisphereFlipVerdict: v.diagnostics.hemisphereFlip.verdict,
              dateShiftDays: v.diagnostics.dateShift ? Math.round(v.diagnostics.dateShift.offsetDays) : null,
            }
          : null,
      },
      null,
      2,
    );
  }
  if (result.mode === "chronolocate" && result.chronolocate) {
    const c = result.chronolocate;
    return JSON.stringify(
      {
        daysScanned: c.daysScanned,
        daysPruned: c.daysPruned,
        windowCount: c.windows.length,
        topWindows: c.windows.slice(0, 5).map((w) => ({
          peakUtc: jdUtToIso(w.bestJd),
          durationMinutes: r1(w.durationMinutes),
          fitScore: Number(w.fitScore.toFixed(3)),
        })),
      },
      null,
      2,
    );
  }
  if (result.mode === "geolocate" && result.geolocate) {
    const g = result.geolocate;
    return JSON.stringify(
      {
        method: g.method,
        subsolar: { lat: r1(g.subsolar.lat), lon: r1(g.subsolar.lon) },
        sublunar: { lat: r1(g.sublunar.lat), lon: r1(g.sublunar.lon) },
        candidates: g.candidates.slice(0, 5).map((cand) => ({
          lat: Number(cand.lat.toFixed(3)),
          lon: Number(cand.lon.toFixed(3)),
          radiusKm: r1(cand.radiusKm),
          regionKind: cand.regionKind,
          fitScore: Number(cand.fitScore.toFixed(3)),
        })),
      },
      null,
      2,
    );
  }
  return "null";
}
