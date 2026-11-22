import type { WheelTheme } from "caelus-wheel";

/**
 * The caelus-wheel renderers ship a fixed dark palette for standalone embeds.
 * On the site we feed them live OKLCH design tokens as CSS-variable strings,
 * so every SVG colour resolves against the page's active `data-theme` and
 * tracks the dark/light toggle with zero JS, zero flash, and zero hydration
 * mismatch. Every planet, aspect, ring, and reference-circle token carries a
 * tuned dark and light OKLCH twin in `apps/web/app/globals.css`.
 */
export const WHEEL_PLANET_COLORS: Record<string, string> = {
  sun: "var(--wheel-planet-sun)",
  moon: "var(--wheel-planet-moon)",
  mercury: "var(--wheel-planet-mercury)",
  venus: "var(--wheel-planet-venus)",
  mars: "var(--wheel-planet-mars)",
  jupiter: "var(--wheel-planet-jupiter)",
  saturn: "var(--wheel-planet-saturn)",
  uranus: "var(--wheel-planet-uranus)",
  neptune: "var(--wheel-planet-neptune)",
  pluto: "var(--wheel-planet-pluto)",
  chiron: "var(--wheel-planet-chiron)",
  true_node: "var(--wheel-planet-true-node)",
};

export const WHEEL_THEME: Partial<WheelTheme> = {
  background: "transparent",
  ring: "var(--wheel-ring)",
  ringMinor: "var(--wheel-ring-minor, var(--wheel-ring))",
  axis: "var(--accent)",
  signText: "var(--wheel-sign)",
  planetText: "var(--text)",
  planetColors: WHEEL_PLANET_COLORS,
  labelText: "var(--wheel-label)",
  houseText: "var(--wheel-house)",
  aspectColors: {
    conjunction: "var(--wheel-aspect-conj, var(--wheel-conj))",
    sextile: "var(--wheel-aspect-sextile, #4fb09a)",
    square: "var(--wheel-aspect-square, #c0564f)",
    trine: "var(--wheel-aspect-trine, #4f8fc0)",
    opposition: "var(--wheel-aspect-opposition, #c0564f)",
  },
  horizon: "var(--wheel-horizon, var(--dim))",
  ecliptic: "var(--wheel-ecliptic, var(--warm))",
  meridian: "var(--wheel-meridian, var(--accent))",
  fontFamily: "var(--mono, ui-monospace, 'SF Mono', Menlo, Consolas, monospace)",
};

/**
 * Per-body line inks for AstroMap and EphemerisGraph. Every body maps to its
 * mode-aware OKLCH `--wheel-planet-*` token so curves and meridians maintain
 * strong contrast on both obsidian dark and vellum light surfaces.
 */
export const WHEEL_LINE_COLORS: Record<string, string> = {
  ...WHEEL_PLANET_COLORS,
  moon: "var(--wheel-line-moon, var(--wheel-planet-moon))",
  saturn: "var(--wheel-line-saturn, var(--wheel-planet-saturn))",
};

/**
 * Workbench-aware tokens for PlateConsole on the live site (high-contrast
 * dark/light parity instead of cream-paper ink defaults).
 */
export const WORKBENCH_CONSOLE_TOKENS = {
  rule: "var(--line2)",
  mutedInk: "var(--dim)",
  ink: "var(--text)",
  accent: "var(--warm)",
} as const;
