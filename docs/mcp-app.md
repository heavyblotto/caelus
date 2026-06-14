# Chat MCP App (Apps SDK / MCP-UI)

The caelus chat app renders a **correct chart wheel inside the chat host**
(ChatGPT, Claude, and other MCP-Apps hosts), interpretation-free, built once on
the MCP App standard and reusing the hosted MCP server. This is *distribution*,
not a new engine capability: the wedge is "astrology in the chat where the math
is actually correct and rendered," since generic LLMs hallucinate chart
positions.

## Two pieces, two owners

The app is the existing MCP server plus a UI component, wired by a tool-result
reference:

1. **UI surface (this repo, `apps/web/app/embed/chart`).** A self-contained,
   chrome-free route that renders `caelus-wheel`'s `ChartWheel` from a
   `natal_chart` / `current_sky` payload. It reads the payload from the
   Apps-SDK host (`window.openai.toolOutput`) and falls back to a
   `?c=<base64 chart JSON>` query parameter for standalone use and testing.
   `ChartWheel` accepts the MCP payload as-is, so no adapter is needed.

2. **Server wiring (`caelus-mcp` / the hosted `/api/mcp` mount).** To make a
   tool render the wheel, the tool result attaches a UI-resource reference
   pointing at the embed route — the OpenAI Apps SDK `_meta` output template, or
   an MCP-UI `ui://` resource. This lives in the MCP server's tool definitions
   and is owned alongside the rest of that layer; the UI surface above is
   deliberately independent of it so the two can move in parallel.

## Data flow

```
host (ChatGPT/Claude) --tools/call--> caelus-mcp (hosted /api/mcp)
        |                                   |
        |<-- result + UI-resource ref ------|   (natal_chart payload + embed ref)
        v
  iframe loads /embed/chart, reads window.openai.toolOutput, renders ChartWheel
```

## Privacy posture (distinct from the web flagship)

Inside a chat host, birth data passes through the host (OpenAI/Anthropic) by
definition, so the chat app is the **reach** channel and sits in the
server-readable, disclosed tier — do not claim the zero-transmission story here.
The **client-side, zero-knowledge** privacy product is the separate web
experience. Same engine and corpus, different posture; keep them distinct.

## Status

- UI surface: shipped (`/embed/chart`), builds static, renders the MCP payload.
- Server-side UI-resource wiring + Apps-SDK manifest / host registration:
  tracked, to land with the MCP layer.
