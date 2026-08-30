/**
 * Ensure caelus-widgets is built before web dev/build (subpath exports
 * resolve to dist/src/*.js via package exports).
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const ENTRY = ROOT + "packages/widgets/dist/src/house-comparator-widget.js";

if (existsSync(ENTRY)) process.exit(0);

console.log("ensure-widgets: building caelus-widgets…");
execFileSync("npm", ["run", "build", "-w", "caelus-widgets"], {
  cwd: ROOT,
  stdio: "inherit",
});
