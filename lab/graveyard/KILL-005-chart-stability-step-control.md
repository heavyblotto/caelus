# KILL-005: Adaptive Cognitive Step-Size via `chartStability`

- **ID**: `KILL-005`
- **Date Killed**: `2026-11-22`
- **Category**: Agent Scheduling / Adaptive Sleep Control (`EXP-010`)
- **Verdict**: KILLED (strictly dominated by direct `sceneGeometry.diurnal.minutesToNextTwilight` by `20.9x` CPU, `+59.5 pp` cliff coverage, and `-54.8%` wakeups)

## Original Proposal

Run `chartStability` (`packages/caelus/src/stability.ts`) on a rolling forward window (`+/-30 min`) as an adaptive Runge-Kutta-style step-size controller for agent sleep intervals, stretching wakeups during stable periods and tightening around circadian regime cliffs (`sect` flips).

## Null / Direct-Physics Baseline That Won

Direct analytic next-boundary jump scheduling using `sceneGeometry(engine, t, lat, lon).diurnal.minutesToNextTwilight` (`packages/caelus/src/observe.ts`), which computes exact upcoming `sunrise`, `sunset`, `civil_dawn`, and `civil_dusk` transitions in `< 1 ms` without finite-difference chart sweeps.

## Measured Failure Mode (`lab/experiments/EXP-010-adaptive-step-stability/results.json`)

Measured across `20` deterministic 24-hour episodes (`5` latitudes x `4` seasons, `74` ground-truth physical sunrise/sunset/civil-twilight cliffs):

1. **Phantom zodiac/house cliff flooding (unfiltered `Arm2`)**: Reacting to all `chartStability` facts triggers **`23.8` phantom alarms per 24h** (`476` false wakeups across 20 episodes) from non-physical `angle_sign`, `sign`, `house`, and `aspect` boundary crossings, consuming **`308.1 ms/24h`** (`38.6` wakeups/24h) while catching only `43.2%` of all physical cliffs.
2. **Incomplete physical cliff coverage and high CPU (sect-only `Arm3`)**: Filtering strictly to `kind === "sect"` eliminates phantom alarms, but still evaluates full multi-body charts across a finite-difference grid (**`191.69 ms/24h`**, `26.35` wakeups/24h), catches only **`80.6%`** of apparent sunrise/sunset cliffs within `+/-5 min` (because classical ecliptic `isDayChart` omits atmospheric refraction and high-latitude geometric dip), and misses civil dawn/dusk almost completely (**`2.6%`** civil twilight catch -> **`40.5%`** overall cliff catch).
3. **Strict dominance by direct `sceneGeometry` (`Arm4`)**: Sleeping directly to `min(180m, diurnal.minutesToNextTwilight)` catches **`100.0%`** of all 4 physical cliff classes (`0.00 min` median timing error) in **`11.9` wakeups/24h** (`-75.2%` vs 30-min fixed polling, `-54.8%` vs `Arm3`) and **`9.15 ms/24h`** (**`20.9x` faster** than `Arm3`).

## Revival Condition

Do not revive `chartStability` for circadian sleep-step scheduling. `chartStability` remains the right tool for its designed purpose: epistemic uncertainty analysis of discrete chart claims under uncertain timestamps or historical `Delta-T` intervals (Workbench Instrument I-02). For agent adaptive sleep control around human lighting/twilight transitions, use `sceneGeometry.diurnal.minutesToNextTwilight` directly.
