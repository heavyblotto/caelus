# memorativa

Arithmology computation in TypeScript: theosophical arithmetic,
neutralization operators, the seven planetary kameas with sigil tracing,
gematria with notarikon and temurah, and lambdoma ratio tables. Pure
functions with golden tests. MIT.

Memorativa is a peer of the `caelus` engine. Caelus computes the sky;
Memorativa computes the numbers. The package supplies computation only:
structure and provenance live in the knowledge base, and interpretation
lives with the writer.

## Verification

The golden tests pin public-domain printed tables. The seven kamea grids
and their magic constants come from Agrippa, "Three Books of Occult
Philosophy" (J.F., 1651), Book II ch. XXII, and the letter values from
chapters XVIII to XX of the same printing. The chapter's divine-name table
doubles as a cross-check: the names' Hebrew gematria equals the kamea
constants they are set over. Rows where the printed value disagrees with
the printed Hebrew are asserted at the computed value and documented in
`test/gematria-golden.test.ts`.

Oracles derived from in-copyright scans (Skinner, encausse-01, godwin-02,
guthrie-02, the tarot shelf) stay in the private store as hash-pinned
fixtures and are not part of this package.

## Usage

```bash
npm install memorativa
```

```ts
import {
  theosophicalReduce,
  theosophicalAdd,
  neutralize,
  kamea,
  sigilTrace,
  gematria,
  notarikon,
  atbash,
  albam,
  lambdoma,
  VERSION,
} from "memorativa";

// Theosophical arithmetic (Papus, public domain)
theosophicalReduce(365); // 5
theosophicalAdd(4);      // 10 (the tetraktys)
neutralize(1, 2);        // 3

// The seven kameas (Agrippa, Book II ch. XXII)
const saturn = kamea("saturn");
saturn.grid;          // [[4, 9, 2], [3, 5, 7], [8, 1, 6]]
saturn.magicConstant; // 15
saturn.total;         // 45

// Sigil tracing: a name's letters locate cells across the square
const steps = sigilTrace("אגיאל", "hebrew", "saturn");
steps.map((s) => s.reduced); // [1, 3, 1, 1, 3]

// Gematria across the systems
gematria("אלים", "hebrew").total;          // 81
gematria("αβγω", "greek-isopsephy").total; // 806
gematria("AGRIPPA", "latin-agrippa").total; // 218

// Notarikon and temurah
notarikon("Atah Gibor Le-olam Adonai"); // "AGLA"
atbash("בבל");                          // "ששך" (Jeremiah 25:26)
albam("א");                             // "ל"

// The lambdoma ratio table
const table = lambdoma(4);
table[2][1]; // { p: 3, q: 2 } (the fifth)
```

## Letter systems

| System | Source | Notes |
| ------ | ------ | ----- |
| `hebrew` | Agrippa, Book II ch. XIX | 22 letters; finals count at base values, the convention of the ch. XXII name tables |
| `hebrew-finals` | Agrippa, Book II ch. XIX | the five finals at 500 to 900, the numeral-mark table |
| `greek-isopsephy` | Agrippa, Book II ch. XVIII | three classes with digamma 6, koppa 90, sampi 900 |
| `greek-ordinal` | Agrippa, Book II ch. XVIII | alphabet place, alpha 1 to omega 24 |
| `latin-agrippa` | Agrippa, Book II ch. XX | the 27-place Roman table; J is 600, U is 700, W unvalued |

## Version stamp

`VERSION` is a runtime export equal to the package version, asserted by the
repository's version gate. Consumers that stamp computed figures (the
Encyclopedia's numerical plates) read it without importing package metadata
into browser bundles.
