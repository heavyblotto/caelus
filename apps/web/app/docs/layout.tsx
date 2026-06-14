import DocsSidebar from "../../components/DocsSidebar";
import TableOfContents from "../../components/TableOfContents";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container-wide page">
      <div className="docs-shell">
        <DocsSidebar />
        <article className="docs-content">{children}</article>
        <TableOfContents />
      </div>
    </main>
  );
}
