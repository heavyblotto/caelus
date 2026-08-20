/** Writes data/kb.json from the current engine and curated data.
 *  Run through `npm run generate`; commit the result. */
import { writeFileSync } from "node:fs";
import { buildKb } from "./generate.js";

const KB_VERSION = "0.1.0";

const kb = buildKb();
const out = new URL("../../data/kb.json", import.meta.url);
writeFileSync(out, JSON.stringify({ version: KB_VERSION, ...kb }, null, 2) + "\n");
console.log(`kb.json: ${kb.nodes.length} nodes, ${kb.edges.length} edges`);
