import Link from "next/link";
import { INSTRUMENTS } from "../../lib/instruments";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Instruments",
  description:
    "Single-purpose pages built on the Caelus engine. Each takes a small input, computes in your browser, and shows the call that produced the result.",
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
              An instrument answers one question from a small input. It
              computes in your browser on the embedded data tier, and it shows
              the call that produced the result so you can run the same thing
              in your own code.
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
