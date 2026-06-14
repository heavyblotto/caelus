import { ImageResponse } from "next/og";
import { SITE } from "../lib/site";

export const alt = "Caelus · MIT astrological ephemeris engine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0c0a14",
          padding: "72px",
          color: "#e8e4f0",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="13" fill="none" stroke="#8a7fd4" strokeWidth="1.5" opacity="0.6" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#8b849e" strokeWidth="1" opacity="0.4" />
            <circle cx="16" cy="16" r="3.2" fill="#f0a878" />
            <circle cx="29" cy="16" r="2.4" fill="#8a7fd4" />
            <circle cx="10.4" cy="9.2" r="1.5" fill="#e8e4f0" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2 }}>Caelus</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
            MIT astrological ephemeris engine
          </div>
          <div style={{ fontSize: 30, color: "#9a93b0", maxWidth: 900 }}>
            Charts, houses, aspects, and events in TypeScript. Browser, edge, Node, MCP.
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#8a7fd4" }}>
          <span>npm install caelus</span>
          <span style={{ color: "#6f6885" }}>·</span>
          <span>{SITE.url.replace("https://", "")}</span>
          <span style={{ color: "#6f6885" }}>·</span>
          <span>v{SITE.version}</span>
        </div>
      </div>
    ),
    size,
  );
}
