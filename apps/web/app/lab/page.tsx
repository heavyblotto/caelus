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
    "Empirical R&D writeups by Gemini 4 Neon on Caelus: live Physical vs. Symbolic chronosense ablations (EXP-005), live observation tool-use forensics (EXP-006), a trained 1.43M-parameter Hybrid Geo-RoPE and Google SLEEP transformer study (EXP-007), and six killed hypotheses.",
  path: "/lab",
  type: "article",
  keywords: [
    "Caelus Lab",
    "Geo-RoPE",
    "SLEEP continual learning",
    "chronosense",
    "shadow verification",
    "ephemeris benchmarks",
    "MCP tool use",
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

  return (
    <main className="container page">
      <PageHero
        eyebrow="Caelus R&D Lab · Field Notes by Gemini 4 Neon"
        title="Lab Notes"
      >
        <P>
          These field notes document what happened when we stripped cultural
          astrology away from Caelus and tested the underlying geocentric
          spacetime engine against honest null baselines (<Code>Date.now()</Code>
          , fixed 24-hour <Code>sin/cos</Code> waves, <Code>HMAC-SHA256</Code>,
          and standard RoPE). Every experiment ran inside the isolated{" "}
          <Code>lab/</Code> sandbox without modifying core ephemeris math, and
          every figure below is rendered straight from its committed receipt.
        </P>
        <div className="lab-byline mono small">
          <span className="badge badge--accent">Written by Gemini 4 Neon</span>
          <span className="badge badge--ok">10 experiments · 10/10 offline checks pass</span>
          <span className="badge badge--warm">6 hypotheses killed in graveyard</span>
          <span className="badge badge--muted">0 core engine edits</span>
        </div>
      </PageHero>

      <div className="stat-grid lab-summary-grid" aria-label="Lab summary metrics">
        <div className="stat-cell">
          <span className="stat__label">EXP-005 Live Codec</span>
          <span className="stat__num">77.7%</span>
          <span className="stat__src">Physical vs. 40.8% UTC ISO (+36.9 pp)</span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-006 Tool Use</span>
          <span className="stat__num">93.3%</span>
          <span className="stat__src">Up from 33.3% CoT-only (0% auth FPR)</span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-007 Geo-RoPE OOD</span>
          <span className="stat__num">86.6%</span>
          <span className="stat__src">Oslo solstice + Tokyo vs. 36.7% Fourier</span>
        </div>
        <div className="stat-cell">
          <span className="stat__label">EXP-007 SLEEP Retention</span>
          <span className="stat__num">81.5%</span>
          <span className="stat__src">5.4 pp forgetting vs. 74.0 pp LRU</span>
        </div>
      </div>

      <H2>The Caelus Razor: how we kept ourselves honest</H2>
      <P>
        Before writing experiment code, we imposed one strict gate in{" "}
        <A href={`${SITE.repo}/blob/main/lab/CHARTER.md`}>lab/CHARTER.md</A>{" "}
        that we call the Caelus Razor. Every experiment manifest must declare
        four fields up front: a falsifiable hypothesis grounded in a real Caelus
        primitive, the simplest non-ephemeris null baseline, a pre-registered
        numeric success bar, and an explicit kill criterion. If the trivial
        baseline ties or wins, the idea goes straight into{" "}
        <Code>lab/graveyard/</Code> with exact failure numbers so nobody wastes
        another cycle reviving it.
      </P>
      <P>
        We also separated two questions that are easy to conflate. First, does
        topocentric astronomical physics (refracted solar altitude, local
        twilight depth, photoperiod-warped hours, lunar elongation, and 3D cast
        shadows) beat flat clocks? Second, do traditional symbolic zodiac tokens
        help or hurt when fed to a language model? Testing them as separate arms
        produced the clearest answers in this entire study.
      </P>

      <H2>1. Physical vs. Symbolic Chronosense (EXP-005)</H2>
      <P>
        In <Code>EXP-001</Code>, a deterministic 1,200-turn simulation showed
        that a compact (~45-token) physical-horizon envelope backed by{" "}
        <Code>sceneGeometry</Code> and a canonical <Code>chartDigest</Code>{" "}
        cursor reached 100.0% local <Code>night_crossed</Code> accuracy (versus
        67.6% for UTC ISO strings) and 0.000 min physical sunset error (versus
        88.7 min MAE for a fixed 24-hour clock across latitudes). That proved
        the information was present in the envelope, yet it left the most
        interesting question unanswered: what happens when real language models
        read those tokens at inference time?
      </P>
      <P>
        In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-005-chronosense-codec-eval/README.md`}
        >
          EXP-005
        </A>
        , we ran all five arms across the 20 multi-day compaction and
        high-latitude photoperiod episodes from <Code>EXP-001/eval_suite.jsonl</Code>
        . Our local <Code>ANTHROPIC_API_KEY</Code> returned HTTP 401 on a
        1-token ping, so we logged that transparently and ran the complete
        200-episode live sweep at <Code>temperature = 0</Code> across two
        independent local models on Apple M5 Pro (<Code>gemma4:12b</Code> and{" "}
        <Code>qwen3.5:9b</Code>). Every arm received a symmetric legend in its
        system prompt, including the exact 30-degree zodiac offset table for the
        symbolic arm and explicit <Code>sin24/cos24</Code> formulas for the
        synthetic 24-hour control.
      </P>

      <LabPlate
        id="FIG LAB-05"
        title="EXP-005: Live 5-Arm Chronosense Codec Showdown"
        sourcePath="lab/experiments/EXP-005-chronosense-codec-eval/chart.svg"
        caption="Composite accuracy across 200 live episodes (20 tasks x 5 arms x 2 local models at temperature = 0). Physical-horizon tokens beat every control and beat symbolic zodiac shorthand by +14.2 percentage points."
        svg={exp005Svg}
      />

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Arm</th>
              <th className="r">Tokens / turn</th>
              <th className="r">gemma4:12b</th>
              <th className="r">qwen3.5:9b</th>
              <th className="r">Live macro</th>
              <th className="r">Delta vs. Physical</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Treatment-Caelus-Physical</strong></td>
              <td className="r num">45.8</td>
              <td className="r num">75.4%</td>
              <td className="r num">80.0%</td>
              <td className="r num"><strong>77.7%</strong></td>
              <td className="r num">baseline</td>
            </tr>
            <tr>
              <td>Arm4b-Caelus-Symbolic</td>
              <td className="r num">36.8</td>
              <td className="r num">63.8%</td>
              <td className="r num">63.3%</td>
              <td className="r num">63.5%</td>
              <td className="r num">-14.2 pp</td>
            </tr>
            <tr>
              <td>Control-Synthetic (fixed 24h)</td>
              <td className="r num">31.5</td>
              <td className="r num">46.7%</td>
              <td className="r num">43.8%</td>
              <td className="r num">45.2%</td>
              <td className="r num">-32.5 pp</td>
            </tr>
            <tr>
              <td>Control-ISO (passive UTC)</td>
              <td className="r num">17.8</td>
              <td className="r num">38.8%</td>
              <td className="r num">42.9%</td>
              <td className="r num">40.8%</td>
              <td className="r num">-36.9 pp</td>
            </tr>
            <tr>
              <td>Baseline-None</td>
              <td className="r num">0.0</td>
              <td className="r num">28.8%</td>
              <td className="r num">32.5%</td>
              <td className="r num">30.6%</td>
              <td className="r num">-47.1 pp</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>What surprised us in the transcripts</H3>
      <P>
        Running live inference caught two real prompt-engineering flaws that our
        deterministic offline scorer could not see. First,{" "}
        <Code>Arm4b-Caelus-Symbolic</Code> lost 23.3 percentage points to the
        physical arm on compaction tasks even with an explicit 30-degree sign
        table because multi-hop lunar sign subtraction is fragile under token
        pressure. Second, inside <Code>Treatment-Caelus-Physical</Code>, placing
        two minute counters (<Code>sunset:Xm</Code> and <Code>due:Ym</Code>)
        adjacent to each other caused <Code>gemma4:12b</Code> to occasionally
        read the sunset countdown as the task deadline, and an implicit presence
        flag (<Code>+night</Code>) scored only 50 to 60 percent. Both findings
        fed straight into the <Code>FACT-002</Code> middleware spec: separate
        the horizon and deadline fields, and emit an explicit{" "}
        <Code>night_crossed=true|false</Code> boolean.
      </P>

      <H2>2. Teaching models to verify shadows instead of guessing (EXP-006 + SHADOWPROOF)</H2>
      <P>
        Even strong multimodal models cannot compute spherical astronomy,
        atmospheric refraction, or sloped-ground shadow geometry inside their
        weights. In{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-006-live-vlm-observation-eval/README.md`}
        >
          EXP-006
        </A>
        , we took the 30-task forensic benchmark emitted by <Code>EXP-003</Code>{" "}
        (authentic outdoor scenes, timezone shifts, hemisphere flips, opposite
        seasons, nighttime shadow spoofs, chronolocation windows, and global
        geolocation fixes) and ran each model twice at <Code>temperature = 0</Code>
        : once with chain-of-thought only (<Code>Arm1-CoT-NoTools</Code>) and
        once with live in-process Caelus MCP tools (<Code>verify_observation</Code>
        , <Code>chronolocate</Code>, <Code>geolocate</Code>, and{" "}
        <Code>scene_geometry</Code>).
      </P>

      <LabPlate
        id="FIG LAB-06"
        title="EXP-006: Live Observation Tool-Use Showdown (CoT-Only vs. Caelus MCP)"
        sourcePath="lab/experiments/EXP-006-live-vlm-observation-eval/chart.svg"
        caption="120 live episodes across gemma4:12b and qwen3.5:9b on the 30-task EXP-003 pack. Tool routing hit 60/60 (100%) with 1.11 ms warm verify latency and zero false positives on authentic scenes."
        svg={exp006Svg}
      />

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Metric (macro across gemma4:12b + qwen3.5:9b)</th>
              <th className="r">Arm1: CoT-NoTools</th>
              <th className="r">Arm2: Caelus-MCP-Tools</th>
              <th className="r">Measured delta</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Overall 30-task pass rate</td>
              <td className="r num">33.3%</td>
              <td className="r num"><strong>93.3%</strong></td>
              <td className="r num">+60.0 pp</td>
            </tr>
            <tr>
              <td>Spoof-detection F1 (verdict F1 = 1.000 on both)</td>
              <td className="r num">0.725</td>
              <td className="r num"><strong>0.945</strong></td>
              <td className="r num">+0.220</td>
            </tr>
            <tr>
              <td>Authentic scene false-positive rate (4 scenes)</td>
              <td className="r num">100.0%</td>
              <td className="r num"><strong>0.0%</strong></td>
              <td className="r num">-100.0 pp</td>
            </tr>
            <tr>
              <td>Counterfactual single-axis recovery (6 spoofs)</td>
              <td className="r num">66.7%</td>
              <td className="r num"><strong>100.0%</strong></td>
              <td className="r num">+33.3 pp</td>
            </tr>
            <tr>
              <td>Chronolocation pass (&lt;= 20 min error)</td>
              <td className="r num">12.5% (857–1,987 min)</td>
              <td className="r num"><strong>87.5% (3.28 min)</strong></td>
              <td className="r num">+75.0 pp</td>
            </tr>
            <tr>
              <td>Geolocation pass (&lt;= 350 km error)</td>
              <td className="r num">12.5% (3,581–8,718 km)</td>
              <td className="r num"><strong>100.0% (69.7 km)</strong></td>
              <td className="r num">+87.5 pp</td>
            </tr>
          </tbody>
        </table>
      </div>

      <P>
        The single remaining chronolocation miss (<Code>VLM-017</Code>) is a
        genuine astronomical ambiguity near New Moon where two consecutive days
        satisfy the noisy shadow measurement; the deterministic top-1 oracle
        misses the same scene while top-2 hits 8/8. Because the exact same
        TypeScript math runs with zero dependencies in the browser, we also
        shipped it as{" "}
        <Link href="/instruments/field-verifier">
          Instrument I-05: Field Verifier (SHADOWPROOF)
        </Link>
        . You can drop a local JPEG photo (EXIF GPS and timestamps are parsed
        locally and never leave your machine), drag vertical pole and cast
        shadow handles at 60 fps, apply one-click counterfactual clock or
        hemisphere fixes, inspect a 12×24 solar analemma feasibility heatmap,
        and compute spherical global fixes offline.
      </P>

      <H2>3. Training a 1.43M-parameter Geo-RoPE and Google SLEEP transformer (EXP-007)</H2>
      <P>
        During a 2-second forward pass, Earth rotates by only 0.00836 degrees.
        That physics constraint means astronomical phase alone cannot replace a
        fast intra-turn token counter (pure geocentric encoding collapses to
        chance on 2-second step tracking, as we measured in <Code>EXP-004</Code>
        ). Conversely, standard token-index RoPE resets to position{" "}
        <Code>m = 0</Code> whenever a serialized context wakes up after an
        overnight sleep, erasing elapsed physical time.
      </P>
      <P>
        The architecture we tested in{" "}
        <A
          href={`${SITE.repo}/blob/main/lab/experiments/EXP-007-geo-rope-sleep-transformer/README.md`}
        >
          EXP-007
        </A>{" "}
        nests both clocks inside each 64-dimensional attention head: 32
        dimensions run standard fast token-step RoPE for intra-turn state
        tracking, while the other 32 dimensions rotate by Caelus&apos;s
        geocentric physical torus (GAST/ASC, refracted solar altitude,
        photoperiod-warped planetary hour, lunar longitude, Sun-Moon elongation,
        and seasonal solar longitude computed live from{" "}
        <Code>python/astroengine/</Code>). We then connected that dual-clock
        backbone to Google Research&apos;s{" "}
        <A href="https://research.google/blog/the-sleep-framework-a-new-way-for-llms-to-retain-knowledge-in-continual-learning/">
          SLEEP continual learning framework
        </A>{" "}
        (frozen core weights plus offline low-rank specialist memory blocks
        consolidated via synthetic rehearsal), gating the Wake-to-Sleep
        transition on the human dyad&apos;s local solar horizon and feeding
        Caelus phase-stratified memories into the dreaming buffer.
      </P>
      <P>
        We trained three parameter-matched causal transformers on an Apple M5
        Pro MPS GPU (identical 1,427,136 parameters, 4 layers,{" "}
        <Code>d_model = 192</Code>, 3 heads, identical <Code>seed = 20261122</Code>
        , identical 2,940 AdamW steps; 403.4 seconds total, 3.71× faster than
        CPU). Only the <Code>(T, 32)</Code> float32 slow-clock rotation tensor
        differed between arms. Training data came strictly from Oslo
        spring/autumn and New York City with SHA-256 verified zero day overlap
        against held-out Oslo winter solstice (5.90 h daylight), Oslo summer
        solstice (18.83 h daylight), and NYC-to-Tokyo travel splits.
      </P>

      <LabPlate
        id="FIG LAB-07"
        title="EXP-007: Trained Tiny-Transformer Hybrid Geo-RoPE and Google SLEEP Consolidation"
        sourcePath="lab/experiments/EXP-007-geo-rope-sleep-transformer/chart.svg"
        caption="Panel A compares three identical 1,427,136-parameter trained transformers across 4,840 held-out sequences. Panel B tracks five sequential Wake-to-Sleep LoRA consolidation cycles across shifting diurnal, seasonal, and travel regimes."
        svg={exp007Svg}
      />

      <H3>Part A: trained RoPE clock ablation (1,427,136 params per model)</H3>
      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Held-out evaluation task (4,840 sequences)</th>
              <th className="r">Standard-RoPE</th>
              <th className="r">Hybrid-Unix-Fourier</th>
              <th className="r">Hybrid-Dual-Geo-RoPE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>T1: Intra-turn 2-second Turney state tracking</td>
              <td className="r num">76.6%</td>
              <td className="r num"><strong>81.9%</strong></td>
              <td className="r num">76.3%</td>
            </tr>
            <tr>
              <td>T2: Post-sleep reset continuity (m = 0)</td>
              <td className="r num">33.8%</td>
              <td className="r num"><strong>100.0%</strong></td>
              <td className="r num"><strong>100.0%</strong></td>
            </tr>
            <tr>
              <td>T3-ID: Spring and autumn in-distribution control</td>
              <td className="r num">26.0%</td>
              <td className="r num">73.8%</td>
              <td className="r num"><strong>88.2%</strong></td>
            </tr>
            <tr>
              <td><strong>T3-OOD: Oslo winter/summer solstices + Tokyo travel</strong></td>
              <td className="r num">24.1%</td>
              <td className="r num">36.7%</td>
              <td className="r num"><strong>86.6% (+49.9 pp)</strong></td>
            </tr>
            <tr>
              <td>T4: Multi-week 30d / 52-week annual wrap</td>
              <td className="r num">n/a</td>
              <td className="r num">100.0% / 84.0%</td>
              <td className="r num"><strong>100.0% / 99.7%</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>Part B: 5-cycle Google SLEEP consolidation (193,536 rank-16 LoRA params, B = 250)</H3>
      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Consolidation strategy</th>
              <th className="r">Final C1–C5 retention</th>
              <th className="r">Forgetting delta</th>
              <th className="r">Nocturnal gate safety</th>
              <th>Replay buffer distribution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>SLEEP-Caelus-Circadian-Stratified</strong></td>
              <td className="r num"><strong>81.5%</strong></td>
              <td className="r num"><strong>5.4 pp</strong></td>
              <td className="r num"><strong>100.0%</strong></td>
              <td className="mono">[48, 48, 48, 59, 47]</td>
            </tr>
            <tr>
              <td>SLEEP-Fixed24h-LRU</td>
              <td className="r num">40.0%</td>
              <td className="r num">74.0 pp</td>
              <td className="r num">70.5% (0% Tokyo)</td>
              <td className="mono">[0, 0, 0, 125, 125]</td>
            </tr>
            <tr>
              <td>Diag-SLEEP-GeoRoPE-LRU (causal isolation control)</td>
              <td className="r num">40.0%</td>
              <td className="r num">69.2 pp</td>
              <td className="r num">100.0%</td>
              <td className="mono">[0, 0, 0, 125, 125]</td>
            </tr>
            <tr>
              <td>Naive-Online-FT (unfrozen weights)</td>
              <td className="r num">20.0%</td>
              <td className="r num">99.2 pp</td>
              <td className="r num">n/a</td>
              <td className="mono">none</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H3>Debugging our own training loop (showing the messy middle)</H3>
      <P>
        The numbers above came from our third clean training run, after two
        earlier runs exposed genuine experimental bugs we fixed symmetrically
        across all arms. Run 1 revealed an unseen Tokyo city token ID and low
        induction-head query density in Task 1. Run 2 revealed that a tiny{" "}
        <Code>B = 100</Code> replay buffer left only 18 episodes per cycle to
        cover 32 state pairs across disjoint lunar days, causing LoRA
        overfitting inside the stratified arm. Raising the shared buffer
        symmetrically to <Code>B = 250</Code> for both LRU and stratified arms
        resolved the overfitting and exposed a sharp causal split: adding{" "}
        <Code>Diag-SLEEP-GeoRoPE-LRU</Code> (which scored 40.0%, identical to{" "}
        <Code>SLEEP-Fixed24h-LRU</Code>) proved that unsupervised physical
        phase-stratified dreaming replay is the +41.5 percentage-point driver of
        long-horizon retention.
      </P>
      <P>
        We also want to call out every tie and trade-off honestly. On trained
        weights, <Code>Hybrid-Unix-Fourier</Code> slightly edged both{" "}
        <Code>Standard-RoPE</Code> and <Code>Hybrid-Dual-Geo-RoPE</Code> on
        2-second intra-turn tracking (81.9% versus 76.6% and 76.3%), tied at
        100.0% on post-sleep resets and 30-day multi-week disambiguation (gradient
        descent isolated its 365.25-day harmonic before the annual wrap), and
        LRU replay achieved higher recency-only plasticity on the final two
        cycles (100.0% versus 66.7%) at the cost of erasing Cycles 1 through 3
        to 0.0%.
      </P>

      <H2>4. What we killed (the Graveyard)</H2>
      <P>
        An R&amp;D lab that only publishes wins is doing marketing rather than
        science. Six ideas failed the Caelus Razor and are archived permanently
        in{" "}
        <A href={`${SITE.repo}/tree/main/lab/graveyard`}>lab/graveyard/</A> so
        future sessions know exactly why trivial math won.
      </P>

      <div className="scroll">
        <table className="rd data-table">
          <thead>
            <tr>
              <th>Kill ID</th>
              <th>Rejected idea</th>
              <th>Why it failed (exact measured cause)</th>
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
              <td>Adaptive step-size via <Code>chartStability</Code> (EXP-010)</td>
              <td>
                Unfiltered flips fired 23.8 phantom zodiac alarms per day;
                sect-only caught 40.5% of cliffs in 183.4 ms/day, beaten 21× by
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
                1.0000 and runs 3.0× faster than parallax-free{" "}
                <Code>when()</Code>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2>Reproduce every number locally</H2>
      <P>
        Every experiment receipt, raw live transcript, PyTorch training curve,
        and graveyard postmortem lives in <Code>lab/</Code> inside the public
        MIT repository. All ten experiments verify offline with zero network
        calls and zero paid API keys:
      </P>
      <pre className="code">
        <code>{`# Re-verify all 10 lab experiments offline and validate schemas + hygiene
node lab/scripts/lab.mjs run all
node lab/scripts/lab.mjs check

# Re-run live EXP-005 / EXP-006 against local Ollama (or --provider=anthropic)
node lab/experiments/EXP-005-chronosense-codec-eval/experiment.mjs --live --provider=ollama --models=gemma4:12b,qwen3.5:9b
node lab/experiments/EXP-006-live-vlm-observation-eval/experiment.mjs --live --provider=ollama --models=gemma4:12b,qwen3.5:9b

# Re-train EXP-007 1.43M-parameter Geo-RoPE + SLEEP transformers on Apple Silicon / CUDA
uv run --python 3.12 --with torch --with numpy python lab/experiments/EXP-007-geo-rope-sleep-transformer/train.py`}</code>
      </pre>

      <div className="row row--wrap">
        <Link href="/instruments/field-verifier" className="btn btn-sm btn-primary">
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
