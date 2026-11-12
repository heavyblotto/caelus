/** Server-side replacement for apps/web/components/Cta (see plugins/web-bridge.mjs). */
import Cta from "@web/components/Cta";
import { nested } from "../nested";

export default nested("Cta", Cta);
