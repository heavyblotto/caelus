import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { remarkRunnable } from "./lib/runnable-mdx.mjs";

const withMDX = createMDX({
  options: {
    // remarkRunnable turns a fence flagged `run` into <CodeBlock run … />, the
    // in-browser runnable example (lib/runnable-core.mjs).
    remarkPlugins: [remarkGfm, remarkRunnable],
    rehypePlugins: [rehypeSlug],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["caelus", "caelus-wheel", "caelus-mcp", "caelus-delineations-pd", "caelus-corpus", "caelus-widgets"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Let CI/preflight build into a separate dir (NEXT_DIST_DIR=.next-ci) so a
  // `next build` never clobbers the `.next` a running `next dev` depends on.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `/about` is a common guessed URL; send it to the project's build story
  // rather than a 404. Temporary (307) so a dedicated page can claim it later.
  async redirects() {
    return [
      { source: "/about", destination: "/how-it-was-built", permanent: false },
      // Legacy/direct /favicon.ico requests 404 otherwise (the icon is the SVG
      // in app/icon.svg, which modern browsers load via the emitted <link>).
      { source: "/favicon.ico", destination: "/icon.svg", permanent: false },
    ];
  },
  // The binary packs a page fetches on demand (scripts/build-pack-manifest.mjs)
  // are published under names that carry their content hash, so a browser may
  // keep one for good. The manifest beside them is revalidated as usual.
  async headers() {
    return [
      {
        source: "/data/packs/cpk/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withMDX(nextConfig);
