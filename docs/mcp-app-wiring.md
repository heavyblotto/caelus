# MCP-server wiring for the chat app

> **Status: implemented in `caelus-mcp` 0.14.0.** The architecture below is
> as-built; the metadata key names were reconciled against the current OpenAI
> Apps SDK / MCP Apps docs before merging (the draft used the now-legacy
> `text/html+skybridge` MIME and `openai/widgetCSP` keys). As shipped, the
> resource uses the current `text/html;profile=mcp-app` MIME and `_meta.ui.*`
> keys, and sets the legacy `openai/*` aliases alongside them for ChatGPT
> compatibility. The code snippets in this doc have been updated to match.

Goal: make the `natal_chart` and `current_sky` tools **render the chart wheel
in-host** (ChatGPT and other Apps-SDK / MCP-UI hosts), using the already-shipped
UI surface at `apps/web/app/embed/chart` (`/embed/chart`). This is the
server-side half; the UI surface is independent of it (see `docs/mcp-app.md`).

This lives in the MCP layer (`packages/caelus-mcp/src/server.ts`, served by both
the stdio server and the hosted `apps/web/app/api/mcp` mount). It does not change
the engine, the tool inputs/outputs, or any existing payload — it only **adds** a
UI resource and a UI-resource reference on two tools.

## Approach

1. Register a tiny **widget resource** (`ui://widget/chart.html`) whose HTML
   loads the hosted `/embed/chart` route in an iframe, forwarding the tool
   output to it as the `?c=<base64 chart JSON>` parameter that the embed already
   decodes. No change to the embed.
2. On `natal_chart` and `current_sky`, set `_meta.ui.resourceUri` (plus the
   `openai/outputTemplate` compatibility alias) to that resource and return the
   chart payload as `structuredContent` (so the host hands it to the widget via
   the MCP Apps `ui/notifications/tool-result` message, or ChatGPT's
   `window.openai.toolOutput`). The existing `text` content stays, so non-UI
   clients are unaffected.

## 1. The widget resource

Add near the top of `server.ts` (the base URL should come from an env var on the
hosted mount; default to the production origin):

```ts
const EMBED_ORIGIN = process.env.CAELUS_EMBED_ORIGIN ?? "https://www.ephemengine.com";
const CHART_WIDGET_URI = "ui://widget/chart.html";
const CHART_WIDGET_MIME = "text/html;profile=mcp-app"; // current MCP Apps UI MIME

// A minimal shell that loads the hosted /embed/chart route in an iframe and
// feeds it the tool output via the ?c= param the embed already decodes — both
// the MCP Apps standard (tool-result postMessage) and the ChatGPT window.openai
// compatibility layer.
const CHART_WIDGET_HTML = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0e0e14}iframe{display:block;border:0;width:100%;height:100%}</style>
<iframe id="c"></iframe>
<script>
  var f = document.getElementById("c");
  function render(o) {
    f.src = "${EMBED_ORIGIN}/embed/chart" + (o ? "?c=" + encodeURIComponent(btoa(JSON.stringify(o))) : "");
  }
  window.addEventListener("message", function (e) {
    var m = e && e.data;
    if (m && m.jsonrpc === "2.0" && m.method === "ui/notifications/tool-result") render(m.params && m.params.structuredContent);
  });
  function fromHost() { return (window.openai && window.openai.toolOutput) || null; }
  render(fromHost());
  window.addEventListener("openai:set_globals", function () { render(fromHost()); });
</script>`;
```

Register it inside `buildServer()` alongside the other resources. `frameDomains`
is required for the iframe to load; the legacy `openai/widgetCSP` mirror keeps
older ChatGPT happy:

```ts
server.registerResource(
  "chart-widget",
  CHART_WIDGET_URI,
  {
    title: "Chart wheel",
    description: "Renders the natal_chart / current_sky payload as a caelus-wheel chart.",
    mimeType: CHART_WIDGET_MIME,
    _meta: {
      ui: { csp: { connectDomains: [], resourceDomains: [EMBED_ORIGIN], frameDomains: [EMBED_ORIGIN] } },
      "openai/widgetCSP": { connect_domains: [], resource_domains: [EMBED_ORIGIN] },
    },
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: CHART_WIDGET_MIME, text: CHART_WIDGET_HTML }],
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

- **Cross-host (MCP-UI):** for hosts on the MCP-UI standard rather than the
  OpenAI Apps SDK, expose the same UI as an `externalUrl` resource pointing at
  `${EMBED_ORIGIN}/embed/chart` (via `@mcp-ui/server`'s `createUIResource`).
  The embed reads `window.openai.toolOutput` when present and the `?c=` param
  otherwise, so it works either way; only the data-injection differs per host.
- **No embed change needed.** `/embed/chart` already supports both the
  `window.openai.toolOutput` path (if a host loads it directly as the widget)
  and the `?c=` param (used by the shell above).
- **Hosted mount:** set `CAELUS_EMBED_ORIGIN` on the `apps/web/api/mcp` mount if
  the embed should be loaded from a non-default origin (e.g. a preview deploy).
- **Smoke:** extend the live-smoke to assert `resources/list` includes
  `ui://widget/chart.html` and that `/embed/chart` returns 200.
