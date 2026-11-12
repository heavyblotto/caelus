/**
 * The site chrome from apps/web, wrapped so each piece knows the current path.
 * In Next these call `usePathname()`; here an .astro layout passes
 * `Astro.url.pathname` as a prop and the wrapper provides it through context,
 * which keeps the static render and the hydrated island in agreement.
 */
import type { ReactNode } from "react";
import SiteHeader from "@web/components/SiteHeader";
import DocsSidebar from "@web/components/DocsSidebar";
import DocsPageFooter from "@web/components/DocsPageFooter";
import DocsBreadcrumbs from "@web/components/DocsBreadcrumbs";
import TableOfContents from "@web/components/TableOfContents";
import { PathnameContext } from "../shims/next-navigation";

type Props = { pathname: string };

const at = (pathname: string, node: ReactNode) => (
  <PathnameContext.Provider value={pathname}>{node}</PathnameContext.Provider>
);

export const Header = ({ pathname }: Props) => at(pathname, <SiteHeader />);
export const Sidebar = ({ pathname }: Props) => at(pathname, <DocsSidebar />);
export const Toc = ({ pathname }: Props) => at(pathname, <TableOfContents />);
export const DocsFooter = ({ pathname }: Props) => at(pathname, <DocsPageFooter />);
export const Breadcrumbs = ({ pathname }: Props) => at(pathname, <DocsBreadcrumbs />);
