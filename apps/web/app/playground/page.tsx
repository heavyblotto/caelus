import { SkyNow, PlaygroundExamples } from "../../components/PlaygroundPanels";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import PlaygroundStickyBar from "../../components/PlaygroundStickyBar";
import { Lead, P, H2 } from "../../components/Prose";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Playground",
  description:
    "Cast a natal chart: wheel, transits, a cited corpus reading, Vedic kundli, timing, and maps. Enter a place and a date.",
  path: "/playground",
});

export default function Playground() {
  return (
    <main className="container-workspace page page--sticky-cta">
      <PageHero eyebrow="Playground" title="Cast a chart">
        <Lead>
          Search a place, enter a date, and read the wheel. Transits, a cited
          corpus reading, and the rest of the chart follow.
        </Lead>
      </PageHero>

      <SkyNow />

      <H2>Example charts</H2>
      <P>
        Click one to load it. The last has no birth time.
      </P>
      <PlaygroundExamples />

      <PageClose title="Ship it in your app" />
      <PlaygroundStickyBar />
    </main>
  );
}
