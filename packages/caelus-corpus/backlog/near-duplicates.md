# Backlog — near-duplicate sentences

Two sentences that are the same sentence with a word swapped, scored by
longest common subsequence over words. Order-aware, because the defect is
a reused sentence *shape*: a synonym does not save it.

## How to clear it

**Make a different move, not another word swap.** Two sentences at 79%
pass the lint and still read as a template. If both say the same true
thing about different geometry, one of them has drifted off its own cell;
fix that one and it stops being generic.

**38 findings across the corpus, 19 distinct collisions.** Each collision is reported against both of its entries, so the collision count is the number of repairs owed.

## By family

| family | entries | findings |
|---|---|---|
| composite-placement | 144 | 20 |
| synastry-overlay | 120 | 16 |
| timelord-dasha | 90 | 2 |

## By file — this is the worklist

One reviewer per file, or per group of files sharing a first body.
Edit only the files in your own scope; when a finding names an entry in
someone else's file, fix your side and leave theirs.

| file | findings |
|---|---|
| `b3-composite-sun.json` | 5 |
| `b3-composite-venus.json` | 4 |
| `b3-composite-uranus.json` | 4 |
| `b3-synastry-overlays-mars.json` | 3 |
| `b3-synastry-overlays-saturn.json` | 3 |
| `b3-composite-mercury.json` | 2 |
| `b3-composite-moon.json` | 2 |
| `b3-composite-pluto.json` | 2 |
| `b3-synastry-overlays-pluto.json` | 2 |
| `b3-synastry-overlays-jupiter.json` | 2 |
| `b3-synastry-overlays-mercury.json` | 2 |
| `b3-composite-true-node.json` | 1 |
| `b3-synastry-overlays-neptune.json` | 1 |
| `b3-synastry-overlays-uranus.json` | 1 |
| `b3-synastry-overlays-sun.json` | 1 |
| `b3-synastry-overlays-venus.json` | 1 |
| `b4-dasha-antars-venus.json` | 1 |
| `b4-dasha-mahas.json` | 1 |

## Findings


### b3-composite-mercury.json

- **composite:mercury:sign:virgo** — 83% the same sentence as composite:mercury:sign:capricorn: "what this mercury gives is competence…" vs "what this mercury gives is dependability…"
- **composite:mercury:sign:capricorn** — 83% the same sentence as composite:mercury:sign:virgo: "what this mercury gives is dependability…" vs "what this mercury gives is competence…"

### b3-composite-moon.json

- **composite:moon:sign:gemini** — 86% the same sentence as composite:moon:sign:capricorn: "curiosity is the mood it returns to…" vs "seriousness is the mood it returns to…"
- **composite:moon:sign:capricorn** — 86% the same sentence as composite:moon:sign:gemini: "seriousness is the mood it returns to…" vs "curiosity is the mood it returns to…"

### b3-composite-pluto.json

- **composite:pluto:sign:capricorn** — 92% the same sentence as composite:sun:sign:taurus: "ambition belongs to the relationship itself not on…" vs "stubbornness belongs to the relationship itself no…"
- **composite:pluto:sign:capricorn** — 85% the same sentence as composite:sun:sign:leo: "ambition belongs to the relationship itself not on…" vs "pride belongs to the relationship and not only to …"

### b3-composite-sun.json

- **composite:sun:sign:capricorn** — 80% the same sentence as composite:venus:sign:virgo: "a composite chart says nothing about whether a rel…" vs "nothing in a composite chart says whether a relati…"
- **composite:sun:sign:taurus** — 92% the same sentence as composite:pluto:sign:capricorn: "stubbornness belongs to the relationship itself no…" vs "ambition belongs to the relationship itself not on…"
- **composite:sun:sign:leo** — 85% the same sentence as composite:pluto:sign:capricorn: "pride belongs to the relationship and not only to …" vs "ambition belongs to the relationship itself not on…"
- **composite:sun:sign:taurus** — 85% the same sentence as composite:sun:sign:leo: "stubbornness belongs to the relationship itself no…" vs "pride belongs to the relationship and not only to …"
- **composite:sun:sign:leo** — 85% the same sentence as composite:sun:sign:taurus: "pride belongs to the relationship and not only to …" vs "stubbornness belongs to the relationship itself no…"

### b3-composite-true-node.json

- **composite:true_node:sign:scorpio** — 80% the same sentence as composite:uranus:sign:leo: "change is the other half of it…" vs "creative life is the other half of it…"

### b3-composite-uranus.json

- **composite:uranus:sign:gemini** — 82% the same sentence as composite:venus:sign:scorpio: "nothing said between these two stays official for …" vs "nothing between these two stays casual for long…"
- **composite:uranus:sign:leo** — 80% the same sentence as composite:true_node:sign:scorpio: "creative life is the other half of it…" vs "change is the other half of it…"
- **composite:uranus:sign:gemini** — 84% the same sentence as composite:uranus:sign:pisces: "the refusal here is a refusal of the final word…" vs "the refusal here is a refusal of the literal…"
- **composite:uranus:sign:pisces** — 84% the same sentence as composite:uranus:sign:gemini: "the refusal here is a refusal of the literal…" vs "the refusal here is a refusal of the final word…"

### b3-composite-venus.json

- **composite:venus:sign:virgo** — 80% the same sentence as composite:sun:sign:capricorn: "nothing in a composite chart says whether a relati…" vs "a composite chart says nothing about whether a rel…"
- **composite:venus:sign:scorpio** — 82% the same sentence as composite:uranus:sign:gemini: "nothing between these two stays casual for long…" vs "nothing said between these two stays official for …"
- **composite:venus:sign:taurus** — 89% the same sentence as composite:venus:sign:aquarius: "what this composite venus gives the pair is weight…" vs "what this composite venus gives the pair is permis…"
- **composite:venus:sign:aquarius** — 89% the same sentence as composite:venus:sign:taurus: "what this composite venus gives the pair is permis…" vs "what this composite venus gives the pair is weight…"

### b3-synastry-overlays-jupiter.json

- **synastry:overlay:jupiter:house:2** — 81% the same sentence as synastry:overlay:mars:house:2: "what you take from occupying this part of their li…" vs "what you get from occupying this part of their lif…"
- **synastry:overlay:jupiter:house:7** — 82% the same sentence as synastry:overlay:mercury:house:7: "you show up in their life as a counterpart…" vs "you arrive in their life as a counterpart…"

### b3-synastry-overlays-mars.json

- **synastry:overlay:mars:house:2** — 81% the same sentence as synastry:overlay:jupiter:house:2: "what you get from occupying this part of their lif…" vs "what you take from occupying this part of their li…"
- **synastry:overlay:mars:house:4** — 84% the same sentence as synastry:overlay:saturn:house:4: "you are not a visitor in their life…" vs "you are not a visitor in their life you are loadbe…"
- **synastry:overlay:mars:house:7** — 88% the same sentence as synastry:overlay:mercury:house:7: "you arrive in their chart as a counterpart…" vs "you arrive in their life as a counterpart…"

### b3-synastry-overlays-mercury.json

- **synastry:overlay:mercury:house:7** — 82% the same sentence as synastry:overlay:jupiter:house:7: "you arrive in their life as a counterpart…" vs "you show up in their life as a counterpart…"
- **synastry:overlay:mercury:house:7** — 88% the same sentence as synastry:overlay:mars:house:7: "you arrive in their life as a counterpart…" vs "you arrive in their chart as a counterpart…"

### b3-synastry-overlays-neptune.json

- **synastry:overlay:neptune:house:2** — 82% the same sentence as synastry:overlay:pluto:house:2: "their second house covers what they own what they …" vs "their second house holds what they own what they e…"

### b3-synastry-overlays-pluto.json

- **synastry:overlay:pluto:house:2** — 82% the same sentence as synastry:overlay:neptune:house:2: "their second house holds what they own what they e…" vs "their second house covers what they own what they …"
- **synastry:overlay:pluto:house:12** — 82% the same sentence as synastry:overlay:uranus:house:7: "the first effect is that they cannot explain you…" vs "the effect is that they cannot predict you…"

### b3-synastry-overlays-saturn.json

- **synastry:overlay:saturn:house:2** — 88% the same sentence as synastry:overlay:saturn:house:11: "what they tend to experience is a sobering…" vs "what they tend to experience is a filter…"
- **synastry:overlay:saturn:house:11** — 88% the same sentence as synastry:overlay:saturn:house:2: "what they tend to experience is a filter…" vs "what they tend to experience is a sobering…"
- **synastry:overlay:saturn:house:4** — 84% the same sentence as synastry:overlay:mars:house:4: "you are not a visitor in their life you are loadbe…" vs "you are not a visitor in their life…"

### b3-synastry-overlays-sun.json

- **synastry:overlay:sun:house:2** — 80% the same sentence as synastry:overlay:venus:house:2: "money possessions and the quieter question of what…" vs "possessions income and the private question of whe…"

### b3-synastry-overlays-uranus.json

- **synastry:overlay:uranus:house:7** — 82% the same sentence as synastry:overlay:pluto:house:12: "the effect is that they cannot predict you…" vs "the first effect is that they cannot explain you…"

### b3-synastry-overlays-venus.json

- **synastry:overlay:venus:house:2** — 80% the same sentence as synastry:overlay:sun:house:2: "possessions income and the private question of whe…" vs "money possessions and the quieter question of what…"

### b4-dasha-antars-venus.json

- **timelord:dasha:antar:venus:mars** — 88% the same sentence as timelord:dasha:maha:mars: "conflict is part of the honest weather here…" vs "conflict is part of the chapters honest weather…"

### b4-dasha-mahas.json

- **timelord:dasha:maha:mars** — 88% the same sentence as timelord:dasha:antar:venus:mars: "conflict is part of the chapters honest weather…" vs "conflict is part of the honest weather here…"
