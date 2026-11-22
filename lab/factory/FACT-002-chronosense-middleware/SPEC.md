# FACT-002: Chronosense Read-Write Middleware and Citation Auditor

- **Factory ID**: `FACT-002`
- **Status**: `queued` (**HARD-GATED** on `EXP-001` + `EXP-005` live-LLM eval)
- **Target Surfaces**: `packages/caelus/src/` (or dedicated zero-dep helper module), `packages/caelus-mcp/src/core.ts`, `docs/`

## 1. Promotion Gate (Do Not Start Stage 1 Until Cleared)

This track enforces the Caelus Razor strictly:

1. `EXP-001-chronosense-ablation` (`lab/experiments/EXP-001-chronosense-ablation/results.json`)
   must pass with `< 1 ms/turn` envelope generation latency and `100%`
   deterministic catch rate on injected stale/corrupted write-back cursors.
2. `EXP-005` (live-LLM inference ablation over `EXP-001/eval_suite.jsonl`) must
   demonstrate:
   - `>= 20%` reduction in temporal confusion (`yesterday vs today` across
     compaction), duplicate tool-call loops, and missed deadlines relative to
     `Control-ISO`.
   - Clear margin over `Control-Synthetic` (`elapsed_s + sin/cos(24h)`) on
     high-latitude photoperiod, cross-midnight compaction, and physical
     sunset/solar-noon deadline subsets.
3. If `Control-Synthetic` ties `Treatment-Caelus-Physical` on live LLMs, do
   NOT ship astronomical middleware; extract only generic deadline/cursor
   auditing or kill the track.

## 2. Architecture

A lightweight, zero-network, zero-retraining temporal harness with two pure
functions (Node-free, browser and Cloudflare Worker compatible):

### A. Read Envelope (`chronosenseEnvelope`)

Given `(engine, nowJdUt, lat, lonEast, sessionState)`:
- Computes `sceneGeometry(engine, nowJdUt, lat, lonEast, { prevJdUt, deadlineJdUt })`
  and `chartDigest` prefix (`8` hex chars) from `canonicalChart`.
- Emits a fixed-budget `<= 45`-token plain-text physical-horizon header
  (strictly zero astrological/horoscope labels unless an explicit opt-in flag
  wins in `EXP-005` Arm 4b):

  ```text
  [CAELUS-CLOCK id=a1b2c3d4 turn=14 t=2026-11-22T14:30Z sun=+24.8deg rising
   day=daylight next=sunset(16:34Z,-124m) slot=7/12 night_crossed=true
   dl=deadline(applying,-42m) dt_prev=+14h12m]
  ```

- Runtime budget: `< 1.0 ms` per turn on `embeddedData`.

### B. Write-Back Cursor and Citation Auditor (`auditCitations`)

Before dispatching any mutating tool call or finalizing a turn, the harness
inspects the model's structured write-back cursor block:

```json
{
  "clock_id": "a1b2c3d4",
  "turn": 14,
  "night_crossed_ack": true,
  "deadline_min": -42,
  "cited_facts": ["sun.altitudeApparentDeg", "diurnal.sunsetJdUt"]
}
```

`auditCitations(expectedEnvelope, agentCursor, options)` verifies
deterministically:
1. **Digest match**: `clock_id` equals the current turn's `chartDigest` prefix
   (catches stale compacted headers copied from earlier turns).
2. **Turn monotonicity**: `turn` matches the exact monotonic turn counter.
3. **Regime crossing acknowledgment**: whenever `night_crossed === true` (a
   physical midnight/sunrise boundary elapsed since `prevJdUt`), the agent must
   acknowledge `night_crossed_ack: true` before reusing cached tool outputs
   from the prior day.
4. **Deadline drift check**: `|agentCursor.deadline_min - expectedDeadlineMin| <= toleranceMin`.
5. **Fact provenance audit**: any numeric sky/time claims tagged with
   `cited_facts` are checked against the authoritative `SceneGeometry` record
   (zero hallucinated times or altitudes).

Returns `{ ok: boolean, driftFlags: string[], correctivePrompt: string | null }`.

### C. Optional Phase-Stratified Memory Adapter (Gated on `EXP-002`)

If `EXP-002-phase-resonant-memory` proves a clear margin over `Arm2-Semantic-Fixed24h`
on high-latitude seasonal shifts and post-compaction nocturnal queries, expose
a pure 10D physical phase descriptor helper (`photoperiodVector(scene)`) and a
bucket-preserving compaction selector (`stratifiedSelect(entries, budget)`).

## 3. Target Implementation Plan (Post-Gate)

1. **Stage 1 (Python Reference)**: `python/astroengine/chronosense.py` +
   `python/test_chronosense.py` + `packages/caelus/test/chronosense-golden.json`.
2. **Stage 2 (TS Core)**: `packages/caelus/src/chronosense.ts` (zero deps, zero
   `node:*`) + barrel exports in `packages/caelus/src/index.ts` + golden parity
   test (`<= 1e-6`).
3. **Stage 3 (MCP & Docs)**:
   - Optional `audit_chronosense` helper or envelope field on
     `verify_observation` in `packages/caelus-mcp/src/core.ts` (Node-free) +
     `apps/web/app/api/mcp/route.ts`.
   - Agent cookbook guide `apps/web/app/docs/chronosense/page.mdx` with
     runnable `ts run` example.
4. **Stage 4 (Verifier)**: Full `npm run test:python && npm run build && npm run preflight`.
