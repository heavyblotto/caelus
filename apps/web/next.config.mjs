import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["caelus", "caelus-wheel", "caelus-mcp"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Let CI/preflight build into a separate dir (NEXT_DIST_DIR=.next-ci) so a
  // `next build` never clobbers the `.next` a running `next dev` depends on.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `/about` is a common guessed URL; send it to the project's build story
  // rather than a 404. Temporary (307) so a dedicated page can claim it later.
  async redirects() {
    return [{ source: "/about", destination: "/how-it-was-built", permanent: false }];
  },
};

export default withMDX(nextConfig);
