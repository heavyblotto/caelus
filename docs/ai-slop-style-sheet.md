# AI slop style sheet — Caelus

Mechanical rules for prose under `docs/`, `packages/`, and `apps/web/`. Companion to `editorial-voice.md`.

## Claude Code-speak tells (rewrite)

| Pattern | Fix |
|---------|-----|
| Cryptic riddle openers ("A chart goes one way. `dateSky` goes the other way.") | Open with a clear summary of what the function does, what inputs it accepts, and what it returns |
| Pseudo-poetic or elliptical phrasing ("where a search ran dry", "what one constraint left standing", "smeared by the clock", "the text it licenses", "precision escrow") | Use direct engineering descriptions ("which constraint eliminated candidate dates", "longitude uncertainty due to clock error", "interpretation text matched by cited rules", "provenance metadata") |
| Vague faux-simple nouns ("a place", "one place", "the call", "an instant") where domain terms are clearer | Use `location` or `coordinates`, `function call` or `API`, and `timestamp` or `date and time` alongside `Julian Day` |
| Choppy staccato fragments ("Higher is better.", "Different kinds of number.") | Merge into clear, well-structured sentences with natural connectors |
| Flat `, and` comma splices used to link cause and effect | Connect clauses with `because`, `so`, `when`, `while`, or `if` |
| Combative commentary ("`chartAt` silently asserts... That is wrong.") | Explain the limitation directly ("`chartAt` computes a point-in-time chart, so approximate times require an uncertainty window.") |

## High severity (rewrite)

| Pattern | Fix |
|---------|-----|
| Em-dash parenthetical in prose | Use commas, colons, parentheses, or a separate sentence |
| Fragment with no finite verb in body prose ("Two-stage CI.", "Fix: fit geometric states.") | Write a complete sentence with a subject and finite verb |
| "X, not Y" where Y is a fault nobody proposed ("published, not asserted") | State X directly and omit the negative comparison |
| Semicolon antithesis ("The engine was fine; the search was wrong") | Write two clear sentences or state the causal relationship |
| Telegraphic "A vs B" as a standalone sentence | Write "A was compared against B" |
| "Not merely X but Y" | State X or Y directly without rhetorical framing |
| "The lesson generalizes" / "What this buys you" / "full stop" | Delete the filler and state the point directly |
| "cannot hide inside it" / "Every layer needs its own referee" | Describe the test or failure mode mechanically |
| Unsubstantiated hype ("flawless", "game-changing", "seamless", "robust") | Replace with measured numbers or concrete behavior |

## Medium severity

| Pattern | Fix |
|---------|-----|
| Repeating "in your browser" / "runs in the page" on every paragraph | State client-side execution clearly once per section |
| "clean room" as brand posture | Say "implemented from published astronomical references" |
| Anthropomorphizing code ("the engine refuses", "the solver knows") | State input validation or algorithmic behavior directly ("throws a range error", "returns") |

## Keep

- Exact arcsecond figures, bundle measurements, and body names
- Source citations (`Bretagnon & Francou`, `IERS`, `JPL Horizons`, `Swiss Ephemeris`)
- Runnable code blocks and CLI commands (`npm test`, `git clone`)
- Explicit limits (valid date ranges, polar Placidus fallback, ΔT uncertainty)

## Vale

Run `npm run lint:prose` after editing prose. For exact quoted API terminology that intentionally contains flagged words, wrap with Vale comments:

```html
<!-- vale RuleName = NO -->
quoted text
<!-- vale RuleName = YES -->
```
