/**
 * Stand-in for `next/og`, used only while prerendering /opengraph-image under
 * Node at build time. `@vercel/og` is the library Next bundles as `next/og`;
 * it is pinned to the release Next 15 ships (0.7.2) so the card renders with
 * the same default face (Noto Sans) and comes out unchanged. It is a
 * build-time image renderer and has no tie to Vercel hosting.
 */
export { ImageResponse } from "@vercel/og";
