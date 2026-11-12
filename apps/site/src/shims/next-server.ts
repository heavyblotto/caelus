/**
 * Stand-in for `next/server`, so the site can run the apps/web route handlers
 * as they are. Only the surface those handlers use is provided.
 */
export class NextResponse extends Response {
  static json(data: unknown, init?: ResponseInit): Response {
    return Response.json(data, init);
  }
}

/** The part of NextRequest the handlers read. */
export type NextRequest = { nextUrl: URL; url: string; headers: Headers };

export function toNextRequest(request: Request): NextRequest {
  return { nextUrl: new URL(request.url), url: request.url, headers: request.headers };
}
