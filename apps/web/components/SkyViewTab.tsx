import { useEffect, useMemo, useState } from "react";
import { Engine, skyView, type SkyViewResult } from "caelus";
import { WHEEL_PLANET_COLORS } from "../lib/wheelTheme";

const LENSES = ["ultrawide", "wide", "standard", "normal", "portrait", "telephoto", "supertele"];
const AIM_PRESETS = [
  { id: "N", label: "N", alt: "15" },
  { id: "E", label: "E", alt: "15" },
  { id: "S", label: "S", alt: "25" },
  { id: "W", label: "W", alt: "10" },
  { id: "S", label: "Zenith", alt: "80" },
] as const;

function colorOf(id: string): string {
  if (id.startsWith("star:")) return "var(--dim)";
  return WHEEL_PLANET_COLORS[id] ?? "var(--accent)";
}

export interface SkyViewTabProps {
  engine: Engine;
  jdUt: number;
  lat: number;
  lonEast: number;
  extraBodies?: string[];
  selectedBody?: string | null;
  hoveredBody?: string | null;
  onSelectBody?: (body: string | null) => void;
  onHoverBody?: (body: string | null) => void;
}

export default function SkyViewTab({
  engine,
  jdUt,
  lat,
  lonEast,
  extraBodies,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
}: SkyViewTabProps) {
  const [azimuth, setAzimuth] = useState("W");
  const [altitude, setAltitude] = useState("5");
  const [lens, setLens] = useState("normal");
  const [w, setW] = useState("1024");
  const [h, setH] = useState("683");
  const [bortle, setBortle] = useState("");
  const [offsetMin, setOffsetMin] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ov, setOv] = useState({ ecliptic: true, signs: false, houses: false, constellations: true });
  const anyOverlay = ov.ecliptic || ov.signs || ov.houses || ov.constellations;

  // Animation: advance the instant a step per tick and re-render. Each frame is
  // a fresh exact skyView, so stars rotate about the pole, the Moon drifts, and
  // twilight evolves.
  const OFFSET_MAX = 600;
  const STEP = 8;
  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (!playing || reduceMotion) return undefined;
    const id = setInterval(() => {
      setOffsetMin((m) => (m + STEP > OFFSET_MAX ? -120 : m + STEP));
    }, 200);
    return () => clearInterval(id);
  }, [playing, reduceMotion]);

  const effJd = jdUt + offsetMin / 1440;
  const result = useMemo<SkyViewResult | { error: string }>(() => {
    try {
      const base = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
      const extra = (extraBodies ?? []).filter((id) => !base.includes(id));
      return skyView(engine, effJd, {
        observer: { lat, lonEast },
        aim: { azimuth, altitude: Number(altitude) },
        lens,
        image: { width: Math.round(Number(w)), height: Math.round(Number(h)) },
      }, {
        bortle: bortle ? Number(bortle) : undefined,
        overlays: anyOverlay ? ov : undefined,
        bodies: extra.length ? [...base, ...extra] : undefined,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [engine, effJd, lat, lonEast, azimuth, altitude, lens, w, h, bortle, ov, anyOverlay, extraBodies]);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="stack">
      <div className="preset-bar" role="group" aria-label="Quick sky aim">
        {AIM_PRESETS.map((p) => {
          const active = azimuth.toUpperCase() === p.id && altitude === p.alt;
          return (
            <button
              key={p.label}
              type="button"
              className="chip"
              aria-pressed={active}
              onClick={() => { setAzimuth(p.id); setAltitude(p.alt); }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="controls">
        <label className="field">
          <span className="field__label">aim</span>
          <input className="control" value={azimuth}
            onChange={(e) => setAzimuth(e.target.value)} aria-label="aim azimuth (compass or degrees)" />
        </label>
        <label className="field">
          <span className="field__label">altitude°</span>
          <input className="control" value={altitude} type="number"
            onChange={(e) => setAltitude(e.target.value)} aria-label="aim altitude in degrees" />
        </label>
        <label className="field">
          <span className="field__label">lens</span>
          <select className="control" value={lens} onChange={(e) => setLens(e.target.value)} aria-label="lens preset">
            {LENSES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">width</span>
          <input className="control" value={w} type="number"
            onChange={(e) => setW(e.target.value)} aria-label="image width in pixels" />
        </label>
        <label className="field">
          <span className="field__label">height</span>
          <input className="control" value={h} type="number"
            onChange={(e) => setH(e.target.value)} aria-label="image height in pixels" />
        </label>
        <label className="field">
          <span className="field__label">dark sky</span>
          <select className="control" value={bortle} onChange={(e) => setBortle(e.target.value)} aria-label="Bortle dark-sky class">
            <option value="">auto</option>
            <option value="1">Bortle 1 (pristine)</option>
            <option value="2">Bortle 2</option>
            <option value="3">Bortle 3 (rural)</option>
            <option value="4">Bortle 4</option>
            <option value="5">Bortle 5 (suburban)</option>
            <option value="7">Bortle 7 (city)</option>
            <option value="9">Bortle 9 (inner city)</option>
          </select>
        </label>
      </div>

      <div className="scrubber-bar">
        {!reduceMotion && (
          <button type="button" className="btn btn-sm btn-ghost mono"
            onClick={() => setPlaying((p) => !p)} aria-label={playing ? "pause animation" : "play animation"}>
            {playing ? "Pause" : "Play"}
          </button>
        )}
        <input type="range" className="control scrubber__track" min={-120} max={OFFSET_MAX} step={1} value={offsetMin}
          onChange={(e) => { setPlaying(false); setOffsetMin(Number(e.target.value)); }}
          aria-label="time offset in minutes" />
        <span className="mono small mute num">
          {offsetMin >= 0 ? "+" : ""}{(offsetMin / 60).toFixed(1)} h
        </span>
        {offsetMin !== 0 && (
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => { setPlaying(false); setOffsetMin(0); }} aria-label="reset time">Reset</button>
        )}
      </div>

      <div className="row row--wrap viz-toolbar">
        <span className="mono small mute">Overlays:</span>
        {(["ecliptic", "signs", "houses", "constellations"] as const).map((k) => (
          <label key={k} className="row small">
            <input type="checkbox" checked={ov[k]}
              onChange={(e) => setOv((s) => ({ ...s, [k]: e.target.checked }))} />
            <span>{k}</span>
          </label>
        ))}
      </div>

      {"error" in result ? (
        <p className="small badge badge--bad">{result.error}</p>
      ) : (
        <SkyViewBody
          result={result}
          onCopy={copy}
          copied={copied}
          selectedBody={selectedBody}
          hoveredBody={hoveredBody}
          onSelectBody={onSelectBody}
          onHoverBody={onHoverBody}
        />
      )}

      <p className="dim small">
        Caelus places the bodies and describes the sky; it does not render pixels. Aim takes a
        compass point (W, WNW) or degrees from true north; the prompt is built for an image model.
        Press Play or scrub time forward to watch the sky rotate, the Moon drift, and twilight
        evolve from fresh exact computations.
      </p>
    </div>
  );
}

function SkyViewBody({
  result,
  onCopy,
  copied,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
}: {
  result: SkyViewResult;
  onCopy: (t: string) => void;
  copied: boolean;
  selectedBody?: string | null;
  hoveredBody?: string | null;
  onSelectBody?: (body: string | null) => void;
  onHoverBody?: (body: string | null) => void;
}) {
  const { sky, lens, image, bodies, offFrame, milkyWay, overlays, aim, prompt } = result;
  const W = image.width;
  const H = image.height;
  const dotR = Math.max(H * 0.014, 4);
  const activeBody = hoveredBody ?? selectedBody ?? null;
  const interactive = Boolean(onSelectBody || onHoverBody);

  return (
    <div className="stack">
      <div className="viz-stage viz-stage--wide">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Sky frame aimed ${aim.compass} at altitude ${aim.altitudeDeg} degrees`}
        >
          <rect x={0} y={0} width={W} height={H} fill="var(--panel-inset, var(--bg))" />
          {/* subtle framing reticle hairlines at edges */}
          <g stroke="var(--line)" strokeWidth={H * 0.002} opacity={0.7}>
            <line x1={W / 2} y1={0} x2={W / 2} y2={H * 0.03} />
            <line x1={W / 2} y1={H * 0.97} x2={W / 2} y2={H} />
            <line x1={0} y1={H / 2} x2={W * 0.02} y2={H / 2} />
            <line x1={W * 0.98} y1={H / 2} x2={W} y2={H / 2} />
          </g>

          {milkyWay.visible && milkyWay.inFrame && milkyWay.entry && milkyWay.exit && (
            <line x1={milkyWay.entry.x} y1={milkyWay.entry.y} x2={milkyWay.exit.x} y2={milkyWay.exit.y}
              stroke="var(--accent)" strokeOpacity={0.14} strokeWidth={H * 0.12} strokeLinecap="round" />
          )}
          {milkyWay.visible && milkyWay.galacticCenter?.inFrame && (
            <circle cx={milkyWay.galacticCenter.x} cy={milkyWay.galacticCenter.y} r={H * 0.09}
              fill="var(--accent)" opacity={0.14} />
          )}
          {sky.horizonY !== null && sky.horizonY >= 0 && sky.horizonY <= H && (
            <g>
              <line x1={0} y1={sky.horizonY} x2={W} y2={sky.horizonY}
                stroke="var(--wheel-horizon, var(--dim))" strokeWidth={H * 0.003}
                strokeDasharray={`${H * 0.018} ${H * 0.014}`} />
              <text x={W * 0.018} y={Math.max(H * 0.04, sky.horizonY - H * 0.015)}
                fill="var(--wheel-horizon, var(--dim))" fontSize={H * 0.025} fontFamily="var(--mono, monospace)">
                Horizon 0°
              </text>
            </g>
          )}
          {overlays && (
            <g>
              {(overlays.constellations?.lines ?? []).map((ln, i) => (
                <polyline key={`c${i}`} points={ln.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke="var(--wheel-meridian, var(--accent))" strokeOpacity={0.45} strokeWidth={H * 0.0025} />
              ))}
              {(overlays.ecliptic ?? []).map((ln, i) => (
                <polyline key={`e${i}`} points={ln.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke="var(--wheel-ecliptic, var(--warm))" strokeOpacity={0.85} strokeWidth={H * 0.0038}
                  strokeDasharray={`${H * 0.018} ${H * 0.012}`} />
              ))}
              {(overlays.constellations?.labels ?? []).map((m, i) => (
                <text key={`cl${i}`} x={m.x} y={m.y} fill="var(--dim)" opacity={0.85} textAnchor="middle"
                  fontSize={H * 0.024} fontFamily="var(--mono, monospace)">{m.text}</text>
              ))}
              {(overlays.signs ?? []).map((m, i) => (
                <text key={`s${i}`} x={m.x} y={m.y} fill="var(--wheel-sign, var(--dim))" textAnchor="middle"
                  fontSize={H * 0.032} fontFamily="var(--mono, monospace)">{m.text}</text>
              ))}
              {(overlays.houses ?? []).map((m, i) => (
                <text key={`h${i}`} x={m.x} y={m.y} fill="var(--accent)" textAnchor="middle"
                  fontSize={H * 0.028} fontFamily="var(--mono, monospace)">{m.text}</text>
              ))}
            </g>
          )}
          {bodies.map((b) => {
            const isStar = b.id.startsWith("star:");
            const r = b.id === "sun" || b.id === "moon"
              ? Math.max(b.sizePx / 2, dotR) : b.sizePx > 0 ? Math.max(b.sizePx / 2, dotR * 0.7) : dotR * 0.6;
            const isSelected = selectedBody === b.id;
            const isHighlighted = activeBody === b.id;
            const isDimmed = !isStar && activeBody !== null && !isHighlighted;
            const handlers = !isStar && interactive
              ? {
                  style: { cursor: onSelectBody ? "pointer" : undefined },
                  onClick: onSelectBody ? () => onSelectBody(selectedBody === b.id ? null : b.id) : undefined,
                  onMouseEnter: onHoverBody ? () => onHoverBody(b.id) : undefined,
                  onMouseLeave: onHoverBody ? () => onHoverBody(null) : undefined,
                }
              : {};
            return (
              <g key={b.id}
                data-body={!isStar ? b.id : undefined}
                data-selected={isSelected ? "true" : undefined}
                data-highlighted={isHighlighted ? "true" : undefined}
                data-dimmed={isDimmed ? "true" : undefined}
                opacity={isDimmed ? 0.3 : 1}
                {...handlers}>
                <title>{`${b.name} · (${b.x}, ${b.y})${b.magnitude !== null ? ` · mag ${b.magnitude}` : ""}`}</title>
                {isHighlighted && (
                  <circle cx={b.x} cy={b.y} r={r + H * 0.022} fill="none" stroke="var(--accent)" strokeWidth={H * 0.0035} />
                )}
                <circle cx={b.x} cy={b.y} r={r} fill={colorOf(b.id)} opacity={b.nakedEye ? 0.96 : 0.5} />
                {!isStar && (
                  <text x={b.x + r + H * 0.012} y={b.y + H * 0.01} fill="var(--text)"
                    fontSize={H * 0.029} fontFamily="var(--mono, monospace)">
                    {b.name}
                  </text>
                )}
              </g>
            );
          })}
          {/* Direct aim readout in upper-left corner */}
          <text x={W * 0.018} y={H * 0.048} fill="var(--dim)" fontSize={H * 0.025} fontFamily="var(--mono, monospace)">
            {`${aim.compass} (${aim.azimuthDeg}°) · alt ${aim.altitudeDeg}° · ${lens.hfovDeg}°×${lens.vfovDeg}°`}
          </text>
        </svg>
      </div>

      <div className="telemetry">
        <div className="telemetry__item">
          <span className="telemetry__label">Twilight</span>
          <span className="telemetry__val">{sky.twilight}</span>
        </div>
        <div className="telemetry__item">
          <span className="telemetry__label">Sun</span>
          <span className="telemetry__val">{sky.sunAltitudeDeg}° alt / {sky.sunAzimuthDeg}° az</span>
        </div>
        <div className="telemetry__item">
          <span className="telemetry__label">Limiting mag</span>
          <span className="telemetry__val">{sky.limitingMag}</span>
        </div>
        <div className="telemetry__item">
          <span className="telemetry__label">Moon</span>
          <span className="telemetry__val">
            {sky.moonIllum !== null ? `${Math.round(sky.moonIllum * 100)}% lit` : "n/a"}
            {sky.moonAltitudeDeg !== null ? ` · ${sky.moonAltitudeDeg}°` : ""}
          </span>
        </div>
        {result.starfield.count > 0 && (
          <div className="telemetry__item">
            <span className="telemetry__label">Stars</span>
            <span className="telemetry__val">
              {result.starfield.count}{result.starfield.complete ? " complete" : ""}
            </span>
          </div>
        )}
      </div>

      {bodies.length > 0 && (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table data-table--interactive mono">
            <thead>
              <tr>
                <th>Body</th>
                <th>Pixel (x, y)</th>
                <th>Angular size</th>
                <th>Mag</th>
                <th>Phase / note</th>
              </tr>
            </thead>
            <tbody>
              {bodies.map((b) => {
                const isStar = b.id.startsWith("star:");
                const isSelected = !isStar && selectedBody === b.id;
                const isHighlighted = !isStar && hoveredBody === b.id;
                return (
                  <tr
                    key={b.id}
                    data-selected={isSelected ? "true" : undefined}
                    data-highlighted={isHighlighted ? "true" : undefined}
                    onClick={!isStar && onSelectBody ? () => onSelectBody(selectedBody === b.id ? null : b.id) : undefined}
                    onMouseEnter={!isStar && onHoverBody ? () => onHoverBody(b.id) : undefined}
                    onMouseLeave={!isStar && onHoverBody ? () => onHoverBody(null) : undefined}
                  >
                    <td>{b.name}</td>
                    <td className="mute">({b.x}, {b.y})</td>
                    <td className="mute">{b.sizePx > 0 ? `${b.sizePx}px` : "point"}</td>
                    <td className="mute">{b.magnitude !== null ? `m${b.magnitude}` : ""}</td>
                    <td className="mute">
                      {b.phaseName ? `${b.phaseName}, limb ${b.brightLimbClock}` : b.note ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {bodies.length === 0 && (
        <p className="dim small">No bodies in this frame. Try a wider lens or a different aim.</p>
      )}

      {offFrame.length > 0 && (
        <p className="dim small">
          Just out of frame: {offFrame.map((o) => `${o.name} (${o.side}, ${o.deltaDeg}°)`).join(", ")}
        </p>
      )}

      <p className="dim small">Milky Way: {milkyWay.note}.</p>

      <div className="row row--wrap row--between">
        <strong className="small mono">Image prompt &amp; render plan</strong>
        <div className="row">
          <button type="button" className="btn btn-sm btn-ghost mono" onClick={() => onCopy(prompt)}>
            {copied ? "Copied" : "Copy prompt"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost mono"
            onClick={() => onCopy(JSON.stringify(result.renderPlan, null, 2))}
            title="A machine-readable hybrid-render contract: a body-free background-plate prompt plus the computed layers to composite locally"
          >
            Copy render plan (JSON)
          </button>
        </div>
      </div>
      <p className="dim small">
        The render plan separates a body-free background plate (for an image model) from the computed
        layers (bodies, stars, Milky Way, overlays) to composite locally.
      </p>
      <pre className="codeblock">{prompt}</pre>
    </div>
  );
}
