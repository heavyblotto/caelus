/**
 * The engine version, as a runtime export.
 *
 * Consumers that stamp computed artifacts (the Encyclopedia's figure
 * plates, for one) need the version at runtime without importing
 * package.json metadata into browser bundles. This constant must equal
 * the version field in package.json; scripts/check-versions.mjs at the
 * repo root asserts the two never drift.
 */
export const VERSION = "0.24.1";
