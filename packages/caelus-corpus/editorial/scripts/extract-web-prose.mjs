#!/usr/bin/env node
/**
 * Extract user-facing prose from an app's source for Vale.
 * Writes .web-prose-extract.md and .free-prose-extract.md (both gitignored).
 *
 * ---------------------------------------------------------------------------
 * STATUS: carried over as a reference implementation. It does NOT run as-is.
 *
 * The paths below are the source project's; repoint them at yours. And know
 * the defect before you trust the output (editorial/README.md has the long
 * version):
 *
 *   1. It scrapes TypeScript along with the prose. Roughly 18% of the lines
 *      Vale ends up grading are imports, type declarations and JSX props.
 *      Vale grades them and finds nothing, which reads exactly like clean
 *      copy.
 *   2. It only walks .tsx, so copy living in .ts modules -- labels, verdict
 *      names, chip text, anything a component imports rather than inlines --
 *      is never linted at all.
 *
 * The better fix is to stop scraping. Put user-facing strings in one module
 * per surface, or in message catalogs, and point Vale at those files
 * directly. Scraping was always a workaround for copy scattered through
 * components.
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const files = [
  "apps/web/app/page.tsx",
  "apps/web/app/notes/page.tsx",
  "apps/web/app/provenance/page.tsx",
  "apps/web/app/validation/page.tsx",
  "apps/web/app/methods/page.tsx",
  "apps/web/app/how-it-was-built/page.tsx",
  "apps/web/app/features/page.tsx",
];

const chunks = ["# Web prose extract (auto-generated for Vale)\n"];

function add(line) {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length < 12) return;
  if (/[{=>]|const |useState|style=|opacity:|fontSize:/.test(t)) return;
  // Code lines inside multi-line JSX props (CodeBlock `code={...}`) survive the
  // tag strip; they are source, not prose, and their comment syntax reads as
  // punctuation errors.
  if (/^\/\/|^\s*\*|;$/.test(t)) return;
  chunks.push(t, "\n");
}

for (const file of files) {
  const text = readFileSync(join(root, file), "utf8");
  chunks.push(`\n## ${relative(root, file)}\n`);

  for (const m of text.matchAll(/description:\s*"([^"]+)"/g)) add(m[1]);

  // Multi-line JSX text between tags (P, H2, h1, strong)
  for (const m of text.matchAll(/(?:<P>|<H2>|<h1[^>]*>|>)\s*([\s\S]*?)<\//g)) {
    const block = m[1].replace(/\{[^}]+\}/g, " ").replace(/<[^>]+>/g, " ");
    for (const line of block.split(/\n/)) add(line);
  }
}

// The MDX guides are the rest of the site's prose. They are code-heavy, so the
// body is stripped to running text first: fenced blocks, JSX islands, tables,
// and import/export lines all carry identifiers that read as spelling errors
// and as sentence fragments. What survives is the paragraph text, which is what
// the voice rules are meant to see.
const mdxFiles = globSync("apps/web/app/docs/**/page.mdx", { cwd: root }).sort();

for (const file of mdxFiles) {
  const text = readFileSync(join(root, file), "utf8");
  chunks.push(`\n## ${relative(root, file)}\n`);

  for (const m of text.matchAll(/description:\s*"([^"]+)"/g)) add(m[1]);

  const body = text
    .replace(/```[\s\S]*?```/g, " ")          // fenced code
    .replace(/^(?:import|export)\s[\s\S]*?$/gm, " ") // module lines
    .replace(/<[^>]+>/g, " ")                  // JSX tags
    .replace(/`[^`\n]*`/g, "code")            // inline code → a neutral token
    .replace(/^\s*\|.*$/gm, " ")              // table rows
    .replace(/^\s*[-*+]\s+/gm, "")            // list bullets
    // Bold is how the reference docs mark a defined term or a negation that a
    // reader must not skim past ("does **not** throw"). That is ordinary
    // technical markup, so it is normalized away before the emphasis rules run.
    .replaceAll("**", "");

  for (const line of body.split(/\n/)) add(line);
}

writeFileSync(join(root, ".web-prose-extract.md"), chunks.join("\n"));
console.log("Wrote .web-prose-extract.md");

// Caelus Free is the consumer surface: same extraction, its own file, so the
// product-copy rules (insider vocabulary above all) gate it separately from
// the developer pages, which legitimately name their own API terms.
const freeFiles = [
  ...globSync("apps/web/app/free/**/*.tsx", { cwd: root }),
  ...globSync("apps/web/components/free/**/*.tsx", { cwd: root }),
].sort();

const freeChunks = ["# Caelus Free prose extract (auto-generated for Vale)\n"];
const addFree = (line) => {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length < 12) return;
  if (/[{=>]|const |useState|style=|opacity:|fontSize:/.test(t)) return;
  if (/^\/\/|^\s*\*|;$/.test(t)) return;
  freeChunks.push(t, "\n");
};

for (const file of freeFiles) {
  const text = readFileSync(join(root, file), "utf8");
  freeChunks.push(`\n## ${relative(root, file)}\n`);
  for (const m of text.matchAll(/description:\s*\n?\s*"([^"]+)"/g)) addFree(m[1]);
  for (const m of text.matchAll(/(?:<P>|<H2>|<h1[^>]*>|>)\s*([\s\S]*?)<\//g)) {
    const block = m[1].replace(/\{[^}]+\}/g, " ").replace(/<[^>]+>/g, " ");
    for (const line of block.split(/\n/)) addFree(line);
  }
}

writeFileSync(join(root, ".free-prose-extract.md"), freeChunks.join("\n"));
console.log("Wrote .free-prose-extract.md");
