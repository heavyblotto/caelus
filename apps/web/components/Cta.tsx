"use client";

import { useState } from "react";
import Link from "next/link";
import InstallButton from "./InstallButton";
import { MCP_TOOL_COUNT, SITE } from "../lib/site";

type InstallRuntime = "npm" | "python" | "mcp";

const INSTALL_OPTIONS: Array<{
  id: InstallRuntime;
  label: string;
  cmd: string;
  note: string;
}> = [
  {
    id: "npm",
    label: "npm",
    cmd: "npm install caelus",
    note: "TypeScript · browser, edge, Node.js",
  },
  {
    id: "python",
    label: "python",
    cmd: "pip install caelus-engine",
    note: "Python stdlib only · reference engine",
  },
  {
    id: "mcp",
    label: "mcp",
    cmd: "claude mcp add caelus -- npx caelus-mcp",
    note: `${MCP_TOOL_COUNT} tools · Claude, Cursor, stdio`,
  },
];

type CtaProps = {
  /** Hero shows install tabs and tertiary links; compact is install + quickstart only. */
  variant?: "hero" | "compact";
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Override whether the multi-runtime install switcher renders. */
  installTabs?: boolean;
};

function CtaLinks() {
  return (
    <p className="cta__links">
      <Link href="/docs">Docs</Link>
      <span className="cta__sep" aria-hidden>
        ·
      </span>
      <Link href="/features">Features</Link>
      <span className="cta__sep" aria-hidden>
        ·
      </span>
      <Link href="/validation">Validation</Link>
      <span className="cta__sep" aria-hidden>
        ·
      </span>
      <Link href="/docs/mcp">MCP tools ({MCP_TOOL_COUNT})</Link>
      <span className="cta__sep" aria-hidden>
        ·
      </span>
      <a href={SITE.starter} target="_blank" rel="noreferrer">
        Starter<span className="cta__external" aria-hidden> ↗</span>
      </a>
    </p>
  );
}

function InstallTabs() {
  const [active, setActive] = useState<InstallRuntime>("npm");
  const [copiedId, setCopiedId] = useState<InstallRuntime | null>(null);
  const current = INSTALL_OPTIONS.find((o) => o.id === active) ?? INSTALL_OPTIONS[0];

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(current.cmd);
      setCopiedId(current.id);
      setTimeout(() => setCopiedId((prev) => (prev === current.id ? null : prev)), 1600);
    } catch {
      // Clipboard may be unavailable in restricted contexts.
    }
  };

  return (
    <div className="install-tabs">
      <div className="tabs__list" role="tablist" aria-label="Install Caelus by runtime">
        {INSTALL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={opt.id === current.id}
            onClick={() => setActive(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="install-cmd" role="tabpanel" aria-label={`${current.label} install command`}>
        <code className="mono">$ {current.cmd}</code>
        <button
          type="button"
          className="btn btn-sm btn-ghost mono"
          onClick={copyCommand}
          aria-live="polite"
        >
          {copiedId === current.id ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div className="lab">{current.note}</div>
    </div>
  );
}

export default function Cta({
  variant = "hero",
  secondaryHref = "/docs/quickstart",
  secondaryLabel = "Quickstart →",
  installTabs,
}: CtaProps) {
  const showTabs = installTabs ?? variant === "hero";

  return (
    <div className="cta">
      {showTabs ? (
        <>
          <InstallTabs />
          <div className="cta__actions">
            <Link href="/playground" className="btn btn-primary">
              Open Playground
            </Link>
            <Link href={secondaryHref} className="btn btn-secondary">
              {secondaryLabel}
            </Link>
          </div>
        </>
      ) : (
        <div className="cta__actions">
          <InstallButton />
          <Link href={secondaryHref} className="btn btn-secondary">
            {secondaryLabel}
          </Link>
        </div>
      )}
      {variant === "hero" ? <CtaLinks /> : null}
    </div>
  );
}
