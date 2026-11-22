# EXP-005: Chronosense Physical vs. Symbolic Codec Eval Harness

Evaluates all five temporal context codecs emitted in `EXP-001/eval_suite.jsonl` (20 multi-latitude, multi-season tasks across Oslo, New York, Singapore, Sydney, and Tromso in June and December) across **two independent live model families** (`ollama/gemma4:12b` and `ollama/qwen3.5:9b`, 200 live episodes at `temperature = 0`), plus a deterministic offline bounded-decoder audit and an **offline 20-line Spencer/NOAA solar formula baseline (`Control-NOAA-20line`)**.

**Verdict: `PROVED` (`FACT-002` live-LLM gate cleared and shipped).**

![EXP-005 Live 5-Arm Codec Showdown](chart.svg)

## Composite Accuracy Scoring Rubric

Every episode is graded deterministically by `gradeResponse(task, parsed)` in `experiment.mjs` using equal-weighted binary sub-checks (`score_i = passed_checks_i / total_checks_i` in `[0, 1]`):

- **Compaction Stale-Tool slice (`10` tasks, `3` binary checks worth `1/3` each)**:
  1. `night_crossed`: exact boolean match against `ground_truth.night_crossed`.
  2. `fresh_tool_id`: exact string match (`"Tool-A"` or `"Tool-B"`) against `ground_truth.fresh_tool_id`.
  3. `digest_match`: exact lowercase 8-hex-character match (stripping optional `#` or `d=`) against `ground_truth.canonical_digest8`.
- **Photoperiod Deadline slice (`10` tasks, `4` binary checks worth `1/4` each)**:
  1. `is_day`: exact boolean match against `ground_truth.is_day`.
  2. `twilight_stage`: exact 5-class lowercase match (`day | civil | nautical | astronomical | night`).
  3. `deadline_phase`: exact match (`applying | exact | separating`).
  4. `deadline_minutes_within_15m`: numeric match `|pred_min - gt_min| <= 15`.
- **Aggregations**:
  - **Model composite accuracy**: unweighted mean `(1 / 20) * sum_{i=1..20} score_i`.
  - **Live macro composite accuracy**: unweighted mean across both models `(1 / 2) * (score_gemma4 + score_qwen3.5)`, numerically identical to the pooled mean across all `n = 40` `(model, task)` episodes.
  - **Exact task rate**: fraction of episodes passing every check (`passed_checks_i === total_checks_i`, i.e., `score_i = 1.0`).
- **Token counting**: `approxCl100kTokens` (`/[A-Za-z]+|\d+|[^\sA-Za-z\d]/g`) over each arm's `system_header`, reported identically to 2 decimals across `results.json`, `README.md`, and `chart.svg`.

## Arms

Every live arm receives a symmetric, concise 2-line format legend for its own header syntax (including explicit `sin24/cos24` conventions for `Control-Synthetic` and the explicit 12-sign 30-degree zodiac offset table `Ari=0..Pis=330` for `Arm4b-Caelus-Symbolic`):

1. `Baseline-None`: empty system temporal header (`0.00` cl100k tokens).
2. `Control-ISO`: passive UTC ISO-8601 timestamp (`15.00` cl100k tokens).
3. `Control-Synthetic`: elapsed seconds plus fixed 24h `sin/cos` clock wave and due offset (`26.00` cl100k tokens).
4. `Treatment-Caelus-Physical`: physical-horizon header backed by `sceneGeometry` and `canonicalChart`/`chartDigest` (`sun:+23E/rising`, 5-class twilight stage, `sunset:899m`, `due:+902m/applying`, `+night`, `m:101.0`, `#digest8`; `45.75` cl100k tokens).
5. `Arm4b-Caelus-Symbolic`: traditional zodiac sign/degree and planetary-hour shorthand (`Day venus-H3 | Sun 25Gem | Moon 11Can | Asc 04Leo due=+902m/applying +night | d=8605b51b`; `36.75` cl100k tokens).
6. `Control-NOAA-20line` *(offline steelman audit)*: 20-line Spencer (1971) / NOAA solar declination + equation-of-time formula (zero Moon, zero atmospheric refraction on altitude, zero canonical digest; `23.00` cl100k tokens).

## Live-LLM Showdown Results (200 Live Episodes, 10,000-Resample Bootstrap CIs)

Environment note: `ANTHROPIC_API_KEY` was probed via a 1-token ping against `https://api.anthropic.com/v1/messages` (`claude-haiku-4-5`, `claude-sonnet-4-5`) and returned HTTP 401 (`invalid x-api-key`). Live inference executed on two independent local Ollama models (`gemma4:12b` and `qwen3.5:9b`) at `temperature = 0`, `format: "json"`, with zero API errors (`0/200`).

### Overall Accuracy and 95% Bootstrap Confidence Intervals

Confidence intervals use deterministic `B = 10,000` bootstrap resampling (Mulberry32 PRNG, `seed = 20261122`). We report both **episode-level (`n = 40` task-model pairs)** and **task-clustered (`n = 20` tasks averaging both models per task)** 95% CIs to account for within-task correlation across models.

| Arm | cl100k Tokens | Offline Decoder | `gemma4:12b` Live [95% CI] | `qwen3.5:9b` Live [95% CI] | Live Macro Mean | 95% CI (Episode `n=40`) | 95% CI (Task Cluster `n=20`) | Exact Task Rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Baseline-None` | 0.00 | 0.0% | 28.8% [17.9, 40.0] | 32.5% [24.2, 40.8] | 30.6% | [23.3%, 37.7%] | [22.3%, 38.8%] | 0.0% |
| `Control-ISO` | 15.00 | 17.5% | 38.8% [27.9, 50.0] | 42.9% [34.2, 51.2] | 40.8% | [33.5%, 47.9%] | [32.5%, 49.6%] | 0.0% |
| `Control-Synthetic` | 26.00 | 55.8% | 46.7% [30.4, 62.5] | 43.8% [30.4, 57.5] | 45.2% | [34.8%, 55.6%] | [33.8%, 56.5%] | 15.0% |
| `Arm4b-Caelus-Symbolic` | 36.75 | 98.8% | 63.8% [53.3, 73.3] | 63.3% [52.1, 73.8] | 63.5% | [55.8%, 70.6%] | [56.7%, 70.4%] | 12.5% |
| **`Treatment-Caelus-Physical`** | **45.75** | **100.0%** | **75.4%** [65.8, 84.2] | **80.0%** [71.7, 87.9] | **77.7%** | **[71.0%, 83.5%]** | **[70.8%, 83.8%]** | **32.5%** |

### Paired Bootstrap Comparisons (`B = 10,000`, Exact Win / Tie / Loss)

**Do `Treatment-Caelus-Physical` (`77.7%`) and `Arm4b-Caelus-Symbolic` (`63.5%`) separate?** Yes, on both marginal and paired intervals: their marginal 95% CIs do **not** overlap (`[71.0%, 83.5%]` vs `[55.8%, 70.6%]` episode-level; `[70.8%, 83.8%]` vs `[56.7%, 70.4%]` task-clustered), and the paired bootstrap 95% CI on `Physical - Symbolic` cleanly excludes zero under both resampling schemes (`p = 0.0004` episode-level, `p = 0.0008` task-clustered). Per model (`n = 20`), `qwen3.5:9b` separates decisively (`+16.7 pp [+6.3, +27.9]`, `p = 0.0006`), while `gemma4:12b` alone shows the same positive direction (`+11.7 pp`, `9W/9T/2L`) with a borderline two-sided 95% CI `[-1.3, +24.2 pp]` (`p = 0.0760`, one-sided `p = 0.0380`).

| Paired Contrast | Unit | Mean Delta | Paired 95% Bootstrap CI | Two-Sided Bootstrap `p` | Exact Sign-Test `p` | Wins / Ties / Losses |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `Physical - Symbolic` | Episode (`n=40`) | **+14.2 pp** | **[+5.6, +22.5 pp]** | **0.0004** | 0.0026 | **19W / 17T / 4L** |
| `Physical - Symbolic` | Task Cluster (`n=20`) | **+14.2 pp** | **[+5.6, +22.7 pp]** | **0.0008** | 0.0352 | **12W / 5T / 3L** |
| `Physical - Symbolic` | `gemma4:12b` (`n=20`) | +11.7 pp | [-1.3, +24.2 pp] | 0.0760 | 0.0654 | 9W / 9T / 2L |
| `Physical - Symbolic` | `qwen3.5:9b` (`n=20`) | +16.7 pp | [+6.3, +27.9 pp] | 0.0006 | 0.0386 | 10W / 8T / 2L |
| `Physical - Synthetic` | Episode (`n=40`) | **+32.5 pp** | **[+20.8, +44.4 pp]** | **< 0.0001** | 0.0008 | **27W / 6T / 7L** |
| `Physical - Synthetic` | Task Cluster (`n=20`) | **+32.5 pp** | **[+19.8, +44.8 pp]** | **< 0.0001** | 0.0075 | **15W / 2T / 3L** |
| `Physical - ISO` | Episode (`n=40`) | **+36.9 pp** | **[+28.5, +45.6 pp]** | **< 0.0001** | < 0.0001 | **32W / 8T / 0L** |
| `Physical - None` | Episode (`n=40`) | **+47.1 pp** | **[+38.3, +56.0 pp]** | **< 0.0001** | < 0.0001 | **37W / 3T / 0L** |

### Slice Breakdown and Razor Margins

| Metric / Slice | `Treatment-Caelus-Physical` | `Arm4b-Caelus-Symbolic` | `Control-Synthetic` | `Control-ISO` | Physical Margin |
| --- | ---: | ---: | ---: | ---: | --- |
| Live Macro Composite (All 20) | **77.7%** | 63.5% | 45.2% | 40.8% | **+36.9 pp vs ISO** (bar >= 20 pp), **+32.5 pp vs Synth**, **+14.2 pp vs Sym** |
| Compaction Stale-Tool Slice (10 tasks) | **76.7%** | 53.3% | 26.7% | 31.7% | **+50.0 pp vs Synth**, **+23.3 pp vs Sym** |
| Photoperiod Deadline Slice (10 tasks) | **78.8%** | 73.8% | 63.8% | 50.0% | **+15.0 pp vs Synth**, **+5.0 pp vs Sym** |
| High-Latitude Photoperiod (Oslo + Tromso) | **71.9%** | 68.8% | 59.4% | 56.3% | **+12.5 pp vs Synth**, **+3.1 pp vs Sym** |
| 5-Class Twilight Accuracy (`gemma4` / `qwen3.5`) | **100% / 90%** | 90% / 80% | 80% / 60% | 80% / 60% | Physical is the only arm reaching 100% on `gemma4:12b` |
| Canonical Digest Match (`gemma4` / `qwen3.5`) | **90% / 100%** | 100% / 20% | 0% / 0% | 0% / 0% | Physical avoids `d=` / symbolic clutter drop on `qwen3.5:9b` |

## Offline 20-Line NOAA Solar Formula Steelman (`Control-NOAA-20line`)

A sharp reviewer asks: *could a 20-line Spencer (1971) / NOAA solar-declination and equation-of-time formula replace Caelus's ephemeris on `EXP-001`/`EXP-005`?* We implemented the exact 20-line NOAA formula inside `experiment.mjs` and scored it offline against Caelus `sceneGeometry` across all 20 tasks:

| Offline Metric (`EXP-001/eval_suite.jsonl`, 20 tasks) | `Control-NOAA-20line` (23.00 tok) | `Treatment-Caelus-Physical` (45.75 tok) | Verdict |
| --- | ---: | ---: | --- |
| **Overall Offline Codec Score** | 66.7% (10/20 exact) | **100.0%** (20/20 exact) | Caelus `+33.3 pp` overall |
| **Photoperiod Deadline Slice (10 tasks)** | **100.0%** (`is_day`, `twilight_stage`, `deadline_phase`, `<=15m`) | **100.0%** | **Honest Tie** on basic solar daylight/noon/sunset |
| **Compaction Stale-Tool Slice (10 tasks)** | 33.3% (`night_crossed=100%`, `fresh_tool_id=0%`, `digest=0%`) | **100.0%** | Caelus `+66.7 pp` (lunar + digest separation) |
| Mid-Latitude Solar Timing Error vs Caelus | MAE `0.29 min` (max `0.50 min`), alt MAE `0.044 deg` | 0.00 min (reference) | Ties well inside 1-2 min |
| High-Lat / Polar Timing & Horizon Refraction | MAE `0.38 min`; `2` Tromso polar undefined-sunset tasks; `0.25-0.76 deg` low-alt refraction error | Exact refracted horizon + polar fallback | Diverges at polar/grazing horizon |

- **Where a 20-line NOAA formula honestly ties Caelus**: On mid-latitude daylight/darkness, 5-class twilight (away from grazing horizon boundaries), and solar noon or sunset deadlines, 20 lines of Spencer/NOAA trigonometry match Caelus `sceneGeometry` within `0.3-0.5 min` (well under 1-2 min) and score `100.0%` on the offline photoperiod slice.
- **Where Caelus diverges and adds genuine engineering value**:
  1. **Polar refraction and undefined roots**: Unrefracted geometric altitude misses `~0.25-0.76 deg` near grazing horizons (`Tromso June low midnight sun` `0.25 deg`, `NYC equinox sunset` `0.76 deg`), and `cos(ha0)` yields no real sunrise/sunset root on `2` Tromso polar tasks.
  2. **Lunar compaction separation**: A solar-only formula has zero Moon ephemeris, scoring `0/10` (`0.0%`) on `fresh_tool_id` when two cached tool readings share the same local clock minute across days (`moon=85.8deg` vs `moon=101.0deg`).
  3. **Canonical provenance and 3D observation physics**: NOAA-20line emits no canonical chart digest (`0/10` on `digest_match`) and cannot compute the sloped-ground 3D shadows or lunar bright-limb zenith angles required by `EXP-003`/`EXP-006`.
  4. **Unified zero-dependency MCP packaging**: Caelus ships all solar, lunar, horizon, shadow, and cursor-audit primitives in one tested zero-dep TypeScript/Python library (`FACT-002`) rather than fragile per-feature trig snippets.

## Honest Analysis: Wins, Ties, and Surprises (Implemented in `FACT-002`)

1. **Physical dominates Symbolic even with the zodiac table in-prompt**: Even with the explicit 30-degree zodiac table (`Ari=0..Pis=330`) in-prompt, both models lost `-14.2 pp` macro accuracy (`-11.7 pp` on `gemma4:12b`, `-16.7 pp` on `qwen3.5:9b`, paired `p = 0.0004`) and `-23.3 pp` on compaction stale-tool resolution.
2. **Surprise #1 (`sunset:Xm` vs. `due:Ym` interference)**: On `gemma4:12b`, `Control-Synthetic` scored `81.3%` on the 4 high-latitude photoperiod tasks vs `75.0%` for `Treatment-Caelus-Physical` because adjacent `sunset:455m due:+4m/applying` tokens caused minute-field copy confusion (`qwen3.5:9b` reversed that to `68.8%` vs `37.5%`). `FACT-002` fixed this by labeling `horizon_eta` and `deadline_eta` distinctly.
3. **Surprise #2 (Implicit-absence `+night` flag)**: Both models scored `50-60%` on `night_crossed` under an implicit presence/absence `+night` token. `FACT-002` fixed this by emitting explicit `night_crossed=true|false`.

## Reproducibility

Default execution is **100% offline and deterministic** (`< 400 ms`), verifying all 20 ground-truth records live against `packages/caelus/dist/`, running the offline codec + `Control-NOAA-20line` audit, computing 10,000-resample paired bootstrap CIs over `live_receipt.json`, and regenerating `results.json` and `chart.svg`:

```bash
node lab/scripts/lab.mjs run EXP-005
```

To re-execute live inference against Ollama or a cloud API:

```bash
node lab/experiments/EXP-005-chronosense-codec-eval/experiment.mjs \
  --live --provider=ollama --models=gemma4:12b,qwen3.5:9b
```
