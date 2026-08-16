#!/usr/bin/env node
/**
 * Unit-test lane for apps/web library code (the app has no tsc build of its
 * own; Next compiles TS in-process). Finds *.test.ts files under
 * apps/web/lib, transpiles each with esbuild (workspace packages left
 * external so the
 * built dist under node_modules is used), and runs them under node. A test
 * file fails by exiting non-zero, same convention as the package suites.
 */
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const libDir = join(root, "apps", "web", "lib");
const outDir = join(root, "apps", "web", ".test-dist");

function findTests(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...findTests(p));
    else if (/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const tests = findTests(libDir);
if (tests.length === 0) {
  console.log("test-web-libs: no test files under apps/web/lib");
  process.exit(0);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: tests,
  outdir: outDir,
  outbase: libDir,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  sourcemap: "inline",
  outExtension: { ".js": ".mjs" },
});

let failures = 0;
for (const t of tests) {
  const rel = relative(libDir, t).replace(/\.tsx?$/, ".mjs");
  const compiled = join(outDir, rel);
  console.log(`\n== ${relative(root, t)}`);
  const r = spawnSync(process.execPath, [compiled], { stdio: "inherit" });
  if (r.status !== 0) failures++;
}

rmSync(outDir, { recursive: true, force: true });
if (failures) {
  console.error(`\ntest-web-libs: ${failures} test file(s) failed`);
  process.exit(1);
}
console.log(`\ntest-web-libs: ${tests.length} test file(s) passed`);
