# KILL-001: Secret-Asteroid Spacetime TOTP

- **ID**: `KILL-001`
- **Date Killed**: `2026-11-22`
- **Category**: Security / Authentication (Poetic Reskinning)
- **Verdict**: KILLED (strictly dominated by `HMAC-SHA256`)

## Original Proposal

Use a shared secret subset of 5 minted numbered asteroids (loaded via
`packages/caelus/src/minted.ts` `.cpk` binary packs) plus `chartDigest` to
derive spacetime-bound one-time passcodes (TOTP) between two air-gapped agent
nodes.

## Null Baseline That Won

Standard keyed hash over quantized time and coordinates:

```text
HMAC-SHA256(k_256bit, floor(Date.now() / W) || round(lat, 2) || round(lon, 2))
```

## Measured / Analytical Failure Mode

1. **Inferior keyspace entropy**: Choosing 5 secret asteroids out of roughly
   `6 x 10^5` numbered minor planets yields `C(6e5, 5) ~ 6.48 x 10^26`, which
   is approximately **89 bits** of entropy. A standard 32-byte symmetric key
   for `HMAC-SHA256` provides **256 bits** of cryptographic security.
2. **Unnecessary payload overhead**: Both air-gapped nodes must already perform
   an out-of-band secret exchange to agree on the asteroid IDs and carry five
   `.cpk` binary ephemeris packs. Exchanging a 32-byte key requires zero pack
   bytes and zero ephemeris evaluation.
3. **Operational desync risk**: Continuous ecliptic positions crossing sign or
   degree quantization buckets (`nearBoundary` flags in `canonicalChart`) create
   edge-case code mismatches under minor clock jitter or coordinate rounding
   that standard TOTP window skew tolerance handles cleanly without astronomy.

## Revival Condition

None for symmetric authentication. Any future spacetime-attestation work must
rely on unforgeable *external physical observation* (such as `observe.ts`
verifying real camera shadows, solar altitude, and lunar orientation against a
claimed timestamp and location), never on hiding publicly catalogued orbital
elements as a secret key.
