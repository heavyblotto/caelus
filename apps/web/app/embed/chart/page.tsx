"use client";

/**
 * In-host chart renderer for the caelus chat MCP App (OpenAI Apps SDK / MCP-UI).
 *
 * The MCP server (caelus-mcp) returns a natal_chart / current_sky payload; an
 * Apps-SDK host (ChatGPT, Claude, ...) loads this route in a sandboxed iframe
 * and hands it that payload via `window.openai.toolOutput`. The component is
 * interpretation-free: it renders only the chart wheel from caelus-wheel, which
 * accepts the MCP payload as-is. A `?c=<base64 chart JSON>` query parameter is a
 * standalone/testing fallback when no host is present.
 *
 * Rendered as a fixed full-viewport overlay so the site header/footer never show
 * inside the embed iframe.
 */
import { useEffect, useState } from "react";
import { ChartWheel, DARK_THEME } from "caelus-wheel";

declare global {
  interface Window {
    // Injected by the Apps-SDK host; toolOutput is the MCP tool's structured result.
    openai?: { toolOutput?: unknown };
  }
}

type WheelChart = Parameters<typeof ChartWheel>[0]["chart"];

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

export default function EmbedChart() {
  const [chart, setChart] = useState<WheelChart | null>(null);
  const [size, setSize] = useState(420);

  useEffect(() => {
    const fromHost = window.openai?.toolOutput;
    setChart(isChart(fromHost) ? fromHost : fromQuery());

    const fit = () => setSize(Math.max(240, Math.min(window.innerWidth, window.innerHeight) - 16));
    fit();
    window.addEventListener("resize", fit);

    // Apps-SDK hosts dispatch a global event when the tool output changes.
    const onUpdate = () => { if (isChart(window.openai?.toolOutput)) setChart(window.openai!.toolOutput as WheelChart); };
    window.addEventListener("openai:set_globals", onUpdate);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("openai:set_globals", onUpdate);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "#0e0e14",
        display: "grid", placeItems: "center", overflow: "hidden",
        color: "#8d8a99", fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      }}
    >
      {chart
        ? <ChartWheel chart={chart} size={size} theme={DARK_THEME} />
        : <div style={{ fontSize: 13, opacity: 0.7, padding: 24, textAlign: "center" }}>
            Compute a chart with the caelus MCP tools to render it here.
          </div>}
    </div>
  );
}
