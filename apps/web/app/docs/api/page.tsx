import ApiMarkdown from "../../../components/ApiMarkdown";
import { Eyebrow, P } from "../../../components/Prose";
import { readApiDoc } from "../../../lib/api-docs";
import { SITE } from "../../../lib/site";

export const metadata = {
  title: "API Reference",
  description: "Generated TypeScript API reference for the caelus package surface.",
};

export default function ApiIndex() {
  const content = readApiDoc("index");
  return (
    <>
      <Eyebrow>Reference · v{SITE.version}</Eyebrow>
      <h1>API Reference</h1>
      <P dim>
        Generated from the <code>caelus</code> package with TypeDoc. Regenerate with{" "}
        <code>npm run docs:api</code>.
      </P>
      {content ? (
        <ApiMarkdown content={content} />
      ) : (
        <P>Run <code>npm run docs:api</code> to generate the reference.</P>
      )}
    </>
  );
}
