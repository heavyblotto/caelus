import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";

const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"] });

export const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
  href.startsWith("/")
    ? <Link href={href} style={{ color: "#8a7fd4" }}>{children}</Link>
    : <a href={href} style={{ color: "#8a7fd4" }}>{children}</a>;

export const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} style={{ marginTop: "2.2rem", fontSize: "1.05rem", letterSpacing: "0.04em", opacity: 0.9 }}>{children}</h2>
);

export const P = ({ children, dim }: { children: React.ReactNode; dim?: boolean }) => (
  <p style={{ lineHeight: 1.65, opacity: dim ? 0.55 : 0.78 }}>{children}</p>
);

export const Code = ({ children }: { children: React.ReactNode }) => (
  <code
    className={mono.className}
    style={{
      background: "#161322",
      padding: "0.12rem 0.4rem",
      borderRadius: 4,
      border: "1px solid #2a2438",
      fontSize: "0.88em",
    }}
  >
    {children}
  </code>
);

export const Pre = ({ children }: { children: React.ReactNode }) => (
  <pre
    className={mono.className}
    style={{
      background: "#13101e",
      padding: "1rem 1.1rem",
      borderRadius: 8,
      border: "1px solid #2a2438",
      overflow: "auto",
      fontSize: "0.8125rem",
      lineHeight: 1.65,
      tabSize: 2,
    }}
  >
    {children}
  </pre>
);

export function Nav({ current }: { current: string }) {
  const pages = [["/", "Playground"], ["/validation", "Validation"], ["/provenance", "Provenance"], ["/notes", "Build Notes"]];
  return (
    <nav style={{ display: "flex", gap: "1.1rem", marginBottom: "2rem", fontSize: "0.85em" }}>
      {pages.map(([href, label]) => (
        <Link key={href} href={href} style={{ color: current === href ? "#e8e4f0" : "#8a7fd4", textDecoration: current === href ? "none" : undefined }}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
