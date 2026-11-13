/** Server-side replacement for apps/web/app/instruments/eclipses/EclipsesIsland (see plugins/web-bridge.mjs). */
import EclipsesIsland from "@web/app/instruments/eclipses/EclipsesIsland";
import { nested } from "../nested";

export default nested("Eclipses", EclipsesIsland);
