/** Server-side replacement for apps/web/components/PlaygroundStickyBar (see plugins/web-bridge.mjs). */
import PlaygroundStickyBar from "@web/components/PlaygroundStickyBar";
import { nested } from "../nested";

export default nested("PlaygroundStickyBar", PlaygroundStickyBar);
