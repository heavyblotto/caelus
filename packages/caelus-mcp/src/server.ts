#!/usr/bin/env node
/**
 * caelus-mcp -- MCP server for Caelus astrology computation (Node entry).
 *
 * The tools, resources, and prompts live in ./core.ts, which has no Node
 * dependency. This file is the Node host around it: it reads from disk what
 * the core takes as options (the package version, the accuracy tables, the
 * city gazetteer, the full data packs), and runs the stdio transport when
 * executed as a program.
 *
 * Transport: stdio (this file). The same buildServer() can be mounted on
 * Streamable HTTP for the hosted ephemengine.com deployment; a host with no
 * filesystem (an edge function, a Cloudflare Worker) should import
 * `caelus-mcp/core` instead and inject its own engine.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { realpathSync, readFileSync } from "node:fs";
import { Engine } from "caelus";
import { loadNodeData } from "caelus/node";
import {
  buildServer as buildCoreServer,
  type AccuracyTables, type BuildServerOptions, type GazetteerRow,
} from "./core.js";

export * from "./core.js";

const require = createRequire(import.meta.url);

// Read our own version relative to this file (dist/src/server.js -> the package
// root package.json). A bare require("caelus-mcp/package.json") resolves the
// package by name -- fine under the workspace symlink, but it throws when this
// module is traced into a serverless bundle (the apps/web Streamable HTTP mount)
// where "caelus-mcp" is not a resolvable node_modules entry. The relative path
// resolves from this file's own location, so it holds in both layouts.
const VERSION: string = (() => {
  try {
    return (require("../../package.json") as { version: string }).version;
  } catch {
    return "0.0.0";
  }
})();

// The stdio server builds its engine from the Node data packs (precise Moon,
// fixed stars). Hosted transports -- e.g. the Streamable HTTP mount in
// apps/web -- inject their own engine, typically the embedded tier, which
// carries every body these tools use and touches no filesystem. So the
// default stays lazy and loadNodeData never runs unless a caller wants it.
let _defaultEngine: Engine | null = null;
function defaultEngine(): Engine {
  if (_defaultEngine) return _defaultEngine;
  // Resolved lazily: only the stdio default reads the Node data packs. Hosted
  // transports inject their own engine and never reach this, so the caelus
  // package-dir lookup and filesystem read never run in a bundle without them.
  const dataDir = process.env.CAELUS_DATA
    ?? join(dirname(require.resolve("caelus/package.json")), "data");
  return (_defaultEngine = new Engine(loadNodeData(dataDir, "embedded", "full")));
}

// Loaded on first read of the accuracy resource and memoized. Kept off the
// module top level so importing this file touches no filesystem; resilient so
// a missing pack degrades to null instead of failing the server.
let _accuracy: AccuracyTables | null = null;
function accuracyFromDisk(): AccuracyTables {
  if (_accuracy) return _accuracy;
  let swiss: unknown = null;
  try { swiss = require("caelus/accuracy.json"); } catch { /* optional */ }
  let jpl: unknown = null;
  try {
    jpl = require(join(dirname(require.resolve("caelus/package.json")),
                       "horizons-accuracy.json"));
  } catch { /* optional, ships with the repo but maybe not the tarball */ }
  return (_accuracy = { swiss, jpl });
}

// The bundled city gazetteer (data/gazetteer.json), read on the first named
// place lookup. A bundle that does not ship the file resolves named places to
// null (reported, never silent).
let _gazetteer: GazetteerRow[] | null | undefined;
function gazetteerFromDisk(): GazetteerRow[] | null {
  if (_gazetteer !== undefined) return _gazetteer;
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), "../../data/gazetteer.json");
    _gazetteer = (JSON.parse(readFileSync(path, "utf8")) as { cities: GazetteerRow[] }).cities;
  } catch {
    _gazetteer = null;
  }
  return _gazetteer;
}

/**
 * Build the server with Node defaults: the engine from the full data packs
 * and, for any option the caller leaves unset, the value read from disk or
 * the environment. Options a caller passes are used as given.
 */
export function buildServer(
  engine: Engine = defaultEngine(),
  opts: BuildServerOptions = {},
): McpServer {
  return buildCoreServer(engine, {
    version: opts.version ?? VERSION,
    accuracy: opts.accuracy ?? accuracyFromDisk,
    gazetteer: opts.gazetteer ?? gazetteerFromDisk,
    embedOrigin: opts.embedOrigin ?? process.env.CAELUS_EMBED_ORIGIN,
  });
}

// ---------------------------------------------------------------- main
// argv[1] is a symlink when invoked via a bin shim (npx, node_modules/.bin),
// so compare realpaths or the server silently never starts.
const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (isMain) {
  // An async IIFE rather than top-level await keeps this module synchronous, so
  // bundlers that import buildServer() for the Streamable HTTP transport (the
  // apps/web mount) don't have to treat the whole module as async.
  void (async () => {
    const server = buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Caelus under the velificatio, in stderr's ASCII. stdout is the protocol
    // channel, so the banner goes to stderr where hosts collect logs.
    const arch = String.raw`
       .-~~~~~-.
     .'  *  .   '.
    /  ( o   o )  \
   |       >       |
    \    \___/    /
     '.         .'
       '-_____-'`;
    console.error(
      `${arch}\n   caelus-mcp v${VERSION} · western + vedic ephemeris · MIT\n   listening on stdio\n`,
    );
  })();
}
