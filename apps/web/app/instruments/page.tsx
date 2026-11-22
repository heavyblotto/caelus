import Link from "next/link";
import { INSTRUMENTS } from "../../lib/instruments";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Instruments",
  description:
    "Interactive browser tools built on Caelus. Enter inputs, run calculations locally, and view the TypeScript API call behind each result.",
  path: "/instruments",
});

export default function InstrumentsPage() {
  return (
    <main>
      <div className="bench">
        <div className="head">
          <div>
            <span className="lab">{INSTRUMENTS.length} live</span>
            <h1>Instruments</h1>
          </div>
          <div>
            <p>
              Each interactive instrument answers a focused astronomical or
              astrological question directly in your browser using the embedded
              ephemeris tier, and displays the TypeScript code so you can run
              the same calculation in your own app.
            </p>
          </div>
        </div>
        {INSTRUMENTS.map((inst) => (
          <Link key={inst.id} href={inst.href} className="tile s3">
            <div className="tile__h">
              <b>{inst.id}</b>
              <span>Instrument</span>
              <i><span className="led led--live" aria-hidden />{inst.status}</i>
            </div>
            <div className="tile__b">
              <h3>{inst.title}</h3>
              <p>{inst.line}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
