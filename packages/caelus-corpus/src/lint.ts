/**
 * Corpus lints for the corpus voice (build-plan stream D): length bands per
 * cell family, banned phrases, reading level, and near-duplicate detection.
 * The binding harness proves a passage attaches to legal geometry; these
 * prove the prose holds the register the voice sheet demands. Both run in
 * the package test, so a failing entry cannot ship.
 */
import { LENGTH_BANDS } from "./types.js";
import type { Passage } from "./types.js";

export interface LintFinding {
  id: string;
  rule: string;
  detail: string;
}

/** Phrases the voice sheet bans: model-cadence tells, doom language, and
 *  directive advice the content-safety rules exclude. Lowercase substrings. */
export const BANNED_PHRASES: string[] = [
  // model-cadence tells (docs/ai-slop-style-sheet.md)
  "delve", "tapestry", "testament to", "multifaceted", "unpack",
  "beacon", "resonate", "pivotal", "holistic", "landscape of",
  "embark on", "journey of self", "unlock your", "harness the",
  "dive into", "navigate the", "it's important to note",
  "in conclusion", "ultimately,", "at its core,", "vibrant",
  "rich inner world", "unique blend", "powerful energy",
  // genre filler
  "cosmic dance", "the universe has", "the stars have plans",
  "written in the stars", "align with your true",
  // fatalism (the non-fatalistic rule)
  "doomed", "cursed", "you will never", "you are destined to",
  "there is nothing you can do", "inevitable downfall", "tragedy will",
  // directive medical / financial / legal advice
  "you should invest", "stop taking", "your medication", "see a lawyer",
  "you should divorce", "quit your job", "diagnosis",
];

const wordCount = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

/** Crude but stable syllable estimate for the reading-level gate. */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch-Kincaid grade level. The corpus targets plain speech: grade <= 12
 *  per entry (most entries land well under). */
export function fkGrade(text: string): number {
  const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  if (sentences.length === 0 || words.length === 0) return 0;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

export function lintPassage(p: Passage): LintFinding[] {
  const findings: LintFinding[] = [];
  const text = p.text;
  const lower = text.toLowerCase();

  const band = LENGTH_BANDS[p.family];
  const words = wordCount(text);
  if (words < band.min || words > band.max) {
    findings.push({
      id: p.id, rule: "length-band",
      detail: `${words} words; ${p.family} band is ${band.min}-${band.max}`,
    });
  }

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      findings.push({ id: p.id, rule: "banned-phrase", detail: `"${phrase}"` });
    }
  }

  if (/—|&mdash;/.test(text)) {
    findings.push({ id: p.id, rule: "em-dash", detail: "em dash in prose" });
  }

  if (!/\byou\b|\byour\b/i.test(text)) {
    findings.push({
      id: p.id, rule: "second-person",
      detail: "entry never addresses the reader",
    });
  }

  const grade = fkGrade(text);
  if (grade > 12) {
    findings.push({
      id: p.id, rule: "reading-level",
      detail: `Flesch-Kincaid grade ${grade.toFixed(1)} (max 12)`,
    });
  }

  return findings;
}

/** Word 4-gram shingles for near-duplicate detection. */
function shingles(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 4 <= words.length; i++) out.add(words.slice(i, i + 4).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Flag pairs within a family whose 4-gram similarity exceeds the cap.
 *  Formulaic sameness is exactly what the Hand standard rules out. */
export function lintDuplication(
  passages: Passage[], cap = 0.2,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const sets = passages.map((p) => ({ id: p.id, sh: shingles(p.text) }));
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const sim = jaccard(sets[i].sh, sets[j].sh);
      if (sim > cap) {
        findings.push({
          id: sets[i].id, rule: "duplication",
          detail: `${(sim * 100).toFixed(0)}% shingle overlap with ${sets[j].id} (cap ${cap * 100}%)`,
        });
      }
    }
  }
  return findings;
}

/** Sentences, normalized for comparison (case, punctuation, whitespace). */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.split(" ").length >= 6); // ignore fragments and asides
}

/**
 * Flag a whole sentence that appears verbatim in more than one entry of a
 * family. The Jaccard cap above measures how much of two essays overlap,
 * which a single shared sentence never moves in a 300-word entry -- but a
 * reader of two essays notices the repeat immediately. This catches what
 * the ratio cannot.
 */
export function lintSharedSentences(
  passages: Passage[],
): LintFinding[] {
  const seen = new Map<string, string>();
  const findings: LintFinding[] = [];
  for (const p of passages) {
    for (const s of new Set(sentences(p.text))) {
      const first = seen.get(s);
      if (first === undefined) { seen.set(s, p.id); continue; }
      findings.push({
        id: p.id, rule: "shared-sentence",
        detail: `repeats a sentence from ${first}: "${s.slice(0, 60)}…"`,
      });
    }
  }
  return findings;
}

/** Sentences as normalized word arrays, for order-aware comparison. */
function sentenceWords(text: string): string[][] {
  return sentences(text).map((s) => s.split(" "));
}

/** Length of the longest common subsequence of two token arrays. */
function lcs(a: string[], b: string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  let cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[b.length];
}

/**
 * Flag two sentences in a family that are near-identical -- the same
 * sentence with a word swapped.
 *
 * `lintSharedSentences` only catches a *verbatim* repeat, so a formula
 * survives it as long as each writer changes one word. The B3 composite
 * wave produced eight variations on "each pole supplies what the other
 * lacks" across eight slices written in parallel; every one passed every
 * lint, and a reader who opened two of them would see the template at
 * once. This closes that gap.
 *
 * Similarity is order-aware (longest common subsequence over words, as a
 * fraction of the two lengths), because the defect is a reused sentence
 * *shape*, not a reused vocabulary. Bag-of-words scoring misses it: the
 * two sentences above share only five words out of ten.
 *
 * Candidate pairs are pruned to sentences sharing a word 4-gram, which
 * keeps a large family from going quadratic over every sentence pair.
 */
export function lintNearDuplicateSentences(
  passages: Passage[], threshold = 0.8,
): LintFinding[] {
  const all: { id: string; words: string[] }[] = [];
  for (const p of passages) {
    for (const words of sentenceWords(p.text)) all.push({ id: p.id, words });
  }
  // Bucket by shared 4-gram; only sentences sharing one can be near-dupes.
  const buckets = new Map<string, number[]>();
  for (let n = 0; n < all.length; n++) {
    const w = all[n].words;
    for (const g of new Set(
      Array.from({ length: Math.max(0, w.length - 3) },
        (_, k) => w.slice(k, k + 4).join(" ")),
    )) {
      (buckets.get(g) ?? buckets.set(g, []).get(g)!).push(n);
    }
  }
  const pairs = new Set<string>();
  for (const idxs of buckets.values()) {
    if (idxs.length < 2 || idxs.length > 200) continue; // skip boilerplate n-grams
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        if (all[idxs[a]].id !== all[idxs[b]].id) {
          pairs.add(`${Math.min(idxs[a], idxs[b])},${Math.max(idxs[a], idxs[b])}`);
        }
      }
    }
  }
  const findings: LintFinding[] = [];
  const reported = new Set<string>();
  for (const key of pairs) {
    const [x, y] = key.split(",").map(Number);
    const a = all[x], b = all[y];
    const sa = a.words.join(" "), sb = b.words.join(" ");
    if (sa === sb) continue; // a verbatim repeat is lintSharedSentences' finding
    const sim = (2 * lcs(a.words, b.words)) / (a.words.length + b.words.length);
    if (sim < threshold) continue;
    // Report against BOTH entries, not just one. check-family decides whose
    // problem a finding is by its `id`, so a one-sided finding shows the
    // second writer a "note" naming someone else's file and lets them ship
    // the collision they just wrote.
    for (const [own, other, mine, theirs] of [
      [a, b, sa, sb], [b, a, sb, sa],
    ] as const) {
      const dedupe = `${own.id}|${mine}|${other.id}|${theirs}`;
      if (reported.has(dedupe)) continue;
      reported.add(dedupe);
      findings.push({
        id: own.id, rule: "near-duplicate-sentence",
        detail: `${(sim * 100).toFixed(0)}% the same sentence as ${other.id}: `
          + `"${mine.slice(0, 50)}…" vs "${theirs.slice(0, 50)}…"`,
      });
    }
  }
  return findings;
}

/** The first `n` words of a string, normalized. */
const head = (s: string, n: number): string =>
  s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean).slice(0, n).join(" ");

/**
 * Flag an opening or closing formula that more than `cap` of a family's
 * entries share. Sibling essays written to one brief drift into the same
 * first move ("This month the profection count arrives at your Nth
 * house") and the same last move ("You grow with this cycle by..."); each
 * reads fine alone, and the set reads like a template. Compares the first
 * and last six words, which is where the formula lives.
 */
export function lintSkeletons(
  passages: Passage[], cap = 0.34,
): LintFinding[] {
  if (passages.length < 4) return [];
  const findings: LintFinding[] = [];
  for (const [where, pick] of [
    ["opening", (t: string) => head(t, 6)],
    ["closing", (t: string) => {
      const ss = sentences(t);
      return head(ss[ss.length - 1] ?? "", 6);
    }],
  ] as const) {
    const counts = new Map<string, string[]>();
    for (const p of passages) {
      const k = pick(p.text);
      if (!k) continue;
      (counts.get(k) ?? counts.set(k, []).get(k)!).push(p.id);
    }
    for (const [k, ids] of counts) {
      if (ids.length / passages.length > cap && ids.length > 2) {
        findings.push({
          id: ids[0], rule: "skeleton",
          detail: `${ids.length} of ${passages.length} entries share this ${where} `
            + `("${k}…"): ${ids.slice(1, 4).join(", ")}${ids.length > 4 ? ", …" : ""}`,
        });
      }
    }
  }
  return findings;
}

/**
 * Flag a rhetorical *move* that a family has converged on, where no two
 * instances are near-duplicates.
 *
 * This is the defect the B3 review kept reporting by hand and asking for a
 * ruling on. Five reviewers, working blind to each other, each found the same
 * shape: eight or ten sibling essays making one argumentative move at one
 * position, in visibly different words. "The failure mode of a sextile is not
 * conflict, it is X." "Nothing insists / a trine asks nothing / no test is
 * supplied." The slow-planet cohort caveat, once per outer-planet cell. Each
 * pair sits well under the near-duplicate threshold, so the lint clears them
 * one at a time while a reader who opens two cells sees the template at once.
 *
 * The fix is to score clusters rather than pairs. Sentences are linked when
 * they are similar at a *lower* bar than a near-duplicate, and a connected
 * component drawn from enough distinct entries is a formula: no single edge
 * is damning, and a component of nine sentences across nine essays is not an
 * accident. Reporting the component rather than its edges is also what makes
 * the finding actionable, because the repair is to break the set up, not to
 * reword one member of it.
 */
export function lintFormulaClusters(
  passages: Passage[], link = 0.6, minEntries = 4,
): LintFinding[] {
  const all: { id: string; words: string[]; text: string }[] = [];
  for (const p of passages) {
    const raw = sentences(p.text);
    sentenceWords(p.text).forEach((words, i) => {
      // Short sentences share too much by chance to carry a verdict.
      if (words.length >= 8) all.push({ id: p.id, words, text: raw[i] });
    });
  }
  // Same 4-gram bucketing as the near-duplicate lint: a pair with no shared
  // 4-gram cannot reach the link threshold, and this keeps a 600-entry family
  // from going quadratic over every sentence pair.
  const buckets = new Map<string, number[]>();
  for (let n = 0; n < all.length; n++) {
    const w = all[n].words;
    for (const g of new Set(
      Array.from({ length: Math.max(0, w.length - 3) },
        (_, k) => w.slice(k, k + 4).join(" ")),
    )) {
      (buckets.get(g) ?? buckets.set(g, []).get(g)!).push(n);
    }
  }
  // Union-find over the linked pairs.
  const parent = all.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const seen = new Set<string>();
  for (const idxs of buckets.values()) {
    if (idxs.length < 2 || idxs.length > 200) continue;
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const [x, y] = [idxs[a], idxs[b]];
        if (all[x].id === all[y].id) continue;
        const key = `${Math.min(x, y)},${Math.max(x, y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const sim = (2 * lcs(all[x].words, all[y].words))
          / (all[x].words.length + all[y].words.length);
        if (sim < link) continue;
        const [rx, ry] = [find(x), find(y)];
        if (rx !== ry) parent[rx] = ry;
      }
    }
  }
  const components = new Map<number, number[]>();
  for (let i = 0; i < all.length; i++) {
    if (parent[i] === i && !seen.size) continue;
    const r = find(i);
    (components.get(r) ?? components.set(r, []).get(r)!).push(i);
  }
  const findings: LintFinding[] = [];
  for (const members of components.values()) {
    const ids = [...new Set(members.map((i) => all[i].id))];
    if (ids.length < minEntries) continue;
    // Report against every entry in the cluster: the repair is to break the
    // set up, so each writer needs to see that theirs is one of nine.
    for (const i of members) {
      findings.push({
        id: all[i].id, rule: "formula-cluster",
        detail: `one of ${ids.length} entries making this move: `
          + `"${all[i].text.slice(0, 60)}…" (also ${ids
            .filter((x) => x !== all[i].id).slice(0, 3).join(", ")}`
          + `${ids.length > 4 ? ", …" : ""})`,
      });
    }
  }
  return findings;
}

/**
 * The families a reader meets on one surface. Every lint above groups by
 * family, which is the unit a writer works in -- but it is not the unit a
 * reader reads. The Chart hub's Reading puts a body's sign essay, its house
 * essay and its aspect essays in one column; People puts the synastry,
 * overlay and composite essays for a body on one page. So a formula shared
 * between two *families* is invisible to every family-scoped lint and fully
 * visible to the reader, which is the worst combination available.
 */
const READING_SCOPES: Record<string, readonly string[]> = {
  natal: [
    "planet-in-sign", "planet-in-house", "aspect", "dignity", "pattern",
    "signature", "out-of-bounds", "natal-retrograde", "rising-sign",
    "mc-sign", "angle-conjunction",
  ],
  sky: [
    "transit-aspect", "transit-house", "transit-station", "timelord-profection",
    "timelord-zr", "timelord-firdaria", "timelord-dasha", "lunation-house",
    "eclipse", "planetary-return", "solar-phase",
  ],
  relationship: [
    "synastry-aspect", "synastry-overlay", "composite-aspect",
    "composite-placement", "composite-house",
  ],
};

/** Every body named in an id, which is how two entries end up side by side. */
const BODY_TOKENS = new Set([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus",
  "neptune", "pluto", "chiron", "true_node", "mean_node", "asc", "mc",
]);

const bodiesIn = (id: string): string[] =>
  id.split(":").filter((t) => BODY_TOKENS.has(t));

/**
 * Flag an echo between two *different* families that a reader sees together.
 *
 * The B3 waves found this by hand: several composite-house writers checked
 * their slice against the same body's sign slice and rewrote two to five
 * sentences each, because the two essays had converged on one move. Nothing
 * enforced it, and the writers who did not think to check shipped the echo.
 *
 * Grouping is by body within a reading scope, since that is what puts two
 * essays in front of one reader: Mars in Scorpio, Mars in the 8th, and Mars
 * square Pluto all render in the same Reading. Same-family pairs are left to
 * the family lints so a finding is never reported twice.
 */
export function lintCrossFamilyEchoes(
  passages: Passage[], threshold = 0.8,
): LintFinding[] {
  const scopeOf = new Map<string, string>();
  for (const [scope, families] of Object.entries(READING_SCOPES)) {
    for (const f of families) scopeOf.set(f, scope);
  }
  // One group per (scope, body). A passage naming two bodies joins both, so
  // the groups overlap; findings are deduped by entry pair below.
  const groups = new Map<string, Passage[]>();
  for (const p of passages) {
    const scope = scopeOf.get(p.family);
    if (scope === undefined) continue;
    for (const body of new Set(bodiesIn(p.id))) {
      const key = `${scope}:${body}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
    }
  }
  const family = new Map(passages.map((p) => [p.id, p.family]));
  const findings: LintFinding[] = [];
  const seen = new Set<string>();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const raw = [
      ...lintSharedSentences(list),
      ...lintNearDuplicateSentences(list, threshold),
    ];
    for (const f of raw) {
      const other = /(?:from|as) ([\w:~.-]+):/.exec(f.detail)?.[1];
      // Within-family echoes are the family lints' finding, not this one's.
      if (other === undefined || family.get(other) === family.get(f.id)) continue;
      const dedupe = `${f.rule}|${f.id}|${other}|${f.detail}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      findings.push({
        id: f.id, rule: "cross-family-echo",
        detail: `${key.split(":")[1]} in ${key.split(":")[0]}: `
          + `${family.get(f.id)} echoes ${family.get(other)} -- ${f.detail}`,
      });
    }
  }
  return findings;
}

export function lintCorpus(passages: Passage[]): LintFinding[] {
  const findings = passages.flatMap(lintPassage);
  const byFamily = new Map<string, Passage[]>();
  for (const p of passages) {
    const list = byFamily.get(p.family) ?? [];
    list.push(p);
    byFamily.set(p.family, list);
  }
  for (const group of byFamily.values()) {
    findings.push(...lintDuplication(group));
    findings.push(...lintSharedSentences(group));
    findings.push(...lintSkeletons(group));
  }
  return findings;
}
