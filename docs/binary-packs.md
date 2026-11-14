# Binary packs (CPK1)

A Chebyshev pack is the engine's largest kind of data: a body's heliocentric
(or, for the Moon, geocentric) position as piecewise polynomials, a few
thousand to a few tens of thousands of segments each. As JSON, the seventeen
planet, Earth, and Moon packs were 137 MB, and most of those bytes were
decimal digits the fits cannot justify. A coefficient was printed to 16
digits; the series it belongs to is good to seven or eight.

CPK1 stores each coefficient as an integer multiple of a quantum that sits
well below the pack's own fit residual. The seventeen packs are 27 MB in this
form, and the largest is 8.5 MB. Three era packs minted since (Uranus,
Neptune, and Pluto for 3000 BCE to 1000 CE) add 0.4 MB.

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

A browser bundle carries the embedded tier. `pack-loader.ts` is the path from
there to the full packs for a host with no filesystem: a browser, a
Cloudflare Worker, or Node.

`loadPacks(base, manifest, entries, fetchPack)` fetches the packs it is
handed, checks each against the manifest, decodes it, and returns engine data
with the packs placed over `base` in the fields `loadNodeData` uses.
`selectPacks(manifest, { bodies, fromYear, toYear })` chooses the entries: the
packs of the bodies named, the Earth's for the Sun and for every planet, and
only the eras the years touch.

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

The loader keeps three promises. It fetches only the entries passed to it, and
each must be one the manifest lists, with a plain relative file name. It
compares a fetched file's length and its SHA-256, computed with Web Crypto,
against the manifest before decoding a byte, and rejects with
`PackIntegrityError` on a mismatch. It has no dependency.

`pack-loader.test.ts` checks that a matching pack loads, that one changed bit
and one missing byte are each refused, that nothing outside the request is
fetched, and that an engine on the loader's output returns the positions of
an engine on `loadNodeData` with `===`: 28 positions at four instants from
2500 BCE to 1990. The same call was run once inside workerd, where it
returned the Node loader's positions and refused an altered pack.

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
