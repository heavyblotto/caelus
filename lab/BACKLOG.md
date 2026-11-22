# Caelus R&D Lab and Feature Factory Backlog

Ranked queue of active experiments, follow-up R&D programs, and Feature Factory
candidates. Live measured metrics and verdicts are compiled automatically into
`lab/LEDGER.md` via `node lab/scripts/lab.mjs ledger`.

## 1. Completed and Active R&D Lab Experiments

These eight benchmarks establish empirical ground truth for Caelus's
agent-native Chronosense capabilities directly against `packages/caelus/dist/`
and `python/astroengine/`.

| Rank | ID | Status | Directory | Core Question | Null Baseline | Next Step |
|---|---|---|---|---|---|---|
| 1 | `EXP-003` | `promoted` | `lab/experiments/EXP-003-vlm-observation-bench/` | Does `observe.ts` achieve high spoof-detection F1, diagnostic recovery, chronolocation, and geolocation across 200 noisy global scenarios, plus produce a 30-task VLM eval pack? | `Naive-LMT-Clock` metadata heuristic | Promoted into `FACT-001`; run VLM tool-use eval (`EXP-006`) |
| 2 | `EXP-001` | `proved` | `lab/experiments/EXP-001-chronosense-ablation/` | Does a ~45-token physical-horizon `sceneGeometry` read-write cursor beat passive ISO and synthetic 24h clocks on cross-latitude `night_crossed`, physical deadline accuracy, and cursor-drift catching? | `Baseline-None`, `Control-ISO`, `Control-Synthetic` (`sin/cos 24h`) | Deterministic harness proved; run `EXP-005 --live` to unlock `FACT-002` |
| 3 | `EXP-002` | `proved` | `lab/experiments/EXP-002-phase-resonant-memory/` | Does trimmed physical photoperiod phase indexing + phase-stratified compaction beat LRU and fixed 24h hour cosine on 90-day multi-latitude/travel memory recall? | `Arm1-Semantic-LRU`, `Arm2-Semantic-Fixed24h` | Proved (+39.2 pp compacted Top-1 overall, +62.9 pp photoperiod); optional adapter in `FACT-002` |
| 4 | `EXP-004` | `proved` | `lab/experiments/EXP-004-geo-rope-prototype/` | Does Hybrid Dual-Clock Geo-RoPE (32D step RoPE + 32D Caelus physical torus) preserve intra-turn ordering, post-compaction elapsed time, high-latitude photoperiod recurrence, and multi-week uniqueness? | `Standard-RoPE`, `Unix-Linear-Fourier`, `Caelus-Pure-Geo`, `Hybrid-Unix-Fourier` | Numerical probes proved; graduate to trained tiny-transformer study (`EXP-007`) |
| 5 | `EXP-005` | `active` | `lab/experiments/EXP-005-chronosense-codec-eval/` | Does `Treatment-Caelus-Physical` outperform `Control-ISO`, `Control-Synthetic`, and `Arm4b-Caelus-Symbolic` on `EXP-001/eval_suite.jsonl`? | `Baseline-None`, `Control-ISO`, `Control-Synthetic`, `Arm4b-Caelus-Symbolic` | Offline codec audit & scorer verified (100% Physical vs 98.8% Symbolic / 85% 5-class twilight); run `--live` with API key to clear `FACT-002` hard gate |
| 6 | `EXP-009` | `proved` | `lab/experiments/EXP-009-follow-the-sun-wavefront/` | Does zero-RPC offline solar-horizon quadrant routing (`sceneGeometry`) beat UTC round-robin and longitude-fixed-24h clocks across 8 global cities and 4 seasons? | `Control-UTC-RoundRobin`, `Control-Lon-Fixed24h` | Proved (100% daylight & GC safety, +20.1 pp solstice high/polar daylight, 887 us/tick); candidate zero-RPC helper for swarm orchestration |
| 7 | `EXP-010` | `killed` | `lab/experiments/EXP-010-adaptive-step-stability/` | Does `chartStability` (sect-only) beat fixed polling and direct `sceneGeometry.diurnal.minutesToNextTwilight` as an adaptive sleep-step controller? | `Arm1-Fixed-Poll-30m`, `Arm2-Stability-AllFlips`, `Arm4-Analytic-RiseSet-Jump` | Killed (`KILL-005`): `sceneGeometry.diurnal.minutesToNextTwilight` dominates by 20.9x CPU, 100% vs 40.5% cliff catch, and -54.8% wakeups |
| 8 | `EXP-011` | `killed` | `lab/experiments/EXP-011-synthetic-orbit-collisions/` | Does registering agent task rhythms as virtual `periodic` bodies in `synthetic.ts` + `when()` beat direct `riseSet` + modulo interval intersection? | `Arm3-Direct-RiseSet-Modulo`, `Arm2-WorldFrame-Synthetic-When` | Killed (`KILL-006`): Kepler `a=P^(2/3)` Earth parallax collapses `Arm1` to F1=0.0255; direct `riseSet` + modulo achieves F1=1.0000 and runs 3.11x faster than parallax-free `when()` |

## 2. Queued R&D Lab Programs (Next Tranche)

Use `node lab/scripts/lab.mjs new exp <slug>` when picking up any item below.
(`EXP-005` is now active in `lab/experiments/EXP-005-chronosense-codec-eval/`;
`EXP-006`, `EXP-007`, and `EXP-008` remain reserved below.)

| Rank | Proposed ID | Program | Hypothesis | Null Baseline | Promotion Target |
|---|---|---|---|---|---|
| 1 | `EXP-006` | Live-VLM Observation Tool-Use Eval | Equipping a vision model with Caelus MCP tools (`verify_observation`, `chronolocate`, `geolocate`) on `EXP-003/vlm_eval_pack.jsonl` raises spacetime spoof-detection F1 from near-chance (~0.55-0.65) to >=0.88 at <2 ms local tool latency. | Same VLM without Caelus MCP tools (chain-of-thought only) | Validates agent-native positioning on `ephemengine.com` docs |
| 2 | `EXP-007` | Trained Tiny-Transformer Hybrid Geo-RoPE Forward-Pass Study | Extending `EXP-004` into a small trained autoregressive transformer on synthetic multi-day state-tracking streams recovers Turney-style long-horizon tracking across context resets while preserving circadian/photoperiod generalization across seasonal shifts. | Standard RoPE and Unix-Linear-Fourier RoPE with identical parameter count | Research paper / open-source reference module |
| 3 | `EXP-008` | Delta-T UT External Oracle Validation (`ROADMAP.md` M1 open item) | Cross-check Caelus's UT-to-TT path and historical Delta-T spline before 1948 against independent historical eclipse timing catalogs (Stephenson, Morrison, Hohenkerk 2016 eclipse contact times) where Horizons/Swiss validate only in TT. | Extrapolated polynomial Delta-T | Closes `ROADMAP.md` Milestone 1 open item |

## 3. Feature Factory Queue (`lab/factory/`)

Factory tracks ship production code via `.agents/skills/caelus-factory/SKILL.md`.

| Priority | ID | Track | Roadmap / Lab Link | Promotion Gate | Status |
|---|---|---|---|---|---|
| 1 | `FACT-001` | **Instrument I-05: Field Verifier and Chronolocator** (`packages/widgets/`, `apps/web/`, `apps/site/`) | Builds on shipped `observe.ts` + `EXP-003` scenario presets | `observe` preflight green (ready immediately after current preflight) | `queued` |
| 2 | `FACT-002` | **Chronosense Read-Write Middleware and Citation Auditor** (`<1 ms/turn`) | Promoted from `EXP-001` (and optional phase-stratified hook from `EXP-002`); aligns with mined `auditCitations` trust gap | **Hard gate**: `EXP-001` harness pass AND `EXP-005` live-LLM eval beating `Control-Synthetic` | `queued` |
| 3 | `FACT-003` | **Roadmap Milestones 5 and 6 Closure** (`when()` heliacal predicate + `minted_bodies` MCP tool) | `ROADMAP.md` Milestones 5 & 6 planned remainders | Reference-first Python + golden parity; first `.github/workflows/mint-body.yml` test pack | `queued` |
| 4 | `FACT-005` | **Portable Versioned JSON Envelopes** (`caelus`, `caelus-mcp`, Instruments I-01..I-05, `lab/`) | Mined from `feature/caelus-free` (`99a4085`) | Schema frozen across `chart`, `observe`, and MCP payloads with zero-loss round-trip tests | `queued` |
| 5 | `FACT-006` | **Paired View (Wheel + 3D Dome/Sphere), Reader-Chart Binding, and OKLCH Theme Completeness** | Mined from `feature/caelus-free` (`ae35c25`, `378a3c6`, `88163ce`, `ae015d9`, `caelus-free-audit.md`) & `archive/feature/house-corpus` (`reader-chart.ts`, `ds-01-disposition.md`) | Live-browser SVG + dual-theme contrast check passes in Chromium; pairs cleanly with `FACT-001` | `queued` |
| 6 | `FACT-007` | **Structured Knowledge Graph (`caelus-kb`) for Neuro-Symbolic MCP Discovery** | Mined from `archive/feature/house-corpus` (`packages/kb`: 604 nodes, 578 edges, `computedBy`, `parseCellId`) | **Hard gate**: R&D ablation proves `computedBy` + `parseAtomId` improves multi-step MCP routing or citation resolution over flat tool descriptions | `queued` |
| 7 | `FACT-004` | **Portable Conformance Kit and Rust Engine Port** | `ROADMAP.md` Milestone 7 (post-CPK1 Milestone 4 binary packs) | `CPK1` format frozen; language-agnostic golden bundle signed off | `queued` |

## 4. Mined Prior Art From Archived Branches

Distilled via read-only inspection of `archive/feature/house-corpus` and
`feature/caelus-free` (preserved in git archive refs and the offline backup
bundle). Future sessions can inspect any referenced file directly with
`git show <ref>:<path>` without checking out old branches.

| # | Mined Concept | Source Pointer | Caelus Razor Assessment | Lab Disposition |
|---|---|---|---|---|
| 1 | **Portable Objects** (one versioned JSON envelope for files, share links, and API/MCP payloads) | `feature/caelus-free` commit `99a4085` (`docs/product/proposal.md`) | **Strong win.** Eliminates drift between share codecs, downloaded artifacts, MCP outputs, and Lab receipts while stamping `engineVersion` and `chartDigest` provenance automatically. | Queued as `FACT-005` (`lab/factory/FACT-005-portable-envelopes/`) |
| 2 | **The Planetarium / Paired View** (wheel + sphere linked selection, animated ecliptic flattening, dome + sphere dual projection, layered source overlays) | `feature/caelus-free` commits `ae35c25`, `378a3c6`, `88163ce`, `ae015d9` | **Strong visualization win.** Teaches 3D projection honesty (out-of-bounds declination, parallels, true spatial separation) and directly extends `FACT-001` (paired shadow-compass + 3D sky-dome view) and `caelus-wheel`. | Queued as `FACT-006` (`lab/factory/FACT-006-paired-dome-and-plates/`) |
| 3 | **Structured Knowledge Graph (`caelus-kb`)** (604 nodes, 578 edges, `computedBy` MCP links, `parseAtomId`/`parseCellId`, Wikidata `sameAs`, zero prose) | `archive/feature/house-corpus` (`packages/kb/`) | **Promising, requires ablation.** Clean structural separation (KB structure vs. corpus prose). Must beat flat MCP tool schemas / BM25 on multi-step tool routing and citation auditing before shipping. | Queued (gated) as `FACT-007` (`lab/factory/FACT-007-kb-neurosymbolic-mcp/`) |
| 4 | **Clean-Room Arithmology Engine (`memorativa`)** (7 Agrippa 1651 kameas, sigil tracing, gematria, lambdoma harmonic ratio tables, public-domain golden tests) | `archive/feature/house-corpus` (`packages/memorativa/`) | **Keep separate from `caelus` core.** Pure deterministic math with printed-table oracles (discrete harmonic ratio lattices and geometric sigil tracing are valid standalone utilities), while esoteric correspondence layers stay permanently outside Caelus core per `ROADMAP.md`. | Standalone peer spinout candidate (exported outside core monorepo; optional R&D track if harmonic lattices are needed) |
| 5 | **Plate-Direction Interactive Docs, Live Reader-Chart Binding, and OKLCH Token Discipline** | `archive/feature/house-corpus` (`apps/web/lib/reader-chart.ts`, `docs/design/ds-01-disposition.md`, `components/plates/**`, `scripts/scan-plates.mjs`) | **High UX leverage.** Client-only site-wide chart state (`Share` codec, zero server upload), 8-step type scale, 4px spacing scale, and derived OKLCH light-theme twins prevent dark-only chart ink bugs and pair cleanly with Tufte VDQI checks. | Folded into `FACT-006` and Workbench `tufte-critique` guidance |
| 6 | **Product Catalog and Browser-Audit Lessons** (`auditCitations` trust moat; live rendered-DOM/SVG/contrast verification; curated reference bibliography) | `feature/caelus-free` (`docs/product/caelus-free-audit.md`, `proposal.md`, 13 product/audit docs) and `archive/feature/house-corpus` (`docs/product/library.csv`) | **Critical process + product insight.** (a) `caelus-free-audit.md` proved typechecks + unit tests miss empty SVG renders and broken button contrast; Stage 4 UI gates now require rendered SVG/contrast checks. (b) "Check your AI's answer" (`auditCitations`) stands out as an uncontested trust feature reinforcing `FACT-002`. | Process rule added to `.agents/skills/caelus-factory/SKILL.md`; `auditCitations` anchored in `FACT-002` |

## 5. Permanently Rejected / Out of Scope

Do not re-queue without meeting the documented revival criteria:

- **Secret-Asteroid Spacetime TOTP**: killed in `lab/graveyard/KILL-001-asteroid-totp.md`.
- **Synastry Swarm Routing and Tie-Breaking**: killed in `lab/graveyard/KILL-002-synastry-swarm-routing.md`.
- **Retrograde Duty Cycles and Zodiacal Releasing Daemon Maintenance**: killed in `lab/graveyard/KILL-003-retrograde-zr-maintenance.md`.
- **Void-of-Course Execution Freezes and Parans Latitude Sharding**: killed in `lab/graveyard/KILL-004-voc-freezes-and-parans-sharding.md`.
- **Adaptive Cognitive Step-Size via `chartStability`**: killed in `lab/graveyard/KILL-005-chart-stability-step-control.md` (dominated 20.9x by direct `sceneGeometry.diurnal.minutesToNextTwilight`).
- **Synthetic Orbital Task-Space (`synthetic.ts` + `when()`) for Agent Deadline Scheduling**: killed in `lab/graveyard/KILL-006-synthetic-orbit-task-space.md` (Earth-parallax failure F1=0.0255; direct `riseSet` + modulo reaches F1=1.0000 and runs 3.11x faster).
- **Interpretive flavor tags, symbolic tarot/archetype correspondences, or subjective intensity scores**: permanently out of scope for Caelus core per `ROADMAP.md`.
