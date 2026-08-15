# Editorial voice — Caelus

Technical writing for docs, web copy, and package READMEs. Adapted from the Mystery Schools editorial export; tuned for astrology computation, not a podcast.

## Register

Dry engineer explaining a hard problem to a peer who builds software. State what was built, how it was verified, and where the limits are. No pitch, no manifesto, no performed wit.

**Sound like:** Dan Luu, a good internal design doc, a terse release note with numbers attached.

**Not like:** a YC landing page, a professor lecturing, an AI assistant performing confidence, marketing copy manufacturing urgency.

## Sentence mechanics

- Prefer 12–22 words. One idea per sentence.
- **Write sentences.** Every sentence needs a subject and a finite verb. "Two-stage CI." and "Fix: fit geometric states." are notes to self, not prose. This rule outranks brevity: a 22-word sentence that reads like English beats three four-word fragments that read like a changelog.
- Terse is not the same as clipped. Aim for the register of a well-written paper or design doc, where short sentences sit inside connected paragraphs, not a stack of standalone assertions.
- Active voice. Name the subject: **Caelus** in prose, `caelus` for the npm package and import paths, `the suite`, `Swiss Ephemeris` — not `the project` or `this approach`.
- Concrete before abstract. Lead with the bug, the measurement, or the source.
- Technical terms: define once, then reuse (`ΔT`, `VSOP87D`, `golden fixture`).

## Don't posture

The engine's credibility comes from the tables, so the prose does not need to
carry any swagger. Three habits to avoid:

- **The antithesis flex.** "published on Validation, not asserted", "validated against a named authority, not memory", "The engine was fine; the MCP search was wrong." State what is true and stop; the reader does not need the rejected alternative.
- **The bragging fragment.** "The counts are exact." "A red run blocks merge." "AI writes like AI." These read as a performance of confidence rather than a statement of fact. Say the same thing in a sentence that explains the mechanism.
- **Slogan closers.** "The meaning is always yours and always traceable to a fact." "It computes; you interpret." If a line would look at home on a landing-page banner, cut it.

Fragments are legitimate in table cells, card blurbs, bullet labels, figure
captions, and one-word FAQ openers ("Yes."). They are not legitimate in body
paragraphs.

## Cut on sight

- Filler: "it's important to note," "it's worth considering," "one might argue."
- Intensifiers without data: "remarkable," "extraordinary," "flawless," "game-changing."
- Meta-commentary: "this is what makes Caelus unique," "the lesson generalizes," "what this buys you."
- Punchy closers: "Every layer needs its own referee," "full stop," "mail to Zurich."
- AI vocabulary: `landscape`, `delve`, `unpack`, `multifaceted`, `testament`, `beacon`, `tapestry`, `resonates`, `pivotal`, `holistic`, `comprehensive overview`.
- Em-dash chains. Use commas, colons, or a second sentence.

## Epistemic levels

| Level | How to write it |
|-------|-----------------|
| Measured fact | State the number and source |
| Engine limit | "VSOP87 theory limit," "embedded Moon tier 1920–2080" |
| Comparison | "Swiss Ephemeris 2.10 at N random instants" — give N or "hundreds" |
| Open question | Name it; don't fake closure |

Never dress conviction as measurement. Never dress marketing as engineering.

## Web pages

- Headings and nav: normal title case (`Build Notes`, `What This Is`). **Caelus** capitalized as a proper noun in prose; **`caelus`** lowercase only for npm package names, CLI commands, and code.
- Emoji: allowed in home-page hero bullets and CTA labels only. Never in body prose, docs, or the other pages.
- **Playground (`/`)**: one sentence on what it does; links to proof, not adjectives.
- **Provenance (`/provenance`)**: table of sources; AGPL facts without sermonizing.
- **Validation (`/validation`)**: tables and commands; CI is a fact, not a slogan.
- **Build Notes (`/notes`)**: postmortems with symptoms → cause → fix → test that caught it.

## For agents

1. Read this file before editing user-facing prose under `apps/web/` or `docs/`.
2. Run `npm run lint:prose` before finishing a copy pass.
3. Mechanical fixes (banned phrases, em dashes) are yours. Tone rewrites that need judgment: propose, don't silently manifesto-ize.
4. Prefer deleting a sentence over adding a clever one.
