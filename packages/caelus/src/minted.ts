/**
 * astroengine minted -- bodies minted on demand.
 *
 * The engine ships packs for a handful of small bodies. Any other numbered
 * asteroid can be minted: `python/mint_body.py` fits a pack to JPL Horizons
 * and writes it with a certificate, a small JSON file that states the span,
 * the source, the error measured against Horizons at epochs the fit never
 * saw, and the SHA-256 of the pack's bytes.
 *
 * This module is the loading half. It checks that a pack's bytes are the
 * bytes the certificate was written for, and registers the body on an engine
 * under the certificate's id. A pack that fails the check is never decoded.
 * Nothing here does I/O on its own: the caller hands in the bytes, or a
 * function that fetches them.
 *
 * Mirrors the Python reference (astroengine/minted.py).
 */
import type { Engine } from "./chart.js";
import { ChebSeries, type ChebData } from "./core.js";
import { decodePack } from "./packbin.js";

/** What `python/mint_body.py` writes beside a minted pack. */
export interface MintCertificate {
  format: "caelus-mint-certificate";
  version: 1;
  /** The body id the pack registers under, such as `"eros"`. */
  id: string;
  /** The asteroid's IAU number. */
  number: number;
  /** The body as JPL Horizons names it, such as `"433 Eros (A898 PA)"`. */
  name: string;
  source: {
    service: string;
    /** The orbit solution the samples came from, such as `"JPL#659"`. */
    solution: string;
    frame: string;
    correction: string;
  };
  /** The span the pack serves: whole years, and the same as TT Julian Days. */
  span: { from: number; to: number; jd0: number; jd1: number };
  fit: {
    sample_step_days: number;
    seg_days: number;
    degree: number;
    node_residual_au: number;
    quantum_exponent: number;
  };
  error: {
    /** Largest distance between the published pack and Horizons, in AU, at
     *  `epochs` instants the fit never sampled. */
    max_au: number;
    /** The error the mint was required to stay under, in AU. */
    target_au: number;
    epochs: number;
    basis: string;
    /** The body's closest approach to the Earth inside the span, in AU. */
    min_geocentric_au: number;
    /** `max_au` as an angle seen from the Earth at that closest approach:
     *  an upper bound on the error of a geocentric position, in arcseconds. */
    angle_bound_arcsec: number;
  };
  pack: {
    /** File name of the pack, beside the certificate. */
    file: string;
    bytes: number;
    /** SHA-256 of the pack, lowercase hex. */
    sha256: string;
  };
  /** The date the pack was minted, `YYYY-MM-DD`. */
  minted: string;
}

/** A minted pack did not match its certificate. Nothing from it was decoded. */
export class MintIntegrityError extends Error {
  constructor(readonly file: string, reason: string) {
    super(`minted pack ${file} refused: ${reason}`);
    this.name = "MintIntegrityError";
  }
}

/**
 * Check that a value is a mint certificate this engine reads.
 *
 * @throws RangeError when the format, the version, or a required field is
 *   missing.
 */
export function checkMintCertificate(cert: unknown): MintCertificate {
  const c = cert as Partial<MintCertificate> | null;
  if (!c || typeof c !== "object" || c.format !== "caelus-mint-certificate" || c.version !== 1) {
    throw new RangeError("not a caelus mint certificate (format caelus-mint-certificate, version 1)");
  }
  for (const key of ["id", "span", "error", "pack"] as const) {
    if (c[key] === undefined) throw new RangeError(`mint certificate has no '${key}'`);
  }
  for (const key of ["file", "bytes", "sha256"] as const) {
    if (c.pack![key] === undefined) throw new RangeError(`mint certificate's pack has no '${key}'`);
  }
  return c as MintCertificate;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto (crypto.subtle) is not available, so a minted pack cannot be verified. "
      + "Browsers provide it on https and on localhost only.",
    );
  }
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
  let hex = "";
  for (const b of digest) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Decode a minted pack once its length and SHA-256 match the certificate.
 *
 * @param bytes The pack's bytes as fetched.
 * @param certificate The certificate published beside it.
 * @returns The decoded pack.
 * @throws MintIntegrityError when the bytes are not the ones the
 *   certificate was written for; nothing is decoded in that case.
 */
export async function verifyMintedPack(
  bytes: Uint8Array, certificate: MintCertificate,
): Promise<ChebData> {
  const cert = checkMintCertificate(certificate);
  if (bytes.length !== cert.pack.bytes) {
    throw new MintIntegrityError(cert.pack.file, `${bytes.length} bytes, the certificate says ${cert.pack.bytes}`);
  }
  if (await sha256Hex(bytes) !== String(cert.pack.sha256).toLowerCase()) {
    throw new MintIntegrityError(cert.pack.file, "its SHA-256 does not match the certificate");
  }
  return decodePack(bytes);
}

/**
 * Verify a minted pack and register its body on an engine under the
 * certificate's id. The body then answers `position`, `longitude`, and
 * `heliocentric` inside the certificate's span and throws outside it, and
 * {@link engineCapabilities} reports it with that span.
 *
 * @param engine The engine to register on.
 * @param bytes The pack's bytes.
 * @param certificate The certificate published beside the pack.
 * @returns The certificate.
 * @example
 * ```ts
 * const cert = await registerMintedBody(engine, bytes, certificate);
 * engine.position(cert.id, julianDay(2012, 1, 31)).lon;
 * cert.error.angle_bound_arcsec; // how far off that longitude can be
 * ```
 */
export async function registerMintedBody(
  engine: Engine, bytes: Uint8Array, certificate: MintCertificate,
): Promise<MintCertificate> {
  const pack = await verifyMintedPack(bytes, certificate);
  engine.registerSource(certificate.id, new ChebSeries(pack));
  engine.minted.set(certificate.id, certificate);
  return certificate;
}

/** Returns the bytes of a file published beside a certificate. */
export type MintFetch = (file: string) => Promise<ArrayBuffer | ArrayBufferView | string>;

/**
 * Fetch a certificate and the pack it names, verify, and register the body.
 * `fetchFile` is called twice: with the certificate's file name and with the
 * pack's, which must be a plain file name beside it.
 *
 * @param engine The engine to register on.
 * @param certificateFile The certificate's file name, such as
 *   `"eros.cert.json"`.
 * @param fetchFile Returns the contents of a file in the directory the
 *   certificate is published in.
 * @returns The certificate.
 * @example
 * ```ts
 * const base = "https://example.org/minted/";
 * const cert = await loadMintedBody(engine, "eros.cert.json",
 *   async (file) => (await fetch(base + file)).arrayBuffer());
 * ```
 */
export async function loadMintedBody(
  engine: Engine, certificateFile: string, fetchFile: MintFetch,
): Promise<MintCertificate> {
  const raw = await fetchFile(certificateFile);
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(toBytes(raw));
  const cert = checkMintCertificate(JSON.parse(text));
  const file = cert.pack.file;
  if (!/^[\w.-]+$/.test(file) || file.startsWith(".")) {
    throw new RangeError(`pack file name ${JSON.stringify(file)} is not a plain file name`);
  }
  const packRaw = await fetchFile(file);
  if (typeof packRaw === "string") {
    throw new RangeError("the pack must be fetched as bytes, not text");
  }
  return registerMintedBody(engine, toBytes(packRaw), cert);
}

function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  return data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
