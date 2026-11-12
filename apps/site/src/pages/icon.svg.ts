/** /icon.svg: the site icon, read from apps/web/app/icon.svg. */
import type { APIRoute } from "astro";
import icon from "@web/app/icon.svg?raw";

export const GET: APIRoute = () => new Response(icon, { headers: { "Content-Type": "image/svg+xml" } });
