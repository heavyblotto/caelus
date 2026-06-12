#!/usr/bin/env bash
# Publish a workspace package unless its version is already on the registry.
# Makes the release workflow idempotent: re-running it (tag push after a
# manual dispatch, or vice versa) skips work instead of failing on E403.
set -euo pipefail

PKG="$1"   # npm package name, e.g. caelus-mcp
DIR="$2"   # workspace dir, e.g. packages/caelus-mcp

VERSION="$(node -p "require('./$DIR/package.json').version")"
if npm view "$PKG@$VERSION" version >/dev/null 2>&1; then
  echo "$PKG@$VERSION already on the registry — skipping publish"
else
  npm publish --provenance --access public -w "$PKG"
fi
