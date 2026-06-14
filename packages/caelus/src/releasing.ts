/**
 * astroengine releasing -- zodiacal releasing (aphesis), the Hellenistic
 * time-lord technique from Vettius Valens, released from a Lot (usually Spirit
 * or Fortune).
 *
 * From the Lot's sign, periods release sign by sign. A sign's period length is
 * its planetary minor years (Aries 15, Taurus 8, Gemini 20, Cancer 25, Leo 19,
 * Virgo 20, Libra 8, Scorpio 15, Sagittarius 12, Capricorn 27, Aquarius 30,
 * Pisces 12). Convention: 360-day years, each level a twelfth of the one above
 * (L1 = period x 360 days, L2 = x 30, L3 = x 2.5, L4 = x 2.5/12). Within a
 * period the next level releases from the same sign and fills it (last
 * sub-period truncates at the boundary); when a sub-level returns to the sign it
 * began on it looses the bond, jumping to the opposite sign (+6) once. Mirrors
 * the Python reference (astroengine/releasing.py); the golden fixtures pin the
 * two together.
 */
import { SIGNS } from "./chart.js";
import { isDayChart } from "./derived.js";
import { lotSpirit, lotFortune } from "./lots.js";
import { SIGN_RULERS } from "./profections.js";
import { Engine, Zodiac } from "./chart.js";

/** Period length in 360-day years for each sign, Aries..Pisces. */
export const ZR_PERIODS = [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12] as const;

/** Days per period unit at each level (each a twelfth of the one above). */
export const LEVEL_UNIT: Record<number, number> = { 1: 360, 2: 30, 3: 2.5, 4: 2.5 / 12 };

const FULL_CYCLE = ZR_PERIODS.reduce((a, b) => a + b, 0) * 360; // one full L1 cycle, days
const EPS = 1e-9;

export interface ZrPeriod {
  level: number;
  sign: string;
  lord: string;
  start: number;
  end: number;
  /** True when this period is the loosing of the bond (jumped to the opposite sign). */
  lb: boolean;
}

function release(
  out: ZrPeriod[], level: number, maxLevel: number, startSign: number,
  spanStart: number, spanEnd: number, horizon: number,
): void {
  const unit = LEVEL_UNIT[level];
  let sign = startSign;
  let lb = false;
  let pendingLb = false;
  let cur = spanStart;
  while (cur < spanEnd - EPS && cur < horizon - EPS) {
    const plen = ZR_PERIODS[sign] * unit;
    const subEnd = Math.min(cur + plen, spanEnd, horizon);
    out.push({ level, sign: SIGNS[sign], lord: SIGN_RULERS[sign], start: cur, end: subEnd, lb: pendingLb });
    if (level < maxLevel) {
      release(out, level + 1, maxLevel, sign, cur, Math.min(cur + plen, spanEnd), horizon);
    }
    cur += plen;
    pendingLb = false;
    const nxt = (sign + 1) % 12;
    if (nxt === startSign && !lb) {
      sign = (startSign + 6) % 12;
      lb = true;
      pendingLb = true;
    } else {
      sign = nxt;
    }
  }
}

/** Flat timeline of releasing periods down to `maxLevel` over `horizonYears`
 *  (360-day years) from birth. */
export function zrRelease(
  lotSign: number, natalJd: number, maxLevel = 2, horizonYears = 100,
): ZrPeriod[] {
  const out: ZrPeriod[] = [];
  const horizon = natalJd + horizonYears * 360;
  release(out, 1, maxLevel, lotSign, natalJd, natalJd + FULL_CYCLE, horizon);
  return out;
}

/** The (sign, start, end) of the sub-period containing `target`, or null. */
function subAt(
  unit: number, startSign: number, spanStart: number, spanEnd: number, target: number,
): [number, number, number] | null {
  let sign = startSign;
  let lb = false;
  let cur = spanStart;
  while (cur < spanEnd - EPS) {
    const plen = ZR_PERIODS[sign] * unit;
    const subEnd = Math.min(cur + plen, spanEnd);
    if (cur <= target && target < subEnd) return [sign, cur, subEnd];
    cur += plen;
    const nxt = (sign + 1) % 12;
    if (nxt === startSign && !lb) { sign = (startSign + 6) % 12; lb = true; } else sign = nxt;
  }
  return null;
}

export interface ZrActive { l1: string; l2: string; l3: string; l4: string; }

/** The L1..L4 releasing signs active at `targetJd`; null outside the span. */
export function zrActive(lotSign: number, natalJd: number, targetJd: number): ZrActive | null {
  const l1 = subAt(360, lotSign, natalJd, natalJd + FULL_CYCLE, targetJd);
  if (l1 === null) return null;
  const l2 = subAt(30, l1[0], l1[1], l1[2], targetJd);
  if (l2 === null) return null;
  const l3 = subAt(2.5, l2[0], l2[1], l2[2], targetJd);
  if (l3 === null) return null;
  const l4 = subAt(2.5 / 12, l3[0], l3[1], l3[2], targetJd);
  if (l4 === null) return null;
  return { l1: SIGNS[l1[0]], l2: SIGNS[l2[0]], l3: SIGNS[l3[0]], l4: SIGNS[l4[0]] };
}

/** Zodiacal releasing active at `targetJd`, releasing from the Lot of Spirit
 *  (default) or Fortune of the natal chart. */
export function zrAt(
  engine: Engine, natalJd: number, targetJd: number, lat: number, lonEast: number,
  lot: "spirit" | "fortune" = "spirit", zodiac: Zodiac = "tropical",
): { lot: string; lot_sign: string; day: boolean } & Partial<ZrActive> {
  const asc = engine.chartAt(natalJd, lat, lonEast, { zodiac }).angles.asc;
  const day = isDayChart(engine, natalJd, lat, lonEast);
  const sun = engine.longitude("sun", natalJd, { zodiac });
  const moon = engine.longitude("moon", natalJd, { zodiac });
  const lotLon = (lot === "spirit" ? lotSpirit : lotFortune)(asc, sun, moon, day);
  const lotSign = ((Math.floor(lotLon / 30) % 12) + 12) % 12;
  const active = zrActive(lotSign, natalJd, targetJd) ?? {};
  return { lot, lot_sign: SIGNS[lotSign], day, ...active };
}
