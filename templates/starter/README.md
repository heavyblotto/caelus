# caelus-starter

Birth form → natal chart wheel, in an afternoon. Next.js 15 +
[caelus](https://github.com/heavyblotto/caelus) (MIT ephemeris engine,
charts compute client-side) + `@caelus/birth` (timezone resolution) +
`@caelus/wheel` (SVG chart wheel).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fheavyblotto%2Fcaelus-starter)

## Quickstart (90 seconds)

```sh
git clone https://github.com/heavyblotto/caelus-starter
cd caelus-starter
npm install
npm run dev      # → http://localhost:3000
```

Zero config. Charts compute in the browser — no ephemeris files, no
backend, no API keys needed for the core flow.

## The timezone trap (already defused here)

The #1 wrong-chart bug in astrology software: converting the user's local
birth time with `new Date(localString)`, which silently uses the *server's*
timezone. A Tampa 2:30 PM birth computed on a UTC server gets an Ascendant
of 10° Leo instead of the correct 3° Libra — two signs off, every house
wrong. This template converts through `@caelus/birth`, which resolves the
IANA zone from the birthplace and applies historical tzdb rules (DST,
half-hour zones, wartime offsets). DST edge cases surface to the user in
plain language ("clocks changed that night — we used the earlier 1:30;
switch?"). `npm run test:birth` pins nine cursed cases in CI.

## What's inside

| Route | What it does |
|---|---|
| `/` | Birth form (place search via free Open-Meteo geocoding, manual lat/lon fallback, "time unknown" path) + today's sky strip |
| `/chart` | Wheel, positions, houses, aspects — all client-side via `caelus/data-embedded` |
| `/rectify` | What to do about unknown birth times (the `rectification_grid` MCP flow) |
| `POST /api/reading` | Optional LLM reading — set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`); without a key the app runs charts-only |

The reading prompt lives in `lib/prompt.ts` — one editable file. Read the
comment there before shipping readings: uncited LLM astrology is the floor,
not the ceiling.

No interpretation text ships in this template; positions are math
(caelus is verified per-body against Swiss Ephemeris — see
[ephemengine.com/validation](https://ephemengine.com/validation)), meaning
is your product.

## What to build next

- **Transits & timing** — `caelus-mcp` exposes `transits`,
  `find_aspect_dates` (retrograde re-hits included), and
  `rectification_grid` to any MCP client: `npx caelus-mcp`.
- **Engine docs** — [ephemengine.com](https://ephemengine.com): playground,
  per-body validation tables, data provenance.
- **For AI assistants** — point them at
  [ephemengine.com/llms.txt](https://ephemengine.com/llms.txt) and
  `docs/agents.md` in the caelus repo.

Place search data: [GeoNames](https://www.geonames.org/) via the
[Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
(CC-BY 4.0).
