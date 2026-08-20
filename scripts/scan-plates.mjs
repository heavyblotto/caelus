#!/usr/bin/env node
/**
 * The MDX AST scan that builds the plate registry.
 *
 * Widget specs are authored inline in the Encyclopedia MDX
 * (`<W kind="..." params={{...}} figure={n} caption="..." />`) and
 * enumerated here mechanically: the scan walks the entry sources,
 * reads every `W` element out of the MDX AST, validates its spec
 * against the widget-kind contracts, and emits the PlateRegistry
 * artifact (packages/widgets/src/registry.ts) that feeds the figure
 * harness, the search index, the plate count, and the reproduce
 * permalinks.
 *
 * The gates it enforces at scan time:
 *   - `params` must be a JSON literal (objects, arrays, strings,
 *     numbers, booleans, null) — the spec is serializable by
 *     construction or the build fails.
 *   - The spec must validate against its kind's params contract.
 *   - `figure` must match document order within its entry, so prose
 *     references ("Fig. 2") cannot drift.
 *   - Plate ids must be unique corpus-wide.
 *
 * Modes:
 *   node scripts/scan-plates.mjs           # write the registry
 *   node scripts/scan-plates.mjs --check   # CI drift gate: fail if the
 *                                          # committed registry is stale
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "packages", "widgets", "test", "plate-registry.json");
const CHECK = process.argv.includes("--check");

// The engine version stamped on every plate. package.json and the
// runtime VERSION export are asserted equal by check-versions.mjs, so
// either is authoritative; package.json needs no build first.
const ENGINE_VERSION = JSON.parse(
  readFileSync(join(ROOT, "packages", "caelus", "package.json"), "utf8"),
).version;

// The kb attribute must name a real node: the infobox and search link
// through it in both directions, so a phantom id is a build failure,
// not a dead link discovered later.
const KB_IDS = new Set(
  JSON.parse(
    readFileSync(join(ROOT, "packages", "kb", "data", "kb.json"), "utf8"),
  ).nodes.map((n) => n.id),
);

// ------------------------------------------------------------- sources
// Entry sources: the content dir carries entries as flat MDX
// (`<slug>.mdx`) until the Encyclopedia routes land; app-dir pages
// (`app/encyclopedia/<slug>/page.mdx`) join the walk when they exist.
function entrySources() {
  const out = [];
  const contentDir = join(ROOT, "apps", "web", "content", "encyclopedia");
  if (existsSync(contentDir)) {
    for (const f of readdirSync(contentDir).sort()) {
      if (f.endsWith(".mdx")) {
        out.push({ file: join(contentDir, f), entry: basename(f, ".mdx") });
      }
    }
  }
  const appDir = join(ROOT, "apps", "web", "app", "encyclopedia");
  if (existsSync(appDir)) {
    for (const slug of readdirSync(appDir).sort()) {
      const page = join(appDir, slug, "page.mdx");
      if (existsSync(page)) out.push({ file: page, entry: slug });
    }
  }
  return out;
}

// ------------------------------------------------------- literal eval
/** Evaluate an estree node that must be a JSON literal. Anything else
 *  (identifiers, calls, spreads, computed keys) fails the build: a
 *  spec that isn't serializable source can't be reproduced. */
function literal(node, where) {
  const fail = (what) => {
    throw new Error(`${where}: params must be a JSON literal; found ${what}`);
  };
  switch (node.type) {
    case "Literal": {
      const t = typeof node.value;
      if (node.value === null || t === "string" || t === "number" || t === "boolean") {
        return node.value;
      }
      return fail(`literal of type ${t}`);
    }
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "Literal"
        && typeof node.argument.value === "number") {
        return -node.argument.value;
      }
      return fail(`unary ${node.operator}`);
    case "ObjectExpression": {
      const obj = {};
      for (const p of node.properties) {
        if (p.type !== "Property" || p.computed) return fail("a non-literal key");
        const key = p.key.type === "Identifier" ? p.key.name
          : p.key.type === "Literal" ? String(p.key.value)
            : fail("a non-literal key");
        obj[key] = literal(p.value, where);
      }
      return obj;
    }
    case "ArrayExpression": {
      const arr = [];
      for (const el of node.elements) {
        if (!el || el.type === "SpreadElement") return fail("a spread or hole");
        arr.push(literal(el, where));
      }
      return arr;
    }
    default:
      return fail(node.type);
  }
}

/** The value of one JSX attribute: a string, or the evaluated literal
 *  of an expression container. */
function attrValue(attr, where) {
  if (attr.value == null) return true; // bare attribute
  if (typeof attr.value === "string") return attr.value;
  const estree = attr.value.data?.estree;
  const expr = estree?.body?.[0]?.expression;
  if (!expr) {
    throw new Error(`${where}: attribute ${attr.name} has no parsed expression`);
  }
  return literal(expr, `${where} (${attr.name})`);
}

// ----------------------------------------------------- spec validation
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string";

function checkChartParams(p, fail) {
  const i = p.instant;
  if (!i || !["y", "mo", "d", "h", "mi", "s"].every((k) => isNum(i[k]))) {
    fail("instant must carry numeric y, mo, d, h, mi, s (the instant is always explicit)");
  }
  const pl = p.place;
  if (!pl || !isNum(pl.latDeg) || !isNum(pl.lonEastDeg)) {
    fail("place must carry numeric latDeg and lonEastDeg");
  }
  if (pl.label !== undefined && !isStr(pl.label)) fail("place.label must be a string");
  if (p.houseSystem !== undefined && !isStr(p.houseSystem)) {
    fail("houseSystem must be a string");
  }
}

/** Per-kind params contracts, mirroring the WidgetSpec union
 *  (packages/widgets/src/spec.ts). A kind missing here cannot ship a
 *  plate — grow this table as the union grows. */
const KINDS = {
  derivation(p, fail) {
    checkChartParams(p, fail);
    if (p.t !== undefined && !(isNum(p.t) && p.t >= 0 && p.t <= 1)) {
      fail("t must be a number in [0, 1]");
    }
    if (p.follow !== undefined && !isStr(p.follow)) fail("follow must be a string");
    if (p.captions !== undefined && typeof p.captions !== "boolean") {
      fail("captions must be a boolean");
    }
  },
  "wheel-anatomy"(p, fail) {
    checkChartParams(p, fail);
    if (p.layers !== undefined) {
      const known = new Set(["horizon", "zodiac", "houses", "bodies", "aspects"]);
      if (!Array.isArray(p.layers) || !p.layers.every((l) => known.has(l))) {
        fail("layers must be an array of anatomy layer names");
      }
    }
  },
  "house-comparator"(p, fail) {
    checkChartParams(p, fail);
    if (p.compare !== undefined && !isStr(p.compare)) {
      fail("compare must be a house-system name");
    }
  },
  "zodiac-drift"(p, fail) {
    checkChartParams(p, fail);
    const modes = new Set([
      "lahiri", "fagan_bradley", "krishnamurti", "raman", "yukteshwar",
    ]);
    if (p.ayanamsa !== undefined && !(isStr(p.ayanamsa) && modes.has(p.ayanamsa))) {
      fail("ayanamsa must be one of lahiri, fagan_bradley, krishnamurti, raman, yukteshwar");
    }
  },
  "aspect-dial"(p, fail) {
    checkChartParams(p, fail);
    if (p.a !== undefined && !isStr(p.a)) fail("a must be a body id");
    if (p.b !== undefined && !isStr(p.b)) fail("b must be a body id");
    if (p.orb !== undefined && !(isNum(p.orb) && p.orb >= 0 && p.orb <= 10)) {
      fail("orb must be a number in [0, 10]");
    }
  },
};

// ---------------------------------------------------------------- scan
const parser = unified().use(remarkParse).use(remarkMdx);
const plates = [];
const errors = [];

for (const { file, entry } of entrySources()) {
  const rel = relative(ROOT, file);
  const tree = parser.parse(readFileSync(file, "utf8"));
  let section = 0;
  let figures = 0;

  // Document order: headings advance the section locator, W elements
  // become plates. Top-level walk is enough for headings; W elements
  // are collected at any depth.
  const walk = (node) => {
    if (node.type === "heading" && node.depth === 2) section++;
    if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement")
      && node.name === "W") {
      figures++;
      const line = node.position?.start?.line;
      const where = `${rel}:${line}`;
      try {
        const attrs = {};
        for (const a of node.attributes) {
          if (a.type !== "mdxJsxAttribute") {
            throw new Error(`${where}: spread attributes are not scannable`);
          }
          attrs[a.name] = attrValue(a, where);
        }
        const { kind, params, figure, caption, kb, id } = attrs;
        if (!isStr(kind) || !(kind in KINDS)) {
          throw new Error(`${where}: unknown widget kind ${JSON.stringify(kind)}`);
        }
        KINDS[kind](params ?? {}, (msg) => {
          throw new Error(`${where}: ${kind} spec invalid: ${msg}`);
        });
        if (figure !== figures) {
          throw new Error(
            `${where}: figure={${figure}} but this is figure ${figures} of "${entry}" in document order`,
          );
        }
        if (!isStr(caption) || !caption.trim()) {
          throw new Error(`${where}: every plate carries an apparatus caption`);
        }
        if (kb !== undefined && !KB_IDS.has(kb)) {
          throw new Error(
            `${where}: kb must name an existing caelus-kb node, got ${JSON.stringify(kb)}`,
          );
        }
        plates.push({
          id: isStr(id) ? id : `${entry}-fig-${figure}`,
          figure,
          spec: { kind, params },
          caption,
          location: { entry, ...(section ? { section: String(section) } : {}) },
          ...(kb !== undefined ? { kb } : {}),
          engineVersion: ENGINE_VERSION,
        });
      } catch (e) {
        errors.push(e.message);
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
}

// Corpus-wide gates.
const seen = new Set();
for (const p of plates) {
  if (seen.has(p.id)) errors.push(`duplicate plate id ${p.id}`);
  seen.add(p.id);
}

if (errors.length) {
  console.error("scan-plates: the MDX corpus does not validate:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

plates.sort((a, b) =>
  a.location.entry.localeCompare(b.location.entry) || a.figure - b.figure);

const registry = {
  comment:
    "Generated by scripts/scan-plates.mjs from the Encyclopedia MDX sources "
    + "(apps/web/content/encyclopedia, apps/web/app/encyclopedia) — do not edit. "
    + "Regenerate with `npm run plates:scan`. Shape: PlateRegistry "
    + "(packages/widgets/src/registry.ts); the figure harness gates every plate "
    + "listed here and asserts engineVersion equals the runtime VERSION.",
  engineVersion: ENGINE_VERSION,
  plates,
};
const text = `${JSON.stringify(registry, null, 2)}\n`;

if (CHECK) {
  const committed = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (committed !== text) {
    console.error(
      "scan-plates: committed plate registry is stale against the MDX sources; "
      + "run `npm run plates:scan` and commit the result "
      + "(then regenerate figure hashes if plates changed: "
      + "CAELUS_FIGURES_WRITE=1 node packages/widgets/dist/test/harness.test.js).",
    );
    process.exit(1);
  }
  console.log(`scan-plates: registry current (${plates.length} plates)`);
} else {
  writeFileSync(OUT, text);
  console.log(`scan-plates: wrote ${plates.length} plates -> ${relative(ROOT, OUT)}`);
}
