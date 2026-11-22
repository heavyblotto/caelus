# FACT-004: Portable Conformance Kit and Clean-Room Rust Port

- **Factory ID**: `FACT-004`
- **Status**: `queued` (Long-term `ROADMAP.md` Milestone 7)
- **Target Surfaces**: `conformance/` (new portable fixture bundle + grader spec), `rust/` (or standalone `caelus-rs` crate workspace)

## 1. Objective

Operationalize **Milestone 7** from `ROADMAP.md`:

1. **Part A: Language-Agnostic Conformance Kit (`conformance/`)**: Decouple
   Caelus's validation suite from Node/TypeScript test files so any clean-room
   implementation (TypeScript, Python, Rust, Go, C, WebAssembly) can be graded
   mechanically against one versioned fixture archive and tolerance contract.
2. **Part B: Clean-Room Rust Engine Port (`caelus-rs`)**: Implement the
   validated astronomical core and `CPK1` binary pack decoder in zero-dependency
   Rust (`no_std` + `alloc` compatible core, optional `std` / `wasm-bindgen`
   bindings), graded end-to-end against Part A.

## 2. Part A: Conformance Kit Specification

### Bundle Contents

`conformance/` ships as a versioned, self-contained directory (and release
tarball) generated directly from the Python reference:

- `conformance/manifest.json`: schema version, Caelus reference version,
  `CPK1` format version (`1`), SHA-256 digests of every vector file, and
  explicit per-tier numeric tolerances.
- `conformance/packs/`: minimal test `CPK1` binary packs covering embedded
  modern and classical era boundaries (`-3000` to `3000`).
- `conformance/vectors/`:
  - `packbin.json`: exact IEEE-754 hex/decimal decoded Chebyshev coefficients
    verifying exact integer + `2^qexp` scaling (zero `powf` drift).
  - `core-positions.json`: geocentric, heliocentric, topocentric longitudes,
    latitudes, distances, speeds, nutation, obliquity, and Delta-T spline
    (including Morrison-Stephenson-Hohenkerk-Zawilski pre-1948 epochs).
  - `houses-angles.json`: all 12 house systems, GAST, ASC/MC/Vertex, polar
    edge cases.
  - `events-eclipses.json`: rise/set, crossings, stations, lunar phases, solar
    and lunar eclipses, heliacal visibility.
  - `observe.json`: `sceneGeometry`, `verifyObservation`, `chronolocate`, and
    `geolocate` cases matching `observe-golden.json`.
  - `techniques.json`: aspects, dignities, lots, profections, firdaria,
    zodiacal releasing, primary directions, Vedic nakshatras/dashas/vargas/yogas,
    parans, and `dateSky`.
- `conformance/PROTOCOL.md`: strict CLI JSON-lines grading contract so a single
  grader script (`conformance/grade.mjs` or `grade.py`) feeds test requests on
  `stdin` (or links as a harness) and scores any candidate binary, emitting a
  signed JSON scorecard compatible with `accuracy.json`.

### Part A Exit Gate

- Both `python/astroengine/` and `packages/caelus/` score **100% pass**
  against `conformance/` with zero tolerance relaxations.

## 3. Part B: Clean-Room Rust Port (`caelus-rs`)

### Crate Architecture

- `caelus-core` (`#![no_std]` + `alloc`, zero runtime dependencies):
  - `packbin`: bit-exact `CPK1` decoder using integer cumulative sums and exact
    IEEE-754 power-of-two exponent scaling (`f64::from_bits` / `ldexp`
    equivalent, matching `packages/caelus/src/packbin.ts` bit-for-bit).
  - `time`: Julian Day, calendar conversion, TT/UT, Morrison et al. Delta-T
    spline, Vondrak 2011 precession, IAU nutation.
  - `cheb` & `ephemeris`: Chebyshev segment evaluation, planetary/lunar
    positions, light-time aberration, topocentric parallax, fixed stars.
  - `houses`: all 12 house systems and sidereal ayanamsas (7).
  - `events` & `observe`: rise/set, crossings, stations, `scene_geometry`,
    `verify_observation`, `chronolocate`, `geolocate`.
- `caelus-conformance-bin`: thin CLI adapter reading `conformance/PROTOCOL.md`
  test vectors for automated grading.
- Optional `caelus-wasm` / `caelus-py` bindings deferred until `caelus-core`
  hits 100% conformance.

### Part B Acceptance Gates

1. **Bit-exact `CPK1` parity**: decoded coefficients match Python and
   TypeScript to `0 ULPs`.
2. **Core numeric parity**: 100% pass on `conformance/vectors/core-positions.json`,
   `houses-angles.json`, `events-eclipses.json`, and `observe.json` within the
   same uniform `<= 1e-6` bounds as TypeScript.
3. **Zero unsafe / zero runtime deps**: `cargo test`, `cargo clippy -- -D warnings`,
   and `#![forbid(unsafe_code)]` in `caelus-core`.
4. **Throughput receipt**: benchmark suite comparing `caelus-rs` against
   `packages/caelus` on `chartAt`, `sceneGeometry`, `chronolocate`, and
   `dateSky`, stored in `lab/factory/FACT-004-conformance-rust/results.json`.
5. Independent `verifier` audits conformance scorecard and runs existing repo
   `npm run preflight` to ensure zero regressions in JS/Python packages.
