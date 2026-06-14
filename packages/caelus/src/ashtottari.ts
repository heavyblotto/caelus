/**
 * astroengine ashtottari -- the Ashtottari dasha, a 108-year conditional dasha.
 *
 * Eight lords rule in order -- Sun 6, Moon 15, Mars 8, Mercury 17, Saturn 10,
 * Jupiter 19, Rahu 12, Venus 21 years (totalling 108). Unlike Vimshottari the
 * nakshatra-to-lord mapping is in irregular groups, and the elapsed portion of
 * the first period is measured across the lord's whole multi-nakshatra span.
 *
 * Convention: the JHora/PVR Narasimha Rao mapping (the PyJHora implementation),
 * which the texts vary around; the lord ranges and across-span balance are
 * reproduced from it, validated against the named source in `validate_jyotish`
 * rather than asserted. Mirrors the Python reference (astroengine/ashtottari.py);
 * the golden fixtures pin the two together.
 */
import { Engine, Zodiac } from "./chart.js";
import { nakshatra, NAK_SPAN, DASHA_YEAR } from "./vedic.js";

export const ASHTOTTARI_ORDER = [
  "sun", "moon", "mars", "mercury", "saturn", "jupiter", "rahu", "venus",
] as const;
export const ASHTOTTARI_YEARS: Record<(typeof ASHTOTTARI_ORDER)[number], number> = {
  sun: 6, moon: 15, mars: 8, mercury: 17, saturn: 10, jupiter: 19, rahu: 12, venus: 21,
};
const ASHTOTTARI_TOTAL = 108;
// Each lord's nakshatra group: [lord, start nakshatra index, span]. Rahu wraps
// past 27 (nakshatras 26, 0, 1, 2).
const ASHTOTTARI_RANGES: Array<[string, number, number]> = [
  ["sun", 6, 4], ["moon", 10, 3], ["mars", 13, 4], ["mercury", 17, 3],
  ["saturn", 20, 3], ["jupiter", 23, 3], ["rahu", 26, 4], ["venus", 3, 3],
];

/** The Ashtottari dasha lord governing a nakshatra index (0-based). */
export function ashtottariLord(nakIndex: number): string {
  for (const [lord, start, span] of ASHTOTTARI_RANGES) {
    if (((nakIndex - start) % 27 + 27) % 27 < span) return lord;
  }
  throw new Error(`no Ashtottari lord for nakshatra ${nakIndex}`);
}

export interface AshtottariSub { lord: string; start: number; end: number; }
export interface AshtottariPeriod {
  level: number; lord: string; years: number; start: number; end: number; sub: AshtottariSub[];
}
export interface AshtottariTimeline { start_lord: string; balance_years: number; dashas: AshtottariPeriod[]; }

/** The Ashtottari dasha timeline from the Moon's sidereal longitude. */
export function ashtottariDashas(
  moonLon: number, natalJd: number, levels = 2, yearLength = DASHA_YEAR, count = 8,
): AshtottariTimeline {
  const lon = ((moonLon % 360) + 360) % 360;
  const nakI = Math.floor(lon / NAK_SPAN) % 27;
  const startLord = ashtottariLord(nakI);
  const [, startNak, spanNak] = ASHTOTTARI_RANGES.find((r) => r[0] === startLord)!;
  const lordStartDeg = startNak * NAK_SPAN;
  const spanDeg = spanNak * NAK_SPAN;
  const elapsed = (((lon - lordStartDeg) % 360) + 360) % 360 / spanDeg;
  const y0 = ASHTOTTARI_YEARS[startLord as keyof typeof ASHTOTTARI_YEARS];
  const li = (ASHTOTTARI_ORDER as readonly string[]).indexOf(startLord);
  let t = natalJd - elapsed * y0 * yearLength;
  const dashas: AshtottariPeriod[] = [];
  for (let k = 0; k < count; k++) {
    const lord = ASHTOTTARI_ORDER[(li + k) % 8];
    const years = ASHTOTTARI_YEARS[lord];
    const span = years * yearLength;
    const maha: AshtottariPeriod = { level: 1, lord, years, start: t, end: t + span, sub: [] };
    if (levels >= 2) {
      const sli = (ASHTOTTARI_ORDER as readonly string[]).indexOf(lord);
      let st = t;
      for (let j = 0; j < 8; j++) {
        const sl = ASHTOTTARI_ORDER[(sli + j) % 8];
        const subSpan = (years * ASHTOTTARI_YEARS[sl] / ASHTOTTARI_TOTAL) * yearLength;
        maha.sub.push({ lord: sl, start: st, end: st + subSpan });
        st += subSpan;
      }
    }
    dashas.push(maha);
    t += span;
  }
  return { start_lord: startLord, balance_years: (1 - elapsed) * y0, dashas };
}

export interface AshtottariActive { maha: string; antar: string | null; }

/** The maha and antar lord active at targetJd; null before the first period. */
export function ashtottariActive(
  moonLon: number, natalJd: number, targetJd: number, yearLength = DASHA_YEAR,
): AshtottariActive | null {
  const timeline = ashtottariDashas(moonLon, natalJd, 2, yearLength, 16).dashas;
  const maha = timeline.find((p) => p.start <= targetJd && targetJd < p.end);
  if (!maha) return null;
  const antar = maha.sub.find((s) => s.start <= targetJd && targetJd < s.end);
  return { maha: maha.lord, antar: antar ? antar.lord : null };
}

/** Ashtottari dasha active at targetJd, from the natal Moon's nakshatra. */
export function ashtottariAt(
  engine: Engine, natalJd: number, targetJd: number,
  zodiac: Zodiac = "sidereal:lahiri", yearLength = DASHA_YEAR,
): { moon_nakshatra: string; start_lord: string } & Partial<AshtottariActive> {
  const moonLon = engine.longitude("moon", natalJd, { zodiac });
  const nak = nakshatra(moonLon);
  const active = ashtottariActive(moonLon, natalJd, targetJd, yearLength) ?? {};
  return { moon_nakshatra: nak.name, start_lord: ashtottariLord(nak.index), ...active };
}
