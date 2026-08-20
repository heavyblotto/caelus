/**
 * Parser tests: one case per atom-id format `interpretationContext` emits
 * and per cell-id format the corpus grid enumerates, plus unknown-format
 * behavior and graph resolution of every id the parsers return here.
 * Plain node, no test framework; run as `node dist/test/parse.test.js`.
 */
import { parseAtomId, parseCellId, conceptById } from "../src/index.js";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) { console.error(`  FAIL: ${msg}`); failures++; }
}

const resolvable = new Set<string>();
function eq(got: string[], want: string[], msg: string): void {
  check(JSON.stringify(got) === JSON.stringify(want), `${msg}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
  for (const id of want) resolvable.add(id);
}

console.log("atom ids");
eq(parseAtomId("placement:mars"), ["body:mars"], "placement");
eq(parseAtomId("aspect:mars~saturn:square"), ["body:mars", "body:saturn", "aspect:square"], "aspect");
eq(parseAtomId("angle:asc"), [], "angle (chart point, no concept)");
eq(parseAtomId("angleContact:venus:mc"), ["body:venus"], "angleContact");
eq(parseAtomId("degree:sun:aries:15"), ["body:sun", "sign:aries"], "degree");
eq(parseAtomId("degree:asc:leo:3"), ["sign:leo"], "degree (chart point)");
eq(parseAtomId("degree:sun:aries:x"), [], "degree: non-numeric ordinal");
eq(parseAtomId("oob:moon"), ["body:moon"], "oob");
eq(parseAtomId("star:sun:Regulus"), ["body:sun", "star:regulus"], "star");
eq(parseAtomId("lot:fortune"), ["lot:fortune"], "lot");
eq(parseAtomId("term:venus:jupiter"), ["body:venus", "body:jupiter", "dignity:term"], "term");
eq(parseAtomId("face:mars:sun"), ["body:mars", "body:sun", "dignity:face"], "face");
eq(parseAtomId("triplicity:saturn"), ["body:saturn", "dignity:triplicity"], "triplicity");
eq(parseAtomId("almuten:moon:venus"), ["body:moon", "body:venus"], "almuten");
eq(
  parseAtomId("transit:saturn~natal_sun:square"),
  ["chart-type:transit", "body:saturn", "body:sun", "aspect:square"], "transit",
);
eq(parseAtomId("transitHouse:jupiter:7"), ["chart-type:transit", "body:jupiter", "house:7"], "transitHouse");
eq(parseAtomId("station:mercury:retrograde"), ["body:mercury"], "station");
eq(parseAtomId("return:saturn:2"), ["chart-type:return", "body:saturn"], "return");
eq(parseAtomId("lunation:full"), ["body:moon"], "lunation");
eq(parseAtomId("lunation:new:eclipse:solar"), ["body:moon"], "lunation with eclipse");
eq(parseAtomId("solarPhase:venus:cazimi"), ["body:venus", "body:sun"], "solarPhase");
eq(
  parseAtomId("synastry:mars~b_venus:trine"),
  ["chart-type:synastry", "body:mars", "body:venus", "aspect:trine"], "synastry aspect",
);
eq(
  parseAtomId("synastry:overlay:a:mars:house:5"),
  ["chart-type:synastry", "body:mars", "house:5"], "synastry overlay",
);
eq(parseAtomId("composite:moon"), ["chart-type:composite", "body:moon"], "composite placement");
eq(
  parseAtomId("composite:sun~moon:conjunction"),
  ["chart-type:composite", "body:sun", "body:moon", "aspect:conjunction"], "composite aspect",
);
eq(
  parseAtomId("profection:year:aries:mars"),
  ["technique:profection", "sign:aries", "body:mars"], "profection year",
);
eq(
  parseAtomId("profection:month:libra:venus"),
  ["technique:profection", "sign:libra", "body:venus"], "profection month",
);
eq(parseAtomId("zr:l1:cancer:moon"), ["technique:zr", "sign:cancer", "body:moon"], "zr");
eq(parseAtomId("firdaria:major:venus"), ["technique:firdaria", "body:venus"], "firdaria major");
eq(parseAtomId("firdaria:sub:mars"), ["technique:firdaria", "body:mars"], "firdaria sub");
eq(parseAtomId("dasha:maha:rahu"), ["technique:dasha", "body:rahu"], "dasha maha");
eq(parseAtomId("dasha:antar:ketu"), ["technique:dasha", "body:ketu"], "dasha antar");
eq(
  parseAtomId("nakshatra:moon:Purva_Phalguni"),
  ["body:moon", "nakshatra:purva-phalguni"], "nakshatra (underscored name)",
);
eq(parseAtomId("varga:d9:venus:pisces"), ["varga:d9", "body:venus", "sign:pisces"], "varga");
eq(parseAtomId("yoga:Budha-Aditya"), ["yoga:budha-aditya"], "yoga");
eq(parseAtomId("parallel:mars~venus:contraparallel"), ["body:mars", "body:venus"], "parallel");
eq(parseAtomId("reception:sun~moon"), ["body:sun", "body:moon"], "reception");
eq(parseAtomId("dispositor:mercury"), ["body:mercury"], "dispositor");
eq(
  parseAtomId("pattern:t_square:mars-saturn-true_node"),
  ["body:mars", "body:saturn", "body:true_node"], "pattern",
);
eq(parseAtomId("signature:element:fire"), ["element:fire"], "signature element");
eq(parseAtomId("signature:modality:cardinal"), ["modality:cardinal"], "signature modality");
eq(parseAtomId("signature:sign:Leo"), ["sign:leo"], "signature sign");
eq(parseAtomId("signature:ruler:venus"), ["body:venus"], "signature ruler");

console.log("atom ids: unknown formats");
eq(parseAtomId(""), [], "empty");
eq(parseAtomId("placement"), [], "bare prefix");
eq(parseAtomId("nonsense:foo:bar"), [], "unknown prefix");
eq(parseAtomId("aspect:mars~saturn:blend"), [], "unknown aspect name");
eq(parseAtomId("synastry:mars~venus:trine"), [], "synastry without the b_ marker");

console.log("cell ids");
eq(parseCellId("natal:mars:sign:aries"), ["chart-type:natal", "body:mars", "sign:aries"], "planet-in-sign");
eq(parseCellId("natal:mars:house:7"), ["chart-type:natal", "body:mars", "house:7"], "planet-in-house");
eq(
  parseCellId("natal:aspect:sun:square:moon"),
  ["chart-type:natal", "body:sun", "aspect:square", "body:moon"], "natal aspect",
);
eq(parseCellId("natal:asc:sign:leo"), ["chart-type:natal", "sign:leo"], "rising sign");
eq(parseCellId("natal:mc:sign:aries"), ["chart-type:natal", "sign:aries"], "mc sign");
eq(parseCellId("natal:venus:on:mc"), ["chart-type:natal", "body:venus"], "angle conjunction");
eq(
  parseCellId("natal:mars:dignity:domicile"),
  ["chart-type:natal", "body:mars", "dignity:domicile"], "dignity",
);
eq(
  parseCellId("natal:mars:dignity:peregrine"),
  ["chart-type:natal", "body:mars"], "peregrine (absence, no DignityType)",
);
eq(parseCellId("natal:pattern:t_square"), ["chart-type:natal"], "pattern");
eq(parseCellId("natal:pattern:yod:apex:mars"), ["chart-type:natal", "body:mars"], "pattern apex");
eq(parseCellId("natal:signature:element:fire"), ["chart-type:natal", "element:fire"], "signature element cell");
eq(parseCellId("natal:signature:sign:aries"), ["chart-type:natal", "sign:aries"], "signature sign cell");
eq(parseCellId("natal:signature:ruler:venus"), ["chart-type:natal", "body:venus"], "signature ruler cell");
eq(parseCellId("natal:moon:oob"), ["chart-type:natal", "body:moon"], "out of bounds");
eq(parseCellId("natal:mercury:retrograde"), ["chart-type:natal", "body:mercury"], "natal retrograde");
eq(parseCellId("transit:saturn:house:7"), ["chart-type:transit", "body:saturn", "house:7"], "transit house");
eq(
  parseCellId("transit:saturn:square:sun"),
  ["chart-type:transit", "body:saturn", "aspect:square", "body:sun"], "transit aspect",
);
eq(parseCellId("transit:mercury:station:retrograde"), ["chart-type:transit", "body:mercury"], "station cell");
eq(parseCellId("timelord:profection:year:house:7"), ["technique:profection", "house:7"], "profection year house");
eq(parseCellId("timelord:profection:year:lord:mars"), ["technique:profection", "body:mars"], "profection year lord");
eq(parseCellId("timelord:profection:month:house:3"), ["technique:profection", "house:3"], "profection month house");
eq(parseCellId("timelord:zr:l1:cancer"), ["technique:zr", "sign:cancer"], "zr chapter");
eq(parseCellId("timelord:firdaria:major:venus"), ["technique:firdaria", "body:venus"], "firdaria major cell");
eq(
  parseCellId("timelord:firdaria:sub:venus:mars"),
  ["technique:firdaria", "body:venus", "body:mars"], "firdaria sub cell",
);
eq(parseCellId("timelord:dasha:maha:ketu"), ["technique:dasha", "body:ketu"], "dasha maha cell");
eq(
  parseCellId("timelord:dasha:antar:rahu:saturn"),
  ["technique:dasha", "body:rahu", "body:saturn"], "dasha antar cell",
);
eq(parseCellId("sky:lunation:new:house:4"), ["body:moon", "house:4"], "lunation house");
eq(parseCellId("sky:eclipse:house:10"), ["body:moon", "house:10"], "eclipse house");
eq(parseCellId("sky:lunation:on-natal"), ["body:moon"], "lunation on natal");
eq(parseCellId("sky:eclipse:on-natal"), ["body:moon"], "eclipse on natal");
eq(parseCellId("return:sun"), ["chart-type:return", "body:sun"], "return");
eq(parseCellId("return:saturn:2"), ["chart-type:return", "body:saturn"], "numbered return");
eq(parseCellId("condition:venus:cazimi"), ["body:venus", "body:sun"], "solar condition");
eq(
  parseCellId("synastry:mars:trine:venus"),
  ["chart-type:synastry", "body:mars", "aspect:trine", "body:venus"], "synastry aspect cell",
);
eq(
  parseCellId("synastry:overlay:mars:house:5"),
  ["chart-type:synastry", "body:mars", "house:5"], "synastry overlay cell",
);
eq(
  parseCellId("composite:aspect:sun:square:moon"),
  ["chart-type:composite", "body:sun", "aspect:square", "body:moon"], "composite aspect cell",
);
eq(
  parseCellId("composite:venus:sign:libra"),
  ["chart-type:composite", "body:venus", "sign:libra"], "composite placement cell",
);
eq(
  parseCellId("composite:venus:house:7"),
  ["chart-type:composite", "body:venus", "house:7"], "composite house cell",
);

console.log("cell ids: unknown formats");
eq(parseCellId(""), [], "empty");
eq(parseCellId("horary:mars:sign:aries"), [], "unknown namespace");
eq(parseCellId("natal:mars:flavor:spicy"), [], "unknown natal shape");

console.log("graph resolution of parsed ids");
for (const id of resolvable) {
  check(conceptById(id) !== undefined, `${id}: parsed id resolves to a node`);
}

if (failures > 0) {
  console.error(`\n${failures} failures`);
  process.exit(1);
}
console.log("\ncaelus-kb parser tests passed");
