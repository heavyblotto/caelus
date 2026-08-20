"use client";

import { useEffect, useMemo, useState } from "react";
import {
  interpretationContext, interpret, reconcile, enrichContextOptions,
  enrichSynastryOptions, julianDay,
  type Chart, type Engine, type FactAtom, type InterpretationSource,
  type ReadingGroup, type Zodiac,
} from "caelus";
import { FAMILY_NOTES } from "caelus-corpus/notes";

const MAX_GROUPS = 16;
const MAX_PER_GROUP = 3;
const MAX_TEXT = 260;

const truncate = (s: string) =>
  s.length <= MAX_TEXT ? s : `${s.slice(0, s.lastIndexOf(" ", MAX_TEXT)).trim()}…`;

/** The corpus family a rule came from, carried as a `family:<name>` tag. */
function familyOf(tags: string[] | undefined): string | null {
  const t = (tags ?? []).find((x) => x.startsWith("family:"));
  return t ? t.slice("family:".length).replace(/-/g, " ") : null;
}

export interface ReadingTabProps {
  chart: Chart;
  engine: Engine;
  lat: number;
  lonEast: number;
  zodiac: Zodiac;
  stars: { body: string; star: string; orb: number }[];
  lots: { lot: string; sign: string; signDeg: number; house: number }[];
  /** When set, project synastry/composite atoms against this partner chart. */
  partner?: { chart: Chart; label?: string };
}

/**
 * The interpretation layer, live in the browser: project the chart into fact
 * atoms (natal, transits, time-lords, synastry/composite when paired, finer
 * dignities, and sidereal structure when applicable), run the Caelus corpus
 * over them, and show the reconciled, cited reading.
 *
 * The corpus batches load on demand (one chunk per batch via the package's
 * subpath exports); the relationship batch loads only when a partner chart
 * is present. Everything stays in the browser.
 */
export default function ReadingTab({
  chart, engine, lat, lonEast, zodiac, stars, lots, partner,
}: ReadingTabProps) {
  const withPartner = Boolean(partner);
  const [sources, setSources] = useState<InterpretationSource[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [natal, transits, timing, relationship] = await Promise.all([
        import("caelus-corpus/natal"),
        import("caelus-corpus/transits"),
        import("caelus-corpus/timing"),
        withPartner ? import("caelus-corpus/relationship") : Promise.resolve(null),
      ]);
      if (!alive) return;
      setSources([
        ...natal.natalSources,
        ...transits.transitSources,
        ...timing.timingSources,
        ...(relationship ? relationship.relationshipSources : []),
      ]);
    })();
    return () => { alive = false; };
  }, [withPartner]);

  const computed = useMemo(() => {
    if (!sources) return null;
    const now = new Date();
    const targetJd = julianDay(
      now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
      now.getUTCHours(), now.getUTCMinutes(),
    );
    const ctx = interpretationContext(chart, {
      stars, lots,
      ...enrichContextOptions(engine, chart, { jd: targetJd, lat, lonEast, zodiac }),
      ...(partner ? enrichSynastryOptions(engine, chart, partner.chart) : {}),
    });
    const reading = interpret(ctx, sources);
    const grouped = reconcile(reading, { dedupe: true });
    const kinds = new Set(ctx.atoms.map((a) => a.kind));
    const firedRules = reading.entries.map((e) => e.rule);
    return {
      groups: grouped,
      atomById: new Map(ctx.atoms.map((a) => [a.id, a] as const)),
      statements: reading.entries.length,
      notes: FAMILY_NOTES.filter((n) => firedRules.some((r) => n.appliesTo(r))),
      enriched: kinds.has("transit") || kinds.has("timelord")
        || kinds.has("synastry") || kinds.has("composite"),
    };
  }, [sources, chart, engine, lat, lonEast, zodiac, stars, lots, partner]);

  if (!computed) {
    return (
      <p className="dim small" style={{ marginTop: 0 }}>
        Loading the corpus…
      </p>
    );
  }

  const { groups, atomById, statements, notes, enriched } = computed;

  // The most prominent fact a group is about, to label it.
  const factOf = (g: ReadingGroup): FactAtom | undefined => {
    let best: FactAtom | undefined;
    for (const id of g.atomIds) {
      const a = atomById.get(id);
      if (a && (!best || a.salience > best.salience)) best = a;
    }
    return best;
  };

  if (!groups.length) {
    return (
      <p className="dim small" style={{ marginTop: 0 }}>
        No corpus essay matched this chart&rsquo;s facts.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.85rem" }}>
      <p className="dim small" style={{ margin: 0 }}>
        <strong style={{ color: "var(--text)" }}>{statements}</strong> essays from the Caelus
        corpus, each citing the validated facts it rests on.
        {partner ? (
          <> Includes synastry/composite atoms plus transits and time-lords active{" "}
            <strong style={{ color: "var(--text)" }}>now</strong>.</>
        ) : enriched ? (
          <> Includes transits and time-lords active <strong style={{ color: "var(--text)" }}>now</strong>.</>
        ) : null}
      </p>

      {groups.slice(0, MAX_GROUPS).map((g, gi) => {
        const fact = factOf(g);
        const extra = g.entries.length - MAX_PER_GROUP;
        return (
          <div key={gi} style={{ borderLeft: "2px solid var(--border-strong)", paddingLeft: "0.8rem" }}>
            {fact && (
              <div className="mono" style={{ color: "var(--accent)", fontSize: "0.78rem", marginBottom: "0.3rem" }}>
                {fact.text} <span className="mute">[{fact.id}]</span>
              </div>
            )}
            {g.entries.slice(0, MAX_PER_GROUP).map((e, ei) => {
              const family = familyOf(e.tags);
              return (
                <div key={ei} style={{ margin: ei ? "0.55rem 0 0" : 0 }}>
                  <span style={{ color: "var(--text)" }}>{truncate(e.text)}</span>
                  <div className="mono mute" style={{ fontSize: "0.66rem", marginTop: "0.15rem" }}>
                    {family && (
                      <span style={{ fontStyle: "italic", marginRight: "0.6rem" }}>{family}</span>
                    )}
                    {e.atomIds.map((id) => (
                      <span key={id} style={{ marginRight: "0.5rem", whiteSpace: "nowrap" }}>[{id}]</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {extra > 0 && (
              <p className="dim small" style={{ margin: "0.35rem 0 0" }}>
                + {extra} more said about this fact.
              </p>
            )}
          </div>
        );
      })}

      {groups.length > MAX_GROUPS && (
        <p className="dim small" style={{ margin: 0 }}>
          + {groups.length - MAX_GROUPS} more facts with delineations.
        </p>
      )}

      {notes.map((n) => (
        <p key={n.id} className="dim small" style={{ margin: 0 }}>
          {n.note}
        </p>
      ))}

      <p className="dim small" style={{ margin: 0 }}>
        The Caelus corpus: original essays written against the engine&rsquo;s fact atoms
        (natal, transit, time-lord, and dignity ids), all{" "}
        <code>auditCitations</code>-checkable. See the{" "}
        <a href="/docs/interpretation">interpretation layer</a>.
      </p>
    </div>
  );
}
