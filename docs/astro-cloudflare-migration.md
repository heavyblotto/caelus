# Astro on Cloudflare: migration report

Date: 2026-11-11. Branch: `claude/cool-golick-8ae836`, with local `dev` merged
at `7a7b1bf` (sky dating, the `date_sky` tool, the Workbench design rules).
Nothing is deployed, no Cloudflare resource exists, and `apps/web` is untouched
by this work and still builds.

`apps/site` is an Astro 7 app that serves every URL the Next.js app serves and
runs on Cloudflare Workers: static pages from the assets directory, and one
Worker for `/api/chart`, `/api/mcp`, and the 404 page. It was built and served
locally in workerd, the runtime Cloudflare deploys to, and compared against the
Next build route by route.

## What needs a decision first

`/api/chart` does not return the same bytes on Cloudflare as it does today.
The JSON has the same keys, strings, and order, and every number agrees to
within 1.1e-12, but the last one or two digits of a few values differ. In the
flagship query, 16 values differ, by at most 5e-14 degrees.

The port is not the cause. The Worker bundle, run under Node, produces output
byte-identical to the Next route, and to production for the one query fetched
from it. The cause is the runtime: workerd and Node are both V8 but ship
different math libraries. Of 22 `Math` functions probed with 20,000 inputs
each, 17 returned different bits somewhere, among them `sin`, `cos`, `atan2`,
`exp`, and `log`. On the evidence of that one production query, Vercel's
runtime currently agrees with Node.

The engine's validated accuracy is about twelve orders of magnitude coarser
than this difference, and canonical mode exists for callers who need
bit-stable output. A client that hashes or diffs raw `/api/chart` responses
would still see a change at cutover. If that matters, the options are to
serve `/api/chart` from a Node host, or to give the engine its own
deterministic transcendentals. Neither is done here. The MCP endpoint rounds
to 0.01 degrees and matched exactly on all 107 hosted integration checks.

## How it is built

The pages, components, MDX guides, and stylesheet are not copied. `apps/site`
imports them from `apps/web` and renders them to static HTML, so the two builds
cannot drift while both exist. `apps/site/README.md` describes the layout. The
parts worth knowing:

- Each route is a small `.astro` file that renders the page component and
  `metadata` export from `apps/web/app`. A helper converts that metadata into
  the `<head>` tags Next emitted.
- Five shims stand in for `next/link`, `next/navigation`, `next/dynamic`,
  `next/server`, and `next/og`.
- The header, docs sidebar, and table of contents are Astro islands. Client
  components nested inside server-rendered React trees (the install button,
  code-block copy, the playground, the home page's live sky) hydrate through a
  small island registry. A Vite plugin wires this at the import edge, and
  fails the build if a server component imports a client component that has no
  island registered.
- The two API endpoints call the existing route handlers in
  `apps/web/app/api` unchanged.

This is a bridge. It makes the Astro site a faithful second build of the same
source, at the cost of a custom hydration path that a new contributor has to
learn. After cutover, pages can be converted to native Astro one at a time and
the bridge removed when the last one is done.

## Copied versus imported

Nothing under `apps/web/components`, `apps/web/app`, or `apps/web/lib` was
copied. `apps/web/app/globals.css` is imported by `src/layouts/Base.astro`, so
a restyle done there, or in whatever replaces it, reaches the Astro build with
no second edit.

Three pieces are site-local replacements, each because the original depends on
Next:

| Site file | Replaces | Why |
|-----------|----------|-----|
| `src/components/Tabs.astro`, `Tab.astro` | `components/Tabs.tsx` | The React version reads labels off its children, which needs the whole document to be one React tree. Same class names, so the same CSS applies. |
| `src/layouts/Base.astro`, `Docs.astro` | `app/layout.tsx`, `app/docs/layout.tsx` | A layout is written for Next or for Astro, not both. Same markup and class names. |
| `src/components/MdxLink.astro`, `src/lib/mdx-components.ts` | `mdx-components.tsx` | Next and Astro each wire the MDX component map their own way. |

Four small modules restate logic that could not be imported as it stands:
`src/lib/api-docs.ts` (the original finds its files from an `apps/web` working
directory), `src/pages/sitemap.xml.ts` (same reason; it reads the route list
from the original's source), `src/pages/robots.txt.ts`, and
`src/pages/docs/api/[slug].astro`. `src/styles/fonts.css` is new and replaces
`next/font`. The only style rules in `apps/site` are those font faces; every
other rule comes from `globals.css`.

So a restyle that changes markup, not only CSS, has four site-local files to
touch: the two layouts and the two tab components.

## Pending from dev

`/instruments/sky-dating` is not in this build. It is due on `dev` as a React
widget from `packages/widgets`, styled by a scoped `workbench.css`. It will
mount here as a client-only island inside a `.wb` wrapper, with the stylesheet
imported from `apps/web` like `globals.css`. The Workbench restyle of the rest
of the site is out of scope for this branch.

## What is ported

| Route | Status |
|-------|--------|
| `/`, `/playground`, `/features`, `/validation`, `/methods`, `/provenance`, `/notes`, `/how-it-was-built`, `/changelog`, `/privacy` | Static. Rendered from the same page components. |
| `/docs`, the 19 MDX guides, `/docs/visualizations` | Static. MDX is compiled by Astro's MDX integration from the files in `apps/web/app/docs`. |
| `/docs/api`, `/docs/api/[slug]` (607 pages) | Static, from the TypeDoc markdown in `apps/web/content/api`. |
| `/embed/chart` | Static shell, hydrated on load. |
| `/api/chart` | Worker. See the note on float output above. |
| `/api/mcp` | Worker. Stateless, JSON responses, 36 tools. |
| `robots.txt`, `sitemap.xml`, `/icon.svg`, `/opengraph-image` | Static files written at build time. The Open Graph PNG is byte-identical to Next's. |
| `/about`, `/favicon.ico` | 307 redirects, via `_redirects`. |
| Unknown paths | 404 with the existing not-found page. |

The home page is static. The New York clock is read in the browser when the
island mounts, so the page no longer needs a server render per request.

The playground keeps the lazy data packs from `lib/loadExtraData.ts`. They
build as separate chunks that load on demand, and the largest static asset is
2.6 MB against Cloudflare's 25 MiB limit. No era or wide pack is shipped. The
Worker uses `caelus/data-embedded` only.

Not ported: nothing that `apps/web` serves is missing. Not done, by
instruction: no deploy, no Cloudflare resources, no DNS change, no push, no
pull request, no redesign.

## Choices the brief asked about

**MCP: refactor, not `nodejs_compat`.** `packages/caelus-mcp/src/server.ts`
was split in two. `core.ts` registers every tool, resource, and prompt and
imports no `node:*` module. `server.ts` is now the Node entry: it reads the
version, accuracy tables, gazetteer, and data packs from disk, passes them to
the core as options, and runs stdio. The refactor was small because the disk
reads were already isolated in four helpers: `core.ts` differs from the old
`server.ts` by 134 removed and 67 added lines out of 2,341, and the new
`server.ts` is 144 lines. The
package gains a `caelus-mcp/core` export, and `caelus-mcp` behaves as before.
The Worker's `wrangler.jsonc` sets no compatibility flags, and the built
bundle contains no `node:` import. `check-mcp-surface` now fails if `core.ts`
gains one.

**Search: kept `search-index.json`.** The existing index, its build script,
and the `Search` component work unchanged, so keeping them cost nothing.
Pagefind would have meant a new index format and a rewritten search dialog.

**Fonts.** Inter and JetBrains Mono are self-hosted from Fontsource packages,
as variable fonts with the same fallback metrics `next/font` generated.

**Open Graph image.** `@vercel/og` renders it at build time, pinned to 0.7.2,
the release Next 15 bundles. It is an image library with no tie to Vercel
hosting. Version 1.0.3 fails to load under Node as an ES module.

## Verification

All of this ran against `wrangler dev` serving the built output.

| Check | Result |
|-------|--------|
| `npm run build -w site` | Builds cleanly. `astro check` reports 0 errors. |
| `node scripts/smoke-site.mjs --against <next>` | 644 URLs crawled on each build. Every URL that is 200 on Next is 200 on Astro with the same content type, both redirects match, and the two sitemaps list the same 639 URLs. |
| `/api/chart` and `/api/mcp` GET, 12 samples | 6 byte-identical (every 400 response, including two dates outside 1920 to 2080, and the MCP description). 6 chart responses equal in structure with numbers within 1.1e-12. |
| `CAELUS_MCP_URL=<worker>/api/mcp node packages/caelus-mcp/integration.test.mjs` | 107 checks, 0 failures. The same command against the Next route also passes. |
| `npm test`, which includes `test:mcp` | Passes. |
| `node scripts/smoke-live.mjs <worker>` | Passes. |
| `lint:claims`, `lint:emdash`, `check:docs`, `lint:prose`, `check-llms`, `check-mcp-surface`, `check:versions`, `check-tarball` | All pass. |
| Page content, 36 pages | Visible text is identical to Next on every page except `/docs/mcp`. On 34 of them the headings, links, element counts, and CSS classes were also compared and match, apart from one React-generated id per page. |
| `<head>` tags, 11 pages | Identical to Next, apart from the image URL's cache key. |

`integration.test.mjs` gained a hosted mode, selected by `CAELUS_MCP_URL`. The
committed goldens were minted on the full data tier and the hosted endpoint
serves the embedded tier, so in hosted mode the test builds the same server
core in process on the embedded tier and requires the endpoint's payloads to
equal it. A golden case the embedded tier cannot serve, such as a `date_sky`
search before 1000 CE, must be refused with the same message the reference
gives. Without the variable the test runs as before, with 108 checks.

## Measurements

One machine, Apple silicon, Node 25.8.1. Build times cover the app's own build
script, with workspace packages, API markdown, and search index already built.
These were taken before `dev` was merged, at `bb1164a`. The merge adds one
guide and ten API pages and was not re-measured.

| | Next (`apps/web`) | Astro (`apps/site`) |
|---|---|---|
| Build, cold | 21.0 s | 5.6 s |
| Build, warm | 18.0 s | 5.2 s |
| Build output | 56.1 MB in 2,188 files, plus 2.0 MB `public` | 33.0 MB in 790 files, `public` included |
| Static files to serve | 13.9 MB in `.next/static` | 27.4 MB in 745 files, of which 12.2 MB is HTML |
| Server code | 41.5 MB in `.next/server` | 2.1 MB of Worker JS, 555 KB gzipped, plus 3.2 MB of source maps |

Client JavaScript, measured in a browser after load and a scroll to the bottom
of the page, gzip:

| Page | Next | Astro |
|------|------|-------|
| `/` | 361 KB (1,025 KB raw, 29 files) | 308 KB (823 KB raw, 26 files) |
| `/playground` | 2,169 KB (6,616 KB raw) | 2,116 KB (6,400 KB raw) |
| `/docs/quickstart` | 118 KB (386 KB raw) | 72 KB (218 KB raw) |

The home page and playground are dominated by the engine, its data, and the
corpus, which both builds ship. The saving there is Next's client runtime,
about 50 KB. A prose page drops by about 40 percent, and its HTML is smaller
because there is no serialized component payload.

## Other differences from the Next deployment

- `/docs/mcp`: the two tab groups render every panel into the page and hide
  the inactive ones. Next rendered only the active panel. The look and the
  interaction are the same, and the page is searchable in full.
- Interactive pieces inside page bodies hydrate when they scroll near the
  viewport, not all at load.
- A trailing slash redirects with 307, where Next used 308. `/features.html`
  redirects to `/features`, where Next returned 404. These come from
  Cloudflare's asset handling as `wrangler dev` reproduces it.
- `/404` requested directly returns 200. Unknown paths return 404.
- The image URL in social tags is `/opengraph-image?v=0.25.0`. Next appended
  a content hash.
- HTML is served with `Cache-Control: public, max-age=0, must-revalidate`,
  and hashed assets with a one-year immutable policy.

## Not verified

- Nothing ran on Cloudflare's network. `_headers`, `_redirects`, clean-URL
  handling, and the 404 path were checked in local workerd only.
- CPU time as Cloudflare bills it. Locally a chart takes about 5 ms of wall
  time, `tools/list` about 22 ms, and a 34-year `find_aspect_dates` about
  0.7 s. The free plan allows 10 ms of CPU per request, so the MCP endpoint
  will need the paid plan, whose default is 30 s.
- A build under Node 22. This machine has Node 25.8.1 only. Astro 7 requires
  22.23.4 or later, and the repo pins Node 22 without a minor version.
- Whether Cloudflare's build clones full git history. With a shallow clone,
  older pages get the build date as their sitemap `lastmod`.
- Pixel-level visual parity. Parity rests on the text and structure diffs
  above, plus screenshots of four pages in the light theme. The dark theme
  was toggled by script, and no narrow viewport was checked.
- Clipboard writes. The install and copy buttons hydrate and respond, but the
  test browser refused clipboard access to an unfocused page.
- The 607 API pages were compared by status and content type. Three were
  compared by text and structure.
- Hot reload in `astro dev`. The dev server answered every route over HTTP.

## Cutover checklist

Steps 1 to 6 and 9 to 11 need the owner. Steps 7 and 8 are repo edits.

1. Decide whether the float change in `/api/chart` is acceptable.
2. Create or choose the Cloudflare account, and enable Workers Paid.
3. Move the `ephemengine.com` zone to Cloudflare DNS. A Worker custom domain
   requires the zone to be on Cloudflare. Keep the records pointing at Vercel
   until step 9.
4. Create the Worker from this repo. The build command is
   `npm ci && npm run build:site` from the repo root, and the deploy command
   is `npx wrangler deploy` from `apps/site`. The Worker needs no environment
   variables, secrets, or bindings beyond its assets. Set the build to Node 22
   and, if the option exists, a full clone.
5. Check the Worker on its `workers.dev` URL before any DNS change:
   `node scripts/smoke-live.mjs <url>`,
   `node scripts/smoke-site.mjs --against https://www.ephemengine.com <url>`,
   and `CAELUS_MCP_URL=<url>/api/mcp node packages/caelus-mcp/integration.test.mjs`.
   Read the Worker's CPU time for the MCP calls in the dashboard.
6. Add `www.ephemengine.com` as the Worker's custom domain, and a redirect
   rule from the apex to `www`. `smoke-live.mjs` asserts that redirect.
7. Switch the repo's build and CI to the site: the root `build`, `test:web`,
   and `preflight` scripts, the `build -w web` and `smoke:web` steps in
   `ci.yml` and `release.yml`, and `vercel-build` in `apps/web/package.json`.
8. Update `live-smoke.yml` and `smoke-live.mjs`. The checks are host-neutral,
   but their comments and failure messages name Vercel, its WAF, and its
   deploy delay.
9. Change the `www` record to the Worker. Run the daily live smoke by hand
   and watch it for a few days.
10. Remove the domain from the Vercel project, then pause or delete the
    project.
11. Add a changelog entry for the `caelus-mcp/core` export. `CHANGELOG.md` was
    off limits for this branch; the merge from `dev` brought its entries in
    unchanged.

## Gates wired to `apps/web`

None of these changed, and none has to change on cutover day if `apps/web`
stays as the source directory that `apps/site` builds from. They need
repointing only when the sources move into `apps/site`:

- Prose: `check-em-dashes.mjs`, `extract-web-prose.mjs`, `lint-prose.sh`.
- Claims: `claims-registry.json` (34 paths), `sync-facts.mjs` (the generated
  anchors file), `check-docs.mjs`, `check-versions.mjs`.
- Surface: `check-mcp-surface.mjs` (both route files and the data-tiers page),
  `check-llms.mjs` (`apps/web/public/llms.txt`).
- Generated inputs: `typedoc.json` (`out`), `build-search-index.mjs`,
  `build-chart-widget.mjs`, `build-gazetteer.mjs`.
- Tests: `test-web-libs.mjs`. `smoke-web.mjs` is replaced by
  `smoke-site.mjs`.

Three gates were repointed now, because the MCP tools moved files:
`sync-facts.mjs`, `check-mcp-surface.mjs`, and `claims-registry.json` read
`core.ts` where they read `server.ts`.

## Noticed, not changed

- Only the home page, `/embed/chart`, and the 404 page carry `og:image` tags.
  Every page built with `pageMetadata()` replaces the root Open Graph object
  and loses the image. The Astro build reproduces this.
- The hosted MCP endpoint resolves no named places, because the gazetteer is
  read from disk and the hosted bundle has none. The core now accepts the rows
  as an option, so the Worker could bundle them (811 KB).
- `npm install` for the new workspace moved 32 existing lockfile entries by a
  patch version, among them `sharp`, `nanoid`, and `yaml`.
- CI does not build `apps/site` yet.
