# Caelus R&D Lab and Feature Factory Ledger

Generated deterministically by `node lab/scripts/lab.mjs ledger` from `lab/experiments/*/manifest.json`, `results.json`, `lab/factory/*/manifest.json`, and `lab/graveyard/KILL-*.md`. Do not hand-edit metrics in this file.

- **Branch**: `swarm-lab-steelman-exp-d61cdd4b`
- **Git HEAD**: `0ee232d`
- **Research Experiments**: 11 (11 with verified receipts)
- **Feature Factory Tracks**: 7
- **Graveyard Kills**: 7

## 1. Research Experiments Overview

| ID | Title | Status | Receipt | Key Metrics | Path |
|---|---|---|---|---|---|
| `EXP-001` | Chronosense 4-Arm Ablation: Physical-Horizon Envelope, Read-Write Cursor, and Drift Audit | `proved` | `pass` (2026-11-22) | caelus_night_crossed_accuracy=1, iso_utc_night_crossed_accuracy=0.6764, caelus_daylight_accuracy=1, synth_24h_daylight_accuracy=0.8117 | `lab/experiments/EXP-001-chronosense-ablation/` |
| `EXP-002` | Dyadic Circadian and Phase-Resonant Episodic Memory Benchmark (3-Arm Ablation) | `proved` | `pass` (2026-11-22) | compacted4x_arm3_top1=0.8, compacted4x_arm2_top1=0.4083, compacted4x_arm1_top1=0.2083, compacted4x_arm3_top3=0.9083 | `lab/experiments/EXP-002-phase-resonant-memory/` |
| `EXP-003` | Spacetime Observation, Spoof-Detection, Chronolocation and Geolocation Benchmark Suite | `promoted` | `pass` (2026-11-22) | caelus_spoof_detection.precision=1, null_baseline_naive_lmt.precision=0.8947, counterfactual_diagnostics.axis_recovery_rate=1, chronolocation.noisy_recall=1 | `lab/experiments/EXP-003-vlm-observation-bench/` |
| `EXP-004` | Hybrid Dual-Clock Geo-RoPE Mathematical Prototype and Numerical Simulation | `proved` | `pass` (2026-11-22) | Standard-RoPE.mean_50step_2s_separation_margin=0.5258, Standard-RoPE.mean_overnight_reset_sep_margin_64d=0, Standard-RoPE.isotropic_64d_top1_acc=0.09, Standard-RoPE.isotropic_64d_top1_acc=0.14 | `lab/experiments/EXP-004-geo-rope-prototype/` |
| `EXP-005` | Chronosense Physical vs. Symbolic Codec Eval Harness (Offline Audit and Live-LLM Runner) | `proved` | `pass` (2026-11-22) | live_physical_accuracy=0.7771, live_symbolic_accuracy=0.6354, live_synthetic_accuracy=0.4521, live_iso_accuracy=0.4083 | `lab/experiments/EXP-005-chronosense-codec-eval/` |
| `EXP-006` | Live Observation Tool-Use Eval (CoT-Only vs. Caelus MCP Tools) | `proved` | `pass` (2026-11-22) | cot_spoof_f1=0.7247, mcp_spoof_f1=0.9445, spoof_f1_margin=0.2198, cot_authentic_false_positive_rate=1 | `lab/experiments/EXP-006-live-vlm-observation-eval/` |
| `EXP-007` | Trained Tiny-Transformer Hybrid Dual-Clock Geo-RoPE and Google SLEEP Continual Learning Study | `active` | `inconclusive` (2026-11-22) | geo_rope_t1_intra_turn_accuracy=0.825, unix_fourier_t1_intra_turn_accuracy=0.841, std_rope_t1_intra_turn_accuracy=0.8129, geo_rope_t2_post_sleep_accuracy=1 | `lab/experiments/EXP-007-geo-rope-sleep-transformer/` |
| `EXP-009` | Geocentric Follow-the-Sun Wavefront Orchestration (4-Season Global Swarm Ablation) | `proved` | `pass` (2026-11-22) | caelus_overall_daylight_accuracy=1, lon_fixed24h_overall_daylight_accuracy=0.9476, utc_rr_overall_daylight_accuracy=0.4898, caelus_solstice_high_polar_daylight_accuracy=1 | `lab/experiments/EXP-009-follow-the-sun-wavefront/` |
| `EXP-010` | Adaptive Cognitive Step-Size Control: chartStability vs. Direct sceneGeometry Horizon Jumps vs. Fixed Polling | `killed` | `fail` (2026-11-22) | Arm1-Fixed-Poll-30m.median_cliff_timing_err_min=7.3406, Arm2-Stability-AllFlips.median_cliff_timing_err_min=7.0551, Arm3-Stability-Physical-SectOnly.median_cliff_timing_err_min=7.3999, Arm4-Analytic-RiseSet-Jump.median_cliff_timing_err_min=0 | `lab/experiments/EXP-010-adaptive-step-stability/` |
| `EXP-011` | Synthetic Orbital Task-Space (synthetic.ts + when()) vs. Direct riseSet Modulo Interval Intersection | `killed` | `fail` (2026-11-22) | arm1_synthetic_engine_event_f1=0.0255, arm1_synthetic_engine_overlap_time_f1=0.046, arm2_worldframe_when_event_f1=0.9987, arm2_worldframe_when_overlap_time_f1=0.9992 | `lab/experiments/EXP-011-synthetic-orbit-collisions/` |
| `EXP-012` | Pretrained Frozen LLM Transfer Test for Physical Slow-Clock Adapters | `killed` | `fail` (2026-11-22) | frozen_base_params=494032768, arm1b_trainable_params=1081344, arm2_arm2b_arm3_trainable_params=1552641, arm0_ood_solstice_travel_acc=0.2104 | `lab/experiments/EXP-012-pretrained-georope-adapter/` |

## 2. Experiment Receipts and Razor Records

### EXP-001: Chronosense 4-Arm Ablation: Physical-Horizon Envelope, Read-Write Cursor, and Drift Audit

- **Directory**: `lab/experiments/EXP-001-chronosense-ablation/`
- **Chart**: `lab/experiments/EXP-001-chronosense-ablation/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `ablation`, `observe`, `canonical`, `cursor-audit`, `photoperiod`
- **Hypothesis**: Injecting a compact (~40-token) Caelus physical-horizon envelope backed by sceneGeometry and canonicalChart/chartDigest outperforms no-clock, passive UTC ISO, and fixed-24h synthetic sinusoid controls on cross-compaction local night_crossed disambiguation, high-latitude solar-horizon deadline accuracy, daylight/twilight regime accuracy, and deterministic pre-tool cursor drift detection at sub-2ms offline compute cost.
- **Null Baseline**: Passive UTC ISO-8601 timestamp (Control-ISO) and elapsed-seconds plus fixed 24h sin/cos clock wave (Control-Synthetic).
- **Success Bar**: 100% local night_crossed accuracy across all 5 latitudes x 2 seasons (vs <90% UTC-ISO), 0.0 min physical sunset/solar-noon deadline error (vs >60 min MAE for fixed-24h clock across latitudes), >=99% deterministic cursor drift detection at 0% false positive rate on clean turns, mean compute latency <=2500 us/turn, and <=55 cl100k-approx tokens/turn.
- **Kill Criterion**: If Treatment-Caelus-Physical fails to beat Control-Synthetic by >=15 percentage points on high-latitude daylight/twilight accuracy or >=45 min MAE on physical sunset deadlines, or exceeds 100 tokens/turn or 10 ms/turn offline latency.

**Latest Receipt**: `pass` (run at `2026-11-22T21:05:43.883Z`, git SHA `0ee232d`)

- **Summary**: 100 72h episodes (1,200 turns) across 5 latitudes x 2 seasons. Treatment-Caelus-Physical achieves 100.0% local night_crossed accuracy (vs 67.6% UTC Control-ISO), 100.0% physical daylight classification (vs 81.2% fixed-24h Control-Synthetic), 0.000 min sunset deadline error (vs 88.7 min MAE / 206.8 min max for longitude-adjusted fixed-24h clock plus 10 polar no-sunset episodes), and 100.0% pre-tool cursor drift detection at 0.0% FPR in 1469 us/turn (~45.5 cl100k tokens).
- **Verdict**: PASS (deterministic harness): Caelus physical-horizon envelope + canonical cursor-audit hook clears every accuracy, latency, token-budget, and drift-detection bar against both ISO and fixed-24h synthetic controls; live-LLM inference on eval_suite.jsonl remains the next empirical gate.

| Metric | Value |
|---|---|
| `caelus_night_crossed_accuracy` | `1` |
| `iso_utc_night_crossed_accuracy` | `0.6764` |
| `caelus_daylight_accuracy` | `1` |
| `synth_24h_daylight_accuracy` | `0.8117` |
| `caelus_sunset_mae_min` | `0` |
| `synth_24h_sunset_mae_min` | `88.74` |
| `caelus_drift_caught_rate` | `1` |
| `caelus_drift_false_positive_rate` | `0` |
| `caelus_mean_us` | `1468.93` |
| `compute_latency_us.Baseline-None.mean` | `0.119` |
| `compute_latency_us.Baseline-None.median` | `0.083` |
| `compute_latency_us.Baseline-None.p95` | `0.291` |
| `compute_latency_us.Baseline-None.p99` | `0.625` |
| `compute_latency_us.Baseline-None.max` | `19.708` |
| `compute_latency_us.Control-ISO.mean` | `0.783` |
| `compute_latency_us.Control-ISO.median` | `0.5` |
| `compute_latency_us.Control-ISO.p95` | `1.708` |
| `compute_latency_us.Control-ISO.p99` | `3.916` |
| `compute_latency_us.Control-ISO.max` | `60.875` |
| `compute_latency_us.Control-Synthetic.mean` | `2.616` |
| `compute_latency_us.Control-Synthetic.median` | `2.041` |
| `compute_latency_us.Control-Synthetic.p95` | `5.042` |
| `compute_latency_us.Control-Synthetic.p99` | `13.042` |
| `compute_latency_us.Control-Synthetic.max` | `82.625` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.mean` | `946.842` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.median` | `887.917` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.p95` | `1476.458` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.p99` | `2241.167` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.max` | `2778.708` |
| `compute_latency_us.Treatment-Caelus-Physical.mean` | `1468.928` |
| `compute_latency_us.Treatment-Caelus-Physical.median` | `1378.708` |
| `compute_latency_us.Treatment-Caelus-Physical.p95` | `2232.5` |
| `compute_latency_us.Treatment-Caelus-Physical.p99` | `2955.625` |
| `compute_latency_us.Treatment-Caelus-Physical.max` | `3970.625` |
| `compute_latency_us.Treatment-Caelus-AuditHook.mean` | `1458.313` |
| `compute_latency_us.Treatment-Caelus-AuditHook.median` | `1365.208` |
| _additional detail_ | `282 more metric entries in lab/experiments/EXP-001-chronosense-ablation/results.json` |

### EXP-002: Dyadic Circadian and Phase-Resonant Episodic Memory Benchmark (3-Arm Ablation)

- **Directory**: `lab/experiments/EXP-002-phase-resonant-memory/`
- **Chart**: `lab/experiments/EXP-002-phase-resonant-memory/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `memory`, `circadian`, `photoperiod`, `phase-stratified-compaction`, `counterfactual`, `planetary-hour`
- **Hypothesis**: Indexing episodic memories with a trimmed Caelus physical phase vector (solar altitude/trend, diurnal sect, photoperiod-warped planetary-hour arc, lunar elongation, solar seasonal longitude via sceneGeometry and pheno) paired with phase-stratified compaction (retaining diurnal, photoperiod, and counterfactual travel-relocation strata) significantly improves Top-1 and Top-3 recall over Semantic-LRU and Semantic-Fixed24h on high-latitude seasonal photoperiod shifts, post-compaction nocturnal queries, and NYC-to-Tokyo travel handoffs.
- **Null Baseline**: Arm1-Semantic-LRU (semantic cosine + exponential recency decay, LRU eviction) and Arm2-Semantic-Fixed24h (semantic cosine + fixed 24h sin/cos local clock, LRU eviction; plus oracle-TZ diagnostic Arm2b-LocalCivil24h).
- **Success Bar**: Under 4x compaction (90/360 budget), Arm3-Semantic-Caelus-Photoperiod beats both Arm1 and Arm2 by >=20 percentage points Top-1 overall, >=25 pp Top-1 on high-latitude photoperiod shift queries, >=35 pp Top-1 on post-compaction nocturnal queries, and >=25 pp Top-1 on travel-handoff queries, while maintaining sub-1500 us indexing and sub-500 us query latency.
- **Kill Criterion**: If Arm3 fails to beat Arm2-Semantic-Fixed24h by >=15 pp Top-1 on high-latitude photoperiod shifts or >=20 pp Top-1 on post-compaction nocturnal recall, or degrades stationary recent control recall by >20 pp.

**Latest Receipt**: `pass` (run at `2026-11-22T21:05:45.661Z`, git SHA `0ee232d`)

- **Summary**: 90-day Oslo/NYC/Tokyo trace (360 memories, 120 recall queries; Oslo daylight drops 12.26h -> 5.90h). Uncompacted Top-1: Arm1=20.8%, Arm2=64.2%, Arm3=86.7% (photoperiod 82.9% vs 5.7%). Under 4x compaction (90/360) Top-1: Arm1=20.8%, Arm2=40.8%, Arm3=80.0% (photoperiod 62.9% vs 0.0%, nocturnal 100.0% vs 33.3%, travel 73.3% vs 46.7%). Index=1218 us, Query=1148 us (69 us scan-only).
- **Verdict**: PASS: Arm3-Semantic-Caelus-Photoperiod clears all 4x-compacted overall and slice recall bars against Arm1-Semantic-LRU and Arm2-Semantic-Fixed24h, while honestly reporting exact slices where Fixed24h/LRU ties or slightly edges Arm3 on stationary recent density.

| Metric | Value |
|---|---|
| `compacted4x_arm3_top1` | `0.8` |
| `compacted4x_arm2_top1` | `0.4083` |
| `compacted4x_arm1_top1` | `0.2083` |
| `compacted4x_arm3_top3` | `0.9083` |
| `uncompacted_arm3_top1` | `0.8667` |
| `uncompacted_arm2_top1` | `0.6417` |
| `photoperiod_uncompacted_arm3_top1` | `0.8286` |
| `photoperiod_uncompacted_arm2_top1` | `0.0571` |
| `nocturnal_compacted4x_arm3_top1` | `1` |
| `nocturnal_compacted4x_arm2_top1` | `0.3333` |
| `travel_compacted4x_arm3_top1` | `0.7333` |
| `travel_compacted4x_arm2_top1` | `0.4667` |
| `arm3_index_mean_us` | `1217.99` |
| `arm3_query_scan_mean_us` | `68.55` |
| `uncompacted_360.Arm1-Semantic-LRU.overall.top1` | `0.2083` |
| `uncompacted_360.Arm1-Semantic-LRU.overall.top3` | `0.3667` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.high_lat_photoperiod_shift.top1` | `0` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.high_lat_photoperiod_shift.top3` | `0` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.post_compaction_nocturnal.top1` | `0` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.post_compaction_nocturnal.top3` | `0.1` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.travel_handoff_nyc_tokyo.top1` | `0.3` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.travel_handoff_nyc_tokyo.top3` | `0.6` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.stationary_recent_control.top1` | `0.64` |
| `uncompacted_360.Arm1-Semantic-LRU.by_slice.stationary_recent_control.top3` | `0.92` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.overall.top1` | `0.6417` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.overall.top3` | `0.7833` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.high_lat_photoperiod_shift.top1` | `0.0571` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.high_lat_photoperiod_shift.top3` | `0.3143` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.post_compaction_nocturnal.top1` | `0.8667` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.post_compaction_nocturnal.top3` | `1` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.travel_handoff_nyc_tokyo.top1` | `0.8` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.travel_handoff_nyc_tokyo.top3` | `0.9333` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.stationary_recent_control.top1` | `1` |
| `uncompacted_360.Arm2-Semantic-Fixed24h.by_slice.stationary_recent_control.top3` | `1` |
| `uncompacted_360.Arm2b-LocalCivil24h-Diagnostic.overall.top1` | `0.675` |
| `uncompacted_360.Arm2b-LocalCivil24h-Diagnostic.overall.top3` | `0.8` |
| _additional detail_ | `201 more metric entries in lab/experiments/EXP-002-phase-resonant-memory/results.json` |

### EXP-003: Spacetime Observation, Spoof-Detection, Chronolocation and Geolocation Benchmark Suite

- **Directory**: `lab/experiments/EXP-003-vlm-observation-bench/`
- **Chart**: `lab/experiments/EXP-003-vlm-observation-bench/chart.svg`
- **Status**: `promoted` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `observe`, `vlm`, `spoof-detection`, `chronolocation`, `geolocation`, `benchmark`, `mcp-eval`
- **Hypothesis**: Caelus physical ephemeris verification (sceneGeometry, verifyObservation, chronolocate, geolocate) detects spacetime spoofs across 7 adversarial attack classes with F1 >= 0.95 and FPR <= 0.05 under realistic VLM measurement noise (+/-3 deg shadow bearing, +/-6% shadow ratio, +/-8 deg Moon bright limb), recovers single-axis spoof causes via counterfactual diagnostics >= 90%, chronolocates noisy shadows within median <= 15 min, and geolocates via analytical Path A and spherical-grid Path B far beyond metadata-only heuristics.
- **Null Baseline**: Naive local-mean-time (LMT = UTC + lon/15) day/night metadata heuristic with no astronomical ephemeris, shadow azimuth/altitude geometry, lunar phase/limb physics, or shadow sweep handedness.
- **Success Bar**: Spoof detection F1 >= 0.95 with FPR <= 0.05 and zero false-impossible verdicts on 100 noisy authentic scenes; counterfactual diagnostic recovery >= 90%; noisy chronolocation median error <= 15 min; Path A noiseless median error < 1 km and Path B grid median error < 250 km; emits 30-task VLM MCP evaluation pack.
- **Kill Criterion**: Spoof detection F1 < 0.85, authentic FPR > 0.15, counterfactual recovery < 70%, or Path A noiseless error > 10 km.

**Latest Receipt**: `pass` (run at `2026-11-22T21:05:52.221Z`, git SHA `0ee232d`)

- **Summary**: 200-scenario spacetime benchmark across 20 global cities and 4 seasons: Caelus verifyObservation achieves F1=1 (P=1, R=1, FPR=0, auth_impossible=0) vs Naive-LMT-Clock baseline F1=0.2857 (R=0.17). Counterfactual axis recovery=60/60 (100%), top-1 attribution=60/60 (100%). Noisy chronolocation median=2.5 min (21.43 ms). Geolocation median error: Path A analytical=0 km clean / 121.1 km noisy (0.1 ms) vs Path B grid Sun+Moon=0.2 km clean / 160.4 km noisy (4.3 ms), bearing+Moon-limb=0.2 km clean / 294.8 km noisy (4.4 ms).
- **Verdict**: PASS: Caelus physical observation engine clears all spoof-detection, diagnostic, chronolocation, and Path A/B geolocation bars and decisively outperforms the Naive-LMT-Clock null baseline across all 7 attack classes.

| Metric | Value |
|---|---|
| `caelus_spoof_detection.precision` | `1` |
| `caelus_spoof_detection.recall` | `1` |
| `caelus_spoof_detection.f1` | `1` |
| `caelus_spoof_detection.false_positive_rate` | `0` |
| `caelus_spoof_detection.authentic_marginal` | `0` |
| `null_baseline_naive_lmt.precision` | `0.8947` |
| `null_baseline_naive_lmt.recall` | `0.17` |
| `null_baseline_naive_lmt.f1` | `0.2857` |
| `null_baseline_naive_lmt.false_positive_rate` | `0.02` |
| `counterfactual_diagnostics.axis_recovery_rate` | `1` |
| `counterfactual_diagnostics.top1_summary_attributed` | `60` |
| `counterfactual_diagnostics.top1_summary_attribution_rate` | `1` |
| `counterfactual_diagnostics.by_class.tz_shift_4h.top1_attributed` | `15` |
| `counterfactual_diagnostics.by_class.tz_shift_4h.median_offset_err_min` | `4.03` |
| `counterfactual_diagnostics.by_class.tz_shift_half_hour.top1_attributed` | `15` |
| `counterfactual_diagnostics.by_class.tz_shift_half_hour.median_offset_err_min` | `3.9` |
| `counterfactual_diagnostics.by_class.hemisphere_flip.top1_attributed` | `15` |
| `counterfactual_diagnostics.by_class.opposite_season.top1_attributed` | `15` |
| `counterfactual_diagnostics.by_class.opposite_season.median_offset_err_days` | `5` |
| `chronolocation.noisy_recall` | `1` |
| `chronolocation.noisy_median_err_min` | `2.499` |
| `chronolocation.clean_recall` | `1` |
| `chronolocation.clean_median_err_min` | `0.0002` |
| `chronolocation.mean_latency_ms` | `21.43` |
| `chronolocation.p95_latency_ms` | `28.23` |
| `chronolocation.sixty_day_mean_latency_ms` | `64.5` |
| `geolocation.path_a_analytical.clean_recall` | `1` |
| `geolocation.path_a_analytical.clean_median_err_km` | `0` |
| `geolocation.path_a_analytical.noisy_recall` | `1` |
| `geolocation.path_a_analytical.noisy_median_err_km` | `121.13` |
| `geolocation.path_a_analytical.mean_latency_ms` | `0.1` |
| `geolocation.path_a_analytical.p95_latency_ms` | `0.135` |
| `geolocation.path_b_double_altitude_sun_moon.noisy_recall` | `1` |
| `geolocation.path_b_double_altitude_sun_moon.clean_median_err_km` | `0.16` |
| `geolocation.path_b_double_altitude_sun_moon.noisy_median_err_km` | `160.4` |
| `geolocation.path_b_double_altitude_sun_moon.mean_latency_ms` | `4.31` |
| _additional detail_ | `82 more metric entries in lab/experiments/EXP-003-vlm-observation-bench/results.json` |

### EXP-004: Hybrid Dual-Clock Geo-RoPE Mathematical Prototype and Numerical Simulation

- **Directory**: `lab/experiments/EXP-004-geo-rope-prototype/`
- **Chart**: `lab/experiments/EXP-004-geo-rope-prototype/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.py`
- **Tags**: `geo-rope`, `chronosense`, `rotary-embeddings`, `attention`, `photoperiod`, `python`, `research`
- **Hypothesis**: Nesting a 32-D fast token/step RoPE clock inside a 32-D Caelus geocentric physical torus (GAST/ASC, solar altitude, planetary-hour photoperiod phase, Moon longitude, Sun-Moon elongation, solar seasonal longitude) preserves 100% intra-turn token ordering where Caelus-Pure-Geo collapses, preserves post-sleep/post-compaction elapsed ordering where Standard-RoPE collapses, beats fixed-period Unix-Linear-Fourier on high-latitude seasonal photoperiod recurrence (Oslo Dec vs Sept), and eliminates 7d/14d/21d/28d weekly aliasing across 30-day same-clock memory streams.
- **Null Baseline**: Standard-RoPE (token index only), Unix-Linear-Fourier (synthetic fixed-period 24h/7d/365.25d UTC sinusoids), and steelman Hybrid-Unix-Fourier (32-D fast token RoPE + 32-D fixed-period 24h/7d/365.25d UTC sinusoids).
- **Success Bar**: Hybrid-Dual-Geo-RoPE achieves AUC >= 0.99 on Probe A (confirming Caelus-Pure-Geo collapses near 0.50), AUC >= 0.99 on Probe B (confirming Standard-RoPE collapses near 0.50), beats Unix-Linear-Fourier and Hybrid-Unix-Fourier by >= +0.30 Top-1 accuracy on Probe C Oslo photoperiod recurrence, and achieves lower multi-week collision rate than Unix-Linear-Fourier on Probe D while honestly reporting all probes where Unix-Fourier ties.
- **Kill Criterion**: Hybrid-Dual-Geo-RoPE fails to beat Unix-Linear-Fourier / Hybrid-Unix-Fourier on Probe C photoperiod recurrence by at least +0.15 Top-1 accuracy, fails to beat Caelus-Pure-Geo on Probe A, or fails to beat Standard-RoPE on Probe B.

**Latest Receipt**: `pass` (run at `2026-11-22T21:05:59.563165Z`, git SHA `0ee232d`)

- **Summary**: 64-D Geo-RoPE simulation over 500 memories / 30 days (Oslo 59.91N + Singapore control): Probe A (2s intra-turn, Earth turns 0.008356 deg): Hybrid AUC=0.9999 vs Caelus-Pure collapse AUC=0.4939 (Hybrid-Unix ties at 0.9988). Probe B (post-sleep reset): Hybrid AUC=1.0 vs Standard-RoPE collapse AUC=0.0 (Unix-Fourier ties at 1.0). Probe C (Oslo Dec-vs-Sept photoperiod): Hybrid circadian Top-1=0.99 (iso 64-D=0.57) beats Unix-Linear-Fourier (0.0) and Hybrid-Unix-Fourier (0.0). Probe D (30d same-UTC non-aliasing): Hybrid collision(>0.90)=0.0 (Top-1=0.9067) vs Unix-Linear-Fourier collision=0.0529 (Top-1=0.7933, 7d alias cos=0.9638).
- **Verdict**: PASS: Hybrid-Dual-Geo-RoPE clears all 4 probes, resolves Caelus-Pure's 2-second collapse and Standard-RoPE's post-sleep collapse, and decisively outperforms both Unix-Linear-Fourier and steelman Hybrid-Unix-Fourier on high-latitude photoperiod recurrence (Probe C) and weekly non-aliasing (Probe D), while tying Hybrid-Unix-Fourier on Probes A and B.

| Metric | Value |
|---|---|
| `probe_a_intra_turn.encoders.Standard-RoPE.mean_50step_2s_separation_margin` | `0.5258` |
| `probe_a_intra_turn.encoders.Standard-RoPE.retrieval_top1_acc` | `1` |
| `probe_a_intra_turn.encoders.Standard-RoPE.retrieval_auc` | `1` |
| `probe_a_intra_turn.encoders.Unix-Linear-Fourier.mean_50step_2s_separation_margin` | `0` |
| `probe_a_intra_turn.encoders.Unix-Linear-Fourier.retrieval_top1_acc` | `0.495` |
| `probe_a_intra_turn.encoders.Unix-Linear-Fourier.retrieval_auc` | `0.4922` |
| `probe_a_intra_turn.encoders.Caelus-Pure-Geo.mean_50step_2s_separation_margin` | `0` |
| `probe_a_intra_turn.encoders.Caelus-Pure-Geo.retrieval_top1_acc` | `0.485` |
| `probe_a_intra_turn.encoders.Caelus-Pure-Geo.retrieval_auc` | `0.4939` |
| `probe_a_intra_turn.encoders.Hybrid-Dual-Geo-RoPE.mean_50step_2s_separation_margin` | `0.3132` |
| `probe_a_intra_turn.encoders.Hybrid-Dual-Geo-RoPE.retrieval_top1_acc` | `1` |
| `probe_a_intra_turn.encoders.Hybrid-Dual-Geo-RoPE.retrieval_auc` | `0.9999` |
| `probe_a_intra_turn.encoders.Hybrid-Unix-Fourier.mean_50step_2s_separation_margin` | `0.3176` |
| `probe_a_intra_turn.encoders.Hybrid-Unix-Fourier.retrieval_top1_acc` | `1` |
| `probe_a_intra_turn.encoders.Hybrid-Unix-Fourier.retrieval_auc` | `0.9988` |
| `probe_b_post_sleep.encoders.Standard-RoPE.mean_overnight_reset_sep_margin_64d` | `0` |
| `probe_b_post_sleep.encoders.Standard-RoPE.mean_10d_dormancy_reset_sep_margin_64d` | `0` |
| `probe_b_post_sleep.encoders.Standard-RoPE.fresh_vs_stale_top1_acc` | `0` |
| `probe_b_post_sleep.encoders.Standard-RoPE.fresh_vs_stale_auc` | `0` |
| `probe_b_post_sleep.encoders.Unix-Linear-Fourier.mean_overnight_reset_sep_margin_64d` | `0.7653` |
| `probe_b_post_sleep.encoders.Unix-Linear-Fourier.mean_10d_dormancy_reset_sep_margin_64d` | `0.7507` |
| `probe_b_post_sleep.encoders.Unix-Linear-Fourier.fresh_vs_stale_top1_acc` | `1` |
| `probe_b_post_sleep.encoders.Unix-Linear-Fourier.fresh_vs_stale_auc` | `1` |
| `probe_b_post_sleep.encoders.Caelus-Pure-Geo.mean_overnight_reset_sep_margin_64d` | `0.5973` |
| `probe_b_post_sleep.encoders.Caelus-Pure-Geo.mean_10d_dormancy_reset_sep_margin_64d` | `1.1183` |
| `probe_b_post_sleep.encoders.Caelus-Pure-Geo.fresh_vs_stale_top1_acc` | `1` |
| `probe_b_post_sleep.encoders.Caelus-Pure-Geo.fresh_vs_stale_auc` | `1` |
| `probe_b_post_sleep.encoders.Hybrid-Dual-Geo-RoPE.mean_overnight_reset_sep_margin_64d` | `0.2962` |
| `probe_b_post_sleep.encoders.Hybrid-Dual-Geo-RoPE.mean_10d_dormancy_reset_sep_margin_64d` | `0.5625` |
| `probe_b_post_sleep.encoders.Hybrid-Dual-Geo-RoPE.fresh_vs_stale_top1_acc` | `1` |
| `probe_b_post_sleep.encoders.Hybrid-Dual-Geo-RoPE.fresh_vs_stale_auc` | `1` |
| `probe_b_post_sleep.encoders.Hybrid-Unix-Fourier.mean_overnight_reset_sep_margin_64d` | `0.3375` |
| `probe_b_post_sleep.encoders.Hybrid-Unix-Fourier.mean_10d_dormancy_reset_sep_margin_64d` | `0.3818` |
| `probe_b_post_sleep.encoders.Hybrid-Unix-Fourier.fresh_vs_stale_top1_acc` | `1` |
| `probe_b_post_sleep.encoders.Hybrid-Unix-Fourier.fresh_vs_stale_auc` | `1` |
| `probe_c_photoperiod_oslo.encoders.Standard-RoPE.isotropic_64d_top1_acc` | `0.09` |
| _additional detail_ | `227 more metric entries in lab/experiments/EXP-004-geo-rope-prototype/results.json` |

### EXP-005: Chronosense Physical vs. Symbolic Codec Eval Harness (Offline Audit and Live-LLM Runner)

- **Directory**: `lab/experiments/EXP-005-chronosense-codec-eval/`
- **Chart**: `lab/experiments/EXP-005-chronosense-codec-eval/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `codec`, `llm-eval`, `physical-vs-symbolic`, `ablation`, `fact-002-gate`
- **Hypothesis**: Encoding agent spacetime context with Caelus physical-horizon tokens (Treatment-Caelus-Physical, backed by sceneGeometry and canonicalChart/chartDigest) yields higher exact task-state recoverability and lower live-LLM temporal confusion, stale-tool errors, and missed deadlines across EXP-001/eval_suite.jsonl than Baseline-None, Control-ISO, Control-Synthetic, and traditional zodiac shorthand (Arm4b-Caelus-Symbolic) at <= 55 tokens/turn.
- **Null Baseline**: Baseline-None (no clock), Control-ISO (passive UTC ISO-8601), Control-Synthetic (elapsed seconds + fixed 24h sin/cos wave), and Arm4b-Caelus-Symbolic (traditional zodiac sign/degree and planetary hour tokens).
- **Success Bar**: Offline codec audit confirms Treatment-Caelus-Physical encodes 100% of ground-truth observables cleanly at <= 55 cl100k tokens vs <70% for ISO/Synthetic and lossy twilight decoding for Symbolic, AND live-LLM inference (--live) across all 20 tasks x 5 arms reduces composite temporal error by >= 20 percentage points vs Control-ISO while beating Control-Synthetic and Arm4b-Caelus-Symbolic on high-latitude photoperiod and compaction slices.
- **Kill Criterion**: If live-LLM inference shows Control-Synthetic ties Treatment-Caelus-Physical within 5 percentage points across high-latitude photoperiod and cross-compaction slices, or if Arm4b-Caelus-Symbolic matches or beats Treatment-Caelus-Physical at lower token cost without semantic drift, cancel FACT-002 physical envelope middleware.

**Latest Receipt**: `pass` (run at `2026-11-22T21:06:00.231Z`, git SHA `0ee232d`)

- **Summary**: Live-LLM 5-arm codec showdown verified over 20 EXP-001 tasks x 2 live models (ollama/gemma4:12b, ollama/qwen3.5:9b) plus offline codec + 20-line NOAA baseline audit (GT parity=20/20). Live macro score: Physical=77.7% [95% CI 71.0-83.5%] vs Symbolic=63.5% vs Synthetic=45.2% vs ISO=40.8% vs None=30.6% (paired Physical-Symbolic +14.2 pp [95% CI +5.6, +22.5 pp], p=0.0004, 19W/17T/4L; offline NOAA-20line=66.7% overall, 100.0% photoperiod tie vs 33.3% compaction; 45.75 cl100k tok/turn).
- **Verdict**: PROVED (live verified across 2 models, ollama/gemma4:12b, ollama/qwen3.5:9b): Macro score Treatment-Caelus-Physical 77.7% beats Control-ISO 40.8% by +36.9 pp (>= 20 pp bar), beats Control-Synthetic 45.2% by +32.5 pp (compaction +50.0 pp, high-lat photoperiod +12.5 pp), and beats Arm4b-Caelus-Symbolic 63.5% by +14.2 pp (compaction +23.3 pp, high-lat photoperiod +3.1 pp; slices_monotone=true) and Baseline-None 30.6% at 45.75 cl100k tokens/turn. Per model: gemma4:12b: Phys 75.4% vs Sym 63.7% vs Synth 46.7% vs ISO 38.8% vs None 28.7%; qwen3.5:9b: Phys 80.0% vs Sym 63.3% vs Synth 43.8% vs ISO 42.9% vs None 32.5%.

| Metric | Value |
|---|---|
| `live_physical_accuracy` | `0.7771` |
| `live_symbolic_accuracy` | `0.6354` |
| `live_synthetic_accuracy` | `0.4521` |
| `live_iso_accuracy` | `0.4083` |
| `live_none_accuracy` | `0.3063` |
| `live_margin_physical_vs_iso` | `0.3688` |
| `live_margin_physical_vs_synthetic` | `0.325` |
| `live_margin_physical_vs_symbolic` | `0.1417` |
| `physical_all20_twilight_5class_accuracy` | `1` |
| `symbolic_all20_twilight_5class_accuracy` | `0.85` |
| `symbolic_pm1_sign_slip_fresh_tool_accuracy` | `0.5` |
| `offline_codec_by_arm.Baseline-None.twilight_5class_accuracy` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.night_crossed` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.fresh_tool_id` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.digest_match` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.is_day` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.twilight_stage` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.deadline_phase` | `0` |
| `offline_codec_by_arm.Baseline-None.field_accuracy.deadline_minutes_within_15m` | `0` |
| `offline_codec_by_arm.Control-ISO.twilight_5class_accuracy` | `0.7` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.night_crossed` | `0` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.fresh_tool_id` | `0` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.digest_match` | `0` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.is_day` | `0.7` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.twilight_stage` | `0.7` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.deadline_phase` | `0` |
| `offline_codec_by_arm.Control-ISO.field_accuracy.deadline_minutes_within_15m` | `0` |
| `offline_codec_by_arm.Control-Synthetic.twilight_5class_accuracy` | `0.9` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.night_crossed` | `0.5` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.fresh_tool_id` | `0` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.digest_match` | `0` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.is_day` | `0.9` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.twilight_stage` | `0.9` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.deadline_phase` | `1` |
| `offline_codec_by_arm.Control-Synthetic.field_accuracy.deadline_minutes_within_15m` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.twilight_5class_accuracy` | `1` |
| _additional detail_ | `316 more metric entries in lab/experiments/EXP-005-chronosense-codec-eval/results.json` |

### EXP-006: Live Observation Tool-Use Eval (CoT-Only vs. Caelus MCP Tools)

- **Directory**: `lab/experiments/EXP-006-live-vlm-observation-eval/`
- **Chart**: `lab/experiments/EXP-006-live-vlm-observation-eval/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `observe`, `vlm`, `mcp-tools`, `live-eval`, `spoof-detection`, `chronolocation`, `geolocation`
- **Hypothesis**: Equipping a live LLM/VLM with local in-process Caelus observation tools (verify_observation, chronolocate, geolocate, scene_geometry backed by packages/caelus/dist/) on the 30-task EXP-003/vlm_eval_pack.jsonl raises spacetime spoof-detection F1 from near-chance (~0.55-0.65) to >= 0.88, raises counterfactual single-axis diagnostic recovery, chronolocation (<= 20 min), and geolocation (<= 350 km) accuracy decisively over chain-of-thought alone, and executes local tools in milliseconds (< 2 ms forward authentic verification, < 10 ms median across all tools including counterfactual forensics and global grids).
- **Null Baseline**: Arm1-CoT-NoTools: the exact same live model(s) evaluating identical scene descriptions, claimed spacetime context, and visual shadow/twilight/lunar measurements via chain-of-thought reasoning only with zero external tools.
- **Success Bar**: Arm2-Caelus-MCP-Tools achieves spoof-detection F1 >= 0.88 (beating Arm1-CoT-NoTools by >= 0.20 F1), achieves >= 80% pass rate on chronolocation (<= 20 min) and geolocation (<= 350 km) where Arm1-CoT-NoTools stays below 35%, improves overall 30-task pass rate by >= 40 percentage points, and executes local tools at < 10 ms median latency (< 2 ms warm forward authentic verify_observation).
- **Kill Criterion**: If Arm2-Caelus-MCP-Tools achieves spoof-detection F1 < 0.80, fails to beat Arm1-CoT-NoTools by >= 0.15 F1 or >= 25 percentage points overall task pass rate, or if tool-calling schema failures degrade accuracy below baseline on > 25% of tasks.

**Latest Receipt**: `pass` (run at `2026-11-22T21:06:00.881Z`, git SHA `0ee232d`)

- **Summary**: Live 30-task observation tool-use eval across 2 models (ollama/gemma4:12b, ollama/qwen3.5:9b). CoT-NoTools -> Caelus-MCP-Tools macro: spoof F1 0.7247 -> 0.9445, counterfactual axis 66.7% -> 100.0%, chronolocate 12.5% -> 87.5%, geolocate 12.5% -> 100.0%, overall 33.3% -> 93.3% (all tools median 14.5246 ms; warm authentic verify 1.3063 ms).
- **Verdict**: PROVED (live verified across 2 models, ollama/gemma4:12b, ollama/qwen3.5:9b): Arm2-Caelus-MCP-Tools raises macro spoof-detection F1 from 0.7247 to 0.9445 (+0.2198), cuts authentic FPR from 100% to 0%, raises counterfactual axis recovery from 66.7% to 100.0%, chronolocation pass rate (<=20m) from 12.5% to 87.5%, geolocation pass rate (<=350km) from 12.5% to 100.0%, and overall 30-task pass rate from 33.3% to 93.3% (+60.0 pp) with isolated local tool median 3.5019 ms (< 10 ms bar), warm authentic verify_observation 1.3063 ms (< 2 ms bar), and 14.5246 ms median under concurrent local GPU load. Per model: gemma4:12b: CoT F1=0.6667 (33.3% overall) -> MCP F1=1 (96.7% overall); qwen3.5:9b: CoT F1=0.7826 (33.3% overall) -> MCP F1=0.8889 (90.0% overall).

| Metric | Value |
|---|---|
| `cot_spoof_f1` | `0.7247` |
| `mcp_spoof_f1` | `0.9445` |
| `mcp_spoof_f1_ci95_bootstrap_pooled` | `[0.8571, 1]` |
| `spoof_f1_margin` | `0.2198` |
| `cot_authentic_false_positive_rate` | `1` |
| `mcp_authentic_false_positive_rate` | `0` |
| `cot_counterfactual_recovery_rate` | `0.6667` |
| `mcp_counterfactual_recovery_rate` | `1` |
| `cot_chronolocate_accuracy` | `0.125` |
| `mcp_chronolocate_accuracy` | `0.875` |
| `cot_geolocate_accuracy` | `0.125` |
| `mcp_geolocate_accuracy` | `1` |
| `cot_overall_accuracy` | `0.3333` |
| `mcp_overall_accuracy` | `0.9334` |
| `verify_tool_median_latency_ms` | `14.3311` |
| `spoof_f1_formula.formula` | `F1 = 2 * TP / (2 * TP + FP + FN) = 2 * Precision * Recall / (Precision + Recall), where Precision = TP / (TP + FP) and Recall = TP / (TP + FN)` |
| `spoof_f1_formula.positive_class` | `is_spoof === true (10 spoof scenes + 4 authentic scenes = 14 verify_observation scenes per model)` |
| `spoof_f1_formula.macro_f1_definition` | `Unweighted mean of per-model Spoof F1 across the 2 live models; pooled micro F1 also reported for 28 paired verify episodes` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.cot.tp` | `7` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.cot.fp` | `4` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.cot.tn` | `0` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.cot.fn` | `3` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.cot.f1` | `0.6667` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.cot.f1_ci95_bootstrap` | `[0.3529, 0.88]` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.mcp.tp` | `10` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.mcp.fp` | `0` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.mcp.tn` | `4` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.mcp.fn` | `0` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.mcp.f1` | `1` |
| `spoof_f1_formula.counts_by_model.gemma4:12b.mcp.f1_ci95_bootstrap` | `[1, 1]` |
| `spoof_f1_formula.counts_by_model.qwen3.5:9b.cot.tp` | `9` |
| `spoof_f1_formula.counts_by_model.qwen3.5:9b.cot.fp` | `4` |
| `spoof_f1_formula.counts_by_model.qwen3.5:9b.cot.tn` | `0` |
| `spoof_f1_formula.counts_by_model.qwen3.5:9b.cot.fn` | `1` |
| `spoof_f1_formula.counts_by_model.qwen3.5:9b.cot.f1` | `0.7826` |
| `spoof_f1_formula.counts_by_model.qwen3.5:9b.cot.f1_ci95_bootstrap` | `[0.6, 0.9231]` |
| _additional detail_ | `206 more metric entries in lab/experiments/EXP-006-live-vlm-observation-eval/results.json` |

### EXP-007: Trained Tiny-Transformer Hybrid Dual-Clock Geo-RoPE and Google SLEEP Continual Learning Study

- **Directory**: `lab/experiments/EXP-007-geo-rope-sleep-transformer/`
- **Chart**: `lab/experiments/EXP-007-geo-rope-sleep-transformer/chart.svg`
- **Status**: `active` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.py`
- **Tags**: `geo-rope`, `transformer`, `pytorch`, `sleep`, `continual-learning`, `lora`, `photoperiod`, `chronosense`, `research`
- **Hypothesis**: Training parameter-matched (~1.43M-param) causal transformers with Hybrid-Dual-Geo-RoPE (32-D fast token RoPE + 32-D Caelus geocentric physical torus from python/astroengine/) preserves intra-turn state tracking and post-sleep reset continuity while decisively beating Standard-RoPE and steelman Hybrid-Unix-Fourier-RoPE on OOD high-latitude solstice photoperiod generalization (Oslo 5.9h winter / 18.8h summer + NYC-to-Tokyo travel) and multi-week annual-wrap non-aliasing; and pairing Hybrid-Dual-Geo-RoPE with frozen-core LoRA SLEEP consolidation gated by Caelus local-horizon night and unsupervised phase-stratified dreaming replay beats Naive-Online-FT and SLEEP-Fixed24h-LRU on 5-cycle continual retention, catastrophic forgetting delta, and nocturnal sleep-gate safety.
- **Null Baseline**: Part A (3 seeds, 1,427,136 params each): Standard-RoPE (64-D token-step RoPE), Hybrid-Unix-Fourier-RoPE (32-D step + 32-D fixed UTC 24h/7d/365.25d), location-aware Hybrid-Unix-Fourier+LatLon (eliminating location gap with LMT=UTC+lon/15 and lat/lon), and minimal 20-line Hybrid-NOAA20-RoPE (solar-only formula, zero Moon/ephemeris). Part B (3 seeds, matched rank-16 LoRA 193,536 params, B=250): Naive-Online-FT, SLEEP-Fixed24h-LRU, Diag-SLEEP-GeoRoPE-LRU, SLEEP-Reservoir-Random (Vitter's Algorithm R uniform reservoir), and SLEEP-NOAA20-Stratified.
- **Success Bar**: Part A: 0-parameter difference across all 3 models; Hybrid-Dual-Geo-RoPE stays within 5 pp of Standard-RoPE on Task 1 (confirming no intra-turn collapse), achieves >= 95% on Task 2 (tying Hybrid-Unix-Fourier-RoPE and beating Standard-RoPE by >= 50 pp), beats Hybrid-Unix-Fourier-RoPE by >= 25 pp on OOD Task 3 (Oslo winter/summer solstices + NYC-to-Tokyo travel), and beats Hybrid-Unix-Fourier-RoPE on Task 4 multi-week non-aliasing while honestly reporting 30d trained-weight ties. Part B: SLEEP-Caelus-Circadian-Stratified achieves >= 80% mean retention across Cycles 1..5 (+>= 25 pp over SLEEP-Fixed24h-LRU), cuts catastrophic forgetting delta by >= 20 pp vs SLEEP-Fixed24h-LRU and >= 45 pp vs Naive-Online-FT, and achieves 100% local-horizon nocturnal sleep-gate safety (while honestly reporting recency-only C4+C5 plasticity trade-offs).
- **Kill Criterion**: If Hybrid-Dual-Geo-RoPE fails to beat Hybrid-Unix-Fourier-RoPE by >= 15 pp on OOD Task 3, drops more than 10 pp below Standard-RoPE on Task 1 intra-turn tracking, OR if SLEEP-Caelus-Circadian-Stratified fails to beat SLEEP-Fixed24h-LRU by >= 10 pp on final Cycle 1..5 mean retention accuracy.

**Latest Receipt**: `inconclusive` (run at `2026-11-22T21:06:01.192814Z`, git SHA `0ee232d`)

- **Summary**: 5 parameter-matched 1,427,136-param causal transformers trained across 3 seeds (20261122, 20261123, 20261124) on MPS (0 train/OOD overlap). Part A T3-OOD (Solstices+Tokyo): Hybrid-Dual-Geo-RoPE 86.5%+/-0.6 vs Hybrid-NOAA20-RoPE 82.9%+/-1.4 vs location-aware Hybrid-Unix-Fourier+LatLon 53.7%+/-2.3 (Oslo Solstices +47.2 pp vs LatLon) vs Hybrid-Unix-Fourier 37.0%+/-6.7 (+49.5 pp). T4b 52w annual-wrap: Geo 98.4% vs NOAA20 80.0% (+18.4 pp lunar non-aliasing) vs Unix 81.2%. Part B (6 arms, B=250): SLEEP-Caelus 65.5%+/-13.1 (forgetting 11.1 pp) vs SLEEP-NOAA20 86.3%+/-7.9, SLEEP-Reservoir-Random 68.4%+/-25.0, SLEEP-Fixed24h-LRU 41.3%+/-2.3, and Naive-Online-FT 20.0%.
- **Verdict**: PARTIAL: 10/12 Caelus Razor bars cleared across 3 independent seeds. Eliminating the location gap with Hybrid-Unix-Fourier+LatLon rescues Tokyo travel (89.0%) yet still collapses on Oslo Winter/Summer solstices (36.0% vs Geo 83.2%, +47.2 pp). Minimal 20-line Hybrid-NOAA20-RoPE nearly matches Geo-RoPE on solar photoperiod T3-OOD (82.9% vs 86.5%) while aliasing on 52-week annual wrap (80.0% vs Geo 98.4%, +18.4 pp from Caelus's lunar torus). In Part B, SLEEP-Caelus (65.5%, forgetting 11.1 pp, 100% gate safety) decisively beats LRU (41.3%) and Naive-FT (20.0%), while SLEEP-Reservoir-Random (68.4%) and SLEEP-NOAA20-Stratified (86.3%) are reported honestly alongside it.

| Metric | Value |
|---|---|
| `geo_rope_t1_intra_turn_accuracy` | `0.825` |
| `unix_fourier_t1_intra_turn_accuracy` | `0.841` |
| `std_rope_t1_intra_turn_accuracy` | `0.8129` |
| `geo_rope_t2_post_sleep_accuracy` | `1` |
| `unix_fourier_t2_post_sleep_accuracy` | `0.9983` |
| `std_rope_t2_post_sleep_accuracy` | `0.3339` |
| `geo_rope_t3_id_control_accuracy` | `0.8867` |
| `geo_rope_t3_ood_composite_accuracy` | `0.8648` |
| `noaa20_rope_t3_ood_composite_accuracy` | `0.829` |
| `unix_latlon_t3_ood_composite_accuracy` | `0.5368` |
| `unix_latlon_t3_ood_oslo_solstices_accuracy` | `0.3604` |
| `geo_rope_t3_ood_oslo_solstices_accuracy` | `0.832` |
| `unix_fourier_t3_ood_composite_accuracy` | `0.3701` |
| `std_rope_t3_ood_composite_accuracy` | `0.254` |
| `geo_rope_t4_multiweek_ood_accuracy` | `0.9948` |
| `noaa20_rope_t4_multiweek_ood_accuracy` | `0.9333` |
| `unix_latlon_t4_multiweek_ood_accuracy` | `0.9437` |
| `unix_fourier_t4_multiweek_ood_accuracy` | `0.9374` |
| `geo_rope_t4_52w_wrap_accuracy` | `0.9844` |
| `noaa20_rope_t4_52w_wrap_accuracy` | `0.8` |
| `unix_latlon_t4_52w_wrap_accuracy` | `0.8311` |
| `unix_fourier_t4_52w_wrap_accuracy` | `0.8122` |
| `sleep_caelus_final_retention_accuracy` | `0.6555` |
| `sleep_noaa20_final_retention_accuracy` | `0.8634` |
| `sleep_reservoir_final_retention_accuracy` | `0.6839` |
| `sleep_fixed24h_lru_final_retention_accuracy` | `0.4133` |
| `naive_online_ft_final_retention_accuracy` | `0.2` |
| `diag_sleep_georope_lru_final_retention_accuracy` | `0.3728` |
| `part_a_by_encoder.Standard-RoPE.mean.task4_30d_logit_margin` | `-0.2917` |
| `part_a_by_encoder.Standard-RoPE.std.task4_30d_logit_margin` | `0.0048` |
| `part_a_by_encoder.Hybrid-Unix-Fourier-RoPE.mean.task4_30d_logit_margin` | `7.8013` |
| `part_a_by_encoder.Hybrid-Unix-Fourier-RoPE.std.task4_30d_logit_margin` | `0.7623` |
| `part_a_by_encoder.Hybrid-Unix-Fourier+LatLon.mean.task4_30d_logit_margin` | `7.2713` |
| `part_a_by_encoder.Hybrid-Unix-Fourier+LatLon.std.task4_30d_logit_margin` | `0.1426` |
| `part_a_by_encoder.Hybrid-NOAA20-RoPE.mean.task4_30d_logit_margin` | `7.5857` |
| `part_a_by_encoder.Hybrid-NOAA20-RoPE.std.task4_30d_logit_margin` | `0.1236` |
| _additional detail_ | `353 more metric entries in lab/experiments/EXP-007-geo-rope-sleep-transformer/results.json` |

### EXP-009: Geocentric Follow-the-Sun Wavefront Orchestration (4-Season Global Swarm Ablation)

- **Directory**: `lab/experiments/EXP-009-follow-the-sun-wavefront/`
- **Chart**: `lab/experiments/EXP-009-follow-the-sun-wavefront/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `follow-the-sun`, `wavefront`, `swarm`, `photoperiod`, `ablation`
- **Hypothesis**: Zero-RPC offline solar-horizon quadrant routing via Caelus sceneGeometry (initiate/execute/review_ship/handoff_buffer/subterranean_gc) across an 8-city global human-tethered swarm outperforms static UTC round-robin and zero-RPC longitude-derived fixed-24h local solar clocks on physical daylight alignment, nocturnal compaction safety, and solstice photoperiod adaptation at < 1.5 ms per node tick.
- **Null Baseline**: Control-UTC-RoundRobin (static 6-hour UTC rotation) and Control-Lon-Fixed24h (zero-RPC LMT = UTC + lon/15 fixed 24h quadrants: 06-10 initiate, 10-14 execute, 14-18 review_ship, 18-06 subterranean_gc, ignoring latitude, solar declination, Equation of Time, and polar day/night).
- **Success Bar**: Treatment-Caelus-Wavefront achieves >= 99.5% physical daylight alignment for active interactive phases (vs < 85% for Control-Lon-Fixed24h across solstice mid/high latitudes and < 60% for Control-UTC-RoundRobin), >= 99.5% nocturnal compaction safety (zero daytime GC interruptions vs > 10% error for Control-Lon-Fixed24h on solstices), 100% 24h global swarm coverage across all 4 seasons, and < 1.5 ms mean compute per node tick, while honestly reporting equinox and equatorial slices where Control-Lon-Fixed24h ties within 3 pp.
- **Kill Criterion**: If Treatment-Caelus-Wavefront fails to beat Control-Lon-Fixed24h by >= 10 percentage points on solstice mid/high-latitude daylight alignment or nocturnal compaction safety, or fails to maintain continuous 24h global swarm coverage across seasons.

**Latest Receipt**: `pass` (run at `2026-11-22T21:06:07.831Z`, git SHA `0ee232d`)

- **Summary**: 4-season global swarm trace (8 cities x 768 ticks = 6144 node evals). Treatment-Caelus-Wavefront achieves 100.00% overall daylight alignment and 100.00% nocturnal GC safety at 1021.4213 us/node-tick with 100% 24h global daylight coverage, beating Control-Lon-Fixed24h (94.8% daylight, 93.3% GC safety; solstice high/polar 79.9% daylight and 84.0% GC safety) and Control-UTC-RoundRobin (49.0% daylight), while equatorial Singapore nearly ties (100.0% vs 100.0%).
- **Verdict**: PROVED: Treatment-Caelus-Wavefront clears all daylight alignment (100.0%), nocturnal GC safety (100.0%), 24h global coverage (100.0%), and latency (1021.4213 us/node-tick) bars, beating Control-Lon-Fixed24h by +20.1 pp daylight and +16.0 pp GC safety on solstice high/polar latitudes while tying within 0.0 pp at equatorial Singapore.

| Metric | Value |
|---|---|
| `caelus_overall_daylight_accuracy` | `1` |
| `lon_fixed24h_overall_daylight_accuracy` | `0.9476` |
| `utc_rr_overall_daylight_accuracy` | `0.4898` |
| `caelus_solstice_high_polar_daylight_accuracy` | `1` |
| `lon_fixed24h_solstice_high_polar_daylight_accuracy` | `0.7986` |
| `caelus_equatorial_daylight_accuracy` | `1` |
| `lon_fixed24h_equatorial_daylight_accuracy` | `1` |
| `caelus_mean_us_per_node_tick` | `1021.4213` |
| `caelus_overall_gc_safety` | `1` |
| `lon_fixed24h_overall_gc_safety` | `0.9329` |
| `utc_rr_overall_gc_safety` | `0.3242` |
| `caelus_solstice_high_polar_gc_safety` | `1` |
| `lon_fixed24h_solstice_high_polar_gc_safety` | `0.8403` |
| `caelus_solstice_nonpolar_gc_safety` | `1` |
| `lon_fixed24h_solstice_nonpolar_gc_safety` | `0.8438` |
| `caelus_global_daylight_coverage` | `1` |
| `total_runtime_ms` | `6479.5614` |
| `overall_by_arm.Control-UTC-RoundRobin.interactive_total` | `4608` |
| `overall_by_arm.Control-UTC-RoundRobin.daylight_alignment_civil` | `0.4898` |
| `overall_by_arm.Control-UTC-RoundRobin.daylight_alignment_strict` | `0.4377` |
| `overall_by_arm.Control-UTC-RoundRobin.gc_total` | `1536` |
| `overall_by_arm.Control-UTC-RoundRobin.nocturnal_gc_safety_strict` | `0.3242` |
| `overall_by_arm.Control-UTC-RoundRobin.nocturnal_gc_safety_civil` | `0.2624` |
| `overall_by_arm.Control-UTC-RoundRobin.handoff_buffer_count` | `0` |
| `overall_by_arm.Control-Lon-Fixed24h.interactive_total` | `3072` |
| `overall_by_arm.Control-Lon-Fixed24h.daylight_alignment_civil` | `0.9476` |
| `overall_by_arm.Control-Lon-Fixed24h.daylight_alignment_strict` | `0.9118` |
| `overall_by_arm.Control-Lon-Fixed24h.gc_total` | `3072` |
| `overall_by_arm.Control-Lon-Fixed24h.nocturnal_gc_safety_strict` | `0.9329` |
| `overall_by_arm.Control-Lon-Fixed24h.nocturnal_gc_safety_civil` | `0.8597` |
| `overall_by_arm.Control-Lon-Fixed24h.handoff_buffer_count` | `0` |
| `overall_by_arm.Treatment-Caelus-Wavefront.interactive_total` | `3007` |
| `overall_by_arm.Treatment-Caelus-Wavefront.daylight_alignment_civil` | `1` |
| `overall_by_arm.Treatment-Caelus-Wavefront.daylight_alignment_strict` | `1` |
| `overall_by_arm.Treatment-Caelus-Wavefront.gc_total` | `2802` |
| `overall_by_arm.Treatment-Caelus-Wavefront.nocturnal_gc_safety_strict` | `1` |
| _additional detail_ | `290 more metric entries in lab/experiments/EXP-009-follow-the-sun-wavefront/results.json` |

### EXP-010: Adaptive Cognitive Step-Size Control: chartStability vs. Direct sceneGeometry Horizon Jumps vs. Fixed Polling

- **Directory**: `lab/experiments/EXP-010-adaptive-step-stability/`
- **Chart**: `lab/experiments/EXP-010-adaptive-step-stability/chart.svg`
- **Status**: `killed` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `stability`, `adaptive-step`, `phantom-cliffs`, `ablation`
- **Hypothesis**: Using chartStability filtered to physical sect flips provides accurate, low-overhead adaptive step-size control around circadian regime cliffs (sunrise, sunset, civil dawn, civil dusk) that beats both fixed-interval polling and direct analytic sceneGeometry.diurnal.minutesToNext jump scheduling.
- **Null Baseline**: Arm1-Fixed-Poll-30m (constant 30-min polling), Arm2-Stability-AllFlips (unfiltered chartStability reacting to angle/sign/house/aspect flips), and Arm4-Analytic-RiseSet-Jump (direct next-boundary sleep via sceneGeometry.diurnal.minutesToNext without finite-difference chart sweeps).
- **Success Bar**: Arm3-Stability-Physical-SectOnly detects >= 95% of all 4 physical twilight/horizon cliffs within +/-5 min, reduces wakeups by >= 40% vs Arm1-Fixed-Poll-30m with 0 phantom sign-ingress alarms, AND stays within 2x of Arm4-Analytic-RiseSet-Jump total CPU cost.
- **Kill Criterion**: If Arm4-Analytic-RiseSet-Jump (sceneGeometry.diurnal.minutesToNext) strictly dominates Arm3-Stability-Physical-SectOnly with >= 5x lower CPU cost AND higher physical cliff coverage (catching civil dawn/dusk that binary sect misses) at equal or fewer wakeups, kill chartStability as an adaptive step-size controller and archive to lab/graveyard/KILL-005-chart-stability-step-control.md.

**Latest Receipt**: `fail` (run at `2026-11-22T21:06:22.093Z`, git SHA `0ee232d`)

- **Summary**: 20 24h episodes (5 latitudes x 4 seasons, 74 physical sunrise/sunset/civil-twilight cliffs, 1 polar 0-cliff episodes). Unfiltered chartStability (Arm2) triggers 23.8 phantom zodiac/house alarms per 24h (476 total). Filtered sect-only chartStability (Arm3) eliminates phantom alarms and catches 80.6% sunrise/sunset cliffs, but misses civil twilight (2.6% civil catch -> 40.5% all-cliff) at 238.1572 ms/24h (26.35 wakeups). Direct analytic sceneGeometry.diurnal.minutesToNextTwilight (Arm4) catches 100.0% of all 4 physical cliffs (median err 0 min) in 11.9 wakeups (-75.2% vs 30m poll) and 11.1821 ms/24h (21.2981x faster than Arm3).
- **Verdict**: KILLED (chartStability step-size control): Arm4-Analytic-RiseSet-Jump (sceneGeometry.diurnal.minutesToNextTwilight) strictly dominates Arm3-Stability-Physical-SectOnly by 21.2981x lower CPU (11.1821 vs 238.1572 ms/24h), higher physical cliff coverage (100.0% vs 40.5%, catching civil dawn/dusk), and fewer wakeups (11.9 vs 26.35/24h). Archive chartStability scheduler to lab/graveyard/KILL-005-chart-stability-step-control.md; use direct sceneGeometry next-event scheduling instead.

| Metric | Value |
|---|---|
| `by_arm.Arm1-Fixed-Poll-30m.median_cliff_timing_err_min` | `7.3406` |
| `by_arm.Arm2-Stability-AllFlips.median_cliff_timing_err_min` | `7.0551` |
| `by_arm.Arm3-Stability-Physical-SectOnly.median_cliff_timing_err_min` | `7.3999` |
| `by_arm.Arm4-Analytic-RiseSet-Jump.median_cliff_timing_err_min` | `0` |
| `arm3_all_cliff_catch_rate` | `0.4054` |
| `arm4_all_cliff_catch_rate` | `1` |
| `arm1_all_cliff_catch_rate` | `0.4189` |
| `arm3_civil_twilight_catch_rate` | `0.0263` |
| `arm4_civil_twilight_catch_rate` | `1` |
| `arm2_phantom_alarms_per_24h` | `23.8` |
| `arm3_over_arm4_cpu_ratio` | `21.2981` |
| `arm3_mean_wakeups_per_24h` | `26.35` |
| `arm4_mean_wakeups_per_24h` | `11.9` |
| `arm1_mean_wakeups_per_24h` | `48` |
| `arm4_wakeup_savings_vs_poll` | `0.7521` |
| `arm3_mean_cpu_ms_per_24h` | `238.1572` |
| `arm4_mean_cpu_ms_per_24h` | `11.1821` |
| `total_runtime_ms` | `14140.6978` |
| `by_arm.Arm1-Fixed-Poll-30m.mean_wakeups_per_24h` | `48` |
| `by_arm.Arm1-Fixed-Poll-30m.total_wakeups_20ep` | `960` |
| `by_arm.Arm1-Fixed-Poll-30m.horizon_cliff_catch_rate` | `0.4722` |
| `by_arm.Arm1-Fixed-Poll-30m.civil_twilight_catch_rate` | `0.3684` |
| `by_arm.Arm1-Fixed-Poll-30m.all_physical_cliff_catch_rate` | `0.4189` |
| `by_arm.Arm1-Fixed-Poll-30m.phantom_sign_house_alarms_total` | `0` |
| `by_arm.Arm1-Fixed-Poll-30m.phantom_alarms_per_24h` | `0` |
| `by_arm.Arm1-Fixed-Poll-30m.total_cpu_ms_20ep` | `963.3291` |
| `by_arm.Arm1-Fixed-Poll-30m.mean_cpu_ms_per_24h` | `48.1665` |
| `by_arm.Arm1-Fixed-Poll-30m.mean_ms_per_wakeup` | `1.0035` |
| `by_arm.Arm2-Stability-AllFlips.mean_wakeups_per_24h` | `38.6` |
| `by_arm.Arm2-Stability-AllFlips.total_wakeups_20ep` | `772` |
| `by_arm.Arm2-Stability-AllFlips.horizon_cliff_catch_rate` | `0.8056` |
| `by_arm.Arm2-Stability-AllFlips.civil_twilight_catch_rate` | `0.0789` |
| `by_arm.Arm2-Stability-AllFlips.all_physical_cliff_catch_rate` | `0.4324` |
| `by_arm.Arm2-Stability-AllFlips.phantom_sign_house_alarms_total` | `476` |
| `by_arm.Arm2-Stability-AllFlips.phantom_alarms_per_24h` | `23.8` |
| `by_arm.Arm2-Stability-AllFlips.total_cpu_ms_20ep` | `7678.3294` |
| _additional detail_ | `22 more metric entries in lab/experiments/EXP-010-adaptive-step-stability/results.json` |

### EXP-011: Synthetic Orbital Task-Space (synthetic.ts + when()) vs. Direct riseSet Modulo Interval Intersection

- **Directory**: `lab/experiments/EXP-011-synthetic-orbit-collisions/`
- **Chart**: `lab/experiments/EXP-011-synthetic-orbit-collisions/chart.svg`
- **Status**: `killed` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `synthetic`, `when-query`, `deadlines`, `ablation`
- **Hypothesis**: Registering internal agent task rhythms (6h CI cadence, 24h daily standup, 14d sprint release) as virtual periodic bodies via registerSyntheticSystem inside the real Earth-sky Engine and solving collisions against local human night via when() matches or outperforms direct riseSet + modulo interval arithmetic on collision F1, boundary accuracy, and compute latency.
- **Null Baseline**: Arm3-Direct-RiseSet-Modulo (daily riseSet('sun') sunset-to-sunrise intervals intersected analytically with closed-form modular task windows) plus Arm2-WorldFrame-Synthetic-When (syntheticEphemeris world-frame longitudes without Earth parallax inside when()).
- **Success Bar**: Arm1-Synthetic-Engine-When achieves collision F1 >= 0.99 and median boundary error <= 1.0 min across all 3 task periods (0.25d, 1.0d, 14.0d) and 5 latitudes, within <= 3x the runtime latency of Arm3-Direct-RiseSet-Modulo.
- **Kill Criterion**: If Arm1-Synthetic-Engine-When suffers F1 < 0.90 or median boundary error > 15 min due to heliocentric Kepler a = periodDays^(2/3) Earth-parallax distortion, OR if even parallax-free Arm2-WorldFrame-Synthetic-When offers zero accuracy gain over Arm3-Direct-RiseSet-Modulo while running >= 5x slower, kill synthetic orbital task-space injection for agent deadline scheduling and archive to lab/graveyard/KILL-006-synthetic-orbit-task-space.md.

**Latest Receipt**: `fail` (run at `2026-11-22T21:06:31.731Z`, git SHA `0ee232d`)

- **Summary**: 30-scenario (5 cities x 2 seasons x 3 task rhythms over 28d) deadline-vs-night collision benchmark. Arm1-Synthetic-Engine-When (registerSyntheticSystem + when()) fails catastrophically: event F1=0.0255 (overlap time F1=0.046), because synthetic.ts places periodic bodies heliocentrically at Kepler a=P^(2/3) AU (0.25d CI cadence sits at 0.397 AU inside Earth's orbit, max elongation 23.0354 deg, never completing a geocentric cycle; 1.0d standup hits a 1.0 AU co-orbital singularity; 14d sprint suffers +/-10.5208 deg = 589.1654 min annual parallax error). Even parallax-free Arm2-WorldFrame-Synthetic-When (event F1=0.9987, 2587.1402 ms) runs 3.0742x slower than Arm3-Direct-RiseSet-Modulo (F1=1, 841.5682 ms) with zero accuracy gain.
- **Verdict**: KILLED (synthetic.ts orbital task-space for agent scheduling): Arm1-Synthetic-Engine-When hits F1=0.0255 (overlap F1=0.046) due to Kepler a=P^(2/3) Earth-parallax distortion, and parallax-free Arm2-WorldFrame-Synthetic-When offers zero accuracy gain over Arm3-Direct-RiseSet-Modulo while running 3.0742x slower (2587.1402 ms vs 841.5682 ms). Archive to lab/graveyard/KILL-006-synthetic-orbit-task-space.md; use direct riseSet('sun') + modular interval arithmetic instead.

| Metric | Value |
|---|---|
| `arm1_synthetic_engine_event_f1` | `0.0255` |
| `arm1_synthetic_engine_overlap_time_f1` | `0.046` |
| `arm2_worldframe_when_event_f1` | `0.9987` |
| `arm2_worldframe_when_overlap_time_f1` | `0.9992` |
| `arm3_direct_riseset_event_f1` | `1` |
| `by_arm.Arm1-Synthetic-Engine-When.event_precision` | `0.0774` |
| `by_arm.Arm1-Synthetic-Engine-When.event_recall` | `0.0152` |
| `by_arm.Arm1-Synthetic-Engine-When.event_f1` | `0.0255` |
| `by_arm.Arm1-Synthetic-Engine-When.overlap_time_f1` | `0.046` |
| `by_arm.Arm1-Synthetic-Engine-When.median_boundary_err_min` | `236.5489` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.ci_cadence.event_precision` | `1` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.ci_cadence.event_recall` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.ci_cadence.event_f1` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.ci_cadence.overlap_time_f1` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.ci_cadence.median_boundary_err_min` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.daily_standup.event_precision` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.daily_standup.event_recall` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.daily_standup.event_f1` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.daily_standup.overlap_time_f1` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.daily_standup.median_boundary_err_min` | `0` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.sprint_release.event_precision` | `0.7059` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.sprint_release.event_recall` | `0.5455` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.sprint_release.event_f1` | `0.6154` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.sprint_release.overlap_time_f1` | `0.2532` |
| `by_arm.Arm1-Synthetic-Engine-When.by_task.sprint_release.median_boundary_err_min` | `236.5489` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.event_precision` | `1` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.event_recall` | `0.9975` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.event_f1` | `0.9987` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.overlap_time_f1` | `0.9992` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.median_boundary_err_min` | `0.0002` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.by_task.ci_cadence.event_precision` | `1` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.by_task.ci_cadence.event_recall` | `1` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.by_task.ci_cadence.event_f1` | `1` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.by_task.ci_cadence.overlap_time_f1` | `1` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.by_task.ci_cadence.median_boundary_err_min` | `0.0002` |
| `by_arm.Arm2-WorldFrame-Synthetic-When.by_task.daily_standup.event_precision` | `1` |
| _additional detail_ | `103 more metric entries in lab/experiments/EXP-011-synthetic-orbit-collisions/results.json` |

### EXP-012: Pretrained Frozen LLM Transfer Test for Physical Slow-Clock Adapters

- **Directory**: `lab/experiments/EXP-012-pretrained-georope-adapter/`
- **Chart**: `lab/experiments/EXP-012-pretrained-georope-adapter/chart.svg`
- **Status**: `killed` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.py`
- **Tags**: `geo-rope`, `pretrained-llm`, `transfer-learning`, `lora`, `adapter`, `chronosense`, `photoperiod`, `pytorch`, `mps`, `research`
- **Hypothesis**: Injecting Caelus's python/astroengine/ physical slow clock (32-D geocentric and photoperiod torus) into a frozen pretrained 494M-param RoPE LLM (Qwen/Qwen2.5-0.5B-Instruct) via a lightweight trainable soft-token MLP adapter plus rank-8 attention LoRA (Arm3-LoRA-Caelus-GeoAdapter, 2 soft tokens/event) transfers zero-shot OOD seasonal and geographic generalization (Oslo 5.90h winter / 18.83h summer solstices, NYC-to-Tokyo travel, and post-sleep compaction) through frozen weights, beating parameter-matched UTC Fourier adapters (Arm2-LoRA-UnixFourier-Adapter) by >= +15 pp on OOD Oslo Solstice + Tokyo travel while beating zero-training FACT-002 text-prompt injection (Arm1-Frozen-Caelus-TextPrompt) and matching or beating LoRA-tuned text envelopes (Arm1b-LoRA-TextPrompt) with >= 50% fewer temporal prompt tokens.
- **Null Baseline**: Progressive controls on the exact same frozen Qwen/Qwen2.5-0.5B-Instruct base weights: (1) Arm0-Frozen-ISO-Prompt (0 trained params, passive UTC ISO text), (2) Arm1-Frozen-Caelus-TextPrompt (0 trained params, compact FACT-002 physical-horizon text envelope; text-only steelman) plus Arm1b-LoRA-TextPrompt (rank-8 LoRA on the FACT-002 text envelope to isolate LoRA capacity), (3) Arm2-LoRA-UnixFourier-Adapter (exact 0-parameter-difference rank-8 LoRA + MLP soft-token adapter fed fixed 24h/7d/365.25d UTC Fourier features), and (4) Arm2b-LoRA-UnixFourier+LatLon-Adapter (exact 0-parameter-difference adapter fed local mean solar time UTC+lon/15, 7d, 365.25d, and observer (lat, lon) harmonics to eliminate any location information gap).
- **Success Bar**: 0-parameter difference across Arm2, Arm2b, and Arm3, 0 train/ID/OOD date overlap verified by SHA-256 across all tasks, real MPS gradient-descent convergence across all trained arms, 95% Wilson CIs reported on all splits, AND Arm3-LoRA-Caelus-GeoAdapter clears ALL Razor bars: (a) beats Arm2-LoRA-UnixFourier-Adapter by >= +15.0 pp on OOD Oslo Solstice + Tokyo travel composite accuracy and beats location-aware Arm2b-LoRA-UnixFourier+LatLon-Adapter on OOD Oslo Solstice photoperiod slices, AND (b) beats Arm1-Frozen-Caelus-TextPrompt on OOD composite accuracy AND matches (within 3.0 pp) or beats Arm1b-LoRA-TextPrompt on OOD composite accuracy while cutting temporal prompt-token overhead by >= 50%.
- **Kill Criterion**: If frozen pretrained weights reject continuous physical-adapter injection (Arm3 fails to beat Arm2 by >= +15.0 pp on OOD Oslo Solstice + Tokyo travel, OR fails to beat location-aware Arm2b on OOD Oslo Winter/Summer solstices), OR if plain-text FACT-002 envelopes strictly dominate weight adapters on frozen LLMs (Arm3 trails Arm1-Frozen-Caelus-TextPrompt on OOD composite accuracy, OR trails Arm1b-LoRA-TextPrompt by > 3.0 pp on OOD composite accuracy despite training 1.55M adapter+LoRA parameters).

**Latest Receipt**: `fail` (run at `2026-11-22T21:06:32.238168Z`, git SHA `0ee232d`)

- **Summary**: 6-arm transfer test on frozen Qwen/Qwen2.5-0.5B-Instruct (494,032,768 frozen params, Apple MPS, 0 train/eval overlap, 1,720 held-out prompts). Continuous physical injection transfers strongly through frozen weights: Arm3-LoRA-Caelus-GeoAdapter reaches 90.1% OOD Solstice+Travel (95% CI 88.0-91.8%), beating parameter-matched Arm2-LoRA-UnixFourier by +65.3 pp (24.8%), beating location-aware Arm2b-LoRA-UnixFourier+LatLon by +49.8 pp on Oslo Solstices (88.0% vs 38.1%), and beating zero-shot Arm1-Frozen-Caelus-TextPrompt by +47.7 pp (42.4%) while cutting clock tokens by 95.3% and running 2.55x faster. HOWEVER, plain-text Arm1b-LoRA-TextPrompt (471K fewer params) strictly dominates accuracy across every split: 96.9% OOD Solstice+Travel (+6.8 pp over Arm3), 100.0% OOD Compaction (+18.9 pp), and 97.3% OOD All (+8.5 pp), triggering the pre-registered -3.0 pp kill bar.
- **Verdict**: KILLED: Passed 7/9 Razor checks; failed pre-registered text-steelman accuracy parity bars (Arm3 trails Arm1b-LoRA-TextPrompt by -6.8 pp on OOD Solstice+Travel and -8.5 pp on OOD All, exceeding the -3.0 pp kill threshold). Although continuous physical slow-clock adapters clearly transfer through frozen 494M weights (+65.3 pp vs Arm2 UTC-Fourier; +49.8 pp vs location-aware Arm2b on Oslo Solstices; 2.55x faster MPS inference with 95.3% fewer clock tokens), FACT-002 plain-text physical envelopes strictly win on accuracy and simplicity for frozen pretrained LLMs. Ship FACT-002 text envelopes, not continuous weight adapters, for frozen LLMs.

| Metric | Value |
|---|---|
| `frozen_base_params` | `494032768` |
| `arm1b_trainable_params` | `1081344` |
| `arm2_arm2b_arm3_trainable_params` | `1552641` |
| `arm0_ood_solstice_travel_acc` | `0.2104` |
| `arm1_ood_solstice_travel_acc` | `0.4239` |
| `arm1b_ood_solstice_travel_acc` | `0.9688` |
| `arm2_ood_solstice_travel_acc` | `0.2479` |
| `arm2b_ood_solstice_travel_acc` | `0.5177` |
| `arm3_ood_solstice_travel_acc` | `0.901` |
| `arm3_minus_arm2_ood_solstice_travel` | `0.6531` |
| `arm3_minus_arm2b_ood_oslo_solstices` | `0.4984` |
| `arm3_minus_arm1_ood_solstice_travel` | `0.4771` |
| `arm3_minus_arm1b_ood_solstice_travel` | `-0.0678` |
| `arm1b_ood_all_acc` | `0.9732` |
| `arm3_ood_all_acc` | `0.8882` |
| `arm3_minus_arm1b_ood_all` | `-0.085` |
| `arm1b_ood_compaction_acc` | `1` |
| `arm3_ood_compaction_acc` | `0.8111` |
| `arm1b_ood_all_ce` | `0.1527` |
| `arm3_ood_all_ce` | `0.5751` |
| `arm2b_ood_all_ce` | `3.0796` |
| `arm2_ood_all_ce` | `4.5672` |
| `per_event_clock_token_reduction_pct` | `95.35` |
| `arm3_vs_arm1b_inference_speedup` | `2.55` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.id_composite_choice_acc` | `0.2611` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.id_composite_choice_ci95` | `[0.2247, 0.2958]` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.id_composite_choice_ce` | `1.8011` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.id_composite_full_acc` | `0.2611` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_solstice_travel_choice_acc` | `0.2104` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_solstice_travel_choice_ci95` | `[0.1858, 0.2373]` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_solstice_travel_choice_ce` | `2.0354` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_solstice_travel_full_acc` | `0.2104` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_solstice_travel_full_ce` | `2.0903` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_oslo_solstices_choice_acc` | `0.2109` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_oslo_solstices_choice_ci95` | `[0.1811, 0.2442]` |
| `summary_by_arm.Arm0-Frozen-ISO-Prompt.ood_tokyo_travel_choice_acc` | `0.2094` |
| _additional detail_ | `469 more metric entries in lab/experiments/EXP-012-pretrained-georope-adapter/results.json` |

## 3. Feature Factory Queue

| ID | Title | Status | Stage | Dependencies | Spec |
|---|---|---|---|---|---|
| `FACT-001` | Instrument I-05: Field Verifier and Chronolocator | `shipped` | `stage-4-verified` | feat/observe-and-release-rollup preflight green; EXP-003 scenario presets | `lab/factory/FACT-001-observe-instrument/SPEC.md`, `lab/factory/FACT-001-observe-instrument/tufte-notes.md` |
| `FACT-002` | Chronosense Read-Write Middleware and Citation Auditor | `shipped` | `stage-4-verified` | EXP-001 deterministic harness pass; EXP-005 live-LLM ablation beating Control-Synthetic | `lab/factory/FACT-002-chronosense-middleware/SPEC.md` |
| `FACT-003` | Roadmap Milestones 5 and 6 Closure: when() Heliacal Predicate and minted_bodies MCP Tool | `queued` | `stage-0-spec` | ROADMAP.md Milestone 4 CPK1 packs (done); ROADMAP.md Milestone 5 heliacal core (done); ROADMAP.md Milestone 6 mint script and loaders (done) | `lab/factory/FACT-003-roadmap-m5-m6-closure/SPEC.md` |
| `FACT-004` | Portable Conformance Kit and Clean-Room Rust Engine Port | `queued` | `stage-0-spec` | ROADMAP.md Milestone 4 CPK1 pack format frozen; ROADMAP.md Milestone 7 planning alignment | `lab/factory/FACT-004-conformance-rust/SPEC.md` |
| `FACT-005` | Portable Versioned JSON Envelopes Across Engine, MCP, Instruments, and Lab | `queued` | `stage-0-spec` | Mined prior art: feature/caelus-free commit 99a4085 (docs/product/proposal.md); packages/caelus/src/canonical.ts chartDigest | `lab/factory/FACT-005-portable-envelopes/SPEC.md` |
| `FACT-006` | Paired View (Wheel + 3D Dome/Sphere), Reader-Chart Binding, and OKLCH Theme Completeness | `queued` | `stage-0-spec` | Mined prior art: feature/caelus-free commits ae35c25, 378a3c6, 88163ce, ae015d9, caelus-free-audit.md; Mined prior art: archive/feature/house-corpus reader-chart.ts, ds-01-disposition.md; FACT-001 Instrument I-05 baseline | `lab/factory/FACT-006-paired-dome-and-plates/SPEC.md` |
| `FACT-007` | Structured Knowledge Graph (caelus-kb) for Neuro-Symbolic MCP Discovery | `queued` | `stage-0-gated` | Mined prior art: archive/feature/house-corpus packages/kb (604 nodes, 578 edges, drift.test.ts); R&D ablation experiment beating flat MCP tool list | `lab/factory/FACT-007-kb-neurosymbolic-mcp/SPEC.md` |

## 4. Graveyard Archive (Killed Ideas)

| ID | Date | Title | Verdict | Postmortem |
|---|---|---|---|---|
| `KILL-001` | `2026-11-22` | Secret-Asteroid Spacetime TOTP | KILLED (strictly dominated by `HMAC-SHA256`) | `lab/graveyard/KILL-001-asteroid-totp.md` |
| `KILL-002` | `2026-11-22` | Synastry Swarm Role Routing and Tie-Breaking | KILLED (broken by cohort correlation and element/modality skew; strictly dominated by `sha256`) | `lab/graveyard/KILL-002-synastry-swarm-routing.md` |
| `KILL-003` | `2026-11-22` | Retrograde Duty Cycles and Zodiacal Releasing Maintenance | KILLED (wrong timescales and wrong trigger signal) | `lab/graveyard/KILL-003-retrograde-zr-maintenance.md` |
| `KILL-004` | `2026-11-22` | Void-of-Course Execution Freezes and Parans Latitude Sharding | KILLED (operationally harmful lockouts and wrong sharding axis) | `lab/graveyard/KILL-004-voc-freezes-and-parans-sharding.md` |
| `KILL-005` | `2026-11-22` | Adaptive Cognitive Step-Size via `chartStability` | KILLED (strictly dominated by direct `sceneGeometry.diurnal.minutesToNextTwilight` by `20.9x` CPU, `+59.5 pp` cliff coverage, and `-54.8%` wakeups) | `lab/graveyard/KILL-005-chart-stability-step-control.md` |
| `KILL-006` | `2026-11-22` | Synthetic Orbital Task-Space (`synthetic.ts` + `when()`) for Agent Deadline Scheduling | KILLED (catastrophic Earth-parallax failure `F1 = 0.0255` via `registerSyntheticSystem`, and parallax-free `when()` is `3.11x` slower than direct `riseSet` + modulo arithmetic with zero accuracy gain) | `lab/graveyard/KILL-006-synthetic-orbit-task-space.md` |
| `KILL-007` | `2026-11-22` | Continuous Slow-Clock Soft-Token Adapters on Frozen Pretrained LLMs | KILLED (`Arm3-LoRA-Caelus-GeoAdapter` reached `90.1%` OOD Solstice+Travel and beat location-aware `Arm2b` by `+49.8 pp` on Oslo Solstices, yet plain-text `Arm1b-LoRA-TextPrompt` strictly dominated at `96.9%` OOD Solstice+Travel and `97.3%` OOD All with `471,297` fewer trainable parameters, breaching the pre-registered `-3.0 pp` kill threshold) | `lab/graveyard/KILL-007-pretrained-georope-adapter.md` |

## 5. Lab Commands

```bash
node lab/scripts/lab.mjs status          # Live summary tables and hygiene check
node lab/scripts/lab.mjs run all         # Execute all experiments and verify results.json
node lab/scripts/lab.mjs ledger          # Regenerate this file deterministically
node lab/scripts/lab.mjs check           # Validate schemas and zero em-dashes
node lab/scripts/lab.mjs new exp <slug>  # Scaffold a new Razor-compliant experiment
node lab/scripts/lab.mjs new fact <slug> # Scaffold a new Feature Factory track
```
