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
  p99 0.778, max 0.906.
- Threshold: **0.88**, chosen from that distribution to yield a
  reviewable list. At this cutoff: **34 pairs**.
- Regenerate: `uv run python report_semantic_echoes.py` in
  `pipeline/embeddings/` (after `embed.py`).

**68 findings across the corpus, 34 distinct pairs.**
Each pair is reported against both of its entries, so the pair count
is the number of repairs owed.

## By family

| family | findings |
|---|---|
| composite-aspect | 44 |
| synastry-aspect | 11 |
| composite-house | 4 |
| synastry-overlay | 3 |
| transit-aspect | 2 |
| timelord-dasha | 2 |
| planet-in-house | 1 |
| planetary-return | 1 |

## By file — this is the worklist

One reviewer per file, or per group of files sharing a first body.
Edit only the files in your own scope; when a finding names an entry
in someone else's file, fix your side and leave theirs.

| file | findings |
|---|---|
| `b3-composite-aspects-moon-3.json` | 7 |
| `b3-composite-aspects-chiron-1.json` | 5 |
| `b3-composite-aspects-sun-4.json` | 5 |
| `b3-composite-aspects-mars-1.json` | 4 |
| `b3-composite-aspects-moon-2.json` | 3 |
| `b3-composite-aspects-neptune-1.json` | 3 |
| `b3-composite-aspects-saturn-1.json` | 3 |
| `b3-composite-aspects-sun-3.json` | 3 |
| `b3-composite-aspects-mars-2.json` | 2 |
| `b3-composite-aspects-saturn-2.json` | 2 |
| `b3-composite-aspects-sun-2.json` | 2 |
| `b3-composite-houses-jupiter.json` | 2 |
| `b3-synastry-mars-2.json` | 2 |
| `b3-synastry-moon-2.json` | 2 |
| `b3-synastry-venus-3.json` | 2 |
| `b4-dasha-antars-rahu.json` | 2 |
| `b1-venus-houses.json` | 1 |
| `b2-transits-venus-1.json` | 1 |
| `b2-transits-venus-2.json` | 1 |
| `b3-composite-aspects-jupiter-1.json` | 1 |
| `b3-composite-aspects-jupiter-2.json` | 1 |
| `b3-composite-aspects-moon-1.json` | 1 |
| `b3-composite-aspects-pluto-1.json` | 1 |
| `b3-composite-aspects-venus-2.json` | 1 |
| `b3-composite-houses-pluto.json` | 1 |
| `b3-composite-houses-saturn.json` | 1 |
| `b3-synastry-mars-1.json` | 1 |
| `b3-synastry-moon-3.json` | 1 |
| `b3-synastry-neptune-1.json` | 1 |
| `b3-synastry-overlays-mars.json` | 1 |
| `b3-synastry-overlays-sun.json` | 1 |
| `b3-synastry-overlays-venus.json` | 1 |
| `b3-synastry-sun-2.json` | 1 |
| `b3-synastry-venus-4.json` | 1 |
| `b4-returns.json` | 1 |

## Findings

### b1-venus-houses.json

- **natal:venus:house:6** — planet-in-house echoes synastry-overlay -- cosine 0.890 with synastry:overlay:venus:house:6

### b2-transits-venus-1.json

- **transit:venus:sextile:moon** — transit-aspect echoes synastry-aspect -- cosine 0.883 with synastry:moon:sextile:venus

### b2-transits-venus-2.json

- **transit:venus:conjunction:venus** — transit-aspect echoes planetary-return -- cosine 0.888 with return:venus

### b3-composite-aspects-chiron-1.json

- **composite:aspect:chiron:trine:true_node** — composite-aspect echoes composite-aspect -- cosine 0.894 with composite:aspect:saturn:trine:chiron
- **composite:aspect:chiron:trine:true_node** — composite-aspect echoes composite-aspect -- cosine 0.893 with composite:aspect:moon:trine:chiron
- **composite:aspect:chiron:trine:true_node** — composite-aspect echoes composite-aspect -- cosine 0.891 with composite:aspect:sun:trine:chiron
- **composite:aspect:chiron:trine:true_node** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:neptune:trine:chiron
- **composite:aspect:chiron:sextile:true_node** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:sun:sextile:chiron

### b3-composite-aspects-jupiter-1.json

- **composite:aspect:jupiter:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:moon:sextile:uranus

### b3-composite-aspects-jupiter-2.json

- **composite:aspect:jupiter:sextile:chiron** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:moon:sextile:chiron

### b3-composite-aspects-mars-1.json

- **composite:aspect:mars:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.899 with composite:aspect:moon:sextile:uranus
- **composite:aspect:mars:sextile:saturn** — composite-aspect echoes composite-aspect -- cosine 0.886 with composite:aspect:moon:sextile:mars
- **composite:aspect:mars:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:sun:sextile:mars
- **composite:aspect:mars:sextile:saturn** — composite-aspect echoes composite-aspect -- cosine 0.881 with composite:aspect:sun:sextile:mars

### b3-composite-aspects-mars-2.json

- **composite:aspect:mars:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.893 with composite:aspect:moon:trine:chiron
- **composite:aspect:mars:opposition:pluto** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:pluto:opposition:chiron

### b3-composite-aspects-moon-1.json

- **composite:aspect:moon:sextile:mars** — composite-aspect echoes composite-aspect -- cosine 0.886 with composite:aspect:mars:sextile:saturn

### b3-composite-aspects-moon-2.json

- **composite:aspect:moon:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.899 with composite:aspect:mars:sextile:uranus
- **composite:aspect:moon:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:jupiter:sextile:uranus
- **composite:aspect:moon:trine:uranus** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:sun:trine:uranus

### b3-composite-aspects-moon-3.json

- **composite:aspect:moon:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.900 with composite:aspect:sun:trine:chiron
- **composite:aspect:moon:sextile:chiron** — composite-aspect echoes composite-aspect -- cosine 0.895 with composite:aspect:sun:sextile:chiron
- **composite:aspect:moon:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.893 with composite:aspect:mars:trine:chiron
- **composite:aspect:moon:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.893 with composite:aspect:chiron:trine:true_node
- **composite:aspect:moon:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:neptune:trine:chiron
- **composite:aspect:moon:sextile:chiron** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:jupiter:sextile:chiron
- **composite:aspect:moon:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:saturn:trine:chiron

### b3-composite-aspects-neptune-1.json

- **composite:aspect:neptune:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:moon:trine:chiron
- **composite:aspect:neptune:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:sun:trine:chiron
- **composite:aspect:neptune:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:chiron:trine:true_node

### b3-composite-aspects-pluto-1.json

- **composite:aspect:pluto:opposition:chiron** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:mars:opposition:pluto

### b3-composite-aspects-saturn-1.json

- **composite:aspect:saturn:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.903 with composite:aspect:sun:sextile:uranus
- **composite:aspect:saturn:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:venus:sextile:uranus
- **composite:aspect:saturn:sextile:neptune** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:sun:sextile:neptune

### b3-composite-aspects-saturn-2.json

- **composite:aspect:saturn:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.894 with composite:aspect:chiron:trine:true_node
- **composite:aspect:saturn:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:moon:trine:chiron

### b3-composite-aspects-sun-2.json

- **composite:aspect:sun:sextile:mars** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:mars:sextile:uranus
- **composite:aspect:sun:sextile:mars** — composite-aspect echoes composite-aspect -- cosine 0.881 with composite:aspect:mars:sextile:saturn

### b3-composite-aspects-sun-3.json

- **composite:aspect:sun:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.903 with composite:aspect:saturn:sextile:uranus
- **composite:aspect:sun:trine:uranus** — composite-aspect echoes composite-aspect -- cosine 0.882 with composite:aspect:moon:trine:uranus
- **composite:aspect:sun:sextile:neptune** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:saturn:sextile:neptune

### b3-composite-aspects-sun-4.json

- **composite:aspect:sun:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.900 with composite:aspect:moon:trine:chiron
- **composite:aspect:sun:sextile:chiron** — composite-aspect echoes composite-aspect -- cosine 0.895 with composite:aspect:moon:sextile:chiron
- **composite:aspect:sun:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.891 with composite:aspect:chiron:trine:true_node
- **composite:aspect:sun:trine:chiron** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:neptune:trine:chiron
- **composite:aspect:sun:sextile:chiron** — composite-aspect echoes composite-aspect -- cosine 0.880 with composite:aspect:chiron:sextile:true_node

### b3-composite-aspects-venus-2.json

- **composite:aspect:venus:sextile:uranus** — composite-aspect echoes composite-aspect -- cosine 0.885 with composite:aspect:saturn:sextile:uranus

### b3-composite-houses-jupiter.json

- **composite:jupiter:house:10** — composite-house echoes composite-house -- cosine 0.906 with composite:pluto:house:10
- **composite:jupiter:house:10** — composite-house echoes composite-house -- cosine 0.885 with composite:saturn:house:10

### b3-composite-houses-pluto.json

- **composite:pluto:house:10** — composite-house echoes composite-house -- cosine 0.906 with composite:jupiter:house:10

### b3-composite-houses-saturn.json

- **composite:saturn:house:10** — composite-house echoes composite-house -- cosine 0.885 with composite:jupiter:house:10

### b3-synastry-mars-1.json

- **synastry:mars:sextile:mercury** — synastry-aspect echoes synastry-aspect -- cosine 0.881 with synastry:sun:sextile:mars

### b3-synastry-mars-2.json

- **synastry:mars:sextile:venus** — synastry-aspect echoes synastry-aspect -- cosine 0.890 with synastry:venus:sextile:pluto
- **synastry:mars:sextile:venus** — synastry-aspect echoes synastry-aspect -- cosine 0.887 with synastry:moon:sextile:venus

### b3-synastry-moon-2.json

- **synastry:moon:sextile:venus** — synastry-aspect echoes synastry-aspect -- cosine 0.887 with synastry:mars:sextile:venus
- **synastry:moon:sextile:venus** — synastry-aspect echoes transit-aspect -- cosine 0.883 with transit:venus:sextile:moon

### b3-synastry-moon-3.json

- **synastry:moon:sextile:neptune** — synastry-aspect echoes synastry-aspect -- cosine 0.883 with synastry:venus:sextile:neptune

### b3-synastry-neptune-1.json

- **synastry:neptune:sextile:moon** — synastry-aspect echoes synastry-aspect -- cosine 0.887 with synastry:venus:sextile:neptune

### b3-synastry-overlays-mars.json

- **synastry:overlay:mars:house:8** — synastry-overlay echoes synastry-overlay -- cosine 0.885 with synastry:overlay:sun:house:8

### b3-synastry-overlays-sun.json

- **synastry:overlay:sun:house:8** — synastry-overlay echoes synastry-overlay -- cosine 0.885 with synastry:overlay:mars:house:8

### b3-synastry-overlays-venus.json

- **synastry:overlay:venus:house:6** — synastry-overlay echoes planet-in-house -- cosine 0.890 with natal:venus:house:6

### b3-synastry-sun-2.json

- **synastry:sun:sextile:mars** — synastry-aspect echoes synastry-aspect -- cosine 0.881 with synastry:mars:sextile:mercury

### b3-synastry-venus-3.json

- **synastry:venus:sextile:neptune** — synastry-aspect echoes synastry-aspect -- cosine 0.887 with synastry:neptune:sextile:moon
- **synastry:venus:sextile:neptune** — synastry-aspect echoes synastry-aspect -- cosine 0.883 with synastry:moon:sextile:neptune

### b3-synastry-venus-4.json

- **synastry:venus:sextile:pluto** — synastry-aspect echoes synastry-aspect -- cosine 0.890 with synastry:mars:sextile:venus

### b4-dasha-antars-rahu.json

- **timelord:dasha:antar:rahu:moon** — timelord-dasha echoes timelord-dasha -- cosine 0.880 with timelord:dasha:antar:rahu:mars
- **timelord:dasha:antar:rahu:mars** — timelord-dasha echoes timelord-dasha -- cosine 0.880 with timelord:dasha:antar:rahu:moon

### b4-returns.json

- **return:venus** — planetary-return echoes transit-aspect -- cosine 0.888 with transit:venus:conjunction:venus
