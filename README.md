# Caelus

Clean-room astrology and astronomical computation monorepo. MIT, no Swiss
Ephemeris code, no AGPL, no external ephemeris files. Caelus computes ephemeris
positions, charts, events, hellenistic timing techniques, Vedic methods, citable
chart facts, physical observation (`sceneGeometry`, `verifyObservation`,
`chronolocate`, and `geolocate`), sky-view image-prompt frames, interactive
widgets, and the MCP tools around them. Live at
[ephemengine.com](https://www.ephemengine.com).

## Packages

| Path | npm | Description |
|------|-----|-------------|
| `packages/caelus` | [`caelus`](https://www.npmjs.com/package/caelus) | TypeScript engine (~153 KB gzipped total, zero deps) |
| `packages/caelus-mcp` | [`caelus-mcp`](https://www.npmjs.com/package/caelus-mcp) | MCP server: charts, transits, synastry, events, eclipses, observation |
| `packages/caelus-delineations-pd` | [`caelus-delineations-pd`](https://www.npmjs.com/package/caelus-delineations-pd) | Public-domain interpretation corpus + default validation set for `interpret()` |
| `packages/caelus-corpus` | private | Original interpretation corpus bound to chart cells and conditions |
| `packages/birth` | [`caelus-birth`](https://www.npmjs.com/package/caelus-birth) | Birth time + place to UT (timezone and DST resolution) |
| `packages/wheel` | [`caelus-wheel`](https://www.npmjs.com/package/caelus-wheel) | React SVG chart wheel, sky sphere, astro-map, and ephemeris graph |
| `packages/widgets` | private | Interactive Workbench instruments and chart widgets |
| `apps/web` | private | Next.js site: playground, instruments, validation, docs, edge `/api/chart` |
| `apps/site` | private | Static + Cloudflare Workers site (`Astro` port with edge Worker) |
| [`caelus-starter`](https://github.com/heavyblotto/caelus-starter) | template | Next.js starter app (separate repo) |

The Python reference engine and data-fitting pipeline live in `python/`;
they mint the coefficient data and golden fixtures and are not a runtime
dependency.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md): layout and durability decisions
- [MCP_SPEC.md](./MCP_SPEC.md): MCP tool contract
- [docs/gap-analysis.md](./docs/gap-analysis.md): Swiss Ephemeris comparison (closed at 0.5.0)
- [docs/agents.md](./docs/agents.md): pitfalls for coding agents building on Caelus
- [docs/releasing.md](./docs/releasing.md): release process
- [lab/CHARTER.md](./lab/CHARTER.md): open R&D Lab experiments, null-baseline receipts, and Feature Factory specs ([ledger](./lab/LEDGER.md))

## Quick start

```bash
npm install
npm run build
npm test
npm run dev -w web
```

Live chart in the browser at `http://localhost:3000`.
Edge API: `GET /api/chart?date=...&lat=...&lon=...`.

## Branches

- `main`: stable releases
- `dev`: active development
