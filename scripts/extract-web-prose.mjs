#!/usr/bin/env node
/**
 * Extract user-facing prose from apps/web for Vale.
 * Writes .web-prose-extract.md (gitignored).
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
  "apps/web/app/playground/page.tsx",
  "apps/web/app/privacy/page.tsx",
  // Component copy: the playground's Reading panel and compare surfaces
  // carry full user-facing sentences, not just labels.
  "apps/web/components/SkyNow.tsx",
  "apps/web/components/ReadingTab.tsx",
  "apps/web/components/SynastryPanel.tsx",
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
