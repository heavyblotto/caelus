# EXP-001: Chronosense 4-Arm Ablation Benchmark

## Purpose

Evaluate whether a compact (~45-token) physical-horizon context envelope and read-write cursor backed by Caelus (`sceneGeometry`, `canonicalChart`, `chartDigest`, `riseSet`) measurably outperforms standard temporal baselines across multi-day, multi-latitude agent episodes with forced context compactions, physical deadlines, stale-tool traps, and cursor corruption.

## Arms

1. `Baseline-None`: No temporal signal injected.
2. `Control-ISO`: Passive UTC ISO-8601 timestamp (`[time] 2026-06-16T05:39:20Z`).
3. `Control-Synthetic`: Elapsed seconds plus fixed 24h `sin/cos(2*pi*t/86400)` clock wave (evaluated under both civil timezone and longitude-adjusted mean solar time).
4. `Treatment-Caelus-Physical`: Compact physical-horizon envelope built from `packages/caelus/dist/src/observe.js` (`sceneGeometry`) and `canonical.js` (`canonicalChart` + `chartDigest` on `"centideg"` grid) plus a deterministic pre-tool cursor-audit hook.
5. `Arm4b-Caelus-Symbolic` (emitted in `eval_suite.jsonl`): Zodiac sign/degree and planetary-hour symbolic variant of the same instant for downstream live-LLM codec A/B testing.

## Benchmark Design

- **100 deterministic 72h episodes** (1,200 turns, 1,100 transitions, 200 forced context compaction boundaries) across **5 latitudes x 2 seasons**:
  - Oslo (`59.91N, 10.75E`), New York (`40.71N, -74.01E`), Singapore (`1.35N, 103.82E`), Sydney (`33.87S, 151.21E`), Tromso (`69.65N, 18.96E`), in June and December 2026.
- **Physical deadlines**: 50 sunset episodes (10 in polar Tromso with no physical sunset, handled via explicit polar fallback) and 50 apparent solar-noon episodes.
- **Stale-tool traps**: 200 post-compaction traps pairing a 24h-old identical wall-clock (`HH:MM`) cached reading against a 2-minute-old reading, evaluated under both Condition A (clock-time / periodic phase only) and Condition B (intact full scalar timestamp).
- **Cursor-drift injection**: 900 clean turns (with small realistic rounding jitter) plus 300 corrupted write-back cursors across 5 failure modes (60 each): stale compaction replay, night-crossed/deadline phase flip, ephemeris angle drift, canonical digest tamper, and twilight/day-night flip.
- **Live-LLM eval pack**: Emits `eval_suite.jsonl` (20 structured multi-turn prompts covering all 5 cities x 2 seasons x 2 task archetypes across all 4 arms plus `Arm4b-Caelus-Symbolic`).

## Running

```bash
node lab/experiments/EXP-001-chronosense-ablation/experiment.mjs
```

Outputs `results.json` and `eval_suite.jsonl` inside this directory.

## Key Results (Measured)

| Metric | Baseline-None | Control-ISO (UTC) | Control-Synthetic (LonMean 24h) | Treatment-Caelus-Physical |
|---|---:|---:|---:|---:|
| Tokens (cl100k approx / whitespace) | 0.0 / 0.0 | 16.0 / 2.0 | 24.5 / 5.0 | 45.5 / 8.3 (56.5 full scene line) |
| Compute latency mean (us/turn) | 0.1 | 0.4 | 1.3 | 1244 (818 scene only) |
| Local `night_crossed` accuracy (all / compaction) | 72.7% / 67.5% | 67.6% / 54.5% | 99.1% / 98.5% (92.6% civil) | 100.0% / 100.0% |
| Physical daylight (`isDay`) accuracy | 49.4% | 47.6% | 81.2% (79.1% civil) | 100.0% |
| Sunset deadline MAE / max (min, non-polar) | n/a | 459.7 / 1050.7 | 88.7 / 206.8 (127.1 / 283.8 civil) | 0.0 / 0.0 |
| Polar no-sunset episodes handled | n/a | hallucinates | hallucinates | 10 / 10 detected |
| Stale-tool 24h catch (Cond A / Cond B) | 0% / 0% | 0% / 100% | 0% / 100% | 100% / 100% |
| Pre-tool cursor drift TPR / FPR | 0.0% / 0.0% | 20.0% / 0.0% | 20.0% / 0.0% | 100.0% / 0.0% |

## Honest Epistemic Boundaries

- **Where controls tie Caelus:** Intact scalar ISO dates or monotonic `elapsed` counters already catch 100% of Condition B stale-tool traps and preserve 100% deadline monotonicity once a fixed timestamp is set. Equatorial Singapore daylight is closely matched by a longitude-mean 24h wave (though civil UTC+8 still shifts Singapore solar noon by ~65 min). Longitude-mean solar midnight matches Caelus `night_crossed` on 99.1% of transitions (diverging only inside Equation of Time bounds).
- **What requires live-LLM inference:** This harness proves exact token overhead, sub-2ms offline latency, physical horizon accuracy across latitudes/seasons, and deterministic pre-tool drift auditing. Testing whether live transformer attention improves long-context reasoning with Physical vs Symbolic envelopes requires executing `eval_suite.jsonl` against live LLM endpoints.
