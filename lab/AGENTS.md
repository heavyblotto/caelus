# Caelus R&D Lab Rules

These rules apply whenever any agent reads, writes, or executes work inside
`lab/`.

## 1. Enforce the Caelus Razor

Every research experiment under `lab/experiments/` MUST define and execute
against a trivial null baseline before claiming a win:

- Time and circadian proposals must beat `Date.now()`, passive ISO strings, and
  fixed `sin/cos(2*pi*t/T)` clocks.
- Routing, hashing, and authentication proposals must beat `sha256` and
  `HMAC-SHA256`.
- Memory retrieval proposals must beat semantic similarity + LRU decay and
  semantic similarity + fixed 24-hour local hour.

Every `manifest.json` must state `hypothesis`, `null_baseline`, `success_bar`,
and `kill_criterion` explicitly before the experiment runs.

## 2. Run No-Placebo Ablations

Isolate Caelus's geocentric ephemeris and horizon geometry from wrapper
mechanics:

- Test read-write loop mechanics separately from astronomical features.
- Test physical-horizon encodings (`sunAlt`, `civil_dusk`, `shadowBearingDeg`)
  separately from traditional symbolic encodings (`Moon in Scorpio`).
- Report every slice where the null baseline ties or beats Caelus. If the
  baseline matches Caelus everywhere, mark the experiment `killed` and archive
  it to `lab/graveyard/`.

## 3. Record Reproducible Metric Receipts

- Never fabricate, extrapolate, or hand-edit benchmark metrics.
- Every experiment must run cleanly via `node lab/scripts/lab.mjs run <id>` and
  emit a valid `results.json` containing `id`, `run_at`, `git_sha`, `status`,
  `summary`, `metrics`, and `verdict`.
- Keep experiment datasets deterministic (seeded PRNGs) and offline (zero
  network calls during benchmark runs).
- After any manifest, receipt, factory spec, or graveyard change, run
  `node lab/scripts/lab.mjs ledger` and `node lab/scripts/lab.mjs check`.

## 4. Respect the Sandbox Boundary

- Treat `packages/`, `python/`, `apps/`, `docs/`, and `scripts/` as read-only
  dependencies when working in `lab/experiments/`.
- Import from already-built artifacts (`packages/caelus/dist/` or
  `python/astroengine/`) with zero added npm or pip dependencies.
- Production changes happen only through the Feature Factory (`caelus-factory`
  skill) on an isolated feature branch (`feat/<slug>`) after an experiment
  clears its promotion gate.

## 5. Check the Graveyard First

Before proposing a new experiment, read `lab/graveyard/KILL-*.md`. Do not
re-test a killed idea unless its documented revival condition has changed. When
an active experiment hits its kill criterion, archive a concise `KILL-NNN-*.md`
postmortem with measured evidence immediately.

## 6. Maintain Caelus Editorial Discipline

All prose in `lab/` (charters, backlogs, specs, READMEs, graveyard notes, and
generated ledgers) follows `docs/editorial-voice.md`:

- **Zero em-dashes** (no U+2014 character and no HTML em-dash entities). Use
  commas, colons, parentheses, or separate sentences.
- Crisp, plain engineering prose with concrete file paths, exact numbers, and
  explicit units.
- Zero marketing hype, metaphors, or filler adjectives (`seamless`, `robust`,
  `leverage`, `revolutionary`, `game-changing`).
