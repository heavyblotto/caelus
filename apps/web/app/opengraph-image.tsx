import { ImageResponse } from "next/og";
import { FACTS, formatGoldenChecks, formatWorstNano } from "../lib/facts";
import { SITE } from "../lib/site";

export const alt = "Caelus: deterministic ephemeris and astrology engine for TypeScript, Python, and MCP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEGREE_TICKS = Array.from({ length: 36 }, (_, i) => {
  const angle = (i * 10 * Math.PI) / 180;
  const major = i % 3 === 0;
  const r1 = major ? 150 : 158;
  const r2 = 166;
  return {
    x1: 180 + r1 * Math.cos(angle),
    y1: 180 + r1 * Math.sin(angle),
    x2: 180 + r2 * Math.cos(angle),
    y2: 180 + r2 * Math.sin(angle),
    major,
  };
});

export default function OpengraphImage() {
  const subtitle = `Sub-millisecond planetary positions, ${FACTS.houseSystems} house systems, eclipses, physical shadow verification, and ${FACTS.mcpTools} MCP tools verified against JPL Horizons and Swiss Ephemeris.`;
  const checksBadge = `${formatGoldenChecks()} CHECKS`;
  const versionText = `v${SITE.version}`;
  const hostText = SITE.url.replace("https://www.", "");

  const stats = [
    { label: "TS / PY DELTA", value: `${formatWorstNano()} nas` },
    { label: "CI GOLDEN SUITE", value: formatGoldenChecks() },
    { label: "MCP TOOLS", value: String(FACTS.mcpTools) },
    { label: "VALIDATED SPAN", value: "AD 1000-3000" },
    { label: "LICENSE", value: "MIT / 0 DEPS" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#08090b",
          color: "#e7e9ec",
          fontFamily: "monospace",
          border: "1px solid #272b33",
        }}
      >
        {/* Top workbench status bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 54,
            padding: "0 36px",
            background: "#0f1114",
            borderBottom: "1px solid #272b33",
            fontSize: 16,
            letterSpacing: "0.12em",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", width: 10, height: 10, background: "#f283b3" }} />
            <span style={{ fontWeight: 700, color: "#e7e9ec" }}>CAELUS</span>
            <span style={{ color: "#6d7480" }}>|</span>
            <span style={{ color: "#a0a7b1" }}>PRECISION EPHEMERIS WORKBENCH</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, color: "#a0a7b1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8fd694" }}>
              <div style={{ display: "flex", width: 8, height: 8, background: "#8fd694" }} />
              <span>{checksBadge}</span>
            </div>
            <span>{versionText}</span>
            <span>{hostText}</span>
          </div>
        </div>

        {/* Main 2-tile split */}
        <div
          style={{
            display: "flex",
            flex: 1,
            width: "100%",
          }}
        >
          {/* Left narrative tile */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 750,
              padding: "40px 44px",
              background: "#0f1114",
              borderRight: "1px solid #272b33",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 15,
                  letterSpacing: "0.14em",
                  color: "#a596ff",
                }}
              >
                <span>TYPESCRIPT</span>
                <span style={{ color: "#3d434e" }}>/</span>
                <span>PYTHON</span>
                <span style={{ color: "#3d434e" }}>/</span>
                <span>MCP</span>
                <span style={{ color: "#3d434e" }}>/</span>
                <span>OFFLINE</span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 54,
                  fontWeight: 700,
                  lineHeight: 1.06,
                  letterSpacing: "-0.02em",
                  color: "#e7e9ec",
                }}
              >
                <span>Deterministic ephemeris</span>
                <span>&amp; astrology engine.</span>
              </div>

              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: "#a0a7b1",
                  maxWidth: 640,
                }}
              >
                {subtitle}
              </div>
            </div>

            {/* Install command row */}
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 18px",
                  background: "#08090b",
                  border: "1px solid #3d434e",
                  fontSize: 18,
                  color: "#e7e9ec",
                }}
              >
                <span style={{ color: "#a596ff", marginRight: 10 }}>$</span>
                <span>npm install caelus</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 18px",
                  background: "#08090b",
                  border: "1px solid #272b33",
                  fontSize: 18,
                  color: "#a0a7b1",
                }}
              >
                <span>pip install caelus-engine</span>
              </div>
            </div>
          </div>

          {/* Right precision celestial reticle tile */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              background: "#08090b",
              padding: "24px",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                fontSize: 13,
                letterSpacing: "0.14em",
                color: "#a0a7b1",
                marginBottom: 8,
              }}
            >
              <span style={{ color: "#a596ff" }}>FIG 01</span>
              <span>ECLIPTIC / HORIZON</span>
            </div>

            <svg width="360" height="360" viewBox="0 0 360 360">
              {/* Concentric instrument rings */}
              <circle cx="180" cy="180" r="166" fill="#0f1114" stroke="#3d434e" strokeWidth="1.5" />
              <circle cx="180" cy="180" r="132" fill="none" stroke="#272b33" strokeWidth="1.2" />
              <circle cx="180" cy="180" r="88" fill="none" stroke="#272b33" strokeWidth="1" />
              <circle cx="180" cy="180" r="40" fill="none" stroke="#272b33" strokeWidth="1" />

              {/* Degree ticks */}
              {DEGREE_TICKS.map((t, idx) => (
                <line
                  key={idx}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={t.major ? "#a596ff" : "#3d434e"}
                  strokeWidth={t.major ? 1.5 : 1}
                />
              ))}

              {/* Horizon & meridian axes */}
              <line x1="14" y1="180" x2="346" y2="180" stroke="#a596ff" strokeWidth="1.4" opacity="0.85" />
              <line x1="180" y1="14" x2="180" y2="346" stroke="#3d434e" strokeWidth="1.2" />
              <line x1="63" y1="63" x2="297" y2="297" stroke="#272b33" strokeWidth="1" />
              <line x1="297" y1="63" x2="63" y2="297" stroke="#272b33" strokeWidth="1" />

              {/* Aspect chords */}
              <line x1="268" y1="112" x2="108" y2="246" stroke="#a596ff" strokeWidth="1.4" opacity="0.7" />
              <line x1="268" y1="112" x2="146" y2="96" stroke="#f283b3" strokeWidth="1.4" opacity="0.8" />
              <line x1="108" y1="246" x2="254" y2="238" stroke="#8fd694" strokeWidth="1.2" opacity="0.7" />

              {/* Planet nodes */}
              <circle cx="268" cy="112" r="7" fill="#f283b3" stroke="#08090b" strokeWidth="2" />
              <circle cx="146" cy="96" r="5.5" fill="#e7e9ec" stroke="#08090b" strokeWidth="1.5" />
              <circle cx="108" cy="246" r="5.5" fill="#a596ff" stroke="#08090b" strokeWidth="1.5" />
              <circle cx="254" cy="238" r="5" fill="#8fd694" stroke="#08090b" strokeWidth="1.5" />
              <circle cx="78" cy="148" r="4.5" fill="#a596ff" stroke="#08090b" strokeWidth="1.5" />

              {/* Center reticle */}
              <circle cx="180" cy="180" r="3" fill="#f283b3" />
            </svg>
          </div>
        </div>

        {/* Bottom Workbench proof strip */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 92,
            background: "#0f1114",
            borderTop: "1px solid #272b33",
          }}
        >
          {stats.map((s, idx) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                padding: "0 24px",
                borderRight: idx < stats.length - 1 ? "1px solid #272b33" : "none",
              }}
            >
              <span style={{ fontSize: 12, letterSpacing: "0.14em", color: "#a0a7b1" }}>
                {s.label}
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#e7e9ec", marginTop: 4 }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
