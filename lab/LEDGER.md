# Caelus R&D Lab and Feature Factory Ledger

Generated deterministically by `node lab/scripts/lab.mjs ledger` from `lab/experiments/*/manifest.json`, `results.json`, `lab/factory/*/manifest.json`, and `lab/graveyard/KILL-*.md`. Do not hand-edit metrics in this file.

- **Branch**: `swarm-lab-chronosense-9379049f`
- **Git HEAD**: `52a58e3`
- **Research Experiments**: 8 (8 with verified receipts)
- **Feature Factory Tracks**: 7
- **Graveyard Kills**: 6

## 1. Research Experiments Overview

| ID | Title | Status | Receipt | Key Metrics | Path |
|---|---|---|---|---|---|
| `EXP-001` | Chronosense 4-Arm Ablation: Physical-Horizon Envelope, Read-Write Cursor, and Drift Audit | `proved` | `pass` (2026-11-22) | caelus_night_crossed_accuracy=1, iso_utc_night_crossed_accuracy=0.6764, caelus_daylight_accuracy=1, synth_24h_daylight_accuracy=0.8117 | `lab/experiments/EXP-001-chronosense-ablation/` |
| `EXP-002` | Dyadic Circadian and Phase-Resonant Episodic Memory Benchmark (3-Arm Ablation) | `proved` | `pass` (2026-11-22) | compacted4x_arm3_top1=0.8, compacted4x_arm2_top1=0.4083, compacted4x_arm1_top1=0.2083, compacted4x_arm3_top3=0.9083 | `lab/experiments/EXP-002-phase-resonant-memory/` |
| `EXP-003` | Spacetime Observation, Spoof-Detection, Chronolocation and Geolocation Benchmark Suite | `promoted` | `pass` (2026-11-22) | caelus_spoof_detection.precision=1, null_baseline_naive_lmt.precision=0.8947, counterfactual_diagnostics.axis_recovery_rate=1, chronolocation.noisy_recall=1 | `lab/experiments/EXP-003-vlm-observation-bench/` |
| `EXP-004` | Hybrid Dual-Clock Geo-RoPE Mathematical Prototype and Numerical Simulation | `proved` | `pass` (2026-11-22) | Standard-RoPE.mean_50step_2s_separation_margin=0.5258, Standard-RoPE.mean_overnight_reset_sep_margin_64d=0, Standard-RoPE.isotropic_64d_top1_acc=0.09, Standard-RoPE.isotropic_64d_top1_acc=0.14 | `lab/experiments/EXP-004-geo-rope-prototype/` |
| `EXP-005` | Chronosense Physical vs. Symbolic Codec Eval Harness (Offline Audit and Live-LLM Runner) | `active` | `inconclusive` (2026-11-22) | physical_all20_twilight_5class_accuracy=1, symbolic_all20_twilight_5class_accuracy=0.85, symbolic_pm1_sign_slip_fresh_tool_accuracy=0.5, Baseline-None.twilight_5class_accuracy=0 | `lab/experiments/EXP-005-chronosense-codec-eval/` |
| `EXP-009` | Geocentric Follow-the-Sun Wavefront Orchestration (4-Season Global Swarm Ablation) | `proved` | `pass` (2026-11-22) | caelus_overall_daylight_accuracy=1, lon_fixed24h_overall_daylight_accuracy=0.9476, utc_rr_overall_daylight_accuracy=0.4898, caelus_solstice_high_polar_daylight_accuracy=1 | `lab/experiments/EXP-009-follow-the-sun-wavefront/` |
| `EXP-010` | Adaptive Cognitive Step-Size Control: chartStability vs. Direct sceneGeometry Horizon Jumps vs. Fixed Polling | `killed` | `fail` (2026-11-22) | Arm1-Fixed-Poll-30m.median_cliff_timing_err_min=7.3406, Arm2-Stability-AllFlips.median_cliff_timing_err_min=7.0551, Arm3-Stability-Physical-SectOnly.median_cliff_timing_err_min=7.3999, Arm4-Analytic-RiseSet-Jump.median_cliff_timing_err_min=0 | `lab/experiments/EXP-010-adaptive-step-stability/` |
| `EXP-011` | Synthetic Orbital Task-Space (synthetic.ts + when()) vs. Direct riseSet Modulo Interval Intersection | `killed` | `fail` (2026-11-22) | arm1_synthetic_engine_event_f1=0.0255, arm1_synthetic_engine_overlap_time_f1=0.046, arm2_worldframe_when_event_f1=0.9987, arm2_worldframe_when_overlap_time_f1=0.9992 | `lab/experiments/EXP-011-synthetic-orbit-collisions/` |

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

**Latest Receipt**: `pass` (run at `2026-11-22T16:56:40.623Z`, git SHA `a16db97`)

- **Summary**: 100 72h episodes (1,200 turns) across 5 latitudes x 2 seasons. Treatment-Caelus-Physical achieves 100.0% local night_crossed accuracy (vs 67.6% UTC Control-ISO), 100.0% physical daylight classification (vs 81.2% fixed-24h Control-Synthetic), 0.000 min sunset deadline error (vs 88.7 min MAE / 206.8 min max for longitude-adjusted fixed-24h clock plus 10 polar no-sunset episodes), and 100.0% pre-tool cursor drift detection at 0.0% FPR in 1318 us/turn (~45.5 cl100k tokens).
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
| `caelus_mean_us` | `1317.85` |
| `compute_latency_us.Baseline-None.mean` | `0.079` |
| `compute_latency_us.Baseline-None.median` | `0.042` |
| `compute_latency_us.Baseline-None.p95` | `0.166` |
| `compute_latency_us.Baseline-None.p99` | `0.333` |
| `compute_latency_us.Baseline-None.max` | `7.125` |
| `compute_latency_us.Control-ISO.mean` | `0.473` |
| `compute_latency_us.Control-ISO.median` | `0.375` |
| `compute_latency_us.Control-ISO.p95` | `1` |
| `compute_latency_us.Control-ISO.p99` | `2.042` |
| `compute_latency_us.Control-ISO.max` | `32.125` |
| `compute_latency_us.Control-Synthetic.mean` | `1.566` |
| `compute_latency_us.Control-Synthetic.median` | `1.333` |
| `compute_latency_us.Control-Synthetic.p95` | `3.042` |
| `compute_latency_us.Control-Synthetic.p99` | `5.291` |
| `compute_latency_us.Control-Synthetic.max` | `25.583` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.mean` | `862.649` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.median` | `823.667` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.p95` | `1307.417` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.p99` | `2026.042` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.max` | `2560.5` |
| `compute_latency_us.Treatment-Caelus-Physical.mean` | `1317.846` |
| `compute_latency_us.Treatment-Caelus-Physical.median` | `1261.125` |
| `compute_latency_us.Treatment-Caelus-Physical.p95` | `1833.792` |
| `compute_latency_us.Treatment-Caelus-Physical.p99` | `2478` |
| `compute_latency_us.Treatment-Caelus-Physical.max` | `3071.25` |
| `compute_latency_us.Treatment-Caelus-AuditHook.mean` | `1301.743` |
| `compute_latency_us.Treatment-Caelus-AuditHook.median` | `1245.167` |
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

**Latest Receipt**: `pass` (run at `2026-11-22T16:56:42.030Z`, git SHA `a16db97`)

- **Summary**: 90-day Oslo/NYC/Tokyo trace (360 memories, 120 recall queries; Oslo daylight drops 12.26h -> 5.90h). Uncompacted Top-1: Arm1=20.8%, Arm2=64.2%, Arm3=86.7% (photoperiod 82.9% vs 5.7%). Under 4x compaction (90/360) Top-1: Arm1=20.8%, Arm2=40.8%, Arm3=80.0% (photoperiod 62.9% vs 0.0%, nocturnal 100.0% vs 33.3%, travel 73.3% vs 46.7%). Index=923 us, Query=955 us (55 us scan-only).
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
| `arm3_index_mean_us` | `923.18` |
| `arm3_query_scan_mean_us` | `54.52` |
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

**Latest Receipt**: `pass` (run at `2026-11-22T16:56:47.569Z`, git SHA `a16db97`)

- **Summary**: 200-scenario spacetime benchmark across 20 global cities and 4 seasons: Caelus verifyObservation achieves F1=1 (P=1, R=1, FPR=0, auth_impossible=0) vs Naive-LMT-Clock baseline F1=0.2857 (R=0.17). Counterfactual axis recovery=60/60 (100%), top-1 attribution=60/60 (100%). Noisy chronolocation median=2.5 min (18.79 ms). Geolocation median error: Path A analytical=0 km clean / 121.1 km noisy (0.09 ms) vs Path B grid Sun+Moon=0.2 km clean / 160.4 km noisy (3.3 ms), bearing+Moon-limb=0.2 km clean / 294.8 km noisy (2.8 ms).
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
| `chronolocation.mean_latency_ms` | `18.79` |
| `chronolocation.p95_latency_ms` | `25.31` |
| `chronolocation.sixty_day_mean_latency_ms` | `50.54` |
| `geolocation.path_a_analytical.clean_recall` | `1` |
| `geolocation.path_a_analytical.clean_median_err_km` | `0` |
| `geolocation.path_a_analytical.noisy_recall` | `1` |
| `geolocation.path_a_analytical.noisy_median_err_km` | `121.13` |
| `geolocation.path_a_analytical.mean_latency_ms` | `0.086` |
| `geolocation.path_a_analytical.p95_latency_ms` | `0.166` |
| `geolocation.path_b_double_altitude_sun_moon.noisy_recall` | `1` |
| `geolocation.path_b_double_altitude_sun_moon.clean_median_err_km` | `0.16` |
| `geolocation.path_b_double_altitude_sun_moon.noisy_median_err_km` | `160.4` |
| `geolocation.path_b_double_altitude_sun_moon.mean_latency_ms` | `3.3` |
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

**Latest Receipt**: `pass` (run at `2026-11-22T16:56:53.508265Z`, git SHA `a16db97`)

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
- **Status**: `active` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `codec`, `llm-eval`, `physical-vs-symbolic`, `ablation`, `fact-002-gate`
- **Hypothesis**: Encoding agent spacetime context with Caelus physical-horizon tokens (Treatment-Caelus-Physical, backed by sceneGeometry and canonicalChart/chartDigest) yields higher exact task-state recoverability and lower live-LLM temporal confusion, stale-tool errors, and missed deadlines across EXP-001/eval_suite.jsonl than Baseline-None, Control-ISO, Control-Synthetic, and traditional zodiac shorthand (Arm4b-Caelus-Symbolic) at <= 55 tokens/turn.
- **Null Baseline**: Baseline-None (no clock), Control-ISO (passive UTC ISO-8601), Control-Synthetic (elapsed seconds + fixed 24h sin/cos wave), and Arm4b-Caelus-Symbolic (traditional zodiac sign/degree and planetary hour tokens).
- **Success Bar**: Offline codec audit confirms Treatment-Caelus-Physical encodes 100% of ground-truth observables cleanly at <= 55 cl100k tokens vs <70% for ISO/Synthetic and lossy twilight decoding for Symbolic, AND live-LLM inference (--live) across all 20 tasks x 5 arms reduces composite temporal error by >= 20 percentage points vs Control-ISO while beating Control-Synthetic and Arm4b-Caelus-Symbolic on high-latitude photoperiod and compaction slices.
- **Kill Criterion**: If live-LLM inference shows Control-Synthetic ties Treatment-Caelus-Physical within 5 percentage points across high-latitude photoperiod and cross-compaction slices, or if Arm4b-Caelus-Symbolic matches or beats Treatment-Caelus-Physical at lower token cost without semantic drift, cancel FACT-002 physical envelope middleware.

**Latest Receipt**: `inconclusive` (run at `2026-11-22T16:56:53.975Z`, git SHA `a16db97`)

- **Summary**: Offline codec audit + scorer verification over 20 EXP-001 eval_suite tasks x 5 arms (GT parity=20/20, max sunAlt diff=0 deg). Bounded-decoder score: Physical=100.0% (45.75 tok, 100% 5-class twilight), Symbolic=98.8% (36.75 tok, 85% 5-class twilight, 2 conversion hops, 50% on +/-1 sign slip), Synthetic=55.8%, ISO=17.5%, None=0.0%. Live-LLM inference (PENDING --live) remains the FACT-002 gate.
- **Verdict**: INCONCLUSIVE (offline dry-run complete; live-LLM gate pending): Ground-truth parity (20/20), scorer self-tests (20/20 oracle, 20/20 corrupt caught), and bounded codec audit pass cleanly. Treatment-Caelus-Physical recovers 100.0% of task observables (100% 5-class twilight across all 20 tasks, 45.75 tokens, 0 conversion hops) vs Arm4b-Caelus-Symbolic 98.8% (85% 5-class twilight across all 20 tasks because 3 civil/nautical/astronomical twilight tasks collapse to binary Night, 36.75 tokens, 2 zodiac-to-degree hops, drops to 50% fresh-tool acc under symmetric +/-1 sign slip), Control-Synthetic 55.8%, Control-ISO 17.5%, and Baseline-None 0.0%. Run with --live and an API key to clear the FACT-002 live-LLM gate.

| Metric | Value |
|---|---|
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
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.night_crossed` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.fresh_tool_id` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.digest_match` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.is_day` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.twilight_stage` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.deadline_phase` | `1` |
| `offline_codec_by_arm.Treatment-Caelus-Physical.field_accuracy.deadline_minutes_within_15m` | `1` |
| `offline_codec_by_arm.Arm4b-Caelus-Symbolic.twilight_5class_accuracy` | `0.9` |
| _additional detail_ | `56 more metric entries in lab/experiments/EXP-005-chronosense-codec-eval/results.json` |

### EXP-009: Geocentric Follow-the-Sun Wavefront Orchestration (4-Season Global Swarm Ablation)

- **Directory**: `lab/experiments/EXP-009-follow-the-sun-wavefront/`
- **Chart**: `lab/experiments/EXP-009-follow-the-sun-wavefront/chart.svg`
- **Status**: `proved` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `follow-the-sun`, `wavefront`, `swarm`, `photoperiod`, `ablation`
- **Hypothesis**: Zero-RPC offline solar-horizon quadrant routing via Caelus sceneGeometry (initiate/execute/review_ship/handoff_buffer/subterranean_gc) across an 8-city global human-tethered swarm outperforms static UTC round-robin and zero-RPC longitude-derived fixed-24h local solar clocks on physical daylight alignment, nocturnal compaction safety, and solstice photoperiod adaptation at < 1.5 ms per node tick.
- **Null Baseline**: Control-UTC-RoundRobin (static 6-hour UTC rotation) and Control-Lon-Fixed24h (zero-RPC LMT = UTC + lon/15 fixed 24h quadrants: 06-10 initiate, 10-14 execute, 14-18 review_ship, 18-06 subterranean_gc, ignoring latitude, solar declination, Equation of Time, and polar day/night).
- **Success Bar**: Treatment-Caelus-Wavefront achieves >= 99.5% physical daylight alignment for active interactive phases (vs < 85% for Control-Lon-Fixed24h across solstice mid/high latitudes and < 60% for Control-UTC-RoundRobin), >= 99.5% nocturnal compaction safety (zero daytime GC interruptions vs > 10% error for Control-Lon-Fixed24h on solstices), 100% 24h global swarm coverage across all 4 seasons, and < 1.5 ms mean compute per node tick, while honestly reporting equinox and equatorial slices where Control-Lon-Fixed24h ties within 3 pp.
- **Kill Criterion**: If Treatment-Caelus-Wavefront fails to beat Control-Lon-Fixed24h by >= 10 percentage points on solstice mid/high-latitude daylight alignment or nocturnal compaction safety, or fails to maintain continuous 24h global swarm coverage across seasons.

**Latest Receipt**: `pass` (run at `2026-11-22T16:59:59.363Z`, git SHA `52a58e3`)

- **Summary**: 4-season global swarm trace (8 cities x 768 ticks = 6144 node evals). Treatment-Caelus-Wavefront achieves 100.00% overall daylight alignment and 100.00% nocturnal GC safety at 873.0916 us/node-tick with 100% 24h global daylight coverage, beating Control-Lon-Fixed24h (94.8% daylight, 93.3% GC safety; solstice high/polar 79.9% daylight and 84.0% GC safety) and Control-UTC-RoundRobin (49.0% daylight), while equatorial Singapore nearly ties (100.0% vs 100.0%).
- **Verdict**: PROVED: Treatment-Caelus-Wavefront clears all daylight alignment (100.0%), nocturnal GC safety (100.0%), 24h global coverage (100.0%), and latency (873.0916 us/node-tick) bars, beating Control-Lon-Fixed24h by +20.1 pp daylight and +16.0 pp GC safety on solstice high/polar latitudes while tying within 0.0 pp at equatorial Singapore.

| Metric | Value |
|---|---|
| `caelus_overall_daylight_accuracy` | `1` |
| `lon_fixed24h_overall_daylight_accuracy` | `0.9476` |
| `utc_rr_overall_daylight_accuracy` | `0.4898` |
| `caelus_solstice_high_polar_daylight_accuracy` | `1` |
| `lon_fixed24h_solstice_high_polar_daylight_accuracy` | `0.7986` |
| `caelus_equatorial_daylight_accuracy` | `1` |
| `lon_fixed24h_equatorial_daylight_accuracy` | `1` |
| `caelus_mean_us_per_node_tick` | `873.0916` |
| `caelus_overall_gc_safety` | `1` |
| `lon_fixed24h_overall_gc_safety` | `0.9329` |
| `utc_rr_overall_gc_safety` | `0.3242` |
| `caelus_solstice_high_polar_gc_safety` | `1` |
| `lon_fixed24h_solstice_high_polar_gc_safety` | `0.8403` |
| `caelus_solstice_nonpolar_gc_safety` | `1` |
| `lon_fixed24h_solstice_nonpolar_gc_safety` | `0.8438` |
| `caelus_global_daylight_coverage` | `1` |
| `total_runtime_ms` | `5573.3917` |
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

**Latest Receipt**: `fail` (run at `2026-11-22T16:57:11.520Z`, git SHA `a16db97`)

- **Summary**: 20 24h episodes (5 latitudes x 4 seasons, 74 physical sunrise/sunset/civil-twilight cliffs, 1 polar 0-cliff episodes). Unfiltered chartStability (Arm2) triggers 23.8 phantom zodiac/house alarms per 24h (476 total). Filtered sect-only chartStability (Arm3) eliminates phantom alarms and catches 80.6% sunrise/sunset cliffs, but misses civil twilight (2.6% civil catch -> 40.5% all-cliff) at 200.6108 ms/24h (26.35 wakeups). Direct analytic sceneGeometry.diurnal.minutesToNextTwilight (Arm4) catches 100.0% of all 4 physical cliffs (median err 0 min) in 11.9 wakeups (-75.2% vs 30m poll) and 9.5826 ms/24h (20.935x faster than Arm3).
- **Verdict**: KILLED (chartStability step-size control): Arm4-Analytic-RiseSet-Jump (sceneGeometry.diurnal.minutesToNextTwilight) strictly dominates Arm3-Stability-Physical-SectOnly by 20.935x lower CPU (9.5826 vs 200.6108 ms/24h), higher physical cliff coverage (100.0% vs 40.5%, catching civil dawn/dusk), and fewer wakeups (11.9 vs 26.35/24h). Archive chartStability scheduler to lab/graveyard/KILL-005-chart-stability-step-control.md; use direct sceneGeometry next-event scheduling instead.

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
| `arm3_over_arm4_cpu_ratio` | `20.935` |
| `arm3_mean_wakeups_per_24h` | `26.35` |
| `arm4_mean_wakeups_per_24h` | `11.9` |
| `arm1_mean_wakeups_per_24h` | `48` |
| `arm4_wakeup_savings_vs_poll` | `0.7521` |
| `arm3_mean_cpu_ms_per_24h` | `200.6108` |
| `arm4_mean_cpu_ms_per_24h` | `9.5826` |
| `total_runtime_ms` | `11918.3959` |
| `by_arm.Arm1-Fixed-Poll-30m.mean_wakeups_per_24h` | `48` |
| `by_arm.Arm1-Fixed-Poll-30m.total_wakeups_20ep` | `960` |
| `by_arm.Arm1-Fixed-Poll-30m.horizon_cliff_catch_rate` | `0.4722` |
| `by_arm.Arm1-Fixed-Poll-30m.civil_twilight_catch_rate` | `0.3684` |
| `by_arm.Arm1-Fixed-Poll-30m.all_physical_cliff_catch_rate` | `0.4189` |
| `by_arm.Arm1-Fixed-Poll-30m.phantom_sign_house_alarms_total` | `0` |
| `by_arm.Arm1-Fixed-Poll-30m.phantom_alarms_per_24h` | `0` |
| `by_arm.Arm1-Fixed-Poll-30m.total_cpu_ms_20ep` | `804.6764` |
| `by_arm.Arm1-Fixed-Poll-30m.mean_cpu_ms_per_24h` | `40.2338` |
| `by_arm.Arm1-Fixed-Poll-30m.mean_ms_per_wakeup` | `0.8382` |
| `by_arm.Arm2-Stability-AllFlips.mean_wakeups_per_24h` | `38.6` |
| `by_arm.Arm2-Stability-AllFlips.total_wakeups_20ep` | `772` |
| `by_arm.Arm2-Stability-AllFlips.horizon_cliff_catch_rate` | `0.8056` |
| `by_arm.Arm2-Stability-AllFlips.civil_twilight_catch_rate` | `0.0789` |
| `by_arm.Arm2-Stability-AllFlips.all_physical_cliff_catch_rate` | `0.4324` |
| `by_arm.Arm2-Stability-AllFlips.phantom_sign_house_alarms_total` | `476` |
| `by_arm.Arm2-Stability-AllFlips.phantom_alarms_per_24h` | `23.8` |
| `by_arm.Arm2-Stability-AllFlips.total_cpu_ms_20ep` | `6468.5056` |
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

**Latest Receipt**: `fail` (run at `2026-11-22T16:57:19.881Z`, git SHA `a16db97`)

- **Summary**: 30-scenario (5 cities x 2 seasons x 3 task rhythms over 28d) deadline-vs-night collision benchmark. Arm1-Synthetic-Engine-When (registerSyntheticSystem + when()) fails catastrophically: event F1=0.0255 (overlap time F1=0.046), because synthetic.ts places periodic bodies heliocentrically at Kepler a=P^(2/3) AU (0.25d CI cadence sits at 0.397 AU inside Earth's orbit, max elongation 23.0354 deg, never completing a geocentric cycle; 1.0d standup hits a 1.0 AU co-orbital singularity; 14d sprint suffers +/-10.5208 deg = 589.1654 min annual parallax error). Even parallax-free Arm2-WorldFrame-Synthetic-When (event F1=0.9987, 2259.656 ms) runs 3.029x slower than Arm3-Direct-RiseSet-Modulo (F1=1, 746.009 ms) with zero accuracy gain.
- **Verdict**: KILLED (synthetic.ts orbital task-space for agent scheduling): Arm1-Synthetic-Engine-When hits F1=0.0255 (overlap F1=0.046) due to Kepler a=P^(2/3) Earth-parallax distortion, and parallax-free Arm2-WorldFrame-Synthetic-When offers zero accuracy gain over Arm3-Direct-RiseSet-Modulo while running 3.029x slower (2259.656 ms vs 746.009 ms). Archive to lab/graveyard/KILL-006-synthetic-orbit-task-space.md; use direct riseSet('sun') + modular interval arithmetic instead.

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

## 3. Feature Factory Queue

| ID | Title | Status | Stage | Dependencies | Spec |
|---|---|---|---|---|---|
| `FACT-001` | Instrument I-05: Field Verifier and Chronolocator | `queued` | `stage-0-spec` | feat/observe-and-release-rollup preflight green; EXP-003 scenario presets | `lab/factory/FACT-001-observe-instrument/SPEC.md`, `lab/factory/FACT-001-observe-instrument/tufte-notes.md` |
| `FACT-002` | Chronosense Read-Write Middleware and Citation Auditor | `queued` | `stage-0-gated` | EXP-001 deterministic harness pass; EXP-005 live-LLM ablation beating Control-Synthetic | `lab/factory/FACT-002-chronosense-middleware/SPEC.md` |
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

## 5. Lab Commands

```bash
node lab/scripts/lab.mjs status          # Live summary tables and hygiene check
node lab/scripts/lab.mjs run all         # Execute all experiments and verify results.json
node lab/scripts/lab.mjs ledger          # Regenerate this file deterministically
node lab/scripts/lab.mjs check           # Validate schemas and zero em-dashes
node lab/scripts/lab.mjs new exp <slug>  # Scaffold a new Razor-compliant experiment
node lab/scripts/lab.mjs new fact <slug> # Scaffold a new Feature Factory track
```
