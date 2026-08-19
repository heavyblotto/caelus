#!/usr/bin/env bash
# Prose gates for documentation and product copy.
#
# Two lanes:
#   1. The em-dash check, pure Node, runs everywhere and needs nothing
#      installed. It also catches the `&mdash;` entity dodge.
#   2. Vale, which needs `vale` on PATH (brew install vale / https://vale.sh).
#
# PROSE_DIRS below is the only thing to edit when you wire this into a new
# project: point it at the directories holding user-facing source. With no
# app in the repo yet, the em-dash check has nothing to walk and says so.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Directories of user-facing source to gate. Space-separated, relative to root.
PROSE_DIRS="${PROSE_DIRS:-}"

FAIL=0

echo "→ Em-dash check"
if [ -n "$PROSE_DIRS" ]; then
  node editorial/scripts/check-em-dashes.mjs $PROSE_DIRS || FAIL=1
else
  echo "  PROSE_DIRS is empty — no app source to walk yet. Set it when there is:"
  echo "    PROSE_DIRS='app components' npm run lint:prose"
fi
echo ""

# Note the em-dash gate is deliberately not pointed at editorial/ or
# pipeline/. Those are working documents addressed to writers and reviewers,
# not shipped prose, and they quote the phrasings they ban.

if ! command -v vale >/dev/null 2>&1; then
  echo "vale not found — install: brew install vale (https://vale.sh)"
  echo "(the em-dash lane above still ran and its result stands)"
  exit "$FAIL"
fi

# Styles are vendored under editorial/styles; sync refreshes the pinned
# package when the network allows and is skipped quietly when it does not.
vale sync >/dev/null 2>&1 || echo "vale sync unavailable — using vendored styles"

echo "→ Vale on the editorial guides"
vale editorial/editorial-voice.md editorial/ai-slop-style-sheet.md || FAIL=1
echo ""

echo "→ Vale on the writing and review sheets"
vale pipeline/*.md || FAIL=1
echo ""

# The extractor is app-coupled: it needs a target to scrape, and it carries a
# known defect (see editorial/README.md). It runs only once you have pointed
# it at real source and fixed that defect.
if [ -n "$PROSE_DIRS" ]; then
  echo "→ Extract + Vale on product copy"
  node editorial/scripts/extract-web-prose.mjs
  [ -f .web-prose-extract.md ]  && { vale .web-prose-extract.md  || FAIL=1; }
  [ -f .free-prose-extract.md ] && { vale .free-prose-extract.md || FAIL=1; }
  echo ""
fi

exit "$FAIL"
