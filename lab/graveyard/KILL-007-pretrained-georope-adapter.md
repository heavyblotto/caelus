# KILL-007: Continuous Slow-Clock Soft-Token Adapters on Frozen Pretrained LLMs

- **ID**: `KILL-007`
- **Date Killed**: `2026-11-22`
- **Category**: Pretrained LLM Weight-Level Temporal Transfer (`EXP-012`)
- **Verdict**: KILLED (`Arm3-LoRA-Caelus-GeoAdapter` reached `90.1%` OOD Solstice+Travel and beat location-aware `Arm2b` by `+49.8 pp` on Oslo Solstices, yet plain-text `Arm1b-LoRA-TextPrompt` strictly dominated at `96.9%` OOD Solstice+Travel and `97.3%` OOD All with `471,297` fewer trainable parameters, breaching the pre-registered `-3.0 pp` kill threshold)

## Original Proposal

Project Caelus's 32-D geocentric physical slow-clock torus (`GAST`, `ASC`, apparent refracted solar altitude and trend, unequal planetary-hour photoperiod arc `ph_rad`, lunar sidereal longitude, synodic elongation, and solar longitude) through a lightweight 2-layer MLP adapter (`32 -> 256 -> 2 x 896`, `471,297` params) into two continuous soft tokens per event inside a strictly frozen `Qwen/Qwen2.5-0.5B-Instruct` backbone (`494,032,768` frozen `bfloat16` weights) paired with rank-8 attention LoRA (`1,081,344` params), matching or beating plain-text `FACT-002` physical-horizon prompt envelopes while compressing per-event clock tokens by `> 95%`.

## Null / Text-Envelope Baseline That Won

`Arm1b-LoRA-TextPrompt`: the exact same frozen `Qwen/Qwen2.5-0.5B-Instruct` backbone with identical rank-8 (`alpha = 16`) attention LoRA (`1,081,344` trainable parameters, `471,297` fewer than the continuous adapter arms) reading compact plain-text `FACT-002` physical-horizon headers (`43` tokens/event).

## Measured Failure Mode (`lab/experiments/EXP-012-pretrained-georope-adapter/results.json`)

Measured across `1,720` strictly held-out evaluation prompts (`580` ID Control + `1,140` OOD across Oslo Winter/Summer Solstices, NYC-to-Tokyo travel, and OOD compaction; `0` overlapping city-days verified by SHA-256) on Apple M5 Pro MPS with exact 95% Wilson score confidence intervals:

| Arm | Trainable Params | ID Control (n=580) | OOD Oslo Solstices (n=640) | OOD Tokyo Travel (n=320) | OOD Solstice+Travel (n=960) | OOD Compaction (n=180) | OOD All (n=1,140) | OOD All CE | Mean Tokens | MPS Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Arm0-Frozen-ISO-Prompt` | 0 | 26.1% [22.5, 29.6] | 21.1% [18.1, 24.4] | 20.9% [16.8, 25.7] | 21.0% [18.6, 23.7] | 32.2% [25.8, 39.4] | 22.6% [20.5, 25.3] | 1.974 | 134.8 | 8.57 ms |
| `Arm1-Frozen-Caelus-TextPrompt` | 0 | 46.8% [42.5, 50.6] | 43.4% [39.7, 47.3] | 40.3% [35.1, 45.8] | 42.4% [39.3, 45.6] | 58.9% [51.6, 65.8] | 44.8% [42.1, 47.9] | 1.240 | 247.7 | 14.69 ms |
| **`Arm1b-LoRA-TextPrompt`** | **1,081,344** | **99.8%** [99.0, 100.0] | **95.6%** [93.8, 97.0] | **99.4%** [97.8, 99.8] | **96.9%** [95.6, 97.8] | **100.0%** [97.9, 100.0] | **97.3%** [96.3, 98.2] | **0.153** | 247.7 | 23.25 ms |
| `Arm2-LoRA-UnixFourier-Adapter` | 1,552,641 | 83.0% [79.5, 85.6] | 36.4% [32.8, 40.2] | 1.6% [0.7, 3.6] | 24.8% [22.2, 27.6] | 54.4% [47.2, 61.6] | 29.0% [26.9, 32.2] | 4.567 | **89.8** | 8.94 ms |
| `Arm2b-LoRA-UnixFourier+LatLon` | 1,552,641 | 87.9% [84.8, 90.2] | 38.1% [34.4, 42.0] | 79.1% [74.3, 83.2] | 51.8% [48.6, 54.9] | 60.0% [52.7, 66.9] | 53.0% [50.2, 56.0] | 3.080 | **89.8** | 9.14 ms |
| **`Arm3-LoRA-Caelus-GeoAdapter`** | **1,552,641** | 95.5% [93.5, 96.9] | 88.0% [85.2, 90.3] | 94.4% [91.3, 96.4] | 90.1% [88.1, 91.8] | 81.1% [74.8, 86.2] | 88.8% [86.7, 90.4] | 0.575 | **89.8** | **9.13 ms** |

Key diagnostic findings:

1. **Continuous physical injection transfers strongly through frozen weights, even after eliminating the location gap**: `Arm3-LoRA-Caelus-GeoAdapter` reaches `90.1%` [88.1%, 91.8%] on OOD Solstice+Travel, beating pure UTC Fourier `Arm2` (`24.8%` [22.2%, 27.6%]) by **`+65.3 pp`**, beating location-aware `Arm2b-LoRA-UnixFourier+LatLon` (`51.8%` [48.6%, 54.9%] Solstice+Travel; `38.1%` [34.4%, 42.0%] Oslo Solstices) by **`+49.8 pp`** on Oslo Solstices (`88.0%` vs `38.1%`) and `+15.3 pp` on Tokyo Travel (`94.4%` vs `79.1%`), and beating zero-shot `Arm1` (`42.4%`) by `+47.7 pp`.
2. **Plain-text `FACT-002` + LoRA strictly dominates accuracy and calibration**: Because frozen `Qwen2.5-0.5B-Instruct` attention heads were pretrained on trillions of discrete text tokens, `Arm1b-LoRA-TextPrompt` reaches **`96.9%`** [95.6%, 97.8%] OOD Solstice+Travel, **`100.0%`** [97.9%, 100.0%] OOD Compaction (CE `0.000` vs `0.708`), and **`97.3%`** [96.3%, 98.2%] OOD All (CE `0.153` vs `0.575`). `Arm3` trails by **`-6.8 pp`** on OOD Solstice+Travel and **`-8.5 pp`** on OOD All, breaching the pre-registered `-3.0 pp` kill criterion (`7/9` Razor bars passed; both `Arm1b` parity bars failed).
3. **Bottleneck**: Compressing multi-event pairwise deltas into 2 continuous soft tokens degrades fine-grained compaction discrimination (`fresh_short` `60.0%`, `multiday_random` `63.3%`, `Oslo Summer Retrieval` `76.2%` vs `91.2%-100.0%` for `Arm1b`).

## Narrow Revival Condition

Do **not** ship continuous slow-clock soft-token weight adapters for general frozen pretrained LLMs; deploy plain-text `FACT-002` envelopes (`[CAELUS-CHRONO ...]`) instead. Revisit `Arm3`-style continuous physical slow-clock adapters **only** under one of two narrow regimes:

1. **Strict token-budget / prefill-latency regime**: an on-device or edge model must ingest hundreds of timestamped memory records per prompt, where `Arm3`'s **`-95.35%` per-event clock token reduction** (`2` soft tokens vs `43` text tokens; `-63.7%` total prompt tokens) and **`2.55x` faster Apple MPS inference** (`9.13 ms` vs `23.25 ms/example`, `2.39x` faster training) outweigh a `7-9 pp` accuracy penalty.
2. **Native from-scratch pretraining**: embedding Caelus physical phases directly into rotary `SO(2)` attention planes during from-scratch pretraining (as verified in `EXP-007`), rather than grafting soft-token adapters onto already-frozen discrete-token weights.
