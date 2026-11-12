/** /robots.txt, matching apps/web/app/robots.ts. */
import type { APIRoute } from "astro";
import { SITE } from "@web/lib/site";

export const GET: APIRoute = () =>
  new Response(
    ["User-Agent: *", "Allow: /", "Disallow: /api/", "Disallow: /embed/", "", `Sitemap: ${SITE.url}/sitemap.xml`, ""].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
