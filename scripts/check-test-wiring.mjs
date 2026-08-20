#!/usr/bin/env node
// Every test file in the repo must actually run in CI. Four golden suites
// (patterns, signature, dignity, parans) sat dormant for ~11 releases because
// the CI workflow enumerates test files by hand and nobody added them. This
// gate makes that impossible: a test/*.test.ts(x) file whose compiled name
// never appears in .github/workflows/ci.yml fails the build.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");

const PACKAGES = [
  "packages/caelus",
  "packages/wheel",
  "packages/birth",
  "packages/caelus-delineations-pd",
  "packages/caelus-corpus",
  "packages/kb",
];

const missing = [];
for (const pkg of PACKAGES) {
  let files;
  try {
    files = readdirSync(join(ROOT, pkg, "test"));
  } catch {
    continue;
  }
  for (const f of files) {
    const m = f.match(/^(.+\.test)\.(ts|tsx|mjs|js)$/);
    if (!m) continue;
    const compiled = `${m[1]}.js`;
    // A file counts as wired if CI names it directly, or CI runs the
    // package's `npm run test` and the package test script names it.
    const pkgJson = JSON.parse(
      readFileSync(join(ROOT, pkg, "package.json"), "utf8"),
    );
    const viaScript =
      ci.includes(`npm run test -w ${pkgJson.name}`) &&
      (pkgJson.scripts?.test ?? "").includes(compiled);
    if (!ci.includes(compiled) && !viaScript) missing.push(`${pkg}/test/${f}`);
  }
}

if (missing.length) {
  console.error("test files not wired into .github/workflows/ci.yml:");
  for (const f of missing) console.error(`  ${f}`);
  process.exit(1);
}
console.log("check-test-wiring: every test file runs in CI");
