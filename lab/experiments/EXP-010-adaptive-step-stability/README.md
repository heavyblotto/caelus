# EXP-010: Adaptive Cognitive Step-Size Control (`chartStability` vs. Direct `sceneGeometry` Horizon Jumps)

Empirically tests the trimmed frontier proposal in `caelus_agent_chronosense.md` Section 3 ("Adaptive Cognitive Step-Size via `chartStability` watching physical `sect` flips") against fixed 30-minute polling, unfiltered `chartStability`, and direct analytic next-boundary scheduling via `sceneGeometry.diurnal.minutesToNextTwilight`.

## Experimental Design

- **20 deterministic 24-hour episodes** (`5` cities: Oslo, New York, Singapore, Sydney, Tromso x `4` seasons: Mar equinox, Jun solstice, Sep equinox, Dec solstice; `480` simulated hours, `74` ground-truth physical cliffs: sunrise, sunset, civil dawn `-6 deg`, civil dusk `-6 deg`; `1` polar 0-cliff episode).
- **4 Arms**:
  1. `Arm1-Fixed-Poll-30m`: constant 30-minute polling (`48` wakeups/24h).
  2. `Arm2-Stability-AllFlips`: unfiltered `chartStability(..., { houseSystem: "whole_sign", halfWidthSeconds: 1800, stepSeconds: 600 })` reacting to every unstable fact (`angle_sign`, `sign`, `house`, `aspect`, `retrograde`, `sect`).
  3. `Arm3-Stability-Physical-SectOnly`: `chartStability` filtered strictly to `kind === "sect"` (day/night flip).
  4. `Arm4-Analytic-RiseSet-Jump`: calls `sceneGeometry` once per wakeup and sleeps directly to `min(180m, diurnal.minutesToNextTwilight)`.

## Measured Results (`results.json`)

| Arm | Wakeups / 24h | Sunrise/Sunset Catch | Civil Twilight Catch | All 4 Cliffs Catch | Median Err (min) | Phantom Alarms / 24h | CPU / 24h (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Arm1-Fixed-Poll-30m` | 48.00 | 47.2% | 36.8% | 41.9% | 7.34 | 0.0 | 38.64 |
| `Arm2-Stability-AllFlips` | 38.60 | 80.6% | 7.9% | 43.2% | 7.06 | **23.8** (476 total) | 308.10 |
| `Arm3-Stability-Physical-SectOnly` | 26.35 | 80.6% | 2.6% | 40.5% | 7.40 | 0.0 | 191.69 |
| `Arm4-Analytic-RiseSet-Jump` | **11.90** (-75.2%) | **100.0%** | **100.0%** | **100.0%** | **0.00** | **0.0** | **9.15** |

## Disposition: KILLED (`KILL-005`)

- Unfiltered `chartStability` (Arm 2) fires `23.8` phantom zodiac/house alarms per 24 hours (`476` total across 20 episodes) with zero physical lighting change.
- Even after filtering strictly to `kind === "sect"` (Arm 3), `chartStability` still evaluates full multi-body charts across a finite-difference grid (`191.69 ms/24h`), catches only `80.6%` of apparent horizon crossings within `+/-5 min` (because classical ecliptic `isDayChart` ignores atmospheric refraction and high-latitude geometric dip), and misses civil twilight completely (`2.6%` catch).
- Direct analytic `sceneGeometry.diurnal.minutesToNextTwilight` (Arm 4) strictly dominates Arm 3: **`20.9x` lower CPU** (`9.15` vs `191.69 ms/24h`), **`100.0%` coverage** across all 4 physical cliffs (`0.00 min` median error), and **`54.8%` fewer wakeups** than Arm 3 (`-75.2%` vs fixed 30m polling).
- Archived to `lab/graveyard/KILL-005-chart-stability-step-control.md`.

## Reproducing

```bash
node lab/scripts/lab.mjs run EXP-010
```
