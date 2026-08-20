/**
 * The Memorativa version, as a runtime export.
 *
 * Consumers that stamp computed artifacts (the Encyclopedia's numerical
 * figure plates, for one) need the version at runtime without importing
 * package.json metadata into browser bundles. This constant must equal
 * the version field in package.json; scripts/check-versions.mjs at the
 * repo root asserts the two never drift. Same pattern as the caelus
 * engine's src/version.ts.
 */
export const VERSION = "0.25.0";
