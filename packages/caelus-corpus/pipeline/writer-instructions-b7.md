# B7 writer slice — instructions (birth-time finder bank)

You are writing one slice of the Caelus Free birth-time finder bank
(`caelus-corpus`, batch B7). These entries are not
delineations: they are the questions and prompts the finder shows a
reader who does not know their birth time. The finder sweeps the birth
day, finds the possible rising signs, and needs (a) fit descriptions a
reader can say yes or no to, and (b) event prompts whose dates it can
check against the chart's angles.

Everything in `pipeline/voice-sheet.md` and `editorial/editorial-voice.md`
still applies: second person, plain speech, no insider vocabulary, no
em dashes, the banned-phrase list, FK grade 12 or under, and the
4-gram duplication cap inside each family. Copy `id`, `family`, `when`,
`atomIds` verbatim from the brief.

## finder-rising-fit (12 entries, 60–180 words each)

One entry per rising sign. The reader sees it under the question "Does
this sound like you?" and answers yes, no, or not sure. Write the
description so a stranger could honestly disagree with it:

- Describe **manner**: how the person enters a room, opens a
  conversation, meets a stranger, starts a task. The rising sign is
  the meeting-the-world layer, not the whole character, and the entry
  should read that way.
- **No physical appearance claims** (no build, features, coloring).
  Behavior and first impressions only.
- **Make them discriminating.** These twelve are shown against each
  other; an entry that flatters everyone is useless as evidence. Each
  should contain at least one concrete tell a person could say
  "no, that's not me" to. Do not reuse the same sentence skeleton
  across entries; the duplication lint runs inside the family.
- End with a line the reader can weigh, not a summary.

## finder-event-angle (28 entries, 40–140 words each)

One entry per dateable life-event class. The reader sees it as a card
asking whether this kind of event has happened to them and, if so,
when. The finder then checks the date against the chart's angles. Each
entry does two things, briefly:

1. Asks for the event and its date in plain, kind words. These touch
   real losses (a parent's death, a breakup, a lost home), so ask the
   way a considerate person would, without drama and without hedging
   into vagueness.
2. Says in one sentence why the date helps: this kind of event tends
   to arrive when the moving sky crosses a particular corner of the
   chart, and a good date sharpens the search. Name the life area
   (career, home, self, partners), never the astrological jargon
   ("Midheaven", "IC", "angle", "transit" all stay off the card).

The title in your brief names the event class; keep your text consistent
with it. Vary the asking shape across entries: some lead with the
question, some with the reason. The duplication lint runs inside the
family, and 28 short entries collide fast if you use one template.

## Output and self-check

JSON array in brief order, exactly the keys `id`, `family`, `when`,
`atomIds`, `text`, then

```
node pipeline/check-slice.mjs <your-brief-path> <your-output-path>
```

until it prints `slice ok`. Report one line: slice name, entry count,
check passed, plus anything worth flagging.
