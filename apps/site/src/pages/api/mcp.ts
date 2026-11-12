/**
 * /api/mcp, served by the Worker: the hosted MCP endpoint (Streamable HTTP,
 * stateless, JSON responses). Runs the apps/web route handlers as they are.
 * Their `import("caelus-mcp")` resolves to the node-free `caelus-mcp/core`
 * entry here (see the alias in astro.config.mjs), so the Worker needs no
 * Node compatibility flag.
 */
import type { APIRoute } from "astro";
import { DELETE as mcpDelete, GET as describe, OPTIONS as preflight, POST as mcpPost } from "@web/app/api/mcp/route";

export const prerender = false;

export const GET: APIRoute = () => describe();
export const OPTIONS: APIRoute = () => preflight();
export const POST: APIRoute = ({ request }) => mcpPost(request);
export const DELETE: APIRoute = ({ request }) => mcpDelete(request);

/** Any other method: 405, as the Next route answered. */
export const ALL: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: "GET, POST, DELETE, OPTIONS" } });
