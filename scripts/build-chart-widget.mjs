#!/usr/bin/env node
/**
 * Bundle the standalone in-host chart widget.
 *
 * Compiles apps/web/widget/chart-widget.ts (React + caelus-wheel) into a single
 * self-contained IIFE at apps/web/public/embed/chart-widget.js. The caelus-mcp
 * `ui://widget/chart.html` resource loads this script directly (no iframe), so
 * MCP Apps / Apps-SDK hosts render the chart wheel in their own sandbox.
 *
 * Runs as part of `npm run build -w web` (before `next build`), so the asset is
 * present whenever the site is built or served. esbuild is a repo devDependency;
 * caelus-wheel and react resolve from apps/web (caelus-wheel must be built first,
 * the same precondition `next build` already has for the /embed/chart route).
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(ROOT, "apps", "web", "widget", "chart-widget.ts");
const outfile = join(ROOT, "apps", "web", "public", "embed", "chart-widget.js");

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  // Production React: drops dev-only warnings and the slower dev paths.
  define: { "process.env.NODE_ENV": '"production"' },
});

console.log(`chart widget bundled -> ${outfile.replace(ROOT + "/", "")}`);
