/**
 * Shared chart-display helpers for the playground components (SkyNow, the
 * synastry panel, the bi-wheel). Pure presentation: aspect glyphs and colours,
 * the inter-chart aspect test, the aspectable body order, and pattern labels.
 */
import type { CSSProperties } from "react";
import { ASPECTS, DEFAULT_ORBS, mod } from "caelus";

/** Compact left-aligned table cell, shared by the playground data tables. */
export const cell: CSSProperties = { padding: "0.18rem 0.9rem 0.18rem 0" };

/** Aspectable planets in a fixed display order (nodes and Lilith excluded). */
export const ASPECTABLE_ORDER = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "chiron",
];

/** Unicode glyphs for the five Ptolemaic aspects. */
export const ASPECT_GLYPH: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};

/** Red for hard aspects, green for soft, muted for conjunction. */
export function aspectColor(aspect?: string): string {
  if (aspect === "square" || aspect === "opposition") return "var(--bad)";
  if (aspect === "trine" || aspect === "sextile") return "var(--good)";
  return "var(--text-mute)";
}

/** The single aspect two longitudes form within the engine's default orbs, or null. */
export function crossAspect(lonA: number, lonB: number): { aspect: string; orb: number } | null {
  const sep = Math.abs(mod(lonA - lonB + 180, 360) - 180);
  let best: { aspect: string; orb: number } | null = null;
  for (const [name, angle] of Object.entries(ASPECTS)) {
    const orb = Math.abs(sep - angle);
    if (orb <= (DEFAULT_ORBS[name] ?? 0) && (!best || orb < best.orb)) {
      best = { aspect: name, orb: Math.round(orb * 100) / 100 };
    }
  }
  return best;
}

/** An inter-chart contact: one body in each chart plus the aspect between
 *  them. The shape the cross-aspect scans produce; ringContacts() adapts it
 *  for a two-ring MultiWheel. */
export interface SynContact { aBody: string; bBody: string; aspect: string; orb: number }

/** MultiWheel `contacts` for a two-ring wheel (ring 0 = inner chart). */
export function ringContacts(contacts: SynContact[]) {
  return contacts.map((k) => ({
    a: { ring: 0, body: k.aBody },
    b: { ring: 1, body: k.bBody },
    aspect: k.aspect,
    orb: k.orb,
  }));
}

/** Human labels for the configuration kinds from detectPatterns(). */
export const PATTERN_LABEL: Record<string, string> = {
  grand_cross: "Grand cross", mystic_rectangle: "Mystic rectangle", kite: "Kite",
  t_square: "T-square", grand_trine: "Grand trine", yod: "Yod",
  stellium_sign: "Stellium (sign)", stellium_house: "Stellium (house)",
};
