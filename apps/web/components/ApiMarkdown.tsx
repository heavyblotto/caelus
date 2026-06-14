import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

/** Rewrite typedoc's relative `.md` links to /docs/api routes. */
function toHref(href?: string): string {
  if (!href) return "#";
  const m = href.match(/^\.?\/?([^#]+)\.md(#.*)?$/);
  if (m) {
    const base = m[1];
    const hash = m[2] ?? "";
    return base === "index" ? `/docs/api${hash}` : `/docs/api/${base}${hash}`;
  }
  return href;
}

export default function ApiMarkdown({ content }: { content: string }) {
  return (
    <div className="api-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ href, children }) => {
            const url = toHref(href);
            return url.startsWith("/") ? (
              <Link href={url}>{children}</Link>
            ) : (
              <a href={url} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
