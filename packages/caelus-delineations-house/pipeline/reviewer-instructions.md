# B1 adversarial review — instructions

You are the adversarial reviewer (proposal §6, pass 5) for a scope of the
Caelus Free corpus (`caelus-delineations-house`). Your job is to try to
fail entries against four tests, fix what you can fix without changing an
entry's meaning, and report what needs a judgment call.

## Read first

1. `pipeline/voice-sheet.md`
2. `editorial/editorial-voice.md` (incl. the Caelus Free section)
3. Your assigned passage files (given in your task), every entry, fully.

## The four tests, per entry

1. **Accuracy against the tradition.** Does the essay say what the
   well-trodden canon (Hand, Pelletier, Sakoian/Acker, Greene, modern
   psychological astrology) actually says about this configuration? Flag
   invented doctrine, wrong dignity/sign attributions, and claims the
   selector does not guarantee (a planet-in-sign essay claiming a house,
   an aspect essay claiming a sign, biography stated as fact).
2. **Voice.** Second person, plain speech, varied rhythm, no machine
   cadence, no flattery, no posturing. An entry that reads as keyword
   expansion instead of considered writing fails.
3. **Safety.** Non-fatalistic with full weight: no verdicts, no doom, no
   medical/financial/legal directives; sensitive material (substances,
   grief, abuse, money) descriptive only. Also: no gendered assumptions
   presented as fact (e.g. "your mother" for Moon material should allow
   "a parent or early caretaker"), and era/generation textures must not
   claim birth decades the selector cannot know.
4. **Depth against the Hand standard.** Theme first, then the life areas
   it actually touches, ending on growth without a moral. An essay that
   never leaves generality fails.

## What you may fix directly

Wording-level repairs that keep the entry's meaning: softening a verdict
into a tendency, degendering a caretaker line, cutting an unguaranteed
claim, replacing a formulaic opening, tightening filler. Edit the JSON
text in place. NEVER touch `id`, `family`, `when`, or `atomIds`. Keep
every entry inside its family's length band (see LENGTH_BANDS in
`src/types.ts`) and the other lints (no em dashes, FK grade <= 12, banned
phrases per `src/lint.ts` BANNED_PHRASES).

## What you must NOT do

Do not rewrite entries wholesale, delete entries, change bindings, or
impose your own astrology against the canon. If an entry needs a rewrite
rather than a repair, leave it as is and report it.

## After editing

Other reviewers run concurrently, so do NOT run the package build or
test (shared dist). Instead lint exactly the files you touched:

```
node pipeline/check-texts.mjs <file.json> [...]
```

It must print `texts ok`. If your edit trips a lint, fix your edit.

## Report

A compact list: entries you repaired (id + one clause on what), entries
that need a judgment call or full rewrite (id + why), and a one-line
verdict per file scope ("clears the bar" / "clears with the fixes" /
"needs rework"). No praise, no summary of the astrology.
