#!/usr/bin/env bash
# Push the current caelus-mcp server.json to the official MCP Registry.
#
# This is the one release step outside the tag workflow: the Registry verifies
# metadata against the npm artifact, and publishing needs GitHub device-code
# auth as the io.github.heavyblotto namespace owner -- an interactive step no
# CI runner should hold. Everything around that step is automated here:
# fetch the CLI (pinned location, once per machine), validate server.json,
# publish, and verify the listing went active.
#
# Preconditions: caelus-mcp@<server.json version> must already be live on npm
# (the Registry rejects unpublished versions), and server.json's versions must
# match it -- `npm run check:versions` asserts that.
#
# Usage, from the repo root, after the npm publish is live:
#   bash scripts/mcp-registry-push.sh
set -euo pipefail

cd "$(dirname "$0")/../packages/caelus-mcp"

VERSION="$(node -p "require('./server.json').version")"
NAME="io.github.heavyblotto/caelus-mcp"

if ! npm view "caelus-mcp@$VERSION" version >/dev/null 2>&1; then
  echo "caelus-mcp@$VERSION is not on npm yet -- the Registry verifies against" >&2
  echo "the published artifact, so publish (tag workflow) first." >&2
  exit 1
fi

if [ ! -x ./mcp-publisher ]; then
  echo "fetching mcp-publisher CLI..."
  curl -sSfL "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
fi

./mcp-publisher validate

# Interactive (device code) the first time per machine; the token persists.
./mcp-publisher login github

./mcp-publisher publish

echo "verifying listing..."
curl -sf "https://registry.modelcontextprotocol.io/v0/servers?search=$NAME" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      const s=JSON.parse(d).servers?.find(x=>x.name===process.argv[1]);
      if(!s){console.error('listing not found');process.exit(1);}
      console.log('registry listing:', s.name, s.version ?? '', s.status ?? '');
    })" "$NAME"
