# Editorial voice — Caelus

Technical writing guidelines for Caelus documentation, website copy, and package READMEs.

## Register

Write clear, direct developer documentation in the style of Stripe, Astro, or MDN. Aim for helpful, accurate prose that explains how the software works, what inputs a function expects, and what limits apply, without trying to sound clever, literary, or terse for effect.

**Target qualities:**

- **Direct and helpful:** Open each guide and section by explaining what the feature or function does, what problems it solves, and how to use it.
- **Precise:** Use standard technical and astronomical terms consistently (`location` or `observer coordinates`, `date and time` or `timestamp` alongside `Julian Day`, `function call`, `ephemeris tier`, `uncertainty interval`).
- **Natural flow:** Vary sentence length and connect ideas with clear transitions (`because`, `so`, `when`, `while`, `if`, `for example`).

**Avoid:**

- Cryptic riddle openers ("A chart goes from an instant to positions. `dateSky` goes the other way.")
- Pseudo-poetic or vague phrasing ("where a search ran dry", "what one constraint left standing", "smeared by the clock", "the text it licenses", "what one place sees")
- Choppy, clipped fragments ("Higher is better.", "Two-stage CI.", "It keeps them apart, because they are different kinds of number.")
- Combative swagger ("`chartAt` silently asserts a real instant at a real place. That is wrong for most interesting cases.")
- Marketing hype or AI filler (`seamless`, `robust`, `leverage`, `delve`, `tapestry`, `testament`, `game-changing`)

## Sentence mechanics

1. **Write complete, natural paragraphs.** Every sentence should have a subject and finite verb, except inside table cells, bullet labels, card blurbs, and figure captions. Do not break one clear thought into two or three staccato fragments just to keep word count down.
2. **Use clear causal and conditional connectors.** When one idea explains or qualifies another, join them explicitly (`because`, `so`, `although`, `when`, `while`) instead of defaulting to flat `, and` splices.
3. **Prefer concrete terms over faux-simple nouns.** "Location" or "coordinates" is clearer than "a place"; "date and time" or "timestamp" is clearer than repeating "an instant"; "function" or "call" is clearer than "the call" when talking about code.
4. **Lead with the user's goal or concrete behavior.** Explain what a tool or API does before discussing edge cases or internal implementation details.
5. **Use active voice and accurate subjects.** Name the actual actor (`Caelus`, `caelus`, `the ephemeris solver`, `the validation suite`, `Swiss Ephemeris`). Do not anthropomorphize code, documentation, or test suites with verbs like `knows`, `wants`, `decides`, `refuses`, or `learns`.

## Before and after examples

| Avoid | Prefer |
|-------|--------|
| A chart goes from an instant to positions. `dateSky` goes the other way: you hand it a list of conditions and it finds every date on which all of them held. | `dateSky` solves the inverse of a natal chart: given a set of planetary conditions (sign placements, aspects, or retrograde states), it searches a date range and returns every interval during which all of them held simultaneously. |
| `chartAt(jd, lat, lon)` silently asserts a real instant at a real place. That is wrong for most interesting cases. | `chartAt(jd, lat, lon)` assumes an exact birth time and location. When the time is approximate or unknown, that single-point assumption produces misleading house cusps and angles. |
| It returns two numbers and keeps them apart, because they are different kinds of number. | It returns two separate bounds: the ephemeris model error against JPL DE440 and the longitude shift caused by ΔT clock uncertainty. Keeping them separate lets callers treat known algorithmic precision differently from historical clock drift. |
| Check what one place sees of each, where a search ran dry, and what one constraint left standing. | Check local visibility from a specific location, identify which constraint eliminated candidate dates, and inspect the intervals that matched every filter. |

## Don't posture

The validation tables, code examples, and error bounds establish credibility on their own. Avoid rhetorical habits that sound defensive or theatrical:

- **Antithesis formulas:** Do not write ", not asserted", ", not assumed", ", not guessed", or "X; Y". State what Caelus does cleanly and move on.
- **Self-congratulatory or combative commentary:** Avoid lines like "The counts are exact", "That is wrong", or "a porting bug fails the build instead of sneaking into a release" unless you are describing an actual CI check mechanically.
- **Slogan closers:** Cut banner lines such as "It computes; you interpret" or "Every layer needs its own referee."

## Punctuation and formatting

- **No em-dashes in prose.** Use commas, colons, parentheses, or separate sentences instead of `—`. Numerical ranges such as `1000–3000` use an en-dash (`–`).
- **Headings and casing:** Use sentence case for most headings and standard title case for product sections (`Build Notes`, `Sky Dating`). Capitalize **Caelus** as a proper noun in prose; write `caelus` in code style when referring to the npm package or import path.
- **Citations and numbers:** Keep exact measurements, body names, and source citations (`JPL DE440`, `VSOP87D`, `IERS`, `Swiss Ephemeris`). Always keep published claims synchronized with `scripts/claims-registry.json`.

## Epistemic accuracy

| Category | Standard practice |
|----------|-------------------|
| Measured benchmark | State the measured number, the comparison reference, and the test scope |
| Engine range or limit | State the valid range and fallback behavior directly (e.g., "embedded Moon tier covers AD 1920–2080") |
| Open question or approximation | Name the source of uncertainty (such as extrapolating ΔT before 1620) directly |

## Web pages

- **Home (`/`):** Orient the visitor clearly: what Caelus computes, how it is verified, how to install it, and where to explore the interactive tools and guides.
- **Instruments (`/instruments/*`):** Explain the question each interactive tool answers in plain developer language, then let the inputs and live results speak for themselves.
- **Docs (`/docs/*`):** Structure guides cleanly: overview, installation or minimal working example, API options, return values, and edge cases or caveats.
- **Validation (`/validation`) & Build Notes (`/notes`):** Document test methodology, reference sources, discrepancies found, and regression tests clearly without theatrical storytelling.

## For agents editing copy

1. Read this guide and `docs/ai-slop-style-sheet.md` before modifying user-facing prose under `apps/web/`, `packages/widgets/`, `packages/*/README.md`, or `docs/`.
2. Run `npm run lint:emdash`, `npm run lint:prose`, `npm run check:docs`, `npm run check:mcp-surface`, and `npm run lint:claims` after edits.
3. Preserve all claims registered in `scripts/claims-registry.json`, all tested DOM hooks in `packages/widgets/test/`, and all runnable `ts run` examples in MDX docs.
