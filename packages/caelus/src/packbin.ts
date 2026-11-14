/**
 * astroengine packbin -- the binary form of a Chebyshev pack.
 *
 * A pack as JSON spends most of its bytes on decimal digits the fit cannot
 * justify. The binary form (CPK1) stores each coefficient as an integer
 * multiple of a quantum chosen well below the pack's own fit residual, so the
 * rounding it adds is a small fraction of the error already there.
 *
 * Layout (all integers little-endian):
 *
 *     bytes 0-3   the magic "CPK1"
 *     bytes 4-7   H, the header length in bytes (unsigned 32-bit)
 *     H bytes     the header, UTF-8 JSON
 *     payload     for each channel, for each coefficient order: one byte w
 *                 (1 to 8), then nseg signed integers of w bytes each
 *
 * A column holds one coefficient order of one channel across all segments,
 * stored as differences from the segment before. A coefficient is the running
 * sum of its column times 2^qexp. The quantum is a power of two, so the
 * scaling is exact and a decoded pack is the same list of doubles in every
 * language; decoding uses only integer addition and that one exact scaling,
 * with no call to `Math.pow` or any other function a runtime may round
 * differently.
 *
 * This module only decodes. Packs are minted by the Python reference
 * (python/pack_binary.py, astroengine/packbin.py), which this mirrors.
 */
import type { ChebData } from "./core.js";

/** The header of a CPK1 pack. */
export interface PackHeader {
  format: "caelus-pack";
  version: 1;
  jd0: number;
  seg_days: number;
  scale: number;
  nseg: number;
  nch: number;
  ncoef: number;
  /** The quantum is 2^qexp, in the units the coefficients are stored in. */
  qexp: number;
  /** SHA-256 of the JSON pack this one was minted from. */
  source_sha256?: string;
  provenance?: Record<string, unknown>;
}

const MAGIC = [0x43, 0x50, 0x4b, 0x31]; // "CPK1"

/** 2^e for an integer e, by repeated doubling or halving, so the result is
 *  exact on every runtime. */
function pow2(e: number): number {
  let q = 1.0;
  for (let i = 0; i < e; i++) q *= 2.0;
  for (let i = 0; i > e; i--) q *= 0.5;
  return q;
}

/** Whether the bytes begin with the CPK1 magic. */
export function isBinaryPack(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && MAGIC.every((b, i) => bytes[i] === b);
}

/** Read the header of a CPK1 pack and the offset at which its payload starts. */
export function decodePackHeader(bytes: Uint8Array): { header: PackHeader; offset: number } {
  if (!isBinaryPack(bytes)) throw new RangeError("not a CPK1 pack");
  const hlen = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
  const header = JSON.parse(
    new TextDecoder("utf-8").decode(bytes.subarray(8, 8 + hlen)),
  ) as PackHeader;
  if (header.format !== "caelus-pack" || header.version !== 1) {
    throw new RangeError(
      `unsupported pack format ${JSON.stringify(header.format)} version ${JSON.stringify(header.version)}`,
    );
  }
  return { header, offset: 8 + hlen };
}

/**
 * Decode a binary (CPK1) Chebyshev pack into the same shape a JSON pack loads
 * to, ready for {@link EngineData}. The coefficients are exact multiples of
 * the pack's quantum, identical to the Python reference's decoding.
 *
 * @param bytes The contents of a `.cpk` file.
 * @returns The pack: `jd0`, `seg_days`, `scale`, `segments`, and `provenance`.
 * @example
 * ```ts
 * const bytes = new Uint8Array(await (await fetch("/data/mars_cheb.cpk")).arrayBuffer());
 * const data = { ...embeddedData, chebPacks: { mars: decodePack(bytes) } };
 * ```
 */
export function decodePack(bytes: Uint8Array): ChebData {
  const { header, offset } = decodePackHeader(bytes);
  const { nseg, nch, ncoef } = header;
  const q = pow2(header.qexp);
  const segments: number[][][] = new Array(nseg);
  for (let s = 0; s < nseg; s++) {
    const seg: number[][] = new Array(nch);
    for (let c = 0; c < nch; c++) seg[c] = new Array<number>(ncoef);
    segments[s] = seg;
  }
  let pos = offset;
  for (let c = 0; c < nch; c++) {
    for (let k = 0; k < ncoef; k++) {
      const w = bytes[pos];
      if (!(w >= 1 && w <= 8)) throw new RangeError(`bad column width ${w}`);
      pos += 1;
      if (pos + nseg * w > bytes.length) throw new RangeError("pack is truncated");
      let acc = 0;
      for (let s = 0; s < nseg; s++) {
        // A signed little-endian integer of w bytes. Up to four bytes fit a
        // 32-bit operation; beyond that the low four bytes are unsigned and
        // the rest are a signed high part, combined in a double, which holds
        // every value of up to 53 bits exactly.
        let v: number;
        if (w <= 4) {
          let u = 0;
          for (let i = w - 1; i >= 0; i--) u = (u << 8) | bytes[pos + i];
          const shift = 32 - 8 * w;
          v = (u << shift) >> shift;
        } else {
          const lo = (bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16)
            | (bytes[pos + 3] << 24)) >>> 0;
          let hi = 0;
          for (let i = w - 1; i >= 4; i--) hi = (hi << 8) | bytes[pos + i];
          const shift = 32 - 8 * (w - 4);
          hi = (hi << shift) >> shift;
          v = hi * 4294967296 + lo;
        }
        pos += w;
        acc += v;
        segments[s][c][k] = acc * q;
      }
    }
  }
  if (pos !== bytes.length) throw new RangeError("pack has trailing bytes");
  const out: ChebData = {
    jd0: header.jd0, seg_days: header.seg_days, scale: header.scale, segments,
  };
  if (header.provenance) (out as ChebData & { provenance?: unknown }).provenance = header.provenance;
  return out;
}
