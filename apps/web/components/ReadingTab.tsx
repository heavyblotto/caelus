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
  s.length <= MAX_TEXT ? s : `${s.slice(0, s.lastIndexOf(" ", MAX_TEXT)).trim()}...`;

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
  /** Optional focused body from figure selection; bubbles matching essays to the top. */
  selectedBody?: string | null;
}

export default function ReadingTab({
  chart, engine, lat, lonEast, zodiac, stars, lots, partner, selectedBody,
}: ReadingTabProps) {
  const withPartner = Boolean(partner);
  const [sources, setSources] = useState<InterpretationSource[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [natal, conditions, degrees, transits, timing, relationship] = await Promise.all([
        import("caelus-corpus/natal"),
        import("caelus-corpus/conditions"),
        import("caelus-corpus/degrees"),
        import("caelus-corpus/transits"),
        import("caelus-corpus/timing"),
        withPartner ? import("caelus-corpus/relationship") : Promise.resolve(null),
      ]);
      if (!alive) return;
      setSources([
        ...natal.natalSources,
        ...conditions.conditionSources,
        ...degrees.degreeSources,
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
    const isLiveNow = Math.abs(targetJd - chart.jdUt) < 0.25;
    const ctx = interpretationContext(chart, {
      stars,
      lots,
      ...(isLiveNow ? {} : enrichContextOptions(engine, chart, { jd: targetJd, lat, lonEast, zodiac })),
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
    return <p className="dim small">Loading the corpus...</p>;
  }

  const { groups, atomById, statements, notes, enriched } = computed;

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
      <p className="dim small">
        No corpus essay matched this chart&rsquo;s facts.
      </p>
    );
  }

  const orderedGroups = selectedBody
    ? [...groups].sort((a, b) => {
        const aHit = a.atomIds.some((id) => id.includes(selectedBody)) ? 0 : 1;
        const bHit = b.atomIds.some((id) => id.includes(selectedBody)) ? 0 : 1;
        return aHit - bHit;
      })
    : groups;

  return (
    <div className="workspace__panel rail-stack">
      <p className="dim small">
        <strong>{statements}</strong> essays from the Caelus corpus, each citing the validated facts it rests on.
        {selectedBody ? (
          <> Showing <span className="badge badge--accent mono">{selectedBody}</span> matches first.</>
        ) : partner ? (
          <> Includes synastry/composite atoms plus active transits and time-lords.</>
        ) : enriched ? (
          <> Includes transits and time-lords active now.</>
        ) : null}
      </p>

      {orderedGroups.slice(0, MAX_GROUPS).map((g, gi) => {
        const fact = factOf(g);
        const extra = g.entries.length - MAX_PER_GROUP;
        const matchesBody = Boolean(selectedBody && g.atomIds.some((id) => id.includes(selectedBody)));
        return (
          <article
            key={gi}
            className="reading-group"
            data-selected={matchesBody ? "true" : undefined}
          >
            {fact && (
              <div className="reading-group__fact mono">
                {fact.text} <span className="mute">[{fact.id}]</span>
              </div>
            )}
            {g.entries.slice(0, MAX_PER_GROUP).map((e, ei) => {
              const family = familyOf(e.tags);
              return (
                <div key={ei} className="reading-group__entry">
                  <span>{truncate(e.text)}</span>
                  <div className="reading-meta mono mute">
                    {family && <span className="reading-meta__family">{family}</span>}
                    {e.atomIds.map((id) => (
                      <span key={id} className="reading-meta__atom">[{id}]</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {extra > 0 && (
              <p className="dim small">+ {extra} more said about this fact.</p>
            )}
          </article>
        );
      })}

      {orderedGroups.length > MAX_GROUPS && (
        <p className="dim small">+ {orderedGroups.length - MAX_GROUPS} more facts with delineations.</p>
      )}

      {notes.map((n) => (
        <p key={n.id} className="dim small">{n.note}</p>
      ))}

      <p className="dim small">
        The Caelus corpus: original essays written against the engine&rsquo;s fact atoms
        (natal, conditions, degree, transit, and time-lord ids), all{" "}
        <code>auditCitations</code>-checkable. See the{" "}
        <a href="/docs/interpretation">interpretation layer</a>.
      </p>
    </div>
  );
}
