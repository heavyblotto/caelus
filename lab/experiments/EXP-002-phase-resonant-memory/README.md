# EXP-002: Dyadic Circadian and Phase-Resonant Episodic Memory Benchmark

## Purpose

Measure whether indexing episodic memories with a trimmed Caelus physical phase vector (`sceneGeometry` + `pheno` + solar seasonal longitude) and compacting memory via unsupervised **phase-stratified retention** (anchored by `sceneGeometry` diurnal bins and `counterfactual`/`chartDiff` horizon relocation detection) outperforms standard semantic+LRU and semantic+fixed-24h-clock baselines across seasonal photoperiod collapse, nocturnal compaction eviction, and intercontinental travel.

## Arms

1. `Arm1-Semantic-LRU`: 32-D semantic cosine similarity + exponential recency decay (`tau = 14d`) + LRU compaction (keep newest 90 of 360 memories).
2. `Arm2-Semantic-Fixed24h`: 32-D semantic cosine + fixed 24h `cos/sin(2*pi*hour/24)` clock + tiny recency tie-breaker (`0.05`) + LRU compaction.
   - Diagnostic `Arm2b-LocalCivil24h`: Same as Arm 2 but given oracle updated local civil timezone during NYC and Tokyo travel.
3. `Arm3-Semantic-Caelus-Photoperiod`: 32-D semantic cosine + 10-D physical Caelus phase vector (photoperiod-warped unequal `planetaryHour` diurnal circle, horizon-normalized solar elevation & rising/setting polarity, `isDay` sect, 3-deg horizon band, lunar synodic elongation via `pheno`, solar seasonal longitude) + identical `0.05` recency tie-breaker + unsupervised **phase-stratified compaction** (16 recency tail + 74 slots swept round-robin across `diurnalBin x epochBin` physical strata with unsupervised semantic novelty `< 0.70`, zero ground-truth labels).
   - Diagnostic `Arm3-LRU-NoStrat`: Arm 3 phase vector paired with plain LRU compaction to isolate feature-encoding gains from compaction-retention gains.

## Dataset and Query Design

- **90-day multi-regime trace (`2026-09-22` to `2026-12-20`, 360 memories):**
  - Days 0..53: Oslo (`59.91N, 10.75E`) as daylight collapses from `12.26h` (Sept 22) toward winter.
  - Days 54..61: New York (`40.71N, -74.01E`, UTC-5).
  - Days 62..69: Tokyo (`35.68N, 139.65E`, UTC+9), with the `2026-11-23T01:30:00Z` NYC -> Tokyo handoff modeled directly via `counterfactual` and `chartDiff` (ASC flips Cancer -> Capricorn, MC flips Aries -> Scorpio, 13 bodies change house/sign, Sun flips from `-44.5 deg` night house 5 in NYC to `+32.4 deg` day house 10 in Tokyo).
  - Days 70..89: Return to Oslo (`5.90h` daylight on Dec 20, `6.37h` photoperiod collapse vs Sept 22), ending in a 16-day daytime crunch sprint with zero nocturnal sessions.
- **120 time-regime-dependent recall queries** across 4 slices evaluated under both **uncompacted (360)** and **4x compacted (90)** budgets:
  - `high_lat_photoperiod_shift` (35): Oslo Dec sunset/sunrise querying Sept-Oct matching physical regime.
  - `post_compaction_nocturnal` (30): Oslo Dec late-night async debugging queries.
  - `travel_handoff_nyc_tokyo` (30): Tokyo travel-week regime recall across NYC/Tokyo relocation.
  - `stationary_recent_control` (25): Recent Oslo Dec daytime/morning control queries.

## Running

```bash
node lab/experiments/EXP-002-phase-resonant-memory/experiment.mjs
```

Writes `results.json` inside this directory.

## Key Results (Measured)

### Uncompacted (360 memories) Top-1 / Top-3 Recall

| Slice (n) | Arm1-Semantic-LRU | Arm2-Semantic-Fixed24h | Arm2b-LocalCivil24h (Diag) | Arm3-Caelus-Photoperiod |
|---|---:|---:|---:|---:|
| Overall (120) | 20.8% / 36.7% | 64.2% / 78.3% | 67.5% / 80.0% | **86.7% / 96.7%** |
| High-lat photoperiod shift (35) | 0.0% / 0.0% | 5.7% / 31.4% | 5.7% / 31.4% | **82.9% / 88.6%** |
| Post-compaction nocturnal (30) | 0.0% / 10.0% | 86.7% / 100.0% | **100.0% / 100.0%** | **100.0% / 100.0%** |
| Travel handoff NYC -> Tokyo (30) | 30.0% / 60.0% | **80.0%** / 93.3% | **80.0% / 100.0%** | 73.3% / **100.0%** |
| Stationary recent control (25) | 64.0% / 92.0% | **100.0% / 100.0%** | **100.0% / 100.0%** | 92.0% / **100.0%** |

### 4x Compacted (90 / 360 memories) Top-1 / Top-3 Recall

| Slice (n) | Arm1-Semantic-LRU | Arm2-Semantic-Fixed24h | Arm3-LRU-NoStrat (Diag) | Arm3-Caelus-Photoperiod |
|---|---:|---:|---:|---:|
| Overall (120) | 20.8% / 33.3% | 40.8% / 42.5% | 42.5% / 45.0% | **80.0% / 90.8%** |
| High-lat photoperiod shift (35) | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | **62.9% / 80.0%** |
| Post-compaction nocturnal (30) | 0.0% / 10.0% | 33.3% / 40.0% | 60.0% / 60.0% | **100.0% / 100.0%** |
| Travel handoff NYC -> Tokyo (30) | 30.0% / 46.7% | 46.7% / 46.7% | 33.3% / 36.7% | **73.3% / 93.3%** |
| Stationary recent control (25) | 64.0% / 92.0% | **100.0% / 100.0%** | 92.0% / **100.0%** | 88.0% / 92.0% |

### Latency (Real `performance.now()`)

- Indexing per memory (mean): Arm 1 `0.3 us`, Arm 2 `1.2 us`, Arm 3 `~964 us` (1 offline `sceneGeometry` + `pheno` + `longitude` call).
- Query over 360 memories (mean): Arm 1 `62 us`, Arm 2 `53 us`, Arm 3 `~934 us` end-to-end (`~55 us` scan-only once current query phase vector is cached per turn).

## Honest Physics Discoveries and Trade-Offs

- **High-latitude winter solar-noon aliasing:** At Oslo `59.9N` in December, peak solar altitude at noon is only `+6.3 deg`. Using raw unnormalized solar altitude with a broad twilight Gaussian (`exp(-(sunAlt/8)^2)`) misclassified winter noon as partial twilight. Anchoring the diurnal cycle to Caelus's unequal `planetaryHour` arc (mapping sunrise -> `0`, noon -> `pi/2`, sunset -> `pi`, midnight -> `3pi/2`) eliminated winter-noon aliasing.
- **Where Arm 2 ties or beats Arm 3:** Uncompacted nocturnal recall (midnight is clock-stationary across seasons), uncompacted travel-handoff Top-1 when same-city memories are retained (`80.0%` vs `73.3%`, though Arm 3 reaches `100.0%` Top-3), and stationary recent control queries (`100.0%` vs `88.0%` compacted, because LRU packs all 90 slots into the latest 22 days).
- **Compaction vs encoding attribution:** `Arm3-LRU-NoStrat` scores `42.5%` compacted vs `80.0%` for full Arm 3 (`+37.5 pp`), demonstrating that phase-stratified compaction is essential under tight memory budgets, while uncompacted photoperiod recall (`82.9%` vs `5.7%`, `+77.2 pp`) proves the independent value of photoperiod-warped Caelus phase features.
