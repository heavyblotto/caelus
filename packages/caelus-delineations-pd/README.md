# caelus-delineations-pd

A public-domain astrology **interpretation corpus** for the Caelus
interpretation layer, and the default validation set for any interpreter built
on it.

Caelus is an interpretation-free fact engine: it stops at validated geometry and
projects a chart into ranked, citable [fact atoms](../../docs/interpretation-layer.md).
The engine ships the *contract* (`interpret()`, selectors), never the *content*.
This package is content: public-domain delineations decomposed, working backward
from that contract, into `InterpretationSource`s you drop straight into
`interpret(ctx, sources)`.

## Use

```ts
import { Engine, julianDay, interpretationContext, interpret } from "caelus";
import { loadNodeData } from "caelus/node";
import { sources } from "caelus-delineations-pd";

const engine = new Engine(loadNodeData(dataDir));
const chart = engine.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");

const reading = interpret(interpretationContext(chart), sources);
// reading.entries: ranked, each citing the atom ids it rests on, tagged with
// its tradition and source work.
```

Also exported: `corpusManifest` (the source bibliography), `correspondences`
(a Liber 777 table), `passages` / `passageSets` (the raw records), and
`selectorFromSpec` / `compileSource` (the compiler) for building your own
sources.

## How it is built

The corpus is data, not hand-written code, so every claim stays traceable:

```
sources/text/*.txt          public-domain scans (manifest-driven fetch)
  -> scripts/extract/*.ts    parse enumerated delineations into PassageRecords
  -> data/passages/*.json    a passage + a serializable SelectorSpec + provenance
  -> src/compile.ts          SelectorSpec -> live Caelus Selector -> Rule
  -> src/sources.ts          one InterpretationSource per work  ->  `sources`
```

A `PassageRecord` names the fact it speaks to with a serializable `SelectorSpec`
(`placement` / `aspect` / `pattern` / `signature` / `angle`), so the corpus
ships as JSON and the binding to the engine is auditable. The atom-id and sign
strings it targets must match the engine's exact output (e.g. `"Aries"`, not
`"aries"`); `npm test` enforces this.

**Restore-only policy.** Extractors restore the author's printed words in the
cited edition. Layout cleanup (running heads, hyphenation, chapter furniture)
is necessary and not sufficient. OCR substitutions, split/joined words, and
unambiguous letter-spacing are fixed at extract time (`scripts/lib/restore.ts`).
Do not modernize, paraphrase, or invent. Period spelling (`shew`, `connexion`,
`nativity`) and Iyer's transliterations stay unless they are OCR of a known
printed form (`Roll ini` → `Rohini`). Unreadable scans are quarantined, not
guessed: Alan Leo *The Key to Your Own Nativity* (DLI djvu) is omitted from
`sources`. Heindel is taken from the Rosicrucian Fellowship HTML of *The
Message of the Stars*, not the Internet Archive djvu.

Scripts:

- `npm run fetch` — (re)acquire the source texts from the manifest.
- `npm run extract` — parse texts into `data/passages/*.json`.
- `npm run census` — quality flags and scores on every passage JSON file.
- `npm run build:correspondences` — rebuild the Liber 777 table.
- `npm run build` / `npm test` — compile, then validate the corpus.

## Validation

`npm test` (`test/validation.test.ts`) is what makes this a *validation set*. With
no ephemeris it proves every compiled rule binds to a legal atom, fires for its
condition and only that condition, and cites only atoms that exist (no invented
provenance); it then runs the corpus against a real engine projection end to end,
and audits the manifest for rights and text integrity. It also rejects chapter
bleed, unrestored OCR tokens, running heads, and a quality-score floor so
Key-level symbol salad cannot land again.

## Coverage

The fact model is finite and enumerable, so the target is *cell coverage*.
About 370 shipped passages across the wired sources (Alan Leo *Key* is
quarantined; Saint-Germain and George drop cells below the quality floor):

| Cell | Selector | Context required | Status |
|---|---|---|---|
| Planet in sign | `placement{ body, sign }` | bare chart | Alan Leo *Astrology for All* (Sun/Moon); Saint-Germain Sun-sign cells that restore; George *A to Z* remaining `gratis-not-pd` cells |
| Planet in house | `placement{ body, house }` | bare chart | Alan Leo *How to Judge* (~75). *Key* quarantined |
| Planet aspect planet | `aspect{ between, aspect }` | bare chart | Heindel (~138; 5 Ptolemaic aspects) |
| Rising sign | `angle{ asc, sign }` | bare chart | Heindel 12/12; Sepharial *Horoscope* 12/12 |
| Fixed-star conjunction | `star{ body, star }` | `opts.stars` (from `Engine.starConjunctions`) | Robson 20 (curated) |
| Planet parallel planet | `parallel{ a, b }` | bare chart | Heindel (~18; headings pairing "parallel or conjunction") |
| Out of bounds | `outOfBounds{ body }` | bare chart | selector ready; no corpus — the out-of-bounds reading postdates these public-domain sources |
| Moon in nakshatra | `nakshatra{ body, name }` | `opts.vedic.nakshatraBodies` on a sidereal chart | Brihat Jataka 27/27 (ch. XVI) |
| Dignities | `placement{ dignity }` | bare chart | Ptolemy Book I ch. XX/XXII (domicile, exaltation); Wilson s.v. exaltation, detriment, fall |
| Hermetic lots | `lot{ lot, sign, house }` | `opts.lots` (from `Engine.lots`) | selector ready; corpus pending |
| Reception / dispositor | `reception{ body, by }` / `dispositor{ body }` | bare chart | Wilson s.v. reception; Lilly dispositor still pending |
| Transit / synastry / composite / time-lord / varga / yoga | `transit{}` `synastry{}` `composite{}` `timelord{}` `varga{}` `yoga{}` | caller-supplied via `ContextOptions` | selectors ready; no PD source in the set delineates these cells |

Sun/Moon-in-sign, houses, aspects, and rising cells are public domain. Mercury–
Saturn (and outer-planet) sign cells that still ship from Llewellyn George's
*A to Z* are tagged `gratis-not-pd` (1910 doctrine from a 1960 reprint scan)
and isolated in their own source. Import `publicDomainSources` instead of
`sources` to drop them. Evangeline Adams, *Astrology: Your Place Among the
Stars* (Dodd, Mead, 1930; US PD as of 2026-01-01) is the spelled-out
planet-in-sign replacement to evaluate next — use a 1930 printing (IAPSOP),
not the 2002 Weiser reset. The IAPSOP PDF text layer is still too noisy to
ingest in this pass.

The `lot` selector compiles, but no public-domain source in the set delineates
the Part of Fortune by house or sign (Sepharial: it "has no qualities of its
own"; Pearce likewise dismisses natal Fortune), so there are no lot rules yet.
The lot atom is still useful on its own: fed via `Engine.lots(chart)`, it
enriches the fact projection an LLM brief or the MCP `chart_facts` tool reads.

Fixed-star rules need `star` atoms, which the bare projection cannot compute
(the catalog lives in the data pack). Supply them when projecting:

```ts
const stars = engine.starConjunctions(chart, { orb: 1 });
const reading = interpret(interpretationContext(chart, { stars }), sources);
```

The Robson star set is **hand-curated** from his documented attributions: his
scan's star catalog is a garbled OCR table, so unlike every other source these
records are transcribed, not auto-extracted (`data/passages/robson-stars.json`).

Coverage is partial by design: an extractor emits only the cells it can lift
cleanly from the OCR, and the harness reports the rest. Known gaps and why:

- **Vedic** (Brihat Jataka): most of the translation is verse/sloka-structured
  with no "planet in rashi" headings, so it needs a verse-level parser, not
  heading extraction. The exception is Chapter XVI (Moon in the asterisms),
  which is regular prose and is extracted in full
  (`scripts/extract/brihat-nakshatras.ts`, 27/27 with an OCR alias table for
  the garbled names). Text is vendored.
- **Varga, yoga, dasha, dignity-facet, time-lord cells**: the
  engine side is done — `FactKind` covers all seventeen atom kinds (`star`,
  `lot`, `varga`, `yoga`, `timelord`, `dignity`, `reception`, and the rest),
  and each has a live selector in `caelus`. Essential-dignity prose from
  Ptolemy and Wilson is extracted; a hand Lilly set can still land later.
  What remains is corpus-side for the other cells (the Vedic sources need the
  verse-level parser above; Robson's star catalog was rescued by hand-curation).

## Corpus and licensing

`sources/manifest.json` is the bibliography; `rights` is one of `pd-us`, `cc0`,
`gratis-not-pd`. Each text carries a `status`; `needs-refetch` flags a file the
fetch pipeline captured corrupt (an HTML wrapper) or only partially, awaiting a
clean re-acquisition. The `data/correspondences.json` table is derived from the
[open_777](https://github.com/adamblvck/open_777) transcription of Crowley's
(public-domain) Liber 777 and attributed in `derivedFrom`.

Verify rights before relying on any entry: a "public-domain scan" is only PD for
the specific *edition/translation* cited (e.g. Ptolemy here is Ashmand 1822, not
the in-copyright Robbins 1940). One source — Llewellyn George's *A to Z* — is
vendored as `gratis-not-pd` (the available scan is a 1960 reprint of unconfirmed
status); use `publicDomainSources` to omit those rules. The full source texts are
vendored to the repo but **not** published to npm; only the manifest, compiled
passages, and correspondence data ship.

MIT (this package's code and data wiring; the source texts are public domain).
