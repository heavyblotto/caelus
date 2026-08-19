# Backlog — near-duplicate sentences

Two sentences that are the same sentence with a word swapped, scored by
longest common subsequence over words. Order-aware, because the defect is
a reused sentence *shape*: a synonym does not save it.

## How to clear it

**Make a different move, not another word swap.** Two sentences at 79%
pass the lint and still read as a template. If both say the same true
thing about different geometry, one of them has drifted off its own cell;
fix that one and it stops being generic.

**320 findings across the corpus, 158 distinct collisions.** Each collision is reported against both of its entries, so the collision count is the number of repairs owed.

## By family

| family | entries | findings |
|---|---|---|
| transit-aspect | 600 | 172 |
| aspect | 330 | 82 |
| composite-placement | 144 | 20 |
| synastry-overlay | 120 | 16 |
| planet-in-house | 144 | 12 |
| planet-in-sign | 144 | 8 |
| transit-house | 120 | 4 |
| dignity | 50 | 2 |
| rising-sign | 12 | 2 |
| timelord-dasha | 90 | 2 |

## By file — this is the worklist

One reviewer per file, or per group of files sharing a first body.
Edit only the files in your own scope; when a finding names an entry in
someone else's file, fix your side and leave theirs.

| file | findings |
|---|---|
| `b2-transits-pluto-1.json` | 32 |
| `b2-transits-jupiter-2.json` | 10 |
| `b2-transits-uranus-1.json` | 8 |
| `b2-transits-jupiter-4.json` | 8 |
| `b1-aspects-06.json` | 7 |
| `b1-aspects-17.json` | 7 |
| `b1-aspects-15.json` | 7 |
| `b2-transits-sun-2.json` | 7 |
| `b2-transits-mars-3.json` | 7 |
| `b1-aspects-13.json` | 6 |
| `b1-aspects-22.json` | 6 |
| `b1-venus-signs.json` | 6 |
| `b2-transits-saturn-4.json` | 6 |
| `b2-transits-neptune-2.json` | 6 |
| `b2-transits-mars-1.json` | 6 |
| `b1-aspects-08.json` | 5 |
| `b1-aspects-02.json` | 5 |
| `b1-aspects-09.json` | 5 |
| `b3-composite-sun.json` | 5 |
| `b2-transits-jupiter-1.json` | 5 |
| `b2-transits-pluto-3.json` | 5 |
| `b2-transits-uranus-2.json` | 5 |
| `b2-transits-mercury-4.json` | 5 |
| `b2-transits-node-sun-moon.json` | 5 |
| `b2-transits-sun-3.json` | 5 |
| `b2-transits-pluto-2.json` | 5 |
| `b1-aspects-03.json` | 4 |
| `b1-aspects-12.json` | 4 |
| `b1-aspects-07.json` | 4 |
| `b3-composite-venus.json` | 4 |
| `b3-composite-uranus.json` | 4 |
| `b2-transits-node-neptune-pluto.json` | 4 |
| `b2-transits-venus-4.json` | 4 |
| `b1-aspects-10.json` | 3 |
| `b1-aspects-20.json` | 3 |
| `b1-aspects-18.json` | 3 |
| `b1-aspects-05.json` | 3 |
| `b3-synastry-overlays-mars.json` | 3 |
| `b3-synastry-overlays-saturn.json` | 3 |
| `b2-transits-mercury-2.json` | 3 |
| `b2-transits-saturn-3.json` | 3 |
| `b2-transits-jupiter-3.json` | 3 |
| `b2-transits-node-mercury-venus.json` | 3 |
| `b2-transits-uranus-3.json` | 3 |
| `b2-transits-saturn-1.json` | 3 |
| `b1-aspects-01.json` | 2 |
| `b1-aspects-19.json` | 2 |
| `b1-aspects-21.json` | 2 |
| `b1-aspects-16.json` | 2 |
| `b3-composite-mercury.json` | 2 |
| `b3-composite-moon.json` | 2 |
| `b3-composite-pluto.json` | 2 |
| `b1-true-node-houses.json` | 2 |
| `b1-jupiter-houses.json` | 2 |
| `b1-neptune-houses.json` | 2 |
| `b1-pluto-signs.json` | 2 |
| `b1-rising-signs.json` | 2 |
| `b3-synastry-overlays-pluto.json` | 2 |
| `b3-synastry-overlays-jupiter.json` | 2 |
| `b3-synastry-overlays-mercury.json` | 2 |
| `b2-transits-venus-3.json` | 2 |
| `b2-transits-moon-4.json` | 2 |
| `b2-transits-neptune-1.json` | 2 |
| `b2-transits-neptune-4.json` | 2 |
| `b2-transits-neptune-3.json` | 2 |
| `b2-transits-venus-2.json` | 2 |
| `b2-transit-houses-mercury.json` | 2 |
| `b1-aspects-04.json` | 1 |
| `b1-aspects-11.json` | 1 |
| `b3-composite-true-node.json` | 1 |
| `b1-dignities-01.json` | 1 |
| `b1-dignities-03.json` | 1 |
| `b1-chiron-houses.json` | 1 |
| `b1-sun-houses.json` | 1 |
| `b1-mercury-houses.json` | 1 |
| `b1-mars-houses.json` | 1 |
| `b1-saturn-houses.json` | 1 |
| `b1-moon-houses.json` | 1 |
| `b3-synastry-overlays-neptune.json` | 1 |
| `b3-synastry-overlays-uranus.json` | 1 |
| `b3-synastry-overlays-sun.json` | 1 |
| `b3-synastry-overlays-venus.json` | 1 |
| `b4-dasha-antars-venus.json` | 1 |
| `b4-dasha-mahas.json` | 1 |
| `b2-transits-moon-2.json` | 1 |
| `b2-transits-saturn-2.json` | 1 |
| `b2-transits-moon-1.json` | 1 |
| `b2-transits-mars-4.json` | 1 |
| `b2-transits-sun-4.json` | 1 |
| `b2-transits-pluto-4.json` | 1 |
| `b2-transits-mars-2.json` | 1 |
| `b2-transits-node-mars-jupiter.json` | 1 |
| `b2-transits-venus-1.json` | 1 |
| `b2-transit-houses-mars.json` | 1 |
| `b2-transit-houses-uranus.json` | 1 |

## Findings


### b1-aspects-01.json

- **natal:aspect:sun:trine:moon** — 82% the same sentence as natal:aspect:jupiter:trine:pluto: "your growth is a matter of aim rather than repair…" vs "your growth is a matter of aim…"
- **natal:aspect:sun:trine:moon** — 80% the same sentence as natal:aspect:mercury:trine:mars: "your growth is a matter of aim rather than repair…" vs "your development is a matter of assignment rather …"

### b1-aspects-02.json

- **natal:aspect:sun:conjunction:mars** — 94% the same sentence as natal:aspect:mars:trine:pluto: "the growth built into this aspect is aim…" vs "the growth built into this aspect is deliberate ai…"
- **natal:aspect:sun:sextile:mars** — 92% the same sentence as natal:aspect:sun:sextile:chiron: "nothing forces you to use this…" vs "nothing forces you to use this ability…"
- **natal:aspect:sun:sextile:mars** — 88% the same sentence as natal:aspect:mercury:sextile:saturn: "growth here is mostly a matter of appetite…" vs "growth here is mostly a matter of invitation…"
- **natal:aspect:sun:conjunction:jupiter** — 88% the same sentence as natal:aspect:venus:conjunction:jupiter: "the bill for all this expansiveness is proportion…" vs "the bill for all this abundance is proportion…"
- **natal:aspect:sun:square:saturn** — 86% the same sentence as natal:aspect:moon:square:pluto: "here is what the difficulty is doing…" vs "here is what the difficulty is building…"

### b1-aspects-03.json

- **natal:aspect:sun:trine:uranus** — 86% the same sentence as natal:aspect:moon:sextile:uranus: "in love you offer a rare combination warmth withou…" vs "in love you offer a rare deal real warmth without …"
- **natal:aspect:sun:trine:neptune** — 80% the same sentence as natal:aspect:venus:trine:chiron: "your growth is a matter of adding spine to the wat…" vs "your growth with this aspect is a matter of adding…"
- **natal:aspect:sun:sextile:uranus** — 92% the same sentence as natal:aspect:venus:sextile:chiron: "the one caution with a sextile is that it waits to…" vs "the one caution with a sextile is that it waits to…"
- **natal:aspect:sun:opposition:neptune** — 88% the same sentence as natal:aspect:jupiter:square:neptune: "none of this means your perception is broken…" vs "none of this means your instinct is broken…"

### b1-aspects-04.json

- **natal:aspect:sun:sextile:chiron** — 92% the same sentence as natal:aspect:sun:sextile:mars: "nothing forces you to use this ability…" vs "nothing forces you to use this…"

### b1-aspects-05.json

- **natal:aspect:moon:trine:venus** — 80% the same sentence as natal:aspect:moon:trine:pluto: "the shadow of a trine is not pain but slack…" vs "the shadow of a trine is not misuse but sleep…"
- **natal:aspect:moon:trine:venus** — 80% the same sentence as natal:aspect:mars:trine:pluto: "the shadow of a trine is not pain but slack…" vs "the shadow of a trine is not damage but sleep…"
- **natal:aspect:moon:square:mars** — 80% the same sentence as natal:aspect:moon:square:uranus: "here is what the friction is building because a sq…" vs "here is what the friction is building because squa…"

### b1-aspects-06.json

- **natal:aspect:moon:sextile:uranus** — 86% the same sentence as natal:aspect:sun:trine:uranus: "in love you offer a rare deal real warmth without …" vs "in love you offer a rare combination warmth withou…"
- **natal:aspect:moon:trine:uranus** — 86% the same sentence as natal:aspect:jupiter:trine:pluto: "your growth is a matter of aiming…" vs "your growth is a matter of aim…"
- **natal:aspect:moon:trine:uranus** — 86% the same sentence as natal:aspect:saturn:sextile:uranus: "your growth is a matter of aiming…" vs "your growth is a matter of practice…"
- **natal:aspect:moon:square:uranus** — 80% the same sentence as natal:aspect:moon:square:mars: "here is what the friction is building because squa…" vs "here is what the friction is building because a sq…"
- **natal:aspect:moon:square:saturn** — 82% the same sentence as natal:aspect:saturn:square:chiron: "a square is friction and friction worked with buil…" vs "a square is friction and friction worked with over…"
- **natal:aspect:moon:sextile:uranus** — 83% the same sentence as natal:aspect:jupiter:conjunction:true_node: "this shows up socially as range…" vs "this shows up socially as well…"
- **natal:aspect:moon:square:neptune** — 83% the same sentence as natal:aspect:mars:square:jupiter: "the imagination never was the problem…" vs "the energy never was the problem…"

### b1-aspects-07.json

- **natal:aspect:moon:trine:pluto** — 80% the same sentence as natal:aspect:moon:trine:venus: "the shadow of a trine is not misuse but sleep…" vs "the shadow of a trine is not pain but slack…"
- **natal:aspect:moon:trine:pluto** — 90% the same sentence as natal:aspect:mars:trine:pluto: "the shadow of a trine is not misuse but sleep…" vs "the shadow of a trine is not damage but sleep…"
- **natal:aspect:moon:square:pluto** — 86% the same sentence as natal:aspect:sun:square:saturn: "here is what the difficulty is building…" vs "here is what the difficulty is doing…"
- **natal:aspect:moon:square:pluto** — 86% the same sentence as natal:aspect:mercury:square:saturn: "here is what the difficulty is building…" vs "here is what the friction is building…"

### b1-aspects-08.json

- **natal:aspect:mercury:trine:mars** — 80% the same sentence as natal:aspect:sun:trine:moon: "your development is a matter of assignment rather …" vs "your growth is a matter of aim rather than repair…"
- **natal:aspect:mercury:trine:venus** — 82% the same sentence as natal:aspect:uranus:conjunction:pluto: "growth with this aspect is mostly a matter of aim…" vs "your growth with this aspect is a matter of aim an…"
- **natal:aspect:mercury:trine:venus** — 80% the same sentence as natal:aspect:neptune:trine:chiron: "growth with this aspect is mostly a matter of aim…" vs "growth with this trine is mostly a matter of owner…"
- **natal:aspect:mercury:square:mars** — 86% the same sentence as natal:aspect:mercury:square:saturn: "here is what the friction is for…" vs "here is what the friction is building…"
- **natal:aspect:mercury:sextile:mars** — 86% the same sentence as natal:aspect:venus:sextile:pluto: "decisiveness is available to you on request…" vs "depth is available to you on request…"

### b1-aspects-09.json

- **natal:aspect:mercury:sextile:saturn** — 88% the same sentence as natal:aspect:sun:sextile:mars: "growth here is mostly a matter of invitation…" vs "growth here is mostly a matter of appetite…"
- **natal:aspect:mercury:square:saturn** — 86% the same sentence as natal:aspect:moon:square:pluto: "here is what the friction is building…" vs "here is what the difficulty is building…"
- **natal:aspect:mercury:square:saturn** — 86% the same sentence as natal:aspect:mercury:square:mars: "here is what the friction is building…" vs "here is what the friction is for…"
- **natal:aspect:mercury:trine:uranus** — 82% the same sentence as natal:aspect:saturn:trine:neptune: "in daily life this shows as a kind of mental hospi…" vs "in daily life this shows as a kind of composed ide…"
- **natal:aspect:mercury:sextile:uranus** — 80% the same sentence as natal:aspect:mercury:sextile:pluto: "this is an aptitude not a compulsion…" vs "a sextile is an aptitude not a compulsion…"

### b1-aspects-10.json

- **natal:aspect:mercury:opposition:true_node** — 88% the same sentence as natal:aspect:uranus:opposition:true_node: "none of this makes your gift a flaw…" vs "none of this makes your independence a flaw…"
- **natal:aspect:mercury:sextile:pluto** — 80% the same sentence as natal:aspect:mercury:sextile:uranus: "a sextile is an aptitude not a compulsion…" vs "this is an aptitude not a compulsion…"
- **natal:aspect:mercury:sextile:pluto** — 88% the same sentence as natal:aspect:jupiter:sextile:neptune: "the signal to watch for is that flatness…" vs "the signal to watch for is that thirst…"

### b1-aspects-11.json

- **natal:aspect:venus:conjunction:jupiter** — 88% the same sentence as natal:aspect:sun:conjunction:jupiter: "the bill for all this abundance is proportion…" vs "the bill for all this expansiveness is proportion…"

### b1-aspects-12.json

- **natal:aspect:venus:sextile:uranus** — 87% the same sentence as natal:aspect:mars:sextile:pluto: "the catch with a sextile is that nothing forces it…" vs "the catch with a sextile is that nothing forces yo…"
- **natal:aspect:venus:sextile:uranus** — 80% the same sentence as natal:aspect:neptune:sextile:chiron: "the catch with a sextile is that nothing forces it…" vs "the limitation of a sextile is that nothing forces…"
- **natal:aspect:venus:sextile:pluto** — 86% the same sentence as natal:aspect:mercury:sextile:mars: "depth is available to you on request…" vs "decisiveness is available to you on request…"
- **natal:aspect:venus:sextile:uranus** — 80% the same sentence as natal:aspect:venus:trine:chiron: "in love the gift shows up as flexibility…" vs "in love the gift shows as acceptance…"

### b1-aspects-13.json

- **natal:aspect:venus:trine:chiron** — 80% the same sentence as natal:aspect:sun:trine:neptune: "your growth with this aspect is a matter of adding…" vs "your growth is a matter of adding spine to the wat…"
- **natal:aspect:venus:sextile:chiron** — 92% the same sentence as natal:aspect:sun:sextile:uranus: "the one caution with a sextile is that it waits to…" vs "the one caution with a sextile is that it waits to…"
- **natal:aspect:mars:square:jupiter** — 83% the same sentence as natal:aspect:moon:square:neptune: "the energy never was the problem…" vs "the imagination never was the problem…"
- **natal:aspect:mars:square:jupiter** — 83% the same sentence as natal:aspect:mars:square:true_node: "the energy never was the problem…" vs "your energy never was the problem…"
- **natal:aspect:venus:trine:chiron** — 80% the same sentence as natal:aspect:venus:sextile:uranus: "in love the gift shows as acceptance…" vs "in love the gift shows up as flexibility…"
- **natal:aspect:venus:square:chiron** — 83% the same sentence as natal:aspect:mars:square:chiron: "the doubt may never fully retire…" vs "the ache may never fully retire…"

### b1-aspects-15.json

- **natal:aspect:mars:conjunction:pluto** — 93% the same sentence as natal:aspect:jupiter:trine:pluto: "your growth is largely a matter of aim…" vs "your growth is a matter of aim…"
- **natal:aspect:mars:trine:pluto** — 94% the same sentence as natal:aspect:sun:conjunction:mars: "the growth built into this aspect is deliberate ai…" vs "the growth built into this aspect is aim…"
- **natal:aspect:mars:sextile:pluto** — 87% the same sentence as natal:aspect:venus:sextile:uranus: "the catch with a sextile is that nothing forces yo…" vs "the catch with a sextile is that nothing forces it…"
- **natal:aspect:mars:trine:pluto** — 80% the same sentence as natal:aspect:moon:trine:venus: "the shadow of a trine is not damage but sleep…" vs "the shadow of a trine is not pain but slack…"
- **natal:aspect:mars:trine:pluto** — 90% the same sentence as natal:aspect:moon:trine:pluto: "the shadow of a trine is not damage but sleep…" vs "the shadow of a trine is not misuse but sleep…"
- **natal:aspect:mars:square:true_node** — 83% the same sentence as natal:aspect:mars:square:jupiter: "your energy never was the problem…" vs "the energy never was the problem…"
- **natal:aspect:mars:square:chiron** — 83% the same sentence as natal:aspect:venus:square:chiron: "the ache may never fully retire…" vs "the doubt may never fully retire…"

### b1-aspects-16.json

- **natal:aspect:jupiter:square:neptune** — 88% the same sentence as natal:aspect:sun:opposition:neptune: "none of this means your instinct is broken…" vs "none of this means your perception is broken…"
- **natal:aspect:jupiter:sextile:neptune** — 88% the same sentence as natal:aspect:mercury:sextile:pluto: "the signal to watch for is that thirst…" vs "the signal to watch for is that flatness…"

### b1-aspects-17.json

- **natal:aspect:jupiter:trine:pluto** — 82% the same sentence as natal:aspect:sun:trine:moon: "your growth is a matter of aim…" vs "your growth is a matter of aim rather than repair…"
- **natal:aspect:jupiter:trine:pluto** — 86% the same sentence as natal:aspect:moon:trine:uranus: "your growth is a matter of aim…" vs "your growth is a matter of aiming…"
- **natal:aspect:jupiter:trine:pluto** — 86% the same sentence as natal:aspect:saturn:sextile:uranus: "your growth is a matter of aim…" vs "your growth is a matter of practice…"
- **natal:aspect:jupiter:trine:pluto** — 93% the same sentence as natal:aspect:mars:conjunction:pluto: "your growth is a matter of aim…" vs "your growth is largely a matter of aim…"
- **natal:aspect:jupiter:trine:pluto** — 80% the same sentence as natal:aspect:pluto:trine:chiron: "the catch with a trine is that ease invites coasti…" vs "the catch with a trine is that ease goes unexamine…"
- **natal:aspect:jupiter:conjunction:true_node** — 83% the same sentence as natal:aspect:moon:sextile:uranus: "this shows up socially as well…" vs "this shows up socially as range…"
- **natal:aspect:jupiter:square:true_node** — 86% the same sentence as natal:aspect:chiron:sextile:true_node: "you know the feeling this describes…" vs "you may already know the feeling this describes…"

### b1-aspects-18.json

- **natal:aspect:saturn:sextile:uranus** — 86% the same sentence as natal:aspect:moon:trine:uranus: "your growth is a matter of practice…" vs "your growth is a matter of aiming…"
- **natal:aspect:saturn:sextile:uranus** — 86% the same sentence as natal:aspect:jupiter:trine:pluto: "your growth is a matter of practice…" vs "your growth is a matter of aim…"
- **natal:aspect:saturn:trine:neptune** — 82% the same sentence as natal:aspect:mercury:trine:uranus: "in daily life this shows as a kind of composed ide…" vs "in daily life this shows as a kind of mental hospi…"

### b1-aspects-19.json

- **natal:aspect:saturn:sextile:chiron** — 80% the same sentence as natal:aspect:pluto:sextile:chiron: "the catch with a sextile is neglect…" vs "the one caution with a sextile is neglect…"
- **natal:aspect:saturn:square:chiron** — 82% the same sentence as natal:aspect:moon:square:saturn: "a square is friction and friction worked with over…" vs "a square is friction and friction worked with buil…"

### b1-aspects-20.json

- **natal:aspect:uranus:opposition:true_node** — 88% the same sentence as natal:aspect:mercury:opposition:true_node: "none of this makes your independence a flaw…" vs "none of this makes your gift a flaw…"
- **natal:aspect:uranus:conjunction:pluto** — 82% the same sentence as natal:aspect:mercury:trine:venus: "your growth with this aspect is a matter of aim an…" vs "growth with this aspect is mostly a matter of aim…"
- **natal:aspect:uranus:square:chiron** — 82% the same sentence as natal:aspect:chiron:square:true_node: "the pattern is easiest to see in its cycle…" vs "the pattern is easiest to see in hindsight…"

### b1-aspects-21.json

- **natal:aspect:neptune:sextile:chiron** — 80% the same sentence as natal:aspect:venus:sextile:uranus: "the limitation of a sextile is that nothing forces…" vs "the catch with a sextile is that nothing forces it…"
- **natal:aspect:neptune:trine:chiron** — 80% the same sentence as natal:aspect:mercury:trine:venus: "growth with this trine is mostly a matter of owner…" vs "growth with this aspect is mostly a matter of aim…"

### b1-aspects-22.json

- **natal:aspect:pluto:sextile:chiron** — 80% the same sentence as natal:aspect:saturn:sextile:chiron: "the one caution with a sextile is neglect…" vs "the catch with a sextile is neglect…"
- **natal:aspect:pluto:trine:chiron** — 80% the same sentence as natal:aspect:jupiter:trine:pluto: "the catch with a trine is that ease goes unexamine…" vs "the catch with a trine is that ease invites coasti…"
- **natal:aspect:chiron:sextile:true_node** — 86% the same sentence as natal:aspect:jupiter:square:true_node: "you may already know the feeling this describes…" vs "you know the feeling this describes…"
- **natal:aspect:chiron:square:true_node** — 82% the same sentence as natal:aspect:uranus:square:chiron: "the pattern is easiest to see in hindsight…" vs "the pattern is easiest to see in its cycle…"
- **natal:aspect:pluto:opposition:true_node** — 83% the same sentence as natal:aspect:chiron:opposition:true_node: "because the lunar nodes always sit opposite each o…" vs "because the lunar nodes are always opposite each o…"
- **natal:aspect:chiron:opposition:true_node** — 83% the same sentence as natal:aspect:pluto:opposition:true_node: "because the lunar nodes are always opposite each o…" vs "because the lunar nodes always sit opposite each o…"

### b1-chiron-houses.json

- **natal:chiron:house:2** — 83% the same sentence as natal:sun:house:4: "that is the real subject here…" vs "that is the real project here…"

### b1-dignities-01.json

- **natal:sun:dignity:detriment** — 83% the same sentence as natal:saturn:dignity:fall: "none of this is a flaw…" vs "none of this is a verdict…"

### b1-dignities-03.json

- **natal:saturn:dignity:fall** — 83% the same sentence as natal:sun:dignity:detriment: "none of this is a verdict…" vs "none of this is a flaw…"

### b1-jupiter-houses.json

- **natal:jupiter:house:2** — 80% the same sentence as natal:mercury:house:1: "what matures in you over time is the question of e…" vs "what matures in you over time is the pause…"
- **natal:jupiter:house:6** — 86% the same sentence as natal:saturn:house:1: "your growth is a matter of scale…" vs "your growth is a matter of permission…"

### b1-mars-houses.json

- **natal:mars:house:9** — 83% the same sentence as natal:neptune:house:8: "this makes you a natural advocate…" vs "this makes you a natural confessor…"

### b1-mercury-houses.json

- **natal:mercury:house:1** — 80% the same sentence as natal:jupiter:house:2: "what matures in you over time is the pause…" vs "what matures in you over time is the question of e…"

### b1-moon-houses.json

- **natal:moon:house:10** — 83% the same sentence as natal:neptune:house:4: "the risks are worth naming plainly…" vs "the hazards are worth naming plainly…"

### b1-neptune-houses.json

- **natal:neptune:house:8** — 83% the same sentence as natal:mars:house:9: "this makes you a natural confessor…" vs "this makes you a natural advocate…"
- **natal:neptune:house:4** — 83% the same sentence as natal:moon:house:10: "the hazards are worth naming plainly…" vs "the risks are worth naming plainly…"

### b1-pluto-signs.json

- **natal:pluto:sign:taurus** — 80% the same sentence as natal:pluto:sign:sagittarius: "you carry that upheaval personally as a compulsion…" vs "you carry that collision personally as a compulsio…"
- **natal:pluto:sign:sagittarius** — 80% the same sentence as natal:pluto:sign:taurus: "you carry that collision personally as a compulsio…" vs "you carry that upheaval personally as a compulsion…"

### b1-rising-signs.json

- **natal:asc:sign:leo** — 80% the same sentence as natal:asc:sign:sagittarius: "as a lens this rising sign colors your whole chart…" vs "as a lens this rising sign turns your whole chart …"
- **natal:asc:sign:sagittarius** — 80% the same sentence as natal:asc:sign:leo: "as a lens this rising sign turns your whole chart …" vs "as a lens this rising sign colors your whole chart…"

### b1-saturn-houses.json

- **natal:saturn:house:1** — 86% the same sentence as natal:jupiter:house:6: "your growth is a matter of permission…" vs "your growth is a matter of scale…"

### b1-sun-houses.json

- **natal:sun:house:4** — 83% the same sentence as natal:chiron:house:2: "that is the real project here…" vs "that is the real subject here…"

### b1-true-node-houses.json

- **natal:true_node:house:8** — 83% the same sentence as natal:true_node:house:12: "you know how to be secure…" vs "you know how to be busy…"
- **natal:true_node:house:12** — 83% the same sentence as natal:true_node:house:8: "you know how to be busy…" vs "you know how to be secure…"

### b1-venus-signs.json

- **natal:venus:sign:taurus** — 83% the same sentence as natal:venus:sign:cancer: "in friendship you are the constant…" vs "in friendship you are the harbor…"
- **natal:venus:sign:cancer** — 83% the same sentence as natal:venus:sign:taurus: "in friendship you are the harbor…" vs "in friendship you are the constant…"
- **natal:venus:sign:taurus** — 83% the same sentence as natal:venus:sign:pisces: "in friendship you are the constant…" vs "in friendship you are the refuge…"
- **natal:venus:sign:pisces** — 83% the same sentence as natal:venus:sign:taurus: "in friendship you are the refuge…" vs "in friendship you are the constant…"
- **natal:venus:sign:cancer** — 83% the same sentence as natal:venus:sign:pisces: "in friendship you are the harbor…" vs "in friendship you are the refuge…"
- **natal:venus:sign:pisces** — 83% the same sentence as natal:venus:sign:cancer: "in friendship you are the refuge…" vs "in friendship you are the harbor…"

### b2-transit-houses-mars.json

- **transit:mars:house:1** — 80% the same sentence as transit:uranus:house:1: "the gift of the period is initiative…" vs "the gift of the period is equally real…"

### b2-transit-houses-mercury.json

- **transit:mercury:house:3** — 80% the same sentence as transit:mercury:house:9: "a normal pass through this house takes a few weeks…" vs "a standard pass through this house lasts a few wee…"
- **transit:mercury:house:9** — 80% the same sentence as transit:mercury:house:3: "a standard pass through this house lasts a few wee…" vs "a normal pass through this house takes a few weeks…"

### b2-transit-houses-uranus.json

- **transit:uranus:house:1** — 80% the same sentence as transit:mars:house:1: "the gift of the period is equally real…" vs "the gift of the period is initiative…"

### b2-transits-jupiter-1.json

- **transit:jupiter:conjunction:sun** — 86% the same sentence as transit:saturn:square:chiron: "the transit has a shape worth knowing…" vs "the timing has a shape worth knowing…"
- **transit:jupiter:square:sun** — 80% the same sentence as transit:pluto:square:uranus: "restlessness is usually the first sign…" vs "restlessness is usually the first sign of this tra…"
- **transit:jupiter:opposition:sun** — 88% the same sentence as transit:jupiter:opposition:uranus: "jupiters retrograde can bring the opposition back …" vs "jupiters retrograde can bring the opposition back …"
- **transit:jupiter:trine:moon** — 82% the same sentence as transit:moon:trine:sun: "the arc is soft at every stage…" vs "the arc of the transit is soft at every stage…"
- **transit:jupiter:trine:moon** — 86% the same sentence as transit:venus:trine:chiron: "the arc is soft at every stage…" vs "the arc stays soft at every stage…"

### b2-transits-jupiter-2.json

- **transit:jupiter:conjunction:venus** — 88% the same sentence as transit:jupiter:conjunction:pluto: "because jupiter can retrograde this transit someti…" vs "because jupiter can retrograde this conjunction so…"
- **transit:jupiter:conjunction:venus** — 86% the same sentence as transit:jupiter:square:mars: "around the exact pass the warmth peaks…" vs "around the exact pass the pressure peaks…"
- **transit:jupiter:square:mars** — 86% the same sentence as transit:jupiter:conjunction:venus: "around the exact pass the pressure peaks…" vs "around the exact pass the warmth peaks…"
- **transit:jupiter:conjunction:venus** — 86% the same sentence as transit:jupiter:conjunction:pluto: "around the exact pass the warmth peaks…" vs "around the exact pass the drive peaks…"
- **transit:jupiter:conjunction:venus** — 86% the same sentence as transit:neptune:conjunction:true_node: "around the exact pass the warmth peaks…" vs "around the exact pass the pull peaks…"
- **transit:jupiter:square:mars** — 86% the same sentence as transit:jupiter:conjunction:pluto: "around the exact pass the pressure peaks…" vs "around the exact pass the drive peaks…"
- **transit:jupiter:square:mars** — 86% the same sentence as transit:neptune:conjunction:true_node: "around the exact pass the pressure peaks…" vs "around the exact pass the pull peaks…"
- **transit:jupiter:conjunction:venus** — 86% the same sentence as transit:sun:conjunction:venus: "around the exact pass the warmth peaks…" vs "at the exact pass the warmth peaks…"
- **transit:jupiter:opposition:venus** — 82% the same sentence as transit:mercury:opposition:true_node: "while the aspect applies the pull builds…" vs "while the aspect applies the pull of the familiar …"
- **transit:jupiter:conjunction:venus** — 83% the same sentence as transit:saturn:conjunction:saturn: "the final pass settles the question usually more g…" vs "the final pass settles the matter usually more qui…"

### b2-transits-jupiter-3.json

- **transit:jupiter:opposition:uranus** — 88% the same sentence as transit:jupiter:opposition:sun: "jupiters retrograde can bring the opposition back …" vs "jupiters retrograde can bring the opposition back …"
- **transit:jupiter:square:neptune** — 86% the same sentence as transit:jupiter:square:pluto: "none of this makes the period bad…" vs "none of this makes the season bad…"
- **transit:jupiter:square:neptune** — 86% the same sentence as transit:moon:conjunction:pluto: "none of this makes the period bad…" vs "none of this makes the window bad…"

### b2-transits-jupiter-4.json

- **transit:jupiter:conjunction:pluto** — 88% the same sentence as transit:jupiter:conjunction:venus: "because jupiter can retrograde this conjunction so…" vs "because jupiter can retrograde this transit someti…"
- **transit:jupiter:conjunction:pluto** — 86% the same sentence as transit:jupiter:conjunction:venus: "around the exact pass the drive peaks…" vs "around the exact pass the warmth peaks…"
- **transit:jupiter:conjunction:pluto** — 86% the same sentence as transit:jupiter:square:mars: "around the exact pass the drive peaks…" vs "around the exact pass the pressure peaks…"
- **transit:jupiter:conjunction:pluto** — 86% the same sentence as transit:neptune:conjunction:true_node: "around the exact pass the drive peaks…" vs "around the exact pass the pull peaks…"
- **transit:jupiter:conjunction:pluto** — 86% the same sentence as transit:mars:conjunction:sun: "around the exact pass the drive peaks…" vs "at the exact pass the drive peaks…"
- **transit:jupiter:trine:chiron** — 95% the same sentence as transit:uranus:trine:saturn: "the one weakness of the period is its own comfort…" vs "the one weakness of the period is its comfort…"
- **transit:jupiter:square:pluto** — 86% the same sentence as transit:jupiter:square:neptune: "none of this makes the season bad…" vs "none of this makes the period bad…"
- **transit:jupiter:square:pluto** — 86% the same sentence as transit:moon:conjunction:pluto: "none of this makes the season bad…" vs "none of this makes the window bad…"

### b2-transits-mars-1.json

- **transit:mars:conjunction:sun** — 86% the same sentence as transit:jupiter:conjunction:pluto: "at the exact pass the drive peaks…" vs "around the exact pass the drive peaks…"
- **transit:mars:conjunction:sun** — 86% the same sentence as transit:mars:opposition:neptune: "at the exact pass the drive peaks…" vs "at the exact pass the confusion peaks…"
- **transit:mars:conjunction:sun** — 86% the same sentence as transit:mercury:conjunction:pluto: "at the exact pass the drive peaks…" vs "at the exact pass the intensity peaks…"
- **transit:mars:conjunction:sun** — 86% the same sentence as transit:sun:conjunction:true_node: "at the exact pass the drive peaks…" vs "at the exact pass the theme peaks…"
- **transit:mars:conjunction:sun** — 86% the same sentence as transit:sun:conjunction:venus: "at the exact pass the drive peaks…" vs "at the exact pass the warmth peaks…"
- **transit:mars:conjunction:sun** — 86% the same sentence as transit:sun:conjunction:uranus: "at the exact pass the drive peaks…" vs "at the exact pass the static peaks…"

### b2-transits-mars-2.json

- **transit:mars:square:jupiter** — 89% the same sentence as transit:neptune:opposition:venus: "what stays with you afterward is a better instrume…" vs "what stays with you is a better instrument…"

### b2-transits-mars-3.json

- **transit:mars:opposition:neptune** — 86% the same sentence as transit:mars:conjunction:sun: "at the exact pass the confusion peaks…" vs "at the exact pass the drive peaks…"
- **transit:mars:opposition:neptune** — 86% the same sentence as transit:mercury:conjunction:pluto: "at the exact pass the confusion peaks…" vs "at the exact pass the intensity peaks…"
- **transit:mars:opposition:neptune** — 86% the same sentence as transit:sun:conjunction:true_node: "at the exact pass the confusion peaks…" vs "at the exact pass the theme peaks…"
- **transit:mars:opposition:neptune** — 86% the same sentence as transit:sun:conjunction:venus: "at the exact pass the confusion peaks…" vs "at the exact pass the warmth peaks…"
- **transit:mars:opposition:neptune** — 86% the same sentence as transit:sun:conjunction:uranus: "at the exact pass the confusion peaks…" vs "at the exact pass the static peaks…"
- **transit:mars:conjunction:neptune** — 82% the same sentence as transit:venus:conjunction:chiron: "none of this means anything is wrong with you…" vs "none of this means anything is going wrong…"
- **transit:mars:sextile:saturn** — 89% the same sentence as transit:mercury:conjunction:true_node: "the growth in this transit is modest and real…" vs "the growth this transit offers is modest and real…"

### b2-transits-mars-4.json

- **transit:mars:conjunction:pluto** — 83% the same sentence as transit:sun:conjunction:pluto: "as mars separates the charge drains off and you ca…" vs "as the sun separates the intensity drains off quic…"

### b2-transits-mercury-2.json

- **transit:mercury:conjunction:mars** — 82% the same sentence as transit:moon:conjunction:mars: "the exact pass is the peak of both decisiveness an…" vs "the exact pass is the peak of both power and touch…"
- **transit:mercury:opposition:mars** — 86% the same sentence as transit:venus:opposition:saturn: "this transit tends to arrive wearing someone elses…" vs "the coolness in this transit tends to arrive weari…"
- **transit:mercury:trine:jupiter** — 86% the same sentence as transit:saturn:trine:sun: "ease invites coasting and a coasted trine leaves n…" vs "ease invites coasting and a trine spent coasting l…"

### b2-transits-mercury-4.json

- **transit:mercury:conjunction:pluto** — 86% the same sentence as transit:mars:conjunction:sun: "at the exact pass the intensity peaks…" vs "at the exact pass the drive peaks…"
- **transit:mercury:conjunction:pluto** — 86% the same sentence as transit:mars:opposition:neptune: "at the exact pass the intensity peaks…" vs "at the exact pass the confusion peaks…"
- **transit:mercury:conjunction:pluto** — 86% the same sentence as transit:sun:conjunction:true_node: "at the exact pass the intensity peaks…" vs "at the exact pass the theme peaks…"
- **transit:mercury:conjunction:pluto** — 86% the same sentence as transit:sun:conjunction:venus: "at the exact pass the intensity peaks…" vs "at the exact pass the warmth peaks…"
- **transit:mercury:conjunction:pluto** — 86% the same sentence as transit:sun:conjunction:uranus: "at the exact pass the intensity peaks…" vs "at the exact pass the static peaks…"

### b2-transits-moon-1.json

- **transit:moon:trine:sun** — 82% the same sentence as transit:jupiter:trine:moon: "the arc of the transit is soft at every stage…" vs "the arc is soft at every stage…"

### b2-transits-moon-2.json

- **transit:moon:conjunction:mars** — 82% the same sentence as transit:mercury:conjunction:mars: "the exact pass is the peak of both power and touch…" vs "the exact pass is the peak of both decisiveness an…"

### b2-transits-moon-4.json

- **transit:moon:conjunction:pluto** — 86% the same sentence as transit:jupiter:square:neptune: "none of this makes the window bad…" vs "none of this makes the period bad…"
- **transit:moon:conjunction:pluto** — 86% the same sentence as transit:jupiter:square:pluto: "none of this makes the window bad…" vs "none of this makes the season bad…"

### b2-transits-neptune-1.json

- **transit:neptune:square:mercury** — 96% the same sentence as transit:saturn:square:chiron: "ask the question you think you already know the an…" vs "ask the question you think you should already know…"
- **transit:neptune:conjunction:moon** — 83% the same sentence as transit:neptune:square:pluto: "most people experience this conjunction once in a …" vs "most people meet this square once in a lifetime if…"

### b2-transits-neptune-2.json

- **transit:neptune:conjunction:venus** — 81% the same sentence as transit:uranus:conjunction:sun: "because neptune retrogrades it usually touches thi…" vs "because uranus retrogrades it can cross this degre…"
- **transit:neptune:sextile:jupiter** — 82% the same sentence as transit:uranus:sextile:venus: "little about this transit is dramatic and that is …" vs "little in this period is dramatic and that is its …"
- **transit:neptune:opposition:venus** — 89% the same sentence as transit:mars:square:jupiter: "what stays with you is a better instrument…" vs "what stays with you afterward is a better instrume…"
- **transit:neptune:conjunction:venus** — 86% the same sentence as transit:pluto:conjunction:saturn: "around the exact passes the longing peaks…" vs "around the exact passes the pressure peaks…"
- **transit:neptune:square:jupiter** — 82% the same sentence as transit:neptune:opposition:uranus: "in the applying months this is mostly mood…" vs "in the applying months the pull is mostly mood…"
- **transit:neptune:square:jupiter** — 82% the same sentence as transit:uranus:square:saturn: "in the applying months this is mostly mood…" vs "in the applying months the tension is mostly mood…"

### b2-transits-neptune-3.json

- **transit:neptune:opposition:uranus** — 82% the same sentence as transit:neptune:square:jupiter: "in the applying months the pull is mostly mood…" vs "in the applying months this is mostly mood…"
- **transit:neptune:opposition:uranus** — 89% the same sentence as transit:uranus:square:saturn: "in the applying months the pull is mostly mood…" vs "in the applying months the tension is mostly mood…"

### b2-transits-neptune-4.json

- **transit:neptune:trine:pluto** — 88% the same sentence as transit:saturn:trine:pluto: "because the trine does not force anything its main…" vs "because the trine does not force anything its main…"
- **transit:neptune:square:pluto** — 83% the same sentence as transit:neptune:conjunction:moon: "most people meet this square once in a lifetime if…" vs "most people experience this conjunction once in a …"

### b2-transits-node-mars-jupiter.json

- **transit:mars:square:true_node** — 86% the same sentence as transit:uranus:square:mercury: "a square forces it does not invite…" vs "the square forces it does not invite…"

### b2-transits-node-mercury-venus.json

- **transit:mercury:opposition:true_node** — 82% the same sentence as transit:jupiter:opposition:venus: "while the aspect applies the pull of the familiar …" vs "while the aspect applies the pull builds…"
- **transit:mercury:conjunction:true_node** — 89% the same sentence as transit:mars:sextile:saturn: "the growth this transit offers is modest and real…" vs "the growth in this transit is modest and real…"
- **transit:mercury:conjunction:true_node** — 83% the same sentence as transit:saturn:conjunction:saturn: "the first pass raises the subject…" vs "the first pass raises the question…"

### b2-transits-node-neptune-pluto.json

- **transit:neptune:conjunction:true_node** — 86% the same sentence as transit:jupiter:conjunction:venus: "around the exact pass the pull peaks…" vs "around the exact pass the warmth peaks…"
- **transit:neptune:conjunction:true_node** — 86% the same sentence as transit:jupiter:square:mars: "around the exact pass the pull peaks…" vs "around the exact pass the pressure peaks…"
- **transit:neptune:conjunction:true_node** — 86% the same sentence as transit:jupiter:conjunction:pluto: "around the exact pass the pull peaks…" vs "around the exact pass the drive peaks…"
- **transit:neptune:opposition:true_node** — 82% the same sentence as transit:pluto:square:uranus: "nostalgia is the first sign of this transit…" vs "restlessness is usually the first sign of this tra…"

### b2-transits-node-sun-moon.json

- **transit:sun:conjunction:true_node** — 86% the same sentence as transit:mars:conjunction:sun: "at the exact pass the theme peaks…" vs "at the exact pass the drive peaks…"
- **transit:sun:conjunction:true_node** — 86% the same sentence as transit:mars:opposition:neptune: "at the exact pass the theme peaks…" vs "at the exact pass the confusion peaks…"
- **transit:sun:conjunction:true_node** — 86% the same sentence as transit:mercury:conjunction:pluto: "at the exact pass the theme peaks…" vs "at the exact pass the intensity peaks…"
- **transit:sun:conjunction:true_node** — 86% the same sentence as transit:sun:conjunction:venus: "at the exact pass the theme peaks…" vs "at the exact pass the warmth peaks…"
- **transit:sun:conjunction:true_node** — 86% the same sentence as transit:sun:conjunction:uranus: "at the exact pass the theme peaks…" vs "at the exact pass the static peaks…"

### b2-transits-pluto-1.json

- **transit:pluto:sextile:moon** — 83% the same sentence as transit:pluto:trine:moon: "around the exact contacts which plutos slow loops …" vs "around the exact passes which plutos slow loops ca…"
- **transit:pluto:trine:moon** — 83% the same sentence as transit:pluto:sextile:moon: "around the exact passes which plutos slow loops ca…" vs "around the exact contacts which plutos slow loops …"
- **transit:pluto:sextile:moon** — 94% the same sentence as transit:pluto:sextile:mercury: "around the exact contacts which plutos slow loops …" vs "around the exact contacts which plutos slow loops …"
- **transit:pluto:sextile:mercury** — 94% the same sentence as transit:pluto:sextile:moon: "around the exact contacts which plutos slow loops …" vs "around the exact contacts which plutos slow loops …"
- **transit:pluto:sextile:moon** — 83% the same sentence as transit:pluto:trine:mercury: "around the exact contacts which plutos slow loops …" vs "around the exact passes which plutos slow loops ca…"
- **transit:pluto:trine:mercury** — 83% the same sentence as transit:pluto:sextile:moon: "around the exact passes which plutos slow loops ca…" vs "around the exact contacts which plutos slow loops …"
- **transit:pluto:trine:moon** — 83% the same sentence as transit:pluto:sextile:mercury: "around the exact passes which plutos slow loops ca…" vs "around the exact contacts which plutos slow loops …"
- **transit:pluto:sextile:mercury** — 83% the same sentence as transit:pluto:trine:moon: "around the exact contacts which plutos slow loops …" vs "around the exact passes which plutos slow loops ca…"
- **transit:pluto:trine:moon** — 94% the same sentence as transit:pluto:trine:mercury: "around the exact passes which plutos slow loops ca…" vs "around the exact passes which plutos slow loops ca…"
- **transit:pluto:trine:mercury** — 94% the same sentence as transit:pluto:trine:moon: "around the exact passes which plutos slow loops ca…" vs "around the exact passes which plutos slow loops ca…"
- **transit:pluto:sextile:mercury** — 83% the same sentence as transit:pluto:trine:mercury: "around the exact contacts which plutos slow loops …" vs "around the exact passes which plutos slow loops ca…"
- **transit:pluto:trine:mercury** — 83% the same sentence as transit:pluto:sextile:mercury: "around the exact passes which plutos slow loops ca…" vs "around the exact contacts which plutos slow loops …"
- **transit:pluto:conjunction:moon** — 83% the same sentence as transit:pluto:conjunction:mercury: "around the exact passes and plutos retrograde loop…" vs "around the exact passes and plutos loops can produ…"
- **transit:pluto:conjunction:mercury** — 83% the same sentence as transit:pluto:conjunction:moon: "around the exact passes and plutos loops can produ…" vs "around the exact passes and plutos retrograde loop…"
- **transit:pluto:opposition:moon** — 95% the same sentence as transit:pluto:opposition:mercury: "around the exact contacts and plutos loops can bri…" vs "around the exact contacts and plutos loops can bri…"
- **transit:pluto:opposition:mercury** — 95% the same sentence as transit:pluto:opposition:moon: "around the exact contacts and plutos loops can bri…" vs "around the exact contacts and plutos loops can bri…"
- **transit:pluto:opposition:moon** — 84% the same sentence as transit:pluto:square:mercury: "around the exact contacts and plutos loops can bri…" vs "around the exact hits and plutos retrograde motion…"
- **transit:pluto:square:mercury** — 84% the same sentence as transit:pluto:opposition:moon: "around the exact hits and plutos retrograde motion…" vs "around the exact contacts and plutos loops can bri…"
- **transit:pluto:opposition:sun** — 89% the same sentence as transit:pluto:trine:moon: "this opposition comes at most once in a life…" vs "this trine comes at most once in a life…"
- **transit:pluto:trine:moon** — 89% the same sentence as transit:pluto:opposition:sun: "this trine comes at most once in a life…" vs "this opposition comes at most once in a life…"
- **transit:pluto:opposition:sun** — 89% the same sentence as transit:pluto:square:mercury: "this opposition comes at most once in a life…" vs "this square comes at most once in a life…"
- **transit:pluto:square:mercury** — 89% the same sentence as transit:pluto:opposition:sun: "this square comes at most once in a life…" vs "this opposition comes at most once in a life…"
- **transit:pluto:sextile:moon** — 93% the same sentence as transit:pluto:sextile:mercury: "this aspect of pluto to your moon comes at most on…" vs "this aspect of pluto to your mercury comes at most…"
- **transit:pluto:sextile:mercury** — 93% the same sentence as transit:pluto:sextile:moon: "this aspect of pluto to your mercury comes at most…" vs "this aspect of pluto to your moon comes at most on…"
- **transit:pluto:trine:moon** — 89% the same sentence as transit:pluto:square:mercury: "this trine comes at most once in a life…" vs "this square comes at most once in a life…"
- **transit:pluto:square:mercury** — 89% the same sentence as transit:pluto:trine:moon: "this square comes at most once in a life…" vs "this trine comes at most once in a life…"
- **transit:pluto:conjunction:moon** — 80% the same sentence as transit:pluto:opposition:moon: "around the exact passes and plutos retrograde loop…" vs "around the exact contacts and plutos loops can bri…"
- **transit:pluto:opposition:moon** — 80% the same sentence as transit:pluto:conjunction:moon: "around the exact contacts and plutos loops can bri…" vs "around the exact passes and plutos retrograde loop…"
- **transit:pluto:conjunction:moon** — 80% the same sentence as transit:pluto:opposition:mercury: "around the exact passes and plutos retrograde loop…" vs "around the exact contacts and plutos loops can bri…"
- **transit:pluto:opposition:mercury** — 80% the same sentence as transit:pluto:conjunction:moon: "around the exact contacts and plutos loops can bri…" vs "around the exact passes and plutos retrograde loop…"
- **transit:pluto:square:sun** — 86% the same sentence as transit:pluto:opposition:sun: "around the exact hits the confrontation peaks…" vs "around the exact hits the standoff peaks…"
- **transit:pluto:opposition:sun** — 86% the same sentence as transit:pluto:square:sun: "around the exact hits the standoff peaks…" vs "around the exact hits the confrontation peaks…"

### b2-transits-pluto-2.json

- **transit:pluto:conjunction:mars** — 86% the same sentence as transit:pluto:trine:mars: "around the exact contacts the drive peaks…" vs "around the exact contacts the capacity peaks…"
- **transit:pluto:trine:mars** — 86% the same sentence as transit:pluto:conjunction:mars: "around the exact contacts the capacity peaks…" vs "around the exact contacts the drive peaks…"
- **transit:pluto:square:mars** — 86% the same sentence as transit:saturn:square:chiron: "the square forces it does not negotiate…" vs "the square forces it does not ask…"
- **transit:pluto:square:mars** — 86% the same sentence as transit:uranus:square:mercury: "the square forces it does not negotiate…" vs "the square forces it does not invite…"
- **transit:pluto:square:mars** — 88% the same sentence as transit:saturn:square:pluto: "the square forces it does not negotiate…" vs "the square forces an issue it does not negotiate…"

### b2-transits-pluto-3.json

- **transit:pluto:conjunction:saturn** — 92% the same sentence as transit:pluto:conjunction:uranus: "because pluto retrogrades it can cross this point …" vs "because pluto retrogrades it can cross this degree…"
- **transit:pluto:conjunction:uranus** — 92% the same sentence as transit:pluto:conjunction:saturn: "because pluto retrogrades it can cross this degree…" vs "because pluto retrogrades it can cross this point …"
- **transit:pluto:square:uranus** — 80% the same sentence as transit:jupiter:square:sun: "restlessness is usually the first sign of this tra…" vs "restlessness is usually the first sign…"
- **transit:pluto:conjunction:saturn** — 86% the same sentence as transit:neptune:conjunction:venus: "around the exact passes the pressure peaks…" vs "around the exact passes the longing peaks…"
- **transit:pluto:square:uranus** — 82% the same sentence as transit:neptune:opposition:true_node: "restlessness is usually the first sign of this tra…" vs "nostalgia is the first sign of this transit…"

### b2-transits-pluto-4.json

- **transit:pluto:opposition:chiron** — 87% the same sentence as transit:saturn:square:sun: "it is tempting to read all this as bad luck in oth…" vs "it is tempting to read all this as bad luck…"

### b2-transits-saturn-1.json

- **transit:saturn:conjunction:moon** — 82% the same sentence as transit:venus:conjunction:chiron: "none of this means your life is going wrong…" vs "none of this means anything is going wrong…"
- **transit:saturn:square:sun** — 87% the same sentence as transit:pluto:opposition:chiron: "it is tempting to read all this as bad luck…" vs "it is tempting to read all this as bad luck in oth…"
- **transit:saturn:trine:sun** — 86% the same sentence as transit:mercury:trine:jupiter: "ease invites coasting and a trine spent coasting l…" vs "ease invites coasting and a coasted trine leaves n…"

### b2-transits-saturn-2.json

- **transit:saturn:conjunction:venus** — 81% the same sentence as transit:uranus:conjunction:sun: "because saturn retrogrades it can touch this degre…" vs "because uranus retrogrades it can cross this degre…"

### b2-transits-saturn-3.json

- **transit:saturn:conjunction:uranus** — 81% the same sentence as transit:uranus:conjunction:sun: "because saturn retrogrades it may cross this point…" vs "because uranus retrogrades it can cross this degre…"
- **transit:saturn:conjunction:saturn** — 83% the same sentence as transit:jupiter:conjunction:venus: "the final pass settles the matter usually more qui…" vs "the final pass settles the question usually more g…"
- **transit:saturn:conjunction:saturn** — 83% the same sentence as transit:mercury:conjunction:true_node: "the first pass raises the question…" vs "the first pass raises the subject…"

### b2-transits-saturn-4.json

- **transit:saturn:square:chiron** — 86% the same sentence as transit:jupiter:conjunction:sun: "the timing has a shape worth knowing…" vs "the transit has a shape worth knowing…"
- **transit:saturn:square:chiron** — 96% the same sentence as transit:neptune:square:mercury: "ask the question you think you should already know…" vs "ask the question you think you already know the an…"
- **transit:saturn:trine:pluto** — 88% the same sentence as transit:neptune:trine:pluto: "because the trine does not force anything its main…" vs "because the trine does not force anything its main…"
- **transit:saturn:square:chiron** — 86% the same sentence as transit:pluto:square:mars: "the square forces it does not ask…" vs "the square forces it does not negotiate…"
- **transit:saturn:square:chiron** — 86% the same sentence as transit:uranus:square:mercury: "the square forces it does not ask…" vs "the square forces it does not invite…"
- **transit:saturn:square:pluto** — 88% the same sentence as transit:pluto:square:mars: "the square forces an issue it does not negotiate…" vs "the square forces it does not negotiate…"

### b2-transits-sun-2.json

- **transit:sun:conjunction:venus** — 86% the same sentence as transit:jupiter:conjunction:venus: "at the exact pass the warmth peaks…" vs "around the exact pass the warmth peaks…"
- **transit:sun:conjunction:venus** — 86% the same sentence as transit:mars:conjunction:sun: "at the exact pass the warmth peaks…" vs "at the exact pass the drive peaks…"
- **transit:sun:conjunction:venus** — 86% the same sentence as transit:mars:opposition:neptune: "at the exact pass the warmth peaks…" vs "at the exact pass the confusion peaks…"
- **transit:sun:conjunction:venus** — 86% the same sentence as transit:mercury:conjunction:pluto: "at the exact pass the warmth peaks…" vs "at the exact pass the intensity peaks…"
- **transit:sun:conjunction:venus** — 86% the same sentence as transit:sun:conjunction:true_node: "at the exact pass the warmth peaks…" vs "at the exact pass the theme peaks…"
- **transit:sun:conjunction:venus** — 86% the same sentence as transit:sun:conjunction:uranus: "at the exact pass the warmth peaks…" vs "at the exact pass the static peaks…"
- **transit:sun:square:jupiter** — 86% the same sentence as transit:venus:square:jupiter: "the useful discipline is delay not denial…" vs "the useful practice is delay not denial…"

### b2-transits-sun-3.json

- **transit:sun:conjunction:uranus** — 86% the same sentence as transit:mars:conjunction:sun: "at the exact pass the static peaks…" vs "at the exact pass the drive peaks…"
- **transit:sun:conjunction:uranus** — 86% the same sentence as transit:mars:opposition:neptune: "at the exact pass the static peaks…" vs "at the exact pass the confusion peaks…"
- **transit:sun:conjunction:uranus** — 86% the same sentence as transit:mercury:conjunction:pluto: "at the exact pass the static peaks…" vs "at the exact pass the intensity peaks…"
- **transit:sun:conjunction:uranus** — 86% the same sentence as transit:sun:conjunction:true_node: "at the exact pass the static peaks…" vs "at the exact pass the theme peaks…"
- **transit:sun:conjunction:uranus** — 86% the same sentence as transit:sun:conjunction:venus: "at the exact pass the static peaks…" vs "at the exact pass the warmth peaks…"

### b2-transits-sun-4.json

- **transit:sun:conjunction:pluto** — 83% the same sentence as transit:mars:conjunction:pluto: "as the sun separates the intensity drains off quic…" vs "as mars separates the charge drains off and you ca…"

### b2-transits-uranus-1.json

- **transit:uranus:conjunction:sun** — 84% the same sentence as transit:uranus:conjunction:venus: "because uranus retrogrades it can cross this degre…" vs "because uranus retrogrades it can cross this point…"
- **transit:uranus:conjunction:sun** — 81% the same sentence as transit:neptune:conjunction:venus: "because uranus retrogrades it can cross this degre…" vs "because neptune retrogrades it usually touches thi…"
- **transit:uranus:conjunction:sun** — 81% the same sentence as transit:saturn:conjunction:venus: "because uranus retrogrades it can cross this degre…" vs "because saturn retrogrades it can touch this degre…"
- **transit:uranus:conjunction:sun** — 81% the same sentence as transit:saturn:conjunction:uranus: "because uranus retrogrades it can cross this degre…" vs "because saturn retrogrades it may cross this point…"
- **transit:uranus:square:mercury** — 86% the same sentence as transit:mars:square:true_node: "the square forces it does not invite…" vs "a square forces it does not invite…"
- **transit:uranus:square:mercury** — 86% the same sentence as transit:pluto:square:mars: "the square forces it does not invite…" vs "the square forces it does not negotiate…"
- **transit:uranus:square:mercury** — 86% the same sentence as transit:saturn:square:chiron: "the square forces it does not invite…" vs "the square forces it does not ask…"
- **transit:uranus:opposition:sun** — 92% the same sentence as transit:uranus:square:venus: "the third settles the new terms…" vs "the third pass settles the new terms…"

### b2-transits-uranus-2.json

- **transit:uranus:conjunction:venus** — 84% the same sentence as transit:uranus:conjunction:sun: "because uranus retrogrades it can cross this point…" vs "because uranus retrogrades it can cross this degre…"
- **transit:uranus:sextile:venus** — 82% the same sentence as transit:neptune:sextile:jupiter: "little in this period is dramatic and that is its …" vs "little about this transit is dramatic and that is …"
- **transit:uranus:square:mars** — 83% the same sentence as transit:uranus:conjunction:jupiter: "the first pass springs the conflict…" vs "the first pass springs the surprise…"
- **transit:uranus:conjunction:jupiter** — 83% the same sentence as transit:uranus:square:mars: "the first pass springs the surprise…" vs "the first pass springs the conflict…"
- **transit:uranus:square:venus** — 92% the same sentence as transit:uranus:opposition:sun: "the third pass settles the new terms…" vs "the third settles the new terms…"

### b2-transits-uranus-3.json

- **transit:uranus:trine:saturn** — 95% the same sentence as transit:jupiter:trine:chiron: "the one weakness of the period is its comfort…" vs "the one weakness of the period is its own comfort…"
- **transit:uranus:square:saturn** — 82% the same sentence as transit:neptune:square:jupiter: "in the applying months the tension is mostly mood…" vs "in the applying months this is mostly mood…"
- **transit:uranus:square:saturn** — 89% the same sentence as transit:neptune:opposition:uranus: "in the applying months the tension is mostly mood…" vs "in the applying months the pull is mostly mood…"

### b2-transits-venus-1.json

- **transit:venus:conjunction:mercury** — 83% the same sentence as transit:venus:conjunction:jupiter: "the arc is brief and pleasant…" vs "the arc is brief and friendly…"

### b2-transits-venus-2.json

- **transit:venus:square:jupiter** — 86% the same sentence as transit:sun:square:jupiter: "the useful practice is delay not denial…" vs "the useful discipline is delay not denial…"
- **transit:venus:conjunction:jupiter** — 83% the same sentence as transit:venus:conjunction:mercury: "the arc is brief and friendly…" vs "the arc is brief and pleasant…"

### b2-transits-venus-3.json

- **transit:venus:sextile:saturn** — 82% the same sentence as transit:venus:trine:pluto: "the arc of this transit is gentle…" vs "the arc of this transit is gentle at every stage…"
- **transit:venus:opposition:saturn** — 86% the same sentence as transit:mercury:opposition:mars: "the coolness in this transit tends to arrive weari…" vs "this transit tends to arrive wearing someone elses…"

### b2-transits-venus-4.json

- **transit:venus:trine:pluto** — 82% the same sentence as transit:venus:sextile:saturn: "the arc of this transit is gentle at every stage…" vs "the arc of this transit is gentle…"
- **transit:venus:trine:chiron** — 86% the same sentence as transit:jupiter:trine:moon: "the arc stays soft at every stage…" vs "the arc is soft at every stage…"
- **transit:venus:conjunction:chiron** — 82% the same sentence as transit:mars:conjunction:neptune: "none of this means anything is going wrong…" vs "none of this means anything is wrong with you…"
- **transit:venus:conjunction:chiron** — 82% the same sentence as transit:saturn:conjunction:moon: "none of this means anything is going wrong…" vs "none of this means your life is going wrong…"

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
