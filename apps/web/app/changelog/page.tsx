import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ApiMarkdown from "../../components/ApiMarkdown";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { Lead, P } from "../../components/Prose";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Changelog",
  description: "Release notes for caelus, caelus-mcp, caelus-birth, and caelus-wheel, versioned in lockstep.",
  path: "/changelog",
});

function loadChangelog(): string | null {
  const path = join(process.cwd(), "..", "..", "CHANGELOG.md");
  if (!existsSync(path)) return null;
  // drop everything before the first release heading: the page already
  // provides the title and the lockstep/accuracy lead, so the file's own
  // H1 and intro paragraph would otherwise render a second time.
  return readFileSync(path, "utf8").replace(/^[\s\S]*?(?=^## )/m, "");
}

export default function Changelog() {
  const content = loadChangelog();
  return (
    <main className="container page">
      <PageHero eyebrow="Changelog" title="Changelog">
        <Lead>
          The four core packages (<code>caelus</code>, <code>caelus-mcp</code>,{" "}
          <code>caelus-birth</code>, and <code>caelus-wheel</code>) share
          lockstep versions, while <code>caelus-delineations-pd</code> follows
          its own semver. Metrics below reflect measurements at each release;
          current figures live in <code>accuracy.json</code> and on{" "}
          <a href="/validation">Validation</a>.
        </Lead>
      </PageHero>
      {content ? <ApiMarkdown content={content} /> : <P>Changelog unavailable.</P>}
      <PageClose title="Install the latest" />
    </main>
  );
}
