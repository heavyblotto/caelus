import Link from "next/link";
import { INSTRUMENTS } from "../../lib/instruments";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Instruments",
  description:
    "Interactive browser instruments built on Caelus. Enter inputs, run deterministic calculations locally, and copy the TypeScript, Python, or MCP API call behind every result.",
  path: "/instruments",
});

export default function InstrumentsPage() {
  return (
    <main>
      <div className="bench">
        <header className="head">
          <div>
            <span className="lab">
              <span className="led led--live" aria-hidden="true" />
              {INSTRUMENTS.length} live instruments · zero network I/O
            </span>
            <h1>Instruments</h1>
          </div>
          <div className="stack--sm">
            <p>
              Each Workbench instrument answers one focused astronomical or
              astrological question directly in your browser using the embedded
              ephemeris, with reproducible TypeScript, Python, MCP, and JSON
              output beside every result.
            </p>
            <div className="row row--wrap">
              <Link href="/playground" className="btn btn-primary btn-sm">
                Open Chart Playground &rarr;
              </Link>
              <Link href="/docs/recipes" className="btn btn-secondary btn-sm">
                API Recipes
              </Link>
            </div>
          </div>
        </header>

        {INSTRUMENTS.map((inst) => {
          const featured = inst.id === "I-05";
          return (
            <article
              key={inst.id}
              className={`tile ${featured ? "s12 tile--live inst-card--featured" : "s6"} inst-card`}
            >
              <div className="tile__h">
                <b>{inst.id}</b>
                <span>{inst.category}</span>
                <i>
                  <span className="led led--live" aria-hidden="true" />
                  {inst.status}
                </i>
              </div>
              <div className="tile__b stack">
                <div className="stack">
                  <div className="stack--sm">
                    <div className="row row--between row--wrap">
                      <h3>
                        <Link href={inst.href}>{inst.title}</Link>
                      </h3>
                      <span className="badge badge--muted mono">{inst.spanNote}</span>
                    </div>
                    <p>{inst.line}</p>
                  </div>

                  <div className="inst-meta">
                    <div className="row row--wrap">
                      {inst.apiCalls.map((fn) => (
                        <span key={fn} className="badge badge--accent mono">{fn}</span>
                      ))}
                      <span className="badge badge--muted mono">mcp:{inst.mcpTool}</span>
                    </div>
                  </div>
                </div>

                <div className="stack--sm">
                  <span className="field__label">Quick launch presets</span>
                  <div className="preset-bar inst-presets">
                    {inst.presets.map((p) => (
                      <Link
                        key={p.id}
                        href={`${inst.href}?preset=${encodeURIComponent(p.id)}`}
                        className="chip preset-chip"
                      >
                        {p.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="tile__f row row--between">
                <span className="dim small mono">
                  {featured ? "Zero-upload client-side verification" : "Runs locally in browser"}
                </span>
                <Link href={inst.href} className="btn btn-secondary btn-sm">
                  Open {inst.title} &rarr;
                </Link>
              </div>
            </article>
          );
        })}

        <div className="band">
          <span className="band__kicker">NEXT</span>
          <h2>Full interactive bench</h2>
          <p>
            Need a natal wheel, paired 3D sphere, transits, synastry, Vedic dashas, or custom constraints?
          </p>
          <div className="band__meta">
            <Link href="/playground" className="btn btn-primary btn-sm">
              Launch Playground &rarr;
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
