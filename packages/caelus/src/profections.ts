/**
 * astroengine profections -- annual and monthly profections, a Hellenistic
 * time-lord technique.
 *
 * The Ascendant advances one whole sign per year of life; the profected sign's
 * traditional (domicile) ruler is the lord of the year. Within the year the
 * monthly profection advances one further sign per 1/12 of the year. Pure
 * arithmetic on a date difference and the natal Ascendant sign. Mirrors the
 * Python reference (astroengine/profections.py); the golden fixtures pin the
 * two together. Whole-sign frame: the sign N signs after the Ascendant is the
 * (N+1)th house. The profection year is a fixed length (the tropical year by
 * default); birthday-exact profections would key off the solar return.
 */
import { mod } from "./core.js";
import { Engine, SIGNS, Zodiac } from "./chart.js";
import { TROPICAL_YEAR } from "./derived.js";

/** Traditional (domicile) ruler of each sign, Aries..Pisces. */
export const SIGN_RULERS = [
  "mars", "venus", "mercury", "moon", "sun", "mercury",
  "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
] as const;

/** Traditional (domicile) ruler of a sign index (0 = Aries). */
export function signRuler(sign: number): string {
  return SIGN_RULERS[mod(sign, 12)];
}

export interface ProfectedSign {
  sign: string;
  sign_index: number;
  /** 1-based whole-sign house from the natal Ascendant. */
  house: number;
  /** Traditional (domicile) lord of the profected sign. */
  lord: string;
}

/** The whole-sign profection `steps` signs after the Ascendant sign. */
export function profectedSign(ascSign: number, steps: number): ProfectedSign {
  const sign = mod(ascSign + steps, 12);
  return { sign: SIGNS[sign], sign_index: sign, house: mod(steps, 12) + 1, lord: signRuler(sign) };
}

export interface Profection {
  age_years: number;
  /** 1-based month within the profection year. */
  month: number;
  annual: ProfectedSign;
  monthly: ProfectedSign;
}

/** Annual and monthly profection at `targetJd` for a natal Ascendant sign. */
export function profection(
  ascSign: number, natalJd: number, targetJd: number, yearLength = TROPICAL_YEAR,
): Profection {
  const age = (targetJd - natalJd) / yearLength;
  const years = Math.floor(age);
  const month = Math.floor((age - years) * 12); // 0..11
  return {
    age_years: years,
    month: month + 1,
    annual: profectedSign(ascSign, years),
    monthly: profectedSign(ascSign, years + month),
  };
}

/** Profection from a natal chart: take the Ascendant sign from the natal chart,
 *  then profect to `targetJd`. */
export function profectionAt(
  engine: Engine, natalJd: number, targetJd: number, lat: number, lonEast: number,
  zodiac: Zodiac = "tropical", yearLength = TROPICAL_YEAR,
): Profection {
  const asc = engine.chartAt(natalJd, lat, lonEast, { zodiac }).angles.asc;
  const ascSign = mod(Math.floor(asc / 30), 12);
  return profection(ascSign, natalJd, targetJd, yearLength);
}
