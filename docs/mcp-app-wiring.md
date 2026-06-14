# MCP-server wiring for the chat app

> **Status: implemented in `caelus-mcp` 0.14.0.** The architecture below is
> as-built. Two reconciliations were made against the current OpenAI Apps SDK /
> MCP Apps docs before merging:
> 1. **Keys.** The original draft used the now-legacy `text/html+skybridge` MIME
>    and `openai/widgetCSP`/`openai/outputTemplate` keys. As shipped, the
>    resource uses the current `text/html;profile=mcp-app` MIME and `_meta.ui.*`
>    keys, with the legacy `openai/*` aliases set alongside for ChatGPT
>    compatibility.
> 2. **No iframe.** The first cut loaded `/embed/chart` in an iframe, which
>    requires the `frameDomains` CSP grant — discouraged and heavily scrutinised
>    for ChatGPT directory distribution. As shipped, the widget loads a
>    self-contained **bundle** (`apps/web/widget` → `/embed/chart-widget.js`)
>    directly in the host sandbox, so the CSP needs only `resourceDomains`.

Goal: make the `natal_chart` and `current_sky` tools **render the chart wheel
in-host** (ChatGPT and other Apps-SDK / MCP-UI hosts). This is the server-side
half plus a small UI bundle; the standalone `/embed/chart` route stays as a
browser fallback (see `docs/mcp-app.md`).

It does not change the engine, the tool inputs/outputs, or any existing payload —
it only **adds** a UI resource, a UI-resource reference on two tools, and the
`structuredContent` the widget renders from.

## Pieces

- **Widget bundle** (`apps/web/widget/chart-widget.ts`, bundled by
  `scripts/build-chart-widget.mjs` to `apps/web/public/embed/chart-widget.js`).
  A self-contained IIFE (React + `caelus-wheel`) that mounts `ChartWheel` from
  the chart payload, read from the MCP Apps `ui/notifications/tool-result`
  message, ChatGPT's `window.openai.toolOutput`, or a `?c=` fallback. Built as
  part of `npm run build -w web`. Lives in the web/UI layer (where `caelus-wheel`
  already builds), keeping the MCP server independent of the UI build.
- **Widget resource + tool binding** (`packages/caelus-mcp/src/server.ts`,
  served by both the stdio server and the hosted `/api/mcp` mount).

## Approach

1. Register a tiny **widget resource** (`ui://widget/chart.html`) whose HTML is a
   root element plus a `<script src>` pointing at `/embed/chart-widget.js`. The
   bundle renders directly in the host sandbox — no nested iframe.
2. On `natal_chart` and `current_sky`, set `_meta.ui.resourceUri` (plus the
   `openai/outputTemplate` compatibility alias) to that resource and return the
   chart payload as `structuredContent` (handed to the widget via the MCP Apps
   `ui/notifications/tool-result` message, or ChatGPT's
   `window.openai.toolOutput`). The existing `text` content stays, so non-UI
   clients are unaffected.

## 1. The widget resource

Add near the top of `server.ts` (the base URL should come from an env var on the
hosted mount; default to the production origin):

```ts
const EMBED_ORIGIN = process.env.CAELUS_EMBED_ORIGIN ?? "https://www.ephemengine.com";
const CHART_WIDGET_URI = "ui://widget/chart.html";
const CHART_WIDGET_MIME = "text/html;profile=mcp-app"; // current MCP Apps UI MIME

// Root element + the bundle loaded directly from the embed origin (a script,
// not an iframe). `version` is a cache-buster so a release loads fresh JS.
const chartWidgetHtml = (version: string) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0e0e14}#caelus-chart-root{position:fixed;inset:0;display:grid;place-items:center;overflow:hidden}</style>
<div id="caelus-chart-root"></div>
<script src="${EMBED_ORIGIN}/embed/chart-widget.js?v=${encodeURIComponent(version)}"></script>`;
```

Register it inside `buildServer()` alongside the other resources. The CSP needs
only `resourceDomains` (to load the script); the legacy `openai/widgetCSP`
mirror keeps older ChatGPT happy:

```ts
server.registerResource(
  "chart-widget",
  CHART_WIDGET_URI,
  {
    title: "Chart wheel",
    description: "Renders the natal_chart / current_sky payload as a caelus-wheel chart.",
    mimeType: CHART_WIDGET_MIME,
    _meta: {
      ui: { csp: { connectDomains: [], resourceDomains: [EMBED_ORIGIN] } },
      "openai/widgetCSP": { connect_domains: [], resource_domains: [EMBED_ORIGIN] },
    },
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: CHART_WIDGET_MIME, text: chartWidgetHtml(version) }],
  }),
);
```

## 2. Attach to the two chart tools

On `registerTool("natal_chart", …)` and `registerTool("current_sky", …)`, add
the UI-resource reference to the **config** object and return `structuredContent`
from the handler. The binding constant:

```ts
const CHART_TOOL_META = {
  ui: { resourceUri: CHART_WIDGET_URI },
  "openai/outputTemplate": CHART_WIDGET_URI, // ChatGPT compatibility alias
};
const chartResult = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  structuredContent: payload as Record<string, unknown>,
});
```

Minimal diff for `natal_chart` (mirror for `current_sky`):

```ts
server.registerTool("natal_chart", {
  description: "…unchanged…",
  inputSchema: { ...birth, house_system: houseSys, zodiac: zodiacSchema },
  _meta: CHART_TOOL_META,                                                 // <- add
}, async ({ date, lat, lon, house_system, zodiac }) =>
  chartResult(chartPayload(engine, date, lat, lon, house_system, zodiac))); // <- structuredContent
```

`current_sky` is the same change with its existing handler/defaults. No other
tool changes; the payloads, schemas, golden fixtures, and `verify_tools` /
`integration` suites stay valid (the added `structuredContent` is the same
object already serialized into `content`, and `_meta` is additive).

## Notes

- **CSP / no iframe.** The bundle runs as a script in the host's own sandbox, so
  the resource declares only `resourceDomains: [EMBED_ORIGIN]` — never
  `frameDomains`. The script is a classic (non-module) IIFE, so the cross-origin
  load needs no CORS.
- **Cross-host (MCP-UI).** `window.openai` is the Apps-SDK compatibility layer
  that standard hosts also expose, and the bundle additionally listens for the
  MCP Apps `ui/notifications/tool-result` message, so the same bundle works
  across hosts; only the data-injection path differs.
- **Cache-busting.** The shell appends `?v=<version>` to the bundle URL; the
  lockstep package version changes the URL on every release. The resource URI
  itself stays `ui://widget/chart.html`.
- **Hosted mount.** Set `CAELUS_EMBED_ORIGIN` on the `apps/web/api/mcp` mount (or
  the stdio env) to load the bundle from a non-default origin (e.g. a preview
  deploy).
- **Smoke / tests.** `integration.test.mjs` asserts `resources/list` includes
  `ui://widget/chart.html`, its MIME, that the shell loads the bundle with no
  iframe, and that both chart tools return `structuredContent`. `smoke-web.mjs`
  asserts `/embed/chart-widget.js` and `/embed/chart` both return 200.
