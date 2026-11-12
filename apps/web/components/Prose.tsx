import Link from "next/link";

export const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
  href.startsWith("/") ? (
    <Link href={href}>{children}</Link>
  ) : (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {children}
    </a>
  );

export const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id}>{children}</h2>
);

export const H3 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h3 id={id}>{children}</h3>
);

export const P = ({ children, dim }: { children: React.ReactNode; dim?: boolean }) => (
  <p className={dim ? "dim small" : undefined}>{children}</p>
);

export const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="lead">{children}</p>
);

export const Code = ({ children }: { children: React.ReactNode }) => <code>{children}</code>;

export const Pre = ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>;

/** Eyebrow label above a heading, set in mono. */
export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="eyebrow">{children}</div>
);

/** A bordered aside for caveats and tips. */
export const Note = ({ children }: { children: React.ReactNode }) => (
  <aside className="card small aside-note">{children}</aside>
);
