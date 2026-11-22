# EXP-003: Spacetime Observation, Spoof-Detection, Chronolocation and Geolocation Benchmark Suite

Standing R&D Lab benchmark exercising `packages/caelus/dist/src/observe.js` (`sceneGeometry`, `verifyObservation`, `chronolocate`, `geolocate`) across 200 deterministic physical spacetime scenarios, 20 global cities, all 4 seasons, and 7 adversarial spoof classes, plus generating a 30-task multimodal MCP evaluation pack (`vlm_eval_pack.jsonl`).

## Hypothesis and Null Baseline

- **Hypothesis:** Grounding visual spacetime verification, chronolocation, and geolocation in deterministic solar/lunar ephemeris geometry (`observe.js`) detects all 7 adversarial spoof classes with F1 >= 0.95 and FPR <= 0.05 under realistic VLM measurement noise (`+/-3 deg` shadow bearing, `+/-6%` shadow ratio, `+/-8 deg` Moon bright limb), recovers single-axis spoof causes via counterfactual diagnostics >= 90%, chronolocates noisy shadows within median <= 15 min, and solves both analytical Path A and spherical-grid Path B geolocation fixes.
- **Null Baseline (`Naive-LMT-Clock`):** Metadata-only local mean time heuristic (`LMT = UTC + lon/15`) that flags daytime/shadow observations outside `05:30..18:30 LMT` and dark observations inside `07:30..16:30 LMT`, without solar azimuth/altitude, seasonal declination, lunar ephemeris, or shadow sweep physics.

## Experimental Design

- **20 Global Cities:** Northern mid-latitude (`new_york`, `london`, `tokyo`, `cairo`, `san_francisco`), northern tropical (`mumbai`, `honolulu`), Arctic/sub-Arctic (`reykjavik`, `tromso`, `longyearbyen` including June midnight sun and December polar noon darkness), equatorial (`singapore`, `nairobi`), southern mid/high-latitude (`sydney`, `buenos_aires`, `cape_town`, `ushuaia`), antimeridian (`suva_fiji` +178.44E, `chatham_nz` -176.54W), and high-elevation sloped mountain terrain (`chamonix_alpine` 18 deg slope at 2400 m, `cusco_andes` 15 deg slope at 3400 m).
- **100 Authentic Observations:** 5 per city across spring, summer, autumn, and winter, covering flat/sloped shadows, daytime Moon + bright limb, Arctic polar extremes, night sky + naked-eye planets, and 40-minute NH/SH video shadow sweeps, all perturbed with deterministic VLM noise (`+/-3 deg` bearing, `+/-6%` length ratio, `+/-8 deg` Moon bright limb, `+/-2 deg` altitude, `+/-0.04` lunar illumination, `+/-1.5 deg` sweep).
- **100 Adversarial Spoofs (7 Attack Classes):**
  1. `tz_shift_4h` (15): `+/-4h` timezone offset
  2. `tz_shift_half_hour` (15): `+5:30` half-hour timezone offset (IST UTC+5:30 stamped as UTC)
  3. `hemisphere_flip` (15): N/S latitude sign inversion (`lat -> -lat`)
  4. `opposite_season` (15): 6-month (`+/-182d`) solstice shift at same UTC time of day
  5. `night_shadow_impossible` (14): daytime crisp shadow claimed at local astronomical night
  6. `moon_spoof` (13): below-horizon Moon visibility (4), waxing/waning inversion (4), and bright-limb hemisphere horizontal mirror (5)
  7. `reversed_video_sweep` (13): time-reversed video shadow sweep handedness across NH clockwise and SH counterclockwise cities

## Measured Results (`results.json`)

### 1. Spoof Detection (200 Scenarios)

| Method | TP | FP | TN | FN | Precision | Recall | F1 | FPR | Auth False-Impossible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Naive-LMT-Clock` (null) | 17 | 2 | 98 | 83 | 0.8947 | 0.1700 | 0.2857 | 0.0200 | n/a |
| `Caelus verifyObservation` | 100 | 0 | 100 | 0 | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 0 |

The 2 false positives on `Naive-LMT-Clock` occur on authentic High-Arctic polar physics at Longyearbyen (June midnight sun casting a shadow at 00:00 local time and December polar noon darkness at 12:00 local time).

### 2. Per-Attack-Class Catch Rate

| Attack Class | Count | Caelus Catch Rate | Null Baseline Catch Rate |
| --- | ---: | ---: | ---: |
| `tz_shift_4h` | 15 | 15/15 (100.0%) | 0/15 (0.0%) |
| `tz_shift_half_hour` (+5:30) | 15 | 15/15 (100.0%) | 3/15 (20.0%) |
| `hemisphere_flip` | 15 | 15/15 (100.0%) | 0/15 (0.0%) |
| `opposite_season` | 15 | 15/15 (100.0%) | 0/15 (0.0%) |
| `night_shadow_impossible` | 14 | 14/14 (100.0%) | 14/14 (100.0%) |
| `moon_spoof` | 13 | 13/13 (100.0%) | 0/13 (0.0%) |
| `reversed_video_sweep` | 13 | 13/13 (100.0%) | 0/13 (0.0%) |

### 3. Counterfactual Diagnostic Recovery (60 Single-Axis Spoofs)

| Spoof Class | Axis Recovered | Top-1 Summary Attribution | Median Offset Error |
| --- | ---: | ---: | ---: |
| `tz_shift_4h` | 15/15 (100.0%) | 15/15 (100.0%) | 4.03 min |
| `tz_shift_half_hour` | 15/15 (100.0%) | 15/15 (100.0%) | 3.90 min |
| `hemisphere_flip` | 15/15 (100.0%) | 15/15 (100.0%) | n/a |
| `opposite_season` | 15/15 (100.0%) | 15/15 (100.0%) | 5.0 days |
| **Total** | **60/60 (100.0%)** | **60/60 (100.0%)** | |

### 4. Chronolocation and Geolocation Solvers

| Benchmark | Cases | Recall | Clean Median Error | Noisy Median Error | Noisy p90 Error | Mean Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `chronolocate` (7-day span) | 20 | 100.0% | 0.0002 min | 2.50 min | 6.07 min | 19.63 ms |
| `chronolocate` (60-day pruning) | 5 | n/a | 82.67% days pruned | n/a | n/a | 56.34 ms |
| `geolocate` Path A (analytical) | 18 | 100.0% | 0.0000 km | 121.13 km | 189.34 km | 0.090 ms |
| `geolocate` Path B (Sun+Moon double alt) | 12 | 100.0% | 0.16 km | 160.40 km | 316.43 km | 3.29 ms |
| `geolocate` Path B (bearing + Moon limb) | 12 | 100.0% | 0.16 km | 294.77 km | 535.84 km | 2.90 ms |
| `geolocate` Path B (sloped mountain) | 4 | 100.0% | 0.19 km | n/a | n/a | 3.06 ms |

Forward latency (200 calls after warmup): `sceneGeometry` mean **0.893 ms** (p95 1.302 ms), `verifyObservation` mean **0.918 ms** (p95 1.320 ms).

### 5. VLM Noise-Stress Sensitivity (88 Authentic Shadow Scenes)

| Noise Scale | Bearing Jitter | Ratio Jitter | False Positives | Marginal Verdicts | False-Impossible | FPR |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1x | +/-3.0 deg | +/-6.0% | 0 | 0 | 0 | 0.00% |
| 2x | +/-6.0 deg | +/-12.0% | 0 | 0 | 0 | 0.00% |
| 3x | +/-9.0 deg | +/-18.0% | 0 | 0 | 0 | 0.00% |
| 4x | +/-12.0 deg | +/-24.0% | 0 | 27 | 0 | 0.00% |
| 5x | +/-15.0 deg | +/-30.0% | 2 | 37 | 0 | 2.27% |

### 6. Generated VLM MCP Evaluation Pack (`vlm_eval_pack.jsonl`)

30 structured JSONL tasks ready to run an external vision model with vs without Caelus MCP tools (`verify_observation`: 14 tasks, `chronolocate`: 8 tasks, `geolocate`: 8 tasks across Path A analytical and Path B double-altitude, bearing+Moon-limb, and sloped alpine fixes). Every `tool_input` uses the exact snake_case MCP schema from `packages/caelus-mcp/src/core.ts` and every `ground_truth` is computed directly from `observe.js`.

## Reproducing

```bash
node lab/experiments/EXP-003-vlm-observation-bench/experiment.mjs
```
