---
name: caelus-lab
description: >-
  Run and operate the Caelus R&D Lab for hypothesis-driven research, empirical
  ablations, and benchmark verification inside `lab/`. Use when the user asks
  to run lab experiments, explore novel agent-native or scientific uses of
  Caelus, test a new hypothesis against a null baseline, triage the research
  backlog, archive a killed idea, or promote a proved winner to the Feature
  Factory. Works on demand, in `/swarm`, overnight via `/goal`, or on a
  recurring `/schedule`.
---

# Caelus R&D Lab Runbook

The Caelus R&D Lab (`lab/`) is an isolated empirical sandbox next to the
production packages (`packages/`, `python/`, `apps/`, `docs/`). Its purpose is
to test new computational, agent-native, and astronomical ideas quickly against
honest baselines, record reproducible receipts, kill dead ends permanently, and
promote proved winners to the Feature Factory (`lab/factory/`).

## Before You Propose or Code Anything

1. Read the current state of the lab:
   - `lab/LEDGER.md` (compiled status and latest measured receipts)
   - `lab/BACKLOG.md` (ranked R&D queue and Factory candidates)
   - `lab/CHARTER.md` (lifecycle rules and `ROADMAP.md` interface)
   - `lab/graveyard/` (every killed idea and why it failed)
2. Run `node lab/scripts/lab.mjs status` to inspect manifests, receipts, and
   hygiene checks live.
3. Never re-propose an idea listed in `lab/graveyard/` unless the specific
   revival condition recorded in its `KILL-*.md` file has actually been met.

## The Caelus Razor (Mandatory Gate)

Every experiment under `lab/experiments/` must declare all four Razor fields in
`manifest.json` before execution:

1. **Hypothesis**: a concrete claim about a measurable outcome produced by a
   real Caelus primitive (`packages/caelus/dist/` or `python/astroengine/`).
2. **Null baseline**: the simplest trivial alternative (`Date.now()`, fixed
   `sin/cos(2*pi*t/T)`, `sha256`/`HMAC-SHA256`, or semantic vector + LRU).
3. **Success bar**: a pre-registered quantitative margin over the null baseline
   on a deterministic, reproducible benchmark.
4. **Kill criterion**: the exact outcome under which the hypothesis is declared
   dead and archived to `lab/graveyard/`.

Rules for honest ablations:

- Separate Caelus's physical ephemeris/horizon math from wrapper mechanics (for
  example, compare read-write cursors using synthetic clocks against read-write
  cursors using Caelus `sceneGeometry`).
- Separate physical-horizon language (`sunAlt`, `civil_dusk`, `minutesToNext`)
  from traditional symbolic vocabulary (`Moon in Scorpio`); test symbolic
  tokens only as an explicit ablation arm.
- Report slices where the baseline ties Caelus alongside slices where Caelus
  wins. Never cherry-pick scenarios or hand-write metrics.

## Standard Operating Workflow

### Step 1: Scaffold the Experiment

```bash
node lab/scripts/lab.mjs new exp <short-kebab-slug>
```

This creates `lab/experiments/EXP-NNN-<slug>/` with:
- `manifest.json` (pre-populated Razor schema)
- `README.md` (design, arms, dataset notes)
- `experiment.mjs` (starter Node ESM harness; replace with `experiment.py` if
  running against `python/astroengine/` and update `entrypoint` in
  `manifest.json`)

### Step 2: Implement Against Built Production Code (Read-Only)

- Import directly from `packages/caelus/dist/` (Node ESM) or
  `python/astroengine/` (Python 3 stdlib only, zero pip installs).
- Keep experiments deterministic (fixed PRNG seeds), zero-network, and fast
  enough to rerun in CI or scheduled sweeps.
- **Strict sandbox boundary**: do NOT edit files under `packages/`, `python/`,
  `apps/`, `docs/`, or `scripts/` from an R&D Lab run. If a bug or missing API
  is discovered in production, log it in `README.md` and queue a Feature
  Factory track instead.

### Step 3: Execute and Capture Receipts

```bash
node lab/scripts/lab.mjs run EXP-NNN
```

The CLI executes the declared `entrypoint`, records exit code and wall-clock
runtime, validates `results.json`, and prints the summary metrics and verdict.
To rerun the entire experiment suite:

```bash
node lab/scripts/lab.mjs run all
```

### Step 4: Optional Visual Plotting and Ledger Regeneration

If the machine-local `tufte-chart` skill (`~/.gemini/config/skills/tufte-chart/`,
kept outside the repository to preserve Caelus's MIT license) is available,
render a zero-chartjunk SVG figure directly from `results.json` and save it as
`lab/experiments/EXP-NNN-<slug>/chart.svg`. Do not vendor third-party skill
files or CSS frameworks into the repository; commit only the generated data
SVG.

```bash
node lab/scripts/lab.mjs ledger
node lab/scripts/lab.mjs check
```

`ledger` deterministically rewrites `lab/LEDGER.md` from all manifests,
`results.json` files, optional `chart.svg` plots, factory specs, and graveyard
entries. `check` validates JSON schemas and verifies zero em-dashes (U+2014)
across `lab/` and `.agents/`.

### Step 5: Decide Disposition (Kill or Promote)

- **If killed**:
  1. Set `"status": "killed"` in `lab/experiments/EXP-NNN-<slug>/manifest.json`.
  2. Write `lab/graveyard/KILL-NNN-<slug>.md` with the hypothesis, the null
     baseline that won, exact measured numbers from `results.json`, and any
     narrow revival condition.
  3. Run `node lab/scripts/lab.mjs ledger`.
- **If proved**:
  1. Set `"status": "proved"` in `lab/experiments/EXP-NNN-<slug>/manifest.json`.
  2. Scaffold a Feature Factory track:
     `node lab/scripts/lab.mjs new fact <slug>`.
  3. Fill `lab/factory/FACT-NNN-<slug>/SPEC.md` and `manifest.json` with a
     direct link to the proving `results.json` receipt, update the experiment
     status to `"promoted"`, and run `node lab/scripts/lab.mjs ledger`.
  4. Hand off implementation to the `caelus-factory` skill on a feature branch.

## Manifest and Receipt Schemas

### `manifest.json`

```json
{
  "id": "EXP-005",
  "title": "Short descriptive title",
  "track": "research",
  "status": "active",
  "created": "2026-11-22",
  "hypothesis": "Falsifiable claim grounded in a specific Caelus primitive.",
  "null_baseline": "Trivial non-ephemeris alternative to beat.",
  "success_bar": "Exact quantitative threshold over the baseline.",
  "kill_criterion": "Exact condition that triggers archival to lab/graveyard/.",
  "entrypoint": "experiment.mjs",
  "tags": ["chronosense", "ablation"]
}
```

Valid `status` values: `idea`, `queued`, `active`, `proved`, `promoted`,
`shipped`, `killed`. Optional fields: `runner` (`"node"` or `"python3"`,
auto-detected from `.mjs`/`.js`/`.py`), `stage`, `dependencies`.

### `results.json`

```json
{
  "id": "EXP-005",
  "run_at": "2026-11-22T15:00:00Z",
  "git_sha": "abc1234",
  "status": "pass",
  "summary": "One-sentence factual summary of the measured outcome.",
  "metrics": {
    "latency_ms": 0.42,
    "accuracy": 0.96
  },
  "verdict": "PROVED / PARTIAL / KILLED with exact comparison against success_bar."
}
```

Valid `results.json` `status` values: `pass`, `fail`, `inconclusive`.

## Running Modes

### On-Demand Single Session

Run `node lab/scripts/lab.mjs status`, pick the top queued item from
`lab/BACKLOG.md`, execute Steps 1 through 5, and report the measured verdict.

### Parallel `/swarm` Mode

Assign disjoint directories to workers so two agents never touch the same file:
- `lab-researcher-*`: each owns one or two `lab/experiments/EXP-NNN-*/`
  directories; runs scripts and writes `results.json`.
- `lab-architect`: owns `lab/BACKLOG.md`, `lab/graveyard/`, `lab/factory/`, and
  runs `node lab/scripts/lab.mjs ledger` plus `check` once researchers post
  `[done]`.
- `lab-skeptic` (optional verifier): audits ablation fairness, checks for
  leakage or missing baselines, and confirms `results.json` reproduces cleanly.

### Overnight `/goal` Mode

Use `/goal` when an experiment needs multiple design-run-diagnose iterations or
an entire backlog tranche (for example, running live-LLM evaluations over
`eval_suite.jsonl` or sweeping parameter spaces across `EXP-001` through
`EXP-004`):
1. Define the terminal condition clearly (all target experiments have fresh
   `results.json`, `lab/LEDGER.md` is regenerated, `lab.mjs check` exits 0, and
   each experiment ends in `proved`, `killed`, or an explicit blocker note).
2. Commit nothing to production branches; keep all outputs inside `lab/`.

### Recurring `/schedule` Mode

Recommended standing schedules for `caelus-lab`:
- **Weekly regression check**: run `node lab/scripts/lab.mjs run all && node lab/scripts/lab.mjs check` after core engine releases to confirm no drift in
  benchmark receipts (`observe`, `chronosense`, `geo-rope`, memory recall).
- **Backlog triage**: compare `lab/BACKLOG.md` against `ROADMAP.md` and promote
  any experiment whose external gate (such as live-LLM evals) has cleared.

## Editorial Hygiene

Follow `docs/editorial-voice.md` everywhere in `lab/`:
- Zero em-dashes (no U+2014 character or HTML em-dash entity). Use commas,
  colons, parentheses, or separate sentences.
- Plain, active engineering prose with exact units and measurements.
- No hype words (`seamless`, `robust`, `leverage`, `game-changing`).
