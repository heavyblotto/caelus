# KILL-002: Synastry Swarm Role Routing and Tie-Breaking

- **ID**: `KILL-002`
- **Date Killed**: `2026-11-22`
- **Category**: Multi-Agent Orchestration / Task Routing
- **Verdict**: KILLED (broken by cohort correlation and element/modality skew; strictly dominated by `sha256`)

## Original Proposal

Assign swarm roles (such as red-team verifier vs. synthesizer) and break ties
between peer agents by computing `synastryAspects(agentGenesis, taskGenesis)`
and `synastryOverlays` between each agent's spawn timestamp and the task's
creation timestamp.

## Null Baseline That Won

Deterministic cryptographic hashing of agent and task identifiers:

```text
role_index = uint32(sha256(agentId || taskId)) mod N
```

## Measured Failure Mode

1. **1-week cohort correlation collapse (`r = 0.911`)**: Empirical measurements
   over Caelus's 10-body feature vectors (`research_notes/Chart based NPC
   behavior engine/`) show that charts created within the same week have a
   mean 10-body cosine similarity of **`r = 0.911`** because Mars through Pluto
   barely move over hours or days.
2. **Universal self-conjunction flooding**: Because agents and tasks spawned in
   the same session or week share outer-planet longitudes, `synastryAspects`
   produces near-0-degree self-conjunctions across every agent-task pair,
   swamping the aspect channel. Stripping slow bodies reduces the mechanism to
   hashing `delta_t mod 24h`.
3. **Structural distribution skew**: Measured `chartSignature` baselines show
   non-uniform element and modality frequencies (for example, **33% Fire** and
   **43% Cardinal** skew). Using signature or overlay buckets for load
   balancing or role selection introduces systematic routing bias.
4. **Latency and uniformity**: `sha256(agentId || taskId)` executes in
   microseconds, is cryptographically uniform across arbitrary team sizes, and
   stays invariant when an entire swarm launches in the same second.

## Revival Condition

Do not revive for deterministic agent/task assignment or load balancing.
Cross-epoch relational operators (`synastryAspects`, `cosineSimilarity`) remain
valid only for explicit astronomical similarity queries (`similar_skies`) or
trimmed physical-horizon comparison (`EXP-002` photoperiod matching).
