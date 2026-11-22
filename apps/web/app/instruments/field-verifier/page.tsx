import FieldVerifierIsland from "./FieldVerifierIsland";
import PageClose from "../../../components/PageClose";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Field verifier",
  description:
    "Verify outdoor shadows, twilight, and lunar bright-limb tilt against claimed timestamps, or invert physical sky observations to matching UTC windows or Earth coordinates completely client-side.",
  path: "/instruments/field-verifier",
});

export default function FieldVerifierPage() {
  return (
    <main>
      <FieldVerifierIsland />
      <div className="bench">
        <PageClose
          title="Use the observation API in your own code"
          secondaryHref="/docs/observation"
          secondaryLabel="Observation guide"
        />
      </div>
    </main>
  );
}
