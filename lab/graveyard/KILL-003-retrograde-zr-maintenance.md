# KILL-003: Retrograde Duty Cycles and Zodiacal Releasing Maintenance

- **ID**: `KILL-003`
- **Date Killed**: `2026-11-22`
- **Category**: Autonomous Daemon Scheduling / Compaction
- **Verdict**: KILLED (wrong timescales and wrong trigger signal)

## Original Proposal

Gate autonomous daemon maintenance (halting forward code commits to force
refactoring, memory compaction, or audit sweeps) on planetary retrograde
windows (such as Mercury retrograde via `events.stations`) or Hellenistic
Zodiacal Releasing transitions (`zrActive` / loosing of the bond `lb` in
`packages/caelus/src/releasing.ts`).

## Null Baseline That Won

State-driven triggers combined with local wall-clock nocturnal windows:
- Context utilization threshold (for example, compact when context reaches
  75% of budget)
- Error-rate or test-failure drift triggers
- Local human nocturnal window computed from real solar twilight
  (`sceneGeometry` / `isDayChart`) or jittered cron intervals

## Analytical Failure Mode

1. **Severe timescale mismatch**: Mercury retrograde halts forward activity for
   roughly **21 days** every **~4 months** (about 116-day synodic cycle).
   Zodiacal Releasing Level 1 and Level 2 periods span **years to decades**
   (5 to 30 years per L1 sign period). Neither timescale aligns with software
   build cycles, context-window compaction, or daily agent workloads.
2. **Decoupled from system health**: A daemon whose context window fills up or
   whose error rate spikes cannot wait 90 days for a planetary station to
   compact memory or audit regressions. Conversely, freezing healthy
   deployments for three weeks on an arbitrary synodic calendar degrades
   throughput with zero engineering benefit.

## Revival Condition

None for software maintenance scheduling. When an agent genuinely needs
maintenance aligned with its human counterpart's downtime, use Caelus's real
local solar horizon (`sun.altitudeApparentDeg`, `twilightStage`, `diurnal`) so
background batch work runs during the human's actual local night rather than an
unrelated planetary synodic period.
