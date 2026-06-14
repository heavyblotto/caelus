# MCP-server wiring for the chat app — draft for the MCP layer

Goal: make the `natal_chart` and `current_sky` tools **render the chart wheel
in-host** (ChatGPT and other Apps-SDK / MCP-UI hosts), using the already-shipped
UI surface at `apps/web/app/embed/chart` (`/embed/chart`). This is the
server-side half; the UI surface is independent of it (see `docs/mcp-app.md`).

This draft is for the MCP layer (`packages/caelus-mcp/src/server.ts` and the
hosted `apps/web/app/api/mcp` mount). It does not change the engine, the tool
inputs/outputs, or any existing payload — it only **adds** a UI resource and an
output-template reference on two tools. Confirm the exact Apps-SDK metadata keys
against the current OpenAI Apps SDK docs before merging; the surrounding pattern
is stable, the key names are the part most likely to drift.

## Approach

1. Register a tiny **widget resource** (`ui://widget/chart.html`) whose HTML
   loads the hosted `/embed/chart` route in an iframe, forwarding the tool
   output to it as the `?c=<base64 chart JSON>` parameter that the embed already
   decodes. No nested-iframe data bridge, no change to the embed.
2. On `natal_chart` and `current_sky`, set `_meta["openai/outputTemplate"]` to
   that resource and return the chart payload as `structuredContent` (so the
   host injects it as `window.openai.toolOutput`). The existing `text` content
   stays, so non-UI clients are unaffected.

## 1. The widget resource

Add near the top of `server.ts` (the base URL should come from an env var on the
hosted mount; default to the production origin):

```ts
const EMBED_ORIGIN = process.env.CAELUS_EMBED_ORIGIN ?? "https://www.ephemengine.com";

// Apps-SDK widget: a minimal shell that loads the hosted /embed/chart route and
// passes the tool output to it via the ?c= param the embed already decodes.
const CHART_WIDGET_HTML = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0e0e14}iframe{display:block;border:0;width:100%;height:100%}</style>
<iframe id="c"></iframe>
<script>
  var f = document.getElementById("c");
  function render() {
    var o = window.openai && window.openai.toolOutput;
    f.src = "${EMBED_ORIGIN}/embed/chart" + (o ? "?c=" + encodeURIComponent(btoa(JSON.stringify(o))) : "");
  }
  render();
  window.addEventListener("openai:set_globals", render);
</script>`;
```

Register it inside `buildServer()` alongside the other resources:

```ts
server.registerResource(
  "chart-widget",
  "ui://widget/chart.html",
  {
    title: "Chart wheel",
    description: "Renders the natal_chart / current_sky payload as a caelus-wheel chart.",
    mimeType: "text/html+skybridge",
    // Allow the widget iframe to load the embed origin.
    _meta: { "openai/widgetCSP": { connect_domains: [], resource_domains: [EMBED_ORIGIN] } },
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/html+skybridge", text: CHART_WIDGET_HTML }],
  }),
);
```

## 2. Attach to the two chart tools

On `registerTool("natal_chart", …)` and `registerTool("current_sky", …)`, add
the `_meta` output template to the **config** object and return
`structuredContent` from the handler. Minimal diff for `natal_chart` (mirror for
`current_sky`):

```ts
server.registerTool("natal_chart", {
  description: "…unchanged…",
  inputSchema: { ...birth, house_system: houseSys, zodiac: zodiacSchema },
  _meta: { "openai/outputTemplate": "ui://widget/chart.html" },          // <- add
}, async ({ date, lat, lon, house_system, zodiac }) => {
  const payload = chartPayload(engine, date, lat, lon, house_system, zodiac);
  return { content: [{ type: "text", text: JSON.stringify(payload) }],   // <- unchanged shape
           structuredContent: payload };                                  // <- add
});
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
