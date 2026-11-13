# Runnable docs examples

A guide can mark a code block runnable. The site then shows a Run control on
it, and pressing Run executes the block in the reader's browser against the
engine and prints the value of its last expression under the code. Nothing is
sent to a server, and the engine downloads only when a reader first presses
Run.

## Marking a block

Add `run` to the fence:

````mdx
```ts run
solarEclipses(engine, julianDay(2024, 1, 1), julianDay(2027, 1, 1));
```
````

A label for the tile is optional: `ts run label="chart.ts"`. A `<CodeBlock>`
element takes the same flag as a prop, `<CodeBlock run lang="typescript" … />`.

## Rules for a runnable block

- It may import only `caelus` and `caelus/data-embedded`. A block that imports
  `caelus/node`, reads a file, or needs the era packs cannot run in a browser
  and must not be marked. Both site builds fail if one is.
- It must be JavaScript. Nothing compiles the block, so type annotations and
  other TypeScript-only syntax are errors.
- It sees the names declared by the runnable blocks above it on the same page.
  Running a block runs those blocks first, in order. So a setup block with the
  imports and the engine has to be marked too, even though running it alone
  prints no value.
- The value shown is that of the last expression statement. A block that ends
  in a declaration has no value. Anything passed to `console.log` is shown
  above the value.
- Engine times are Julian Days. An example whose stated result is a clock
  time should convert before its last line, as the guides do with a one-line
  `utc` helper.
- A run is stopped after 15 seconds. Keep an example well under that: the
  test fails any block that takes 10 seconds in Node.

## How it works

| Piece | File |
|---|---|
| Import rewriting, block assembly, execution, output formatting, extraction from MDX | `apps/web/lib/runnable-core.mjs` |
| MDX plugins that turn a flagged fence into `<CodeBlock run … />` | `apps/web/lib/runnable-mdx.mjs` |
| The Web Worker that holds the engine and runs a block | `apps/web/lib/runnable.worker.ts` |
| Worker lifecycle and the time limit | `apps/web/lib/runnable-client.ts` |
| The Run control and the output panel | `apps/web/components/CodeBlock.tsx` |

A block's `import` lines are never evaluated as module specifiers. They are
rewritten into reads from a fixed table of two modules that the worker has
already loaded, and any other specifier is refused by name. The block runs in
a Web Worker, so a long search does not freeze the page, and the page stops a
run that exceeds the limit by shutting the worker down.

Output is JSON, shortened where it would be unreadable: arrays past 20 items,
objects past 40 keys, nesting past 6 levels, and strings past 300 characters
are cut with a marker, and the whole output stops at 8,000 characters.

Both builds render the same MDX, and each compiles it with a different
toolchain. The Next app adds `remarkRunnable` to its remark plugins in
`next.config.mjs`. The Astro app adds `satteriRunnable` to its Markdown
processor in `astro.config.mjs`. Both plugins call one function, and
`CodeBlock` was already in each build's MDX component map, so neither build
needed a new component. Each bundler packages the worker from the same
`new Worker(new URL(…))` call.

## The test

`npm run test:docs-examples` extracts every runnable block from the guides and
executes each in Node against the built engine, through the same core module
the worker uses. It fails if a block throws, imports a module the runner does
not provide, or runs too long. Add `--show` to print each block's output,
which is the quickest way to check a guide's stated results against the
engine. CI runs it in the `conformance` job.

The test proves that an example runs. It does not compare the output with the
result the guide states, so a number in a table or a comment still has to be
checked by hand when an example changes.
