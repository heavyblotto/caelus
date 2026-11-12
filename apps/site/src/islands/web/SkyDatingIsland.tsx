/** Server-side replacement for apps/web/app/instruments/sky-dating/SkyDatingIsland (see plugins/web-bridge.mjs). */
import SkyDatingIsland from "@web/app/instruments/sky-dating/SkyDatingIsland";
import { nested } from "../nested";

export default nested("SkyDating", SkyDatingIsland);
