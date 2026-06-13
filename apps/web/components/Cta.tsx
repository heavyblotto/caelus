"use client";

import { useState } from "react";

const button: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: "0.9em",
  padding: "0.55rem 1.1rem",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};
const primary: React.CSSProperties = {
  ...button,
  background: "#8a7fd4",
  color: "#0c0a14",
  border: "1px solid #8a7fd4",
  fontWeight: 600,
};
const secondary: React.CSSProperties = {
  ...button,
  background: "transparent",
  color: "#e8e4f0",
  border: "1px solid #3a3450",
};

export default function Cta() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText("npm install caelus");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ margin: "1.4rem 0 1.6rem", display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" style={primary} onClick={copy}>
        {copied ? "copied ✓" : "npm install caelus"}
      </button>
      <a href="#mcp" style={secondary}>Add to Claude / Cursor</a>
      <a href="https://github.com/heavyblotto/caelus" style={secondary}>GitHub</a>
    </div>
  );
}
