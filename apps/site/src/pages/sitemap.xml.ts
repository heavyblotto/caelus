/**
 * /sitemap.xml, matching apps/web/app/sitemap.ts: the same routes, priorities,
 * and change frequencies, with each page's lastmod taken from the last git
 * commit that touched its source in apps/web.
 *
 * Cloudflare's build image clones shallowly by default; without full history a
 * file untouched in the fetched commits falls back to the build date.
 */
import type { APIRoute } from "astro";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "@web/lib/site";
import { listApiDocs } from "../lib/api-docs";
import { WEB_ROOT } from "../lib/paths";

/**
 * The hand-kept route list lives in apps/web/app/sitemap.ts. It is read from
 * that file's source so a guide added there appears in both sitemaps; the
 * module itself cannot be imported, because it resolves paths and runs git
 * from an apps/web working directory. At cutover the list moves here.
 */
function webRoutes(): string[] {
  const source = readFileSync(join(WEB_ROOT, "app", "sitemap.ts"), "utf8");
  const block = source.match(/const routes = \[([\s\S]*?)\.\.\.listApiDocs/);
  const routes = block ? [...block[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]) : [];
  if (routes.length < 10 || routes[0] !== "") {
    throw new Error("Could not read the route list from apps/web/app/sitemap.ts");
  }
  return routes;
}

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: WEB_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** Map a route to the apps/web source file whose history drives its freshness. */
function sourceFor(route: string): string {
  if (route === "") return "app/page.tsx";
  if (route === "/changelog") return join("..", "..", "CHANGELOG.md");
  const base = join("app", route.slice(1));
  for (const ext of ["page.mdx", "page.tsx"]) {
    if (existsSync(join(WEB_ROOT, base, ext))) return join(base, ext);
  }
  return join(base, "page.tsx");
}

export const GET: APIRoute = () => {
  const buildDate = new Date();
  if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
    console.warn("[sitemap] shallow git clone: lastmod falls back to the build date for older files.");
  }
  const gitDate = (relPath: string): Date => {
    const out = git(["log", "-1", "--format=%cI", "--", relPath]);
    return out ? new Date(out) : buildDate;
  };

  const entries = [
    ...webRoutes().map((path) => ({ path, lastModified: gitDate(sourceFor(path)) })),
    // The API pages are generated at build time and never committed, so their
    // date is the build date (as it is on the Next deployment).
    ...listApiDocs().map((slug) => ({ path: `/docs/api/${slug}`, lastModified: buildDate })),
  ];

  const urls = entries
    .map(({ path, lastModified }) =>
      [
        "<url>",
        `<loc>${SITE.url}${path}</loc>`,
        `<lastmod>${lastModified.toISOString()}</lastmod>`,
        `<changefreq>${path.startsWith("/docs/api") ? "monthly" : "weekly"}</changefreq>`,
        `<priority>${path === "" ? 1 : path.startsWith("/docs") ? 0.7 : 0.6}</priority>`,
        "</url>",
      ].join("\n"),
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml" } },
  );
};
