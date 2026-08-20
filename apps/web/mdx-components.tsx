import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import CodeBlock from "./components/CodeBlock";
import Cta from "./components/Cta";
import PageClose from "./components/PageClose";
import { Note, Eyebrow } from "./components/Prose";
import { Tabs, Tab } from "./components/Tabs";
import W from "./components/plates/W";
import EntryShell from "./components/encyclopedia/EntryShell";
import EntryLink from "./components/encyclopedia/EntryLink";
import Infobox from "./components/encyclopedia/Infobox";
import KindMark from "./components/encyclopedia/KindMark";
import { NoteRef, Notes, Note as EncyNote } from "./components/encyclopedia/Notes";
import RevisionStamp from "./components/encyclopedia/RevisionStamp";

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
    // Encyclopedia parts (DS-02 plate direction): the entry frame, the
    // apparatus, and the stamp. Only Encyclopedia entries use them.
    EntryShell,
    EntryLink,
    Infobox,
    KindMark,
    NoteRef,
    Notes,
    NoteItem: EncyNote,
    RevisionStamp,
    ...components,
  };
}
