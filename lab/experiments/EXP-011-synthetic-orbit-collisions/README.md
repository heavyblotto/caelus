# EXP-011: Synthetic Orbital Task-Space (`synthetic.ts` + `when()`) vs. Direct `riseSet` Modulo Interval Intersection

Empirically tests the trimmed frontier proposal in `caelus_agent_chronosense.md` Section 3 ("Registering internal agent rhythms as virtual `periodic` bodies in `synthetic.ts` inside the real Earth-sky `Engine` so `when()` detects collisions with human local sunset/night").

## Experimental Design

- **30 deterministic 28-day scenarios** (`5` cities: Oslo, New York, Singapore, Sydney, Tromso x `2` seasons: June and December 2026 x `3` agent rhythms):
  - `ci_cadence`: `periodDays = 0.25` (6h cycle, 60m deadline window)
  - `daily_standup`: `periodDays = 1.0` (24h cycle, 120m deadline window)
  - `sprint_release`: `periodDays = 14.0` (14d cycle, 12h deadline window)
- **Independent Ground Truth**: 5-minute solar-altitude bracketing + 32-step bisection on apparent solar altitude `< 0 deg` intersected with exact modular task windows (`787` total collision events).
- **3 Arms**:
  1. `Arm1-Synthetic-Engine-When`: `registerSyntheticSystem(engine, sys)` + `when(engine, allOf(aspect(taskId, "conjunction", 0, halfOrb), localNight))`.
  2. `Arm2-WorldFrame-Synthetic-When`: parallax-free `syntheticEphemeris(sys)` world-frame longitudes + `when()`.
  3. `Arm3-Direct-RiseSet-Modulo`: direct `riseSet("sun", ..., { discCenter: true })` (computed once per city-season) intersected analytically with closed-form modular task windows.

## Measured Results (`results.json`)

### 1. Heliocentric Kepler `a = P^(2/3)` Earth-Parallax Distortion on `registerSyntheticSystem`

| Task Rhythm | Period (d) | Kepler Radius `a` (AU) | Orbital Regime vs Earth (1 AU) | Max Geocentric Phase Error | Equivalent Timing Drift | Max Elongation from Sun |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| `ci_cadence` | 0.25 | 0.3969 | Inside Earth orbit (trapped) | 179.80 deg | 179.8 min | 23.04 deg |
| `daily_standup` | 1.00 | 1.0000 | Co-orbital 1 AU singularity | 170.36 deg | 681.4 min | 80.30 deg |
| `sprint_release` | 14.00 | 5.8088 | Outer annual parallax | 10.52 deg | 589.2 min | 179.48 deg |

### 2. 3-Arm Collision Detection Benchmark (`787` Ground-Truth Collisions)

| Arm | TP | FP | FN | Event Precision | Event Recall | Event F1 | Overlap Time F1 | Median Err (min) | Total CPU (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Arm1-Synthetic-Engine-When` | 12 | 143 | 775 | 0.0774 | 0.0152 | **0.0255** | 0.0460 | 236.55 | 2,027.4 |
| `Arm2-WorldFrame-Synthetic-When` | 785 | 0 | 2 | 1.0000 | 0.9975 | 0.9987 | 0.9992 | 0.0002 | 2,214.4 |
| `Arm3-Direct-RiseSet-Modulo` | **787** | **0** | **0** | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **0.0000** | **711.8** |

## Disposition: KILLED (`KILL-006`)

- `registerSyntheticSystem` (`packages/caelus/src/synthetic.ts`) sets a `periodic` body's heliocentric radius via Kepler's third law (`a = periodDays^(2/3)` AU) and views it from Earth at `1 AU`. Any sub-annual agent task rhythm (`P = 0.25d`, `1d`, `14d`) suffers severe Earth-orbit parallax or inner-orbit trapping, driving `Arm1` to **`F1 = 0.0255`** (`0.0000` on `ci_cadence` and `daily_standup`; `236.5 min` median error on `sprint_release`).
- Even bypassing Earth parallax via `syntheticEphemeris` world-frame longitudes (`Arm2`) yields zero accuracy gain (`F1 = 0.9987`, missing 2 grazing windows narrower than `when()`'s scan step) while running **`3.11x` slower** (`2,214.4 ms` vs `711.8 ms`) than direct `riseSet("sun")` + modular interval intersection (`Arm3`, `F1 = 1.0000`).
- Archived to `lab/graveyard/KILL-006-synthetic-orbit-task-space.md`.

## Reproducing

```bash
node lab/scripts/lab.mjs run EXP-011
```
