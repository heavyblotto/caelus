/**
 * Stand-in for `next/dynamic` covering the one mode apps/web uses:
 * `dynamic(() => import(...), { ssr: false, loading })`.
 *
 * The server render and the hydration pass both emit `loading()`; the real
 * component is fetched after mount and replaces it. Once a chunk has loaded,
 * later client-only mounts render it immediately.
 */
import { useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";

type Loaded<P> = { default: ComponentType<P> } | ComponentType<P>;
type Options = { ssr?: boolean; loading?: () => ReactNode };

const subscribeNever = () => () => {};

export default function dynamic<P extends object>(loader: () => Promise<Loaded<P>>, options: Options = {}) {
  let Resolved: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;

  const load = () =>
    (pending ??= loader().then((mod) => {
      Resolved = typeof mod === "function" ? mod : (mod as { default: ComponentType<P> }).default;
    }));

  function Dynamic(props: P) {
    // False on the server and while hydrating, true for every later render.
    const onClient = useSyncExternalStore(subscribeNever, () => true, () => false);
    const [, rerender] = useState(0);

    useEffect(() => {
      if (Resolved) return;
      let live = true;
      void load().then(() => {
        if (live) rerender((n) => n + 1);
      });
      return () => {
        live = false;
      };
    }, []);

    if (onClient && Resolved) return <Resolved {...props} />;
    return options.loading ? <>{options.loading()}</> : null;
  }
  return Dynamic;
}
