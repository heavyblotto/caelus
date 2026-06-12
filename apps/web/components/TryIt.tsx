"use client";

import { useEffect, useState } from "react";

const PATH = "/api/chart?lat=27.94&lon=-82.46";

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.8rem",
  flexWrap: "wrap",
};
const code: React.CSSProperties = {
  background: "#1a1626",
  padding: "0.25rem 0.6rem",
  borderRadius: 4,
  fontSize: "0.85em",
  color: "inherit",
};
const dim: React.CSSProperties = { opacity: 0.45, fontSize: "0.8em" };

export default function TryIt() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", margin: "1.4rem 0 1.6rem" }}>
      <div style={row}>
        <a href={PATH} style={{ textDecoration: "none", color: "inherit" }}>
          <code style={code}>
            curl &quot;{origin}{PATH}&quot;
          </code>
        </a>
        <span style={dim}>try it in ten seconds (demo endpoint)</span>
      </div>
      <div style={row}>
        <a
          href="https://www.npmjs.com/package/caelus"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <code style={code}>npm install caelus</code>
        </a>
        <span style={dim}>own it in thirty</span>
      </div>
    </div>
  );
}
