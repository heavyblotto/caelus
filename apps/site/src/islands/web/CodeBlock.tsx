/** Server-side replacement for apps/web/components/CodeBlock (see plugins/web-bridge.mjs). */
import CodeBlock from "@web/components/CodeBlock";
import { nested } from "../nested";

export default nested("CodeBlock", CodeBlock);
