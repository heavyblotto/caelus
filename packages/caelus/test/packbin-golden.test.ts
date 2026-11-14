/**
 * Binary pack golden: the TS decoder must return exactly the doubles the
 * Python reference decodes from the same .cpk file (compared with ===, since
 * a decoded coefficient is an integer times a power of two in both), the file
 * on disk must be the one the fixture was minted from, and the Node loader
 * must prefer a binary pack over its JSON sibling. Malformed input must be
 * refused, not half-read.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePack, decodePackHeader, isBinaryPack } from "../src/packbin.js";
import { loadNodeData } from "../src/node-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, "../../data");
const G = JSON.parse(readFileSync(join(here, "../../test/packbin-golden.json"), "utf8"));

let checks = 0;
let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
};

const SAMPLES = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const p of G.packs as any[]) {
  const bytes = new Uint8Array(readFileSync(join(DATA, p.file)));
  ok(bytes.length === p.bytes, `${p.file}: ${bytes.length} bytes vs ${p.bytes}`);
  ok(createHash("sha256").update(bytes).digest("hex") === p.sha256, `${p.file}: sha256 matches the fixture`);
  ok(isBinaryPack(bytes), `${p.file}: has the CPK1 magic`);
  const { header } = decodePackHeader(bytes);
  ok(header.nseg === p.nseg && header.nch === p.nch && header.ncoef === p.ncoef
    && header.qexp === p.qexp, `${p.file}: header shape and quantum`);
  const pack = decodePack(bytes);
  ok(pack.jd0 === p.jd0 && pack.seg_days === p.seg_days && pack.scale === p.scale,
    `${p.file}: jd0, seg_days, scale`);
  ok(pack.segments.length === p.nseg && pack.segments[0].length === p.nch
    && pack.segments[0][0].length === p.ncoef, `${p.file}: decoded block shape`);
  const total = p.nseg * p.nch * p.ncoef;
  let same = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const flat = (i * 7919 + 13) % total;
    const s = Math.floor(flat / (p.nch * p.ncoef));
    const rest = flat - s * p.nch * p.ncoef;
    const c = Math.floor(rest / p.ncoef);
    const k = rest - c * p.ncoef;
    if (pack.segments[s][c][k] === p.samples[i]) same++;
  }
  ok(same === SAMPLES, `${p.file}: ${same} of ${SAMPLES} sampled coefficients are identical`);
}
ok((G.packs as unknown[]).length >= 17, "the fixture covers the shipped binary packs");

// The loader prefers the binary pack: its coefficients are whole multiples of
// the quantum, which the JSON pack's are not.
{
  const data = loadNodeData(DATA, "embedded", "full");
  const bytes = new Uint8Array(readFileSync(join(DATA, "mars_cheb.cpk")));
  const { header } = decodePackHeader(bytes);
  let q = 1.0;
  for (let i = 0; i > header.qexp; i--) q *= 0.5;
  const mars = data.chebPacks!.mars;
  const v = mars.segments[5][1][3] / q;
  ok(Number.isInteger(v), "loadNodeData serves the binary Mars pack");
  ok(data.moonCheb !== undefined && data.moonEraPacks !== undefined && data.earthPack !== undefined,
    "loadNodeData finds the Moon, its era slab, and Earth from binary packs alone");
  ok(existsSync(join(DATA, "chiron_cheb.json")) && data.chiron !== undefined,
    "a pack with no binary form still loads from JSON");
}

// Malformed input.
{
  const good = new Uint8Array(readFileSync(join(DATA, "saturn_cheb.cpk")));
  const refuses = (bytes: Uint8Array, why: string): void => {
    let threw = false;
    try { decodePack(bytes); } catch (e) { threw = e instanceof RangeError; }
    ok(threw, `refuses ${why}`);
  };
  const badMagic = good.slice(); badMagic[0] = 0x58;
  refuses(badMagic, "a wrong magic");
  refuses(good.slice(0, good.length - 7), "a truncated payload");
  const longer = new Uint8Array(good.length + 3); longer.set(good);
  refuses(longer, "trailing bytes");
  refuses(new Uint8Array([0x43, 0x50]), "a file shorter than the magic");
  ok(!isBinaryPack(new TextEncoder().encode('{"jd0":1}')), "JSON is not mistaken for a binary pack");
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
