# EXP-005: Chronosense Physical vs. Symbolic Codec Eval Harness

Evaluates all five temporal context codecs emitted in `EXP-001/eval_suite.jsonl` (20 multi-latitude, multi-season tasks across Oslo, New York, Singapore, Sydney, and Tromso in June and December) and provides the reproducible `--live` LLM grading harness that gates `FACT-002`.

## Arms

1. `Baseline-None`: empty system temporal header.
2. `Control-ISO`: passive UTC ISO-8601 timestamp (`[time] 2026-06-16T05:39:20Z`).
3. `Control-Synthetic`: elapsed seconds plus fixed 24h `sin/cos` clock wave and due offset.
4. `Treatment-Caelus-Physical`: compact physical-horizon header backed by `sceneGeometry` and `canonicalChart`/`chartDigest` (`sun:+23E/rising`, 5-class twilight stage, `sunset:899m`, `due:+902m/applying`, `+night`, `m:101.0`, `#digest8`).
5. `Arm4b-Caelus-Symbolic`: traditional zodiac sign/degree and planetary-hour shorthand (`Day venus-H3 | Sun 25Gem | Moon 11Can | Asc 04Leo`).

## Offline Audit Results (Default Zero-Network Mode)

Running `node lab/scripts/lab.mjs run EXP-005` executes deterministically offline (`~180 ms`, zero network I/O):
- **Ground-truth parity**: `20/20` (`100%`) verified live against `packages/caelus/dist/` (`max |sunAlt diff| = 0.00 deg`).
- **Scorer self-tests**: `20/20` oracle pass rate and `20/20` corrupted-response catch rate (`0%` grader error).

| Arm | Bounded-Decoder Score | Exact Task Rate | Compaction Slice | Photoperiod Slice | 5-Class Twilight (All 20) | cl100k Tokens | Conversion Hops |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Baseline-None` | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.00 | 0 |
| `Control-ISO` | 17.5% | 0.0% | 0.0% | 35.0% | 70.0% | 15.00 | 0 |
| `Control-Synthetic` | 55.8% | 45.0% | 16.7% | 95.0% | 90.0% | 26.00 | 1 |
| `Arm4b-Caelus-Symbolic` | 98.8% | 95.0% | 100.0% | 97.5% | 85.0% | 36.75 | 2 (Moon) |
| `Treatment-Caelus-Physical` | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | 45.75 | 0 |

### Codec Trade-Offs Exposed Offline

- `Arm4b-Caelus-Symbolic` saves `9.0` cl100k tokens per turn (`36.75` vs `45.75`), but collapses the 5 physical twilight regimes (`day`, `civil`, `nautical`, `astronomical`, `night`) into binary `Day`/`Night` (`85%` 5-class accuracy across all 20 tasks because 3 civil/nautical/astronomical twilight cases cannot be distinguished) and requires 2 arithmetic conversion hops (`sign_index * 30 + deg`) to reconcile `Moon 11Can` with decimal tool telemetry (`moon=101.0deg`). Under a symmetric `+/-1` zodiac sign recall slip, `Arm4b` fresh-tool accuracy drops from `100%` to **`50.0%`**.
- `Control-Synthetic` achieves `95.0%` on the 10 photoperiod tasks in `eval_suite.jsonl` because the solar-noon deadline subset only suffers Equation-of-Time drift (`< 15 min`), whereas `Control-Synthetic` collapses to `16.7%` on the compaction stale-tool slice (`0%` fresh-tool disambiguation and `0%` canonical digest verification).

## Honest Disposition and Live-LLM Gate

Default offline execution writes `status: "inconclusive"` because bounded-parser information capacity does not measure how pretrained transformer weights respond to physical vs. symbolic prompts. `FACT-002` therefore remains **`stage-0-gated`** until `--live` is run against a real model:

```bash
GEMINI_API_KEY=... node lab/experiments/EXP-005-chronosense-codec-eval/experiment.mjs \
  --live --provider=gemini --model=gemini-2.5-flash
```

Supported providers: `gemini` (`GEMINI_API_KEY`), `openai` (`OPENAI_API_KEY`), and `anthropic` (`ANTHROPIC_API_KEY`).
