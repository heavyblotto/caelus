# Caelus R&D Lab and Feature Factory Backlog

Ranked queue of active experiments, follow-up R&D programs, and Feature Factory
candidates. Live measured metrics and verdicts are compiled automatically into
`lab/LEDGER.md` via `node lab/scripts/lab.mjs ledger`.

## 1. Active R&D Lab Experiments

These four foundational benchmarks establish empirical ground truth for Caelus's
agent-native capabilities directly against `packages/caelus/dist/` and
`python/astroengine/`.

| Rank | ID | Directory | Core Question | Null Baseline | Next Step |
|---|---|---|---|---|---|
| 1 | `EXP-003` | `lab/experiments/EXP-003-vlm-observation-bench/` | Does `observe.ts` achieve high spoof-detection F1, diagnostic recovery, chronolocation, and geolocation across 200 noisy global scenarios, plus produce a 30-task VLM eval pack? | Chance / unassisted VLM geometric estimation | Run VLM tool-use eval (`EXP-006`) and feed presets into `FACT-001` |
| 2 | `EXP-001` | `lab/experiments/EXP-001-chronosense-ablation/` | Does a ~40-token physical-horizon `sceneGeometry` read-write cursor beat passive ISO and synthetic 24h clocks on cross-latitude `night_crossed`, physical deadline accuracy, and cursor-drift catching? | `Baseline-None`, `Control-ISO`, `Control-Synthetic` (`sin/cos 24h`) | Run live-LLM eval over emitted `eval_suite.jsonl` (`EXP-005`) to unlock `FACT-002` |
| 3 | `EXP-002` | `lab/experiments/EXP-002-phase-resonant-memory/` | Does trimmed physical photoperiod phase indexing + phase-stratified compaction beat LRU and fixed 24h hour cosine on 90-day multi-latitude/travel memory recall? | `Arm1-Semantic-LRU`, `Arm2-Semantic-Fixed24h` | Inspect exact slice win/tie breakdown; gate memory plugin on high-latitude/compaction win |
| 4 | `EXP-004` | `lab/experiments/EXP-004-geo-rope-prototype/` | Does Hybrid Dual-Clock Geo-RoPE (32D step RoPE + 32D Caelus physical torus) preserve intra-turn ordering, post-compaction elapsed time, high-latitude photoperiod recurrence, and multi-week uniqueness? | `Standard-RoPE`, `Unix-Linear-Fourier`, `Caelus-Pure-Geo` | If numerical probes pass, graduate to trained tiny-transformer study (`EXP-007`) |

## 2. Queued R&D Lab Programs (Next Tranche)

Use `node lab/scripts/lab.mjs new exp <slug>` when picking up any item below.

| Rank | Proposed ID | Program | Hypothesis | Null Baseline | Promotion Target |
|---|---|---|---|---|---|
| 5 | `EXP-005` | Live-LLM Chronosense Physical vs. Symbolic Codec Eval | Running live LLM inference over `EXP-001/eval_suite.jsonl` reduces temporal confusion, redundant tool loops, and missed deadlines by >=20% vs `Control-ISO` and beats `Control-Synthetic` on cross-latitude/compaction episodes; tests Arm 4a (physical horizon) vs Arm 4b (traditional zodiac tokens). | `Control-ISO` and `Control-Synthetic` on identical model and prompt budget | Unlocks `FACT-002` if physical arm clears bar |
| 6 | `EXP-006` | Live-VLM Observation Tool-Use Eval | Equipping a vision model with Caelus MCP tools (`verify_observation`, `chronolocate`, `geolocate`) on `EXP-003/vlm_eval_pack.jsonl` raises spacetime spoof-detection F1 from near-chance (~0.55-0.65) to >=0.88 at <2 ms local tool latency. | Same VLM without Caelus MCP tools (chain-of-thought only) | Validates agent-native positioning on `ephemengine.com` docs |
| 7 | `EXP-007` | Trained Tiny-Transformer Hybrid Geo-RoPE Forward-Pass Study | Extending `EXP-004` into a small trained autoregressive transformer on synthetic multi-day state-tracking streams recovers Turney-style long-horizon tracking across context resets while preserving circadian/photoperiod generalization across seasonal shifts. | Standard RoPE and Unix-Linear-Fourier RoPE with identical parameter count | Research paper / open-source reference module |
| 8 | `EXP-008` | Delta-T UT External Oracle Validation (`ROADMAP.md` M1 open item) | Cross-check Caelus's UT-to-TT path and historical Delta-T spline before 1948 against independent historical eclipse timing catalogs (Stephenson, Morrison, Hohenkerk 2016 eclipse contact times) where Horizons/Swiss validate only in TT. | Extrapolated polynomial Delta-T | Closes `ROADMAP.md` Milestone 1 open item |

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
- **Interpretive flavor tags, symbolic tarot/archetype correspondences, or subjective intensity scores**: permanently out of scope for Caelus core per `ROADMAP.md`.
