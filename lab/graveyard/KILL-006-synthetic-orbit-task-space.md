# KILL-006: Synthetic Orbital Task-Space (`synthetic.ts` + `when()`) for Agent Deadline Scheduling

- **ID**: `KILL-006`
- **Date Killed**: `2026-11-22`
- **Category**: Agent Task Scheduling / Deadline-Horizon Collision Detection (`EXP-011`)
- **Verdict**: KILLED (catastrophic Earth-parallax failure `F1 = 0.0255` via `registerSyntheticSystem`, and parallax-free `when()` is `3.11x` slower than direct `riseSet` + modulo arithmetic with zero accuracy gain)

## Original Proposal

Register internal agent rhythms (6h CI cadences, 24h standups, 14d sprint deadlines) as virtual `periodic` bodies via `registerSyntheticSystem` (`packages/caelus/src/synthetic.ts`) inside the real Earth-sky `Engine`, then invoke `when()` (`packages/caelus/src/query.ts`) to detect collisions between internal task deadlines and the human counterpart's local physical sunset/night.

## Null / Direct-Physics Baseline That Won

Direct `riseSet(engine, "sun", ..., { discCenter: true })` night interval generation (computed once per city-window) intersected analytically in `O(N + M)` time with closed-form modular task windows `k * periodDays + [-W/2, +W/2]`.

## Measured Failure Mode (`lab/experiments/EXP-011-synthetic-orbit-collisions/results.json`)

Measured across `30` deterministic 28-day scenarios (`5` latitudes x `2` seasons x `3` task periods: `0.25d`, `1.0d`, `14.0d`; `787` independent ground-truth night-collision events):

1. **Kepler `a = P^(2/3)` Earth-parallax catastrophe (`Arm1-Synthetic-Engine-When`)**: `synthetic.ts` places `mode: "periodic"` bodies on heliocentric circular orbits of radius `a = periodDays^(2/3)` AU (`packages/caelus/src/synthetic.ts:181`), and `registerSyntheticSystem` views them from real Earth at `1 AU`:
   - `ci_cadence` (`0.25d`): sits at **`0.3969 AU`** inside Earth's orbit, trapped within **`23.04 deg`** of the Sun and never completing a geocentric cycle (`F1 = 0.0000`, `0/592` recall).
   - `daily_standup` (`1.0d`): sits at **`1.0000 AU`** co-orbital with Earth, causing discontinuous parallax jumps (`F1 = 0.0000`, `0/173` recall, `138` false positives).
   - `sprint_release` (`14.0d`): sits at **`5.8088 AU`**, suffering **`+/-10.52 deg`** (`589.2 min` = `9.8 h`) annual Earth-orbit parallax (`F1 = 0.6154`, `236.5 min` median boundary error).
   - Combined `Arm1` score: **`F1 = 0.0255`**, overlap-time **`F1 = 0.0460`**, `2,027.4 ms`.
2. **Zero accuracy advantage and `3.11x` slowdown even without Earth parallax (`Arm2-WorldFrame-Synthetic-When`)**: Bypassing `Engine` via `syntheticEphemeris` world-frame longitudes inside `when()` reaches `F1 = 0.9987` (`2` missed grazing collisions narrower than `when()`'s scan step) in **`2,214.4 ms`**, whereas direct `riseSet("sun")` + modulo intersection (`Arm3`) achieves **`F1 = 1.0000`** (`787/787` TP, `0` FP, `0` FN, `0.0000 min` boundary error) in **`711.8 ms`** (**`3.11x` faster**).

## Revival Condition

Do not revive `synthetic.ts` orbital injection for software deadline or cron-vs-sunset collision scheduling. `synthetic.ts` belongs to authored fictional/game world-frame sky mechanics (`syntheticPositions`, `skyViewSequence`), and `when()` belongs to multi-body astronomical configuration queries where closed-form interval endpoints do not exist. For deadline-vs-night scheduling, compute `riseSet("sun")` once per location window and intersect modular deadline intervals directly.
