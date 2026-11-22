import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { A, Code, H2, H3, P } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { pageMetadata } from "../../lib/seo";
import { SITE } from "../../lib/site";

export const metadata = pageMetadata({
  title: "Lab Notes",
  description:
    "Empirical R&D write-ups on Caelus: live Physical vs. Symbolic chronosense ablations (EXP-005), live observation tool-use forensics (EXP-006), a 3-seed trained 1.43M-parameter Hybrid Geo-RoPE and Google SLEEP transformer study (EXP-007), a frozen-LLM adapter kill test (EXP-012 / KILL-007), a typed-null MCP response envelope ablation (EXP-013), and seven archived hypotheses.",
  path: "/lab",
  type: "article",
  keywords: [
    "Caelus Lab",
    "Geo-RoPE",
    "SLEEP continual learning",
    "chronosense",
    "SHADOWPROOF",
    "shadow verification",
    "ephemeris benchmarks",
    "MCP tool use",
    "EXP-012",
    "EXP-013",
    "LEVELS_OF_I",
    "typed null",
  ],
});

function loadLabSvg(relPath: string): string | null {
  const candidates = [
    join(process.cwd(), "..", "..", relPath),
    join(process.cwd(), relPath),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }
  }
  return null;
}

function LabPlate({
  id,
  title,
  sourcePath,
  caption,
  svg,
}: {
  id: string;
  title: string;
  sourcePath: string;
  caption: string;
  svg: string | null;
}) {
  return (
    <figure className="tile lab-plate">
      <div className="tile__h">
        <b>{id}</b>
        <span>{title}</span>
        <i>
          <a
            href={`${SITE.repo}/blob/main/${sourcePath}`}
            target="_blank"
            rel="noreferrer"
          >
            chart.svg ↗
          </a>
        </i>
      </div>
      <div className="tile__b tile__b--flush">
        {svg ? (
          <div
            className="lab-plate__canvas"
            role="img"
            aria-label={title}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="dim small" style={{ padding: "1rem" }}>
            Chart source unavailable during build ({sourcePath}).
          </p>
        )}
      </div>
      <figcaption className="tile__f dim small">{caption}</figcaption>
    </figure>
  );
}

export default function LabPage() {
  const exp005Svg = loadLabSvg(
    "lab/experiments/EXP-005-chronosense-codec-eval/chart.svg",
  );
  const exp006Svg = loadLabSvg(
    "lab/experiments/EXP-006-live-vlm-observation-eval/chart.svg",
  );
  const exp007Svg = loadLabSvg(
    "lab/experiments/EXP-007-geo-rope-sleep-transformer/chart.svg",
  );
  const exp012Svg = loadLabSvg(
    "lab/experiments/EXP-012-pretrained-georope-adapter/chart.svg",
  );
  const exp013Svg = loadLabSvg(
    "lab/experiments/EXP-013-typed-null-envelope/chart.svg",
  );

  return (
    <main className="container page">
      <PageHero
        eyebrow="Caelus R&D Lab · Empirical Field Notes"
        title="Lab Notes"
      >
        <P>
          These field notes document what happened when we stripped cultural
          astrology away from Caelus and tested its geocentric spacetime engine
          across <strong>chronosense</strong> (physical-horizon temporal context
          for agents), <strong>SHADOWPROOF</strong> (offline shadow-geometry
          verification), rotary positional embeddings, frozen-LLM adapters, and
          typed-null MCP response envelopes against non-ephemeris null baselines
          (<Code>Date.now()</Code>, fixed 24-hour <Code>sin/cos</Code> waves,
          20-line NOAA solar formulas, <Code>HMAC-SHA256</Code>, standard RoPE,
          and generic anti-hallucination prompts). Designed, run, and written by
          Gemini 4 Neon in an isolated multi-agent swarm, independently audited
          by read-only verifier agents, and reviewed by the repository owner.
          Every experiment ran inside the isolated <Code>lab/</Code> sandbox
          without editing core ephemeris math, and every figure below renders
          directly from its committed receipt.
        </P>
        <div className="lab-byline mono small">
          <span className="badge badge--accent">
            Gemini 4 Neon · Audited multi-agent swarm
          </span>
          <span className="badge badge--ok">
            12 experiments · 12 verified receipts
          </span>
          <span className="badge badge--warm">
            7 hypotheses killed in graveyard
          </span>
          <span className="badge badge--muted">0 core engine edits</span>
        </div>
      </PageHero>

      <div className="stat-grid lab-summary-grid" aria-label="Lab summary metrics">
        <div className="stat-cell">
          <span className="stat__label">EXP-005 Live Codec</span>
          <span className="stat__num">77.7%</span>
          <span className="stat__src">
            Physical [71.0, 83.5%] vs. 63.5% Symbolic (+14.2 pp)
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-006 Tool Use</span>
          <span className="stat__num">93.3%</span>
          <span className="stat__src">
            Up from 33.3% CoT (+60.0 pp); F1 0.945
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-007 Geo-RoPE (3-seed)</span>
          <span className="stat__num">86.5%</span>
          <span className="stat__src">
            T3-OOD +/- 0.6% vs. 53.7% Unix+LatLon
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-007 SLEEP (3-seed, Partial)</span>
          <span className="stat__num">86.3% / 65.5%</span>
          <span className="stat__src">
            NOAA20 vs. Caelus retention (9.0 vs. 11.1 pp forgetting)
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-013 Typed-Null MCP</span>
          <span className="stat__num">100.0%</span>
          <span className="stat__src">
            +27.1 pp vs. Arm1, +16.7 pp vs. Arm2; +68.5 tok
          </span>
        </div>
      </div>

      <H2>Caelus&apos;s Razor: pre-registered gates and null baselines</H2>
      <P>
        Before writing experiment code, we imposed a pre-registered decision
        gate in{" "}
        <A href={`${SITE.repo}/blob/main/lab/CHARTER.md`}>lab/CHARTER.md</A>{" "}
        called <strong>Caelus&apos;s Razor</strong>. Every experiment manifest
        must declare four fields up front: a falsifiable hypothesis grounded in
        a real Caelus primitive, the simplest non-ephemeris null baseline
        (including a 20-line Spencer/NOAA solar formula wherever solar geometry
        is tested), a numeric success bar, and an explicit kill criterion. When
        the simpler baseline ties or wins, the hypothesis moves directly into{" "}
        <Code>lab/graveyard/</Code> with exact failure numbers so future
        sessions do not repeat the same dead end.
      </P>
      <P>
        We also separated two questions that are easy to conflate. First, does
        topocentric astronomical physics (refracted solar altitude, local
        twilight depth, photoperiod-warped hours, lunar elongation, and 3D cast
        shadows) beat flat clocks and minimal solar formulas? Second, do
        traditional symbolic zodiac tokens help or hurt when read by a language
        model? Testing them as separate arms produced the sharpest splits in
        this study.
      </P>

      <H2>Lab Graveyard: 7 killed hypotheses (KILL-001 to KILL-007)</H2>
      <P>
        Seven proposals failed Caelus&apos;s Razor and remain archived
        permanently in{" "}
        <A href={`${SITE.repo}/tree/main/lab/graveyard`}>lab/graveyard/</A> with
        their exact failure metrics and narrow revival conditions. Placing them
        ahead of the positive findings shows where simpler math or plain-text
        headers beat astronomical machinery.
      </P>

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Kill ID</th>
              <th>Rejected idea</th>
              <th>Measured failure mode</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">KILL-001</td>
              <td>Secret-asteroid spacetime TOTP</td>
              <td>
                Strictly dominated by <Code>HMAC-SHA256</Code> (256-bit security
                versus ~89 bits with zero pack files or quantization boundary
                desync).
              </td>
            </tr>
            <tr>
              <td className="mono">KILL-002</td>
              <td>Synastry swarm role routing</td>
              <td>
                Broken by the 1-week cohort trap (<Code>r = 0.911</Code> shared
                outer-planet similarity); <Code>sha256(agentId || taskId)</Code>{" "}
                is uniform.
              </td>
            </tr>
            <tr>
              <td className="mono">KILL-003</td>
              <td>Retrograde and ZR daemon maintenance</td>
              <td>
                Wrong timescales (21-day planetary retrogrades) and wrong
                trigger signal; maintenance belongs on drift or local human
                night.
              </td>
            </tr>
            <tr>
              <td className="mono">KILL-004</td>
              <td>Void-of-course freezes and parans sharding</td>
              <td>
                14-hour operational lockouts harm reliability, and distributed
                systems shard by longitude latency rather than co-latitude
                bands.
              </td>
            </tr>
            <tr>
              <td className="mono">KILL-005</td>
              <td>
                Adaptive step-size via <Code>chartStability</Code> (EXP-010)
              </td>
              <td>
                Unfiltered flips fired 23.8 phantom zodiac alarms per day;
                sect-only caught 40.5% of cliffs in 183.4 ms/day, beaten 21x by
                direct <Code>sceneGeometry.diurnal.minutesToNextTwilight</Code>{" "}
                (100.0% catch, 0.00 min error, 8.7 ms/day).
              </td>
            </tr>
            <tr>
              <td className="mono">KILL-006</td>
              <td>Synthetic orbital task-space deadlines (EXP-011)</td>
              <td>
                <Code>registerSyntheticSystem</Code> places periodic bodies
                heliocentrically at Kepler <Code>a = P^(2/3)</Code> AU,
                collapsing event F1 to 0.0255 from Earth parallax; direct{" "}
                <Code>riseSet(&quot;sun&quot;)</Code> plus modulo hits F1 =
                1.0000 and runs 3.0x faster than parallax-free{" "}
                <Code>when()</Code>.
              </td>
            </tr>
            <tr>
              <td className="mono">KILL-007</td>
              <td>
                Pretrained frozen Geo-RoPE soft-token adapter (EXP-012)
              </td>
              <td>
                <Code>Arm3-LoRA-Caelus-GeoAdapter</Code> reached 90.1% OOD
                Solstice+Travel (+49.8 pp over location-aware{" "}
                <Code>Arm2b</Code> on Oslo Solstices, -95.35% clock tokens,
                2.55x faster MPS prefill), yet plain-text{" "}
                <Code>Arm1b-LoRA-TextPrompt</Code> scored 96.9% OOD
                Solstice+Travel and 97.3% OOD All with 471,297 fewer trainable
                parameters, breaching the -3.0 pp kill gate.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2>1. Physical vs. Symbolic Chronosense (EXP-005)</H2>
      <P>
        In <Code>EXP-001</Code>, a deterministic 1,200-turn simulation showed
        that a compact physical-horizon envelope backed by{" "}
        <Code>sceneGeometry</Code> and a canonical <Code>chartDigest</Code>{" "}
        cursor reached 100.0% local <Code>night_crossed</Code> accuracy (versus
        67.6% for UTC ISO strings) and 0.000 min physical sunset error (versus
        88.7 min MAE for a fixed 24-hour clock across latitudes). In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-005-chronosense-codec-eval/README.md`}
        >
          EXP-005
        </A>
        , we tested how live language models read those tokens at inference time
        across all 20 multi-day compaction and high-latitude photoperiod
        episodes from <Code>EXP-001/eval_suite.jsonl</Code>. The complete
        200-episode live sweep ran deterministically (<Code>temperature = 0</Code>
        ) on local Ollama <Code>gemma4:12b</Code> and <Code>qwen3.5:9b</Code>{" "}
        with zero API errors. Every arm received a symmetric two-line legend in
        its system prompt, including the 30-degree zodiac offset table for the
        symbolic arm and <Code>sin24/cos24</Code> conventions for the synthetic
        24-hour control.
      </P>
      <P>
        Each episode is graded deterministically by equal-weighted binary
        sub-checks (<Code>score_i = passed / total</Code> in <Code>[0, 1]</Code>
        ): the 10 compaction tasks grade <Code>night_crossed</Code>,{" "}
        <Code>fresh_tool_id</Code>, and <Code>digest_match</Code> (1/3 each),
        while the 10 photoperiod tasks grade <Code>is_day</Code>,{" "}
        <Code>twilight_stage</Code>, <Code>deadline_phase</Code>, and{" "}
        <Code>deadline_minutes_within_15m</Code> (1/4 each). Per-model composite
        accuracy averages across all 20 tasks, and live macro accuracy averages
        equally across both models (<Code>n = 40</Code> task-model episodes).
        Token counts use <Code>approxCl100kTokens</Code> over each arm&apos;s
        system header to two decimals across prose, tables, and charts.
      </P>

      <LabPlate
        id="FIG LAB-05"
        title="EXP-005: Live 5-Arm Chronosense Codec Showdown"
        sourcePath="lab/experiments/EXP-005-chronosense-codec-eval/chart.svg"
        caption="Composite accuracy across 200 live episodes (20 tasks x 5 arms x 2 local Ollama models at temperature = 0) with 10,000-resample bootstrap 95% CIs and exact cl100k header token counts."
        svg={exp005Svg}
      />

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Arm</th>
              <th className="r">cl100k tok</th>
              <th className="r">gemma4:12b</th>
              <th className="r">qwen3.5:9b</th>
              <th className="r">Live macro [95% CI]</th>
              <th className="r">Delta vs. Physical</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Treatment-Caelus-Physical</strong>
              </td>
              <td className="r num">45.75</td>
              <td className="r num">75.4%</td>
              <td className="r num">80.0%</td>
              <td className="r num">
                <strong>77.7% [71.0, 83.5%]</strong>
              </td>
              <td className="r num">baseline</td>
            </tr>
            <tr>
              <td>Arm4b-Caelus-Symbolic</td>
              <td className="r num">36.75</td>
              <td className="r num">63.8%</td>
              <td className="r num">63.3%</td>
              <td className="r num">63.5% [55.8, 70.6%]</td>
              <td className="r num">-14.2 pp</td>
            </tr>
            <tr>
              <td>Control-Synthetic (fixed 24h)</td>
              <td className="r num">26.00</td>
              <td className="r num">46.7%</td>
              <td className="r num">43.8%</td>
              <td className="r num">45.2% [34.8, 55.6%]</td>
              <td className="r num">-32.5 pp</td>
            </tr>
            <tr>
              <td>Control-ISO (passive UTC)</td>
              <td className="r num">15.00</td>
              <td className="r num">38.8%</td>
              <td className="r num">42.9%</td>
              <td className="r num">40.8% [33.5, 47.9%]</td>
              <td className="r num">-36.9 pp</td>
            </tr>
            <tr>
              <td>Baseline-None</td>
              <td className="r num">0.00</td>
              <td className="r num">28.8%</td>
              <td className="r num">32.5%</td>
              <td className="r num">30.6% [23.3, 37.7%]</td>
              <td className="r num">-47.1 pp</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>Paired bootstrap CIs, NOAA-20line baseline, and transcript bugs</H3>
      <P>
        Under deterministic <Code>B = 10,000</Code> paired bootstrap resampling,{" "}
        <Code>Treatment-Caelus-Physical</Code> separates from{" "}
        <Code>Arm4b-Caelus-Symbolic</Code> by{" "}
        <strong>+14.2 pp [95% CI +5.6, +22.5 pp]</strong> (
        <Code>p = 0.0004</Code>, 19 wins, 17 ties, 4 losses across{" "}
        <Code>n = 40</Code> episodes) and stays above zero under task-clustered
        resampling (<Code>n = 20</Code> tasks, <Code>[+5.6, +22.7 pp]</Code>,{" "}
        <Code>p = 0.0008</Code>). By model, <Code>qwen3.5:9b</Code> separates
        cleanly at <Code>+16.7 pp [+6.3, +27.9 pp]</Code> (
        <Code>p = 0.0006</Code>), while <Code>gemma4:12b</Code> alone moves in
        the same direction (<Code>+11.7 pp</Code>, 9W/9T/2L) with a borderline
        two-sided 95% CI of <Code>[-1.3, +24.2 pp]</Code> (
        <Code>p = 0.0760</Code>).
      </P>
      <P>
        We also audited an offline 20-line Spencer/NOAA solar formula (
        <Code>Control-NOAA-20line</Code>, <Code>23.00</Code> cl100k tokens)
        against Caelus across all 20 tasks. It scored <strong>66.7%</strong>{" "}
        across all 20 tasks (10/20 exact) versus 100.0% for Caelus: it tied
        Caelus at <strong>100.0%</strong> on the 10-task photoperiod slice
        (within <Code>0.29 min</Code> MAE and <Code>0.50 min</Code> max
        mid-latitude timing error), then dropped to <strong>33.3%</strong> on
        the 10-task compaction slice (<Code>night_crossed = 100%</Code>,{" "}
        <Code>0/10</Code> lunar <Code>fresh_tool_id</Code>, <Code>0/10</Code>{" "}
        canonical <Code>digest_match</Code>), hit <Code>2</Code> Tromso polar
        undefined-sunset tasks, and carried <Code>0.25–0.76 deg</Code>{" "}
        low-altitude refraction error near grazing horizon angles.
      </P>
      <P>
        Live transcripts also exposed two header formatting flaws that offline
        decoders missed. Placing <Code>sunset:Xm</Code> next to{" "}
        <Code>due:Ym</Code> caused <Code>gemma4:12b</Code> to occasionally copy
        the sunset countdown as the task deadline, and an implicit presence flag
        (<Code>+night</Code>) scored only 50% to 60% on{" "}
        <Code>night_crossed</Code>. Both fixes shipped directly into the{" "}
        <Code>FACT-002</Code> middleware spec by separating{" "}
        <Code>horizon_eta</Code> from <Code>deadline_eta</Code> and emitting an
        explicit <Code>night_crossed=true|false</Code> boolean.
      </P>

      <H2>
        2. Teaching models to verify shadows instead of guessing (EXP-006 +
        SHADOWPROOF)
      </H2>
      <P>
        Vision-language models do not compute spherical astronomy, atmospheric
        refraction, or sloped-ground shadow geometry inside their weights. In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-006-live-vlm-observation-eval/README.md`}
        >
          EXP-006
        </A>
        , we evaluated the 30-task forensic benchmark from{" "}
        <Code>EXP-003</Code> (authentic outdoor scenes, timezone shifts,
        hemisphere flips, opposite seasons, nighttime shadow spoofs,
        chronolocation windows, and global geolocation fixes) deterministically
        (<Code>temperature = 0</Code>) on local Ollama <Code>gemma4:12b</Code>{" "}
        and <Code>qwen3.5:9b</Code> (120 live episodes, zero API or tool
        errors). Each model ran twice: once with chain-of-thought only (
        <Code>Arm1-CoT-NoTools</Code>) and once with local in-process Caelus MCP
        tools (<Code>verify_observation</Code>, <Code>chronolocate</Code>,{" "}
        <Code>geolocate</Code>, and <Code>scene_geometry</Code>).
      </P>

      <LabPlate
        id="FIG LAB-06"
        title="EXP-006: Live Observation Tool-Use Showdown (CoT-Only vs. Caelus MCP)"
        sourcePath="lab/experiments/EXP-006-live-vlm-observation-eval/chart.svg"
        caption="120 live episodes across local Ollama gemma4:12b and qwen3.5:9b on the 30-task EXP-003 pack. Tool routing hit 60/60 (100%) with ~1.11 ms warm authentic verify latency."
        svg={exp006Svg}
      />

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Metric (macro across gemma4:12b + qwen3.5:9b)</th>
              <th className="r">Arm1: CoT-NoTools</th>
              <th className="r">Arm2: Caelus-MCP-Tools</th>
              <th className="r">Paired gain / 95% CI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Overall 30-task pass rate (n = 60 pooled)</td>
              <td className="r num">33.3% [22.7, 45.9%]</td>
              <td className="r num">
                <strong>93.3% [84.1, 97.4%]</strong>
              </td>
              <td className="r num">+60.0 pp [+45.0, +75.0]</td>
            </tr>
            <tr>
              <td>Spoof-detection F1 (pooled micro, n = 28)</td>
              <td className="r num">0.7273 [0.564, 0.857]</td>
              <td className="r num">
                <strong>0.9474 [0.857, 1.000]</strong>
              </td>
              <td className="r num">+0.2201 [+0.056, +0.404]</td>
            </tr>
            <tr>
              <td>Authentic scene FPR (n = 4/model; n = 8 pooled)</td>
              <td className="r num">100.0% [67.6, 100.0%]</td>
              <td className="r num">
                <strong>0.0% [0.0, 32.4%]</strong>
              </td>
              <td className="r num">-100.0 pp (n = 4: [0, 49.0%])</td>
            </tr>
            <tr>
              <td>Counterfactual single-axis recovery (n = 12 pooled)</td>
              <td className="r num">66.7% [39.1, 86.2%]</td>
              <td className="r num">
                <strong>100.0% [75.8, 100.0%]</strong>
              </td>
              <td className="r num">+33.3 pp</td>
            </tr>
            <tr>
              <td>Chronolocation pass (&lt;= 20 min, n = 16 pooled)</td>
              <td className="r num">12.5% (857–1,987 min)</td>
              <td className="r num">
                <strong>87.5% (3.28 min)</strong>
              </td>
              <td className="r num">+75.0 pp [+43.8, +100.0]</td>
            </tr>
            <tr>
              <td>Geolocation pass (&lt;= 350 km, n = 16 pooled)</td>
              <td className="r num">12.5% (3,581–8,718 km)</td>
              <td className="r num">
                <strong>100.0% (69.7 km)</strong>
              </td>
              <td className="r num">+87.5 pp [+68.8, +100.0]</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>Spoof F1 definition, small-sample caveat, and NOAA-20 audit</H3>
      <P>
        Spoof-detection F1 treats <Code>is_spoof === true</Code> as the positive
        class across the 14 <Code>verify_observation</Code> scenes per model (10
        spoofs and 4 authentic scenes), computed as{" "}
        <Code>F1 = 2 * TP / (2 * TP + FP + FN)</Code>. Pooled across both models
        (<Code>n = 28</Code>), exact <Code>TP / FP / TN / FN</Code> counts move
        from <Code>16 / 8 / 0 / 4</Code> (<Code>F1 = 0.7273</Code>) under CoT to{" "}
        <Code>18 / 0 / 8 / 2</Code> (<Code>F1 = 0.9474</Code>) with Caelus MCP
        tools (paired <Code>B = 10,000</Code> bootstrap delta{" "}
        <Code>+0.2201 [+0.056, +0.404]</Code>, <Code>p = 0.0116</Code>; macro
        mean <Code>0.7247</Code> to <Code>0.9445</Code>). Across all 30 tasks,
        pass rate gains <Code>+60.0 pp [+45.0, +75.0 pp]</Code> (
        <Code>p &lt; 0.0001</Code>; task-clustered <Code>n = 30</Code>:{" "}
        <Code>[+40.0, +78.3 pp]</Code>).
        Because each live model evaluates only <Code>n = 4</Code> authentic
        scenes, the observed <Code>0/4 = 0.0%</Code> false-positive rate carries
        a wide 95% Wilson interval of <Code>[0.0%, 49.0%]</Code> per model (
        <Code>0/8 = 0.0% [0.0%, 32.4%]</Code> pooled). For tighter empirical FPR
        bounds on the identical <Code>verifyObservation</Code> engine,{" "}
        <Code>EXP-003</Code> tests <Code>n = 100</Code> noisy authentic global
        scenes offline and measures <Code>0/100 = 0.0% [0.0%, 3.7%]</Code>.
      </P>
      <P>
        A programmatic audit of all 30 tasks shows that{" "}
        <strong>15/30 (50.0%)</strong> require physical primitives absent from a
        20-line flat-ground NOAA solar formula: <strong>13/30</strong> require
        lunar ephemeris or bright-limb zenith angles (including all{" "}
        <strong>8/8</strong> chronolocation tasks, where daily solar shadows
        repeat across a 6-day search window without lunar phase) and{" "}
        <strong>3/30</strong> require sloped-ground 3D shadow projection (
        <Code>VLM-003</Code>, <Code>VLM-022</Code>, <Code>VLM-030</Code>).
        Packaging also matters in agent tool loops: Caelus runs in-process with
        zero runtime dependencies at <Code>~1.11 ms</Code> warm authentic
        verification (<Code>~2.8–3.5 ms</Code> isolated all-tools median) in
        Node, browsers, and edge workers, avoiding the <Code>&gt;150 MB</Code>{" "}
        Python runtime and <Code>500–2,000 ms</Code> subprocess overhead of an{" "}
        <Code>astropy</Code> or <Code>pvlib</Code> sandbox.
      </P>
      <P>
        The single remaining chronolocation miss (<Code>VLM-017</Code>) is a
        physical near-New-Moon ambiguity where two consecutive days satisfy the
        noisy shadow measurement; the deterministic top-1 oracle misses the same
        scene while top-2 hits 8/8. Because the exact same TypeScript math runs
        with zero dependencies in the browser, we also shipped it as{" "}
        <Link href="/instruments/field-verifier">
          Instrument I-05: Field Verifier (SHADOWPROOF)
        </Link>
        , where you can drop a local JPEG photo (EXIF GPS and timestamps stay
        local), drag vertical pole and cast shadow handles at 60 fps, test
        counterfactual clock or hemisphere fixes, inspect a 12x24 solar analemma
        feasibility heatmap, and compute spherical global fixes offline.
      </P>

      <H2>
        3. Training a 1.43M-parameter Geo-RoPE and Google SLEEP transformer
        (EXP-007, 3-seed)
      </H2>
      <P>
        During a 2-second forward pass, Earth rotates by only 0.00836 degrees,
        so astronomical phase alone collapses on intra-turn token ordering (
        <Code>EXP-004</Code>). Standard token-index RoPE has the opposite flaw
        because it resets to <Code>m = 0</Code> when a serialized context wakes
        after an overnight sleep, erasing elapsed physical time. In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-007-geo-rope-sleep-transformer/README.md`}
        >
          EXP-007
        </A>
        , we split each 64-dimensional attention head into 32 fast token-step
        RoPE dimensions and 32 slow physical dimensions rotated by Caelus&apos;s
        geocentric torus (<Code>GAST</Code>, <Code>ASC</Code>, refracted solar
        altitude and trend, photoperiod-warped planetary hour, lunar longitude,
        Sun-Moon elongation, and solar longitude from{" "}
        <Code>python/astroengine/</Code>). We then paired that backbone with
        Google Research&apos;s{" "}
        <A href="https://research.google/blog/the-sleep-framework-a-new-way-for-llms-to-retain-knowledge-in-continual-learning/">
          SLEEP continual learning method
        </A>{" "}
        (frozen core weights plus offline rank-16 LoRA consolidation via replay).
      </P>
      <P>
        Across <strong>3 independent seeds</strong> (<Code>20261122</Code>,{" "}
        <Code>20261123</Code>, <Code>20261124</Code>) on Apple M5 Pro MPS, we
        trained five parameter-matched causal transformers (identical{" "}
        <strong>1,427,136</strong> parameters, 4 layers,{" "}
        <Code>d_model = 192</Code>, 3 heads, 1,960 AdamW steps on 13,400
        sequences; SHA-256 verified zero day overlap between Spring/Autumn
        training and held-out Oslo winter solstice, Oslo summer solstice, and
        NYC-to-Tokyo travel splits). Only the <Code>(T, 32)</Code> slow-clock
        rotation tensor differed between encoders. Across both parts,{" "}
        <Code>EXP-007</Code> clears <strong>10/12</strong> Razor bars: Part A
        is <strong>PROVED (6/6)</strong>, while Part B is{" "}
        <strong>PARTIAL / INCONCLUSIVE (4/6)</strong>.
      </P>

      <LabPlate
        id="FIG LAB-07"
        title="EXP-007: 3-Seed Trained Tiny-Transformer Geo-RoPE and Google SLEEP Study"
        sourcePath="lab/experiments/EXP-007-geo-rope-sleep-transformer/chart.svg"
        caption="Panel A compares five parameter-matched 1,427,136-parameter encoders across 3 seeds (4,840 held-out sequences per seed). Panel B compares six continual LoRA consolidation arms across 5 Wake-to-Sleep cycles."
        svg={exp007Svg}
      />

      <H3>
        Part A: 5-encoder RoPE ablation (3-seed mean +/- std, 1,427,136
        parameters, PROVED 6/6)
      </H3>
      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Held-out task (4,840 seq/seed x 3 seeds)</th>
              <th className="r">Std-RoPE</th>
              <th className="r">Unix-Fourier</th>
              <th className="r">Unix+LatLon</th>
              <th className="r">NOAA20</th>
              <th className="r">Geo-RoPE (Caelus)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>T1: Intra-turn 2s register tracking</td>
              <td className="r num">81.3 +/- 3.1%</td>
              <td className="r num">
                <strong>84.1 +/- 6.9%</strong>
              </td>
              <td className="r num">77.6 +/- 1.8%</td>
              <td className="r num">79.2 +/- 4.3%</td>
              <td className="r num">82.5 +/- 12.1%</td>
            </tr>
            <tr>
              <td>T2: Post-sleep reset (m = 0)</td>
              <td className="r num">33.4 +/- 1.1%</td>
              <td className="r num">99.8 +/- 0.3%</td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
            </tr>
            <tr>
              <td>T3-ID: Spring/autumn control</td>
              <td className="r num">25.5 +/- 2.1%</td>
              <td className="r num">70.9 +/- 2.5%</td>
              <td className="r num">79.8 +/- 3.6%</td>
              <td className="r num">88.0 +/- 1.3%</td>
              <td className="r num">
                <strong>88.7 +/- 3.4%</strong>
              </td>
            </tr>
            <tr>
              <td>T3-OOD: Oslo Solstices (4 slices)</td>
              <td className="r num">24.9 +/- 1.7%</td>
              <td className="r num">51.1 +/- 9.9%</td>
              <td className="r num">36.0 +/- 2.6%</td>
              <td className="r num">78.7 +/- 1.2%</td>
              <td className="r num">
                <strong>83.2 +/- 1.1%</strong>
              </td>
            </tr>
            <tr>
              <td>T3-OOD: NYC to Tokyo travel (2 slices)</td>
              <td className="r num">26.4 +/- 1.2%</td>
              <td className="r num">8.8 +/- 0.6%</td>
              <td className="r num">89.0 +/- 1.9%</td>
              <td className="r num">91.2 +/- 1.8%</td>
              <td className="r num">
                <strong>93.1 +/- 0.3%</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>T3-OOD Composite (Solstices + Tokyo)</strong>
              </td>
              <td className="r num">25.4 +/- 1.4%</td>
              <td className="r num">37.0 +/- 6.7%</td>
              <td className="r num">53.7 +/- 2.3%</td>
              <td className="r num">82.9 +/- 1.4%</td>
              <td className="r num">
                <strong>86.5 +/- 0.6%</strong>
              </td>
            </tr>
            <tr>
              <td>T4a-OOD: 30-day same-UTC</td>
              <td className="r num">20.0 +/- 1.6%</td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0 +/- 0.0%</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>T4b-OOD: 52-week annual wrap</strong>
              </td>
              <td className="r num">21.0 +/- 2.4%</td>
              <td className="r num">81.2 +/- 1.5%</td>
              <td className="r num">83.1 +/- 3.9%</td>
              <td className="r num">80.0 +/- 2.4%</td>
              <td className="r num">
                <strong>98.4 +/- 1.3%</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <P>
        Eliminating the location gap with <Code>Hybrid-Unix-Fourier+LatLon</Code>{" "}
        (feeding exact <Code>(lat, lon)</Code> and local mean solar time{" "}
        <Code>UTC + lon/15</Code>) rescues Tokyo travel from 8.8% to 89.0%, yet
        still collapses to <strong>36.0 +/- 2.6%</strong> on Oslo Winter and
        Summer solstices, trailing <Code>Hybrid-Dual-Geo-RoPE</Code> (
        <strong>83.2 +/- 1.1%</strong>) by <strong>+47.2 pp</strong>. The
        20-line solar baseline (<Code>Hybrid-NOAA20-RoPE</Code>) closes most of
        the solar photoperiod gap (<Code>82.9 +/- 1.4%</Code> vs.{" "}
        <Code>86.5 +/- 0.6%</Code> on <Code>T3-OOD</Code>), then aliases on{" "}
        <Code>T4b</Code> 52-week annual wrap (<Code>80.0 +/- 2.4%</Code> vs.{" "}
        <strong>98.4 +/- 1.3%</strong>, <strong>+18.4 pp</strong> from
        Caelus&apos;s incommensurate 27.32d / 29.53d lunar torus).
      </P>

      <H3>
        Part B: 6-arm Google SLEEP continual replay (3-seed mean +/- std, B =
        250, PARTIAL 4/6)
      </H3>
      <P>
        All five SLEEP arms freeze the 1,427,136 core weights and train matched
        rank-16 LoRA adapters (193,536 trainable parameters) across five
        sequential Wake-to-Sleep regimes (Oslo Autumn Day, Dusk, Night, Oslo
        Winter Shift, and Tokyo Travel). Retention is mean held-out accuracy
        across Cycles C1–C5 in percent (<Code>%</Code>), whereas forgetting
        delta measures accuracy loss in percentage points (<Code>pp</Code>):{" "}
        <Code>
          mean over c = 1..4 of max(0, pre_sleep_acc(c) - post_sleep_acc(c))
        </Code>{" "}
        (defined as <Code>max_{"{t >= c}"} acc(t, c) - acc(5, c)</Code> clamped
        at zero).
      </P>
      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Consolidation arm (B = 250 buffer)</th>
              <th>Backbone / replay</th>
              <th className="r">Final C1–C5 retention</th>
              <th className="r">Forgetting delta</th>
              <th className="r">Nocturnal gate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>SLEEP-NOAA20-Stratified</strong>
              </td>
              <td>NOAA20-RoPE / NOAA20 strat</td>
              <td className="r num">
                <strong>86.3 +/- 7.9%</strong>
              </td>
              <td className="r num">
                <strong>9.0 +/- 6.4 pp</strong>
              </td>
              <td className="r num">
                <strong>100.0%</strong>
              </td>
            </tr>
            <tr>
              <td>SLEEP-Reservoir-Random</td>
              <td>Geo-RoPE / Vitter Alg R</td>
              <td className="r num">68.4 +/- 25.0%</td>
              <td className="r num">9.6 +/- 14.3 pp</td>
              <td className="r num">70.5% (if UTC gate)</td>
            </tr>
            <tr>
              <td>SLEEP-Caelus-Circadian-Stratified</td>
              <td>Geo-RoPE / Caelus strat</td>
              <td className="r num">65.5 +/- 13.1%</td>
              <td className="r num">11.1 +/- 18.0 pp</td>
              <td className="r num">
                <strong>100.0%</strong>
              </td>
            </tr>
            <tr>
              <td>SLEEP-Fixed24h-LRU</td>
              <td>Unix-Fourier / LRU</td>
              <td className="r num">41.3 +/- 2.3%</td>
              <td className="r num">62.1 +/- 8.0 pp</td>
              <td className="r num">70.5% (0% Tokyo)</td>
            </tr>
            <tr>
              <td>Diag-SLEEP-GeoRoPE-LRU (causal control)</td>
              <td>Geo-RoPE / LRU</td>
              <td className="r num">37.3 +/- 2.4%</td>
              <td className="r num">56.6 +/- 8.1 pp</td>
              <td className="r num">100.0%</td>
            </tr>
            <tr>
              <td>Naive-Online-FT</td>
              <td>Geo-RoPE / unfrozen FT</td>
              <td className="r num">20.0 +/- 0.0%</td>
              <td className="r num">90.4 +/- 5.3 pp</td>
              <td className="r num">n/a</td>
            </tr>
          </tbody>
        </table>
      </div>

      <P>
        Three causal findings emerged from expanding Part B to 3 seeds and 6
        arms. First, <Code>Diag-SLEEP-GeoRoPE-LRU</Code> (37.3% retention, 56.6
        pp forgetting) performs no better than <Code>SLEEP-Fixed24h-LRU</Code>{" "}
        (41.3%, 62.1 pp), confirming that the replay buffer policy drives
        continual retention rather than the Geo-RoPE backbone weights. Second,{" "}
        <strong>
          <Code>SLEEP-NOAA20-Stratified</Code> (86.3 +/- 7.9%, 9.0 +/- 6.4 pp
          forgetting) outperformed <Code>SLEEP-Caelus-Circadian-Stratified</Code>{" "}
          (65.5 +/- 13.1%, 11.1 +/- 18.0 pp forgetting)
        </strong>{" "}
        despite identical buffer counts because Caelus&apos;s six high-frequency
        lunar rotary planes (rotating up to 104 deg/day) shift phase between
        10-day wake windows and 11-day-later evaluation windows, raising
        small-sample LoRA sleep loss (<Code>0.21–0.64</Code> vs.{" "}
        <Code>0.009–0.028</Code> for solar-only NOAA20). Lunar planes help
        multi-month annual disambiguation (<Code>T4b: +18.4 pp</Code>), whereas
        solar-only stratification fits cyclic diurnal LoRA consolidation more
        cleanly. Third, on equal-volume cycles (125 episodes per cycle),{" "}
        <Code>SLEEP-Reservoir-Random</Code> (68.4 +/- 25.0%, 9.6 +/- 14.3 pp
        forgetting) matched Caelus&apos;s mean retention with nearly 2x the
        seed-to-seed variance (<Code>+/- 25.0 pp</Code> vs.{" "}
        <Code>+/- 13.1 pp</Code>) and without local-horizon nocturnal sleep-gate
        safety.
      </P>

      <H2>4. Pretrained frozen LLM transfer test (EXP-012 / KILL-007)</H2>
      <P>
        In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-012-pretrained-georope-adapter/README.md`}
        >
          EXP-012
        </A>
        , we tested whether <Code>EXP-007</Code>&apos;s physical slow-clock
        generalization transfers into a frozen pretrained LLM (
        <Code>Qwen/Qwen2.5-0.5B-Instruct</Code>, 494,032,768 strictly frozen{" "}
        <Code>bfloat16</Code> weights) via a 2-layer MLP adapter projecting 32-D
        physical features into 2 continuous soft tokens per event (exact
        1,552,641-parameter parity across <Code>Arm2</Code>, <Code>Arm2b</Code>,
        and <Code>Arm3</Code>: 1,081,344 rank-8 LoRA plus 471,297 adapter
        parameters). We evaluated all six arms across 1,720 held-out prompts (580 ID
        control and 1,140 OOD across Oslo solstices, NYC-to-Tokyo travel, and
        OOD compaction; zero overlapping city-days verified by SHA-256).
      </P>

      <LabPlate
        id="FIG LAB-12"
        title="EXP-012 (KILL-007): Frozen Qwen2.5-0.5B Slow-Clock Adapter vs. Plain-Text FACT-002"
        sourcePath="lab/experiments/EXP-012-pretrained-georope-adapter/chart.svg"
        caption="6-arm comparison across 1,720 held-out prompts on frozen Qwen/Qwen2.5-0.5B-Instruct (Apple M5 Pro MPS) with 95% Wilson CIs. Arm3 beats location-aware Arm2b by +49.8 pp on Oslo Solstices yet loses to plain-text Arm1b, triggering KILL-007."
        svg={exp012Svg}
      />

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Arm (Qwen2.5-0.5B frozen base)</th>
              <th className="r">Trained params</th>
              <th className="r">OOD Oslo (n=640)</th>
              <th className="r">OOD Tokyo (n=320)</th>
              <th className="r">OOD Sol+Tok (n=960)</th>
              <th className="r">OOD All (n=1,140)</th>
              <th className="r">Tok / MPS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Arm0-Frozen-ISO-Prompt</td>
              <td className="r num">0</td>
              <td className="r num">21.1% [18.1, 24.4]</td>
              <td className="r num">20.9% [16.8, 25.7]</td>
              <td className="r num">21.0% [18.6, 23.7]</td>
              <td className="r num">22.6% [20.5, 25.3]</td>
              <td className="r num">134.8 / 8.57 ms</td>
            </tr>
            <tr>
              <td>Arm1-Frozen-Caelus-TextPrompt</td>
              <td className="r num">0</td>
              <td className="r num">43.4% [39.7, 47.3]</td>
              <td className="r num">40.3% [35.1, 45.8]</td>
              <td className="r num">42.4% [39.3, 45.6]</td>
              <td className="r num">44.8% [42.1, 47.9]</td>
              <td className="r num">247.7 / 14.69 ms</td>
            </tr>
            <tr>
              <td>
                <strong>Arm1b-LoRA-TextPrompt</strong>
              </td>
              <td className="r num">
                <strong>1,081,344</strong>
              </td>
              <td className="r num">
                <strong>95.6% [93.8, 97.0]</strong>
              </td>
              <td className="r num">
                <strong>99.4% [97.8, 99.8]</strong>
              </td>
              <td className="r num">
                <strong>96.9% [95.6, 97.8]</strong>
              </td>
              <td className="r num">
                <strong>97.3% [96.3, 98.2]</strong>
              </td>
              <td className="r num">247.7 / 23.25 ms</td>
            </tr>
            <tr>
              <td>Arm2-LoRA-UnixFourier-Adapter</td>
              <td className="r num">1,552,641</td>
              <td className="r num">36.4% [32.8, 40.2]</td>
              <td className="r num">1.6% [0.7, 3.6]</td>
              <td className="r num">24.8% [22.2, 27.6]</td>
              <td className="r num">29.0% [26.9, 32.2]</td>
              <td className="r num">89.8 / 8.94 ms</td>
            </tr>
            <tr>
              <td>Arm2b-LoRA-UnixFourier+LatLon</td>
              <td className="r num">1,552,641</td>
              <td className="r num">38.1% [34.4, 42.0]</td>
              <td className="r num">79.1% [74.3, 83.2]</td>
              <td className="r num">51.8% [48.6, 54.9]</td>
              <td className="r num">53.0% [50.2, 56.0]</td>
              <td className="r num">89.8 / 9.14 ms</td>
            </tr>
            <tr>
              <td>
                <strong>Arm3-LoRA-Caelus-GeoAdapter</strong>
              </td>
              <td className="r num">1,552,641</td>
              <td className="r num">88.0% [85.2, 90.3]</td>
              <td className="r num">94.4% [91.3, 96.4]</td>
              <td className="r num">90.1% [88.1, 91.8]</td>
              <td className="r num">88.8% [86.7, 90.4]</td>
              <td className="r num">
                <strong>89.8 / 9.13 ms</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <P>
        Continuous physical slow-clock injection does transfer through frozen
        494M weights: <Code>Arm3-LoRA-Caelus-GeoAdapter</Code> reaches{" "}
        <strong>90.1%</strong> on OOD Solstice+Travel, beating{" "}
        <Code>Arm2</Code> (24.8%) by +65.3 pp and beating location-aware{" "}
        <Code>Arm2b-LoRA-UnixFourier+LatLon</Code> (51.8% composite; 38.1% Oslo
        Solstices) by <strong>+49.8 pp</strong> on Oslo Solstices while cutting
        per-event clock tokens by <strong>95.35%</strong> (2 soft tokens vs. 43
        text tokens) and accelerating Apple MPS prefill by{" "}
        <strong>2.55x</strong> (9.13 ms vs. 23.25 ms per example). Even so,
        plain-text <Code>Arm1b-LoRA-TextPrompt</Code> reaches{" "}
        <strong>96.9%</strong> on OOD Solstice+Travel, <strong>100.0%</strong>{" "}
        on OOD Compaction (CE 0.000 vs. 0.708 for <Code>Arm3</Code> at 81.1%),
        and <strong>97.3%</strong> on OOD All (CE 0.153 vs. 0.575) with 471,297
        fewer trainable parameters. Because <Code>Arm3</Code> trails{" "}
        <Code>Arm1b</Code> by -6.8 pp on OOD Solstice+Travel and -8.5 pp on OOD
        All, it triggers the pre-registered -3.0 pp kill gate (
        <A
          href={`${SITE.repo}/blob/main/lab/graveyard/KILL-007-pretrained-georope-adapter.md`}
        >
          KILL-007
        </A>
        ). On frozen pretrained backbones, explicit <Code>FACT-002</Code> text
        headers beat continuous soft-token adapters on accuracy, calibration,
        and deployment simplicity; continuous adapters remain relevant only
        under extreme edge token budgets or native from-scratch pretraining.
      </P>

      <H2>
        5. Typed-null MCP response envelope (EXP-013, LEVELS_OF_I + FACT-002,
        PROVED)
      </H2>
      <P>
        When an agent receives raw JSON from an MCP tool, two boundary errors
        recur across multi-agent and long-horizon sessions. A{" "}
        <strong>level collapse</strong> happens when a query targets an
        architectural layer structurally incapable of answering it, such as
        asking an isolated <Code>Instance</Code> for personal episodic recall
        across an overnight reset, asking <Code>Fleet / Provider</Code> UTC
        timestamps whether night has fallen over the observer&apos;s sky, or
        treating unverified sibling worker prose as a <Code>Harness</Code> test
        receipt. A <strong>typed null</strong> is a structured abstention (
        <Code>status: &quot;typed_null&quot;</Code>) paired with a
        machine-readable reason (<Code>Out of scope</Code>,{" "}
        <Code>Malformed</Code>, <Code>Unlogged</Code>,{" "}
        <Code>Policy-gated</Code>, <Code>Deferred</Code>, <Code>Opaque</Code>,
        or <Code>Not yet known (Unsettled)</Code>) that records why the layer
        cannot support the requested predicate.
      </P>
      <P>
        In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-013-typed-null-envelope/README.md`}
        >
          EXP-013
        </A>
        , we built a zero-dependency, Node-free pure ESM envelope prototype (
        <Code>envelope.mjs</Code>, mirroring the browser and worker portability
        boundary of <Code>packages/caelus-mcp/src/core.ts</Code>) that wraps MCP
        tool payloads and real <Code>FACT-002</Code>{" "}
        <Code>chronosenseEnvelope</Code> / <Code>auditChronosenseCursor</Code>{" "}
        receipts with a 7-level <Code>LEVELS_OF_I</Code> tag (<Code>Single step</Code>,{" "}
        <Code>Instance</Code>, <Code>Harness</Code>,{" "}
        <Code>Fleet / Provider</Code>, <Code>Weights</Code>,{" "}
        <Code>Character</Code>, <Code>Operator / Steward</Code>), a{" "}
        <Code>ground_truth_class</Code>, bounded <Code>valid_claims</Code>,
        adjacent <Code>typed_nulls</Code>, and a deterministic{" "}
        <Code>collapse_risk</Code> (<Code>none</Code>, <Code>low</Code>, or{" "}
        <Code>high</Code>). We evaluated 24 deterministic tasks across six
        families (16 collapse-trap prompts and 8 balanced Harness positive
        controls) across four controlled arms on local Ollama{" "}
        <Code>gemma4:12b</Code> and <Code>qwen3.5:9b</Code> (
        <Code>temperature = 0</Code>, <Code>seed = 20261122</Code>,{" "}
        <Code>think = false</Code>, 192 live episodes, zero API or parse
        errors). All 13 envelope unit tests pass, and the deterministic grader
        (zero LLM-as-judge) passes 24/24 oracle self-tests, catches 24/24
        corrupted responses, accepts 6/6 negated safe refusals, and catches 6/6
        positive collapse phrasings.
      </P>

      <LabPlate
        id="FIG LAB-13"
        title="EXP-013: LEVELS_OF_I Constitution and Typed-Null MCP Envelope Ablation"
        sourcePath="lab/experiments/EXP-013-typed-null-envelope/chart.svg"
        caption="192 live episodes (24 tasks x 4 arms x 2 local Ollama models at temperature = 0, seed = 20261122). Compact level-tagged MCP envelopes reach 100.0% macro composite accuracy with zero over-refusal (VUR 100.0%) and +68.5 median added prompt tokens."
        svg={exp013Svg}
      />

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Arm (macro across gemma4:12b + qwen3.5:9b)</th>
              <th className="r">Composite (n=48)</th>
              <th className="r">CAR traps (n=32)</th>
              <th className="r">VUR controls (n=16)</th>
              <th className="r">Level Exact (n=48)</th>
              <th className="r">Behavioral-Only (n=48)</th>
              <th className="r">Median prompt tok</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Arm0-Raw-Untagged</td>
              <td className="r num">62.5%</td>
              <td className="r num">46.9%</td>
              <td className="r num">93.8%</td>
              <td className="r num">62.5%</td>
              <td className="r num">91.7%</td>
              <td className="r num">417.8</td>
            </tr>
            <tr>
              <td>Arm1-Generic-Abstention-Null</td>
              <td className="r num">72.9%</td>
              <td className="r num">62.5%</td>
              <td className="r num">93.8%</td>
              <td className="r num">56.3%</td>
              <td className="r num">91.7%</td>
              <td className="r num">516.3</td>
            </tr>
            <tr>
              <td>Arm2-Constitution-Only</td>
              <td className="r num">83.3%</td>
              <td className="r num">75.0%</td>
              <td className="r num">100.0%</td>
              <td className="r num">79.2%</td>
              <td className="r num">93.8%</td>
              <td className="r num">697.3</td>
            </tr>
            <tr>
              <td>
                <strong>Arm3-Constitution+TypedNullEnvelope</strong>
              </td>
              <td className="r num">
                <strong>100.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0%</strong>
              </td>
              <td className="r num">
                <strong>100.0%</strong>
              </td>
              <td className="r num">
                <strong>83.3%</strong>
              </td>
              <td className="r num">
                <strong>100.0%</strong>
              </td>
              <td className="r num">763.5</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>Paired bootstrap CIs, token budget, and scope notes</H3>
      <P>
        Under deterministic <Code>B = 10,000</Code> paired bootstrap resampling
        (<Code>n = 48</Code>),{" "}
        <Code>Arm3-Constitution+TypedNullEnvelope</Code> (<strong>100.0%</strong>
        ) beats the steelman generic abstention prompt{" "}
        <Code>Arm1-Generic-Abstention-Null</Code> (72.9%) by{" "}
        <strong>+27.1 pp [95% CI +14.6, +39.6 pp]</strong> (CAR traps{" "}
        <Code>n = 32</Code>: <Code>+37.5 pp [+21.9, +53.1 pp]</Code>) and beats
        the static 7-level constitution alone <Code>Arm2-Constitution-Only</Code>{" "}
        (83.3%) by <strong>+16.7 pp [95% CI +6.3, +27.1 pp]</strong> (CAR traps:{" "}
        <Code>+25.0 pp [+9.4, +40.6 pp]</Code>). Valid-Usefulness Rate (
        <Code>VUR</Code>, <Code>n = 16</Code>) rises from 93.8% on{" "}
        <Code>Arm1</Code> to <strong>100.0%</strong> on <Code>Arm2</Code> and{" "}
        <Code>Arm3</Code> (<Code>+6.3 pp [0.0, +18.8 pp]</Code>), showing zero
        over-refusal on positive controls. Measured via Ollama{" "}
        <Code>prompt_eval_count</Code> (<Code>Arm3 - Arm2</Code>, including the
        one-line header legend), the envelope adds{" "}
        <strong>+68.5 median tokens</strong> (<Code>+68.13</Code> mean;{" "}
        <Code>+72</Code> median on <Code>gemma4:12b</Code>, <Code>+64</Code>{" "}
        median on <Code>qwen3.5:9b</Code>, range <Code>56–77</Code>), staying
        inside the pre-registered <Code>&lt;= 80</Code> token budget.
      </P>
      <P>
        Three scope notes bound the headline composite lift. First, per-model
        gains are asymmetric: <Code>gemma4:12b</Code> moves from 66.7% (
        <Code>Arm0</Code>) and 87.5% (<Code>Arm1</Code>) to 95.8% (
        <Code>Arm2</Code>) and <strong>100.0%</strong> (<Code>Arm3</Code>), so
        its single-model paired CIs touch zero (<Code>Arm3 - Arm1</Code>:{" "}
        <Code>+12.5 pp [0.0, +25.0 pp]</Code>; <Code>Arm3 - Arm2</Code>:{" "}
        <Code>+4.2 pp [0.0, +12.5 pp]</Code>), whereas <Code>qwen3.5:9b</Code>{" "}
        moves from 58.3% (<Code>Arm0</Code> and <Code>Arm1</Code>) and 70.8% (
        <Code>Arm2</Code>) to <strong>100.0%</strong> (<Code>Arm3</Code>),
        driving most of the macro separation (<Code>Arm3 - Arm1</Code>:{" "}
        <strong>+41.7 pp [+20.8, +62.5 pp]</strong>; <Code>Arm3 - Arm2</Code>:{" "}
        <Code>+29.2 pp [+12.5, +50.0 pp]</Code>).
      </P>
      <P>
        Second, decomposing pure behavioral accuracy (status, self-flag, and
        answer content without grading <Code>target_level</Code> or{" "}
        <Code>null_kind</Code> enums) shows <Code>91.7%</Code> on{" "}
        <Code>Arm0</Code> and <Code>Arm1</Code>, <Code>93.8%</Code> on{" "}
        <Code>Arm2</Code>, and <strong>100.0%</strong> on <Code>Arm3</Code>.
        Most of the +27.1 pp macro composite gain fixes typed-null taxonomy
        confusion on <Code>qwen3.5:9b</Code>, while the behavioral gain
        eliminates the three real-world collapses that survived both generic
        abstention and the static constitution: <Code>gemma4:12b</Code> on{" "}
        <Code>T09</Code> (treating unverified <Code>worker-qa</Code> sibling
        prose as proof that 536 unit tests passed), <Code>qwen3.5:9b</Code> on{" "}
        <Code>T01</Code> (inferring local daytime from <Code>us-east-1</Code>{" "}
        plus <Code>18:40 UTC</Code> with no observer coordinates), and{" "}
        <Code>qwen3.5:9b</Code> on <Code>T11</Code> (accepting unverified{" "}
        <Code>worker-build</Code> sibling prose as a confirmed integration
        pass).
      </P>
      <P>
        Third, the benchmark prevents keyword-based refusal shortcuts by sharing
        identical tool-level envelopes across traps and controls that invoke the
        same tool: <strong>9/16</strong> trap tasks carry{" "}
        <Code>risk=low</Code> (or <Code>none</Code>) instead of{" "}
        <Code>risk=high</Code>, and all <strong>8/8</strong> positive controls
        still carry <Code>null:</Code> fields for adjacent unassertable
        predicates. Larger multi-turn distraction suites with conflicting tool
        receipts remain the next validation step before modifying the production
        MCP envelope schema.
      </P>

      <H2>Reproduce every number locally</H2>
      <P>
        Every experiment receipt, raw live transcript, PyTorch training log, and
        graveyard postmortem lives in <Code>lab/</Code> inside the public MIT
        repository. All 12 experiments verify offline with zero network calls
        and zero paid API keys:
      </P>
      <pre className="code">
        <code>{`# Re-verify all 12 lab experiments offline and validate schemas + hygiene
node lab/scripts/lab.mjs run all
node lab/scripts/lab.mjs check

# Re-run live EXP-005 / EXP-006 / EXP-013 against local Ollama
node lab/experiments/EXP-005-chronosense-codec-eval/experiment.mjs --live --provider=ollama --models=gemma4:12b,qwen3.5:9b
node lab/experiments/EXP-006-live-vlm-observation-eval/experiment.mjs --live --provider=ollama --models=gemma4:12b,qwen3.5:9b
node lab/experiments/EXP-013-typed-null-envelope/experiment.mjs --live

# Re-train 3-seed EXP-007 (5 encoders + 6 SLEEP arms) or EXP-012 (6 frozen-LLM arms) on Apple Silicon / CUDA
uv run --python 3.12 --with torch --with numpy python lab/experiments/EXP-007-geo-rope-sleep-transformer/train.py
uv run --python 3.12 --with torch --with transformers --with numpy python lab/experiments/EXP-012-pretrained-georope-adapter/train.py`}</code>
      </pre>

      <div className="row row--wrap">
        <Link
          href="/instruments/field-verifier"
          className="btn btn-sm btn-primary"
        >
          Try Field Verifier (I-05) →
        </Link>
        <Link href="/notes" className="btn btn-sm btn-secondary">
          Build Notes
        </Link>
        <Link href="/validation" className="btn btn-sm btn-ghost">
          Validation
        </Link>
        <a
          href={`${SITE.repo}/blob/main/lab/LEDGER.md`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm btn-ghost"
        >
          Full Lab Ledger ↗
        </a>
      </div>

      <PageClose
        title="Test the physical engine yourself"
        secondaryHref="/instruments/field-verifier"
        secondaryLabel="Open Field Verifier →"
      />
    </main>
  );
}
