# Provenance — what this is, and what changed on the way out

Extracted 2026-08-17 from the `feature/caelus-free` branch of the Caelus
monorepo, at commit `74706c8`.

Three things came across: the corpus, the editorial machinery, and the open
backlog. Product and project documents were deliberately left behind.

## What changed

Everything below is a change made during extraction, not something that was
true in the source repo. Nothing else was touched: the 249 passage files, the
grid, the lints, the harness and the pipeline scripts are byte-identical to
their source.

### 1. The `caelus-delineations-pd` dependency is gone

`src/selectors.ts` is new. It carries the `SelectorSpec` type union and
`selectorFromSpec()`, vendored verbatim from `caelus-delineations-pd` v0.1.6
(`src/types.ts` lines 36-71 and `src/compile.ts` lines 24-105). Three imports
were repointed at it:

| File | Was | Now |
|---|---|---|
| `src/types.ts` | `SelectorSpec` from `caelus-delineations-pd` | `./selectors.js` |
| `src/compile.ts` | `selectorFromSpec` from `caelus-delineations-pd` | `./selectors.js` |
| `test/validation.test.ts` | `selectorFromSpec` from `caelus-delineations-pd` | `../src/selectors.js` |

**Why.** pd was a sibling package in the source monorepo, and its v0.1.6 —
which carries every selector kind this corpus needs — is the version that
shipped alongside the engine work. Depending on it here would mean keeping two
packages' selector vocabularies in lockstep across two repositories, for the
sake of 150 lines. Vendoring makes the engine the single dependency.

**To reverse it**, if pd travels to the new project after all: delete
`src/selectors.ts`, point those three imports back at `caelus-delineations-pd`,
and add it to `peerDependencies` at `>=0.1.6`.

**The maintenance cost you have accepted.** When the engine adds a `FactKind`,
`src/selectors.ts` is where you teach the corpus about it. It is one switch
statement and one type union, and the harness fails loudly if a spec kind has
no selector.

### 2. Paths in the pipeline sheets were rewritten

23 references across the writer, reviewer and wave sheets pointed at
monorepo paths. All now resolve inside this bundle:

- `docs/editorial-voice.md` → `editorial/editorial-voice.md`
- `packages/caelus-corpus/pipeline/*` → `pipeline/*`
- "from `packages/caelus-corpus`" → "from the package root"

### 3. Two scripts were genericized

- `editorial/scripts/check-em-dashes.mjs` took no arguments and walked a
  hard-coded `apps/web`. It now takes one or more directories.
- `editorial/scripts/lint-prose.sh` referenced monorepo paths throughout. It
  now runs off a `PROSE_DIRS` variable and degrades honestly when there is no
  app to lint yet.

`.vale.ini` was rewritten to match: `StylesPath` points at `editorial/styles`,
the repo-specific sections are gone, and the `pipeline/*.md` sheets are graded
for spelling only (they quote the phrasings they ban, so the slop rules would
fail them).

### 4. Two lints were added to the public API

`lintFormulaClusters` and `lintCrossFamilyEchoes` existed but were not
exported from `src/index.ts`; the report scripts reached into `dist/` for
them. They are now exported. `selectorFromSpec` is exported too, since it is
this package's code now.

### 5. `pipeline/report-backlog.mjs` is new

The three interactive reports print to a terminal. This one writes
`backlog/*.md`, so the backlog is committed, readable without a build, and
visibly shrinking in the diff as waves land. Run it after every repair wave.

## What was deliberately left behind

The product and project documents: the proposal, the feature map, the build
plan, the design direction, the competitive research, the audit, and the
session handoff. Also the web application, the engine, the public-domain
corpus, and the MCP server.

One consequence worth knowing: the pipeline sheets and a few source comments
cite "proposal §6" as the authority for the writing standard. That document
did not travel. The standard it names is fully described in
`pipeline/voice-sheet.md` and `editorial/editorial-voice.md`, which did, so
the citations are dangling references rather than missing information.

## Verification

The bundle was built and tested standalone before packing, against the engine
built from the same branch:

```
tsc                                  clean
node dist/test/validation.test.js    house corpus validation passed
                                     3,096 / 3,096 cells written and firing
node pipeline/report-backlog.mjs     320 / 49 / 444 findings
node pipeline/register-sets.mjs      regenerates src/passages.ts byte-identically
```

The engine used for that run was `caelus` packed from the branch at version
0.24.1, which is the code that became 0.25.0. When 0.25.0 publishes, the
declared range resolves to it with no change here.
