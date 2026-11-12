/**
 * Build-time filesystem locations. npm runs the build with apps/site as the
 * working directory (apps/web makes the same assumption about itself), so the
 * sibling app and the repo root are found from there.
 * Node only: never import this from code that reaches the Worker or a browser.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const SITE_ROOT = process.cwd();
export const WEB_ROOT = resolve(SITE_ROOT, "..", "web");
export const REPO_ROOT = resolve(SITE_ROOT, "..", "..");

if (!existsSync(resolve(SITE_ROOT, "astro.config.mjs")) || !existsSync(resolve(WEB_ROOT, "app"))) {
  throw new Error(
    `The site must be built from apps/site (npm run build -w site); the working directory is ${SITE_ROOT}.`,
  );
}
