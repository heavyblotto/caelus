/**
 * Stand-in for `next/navigation`.
 *
 * `usePathname` reads the path from PathnameContext, which the site's React
 * wrappers (src/react/chrome.tsx) fill from `Astro.url` so the server render
 * and the hydrating island agree. Outside a provider it falls back to the
 * browser location.
 */
import { createContext, useContext } from "react";

export const PathnameContext = createContext<string | null>(null);

export function usePathname(): string {
  const provided = useContext(PathnameContext);
  if (provided !== null) return provided;
  if (typeof window !== "undefined") return window.location.pathname;
  return "/";
}

const router = {
  push(url: string) {
    window.location.assign(url);
  },
  replace(url: string) {
    window.location.replace(url);
  },
  back() {
    window.history.back();
  },
  forward() {
    window.history.forward();
  },
  refresh() {
    window.location.reload();
  },
  prefetch(_url: string) {},
};

/** A stable object, so callbacks that depend on it keep their identity. */
export function useRouter() {
  return router;
}

export function notFound(): never {
  throw new Error("notFound() is not available in the Astro build; resolve the route in getStaticPaths.");
}
