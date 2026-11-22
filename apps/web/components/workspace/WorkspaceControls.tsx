"use client";

import type { Dispatch, SetStateAction } from "react";
import type { HouseSystem, Zodiac } from "caelus";
import CityPicker, { type City } from "../CityPicker";
import type { KundliStyle, Share, Tradition } from "../../lib/share";
import type { DocKind } from "./util";
import { PLAYGROUND_PRESETS, QUICK_CITIES, type PlaygroundPreset } from "./presets";

const SYSTEMS: HouseSystem[] = [
  "placidus", "whole_sign", "equal", "porphyry",
  "koch", "regiomontanus", "campanus", "alcabitius",
  "morinus", "meridian", "polich_page", "vehlow",
];

const ZODIACS: Array<[string, Zodiac]> = [
  ["tropical", "tropical"],
  ["sidereal · lahiri", "sidereal:lahiri"],
  ["sidereal · fagan/bradley", "sidereal:fagan_bradley"],
  ["sidereal · krishnamurti", "sidereal:krishnamurti"],
  ["sidereal · raman", "sidereal:raman"],
  ["sidereal · yukteshwar", "sidereal:yukteshwar"],
];

export interface WorkspaceControlsProps {
  activePreset: string | null;
  onSelectPreset: (preset: PlaygroundPreset) => void;
  onJumpNow: () => void;
  tradition: Tradition;
  onSwitchTradition: (t: Tradition) => void;
  kundliStyle: KundliStyle;
  setKundliStyle: Dispatch<SetStateAction<KundliStyle>>;
  advanced: boolean;
  setAdvanced: Dispatch<SetStateAction<boolean>>;
  docKind: DocKind;
  onSwitchDocKind: (kind: DocKind) => void;
  iso: string;
  setIso: Dispatch<SetStateAction<string>>;
  lat: string;
  setLat: (v: string) => void;
  lon: string;
  setLon: (v: string) => void;
  sys: HouseSystem;
  setSys: (v: HouseSystem) => void;
  zodiac: Zodiac;
  setZodiac: (v: Zodiac) => void;
  tzMode: "utc" | "local";
  setTzMode: Dispatch<SetStateAction<"utc" | "local">>;
  place: string;
  setPlace: Dispatch<SetStateAction<string>>;
  label: string;
  setLabel: Dispatch<SetStateAction<string>>;
  timeUnknown: boolean;
  setTimeUnknown: (v: boolean) => void;
  topocentric: boolean;
  setTopocentric: Dispatch<SetStateAction<boolean>>;
  extras: boolean;
  setExtras: Dispatch<SetStateAction<boolean>>;
  spatial: boolean;
  setSpatial: Dispatch<SetStateAction<boolean>>;
  orbOverride: string;
  setOrbOverride: Dispatch<SetStateAction<string>>;
  set: Share[];
  hasChart: boolean;
  copied: boolean;
  jsonCopied: boolean;
  collectionCopied: boolean;
  codeOpen: boolean;
  onToggleCode: () => void;
  onShare: () => void;
  onCopyJson: () => void;
  onAddToSet: () => void;
  onShareSet: () => void;
  onLoadShare: (s: Share) => void;
  onRemoveFromSet: (i: number) => void;
  statusMessage: string;
}

export default function WorkspaceControls({
  activePreset,
  onSelectPreset,
  onJumpNow,
  tradition,
  onSwitchTradition,
  kundliStyle,
  setKundliStyle,
  advanced,
  setAdvanced,
  docKind,
  onSwitchDocKind,
  iso,
  setIso,
  lat,
  setLat,
  lon,
  setLon,
  sys,
  setSys,
  zodiac,
  setZodiac,
  tzMode,
  setTzMode,
  place,
  setPlace,
  label,
  setLabel,
  timeUnknown,
  setTimeUnknown,
  topocentric,
  setTopocentric,
  extras,
  setExtras,
  spatial,
  setSpatial,
  orbOverride,
  setOrbOverride,
  set,
  hasChart,
  copied,
  jsonCopied,
  collectionCopied,
  codeOpen,
  onToggleCode,
  onShare,
  onCopyJson,
  onAddToSet,
  onShareSet,
  onLoadShare,
  onRemoveFromSet,
  statusMessage,
}: WorkspaceControlsProps) {
  const [datePart, timePart] = (iso || "2000-08-22T12:00").split("T");

  return (
    <>
      <section className="tile s12" aria-label="Quick presets">
        <div className="tile__h">
          <b>PRESET</b>
          <span>Instant charts</span>
          <i>{PLAYGROUND_PRESETS.length} presets</i>
        </div>
        <div className="tile__b tile__b--compact row row--between row--wrap">
          <div className="preset-bar" role="group" aria-label="Instant chart presets">
            {PLAYGROUND_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip preset-chip"
                aria-pressed={activePreset === p.id}
                title={p.summary}
                onClick={() => onSelectPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="row row--wrap">
            <button type="button" className="btn btn-primary btn-sm" onClick={onJumpNow}>
              Now
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onShare}>
              {copied ? "Link copied" : "Share URL"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!hasChart}
              onClick={onCopyJson}
            >
              {jsonCopied ? "JSON copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-pressed={codeOpen}
              onClick={onToggleCode}
            >
              {codeOpen ? "Hide code" : "Code call"}
            </button>
          </div>
        </div>
      </section>

      <section className="tile s12" aria-label="Chart document controls">
        <div className="tile__h">
          <b>DOC</b>
          <span>{place || label || "Chart parameters"}</span>
          <i>{tradition} · {advanced ? "advanced" : "casual"}</i>
        </div>

        <div className="tile__b stack--sm">
          <div className="row row--between row--wrap">
            <div className="row row--wrap">
              <div className="seg" role="group" aria-label="Tradition">
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={tradition === "western"}
                  onClick={() => onSwitchTradition("western")}
                >
                  Western
                </button>
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={tradition === "vedic"}
                  onClick={() => onSwitchTradition("vedic")}
                >
                  Vedic
                </button>
              </div>
              {tradition === "vedic" && (
                <div className="seg" role="group" aria-label="Kundli style">
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={kundliStyle === "north"}
                    onClick={() => setKundliStyle("north")}
                  >
                    North
                  </button>
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={kundliStyle === "south"}
                    onClick={() => setKundliStyle("south")}
                  >
                    South
                  </button>
                </div>
              )}
            </div>
            <div className="seg" role="group" aria-label="Interface depth">
              <button
                type="button"
                className="seg__btn"
                aria-pressed={!advanced}
                onClick={() => setAdvanced(false)}
              >
                Casual
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={advanced}
                onClick={() => setAdvanced(true)}
              >
                Advanced
              </button>
            </div>
          </div>
          {docKind === "birth" ? (
            <div className="controls">
              <div className="field field--place">
                <span className="field__label">place</span>
                <CityPicker
                  placeholder={place || "search city..."}
                  onSelect={(c: City) => {
                    setLat(String(c.lat));
                    setLon(String(c.lon));
                    setPlace(`${c.name}, ${c.country}`);
                    setTzMode("local");
                  }}
                />
              </div>

              <div className="field field--date">
                <span className="field__label">date</span>
                <input
                  className="control"
                  type="date"
                  value={datePart ?? ""}
                  onChange={(e) => {
                    if (e.target.value) setIso(`${e.target.value}T${timeUnknown ? "12:00" : (timePart || "12:00")}`);
                  }}
                  aria-label="Chart date"
                />
              </div>

              {!timeUnknown && (
                <div className="field field--time">
                  <span className="field__label">time</span>
                  <div className="field__row">
                    <input
                      className="control"
                      type="time"
                      value={timePart ?? "12:00"}
                      onChange={(e) => {
                        if (e.target.value && datePart) setIso(`${datePart}T${e.target.value}`);
                      }}
                      aria-label={tzMode === "local" ? "Local birth time" : "UTC time"}
                    />
                    <select
                      className="control"
                      value={tzMode}
                      onChange={(e) => setTzMode(e.target.value as "utc" | "local")}
                      aria-label="Time zone mode"
                    >
                      <option value="utc">UTC</option>
                      <option value="local">Local</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="field field--select">
                <span className="field__label">houses</span>
                <select
                  className="control"
                  value={sys}
                  onChange={(e) => setSys(e.target.value as HouseSystem)}
                  aria-label="House system"
                >
                  {SYSTEMS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="field field--select">
                <span className="field__label">zodiac</span>
                <select
                  className="control"
                  value={zodiac}
                  onChange={(e) => setZodiac(e.target.value as Zodiac)}
                  aria-label="Zodiac"
                >
                  {ZODIACS.map(([zlabel, value]) => (
                    <option key={value} value={value}>{zlabel}</option>
                  ))}
                </select>
              </div>

              <div className="field field--actions">
                <span className="field__label">options</span>
                <div className="field__row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={timeUnknown}
                      onChange={(e) => setTimeUnknown(e.target.checked)}
                    />
                    clock unknown
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onAddToSet}
                    disabled={!hasChart}
                    title="Save this chart into My charts for synastry or multi-chart sharing"
                  >
                    + Save chart
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="controls">
              <div className="field field--name">
                <span className="field__label">form name</span>
                <input
                  className="control"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="field field--actions">
                <span className="field__label">actions</span>
                <div className="field__row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onAddToSet}>
                    + Save form
                  </button>
                </div>
              </div>
            </div>
          )}

          {advanced && (
            <div className="workspace__adv-row">
              <div className="seg" role="group" aria-label="Document kind">
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={docKind === "birth"}
                  onClick={() => onSwitchDocKind("birth")}
                >
                  Birth chart
                </button>
                <button
                  type="button"
                  className="seg__btn"
                  aria-pressed={docKind === "form"}
                  onClick={() => onSwitchDocKind("form")}
                >
                  Archetypal form
                </button>
              </div>
              {docKind === "birth" && (
                <>
                  <div className="field field--coord">
                    <span className="field__label">lat</span>
                    <input
                      className="control mono"
                      value={lat}
                      onChange={(e) => { setLat(e.target.value); setPlace(""); }}
                      aria-label="Latitude"
                    />
                  </div>
                  <div className="field field--coord">
                    <span className="field__label">lon</span>
                    <input
                      className="control mono"
                      value={lon}
                      onChange={(e) => { setLon(e.target.value); setPlace(""); }}
                      aria-label="Longitude east positive"
                    />
                  </div>
                  <div className="field field--name">
                    <span className="field__label">label</span>
                    <input
                      className="control"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="optional"
                      aria-label="Chart label"
                    />
                  </div>
                  <div className="field field--compact">
                    <span className="field__label">orb °</span>
                    <input
                      className="control mono"
                      value={orbOverride}
                      onChange={(e) => setOrbOverride(e.target.value)}
                      placeholder="def"
                      aria-label="Aspect orb override"
                    />
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={topocentric} onChange={(e) => setTopocentric(e.target.checked)} />
                    topocentric
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)} />
                    extra bodies
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={spatial} onChange={(e) => setSpatial(e.target.checked)} />
                    spatial aspects
                  </label>
                </>
              )}
              <div className="row row--wrap" role="group" aria-label="Quick city coordinates">
                {QUICK_CITIES.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setLat(c.lat);
                      setLon(c.lon);
                      setPlace(c.place);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {set.length > 0 && (
            <div className="chart-tray" aria-label="Saved charts">
              <span className="badge badge--muted">My charts ({set.length})</span>
              {set.map((s, i) => (
                <span key={i} className="chart-chip">
                  <button
                    type="button"
                    className="chart-chip__load"
                    onClick={() => onLoadShare(s)}
                    title="Load this chart"
                  >
                    {s.n || `Chart ${i + 1}`}
                  </button>
                  <button
                    type="button"
                    className="chart-chip__remove"
                    onClick={() => onRemoveFromSet(i)}
                    aria-label={`Remove ${s.n || `chart ${i + 1}`}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={onShareSet}>
                {collectionCopied ? "Set link copied" : `Share ${set.length} chart${set.length > 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {statusMessage && (
            <p className="status-live dim small" role="status" aria-live="polite">
              {statusMessage}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
