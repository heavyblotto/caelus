/**
 * caelus-widgets — console formatting (internal).
 *
 * The datum register every console speaks: mono, degree–minute,
 * zodiacal longitudes as sign glyph + in-sign degrees. Shared so the
 * derivation datum line and the comparator's cusp table cannot drift
 * apart typographically.
 */

export const SIGN_GLYPHS = [
  "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓",
];

/** The five major aspects, name → glyph, keyed like the engine's
 *  ASPECTS table. */
export const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};

/** UT calendar date (YYYY-MM-DD) of a Julian Day. */
export function fmtDate(jdUt: number): string {
  return new Date((jdUt - 2440587.5) * 86400000).toISOString().slice(0, 10);
}

/** Degrees to (whole degrees, zero-padded minutes). */
export function dm(deg: number): [number, string] {
  const a = Math.abs(deg);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return [d, String(m).padStart(2, "0")];
}

/** An ecliptic longitude in the console register: `19°27′ ♊`. */
export function fmtZodiac(lon: number): string {
  const l = ((lon % 360) + 360) % 360;
  const [d, m] = dm(l % 30);
  return `${d}°${m}′ ${SIGN_GLYPHS[Math.floor(l / 30)]}`;
}
