import EclipsesIsland from "./EclipsesIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Eclipses",
  description:
    "Browse solar and lunar eclipses over a multi-year span, check local visibility from any coordinates, and map central eclipse paths in your browser.",
  path: "/instruments/eclipses",
});

export default function EclipsesPage() {
  return (
    <main>
      <EclipsesIsland />
    </main>
  );
}
