import ChartStabilityIsland from "./ChartStabilityIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Uncertain Time",
  description:
    "Test a birth-time uncertainty window in your browser to see which chart placements remain unchanged and pinpoint when cusps, signs, or aspects shift.",
  path: "/instruments/uncertain-time",
});

export default function UncertainTimePage() {
  return (
    <main>
      <ChartStabilityIsland />
    </main>
  );
}
