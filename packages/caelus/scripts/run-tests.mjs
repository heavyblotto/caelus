#!/usr/bin/env node
// Run every compiled test in dist/test/, in name order. `npm test -w caelus`
// used to enumerate three files by hand and silently skipped the rest; this
// runner globs, so a new test file is executed the moment it compiles.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(pkg, "dist", "test");
const tests = readdirSync(dir)
  .filter((f) => f.endsWith(".test.js"))
  .sort();

if (tests.length === 0) {
  console.error("run-tests: no compiled tests in dist/test — run the build first");
  process.exit(1);
}

let failures = 0;
for (const f of tests) {
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: "inherit" });
  if (r.status !== 0) {
    failures++;
    console.error(`FAIL ${f}`);
  }
}
console.log(`run-tests: ${tests.length} suites, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
