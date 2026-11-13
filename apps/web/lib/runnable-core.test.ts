/**
 * Unit checks for the runnable-example core: import rewriting, block
 * assembly, execution, formatting, and extraction from MDX. Run by
 * scripts/test-web-libs.mjs.
 */
import {
  assembleProgram, disallowedImports, execute, extractRunnable, formatValue,
  parseRunMeta, rewriteImports,
} from "./runnable-core.mjs";

let checks = 0;
let failures = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}
const eq = (got: unknown, want: unknown, msg: string) =>
  ok(JSON.stringify(got) === JSON.stringify(want), `${msg}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ---------------------------------------------------------------- fence meta
eq(parseRunMeta("ts", "run"), {}, "ts run");
eq(parseRunMeta("ts", 'run label="chart.ts"'), { label: "chart.ts" }, "label");
eq(parseRunMeta("ts", null), null, "no meta");
eq(parseRunMeta("ts", "runner"), null, "run must be a whole word");
eq(parseRunMeta("bash", "run"), null, "only script languages run");

// ---------------------------------------------------------------- imports
eq(
  rewriteImports('import { Engine, julianDay as jd } from "caelus";'),
  'const { Engine, julianDay: jd } = __mod("caelus");',
  "named imports",
);
eq(
  rewriteImports('import {\n  Engine,\n  julianDay,\n} from "caelus";\nconst a = 1;'),
  'const { Engine, julianDay } = __mod("caelus");\nconst a = 1;',
  "multi-line named imports",
);
eq(rewriteImports('import * as c from "caelus";'), 'const c = __mod("caelus");', "namespace import");
eq(rewriteImports('import type { Chart } from "caelus";\nlet x;'), "\nlet x;", "type-only import dropped");
eq(disallowedImports('import { loadNodeData } from "caelus/node";'), ["caelus/node"], "node loader is not provided");
eq(disallowedImports('import { Engine } from "caelus";\nimport "node:fs";'), ["node:fs"], "side-effect import");
eq(disallowedImports('const s = "import x from \\"y\\"";'), [], "an import inside a string is not an import");

// ---------------------------------------------------------------- execution
const modules = { caelus: { double: (n: number) => n * 2 }, "caelus/data-embedded": { embeddedData: {} } };
const setup = 'import { double } from "caelus";\nconst base = 21;';

eq(execute([setup, "double(base);"], modules).value, 42, "a block sees names from the block above");
eq(execute([setup, "const base = 5;\ndouble(base);"], modules).value, 10, "a later block may redeclare a name");
eq(execute(["1 + 1;", "const x = 3;"], modules).value, undefined, "no stale value when the block ends in a declaration");
eq(execute(["console.log('setup');", "console.log('a', { b: 1 });\n7;"], modules).logs, ['a { "b": 1 }'], "only the last block's logs");
eq(execute(["typeof fetch;"], modules).value, "undefined", "network globals are shadowed");
ok(assembleProgram(["a;", "b;", "c;"]).endsWith("}\n}\n"), "blocks nest");

let threw = "";
try {
  execute(['import { readFileSync } from "node:fs";'], modules);
} catch (e) {
  threw = (e as Error).message;
}
ok(threw.includes('"node:fs"') && threw.includes("caelus/data-embedded"), "an unknown module is refused by name");

// ---------------------------------------------------------------- formatting
eq(formatValue({ lat: 25.3, lonEast: -104.17 }), '{ "lat": 25.3, "lonEast": -104.17 }', "small object on one line");
eq(formatValue(undefined), "undefined", "undefined");
eq(formatValue([1, [2, 3]]), "[1, [2, 3]]", "nested arrays inline");
ok(formatValue(Array.from({ length: 50 }, (_, i) => i)).includes('"… 30 more"'), "long arrays are cut");
ok(formatValue(new (class Engine {})()).startsWith("[Engine]"), "class instances print by name");
ok(formatValue("x".repeat(500)).includes("(500 characters)"), "long strings are cut");
const cyclic: Record<string, unknown> = {};
cyclic.self = cyclic;
eq(formatValue(cyclic), '{ "self": [Circular] }', "cycles");
ok(formatValue({ a: "x".repeat(60), b: "y".repeat(60) }).includes("\n"), "wide objects wrap");

// ---------------------------------------------------------------- extraction
const mdx = [
  "# T", "", "```ts run", 'import { Engine } from "caelus";', "```", "",
  "```ts", "notRunnable();", "```", "",
  '<CodeBlock', '  run', '  lang="typescript"', "  code={`const s = \\`t\\`;", "s;`}", "/>", "",
  '<CodeBlock lang="typescript" code={`plain();`} />', "",
  "```ts run label=\"x.ts\"", "last();", "```", "",
].join("\n");
const found = extractRunnable(mdx);
eq(found.map((b: { code: string }) => b.code), ['import { Engine } from "caelus";', "const s = `t`;\ns;", "last();"], "runnable blocks in page order");
eq(found.map((b: { line: number }) => b.line), [3, 11, 20], "line numbers");

console.log(`runnable-core: ${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
