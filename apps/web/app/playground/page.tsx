import { SkyNow, PlaygroundExamples } from "../../components/PlaygroundPanels";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import PlaygroundStickyBar from "../../components/PlaygroundStickyBar";
import { Lead, P, H2 } from "../../components/Prose";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Playground",
  description:
    "Calculate a natal chart, transits, cited delineations, Vedic kundli, timing periods, and astrocartography maps directly in your browser.",
  path: "/playground",
});

export default function Playground() {
  return (
    <main className="container page page--bench page--sticky-cta">
      <PageHero eyebrow="Playground" title="Cast a chart">
        <Lead>
          Search for a city, enter a date and time, and inspect the wheel,
          transits, cited delineations, Vedic charts, and maps directly in your
          browser.
        </Lead>
      </PageHero>

      <SkyNow />

      <H2>Example charts</H2>
      <P>
        Select an example below to load it into the playground (the last preset
        demonstrates an untimed chart).
      </P>
      <PlaygroundExamples />

      <PageClose title="Ship it in your app" />
      <PlaygroundStickyBar />
    </main>
  );
}
