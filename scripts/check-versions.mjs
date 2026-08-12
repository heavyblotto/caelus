#!/usr/bin/env node
// Single source of truth for "everything ships at the same version".
// Asserts the four npm packages, the Python package (pyproject.toml), and the
// MCP Registry descriptor (server.json) all agree, and that caelus-mcp/birth
// pin caelus at the matching ^X.Y.Z range. A drift fails CI before a tag can
// publish a half-bumped release (e.g. PyPI lagging npm). Run in release.yml.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const pkgVersion = (p) => JSON.parse(read(p)).version;

const sources = [
  { label: "caelus (npm)", version: pkgVersion("packages/caelus/package.json") },
  { label: "caelus-mcp (npm)", version: pkgVersion("packages/caelus-mcp/package.json") },
  { label: "caelus-birth (npm)", version: pkgVersion("packages/birth/package.json") },
  { label: "caelus-wheel (npm)", version: pkgVersion("packages/wheel/package.json") },
];

// Python: [project] version = "X.Y.Z"
const pyproject = read("python/pyproject.toml");
const pyMatch = pyproject.match(/^\s*version\s*=\s*"([^"]+)"/m);
if (!pyMatch) {
  console.error("check-versions: could not find version in python/pyproject.toml");
  process.exit(1);
}
sources.push({ label: "caelus-engine (PyPI / pyproject)", version: pyMatch[1] });

// MCP Registry descriptor: top-level version + packages[].version
const serverJson = JSON.parse(read("packages/caelus-mcp/server.json"));
sources.push({ label: "server.json (version)", version: serverJson.version });
for (const p of serverJson.packages ?? []) {
  sources.push({ label: `server.json packages[${p.identifier}]`, version: p.version });
}

// Web display version: SITE.version (header tag, footer, OG image, docs eyebrow)
const siteTs = read("apps/web/lib/site.ts");
const siteMatch = siteTs.match(/version:\s*"([^"]+)"/);
if (!siteMatch) {
  console.error("check-versions: could not find SITE.version in apps/web/lib/site.ts");
  process.exit(1);
}
sources.push({ label: "apps/web/lib/site.ts (SITE.version)", version: siteMatch[1] });

const canonical = sources[0].version;
const mismatches = sources.filter((s) => s.version !== canonical);

// caelus-mcp and caelus-birth must pin caelus at ^<canonical>
const depErrors = [];
for (const dir of ["packages/caelus-mcp", "packages/birth"]) {
  const dep = JSON.parse(read(`${dir}/package.json`)).dependencies?.caelus;
  const expected = `^${canonical}`;
  if (dep !== expected) {
    depErrors.push(`${dir} depends on caelus "${dep}", expected "${expected}"`);
  }
}

// caelus-delineations-pd versions independently (0.1.x) but its peer range on
// caelus must admit the canonical engine version. The old shape — a regular
// dependency whose caret range went stale — nested a duplicate engine inside
// every consumer install and drifted three times without a version bump,
// because this script never looked at the package. Range form is ">=A <B".
const pdPkg = JSON.parse(read("packages/caelus-delineations-pd/package.json"));
const pdRange = pdPkg.peerDependencies?.caelus;
const parseVer = (v) => v.split(".").map(Number);
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
if (pdPkg.dependencies?.caelus) {
  depErrors.push(
    "caelus-delineations-pd lists caelus in dependencies — it must be a peerDependency " +
      "(a regular dependency nests a second engine copy in consumer installs)",
  );
}
const rangeMatch = pdRange?.match(/^>=(\d+\.\d+\.\d+) <(\d+\.\d+(?:\.\d+)?)$/);
if (!rangeMatch) {
  depErrors.push(
    `caelus-delineations-pd peerDependencies.caelus is "${pdRange}", expected ">=A.B.C <X.Y" form`,
  );
} else {
  const lo = parseVer(rangeMatch[1]);
  const hi = parseVer(rangeMatch[2].split(".").length === 2 ? `${rangeMatch[2]}.0` : rangeMatch[2]);
  const can = parseVer(canonical);
  if (cmp(can, lo) < 0 || cmp(can, hi) >= 0) {
    depErrors.push(
      `caelus-delineations-pd peer range "${pdRange}" does not admit caelus ${canonical} — ` +
        "widen the range AND bump the package version so the fix can actually publish",
    );
  }
}

if (mismatches.length === 0 && depErrors.length === 0) {
  console.log(
    `versions check passed — all artifacts at ${canonical}; ` +
      `caelus-delineations-pd at ${pdPkg.version} (peer ${pdRange})`,
  );
  process.exit(0);
}

console.error(`version drift detected (canonical = ${canonical}, from ${sources[0].label}):`);
for (const m of mismatches) console.error(`  - ${m.label}: ${m.version}`);
for (const e of depErrors) console.error(`  - ${e}`);
process.exit(1);
