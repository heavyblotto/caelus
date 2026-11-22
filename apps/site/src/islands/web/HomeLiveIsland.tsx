/**
 * Server-side replacement for apps/web/components/home/HomeLiveIsland (see
 * plugins/web-bridge.mjs). The Next page passes the server's New York time as
 * `civil`; the static build drops it and lets the island read the clock in the
 * browser, so no build-time timestamp is baked into the page.
 */
import type { HomeLiveProps } from "@web/components/home/HomeLive";
import HomeLiveClient from "../HomeLiveClient";
import { nested } from "../nested";

const Island = nested("HomeLive", HomeLiveClient);

export default function HomeLiveIsland(props: { civil?: unknown; variant?: HomeLiveProps["variant"] }) {
  return <Island variant={props.variant} />;
}
