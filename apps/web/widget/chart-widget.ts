/**
 * Standalone in-host chart widget for the caelus chat MCP App.
 *
 * Bundled by `scripts/build-chart-widget.mjs` (esbuild, IIFE) to
 * `apps/web/public/embed/chart-widget.js`, and loaded *directly* (no iframe) by
 * the caelus-mcp `ui://widget/chart.html` resource inside an MCP Apps / Apps-SDK
 * host (ChatGPT and others). It renders only the chart wheel from caelus-wheel,
 * interpretation-free; it is the no-iframe counterpart to the /embed/chart route
 * (which stays as a standalone/browser fallback).
 *
 * Data arrives three ways, in priority order:
 *   1. MCP Apps standard: a `ui/notifications/tool-result` postMessage whose
 *      params carry the tool's `structuredContent`.
 *   2. ChatGPT compatibility: `window.openai.toolOutput`, refreshed on the
 *      `openai:set_globals` event.
 *   3. `?c=<base64 chart JSON>` query param (standalone/testing).
 *
 * This file is bundled separately by esbuild and is intentionally outside the
 * Next graph (see apps/web/tsconfig.json `exclude`).
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChartWheel, DARK_THEME, type WheelChart } from "caelus-wheel";

declare global {
  interface Window {
    openai?: { toolOutput?: unknown };
  }
}

const isChart = (v: unknown): v is WheelChart =>
  !!v && typeof v === "object" && "bodies" in (v as Record<string, unknown>);

function fromQuery(): WheelChart | null {
  try {
    const c = new URLSearchParams(window.location.search).get("c");
    if (!c) return null;
    const parsed = JSON.parse(atob(c.replace(/ /g, "+")));
    return isChart(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function wheelSize(): number {
  return Math.max(240, Math.min(window.innerWidth, window.innerHeight) - 16);
}

const PLACEHOLDER = createElement(
  "div",
  {
    style: {
      fontSize: 13,
      opacity: 0.7,
      padding: 24,
      textAlign: "center" as const,
      color: "#8d8a99",
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    },
  },
  "Compute a chart with the caelus MCP tools to render it here.",
);

let root: Root | null = null;
let chart: WheelChart | null = null;

function mount(): Root {
  if (root) return root;
  let el = document.getElementById("caelus-chart-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "caelus-chart-root";
    document.body.appendChild(el);
  }
  // Full-viewport dark canvas so the wheel centers and the host chrome never
  // bleeds through; mirrors the /embed/chart overlay.
  document.documentElement.style.background = "#0e0e14";
  document.body.style.margin = "0";
  el.style.cssText =
    "position:fixed;inset:0;display:grid;place-items:center;overflow:hidden;background:#0e0e14";
  root = createRoot(el);
  return root;
}

function paint(): void {
  const r = mount();
  r.render(
    chart
      ? createElement(ChartWheel, { chart, size: wheelSize(), theme: DARK_THEME })
      : PLACEHOLDER,
  );
}

function setChart(v: unknown): void {
  if (isChart(v)) {
    chart = v;
    paint();
  }
}

chart = isChart(window.openai?.toolOutput)
  ? (window.openai!.toolOutput as WheelChart)
  : fromQuery();
paint();

window.addEventListener("resize", paint);
window.addEventListener("openai:set_globals", () => setChart(window.openai?.toolOutput));
window.addEventListener("message", (e: MessageEvent) => {
  const m = e.data as { jsonrpc?: string; method?: string; params?: { structuredContent?: unknown } } | null;
  if (m && m.jsonrpc === "2.0" && m.method === "ui/notifications/tool-result") {
    setChart(m.params?.structuredContent);
  }
});
