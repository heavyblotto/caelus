import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import { satteri } from "@astrojs/markdown-satteri";
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import webBridge from "./plugins/web-bridge.mjs";

const SITE_ROOT = fileURLToPath(new URL("./", import.meta.url));
const WEB_ROOT = fileURLToPath(new URL("../web/", import.meta.url));
const shim = (name) => fileURLToPath(new URL(`./src/shims/${name}`, import.meta.url));

/**
 * The Open Graph image keeps its Next URL, /opengraph-image, which has no file
 * extension, so Cloudflare cannot infer a content type for it. Declare one.
 */
function staticHeaders() {
  return {
    name: "caelus:static-headers",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        await appendFile(
          new URL("./_headers", dir),
          "\n/opengraph-image\n  Content-Type: image/png\n  Cache-Control: public, max-age=86400\n",
        );
      },
    },
  };
}

export default defineConfig({
  site: "https://www.ephemengine.com",
  // Every page is prerendered. Only the two API endpoints opt out
  // (`export const prerender = false`) and run in the Worker.
  output: "static",
  // Match the Next URLs: /features, never /features/.
  trailingSlash: "never",
  build: { format: "file" },
  // Shared with apps/web until cutover: gazetteer, sky plates, llms.txt, and
  // the generated search-index.json and embed/chart-widget.js.
  publicDir: "../web/public",
  // No sessions, so the adapter provisions no KV namespace.
  session: false,
  // The API endpoints are public and CORS-open, as on the Next deployment.
  security: { checkOrigin: false },
  adapter: cloudflare({
    // Pages read CHANGELOG.md, the TypeDoc markdown, and git history at build
    // time, so they prerender under Node. The Worker itself runs in workerd.
    prerenderEnvironment: "node",
    // No image optimisation is used; do not provision an Images binding.
    imageService: "passthrough",
  }),
  // The guides render as they do under @next/mdx: GitHub-flavoured Markdown,
  // heading ids, no syntax highlighter on fenced blocks (CodeBlock does its
  // own), and straight quotes left as typed.
  markdown: {
    syntaxHighlight: false,
    processor: satteri({ features: { smartPunctuation: false } }),
  },
  integrations: [react(), mdx(), staticHeaders()],
  redirects: {
    "/about": { status: 307, destination: "/how-it-was-built" },
    "/favicon.ico": { status: 307, destination: "/icon.svg" },
  },
  vite: {
    plugins: [
      webBridge({
        webRoot: WEB_ROOT,
        siteRoot: SITE_ROOT,
        redirects: {
          // Client components reached from server-rendered trees: hydrated
          // through the nested-island registry (src/islands).
          "components/Cta.tsx": "src/islands/web/Cta.tsx",
          "components/CodeBlock.tsx": "src/islands/web/CodeBlock.tsx",
          "components/PlaygroundPanels.tsx": "src/islands/web/PlaygroundPanels.tsx",
          "components/PlaygroundStickyBar.tsx": "src/islands/web/PlaygroundStickyBar.tsx",
          "components/home/HomeLiveIsland.tsx": "src/islands/web/HomeLiveIsland.tsx",
          "app/instruments/sky-dating/SkyDatingIsland.tsx": "src/islands/web/SkyDatingIsland.tsx",
          // Reads apps/web/content/api relative to process.cwd() in apps/web.
          "lib/api-docs.ts": { to: "src/lib/api-docs.ts", always: true },
        },
      }),
    ],
    resolve: {
      alias: [
        { find: /^next\/link$/, replacement: shim("next-link.tsx") },
        { find: /^next\/navigation$/, replacement: shim("next-navigation.tsx") },
        { find: /^next\/dynamic$/, replacement: shim("next-dynamic.tsx") },
        { find: /^next\/server$/, replacement: shim("next-server.ts") },
        { find: /^next\/og$/, replacement: shim("next-og.ts") },
        // The Worker must not load the Node entry of caelus-mcp (node:fs,
        // node:module); the core entry registers the same tools with no
        // node:* imports.
        { find: /^caelus-mcp$/, replacement: "caelus-mcp/core" },
        { find: /^@web\//, replacement: WEB_ROOT },
      ],
    },
    server: { fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] } },
    // The playground's corpus and data-pack chunks are megabytes by nature and
    // already load on demand; the default 500 kB warning is noise here. The
    // limit that matters is Cloudflare's 25 MiB per static asset.
    build: { chunkSizeWarningLimit: 4000 },
  },
});
