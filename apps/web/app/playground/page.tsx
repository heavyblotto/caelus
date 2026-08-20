import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartWheel } from "caelus-wheel";
import { SkyNow, SynastryPanel } from "../../components/PlaygroundPanels";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import PlaygroundStickyBar from "../../components/PlaygroundStickyBar";
import { WHEEL_THEME } from "../../lib/wheelTheme";
import { b64urlEncode, type Share } from "../../lib/share";
import { A, Lead, P, H2 } from "../../components/Prose";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Playground",
  description:
    "Compute and interpret a chart in the browser: ranked citable fact atoms (natal, transits, time-lords), a cited reading from the Caelus corpus, synastry/composite compare, plus positions, aspects, fixed stars, and lots. All client-side.",
  path: "/playground",
});

const engine = new Engine(embeddedData);

// Charts curated for a striking reading. Each carries the share payload (a UT
// instant + place) so a click loads it into the builder above; the wheel is a
// preview computed here.
const EXAMPLES: Array<{ caption: string; args: Parameters<Engine["chart"]>; share: Share }> = [
  {
    caption: "Four Royal Stars lit at once: the Sun and Mercury on Regulus, the Moon on Algol, Pluto on Antares.",
    args: [2000, 8, 22, 12, 0, 0, 51.5, -0.12, "placidus"],
    share: { v: 1, t: "2000-08-22T12:00", la: "51.5", lo: "-0.12", h: "placidus", z: "tropical", n: "Royal stars" },
  },
  {
    caption: "Jupiter conjunct Sirius, the brightest star; the engine's canonical test fixture.",
    args: [1990, 6, 10, 18, 30, 0, 27.95, -82.46, "placidus"],
    share: { v: 1, t: "1990-06-10T18:30", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical", n: "Jupiter on Sirius" },
  },
  {
    caption: "A five-body Aquarius stellium, with Uranus on Regulus.",
    args: [1962, 2, 5, 0, 0, 0, 27.95, -82.46, "placidus"],
    share: { v: 1, t: "1962-02-05T00:00", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical", n: "Aquarius stellium" },
  },
  {
    caption: "The day Star Wars opened: the Moon on Regulus, the lunar node on Spica.",
    args: [1977, 5, 25, 19, 0, 0, 34.05, -118.24, "placidus"],
    share: { v: 1, t: "1977-05-25T19:00", la: "34.05", lo: "-118.24", h: "placidus", z: "tropical", n: "1977-05-25" },
  },
];

export default function Playground() {
  return (
    <main className="container-wide page page--sticky-cta">
      <PageHero eyebrow="Playground" title="Compute and interpret a chart in your browser">
        <Lead>
          Everything on this page is computed here, in your browser, by the{" "}
          <code>caelus</code> engine and its embedded dataset. Nothing is sent
          to a server.
        </Lead>
        <P dim>
          Search a birthplace and enter the local time; the chart&rsquo;s
          positions, aspects, facts, and a cited reading from the Caelus
          corpus follow, with every statement traceable to a fact the engine
          computed.
        </P>
      </PageHero>

      <SkyNow />
      <P dim>
        The playground runs the same build that ships to npm. Its worst
        recorded deviation from the reference ephemeris is tabulated per body
        on <A href="/validation">Validation</A>.
      </P>

      <H2>Compare two charts</H2>
      <P>
        Synastry and the composite, both computed in your browser: two births in,
        the inter-chart aspect grid and the midpoint chart out. Birth times are
        local to each place (resolved to UT with <code>caelus-birth</code>).
      </P>
      <SynastryPanel />

      <H2>Charts worth reading</H2>
      <P>
        Four charts chosen for a striking reading. Click one to load it into
        the builder above and read it in full.
      </P>
      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        {EXAMPLES.map((ex) => (
          <a
            key={ex.caption}
            href={`/playground#c=${b64urlEncode(ex.share)}`}
            className="card card-interactive example-card"
          >
            <div className="example-card__wheel chart-fluid">
              <ChartWheel chart={engine.chart(...ex.args)} size={240} theme={WHEEL_THEME} />
            </div>
            <div className="example-card__text">
              {ex.caption}{" "}
              <span className="example-card__cta">Read this chart &rarr;</span>
            </div>
          </a>
        ))}
      </div>

      <PageClose title="Ship it in your app" />
      <PlaygroundStickyBar />
    </main>
  );
}
