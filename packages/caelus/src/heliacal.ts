/**
 * astroengine heliacal -- first and last visibility: heliacal risings and
 * settings, the evening and morning apparitions of Mercury and Venus, the new
 * and old crescent of the Moon.
 *
 * A star or planet near the Sun is lost in the glare for days or months. The
 * day it is first seen again before sunrise (its heliacal rising, "morning
 * first") and the day it is last seen after sunset (its heliacal setting,
 * "evening last") are what ancient records report, so they are computed here
 * as an observer would meet them: from how bright the sky is where the body
 * stands, how much the air dims it, and how faint a point the eye can pick
 * out against that sky.
 *
 * Two methods.
 *
 * `"visibility"` (the default) is a physical model. The sky's brightness at
 * the body is the sum of the night sky, twilight, and moonlight; the body's
 * light is dimmed by Rayleigh scattering, ozone, and aerosols along its own
 * path; and the eye's threshold against that background follows Hecht's fit
 * to the Knoll, Tousey and Hulburt data. The formulas are those Schaefer
 * published for the purpose (B. E. Schaefer, "To the Visual Limits", Sky &
 * Telescope, May 1998, p. 57; "Telescopic limiting magnitudes", PASP 102,
 * 212, 1990; K. Krisciunas & B. E. Schaefer, "A model of the brightness of
 * moonlight", PASP 103, 1033, 1991), implemented from the published
 * equations. The atmosphere is one explicit number, the V-band extinction
 * coefficient in magnitudes per air mass; every result echoes the value
 * used. Because nobody knows the haze on a morning three thousand years ago,
 * each event is computed three times, at the stated coefficient and at that
 * coefficient less and plus `spread`, and the result carries the earliest
 * and latest date as well as the nominal one.
 *
 * `"arcus"` is the classical geometric rule: the event falls on the day the
 * Sun's depression below the horizon, at the moment the body stands on the
 * horizon with refraction disregarded, reaches a stated angle, the arcus
 * visionis (C. Schoch, MNRAS 84, 731, 1924). The angle must be given; the
 * engine has no table of them. This method also serves the two phenomena at
 * opposition, the acronychal rising (the last evening the body rises with
 * the Sun at least that far down) and the cosmical setting (the first
 * morning it sets so).
 *
 * The Moon's first and last crescent use neither. They use Yallop's q test
 * (B. D. Yallop, "A method for predicting the first sighting of the new
 * crescent moon", NAO Technical Note 69, 1997), the Nautical Almanac
 * Office's fit to 295 recorded sightings.
 *
 * Mirrors the Python reference (astroengine/heliacal.py); the golden
 * fixtures pin the two implementations together.
 */
import { Engine, type BodyId } from "./chart.js";
import { DEG, equatorial, jdTT, mod, trueObliquity } from "./core.js";
import { riseSet } from "./events.js";
import { gast } from "./houses.js";
import { pheno, refractTrueToApparent } from "./pheno.js";

const TWO_PI = 2.0 * Math.PI;
const EARTH_RADIUS_KM = 6378.14;
const KM_PER_AU = 149597870.7;

/** The events {@link heliacal} finds. */
export const HELIACAL_KINDS = [
  "morning_first", "evening_last", "evening_first", "morning_last",
  "acronychal_rising", "cosmical_setting",
] as const;

export type HeliacalKind = (typeof HELIACAL_KINDS)[number];

/** How {@link heliacal} decides the day: the physical model or the classical
 *  geometric rule. */
export type HeliacalMethod = "visibility" | "arcus";

const ALIASES: Record<string, HeliacalKind> = {
  heliacal_rising: "morning_first", heliacal_setting: "evening_last",
};
const INNER = ["mercury", "venus"];
const PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

/** The default atmosphere: a clear sea-level sky, V-band magnitudes per air
 *  mass. Echoed in every result. */
export const HELIACAL_EXTINCTION = 0.25;
/** The default half-width of the clearer-to-hazier range each event is
 *  recomputed over. */
export const HELIACAL_SPREAD = 0.05;

// Schaefer (1998), V band.
const MO = -11.05;         // zero point
const MS = -26.74;         // the Sun
const B0 = 1.0e-13;        // night sky at the zenith
const NL = 1.11e-15;       // that unit per nanolambert
const K_RAYLEIGH = 0.1066; // at sea level; scale height 8200 m
const K_OZONE = 0.031;

const SUN_DOWN_DEG = -0.8333; // the Sun's upper limb on the apparent horizon
const SID_RATE = 360.98564736629 * DEG; // rad per day
const STEP = 1.0 / 720.0;     // two minutes
const GOLD = 0.6180339887498949;

// Yallop's zones, by the lower bound of q.
const YALLOP_ZONES: [string, number][] = [
  ["A", 0.216], ["B", -0.014], ["C", -0.160], ["D", -0.232], ["E", -0.293],
];
const Q_VISIBLE = -0.014; // zone B: visible under perfect conditions
const Q_EASY = 0.216;     // zone A: easily visible

// ---------------------------------------------------------------- the sky

const xGas = (cz: number): number => 1.0 / (cz + 0.0286 * Math.exp(-10.5 * cz));
const xAerosol = (cz: number): number => 1.0 / (cz + 0.0123 * Math.exp(-24.5 * cz));
const xOzone = (sz: number): number => {
  const r = sz / (1.0 + 20.0 / 6378.0);
  return 1.0 / Math.sqrt(1.0 - r * r);
};
const xSky = (cz: number): number => 1.0 / (cz + 0.025 * Math.exp(-11.0 * cz));

/** Total, Rayleigh, ozone, and aerosol extinction coefficients. */
type Parts = [number, number, number, number];

function extinctionParts(extinction: number, altM: number): Parts {
  const kr = K_RAYLEIGH * Math.exp(-altM / 8200.0);
  let ka = extinction - kr - K_OZONE;
  if (ka < 0.0) ka = 0.0;
  return [kr + K_OZONE + ka, kr, K_OZONE, ka];
}

function pointExtinction(altAppDeg: number, parts: Parts): number {
  const z = (90.0 - altAppDeg) * DEG;
  const cz = Math.cos(z);
  const sz = Math.sin(z);
  return parts[1] * xGas(cz) + parts[2] * xOzone(sz) + parts[3] * xAerosol(cz);
}

function skyNanolamberts(
  altAppDeg: number, sunAltDeg: number, sunSepDeg: number, k: number,
  moonAltDeg: number, moonSepDeg: number, moonPhaseAngle: number,
): number {
  const zd = 90.0 - altAppDeg;
  const z = zd * DEG;
  const cz = Math.cos(z);
  const sz = Math.sin(z);
  const x = xSky(cz);
  const scat = 1.0 - Math.pow(10.0, -0.4 * k * x);
  const bn = B0 * (0.4 + 0.6 / Math.sqrt(1.0 - 0.96 * sz * sz)) * Math.pow(10.0, -0.4 * k * x);

  const rs = Math.max(sunSepDeg, 1.0);
  const bt = Math.pow(10.0, -0.4 * (MS - MO + 32.5 - sunAltDeg - zd / (360.0 * k)))
    * (100.0 / rs) * scat;
  const xs = sunAltDeg > 0.0 ? xSky(Math.cos((90.0 - sunAltDeg) * DEG)) : 40.0;
  const c4 = Math.pow(10.0, -0.4 * k * xs);
  const cr = Math.cos(rs * DEG);
  const fs = 6.2e7 / (rs * rs) + Math.pow(10.0, 6.15 - rs / 40.0) + Math.pow(10.0, 5.36) * (1.06 + cr * cr);
  const bd = Math.pow(10.0, -0.4 * (MS - MO + 43.27)) * scat * (fs * c4 + 440000.0 * (1.0 - c4));
  let b = bn + (bd < bt ? bd : bt);

  if (moonAltDeg > 0.0) {
    const am = Math.abs(moonPhaseAngle);
    const mm = -12.73 + 0.026 * am + 4.0e-9 * am ** 4;
    const rm = Math.max(moonSepDeg, 1.0);
    const xm = xSky(Math.cos((90.0 - moonAltDeg) * DEG));
    const c3 = Math.pow(10.0, -0.4 * k * xm);
    const cm = Math.cos(rm * DEG);
    const fm = 6.2e7 / (rm * rm) + Math.pow(10.0, 6.15 - rm / 40.0) + Math.pow(10.0, 5.36) * (1.06 + cm * cm);
    b += Math.pow(10.0, -0.4 * (mm - MO + 43.27)) * scat * (fm * c3 + 440000.0 * (1.0 - c3));
  }
  return b / NL;
}

function thresholdMagnitude(brightnessNl: number): number {
  let c1: number;
  let c2: number;
  if (brightnessNl < 1500.0) {
    c1 = Math.pow(10.0, -9.8);
    c2 = Math.pow(10.0, -1.9);
  } else {
    c1 = Math.pow(10.0, -8.35);
    c2 = Math.pow(10.0, -5.9);
  }
  const th = c1 * (1.0 + Math.sqrt(c2 * brightnessNl)) ** 2;
  return -16.57 - 2.5 * Math.log10(th);
}

// ------------------------------------------------------------- geometry

const clamp1 = (x: number): number => (x < -1.0 ? -1.0 : x > 1.0 ? 1.0 : x);

function altAzHa(ra: number, dec: number, lst: number, phi: number): [number, number, number] {
  const ha = mod(lst - ra + Math.PI, TWO_PI) - Math.PI;
  const alt = Math.asin(clamp1(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha)));
  const az = Math.atan2(
    Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return [alt, mod(az + Math.PI, TWO_PI), ha];
}

function sep(ra1: number, dec1: number, ra2: number, dec2: number): number {
  return Math.acos(clamp1(
    Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2)));
}

function isStar(engine: Engine, target: string): boolean {
  if (target === "moon" || PLANETS.includes(target)) return false;
  if (engine.starNames().includes(target)) return true;
  throw new Error(`heliacal: '${target}' is not a planet, the Moon, or a catalog star`);
}

function raDec(engine: Engine, target: string, star: boolean, jdUt: number): [number, number] {
  if (star) {
    const fs = engine.fixedStar(target, jdUt);
    return [fs.ra * DEG, fs.dec * DEG];
  }
  const p = engine.position(target as BodyId, jdUt);
  return equatorial(p.lon * DEG, p.lat * DEG, trueObliquity(engine.data, jdTT(jdUt)));
}

function lonOf(engine: Engine, target: string, star: boolean, jdUt: number): number {
  return star ? engine.fixedStar(target, jdUt).lon : engine.longitude(target as BodyId, jdUt);
}

function magnitudeOf(engine: Engine, target: string, star: boolean, jdUt: number): number {
  return star ? engine.fixedStar(target, jdUt).mag : pheno(engine, target as BodyId, jdUt).magnitude!;
}

/**
 * The local mean civil day an instant falls in, as an integer. The day begins
 * at the UT Julian Day `day - 0.5 - lonEast / 360`.
 *
 * @param jdUt Julian Day (UT).
 * @param lonEast Observer longitude in degrees, east positive.
 */
export function localDay(jdUt: number, lonEast: number): number {
  return Math.floor(jdUt + lonEast / 360.0 + 0.5);
}

const dayStart = (day: number, lonEast: number): number => day - 0.5 - lonEast / 360.0;

// ----------------------------------------------------- one instant, exactly

/** What {@link visibility} reports for one body at one instant. */
export interface Visibility {
  target: string;
  /** Julian Day (UT). */
  jd: number;
  /** Apparent altitude (refracted) and azimuth from north, degrees. */
  altitude: number;
  azimuth: number;
  /** True altitudes of the Sun and Moon, degrees. */
  sunAltitude: number;
  moonAltitude: number;
  /** The body's apparent magnitude. */
  magnitude: number;
  /** The extinction coefficient used, V-band magnitudes per air mass. */
  extinction: number;
  /** Sky brightness at the body, nanolamberts; `null` below the horizon. */
  skyBrightness: number | null;
  /** The faintest magnitude visible at the body's position, after
   *  extinction; `null` below the horizon. */
  limitingMagnitude: number | null;
  /** Limiting magnitude less the body's: positive means visible. */
  margin: number | null;
  visible: boolean;
}

/**
 * Whether a planet or catalog star can be seen with the naked eye at one
 * instant from one place: the sky's brightness where it stands, the limiting
 * magnitude there after extinction, and the margin the body has over it.
 *
 * @param engine The engine used to evaluate positions.
 * @param target A planet id (`"mercury"` to `"pluto"`) or a catalog star name.
 * @param jdUt Julian Day (UT).
 * @param latDeg Observer latitude in degrees, north positive.
 * @param lonDeg Observer longitude in degrees, east positive.
 * @param opts `extinction` (V-band magnitudes per air mass, default 0.25) and
 *   `altM` (observer altitude in metres).
 * @example
 * ```ts
 * // Is Sirius visible from Cairo 40 minutes before sunrise on 5 August 2025?
 * visibility(engine, "Sirius", julianDay(2025, 8, 5, 2, 35), 30.05, 31.25).visible;
 * ```
 */
export function visibility(
  engine: Engine, target: string, jdUt: number, latDeg: number, lonDeg: number,
  opts: { extinction?: number; altM?: number } = {},
): Visibility {
  const star = isStar(engine, target);
  if (target === "moon") {
    throw new Error("visibility: the Moon is an extended source; use lunarCrescent()");
  }
  const parts = extinctionParts(opts.extinction ?? HELIACAL_EXTINCTION, opts.altM ?? 0.0);
  const phi = latDeg * DEG;
  const lst = mod(gast(engine.data, jdUt) + lonDeg * DEG, TWO_PI);
  const [ra, dec] = raDec(engine, target, star, jdUt);
  const [sra, sdec] = raDec(engine, "sun", false, jdUt);
  const [mra, mdec] = raDec(engine, "moon", false, jdUt);
  const [alt, az] = altAzHa(ra, dec, lst, phi);
  const salt = altAzHa(sra, sdec, lst, phi)[0];
  const malt = altAzHa(mra, mdec, lst, phi)[0];
  const mag = magnitudeOf(engine, target, star, jdUt);
  const out: Visibility = {
    target, jd: jdUt,
    altitude: refractTrueToApparent(alt / DEG), azimuth: az / DEG,
    sunAltitude: salt / DEG, moonAltitude: malt / DEG,
    magnitude: mag, extinction: parts[0],
    skyBrightness: null, limitingMagnitude: null, margin: null, visible: false,
  };
  if (out.altitude <= 0.0) return out;
  const b = skyNanolamberts(
    out.altitude, salt / DEG, sep(ra, dec, sra, sdec) / DEG, parts[0],
    malt / DEG, sep(ra, dec, mra, mdec) / DEG, pheno(engine, "moon", jdUt).phaseAngle);
  const lim = thresholdMagnitude(b) - pointExtinction(out.altitude, parts);
  out.skyBrightness = b;
  out.limitingMagnitude = lim;
  out.margin = lim - mag;
  out.visible = lim > mag;
  return out;
}

// ------------------------------------------------- a half night, sampled

type Half = "morning" | "evening";

/** One half of a local night for one target: the morning half runs from
 *  local mean midnight to noon, the evening half from noon to midnight. The
 *  Sun, the target, and the Moon are placed at both ends and carried between
 *  them linearly; sidereal time advances at its mean rate. */
class Night {
  readonly t0: number;
  readonly phi: number;
  readonly lst0: number;
  readonly track: [number, number, number, number][] = [];
  readonly mag: number;
  readonly moonPhase: number;

  constructor(
    engine: Engine, target: string, star: boolean, day: number,
    readonly half: Half, latDeg: number, lonDeg: number,
  ) {
    this.t0 = dayStart(day, lonDeg) + (half === "morning" ? 0.0 : 0.5);
    const t1 = this.t0 + 0.5;
    this.phi = latDeg * DEG;
    this.lst0 = mod(gast(engine.data, this.t0) + lonDeg * DEG, TWO_PI);
    const who: [string, boolean][] = [[target, star], ["sun", false], ["moon", false]];
    for (const [name, isS] of who) {
      const [ra0, dec0] = raDec(engine, name, isS, this.t0);
      const [ra1, dec1] = raDec(engine, name, isS, t1);
      const dra = mod(ra1 - ra0 + Math.PI, TWO_PI) - Math.PI;
      this.track.push([ra0, dec0, dra, dec1 - dec0]);
    }
    const tm = this.t0 + 0.25;
    this.mag = magnitudeOf(engine, target, star, tm);
    this.moonPhase = pheno(engine, "moon", tm).phaseAngle;
  }

  private place(i: number, t: number): [number, number] {
    const [ra0, dec0, dra, ddec] = this.track[i];
    const u = (t - this.t0) / 0.5;
    return [ra0 + dra * u, dec0 + ddec * u];
  }

  /** [altitude, azimuth, hour angle, Sun altitude] in radians, true. */
  state(t: number): [number, number, number, number] {
    const lst = this.lst0 + SID_RATE * (t - this.t0);
    const [ra, dec] = this.place(0, t);
    const [sra, sdec] = this.place(1, t);
    const [alt, az, ha] = altAzHa(ra, dec, lst, this.phi);
    const salt = altAzHa(sra, sdec, lst, this.phi)[0];
    return [alt, az, ha, salt];
  }

  /** Limiting magnitude less the target's at instant t, or null when the Sun
   *  is up, the target is down, or the target is on the wrong side of the
   *  meridian for this half of the night. */
  margin(t: number, parts: Parts): number | null {
    const lst = this.lst0 + SID_RATE * (t - this.t0);
    const [sra, sdec] = this.place(1, t);
    const salt = altAzHa(sra, sdec, lst, this.phi)[0];
    if (salt / DEG >= SUN_DOWN_DEG) return null;
    const [ra, dec] = this.place(0, t);
    const [alt, , ha] = altAzHa(ra, dec, lst, this.phi);
    if (this.half === "morning" ? ha > 0.0 : ha < 0.0) return null;
    const app = refractTrueToApparent(alt / DEG);
    if (app <= 0.0) return null;
    const [mra, mdec] = this.place(2, t);
    const malt = altAzHa(mra, mdec, lst, this.phi)[0];
    const b = skyNanolamberts(
      app, salt / DEG, sep(ra, dec, sra, sdec) / DEG, parts[0],
      malt / DEG, sep(ra, dec, mra, mdec) / DEG, this.moonPhase);
    return thresholdMagnitude(b) - pointExtinction(app, parts) - this.mag;
  }

  /** [margin, instant] at the moment of best visibility, or null when the
   *  target is never in view in this half of the night. */
  best(parts: Parts): [number, number] | null {
    let bestM: number | null = null;
    let bestT = 0;
    for (let i = 0; i < 361; i++) {
      const t = this.t0 + i * STEP;
      const m = this.margin(t, parts);
      if (m !== null && (bestM === null || m > bestM)) {
        bestM = m;
        bestT = t;
      }
    }
    if (bestM === null) return null;
    // golden-section refinement between the neighbouring samples
    let a = bestT - STEP;
    let b = bestT + STEP;
    const f = (t: number): number => {
      const m = this.margin(t, parts);
      return m === null ? -1.0e9 : m;
    };
    let c = b - GOLD * (b - a);
    let d = a + GOLD * (b - a);
    let fc = f(c);
    let fd = f(d);
    for (let i = 0; i < 24; i++) {
      if (fc > fd) {
        b = d; d = c; fd = fc;
        c = b - GOLD * (b - a);
        fc = f(c);
      } else {
        a = c; c = d; fc = fd;
        d = a + GOLD * (b - a);
        fd = f(d);
      }
    }
    const t = (a + b) / 2.0;
    const m = f(t);
    if (m > bestM) {
      bestM = m;
      bestT = t;
    }
    return [bestM, bestT];
  }

  /** [instant, Sun depression in degrees] when the target crosses the
   *  geometric horizon in this half of the night, rising or setting, or null
   *  when it does not. */
  horizon(rising: boolean): [number, number] | null {
    let prev = this.state(this.t0)[0];
    for (let i = 1; i < 361; i++) {
      const t = this.t0 + i * STEP;
      const cur = this.state(t)[0];
      if (rising ? (prev < 0.0 && cur >= 0.0) : (prev > 0.0 && cur <= 0.0)) {
        let a = t - STEP;
        let b = t;
        for (let j = 0; j < 40; j++) {
          const mid = (a + b) / 2.0;
          if ((this.state(mid)[0] < 0.0) === rising) a = mid;
          else b = mid;
        }
        const tc = (a + b) / 2.0;
        return [tc, -this.state(tc)[3] / DEG];
      }
      prev = cur;
    }
    return null;
  }
}

// ------------------------------------------------- conjunctions, the anchors

function phaseEvents(
  engine: Engine, target: string, star: boolean, offset: number,
  jdFrom: number, jdTo: number,
): number[] {
  const step = target === "moon" ? 0.5 : 2.0;
  const f = (t: number): number =>
    mod(lonOf(engine, target, star, t) - engine.longitude("sun", t) - offset + 180.0, 360.0) - 180.0;
  const out: number[] = [];
  let prev = f(jdFrom);
  let t = jdFrom + step;
  while (t <= jdTo + step) {
    const cur = f(t);
    if (prev * cur < 0.0 && Math.abs(cur - prev) < 180.0) {
      let a = t - step;
      let b = t;
      let fa = prev;
      for (let i = 0; i < 40; i++) {
        const mid = (a + b) / 2.0;
        const fm = f(mid);
        if (fa * fm <= 0.0) {
          b = mid;
        } else {
          a = mid;
          fa = fm;
        }
      }
      out.push((a + b) / 2.0);
    }
    prev = cur;
    t += step;
  }
  return out;
}

function anchors(
  engine: Engine, target: string, star: boolean, kind: HeliacalKind,
  jdFrom: number, jdTo: number,
): number[] {
  if (kind === "acronychal_rising" || kind === "cosmical_setting") {
    return phaseEvents(engine, target, star, 180.0, jdFrom, jdTo);
  }
  const conj = phaseEvents(engine, target, star, 0.0, jdFrom, jdTo);
  if (!INNER.includes(target)) return conj;
  const wantInferior = kind === "morning_first" || kind === "evening_last";
  return conj.filter((t) => {
    const inferior = engine.position(target as BodyId, t).dist! < engine.position("sun", t).dist!;
    return inferior === wantInferior;
  });
}

function walkLimit(target: string): number {
  if (target === "mercury") return 70;
  if (target === "venus") return 150;
  if (target === "moon") return 6;
  return 200;
}

/** The day a run of days on which `holds` is true begins (first) or ends
 *  (not first), searched from day0: forward for a beginning and backward for
 *  an end when day0 is outside the run, the other way when it is inside.
 *  null when no edge lies within `limit` days. */
function walk(holds: (day: number) => boolean, day0: number, first: boolean, limit: number): number | null {
  const fwd = first ? 1 : -1;
  if (!holds(day0)) {
    for (let i = 1; i <= limit; i++) {
      if (holds(day0 + fwd * i)) return day0 + fwd * i;
    }
    return null;
  }
  for (let i = 1; i <= limit; i++) {
    if (!holds(day0 - fwd * i)) return day0 - fwd * (i - 1);
  }
  return null;
}

// ------------------------------------------------------------- the Moon

/** Yallop's q test for one evening or morning; see {@link lunarCrescent}. */
export interface Crescent {
  /** Yallop's q: above -0.014 the crescent is visible to the naked eye
   *  under perfect conditions, above 0.216 easily. */
  q: number;
  /** A easily visible, B visible under perfect conditions, C may need
   *  optical aid to find, D optical aid only, E not visible with a
   *  telescope, F below the Danjon limit. */
  zone: string;
  /** The best time to look, Julian Day (UT): four ninths of the lag after
   *  sunset, or before sunrise. */
  jd: number;
  /** Minutes between sunset and moonset, or moonrise and sunrise. */
  lagMinutes: number;
  /** Moon's altitude less the Sun's at the best time, degrees, geocentric. */
  arcv: number;
  /** Elongation of the Moon from the Sun, degrees. */
  arcl: number;
  /** Sun's azimuth less the Moon's, degrees. */
  daz: number;
  /** Width of the crescent, arcminutes, topocentric. */
  width: number;
  /** Sunset (evening) or sunrise (morning), Julian Day (UT). */
  sun: number;
  /** Moonset (evening) or moonrise (morning), Julian Day (UT). */
  moon: number;
}

/**
 * Yallop's q test for the lunar crescent on one local day: the evening
 * crescent after sunset, or with `half: "morning"` the old crescent before
 * sunrise.
 *
 * @param engine The engine used to evaluate positions.
 * @param day A local day number from {@link localDay}.
 * @param latDeg Observer latitude in degrees, north positive.
 * @param lonDeg Observer longitude in degrees, east positive.
 * @param opts `half` (`"evening"` by default) and `altM`.
 * @returns The test's result, or `null` when the Sun or Moon does not rise
 *   or set that day or the Moon is on the wrong side of the Sun.
 * @example
 * ```ts
 * const day = localDay(julianDay(2025, 3, 30, 15), 39.8);
 * lunarCrescent(engine, day, 21.4, 39.8)?.zone; // "A" to "F"
 * ```
 */
export function lunarCrescent(
  engine: Engine, day: number, latDeg: number, lonDeg: number,
  opts: { half?: Half; altM?: number } = {},
): Crescent | null {
  const half = opts.half ?? "evening";
  const altM = opts.altM ?? 0.0;
  const noon = dayStart(day, lonDeg) + 0.5;
  let sunT: number | null;
  let moonT: number | null;
  let lag: number;
  let best: number;
  if (half === "evening") {
    sunT = riseSet(engine, "sun", noon, latDeg, lonDeg, "set", { altM, searchDays: 0.75 });
    if (sunT === null) return null;
    moonT = riseSet(engine, "moon", sunT - 0.25, latDeg, lonDeg, "set", { altM, searchDays: 1.0 });
    if (moonT === null) return null;
    lag = moonT - sunT;
    best = sunT + (lag * 4.0) / 9.0;
  } else {
    sunT = riseSet(engine, "sun", noon - 0.75, latDeg, lonDeg, "rise", { altM, searchDays: 0.75 });
    if (sunT === null) return null;
    moonT = riseSet(engine, "moon", sunT - 0.75, latDeg, lonDeg, "rise", { altM, searchDays: 1.0 });
    if (moonT === null) return null;
    lag = sunT - moonT;
    best = sunT - (lag * 4.0) / 9.0;
  }
  if (lag <= 0.0) return null;
  const phi = latDeg * DEG;
  const lst = mod(gast(engine.data, best) + lonDeg * DEG, TWO_PI);
  const eps = trueObliquity(engine.data, jdTT(best));
  const m = engine.position("moon", best);
  const s = engine.position("sun", best);
  const [mra, mdec] = equatorial(m.lon * DEG, m.lat * DEG, eps);
  const [sra, sdec] = equatorial(s.lon * DEG, s.lat * DEG, eps);
  const [malt, maz] = altAzHa(mra, mdec, lst, phi);
  const [salt, saz] = altAzHa(sra, sdec, lst, phi);
  const arcv = (malt - salt) / DEG;
  const arcl = sep(mra, mdec, sra, sdec);
  const daz = mod((saz - maz) / DEG + 180.0, 360.0) - 180.0;
  const sinPi = EARTH_RADIUS_KM / (m.dist! * KM_PER_AU);
  const par = (Math.asin(sinPi) / DEG) * 60.0; // horizontal parallax, arcmin
  const sd = 0.27245 * par * (1.0 + Math.sin(malt) * sinPi);
  const w = sd * (1.0 - Math.cos(arcl));
  const q = (arcv - (11.8371 - 6.3226 * w + 0.7319 * w * w - 0.1018 * w ** 3)) / 10.0;
  let zone = "F";
  for (const [name, floor] of YALLOP_ZONES) {
    if (q > floor) {
      zone = name;
      break;
    }
  }
  return {
    q, zone, jd: best, lagMinutes: lag * 1440.0,
    arcv, arcl: arcl / DEG, daz, width: w, sun: sunT, moon: moonT,
  };
}

// ------------------------------------------------------------- the events

/** Options for {@link heliacal}. */
export interface HeliacalOptions {
  /** Which event. Defaults to `"morning_first"`, the heliacal rising.
   *  `"heliacal_rising"` and `"heliacal_setting"` are accepted as names for
   *  `"morning_first"` and `"evening_last"`. */
  kind?: HeliacalKind | "heliacal_rising" | "heliacal_setting";
  /** `"visibility"` (default) or `"arcus"`. */
  method?: HeliacalMethod;
  /** V-band extinction coefficient, magnitudes per air mass. Default 0.25. */
  extinction?: number;
  /** Half-width of the extinction range the event is recomputed over for
   *  `earliest` and `latest`. Default 0.05. */
  spread?: number;
  /** The arcus visionis in degrees; required by the arcus method. */
  arcusVisionis?: number;
  /** Observer altitude in metres. */
  altM?: number;
  /** Shorten the search to this many days past `jdStart`: a later event is
   *  not returned, and the engine is not asked for positions much beyond
   *  it. The default search runs about 830 days (45 for the Moon). */
  span?: number;
}

/** One first or last visibility, as {@link heliacal} reports it. */
export interface HeliacalEvent {
  target: string;
  kind: HeliacalKind;
  /** `"visibility"`, `"arcus"`, or `"crescent"` for the Moon. */
  method: HeliacalMethod | "crescent";
  /** The instant of best visibility on the day of the event, Julian Day
   *  (UT); for the arcus method, the instant the body is on the horizon. */
  jd: number;
  /** The conjunction or opposition the event belongs to, Julian Day (UT). */
  conjunction: number;
  /** The same event under the clearer and the hazier sky (for the Moon,
   *  under the stricter and the looser reading of q). `null` when that sky
   *  gives no event. Absent for the arcus method. */
  earliest?: number | null;
  latest?: number | null;
  /** Limiting magnitude less the body's at `jd`. */
  margin?: number;
  magnitude?: number;
  /** Apparent altitude and azimuth of the body at `jd`, degrees. */
  altitude?: number;
  azimuth?: number;
  /** The Sun's true altitude at `jd`, degrees. */
  sunAltitude?: number;
  /** The Sun's depression when the body crossed the geometric horizon that
   *  day: the arcus visionis the event implies (visibility method) or the
   *  one it was given (arcus method). */
  arcusVisionis?: number;
  /** The Sun's depression at `jd` (arcus method). */
  sunDepression?: number;
  extinction?: number;
  spread?: number;
  /** Yallop's q and its zone, and the geometry behind it (the Moon). */
  q?: number;
  zone?: string;
  lagMinutes?: number;
  arcv?: number;
  arcl?: number;
  daz?: number;
  width?: number;
}

/**
 * The events a target has under a method, in the order {@link heliacal}
 * names them: stars and the outer planets have the heliacal rising and
 * setting (and, by the arcus method, the two events at opposition), Mercury
 * and Venus have four, and the Moon has its first and last crescent by the
 * visibility method only.
 *
 * @param engine The engine whose star catalog names the stars.
 * @param target A planet id, `"moon"`, or a catalog star name.
 * @param method `"visibility"` (default) or `"arcus"`.
 * @throws Error for an unknown target or method.
 * @example
 * ```ts
 * heliacalKindsFor(engine, "venus");  // four kinds
 * heliacalKindsFor(engine, "Sirius"); // ["morning_first", "evening_last"]
 * ```
 */
export function heliacalKindsFor(
  engine: Engine, target: string, method: HeliacalMethod = "visibility",
): HeliacalKind[] {
  if (method !== "visibility" && method !== "arcus") {
    throw new Error(`heliacal: unknown method '${method}'`);
  }
  isStar(engine, target);
  if (target === "moon") return method === "visibility" ? ["evening_first", "morning_last"] : [];
  if (INNER.includes(target)) return ["morning_first", "evening_last", "evening_first", "morning_last"];
  if (method === "arcus") return ["morning_first", "evening_last", "acronychal_rising", "cosmical_setting"];
  return ["morning_first", "evening_last"];
}

function moonEvent(
  engine: Engine, kind: HeliacalKind, jdStart: number,
  latDeg: number, lonDeg: number, altM: number, span: number | undefined,
): HeliacalEvent | null {
  const first = kind === "evening_first";
  const half: Half = first ? "evening" : "morning";
  const cache = new Map<number, Crescent | null>();
  const look = (day: number): Crescent | null => {
    if (!cache.has(day)) cache.set(day, lunarCrescent(engine, day, latDeg, lonDeg, { half, altM }));
    return cache.get(day)!;
  };
  const over = (qMin: number) => (day: number): boolean => {
    const c = look(day);
    return c !== null && c.q > qMin;
  };
  const jdLast = span === undefined ? jdStart + 45.0 : jdStart + Math.min(span, 45.0);
  const jdTo = span === undefined ? jdLast : jdLast + 8.0;
  for (const conj of phaseEvents(engine, "moon", false, 0.0, jdStart - 8.0, jdTo)) {
    const day0 = localDay(conj, lonDeg);
    const day = walk(over(Q_VISIBLE), day0, first, 6);
    if (day === null) continue;
    const c = look(day)!;
    if (c.jd < jdStart) continue;
    if (span !== undefined && c.jd > jdLast) return null;
    const easy = walk(over(Q_EASY), day0, first, 6);
    const easyJd = easy !== null ? look(easy)!.jd : null;
    return {
      target: "moon", kind, method: "crescent", jd: c.jd, conjunction: conj,
      earliest: first ? c.jd : easyJd, latest: first ? easyJd : c.jd,
      q: c.q, zone: c.zone, lagMinutes: c.lagMinutes,
      arcv: c.arcv, arcl: c.arcl, daz: c.daz, width: c.width,
    };
  }
  return null;
}

/**
 * The next first or last visibility of a planet, a catalog star, or the Moon
 * at or after `jdStart` from one place: the heliacal rising and setting, the
 * evening and morning apparitions of Mercury and Venus, the new and old
 * crescent, and (by the arcus method) the acronychal rising and cosmical
 * setting.
 *
 * @param engine The engine used to evaluate positions.
 * @param target A planet id, `"moon"`, or a catalog star name.
 * @param jdStart Search start, Julian Day (UT).
 * @param latDeg Observer latitude in degrees, north positive.
 * @param lonDeg Observer longitude in degrees, east positive.
 * @param opts See {@link HeliacalOptions}.
 * @returns The event, or `null` when none is found within the search span
 *   (about 830 days; 45 for the Moon).
 * @throws Error for an unknown target, an event the target does not have,
 *   or the arcus method without an arcus visionis.
 * @example
 * ```ts
 * // The heliacal rising of Sirius at Memphis in 139 CE
 * const ev = heliacal(engine, "Sirius", julianDay(139, 1, 1, 0, 0, 0, "julian"), 29.85, 31.25);
 * calendarDate(ev!.jd, "julian"); // the morning it is first seen
 * ev!.earliest; ev!.latest;       // under a clearer and a hazier sky
 * ```
 */
export function heliacal(
  engine: Engine, target: string, jdStart: number, latDeg: number, lonDeg: number,
  opts: HeliacalOptions = {},
): HeliacalEvent | null {
  const rawKind = opts.kind ?? "morning_first";
  const kind: HeliacalKind = ALIASES[rawKind] ?? (rawKind as HeliacalKind);
  const method = opts.method ?? "visibility";
  if (!(HELIACAL_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`heliacal: unknown kind '${kind}'`);
  }
  if (method !== "visibility" && method !== "arcus") {
    throw new Error(`heliacal: unknown method '${method}'`);
  }
  const star = isStar(engine, target);
  const atOpposition = kind === "acronychal_rising" || kind === "cosmical_setting";
  const innerOnly = kind === "evening_first" || kind === "morning_last";
  if (target === "moon") {
    if (!innerOnly) throw new Error("heliacal: the Moon has evening_first and morning_last only");
    if (method !== "visibility") throw new Error("heliacal: the Moon's crescent has no arcus visionis method");
  } else if (INNER.includes(target)) {
    if (atOpposition) throw new Error(`heliacal: ${target} is never at opposition`);
  } else {
    if (innerOnly) throw new Error(`heliacal: ${kind} applies to Mercury, Venus, and the Moon`);
    if (atOpposition && method !== "arcus") {
      throw new Error(`heliacal: ${kind} is offered by the arcus method only`);
    }
  }
  const altM = opts.altM ?? 0.0;
  const span = opts.span;
  if (span !== undefined && !(span > 0.0)) throw new Error("heliacal: span must be positive");
  if (target === "moon") return moonEvent(engine, kind, jdStart, latDeg, lonDeg, altM, span);
  const av = opts.arcusVisionis;
  if (method === "arcus" && av === undefined) {
    throw new Error("heliacal: the arcus method needs arcusVisionis, in degrees");
  }
  const extinction = opts.extinction ?? HELIACAL_EXTINCTION;
  const spread = opts.spread ?? HELIACAL_SPREAD;
  const half: Half = (kind === "morning_first" || kind === "morning_last" || kind === "cosmical_setting")
    ? "morning" : "evening";
  const first = kind === "morning_first" || kind === "evening_first" || kind === "cosmical_setting";
  const rising = kind === "morning_first" || kind === "morning_last" || kind === "acronychal_rising";
  const limit = walkLimit(target);
  const nights = new Map<number, Night>();
  const night = (day: number): Night => {
    let n = nights.get(day);
    if (!n) {
      n = new Night(engine, target, star, day, half, latDeg, lonDeg);
      nights.set(day, n);
    }
    return n;
  };

  const crossings = new Map<number, [number, number] | null>();
  const crossing = (day: number): [number, number] | null => {
    if (!crossings.has(day)) crossings.set(day, night(day).horizon(rising));
    return crossings.get(day)!;
  };

  const jdLast = span === undefined ? jdStart + 830.0 : jdStart + Math.min(span, 830.0);
  const jdTo = span === undefined ? jdLast : jdLast + limit + 5.0;
  for (const anchor of anchors(engine, target, star, kind, jdStart - limit - 5.0, jdTo)) {
    const day0 = localDay(anchor, lonDeg);
    if (method === "arcus") {
      const holds = (day: number): boolean => {
        const c = crossing(day);
        return c !== null && c[1] >= av!;
      };
      const day = walk(holds, day0, first, limit);
      if (day === null) continue;
      const [tc, dep] = crossing(day)!;
      if (tc < jdStart) continue;
      if (span !== undefined && tc > jdLast) return null;
      return {
        target, kind, method: "arcus", jd: tc, conjunction: anchor,
        arcusVisionis: av!, sunDepression: dep,
      };
    }

    const runs: [Parts, number | null, [number, number] | null][] = [];
    for (const k of [extinction, extinction - spread, extinction + spread]) {
      const parts = extinctionParts(k, altM);
      const memo = new Map<number, [number, number] | null>();
      const best = (day: number): [number, number] | null => {
        if (!memo.has(day)) memo.set(day, night(day).best(parts));
        return memo.get(day)!;
      };
      const holds = (day: number): boolean => {
        // the body must rise (or set) in this half of the night, which a
        // circumpolar star never does, and be seen while it is up
        if (crossing(day) === null) return false;
        const b = best(day);
        return b !== null && b[0] > 0.0;
      };
      const day = walk(holds, day0, first, limit);
      runs.push([parts, day, day !== null ? best(day) : null]);
    }
    const [parts, day, hit] = runs[0];
    if (day === null || hit === null) continue;
    const [margin, t] = hit;
    if (t < jdStart) continue;
    if (span !== undefined && t > jdLast) return null;
    const clearT = runs[1][2] !== null ? runs[1][2][1] : null;
    const hazyT = runs[2][2] !== null ? runs[2][2][1] : null;
    const n = night(day);
    const [alt, az, , salt] = n.state(t);
    const cross = crossing(day)!;
    return {
      target, kind, method: "visibility", jd: t, conjunction: anchor,
      earliest: first ? clearT : hazyT, latest: first ? hazyT : clearT,
      margin, magnitude: n.mag,
      altitude: refractTrueToApparent(alt / DEG), azimuth: az / DEG,
      sunAltitude: salt / DEG,
      arcusVisionis: cross[1],
      extinction: parts[0], spread,
    };
  }
  return null;
}
