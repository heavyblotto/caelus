/**
 * astroengine pack loader -- fetch binary packs on demand, anywhere.
 *
 * The embedded tier is what a browser bundle carries. The full packs (the
 * Horizons fits for the planets, the Earth, and the Moon, and their era slabs
 * back to 3000 BCE) are 27 MB, too much to bundle and small enough to fetch
 * when a caller needs them. This module does that fetch for a host with no
 * filesystem: a browser, a Cloudflare Worker, or Node.
 *
 * The caller supplies two things. A manifest lists the packs a site
 * publishes, each with its size, its SHA-256, the body it holds, and the
 * years it spans. A fetch function turns a manifest file name into bytes.
 * The loader then:
 *
 *  - fetches only the packs it is handed, and only ones the manifest lists;
 *  - checks each pack's length and SHA-256 (Web Crypto) before decoding a
 *    byte of it, and refuses a pack that does not match;
 *  - returns the packs placed into `EngineData` over a base such as
 *    `embeddedData`, in the same fields `loadNodeData` uses.
 *
 * It has no dependency and touches no global but `crypto.subtle`.
 *
 * @example
 * ```ts
 * import { Engine, loadPacks, selectPacks } from "caelus";
 * import { embeddedData } from "caelus/data-embedded";
 *
 * const base = "/data/packs/";
 * const manifest = await (await fetch(base + "manifest.json")).json();
 * const wanted = selectPacks(manifest, { bodies: ["saturn", "moon"], fromYear: -800, toYear: 0 });
 * const data = await loadPacks(embeddedData, manifest, wanted,
 *   async (file) => (await fetch(base + file)).arrayBuffer());
 * const engine = new Engine(data);
 * ```
 */
import type { ChebData, EngineData } from "./core.js";
import { decodePack } from "./packbin.js";

/** One published pack. */
export interface PackManifestEntry {
  /** File name, relative to the manifest. */
  file: string;
  /** Length of the file in bytes. */
  bytes: number;
  /** SHA-256 of the file, lowercase hex. */
  sha256: string;
  /** The body the pack holds: a planet id, `"earth"`, or `"moon"`. */
  body: string;
  /** `"modern"` for the default pack, or the name of an era slab such as `"classical"`. */
  era: string;
  /** First whole astronomical year the pack covers. */
  from: number;
  /** Last whole astronomical year the pack covers. */
  to: number;
}

/** The packs a site publishes. Written by `scripts/build-pack-manifest.mjs`. */
export interface PackManifest {
  format: "caelus-pack-manifest";
  version: 1;
  packs: PackManifestEntry[];
}

/** Which packs a computation needs. */
export interface PackSelection {
  /** Chart bodies: `"sun"`, `"moon"`, a planet id. Bodies with no pack are ignored. */
  bodies: readonly string[];
  /** First astronomical year needed. Omit to take every era. */
  fromYear?: number;
  /** Last astronomical year needed. */
  toYear?: number;
  /** Restrict to these eras, e.g. `["classical"]`. */
  eras?: readonly string[];
}

/** Turns a manifest file name into the file's bytes. The host decides where
 *  the files live and how to fetch them. */
export type PackFetch = (
  file: string, entry: PackManifestEntry,
) => Promise<ArrayBuffer | ArrayBufferView>;

/** Reported after each pack is verified and decoded. */
export interface PackProgress {
  /** The pack just finished. */
  file: string;
  packsDone: number;
  packsTotal: number;
  bytesDone: number;
  bytesTotal: number;
}

export interface LoadPacksOptions {
  onProgress?: (progress: PackProgress) => void;
  /** Packs fetched at once. Defaults to 4. */
  concurrency?: number;
}

/** A verified, decoded pack with the manifest entry it came from. */
export interface LoadedPack {
  entry: PackManifestEntry;
  pack: ChebData;
}

/** A fetched pack did not match its manifest entry. Nothing from it was decoded. */
export class PackIntegrityError extends Error {
  constructor(readonly file: string, reason: string) {
    super(`pack ${file} refused: ${reason}`);
    this.name = "PackIntegrityError";
  }
}

/** Bodies whose position is heliocentric: a geocentric direction is the
 *  body's pack minus the Earth's, so each needs the Earth's pack beside it. */
const HELIOCENTRIC = new Set([
  "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
]);
/** Chart points computed from the Moon's pack. */
const LUNAR = new Set(["moon", "true_node", "true_lilith"]);

function checkManifest(manifest: PackManifest): void {
  if (manifest?.format !== "caelus-pack-manifest" || manifest.version !== 1 || !Array.isArray(manifest.packs)) {
    throw new RangeError("not a caelus pack manifest (format caelus-pack-manifest, version 1)");
  }
}

/**
 * The manifest entries a computation needs, in manifest order.
 *
 * The Sun's position is the Earth's, so `"sun"` selects the Earth's packs.
 * A planet selects its own packs and the Earth's, because its geocentric
 * direction is the difference of the two; with the planet's pack alone the
 * Earth would come from the embedded series and the result would not match
 * the full tier. The Moon is geocentric and needs only its own.
 *
 * With a year range, only packs whose span overlaps it are returned.
 */
export function selectPacks(manifest: PackManifest, selection: PackSelection): PackManifestEntry[] {
  checkManifest(manifest);
  const needed = new Set<string>();
  for (const body of selection.bodies) {
    if (body === "sun" || body === "earth") needed.add("earth");
    else if (LUNAR.has(body)) needed.add("moon");
    else if (HELIOCENTRIC.has(body)) { needed.add(body); needed.add("earth"); }
  }
  const { fromYear, toYear, eras } = selection;
  return manifest.packs.filter((p) =>
    needed.has(p.body)
    && (!eras || eras.includes(p.era))
    && (fromYear === undefined || p.to >= fromYear)
    && (toYear === undefined || p.from <= toYear));
}

function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  return data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto (crypto.subtle) is not available, so packs cannot be verified. "
      + "Browsers provide it on https and on localhost only.",
    );
  }
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
  let hex = "";
  for (const b of digest) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Fetch, verify, and decode packs. Resolves with the packs in the order
 * given. Rejects with {@link PackIntegrityError} if any pack's length or
 * SHA-256 differs from its manifest entry; a pack that fails is never decoded.
 *
 * Only the entries passed are fetched, and each must be one the manifest
 * lists, so a caller cannot be steered into fetching an arbitrary file.
 */
export async function fetchPacks(
  manifest: PackManifest, entries: readonly PackManifestEntry[],
  fetchPack: PackFetch, options: LoadPacksOptions = {},
): Promise<LoadedPack[]> {
  checkManifest(manifest);
  const listed = new Map(manifest.packs.map((p) => [p.file, p]));
  for (const e of entries) {
    const known = listed.get(e.file);
    if (!known || known.sha256 !== e.sha256 || known.bytes !== e.bytes) {
      throw new RangeError(`pack ${JSON.stringify(e.file)} is not in the manifest`);
    }
    if (e.file.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(e.file) || !/^[\w./-]+$/.test(e.file)) {
      throw new RangeError(`pack file name ${JSON.stringify(e.file)} is not a plain relative path`);
    }
  }

  const bytesTotal = entries.reduce((sum, e) => sum + e.bytes, 0);
  const out: LoadedPack[] = new Array(entries.length);
  let next = 0;
  let packsDone = 0;
  let bytesDone = 0;

  const worker = async (): Promise<void> => {
    while (next < entries.length) {
      const i = next++;
      const entry = entries[i];
      const bytes = toBytes(await fetchPack(entry.file, entry));
      if (bytes.length !== entry.bytes) {
        throw new PackIntegrityError(entry.file, `${bytes.length} bytes, the manifest says ${entry.bytes}`);
      }
      const hash = await sha256Hex(bytes);
      if (hash !== entry.sha256.toLowerCase()) {
        throw new PackIntegrityError(entry.file, "its SHA-256 does not match the manifest");
      }
      out[i] = { entry, pack: decodePack(bytes) };
      packsDone++;
      bytesDone += entry.bytes;
      options.onProgress?.({ file: entry.file, packsDone, packsTotal: entries.length, bytesDone, bytesTotal });
    }
  };
  const lanes = Math.max(1, Math.min(options.concurrency ?? 4, entries.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  return out;
}

function sameSlab(a: ChebData, b: ChebData): boolean {
  return a.jd0 === b.jd0 && a.seg_days === b.seg_days && a.segments.length === b.segments.length;
}

/**
 * Place loaded packs into engine data over a base, without changing the
 * base. A modern pack replaces the base's source for its body; an era slab
 * is added beside whatever the base holds.
 */
export function mergePacks(base: EngineData, loaded: readonly LoadedPack[]): EngineData {
  const data: EngineData = { ...base };
  const addSlab = (list: ChebData[] | undefined, pack: ChebData): ChebData[] =>
    list?.some((s) => sameSlab(s, pack)) ? list : [...(list ?? []), pack];
  for (const { entry, pack } of loaded) {
    const { body } = entry;
    if (entry.era === "modern") {
      if (body === "earth") data.earthPack = pack;
      else if (body === "moon") data.moonCheb = pack;
      else data.chebPacks = { ...data.chebPacks, [body]: pack };
    } else if (body === "earth") {
      data.earthEraPacks = addSlab(data.earthEraPacks, pack);
    } else if (body === "moon") {
      data.moonEraPacks = addSlab(data.moonEraPacks, pack);
    } else {
      data.eraPacks = { ...data.eraPacks, [body]: addSlab(data.eraPacks?.[body], pack) };
    }
  }
  return data;
}

/**
 * Fetch the given packs, verify them, and return engine data with them
 * placed over `base`. See {@link fetchPacks} for what is checked and
 * {@link selectPacks} for choosing the entries.
 *
 * @param base The data to build on, usually `embeddedData`.
 * @param manifest The site's pack manifest.
 * @param entries The packs to load, from {@link selectPacks} or chosen by hand.
 * @param fetchPack Returns the bytes of a manifest file.
 */
export async function loadPacks(
  base: EngineData, manifest: PackManifest, entries: readonly PackManifestEntry[],
  fetchPack: PackFetch, options: LoadPacksOptions = {},
): Promise<EngineData> {
  return mergePacks(base, await fetchPacks(manifest, entries, fetchPack, options));
}
