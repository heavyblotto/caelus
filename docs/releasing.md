# Releasing

Publishing is automated; claiming names and the token are one-time manual
steps (they need npm account auth no CI runner should hold interactively).

## One-time setup

1. On npmjs.com: create/log into the publishing account.
2. Create an **automation** access token (Settings → Access Tokens →
   Generate → Automation; bypasses 2FA for CI).
3. Add it to the repo: GitHub → Settings → Secrets and variables →
   Actions → new secret `NPM_TOKEN`.

All four names are unscoped (`caelus`, `caelus-mcp`, `caelus-birth`,
`caelus-wheel` — the `@caelus` scope is claimed/reserved on npm) and are
registered by the first publish itself. Re-check before tagging:
`npm view caelus` should still 404.

## Each release

1. Bump versions in the four package.json files (lockstep on feature
   releases; a metadata-only patch may bump a single package — see MCP
   Registry below) and in `llms.txt` + `apps/web/public/llms.txt` —
   `node scripts/check-llms.mjs` verifies the sync, CI enforces it.
2. Update `caelus-mcp`'s dependency range on `caelus` if needed.
3. Commit, then tag and push:
   ```
   git tag v0.1.0 && git push origin v0.1.0
   ```
   Remote-execution sessions cannot push tags (the git proxy rejects tag
   refs); from those, dispatch the `release` workflow on `main` instead
   (Actions → release → Run workflow) and push the tag afterward from a
   local clone. The published versions come from package.json either way.
4. The release workflow runs the full verification chain (golden suite,
   MCP oracle suite, birth tzdb suite, wheel render suite, llms.txt sync)
   and publishes all four packages with `--provenance`. A red suite
   blocks the publish.

Publishes are idempotent: `scripts/publish-if-missing.sh` skips any
package whose version is already on the registry, so pushing a tag after
a dispatch release (or re-running a partially failed workflow) is safe.

## MCP Registry (`caelus-mcp`)

`caelus-mcp` is listed on the official MCP Registry as
`io.github.heavyblotto/caelus-mcp`. This is the upstream that downstream
directories (mcp.so, Glama, Smithery) sync from. The Registry hosts metadata
only and **verifies it against the published npm artifact**, so two invariants
must hold:

1. `packages/caelus-mcp/package.json` carries
   `"mcpName": "io.github.heavyblotto/caelus-mcp"` (committed since 0.12.1).
2. `packages/caelus-mcp/server.json` `version` and `packages[].version` match a
   version of `caelus-mcp` that is **already published to npm** and contains
   `mcpName`. npm versions are immutable, so a new Registry listing always needs
   a newly published version that carries the field — that is why 0.12.1 was
   cut (a metadata-only `caelus-mcp` patch, the other three stayed at 0.12.0).

To push a new version to the Registry, **after** `caelus-mcp@X.Y.Z` is live on
npm: bump `server.json` to `X.Y.Z`, then from `packages/caelus-mcp/`:

```
# one-time per machine — grab the CLI
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher

./mcp-publisher validate        # server.json vs the registry schema
./mcp-publisher login github     # device-code auth as the heavyblotto account (the io.github.heavyblotto namespace owner); token persists
./mcp-publisher publish
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.heavyblotto/caelus-mcp"  # verify (status: active)
```

The hand-curated lists are separate one-time submissions, not synced from the
Registry: the marketplace issues live at `chatmcp/mcpso` (mcp.so) and
`lobehub/lobehub` (LobeHub), and a PR to `punkpeye/awesome-mcp-servers`.

## What ships

`caelus` ships slim (~2.0 MB unpacked): embedded VSOP tiers, the
1920–2080 precise-Moon Chebyshev tier, Chiron, nutation, Pluto. The
full-range Moon tier (1850–2150, 3.1 MB, same precision) stays in the
repo; `loadNodeData(dir, level, "full")` falls back to the embedded tier
when the full file is absent. Outside 1920–2080 the engine uses the
analytic series (~10″) — documented on /validation.
