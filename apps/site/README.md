# apps/site

The Astro build of ephemengine.com, for Cloudflare Workers. It serves the same
URLs as the Next.js app in `apps/web` and is not deployed anywhere yet. The
migration report, with measurements and the cutover checklist, is in
[`docs/astro-cloudflare-migration.md`](../../docs/astro-cloudflare-migration.md).

## Commands

Run these from the repo root.

| Command | What it does |
|---------|--------------|
| `npm run dev:site` | Astro dev server. Pages render under Node, the two API endpoints under workerd. |
| `npm run build -w site` | Builds `apps/site/dist`: static pages in `dist/client`, the Worker in `dist/server`. |
| `npm run smoke:site` | Serves `dist` with `wrangler dev` and crawls it. Add `-- --against <next-url>` to require parity with a running Next build. |
| `npm run test:site` | Builds `caelus-mcp`, the API markdown, the search index, and the site, then runs the smoke crawl. |

The build expects the workspace packages to be built and
`conformance-stats.json` to exist, as `apps/web` does. `npm run build` at the
root produces both.

## How it works

The pages, components, MDX guides, and stylesheet are not copied. This app
imports them from `apps/web` and renders them to static HTML, so an edit there
shows up in both builds. What lives here is the Astro shell around them.

- `src/pages` holds one small `.astro` file per route. Each imports the page
  component and its `metadata` export from `apps/web/app` and renders them in a
  layout. `docs/[slug].astro` does the same for the MDX guides, and
  `docs/api/[slug].astro` for the TypeDoc markdown.
- `src/layouts` holds the document shell, the docs shell, and the instrument
  shell, the counterparts of the Next layouts. `src/lib/meta.ts` turns a page's `metadata` into the
  `<head>` tags Next emitted.
- `src/shims` stands in for the five `next/*` modules the sources import:
  `next/link`, `next/navigation`, `next/dynamic`, `next/server`, and `next/og`.
  `astro.config.mjs` aliases them.
- `src/islands` hydrates the interactive pieces. Astro hydrates a component only
  where a template places it, and most client components in `apps/web` sit
  inside server-rendered React trees. `plugins/web-bridge.mjs` redirects those
  imports to wrappers in `src/islands/web`, which mark the component in the
  HTML, and `src/islands/client.ts` hydrates each mark when it scrolls near the
  viewport. The header, docs sidebar, and table of contents are ordinary Astro
  islands.
- `src/pages/api` holds the two Worker endpoints. Both call the route handlers
  in `apps/web/app/api` unchanged. The MCP handler's `import("caelus-mcp")`
  resolves to `caelus-mcp/core`, which has no Node dependency.

## Adding an interactive component

A server-rendered component in `apps/web` that imports a new `"use client"`
component fails this build with a message naming both files. Add a wrapper
under `src/islands/web`, register its loader in `src/islands/registry.ts`, and
list the redirect in `astro.config.mjs`. Props that cross into an island must
be JSON-serialisable, which is the rule Next applies at the same boundary.

## Two dependencies that look out of place

`cookie` is listed directly because Astro's prerender bundle imports it by
name, and the monorepo root hoists an older major (through the MCP SDK's
Express dependency) that lacks the exports Astro needs. The direct dependency
puts the right version where the bundle resolves it.

`@vercel/og` renders the Open Graph image at build time. It is pinned to
0.7.2, the release Next 15 bundles as `next/og`, so the image is unchanged. It
runs under Node during the build and has no tie to Vercel hosting.
