import ChartStabilityIsland from "./ChartStabilityIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Uncertain Time",
  description:
    "Give a chart's stated time and how far off it could be, and see which of its facts hold across the whole window and when the others change. Runs in your browser on the Caelus engine, with the call that produced it.",
  path: "/instruments/uncertain-time",
});

export default function UncertainTimePage() {
  return (
    <main>
      <ChartStabilityIsland />
    </main>
  );
}
