#!/usr/bin/env node
/**
 * Fail the build on em-dashes in rendered site prose.
 *
 * The editorial voice (editorial/editorial-voice.md) and slop style sheet
 * (editorial/ai-slop-style-sheet.md) ban em-dash parentheticals in prose. The Vale
 * prose extract only scans the files it is pointed at and does not decode
 * HTML entities, so em-dashes in the MDX docs — and
 * the `&mdash;` entity dodge — slipped past it. This scans every source
 * file for the em-dash character and its entities, after blanking the places an
 * em-dash is legitimately data rather than prose:
 *   - fenced code blocks, inline/template code spans, and code comments
 *   - a lone "—" / '—' string literal (a UI "no value" sentinel)
 *   - markdown table cells (the standard "not applicable" marker)
 *
 * Blanking preserves newlines so reported line numbers stay accurate.
 *
 * Takes one or more directories to scan, relative to the repo root:
 *
 *   node editorial/scripts/check-em-dashes.mjs app components
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TARGETS = process.argv.slice(2);
if (TARGETS.length === 0) {
  console.error("usage: check-em-dashes.mjs <dir> [dir...]  (paths relative to the repo root)");
  process.exit(2);
}
const SCAN_EXT = new Set([".tsx", ".ts", ".mdx", ".md"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".next-ci", ".vercel", "content"]);
// Em-dash character and its HTML entities (named, decimal, hex).
const EM_DASH = /\u2014|&mdash;|&#8212;|&#x2014;/gi;

/** Replace every non-newline char in `s` with a space (keeps line numbers). */
const blank = (s) => s.replace(/[^\n]/g, " ");

/** Remove the spans where an em-dash is code or a sentinel, not prose. */
function stripNonProse(text) {
  return text
    .replace(/```[\s\S]*?```/g, blank)             // fenced code blocks
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)        // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, blank)            // block comments
    .replace(/(?<![:/])\/\/[^\n]*/g, blank)         // line comments (not URLs)
    // Template literals passed as JSX props (`code={`…`}`) legitimately span
    // lines, so they are consumed first, as a whole. The alternation honours
    // escaped backticks (\`) so a nested template is consumed whole rather
    // than mismatched at the escaped backtick.
    .replace(/=\{`(?:\\.|[^`\\])*`\}/gs, blank)
    // Remaining inline code spans may not cross a line. Letting them span
    // newlines made backtick parity decide whether a paragraph counted as
    // prose: in the MDX guides a run of inline spans could pair across an
    // intervening sentence and blank a real em-dash out of the scan.
    .replace(/`(?:\\.|[^`\\\n])*`/g, blank)
    .replace(/(["'])\u2014\1/g, blank);             // lone "—" / '—' sentinel
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(entry.slice(entry.lastIndexOf(".")))) out.push(full);
  }
}

const files = [];
for (const t of TARGETS) walk(join(ROOT, t), files);

const violations = [];
for (const file of files.sort()) {
  const original = readFileSync(file, "utf8").split("\n");
  const scanned = stripNonProse(readFileSync(file, "utf8")).split("\n");
  scanned.forEach((line, i) => {
    // A markdown table cell using — as the "not applicable" marker is data.
    if (original[i].trimStart().startsWith("|")) return;
    for (const m of line.matchAll(EM_DASH)) {
      violations.push({
        file: relative(ROOT, file),
        line: i + 1,
        snippet: original[i].trim().slice(0, 100),
        token: m[0],
      });
    }
  });
}

if (violations.length) {
  console.error(`em-dash check FAILED — ${violations.length} in rendered prose:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  (${v.token})\n    ${v.snippet}`);
  }
  console.error(
    "\nThe editorial voice bans em-dashes in prose (editorial/ai-slop-style-sheet.md):" +
    "\nreplace with a comma, colon, parenthetical, or new sentence. The `&mdash;`" +
    "\nentity is not an exception. Legitimate non-prose em-dashes (code, the \"—\"" +
    "\nsentinel, table cells) are already allowed.",
  );
  process.exit(1);
}

console.log(`em-dash check passed (${files.length} files under ${TARGETS.join(", ")}, prose clean)`);
