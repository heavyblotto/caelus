/**
 * Ensure caelus-corpus is built before web dev/build (subpath exports
 * resolve to dist/src/*.js via package exports).
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const ENTRY = ROOT + "packages/caelus-corpus/dist/src/natal.js";

if (existsSync(ENTRY)) process.exit(0);

console.log("ensure-corpus: building caelus-corpus…");
execFileSync("npm", ["run", "build", "-w", "caelus-corpus"], {
  cwd: ROOT,
  stdio: "inherit",
});
