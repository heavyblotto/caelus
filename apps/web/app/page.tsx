import SkyNow from "../components/SkyNow";
import { Nav } from "../components/Prose";

export default function Home() {
  const a = { color: "#8a7fd4" };
  return (
    <main>
      <Nav current="/" />
      <h1 style={{ letterSpacing: "0.05em" }}>caelus</h1>
      <p style={{ opacity: 0.7 }}>
        ~85 KB ephemeris, computed <em>in your browser</em>. No API call, no
        ephemeris files, no AGPL — <a href="/provenance" style={{ color: "#8a7fd4" }}>clean-room</a> from
        the published record, <a href="/validation" style={{ color: "#8a7fd4" }}>checked</a> to ~1″ vs
        Swiss Ephemeris. MIT.
      </p>
      <SkyNow />
      <p style={{ marginTop: "2rem", display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
        <a style={a} href="https://www.npmjs.com/package/caelus">npm install caelus</a>
        <a style={a} href="https://github.com/heavyblotto/caelus">GitHub</a>
        <a style={a} href="/api/chart?lat=27.94&lon=-82.46">REST API</a>
        <a style={a} href="https://www.npmjs.com/package/caelus-mcp">MCP server</a>
      </p>
    </main>
  );
}
