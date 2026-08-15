# AI slop style sheet — Caelus

Mechanical rules for prose under `docs/` and extracted web copy. Companion to `editorial-voice.md`.

## High severity (rewrite)

| Pattern | Fix |
|---------|-----|
| Em-dash parenthetical | Comma, colon, or new sentence |
| Fragment with no verb in body prose ("Two-stage CI.", "Fix: fit geometric states.") | Rewrite as a sentence with a subject and a finite verb |
| "X, not Y" where Y is a vice nobody proposed ("published, not asserted") | Drop the ", not Y"; state X alone |
| Semicolon antithesis ("The engine was fine; the search was wrong") | Two sentences, or one that explains why |
| Telegraphic "A vs B" as a sentence | "A was compared against B" |
| "Not merely X but Y" | Pick X or Y; drop the rhetorical frame |
| "The lesson generalizes" | Delete; state the fact once |
| "What this buys you" / "full stop" | Delete the section header; state the license in one sentence |
| "cannot hide inside it" | "a porting bug fails the build" |
| "flawless" / "game-changing" | Delete or replace with a measurement |
| "Every layer needs its own referee" | Delete; describe the test instead |

## Medium severity

| Pattern | Fix |
|---------|-----|
| "Two-link chain" as hero phrase | Name the two stages in a sentence: "The reference engine is checked against Swiss Ephemeris, and the port against golden fixtures." Do not compress it to "A vs B; C vs D" — that is the telegraphese this sheet exists to prevent |
| "clean room" as brand posture | "written from published sources" — use once per page max |
| Tricolon headers ("link 1 — … link 2 — … link 3") | Numbered facts, not rhetorical scaffolding |
| "in your browser" repeated | Once on the playground page |

## Keep

- Exact arcsecond figures and body names
- Source citations (Bretagnon & Francou, IERS, JPL Horizons)
- Command blocks (`npm test`, `git clone`)
- Honest limits (date range, polar Placidus fallback)

## Vale

Run `npm run lint:prose`. Inline override for quoted API docs:

```html
<!-- vale RuleName = NO -->
quoted text
<!-- vale RuleName = YES -->
```
