/**
 * Minted-body golden: a real mint (433 Eros, 1990 to 2030, made by
 * python/mint_body.py) must verify against its certificate, register on an
 * engine, and return the positions the Python reference returns for it
 * (minted-golden.json, from python/export_minted_golden.py). A pack that is
 * not the one the certificate was written for must be refused before it is
 * decoded.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine } from "../src/chart.js";
import { engineCapabilities } from "../src/capabilities.js";
import { loadNodeData } from "../src/node-loader.js";
import {
  checkMintCertificate, loadMintedBody, registerMintedBody, verifyMintedPack,
  MintIntegrityError, type MintCertificate,
} from "../src/minted.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "../../test/fixtures/minted");
const G = JSON.parse(readFileSync(join(here, "../../test/minted-golden.json"), "utf8"));
const data = loadNodeData(join(here, "../../data"), "embedded", "full");
const fromDisk = async (file: string): Promise<Uint8Array> => new Uint8Array(readFileSync(join(FIXTURE, file)));

let checks = 0;
let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
};
const rejects = async (fn: () => Promise<unknown>, kind: new (...a: never[]) => Error): Promise<boolean> => {
  try { await fn(); } catch (e) { return e instanceof kind; }
  return false;
};

const eng = new Engine(data);
const cert = await loadMintedBody(eng, G.certificate, fromDisk);
ok(cert.id === G.id && cert.number === 433, `the certificate names the body (${cert.id})`);
ok(eng.bodies().includes("eros") && eng.minted.get("eros") === cert, "the body is registered under the certificate's id");

const TOL = 1e-9; // degrees and AU
// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const c of G.cases as any[]) {
  const p = eng.position("eros", c.jd);
  for (const k of ["lon", "lat", "dist", "ra", "dec"] as const) {
    ok(Math.abs((p[k] as number) - c.position[k]) < TOL, `${c.id}.${k}: ${p[k]} vs ${c.position[k]}`);
  }
  ok(Math.abs(p.speed - c.position.speed) < 1e-8, `${c.id}.speed: ${p.speed} vs ${c.position.speed}`);
  const h = eng.heliocentric("eros", c.jd);
  for (const k of ["lon", "lat", "dist"] as const) {
    ok(Math.abs(h[k] - c.heliocentric[k]) < TOL, `${c.id} heliocentric ${k}: ${h[k]} vs ${c.heliocentric[k]}`);
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const c of G.outside as any[]) {
  let threw = false;
  try { eng.position("eros", c.jd); } catch (e) { threw = e instanceof RangeError; }
  ok(threw, `${c.id}: a position outside the certificate's span throws`);
}

// What the engine says about the body.
const cap = engineCapabilities(eng).bodies.find((b) => b.body === "eros");
ok(cap?.source === "minted" && cap.validated?.from === 1990 && cap.validated?.to === 2030
  && cap.fitted?.from === 1990, `capabilities report the minted span (${JSON.stringify(cap)})`);
ok(cert.error.max_au < cert.error.target_au && cert.error.angle_bound_arcsec < 0.5,
  "the certificate's measured error is inside its target");
ok(Math.abs(cert.error.angle_bound_arcsec
  - cert.error.max_au / cert.error.min_geocentric_au * (648000 / Math.PI)) < 1e-9,
"the angle bound is the error seen from the closest approach");

// Refusals: nothing is decoded unless the bytes are the certificate's.
const bytes = await fromDisk("eros.cpk");
const flipped = bytes.slice();
flipped[flipped.length - 5] ^= 1;
ok(await rejects(() => verifyMintedPack(flipped, cert), MintIntegrityError), "one changed bit is refused");
ok(await rejects(() => verifyMintedPack(bytes.slice(0, bytes.length - 1), cert), MintIntegrityError),
  "a short pack is refused");
const fresh = new Engine(data);
ok(await rejects(() => registerMintedBody(fresh, flipped, cert), MintIntegrityError)
  && !fresh.bodies().includes("eros") && fresh.minted.size === 0, "a refused pack registers nothing");
const wrongHash: MintCertificate = { ...cert, pack: { ...cert.pack, sha256: "0".repeat(64) } };
ok(await rejects(() => verifyMintedPack(bytes, wrongHash), MintIntegrityError), "a certificate for other bytes is refused");
ok((await verifyMintedPack(bytes, cert)).segments.length === 40, "the right bytes decode");
const throwsRange = (fn: () => unknown): boolean => {
  try { fn(); } catch (e) { return e instanceof RangeError; }
  return false;
};
ok(throwsRange(() => checkMintCertificate({ format: "something-else", version: 1 })), "another format is not a certificate");
ok(throwsRange(() => checkMintCertificate({ ...cert, version: 2 })), "another version is not read");
ok(throwsRange(() => checkMintCertificate({ ...cert, pack: { file: "eros.cpk" } })), "a certificate with no hash is not read");
const escaping = JSON.stringify({ ...cert, pack: { ...cert.pack, file: "../eros.cpk" } });
ok(await rejects(() => loadMintedBody(new Engine(data), "x.cert.json",
  async (file) => (file === "x.cert.json" ? escaping : bytes)), RangeError), "a pack path that leaves the directory is refused");

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
