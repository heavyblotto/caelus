import Link from "next/link";
import CaelusMark from "./CaelusMark";
import { FOOTER, SITE } from "../lib/site";

function FooterLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  if (external || href.startsWith("http") || href.endsWith(".txt") || href.startsWith("/api/")) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
        {label}
      </a>
    );
  }
  return <Link href={href}>{label}</Link>;
}

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__col">
          <Link href="/" className="bar__cell bar__mark" aria-label="Caelus home">
            Caelus
          </Link>
          <p className="site-footer__claim dim small">
            {SITE.tagline} MIT-licensed with embedded ephemeris data.
          </p>
          {/* The sky god from the 404, small: a signature, not a mascot. */}
          <div className="site-footer__mark" aria-hidden>
            <CaelusMark size={56} title="Caelus, holding the veil of the sky" />
          </div>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title} className="site-footer__col">
            <h4>{col.title}</h4>
            <ul>
              {col.links.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="site-footer__meta">
        <a href={`${SITE.repo}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
          MIT License
        </a>
        <span aria-hidden>·</span>
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden>·</span>
        <span>v{SITE.version}</span>
        <span className="site-footer__year" suppressHydrationWarning>
          © {year} ephemengine
        </span>
      </div>
    </footer>
  );
}
