/**
 * Drift test: re-derives the KB from the installed `caelus` engine and the
 * curated data, and asserts the committed data/kb.json matches. If the
 * engine's tables change, `npm run generate` and commit; if this fails
 * without an engine change, the generator regressed. Plain node, no test
 * framework; run as `node dist/test/drift.test.js`.
 */
import { buildKb } from "../src/generate.js";
import { nodes, edges, conceptById, edgesFrom, edgesTo, related, KB_VERSION } from "../src/index.js";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) { console.error(`  FAIL: ${msg}`); failures++; }
}

console.log("drift against the engine");
const fresh = buildKb();
check(
  JSON.stringify(fresh.nodes) === JSON.stringify(nodes),
  `nodes match the committed kb.json (derived ${fresh.nodes.length}, committed ${nodes.length})`,
);
check(
  JSON.stringify(fresh.edges) === JSON.stringify(edges),
  `edges match the committed kb.json (derived ${fresh.edges.length}, committed ${edges.length})`,
);
check(KB_VERSION === "0.1.0", "kb.json carries the expected version");

console.log("graph shape");
const ids = new Set(nodes.map((n) => n.id));
check(ids.size === nodes.length, "node ids unique");
const external = new Set(["computedBy", "sameAs"]);
for (const e of edges) {
  check(ids.has(e.from), `${e.type} from ${e.from}: node exists`);
  if (!external.has(e.type)) check(ids.has(e.to), `${e.type} to ${e.to}: node exists`);
}
for (const e of edges) {
  if (e.type === "sameAs") check(/^wikidata:Q\d+$/.test(e.to), `sameAs target well-formed (${e.to})`);
}

console.log("spot checks");
check(conceptById("body:mars")?.type === "Body", "body:mars is a Body");
check(
  edgesFrom("body:mars").some((e) => e.type === "rules" && e.to === "sign:aries"),
  "Mars rules Aries",
);
check(
  edgesTo("sign:libra").some((e) => e.type === "fallIn" && e.from === "body:sun"),
  "the Sun falls in Libra",
);
check(
  (conceptById("aspect:square")?.data as { angle: number }).angle === 90,
  "square carries its angle",
);
check(
  edgesFrom("nakshatra:rohini").some((e) => e.type === "nakshatraLord" && e.to === "body:moon"),
  "Rohini's lord is the Moon",
);
check(
  edgesFrom("star:regulus").some((e) => e.type === "inConstellation" && e.to === "constellation:leo"),
  "Regulus sits in Leo",
);
check(related("sign:aries").some((n) => n.id === "element:fire"), "related() reaches Aries -> fire");
check(
  edgesFrom("technique:profection").some((e) => e.type === "computedBy" && e.to === "profections"),
  "profections maps to its MCP tool",
);
check(
  edgesFrom("house:7").some((e) => e.type === "attestedIn" && e.to === "source:lilly-christian-astrology"),
  "house 7 topics are attested in Lilly",
);
check(
  edgesFrom("body:mercury").some((e) => e.type === "correspondsTo" && e.to === "source:liber-777"),
  "Mercury carries a Liber 777 correspondence",
);

if (failures > 0) {
  console.error(`\n${failures} failures`);
  process.exit(1);
}
console.log(`\ncaelus-kb drift test passed (${nodes.length} nodes, ${edges.length} edges)`);
