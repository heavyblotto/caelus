import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ApiMarkdown from "../../components/ApiMarkdown";
import { Eyebrow, Lead, P } from "../../components/Prose";

export const metadata = {
  title: "Changelog",
  description: "Release notes for caelus, caelus-mcp, caelus-birth, and caelus-wheel, versioned in lockstep.",
};

function loadChangelog(): string | null {
  const path = join(process.cwd(), "..", "..", "CHANGELOG.md");
  if (!existsSync(path)) return null;
  // drop the top H1 ("# Changelog"); the page provides its own heading
  return readFileSync(path, "utf8").replace(/^#\s+Changelog\s*\n/, "");
}

export default function Changelog() {
  const content = loadChangelog();
  return (
    <main className="container page">
      <Eyebrow>Changelog</Eyebrow>
      <h1>Changelog</h1>
      <Lead>
        All four packages version in lockstep. Numbers are as measured at release
        time; current figures live in <code>accuracy.json</code> and on{" "}
        <a href="/validation">Validation</a>.
      </Lead>
      {content ? <ApiMarkdown content={content} /> : <P>Changelog unavailable.</P>}
    </main>
  );
}
