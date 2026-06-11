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
  const chart = engine.chart(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
    lat, lon, "placidus",
  );
  return NextResponse.json(chart);
}
