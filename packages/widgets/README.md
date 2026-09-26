# caelus-widgets

Encyclopedia widgets for caelus: interactive figures whose resting
render is the plate. Private to the monorepo; the Encyclopedia app is
the consumer.

Every widget is a pure function of a serializable `{ kind, params }`
spec. The SSR output at the initial parameters is the build-time
figure, the no-JS fallback, and the print version, from one code path.
The instant is always explicit: a widget never defaults to "now".

## Layout

- `caelus-widgets` — the shared system: `WidgetSpec`, plate registry
  types, `PlateFrame`, `PlateConsole`.
- `caelus-widgets/derivation` — the derivation widget: `deriveScene`
  (engine once, serializable scene out) and `DerivationFigure`
  (a pure function of scene and `t`), plus the stateful
  `ChartDerivation` wrapper. Widget kinds export from their own
  subpaths so an article loads only what it uses.

## The figure harness

`test/harness.test.tsx` walks the plate registry, renders every spec
at rest and at each named station, hashes the SVG, and compares
against `test/figure-hashes.json`. It also asserts the stamped engine
version equals the version doing the computing. Regenerate after an
intentional change:

```bash
CAELUS_FIGURES_WRITE=1 node dist/test/harness.test.js
```

The plan lives in `docs/product/encyclopedia-widgets-plan.md`.
