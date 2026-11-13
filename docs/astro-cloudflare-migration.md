# Astro on Cloudflare: migration report

Date: 2026-11-12. State: local `dev` at `6800f23` plus the CI job and two
guides added with this revision. Nothing is deployed, no Cloudflare resource
exists, and the Next.js app in `apps/web` still builds and still serves
production from Vercel.

`apps/site` is an Astro 7 app that serves every URL the Next.js app serves and
runs on Cloudflare Workers: static pages from the assets directory, and one
Worker for `/api/chart`, `/api/mcp`, and the 404 page. It is built and served
locally in workerd, the runtime Cloudflare deploys to, and compared against the
Next build route by route.

Where things stand:

- The port is complete. Every route matches the Next build under local
  workerd, including the Sky Dating instrument and the 25 MDX guides.
- The site-wide Workbench restyle is merged. It was done once, in
  `apps/web`, and reached the Astro build through the shared stylesheet and
  five site-local files.
- The one open decision, the float difference in `/api/chart`, is made:
  accepted, and documented for callers.
- CI builds and crawls the Astro site in its own job, so `dev` cannot drift
  from a working Astro build unnoticed. That job has not run on GitHub yet.
- What remains is the cutover itself. The steps only the owner can do are the
  last section of this report.

## The float difference in `/api/chart`: accepted

Decision, 2026-11-11: the difference described here is accepted. Raw float
output was never promised to be bit-stable across runtimes, and canonical mode
is the documented answer for a caller who hashes or diffs. The Edge Cases
guide (`/docs/edge-cases`, "Float output across runtimes") states the measured
difference for callers.

`/api/chart` does not return the same bytes on Cloudflare as it does today.
The JSON has the same keys, strings, and order, and every number agrees to
within 1.1e-12, but the last one or two digits of a few values differ. Across
six sample charts, between 7 and 19 of roughly 160 numbers per response
differ. In the flagship query, 16 of 180 differ, by at most 5e-14 degrees.

The port is not the cause. The Worker bundle, run under Node, produces output
byte-identical to the Next route, and to production for the one query fetched
from it. The cause is the runtime: workerd and Node are both V8 but ship
different math libraries. Of 22 `Math` functions probed with 20,000 inputs
each, 17 returned different bits somewhere, among them `sin`, `cos`, `atan2`,
`exp`, and `log`. On the evidence of that one production query, Vercel's
runtime currently agrees with Node.

The largest difference, 1.1e-12 degrees, is about four billionths of an
arcsecond, more than eight orders of magnitude below the one-arcsecond level
the planets are validated to. A client that hashes or diffs raw `/api/chart`
responses will see a change at cutover. The alternatives, serving
`/api/chart` from a Node host or giving the engine its own deterministic
transcendentals, were not taken. The MCP endpoint rounds to 0.01 degrees and
matches the in-process reference exactly on all 111 hosted integration checks.

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
  code-block copy, the playground, the home page's live sky, the Sky Dating
  widget) hydrate through a small island registry. A Vite plugin wires this at
  the import edge, and fails the build if a server component imports a client
  component that has no island registered.
- The two API endpoints call the existing route handlers in
  `apps/web/app/api` unchanged.

This is a bridge. It makes the Astro site a faithful second build of the same
source, at the cost of a custom hydration path that a new contributor has to
learn. After cutover, pages can be converted to native Astro one at a time and
the bridge removed when the last one is done.

A new guide needs no work in `apps/site`. The two added with this revision,
`/docs/astrocartography` and `/docs/deep-time`, were written as MDX files in
`apps/web/app/docs` and registered in `lib/site.ts`, `app/sitemap.ts`, and the
docs hub. The Astro build picked up the pages, the sidebar entries, the
sitemap entries, and the search index from those sources.

## Copied versus imported

Nothing under `apps/web/components`, `apps/web/app`, or `apps/web/lib` is
copied. `apps/web/app/globals.css` is imported by `src/layouts/Base.astro`, and
it is the only stylesheet: the Workbench restyle folded the scoped
`workbench.css` into it.

Three pieces are site-local replacements, each because the original depends on
Next:

| Site file | Replaces | Why |
|-----------|----------|-----|
| `src/components/Tabs.astro`, `Tab.astro` | `components/Tabs.tsx` | The React version reads labels off its children, which needs the whole document to be one React tree. Same class names, so the same CSS applies. |
| `src/layouts/Base.astro`, `Docs.astro`, `Instrument.astro` | `app/layout.tsx`, `app/docs/layout.tsx` | A layout is written for Next or for Astro, not both. Same markup and class names. `Instrument.astro` is a pass-through to `Base.astro` since the restyle. |
| `src/components/MdxLink.astro`, `src/lib/mdx-components.ts` | `mdx-components.tsx` | Next and Astro each wire the MDX component map their own way. |

Four small modules restate logic that could not be imported as it stands:
`src/lib/api-docs.ts` (the original finds its files from an `apps/web` working
directory), `src/pages/sitemap.xml.ts` (same reason; it reads the route list
from the original's source), `src/pages/robots.txt.ts`, and
`src/pages/docs/api/[slug].astro`. `src/styles/fonts.css` replaces `next/font`
and holds the only style rules in `apps/site`: the self-hosted faces for
Barlow, Barlow Condensed, and JetBrains Mono.

The restyle confirmed the split. It changed `globals.css` and the components
in `apps/web`, and in `apps/site` it touched the three layouts, `fonts.css`,
and one island.

## What is ported

| Route | Status |
|-------|--------|
| `/`, `/playground`, `/features`, `/validation`, `/methods`, `/provenance`, `/notes`, `/how-it-was-built`, `/changelog`, `/privacy` | Static. Rendered from the same page components. |
| `/docs`, the 25 MDX guides, `/docs/visualizations` | Static. MDX is compiled by Astro's MDX integration from the files in `apps/web/app/docs`. |
| `/docs/api`, `/docs/api/[slug]` (615 pages) | Static, from the TypeDoc markdown in `apps/web/content/api`. |
| `/embed/chart` | Static shell, hydrated on load. |
| `/instruments/sky-dating` | Static, with the widget prerendered and then hydrated in the browser. |
| `/api/chart` | Worker. See the section on the float difference above. |
| `/api/mcp` | Worker. Stateless, JSON responses, 37 tools. |
| `robots.txt`, `sitemap.xml`, `/icon.svg`, `/opengraph-image` | Static files written at build time. |
| `/about`, `/favicon.ico` | 307 redirects, via `_redirects`. |
| Unknown paths | 404 with the existing not-found page. |

The home page is static. The New York clock is read in the browser when the
island mounts, so the page no longer needs a server render per request.

The Sky Dating widget is prerendered with its default form, as Next
prerenders it, so the page's HTML is the same in both builds. In the browser
it builds `new Engine(embeddedData)` and runs the search there.

The playground keeps the lazy data packs from `lib/loadExtraData.ts`. They
build as separate chunks that load on demand, and the largest static asset is
2.6 MB against Cloudflare's 25 MiB limit. No era or wide pack is shipped. The
Worker uses `caelus/data-embedded` only.

Nothing that `apps/web` serves is missing.

## Choices the brief asked about

**MCP: refactor, not `nodejs_compat`.** `packages/caelus-mcp/src/server.ts`
was split in two. `core.ts` registers every tool, resource, and prompt and
imports no `node:*` module. `server.ts` is the Node entry: it reads the
version, accuracy tables, gazetteer, and data packs from disk, passes them to
the core as options, and runs stdio. The package gains a `caelus-mcp/core`
export, and `caelus-mcp` behaves as before. The Worker's `wrangler.jsonc` sets
no compatibility flags, and the built bundle contains no `node:` import.
`check-mcp-surface` fails if `core.ts` gains one.

**Search: kept `search-index.json`.** The existing index, its build script,
and the `Search` component work unchanged, so keeping them cost nothing.
Pagefind would have meant a new index format and a rewritten search dialog.

**Fonts.** Barlow, Barlow Condensed, and JetBrains Mono are self-hosted from
Fontsource packages, with the same fallback metrics `next/font` generated.

**Open Graph image.** `@vercel/og` renders it at build time, pinned to 0.7.2,
the release Next 15 bundles. It is an image library with no tie to Vercel
hosting. Version 1.0.3 fails to load under Node as an ES module.

## CI

`.github/workflows/ci.yml` has a `site` job beside `conformance`, `python`,
and `prose`. It checks out the repo, installs with `npm ci` on Node 22, runs
`npm run build:site`, and runs `npm run smoke:site`. It needs no Cloudflare
account and no secret, and it deploys nothing.

`build:site` builds the workspace packages, runs the golden suite for the
stats the site quotes, generates the API markdown and the search index, and
runs `astro build`. `smoke:site` serves `apps/site/dist` with `wrangler dev`,
which runs the Worker and the static assets in workerd on the runner, and
crawls it: every page 200, no dead in-site link, both redirects, the 404
page, `/api/chart`, and an MCP `tools/list` round trip.

On this machine `build:site` takes 14 seconds and `smoke:site` 2.4 seconds,
with dependencies already installed. A hosted runner is slower and also pays
for `npm ci`, which was not timed.

The job has not run on GitHub. These are the places it could behave
differently there:

- **Node version.** Astro 7 requires Node 22.23.4 or later. The job asks for
  `22`, which resolves to the newest 22.x. Every local build used Node 25.8.1,
  the only version on this machine.
- **Platform binaries.** The lockfile was written on macOS. It does list the
  Linux builds of workerd, the Astro compiler, Rolldown, Lightning CSS, and
  the Markdown parser, so `npm ci` should install them, but that install has
  not been run on Linux.
- **`wrangler dev` on a runner.** It starts without a login here, with
  telemetry off and `CI=1` set by the smoke script. Whether it prints a prompt
  or reaches for the network on a fresh runner is unconfirmed.
- **Shallow clone.** The checkout fetches one commit, so the sitemap's
  `lastmod` dates fall back to the build date and the build logs a warning.
  The crawl does not check those dates.

The `conformance` job still builds and crawls the Next app. Both run until
cutover.

## Verification

All of this ran against `wrangler dev` serving the built output, at the state
named at the top.

| Check | Result |
|-------|--------|
| `npm run build:site`, then `npm run smoke:site` | Pass. `astro check` reports 0 errors. |
| `npm run test:web` | Passes: the Next build, then its crawl of 665 routes. |
| `node scripts/smoke-site.mjs --against <next>` | 659 URLs crawled on each build. Every URL that is 200 on Next is 200 on Astro with the same content type, both redirects match, and the two sitemaps list the same 654 URLs. |
| `/api/chart` and `/api/mcp` GET, 12 samples | 6 byte-identical (every 400 response, including two dates outside 1920 to 2080, and the MCP description). 6 chart responses equal in structure with numbers within 1.1e-12. |
| `CAELUS_MCP_URL=<worker>/api/mcp node packages/caelus-mcp/integration.test.mjs` | 111 checks, 0 failures. Without the variable the stdio run passes 112. |
| `node scripts/smoke-live.mjs <worker>` | Passes. |
| `lint:claims`, `lint:emdash`, `lint:prose`, `check-docs`, `check-llms`, `check-mcp-surface` | All pass. |
| Page content, 43 pages | Visible text is identical to Next on every page except `/docs/mcp`. Headings, links, element counts, and CSS classes also match on those 42, apart from one React-generated id per page. |

`integration.test.mjs` has a hosted mode, selected by `CAELUS_MCP_URL`. The
committed goldens were minted on the full data tier and the hosted endpoint
serves the embedded tier, so in hosted mode the test builds the same server
core in process on the embedded tier and requires the endpoint's payloads to
equal it. A golden case the embedded tier cannot serve, such as a `date_sky`
search before 1000 CE, must be refused with the same message the reference
gives.

The 43 pages are the eleven top-level pages, the instrument, the docs hub,
`/docs/visualizations`, the API index, three API symbol pages, and all 25
guides.

## Measurements

One machine, Apple silicon, Node 25.8.1, at the state named at the top. Build
times cover the app's own build script, with workspace packages, API markdown,
and search index already built.

| | Next (`apps/web`) | Astro (`apps/site`) |
|---|---|---|
| Build, cold | 21.6 s | 5.5 s |
| Build, warm | 17.4 s | 5.0 s |
| Build output | 57.7 MB in 2,304 files, plus 2.0 MB `public` | 32.9 MB in 798 files, `public` included |
| Static files to serve | 13.9 MB in `.next/static` | 27.6 MB in 774 files, of which 12.4 MB is HTML |
| Server code | 43.1 MB in `.next/server` | 2.1 MB of Worker JS, 566 KB gzipped, plus 3.2 MB of source maps |

Client JavaScript the browser fetched, after load and a scroll to the bottom
of the page, gzip:

| Page | Next | Astro |
|------|------|-------|
| `/` | 373 KB (1,061 KB raw, 29 files) | 309 KB (825 KB raw, 27 files) |
| `/playground` | 2,179 KB (6,644 KB raw) | 2,117 KB (6,401 KB raw) |
| `/docs/quickstart` | 287 KB (825 KB raw, 17 files) | 72 KB (218 KB raw, 13 files) |

The home page and playground are dominated by the engine, its data, and the
corpus, which both builds ship. The saving there is Next's client runtime,
about 60 KB.

The docs figure for Next includes its prefetch of linked routes: once the
header is on screen, Next fetches the code for the pages it links to. The
page's own code is 114 KB (376 KB raw, 9 files). The same measurement gave
118 KB before the Sky Dating link joined the header, and Next's build report
puts that route's own code at 174 KB, which accounts for the jump. The Astro
build does not prefetch, so a prose page costs 72 KB however it is counted.

## Other differences from the Next deployment

- `/docs/mcp`: the two tab groups render every panel into the page and hide
  the inactive ones. Next rendered only the active panel. The look and the
  interaction are the same, and the page is searchable in full.
- Interactive pieces inside page bodies hydrate when they scroll near the
  viewport, not all at load.
- Linked routes are not prefetched, so a first click loads its page fresh.
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
- The Cloudflare build and deploy settings in the cutover steps. They follow
  the adapter's documentation and have not been exercised.
- The `site` CI job on a GitHub runner, as described under CI.
- CPU time as Cloudflare bills it. Locally a chart takes about 5 ms of wall
  time, `tools/list` about 22 ms, and a 34-year `find_aspect_dates` about
  0.7 s. The free plan allows 10 ms of CPU per request, so the MCP endpoint
  will need the paid plan, whose default is 30 s.
- A build under Node 22.
- Whether Cloudflare's build clones full git history. With a shallow clone,
  older pages get the build date as their sitemap `lastmod`.
- Pixel-level visual parity. Parity rests on the text and structure diffs
  above and on screenshots of a handful of pages. Only the instrument page
  was checked at 375 px, before the restyle, where its rendering matched
  Next's. The restyled pages were not compared by eye at narrow widths.
- Clipboard writes. The install and copy buttons hydrate and respond, but the
  test browser refused clipboard access to an unfocused page.
- The 615 API pages were compared by status and content type. Three were
  compared by text and structure.
- Hot reload in `astro dev`. The dev server answered every route over HTTP
  when last tried, before the restyle.
- The Open Graph image was byte-identical to Next's before the restyle. It
  was not compared again.

## Gates wired to `apps/web`

None of these has to change on cutover day if `apps/web` stays as the source
directory that `apps/site` builds from. They need repointing only when the
sources move into `apps/site`:

- Prose: `check-em-dashes.mjs`, `extract-web-prose.mjs`, `lint-prose.sh`.
- Claims: `claims-registry.json` (34 paths), `sync-facts.mjs` (the generated
  anchors file), `check-docs.mjs`, `check-versions.mjs`.
- Surface: `check-mcp-surface.mjs` (both route files and the data-tiers page),
  `check-llms.mjs` (`apps/web/public/llms.txt`).
- Generated inputs: `typedoc.json` (`out`), `build-search-index.mjs`,
  `build-chart-widget.mjs`, `build-gazetteer.mjs`.
- Tests: `test-web-libs.mjs`. `smoke-web.mjs` is replaced by
  `smoke-site.mjs`.

Three gates already read `core.ts` where they read `server.ts`, because the
MCP tools moved files: `sync-facts.mjs`, `check-mcp-surface.mjs`, and
`claims-registry.json`.

## Noticed, not changed

- Only the home page, `/embed/chart`, and the 404 page carry `og:image` tags.
  Every page built with `pageMetadata()` replaces the root Open Graph object
  and loses the image. The Astro build reproduces this.
- The hosted MCP endpoint resolves no named places, because the gazetteer is
  read from disk and the hosted bundle has none. The core accepts the rows as
  an option, so the Worker could bundle them (811 KB).
- `apps/web/tsconfig.json` type-checks both `.next/types` and
  `.next-ci/types`. Generated types left in one directory by an older build
  fail the other's type check when a route has since been removed, which is
  how `npm run test:web` failed here once. Deleting the stale directory fixes
  it. A clean checkout never has one.
- `CHANGELOG.md` has no entry for the `caelus-mcp/core` export. The file was
  off limits for this work.

## Changes to the repo at cutover

These are edits a session can make on request. They belong in the same change
as the DNS switch, not before it, because they stop the Next build.

- Point the root `build`, `test:web`, and `preflight` scripts at the site, and
  drop `vercel-build` from `apps/web/package.json`.
- Remove the Next build and `smoke:web` steps from the `conformance` job and
  from `release.yml`. The `site` job already covers the Astro build.
- Update `live-smoke.yml` and `smoke-live.mjs`. The checks are host-neutral,
  but their comments and failure messages name Vercel, its WAF, and its
  deploy delay.
- Add the changelog entry for `caelus-mcp/core`.

## Cutover: the steps only the owner can do

In order. Production stays on Vercel until step 8.

1. Create or choose the Cloudflare account, and turn on the Workers Paid
   plan. The MCP endpoint needs more CPU time per request than the free plan
   allows.
2. Add `ephemengine.com` to that account as a zone, copy the existing DNS
   records into it so they still point at Vercel, and change the nameservers
   at the registrar to Cloudflare's. A Worker can take a custom domain only on
   a zone Cloudflare serves. Wait until the zone shows as active.
3. Create the Worker and connect it to the GitHub repository. Set the build
   command to `npm ci && npm run build:site` at the repo root, the deploy
   command to `npx wrangler deploy` in `apps/site`, the production branch to
   `main`, and the Node version to 22. It needs no environment variables,
   secrets, or bindings. Choose a full clone if the build settings offer one.
4. Let the first build deploy to the Worker's `workers.dev` address. Nothing
   public points at it yet.
5. Check that address, or ask a session to run these against it:
   `node scripts/smoke-live.mjs <url>`,
   `node scripts/smoke-site.mjs --against https://www.ephemengine.com <url>`,
   and
   `CAELUS_MCP_URL=<url>/api/mcp node packages/caelus-mcp/integration.test.mjs`.
6. In the Cloudflare dashboard, read the Worker's CPU time for the MCP calls
   those checks made, and confirm it sits inside the plan's limit.
7. Say when to cut over, so the changes in the previous section can be merged
   to `main` with step 8.
8. Add `www.ephemengine.com` to the Worker as a custom domain, which takes the
   place of the `www` record that points at Vercel, and add a redirect rule
   that sends the apex, `ephemengine.com`, to `www`. This is the switch.
9. Run the `live-smoke` workflow by hand from the Actions tab, and load the
   site, the playground, and the Sky Dating instrument in a browser.
10. Reconnect one MCP client to the hosted endpoint and call a tool, since
    that endpoint has outside users.
11. Leave the Vercel project in place for a few days while the daily
    `live-smoke` run stays green. To roll back in that time, remove the custom
    domain from the Worker and restore the `www` record to Vercel.
12. Remove the domain from the Vercel project, then delete or pause the
    project.
