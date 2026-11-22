# Caelus R&D Lab and Feature Factory Ledger

Generated deterministically by `node lab/scripts/lab.mjs ledger` from `lab/experiments/*/manifest.json`, `results.json`, `lab/factory/*/manifest.json`, and `lab/graveyard/KILL-*.md`. Do not hand-edit metrics in this file.

- **Branch**: `feat/observe-and-release-rollup`
- **Git HEAD**: `c5d89ab`
- **Research Experiments**: 4 (4 with verified receipts)
- **Feature Factory Tracks**: 7
- **Graveyard Kills**: 4

## 1. Research Experiments Overview

| ID | Title | Status | Receipt | Key Metrics | Path |
|---|---|---|---|---|---|
| `EXP-001` | Chronosense 4-Arm Ablation: Physical-Horizon Envelope, Read-Write Cursor, and Drift Audit | `active` | `pass` (2026-11-22) | caelus_night_crossed_accuracy=1, iso_utc_night_crossed_accuracy=0.6764, caelus_daylight_accuracy=1, synth_24h_daylight_accuracy=0.8117 | `lab/experiments/EXP-001-chronosense-ablation/` |
| `EXP-002` | Dyadic Circadian and Phase-Resonant Episodic Memory Benchmark (3-Arm Ablation) | `active` | `pass` (2026-11-22) | compacted4x_arm3_top1=0.8, compacted4x_arm2_top1=0.4083, compacted4x_arm1_top1=0.2083, compacted4x_arm3_top3=0.9083 | `lab/experiments/EXP-002-phase-resonant-memory/` |
| `EXP-003` | Spacetime Observation, Spoof-Detection, Chronolocation and Geolocation Benchmark Suite | `active` | `pass` (2026-11-22) | caelus_spoof_detection.precision=1, null_baseline_naive_lmt.precision=0.8947, counterfactual_diagnostics.axis_recovery_rate=1, chronolocation.noisy_recall=1 | `lab/experiments/EXP-003-vlm-observation-bench/` |
| `EXP-004` | Hybrid Dual-Clock Geo-RoPE Mathematical Prototype and Numerical Simulation | `active` | `pass` (2026-11-22) | Standard-RoPE.mean_50step_2s_separation_margin=0.5258, Standard-RoPE.mean_overnight_reset_sep_margin_64d=0, Standard-RoPE.isotropic_64d_top1_acc=0.09, Standard-RoPE.isotropic_64d_top1_acc=0.14 | `lab/experiments/EXP-004-geo-rope-prototype/` |

## 2. Experiment Receipts and Razor Records

### EXP-001: Chronosense 4-Arm Ablation: Physical-Horizon Envelope, Read-Write Cursor, and Drift Audit

- **Directory**: `lab/experiments/EXP-001-chronosense-ablation/`
- **Chart**: `lab/experiments/EXP-001-chronosense-ablation/chart.svg`
- **Status**: `active` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `chronosense`, `ablation`, `observe`, `canonical`, `cursor-audit`, `photoperiod`
- **Hypothesis**: Injecting a compact (~40-token) Caelus physical-horizon envelope backed by sceneGeometry and canonicalChart/chartDigest outperforms no-clock, passive UTC ISO, and fixed-24h synthetic sinusoid controls on cross-compaction local night_crossed disambiguation, high-latitude solar-horizon deadline accuracy, daylight/twilight regime accuracy, and deterministic pre-tool cursor drift detection at sub-2ms offline compute cost.
- **Null Baseline**: Passive UTC ISO-8601 timestamp (Control-ISO) and elapsed-seconds plus fixed 24h sin/cos clock wave (Control-Synthetic).
- **Success Bar**: 100% local night_crossed accuracy across all 5 latitudes x 2 seasons (vs <90% UTC-ISO), 0.0 min physical sunset/solar-noon deadline error (vs >60 min MAE for fixed-24h clock across latitudes), >=99% deterministic cursor drift detection at 0% false positive rate on clean turns, mean compute latency <=2500 us/turn, and <=55 cl100k-approx tokens/turn.
- **Kill Criterion**: If Treatment-Caelus-Physical fails to beat Control-Synthetic by >=15 percentage points on high-latitude daylight/twilight accuracy or >=45 min MAE on physical sunset deadlines, or exceeds 100 tokens/turn or 10 ms/turn offline latency.

**Latest Receipt**: `pass` (run at `2026-11-22T15:12:07.220Z`, git SHA `c5d89ab`)

- **Summary**: 100 72h episodes (1,200 turns) across 5 latitudes x 2 seasons. Treatment-Caelus-Physical achieves 100.0% local night_crossed accuracy (vs 67.6% UTC Control-ISO), 100.0% physical daylight classification (vs 81.2% fixed-24h Control-Synthetic), 0.000 min sunset deadline error (vs 88.7 min MAE / 206.8 min max for longitude-adjusted fixed-24h clock plus 10 polar no-sunset episodes), and 100.0% pre-tool cursor drift detection at 0.0% FPR in 1274 us/turn (~45.5 cl100k tokens).
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
| `caelus_mean_us` | `1273.73` |
| `compute_latency_us.Baseline-None.mean` | `0.072` |
| `compute_latency_us.Baseline-None.median` | `0.042` |
| `compute_latency_us.Baseline-None.p95` | `0.125` |
| `compute_latency_us.Baseline-None.p99` | `0.25` |
| `compute_latency_us.Baseline-None.max` | `1.417` |
| `compute_latency_us.Control-ISO.mean` | `0.437` |
| `compute_latency_us.Control-ISO.median` | `0.333` |
| `compute_latency_us.Control-ISO.p95` | `0.833` |
| `compute_latency_us.Control-ISO.p99` | `1.75` |
| `compute_latency_us.Control-ISO.max` | `41.792` |
| `compute_latency_us.Control-Synthetic.mean` | `1.453` |
| `compute_latency_us.Control-Synthetic.median` | `1.167` |
| `compute_latency_us.Control-Synthetic.p95` | `2.666` |
| `compute_latency_us.Control-Synthetic.p99` | `4.083` |
| `compute_latency_us.Control-Synthetic.max` | `53.709` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.mean` | `839.805` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.median` | `809.709` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.p95` | `1167.083` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.p99` | `2111.625` |
| `compute_latency_us.Treatment-Caelus-SceneOnly.max` | `3073.208` |
| `compute_latency_us.Treatment-Caelus-Physical.mean` | `1273.728` |
| `compute_latency_us.Treatment-Caelus-Physical.median` | `1233.375` |
| `compute_latency_us.Treatment-Caelus-Physical.p95` | `1669.834` |
| `compute_latency_us.Treatment-Caelus-Physical.p99` | `2545.458` |
| `compute_latency_us.Treatment-Caelus-Physical.max` | `3654.375` |
| `compute_latency_us.Treatment-Caelus-AuditHook.mean` | `1261.702` |
| `compute_latency_us.Treatment-Caelus-AuditHook.median` | `1218.875` |
| _additional detail_ | `282 more metric entries in lab/experiments/EXP-001-chronosense-ablation/results.json` |

### EXP-002: Dyadic Circadian and Phase-Resonant Episodic Memory Benchmark (3-Arm Ablation)

- **Directory**: `lab/experiments/EXP-002-phase-resonant-memory/`
- **Chart**: `lab/experiments/EXP-002-phase-resonant-memory/chart.svg`
- **Status**: `active` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `memory`, `circadian`, `photoperiod`, `phase-stratified-compaction`, `counterfactual`, `planetary-hour`
- **Hypothesis**: Indexing episodic memories with a trimmed Caelus physical phase vector (solar altitude/trend, diurnal sect, photoperiod-warped planetary-hour arc, lunar elongation, solar seasonal longitude via sceneGeometry and pheno) paired with phase-stratified compaction (retaining diurnal, photoperiod, and counterfactual travel-relocation strata) significantly improves Top-1 and Top-3 recall over Semantic-LRU and Semantic-Fixed24h on high-latitude seasonal photoperiod shifts, post-compaction nocturnal queries, and NYC-to-Tokyo travel handoffs.
- **Null Baseline**: Arm1-Semantic-LRU (semantic cosine + exponential recency decay, LRU eviction) and Arm2-Semantic-Fixed24h (semantic cosine + fixed 24h sin/cos local clock, LRU eviction; plus oracle-TZ diagnostic Arm2b-LocalCivil24h).
- **Success Bar**: Under 4x compaction (90/360 budget), Arm3-Semantic-Caelus-Photoperiod beats both Arm1 and Arm2 by >=20 percentage points Top-1 overall, >=25 pp Top-1 on high-latitude photoperiod shift queries, >=35 pp Top-1 on post-compaction nocturnal queries, and >=25 pp Top-1 on travel-handoff queries, while maintaining sub-1500 us indexing and sub-500 us query latency.
- **Kill Criterion**: If Arm3 fails to beat Arm2-Semantic-Fixed24h by >=15 pp Top-1 on high-latitude photoperiod shifts or >=20 pp Top-1 on post-compaction nocturnal recall, or degrades stationary recent control recall by >20 pp.

**Latest Receipt**: `pass` (run at `2026-11-22T15:12:08.558Z`, git SHA `c5d89ab`)

- **Summary**: 90-day Oslo/NYC/Tokyo trace (360 memories, 120 recall queries; Oslo daylight drops 12.26h -> 5.90h). Uncompacted Top-1: Arm1=20.8%, Arm2=64.2%, Arm3=86.7% (photoperiod 82.9% vs 5.7%). Under 4x compaction (90/360) Top-1: Arm1=20.8%, Arm2=40.8%, Arm3=80.0% (photoperiod 62.9% vs 0.0%, nocturnal 100.0% vs 33.3%, travel 73.3% vs 46.7%). Index=878 us, Query=885 us (51 us scan-only).
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
| `arm3_index_mean_us` | `878.21` |
| `arm3_query_scan_mean_us` | `51.11` |
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
- **Status**: `active` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.mjs`
- **Tags**: `observe`, `vlm`, `spoof-detection`, `chronolocation`, `geolocation`, `benchmark`, `mcp-eval`
- **Hypothesis**: Caelus physical ephemeris verification (sceneGeometry, verifyObservation, chronolocate, geolocate) detects spacetime spoofs across 7 adversarial attack classes with F1 >= 0.95 and FPR <= 0.05 under realistic VLM measurement noise (+/-3 deg shadow bearing, +/-6% shadow ratio, +/-8 deg Moon bright limb), recovers single-axis spoof causes via counterfactual diagnostics >= 90%, chronolocates noisy shadows within median <= 15 min, and geolocates via analytical Path A and spherical-grid Path B far beyond metadata-only heuristics.
- **Null Baseline**: Naive local-mean-time (LMT = UTC + lon/15) day/night metadata heuristic with no astronomical ephemeris, shadow azimuth/altitude geometry, lunar phase/limb physics, or shadow sweep handedness.
- **Success Bar**: Spoof detection F1 >= 0.95 with FPR <= 0.05 and zero false-impossible verdicts on 100 noisy authentic scenes; counterfactual diagnostic recovery >= 90%; noisy chronolocation median error <= 15 min; Path A noiseless median error < 1 km and Path B grid median error < 250 km; emits 30-task VLM MCP evaluation pack.
- **Kill Criterion**: Spoof detection F1 < 0.85, authentic FPR > 0.15, counterfactual recovery < 70%, or Path A noiseless error > 10 km.

**Latest Receipt**: `pass` (run at `2026-11-22T15:10:41.566Z`, git SHA `c5d89ab`)

- **Summary**: 200-scenario spacetime benchmark across 20 global cities and 4 seasons: Caelus verifyObservation achieves F1=1 (P=1, R=1, FPR=0, auth_impossible=0) vs Naive-LMT-Clock baseline F1=0.2857 (R=0.17). Counterfactual axis recovery=60/60 (100%), top-1 attribution=60/60 (100%). Noisy chronolocation median=2.5 min (19.11 ms). Geolocation median error: Path A analytical=0 km clean / 121.1 km noisy (0.09 ms) vs Path B grid Sun+Moon=0.2 km clean / 160.4 km noisy (2.9 ms), bearing+Moon-limb=0.2 km clean / 294.8 km noisy (2.7 ms).
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
| `chronolocation.mean_latency_ms` | `19.11` |
| `chronolocation.p95_latency_ms` | `25.54` |
| `chronolocation.sixty_day_mean_latency_ms` | `51.74` |
| `geolocation.path_a_analytical.clean_recall` | `1` |
| `geolocation.path_a_analytical.clean_median_err_km` | `0` |
| `geolocation.path_a_analytical.noisy_recall` | `1` |
| `geolocation.path_a_analytical.noisy_median_err_km` | `121.13` |
| `geolocation.path_a_analytical.mean_latency_ms` | `0.086` |
| `geolocation.path_a_analytical.p95_latency_ms` | `0.122` |
| `geolocation.path_b_double_altitude_sun_moon.noisy_recall` | `1` |
| `geolocation.path_b_double_altitude_sun_moon.clean_median_err_km` | `0.16` |
| `geolocation.path_b_double_altitude_sun_moon.noisy_median_err_km` | `160.4` |
| `geolocation.path_b_double_altitude_sun_moon.mean_latency_ms` | `2.9` |
| _additional detail_ | `82 more metric entries in lab/experiments/EXP-003-vlm-observation-bench/results.json` |

### EXP-004: Hybrid Dual-Clock Geo-RoPE Mathematical Prototype and Numerical Simulation

- **Directory**: `lab/experiments/EXP-004-geo-rope-prototype/`
- **Chart**: `lab/experiments/EXP-004-geo-rope-prototype/chart.svg`
- **Status**: `active` | **Created**: `2026-11-22` | **Entrypoint**: `experiment.py`
- **Tags**: `geo-rope`, `chronosense`, `rotary-embeddings`, `attention`, `photoperiod`, `python`, `research`
- **Hypothesis**: Nesting a 32-D fast token/step RoPE clock inside a 32-D Caelus geocentric physical torus (GAST/ASC, solar altitude, planetary-hour photoperiod phase, Moon longitude, Sun-Moon elongation, solar seasonal longitude) preserves 100% intra-turn token ordering where Caelus-Pure-Geo collapses, preserves post-sleep/post-compaction elapsed ordering where Standard-RoPE collapses, beats fixed-period Unix-Linear-Fourier on high-latitude seasonal photoperiod recurrence (Oslo Dec vs Sept), and eliminates 7d/14d/21d/28d weekly aliasing across 30-day same-clock memory streams.
- **Null Baseline**: Standard-RoPE (token index only), Unix-Linear-Fourier (synthetic fixed-period 24h/7d/365.25d UTC sinusoids), and steelman Hybrid-Unix-Fourier (32-D fast token RoPE + 32-D fixed-period 24h/7d/365.25d UTC sinusoids).
- **Success Bar**: Hybrid-Dual-Geo-RoPE achieves AUC >= 0.99 on Probe A (confirming Caelus-Pure-Geo collapses near 0.50), AUC >= 0.99 on Probe B (confirming Standard-RoPE collapses near 0.50), beats Unix-Linear-Fourier and Hybrid-Unix-Fourier by >= +0.30 Top-1 accuracy on Probe C Oslo photoperiod recurrence, and achieves lower multi-week collision rate than Unix-Linear-Fourier on Probe D while honestly reporting all probes where Unix-Fourier ties.
- **Kill Criterion**: Hybrid-Dual-Geo-RoPE fails to beat Unix-Linear-Fourier / Hybrid-Unix-Fourier on Probe C photoperiod recurrence by at least +0.15 Top-1 accuracy, fails to beat Caelus-Pure-Geo on Probe A, or fails to beat Standard-RoPE on Probe B.

**Latest Receipt**: `pass` (run at `2026-11-22T15:10:47.511633Z`, git SHA `c5d89ab`)

- **Summary**: 64-D Geo-RoPE simulation over 500 memories / 30 days (Oslo 59.91N + Singapore control): Probe A (2s intra-turn, Earth turns 0.008356 deg): Hybrid AUC=0.9999 vs Caelus-Pure collapse AUC=0.4939 (Hybrid-Unix ties at 0.9988). Probe B (post-sleep reset): Hybrid AUC=1.0 vs Standard-RoPE collapse AUC=0.0 (Unix-Fourier ties at 1.0). Probe C (Oslo Dec-vs-Sept photoperiod): Hybrid circadian Top-1=0.99 (iso 64-D=0.58) beats Unix-Linear-Fourier (0.0) and Hybrid-Unix-Fourier (0.0). Probe D (30d same-UTC non-aliasing): Hybrid collision(>0.90)=0.0 (Top-1=0.9067) vs Unix-Linear-Fourier collision=0.0529 (Top-1=0.7933, 7d alias cos=0.9638).
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

## 5. Lab Commands

```bash
node lab/scripts/lab.mjs status          # Live summary tables and hygiene check
node lab/scripts/lab.mjs run all         # Execute all experiments and verify results.json
node lab/scripts/lab.mjs ledger          # Regenerate this file deterministically
node lab/scripts/lab.mjs check           # Validate schemas and zero em-dashes
node lab/scripts/lab.mjs new exp <slug>  # Scaffold a new Razor-compliant experiment
node lab/scripts/lab.mjs new fact <slug> # Scaffold a new Feature Factory track
```
