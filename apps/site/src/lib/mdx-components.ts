/**
 * Components available to every docs MDX page without an import: the Astro
 * counterpart of apps/web/mdx-components.tsx.
 */
import PageClose from "@web/components/PageClose";
import { Eyebrow, Note } from "@web/components/Prose";
import CodeBlock from "../islands/web/CodeBlock";
import Cta from "../islands/web/Cta";
import MdxLink from "../components/MdxLink.astro";
import Tab from "../components/Tab.astro";
import Tabs from "../components/Tabs.astro";

export const mdxComponents = { a: MdxLink, CodeBlock, Cta, PageClose, Note, Eyebrow, Tabs, Tab };
