/** Server-side replacement for apps/web/app/instruments/uncertain-time/ChartStabilityIsland (see plugins/web-bridge.mjs). */
import ChartStabilityIsland from "@web/app/instruments/uncertain-time/ChartStabilityIsland";
import { nested } from "../nested";

export default nested("ChartStability", ChartStabilityIsland);
