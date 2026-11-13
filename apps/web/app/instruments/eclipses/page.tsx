import EclipsesIsland from "./EclipsesIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Eclipses",
  description:
    "List the solar and lunar eclipses in a span of years, see what one place sees of each, and draw the central path of a solar eclipse. Runs in your browser on the Caelus engine, with the calls that produced it.",
  path: "/instruments/eclipses",
});

export default function EclipsesPage() {
  return (
    <main>
      <EclipsesIsland />
    </main>
  );
}
