/**
 * astroengine observe -- physical spacetime observation, verification,
 * chronolocation, geolocation, and chronosense.
 *
 * Forward model (`sceneGeometry`): computes apparent solar and lunar horizontal
 * coordinates with barometric refraction, flat or sloped-ground 3D shadow
 * geometry and sweep rates, optional camera-relative lighting and glare risk,
 * lens-independent zenith-frame lunar bright-limb orientation, naked-eye planet
 * visibility, local diurnal cycle (sunrise, solar noon, sunset, next twilight
 * transition, planetary hour), and compact chronosense headers.
 *
 * Inverse and verification solvers:
 * - `verifyObservation`: checks any subset of physical observations against a
 *   claimed spacetime point with automatic time/place uncertainty widening,
 *   indeterminate handling for near-zenith shadows and full/new Moon bright limb,
 *   and counterfactual diagnostics (same-day clock/timezone shift, hemisphere
 *   sign flip, seasonal date shift).
 * - `chronolocate`: multi-day fast pruning (solar altitude bounds and lunar phase
 *   bounds), contiguous intra-day continuous signed-margin scan with narrow-peak
 *   rescue, <1 s edge bisection, and golden-section peak refinement.
 * - `geolocate`: Path A closed-form spherical celestial navigation fix with
 *   damped Gauss-Newton refinement and Jacobian covariance uncertainty; Path B
 *   precomputed pure-trig global spherical grid with antimeridian-wrapping
 *   connected-component clustering, local refinement, and region classification.
 *
 * Zero runtime dependencies; mirrors python/astroengine/observe.py.
 */
import {
  DEG, mod, calendarDate, equatorial, jdTT, trueObliquity, topocentricEcl,
} from "./core.js";
import { Engine, type BodyId } from "./chart.js";
import { angles as houseAngles, gast } from "./houses.js";
import {
  DIAMETER_KM, azAlt, pheno, refractApparentToTrue, refractTrueToApparent,
  airmass, extinctionMag,
} from "./pheno.js";
import { riseSet } from "./events.js";
import { planetaryHour, type PlanetaryHour } from "./electional.js";
import {
  dirFromAzAlt, twilightStage, limitingMag, type TwilightStage,
} from "./skyview.js";
import type { Vec3 } from "./spherical.js";

const TWO_PI = 2.0 * Math.PI;
const EARTH_RADIUS_KM = 6371.0;
const INV_PHI = 0.6180339887498949;
const DT_MIN = 1.0 / 1440.0; // 1 minute in days
const GRAZING_ALT_DEG = 0.05;
const GRAZING_SIN = Math.sin(GRAZING_ALT_DEG * DEG);
const ZENITH_INDET_DEG = 88.0;
const MOON_PHASE_INDET_LO = 0.03;
const MOON_PHASE_INDET_HI = 0.97;

const COMPASS16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

const VISIBLE_PLANETS: readonly BodyId[] = [
  "mercury", "venus", "mars", "jupiter", "saturn",
];

const VALID_VISIBLE_BODIES = new Set<string>([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
]);

// ---------------------------------------------------------------- public types

/** Twilight band accepted as an observation constraint. */
export type TwilightObservation = TwilightStage | "daylight" | "dark";

/** Direction of solar altitude motion at an instant. */
export type SunTrend = "rising" | "culminating" | "setting" | "nadir";

/** Qualitative solar glare risk for an aimed camera. */
export type GlareRisk = "direct" | "high" | "moderate" | "none";

/** Next solar horizon or civil-twilight crossing kind. */
export type TwilightTransitionKind =
  | "sunrise"
  | "sunset"
  | "civil_dawn"
  | "civil_dusk";

/** Temporal relationship to a deadline. */
export type DeadlinePhase = "applying" | "exact" | "separating";

/** Overall consistency verdict from {@link verifyObservation}. */
export type ObservationVerdict =
  | "consistent"
  | "marginal"
  | "inconsistent"
  | "impossible"
  | "unconstrained";

/** Per-check classification inside {@link ObservationVerification.checks}. */
export type CheckStatus =
  | "consistent"
  | "marginal"
  | "inconsistent"
  | "impossible"
  | "indeterminate";

/** Solver path used by {@link geolocate}. */
export type GeolocateMethod = "analytical" | "grid";

/** Shape classification of a feasible geolocation region. */
export type GeolocateRegionKind = "point" | "arc" | "band";

/** Default measurement tolerances for physical observation constraints. */
export const DEFAULT_TOLERANCES = {
  shadowBearingDeg: 10.0,
  shadowLengthRatioRel: 0.15,
  shadowLengthRatioAbs: 0.08,
  sunAzimuthDeg: 8.0,
  sunAltitudeDeg: 5.0,
  moonAzimuthDeg: 10.0,
  moonAltitudeDeg: 6.0,
  moonIllum: 0.12,
  moonBrightLimbDeg: 18.0,
  shadowSweepDeg: 5.0,
} as const;

/** Apparent solar altitude intervals `[lo, hi]` (degrees) for each twilight key. */
export const TWILIGHT_BANDS: Readonly<Record<TwilightObservation, readonly [number, number]>> = {
  day: [0.0, 90.0],
  civil: [-6.0, 0.0],
  nautical: [-12.0, -6.0],
  astronomical: [-18.0, -12.0],
  night: [-90.0, -18.0],
  daylight: [-6.0, 90.0],
  dark: [-90.0, -6.0],
};

/** Optional parameters for {@link sceneGeometry}. */
export interface SceneGeometryOptions {
  elevationM?: number;
  slopeDeg?: number;
  slopeAzimuthDeg?: number;
  bortle?: number;
  cameraAimAzDeg?: number;
  cameraAimAltDeg?: number;
  prevJdUt?: number;
  deadlineJdUt?: number;
}

/** Solar horizontal geometry, atmospheric state, and local rates. */
export interface SunGeometry {
  azimuthDeg: number;
  compass16: string;
  altitudeTrueDeg: number;
  altitudeApparentDeg: number;
  airmass: number;
  extinctionMag: number;
  twilightStage: TwilightStage;
  isDay: boolean;
  trend: SunTrend;
  rateAltDegPerMin: number;
  rateAzDegPerMin: number;
  angularDiameterDeg: number;
}

/** Flat or sloped-ground 3D shadow geometry for a vertical unit pole. */
export interface ShadowGeometry {
  cast: boolean;
  selfShadowed: boolean;
  bearingDeg: number | null;
  compass16: string | null;
  lengthRatio: number | null;
  horizontalLengthRatio: number | null;
  rateBearingDegPerMin: number | null;
  rateLengthRatioPerMin: number | null;
  penumbraDeg: number | null;
  slopeDeg: number;
  slopeAzimuthDeg: number;
}

/** Camera-relative solar/shadow angles and glare risk. */
export interface CameraLighting {
  cameraAimAzDeg: number;
  cameraAimAltDeg: number;
  sunRelativeAzDeg: number;
  shadowScreenAzDeg: number | null;
  sunCameraAngleDeg: number;
  glareRisk: GlareRisk;
}

/** Lunar horizontal geometry, photometry, zenith-frame bright limb, and moonlight shadows. */
export interface MoonGeometry {
  visible: boolean;
  azimuthDeg: number;
  compass16: string;
  altitudeTrueDeg: number;
  altitudeApparentDeg: number;
  illum: number;
  phaseName: string;
  waxing: boolean;
  elongationDeg: number;
  magnitude: number;
  brightLimbZenithDeg: number | null;
  brightLimbClock: string | null;
  shadowCast: boolean;
  shadowBearingDeg: number | null;
  shadowLengthRatio: number | null;
}

/** A classical planet above the apparent horizon. */
export interface VisiblePlanet {
  id: string;
  azimuthDeg: number;
  compass16: string;
  altitudeApparentDeg: number;
  magnitude: number;
  nakedEye: boolean;
}

/** Local solar day boundaries, next twilight crossing, and planetary hour. */
export interface DiurnalCycle {
  sunriseJd: number | null;
  solarNoonJd: number | null;
  sunsetJd: number | null;
  minutesToNextTwilight: number | null;
  nextTransitionKind: TwilightTransitionKind | null;
  planetaryHour: PlanetaryHour | null;
}

/** Deadline proximity inside {@link Chronosense}. */
export interface ChronosenseDeadline {
  minutesRemaining: number;
  phase: DeadlinePhase;
}

/** Compact local spacetime awareness state for agent context injection. */
export interface Chronosense {
  moonLonDeg: number;
  ascDeg: number;
  nightCrossed: boolean;
  deadline: ChronosenseDeadline | null;
  line: string;
}

/** Full physical scene returned by {@link sceneGeometry}. */
export interface SceneGeometry {
  jdUt: number;
  lat: number;
  lonEast: number;
  elevationM: number;
  sun: SunGeometry;
  shadow: ShadowGeometry;
  lighting: CameraLighting | null;
  moon: MoonGeometry;
  visiblePlanets: VisiblePlanet[];
  diurnal: DiurnalCycle;
  chronosense: Chronosense;
}

/** Observer location and terrain metadata. */
export interface ObservationPlace {
  lat: number;
  lonEast: number;
  elevationM?: number;
  slopeDeg?: number;
  slopeAzimuthDeg?: number;
  bortle?: number;
}

/** Claimed spacetime point and optional uncertainties for {@link verifyObservation}. */
export interface ObservationClaim extends ObservationPlace {
  jdUt: number;
  timeToleranceMin?: number;
  placeToleranceDeg?: number;
  cameraAimAzDeg?: number;
  cameraAimAltDeg?: number;
  prevJdUt?: number;
  deadlineJdUt?: number;
}

/** Observed shadow angular sweep over a video/time-lapse interval. */
export interface ShadowSweepObservation {
  dtMinutes: number;
  deltaBearingDeg: number;
  toleranceDeg?: number;
}

/** Optional per-field tolerance overrides. */
export interface ObservationTolerances {
  shadowBearingDeg?: number;
  shadowLengthRatio?: number;
  shadowLengthRatioRel?: number;
  shadowLengthRatioAbs?: number;
  sunAzimuthDeg?: number;
  sunAltitudeDeg?: number;
  moonAzimuthDeg?: number;
  moonAltitudeDeg?: number;
  moonIllum?: number;
  moonBrightLimbDeg?: number;
  shadowSweepDeg?: number;
}

/** Any subset of physical observables to verify or invert. */
export interface ObservedConstraints {
  shadowBearingDeg?: number;
  shadowLengthRatio?: number;
  sunAzimuthDeg?: number;
  sunAltitudeDeg?: number;
  twilight?: TwilightObservation;
  sunVisible?: boolean;
  moonVisible?: boolean;
  moonAzimuthDeg?: number;
  moonAltitudeDeg?: number;
  moonIllum?: number;
  moonWaxing?: boolean;
  moonBrightLimbDeg?: number;
  bodiesVisible?: readonly string[];
  shadowSweep?: ShadowSweepObservation;
  tolerances?: ObservationTolerances;
}

/** Detailed per-constraint check result. */
export interface ObservationCheck {
  field: string;
  status: CheckStatus;
  observed: number | string | boolean | null;
  expected: number | string | boolean | null;
  residual: number | null;
  tolerance: number | null;
  normalizedResidual: number | null;
  note: string | null;
}

/** Same-day clock/timezone offset counterfactual diagnostic. */
export interface TimeShiftDiagnostic {
  jdUt: number;
  offsetMinutes: number;
  nearestWholeHourOffset: number;
  fitScore: number;
  verdict: ObservationVerdict;
}

/** Opposite-hemisphere latitude sign-flip counterfactual diagnostic. */
export interface HemisphereFlipDiagnostic {
  lat: number;
  lonEast: number;
  fitScore: number;
  verdict: ObservationVerdict;
}

/** Same-UTC-time seasonal date-shift counterfactual diagnostic. */
export interface DateShiftDiagnostic {
  jdUt: number;
  offsetDays: number;
  fitScore: number;
  verdict: ObservationVerdict;
}

/** Counterfactual forensics computed when a claim is inconsistent or impossible. */
export interface ObservationDiagnostics {
  timeShift: TimeShiftDiagnostic;
  hemisphereFlip: HemisphereFlipDiagnostic;
  dateShift: DateShiftDiagnostic | null;
  summary: string;
}

/** Full result returned by {@link verifyObservation}. */
export interface ObservationVerification {
  verdict: ObservationVerdict;
  consistencyScore: number | null;
  checks: ObservationCheck[];
  scene: SceneGeometry;
  diagnostics: ObservationDiagnostics | null;
}

/** Options for {@link chronolocate}. */
export interface ChronolocateOptions {
  stepMinutes?: number;
  maxWindows?: number;
}

/** Normalized place metadata echoed by {@link chronolocate}. */
export interface ChronolocatePlace {
  lat: number;
  lonEast: number;
  elevationM: number;
  slopeDeg: number;
  slopeAzimuthDeg: number;
}

/** One contiguous time window where all observations hold. */
export interface ChronolocateWindow {
  jdStart: number;
  jdEnd: number;
  bestJd: number;
  durationMinutes: number;
  fitScore: number;
  maxNormalizedResidual: number;
}

/** Result returned by {@link chronolocate}. */
export interface ChronolocateResult {
  place: ChronolocatePlace;
  jdStart: number;
  jdEnd: number;
  daysScanned: number;
  daysPruned: number;
  windows: ChronolocateWindow[];
  truncated: boolean;
}

/** Options for {@link geolocate}. */
export interface GeolocateOptions {
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
  gridStepDeg?: number;
  maxCandidates?: number;
  elevationM?: number;
  slopeDeg?: number;
  slopeAzimuthDeg?: number;
  bortle?: number;
}

/** Geographic point directly beneath a celestial body. */
export interface SubBodyPoint {
  lat: number;
  lon: number;
}

/** One feasible Earth location or region returned by {@link geolocate}. */
export interface GeolocateCandidate {
  lat: number;
  lon: number;
  fitScore: number;
  maxNormalizedResidual: number;
  radiusKm: number;
  latRange: [number, number];
  lonRange: [number, number];
  regionKind: GeolocateRegionKind;
}

/** Result returned by {@link geolocate}. */
export interface GeolocateResult {
  jdUt: number;
  method: GeolocateMethod;
  subsolar: SubBodyPoint;
  sublunar: SubBodyPoint;
  candidates: GeolocateCandidate[];
}

// ------------------------------------------------------------------ math utils

function clamp1(x: number): number {
  return x < -1.0 ? -1.0 : x > 1.0 ? 1.0 : x;
}

/** Signed angle in (-180, 180] degrees. */
function wrap180(x: number): number {
  const r = mod(x + 180.0, 360.0) - 180.0;
  return r === -180.0 ? 180.0 : r;
}

/** Signed angle in (-pi, pi] radians. */
function wrapPi(x: number): number {
  const r = mod(x + Math.PI, TWO_PI) - Math.PI;
  return r === -Math.PI ? Math.PI : r;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function compassOf(azDeg: number): string {
  return COMPASS16[Math.round(mod(azDeg, 360.0) / 22.5) % 16];
}

function clockOf(angleDeg: number): string {
  let h = mod(Math.round((90.0 - angleDeg) / 30.0), 12);
  if (h <= 0) h += 12;
  return `${h} o'clock`;
}

function moonPhaseName(illum: number, waxing: boolean): string {
  if (illum < 0.03) return "new moon";
  if (illum > 0.97) return "full moon";
  if (Math.abs(illum - 0.5) < 0.06) return waxing ? "first quarter" : "last quarter";
  if (illum < 0.5) return waxing ? "waxing crescent" : "waning crescent";
  return waxing ? "waxing gibbous" : "waning gibbous";
}

/** Standard barometric pressure (hPa) at elevationM; exact 1013.25 at 0. */
function pressureAtElevation(elevationM: number): number {
  if (elevationM === 0.0) return 1013.25;
  const h = Math.max(-500.0, Math.min(50000.0, elevationM));
  return 1013.25 * Math.exp(-h / 8434.5);
}

/** Deterministic fixed-decimal string matching Python _fmt_fixed / JS Math.round. */
function fmtFixed(x: number, decimals: number): string {
  const scale = 10 ** decimals;
  const n = Math.round(x * scale);
  if (n === 0) return decimals === 0 ? "0" : `0.${"0".repeat(decimals)}`;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (decimals === 0) return `${sign}${a}`;
  const whole = Math.floor(a / scale);
  const frac = a % scale;
  return `${sign}${whole}.${String(frac).padStart(decimals, "0")}`;
}

function fmtSignedFixed(x: number, decimals: number): string {
  const s = x.toFixed(decimals);
  if (s.startsWith("-")) return s;
  return `+${s}`;
}

function fmtSignedInt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function fmtPyFloat(x: number): string {
  return Number.isInteger(x) ? `${x}.0` : String(x);
}

/** Format UT Julian Day rounded to nearest minute as YYYY-MM-DDTHH:MMZ. */
function formatIsoMinute(jdUt: number): string {
  const cal = calendarDate(jdUt + 0.5 / 1440.0, "gregorian");
  const totalMin = Math.floor(cal.hour * 60.0 + 1e-9);
  const hh = Math.min(23, Math.floor(totalMin / 60));
  const mm = totalMin % 60;
  const yrStr = cal.year < 0
    ? `-${String(Math.abs(cal.year)).padStart(4, "0")}`
    : String(cal.year).padStart(4, "0");
  return `${yrStr}-${String(cal.month).padStart(2, "0")}-${String(cal.day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}Z`;
}

/** Great-circle distance on a sphere of radius EARTH_RADIUS_KM. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = wrap180(lon2 - lon1) * DEG;
  const s1 = Math.sin(dp * 0.5);
  const s2 = Math.sin(dl * 0.5);
  const a = s1 * s1 + Math.cos(p1) * Math.cos(p2) * s2 * s2;
  return 2.0 * EARTH_RADIUS_KM * Math.asin(Math.min(1.0, Math.sqrt(Math.max(0.0, a))));
}

function validatePlace(
  lat: number, lonEast: number, elevationM = 0.0, slopeDeg = 0.0, slopeAzimuthDeg = 0.0,
): void {
  if (!(Number.isFinite(lat) && lat >= -90.0 && lat <= 90.0)) {
    throw new RangeError(`lat must be finite in [-90, 90], got ${lat}`);
  }
  if (!Number.isFinite(lonEast)) {
    throw new RangeError(`lonEast must be finite, got ${lonEast}`);
  }
  if (!Number.isFinite(elevationM)) {
    throw new RangeError(`elevationM must be finite, got ${elevationM}`);
  }
  if (!(Number.isFinite(slopeDeg) && slopeDeg >= 0.0 && slopeDeg < 90.0)) {
    throw new RangeError(`slopeDeg must be in [0, 90), got ${slopeDeg}`);
  }
  if (!Number.isFinite(slopeAzimuthDeg)) {
    throw new RangeError(`slopeAzimuthDeg must be finite, got ${slopeAzimuthDeg}`);
  }
}

/** Equatorial (ra, dec rad) + local apparent sidereal time (rad) + lat (deg)
 *  to [azimuthDeg in [0, 360), trueAltitudeDeg in [-90, 90]]. */
function azAltFromEq(ra: number, dec: number, lst: number, latDeg: number): [number, number] {
  const ha = lst - ra;
  const phi = latDeg * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  const cosHa = Math.cos(ha);
  const sinAlt = clamp1(sinPhi * sinDec + cosPhi * cosDec * cosHa);
  const alt = Math.asin(sinAlt);
  const azS = Math.atan2(
    cosDec * Math.sin(ha),
    cosDec * cosHa * sinPhi - sinDec * cosPhi,
  );
  return [mod(azS / DEG + 180.0, 360.0), alt / DEG];
}

function eqUnit(ra: number, dec: number): Vec3 {
  const cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

function raDecFromUnit(v: Vec3): [number, number] {
  const n = norm(v);
  if (n < 1e-15) return [0.0, 0.0];
  const x = v[0] / n;
  const y = v[1] / n;
  const z = v[2] / n;
  return [mod(Math.atan2(y, x), TWO_PI), Math.asin(clamp1(z))];
}

/** Upward unit normal of terrain tilted by slopeDeg toward downhill azimuth
 *  slopeAzimuthDeg (local horizontal frame: x east, y north, z up). */
function slopeNormal(slopeDeg: number, slopeAzimuthDeg: number): Vec3 {
  if (slopeDeg === 0.0) return [0.0, 0.0, 1.0];
  const sig = slopeDeg * DEG;
  const alp = slopeAzimuthDeg * DEG;
  const ss = Math.sin(sig);
  return [ss * Math.sin(alp), ss * Math.cos(alp), Math.cos(sig)];
}

/** Exact 3D ray-plane shadow of a vertical unit pole P=(0,0,1) along -s
 *  onto flat or sloped ground with upward normal n. */
function computeShadow(
  azDeg: number,
  altAppDeg: number,
  slopeDeg: number,
  slopeAzimuthDeg: number,
  rateAz: number | null = null,
  rateAlt: number | null = null,
  penumbraDeg: number | null = null,
): ShadowGeometry {
  const slopeAzNorm = slopeDeg > 0.0 ? mod(slopeAzimuthDeg, 360.0) : 0.0;
  if (altAppDeg <= 0.0) {
    return {
      cast: false,
      selfShadowed: false,
      bearingDeg: null,
      compass16: null,
      lengthRatio: null,
      horizontalLengthRatio: null,
      rateBearingDegPerMin: null,
      rateLengthRatioPerMin: null,
      penumbraDeg: null,
      slopeDeg,
      slopeAzimuthDeg: slopeAzNorm,
    };
  }

  const s = dirFromAzAlt(azDeg, altAppDeg);
  const n = slopeNormal(slopeDeg, slopeAzimuthDeg);
  const nDotS = dot(n, s);

  if (nDotS <= 0.0) {
    return {
      cast: false,
      selfShadowed: true,
      bearingDeg: null,
      compass16: null,
      lengthRatio: null,
      horizontalLengthRatio: null,
      rateBearingDegPerMin: null,
      rateLengthRatioPerMin: null,
      penumbraDeg: null,
      slopeDeg,
      slopeAzimuthDeg: slopeAzNorm,
    };
  }

  const bearing = mod(azDeg + 180.0, 360.0);
  const comp = compassOf(bearing);

  // Check grazing angle to ground plane (matches altApp < 0.05 deg on flat ground).
  if (nDotS < GRAZING_SIN || altAppDeg < GRAZING_ALT_DEG) {
    return {
      cast: true,
      selfShadowed: false,
      bearingDeg: bearing,
      compass16: comp,
      lengthRatio: null,
      horizontalLengthRatio: null,
      rateBearingDegPerMin: rateAz,
      rateLengthRatioPerMin: null,
      penumbraDeg,
      slopeDeg,
      slopeAzimuthDeg: slopeAzNorm,
    };
  }

  const t = n[2] / nDotS;
  const q: Vec3 = [-t * s[0], -t * s[1], 1.0 - t * s[2]];
  const lengthRatio = norm(q);
  const horizRatio = Math.hypot(q[0], q[1]);

  // Analytical d(||Q||)/dt from (rateAz, rateAlt) in deg/min.
  let rateLen: number | null = null;
  if (rateAz !== null && rateAlt !== null) {
    if (lengthRatio < 1e-9) {
      rateLen = 0.0;
    } else {
      const aR = azDeg * DEG;
      const hR = altAppDeg * DEG;
      const da = rateAz * DEG;
      const dh = rateAlt * DEG;
      const ca = Math.cos(aR);
      const sa = Math.sin(aR);
      const ch = Math.cos(hR);
      const sh = Math.sin(hR);
      const sDot: Vec3 = [
        da * ch * ca - dh * sh * sa,
        -da * ch * sa - dh * sh * ca,
        dh * ch,
      ];
      const tDot = -t * dot(n, sDot) / nDotS;
      const qDot: Vec3 = [
        -tDot * s[0] - t * sDot[0],
        -tDot * s[1] - t * sDot[1],
        -tDot * s[2] - t * sDot[2],
      ];
      rateLen = dot(q, qDot) / lengthRatio;
    }
  }

  return {
    cast: true,
    selfShadowed: false,
    bearingDeg: bearing,
    compass16: comp,
    lengthRatio,
    horizontalLengthRatio: horizRatio,
    rateBearingDegPerMin: rateAz,
    rateLengthRatioPerMin: rateLen,
    penumbraDeg,
    slopeDeg,
    slopeAzimuthDeg: slopeAzNorm,
  };
}

/** Lens-independent zenith-frame bright-limb angle (deg in [0, 360)) and
 *  clock string in the Moon's own local tangent basis:
 *    e_M = (cos A_M, -sin A_M, 0)   (0 deg = right/east)
 *    u_M = e_M x M                  (90 deg = straight up/zenith)
 *  Returns [null, null] at exact syzygy. */
function moonBrightLimb(
  moonAz: number, moonAltTrue: number, sunAz: number, sunAltTrue: number,
): [number | null, string | null] {
  const M = dirFromAzAlt(moonAz, moonAltTrue);
  const S = dirFromAzAlt(sunAz, sunAltTrue);
  const sDotM = dot(S, M);
  const t: Vec3 = [S[0] - sDotM * M[0], S[1] - sDotM * M[1], S[2] - sDotM * M[2]];
  if (norm(t) < 1e-12) return [null, null];
  const aR = moonAz * DEG;
  const eM: Vec3 = [Math.cos(aR), -Math.sin(aR), 0.0];
  const uM = cross(eM, M);
  const angle = mod(Math.atan2(dot(t, uM), dot(t, eM)) / DEG, 360.0);
  return [angle, clockOf(angle)];
}

/** Camera-relative solar azimuth, shadow direction, and glare risk. */
function computeLighting(
  sunAz: number, sunAltApp: number, shadow: ShadowGeometry, camAz: number, camAlt: number,
): CameraLighting {
  const camAzN = mod(camAz, 360.0);
  const sunRel = wrap180(sunAz - camAzN);
  const shdRel = shadow.cast && shadow.bearingDeg !== null
    ? wrap180(shadow.bearingDeg - camAzN)
    : null;
  const camV = dirFromAzAlt(camAzN, camAlt);
  const sunV = dirFromAzAlt(sunAz, sunAltApp);
  const sep = Math.acos(clamp1(dot(camV, sunV))) / DEG;
  let risk: GlareRisk;
  if (sunAltApp <= 0.0) risk = "none";
  else if (sep <= 15.0) risk = "direct";
  else if (sep <= 35.0) risk = "high";
  else if (sep <= 65.0) risk = "moderate";
  else risk = "none";
  return {
    cameraAimAzDeg: camAzN,
    cameraAimAltDeg: camAlt,
    sunRelativeAzDeg: sunRel,
    shadowScreenAzDeg: shdRel,
    sunCameraAngleDeg: sep,
    glareRisk: risk,
  };
}

const KM_PER_AU = 149597870.7;
const R0_ARCMIN = 34.076;
const CHALDEAN_ORDER = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"] as const;
const WEEKDAY_RULERS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"] as const;

interface SunDaySpline {
  t0: number;
  t1: number;
  eval(t: number): [number, number, number, number, number]; // [lonRad, latRad, distAu, epsRad, gastRad]
}

/** Piecewise-quadratic 7-knot Sun spline over [t0, t1] (~3.4 d) so diurnal
 *  rise/set/transit/twilight/planetary-hour brackets run in pure trig before
 *  exact secant polishing against the full ephemeris. */
function buildSunDaySpline(engine: Engine, t0: number, t1: number): SunDaySpline {
  const nPanels = 4;
  const nKnots = nPanels * 2 + 1; // 9 knots (~0.45 d spacing -> <1e-6 deg error)
  const span = t1 - t0;
  const lons = new Array<number>(nKnots);
  const lats = new Array<number>(nKnots);
  const dists = new Array<number>(nKnots);
  const epss = new Array<number>(nKnots);
  const g0 = gast(engine.data, t0);
  const g1 = gast(engine.data, t1);
  const gExpected = g0 + span * TWO_PI * 1.002737909350795;
  const gRate = (gExpected + wrapPi(g1 - gExpected) - g0) / span;

  for (let k = 0; k < nKnots; k++) {
    const tk = t0 + (k / (nKnots - 1)) * span;
    const jde = jdTT(tk);
    const [lon, lat, dist] = engine.ecliptic("sun", jde);
    lons[k] = k === 0 ? lon : lons[k - 1] + wrapPi(lon - lons[k - 1]);
    lats[k] = lat;
    dists[k] = dist ?? 1.0;
    epss[k] = trueObliquity(engine.data, jde);
  }

  const quad = (a: number, b: number, c: number, s: number): number =>
    (1.0 - s) * (1.0 - 2.0 * s) * a + 4.0 * s * (1.0 - s) * b + s * (2.0 * s - 1.0) * c;

  return {
    t0,
    t1,
    eval(t: number): [number, number, number, number, number] {
      const u = ((t - t0) / span) * nPanels;
      const p = Math.max(0, Math.min(nPanels - 1, Math.floor(u)));
      const s = u - p;
      const idx = p * 2;
      const lon = mod(quad(lons[idx], lons[idx + 1], lons[idx + 2], s), TWO_PI);
      const lat = quad(lats[idx], lats[idx + 1], lats[idx + 2], s);
      const dist = quad(dists[idx], dists[idx + 1], dists[idx + 2], s);
      const eps = quad(epss[idx], epss[idx + 1], epss[idx + 2], s);
      const g = mod(g0 + (t - t0) * gRate, TWO_PI);
      return [lon, lat, dist, eps, g];
    },
  };
}

/** Illinois regula-falsi root polish on a tight bracket [loIn, hiIn]. */
function polishRoot(
  f: (t: number) => number,
  loIn: number,
  hiIn: number,
  tol = 2e-9,
  fTol = 1e-9,
): number | null {
  let lo = loIn;
  let hi = hiIn;
  let flo = f(lo);
  let fhi = f(hi);
  if (flo === 0.0) return lo;
  if (fhi === 0.0) return hi;
  if ((flo < 0.0) === (fhi < 0.0)) return null;
  let floScaled = flo;
  let fhiScaled = fhi;
  let side = 0;
  for (let it = 0; it < 12; it++) {
    if (hi - lo <= tol) break;
    let mid = lo - (floScaled * (hi - lo)) / (fhiScaled - floScaled);
    if (!(mid > lo && mid < hi)) mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (Math.abs(fm) < fTol) return mid;
    if ((flo < 0.0) === (fm < 0.0)) {
      lo = mid;
      flo = fm;
      floScaled = fm;
      if (side === -1) fhiScaled *= 0.5;
      side = -1;
    } else {
      hi = mid;
      fhi = fm;
      fhiScaled = fm;
      if (side === 1) floScaled *= 0.5;
      side = 1;
    }
  }
  return Math.abs(flo) <= Math.abs(fhi) ? lo : hi;
}

/** Fast exact solar rise/set/mtransit using the precomputed Sun spline for
 *  coarse bracketing and exact topocentric secant polishing, falling back to
 *  `riseSet` on polar grazing or out-of-span brackets. */
function fastSunRiseSet(
  spline: SunDaySpline,
  engine: Engine,
  jdStart: number,
  latDeg: number,
  lonEast: number,
  kind: "rise" | "set" | "mtransit",
  altM: number,
  pressure: number,
  searchDays: number,
): number | null {
  if (jdStart < spline.t0 - 1e-9 || jdStart + searchDays > spline.t1 + 1e-9) {
    return riseSet(engine, "sun", jdStart, latDeg, lonEast, kind, { altM, pressure, searchDays });
  }
  const phi = latDeg * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const scale = (pressure / 1010.0) * (283.0 / 288.0);
  const refTerm = (R0_ARCMIN / 60.0) * scale * DEG;

  const splineEval = (t: number): number => {
    let [lon, lat, dist, eps, g] = spline.eval(t);
    const lst = mod(g + lonEast * DEG, TWO_PI);
    [lon, lat, dist] = topocentricEcl(lon, lat, dist, lst, phi, altM, eps);
    const [ra, dec] = equatorial(lon, lat, eps);
    const ha = mod(lst - ra + Math.PI, TWO_PI) - Math.PI;
    if (kind === "mtransit") return ha;
    const alt = Math.asin(clamp1(sinPhi * Math.sin(dec) + cosPhi * Math.cos(dec) * Math.cos(ha)));
    const sd = Math.asin(DIAMETER_KM.sun / (2.0 * dist * KM_PER_AU));
    return alt + refTerm + sd;
  };

  const exactEval = (t: number): number => {
    const jde = jdTT(t);
    let [lon, lat, dist] = engine.ecliptic("sun", jde);
    const eps = trueObliquity(engine.data, jde);
    const lst = mod(gast(engine.data, t) + lonEast * DEG, TWO_PI);
    if (dist !== null) {
      [lon, lat, dist] = topocentricEcl(lon, lat, dist, lst, phi, altM, eps);
    }
    const [ra, dec] = equatorial(lon, lat, eps);
    const ha = mod(lst - ra + Math.PI, TWO_PI) - Math.PI;
    if (kind === "mtransit") return ha;
    const alt = Math.asin(clamp1(sinPhi * Math.sin(dec) + cosPhi * Math.cos(dec) * Math.cos(ha)));
    const sd = dist !== null ? Math.asin(DIAMETER_KM.sun / (2.0 * dist * KM_PER_AU)) : 0.0;
    return alt + refTerm + sd;
  };

  const step = 1.0 / 48.0;
  let prev = splineEval(jdStart);
  let minAbs = Math.abs(prev);
  for (let t = jdStart + step; t <= jdStart + searchDays; t += step) {
    const cur = splineEval(t);
    if (Math.abs(cur) < minAbs) minAbs = Math.abs(cur);
    const crossed = kind === "mtransit"
      ? (prev * cur < 0.0 && Math.abs(cur - prev) < Math.PI)
      : kind === "rise"
        ? (prev < 0.0 && cur >= 0.0)
        : (prev > 0.0 && cur <= 0.0);
    if (crossed) {
      let lo = t - step;
      let hi = t;
      let flo = prev;
      for (let it = 0; it < 12; it++) {
        const mid = 0.5 * (lo + hi);
        const fm = splineEval(mid);
        if (flo * fm <= 0.0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fm;
        }
      }
      const pLo = Math.max(t - step, lo - 1e-4);
      const pHi = Math.min(t, hi + 1e-4);
      const root = polishRoot(exactEval, pLo, pHi);
      if (root !== null) return root;
      return riseSet(engine, "sun", jdStart, latDeg, lonEast, kind, { altM, pressure, searchDays });
    }
    prev = cur;
  }

  // Near-grazing polar horizon: verify with exact riseSet so no subtle crossing is missed.
  if (kind !== "mtransit" && minAbs < 0.005) {
    return riseSet(engine, "sun", jdStart, latDeg, lonEast, kind, { altM, pressure, searchDays });
  }
  return null;
}

/** Fast exact planetary hour matching electional.planetaryHour, reusing the
 *  precomputed Sun spline and sea-level sunrise/sunset when available. */
function fastPlanetaryHour(
  spline: SunDaySpline,
  engine: Engine,
  jdUt: number,
  lat: number,
  lonEast: number,
  seaSunrise: number | null,
  seaSunset: number | null,
): PlanetaryHour | null {
  let dayStart: number | null = null;
  let dayEnd: number | null = null;
  let nightEnd: number | null = null;

  if (seaSunrise !== null && seaSunset !== null && seaSunrise <= jdUt && seaSunset > seaSunrise) {
    dayStart = seaSunrise;
    dayEnd = seaSunset;
    nightEnd = fastSunRiseSet(spline, engine, dayEnd + 0.01, lat, lonEast, "rise", 0.0, 1013.25, 2.0);
    if (nightEnd !== null && jdUt >= nightEnd) {
      // Past nightEnd (rare edge near sunrise): fall back to full planetaryHour.
      return planetaryHour(engine, jdUt, lat, lonEast);
    }
  } else {
    let sr = fastSunRiseSet(spline, engine, jdUt - 1.0, lat, lonEast, "rise", 0.0, 1013.25, 2.0);
    if (sr === null) return null;
    let nxt = fastSunRiseSet(spline, engine, sr + 0.01, lat, lonEast, "rise", 0.0, 1013.25, 2.0);
    while (nxt !== null && nxt <= jdUt) {
      sr = nxt;
      nxt = fastSunRiseSet(spline, engine, sr + 0.01, lat, lonEast, "rise", 0.0, 1013.25, 2.0);
    }
    if (sr > jdUt) return null;
    dayStart = sr;
    dayEnd = fastSunRiseSet(spline, engine, dayStart + 0.01, lat, lonEast, "set", 0.0, 1013.25, 2.0);
    if (dayEnd === null) return null;
    nightEnd = nxt !== null && nxt > dayEnd
      ? nxt
      : fastSunRiseSet(spline, engine, dayEnd + 0.01, lat, lonEast, "rise", 0.0, 1013.25, 2.0);
  }

  if (dayStart === null || dayEnd === null || nightEnd === null) return null;

  let span: number;
  let kind: "day" | "night";
  let hourNumber: number;
  let start: number;
  if (jdUt < dayEnd) {
    span = (dayEnd - dayStart) / 12.0;
    const idx = Math.min(Math.floor((jdUt - dayStart) / span), 11);
    kind = "day";
    hourNumber = idx;
    start = dayStart + idx * span;
  } else {
    span = (nightEnd - dayEnd) / 12.0;
    const idx = Math.min(Math.floor((jdUt - dayEnd) / span), 11);
    kind = "night";
    hourNumber = 12 + idx;
    start = dayEnd + idx * span;
  }

  const weekday = mod(Math.floor(dayStart + 1.5), 7);
  const dayRuler = WEEKDAY_RULERS[weekday];
  const ruler = CHALDEAN_ORDER[(CHALDEAN_ORDER.indexOf(dayRuler) + hourNumber) % 7];
  return { ruler, kind, hour: hourNumber + 1, dayRuler, start, end: start + span };
}

/** Find the earliest crossing of sunAltApp=0 (sunrise/sunset) or
 *  sunAltTrue=-6 (civil_dawn/civil_dusk) within the next 1.05 days.
 *  Returns [minutesToNext, kind] or [null, null] in polar day/night. */
function nextTwilightTransition(
  spline: SunDaySpline, engine: Engine, jdUt: number, lat: number, lonEast: number, pressure: number,
): [number | null, TwilightTransitionKind | null] {
  let loH = -1.5;
  let hiH = 0.0;
  for (let i = 0; i < 32; i++) {
    const midH = 0.5 * (loH + hiH);
    if (refractTrueToApparent(midH, pressure) > 0.0) hiH = midH;
    else loH = midH;
  }
  const hRise = hiH;
  const thresholds: ReadonlyArray<readonly [number, TwilightTransitionKind, TwilightTransitionKind]> = [
    [hRise, "sunrise", "sunset"],
    [-6.0, "civil_dawn", "civil_dusk"],
  ];

  const span = 1.05;
  const approxAlt = (t: number): number => {
    const [lon, sLat, , eps, g] = spline.eval(t);
    const [ra, dec] = equatorial(lon, sLat, eps);
    const lst = mod(g + lonEast * DEG, TWO_PI);
    return azAltFromEq(ra, dec, lst, lat)[1];
  };

  const exactAlt = (t: number): number => {
    const jdeT = jdTT(t);
    const [lonR, latR] = engine.ecliptic("sun", jdeT);
    const epsT = trueObliquity(engine.data, jdeT);
    const [raT, decT] = equatorial(lonR, latR, epsT);
    const lstT = mod(gast(engine.data, t) + lonEast * DEG, TWO_PI);
    return azAltFromEq(raT, decT, lstT, lat)[1];
  };

  const step = 15.0 / 1440.0;
  const nSteps = Math.ceil(span / step);
  let tPrev = jdUt;
  let aPrev = approxAlt(tPrev);

  let bestT: number | null = null;
  let bestKind: TwilightTransitionKind | null = null;
  for (let i = 1; i <= nSteps; i++) {
    const tCur = Math.min(jdUt + span, jdUt + i * step);
    const aCur = approxAlt(tCur);
    for (const [thresh, upKind, dnKind] of thresholds) {
      const d0 = aPrev - thresh;
      const d1 = aCur - thresh;
      if ((d0 <= 0.0 && d1 > 0.0) || (d0 >= 0.0 && d1 < 0.0)) {
        const kind = d1 > d0 ? upKind : dnKind;
        let lo = tPrev;
        let hi = tCur;
        let floA = d0;
        for (let it = 0; it < 10; it++) {
          const mid = 0.5 * (lo + hi);
          const fmA = approxAlt(mid) - thresh;
          if ((floA <= 0.0 && fmA <= 0.0) || (floA >= 0.0 && fmA >= 0.0)) {
            lo = mid;
            floA = fmA;
          } else {
            hi = mid;
          }
        }
        const pLo = Math.max(jdUt, lo - 1e-4);
        const pHi = Math.min(jdUt + span, hi + 1e-4);
        const root = polishRoot((t) => exactAlt(t) - thresh, pLo, pHi, 2e-9, 1e-7);
        if (root !== null && root > jdUt && (bestT === null || root < bestT)) {
          bestT = root;
          bestKind = kind;
        }
      }
    }
    if (bestT !== null) break;
    tPrev = tCur;
    aPrev = aCur;
  }

  if (bestT === null) return [null, null];
  return [(bestT - jdUt) * 1440.0, bestKind];
}

/** True iff a local solar midnight (Sun hour angle crossing pi) occurred in
 *  (prevJdUt, jdUt]. Works at all latitudes including polar regions. */
function nightCrossedCheck(
  engine: Engine, prevJdUt: number | undefined, jdUt: number, lonEast: number,
): boolean {
  if (prevJdUt === undefined || prevJdUt >= jdUt) return false;
  if (jdUt - prevJdUt >= 1.0) return true;

  const sunMidnightPhase = (t: number): number => {
    const jde = jdTT(t);
    const [lonR, latR] = engine.ecliptic("sun", jde);
    const [ra] = equatorial(lonR, latR, trueObliquity(engine.data, jde));
    const lst = mod(gast(engine.data, t) + lonEast * DEG, TWO_PI);
    const ha = mod(lst - ra, TWO_PI);
    return mod(ha - Math.PI, TWO_PI);
  };

  return sunMidnightPhase(jdUt) < sunMidnightPhase(prevJdUt);
}

/** Compact ~35-token single-line spacetime header for agent injection. */
function buildChronosenseLine(
  jdUt: number,
  lat: number,
  lonEast: number,
  sun: SunGeometry,
  shadow: ShadowGeometry,
  moon: MoonGeometry,
  diurnal: DiurnalCycle,
  nightCrossed: boolean,
  deadline: ChronosenseDeadline | null,
): string {
  const ts = formatIsoMinute(jdUt);
  const latS = fmtFixed(lat, 2);
  const lonS = fmtFixed(lonEast, 2);
  const sunAltS = fmtFixed(sun.altitudeApparentDeg, 1);
  let shdS: string;
  if (shadow.cast && shadow.lengthRatio !== null) {
    shdS = `shd ${fmtFixed(shadow.lengthRatio, 2)}x ${shadow.compass16}`;
  } else if (shadow.selfShadowed) {
    shdS = "shd self-shadowed";
  } else if (shadow.cast) {
    shdS = `shd grazing ${shadow.compass16}`;
  } else {
    shdS = "shd none";
  }
  const mPct = Math.round(moon.illum * 100.0);
  const mDir = moon.waxing ? "wax" : "wan";
  const mAlt = moon.altitudeApparentDeg;
  const mSign = mAlt >= 0.0 ? "+" : "";
  const mAltS = `${mSign}${fmtFixed(mAlt, 1)}`;
  const nxtS = diurnal.nextTransitionKind !== null && diurnal.minutesToNextTwilight !== null
    ? `next ${diurnal.nextTransitionKind} ${Math.round(diurnal.minutesToNextTwilight)}m`
    : "polar";
  const parts = [
    `${ts} @${latS},${lonS}`,
    `${sun.twilightStage} Sun ${sunAltS}deg ${sun.compass16} ${sun.trend}`,
    shdS,
    `Moon ${mPct}% ${mDir} ${mAltS}deg`,
    nxtS,
  ];
  if (deadline !== null) {
    const rem = Math.round(deadline.minutesRemaining);
    const dSign = rem > 0 ? "+" : "";
    parts.push(`due ${dSign}${rem}m ${deadline.phase}`);
  }
  if (nightCrossed) {
    parts.push("+night");
  }
  return parts.join(" | ");
}

// ------------------------------------------------------------- sceneGeometry

interface BaseSnapData {
  gast: number;
  eps: number;
  sunRa: number;
  sunDec: number;
  sunLon: number;
  moon: MoonSnapshot;
}

function sceneGeometryCore(
  engine: Engine,
  jdUt: number,
  lat: number,
  lonEast: number,
  opts: SceneGeometryOptions = {},
): { scene: SceneGeometry; baseSnap: BaseSnapData } {
  const elevationM = opts.elevationM ?? 0.0;
  const slopeDeg = opts.slopeDeg ?? 0.0;
  const slopeAzimuthDeg = opts.slopeAzimuthDeg ?? 0.0;
  const bortle = opts.bortle;
  const cameraAimAzDeg = opts.cameraAimAzDeg;
  const cameraAimAltDeg = opts.cameraAimAltDeg ?? 0.0;
  const prevJdUt = opts.prevJdUt;
  const deadlineJdUt = opts.deadlineJdUt;

  validatePlace(lat, lonEast, elevationM, slopeDeg, slopeAzimuthDeg);
  const pressure = pressureAtElevation(elevationM);

  const jde = jdTT(jdUt);
  const eps = trueObliquity(engine.data, jde);
  const g = gast(engine.data, jdUt);
  const lst = mod(g + lonEast * DEG, TWO_PI);

  // Sun and +/-1 min finite-difference rates
  const [sunLonR, sunLatR, sunDist] = engine.ecliptic("sun", jde);
  const sunLonDeg = mod(sunLonR / DEG, 360.0);
  const sunLatDeg = sunLatR / DEG;
  const [sunRa, sunDec] = equatorial(sunLonR, sunLatR, eps);
  const [sunAz, sunAltTrue] = azAlt(engine.data, sunLonDeg, sunLatDeg, jdUt, lat, lonEast);
  const sunAltApp = refractTrueToApparent(sunAltTrue, pressure);

  const jdeM = jdTT(jdUt - DT_MIN);
  const jdeP = jdTT(jdUt + DT_MIN);
  const [sunLonM, sunLatM] = engine.ecliptic("sun", jdeM);
  const [sunLonP, sunLatP] = engine.ecliptic("sun", jdeP);
  const [raM, decM] = equatorial(sunLonM, sunLatM, trueObliquity(engine.data, jdeM));
  const [raP, decP] = equatorial(sunLonP, sunLatP, trueObliquity(engine.data, jdeP));
  const [azM, altM] = azAltFromEq(raM, decM, mod(gast(engine.data, jdUt - DT_MIN) + lonEast * DEG, TWO_PI), lat);
  const [azP, altP] = azAltFromEq(raP, decP, mod(gast(engine.data, jdUt + DT_MIN) + lonEast * DEG, TWO_PI), lat);
  const rateAlt = (altP - altM) * 0.5;
  const rateAz = wrap180(azP - azM) * 0.5;

  let trend: SunTrend;
  if (Math.abs(rateAlt) < 0.005) {
    trend = sunAltApp > 0.0 ? "culminating" : "nadir";
  } else if (rateAlt > 0.0) {
    trend = "rising";
  } else {
    trend = "setting";
  }

  const sunDiam = (2.0 * Math.asin(DIAMETER_KM.sun / (2.0 * sunDist! * KM_PER_AU))) / DEG;
  const sunStage = twilightStage(sunAltApp);
  const sun: SunGeometry = {
    azimuthDeg: sunAz,
    compass16: compassOf(sunAz),
    altitudeTrueDeg: sunAltTrue,
    altitudeApparentDeg: sunAltApp,
    airmass: airmass(sunAltApp),
    extinctionMag: extinctionMag(sunAltApp),
    twilightStage: sunStage,
    isDay: sunAltApp > 0.0,
    trend,
    rateAltDegPerMin: rateAlt,
    rateAzDegPerMin: rateAz,
    angularDiameterDeg: sunDiam,
  };

  // Solar shadow (flat or sloped)
  const shadow = computeShadow(
    sunAz, sunAltApp, slopeDeg, slopeAzimuthDeg, rateAz, rateAlt, sunDiam,
  );

  // Optional camera lighting
  const lighting = cameraAimAzDeg !== undefined
    ? computeLighting(sunAz, sunAltApp, shadow, cameraAimAzDeg, cameraAimAltDeg)
    : null;

  // Moon
  const [moonLonR, moonLatR] = engine.ecliptic("moon", jde);
  const moonLonDeg = mod(moonLonR / DEG, 360.0);
  const [moonRa, moonDec] = equatorial(moonLonR, moonLatR, eps);
  const [moonAz, moonAltTrue] = azAltFromEq(moonRa, moonDec, lst, lat);
  const moonAltApp = refractTrueToApparent(moonAltTrue, pressure);
  const moonPh = pheno(engine, "moon", jdUt);
  const moonIllum = moonPh.phase;
  const moonWaxing = mod(moonLonDeg - sunLonDeg, 360.0) < 180.0;
  const moonVisible = moonAltApp > 0.0;
  const [blDeg, blClock] = moonBrightLimb(moonAz, moonAltTrue, sunAz, sunAltTrue);

  let moonShdCast = false;
  let moonShdBearing: number | null = null;
  let moonShdLength: number | null = null;
  if (sunAltApp < -6.0 && moonVisible && moonIllum >= 0.5) {
    const mShd = computeShadow(moonAz, moonAltApp, slopeDeg, slopeAzimuthDeg);
    if (mShd.cast) {
      moonShdCast = true;
      moonShdBearing = mShd.bearingDeg;
      moonShdLength = mShd.lengthRatio;
    }
  }

  const moon: MoonGeometry = {
    visible: moonVisible,
    azimuthDeg: moonAz,
    compass16: compassOf(moonAz),
    altitudeTrueDeg: moonAltTrue,
    altitudeApparentDeg: moonAltApp,
    illum: moonIllum,
    phaseName: moonPhaseName(moonIllum, moonWaxing),
    waxing: moonWaxing,
    elongationDeg: moonPh.elongation,
    magnitude: moonPh.magnitude,
    brightLimbZenithDeg: blDeg,
    brightLimbClock: blClock,
    shadowCast: moonShdCast,
    shadowBearingDeg: moonShdBearing,
    shadowLengthRatio: moonShdLength,
  };

  // Visible naked-eye planets
  const lim = limitingMag(sunStage, moonAltTrue > 0.0 ? moonAltTrue : null, moonIllum, bortle);
  const visiblePlanets: VisiblePlanet[] = [];
  for (const bid of VISIBLE_PLANETS) {
    const [pLonR, pLatR] = engine.ecliptic(bid, jde);
    const [pRa, pDec] = equatorial(pLonR, pLatR, eps);
    const [pAz, pAltTrue] = azAltFromEq(pRa, pDec, lst, lat);
    const pAltApp = refractTrueToApparent(pAltTrue, pressure);
    if (pAltApp > 0.0) {
      const pMag = pheno(engine, bid, jdUt).magnitude;
      visiblePlanets.push({
        id: bid,
        azimuthDeg: pAz,
        compass16: compassOf(pAz),
        altitudeApparentDeg: pAltApp,
        magnitude: pMag,
        nakedEye: pMag <= lim,
      });
    }
  }

  // Diurnal cycle (nearest local solar day)
  const localDayIdx = Math.floor(jdUt + lonEast / 360.0 + 0.5);
  const dayStart = localDayIdx - 0.5 - lonEast / 360.0;
  const spline = buildSunDaySpline(
    engine,
    Math.min(dayStart, jdUt - 1.15),
    Math.max(dayStart + 1.65, jdUt + 2.65),
  );
  let solarNoonJd = fastSunRiseSet(
    spline, engine, dayStart, lat, lonEast, "mtransit", elevationM, pressure, 1.05,
  );
  if (solarNoonJd !== null && solarNoonJd > dayStart + 1.05) {
    solarNoonJd = null;
  }

  let sunriseJd: number | null = null;
  let sunsetJd: number | null = null;
  if (solarNoonJd !== null) {
    const sr = fastSunRiseSet(
      spline, engine, solarNoonJd - 0.55, lat, lonEast, "rise", elevationM, pressure, 0.6,
    );
    if (sr !== null && sr <= solarNoonJd + 1e-6) sunriseJd = sr;
    const ss = fastSunRiseSet(
      spline, engine, solarNoonJd - 0.02, lat, lonEast, "set", elevationM, pressure, 0.6,
    );
    if (ss !== null && ss >= solarNoonJd - 1e-6) sunsetJd = ss;
  }

  const [minsTwi, kindTwi] = nextTwilightTransition(spline, engine, jdUt, lat, lonEast, pressure);
  const phour = fastPlanetaryHour(
    spline, engine, jdUt, lat, lonEast,
    elevationM === 0.0 ? sunriseJd : null,
    elevationM === 0.0 ? sunsetJd : null,
  );

  const diurnal: DiurnalCycle = {
    sunriseJd,
    solarNoonJd,
    sunsetJd,
    minutesToNextTwilight: minsTwi,
    nextTransitionKind: kindTwi,
    planetaryHour: phour,
  };

  // Chronosense
  const [ascRad] = houseAngles(engine.data, jdUt, lat, lonEast);
  const ascDeg = mod(ascRad / DEG, 360.0);
  const nc = nightCrossedCheck(engine, prevJdUt, jdUt, lonEast);
  let deadlineObj: ChronosenseDeadline | null = null;
  if (deadlineJdUt !== undefined) {
    const remMin = (deadlineJdUt - jdUt) * 1440.0;
    let dPhase: DeadlinePhase;
    if (Math.abs(remMin) <= 1.0) dPhase = "exact";
    else if (remMin > 1.0) dPhase = "applying";
    else dPhase = "separating";
    deadlineObj = { minutesRemaining: remMin, phase: dPhase };
  }
  const line = buildChronosenseLine(
    jdUt, lat, lonEast, sun, shadow, moon, diurnal, nc, deadlineObj,
  );
  const chronosense: Chronosense = {
    moonLonDeg,
    ascDeg,
    nightCrossed: nc,
    deadline: deadlineObj,
    line,
  };

  return {
    scene: {
      jdUt,
      lat,
      lonEast,
      elevationM,
      sun,
      shadow,
      lighting,
      moon,
      visiblePlanets,
      diurnal,
      chronosense,
    },
    baseSnap: {
      gast: g,
      eps,
      sunRa,
      sunDec,
      sunLon: sunLonDeg,
      moon: {
        ra: moonRa,
        dec: moonDec,
        lon: moonLonDeg,
        illum: moonIllum,
        waxing: moonWaxing,
        mag: moonPh.magnitude,
      },
    },
  };
}

/**
 * Compute the full forward physical spacetime scene at `(jdUt, lat, lonEast)`:
 * apparent solar and lunar coordinates with barometric refraction, flat or
 * sloped 3D shadow casting and sweep rates, optional camera lighting and glare,
 * zenith-frame lunar bright limb, naked-eye planets, local diurnal cycle, and
 * compact chronosense summary.
 *
 * @param engine Ephemeris engine instance.
 * @param jdUt Instant in UT Julian Days.
 * @param lat Observer latitude in degrees, north positive.
 * @param lonEast Observer longitude in degrees, east positive.
 * @param opts Optional elevation, terrain slope, Bortle class, camera aim,
 *   previous instant, and deadline.
 * @returns Full {@link SceneGeometry} snapshot.
 */
export function sceneGeometry(
  engine: Engine,
  jdUt: number,
  lat: number,
  lonEast: number,
  opts: SceneGeometryOptions = {},
): SceneGeometry {
  return sceneGeometryCore(engine, jdUt, lat, lonEast, opts).scene;
}

// ------------------------------------------------- fast snapshot & day cache

interface NormalizedObserved {
  shadowBearingDeg?: number;
  shadowLengthRatio?: number;
  sunAzimuthDeg?: number;
  sunAltitudeDeg?: number;
  twilight?: TwilightObservation;
  sunVisible?: boolean;
  moonVisible?: boolean;
  moonAzimuthDeg?: number;
  moonAltitudeDeg?: number;
  moonIllum?: number;
  moonWaxing?: boolean;
  moonBrightLimbDeg?: number;
  bodiesVisible?: string[];
  shadowSweep?: { dtMinutes: number; deltaBearingDeg: number; toleranceDeg?: number };
  tolerances?: Partial<Record<keyof ObservationTolerances, number>>;
}

const VALID_TOLERANCE_KEYS = new Set<string>([
  "shadowBearingDeg", "shadowLengthRatio", "shadowLengthRatioRel",
  "shadowLengthRatioAbs", "sunAzimuthDeg", "sunAltitudeDeg",
  "moonAzimuthDeg", "moonAltitudeDeg", "moonIllum",
  "moonBrightLimbDeg", "shadowSweepDeg",
]);

function observedNeeds(obs: NormalizedObserved): [boolean, string[]] {
  let needMoon = (
    obs.moonVisible !== undefined
    || obs.moonAzimuthDeg !== undefined
    || obs.moonAltitudeDeg !== undefined
    || obs.moonIllum !== undefined
    || obs.moonWaxing !== undefined
    || obs.moonBrightLimbDeg !== undefined
  );
  const extraBodies: string[] = [];
  if (obs.bodiesVisible) {
    for (const b of obs.bodiesVisible) {
      const bl = b.toLowerCase();
      if (bl === "moon") needMoon = true;
      else if (bl !== "sun" && !extraBodies.includes(bl)) extraBodies.push(bl);
    }
  }
  // Moon also affects limitingMag when planets are checked.
  if (extraBodies.length > 0) needMoon = true;
  return [needMoon, extraBodies];
}

function validateObserved(observed: ObservedConstraints | null | undefined): NormalizedObserved {
  if (observed === null || observed === undefined) return {};
  if (typeof observed !== "object" || Array.isArray(observed)) {
    throw new RangeError("observed must be an object or null/undefined");
  }
  const out: NormalizedObserved = {};
  for (const [k, v] of Object.entries(observed)) {
    if (v === undefined || v === null) continue;
    switch (k) {
      case "twilight": {
        if (typeof v !== "string" || !(v in TWILIGHT_BANDS)) {
          throw new RangeError(
            `unknown twilight ${JSON.stringify(v)} (expected one of ${Object.keys(TWILIGHT_BANDS).sort().join(", ")})`,
          );
        }
        out.twilight = v as TwilightObservation;
        break;
      }
      case "shadowLengthRatio": {
        const val = Number(v);
        if (!(Number.isFinite(val) && val >= 0.0)) {
          throw new RangeError(`shadowLengthRatio must be >= 0, got ${v}`);
        }
        out.shadowLengthRatio = val;
        break;
      }
      case "shadowBearingDeg":
      case "sunAzimuthDeg":
      case "moonAzimuthDeg":
      case "moonBrightLimbDeg": {
        const val = Number(v);
        if (!Number.isFinite(val)) {
          throw new RangeError(`${k} must be finite, got ${v}`);
        }
        out[k] = mod(val, 360.0);
        break;
      }
      case "sunAltitudeDeg":
      case "moonAltitudeDeg": {
        const val = Number(v);
        if (!(Number.isFinite(val) && val >= -90.0 && val <= 90.0)) {
          throw new RangeError(`${k} must be in [-90, 90], got ${v}`);
        }
        out[k] = val;
        break;
      }
      case "moonIllum": {
        const val = Number(v);
        if (!(Number.isFinite(val) && val >= 0.0 && val <= 1.0)) {
          throw new RangeError(`moonIllum must be in [0, 1], got ${v}`);
        }
        out.moonIllum = val;
        break;
      }
      case "sunVisible":
      case "moonVisible":
      case "moonWaxing": {
        if (typeof v !== "boolean") {
          throw new RangeError(`${k} must be boolean, got ${typeof v}`);
        }
        out[k] = v;
        break;
      }
      case "bodiesVisible": {
        if (!Array.isArray(v)) {
          throw new RangeError("bodiesVisible must be an array");
        }
        const seen: string[] = [];
        for (const b of v) {
          const bl = String(b).toLowerCase();
          if (!VALID_VISIBLE_BODIES.has(bl)) {
            throw new RangeError(`unknown body in bodiesVisible: ${JSON.stringify(b)}`);
          }
          if (!seen.includes(bl)) seen.push(bl);
        }
        if (seen.length > 0) out.bodiesVisible = seen;
        break;
      }
      case "shadowSweep": {
        if (typeof v !== "object" || Array.isArray(v)) {
          throw new RangeError("shadowSweep must be an object");
        }
        const swObj = v as ShadowSweepObservation;
        const dtM = Number(swObj.dtMinutes);
        const db = Number(swObj.deltaBearingDeg);
        if (!(Number.isFinite(dtM) && dtM > 0.0)) {
          throw new RangeError("shadowSweep.dtMinutes must be > 0");
        }
        if (!Number.isFinite(db)) {
          throw new RangeError("shadowSweep.deltaBearingDeg must be finite");
        }
        const sw: { dtMinutes: number; deltaBearingDeg: number; toleranceDeg?: number } = {
          dtMinutes: dtM,
          deltaBearingDeg: db,
        };
        if (swObj.toleranceDeg !== undefined && swObj.toleranceDeg !== null) {
          const tol = Number(swObj.toleranceDeg);
          if (!(Number.isFinite(tol) && tol > 0.0)) {
            throw new RangeError("shadowSweep.toleranceDeg must be > 0");
          }
          sw.toleranceDeg = tol;
        }
        out.shadowSweep = sw;
        break;
      }
      case "tolerances": {
        if (typeof v !== "object" || Array.isArray(v)) {
          throw new RangeError("tolerances must be an object");
        }
        const tols: Partial<Record<keyof ObservationTolerances, number>> = {};
        for (const [tk, tv] of Object.entries(v)) {
          if (tv === undefined || tv === null) continue;
          if (!VALID_TOLERANCE_KEYS.has(tk)) {
            throw new RangeError(`unknown tolerance key: ${JSON.stringify(tk)}`);
          }
          const fval = Number(tv);
          if (!(Number.isFinite(fval) && fval > 0.0)) {
            throw new RangeError(`tolerance ${tk} must be > 0, got ${tv}`);
          }
          tols[tk as keyof ObservationTolerances] = fval;
        }
        out.tolerances = tols;
        break;
      }
      default:
        throw new RangeError(`unknown observed key: ${JSON.stringify(k)}`);
    }
  }
  return out;
}

function hasActiveConstraints(obs: NormalizedObserved): boolean {
  for (const k of Object.keys(obs)) {
    if (k !== "tolerances") return true;
  }
  return false;
}

interface MoonSnapshot {
  ra: number;
  dec: number;
  lon: number;
  illum: number;
  waxing: boolean;
  mag: number;
}

interface BodySnapshot {
  ra: number;
  dec: number;
  mag: number | null;
}

interface GeocentricSnapshot {
  jdUt: number;
  gast: number;
  sunRa: number;
  sunDec: number;
  sunLon: number;
  moon: MoonSnapshot | null;
  bodies: Record<string, BodySnapshot>;
  sweepSteps: Array<[number, number, number]> | null;
}

/** Precompute geocentric equatorial coordinates at jdUt ONCE so evaluating any
 *  (lat, lon) is pure trigonometry. */
function snapshotAt(
  engine: Engine,
  jdUt: number,
  needMoon = false,
  extraBodies: readonly string[] = [],
  sweepDtMin?: number,
  base?: BaseSnapData,
): GeocentricSnapshot {
  const jde = jdTT(jdUt);
  const eps = base ? base.eps : trueObliquity(engine.data, jde);
  const g = base ? base.gast : gast(engine.data, jdUt);
  let sRa: number;
  let sDec: number;
  let sunLon: number;
  if (base) {
    sRa = base.sunRa;
    sDec = base.sunDec;
    sunLon = base.sunLon;
  } else {
    const [sLonR, sLatR] = engine.ecliptic("sun", jde);
    [sRa, sDec] = equatorial(sLonR, sLatR, eps);
    sunLon = mod(sLonR / DEG, 360.0);
  }

  let moon: MoonSnapshot | null = null;
  if (needMoon) {
    if (base) {
      moon = base.moon;
    } else {
      const [mLonR, mLatR] = engine.ecliptic("moon", jde);
      const [mRa, mDec] = equatorial(mLonR, mLatR, eps);
      const mLonDeg = mod(mLonR / DEG, 360.0);
      const mph = pheno(engine, "moon", jdUt);
      moon = {
        ra: mRa,
        dec: mDec,
        lon: mLonDeg,
        illum: mph.phase,
        waxing: mod(mLonDeg - sunLon, 360.0) < 180.0,
        mag: mph.magnitude,
      };
    }
  }

  const bodies: Record<string, BodySnapshot> = {};
  for (const bid of extraBodies) {
    const [bLonR, bLatR] = engine.ecliptic(bid, jde);
    const [bRa, bDec] = equatorial(bLonR, bLatR, eps);
    const bMag = DIAMETER_KM[bid] !== undefined ? pheno(engine, bid, jdUt).magnitude : null;
    bodies[bid] = { ra: bRa, dec: bDec, mag: bMag };
  }

  let sweepSteps: Array<[number, number, number]> | null = null;
  if (sweepDtMin !== undefined) {
    const nChunks = Math.max(1, Math.ceil(sweepDtMin / 30.0));
    sweepSteps = [];
    for (let i = 1; i <= nChunks; i++) {
      const ti = jdUt + sweepDtMin * (i / nChunks) * DT_MIN;
      const jdeI = jdTT(ti);
      const epsI = trueObliquity(engine.data, jdeI);
      const [lonI, latI] = engine.ecliptic("sun", jdeI);
      const [raI, decI] = equatorial(lonI, latI, epsI);
      sweepSteps.push([gast(engine.data, ti), raI, decI]);
    }
  }

  return {
    jdUt,
    gast: g,
    sunRa: sRa,
    sunDec: sDec,
    sunLon,
    moon,
    bodies,
    sweepSteps,
  };
}

/** Smooth equatorial unit-vector interpolation over a <=1.2 day span so dense
 *  intra-day scans run in pure trig while exact ephemeris refines edges. */
function buildDayCache(
  engine: Engine,
  t0: number,
  t1: number,
  needMoon = false,
  extraBodies: readonly string[] = [],
): (t: number, sweepDtMin?: number) => GeocentricSnapshot {
  const span = t1 - t0 > 0.0 ? t1 - t0 : 1e-6;
  const tm = t0 + 0.5 * span;

  const sunKnots: Array<[Vec3, number]> = [];
  for (const t of [t0, tm, t1]) {
    const jde = jdTT(t);
    const eps = trueObliquity(engine.data, jde);
    const [lonR, latR] = engine.ecliptic("sun", jde);
    const [ra, dec] = equatorial(lonR, latR, eps);
    sunKnots.push([eqUnit(ra, dec), mod(lonR / DEG, 360.0)]);
  }

  const g0 = gast(engine.data, t0);
  const g1 = gast(engine.data, t1);
  const gExpected = g0 + span * TWO_PI * 1.002737909350795;
  const gEnd = gExpected + wrapPi(g1 - gExpected);
  const gRate = (gEnd - g0) / span;

  let moonKnots: Array<[Vec3, number, number, number]> | null = null;
  if (needMoon) {
    moonKnots = [];
    for (let k = 0; k < 5; k++) {
      const tk = t0 + (k / 4.0) * span;
      const jde = jdTT(tk);
      const eps = trueObliquity(engine.data, jde);
      const [lonR, latR] = engine.ecliptic("moon", jde);
      const [ra, dec] = equatorial(lonR, latR, eps);
      const mph = pheno(engine, "moon", tk);
      moonKnots.push([eqUnit(ra, dec), mod(lonR / DEG, 360.0), mph.phase, mph.magnitude]);
    }
  }

  const bodyKnots: Record<string, [[Vec3, number | null], [Vec3, number | null]]> = {};
  for (const bid of extraBodies) {
    const pts: Array<[Vec3, number | null]> = [];
    for (const t of [t0, t1]) {
      const jde = jdTT(t);
      const eps = trueObliquity(engine.data, jde);
      const [lonR, latR] = engine.ecliptic(bid, jde);
      const [ra, dec] = equatorial(lonR, latR, eps);
      const bMag = DIAMETER_KM[bid] !== undefined ? pheno(engine, bid, t).magnitude : null;
      pts.push([eqUnit(ra, dec), bMag]);
    }
    bodyKnots[bid] = [pts[0], pts[1]];
  }

  const quadVec = (v0: Vec3, v1: Vec3, v2: Vec3, s: number): Vec3 => {
    const w0 = (1.0 - s) * (1.0 - 2.0 * s);
    const w1 = 4.0 * s * (1.0 - s);
    const w2 = s * (2.0 * s - 1.0);
    return [
      w0 * v0[0] + w1 * v1[0] + w2 * v2[0],
      w0 * v0[1] + w1 * v1[1] + w2 * v2[1],
      w0 * v0[2] + w1 * v1[2] + w2 * v2[2],
    ];
  };

  const lerpLon = (l0: number, l1: number, f: number): number =>
    mod(l0 + f * wrap180(l1 - l0), 360.0);

  return (t: number, sweepDtMin?: number): GeocentricSnapshot => {
    const s = (t - t0) / span;
    const sv = quadVec(sunKnots[0][0], sunKnots[1][0], sunKnots[2][0], s);
    const [sRa, sDec] = raDecFromUnit(sv);
    const sLon = lerpLon(sunKnots[0][1], sunKnots[2][1], s);
    const g = mod(g0 + (t - t0) * gRate, TWO_PI);

    let moonD: MoonSnapshot | null = null;
    if (moonKnots !== null) {
      const sc = Math.max(0.0, Math.min(1.0, s));
      const mv = sc <= 0.5
        ? quadVec(moonKnots[0][0], moonKnots[1][0], moonKnots[2][0], sc * 2.0)
        : quadVec(moonKnots[2][0], moonKnots[3][0], moonKnots[4][0], (sc - 0.5) * 2.0);
      const segF = sc * 4.0;
      const idx = Math.min(3, Math.floor(segF));
      const f = segF - idx;
      const [mRa, mDec] = raDecFromUnit(mv);
      const mLon = lerpLon(moonKnots[idx][1], moonKnots[idx + 1][1], f);
      const mIllum = moonKnots[idx][2] + f * (moonKnots[idx + 1][2] - moonKnots[idx][2]);
      const mMag = moonKnots[idx][3] + f * (moonKnots[idx + 1][3] - moonKnots[idx][3]);
      moonD = {
        ra: mRa,
        dec: mDec,
        lon: mLon,
        illum: Math.max(0.0, Math.min(1.0, mIllum)),
        waxing: mod(mLon - sLon, 360.0) < 180.0,
        mag: mMag,
      };
    }

    const bodiesD: Record<string, BodySnapshot> = {};
    for (const [bid, [k0, k1]] of Object.entries(bodyKnots)) {
      const [v0, m0] = k0;
      const [v1, m1] = k1;
      const bv: Vec3 = [
        v0[0] + s * (v1[0] - v0[0]),
        v0[1] + s * (v1[1] - v0[1]),
        v0[2] + s * (v1[2] - v0[2]),
      ];
      const [bRa, bDec] = raDecFromUnit(bv);
      const bMag = m0 === null || m1 === null ? null : m0 + s * (m1 - m0);
      bodiesD[bid] = { ra: bRa, dec: bDec, mag: bMag };
    }

    let sweepSteps: Array<[number, number, number]> | null = null;
    if (sweepDtMin !== undefined) {
      const nChunks = Math.max(1, Math.ceil(sweepDtMin / 30.0));
      sweepSteps = [];
      for (let i = 1; i <= nChunks; i++) {
        const ti = t + sweepDtMin * (i / nChunks) * DT_MIN;
        const si = (ti - t0) / span;
        const svi = quadVec(sunKnots[0][0], sunKnots[1][0], sunKnots[2][0], si);
        const [rai, deci] = raDecFromUnit(svi);
        const gi = mod(g0 + (ti - t0) * gRate, TWO_PI);
        sweepSteps.push([gi, rai, deci]);
      }
    }

    return {
      jdUt: t,
      gast: g,
      sunRa: sRa,
      sunDec: sDec,
      sunLon: sLon,
      moon: moonD,
      bodies: bodiesD,
      sweepSteps,
    };
  };
}

// ----------------------------------------- constraint evaluation & scoring

interface EvalPlaceOpts {
  elevationM?: number;
  slopeDeg?: number;
  slopeAzimuthDeg?: number;
  timeTol?: number;
  placeTol?: number;
  bortle?: number;
  sunRates?: [number, number];
  moonRates?: [number, number] | null;
  blRate?: number | null;
  sweepTimeSpread?: number;
  chronolocateMode?: boolean;
}

interface EvalResult {
  checks: ObservationCheck[];
  verdict: ObservationVerdict;
  score: number | null;
  maxNormRes: number;
  margin: number;
}

function evalSnapAtPlace(
  snap: GeocentricSnapshot,
  lat: number,
  lonEast: number,
  observed: NormalizedObserved,
  opts: EvalPlaceOpts = {},
): EvalResult {
  const elevationM = opts.elevationM ?? 0.0;
  const slopeDeg = opts.slopeDeg ?? 0.0;
  const slopeAzimuthDeg = opts.slopeAzimuthDeg ?? 0.0;
  const timeTol = opts.timeTol ?? 0.0;
  const placeTol = opts.placeTol ?? 0.0;
  const bortle = opts.bortle;
  const sweepTimeSpread = opts.sweepTimeSpread ?? 0.0;
  const chronolocateMode = opts.chronolocateMode ?? false;

  const pressure = pressureAtElevation(elevationM);
  const tolMap = observed.tolerances ?? {};
  const lst = mod(snap.gast + lonEast * DEG, TWO_PI);

  const [sunAz, sunAltTrue] = azAltFromEq(snap.sunRa, snap.sunDec, lst, lat);
  const sunAltApp = refractTrueToApparent(sunAltTrue, pressure);
  const sunStage = twilightStage(sunAltApp);

  let rateAlt = 0.0;
  let rateAz = 0.0;
  if (opts.sunRates !== undefined) {
    [rateAlt, rateAz] = opts.sunRates;
  } else if (timeTol > 0.0) {
    const dlst = DT_MIN * TWO_PI * 1.002737909350795;
    const [azM, altM] = azAltFromEq(snap.sunRa, snap.sunDec, mod(lst - dlst, TWO_PI), lat);
    const [azP, altP] = azAltFromEq(snap.sunRa, snap.sunDec, mod(lst + dlst, TWO_PI), lat);
    rateAlt = (altP - altM) * 0.5;
    rateAz = wrap180(azP - azM) * 0.5;
  }

  const shadow = computeShadow(sunAz, sunAltApp, slopeDeg, slopeAzimuthDeg, rateAz, rateAlt);

  const moonD = snap.moon;
  let moonAz = 0.0;
  let moonAltTrue = 0.0;
  let moonAltApp = 0.0;
  let moonIllum = 0.0;
  let moonWaxing = false;
  let blDeg: number | null = null;
  let mRateAlt = 0.0;
  let mRateAz = 0.0;
  if (moonD !== null) {
    [moonAz, moonAltTrue] = azAltFromEq(moonD.ra, moonD.dec, lst, lat);
    moonAltApp = refractTrueToApparent(moonAltTrue, pressure);
    moonIllum = moonD.illum;
    moonWaxing = moonD.waxing;
    [blDeg] = moonBrightLimb(moonAz, moonAltTrue, sunAz, sunAltTrue);
    if (opts.moonRates !== undefined && opts.moonRates !== null) {
      [mRateAlt, mRateAz] = opts.moonRates;
    } else if (timeTol > 0.0) {
      const dlst = DT_MIN * TWO_PI * 1.002737909350795;
      const [mazM, maltM] = azAltFromEq(moonD.ra, moonD.dec, mod(lst - dlst, TWO_PI), lat);
      const [mazP, maltP] = azAltFromEq(moonD.ra, moonD.dec, mod(lst + dlst, TWO_PI), lat);
      mRateAlt = (maltP - maltM) * 0.5;
      mRateAz = wrap180(mazP - mazM) * 0.5;
    }
  }

  const azPlaceWidening = (altDeg: number): number => {
    if (placeTol <= 0.0) return 0.0;
    return Math.min(90.0, placeTol / Math.max(0.1, Math.cos(altDeg * DEG)));
  };

  const checks: ObservationCheck[] = [];
  const activeRes: number[] = [];
  const margins: number[] = [];
  let anyImpossible = false;
  let anyInconsistent = false;
  let anyMarginal = false;

  const addCheck = (
    field: string,
    status: CheckStatus,
    obsV: number | string | boolean | null,
    expV: number | string | boolean | null,
    res: number | null,
    tol: number | null,
    normR: number | null,
    marginV: number,
    note: string | null = null,
  ): void => {
    checks.push({
      field,
      status,
      observed: obsV,
      expected: expV,
      residual: res,
      tolerance: tol,
      normalizedResidual: normR,
      note,
    });
    if (status === "indeterminate") return;
    activeRes.push(normR!);
    margins.push(marginV);
    if (status === "impossible") anyImpossible = true;
    else if (status === "inconsistent") anyInconsistent = true;
    else if (status === "marginal") anyMarginal = true;
  };

  const classifyNumeric = (normR: number): CheckStatus => {
    if (normR <= 1.0) return "consistent";
    if (normR <= 1.5) return "marginal";
    return "inconsistent";
  };

  // 1. shadowBearingDeg
  if (observed.shadowBearingDeg !== undefined) {
    const obsV = observed.shadowBearingDeg;
    const tolBase = tolMap.shadowBearingDeg ?? DEFAULT_TOLERANCES.shadowBearingDeg;
    const tol = tolBase + Math.abs(rateAz) * timeTol + azPlaceWidening(sunAltApp);
    if (!shadow.cast) {
      let nr: number;
      let mv: number;
      let note: string;
      if (shadow.selfShadowed) {
        const sVec = dirFromAzAlt(sunAz, sunAltApp);
        const nDotS = dot(slopeNormal(slopeDeg, slopeAzimuthDeg), sVec);
        nr = 3.0 + Math.abs(nDotS) / 0.1;
        mv = -1.0 + nDotS / 0.1;
        note = "terrain is self-shadowed at this slope and solar position";
      } else {
        nr = 3.0 + Math.abs(sunAltApp) / 5.0;
        mv = -1.0 + sunAltApp / 5.0;
        note = "Sun is below horizon; no solar shadow can be cast";
      }
      addCheck("shadowBearingDeg", "impossible", obsV, null, null, tol, nr, mv, note);
    } else if (sunAltApp > ZENITH_INDET_DEG) {
      if (
        chronolocateMode && !(
          (observed.sunAltitudeDeg !== undefined && observed.sunAltitudeDeg > ZENITH_INDET_DEG)
          || (observed.shadowLengthRatio !== undefined && observed.shadowLengthRatio < 0.04)
        )
      ) {
        addCheck(
          "shadowBearingDeg", "inconsistent", obsV, shadow.bearingDeg,
          null, tol, 2.0, -0.5, "Sun near zenith during scan; bearing ill-conditioned",
        );
      } else {
        addCheck(
          "shadowBearingDeg", "indeterminate", obsV, shadow.bearingDeg,
          null, tol, null, 0.0, "Sun is near zenith (>88 deg); shadow bearing is ill-conditioned",
        );
      }
    } else {
      const err = wrap180(obsV - shadow.bearingDeg!);
      const nr = Math.abs(err) / tol;
      addCheck("shadowBearingDeg", classifyNumeric(nr), obsV, shadow.bearingDeg, err, tol, nr, 1.0 - nr);
    }
  }

  // 2. shadowLengthRatio
  if (observed.shadowLengthRatio !== undefined) {
    const obsV = observed.shadowLengthRatio;
    if (!shadow.cast) {
      const tolAbsFallback = tolMap.shadowLengthRatio ?? (
        (tolMap.shadowLengthRatioRel ?? DEFAULT_TOLERANCES.shadowLengthRatioRel) * obsV
        + (tolMap.shadowLengthRatioAbs ?? DEFAULT_TOLERANCES.shadowLengthRatioAbs)
      );
      let nr: number;
      let mv: number;
      let note: string;
      if (shadow.selfShadowed) {
        const sVec = dirFromAzAlt(sunAz, sunAltApp);
        const nDotS = dot(slopeNormal(slopeDeg, slopeAzimuthDeg), sVec);
        nr = 3.0 + Math.abs(nDotS) / 0.1;
        mv = -1.0 + nDotS / 0.1;
        note = "terrain is self-shadowed; no solar shadow length exists";
      } else {
        nr = 3.0 + Math.abs(sunAltApp) / 5.0;
        mv = -1.0 + sunAltApp / 5.0;
        note = "Sun is below horizon; no solar shadow can be cast";
      }
      addCheck("shadowLengthRatio", "impossible", obsV, null, null, tolAbsFallback, nr, mv, note);
    } else if (shadow.lengthRatio === null) {
      if (obsV >= 20.0) {
        addCheck(
          "shadowLengthRatio", "indeterminate", obsV, null, null, null, null, 0.0,
          "Sun is grazing (<0.05 deg); shadow length diverges",
        );
      } else {
        const nr = (20.0 - obsV) / 5.0;
        addCheck(
          "shadowLengthRatio", classifyNumeric(nr), obsV, null, null, 5.0, nr, 1.0 - nr,
          "Sun is grazing (<0.05 deg); shadow length far exceeds observation",
        );
      }
    } else {
      const expV = shadow.lengthRatio;
      const tolBase = tolMap.shadowLengthRatio !== undefined
        ? tolMap.shadowLengthRatio
        : (tolMap.shadowLengthRatioRel ?? DEFAULT_TOLERANCES.shadowLengthRatioRel) * expV
          + (tolMap.shadowLengthRatioAbs ?? DEFAULT_TOLERANCES.shadowLengthRatioAbs);
      const rateL = shadow.rateLengthRatioPerMin ?? 0.0;
      const sVec = dirFromAzAlt(sunAz, sunAltApp);
      const nDotS = Math.max(0.1, dot(slopeNormal(slopeDeg, slopeAzimuthDeg), sVec));
      const placeW = placeTol > 0.0 ? (placeTol * DEG) / (nDotS * nDotS) : 0.0;
      const tol = tolBase + Math.abs(rateL) * timeTol + placeW;
      const err = obsV - expV;
      const nr = Math.abs(err) / tol;
      addCheck("shadowLengthRatio", classifyNumeric(nr), obsV, expV, err, tol, nr, 1.0 - nr);
    }
  }

  // 3. sunAzimuthDeg
  if (observed.sunAzimuthDeg !== undefined) {
    const obsV = observed.sunAzimuthDeg;
    const tolBase = tolMap.sunAzimuthDeg ?? DEFAULT_TOLERANCES.sunAzimuthDeg;
    const tol = tolBase + Math.abs(rateAz) * timeTol + azPlaceWidening(sunAltApp);
    if (Math.abs(sunAltApp) > ZENITH_INDET_DEG) {
      if (
        chronolocateMode && !(
          observed.sunAltitudeDeg !== undefined && Math.abs(observed.sunAltitudeDeg) > ZENITH_INDET_DEG
        )
      ) {
        addCheck(
          "sunAzimuthDeg", "inconsistent", obsV, sunAz, null, tol, 2.0, -0.5,
          "Sun near zenith/nadir during scan",
        );
      } else {
        addCheck(
          "sunAzimuthDeg", "indeterminate", obsV, sunAz, null, tol, null, 0.0,
          "Sun is near zenith/nadir (>88 deg); azimuth ill-conditioned",
        );
      }
    } else {
      const err = wrap180(obsV - sunAz);
      const nr = Math.abs(err) / tol;
      addCheck("sunAzimuthDeg", classifyNumeric(nr), obsV, sunAz, err, tol, nr, 1.0 - nr);
    }
  }

  // 4. sunAltitudeDeg
  if (observed.sunAltitudeDeg !== undefined) {
    const obsV = observed.sunAltitudeDeg;
    const tolBase = tolMap.sunAltitudeDeg ?? DEFAULT_TOLERANCES.sunAltitudeDeg;
    const tol = tolBase + Math.abs(rateAlt) * timeTol + placeTol;
    const err = obsV - sunAltApp;
    const nr = Math.abs(err) / tol;
    addCheck("sunAltitudeDeg", classifyNumeric(nr), obsV, sunAltApp, err, tol, nr, 1.0 - nr);
  }

  // 5. twilight
  if (observed.twilight !== undefined) {
    const obsV = observed.twilight;
    const [loB, hiB] = TWILIGHT_BANDS[obsV];
    if (sunAltApp >= loB && sunAltApp <= hiB) {
      const insideDist = Math.min(sunAltApp - loB, hiB - sunAltApp);
      const mv = Math.min(1.0, insideDist / 1.5);
      addCheck("twilight", "consistent", obsV, sunStage, 0.0, null, 0.0, mv);
    } else {
      const dist = sunAltApp < loB ? loB - sunAltApp : sunAltApp - hiB;
      const bTol = Math.abs(rateAlt) * timeTol + placeTol + 1.5;
      const nr = dist / bTol;
      const mv = -dist / bTol;
      let st: CheckStatus;
      let note: string | null = null;
      if (dist > 6.0 + Math.abs(rateAlt) * timeTol + placeTol) {
        st = "impossible";
        note = `Sun at ${sunAltApp.toFixed(1)} deg is far outside ${obsV} band [${fmtPyFloat(loB)}, ${fmtPyFloat(hiB)}]`;
      } else {
        st = classifyNumeric(nr);
      }
      addCheck("twilight", st, obsV, sunStage, dist, bTol, nr, mv, note);
    }
  }

  // 6. sunVisible
  if (observed.sunVisible !== undefined) {
    const obsV = observed.sunVisible;
    const marginDeg = Math.abs(rateAlt) * timeTol + placeTol + 0.5;
    if (obsV) {
      if (sunAltApp > 0.0) {
        addCheck("sunVisible", "consistent", true, true, 0.0, marginDeg, 0.0, Math.min(1.0, sunAltApp));
      } else {
        const d = -sunAltApp;
        let nr = d / marginDeg;
        const mv = -d / marginDeg;
        let st: CheckStatus;
        if (d <= marginDeg) st = "consistent";
        else if (d <= marginDeg + 2.0) st = "marginal";
        else {
          st = "impossible";
          nr = Math.max(nr, 2.0 + d / 5.0);
        }
        addCheck(
          "sunVisible", st, true, false, -d, marginDeg, nr, mv,
          st === "impossible" ? "Sun is below horizon" : null,
        );
      }
    } else {
      if (sunAltApp <= 0.0) {
        addCheck("sunVisible", "consistent", false, false, 0.0, marginDeg, 0.0, Math.min(1.0, -sunAltApp));
      } else {
        const d = sunAltApp;
        let nr = d / marginDeg;
        const mv = -d / marginDeg;
        let st: CheckStatus;
        if (d <= marginDeg) st = "consistent";
        else if (d <= marginDeg + 2.0) st = "marginal";
        else if (d > 6.0 + marginDeg) {
          st = "impossible";
          nr = Math.max(nr, 2.0 + d / 5.0);
        } else {
          st = "inconsistent";
        }
        addCheck(
          "sunVisible", st, false, true, d, marginDeg, nr, mv,
          st === "impossible" ? "Sun is well above horizon" : null,
        );
      }
    }
  }

  // 7. moonVisible
  if (observed.moonVisible !== undefined) {
    const obsV = observed.moonVisible;
    const marginDeg = Math.abs(mRateAlt) * timeTol + placeTol + 0.5;
    if (obsV) {
      if (moonAltApp > 0.0) {
        addCheck("moonVisible", "consistent", true, true, 0.0, marginDeg, 0.0, Math.min(1.0, moonAltApp));
      } else {
        const d = -moonAltApp;
        let nr = d / marginDeg;
        const mv = -d / marginDeg;
        let st: CheckStatus;
        if (d <= marginDeg) st = "consistent";
        else if (d <= marginDeg + 2.0) st = "marginal";
        else {
          st = "impossible";
          nr = Math.max(nr, 2.0 + d / 5.0);
        }
        addCheck(
          "moonVisible", st, true, false, -d, marginDeg, nr, mv,
          st === "impossible" ? "Moon is below horizon" : null,
        );
      }
    } else {
      if (moonAltApp <= 0.0) {
        addCheck("moonVisible", "consistent", false, false, 0.0, marginDeg, 0.0, Math.min(1.0, -moonAltApp));
      } else {
        const d = moonAltApp;
        let nr = d / marginDeg;
        const mv = -d / marginDeg;
        let st: CheckStatus;
        if (d <= marginDeg) st = "consistent";
        else if (d <= marginDeg + 2.0) st = "marginal";
        else if (d > 6.0 + marginDeg) {
          st = "impossible";
          nr = Math.max(nr, 2.0 + d / 5.0);
        } else {
          st = "inconsistent";
        }
        addCheck(
          "moonVisible", st, false, true, d, marginDeg, nr, mv,
          st === "impossible" ? "Moon is well above horizon" : null,
        );
      }
    }
  }

  // 8. moonAzimuthDeg
  if (observed.moonAzimuthDeg !== undefined) {
    const obsV = observed.moonAzimuthDeg;
    const tolBase = tolMap.moonAzimuthDeg ?? DEFAULT_TOLERANCES.moonAzimuthDeg;
    const tol = tolBase + Math.abs(mRateAz) * timeTol + azPlaceWidening(moonAltApp);
    const visMargin = Math.abs(mRateAlt) * timeTol + placeTol + 3.0;
    if (moonAltApp < -visMargin) {
      const nr = 2.5 + Math.abs(moonAltApp) / 5.0;
      const mv = moonAltApp / 2.0;
      addCheck(
        "moonAzimuthDeg", "impossible", obsV, moonAz, wrap180(obsV - moonAz), tol, nr, mv,
        "Moon is below horizon; azimuth cannot be observed",
      );
    } else if (Math.abs(moonAltApp) > ZENITH_INDET_DEG) {
      addCheck(
        "moonAzimuthDeg", "indeterminate", obsV, moonAz, null, tol, null, 0.0,
        "Moon is near zenith; azimuth ill-conditioned",
      );
    } else {
      const err = wrap180(obsV - moonAz);
      const nr = Math.abs(err) / tol;
      let mv = 1.0 - nr;
      if (chronolocateMode && moonAltApp < 0.0) mv = Math.min(mv, moonAltApp / 2.0);
      addCheck("moonAzimuthDeg", classifyNumeric(nr), obsV, moonAz, err, tol, nr, mv);
    }
  }

  // 9. moonAltitudeDeg
  if (observed.moonAltitudeDeg !== undefined) {
    const obsV = observed.moonAltitudeDeg;
    const tolBase = tolMap.moonAltitudeDeg ?? DEFAULT_TOLERANCES.moonAltitudeDeg;
    const tol = tolBase + Math.abs(mRateAlt) * timeTol + placeTol;
    const err = obsV - moonAltApp;
    let nr = Math.abs(err) / tol;
    const visMargin = Math.abs(mRateAlt) * timeTol + placeTol + 3.0;
    let st: CheckStatus;
    let note: string | null = null;
    if (obsV > 3.0 && moonAltApp < -visMargin) {
      st = "impossible";
      nr = Math.max(nr, 2.5 + Math.abs(moonAltApp) / 5.0);
      note = "Moon is well below horizon";
    } else {
      st = classifyNumeric(nr);
    }
    addCheck("moonAltitudeDeg", st, obsV, moonAltApp, err, tol, nr, 1.0 - nr, note);
  }

  // 10. moonIllum
  if (observed.moonIllum !== undefined) {
    const obsV = observed.moonIllum;
    const tolBase = tolMap.moonIllum ?? DEFAULT_TOLERANCES.moonIllum;
    const tol = tolBase + 0.00005 * timeTol;
    const err = obsV - moonIllum;
    const nr = Math.abs(err) / tol;
    let st: CheckStatus;
    let note: string | null = null;
    if (Math.abs(err) > Math.max(0.35, 3.0 * tol)) {
      st = "impossible";
      note = `Lunar illumination ${moonIllum.toFixed(2)} incompatible with ${obsV.toFixed(2)} on this date`;
    } else {
      st = classifyNumeric(nr);
    }
    addCheck("moonIllum", st, obsV, moonIllum, err, tol, nr, 1.0 - nr, note);
  }

  // 11. moonWaxing
  if (observed.moonWaxing !== undefined) {
    const obsV = observed.moonWaxing;
    if (moonIllum > MOON_PHASE_INDET_HI || moonIllum < MOON_PHASE_INDET_LO) {
      addCheck(
        "moonWaxing", "indeterminate", obsV, moonWaxing, null, null, null, 0.0,
        "Moon is near full or new phase; waxing/waning visually indeterminate",
      );
    } else {
      const elongRad = (moonD!.lon - snap.sunLon) * DEG;
      const sinE = Math.sin(elongRad);
      const signedS = obsV ? sinE : -sinE;
      const mv = Math.max(-2.0, Math.min(1.0, signedS / 0.087));
      if (obsV === moonWaxing) {
        addCheck("moonWaxing", "consistent", obsV, moonWaxing, 0.0, null, 0.0, Math.max(0.0, mv));
      } else {
        addCheck(
          "moonWaxing", "impossible", obsV, moonWaxing, null, null, 4.0, Math.min(-0.5, mv),
          "Observed waxing/waning side contradicts lunar elongation",
        );
      }
    }
  }

  // 12. moonBrightLimbDeg
  if (observed.moonBrightLimbDeg !== undefined) {
    const obsV = observed.moonBrightLimbDeg;
    const tolBase = tolMap.moonBrightLimbDeg ?? DEFAULT_TOLERANCES.moonBrightLimbDeg;
    const br = opts.blRate !== undefined && opts.blRate !== null ? Math.abs(opts.blRate) : 0.25;
    const tol = tolBase + br * timeTol + placeTol;
    const visMargin = Math.abs(mRateAlt) * timeTol + placeTol + 3.0;
    if (moonAltApp < -visMargin) {
      const nr = 2.5 + Math.abs(moonAltApp) / 5.0;
      const mv = moonAltApp / 2.0;
      const resBl = blDeg === null ? null : wrap180(obsV - blDeg);
      addCheck(
        "moonBrightLimbDeg", "impossible", obsV, blDeg, resBl, tol, nr, mv,
        "Moon is below horizon; bright limb cannot be observed",
      );
    } else if (moonIllum > MOON_PHASE_INDET_HI || moonIllum < MOON_PHASE_INDET_LO || blDeg === null) {
      if (
        chronolocateMode && !(
          observed.moonIllum !== undefined
          && (observed.moonIllum > MOON_PHASE_INDET_HI || observed.moonIllum < MOON_PHASE_INDET_LO)
        )
      ) {
        addCheck(
          "moonBrightLimbDeg", "inconsistent", obsV, blDeg, null, tol, 2.0, -0.5,
          "Moon near full/new phase during scan",
        );
      } else {
        addCheck(
          "moonBrightLimbDeg", "indeterminate", obsV, blDeg, null, tol, null, 0.0,
          "Moon is near full or new phase; bright-limb tilt is indeterminate",
        );
      }
    } else {
      const err = wrap180(obsV - blDeg);
      const nr = Math.abs(err) / tol;
      let mv = 1.0 - nr;
      if (chronolocateMode && moonAltApp < 0.0) mv = Math.min(mv, moonAltApp / 2.0);
      addCheck("moonBrightLimbDeg", classifyNumeric(nr), obsV, blDeg, err, tol, nr, mv);
    }
  }

  // 13. bodiesVisible
  if (observed.bodiesVisible !== undefined) {
    const lim = limitingMag(
      sunStage,
      moonD !== null && moonAltTrue > 0.0 ? moonAltTrue : null,
      moonD !== null ? moonIllum : null,
      bortle,
    );
    const bMargin = 0.25 * timeTol + placeTol + 0.5;
    for (const bid of observed.bodiesVisible) {
      const field = `bodyVisible:${bid}`;
      let bAltApp: number;
      let bMag: number | null;
      if (bid === "sun") {
        bAltApp = sunAltApp;
        bMag = -26.74;
      } else if (bid === "moon") {
        bAltApp = moonAltApp;
        bMag = moonD!.mag;
      } else {
        const bd = snap.bodies[bid];
        const [, bAltTrue] = azAltFromEq(bd.ra, bd.dec, lst, lat);
        bAltApp = refractTrueToApparent(bAltTrue, pressure);
        bMag = bd.mag;
      }

      if (bAltApp < -(bMargin + 2.0)) {
        const nr = 2.0 + Math.abs(bAltApp) / 5.0;
        const mv = bAltApp / 2.0;
        addCheck(
          field, "impossible", true, false, bAltApp, bMargin, nr, mv,
          `${bid} is ${Math.abs(bAltApp).toFixed(1)} deg below horizon`,
        );
      } else if (bid === "sun" || bid === "moon") {
        if (bAltApp > 0.0) {
          addCheck(field, "consistent", true, true, 0.0, bMargin, 0.0, Math.min(1.0, bAltApp));
        } else {
          const d = -bAltApp;
          const nr = d / bMargin;
          const st: CheckStatus = nr <= 1.0 ? "consistent" : "marginal";
          addCheck(field, st, true, false, -d, bMargin, nr, 1.0 - nr);
        }
      } else {
        const altMV = Math.min(1.0, bAltApp);
        if (bAltApp <= 0.0) {
          const d = -bAltApp;
          const nr = d / bMargin;
          const st: CheckStatus = nr <= 1.0 ? "consistent" : "marginal";
          addCheck(field, st, true, false, -d, bMargin, nr, Math.min(1.0 - nr, altMV));
        } else if (bMag === null || bMag <= lim) {
          const magMV = bMag === null ? 1.0 : Math.min(1.0, (lim - bMag) / 1.5);
          addCheck(
            field, "consistent", true, true,
            bMag === null ? 0.0 : bMag - lim, 1.5, 0.0, Math.min(altMV, magMV),
          );
        } else if (bMag <= lim + 1.5) {
          const excess = bMag - lim;
          const nr = 1.0 + excess / 3.0;
          addCheck(
            field, "marginal", true, false, excess, 1.5, nr, -excess / 1.5,
            `${bid} (mag ${bMag.toFixed(1)}) is faint against limit ${lim.toFixed(1)}`,
          );
        } else if (bMag > lim + 4.0) {
          const excess = bMag - lim;
          const nr = Math.max(3.0, excess / 1.5);
          addCheck(
            field, "impossible", true, false, excess, 1.5, nr, -excess / 1.5,
            `${bid} (mag ${bMag.toFixed(1)}) cannot be seen naked-eye against limit ${lim.toFixed(1)}`,
          );
        } else {
          const excess = bMag - lim;
          const nr = excess / 1.5;
          addCheck(
            field, "inconsistent", true, false, excess, 1.5, nr, -excess / 1.5,
            `${bid} (mag ${bMag.toFixed(1)}) is fainter than sky limit ${lim.toFixed(1)}`,
          );
        }
      }
    }
  }

  // 14. shadowSweep
  if (observed.shadowSweep !== undefined) {
    const sw = observed.shadowSweep;
    const obsDelta = sw.deltaBearingDeg;
    const tolBase = sw.toleranceDeg ?? tolMap.shadowSweepDeg ?? DEFAULT_TOLERANCES.shadowSweepDeg;
    const tol = tolBase + sweepTimeSpread + placeTol * 0.5;
    if (!shadow.cast) {
      const nr = 3.0 + Math.abs(sunAltApp) / 5.0;
      const mv = -1.0 + Math.min(0.0, sunAltApp) / 5.0;
      addCheck(
        "shadowSweep", "impossible", obsDelta, null, null, tol, nr, mv,
        "no shadow cast at claimed instant",
      );
    } else if (sunAltApp > ZENITH_INDET_DEG) {
      addCheck(
        "shadowSweep", "indeterminate", obsDelta, null, null, tol, null, 0.0,
        "Sun near zenith; shadow sweep ill-conditioned",
      );
    } else {
      let prevAz = sunAz;
      let totalDelta = 0.0;
      let minAltApp = sunAltApp;
      let nearZenith = false;
      const slopeN = slopeDeg > 0.0 ? slopeNormal(slopeDeg, slopeAzimuthDeg) : null;
      let selfShadowedDuring = false;
      let minNDotS = 1.0;
      for (const [gI, raI, decI] of snap.sweepSteps!) {
        const lstI = mod(gI + lonEast * DEG, TWO_PI);
        const [azI, altTI] = azAltFromEq(raI, decI, lstI, lat);
        const altAppI = refractTrueToApparent(altTI, pressure);
        if (altAppI < minAltApp) minAltApp = altAppI;
        if (altAppI > ZENITH_INDET_DEG) nearZenith = true;
        if (slopeN !== null && altAppI > 0.0) {
          const nds = dot(slopeN, dirFromAzAlt(azI, altAppI));
          if (nds < minNDotS) minNDotS = nds;
          if (nds <= 0.0) selfShadowedDuring = true;
        }
        totalDelta += wrap180(azI - prevAz);
        prevAz = azI;
      }
      if (minAltApp <= -0.5) {
        const nr = 3.0 + Math.abs(minAltApp) / 5.0;
        addCheck(
          "shadowSweep", "impossible", obsDelta, totalDelta, obsDelta - totalDelta,
          tol, nr, -1.0 + minAltApp / 5.0, "Sun sets during shadow_sweep window",
        );
      } else if (selfShadowedDuring) {
        const nr = 3.0 + Math.abs(minNDotS) / 0.1;
        addCheck(
          "shadowSweep", "impossible", obsDelta, totalDelta, obsDelta - totalDelta,
          tol, nr, -1.0 + minNDotS / 0.1, "terrain is self-shadowed during shadow_sweep window",
        );
      } else if (nearZenith) {
        addCheck(
          "shadowSweep", "indeterminate", obsDelta, totalDelta, null, tol, null, 0.0,
          "Sun passes near zenith during sweep window",
        );
      } else {
        const err = obsDelta - totalDelta;
        const nr = Math.abs(err) / tol;
        let st: CheckStatus;
        let note: string | null = null;
        if (totalDelta * obsDelta < 0.0 && Math.abs(err) > Math.max(2.0 * tol, 10.0)) {
          st = "impossible";
          note = "shadow swept opposite to physical solar rotation (reversed video or wrong hemisphere)";
        } else {
          st = classifyNumeric(nr);
        }
        addCheck("shadowSweep", st, obsDelta, totalDelta, err, tol, nr, 1.0 - nr, note);
      }
    }
  }

  if (activeRes.length === 0) {
    return { checks, verdict: "unconstrained", score: null, maxNormRes: 0.0, margin: -1.0 };
  }

  let maxNr = activeRes[0];
  let sumSq = 0.0;
  for (const r of activeRes) {
    if (r > maxNr) maxNr = r;
    sumSq += r * r;
  }
  const rmsSq = sumSq / activeRes.length;
  let score = Math.exp(-0.35 * rmsSq - 0.15 * maxNr * maxNr);
  let verdict: ObservationVerdict;
  if (anyImpossible) {
    verdict = "impossible";
    score = Math.min(score, 0.25);
  } else if (anyInconsistent) {
    verdict = "inconsistent";
  } else if (anyMarginal) {
    verdict = "marginal";
  } else {
    verdict = "consistent";
  }

  let minMargin = margins[0];
  for (let i = 1; i < margins.length; i++) {
    if (margins[i] < minMargin) minMargin = margins[i];
  }
  return { checks, verdict, score, maxNormRes: maxNr, margin: minMargin };
}

// ------------------------------------------------ verifyObservation & diag

function goldenMax(f: (x: number) => number, aIn: number, bIn: number, iters = 20): [number, number] {
  let a = aIn;
  let b = bIn;
  let c = b - (b - a) * INV_PHI;
  let d = a + (b - a) * INV_PHI;
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iters; i++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - (b - a) * INV_PHI;
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + (b - a) * INV_PHI;
      fd = f(d);
    }
  }
  const mid = 0.5 * (a + b);
  return [mid, f(mid)];
}

function runDiagnostics(
  engine: Engine,
  jdUt: number,
  lat: number,
  lonEast: number,
  claim: ObservationClaim,
  observed: NormalizedObserved,
  checks: ObservationCheck[],
  baseScore: number | null,
): ObservationDiagnostics {
  const elev = claim.elevationM ?? 0.0;
  const slope = claim.slopeDeg ?? 0.0;
  const slopeAz = claim.slopeAzimuthDeg ?? 0.0;
  const timeTol = claim.timeToleranceMin ?? 0.0;
  const placeTol = claim.placeToleranceDeg ?? 0.0;
  const bortle = claim.bortle;
  const [needMoon, extraBodies] = observedNeeds(observed);
  const sweepDt = observed.shadowSweep?.dtMinutes;

  const evalAt = (
    t: number, la: number, lo: number, snap?: GeocentricSnapshot,
  ): [number, ObservationVerdict] => {
    const s = snap ?? snapshotAt(engine, t, needMoon, extraBodies, sweepDt);
    const res = evalSnapAtPlace(s, la, lo, observed, {
      elevationM: elev,
      slopeDeg: slope,
      slopeAzimuthDeg: slopeAz,
      timeTol,
      placeTol,
      bortle,
    });
    return [res.score ?? 0.0, res.verdict];
  };

  // 1. Time shift: sweep [-14h, +14h] every 10 minutes via day cache, then refine.
  const tLo = jdUt - 14.0 / 24.0;
  const tHi = jdUt + 14.0 / 24.0;
  const cacheFn = buildDayCache(engine, tLo, tHi, needMoon, extraBodies);
  const step = 10.0 * DT_MIN;
  const samples: Array<[number, number]> = [];
  for (let t = tLo; t <= tHi + 1e-9; t += step) {
    const [sc] = evalAt(t, lat, lonEast, cacheFn(t, sweepDt));
    samples.push([t, sc]);
  }

  const peaks: Array<[number, number]> = [];
  for (let i = 0; i < samples.length; i++) {
    const [ti, si] = samples[i];
    const left = i > 0 ? samples[i - 1][1] : -1.0;
    const right = i + 1 < samples.length ? samples[i + 1][1] : -1.0;
    if (si >= left && si >= right) peaks.push([si, ti]);
  }
  peaks.sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));
  if (peaks.length === 0) peaks.push([samples[0][1], samples[0][0]]);

  let bestTsJd = jdUt;
  let bestTsScore = -1.0;
  for (const [, tp] of peaks.slice(0, 3)) {
    const a = Math.max(tLo, tp - step);
    const b = Math.min(tHi, tp + step);
    const [candT] = goldenMax(
      (x) => evalAt(x, lat, lonEast, cacheFn(x, sweepDt))[0],
      a, b, 16,
    );
    const [scExact] = evalAt(candT, lat, lonEast);
    if (scExact > bestTsScore) {
      bestTsScore = scExact;
      bestTsJd = candT;
    }
  }

  [bestTsJd] = goldenMax(
    (x) => evalAt(x, lat, lonEast)[0],
    Math.max(tLo, bestTsJd - 2.0 * DT_MIN),
    Math.min(tHi, bestTsJd + 2.0 * DT_MIN),
    10,
  );
  const [finalTsScore, bestTsVerdict] = evalAt(bestTsJd, lat, lonEast);
  bestTsScore = finalTsScore;
  const offsetMin = (bestTsJd - jdUt) * 1440.0;
  const nearestHr = Math.round(offsetMin / 60.0) || 0;
  const timeShift: TimeShiftDiagnostic = {
    jdUt: bestTsJd,
    offsetMinutes: offsetMin,
    nearestWholeHourOffset: nearestHr,
    fitScore: bestTsScore,
    verdict: bestTsVerdict,
  };

  // 2. Hemisphere flip: (-lat, lonEast) at jdUt.
  const snapNow = snapshotAt(engine, jdUt, needMoon, extraBodies, sweepDt);
  const [hfScore, hfVerdict] = evalAt(jdUt, -lat, lonEast, snapNow);
  const hemisphereFlip: HemisphereFlipDiagnostic = {
    lat: -lat,
    lonEast,
    fitScore: hfScore,
    verdict: hfVerdict,
  };

  // 3. Seasonal date shift: sweep year at same UTC time-of-day if solar geometry failed.
  const solarFields = new Set([
    "sunAltitudeDeg", "shadowLengthRatio", "sunAzimuthDeg",
    "shadowBearingDeg", "twilight", "sunVisible",
  ]);
  const solarFailed = checks.some(
    (c) => solarFields.has(c.field) && (c.status === "inconsistent" || c.status === "impossible"),
  );
  let dateShift: DateShiftDiagnostic | null = null;
  if (solarFailed) {
    const coarse: Array<[number, number]> = [];
    for (let d = -180; d <= 180; d += 10) {
      if (d === 0) continue;
      const [scD] = evalAt(jdUt + d, lat, lonEast);
      coarse.push([scD, d]);
    }
    coarse.sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));
    const radius = needMoon ? 15 : 10;
    let bestD = coarse[0][1];
    let bestDsScore = -1.0;
    let bestDsVerdict: ObservationVerdict = "inconsistent";
    const tested = new Set<number>();
    for (const [, dCenter] of coarse.slice(0, 2)) {
      const dLo = Math.max(-182, dCenter - radius);
      const dHi = Math.min(182, dCenter + radius);
      for (let d = dLo; d <= dHi; d++) {
        if (d === 0 || tested.has(d)) continue;
        tested.add(d);
        const [scD, vd] = evalAt(jdUt + d, lat, lonEast);
        if (scD > bestDsScore) {
          bestDsScore = scD;
          bestDsVerdict = vd;
          bestD = d;
        }
      }
    }
    dateShift = {
      jdUt: jdUt + bestD,
      offsetDays: bestD,
      fitScore: bestDsScore,
      verdict: bestDsVerdict,
    };
  }

  // 4. Crisp one-line summary choosing best explanatory single-axis hypothesis.
  const candidates: Array<["hemisphere_flip" | "time_shift" | "date_shift", number, ObservationVerdict]> = [];
  if (Math.abs(lat) >= 2.0) {
    candidates.push(["hemisphere_flip", hfScore, hfVerdict]);
  }
  candidates.push(["time_shift", bestTsScore, bestTsVerdict]);
  if (dateShift !== null) {
    candidates.push(["date_shift", dateShift.fitScore, dateShift.verdict]);
  }

  const rankV: Record<ObservationVerdict, number> = {
    consistent: 3, marginal: 2, inconsistent: 1, impossible: 0, unconstrained: 0,
  };
  candidates.sort((a, b) => (rankV[b[2]] - rankV[a[2]]) || (b[1] - a[1]));
  const [topKind, topScore, topVerdict] = candidates[0];
  const baseS = baseScore ?? 0.0;

  let summary: string;
  if (
    topVerdict === "consistent"
    || topVerdict === "marginal"
    || (topScore >= 0.65 && topScore > baseS + 0.25)
  ) {
    if (topKind === "hemisphere_flip") {
      summary = `Likely hemisphere sign flip: lat ${fmtSignedFixed(-lat, 2)} fits at score ${hfScore.toFixed(2)} (${hfVerdict}).`;
    } else if (topKind === "time_shift") {
      const rem60 = Math.abs(offsetMin) % 60.0;
      if (Math.abs(rem60 - 30.0) <= 8.0) {
        summary = `Likely half-hour clock/timezone offset of ${fmtSignedFixed(offsetMin, 0)} min (${fmtSignedFixed(offsetMin / 60.0, 1)}h), fit ${bestTsScore.toFixed(2)} (${bestTsVerdict}).`;
      } else if (Math.abs(offsetMin - nearestHr * 60.0) <= 12.0 && nearestHr !== 0) {
        summary = `Likely clock/timezone offset of ${fmtSignedFixed(offsetMin, 0)} min (nearest ${fmtSignedInt(nearestHr)}h), fit ${bestTsScore.toFixed(2)} (${bestTsVerdict}).`;
      } else {
        summary = `Likely time shift of ${fmtSignedFixed(offsetMin, 0)} min, fit ${bestTsScore.toFixed(2)} (${bestTsVerdict}).`;
      }
    } else {
      summary = `Likely seasonal/date shift of ${fmtSignedInt(dateShift!.offsetDays)} days, fit ${dateShift!.fitScore.toFixed(2)} (${dateShift!.verdict}).`;
    }
  } else {
    summary = "No single-axis time, hemisphere, or seasonal shift resolves all observation conflicts.";
  }

  return { timeShift, hemisphereFlip, dateShift, summary };
}

/**
 * Verify physical observations against a claimed `(jdUt, lat, lonEast)`.
 *
 * When `observed` is omitted or empty, acts as a pure ground-truth physical
 * scene and chronosense oracle (`verdict: "unconstrained"`). When `verdict` is
 * `"inconsistent"` or `"impossible"`, counterfactual `diagnostics` probe
 * same-day clock/timezone shifts, hemisphere sign flips, and seasonal date
 * shifts.
 *
 * @param engine Ephemeris engine instance.
 * @param claim Claimed instant, place, terrain, and optional uncertainties.
 * @param observed Optional physical observation constraints.
 * @returns Structured {@link ObservationVerification}.
 */
export function verifyObservation(
  engine: Engine,
  claim: ObservationClaim,
  observed?: ObservedConstraints | null,
): ObservationVerification {
  if (!claim || typeof claim !== "object") {
    throw new RangeError("claim must be an object");
  }
  if (!Number.isFinite(claim.jdUt)) {
    throw new RangeError("claim missing finite jdUt");
  }
  if (!Number.isFinite(claim.lat)) {
    throw new RangeError("claim missing finite lat");
  }
  if (!Number.isFinite(claim.lonEast)) {
    throw new RangeError("claim missing finite lonEast");
  }

  const jdUt = claim.jdUt;
  const lat = claim.lat;
  const lonEast = claim.lonEast;
  const elev = claim.elevationM ?? 0.0;
  const slope = claim.slopeDeg ?? 0.0;
  const slopeAz = claim.slopeAzimuthDeg ?? 0.0;
  const timeTol = claim.timeToleranceMin ?? 0.0;
  const placeTol = claim.placeToleranceDeg ?? 0.0;
  const bortle = claim.bortle;
  if (!(Number.isFinite(timeTol) && timeTol >= 0.0)) {
    throw new RangeError(`timeToleranceMin must be >= 0, got ${timeTol}`);
  }
  if (!(Number.isFinite(placeTol) && placeTol >= 0.0)) {
    throw new RangeError(`placeToleranceDeg must be >= 0, got ${placeTol}`);
  }

  const obs = validateObserved(observed);

  const { scene, baseSnap } = sceneGeometryCore(engine, jdUt, lat, lonEast, {
    elevationM: elev,
    slopeDeg: slope,
    slopeAzimuthDeg: slopeAz,
    bortle,
    cameraAimAzDeg: claim.cameraAimAzDeg,
    cameraAimAltDeg: claim.cameraAimAltDeg ?? 0.0,
    prevJdUt: claim.prevJdUt,
    deadlineJdUt: claim.deadlineJdUt,
  });

  if (!hasActiveConstraints(obs)) {
    return {
      verdict: "unconstrained",
      consistencyScore: null,
      checks: [],
      scene,
      diagnostics: null,
    };
  }

  const [needMoon, extraBodies] = observedNeeds(obs);
  const sweepDt = obs.shadowSweep?.dtMinutes;
  const snap = snapshotAt(engine, jdUt, needMoon, extraBodies, sweepDt, baseSnap);

  let moonRates: [number, number] | null = null;
  let blRate: number | null = null;
  if (timeTol > 0.0 && needMoon) {
    const mpM = engine.position("moon", jdUt - DT_MIN);
    const mpP = engine.position("moon", jdUt + DT_MIN);
    const [mazM, maltM] = azAlt(engine.data, mpM.lon, mpM.lat, jdUt - DT_MIN, lat, lonEast);
    const [mazP, maltP] = azAlt(engine.data, mpP.lon, mpP.lat, jdUt + DT_MIN, lat, lonEast);
    moonRates = [(maltP - maltM) * 0.5, wrap180(mazP - mazM) * 0.5];
    if (obs.moonBrightLimbDeg !== undefined) {
      const spM = engine.position("sun", jdUt - DT_MIN);
      const spP = engine.position("sun", jdUt + DT_MIN);
      const [sazM, saltM] = azAlt(engine.data, spM.lon, spM.lat, jdUt - DT_MIN, lat, lonEast);
      const [sazP, saltP] = azAlt(engine.data, spP.lon, spP.lat, jdUt + DT_MIN, lat, lonEast);
      const [blM] = moonBrightLimb(mazM, maltM, sazM, saltM);
      const [blP] = moonBrightLimb(mazP, maltP, sazP, saltP);
      if (blM !== null && blP !== null) {
        blRate = wrap180(blP - blM) * 0.5;
      }
    }
  }

  let sweepSpread = 0.0;
  if (timeTol > 0.0 && sweepDt !== undefined) {
    const sweepAt = (tStart: number): number => {
      const sp0 = engine.position("sun", tStart);
      const [az0] = azAlt(engine.data, sp0.lon, sp0.lat, tStart, lat, lonEast);
      const nCh = Math.max(1, Math.ceil(sweepDt / 30.0));
      let tot = 0.0;
      let prev = az0;
      for (let i = 1; i <= nCh; i++) {
        const ti = tStart + sweepDt * (i / nCh) * DT_MIN;
        const spi = engine.position("sun", ti);
        const [azi] = azAlt(engine.data, spi.lon, spi.lat, ti, lat, lonEast);
        tot += wrap180(azi - prev);
        prev = azi;
      }
      return tot;
    };
    const s0 = sweepAt(jdUt);
    const sm = sweepAt(jdUt - timeTol * DT_MIN);
    const spV = sweepAt(jdUt + timeTol * DT_MIN);
    sweepSpread = Math.max(Math.abs(sm - s0), Math.abs(spV - s0));
  }

  const sunRates: [number, number] = [scene.sun.rateAltDegPerMin, scene.sun.rateAzDegPerMin];
  const { checks, verdict, score } = evalSnapAtPlace(snap, lat, lonEast, obs, {
    elevationM: elev,
    slopeDeg: slope,
    slopeAzimuthDeg: slopeAz,
    timeTol,
    placeTol,
    bortle,
    sunRates,
    moonRates,
    blRate,
    sweepTimeSpread: sweepSpread,
  });

  let diagnostics: ObservationDiagnostics | null = null;
  if (verdict === "inconsistent" || verdict === "impossible") {
    diagnostics = runDiagnostics(engine, jdUt, lat, lonEast, claim, obs, checks, score);
  }

  return {
    verdict,
    consistencyScore: score,
    checks,
    scene,
    diagnostics,
  };
}

// --------------------------------------------------------------- chronolocate

function canPruneDay(
  engine: Engine, dm: number, lat: number, observed: NormalizedObserved, slopeDeg: number,
): boolean {
  const tolMap = observed.tolerances ?? {};
  const jde = jdTT(dm);
  const eps = trueObliquity(engine.data, jde);
  const sp = engine.position("sun", dm);
  const [, sDecR] = equatorial(sp.lon * DEG, sp.lat * DEG, eps);
  const sDec = sDecR / DEG;

  const hMax = Math.min(90.0, 90.0 - Math.abs(lat - sDec) + 1.5);
  const hMin = Math.max(-90.0, -90.0 + Math.abs(lat + sDec) - 1.5);

  if (observed.sunAltitudeDeg !== undefined) {
    const tol = tolMap.sunAltitudeDeg ?? DEFAULT_TOLERANCES.sunAltitudeDeg;
    const obsH = observed.sunAltitudeDeg;
    if (obsH + tol < hMin || obsH - tol > hMax) return true;
  }

  if (observed.sunVisible !== undefined) {
    if (observed.sunVisible && hMax < -0.5) return true;
    if (!observed.sunVisible && hMin > 0.5) return true;
  }

  if (observed.twilight !== undefined) {
    const [loB, hiB] = TWILIGHT_BANDS[observed.twilight];
    if (hMax < loB - 0.5 || hMin > hiB + 0.5) return true;
  }

  if (observed.shadowBearingDeg !== undefined || observed.shadowSweep !== undefined) {
    if (hMax <= 0.0) return true;
  }

  if (observed.shadowLengthRatio !== undefined) {
    if (hMax <= 0.0) return true;
    if (slopeDeg === 0.0) {
      const obsL = observed.shadowLengthRatio;
      const rel = tolMap.shadowLengthRatioRel ?? DEFAULT_TOLERANCES.shadowLengthRatioRel;
      const absF = tolMap.shadowLengthRatioAbs ?? DEFAULT_TOLERANCES.shadowLengthRatioAbs;
      const hHi = Math.min(89.99, hMax);
      const lMin = Math.cos(hHi * DEG) / Math.sin(hHi * DEG);
      const tolAtMin = tolMap.shadowLengthRatio ?? (rel * lMin + absF);
      if (obsL + tolAtMin + 0.05 < lMin) return true;
      if (hMin > 0.5) {
        const lMax = Math.cos(hMin * DEG) / Math.sin(hMin * DEG);
        const tolAtMax = tolMap.shadowLengthRatio ?? (rel * lMax + absF);
        if (obsL - tolAtMax - 0.05 > lMax) return true;
      }
    }
  }

  const needMoon = (
    observed.moonIllum !== undefined
    || observed.moonWaxing !== undefined
    || observed.moonAltitudeDeg !== undefined
    || observed.moonVisible !== undefined
    || observed.moonAzimuthDeg !== undefined
    || observed.moonBrightLimbDeg !== undefined
  );
  if (needMoon) {
    const mp = engine.position("moon", dm);
    const mph = pheno(engine, "moon", dm);
    const mIllum = mph.phase;
    if (observed.moonIllum !== undefined) {
      const tolI = tolMap.moonIllum ?? DEFAULT_TOLERANCES.moonIllum;
      if (Math.abs(observed.moonIllum - mIllum) > tolI + 0.08) return true;
    }
    if (observed.moonWaxing !== undefined) {
      const eDeg = wrap180(mp.lon - sp.lon);
      if (observed.moonWaxing && eDeg > -170.0 && eDeg < -10.0) return true;
      if (!observed.moonWaxing && eDeg > 10.0 && eDeg < 170.0) return true;
    }
    if (
      observed.moonAltitudeDeg !== undefined
      || observed.moonVisible !== undefined
      || observed.moonAzimuthDeg !== undefined
      || observed.moonBrightLimbDeg !== undefined
    ) {
      const [, mDecR] = equatorial(mp.lon * DEG, mp.lat * DEG, eps);
      const mDec = mDecR / DEG;
      const mhMax = Math.min(90.0, 90.0 - Math.abs(lat - mDec) + 6.0);
      const mhMin = Math.max(-90.0, -90.0 + Math.abs(lat + mDec) - 6.0);
      if (observed.moonAltitudeDeg !== undefined) {
        const tolMh = tolMap.moonAltitudeDeg ?? DEFAULT_TOLERANCES.moonAltitudeDeg;
        const obsMh = observed.moonAltitudeDeg;
        if (obsMh + tolMh < mhMin || obsMh - tolMh > mhMax) return true;
      }
      if (observed.moonVisible === true && mhMax < -1.0) return true;
      if (observed.moonVisible === false && mhMin > 1.0) return true;
      if (
        (observed.moonAzimuthDeg !== undefined || observed.moonBrightLimbDeg !== undefined)
        && mhMax < -3.0
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find every time window in `[jdStart, jdEnd]` at `place` where all physical
 * observations in `observed` hold simultaneously.
 *
 * Prunes impossible days analytically from solar/lunar declinations and lunar
 * phase, scans surviving spans with per-day equatorial unit-vector interpolation
 * and narrow-peak rescue, bisects window edges to sub-second accuracy, and
 * refines each peak with golden-section search.
 *
 * @param engine Ephemeris engine instance.
 * @param place Observer location and terrain metadata.
 * @param observed Physical observation constraints (at least one required).
 * @param jdStart Search range start, Julian Day (UT).
 * @param jdEnd Search range end, Julian Day (UT), strictly greater than `jdStart`.
 * @param opts Optional scan step (`stepMinutes`, default 10) and window cap
 *   (`maxWindows`, default 64).
 * @returns {@link ChronolocateResult} with matching windows and pruning counts.
 */
export function chronolocate(
  engine: Engine,
  place: ObservationPlace,
  observed: ObservedConstraints,
  jdStart: number,
  jdEnd: number,
  opts: ChronolocateOptions = {},
): ChronolocateResult {
  if (!place || typeof place !== "object" || !Number.isFinite(place.lat) || !Number.isFinite(place.lonEast)) {
    throw new RangeError("place must be an object with finite lat and lonEast");
  }
  const lat = place.lat;
  const lonEast = place.lonEast;
  const elev = place.elevationM ?? 0.0;
  const slope = place.slopeDeg ?? 0.0;
  const slopeAz = place.slopeAzimuthDeg ?? 0.0;
  const bortle = place.bortle;
  validatePlace(lat, lonEast, elev, slope, slopeAz);

  if (!(Number.isFinite(jdStart) && Number.isFinite(jdEnd) && jdEnd > jdStart)) {
    throw new RangeError("chronolocate requires finite jdEnd > jdStart");
  }
  const stepMinutes = opts.stepMinutes ?? 10.0;
  const maxWindows = opts.maxWindows ?? 64;
  if (!(Number.isFinite(stepMinutes) && stepMinutes > 0.0)) {
    throw new RangeError("stepMinutes must be > 0");
  }
  if (!(Number.isInteger(maxWindows) && maxWindows >= 1)) {
    throw new RangeError("maxWindows must be an integer >= 1");
  }

  const obs = validateObserved(observed);
  if (!hasActiveConstraints(obs)) {
    throw new RangeError("chronolocate requires at least one observation constraint");
  }

  const [needMoon, extraBodies] = observedNeeds(obs);
  const sweepDt = obs.shadowSweep?.dtMinutes;

  // Partition [jdStart, jdEnd] into 1-day chunks and prune impossible days.
  let daysScanned = 0;
  let daysPruned = 0;
  const survivingSpans: Array<[number, number]> = [];
  let cur = jdStart;
  while (cur < jdEnd - 1e-12) {
    const nxt = Math.min(jdEnd, cur + 1.0);
    const dm = 0.5 * (cur + nxt);
    if (canPruneDay(engine, dm, lat, obs, slope)) {
      daysPruned++;
    } else {
      daysScanned++;
      if (survivingSpans.length > 0 && Math.abs(survivingSpans[survivingSpans.length - 1][1] - cur) < 1e-9) {
        survivingSpans[survivingSpans.length - 1][1] = nxt;
      } else {
        survivingSpans.push([cur, nxt]);
      }
    }
    cur = nxt;
  }

  const exactEval = (t: number): EvalResult => {
    const s = snapshotAt(engine, t, needMoon, extraBodies, sweepDt);
    return evalSnapAtPlace(s, lat, lonEast, obs, {
      elevationM: elev,
      slopeDeg: slope,
      slopeAzimuthDeg: slopeAz,
      bortle,
      chronolocateMode: true,
    });
  };

  const bisectEdge = (loIn: number, hiIn: number, rising: boolean): number => {
    let lo = loIn;
    let hi = hiIn;
    for (let it = 0; it < 22; it++) {
      const mid = 0.5 * (lo + hi);
      const mMid = exactEval(mid).margin;
      if ((mMid >= 0.0) === rising) hi = mid;
      else lo = mid;
    }
    return 0.5 * (lo + hi);
  };

  const dt = stepMinutes * DT_MIN;
  let windows: ChronolocateWindow[] = [];
  let truncated = false;

  for (const [spanA, spanB] of survivingSpans) {
    if (windows.length > maxWindows) {
      truncated = true;
      break;
    }

    let ts: number[] = [];
    let ms: number[] = [];
    let scs: number[] = [];
    let cStart = spanA;
    while (cStart < spanB - 1e-12) {
      const cEnd = Math.min(spanB, cStart + 1.0);
      const cacheFn = buildDayCache(engine, cStart, cEnd, needMoon, extraBodies);
      for (let t = cStart; t < cEnd - 1e-12; t += dt) {
        const snap = cacheFn(t, sweepDt);
        const ev = evalSnapAtPlace(snap, lat, lonEast, obs, {
          elevationM: elev,
          slopeDeg: slope,
          slopeAzimuthDeg: slopeAz,
          bortle,
          chronolocateMode: true,
        });
        ts.push(t);
        ms.push(ev.margin);
        scs.push(ev.score ?? 0.0);
      }
      cStart = cEnd;
    }

    const endEv = exactEval(spanB);
    ts.push(spanB);
    ms.push(endEv.margin);
    scs.push(endEv.score ?? 0.0);

    // Narrow-peak rescue for sub-step feasible windows.
    const rescued: Array<[number, number, number]> = [];
    for (let i = 1; i < ts.length - 1; i++) {
      if (ms[i] > -1.0 && ms[i] < 0.0 && ms[i] >= ms[i - 1] && ms[i] >= ms[i + 1]) {
        const [tp, mp] = goldenMax((x) => exactEval(x).margin, ts[i - 1], ts[i + 1], 12);
        if (mp >= 0.0) {
          const evP = exactEval(tp);
          rescued.push([tp, mp, evP.score ?? 0.0]);
        }
      }
    }
    if (rescued.length > 0) {
      const combined: Array<[number, number, number]> = [];
      for (let i = 0; i < ts.length; i++) combined.push([ts[i], ms[i], scs[i]]);
      for (const r of rescued) combined.push(r);
      combined.sort((a, b) => a[0] - b[0]);
      ts = combined.map((r) => r[0]);
      ms = combined.map((r) => r[1]);
      scs = combined.map((r) => r[2]);
    }

    // Extract contiguous feasible runs (m >= 0).
    let i = 0;
    const nPts = ts.length;
    while (i < nPts) {
      if (ms[i] < 0.0) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < nPts && ms[j + 1] >= 0.0) j++;

      const wStart = i === 0 ? spanA : bisectEdge(ts[i - 1], ts[i], true);
      const wEnd = j === nPts - 1 ? spanB : bisectEdge(ts[j], ts[j + 1], false);

      let bestIdx = i;
      let allFlat = scs[i] >= 0.999999;
      for (let k = i + 1; k <= j; k++) {
        if (scs[k] < 0.999999) allFlat = false;
        if (scs[k] > scs[bestIdx] || (scs[k] === scs[bestIdx] && ms[k] > ms[bestIdx])) {
          bestIdx = k;
        }
      }

      let bestJd: number;
      if (allFlat) {
        bestJd = 0.5 * (wStart + wEnd);
      } else {
        const ra = bestIdx === i ? wStart : Math.max(wStart, ts[bestIdx - 1]);
        const rb = bestIdx === j ? wEnd : Math.min(wEnd, ts[bestIdx + 1]);
        [bestJd] = goldenMax((x) => {
          const ev = exactEval(x);
          return (ev.score ?? 0.0) + 1e-6 * ev.margin;
        }, ra, rb, 20);
      }

      const bestEv = exactEval(bestJd);
      if (bestEv.margin >= -1e-6 && wEnd >= wStart) {
        windows.push({
          jdStart: wStart,
          jdEnd: wEnd,
          bestJd,
          durationMinutes: (wEnd - wStart) * 1440.0,
          fitScore: bestEv.score ?? 0.0,
          maxNormalizedResidual: bestEv.maxNormRes,
        });
        if (windows.length > maxWindows) {
          truncated = true;
          break;
        }
      }
      i = j + 1;
    }
  }

  if (windows.length > maxWindows) {
    windows = windows.slice(0, maxWindows);
    truncated = true;
  }

  return {
    place: {
      lat,
      lonEast,
      elevationM: elev,
      slopeDeg: slope,
      slopeAzimuthDeg: slope > 0.0 ? mod(slopeAz, 360.0) : 0.0,
    },
    jdStart,
    jdEnd,
    daysScanned,
    daysPruned,
    windows,
    truncated,
  };
}

// ----------------------------------------------------------------- geolocate

function lonInBounds(lon: number, lonMin: number, lonMax: number, fullGlobe: boolean): boolean {
  if (fullGlobe) return true;
  if (lonMin <= lonMax) return lon >= lonMin - 1e-9 && lon <= lonMax + 1e-9;
  return lon >= lonMin - 1e-9 || lon <= lonMax + 1e-9;
}

function clampLonToBounds(lonIn: number, lonMin: number, lonMax: number, fullGlobe: boolean): number {
  const lon = wrap180(lonIn);
  if (fullGlobe || lonInBounds(lon, lonMin, lonMax, false)) return lon;
  const dLo = Math.abs(wrap180(lon - lonMin));
  const dHi = Math.abs(wrap180(lon - lonMax));
  return dLo <= dHi ? lonMin : lonMax;
}

function classifyRegion(radiusKm: number, majorKm: number, minorKm: number): GeolocateRegionKind {
  if (radiusKm <= 250.0) return "point";
  if (majorKm / Math.max(1.0, minorKm) >= 2.5) return "arc";
  return "band";
}

const PATTERN_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.70710678, 0.70710678], [0.70710678, -0.70710678],
  [-0.70710678, 0.70710678], [-0.70710678, -0.70710678],
];

function patternRefine(
  evalObj: (lat: number, lon: number) => number,
  lat0: number,
  lon0: number,
  initStep: number,
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  fullGlobe: boolean,
  minStep = 0.002,
): [number, number, number] {
  let lat = lat0;
  let lon = wrap180(lon0);
  let bestVal = evalObj(lat, lon);
  let step = initStep;
  while (step >= minStep) {
    for (let iter = 0; iter < 4; iter++) {
      const cosLat = Math.max(0.15, Math.cos(lat * DEG));
      let candBest: [number, number] | null = null;
      for (const [dy, dx] of PATTERN_DIRS) {
        const nlat = Math.max(latMin, Math.min(latMax, lat + dy * step));
        const nlon = clampLonToBounds(lon + (dx * step) / cosLat, lonMin, lonMax, fullGlobe);
        const val = evalObj(nlat, nlon);
        if (val > bestVal) {
          bestVal = val;
          candBest = [nlat, nlon];
        }
      }
      if (candBest !== null) {
        [lat, lon] = candBest;
      } else {
        break;
      }
    }
    step *= 0.5;
  }
  return [lat, lon, bestVal];
}

function analyticalGeolocate(
  snap: GeocentricSnapshot,
  obs: NormalizedObserved,
  pressure: number,
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  fullGlobe: boolean,
  elevationM: number,
  bortle: number | undefined,
  maxCandidates: number,
): GeolocateCandidate[] | null {
  const tolMap = obs.tolerances ?? {};
  let azObs: number;
  let sigmaAz: number;
  if (obs.sunAzimuthDeg !== undefined) {
    azObs = obs.sunAzimuthDeg;
    sigmaAz = tolMap.sunAzimuthDeg ?? DEFAULT_TOLERANCES.sunAzimuthDeg;
  } else {
    azObs = mod(obs.shadowBearingDeg! + 180.0, 360.0);
    sigmaAz = tolMap.shadowBearingDeg ?? DEFAULT_TOLERANCES.shadowBearingDeg;
  }

  let hAppObs: number;
  let sigmaH: number;
  if (obs.sunAltitudeDeg !== undefined) {
    hAppObs = obs.sunAltitudeDeg;
    sigmaH = tolMap.sunAltitudeDeg ?? DEFAULT_TOLERANCES.sunAltitudeDeg;
  } else {
    const lObs = obs.shadowLengthRatio!;
    hAppObs = Math.atan2(1.0, lObs) / DEG;
    const tolL = tolMap.shadowLengthRatio !== undefined
      ? tolMap.shadowLengthRatio
      : (tolMap.shadowLengthRatioRel ?? DEFAULT_TOLERANCES.shadowLengthRatioRel) * lObs
        + (tolMap.shadowLengthRatioAbs ?? DEFAULT_TOLERANCES.shadowLengthRatioAbs);
    sigmaH = Math.max(0.25, tolL / ((1.0 + lObs * lObs) * DEG));
  }

  const raS = snap.sunRa;
  const decS = snap.sunDec;
  const g = snap.gast;
  const subsolarLat = decS / DEG;
  const subsolarLon = wrap180((raS - g) / DEG);

  let seeds: Array<[number, number]>;
  if (hAppObs > ZENITH_INDET_DEG) {
    seeds = [[subsolarLat, subsolarLon]];
  } else {
    const hTrueR = refractApparentToTrue(hAppObs, pressure) * DEG;
    const azR = azObs * DEG;
    const a = Math.sin(hTrueR);
    const b = Math.cos(hTrueR) * Math.cos(azR);
    const c = Math.sin(decS);
    const R = Math.hypot(a, b);
    if (R < 1e-4) {
      // Degenerate due-East/West horizon case: signal fallback to Path B.
      return null;
    }
    const ratio = c / R;
    if (Math.abs(ratio) > 1.05) {
      // No exact root (e.g. noisy low-Sun due-E/W within tolerance): fall back to Path B.
      return null;
    }
    const alpha = Math.asin(clamp1(ratio));
    const gamma = Math.atan2(b, a);
    const rawPhis = [wrapPi(alpha - gamma), wrapPi(Math.PI - alpha - gamma)];
    seeds = [];
    for (const phi of rawPhis) {
      if (Math.abs(phi) >= Math.PI * 0.5 - 1e-6) continue;
      const latC = phi / DEG;
      if (seeds.some((s) => Math.abs(latC - s[0]) < 1e-5)) continue;
      const ha = Math.atan2(
        -Math.cos(hTrueR) * Math.sin(azR),
        Math.cos(phi) * Math.sin(hTrueR) - Math.sin(phi) * Math.cos(hTrueR) * Math.cos(azR),
      );
      const lonC = wrap180((ha + raS - g) / DEG);
      seeds.push([latC, lonC]);
    }
    if (seeds.length === 0) return null;
  }

  const sunAzAltApp = (la: number, lo: number): [number, number] => {
    const lst = mod(g + lo * DEG, TWO_PI);
    const [az, altT] = azAltFromEq(raS, decS, lst, la);
    return [az, refractTrueToApparent(altT, pressure)];
  };

  const candidates: GeolocateCandidate[] = [];
  const epsJ = 1e-4;
  for (const [lat0, lon0] of seeds) {
    let la = lat0;
    let lo = lon0;
    if (hAppObs <= ZENITH_INDET_DEG) {
      for (let step = 0; step < 4; step++) {
        const [azC, hC] = sunAzAltApp(la, lo);
        const r0 = wrap180(azC - azObs);
        const r1 = hC - hAppObs;
        if (Math.abs(r0) < 1e-8 && Math.abs(r1) < 1e-8) break;
        const [azLp, hLp] = sunAzAltApp(Math.min(89.99, la + epsJ), lo);
        const [azLm, hLm] = sunAzAltApp(Math.max(-89.99, la - epsJ), lo);
        const [azOp, hOp] = sunAzAltApp(la, wrap180(lo + epsJ));
        const [azOm, hOm] = sunAzAltApp(la, wrap180(lo - epsJ));
        const j00 = wrap180(azLp - azLm) / (2.0 * epsJ);
        const j01 = wrap180(azOp - azOm) / (2.0 * epsJ);
        const j10 = (hLp - hLm) / (2.0 * epsJ);
        const j11 = (hOp - hOm) / (2.0 * epsJ);
        const a00 = j00 * j00 + j10 * j10 + 1e-6;
        const a01 = j00 * j01 + j10 * j11;
        const a11 = j01 * j01 + j11 * j11 + 1e-6;
        const b0 = -(j00 * r0 + j10 * r1);
        const b1 = -(j01 * r0 + j11 * r1);
        const det = a00 * a11 - a01 * a01;
        if (Math.abs(det) < 1e-18) break;
        const dLa = Math.max(-10.0, Math.min(10.0, (a11 * b0 - a01 * b1) / det));
        const dLo = Math.max(-20.0, Math.min(20.0, (-a01 * b0 + a00 * b1) / det));
        la = Math.max(-89.99, Math.min(89.99, la + dLa));
        lo = wrap180(lo + dLo);
        if (Math.hypot(dLa, dLo) < 1e-8) break;
      }
    }

    if (!(la >= latMin - 1e-6 && la <= latMax + 1e-6 && lonInBounds(lo, lonMin, lonMax, fullGlobe))) {
      continue;
    }

    let ev = evalSnapAtPlace(snap, la, lo, obs, { elevationM, bortle });
    if (ev.margin < 0.0 && ev.maxNormRes <= 2.2) {
      const jointObj = (xla: number, xlo: number): number => {
        const x = evalSnapAtPlace(snap, xla, xlo, obs, { elevationM, bortle });
        return x.margin < 0.0 ? x.margin : 1.0 + (x.score ?? 0.0);
      };
      const [laR, loR] = patternRefine(
        jointObj, la, lo, 1.5, latMin, latMax, lonMin, lonMax, fullGlobe, 0.005,
      );
      const evR = evalSnapAtPlace(snap, laR, loR, obs, { elevationM, bortle });
      if (evR.margin > ev.margin) {
        la = laR;
        lo = loR;
        ev = evR;
      }
    }

    if (ev.margin < 0.0 || ev.verdict !== "consistent") continue;

    let dLat: number;
    let dLon: number;
    let radiusKm: number;
    let majorKm: number;
    let minorKm: number;
    if (hAppObs > ZENITH_INDET_DEG) {
      dLat = Math.min(90.0, sigmaH);
      dLon = Math.min(180.0, sigmaH / Math.max(0.1, Math.cos(la * DEG)));
      radiusKm = sigmaH * DEG * EARTH_RADIUS_KM;
      majorKm = radiusKm;
      minorKm = radiusKm;
    } else {
      const [azLp, hLp] = sunAzAltApp(Math.min(89.99, la + epsJ), lo);
      const [azLm, hLm] = sunAzAltApp(Math.max(-89.99, la - epsJ), lo);
      const [azOp, hOp] = sunAzAltApp(la, wrap180(lo + epsJ));
      const [azOm, hOm] = sunAzAltApp(la, wrap180(lo - epsJ));
      const j00 = wrap180(azLp - azLm) / (2.0 * epsJ);
      const j01 = wrap180(azOp - azOm) / (2.0 * epsJ);
      const j10 = (hLp - hLm) / (2.0 * epsJ);
      const j11 = (hOp - hOm) / (2.0 * epsJ);
      const det = j00 * j11 - j01 * j10;
      if (Math.abs(det) < 1e-8) {
        dLat = Math.min(45.0, sigmaH * 2.0);
        dLon = Math.min(90.0, sigmaAz * 2.0);
        radiusKm = Math.max(dLat, dLon * Math.cos(la * DEG)) * DEG * EARTH_RADIUS_KM;
        majorKm = radiusKm;
        minorKm = sigmaH * DEG * EARTH_RADIUS_KM;
      } else {
        const inv00 = j11 / det;
        const inv01 = -j01 / det;
        const inv10 = -j10 / det;
        const inv11 = j00 / det;
        const sa2 = sigmaAz * sigmaAz;
        const sh2 = sigmaH * sigmaH;
        const covLl = inv00 * inv00 * sa2 + inv01 * inv01 * sh2;
        const covOo = inv10 * inv10 * sa2 + inv11 * inv11 * sh2;
        const covLo = inv00 * inv10 * sa2 + inv01 * inv11 * sh2;
        dLat = Math.min(90.0, Math.sqrt(Math.max(0.0, covLl)));
        dLon = Math.min(180.0, Math.sqrt(Math.max(0.0, covOo)));
        const ky = DEG * EARTH_RADIUS_KM;
        const kx = Math.max(0.05, Math.cos(la * DEG)) * DEG * EARTH_RADIUS_KM;
        const cyy = covLl * ky * ky;
        const cxx = covOo * kx * kx;
        const cxy = covLo * kx * ky;
        const tr = cxx + cyy;
        const disc = Math.sqrt(Math.max(0.0, (cxx - cyy) * (cxx - cyy) + 4.0 * cxy * cxy));
        const lam1 = 0.5 * (tr + disc);
        const lam2 = Math.max(0.0, 0.5 * (tr - disc));
        majorKm = Math.sqrt(lam1);
        minorKm = Math.sqrt(lam2);
        radiusKm = majorKm;
      }
    }

    const latRange: [number, number] = [Math.max(-90.0, la - dLat), Math.min(90.0, la + dLat)];
    const lonRange: [number, number] = dLon >= 179.0
      ? [-180.0, 180.0]
      : [wrap180(lo - dLon), wrap180(lo + dLon)];

    candidates.push({
      lat: la,
      lon: lo,
      fitScore: ev.score ?? 0.0,
      maxNormalizedResidual: ev.maxNormRes,
      radiusKm,
      latRange,
      lonRange,
      regionKind: classifyRegion(radiusKm, majorKm, minorKm),
    });
  }

  candidates.sort(
    (a, b) => (b.fitScore - a.fitScore)
      || (a.maxNormalizedResidual - b.maxNormalizedResidual)
      || (a.lat - b.lat)
      || (a.lon - b.lon),
  );
  return candidates.slice(0, maxCandidates);
}

function gridGeolocate(
  snap: GeocentricSnapshot,
  obs: NormalizedObserved,
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  fullGlobe: boolean,
  gridStepDeg: number,
  maxCandidates: number,
  elevationM: number,
  slopeDeg: number,
  slopeAzimuthDeg: number,
  bortle: number | undefined,
): GeolocateCandidate[] {
  const lats: number[] = [];
  for (let v = latMin; v < latMax - 1e-9; v += gridStepDeg) lats.push(v);
  lats.push(latMax);
  const nLat = lats.length;

  let lons: number[];
  let wrapLon: boolean;
  if (fullGlobe) {
    const nLonCalc = Math.max(4, Math.round(360.0 / gridStepDeg));
    const lonStep = 360.0 / nLonCalc;
    lons = [];
    for (let j = 0; j < nLonCalc; j++) lons.push(wrap180(-180.0 + j * lonStep));
    wrapLon = true;
  } else {
    lons = [];
    const spanLon = lonMin <= lonMax ? lonMax - lonMin : 360.0 - lonMin + lonMax;
    const nSteps = Math.max(1, Math.floor(spanLon / gridStepDeg));
    for (let j = 0; j <= nSteps; j++) {
      lons.push(wrap180(lonMin + Math.min(spanLon, j * gridStepDeg)));
    }
    if (Math.abs(wrap180(lons[lons.length - 1] - lonMax)) > 1e-6) {
      lons.push(wrap180(lonMax));
    }
    wrapLon = false;
  }
  const nLon = lons.length;

  const evalPt = (la: number, lo: number): [ObservationVerdict, number, number, number] => {
    const ev = evalSnapAtPlace(snap, la, lo, obs, {
      elevationM,
      slopeDeg,
      slopeAzimuthDeg,
      bortle,
    });
    return [ev.verdict, ev.score ?? 0.0, ev.maxNormRes, ev.margin];
  };

  const margins: number[][] = Array.from({ length: nLat }, () => new Array<number>(nLon).fill(0.0));
  const scores: number[][] = Array.from({ length: nLat }, () => new Array<number>(nLon).fill(0.0));
  const feasible: boolean[][] = Array.from({ length: nLat }, () => new Array<boolean>(nLon).fill(false));

  for (let i = 0; i < nLat; i++) {
    const la = lats[i];
    for (let j = 0; j < nLon; j++) {
      const [v, sc, , mv] = evalPt(la, lons[j]);
      margins[i][j] = mv;
      scores[i][j] = sc;
      feasible[i][j] = mv >= 0.0 && v === "consistent";
    }
  }

  // 8-connected BFS clustering with antimeridian wrap.
  const visited: boolean[][] = Array.from({ length: nLat }, () => new Array<boolean>(nLon).fill(false));
  const clusters: Array<Array<[number, number]>> = [];
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      if (!feasible[i][j] || visited[i][j]) continue;
      const comp: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[i, j]];
      visited[i][j] = true;
      while (stack.length > 0) {
        const [ci, cj] = stack.pop()!;
        comp.push([ci, cj]);
        for (let di = -1; di <= 1; di++) {
          const ni = ci + di;
          if (ni < 0 || ni >= nLat) continue;
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            let nj: number;
            if (wrapLon) {
              nj = mod(cj + dj, nLon);
            } else {
              nj = cj + dj;
              if (nj < 0 || nj >= nLon) continue;
            }
            if (feasible[ni][nj] && !visited[ni][nj]) {
              visited[ni][nj] = true;
              stack.push([ni, nj]);
            }
          }
        }
      }
      clusters.push(comp);
    }
  }

  // Isolated near-miss local maxima for sub-grid fixes.
  const rescueSeeds: Array<[number, number, number]> = [];
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      if (feasible[i][j] || margins[i][j] < -1.2) continue;
      const mIj = margins[i][j];
      let isLocalMax = true;
      let touchesFeasible = false;
      for (let di = -1; di <= 1; di++) {
        const ni = i + di;
        if (ni < 0 || ni >= nLat) continue;
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          let nj: number;
          if (wrapLon) {
            nj = mod(j + dj, nLon);
          } else {
            nj = j + dj;
            if (nj < 0 || nj >= nLon) continue;
          }
          if (feasible[ni][nj]) {
            touchesFeasible = true;
            break;
          }
          if (margins[ni][nj] > mIj) isLocalMax = false;
        }
        if (touchesFeasible) break;
      }
      if (isLocalMax && !touchesFeasible) rescueSeeds.push([mIj, i, j]);
    }
  }
  rescueSeeds.sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]) || (b[2] - a[2]));

  const refineObj = (la: number, lo: number): number => {
    const [v, sc, , mv] = evalPt(la, lo);
    if (mv < 0.0 || v !== "consistent") return mv - 1.0;
    return sc + 1e-5 * mv;
  };

  const probeExtent = (
    peakLa: number, peakLo: number, cellPts: Array<[number, number]>,
  ): [number, [number, number], [number, number], GeolocateRegionKind] => {
    const pts: Array<[number, number]> = [[peakLa, peakLo], ...cellPts];
    if (cellPts.length <= 9) {
      const cosP = Math.max(0.15, Math.cos(peakLa * DEG));
      for (const [dy, dx] of PATTERN_DIRS) {
        let loD = 0.0;
        let hiD = gridStepDeg * 2.0;
        const tla = Math.max(latMin, Math.min(latMax, peakLa + dy * hiD));
        const tlo = clampLonToBounds(peakLo + (dx * hiD) / cosP, lonMin, lonMax, fullGlobe);
        if (evalPt(tla, tlo)[3] >= 0.0) {
          pts.push([tla, tlo]);
        } else {
          for (let it = 0; it < 10; it++) {
            const mid = 0.5 * (loD + hiD);
            const mla = Math.max(latMin, Math.min(latMax, peakLa + dy * mid));
            const mlo = clampLonToBounds(peakLo + (dx * mid) / cosP, lonMin, lonMax, fullGlobe);
            if (evalPt(mla, mlo)[3] >= 0.0) loD = mid;
            else hiD = mid;
          }
          if (loD > 0.0) {
            const fla = Math.max(latMin, Math.min(latMax, peakLa + dy * loD));
            const flo = clampLonToBounds(peakLo + (dx * loD) / cosP, lonMin, lonMax, fullGlobe);
            pts.push([fla, flo]);
          }
        }
      }
    }

    let latLo = pts[0][0];
    let latHi = pts[0][0];
    for (const p of pts) {
      if (p[0] < latLo) latLo = p[0];
      if (p[0] > latHi) latHi = p[0];
    }

    // Exact minimum circular bounding arc on S^1 for longitude range.
    const uLons = pts.map((p) => mod(p[1], 360.0)).sort((a, b) => a - b);
    let lonRng: [number, number];
    if (uLons.length === 1 || uLons[uLons.length - 1] - uLons[0] < 1e-9) {
      const w = wrap180(uLons[0]);
      lonRng = [w, w];
    } else {
      let bestGap = -1.0;
      let bestK = 0;
      const nU = uLons.length;
      for (let k = 0; k < nU; k++) {
        const gap = mod(uLons[(k + 1) % nU] - uLons[k], 360.0);
        if (gap > bestGap) {
          bestGap = gap;
          bestK = k;
        }
      }
      if (bestGap <= Math.max(gridStepDeg * 1.5, 5.0)) {
        lonRng = [-180.0, 180.0];
      } else {
        lonRng = [wrap180(uLons[(bestK + 1) % nU]), wrap180(uLons[bestK])];
      }
    }

    let radiusKm = 0.0;
    for (const p of pts) {
      const d = haversineKm(peakLa, peakLo, p[0], p[1]);
      if (d > radiusKm) radiusKm = d;
    }

    // 2D tangent-plane PCA for elongation (arc vs band).
    const cosP = Math.max(0.15, Math.cos(peakLa * DEG));
    const nPts = pts.length;
    const dxs = new Array<number>(nPts);
    const dys = new Array<number>(nPts);
    let mx = 0.0;
    let my = 0.0;
    for (let k = 0; k < nPts; k++) {
      const dl = wrap180(pts[k][1] - peakLo);
      dxs[k] = dl * cosP * DEG * EARTH_RADIUS_KM;
      dys[k] = (pts[k][0] - peakLa) * DEG * EARTH_RADIUS_KM;
      mx += dxs[k];
      my += dys[k];
    }
    mx /= nPts;
    my /= nPts;
    let sxx = 0.0;
    let syy = 0.0;
    let sxy = 0.0;
    for (let k = 0; k < nPts; k++) {
      const ex = dxs[k] - mx;
      const ey = dys[k] - my;
      sxx += ex * ex;
      syy += ey * ey;
      sxy += ex * ey;
    }
    sxx /= nPts;
    syy /= nPts;
    sxy /= nPts;
    const tr = sxx + syy;
    const disc = Math.sqrt(Math.max(0.0, (sxx - syy) * (sxx - syy) + 4.0 * sxy * sxy));
    const major = Math.sqrt(Math.max(0.0, 0.5 * (tr + disc)));
    const minor = Math.sqrt(Math.max(0.0, 0.5 * (tr - disc)));
    return [radiusKm, [latLo, latHi], lonRng, classifyRegion(radiusKm, major, minor)];
  };

  const rawCandidates: GeolocateCandidate[] = [];
  for (const comp of clusters) {
    let bestCell = comp[0];
    let bestSc = scores[bestCell[0]][bestCell[1]];
    let bestM = margins[bestCell[0]][bestCell[1]];
    for (let k = 1; k < comp.length; k++) {
      const [ci, cj] = comp[k];
      const scK = scores[ci][cj];
      const mK = margins[ci][cj];
      if (scK > bestSc || (scK === bestSc && mK > bestM)) {
        bestCell = comp[k];
        bestSc = scK;
        bestM = mK;
      }
    }
    const la0 = lats[bestCell[0]];
    const lo0 = lons[bestCell[1]];
    let [la, lo] = patternRefine(
      refineObj, la0, lo0, gridStepDeg * 0.5, latMin, latMax, lonMin, lonMax, fullGlobe,
    );
    let [v, sc, maxNr, mv] = evalPt(la, lo);
    if (mv < 0.0 || v !== "consistent") {
      la = la0;
      lo = lo0;
      [v, sc, maxNr, mv] = evalPt(la, lo);
    }
    const cellPts: Array<[number, number]> = comp.map(([ci, cj]) => [lats[ci], lons[cj]]);
    const [rad, latR, lonR, rkind] = probeExtent(la, lo, cellPts);
    rawCandidates.push({
      lat: la,
      lon: lo,
      fitScore: sc,
      maxNormalizedResidual: maxNr,
      radiusKm: rad,
      latRange: latR,
      lonRange: lonR,
      regionKind: rkind,
    });
  }

  for (const [, ri, rj] of rescueSeeds.slice(0, 16)) {
    const [la, lo] = patternRefine(
      refineObj, lats[ri], lons[rj], gridStepDeg * 0.5, latMin, latMax, lonMin, lonMax, fullGlobe,
    );
    const [v, sc, maxNr, mv] = evalPt(la, lo);
    if (mv >= 0.0 && v === "consistent") {
      const [rad, latR, lonR, rkind] = probeExtent(la, lo, []);
      rawCandidates.push({
        lat: la,
        lon: lo,
        fitScore: sc,
        maxNormalizedResidual: maxNr,
        radiusKm: rad,
        latRange: latR,
        lonRange: lonR,
        regionKind: rkind,
      });
    }
  }

  rawCandidates.sort(
    (a, b) => (b.fitScore - a.fitScore)
      || (a.maxNormalizedResidual - b.maxNormalizedResidual)
      || (a.lat - b.lat)
      || (a.lon - b.lon),
  );
  const deduped: GeolocateCandidate[] = [];
  const minSepKm = Math.max(150.0, gridStepDeg * 1.1 * DEG * EARTH_RADIUS_KM);
  for (const cand of rawCandidates) {
    const dup = deduped.some(
      (prev) => haversineKm(cand.lat, cand.lon, prev.lat, prev.lon) < minSepKm
        && cand.radiusKm <= prev.radiusKm + minSepKm,
    );
    if (dup) continue;
    deduped.push(cand);
    if (deduped.length >= maxCandidates) break;
  }

  return deduped;
}

/**
 * Estimate Earth locations compatible with physical observations at a fixed
 * UT Julian Day `jdUt`.
 *
 * Uses Path A (`method: "analytical"`, closed-form spherical celestial
 * navigation plus damped Gauss-Newton refinement) on flat ground whenever both
 * solar direction and solar elevation are observed, and Path B (`method: "grid"`,
 * precomputed pure-trig global spherical grid with antimeridian-safe clustering
 * and local refinement) otherwise.
 *
 * @param engine Ephemeris engine instance.
 * @param jdUt Fixed observation instant, Julian Day (UT).
 * @param observed Physical observation constraints (at least one required).
 * @param opts Optional bounding box, grid step, candidate cap, elevation,
 *   terrain slope, and Bortle class.
 * @returns {@link GeolocateResult} with subsolar/sublunar points and ranked candidates.
 */
export function geolocate(
  engine: Engine,
  jdUt: number,
  observed: ObservedConstraints,
  opts: GeolocateOptions = {},
): GeolocateResult {
  const latMin = opts.latMin ?? -70.0;
  const latMax = opts.latMax ?? 70.0;
  const lonMin = opts.lonMin ?? -180.0;
  const lonMax = opts.lonMax ?? 180.0;
  const gridStepDeg = opts.gridStepDeg ?? 4.0;
  const maxCandidates = opts.maxCandidates ?? 12;
  const elevationM = opts.elevationM ?? 0.0;
  const slopeDeg = opts.slopeDeg ?? 0.0;
  const slopeAzimuthDeg = opts.slopeAzimuthDeg ?? 0.0;
  const bortle = opts.bortle;

  if (!Number.isFinite(jdUt)) {
    throw new RangeError("geolocate requires finite jdUt");
  }
  if (!(Number.isFinite(latMin) && Number.isFinite(latMax) && latMin >= -90.0 && latMin < latMax && latMax <= 90.0)) {
    throw new RangeError("geolocate requires -90 <= latMin < latMax <= 90");
  }
  if (!(Number.isFinite(lonMin) && Number.isFinite(lonMax))) {
    throw new RangeError("geolocate requires finite lonMin and lonMax");
  }
  if (!(Number.isFinite(gridStepDeg) && gridStepDeg > 0.0)) {
    throw new RangeError("gridStepDeg must be > 0");
  }
  if (!(Number.isInteger(maxCandidates) && maxCandidates >= 1)) {
    throw new RangeError("maxCandidates must be an integer >= 1");
  }
  validatePlace(0.0, 0.0, elevationM, slopeDeg, slopeAzimuthDeg);

  const obs = validateObserved(observed);
  if (!hasActiveConstraints(obs)) {
    throw new RangeError("geolocate requires at least one observation constraint");
  }

  const [, extraBodies] = observedNeeds(obs);
  const sweepDt = obs.shadowSweep?.dtMinutes;
  // Always precompute Moon so sublunar point is always returned.
  const snap = snapshotAt(engine, jdUt, true, extraBodies, sweepDt);

  const g = snap.gast;
  const subsolar: SubBodyPoint = {
    lat: snap.sunDec / DEG,
    lon: wrap180((snap.sunRa - g) / DEG),
  };
  const sublunar: SubBodyPoint = {
    lat: snap.moon!.dec / DEG,
    lon: wrap180((snap.moon!.ra - g) / DEG),
  };

  const fullGlobe = lonMax - lonMin >= 360.0 - 1e-9;
  const pressure = pressureAtElevation(elevationM);

  const hasSunDir = obs.sunAzimuthDeg !== undefined || obs.shadowBearingDeg !== undefined;
  const hasSunAlt = obs.sunAltitudeDeg !== undefined || obs.shadowLengthRatio !== undefined;

  let method: GeolocateMethod = "grid";
  let candidates: GeolocateCandidate[] | null = null;
  if (slopeDeg === 0.0 && hasSunDir && hasSunAlt) {
    const cands = analyticalGeolocate(
      snap, obs, pressure, latMin, latMax, lonMin, lonMax,
      fullGlobe, elevationM, bortle, maxCandidates,
    );
    if (cands !== null) {
      method = "analytical";
      candidates = cands;
    }
  }

  if (candidates === null) {
    method = "grid";
    candidates = gridGeolocate(
      snap, obs, latMin, latMax, lonMin, lonMax, fullGlobe,
      gridStepDeg, maxCandidates, elevationM, slopeDeg, slopeAzimuthDeg, bortle,
    );
  }

  return {
    jdUt,
    method,
    subsolar,
    sublunar,
    candidates,
  };
}
