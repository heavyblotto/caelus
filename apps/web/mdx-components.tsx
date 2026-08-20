import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import CodeBlock from "./components/CodeBlock";
import Cta from "./components/Cta";
import PageClose from "./components/PageClose";
import { Note, Eyebrow } from "./components/Prose";
import { Tabs, Tab } from "./components/Tabs";
import W from "./components/plates/W";

/**
 * Required by @next/mdx in the App Router. Most elements are styled globally
 * (globals.css); internal links route through next/link, and the rich
 * CodeBlock / Note / Eyebrow components are exposed for use inside .mdx.
 * `W` is the Encyclopedia widget entry point, registered globally so entry
 * authors write the figure where it belongs (no per-page imports); the
 * plate-registry scan enumerates those usages mechanically.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: ({ href, children, ...rest }) => {
      const url = href ?? "#";
      return url.startsWith("/") ? (
        <Link href={url}>{children}</Link>
      ) : (
        <a href={url} target={url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    CodeBlock,
    Cta,
    PageClose,
    Note,
    Eyebrow,
    Tabs,
    Tab,
    W,
    ...components,
  };
}
