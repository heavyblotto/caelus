# Binary packs (CPK1)

Chebyshev packs account for most of the ephemeris data volume: each pack stores
piecewise polynomial coefficients for a body's heliocentric position (or
geocentric position for the Moon) across thousands to tens of thousands of time
segments. Stored as JSON, the seventeen planet, Earth, and Moon packs totaled
137 MB, largely because coefficients were serialized to 16 decimal digits even
though the underlying series is accurate to seven or eight digits.

CPK1 quantizes each coefficient as an integer multiple of a power-of-two quantum
well below the pack's fit residual. In CPK1 format, the seventeen packs total
27 MB on disk, with the largest single pack at 8.5 MB.

## Layout

All integers are little-endian.

| Bytes | Content |
|---|---|
| 0 to 3 | The magic `CPK1` |
| 4 to 7 | `H`, the header length in bytes, unsigned 32-bit |
| next `H` | The header, UTF-8 JSON |
| rest | The payload: `nch × ncoef` columns |

The header has `format` (`"caelus-pack"`), `version` (`1`), `jd0`,
`seg_days`, `scale`, `nseg`, `nch`, `ncoef`, `qexp`, `source_sha256` (the
SHA-256 of the JSON pack it was minted from), and the pack's `provenance`.

A column is one coefficient order of one channel across all segments. Columns
are ordered by channel, then by coefficient order. Each column is one byte
`w`, from 1 to 8, followed by `nseg` signed integers of `w` bytes each. The
integers are differences: the first is the value for segment 0, and each
later one is the change from the segment before. `w` is the smallest width
that holds the column's largest difference.

A coefficient is the running sum of its column multiplied by `2^qexp`.

## Why it decodes the same everywhere

The quantum is a power of two. Multiplying an integer below 2^53 by a power
of two is exact in binary floating point, so a decoded pack is the same list
of doubles in Python, in any JavaScript engine, and in any later port.
Decoding needs integer addition and that one scaling. It does not call a
power function, which runtimes are allowed to round differently; the
TypeScript decoder builds `2^qexp` by repeated halving.

`packbin-golden.test.ts` checks this: 300 coefficients from every pack must
equal the reference's with `===`, and each file's SHA-256 must match the
fixture.

## The quantum, and what it costs

For each pack the quantum is the largest power of two at or below the fit
residual divided by 256. The two Moon packs use 4096.

| Packs | Quantum relative to fit residual | Worst series error added |
|---|---|---|
| Planets and Earth, modern and classical | 1/256 or finer | 1.0% of the residual |
| Moon, modern and classical | 1/4096 or finer | 0.07% of the residual |

The Moon is stored finer because two derived points, the true node and the
osculating apogee, come from the Moon's velocity. Velocity is the derivative
of a degree-18 or degree-36 series, and differentiating amplifies coefficient
rounding. At 1/256 the true node moved 1.4″ on the golden grid; at 1/4096 it
moves 0.14″, against a stated accuracy of 1′.

Measured against the JSON packs on the golden grid, the planets move by at
most 0.0007″ and the Moon by 0.002″. Those shifts are far below the accuracy
table, and they are large enough to change a canonical digest on the
milliarcsecond grid, so digests computed from the Node data tier differ
between 0.25 and 0.26.

## Loading packs on demand

Browser and worker bundles include the embedded data tier by default.
`pack-loader.ts` loads full binary packs on demand for environments without
local filesystem access (browsers, Cloudflare Workers, or sandboxed Node).

`loadPacks(base, manifest, entries, fetchPack)` downloads the requested pack
files, verifies each file's size and SHA-256 digest against the manifest,
decodes them, and merges them into a copy of `base` matching the structure
returned by `loadNodeData`.
`selectPacks(manifest, { bodies, fromYear, toYear })` selects only the packs
needed for a query: the packs for the requested bodies, the corresponding Earth
packs (needed for geocentric positions of the Sun and planets), and only the
eras intersecting `[fromYear, toYear]`.

The manifest is JSON:

```json
{
  "format": "caelus-pack-manifest",
  "version": 1,
  "packs": [
    {
      "file": "cpk/saturn_cheb.classical.7212f6b250e7.cpk",
      "bytes": 63658,
      "sha256": "7212f6b250e7…",
      "body": "saturn",
      "era": "classical",
      "from": -3003,
      "to": 1000
    }
  ]
}
```

`body` is a planet id, `earth`, or `moon`. `era` is `modern` for a body's
default pack and the slab's name otherwise. `from` and `to` are the whole
astronomical years the pack covers.

The loader enforces three guarantees. It fetches only the entries explicitly
requested, and every entry must appear in the manifest with a plain relative
filename. Before decoding any data, it verifies both byte length and Web Crypto
SHA-256 checksum against the manifest and throws `PackIntegrityError` on any
mismatch. It has zero external dependencies.

`pack-loader.test.ts` verifies that valid packs load cleanly, that single-bit
mutations or truncated responses are rejected, that unrequested packs are never
fetched, and that an engine initialized with loaded packs matches `loadNodeData`
positions strictly (`===`) across 28 positions from 2500 BCE to 1990 CE. The same
verification passed inside Cloudflare `workerd`.

### Publishing

`scripts/build-pack-manifest.mjs` reads `packages/caelus/data/*.cpk` and
writes `apps/web/public/data/packs/`: `manifest.json`, and each pack under
`cpk/` with the first 12 hex digits of its SHA-256 in the name. The directory
is generated and gitignored, so the packs are in the repository once. Both
site builds serve `apps/web/public`, and both run the script as part of their
build.

A pack's URL changes when its bytes do, so both builds serve `cpk/` with
`Cache-Control: public, max-age=31536000, immutable`. The manifest keeps a
plain name and is revalidated. The 17 packs and the manifest add 27.4 MB to
each build's static output; the manifest is 4 KB.

### What a page downloads

Measured in the Sky Dating instrument, which loads the packs when its Data
control is set to the full packs:

| Search | Files | Download |
|---|---|---|
| Four planets, 800 BCE to 1 BCE | 5 | 4.2 MB |
| Seven bodies, 2999 BCE to 2998 CE | 14 | 27.2 MB |

With all 14 loaded, one Chromium tab's JavaScript heap grew from 29 MB to
163 MB. A decoded pack is nested arrays of doubles, which is what the engine
reads; a typed-array form would be smaller and is not built.

## Tools

- `python/pack_binary.py` mints `.cpk` files from JSON packs and reports the
  size and the rounding for each. `--check` decodes every pack on disk and
  confirms the two data directories hold the same bytes.
- `astroengine/packbin.py` is the reference encoder and decoder.
- `packbin.ts` exports `decodePack`, `decodePackHeader`, and `isBinaryPack`.
  `loadNodeData` prefers `{stem}.cpk` over `{stem}.json`.
- `pack-loader.ts` exports `loadPacks`, `fetchPacks`, `mergePacks`, and
  `selectPacks`, the verifying loader for hosts with no filesystem.
- `scripts/build-pack-manifest.mjs` publishes the packs and their manifest
  for the site.

The fit scripts still write JSON. After a refit, run `pack_binary.py` on the
new JSON and commit the `.cpk`; the JSON is an intermediate and is not kept
in the repository.

The small packs a browser imports directly (Chiron, the five asteroids, the
interpolated apogee, the embedded Moon) stay JSON, because a bundler handles
a JSON import and they total about 5 MB.
