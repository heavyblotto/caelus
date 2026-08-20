# Memorativa build plan

2026-08-20

Memorativa is the arithmology engine, named for the ars memorativa: a
public peer of `caelus`, pure functions with golden tests. Caelus
computes the sky, Memorativa computes the numbers. The KB attributes
meanings to numbers per author with provenance; the Encyclopedia
narrates.

This plan is the Memorativa track's doc of record, the fifth stream
beside `docs/product/corpus-build-plan.md` (content, KB, Encyclopedia),
`docs/product/encyclopedia-widgets-plan.md` (widgets and plates),
`docs/product/visual-design-system-plan.md` (the page), and
`docs/product/local-pipelines-plan.md` (the private store and its
pipelines). Scope was decided in the corpus build plan's stream J and
the maintainer decisions of 2026-08-20; this document records those
decisions and describes the work. Where this file and the corpus build
plan disagree, the corpus build plan wins and this file gets fixed.

Done for the package means the decided inventory below is computed and
golden-tested against the printed tables, the package is wired into
the root gates, and it is ready for the maintainer to release with the
0.25.0 cycle.

Decisions recorded here are owner decisions of 2026-08-20.

---

## Decisions

- **Public peer of `caelus`.** MIT, npm with provenance, version
  0.25.0 riding the open draft. The maintainer releases it with the
  other packages after the build work; agents do not bump, tag, or
  publish.
- **Pure functions with golden tests.** The scanned correspondence
  tables are the golden-test oracle: Agrippa, Skinner, Godwin, the
  tarot shelf. A fixture that disagrees with the printed table fails.
- **The rights split.** Committed goldens pin public-domain sources
  (Agrippa's kameas, the Hebrew letter values). Oracles derived from
  in-copyright scans stay in the private store as hash-pinned
  fixtures.
- **The division of labor.** Memorativa supplies computation only, no
  interpretations. Structure and provenance live in the KB, meaning
  lives in the corpus, discourse lives in the Encyclopedia.
- **A dedicated fifth agent track owns the package.** Recorded in the
  working plan's maintainer-decisions log.
- **Numerical figures stamp the `memorativa` version**, the same
  discipline as engine figures stamping `caelus` (widgets plan,
  "Decisions").

## What the package computes

The inventory as decided in stream J, with the printed oracles named
by the library-ingestion plan's Memorativa row:

| Area | Contents | Golden oracle |
| ------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Theosophical arithmetic | Theosophical reduction and addition | encausse-01 (private fixture) |
| Neutralization | The neutralization operators for binaries, ternaries, quaternaries | the theosophical-arithmetic fixtures |
| Kameas | The seven planetary magic squares: construction, magic constants, sigil tracing across the squares | Agrippa Book II (public domain; the J.F. text is already in the repo) |
| Gematria | Letter values across the systems; notarikon and temurah | Hebrew letter values (public domain, committed); Papus and the tarot shelf (private fixtures) |
| Lambdoma | The ratio tables | godwin-02 and guthrie-02 (private fixtures) |

## The package

The shape follows the `caelus` conventions:

- `packages/memorativa`, package name `memorativa`, ESM, `tsc` build
  to `dist/`.
- `publishConfig` public with provenance; MIT. Release mechanics are
  `docs/releasing.md` and belong to the maintainer.
- Version 0.25.0 in the open draft, with a `src/version.ts` `VERSION`
  export asserted equal to `package.json` by
  `scripts/check-versions.mjs` (the `caelus` `version.ts` pattern), so
  figure stamps never import package metadata into browser bundles.
  The check learns the memorativa row the way it learned the
  independent-version rows for `caelus-corpus` and `caelus-kb`, and
  the package joins the canonical group when the maintainer cuts
  0.25.0.
- Root wiring on landing: root `build` / `test`, CI, and
  `scripts/check-test-wiring.mjs`, so a broken Memorativa fails the
  build. The `caelus-corpus` landing is the precedent.
- The README joins the prose gate's package-README line
  (`scripts/lint-prose.sh`) when the package lands.

## Golden tests and the rights boundary

- **Committed goldens pin public-domain sources.** Agrippa's kameas:
  the J.F. translation of Book II is in the repo at
  `packages/caelus-delineations-pd/sources/text/agrippa-occult-philosophy.txt`,
  carried by the PD manifest. The Hebrew letter values are public
  domain.
- **Private fixtures stay in the private store.** The oracles derived
  from in-copyright scans (Skinner, encausse-01, godwin-02,
  guthrie-02, the tarot shelf) are hash-pinned fixtures produced by
  the local pipeline track; the fixture manifest is the interface
  (`docs/product/local-pipelines-plan.md`). The committed side names
  hashes, not content. Private-fixture tests run where the private
  store lives; the committed goldens are what CI gates.
- The scaffold proceeds on the public-domain goldens. Private
  fixtures slot in as the pipeline track delivers manifests.

## Consumers

- **The widget track.** The `kamea` and `number` widget kinds (grids
  and letter tables, not wheels) draw their quantities from Memorativa
  exports; `packages/widgets` peers on `memorativa`. Per the widgets
  plan: a widget that wants a number is a request for a Memorativa
  export, and the scanned correspondence tables pin the golden
  fixtures.
- **The Encyclopedia.** Numerical figures ride the figure harness the
  same way engine figures do, stamped `Figures · memorativa <version>`.
  The corpus build plan's article table names the rows: magic square
  and sigil; number, tetraktys, gematria.
- **The KB** attributes meanings to numbers per author with
  provenance. Memorativa computes, the KB attributes, the Encyclopedia
  narrates.
- **The art-of-memory articles.** The memory tradition behind the
  engine's name (bruno-01, yates-03, carruthers-01, spence-01) feeds
  the Encyclopedia's articles on the art of memory, per the
  library-ingestion plan.
- **Developers.** The public package serves the developer case; the
  reader take-away path is the embed channel (widgets plan,
  "Architecture").

## Track boundaries

| Artifact | Owner | Consumers | Protocol |
| ------------------------------- | ------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `packages/memorativa` | memorativa agent | widgets, Encyclopedia figures, developers | root build/test/CI, check-versions, check-test-wiring |
| Private oracle fixtures, manifests | local pipeline track | memorativa golden tests | manifest names hashes; content stays in the private store |
| `kamea` / `number` widget kinds | widget agent | Encyclopedia articles | quantities arrive as Memorativa exports, not widget math |
| Number meanings per author | corpus agent (KB curated files) | Encyclopedia infoboxes | provenance edges to source nodes |
| `openmemory.md` | all five tracks | all five tracks | additive edits only |

## Open decisions (for the maintainer)

1. **Branch topology.** The corpus track works directly on
   `feature/house-corpus`; the design track works on
   `feature/visual-design` and merges through the verified ritual. The
   Memorativa track's branch is unchosen.

---

## Verification

- Golden tests pin the committed public-domain tables in CI with the
  root test run; private fixtures run on the maintainer's machine
  against the manifests.
- `check-versions.mjs` carries the memorativa row; `src/version.ts`
  `VERSION` equals `package.json`.
- `check-test-wiring.mjs` asserts every memorativa test file runs in
  CI.
- Once the widget track's `kamea` and `number` kinds consume the
  package, the figure harness verifies the stamped `memorativa`
  version equals the computing version (widgets plan, "Figure
  harness").
