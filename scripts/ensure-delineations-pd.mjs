/**
 * Ensure the delineation packages are built before web dev/build: the pd
 * `/pd` subpath and the corpus batch subpaths (`caelus-corpus/natal`, ...)
 * resolve to dist via package exports.
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;

const targets = [
  ["caelus-delineations-pd", "packages/caelus-delineations-pd/dist/src/pd.js"],
  ["caelus-corpus", "packages/caelus-corpus/dist/src/natal.js"],
];

for (const [pkg, marker] of targets) {
  if (existsSync(ROOT + marker)) continue;
  console.log(`ensure-delineations-pd: building ${pkg}…`);
  execFileSync("npm", ["run", "build", "-w", pkg], {
    cwd: ROOT,
    stdio: "inherit",
  });
}
