# Visual design system plan

2026-08-20

This plan owns the visual system: the Encyclopedia page-level
implementation of design direction 1a ("Plate", DS-02), the
disposition of the developer-site design work (DS-01), and stewardship
of the shared visual tokens. It is the third stream beside
`docs/product/encyclopedia-widgets-plan.md` (widgets and plates:
engine-driven figures and their machinery) and
`docs/product/corpus-build-plan.md` (corpus, KB, Encyclopedia
content). A dedicated visual design agent owns this plan; the widget
agent and the corpus agent own theirs. This document extracts the
visual work already described in those two plans, records where it
stands, and lists the research and decisions still open.

Decisions recorded here are owner decisions of 2026-08-20.

---

## Decisions

- **Three streams, three owners.** Widgets/engine work stays with the
  widgets plan; content, KB, and article writing stay with the corpus
  build plan; everything the reader sees as page — typography, grid,
  color, chrome, the parts inventory — is this plan's.
- **The design documents enter the repo.** `docs/design/` currently
  holds only the README; the four `.dc.html` documents and
  `support.js` from `design-system.zip` are committed by the
  maintainer as the first act of this stream. No page-level work
  starts from a summary of a design nobody working here can open.
- **The token layer is the boundary artifact, with a change
  protocol.** `PLATE_TOKENS`, `PLATE_THEME`, and `PLATE_BODY_INKS`
  (`packages/wheel/src/index.tsx`) are visual property: the design
  agent owns their values. The widget stream owns the machinery that
  consumes and gates them. Because token changes move committed figure
  hashes, a token change ships in one commit with the mechanical
  regeneration:
  `npm run plates:scan` and
  `CAELUS_FIGURES_WRITE=1 node packages/widgets/dist/test/harness.test.js`,
  then the widgets suites green. A token commit that leaves the
  harness red is an unfinished commit.
- **DS-01 disposition is assigned research, not a standing question.**
  The design agent reads the DS-01 audit and proposal against the live
  `design(site)` commit stream and returns a recommendation (see "The
  DS-01 question" below). The maintainer's stated inclination: the new
  work supersedes DS-01, after mining DS-01 and the live stream for
  what survives. Peach blossom is explicitly liked.
- **Branch topology.** The design agent works on its own branch and
  merges into `feature/house-corpus` through the same verified-merge
  ritual the widget stream uses: build, root test, scan `--check`,
  widgets harness, then push. `openmemory.md` has three writers now;
  edits stay additive.

---

## Scope

**In:** the Encyclopedia page shell and the Plate direction's parts
inventory; fonts; the plate theme token values; the visual treatment
of non-computed figures (photographs, historical plates, facsimiles
from the library pipeline); the visual side of the plate registry's
consumers (search results, counts, per-entry lists); DS-01 research
and disposition; print and accessibility posture.

**Out:** widget geometry, scenes, and interaction machinery (widgets
plan); the figure harness, registry scan, and their gates (widgets
plan); article prose, KB structure, and source ingestion (corpus build
plan); release mechanics (`docs/releasing.md`, the maintainer's).

---

## What the design system already has (state, 2026-08-20)

Implemented on the widget side and mechanically enforced; the design
agent inherits these as fixed points unless a token change goes
through the protocol above:

- **Plate theme tokens**, complete over all thirteen bodies plus
  points (`PLATE_TOKENS`: paper `#f7f3e9`, panel `#fdfbf5`, ink
  `#22201c`, oxblood `#8c2f2a`; `PLATE_THEME`; `PLATE_BODY_INKS`).
  `render.test.tsx` asserts completeness over `GLYPHS` and that
  oxblood appears in no base token.
- **The plate part**: `PlateFrame` — 1px mid rule on the plate ground,
  `Fig. N`, apparatus caption, revision stamp verified against the
  computing engine by the figure harness, reproduce permalink.
- **The plate console** (the seventh part): scrub rail with the
  oxblood index, mono small-caps station labels, datum lines in the
  documented register; the comparator's system picker is the mono
  list with the current item in oxblood. Tests assert the single
  accent mechanically (oxblood exactly once per console surface).
- **The constraints as built behavior**: no hover cards, no shadows,
  no rounded corners, no fills behind text; controls are frames and
  rules; the horizon takes the heaviest ink line and the ecliptic the
  oxblood accent, fixed across every station.
- **The plate registry** (scanned from the MDX sources, CI-gated):
  plates are first-class records with id, caption, entry locator, and
  a KB node id asserted to exist — the data the kind marks, search
  results, and counts consume.

What does not exist yet is the page: there are no Encyclopedia
routes, no EB Garamond on warm paper, and the app loads only Inter and
JetBrains Mono. The plate components carry font-stack fallbacks; no
page loads IBM Plex Mono or EB Garamond. Four seed entries live
unrouted at `apps/web/content/encyclopedia/`.

---

## Extracted work

### From the widgets plan ("Design system integration" and the parts inventory)

1. **The Encyclopedia page shell.** Routes
   (`apps/web/app/encyclopedia/<slug>/`), the Plate direction's
   typography (EB Garamond on `#f7f3e9` / `#fdfbf5`, ink `#22201c`),
   type scale, measure, and grid, per
   `Encyclopedia Design System - Plate.dc.html`. The registry scan
   already walks `app/encyclopedia/*/page.mdx` the moment it exists;
   the seed entries migrate from `content/encyclopedia/` without
   touching the registry pipeline.
2. **Fonts.** Loading EB Garamond and IBM Plex Mono (strategy is an
   open decision below). The Encyclopedia shares nothing visually with
   the developer site.
3. **The parts inventory, completed.** Entry link, kind marks, note
   markers (notes resolve below the rule), the KB-fed infobox, the
   plate (built), the revision stamp (built at plate level; the
   page-level stamp treatment is this stream's), and the plate console
   (built). Direction 1b's "In the delineation corpus" block and
   direction 1c's "Cite · Permalink · JSON-LD" apparatus: the data
   contracts exist (`parseCellId`, `jsonld.ts`, the reproduce
   permalink); the page surfaces do not.
4. **Registry consumers, visual side.** Plates as search results
   ("Fig. 1 · The horizon axis", located "In Ascendant §1"), the home
   plate count, per-entry plate lists. The registry artifact supplies
   the data; this stream designs and builds the surfaces.
5. **The precision-tier footnote**: one shared component stating the
   compute tier once per page.
6. **The constraints as review gates.** Oxblood keeps a single
   meaning; the prohibition list holds on every new surface. Where a
   rule is testable it gets a test, the way the console's single
   accent already has one.

### From the corpus build plan (stream G, the Encyclopedia section)

7. **Article pages at the SEP / 1911 standard**, carrying computed
   plates alongside photographs, historical plates, and diagrams. Computed figures arrive framed and stamped; the visual
   treatment of non-computed figures — scanned images from the library
   pipeline (rights-classed per
   `docs/product/library-ingestion-plan.md`), photographs, redrawn
   diagrams — needs its own frame, caption, and provenance apparatus,
   designed to sit beside the stamped plates without impersonating
   them.
8. **The Hermes frame widens the system.** Kind marks and article
   furniture must extend beyond astrology to the curated hermetic
   subtrees (alchemy, kabbalah, tarot, practices, works, persons) as
   the KB grows them. Memorativa-backed figures (the `kamea` and
   `number` widget kinds) are grids and letter tables, not wheels: the
   plate theme needs treatments for those forms, and their stamps read
   `Figures · memorativa <version>` under the same discipline.
9. **The coverage-report surface** (KB extent: article / glossary /
   not-written per node), when a page shows it, is this stream's
   presentation problem; the data is the corpus stream's.

---

## Interfaces and ownership

| Artifact | Owner | Consumers | Protocol |
| --- | --- | --- | --- |
| `PLATE_TOKENS` / `PLATE_THEME` / `PLATE_BODY_INKS` values | design agent | wheel, widgets, harness | token change + hash regeneration in one commit (see Decisions) |
| Wheel/widget components and gates | widget agent | design agent's pages | design asks land as issues on the widgets plan, not direct edits |
| `apps/web/app/globals.css`, font loading in `layout.tsx` | design agent | whole site | `layout.tsx` is shared with the reader-chart provider; coordinate edits |
| `apps/web/app/encyclopedia/**` page shell | design agent | corpus agent's articles | shell renders MDX; `W` specs stay scan-validated |
| Encyclopedia MDX entry content | corpus agent | design shell, registry scan | captions pass the prose gate; specs are JSON literals |
| `docs/design/**` | design agent | everyone | maintainer commits the `.dc.html` set first |
| `openmemory.md` | all three | all three | additive edits only |

---

## The DS-01 question (assigned research)

DS-01 is the developer-site audit
(`Caelus Site - current.dc.html`) and token-refactor proposal
(`Caelus Design System.dc.html`). Since it was written, the site has
had its own live design stream (`design(site)` commits: one visual
vocabulary across home/playground/features, the footer Caelus mark,
peach blossom as the warm counterpoint to the structural purple, then
peach blossom as the extra-spectral hue).

The design agent's first research task: read DS-01 against that
stream and the current `globals.css`, and report —

- which DS-01 audit findings the live stream already fixed, which
  still stand (finding 08, the light theme stranding ten chart
  colors, is the one the widgets plan names);
- what in the DS-01 proposal is worth carrying into the current
  direction, and what the live stream did better;
- a recommendation: adopt, absorb, or retire DS-01, with the specific
  keepers named.

The maintainer's inclination, recorded: the newer work supersedes
DS-01, but mine both for keepers first. Peach blossom stays.

---

## Open decisions (for the maintainer)

1. **Font loading strategy.** `next/font/google` versus self-hosted
   files; which weights of EB Garamond and IBM Plex Mono; subsetting.
2. **Encyclopedia theme policy.** The Plate direction is a single
   ink-on-paper look. Does the Encyclopedia ignore the site's
   dark-theme toggle (one committed look), or need a designed dark
   variant? The plate theme's completeness rule applies to any second
   theme: a theme is complete or it does not merge.
3. **Print.** Plates are print-ready by construction; is a whole-
   article print stylesheet in scope, and when?
4. **Accessibility posture.** Contrast of oxblood on the paper ground
   at small mono sizes; focus indicators within the frames-and-rules
   constraint; anything beyond the reduced-motion handling the widgets
   already do.
5. **Non-computed figure apparatus.** How photographs and facsimiles
   are framed, captioned, and credited so they read as evidence beside
   the stamped plates (interacts with the library pipeline's rights
   classes).
6. **Kind marks under the Hermes frame.** The mark set for article,
   glossary, person, source, and plate — and whether the hermetic
   divisions get marks of their own.
7. **DS-01 disposition**, on receipt of the research above.
8. **Token sharing between the two sites.** The plans say the
   Encyclopedia shares nothing visually with the developer site;
   confirm that extends to sharing no token infrastructure, or define
   the one seam.

---

## Verification

- The figure harness and registry scan gate every visual change that
  touches a plate; the token protocol keeps them green by
  construction.
- The wheel and widgets test suites carry the mechanical design
  assertions (theme completeness, oxblood counts); new page-level
  rules get the same treatment where they are testable.
- Page copy introduced by the shell joins the prose gate: the
  extractor (`scripts/extract-web-prose.mjs`) names its files, and
  already walks the Encyclopedia entry sources and plate captions.
- `npm run test:web` (build plus smoke) is the closing gate for any
  page-level change, as for the other streams.
