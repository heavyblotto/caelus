/** Server-side replacement for apps/web/app/instruments/first-visibility/FirstVisibilityIsland (see plugins/web-bridge.mjs). */
import FirstVisibilityIsland from "@web/app/instruments/first-visibility/FirstVisibilityIsland";
import { nested } from "../nested";

export default nested("FirstVisibility", FirstVisibilityIsland);
