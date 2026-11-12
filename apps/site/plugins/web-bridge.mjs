/**
 * Vite plugin that lets the Astro site render the existing apps/web React
 * sources unchanged.
 *
 * apps/web is written for the Next.js App Router, where a server component can
 * import a "use client" component and Next hydrates it. Astro renders a React
 * tree to static HTML, so a client component nested inside a server-rendered
 * tree would ship as dead markup. This plugin closes that gap at the import
 * edge, with no edits to apps/web:
 *
 *  - `redirects` maps an apps/web module to a site-local replacement. By
 *    default the redirect applies only when the importer is a server module
 *    (no "use client" directive), which is exactly the server-to-client
 *    boundary. Client-to-client imports keep resolving to the real module.
 *    `always: true` redirects every importer (used for modules whose Node
 *    file paths assume the apps/web working directory).
 *  - Any server module in apps/web that imports a "use client" module with no
 *    redirect registered fails the build, so an interactive component can
 *    never silently ship without hydration.
 */
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

const SOURCE_RE = /\.(tsx?|jsx?|mdx)$/;

/**
 * @param {{
 *   webRoot: string,
 *   siteRoot: string,
 *   redirects: Record<string, string | { to: string, always?: boolean }>,
 * }} options  `redirects` keys are paths relative to webRoot, values relative to siteRoot.
 */
export default function webBridge({ webRoot, siteRoot, redirects }) {
  const web = webRoot.endsWith("/") ? webRoot : webRoot + "/";
  const table = new Map(
    Object.entries(redirects).map(([from, value]) => {
      const entry = typeof value === "string" ? { to: value } : value;
      return [resolvePath(web, from), { to: resolvePath(siteRoot, entry.to), always: !!entry.always }];
    }),
  );

  const clientCache = new Map();
  /** True when the file's first statement is the "use client" directive. */
  function isClientModule(file) {
    if (!SOURCE_RE.test(file)) return false;
    let known = clientCache.get(file);
    if (known === undefined) {
      try {
        const head = readFileSync(file, "utf8").slice(0, 400);
        known = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(["'])use client\1/.test(head);
      } catch {
        known = false;
      }
      clientCache.set(file, known);
    }
    return known;
  }

  return {
    name: "caelus:web-bridge",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !source.startsWith(".")) return null;
      const from = importer.split("?")[0];
      if (!from.startsWith(web) || !SOURCE_RE.test(from)) return null;

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const target = resolved.id.split("?")[0];

      const redirect = table.get(target);
      if (redirect) {
        if (redirect.always || !isClientModule(from)) return redirect.to;
        return null;
      }

      if (target.startsWith(web) && !isClientModule(from) && isClientModule(target)) {
        this.error(
          `${from.slice(web.length)} is a server module that imports the client component ` +
            `${target.slice(web.length)}, which has no island registered. Add a wrapper under ` +
            `apps/site/src/islands/web and list it in the webBridge redirects in astro.config.mjs.`,
        );
      }
      return null;
    },
  };
}
