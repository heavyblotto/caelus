/**
 * Nested islands.
 *
 * Astro hydrates a component only where an .astro template places it. The
 * pages in apps/web are whole React trees, and their interactive pieces (the
 * install button, code-block copy, the playground) sit deep inside
 * server-rendered components, out of a template's reach.
 *
 * `nested(name, Component)` returns a wrapper that renders the component
 * inside a marker element carrying its name and JSON props. In a static render
 * that marker is all that reaches the browser; src/islands/client.ts finds it
 * and hydrates the real component in place from the registry. Inside a tree
 * that React is already hydrating, the wrapper is just a pass-through element.
 *
 * Props must be JSON-serialisable (no children, no callbacks), the same rule
 * Next applies at a server-to-client boundary.
 */
import type { ComponentType } from "react";

export function nested<P extends object>(name: string, Component: ComponentType<P>) {
  function NestedIsland(props: P) {
    return (
      <div data-island={name} data-props={JSON.stringify(props)} style={{ display: "contents" }}>
        <Component {...props} />
      </div>
    );
  }
  NestedIsland.displayName = `Island(${name})`;
  return NestedIsland;
}
