/**
 * Browser entry for nested islands: hydrates each `[data-island]` marker with
 * its component when the marker scrolls near the viewport. Loaded once from
 * the base layout.
 */
import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { registry } from "./registry";

function hydrate(marker: HTMLElement) {
  const name = marker.dataset.island ?? "";
  const load = registry[name];
  if (!load) {
    console.warn(`[islands] no component registered for "${name}"`);
    return;
  }
  void load().then((Component) => {
    let props: Record<string, unknown> = {};
    try {
      props = JSON.parse(marker.dataset.props ?? "{}");
    } catch {
      /* malformed props: hydrate with defaults */
    }
    hydrateRoot(marker, createElement(Component, props));
  });
}

function scan() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const marker = entry.target.closest<HTMLElement>("[data-island]");
        if (marker) hydrate(marker);
      }
    },
    { rootMargin: "300px" },
  );

  for (const marker of document.querySelectorAll<HTMLElement>("[data-island]")) {
    // A marker inside another island belongs to that island's React tree.
    if (marker.parentElement?.closest("[data-island], astro-island")) continue;
    // The marker is `display: contents` and has no box of its own, so watch
    // its first rendered child. An empty marker hydrates straight away.
    const box = marker.firstElementChild;
    if (box) observer.observe(box);
    else hydrate(marker);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
else scan();
