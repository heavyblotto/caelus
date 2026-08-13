# Canonical mode

Integer, hashable, precision-honest output — for users who want the same
bytes every time, everywhere.

## What it fixes (and what was never broken)

The engine is already deterministic run-to-run: identical inputs give
bit-identical doubles on one machine. Floating point's real gaps are
subtler, and canonical mode closes all three:

1. **Cross-platform bit-stability.** IEEE 754 pins arithmetic but not the
   transcendentals, so `sin` in V8, JSC, and Python's libm can differ in the
   last ulp. Invisible astrologically; fatal for hashing.
2. **Serialization stability.** Float JSON repr differs across languages;
   seventeen-digit tails make brittle cache keys and signatures.
3. **Boundary coherence.** A longitude one ulp from a sign cusp can flip a
   sign, a house, or an aspect at its orb limit between platforms.

## The three commitments

- **One rounding rule.** Round half toward +infinity
  (`floor(x·scale + 0.5)`, IEEE-guarded), identical in TypeScript and
  Python. Ties round up everywhere, which is also the discrete tie-break: a
  longitude exactly on a sign or house boundary belongs to the **later**
  sign/house; a quantized speed of exactly 0 is direct, not retrograde.
- **Quantize, then derive.** Sign, sign-degree, house, dignities,
  retrograde, and the aspect list are recomputed from the quantized values
  in integer arithmetic — displayed numbers and derived facts cannot
  disagree, by construction.
- **Floats cannot leak.** The canonical encoding (sorted keys, no
  whitespace) throws on any non-integer number, so a digest over a canonical
  value proves the whole payload was quantized.

## Grids

| Grid | Angle unit | Note |
|---|---|---|
| `arcsec` (default) | arcseconds | 360° = 1,296,000 — safe integer range, no BigInt |
| `milliarcsec` | milliarcseconds | finer than any validated accuracy; for diffing |
| `centideg` | 0.01° | compact, human-scannable |
| `dms` | `[deg, min, sec]` triples | the tradition's own base-60 integer form |
| `accuracy` | arcsec, snapped per body | each body quantized no finer than its **measured** accuracy (accuracy.json) — "validated, not asserted" applied to the output format, and the most portable choice for content addressing |

Speeds share the grid per day; distances are micro-AU; instants are integer
milliseconds since J2000.0; aspect strength is per-mille. The `units` block
inside every canonical payload states all of this, and is bound into the
digest.

## Digests

`chartDigest(chart, opts)` = sha256 over the canonical encoding (sha256 is
implemented dependency-free, so the browser tier works). Equal digests mean
equal charts at the grid's resolution — across machines, browsers, and
languages. Uses: cache keys, dedupe, provenance receipts ("this reading was
computed from chart `a3f9…`"), and the engine's own cross-language check:
`canonical-golden` is the one **tolerance-free** golden — 2,185 comparisons,
every one `===`, TS digests equal to Python digests byte for byte.

Honesty note: digest equality holds wherever the two engines' float outputs
agree to well under half a quantum, which the conformance suite enforces
(≤3.6 milliarcseconds body error vs a 1″ default quantum). A value can in
principle land within libm drift of a grid boundary on some third platform;
the `accuracy` grid makes that probability negligible (its quanta exceed
the drift by orders of magnitude), which is why it is the recommended grid
for cross-platform content addressing.

## Remainder sets

Quantization discards a sub-quantum residue at every leaf; the optional
**remainder set** keeps it — residual coding, with the canonical payload as
the base layer and the sidecar as the enhancement layer. Two modes:

- **Refinement (default).** Each residue is an *integer* in sub-quanta of a
  finer grid (one step finer than the base unless you name one), so the
  sidecar is itself canonical — encodable, digestable, float-free — and
  grids **telescope**: `composeRemainders(payload, remainders)` rebuilds the
  finer-grid payload *exactly*, discrete facts re-derived and all
  (`compose(arcsec chart, residues) === canonicalChart(chart,
  "milliarcsec")`, pinned by the canonical-golden). Time residues are always
  integer microseconds and distance residues integer nano-AU — both payloads
  carry ms / micro-AU regardless of grid, so those two are pure precision
  escrow.
- **Bits (opt-in, engine-API-only).** The pre-quantization IEEE 754 double
  of every leaf, big-endian hex. Truly lossless — but the bits are
  per-platform artifacts (libm drift lives exactly here), so bits mode is a
  local archival and forensics tool, never a cross-platform contract, and it
  is not exposed over MCP.

The **frontier** — which leaves carry residues — is precisely the set of
independently quantized scalars: body lon/lat/speed/latSpeed/dist/ra/dec,
the four angles, the twelve cusps, and `timeMs`. Derived integers (sign,
house, dignities, retrograde, the whole aspect block) are exact functions of
the frontier and carry no residue by construction. Zero residues are kept,
so completeness is checkable.

Three invariants: requesting remainders never changes a byte of the base
payload; the sidecar binds to it via `for` (the payload digest —
`composeRemainders` refuses a mismatch); and angle residues are the signed
*modular* shortest distance, so a longitude at the 360° wrap stays small.

`nearBoundary(remainders)` turns the sidecar into a fragility report: leaves
whose value landed within a stated margin of a base-grid rounding boundary —
the exact places where sub-quantum drift on another platform could flip a
quantized leaf, and with it a sign, a house, an aspect at its orb limit, or
the digest itself. Pure integer arithmetic; `marginPerMille: 0` means dead
on a boundary.

Honesty note, amplified: the sidecar is *definitionally* where cross-platform
drift lives. TS and Python remainder sets match today because conformance
holds to ≤3.6 mas; a bits sidecar differs across platforms by construction.
Base payload = the portable contract; remainder set = precision escrow,
portable only down to where the engines demonstrably agree.

## Engine API

```ts
import { canonicalChart, chartDigest, canonicalDigest,
         canonicalTimeMs, canonicalTimesMs, quantizeUnit,
         canonicalChartWithRemainders, composeRemainders, nearBoundary,
         doubleBitsHex, doubleFromBitsHex } from "caelus";

const cc = canonicalChart(chart);                 // integers, arcsec grid
const id = chartDigest(chart, { grid: "accuracy" });
canonicalTimesMs(eventJds);                       // derived surfaces: ms ints

const { payload, remainders } =
  canonicalChartWithRemainders(chart);            // + milliarcsec residues
composeRemainders(payload, remainders);           // === the mas payload
nearBoundary(remainders);                         // fragility report
canonicalChartWithRemainders(chart, { remainder: "bits" }); // exact doubles
```

Pass the same `orbs`/`aspects`/`separation` options the chart was computed
with so the re-derived aspect list matches intent (`composeRemainders` takes
them too, for the same reason).

## Over MCP

`natal_chart`, `current_sky`, `returns`, and `parans` accept
`output: "canonical"` (plus `grid` where a chart is involved). The payload
is the canonical body plus its `digest`; `verify_tools` pins that the MCP
digest equals the engine's own `chartDigest`, that no float appears
anywhere in the payload, and that the digest is stable across calls.
Other derived tools canonicalize the same way through the exported helpers
(`canonicalTimeMs`, `quantizeUnit`).

The chart tools also take `remainders: "auto" | "arcsec" | "milliarcsec"`
(refinement residues only — bits mode never crosses MCP). The sidecar rides
beside the digest, outside the digested body; on `returns` it is lifted to
the top level and binds to `chart.digest`. `verify_tools` pins the additive
property (same digest with and without the sidecar), the digest binding,
integer-only residues within half a quantum, and the telescoping equality
against a direct finer-grid call.

## Mirrors

`python/astroengine/canonical.py` mirrors the TS module function for
function — remainder machinery included (`canonical_chart_with_remainders`,
`compose_remainders`, `near_boundary`, `double_bits_hex`) — and
`python/astroengine/ranges.py` mirrors the chart-warning text generation so
validity statements digest identically. Regenerate the fixture with
`python3 python/export_canonical_golden.py`.
