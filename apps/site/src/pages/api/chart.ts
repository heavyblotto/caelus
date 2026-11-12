/**
 * GET /api/chart, served by the Worker. Runs the apps/web route handler as it
 * is (embedded data tier, no filesystem), so the JSON is the same bytes the
 * Next deployment returns for the same query.
 */
import type { APIRoute } from "astro";
import { GET as chart } from "@web/app/api/chart/route";
import { toNextRequest } from "../../shims/next-server";

export const prerender = false;

export const GET: APIRoute = ({ request }) => chart(toNextRequest(request) as never);

/** Any other method: 405, as the Next route answered. */
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: "GET" } });
