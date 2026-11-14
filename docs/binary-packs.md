# Binary packs (CPK1)

A Chebyshev pack is the engine's largest kind of data: a body's heliocentric
(or, for the Moon, geocentric) position as piecewise polynomials, a few
thousand to a few tens of thousands of segments each. As JSON, the seventeen
planet, Earth, and Moon packs were 137 MB, and most of those bytes were
decimal digits the fits cannot justify. A coefficient was printed to 16
digits; the series it belongs to is good to seven or eight.

CPK1 stores each coefficient as an integer multiple of a quantum that sits
well below the pack's own fit residual. The seventeen packs are 27 MB in this
form, and the largest is 8.5 MB.

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

## Tools

- `python/pack_binary.py` mints `.cpk` files from JSON packs and reports the
  size and the rounding for each. `--check` decodes every pack on disk and
  confirms the two data directories hold the same bytes.
- `astroengine/packbin.py` is the reference encoder and decoder.
- `packbin.ts` exports `decodePack`, `decodePackHeader`, and `isBinaryPack`.
  `loadNodeData` prefers `{stem}.cpk` over `{stem}.json`.

The fit scripts still write JSON. After a refit, run `pack_binary.py` on the
new JSON and commit the `.cpk`; the JSON is an intermediate and is not kept
in the repository.

The small packs a browser imports directly (Chiron, the five asteroids, the
interpolated apogee, the embedded Moon) stay JSON, because a bundler handles
a JSON import and they total about 5 MB.
