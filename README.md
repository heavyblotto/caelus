# caelus

Clean-room astrological ephemeris engine and monorepo. MIT-licensed, no Swiss
Ephemeris code, no AGPL obligations, no ephemeris files to manage.

## Packages

| Path | Description |
|------|-------------|
| `packages/caelus` | TypeScript ephemeris engine (~85 KB gzipped, zero deps) |
| `packages/caelus-mcp` | MCP server exposing chart computation to AI agents |
| `apps/web` | Next.js 15 demo — client-side charts + edge API |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for product strategy and [MCP_SPEC.md](./MCP_SPEC.md) for the MCP tool contract.

## Quick start

```bash
npm install
npm run build
npm test
npm run dev -w web
```

Open http://localhost:3000 — the homepage computes a live chart in your browser.
The edge API twin: `GET /api/chart?date=…&lat=…&lon=…`.

## Branches

- `main` — stable releases
- `dev` — active development
