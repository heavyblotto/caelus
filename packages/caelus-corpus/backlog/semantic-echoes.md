# Backlog — semantic echoes

Pairs of essays whose **whole-essay embeddings** are close, found by
cosine similarity over BGE-M3 vectors (one vector per essay). Unlike
the near-duplicate and echo lints, this sees paraphrase: two essays
can share no sentence and still say the same thing.

Pairs within the same family that share the same first body are
excluded — siblings legitimately resemble each other. So are mirror
pairs within the same family (the same unordered body pair and
aspect, e.g. transit:saturn:trine:pluto vs transit:pluto:trine:saturn):
they describe the same sky geometry from swapped roles, and repair
on both sides does not move their similarity. Everything reported
here is cross-cutting.

## Method

- Model: BAAI/bge-m3, 1024-dim, normalized; full pairwise cosine over
  3,056 essays (4,618,712 eligible pairs after the sibling
  and mirror exclusions).
- Similarity distribution of eligible pairs: p50 0.633, p90 0.709,
  p99 0.777, max 0.890.
- Threshold: **0.88**, chosen from that distribution to yield a
  reviewable list. At this cutoff: **10 pairs**.
- Regenerate: `uv run python report_semantic_echoes.py` in
  `pipeline/embeddings/` (after `embed.py`).

**20 findings across the corpus, 10 distinct pairs.**
Each pair is reported against both of its entries, so the pair count
is the number of repairs owed.

## By family

| family | findings |
|---|---|
| synastry-aspect | 11 |
| composite-aspect | 4 |
| transit-aspect | 2 |
| timelord-dasha | 2 |
| planetary-return | 1 |

## By file — this is the worklist

One reviewer per file, or per group of files sharing a first body.
Edit only the files in your own scope; when a finding names an entry
in someone else's file, fix your side and leave theirs.

| file | findings |
|---|---|
| `b3-synastry-mars-2.json` | 2 |
| `b3-synastry-moon-2.json` | 2 |
| `b3-synastry-venus-3.json` | 2 |
| `b4-dasha-antars-rahu.json` | 2 |
| `b2-transits-venus-1.json` | 1 |
| `b2-transits-venus-2.json` | 1 |
| `b3-composite-aspects-moon-2.json` | 1 |
| `b3-composite-aspects-neptune-1.json` | 1 |
| `b3-composite-aspects-sun-3.json` | 1 |
| `b3-composite-aspects-venus-2.json` | 1 |
| `b3-synastry-mars-1.json` | 1 |
| `b3-synastry-moon-3.json` | 1 |
| `b3-synastry-neptune-1.json` | 1 |
| `b3-synastry-sun-2.json` | 1 |
| `b3-synastry-venus-4.json` | 1 |
| `b4-returns.json` | 1 |

## Findings

### b2-transits-venus-1.json

- **transit:venus:sextile:moon** — transit-aspect echoes synastry-aspect -- cosine 0.883 with synastry:moon:sextile:venus

### b2-transits-venus-2.json

- **transit:venus:conjunction:venus** — transit-aspect echoes planetary-return -- cosine 0.888 with return:venus

### b3-composite-aspects-moon-2.json

- **composite:aspect:moon:opposition:jupiter** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:neptune:opposition:pluto

### b3-composite-aspects-neptune-1.json

- **composite:aspect:neptune:opposition:pluto** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:moon:opposition:jupiter

### b3-composite-aspects-sun-3.json

- **composite:aspect:sun:trine:neptune** — composite-aspect echoes composite-aspect -- cosine 0.890 with composite:aspect:venus:trine:neptune

### b3-composite-aspects-venus-2.json

- **composite:aspect:venus:trine:neptune** — composite-aspect echoes composite-aspect -- cosine 0.890 with composite:aspect:sun:trine:neptune

### b3-synastry-mars-1.json

- **synastry:mars:sextile:mercury** — synastry-aspect echoes synastry-aspect -- cosine 0.881 with synastry:sun:sextile:mars

### b3-synastry-mars-2.json

- **synastry:mars:sextile:venus** — synastry-aspect echoes synastry-aspect -- cosine 0.890 with synastry:venus:sextile:pluto
- **synastry:mars:sextile:venus** — synastry-aspect echoes synastry-aspect -- cosine 0.887 with synastry:moon:sextile:venus

### b3-synastry-moon-2.json

- **synastry:moon:sextile:venus** — synastry-aspect echoes synastry-aspect -- cosine 0.887 with synastry:mars:sextile:venus
- **synastry:moon:sextile:venus** — synastry-aspect echoes transit-aspect -- cosine 0.883 with transit:venus:sextile:moon

### b3-synastry-moon-3.json

- **synastry:moon:sextile:neptune** — synastry-aspect echoes synastry-aspect -- cosine 0.882 with synastry:venus:sextile:neptune

### b3-synastry-neptune-1.json

- **synastry:neptune:sextile:moon** — synastry-aspect echoes synastry-aspect -- cosine 0.889 with synastry:venus:sextile:neptune

### b3-synastry-sun-2.json

- **synastry:sun:sextile:mars** — synastry-aspect echoes synastry-aspect -- cosine 0.881 with synastry:mars:sextile:mercury

### b3-synastry-venus-3.json

- **synastry:venus:sextile:neptune** — synastry-aspect echoes synastry-aspect -- cosine 0.889 with synastry:neptune:sextile:moon
- **synastry:venus:sextile:neptune** — synastry-aspect echoes synastry-aspect -- cosine 0.882 with synastry:moon:sextile:neptune

### b3-synastry-venus-4.json

- **synastry:venus:sextile:pluto** — synastry-aspect echoes synastry-aspect -- cosine 0.890 with synastry:mars:sextile:venus

### b4-dasha-antars-rahu.json

- **timelord:dasha:antar:rahu:moon** — timelord-dasha echoes timelord-dasha -- cosine 0.880 with timelord:dasha:antar:rahu:mars
- **timelord:dasha:antar:rahu:mars** — timelord-dasha echoes timelord-dasha -- cosine 0.880 with timelord:dasha:antar:rahu:moon

### b4-returns.json

- **return:venus** — planetary-return echoes transit-aspect -- cosine 0.888 with transit:venus:conjunction:venus
