/**
 * field-verifier checks: all 5 EXP-003 presets, all 3 solver modes (verify,
 * chronolocate, geolocate), zero-dependency JPEG EXIF parser (LE + BE +
 * malformed inputs), 12x24 solar analemma feasibility heatmap, antimeridian-safe
 * spherical fix map math, generated TypeScript source, and SSR rendering of all
 * modes and presets with inert, non-empty SVGs and zero em-dashes.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, julianDay, type GeolocateResult } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import {
  compassDialGeometry,
  computeAnalemmaHeatmap,
  FIELD_VERIFIER_MAX_SPAN_DAYS,
  FIELD_VERIFIER_PLACES,
  FIELD_VERIFIER_PRESETS,
  fieldVerifierQueryOk,
  fieldVerifierReturned,
  fieldVerifierSource,
  fixMapGeometry,
  isoToJdUt,
  jdUtToIso,
  parseJpegExif,
  previewSceneGeometry,
  runFieldVerifier,
  timelineGeometry,
  type FieldVerifierQuery,
} from "../src/field-verifier.js";
import { FieldVerifier } from "../src/field-verifier-widget.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

const eng = new Engine(embeddedData);
const preset = (id: string) => FIELD_VERIFIER_PRESETS.find((p) => p.id === id)!;

// -------------------------------------------------- synthetic JPEG EXIF builder for tests

function buildSyntheticExifJpeg(opts: {
  littleEndian: boolean;
  latDeg: number;
  lonDeg: number;
  dateTimeOriginal?: string;
  offsetTimeOriginal?: string;
  gpsDateStamp?: string;
  gpsTimeStamp?: [number, number, number];
  make?: string;
  model?: string;
}): Uint8Array {
  const le = opts.littleEndian;
  const buf = new Uint8Array(2048);
  const view = new DataView(buf.buffer);

  // SOI
  view.setUint16(0, 0xffd8, false);
  // APP1 marker
  view.setUint16(2, 0xffe1, false);
  // Length placeholder at 4..5
  // "Exif\0\0"
  const exifHdr = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  exifHdr.forEach((b, i) => buf[6 + i] = b);

  const tiffStart = 12;
  let dataCursor = 400; // relative to tiffStart

  const writeAscii = (str: string): { offset: number; count: number } => {
    const start = dataCursor;
    for (let i = 0; i < str.length; i++) {
      buf[tiffStart + dataCursor++] = str.charCodeAt(i);
    }
    buf[tiffStart + dataCursor++] = 0;
    return { offset: start, count: str.length + 1 };
  };

  const writeDms = (degAbs: number): number => {
    const start = dataCursor;
    const d = Math.floor(degAbs);
    const remM = (degAbs - d) * 60;
    const m = Math.floor(remM);
    const s = Math.round((remM - m) * 60 * 100);
    const pairs: Array<[number, number]> = [[d, 1], [m, 1], [s, 100]];
    for (const [num, den] of pairs) {
      view.setUint32(tiffStart + dataCursor, num, le);
      view.setUint32(tiffStart + dataCursor + 4, den, le);
      dataCursor += 8;
    }
    return start;
  };

  const writeEntry = (pos: number, tag: number, type: number, count: number, valOrOff: number, inlineShort = false) => {
    view.setUint16(tiffStart + pos, tag, le);
    view.setUint16(tiffStart + pos + 2, type, le);
    view.setUint32(tiffStart + pos + 4, count, le);
    if (inlineShort) {
      view.setUint16(tiffStart + pos + 8, valOrOff, le);
    } else {
      view.setUint32(tiffStart + pos + 8, valOrOff, le);
    }
  };

  const writeAsciiEntry = (pos: number, tag: number, str: string) => {
    const count = str.length + 1;
    view.setUint16(tiffStart + pos, tag, le);
    view.setUint16(tiffStart + pos + 2, 2, le);
    view.setUint32(tiffStart + pos + 4, count, le);
    if (count <= 4) {
      for (let i = 0; i < str.length; i++) buf[tiffStart + pos + 8 + i] = str.charCodeAt(i);
      buf[tiffStart + pos + 8 + str.length] = 0;
    } else {
      const info = writeAscii(str);
      view.setUint32(tiffStart + pos + 8, info.offset, le);
    }
  };

  // TIFF Header
  view.setUint16(tiffStart, le ? 0x4949 : 0x4d4d, false);
  view.setUint16(tiffStart + 2, 42, le);
  view.setUint32(tiffStart + 4, 8, le); // IFD0 offset = 8

  const exifIfdOff = 120;
  const gpsIfdOff = 220;

  // IFD0 at offset 8: Make, Model, Orientation, ExifIFD, GPSIFD
  view.setUint16(tiffStart + 8, 5, le);
  writeAsciiEntry(10, 0x010f, opts.make ?? "TestCam");
  writeAsciiEntry(22, 0x0110, opts.model ?? "Field-1");
  writeEntry(34, 0x0112, 3, 1, 1, true);
  writeEntry(46, 0x8769, 4, 1, exifIfdOff);
  writeEntry(58, 0x8825, 4, 1, gpsIfdOff);

  // Exif SubIFD
  const exifEntries: Array<() => void> = [];
  let ep = exifIfdOff + 2;
  if (opts.dateTimeOriginal) {
    const dt = writeAscii(opts.dateTimeOriginal);
    const pos = ep;
    exifEntries.push(() => writeEntry(pos, 0x9003, 2, dt.count, dt.offset));
    ep += 12;
  }
  if (opts.offsetTimeOriginal) {
    const ot = writeAscii(opts.offsetTimeOriginal);
    const pos = ep;
    exifEntries.push(() => writeEntry(pos, 0x9011, 2, ot.count, ot.offset));
    ep += 12;
  }
  view.setUint16(tiffStart + exifIfdOff, exifEntries.length, le);
  exifEntries.forEach((fn) => fn());

  // GPS SubIFD
  const gpsEntries: Array<() => void> = [];
  let gp = gpsIfdOff + 2;
  const latRef = opts.latDeg < 0 ? "S" : "N";
  const lonRef = opts.lonDeg < 0 ? "W" : "E";
  const latDmsOff = writeDms(Math.abs(opts.latDeg));
  const lonDmsOff = writeDms(Math.abs(opts.lonDeg));

  // Inline 2-byte ASCII strings for N/S and E/W
  const writeInlineRef = (pos: number, tag: number, ch: string) => {
    view.setUint16(tiffStart + pos, tag, le);
    view.setUint16(tiffStart + pos + 2, 2, le);
    view.setUint32(tiffStart + pos + 4, 2, le);
    buf[tiffStart + pos + 8] = ch.charCodeAt(0);
    buf[tiffStart + pos + 9] = 0;
  };
  {
    const p1 = gp; gpsEntries.push(() => writeInlineRef(p1, 0x0001, latRef)); gp += 12;
    const p2 = gp; gpsEntries.push(() => writeEntry(p2, 0x0002, 5, 3, latDmsOff)); gp += 12;
    const p3 = gp; gpsEntries.push(() => writeInlineRef(p3, 0x0003, lonRef)); gp += 12;
    const p4 = gp; gpsEntries.push(() => writeEntry(p4, 0x0004, 5, 3, lonDmsOff)); gp += 12;
  }
  if (opts.gpsTimeStamp) {
    const start = dataCursor;
    for (const v of opts.gpsTimeStamp) {
      view.setUint32(tiffStart + dataCursor, v, le);
      view.setUint32(tiffStart + dataCursor + 4, 1, le);
      dataCursor += 8;
    }
    const p5 = gp; gpsEntries.push(() => writeEntry(p5, 0x0007, 5, 3, start)); gp += 12;
  }
  if (opts.gpsDateStamp) {
    const gd = writeAscii(opts.gpsDateStamp);
    const p6 = gp; gpsEntries.push(() => writeEntry(p6, 0x001d, 2, gd.count, gd.offset)); gp += 12;
  }
  view.setUint16(tiffStart + gpsIfdOff, gpsEntries.length, le);
  gpsEntries.forEach((fn) => fn());

  const totalTiffLen = dataCursor;
  const app1Len = 2 + 6 + totalTiffLen;
  view.setUint16(4, app1Len, false);
  const eoiPos = 4 + app1Len;
  view.setUint16(eoiPos, 0xffd9, false);
  return buf.slice(0, eoiPos + 2);
}

// -------------------------------------------------- 1. Presets & Validation
{
  assert(FIELD_VERIFIER_PRESETS.length === 5, "five EXP-003 presets exported");
  const expectedIds = [
    "nyc-summer-authentic",
    "tz-shift-spoof",
    "hemisphere-moon-spoof",
    "night-shadow-impossible",
    "sloped-alpine",
  ];
  assert(
    FIELD_VERIFIER_PRESETS.map((p) => p.id).join(",") === expectedIds.join(","),
    "preset IDs match FACT-001 specification exactly",
  );
  assert(
    FIELD_VERIFIER_PRESETS.every((p) => fieldVerifierQueryOk(p.query).ok),
    "every preset query validates cleanly",
  );
  assert(FIELD_VERIFIER_PLACES.length >= 6, "preset places list populated");

  // Date round-trip
  const jd = isoToJdUt("2026-07-04T19:30:00Z");
  assert(jd !== null && Math.abs(jd - julianDay(2026, 7, 4, 19, 30, 0)) < 1e-9, "isoToJdUt matches julianDay");
  assert(jdUtToIso(jd!) === "2026-07-04T19:30:00Z", `jdUtToIso round-trips cleanly (got ${jdUtToIso(jd!)})`);
  assert(isoToJdUt("not-a-date") === null, "invalid ISO timestamp rejected");

  // Span clamp validation
  const base = preset("nyc-summer-authentic").query;
  assert(
    !fieldVerifierQueryOk({
      ...base,
      mode: "chronolocate",
      searchStartUtc: "2025-01-01T00:00:00Z",
      searchEndUtc: "2026-06-01T00:00:00Z",
    }).ok,
    `chronolocate rejects spans exceeding ${FIELD_VERIFIER_MAX_SPAN_DAYS} days`,
  );
  assert(
    !fieldVerifierQueryOk({ ...base, place: { ...base.place, lat: 95 } }).ok,
    "invalid latitude rejected",
  );
}

// -------------------------------------------------- 2. Verify Mode across all 5 presets
{
  // Preset 1: NYC summer authentic
  const r1 = runFieldVerifier(eng, preset("nyc-summer-authentic").query);
  assert(r1.verify !== null && r1.verify.verdict === "consistent", `nyc-summer-authentic is consistent (got ${r1.verify?.verdict})`);
  assert((r1.verify?.consistencyScore ?? 0) > 0.95, "nyc-summer-authentic consistency score > 0.95");
  assert(r1.verify?.diagnostics === null, "authentic scene emits no spoof diagnostics");

  const scPreview = previewSceneGeometry(eng, preset("nyc-summer-authentic").query);
  assert(scPreview.shadow.cast && scPreview.shadow.bearingDeg !== null, "previewSceneGeometry computes forward shadow");

  // Preset 2: Timezone shift spoof (-4h)
  const r2 = runFieldVerifier(eng, preset("tz-shift-spoof").query);
  assert(r2.verify !== null && r2.verify.verdict === "inconsistent", `tz-shift-spoof is inconsistent (got ${r2.verify?.verdict})`);
  assert(
    r2.verify?.diagnostics?.timeShift.nearestWholeHourOffset === 4 &&
    r2.verify?.diagnostics?.timeShift.verdict === "consistent",
    `tz-shift-spoof counterfactual recovers +4h shift (got ${r2.verify?.diagnostics?.timeShift.nearestWholeHourOffset}h)`,
  );
  // Apply counterfactual time shift -> consistent
  const fixed2 = runFieldVerifier(eng, {
    ...preset("tz-shift-spoof").query,
    utc: jdUtToIso(r2.verify!.diagnostics!.timeShift.jdUt),
  });
  assert(fixed2.verify?.verdict === "consistent", "applying tz-shift counterfactual aligns claim to consistent");

  // Preset 3: Hemisphere Moon tilt spoof
  const r3 = runFieldVerifier(eng, preset("hemisphere-moon-spoof").query);
  assert(r3.verify !== null && r3.verify.verdict === "inconsistent", `hemisphere-moon-spoof is inconsistent (got ${r3.verify?.verdict})`);
  assert(
    r3.verify?.diagnostics?.hemisphereFlip.verdict === "consistent" &&
    Math.abs(r3.verify!.diagnostics!.hemisphereFlip.lat - -33.8688) < 1e-3,
    "hemisphere-moon-spoof counterfactual recovers Southern Hemisphere latitude",
  );
  // Apply counterfactual hemisphere flip -> consistent
  const fixed3 = runFieldVerifier(eng, {
    ...preset("hemisphere-moon-spoof").query,
    place: { ...preset("hemisphere-moon-spoof").query.place, lat: r3.verify!.diagnostics!.hemisphereFlip.lat },
  });
  assert(fixed3.verify?.verdict === "consistent", "applying hemisphere-flip counterfactual aligns claim to consistent");

  // Preset 4: Night shadow impossible
  const r4 = runFieldVerifier(eng, preset("night-shadow-impossible").query);
  assert(r4.verify !== null && r4.verify.verdict === "impossible", `night-shadow-impossible is impossible (got ${r4.verify?.verdict})`);

  // Preset 5: Sloped alpine terrain
  const r5 = runFieldVerifier(eng, preset("sloped-alpine").query);
  assert(r5.verify !== null && r5.verify.verdict === "consistent", `sloped-alpine is consistent on 20 deg slope (got ${r5.verify?.verdict})`);
  const r5Flat = previewSceneGeometry(eng, {
    ...preset("sloped-alpine").query,
    place: { ...preset("sloped-alpine").query.place, slopeDeg: 0, slopeAzimuthDeg: 0 },
  });
  assert(
    Math.abs((r5.verify!.scene.shadow.lengthRatio ?? 0) - (r5Flat.shadow.lengthRatio ?? 0)) > 0.05,
    "20 deg alpine slope produces measurably shorter shadow ratio than flat ground",
  );
}

// -------------------------------------------------- 3. Chronolocate & Analemma Heatmap
{
  const qChrono: FieldVerifierQuery = {
    ...preset("nyc-summer-authentic").query,
    mode: "chronolocate",
  };
  const rc = runFieldVerifier(eng, qChrono);
  assert(rc.chronolocate !== null && rc.chronolocate.windows.length >= 1, `chronolocate finds matching UTC windows (got ${rc.chronolocate?.windows.length})`);
  const targetJd = isoToJdUt("2026-07-04T19:30:00Z")!;
  const bestDistMin = Math.min(...rc.chronolocate!.windows.map((w) => Math.abs(w.bestJd - targetJd) * 1440));
  assert(bestDistMin < 10, `chronolocate recovers 2026-07-04T19:30Z within 10 min (got ${bestDistMin.toFixed(2)} min)`);

  // Analemma 12x24 feasibility grid
  const t0 = performance.now();
  const map = computeAnalemmaHeatmap(eng, qChrono.place, qChrono.observed, 2026);
  const dt = performance.now() - t0;
  assert(map.cells.length === 288, "analemma heatmap has 12x24 = 288 cells");
  assert(map.feasibleCount >= 1 && map.peak !== null, "analemma heatmap identifies feasible month-hour windows");
  assert(map.peak!.hourUtc === 19 && (map.peak!.month === 6 || map.peak!.month === 7), `analemma peak lands in Jun/Jul at 19h UT (got month ${map.peak?.month} hour ${map.peak?.hourUtc})`);
  assert(dt < 200, `analemma heatmap runs quickly (${dt.toFixed(1)} ms)`);

  // Timeline geometry + sub-2px point hit separation
  const tg = timelineGeometry(eng, rc.chronolocate!);
  assert(tg.ticks.length === 5 && tg.solarCurvePoints.length > 20, "timelineGeometry builds range-frame ticks and solar curve");
  const wideSpanResult = {
    ...rc.chronolocate!,
    jdStart: julianDay(2026, 1, 1, 0, 0, 0),
    jdEnd: julianDay(2026, 12, 31, 0, 0, 0),
  };
  const tgWide = timelineGeometry(eng, wideSpanResult);
  assert(tgWide.hasPointHits && tgWide.windows.every((w) => w.isPointHit), "short windows over 365-day span are flagged as point hits (Tufte B1)");
}

// -------------------------------------------------- 4. Geolocate & Antimeridian Fix Map
{
  const qGeo: FieldVerifierQuery = {
    ...preset("nyc-summer-authentic").query,
    mode: "geolocate",
  };
  const rg = runFieldVerifier(eng, qGeo);
  assert(rg.geolocate !== null && rg.geolocate.method === "analytical", "geolocate uses analytical Path A for flat-ground shadow bearing + ratio");
  assert(rg.geolocate!.candidates.length >= 1, "geolocate returns analytical fix candidate");
  const top = rg.geolocate!.candidates[0];
  assert(Math.abs(top.lat - 40.7128) < 0.5 && Math.abs(top.lon - -74.006) < 0.5, `geolocate recovers NYC coordinates (${top.lat.toFixed(2)}, ${top.lon.toFixed(2)})`);

  // Path B spherical grid fix (double altitude)
  const qGeoB: FieldVerifierQuery = {
    ...preset("nyc-summer-authentic").query,
    mode: "geolocate",
    utc: "2026-04-11T14:26:59Z",
    observed: {
      sunAltitudeDeg: 44.09,
      moonAltitudeDeg: 21.89,
      moonVisible: true,
      tolerances: { sunAltitudeDeg: 3, moonAltitudeDeg: 3.5 },
    },
  };
  const rgB = runFieldVerifier(eng, qGeoB);
  assert(rgB.geolocate !== null && rgB.geolocate.method === "grid" && rgB.geolocate.candidates.length >= 1, "geolocate Path B spherical grid returns candidate fixes");

  // Antimeridian-safe fixMapGeometry (Suva, Fiji crossing +/-180 deg)
  const antimeridianGeo: GeolocateResult = {
    jdUt: julianDay(2026, 5, 19, 2, 2, 41),
    method: "analytical",
    subsolar: { lat: 19.7, lon: 148.5 },
    sublunar: { lat: 24.1, lon: 112.0 },
    candidates: [
      {
        lat: -18.14,
        lon: 178.44,
        fitScore: 0.99,
        maxNormalizedResidual: 0.1,
        radiusKm: 975,
        latRange: [-25, -11],
        lonRange: [171, -173], // crosses antimeridian!
        regionKind: "point",
      },
      {
        lat: 70.0,
        lon: 20.0,
        fitScore: 0.85,
        maxNormalizedResidual: 0.4,
        radiusKm: 975,
        latRange: [62, 78],
        lonRange: [0, 40],
        regionKind: "point",
      },
    ],
  };
  const mapGeom = fixMapGeometry(antimeridianGeo, 640, 310);
  const fiji = mapGeom.candidates[0];
  const arctic = mapGeom.candidates[1];
  assert(fiji.bboxRects.length === 2, `antimeridian bounding box splits into 2 rects (got ${fiji.bboxRects.length})`);
  assert(fiji.contourPolylines.length >= 2, `antimeridian spherical contour splits across +/-180 deg (got ${fiji.contourPolylines.length} segments)`);
  // Verify NO single polyline segment jumps horizontally more than 120 px (no scratch across globe)
  let maxJumpPx = 0;
  for (const poly of [...fiji.contourPolylines, ...mapGeom.terminatorPolylines]) {
    const pts = poly.split(" ").map((s) => s.split(",").map(Number));
    for (let i = 1; i < pts.length; i++) {
      maxJumpPx = Math.max(maxJumpPx, Math.abs(pts[i][0] - pts[i - 1][0]));
    }
  }
  assert(maxJumpPx < 120, `antimeridian polylines never shoot across map (max segment dx = ${maxJumpPx.toFixed(1)} px)`);

  // Verify spherical contour stretches realistically east-west at high latitudes (zero cos(lat) lie factor)
  const xSpanOf = (polys: string[]): number => {
    const xs = polys.flatMap((p) => p.split(" ").map((pair) => Number(pair.split(",")[0])));
    return Math.max(...xs) - Math.min(...xs);
  };
  const arcticSpan = xSpanOf(arctic.contourPolylines);
  const equatorGeo: GeolocateResult = {
    ...antimeridianGeo,
    candidates: [{ ...antimeridianGeo.candidates[1], lat: 0.0, lon: 20.0 }],
  };
  const equatorSpan = xSpanOf(fixMapGeometry(equatorGeo, 640, 310).candidates[0].contourPolylines);
  assert(arcticSpan > equatorSpan * 2.2, `high-latitude 975 km contour stretches east-west by ~1/cos(70 deg) (${arcticSpan.toFixed(1)} px vs ${equatorSpan.toFixed(1)} px at equator)`);
}

// -------------------------------------------------- 5. Zero-Dependency JPEG EXIF Parser
{
  const leJpeg = buildSyntheticExifJpeg({
    littleEndian: true,
    latDeg: 40.7128,
    lonDeg: -74.006,
    dateTimeOriginal: "2026:07:04 15:30:00",
    offsetTimeOriginal: "-04:00",
    make: "Leica",
    model: "Q3",
  });
  const parsedLe = parseJpegExif(leJpeg.buffer);
  assert(parsedLe !== null, "parses little-endian synthetic JPEG EXIF buffer");
  assert(parsedLe?.utc === "2026-07-04T19:30:00Z" && parsedLe.utcVerified, `LE EXIF converts -04:00 local time to exact UTC (got ${parsedLe?.utc})`);
  assert(
    parsedLe?.lat !== null && Math.abs(parsedLe!.lat! - 40.7128) < 0.001 &&
    parsedLe?.lonEast !== null && Math.abs(parsedLe!.lonEast! - -74.006) < 0.001,
    `LE EXIF extracts NYC GPS (${parsedLe?.lat}, ${parsedLe?.lonEast})`,
  );
  assert(parsedLe?.make === "Leica" && parsedLe?.model === "Q3", "LE EXIF extracts camera make and model");

  const beJpeg = buildSyntheticExifJpeg({
    littleEndian: false,
    latDeg: -33.8688,
    lonDeg: 151.2093,
    gpsDateStamp: "2026:05:21",
    gpsTimeStamp: [9, 0, 0],
    make: "Nikon",
    model: "Zf",
  });
  const parsedBe = parseJpegExif(beJpeg);
  assert(parsedBe !== null, "parses big-endian synthetic JPEG EXIF buffer");
  assert(parsedBe?.utc === "2026-05-21T09:00:00Z" && parsedBe.utcVerified, `BE EXIF extracts GPS UTC stamp (got ${parsedBe?.utc})`);
  assert(
    parsedBe?.lat !== null && Math.abs(parsedBe!.lat! - -33.8688) < 0.001 &&
    parsedBe?.lonEast !== null && Math.abs(parsedBe!.lonEast! - 151.2093) < 0.001,
    `BE EXIF extracts Sydney S/E GPS (${parsedBe?.lat}, ${parsedBe?.lonEast})`,
  );

  // Graceful null handling on non-EXIF / non-JPEG / malformed buffers
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0]);
  assert(parseJpegExif(pngHeader) === null, "PNG buffer returns null gracefully");
  assert(parseJpegExif(new Uint8Array(0)) === null, "empty buffer returns null gracefully");
  assert(parseJpegExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66])) === null, "truncated APP1 returns null without throwing");
}

// -------------------------------------------------- 6. Compass Dial & Generated TS Source
{
  const r3 = runFieldVerifier(eng, preset("hemisphere-moon-spoof").query);
  const dial3 = compassDialGeometry(r3.verify!.scene, preset("hemisphere-moon-spoof").query.observed);
  assert(dial3.moon.visible && dial3.moon.predLimbArrow !== null && dial3.moon.obsLimbArrow !== null, "compassDialGeometry emits both predicted and observed Moon bright-limb arrows");

  const r1 = runFieldVerifier(eng, preset("nyc-summer-authentic").query);
  const dial1 = compassDialGeometry(r1.verify!.scene, preset("nyc-summer-authentic").query.observed);
  assert(dial1.observedShadow.wedgePath !== null && dial1.ratioBar.show, "compassDialGeometry emits observed tolerance wedge and 1-D shadow ratio bar");

  const srcVerify = fieldVerifierSource(preset("nyc-summer-authentic").query);
  const srcChrono = fieldVerifierSource({ ...preset("nyc-summer-authentic").query, mode: "chronolocate" });
  const srcGeo = fieldVerifierSource({ ...preset("nyc-summer-authentic").query, mode: "geolocate" });
  assert(srcVerify.includes("verifyObservation(") && srcVerify.includes(`from "caelus"`), "verify TS source imports and calls verifyObservation");
  assert(srcChrono.includes("chronolocate(") && srcChrono.includes(`from "caelus"`), "chronolocate TS source imports and calls chronolocate");
  assert(srcGeo.includes("geolocate(") && srcGeo.includes(`from "caelus"`), "geolocate TS source imports and calls geolocate");
  assert(fieldVerifierReturned(r1).includes(`"verdict": "consistent"`), "fieldVerifierReturned summarizes verify result");
  assert(fieldVerifierReturned(null) === "null", "null result formats cleanly");
}

// -------------------------------------------------- 7. SSR Render via react-dom/server
{
  const htmlVerify = renderToStaticMarkup(<FieldVerifier engine={eng} />);
  const htmlVerifyAgain = renderToStaticMarkup(<FieldVerifier engine={eng} />);
  assert(htmlVerify === htmlVerifyAgain, "SSR markup is byte-for-byte deterministic (no hydration #418 timing drift)");
  assert(!htmlVerify.includes("ms in browser") && htmlVerify.includes("embedded ephemeris"), "SSR renders deterministic ephemeris label before client mount");
  assert(htmlVerify.includes("telemetry__item") && htmlVerify.includes("fv-verdict fv-verdict--consistent"), "SSR emits .telemetry__item spans and semantic .fv-verdict--consistent class");
  assert(htmlVerify.includes("Shadow L/H (pred violet, obs peach)"), "SSR emits unclipped ratio bar header");
  assert(htmlVerify.includes("Instrument I-05") && htmlVerify.includes("<h1>Field verifier</h1>"), "SSR renders Instrument I-05 header and H1");
  for (const id of ["MODE", "IN", "CAL", "OUT", "CHK", "TS", "RET", "M-1", "M-2", "M-3"]) {
    assert(htmlVerify.includes(`<b>${id}</b>`), `Verify SSR renders tile ${id}`);
  }
  assert(htmlVerify.includes("100% local, never uploaded"), "SSR includes zero-upload privacy badge");
  assert(htmlVerify.includes("<svg") && htmlVerify.includes("Outer ring L/H = 4.0"), "Verify SSR renders non-empty Compass Dial SVG");
  assert(!htmlVerify.includes("\u2014"), "Verify SSR contains zero em-dashes");
  assert(!/<script|<animate|<foreignObject|onload=/i.test(htmlVerify), "Verify SSR SVGs are 100% inert");

  const htmlSpoof = renderToStaticMarkup(<FieldVerifier engine={eng} initialPreset="tz-shift-spoof" />);
  assert(htmlSpoof.includes("<b>CF</b>") && htmlSpoof.includes("Apply counterfactual"), "Spoof preset SSR renders Counterfactual Diagnostics card with Apply counterfactual button");
  assert(!htmlSpoof.includes("\u2014"), "Spoof SSR contains zero em-dashes");

  const htmlChrono = renderToStaticMarkup(<FieldVerifier engine={eng} initialMode="chronolocate" />);
  assert(htmlChrono.includes("<b>ANL</b>") && htmlChrono.includes("fv-heatmap") && htmlChrono.includes("fv-timeline"), "Chronolocate SSR renders 12x24 Analemma Heatmap and Timeline Track SVGs");
  assert(!htmlChrono.includes("\u2014"), "Chronolocate SSR contains zero em-dashes");

  const htmlGeo = renderToStaticMarkup(<FieldVerifier engine={eng} initialMode="geolocate" />);
  assert(htmlGeo.includes("fv-map") && htmlGeo.includes("Sub-solar") && htmlGeo.includes("Fix #1"), "Geolocate SSR renders Equirectangular Global Fix Plot SVG");
  assert(!htmlGeo.includes("\u2014"), "Geolocate SSR contains zero em-dashes");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
