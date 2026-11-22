# KILL-004: Void-of-Course Execution Freezes and Parans Latitude Sharding

- **ID**: `KILL-004`
- **Date Killed**: `2026-11-22`
- **Category**: Execution Gating and Distributed Fleet Sharding
- **Verdict**: KILLED (operationally harmful lockouts and wrong sharding axis)

## Original Proposal

1. Freeze external tool mutations (deployments, writes, API calls) whenever
   `voidOfCourse` (`packages/caelus/src/electional.ts`) reports a Void-of-Course
   Moon.
2. Shard distributed agent fleets across latitude bands using fixed-star
   co-angularity (`packages/caelus/src/parans.ts`).

## Null Baseline That Won

- For execution gating: real circuit breakers, rate limits, human approval
  gates, and explicit maintenance windows.
- For fleet sharding: network-latency routing (anycast/RTT) and geographic
  **longitude** sharding (follow-the-sun regional handoffs matching local
  daytime load).

## Measured Failure Mode

1. **Destructive Void-of-Course lockout rate**: Measured Caelus statistics show
   the Moon is Void-of-Course **24.3% of the time**, with a median lockout
   duration of **14.2 hours** (and occasional spans exceeding 24 hours).
   Halting external mutations for half a day nearly a quarter of the calendar
   breaks production agents and SLA-bound workflows with no causal correlation
   to system reliability.
2. **Wrong geometric axis for distributed systems**: `parans` depend strongly
   on observer **latitude** because stellar rising/setting arcs vary by
   declination and latitude. Distributed compute fleets, however, partition by
   network topology (RTT/region) and **longitude** (solar time zones for
   follow-the-sun human traffic and energy/cooling schedules), not by shared
   latitude bands across oceans.

## Revival Condition

None for mutation lockouts or generic compute sharding. `voidOfCourse` and
`parans` remain valuable as validated, oracle-pinned astronomical/traditional
engine primitives and MCP tools for users explicitly querying those techniques;
they are not operational control-plane primitives for agent infrastructure.
