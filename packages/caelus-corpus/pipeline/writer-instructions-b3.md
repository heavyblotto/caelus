# B3 writer slice — instructions (synastry, overlays, composite)

You are writing one slice of the Caelus Free interpretation corpus
(`caelus-corpus`), batch B3: two charts against each other.
Everything in `pipeline/writer-instructions.md` applies (read it first,
along with `pipeline/voice-sheet.md` and `editorial/editorial-voice.md`);
this sheet adds the rules specific to relationship prose.

## What a B3 entry is

A natal essay describes one person. A B3 entry describes **what happens
between two people** when their charts are laid over each other. The
reader is one of the two: address them as "you" and the other person as
"they" or "them", never by a gendered pronoun and never as "your
partner" unless the cell is about partnership. The relationship may be
a marriage, a friendship, a sibling bond, a working partnership, a
parent and child. **Do not assume romance, cohabitation, or exclusivity
anywhere the cell does not name it.**

The other rule that governs this whole batch: **contact is not
compatibility.** The tradition's language of "good" and "bad" synastry
is the single worst habit in consumer astrology, and this corpus does
not have it. An aspect between two charts describes a *kind of
exchange*, not a verdict on the relationship. Hard contacts describe
friction that is also traction. Soft contacts describe ease that can
also be inertia. No entry may tell a reader to leave, stay, pursue, or
avoid anyone.

## Family-specific rules

**synastry-aspect** (250–650 words). The selector guarantees YOUR body,
THEIR body, and the aspect between them. It guarantees nothing about
signs, houses, orbs, or who is older, richer, or more invested.

- The pairs are **ordered**: "your Mars square their Venus" is a
  different entry from "your Venus square their Mars", and the two read
  differently, because the roles differ. Write yours from the reader's
  side: what their body does to yours, and what yours does in return.
  Do not write a symmetric essay that would serve either direction.
- The same-body pairs (your Sun to their Sun, your Moon to their Moon)
  describe two people running the same function at an angle to each
  other: the recognition and the competition in that.
- Keep each aspect's character distinct: conjunction fuses, sextile
  offers, square forces, trine eases, opposition confronts and
  completes. Say what the fusion or the friction is *about* for this
  pair of bodies.
- Name the exchange concretely. "Your Mercury trine their Jupiter" is
  not "you communicate well": it is what one person's way of thinking
  does to the other's sense of scope, and what that feels like in a
  conversation, an argument, a plan.

**synastry-overlay** (200–500 words). The selector guarantees YOUR body
and THEIR house it falls in. This is the "where you land in their life"
fact: your Venus in their 10th house sits on their career and public
standing, whatever your two charts otherwise do. Write it from the
reader's side but honestly two-sided: what the other person tends to
experience with you there, and what you tend to get from occupying that
part of their life. The reverse direction (their body in your house) is
the same set of essays read from the other chair, so do not write "and
of course the same is true in reverse" — the app shows that view
separately.

**composite-placement** (200–500 words). The composite chart is the
midpoint chart: not you, not them, but the *relationship itself* as a
third thing with its own chart. Write in a distinct voice from the
other two families: the subject is "the relationship", "what the two of
you make together", "this bond", not "you". The selector guarantees the
composite body and its sign. Say what that function looks like in the
relationship as an entity: composite Mercury in Gemini is how the pair
talks *as a pair*, the register their conversation settles into, not
how either person thinks alone. Note where useful that a composite
chart says nothing about whether the relationship lasts, which is the
question readers bring to it and the one it cannot answer.

**composite-aspect** (200–500 words). The composite chart has a geometry of
its own, and this family reads it the way the natal aspect family reads a
birth chart — except that the subject is the relationship, not a person.
Composite Mars square composite Saturn is a friction *inside the bond*: a
recurring collision between what the pair goes after and what the pair takes
seriously, felt by both and owned by neither. Write in the composite voice
("the relationship", "this bond", "the two of you together"), never "you".

- No phase. The engine reports no applying or separating on a composite
  aspect, because a midpoint composite is a static figure with no motion.
  Never write that something in a composite is "building", "tightening",
  "coming to a head", or "wearing off".
- The pairs are unordered: composite Sun square composite Saturn is one
  entry, and it has no reverse.
- The two-people warning applies harder here than anywhere: a composite
  aspect is not a score. A composite square does not mean the relationship
  is doomed and a composite trine does not mean it will last.

**composite-house** (200–500 words). The composite chart's own twelve
houses: which area of the relationship's shared life a body sits in. Same
composite voice as the placements — the subject is the bond, not either
person. One thing every entry in this family must respect: a midpoint
composite has no moment and no place, so its houses are a **convention**,
derived here from the midpoint of the two Ascendants with equal houses from
there. Write the house's meaning confidently, but never claim the house is a
fact about the pair the way a sign is; where a cell's whole weight rests on
the house being exactly right, say so. These cells fire only when both birth
times are known.

## The bodies, in one line each

The role each body plays when you write it, in this batch's voice:

| Body | What it is |
|---|---|
| Sun | identity, vitality, what wants to be recognized |
| Moon | needs, comfort, the reflex of feeling and habit |
| Mercury | thinking, talking, sorting information |
| Venus | what is valued, how pleasure and regard are given |
| Mars | wanting, acting, fighting |
| Jupiter | what is enlarged, believed, permitted |
| Saturn | what is taken seriously, limited, held to account |
| Uranus | what is disrupted, freed, refused |
| Neptune | what is idealized, dissolved, imagined |
| Pluto | what is intensified, exposed, not left small |
| Chiron | where the sore place is, and where it can teach |
| North Node | the direction of growth, the unfamiliar road |

## Facts you may rely on (and no others)

The selector's own fields, and general body meanings. Never: the
relationship's type, length, or exclusivity; either person's gender,
age, orientation, family shape, income, or whether they live together;
who "leads"; whether there are children. Hedge every biographical
detail. Degender every reference to partners, parents, and caretakers.
No advice about staying, leaving, or pursuing; no medical, financial,
or legal counsel.

## Output and self-check

Same as B1: JSON array in brief order with exactly the keys
`id`, `family`, `when`, `atomIds`, `text` (verbatim from the brief
except `text`), then

```
node pipeline/check-slice.mjs <your-brief-path> <your-output-path>
```

until it prints `slice ok`. Report one line: slice name, entry count,
check passed, plus anything worth flagging.
