import { NextRequest, NextResponse } from "next/server";
import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";

export const runtime = "edge"; // same engine, zero filesystem, runs at the edge

const engine = new Engine(embeddedData);

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const d = new Date(q.get("date") ?? Date.now());
  const lat = Number(q.get("lat") ?? 0);
  const lon = Number(q.get("lon") ?? 0);
  if (Number.isNaN(d.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const y = d.getUTCFullYear();
  if (y < 1920 || y > 2080) {
    // This edge route loads the embedded tier (embedded Moon 1920-2080); the
    // full engine validates positions over 1000-3000, but that full Moon pack
    // is too large to ship to the edge. Outside the embedded tier the Moon
    // falls back to its analytic series rather than being refused.
    return NextResponse.json(
      { error: "date out of this endpoint's embedded tier (1920-2080); the engine validates 1000-3000" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "lat must be a finite number in [-90, 90]" }, { status: 400 });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "lon must be a finite number in [-180, 180] (east positive)" }, { status: 400 });
  }
  const chart = engine.chart(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
    lat, lon, "placidus",
  );
  return NextResponse.json(chart);
}
