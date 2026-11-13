/**
 * MDX plugins for runnable docs examples: the same transform for both builds.
 *
 * A fenced block flagged `run` is replaced, at compile time, by the element
 * `<CodeBlock run lang="typescript" code="…" />`. CodeBlock is already in both
 * builds' MDX component maps, so neither needs a new component wired in.
 *
 *   ```ts run
 *   solarEclipses(engine, julianDay(2024, 1, 1), julianDay(2027, 1, 1));
 *   ```
 *
 * Next compiles MDX with unified, so apps/web/next.config.mjs uses
 * `remarkRunnable`. Astro compiles it with Sätteri, so apps/site's config
 * uses `satteriRunnable`. Both call `toCodeBlock`, and both fail the build if
 * a runnable block imports a module the in-page runner does not provide.
 */
import { disallowedImports, parseRunMeta, RUNNABLE_MODULES } from "./runnable-core.mjs";

/**
 * The replacement for a runnable `code` node, or null to leave the node alone.
 * @param {{ lang?: string | null, meta?: string | null, value: string }} node
 */
function toCodeBlock(node) {
  const run = parseRunMeta(node.lang, node.meta);
  if (!run) return null;

  const bad = disallowedImports(node.value);
  if (bad.length) {
    throw new Error(
      `A code block is marked \`run\` but imports "${bad[0]}". Runnable examples execute in the ` +
        `reader's browser and can import only ${RUNNABLE_MODULES.join(" and ")}. Remove the flag, ` +
        `or rewrite the example for the embedded tier.`,
    );
  }

  const attribute = (name, value) => ({ type: "mdxJsxAttribute", name, value });
  return {
    type: "mdxJsxFlowElement",
    name: "CodeBlock",
    attributes: [
      attribute("run", null),
      attribute("lang", "typescript"),
      attribute("code", node.value),
      ...(run.label ? [attribute("label", run.label)] : []),
    ],
    children: [],
  };
}

/** unified (remark) plugin, for @next/mdx. */
export function remarkRunnable() {
  const walk = (parent) => {
    if (!Array.isArray(parent.children)) return;
    parent.children.forEach((child, i) => {
      if (child.type === "code") {
        const replacement = toCodeBlock(child);
        if (replacement) parent.children[i] = replacement;
      } else {
        walk(child);
      }
    });
  };
  return (tree) => walk(tree);
}

/** Sätteri mdast plugin, for Astro's MDX integration. */
export const satteriRunnable = {
  name: "caelus-runnable-examples",
  code(node, ctx) {
    const replacement = toCodeBlock(node);
    if (replacement) ctx.replaceNode(node, replacement);
  },
};
