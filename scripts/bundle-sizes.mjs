/**
 * Bundle sizes: measure what each entrypoint actually costs a consumer, after
 * tree-shaking and minification, gzipped and brotli'd. The data-tiers doc
 * quotes these; regenerate after anything that moves the package surface.
 *
 * Real numbers, not estimates: esbuild bundles each import the way an app
 * bundler would, so unused modules (events, eclipses, query, derived, turbo,
 * electional, scan) are shaken out of a chart-only import. Run from the repo
 * root after `npm run build`. Requires esbuild (a devDependency).
 *
 *   npm run build && npm run bundle-sizes
 */
import { build } from "esbuild";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  {
    name: "caelus — engine, chart only",
    code: `export { Engine } from "caelus";`,
    platform: "browser",
  },
  {
    name: "caelus — engine + embedded data",
    code: `export { Engine } from "caelus";
           export { embeddedData } from "caelus/data-embedded";`,
    platform: "browser",
  },
  {
    name: "caelus — full surface",
    code: `export * from "caelus";`,
    platform: "browser",
  },
  {
    name: "caelus-wheel",
    code: `export { ChartWheel } from "caelus-wheel";`,
    platform: "browser",
    external: ["react", "react-dom", "react/jsx-runtime"],
  },
  {
    name: "caelus-birth",
    code: `export { localToChart, toUT } from "caelus-birth";`,
    platform: "browser",
  },
  {
    name: "caelus-mcp (server)",
    code: `export { buildServer } from "caelus-mcp";`,
    platform: "node",
    external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*", "zod"],
  },
];

const kb = (n) => (n / 1024).toFixed(1);

async function measure(t) {
  const r = await build({
    stdin: { contents: t.code, resolveDir: ROOT, loader: "ts", sourcefile: "entry.ts" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: t.platform,
    external: t.external ?? [],
    write: false,
    legalComments: "none",
    logLevel: "silent",
  });
  const bytes = r.outputFiles[0].contents;
  return {
    min: bytes.length,
    gz: gzipSync(bytes, { level: 9 }).length,
    br: brotliCompressSync(bytes).length,
  };
}

const rows = [];
for (const t of TARGETS) {
  try {
    const s = await measure(t);
    rows.push([t.name, kb(s.min), kb(s.gz), kb(s.br)]);
  } catch (e) {
    rows.push([t.name, "ERR", "ERR", String(e.message).slice(0, 60)]);
  }
}

const head = ["Entrypoint", "minified", "gzip", "brotli"];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const fmt = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
console.log(fmt(head));
console.log(widths.map((w) => "-".repeat(w)).join("  "));
for (const r of rows) console.log(fmt(r));

console.log("\nMarkdown:\n");
console.log(`| ${head.join(" | ")} |`);
console.log(`| ${head.map(() => "---").join(" | ")} |`);
for (const r of rows) console.log(`| ${r[0]} | ${r[1]} KB | ${r[2]} KB | ${r[3]} KB |`);
