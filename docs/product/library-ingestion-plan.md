# Library ingestion plan

2026-08-20

The maintainer scans the private library cataloged in
`docs/product/library.csv` (about 365 titles), and the OCR text feeds
four consumers: the Encyclopedia (citations and evidence packs), the
corpus (research for the write loop and its reviewers), `caelus-kb`
(source nodes, attested curated data, correspondence tables), and the
Memorativa engine (golden-test oracles for the numerical tables). This
document describes the pipeline: capture, OCR, the QA harness, storage,
and the consumer wiring.

`caelus-delineations-pd` is unchanged. That package is public-domain
text shipped on npm. The library is a private research store with its
own pipeline, and no scanned text enters the public repo.

---

## Rights boundary

Most of the library is in copyright: Hand, George, Brennan, Sasportas,
Tarnas, the Purdue Agrippa (2021), the Attrell and Porreca Picatrix
(2019), Copenhaver's Hermetica (1995). The design follows from that:

- Page images, OCR text, and vectors live in a private store outside
  the public repo (or gitignored within it).
- Committed artifacts are bibliographic metadata, QA scores, and
  citations.
- The corpus remains original prose. The library supplies the write
  loop's research step, which today runs on model memory.
- The Encyclopedia cites with page numbers and quotes sparingly, the
  way its SEP and 1911 models do.

Classical authors get a two-tier treatment, the pattern the repo
already runs for Agrippa: a public-domain translation supplies quotable
text (the J.F. Agrippa is already in the PD manifest), and the owned
modern translation supplies citation.

## Capture

The CZUR scanner produces page images; its native OCR is not the text
of record. Capture is TIFF or PNG, one page per file, named
`<libraryId>_p0001`. The full page stays in frame, header and footer
included: printed page numbers live there, and every citation the
Encyclopedia makes binds to a printed page number. Where CZUR OCR
output exists it is kept as a second transcription for disagreement
triage, nothing more.

## OCR

**Primary engine: Chandra 2** (Datalab, open weights), run locally. It
reads page images and emits markdown or HTML plus layout JSON, supports
over 90 languages, and reconstructs tables. Benchmarks as of March 2026
(Datalab's own and an independent archival comparison) put it at the
front for print, tables, and multi-column layout; commercial models
keep a lead only on difficult handwriting, which this shelf barely has.
A local run matches the repo's pattern: the embeddings pipeline already
runs on this machine and nothing leaves it. Where Chandra is too slow
on Apple Silicon, Surya (same vendor, 0.65B parameters, runs under
llama.cpp) is the lighter local option.

**Escalation: a frontier vision model** (Claude or Gemini) processes
flagged pages: glyph-dense pages, Greek and Hebrew passages, tables
that fail structural checks, and pages where the engines disagree. The
vision pass emits astrological and alchemical glyphs as Unicode
codepoints (☉, ♈, △, ☍) and reads the printed page number from the
footer in the same pass. Vision models invent plausible text when the
print is uncertain, so escalation output is checked against the primary
engine's reading rather than accepted blind.

**Specialist:** Kraken with eScriptorium is the trainable route for
historical print and right-to-left scripts. The shelf is English with
inline passages, so no volume is expected to need it; it stays
available for any book that proves classical-language dense.

## QA harness

OCR accuracy on clean print is a solved problem; locating the failures
is not. The harness runs per book, and its results commit with the
catalog entry:

1. **Page-number binding.** Each page image yields its printed page
   number or a front-matter marker, recovered from the header or footer
   and bound to the image index. Unbound pages go to the review queue.
   Citations require the binding.
2. **Glyph inventory.** Counts of astrological and alchemical
   codepoints per book, plus a lookalike check for Latin misreads (a
   zodiac glyph read as a digit). Glyph-dense books route to the vision
   tier by default.
3. **Language routing.** Script detection flags Greek and Hebrew
   regions; language identification flags Latin. Flagged regions get
   the escalation pass.
4. **Twin calibration.** Heindel's *Simplified Scientific Astrology*
   (1919) is public domain and fetchable from Wikisource. Its scan is
   diffed against the public-domain text, giving a measured
   character-error rate for the stack on exactly this class of book.
   The J.F. Agrippa text in `caelus-delineations-pd` is a second anchor
   for same-era layout behavior.
5. **Disagreement triage.** The primary engine, the CZUR transcription
   where present, and the escalation output are diffed per page.
   High-disagreement pages join the review queue.
6. **Sampled review.** A sample of pages per book gets human
   comparison against the image.

## Provenance and storage

The figure harness stamps every plate with the engine version that drew
it; the same discipline applies to text. Every page carries its
provenance in the catalog: OCR engine, engine version, run date, and QA
scores. Text without provenance does not enter an evidence pack.

The private store layout:

```text
library/
  images/<libraryId>/p0001.tif
  ocr/<libraryId>/p0001.md
  ocr/<libraryId>/p0001.escalation.md   # where the escalation pass ran
  vectors/<libraryId>.parquet
```

The committed side is the catalog entry and citations.

## Manifest

`docs/product/library.csv` is the catalog of record and gains the
working columns: rights class (`private-scan`, `pd-twin`,
`pd-translation`), scan status, OCR engine and version, run date, and
QA summary. On the KB side, titles become `source:` nodes in the
curated sources data with the rights class recorded, extending the set
seeded from the `caelus-delineations-pd` manifest. Provenance edges
point at these nodes, so an Encyclopedia citation resolves from article
to source node to catalog entry.

## Retrieval

Chunking respects page boundaries, so every chunk carries a printed
page number. Chunks embed with the existing BGE-M3 pipeline (1024-d,
sentence-transformers on MPS) and store as Parquet in the private
store. Search is exact cosine over the library, the same pattern as the
essay vectors; there is no vector database.

## Text mining

A deterministic decomposition layer over the three text collections:
the library, the Encyclopedia articles, and the corpus essays. One
annotation pipeline; the library is the diachronic corpus under
study, and the other two ride through it. Output is data for
researchers, with no use cases fixed in advance; the KB's concept ids
are the coordinate system that makes results comparable across
traditions and times.

Three grades of "deterministic," kept distinct. Rule-deterministic:
counting, matching, pattern extraction. Pinned-model reproducible:
lemmas, part-of-speech, embeddings (same inputs and versions give the
same outputs). Seeded-stochastic: topic models and projection plots,
which stay out of the core layer and are labeled exploratory when
they appear at all.

**Annotation substrate.** Tokens, lemmas, part-of-speech, and
sentence boundaries (spaCy, versions pinned) stored as standoff
Parquet beside the OCR, never mutating source text. Every file
carries annotator and version, the same provenance discipline as the
figure harness. Regions the QA harness flagged as Greek, Hebrew, or
Latin are skipped by the English pipeline; CLTK is the escalation
path if a book proves classical-dense.

**Concept occurrence.** A gazetteer built from the KB: per-node alias
tables covering English, Latin, Greek, and Sanskrit variants,
historical spellings, and the glyph codepoints the escalation pass
emits. Deterministic matching plus disambiguation rules (Mercury the
planet, the metal, the god; the ambiguity is itself a research
object) produce the layer's keystone artifact: concept id x document
x page x count. Unresolvable senses land in a review queue. The table
feeds KB attestations with page numbers, Encyclopedia infobox facts,
and two coverage reports: KB nodes with no library support (thin
articles) and library passages matching no node (missing-node
detector, which is how the hermetic subtrees find their vocabulary).

**Statistics.** Frequencies, keyness by log-likelihood against a
reference shelf or era, collocations, co-occurrence matrices, and
KWIC concordances, all rule-deterministic. `library.csv` gains era
and tradition columns so the surveys come out diachronic: concept
frequency over time, collocate drift between centuries,
correspondence-analysis maps placing traditions by their concept
profiles.

**Relation and table mining.** The domain's claims are formulaic
enough for pattern-based extraction ("X rules Y", "exalted in", "the
lord of"): candidate KB edges with page-cited attestations go to a
review queue, never straight into curated files. Author disagreement
surfaces as data, which is the variant-table shape the KB already
wants. Extracted correspondence tables align to the Liber 777 import
schema and diff across authors.

**Storage and rights.** Annotations and occurrence tables over
in-copyright text are derivatives and live in the private store
(`library/annotations/`, `library/concepts/`). Committed artifacts
are aggregate features and small reports, the HathiTrust
extracted-features pattern: counts are facts, concordance lines are
expression. KWIC from public-domain twins can ship; KWIC from scans
stays private.

**Verification.** The Heindel twin doubles as the annotation golden:
hand-checked concept occurrences on sampled pages, drift-tested per
annotator version, the same pattern as the KB's engine-drift test.
Occurrence rows carry the source book's QA grade so downstream work
can filter by OCR quality.

**Sequencing.** The layer gates on OCR output for the library, but
the substrate and concept-occurrence tiers can be built and proven
now against the collections already in the repo (3,656 corpus essays
and the Encyclopedia as it lands): same code, no rights questions,
and concept coverage of the corpus against the KB is a useful audit
on its own. First researcher surfaces are the occurrence dataset
itself (documented schema plus provenance), a query CLI, and an MCP
concordance tool (concept id to attestations with page cites), which
also upgrades Encyclopedia evidence packs from pure cosine top-k to
hybrid concept-filtered retrieval. Dashboards belong to the visual
design stream, later.

## Consumers

**KB.** Each title becomes a `source:` node. Curated files gain
attestations with page numbers: house topics per author beyond Lilly,
variant dignity tables with attribution, and star natures, which fills
the declared-but-empty `starNature` edge set. Correspondence references
(Bills, Skinner, Saint-Martin's *Natural Table*, Godwin, the tarot
shelf) extract as structured data in the shape of the existing Liber
777 import, not as prose.

**Encyclopedia.** Evidence packs per article: top-k chunks across the
library with page citations, extending the planned embeddings evidence
packs from essays to books. Citations render through KB provenance
edges.

**Corpus.** Research packs per B5/B6 slice ride the writer briefs,
grounding the doctrine-heavy families (nakshatras, vargas, yogas,
stars) in George and Brennan. Reviewers check essays against the same
packs.

**Echo guard.** Corpus essays and Encyclopedia drafts embed against
library chunks, and a too-close-paraphrase report sits beside
`backlog/semantic-echoes.md`. This is the check that keeps research
input from becoming paraphrase, and it is what makes library-assisted
writing safe at scale.

**Memorativa.** The scanned numerical tables are the golden-test
oracle for the arithmology engine: the kameas in Agrippa Book II, the
gematria systems in Papus and the tarot shelf, the theosophical
arithmetic in encausse-01, the ratio tables in godwin-02 and
guthrie-02. A Memorativa fixture that disagrees with the printed
table fails. The memory tradition behind the engine's name (bruno-01,
yates-03, carruthers-01, spence-01) feeds the Encyclopedia's articles
on the art of memory.

## Text inventory

The inventory below maps titles to consumers. Identifiers are the
`libraryId` values from the catalog.

**Corpus research and echo guard.** hand-01 (*Horoscope Symbols*),
hand-02 (*Planets in Composite*), hand-03 (*Planets in Transit*): the
corpus's quality bar is Hand's Para Research series, and these are it.
Also arroyo-01, sasportas-01, tompkins-01, pelletier-01, forrest-01,
clifford-01, george-01 and george-02, brennan-02, papus-01, moore-01,
tarnas-01.

**KB structured data.** bills-01, skinner-01, saint-martin-02,
godwin-01, mebes-01 through mebes-04, sadhu-02, shmakov-01,
regardie-01, papus-04 through papus-06, encausse-01, sutton-01.

**Encyclopedia history and doctrine.** agrippa-01 (Purdue, for
citation; the J.F. translation supplies quotation), pseudo-majriti-01
and -02, copenhaver-01, yates-01 through yates-04, couliano-01,
burkert-01, eliade-01 through eliade-04, guthrie-01 and guthrie-02,
godwin-02, carruthers-01, chambers-01, uzdavinys-01 through -03,
churton-01, azize-01, hall-01, christian-01, waite-01 and waite-02,
roggemans-01, papus-03, evola-12, tomberg-01, jacobsen-01,
vanstiphout-01, meyer-01, bruno-01, spence-01.

**Context shelves: mythology, language, the sky.** graves-01,
hamilton-01, homer-03, hesiod-01, ovid-01, the epic translations
(mason-01, kinsella-01, byock-01, hatto-01, davies-01, debroy-01 and
debroy-02), barfield-03, davidson-01, sidgwick-01, goethe-04 with
bortoff-01 and lehrs-01, lundy-01, michell-01.

**Public-domain twins: no scanning.** A block of the catalog is
public-domain text in modern reprints, fetchable through the existing
PD manifest mechanism: heindel-01 (1919, on Wikisource), iamblichus-01
(Taylor's 1821 translation), frazer-01, chisholm-01 (the 1911
Britannica, which is also the Encyclopedia's stated model), goethe-04
(the MIT Press edition reproduces Eastlake's 1840 translation),
herodotus-01 (Rawlinson, 1858), sanchuniathon-01 (Cumberland, 1720).
For modern translations of classical authors (plato-01, plotinus-01,
aristotle-01), public-domain translations (Jowett, Mackenna, Ross)
supply quotable text and the owned editions supply citation.

---

## Verification

- The QA harness runs per book: page-binding coverage, glyph counts,
  language flags, the twin character-error figure, and the size of the
  disagreement queue commit with the catalog entry.
- Table extraction (Bills, Skinner) is spot-checked against the printed
  table before the data enters a curated KB file.
- The echo-guard report regenerates when corpus essays or Encyclopedia
  drafts change, the same cadence as the essay embeddings.
