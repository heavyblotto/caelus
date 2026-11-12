/**
 * /opengraph-image: the social card, rendered once at build time from
 * apps/web/app/opengraph-image.tsx (see src/shims/next-og.ts). The URL has no
 * extension, so astro.config.mjs adds a Content-Type rule for it.
 */
import type { APIRoute } from "astro";
import OpengraphImage from "@web/app/opengraph-image";

export const GET: APIRoute = async () => {
  const image = OpengraphImage();
  return new Response(await image.arrayBuffer(), { headers: { "Content-Type": "image/png" } });
};
