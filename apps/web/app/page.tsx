import SkyNow from "../components/SkyNow";

export default function Home() {
  return (
    <main>
      <h1 style={{ letterSpacing: "0.05em" }}>caelus</h1>
      <p style={{ opacity: 0.7 }}>
        The chart below is computed <em>in your browser</em> by an ~85 KB
        ephemeris engine — no API call, no ephemeris files. Positions are
        validated to ~1″ against Swiss Ephemeris.
      </p>
      <SkyNow />
      <p style={{ opacity: 0.5, marginTop: "2rem", fontSize: "0.85em" }}>
        Server-side twin: <code>GET /api/chart?date=…&lat=…&lon=…</code> (edge runtime).
      </p>
    </main>
  );
}
