# Site-wide Workbench restyle: screenshots

The site was restyled to the Workbench grammar in `apps/web/DESIGN.md` in one
change. These are first-screen captures of the Next production build, taken
with headless Chrome at 1440 by 900 and 375 by 812, in both themes. The file
name is `<page>-<width>-<theme>.png`.

| Page | Route |
|------|-------|
| `home` | `/` |
| `docs-guide` | `/docs/sky-dating` |
| `api-reference` | `/docs/api` |
| `validation` | `/validation` |
| `playground` | `/playground` |
| `instrument` | `/instruments/sky-dating` |

`home-1440-dark-full.png` is the whole home page.

## What was measured

Every page type on the site (the six above, plus the docs index, the
quickstart, an API function page, Features, Methods, Notes, Provenance,
Changelog, Privacy, How it was built, and the 404 page) was loaded at 375px
and 1440px in both themes. None scrolls sideways. Wide tables, code blocks,
the playground tab row, and the status bar's navigation scroll inside their
own box.

Counts in `apps/web/app/globals.css`, before and after:

| Declaration | Before | After |
|-------------|--------|-------|
| gradients | 10 | 0 |
| `backdrop-filter` | 4 | 0 |
| `box-shadow` | 3 | 0 |
| `border-radius` | 23 | 3, all `border-radius: 0` resets on native controls |
| `@keyframes` | 2 | 0 |
| `transition` | 14 | 0, apart from the reduced-motion override |

## Known rough edges

- The station labels under the home sky's scrubber overlap at phone width.
  They are drawn by `PlateConsole` in `packages/widgets`, which this change
  did not touch.
- The ecliptic ribbon on the home page is small at phone width, as it was
  before.
- The Playground's parts sit between rules as tiles but have no tile headers
  or IDs. Adding them means changing `Workspace.tsx`.
