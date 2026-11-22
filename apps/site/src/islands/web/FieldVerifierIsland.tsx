/** Server-side replacement for apps/web/app/instruments/field-verifier/FieldVerifierIsland (see plugins/web-bridge.mjs). */
import FieldVerifierIsland from "@web/app/instruments/field-verifier/FieldVerifierIsland";
import { nested } from "../nested";

export default nested("FieldVerifier", FieldVerifierIsland);
