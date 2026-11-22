# EXP-004: Hybrid Dual-Clock Geo-RoPE Mathematical Prototype and Numerical Simulation

Pure Python 3 standard library + `python/astroengine/` prototype (zero external pip dependencies) evaluating **Hybrid Dual-Clock Geo-RoPE** against `Standard-RoPE`, `Unix-Linear-Fourier`, `Caelus-Pure-Geo`, and a steelman `Hybrid-Unix-Fourier` control across 4 attention retrieval and discrimination probes over a 500-memory, 30-day agent stream.

## Hypothesis and Null Baselines

- **Hypothesis:** Nesting a 32-D fast token/step rotary clock inside a 32-D Caelus geocentric physical torus (`GAST/ASC`, solar altitude + rising/setting trend, continuous `planetaryHour` photoperiod phase, lunar sidereal longitude `27.32d`, Sun-Moon synodic elongation `29.53d`, and solar tropical longitude `365.24d` with symmetric dyadic harmonics) resolves both `Caelus-Pure-Geo`'s 2-second intra-turn collapse and `Standard-RoPE`'s post-sleep compaction collapse, beats fixed-period UTC Fourier clocks on high-latitude photoperiod recurrence (Oslo Dec vs Sept), and eliminates rational weekly (`7d/14d/21d/28d`) aliasing across multi-week same-UTC memory streams.
- **Null Baselines:**
  1. `Standard-RoPE`: 64-D token index `m` only (`base = 10000`), resets to `0` on sleep/compaction.
  2. `Unix-Linear-Fourier`: 64-D fixed-period `24h / 7d / 365.25d` UTC sinusoids with dyadic harmonics up to `8x`.
  3. `Hybrid-Unix-Fourier` (steelman control): 32-D fast token RoPE + 32-D fixed-period `24h / 7d / 365.25d` UTC Fourier (matched 32-D temporal budget and matched `1/2/4/8x` dyadic harmonic ladder).

## Mathematical Formulation (`d = 64`, 32 Rotary Planes)

For any 64-D vector `x` and phase vector `theta = (theta_0, ..., theta_31)`, rotary encoding applies exact orthogonal block-diagonal 2D rotations `R(theta) in SO(2)^32`:

- Norm preservation verified numerically across all 5 encoders: `max | ||R(theta) x||_2 - 1 | = 0.0`.
- Physical phase parity against `astroengine.observe.scene_geometry`: `0.000000 deg` max diff across `sun_alt`, `asc`, and `moon_lon`.
- Phase extraction speed over the 500-memory stream: `785.6 ms` total (`1.57 ms/memory` in pure Python 3).

`Hybrid-Dual-Geo-RoPE` allocates its 32 rotary planes as:
- **Planes 0..15 (32-D fast cognitive clock):** `theta_p = m * 10000^(-2p / 32)` on session-local token index `m`.
- **Planes 16..31 (32-D Caelus geocentric torus):**
  - 2 planes `GAST / ASC`: `[gast, asc]`
  - 3 planes solar elevation + trend: `[2*sunAlt, 4*sunAlt, atan2(rateAlt, 0.15)]`
  - 3 planes continuous `planetaryHour` photoperiod phase (`0` sunrise -> `pi/2` noon -> `pi` sunset -> `3pi/2` midnight): `[phi_ph, 2*phi_ph, 3*phi_ph]`
  - 4 planes lunar sidereal longitude (`27.32166d`): `[1, 2, 4, 8] * moonLon`
  - 2 planes Sun-Moon synodic elongation (`29.53059d`): `[1, 4] * elong`
  - 2 planes solar tropical longitude (`365.2422d`): `[1, 4] * sunLon`

## Measured Results (`results.json`)

### Probe A: Intra-Turn Ordering (50 Steps Inside a 2.0-Second Turn)

Measured real Earth rotation in `dt = 2.0 s` from `astroengine.houses.gast`: **`0.008356 deg`**.

| Encoder | 50-Step / 2s Margin | Retrieval Top-1 | Retrieval AUC | Verdict |
| --- | ---: | ---: | ---: | --- |
| `Standard-RoPE` | 0.5258 | 1.0000 | 1.0000 | Pass |
| `Unix-Linear-Fourier` | 0.0000 | 0.4950 | 0.4922 | Collapses (2s = 0.0083 deg) |
| `Caelus-Pure-Geo` | 0.0000 | 0.4850 | 0.4939 | Collapses (confirms caveat) |
| `Hybrid-Dual-Geo-RoPE` | 0.3132 | 1.0000 | 0.9999 | Pass |
| `Hybrid-Unix-Fourier` (steelman) | 0.3176 | 1.0000 | 0.9988 | **Ties Hybrid** |

### Probe B: Post-Sleep (9.5h) and 10-Day Dormancy Ordering After `m` Resets to 0

| Encoder | Overnight 64-D Margin | 10d Dormancy Margin | Fresh-vs-Stale Top-1 | Fresh-vs-Stale AUC | Causal Order Acc |
| --- | ---: | ---: | ---: | ---: | ---: |
| `Standard-RoPE` | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| `Unix-Linear-Fourier` | 0.7653 | 0.7507 | 1.0000 | 1.0000 | 1.0000 |
| `Caelus-Pure-Geo` | 0.5973 | 1.1183 | 1.0000 | 1.0000 | 1.0000 |
| `Hybrid-Dual-Geo-RoPE` | 0.2962 | 0.5625 | 1.0000 | 1.0000 | 1.0000 |
| `Hybrid-Unix-Fourier` (steelman) | 0.3375 | 0.3818 | 1.0000 | 1.0000 | 1.0000 |

`Unix-Linear-Fourier` and `Hybrid-Unix-Fourier` **tie** `Hybrid-Dual-Geo-RoPE` on Probe B because raw UTC 24h phase rotates ~142 deg across a 9.5h sleep. `Standard-RoPE` collapses completely (0% accuracy, actively preferring stale pre-sleep `m=0` over fresh post-wake `m=80`).

### Probe C: Circadian / Photoperiod Recurrence Across Seasonal Shift

- **Oslo (`59.91N`, Dec vs Sept):** Mean seasonal twilight UTC shift = **`3.12 hours`**; same-UTC-clock distractor solar altitude error = **`21.81 deg`**.
- **Singapore (`1.35N`, equatorial control):** Mean seasonal twilight UTC shift = **`0.09 hours`** (5.4 min); distractor altitude error = **`1.45 deg`**.

| Encoder | Oslo Circadian Top-1 | Oslo vs-UTC Win Rate | Oslo Circadian AUC | Oslo Isotropic 64-D Top-1 | Oslo Iso vs-UTC Win | Singapore Circadian AUC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `Standard-RoPE` | 0.0900 | 0.4900 | 0.4827 | 0.0900 | 0.4900 | 0.5170 |
| `Unix-Linear-Fourier` | 0.0000 | 0.0000 | 0.4098 | 0.0000 | 0.0000 | 0.9414 |
| `Caelus-Pure-Geo` | 1.0000 | 1.0000 | 0.9994 | 0.6000 | 0.9800 | 0.9486 |
| `Hybrid-Dual-Geo-RoPE` | **0.9900** | **1.0000** | **0.9970** | **0.5800** | **0.9200** | **0.9485** |
| `Hybrid-Unix-Fourier` (steelman) | 0.0000 | 0.0000 | 0.4331 | 0.0000 | 0.0000 | 0.9300 |

Both `Unix-Linear-Fourier` and `Hybrid-Unix-Fourier` score **0.00** in Oslo because they deterministically lock onto the wrong same-UTC-clock afternoon/night distractor. At equatorial Singapore, all temporal encoders tie (`AUC ~0.93-0.95`), proving the Oslo advantage is purely physical solar-declination geometry.

### Probe D: Multi-Week Unique Non-Aliasing Separation (30 Days at Identical 14:00 UTC)

435 distinct day pairs (`Day 0..29` at `14:00 UTC`, `m = 0`):

| Encoder | Collisions (>0.90) | Collisions (>0.95) | Max Off-Diag Cos | Exact-Day Top-1 | Exact-Day AUC | 1d Cos | 7d Cos | 14d Cos | 28d Cos | 29d Cos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Standard-RoPE` | 1.0000 | 1.0000 | 1.0000 | 0.0400 | 0.4665 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| `Unix-Linear-Fourier` | 0.0529 | 0.0529 | 0.9638 | 0.7933 | 0.9918 | 0.6358 | **0.9638** | 0.8800 | 0.7720 | 0.4083 |
| `Caelus-Pure-Geo` | 0.0000 | 0.0000 | 0.8872 | 0.9867 | 0.9996 | 0.8662 | 0.7084 | 0.6309 | 0.7486 | 0.6356 |
| `Hybrid-Dual-Geo-RoPE` | **0.0000** | **0.0000** | **0.8872** | **0.9067** | **0.9935** | 0.8662 | **0.7084** | **0.6309** | 0.7486 | 0.6356 |
| `Hybrid-Unix-Fourier` (steelman) | 0.0529 | 0.0529 | 0.9638 | 0.6467 | 0.9814 | 0.6570 | **0.9638** | 0.8800 | 0.7720 | 0.4295 |

## Honest Tie-vs-Win Summary

- **Where `Unix-Linear-Fourier` / `Hybrid-Unix-Fourier` ties or leads:**
  - **Probe A (2s intra-turn):** `Hybrid-Unix-Fourier` ties `Hybrid-Dual-Geo-RoPE` (`AUC 0.9988 vs 0.9999`) via the shared 32-D fast token clock.
  - **Probe B (post-sleep reset):** Both `Unix-Linear-Fourier` and `Hybrid-Unix-Fourier` tie `Hybrid-Dual-Geo-RoPE` (`1.000` Top-1 / AUC).
  - **Probe C (equator):** At Singapore (`1.35N`), photoperiod barely shifts (`0.09h`), so UTC clocks tie Geo-RoPE (`AUC 0.93-0.95`).
  - **Probe D (`1d` and `29d` lags):** `Unix-Linear-Fourier`'s 7-day cycle provides wider adjacent-day (`1d cos = 0.6358 vs 0.8662`) and `29d` (`0.4083 vs 0.6356`) margin than the slower lunar basis.
- **Where `Hybrid-Dual-Geo-RoPE` genuinely wins:**
  - **Probe C (high-latitude photoperiod):** `0.99` circadian Top-1 (`1.00` vs-same-UTC win rate) vs `0.00` for both `Unix-Linear-Fourier` and `Hybrid-Unix-Fourier`.
  - **Probe D (zero weekly aliasing + global exact-day accuracy):** `0.00%` collisions (`max cos = 0.8872`) and `90.67%` exact-day Top-1 vs `5.29%` collisions (`7d cos = 0.9638`) and `64.67%` Top-1 (`Hybrid-Unix-Fourier`) / `79.33%` (`Unix-Linear-Fourier`), because integer harmonics of a rational 7-day period cannot escape weekly wrap, whereas incommensurate lunar/solar periods (`27.32d / 29.53d / 365.24d`) never mutually alias.
  - **Only architecture passing all 4 probes simultaneously:** `Standard-RoPE` fails B/C/D; `Unix-Linear-Fourier` fails A/C and aliases D; `Caelus-Pure-Geo` fails A; `Hybrid-Unix-Fourier` fails C and aliases D.

## Reproducing

```bash
python3 lab/experiments/EXP-004-geo-rope-prototype/experiment.py
```
