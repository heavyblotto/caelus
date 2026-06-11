# caelus-mcp — MCP Specification v0.1

One bounded context: **astrologically rigorous chart computation**. The
server does math; the model does interpretation. No interpretive text is
ever returned — that keeps outputs small, keeps the server unopinionated
across traditions (Hellenistic, modern, Vedic-later), and makes the KG/
corpus layer (separate server, see ARCHITECTURE.md) cleanly composable.

## Design principles applied

1. **Outcome-level tools, not API wrappers.** `transits` answers "what's
   affecting this person now" in one call — not five calls to assemble it.
2. **Curated surface: six tools.** Every additional tool taxes the model's
   tool-selection accuracy and context budget. Anything expressible by
   composing these six stays out.
3. **Token frugality.** A full natal chart payload is ~1.9 KB: terse keys,
   positions to 0.01°, compact aspect strings ("t.saturn sq n.moon (0.4°
   applying)"). MCP responses are paid for in context tokens on every
   subsequent turn.
4. **Determinism + provenance.** Same input, same output, every time;
   accuracy claims (validated ~1″ vs Swiss Ephemeris) stated in tool
   descriptions so the model can convey trust honestly.

## Tools

### natal_chart(date, lat, lon, house_system?)
Complete natal chart: 13 bodies (sun..pluto, chiron, both nodes) with
sign, degree, house, retrograde, speed; ASC/MC; 12 cusps; major aspects
with orbs. The foundational object every other workflow references.

### current_sky(date?, lat?, lon?, house_system?)
"The sky now" — same payload shape as natal_chart, defaulting to the
current instant. Powers daily/mundane content and grounds "what's
happening today" questions in real positions.

### transits(date, lat, lon, transit_date?, orb?, house_system?)
Natal chart + transiting positions + every transit-to-natal aspect within
orb, marked applying/separating, plus which natal house each transiting
body occupies. The single most-used tool for personal readings.

### synastry(a, b, orb?)
Two charts + all inter-chart aspects + house overlays. Relationship
analysis in one call.

### find_aspect_dates(body, aspect, target_lon|target_body, start, end)
Root-finds exact aspect dates across a range (bisection to ~1 minute),
returning all passes including retrograde re-hits — e.g. Saturn square
natal Moon 2026-2027 correctly returns the direct/retrograde/direct
triple pass. Powers: "when will X happen", electional work, eclipse
planning, and the pattern-mining loops (see mymagus notes): correlating
user-journaled events against exact transit timing requires exactly this
inverse query.

### rectification_grid(date, lat, lon, window?, step_minutes?)
The rectification workflow: sweeps a day (or window) and returns ASC/MC
at each step plus explicit ASC sign-change boundaries. The *model* runs
the dialog — eliciting life events, temperament, appearance — and narrows
candidate windows; the grid gives it the exact astronomical structure of
the day. Pairs with find_aspect_dates to test candidate times against
dated life events ("if born 14:30, transiting Saturn was exactly on the
candidate ASC during the 2019 event you described").

## Resources (phase 2)
- `caelus://glossary` — terse machine-readable definitions (aspects, house
  systems, dignities) so models don't hallucinate basics.
- `caelus://accuracy` — the validation table, for honest provenance.

## Prompts (phase 2)
- `natal_reading` — opinionated prompt template assembling natal_chart +
  corpus citations (once the KG server exists) into a structured reading.
- `rectification_session` — multi-turn elicitation script around
  rectification_grid.

## Transports & deployment
- **stdio** (shipped): `npx caelus-mcp` for Claude Desktop / local agents.
- **Streamable HTTP** (next): mount `buildServer()` behind
  `/api/mcp` on ephemengine.com (Vercel). Stateless, no auth for free
  tier; API-key auth + rate limits for the paid tier. The engine is pure
  computation with no per-user state, so horizontal scaling is trivial.

## Non-goals (v0.1)
Progressions/returns/solar-arc (compose from primitives; dedicated tools
in v0.2 if call patterns show demand), Vedic ayanamsas (one function away;
add with a `zodiac: tropical|sidereal(<ayanamsa>)` param in v0.2),
interpretation text (never — that's the KG server's job).
