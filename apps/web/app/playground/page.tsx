import Link from "next/link";
import { SkyNow, PlaygroundExamples } from "../../components/PlaygroundPanels";
import PageClose from "../../components/PageClose";
import PlaygroundStickyBar from "../../components/PlaygroundStickyBar";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Playground",
  description:
    "Calculate a natal chart, transits, 3D celestial sphere, cited delineations, Vedic kundli, timing periods, and astrocartography maps directly in your browser.",
  path: "/playground",
});

export default function Playground() {
  return (
    <main className="page--sticky-cta">
      <div className="bench">
        <header className="head head--compact">
          <div>
            <span className="lab"><span className="led led--live" aria-hidden="true" />Playground · zero network I/O</span>
            <h1>Chart bench</h1>
          </div>
          <div className="row row--between row--wrap">
            <p>
              Compute natal charts, paired 3D spheres, transits, cited readings,
              Vedic dashas, and sky frames locally in your browser, with exact
              TypeScript, Python, and MCP calls beside every view.
            </p>
            <div className="row">
              <Link href="/instruments" className="btn btn-secondary btn-sm">
                4 Instruments &rarr;
              </Link>
            </div>
          </div>
        </header>
      </div>

      <SkyNow />

      <div className="bench">
        <div className="band">
          <span className="band__kicker">EX</span>
          <h2>Example charts</h2>
          <p>
            Open any chart directly in the bench above via its URL fragment. Nothing is sent to a server.
          </p>
        </div>
      </div>

      <PlaygroundExamples />

      <div className="bench">
        <div className="tile s12">
          <div className="tile__b">
            <PageClose title="Ship it in your app" secondaryHref="/instruments" secondaryLabel="Explore instruments" />
          </div>
        </div>
      </div>

      <PlaygroundStickyBar />
    </main>
  );
}
