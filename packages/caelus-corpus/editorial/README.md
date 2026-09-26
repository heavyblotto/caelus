# The editorial machinery

Two different jobs live here, and it is worth keeping them apart:

- **The corpus** is gated by `src/lint.ts` — length bands, banned phrases,
  reading level, and four kinds of duplication measured across a family. That
  machinery is in the package, not here, because it knows about cell families.
- **Documentation and product copy** are gated by Vale plus the em-dash
  check, which is what this directory holds. Vale knows nothing about
  astrology; it grades register.

## Contents

| Path | What it is |
|---|---|
| `editorial-voice.md` | the voice. Read this before editing any user-facing prose. |
| `ai-slop-style-sheet.md` | the specific tells the Vale rules encode |
| `styles/` | 50 vendored Vale rule files |
| `scripts/check-em-dashes.mjs` | the em-dash gate, pure Node, no install needed |
| `scripts/lint-prose.sh` | the runner |

`.vale.ini` sits at the repo root, where Vale looks for it.

## The voice, in one paragraph

Never dress conviction as measurement, and never dress marketing as
engineering. Consumer copy gets four more rules on top: write from the user's
side (every sentence says what they get or do), keep insider vocabulary out
(the words the code uses for things are not the words a reader uses), plain
spoken sentences (if it would sound odd said aloud to a friend, rewrite it),
and vary the rhythm (runs of short clipped sentences and lists of parallel
imperatives read as machine cadence). `editorial-voice.md` is the full text.

## The styles

`styles/ai-tells/` is the vendored [vale-ai-tells][] package, pinned in
`.vale.ini` at v1.6.1 — 41 rules for the register that gives machine writing
away: hedging, mic-drop closers, verb tricolons, contrastive formulas,
metacommentary, sycophancy, promotional puffery.

`styles/Caelus/` and `styles/web/` are local: `MetaVoice`, `SlopPhrases`,
`AntithesisFlex`, `ClippedFragment`, `EmDash`, and `InsiderVocabulary` — the
gate that keeps engine and trade vocabulary off consumer surfaces.

`styles/config/vocabularies/Caelus/` is the accept/reject word list. Rename
the vocabulary in `.vale.ini` if the new project is not called Caelus; the
list itself is mostly astrology and astronomy terms and stays useful either
way.

[vale-ai-tells]: https://github.com/tbhb/vale-ai-tells

## Running it

```bash
npm run lint:prose                              # nothing to walk yet
PROSE_DIRS='app components' npm run lint:prose  # once there is an app
```

The em-dash lane is pure Node and always runs. Vale needs `vale` on PATH
(`brew install vale`); the script says so and still returns the em-dash
result rather than passing silently.

The gate is deliberately not pointed at `editorial/` or `pipeline/`. Those
are working documents addressed to writers and reviewers, and they quote the
phrasings they ban.

## Product copy is the host repo's job

This kit gates the editorial guides and the writing sheets. Product-copy
extraction lives with the product: in the Caelus monorepo the extractor is
`scripts/extract-web-prose.mjs` at the repo root, run by the root
`lint:prose`, and it names the page and component files it walks. A
carried-over reference extractor with a known defect (it scraped TypeScript
as prose and skipped `.ts` modules entirely) was removed from this kit on
2026-08-19.
