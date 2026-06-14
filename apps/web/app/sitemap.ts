import type { MetadataRoute } from "next";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "../lib/site";
import { listApiDocs } from "../lib/api-docs";

// Next runs the build from apps/web, so source paths are resolved from here.
const ROOT = process.cwd();
const BUILD_DATE = new Date();

/** Last git commit date for a source file, or the build date if unavailable. */
function gitDate(relPath: string): Date {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", relPath],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out ? new Date(out) : BUILD_DATE;
  } catch {
    return BUILD_DATE;
  }
}

/** Map a route to the source file whose history drives its freshness. */
function sourceFor(route: string): string {
  if (route === "") return "app/page.tsx";
  if (route === "/changelog") return join("..", "..", "CHANGELOG.md");
  if (route.startsWith("/docs/api/")) {
    return join("content", "api", `${route.slice("/docs/api/".length)}.md`);
  }
  const base = join("app", route.slice(1));
  for (const ext of ["page.mdx", "page.tsx"]) {
    const candidate = join(base, ext);
    if (existsSync(join(ROOT, candidate))) return candidate;
  }
  return join(base, "page.tsx");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/playground",
    "/features",
    "/validation",
    "/provenance",
    "/methods",
    "/how-it-was-built",
    "/notes",
    "/changelog",
    "/docs",
    "/docs/quickstart",
    "/docs/charts",
    "/docs/architecture",
    "/docs/houses-and-zodiacs",
    "/docs/derived",
    "/docs/data-tiers",
    "/docs/recipes",
    "/docs/electional",
    "/docs/visualizations",
    "/docs/mcp",
    "/docs/edge-cases",
    "/docs/api",
    ...listApiDocs().map((s) => `/docs/api/${s}`),
  ];
  return routes.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: gitDate(sourceFor(path)),
    changeFrequency: path.startsWith("/docs/api") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path.startsWith("/docs") ? 0.7 : 0.6,
  }));
}
