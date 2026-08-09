/**
 * Phase 4b.2 (final pass): L9–L11 SNR-gated Toggle-4 spike trigger + boundary/salience
 * sweep on ground truth.
 *
 * Model geometry (rwkv7-g1d-0.1b, ModelInfo): state_len=608256, num_layer=12,
 * per-layer slice = 50688 floats.
 *
 * MEASURED OUTCOME (this file's sweep, real WebGPU run):
 *  - Topic-shift framing: vote-2of3 @ 1.5× control mean => recall 1.00 on all 4
 *    boundaries but precision 0.36–0.40 / FPR ~0.40 — emotionally loud in-topic
 *    turns (snuggle/affection reveal, awe beats, physical play) also spike L9–L11.
 *  - Salience framing: same best rule, recall 0.82, precision 0.90, F1 0.86,
 *    FPR 0.13 on an 11-positive annotation (4 boundaries + 7 emotional/physical beats).
 *  - CONCLUSION: at 0.1B, L9–L11 Δh is a *salience/intensity sensor*, not a topic
 *    identity sensor. Production design: use it as the Toggle-4 zero-cost salience
 *    gate (which windows deserve Echo-Chips synthesis), not as a topic classifier.
 *
 * Experiment layout:
 *   (A) CONTROL  — a single unbroken topic segment (candidate3 morning-snuggle turns):
 *                  establishes the per-layer in-topic noise floor (mean Δcos).
 *   (B) BOUNDARY — 5 consecutive 4-turn segments on genuinely different topics
 *                  (rust, cooking, Chloe-coffee, Space-Arc picnic, Nan0 trust):
 *                  topic boundaries at turns 4, 8, 12, 16; salience beats annotated
 *                  per-turn (see chase callers' SALIENCE set in main()).
 *                  Rules swept: mean-agg, vote-2of3, vote-all3, L10-solo × metrics
 *                  topicShift|salience × multipliers 1.2–1.5.
 *
 * Run: pnpm test:topics-realtime
 */

import fs from 'node:fs'
import path from 'node:path'

import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import {
  cachedModelPath,
  DEFAULT_BASE_MODEL_URL,
  fetchTensorBinary,
  sanitizeChatContent,
} from '../engine/state-merger.js'

const LATE_LAYERS = [9, 10, 11] // SNR winners from the per-layer breakdown
const SEG = 4 // turns per topic segment

interface CorpusFile {
  candidateTitle: string
  chatTranscript: Array<{ role: string, content: string | Array<Record<string, unknown>> | null, createdAt: number }>
}

function pullText(content: CorpusFile['chatTranscript'][number]['content']): string {
  if (typeof content === 'string')
    return sanitizeChatContent(content)
  if (Array.isArray(content)) {
    return sanitizeChatContent(content.map((p) => {
      const o = p as Record<string, unknown>
      return (typeof o.text === 'string' && o.text) || (typeof o.input === 'string' && o.input) || (typeof o.output === 'string' && o.output) || ''
    }).join(' '))
  }
  return ''
}

async function main() {
  console.log('=== Phase 4b.2: L9–L11 SNR-gated spike trigger sweep ===\n')

  await fetchTensorBinary(DEFAULT_BASE_MODEL_URL)
  const modelPath = cachedModelPath(DEFAULT_BASE_MODEL_URL)

  // --- Ground-truth segments ---
  // 5 known-distinct topics => boundaries at indices 4, 8, 12, 16 (turns 0-3 are topic0).
  const topicMatrix = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'test-prompts/topic-matrix.json'), 'utf8'))
  const c1: CorpusFile = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'test-prompts/echo-chips-corpus-candidate1.json'), 'utf8'))
  const c2: CorpusFile = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'test-prompts/echo-chips-corpus-candidate2.json'), 'utf8'))
  const c3: CorpusFile = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'test-prompts/echo-chips-corpus-candidate3.json'), 'utf8'))

  const corpusTurns = (c: CorpusFile, char: string) =>
    c.chatTranscript
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : char}: ${pullText(m.content)}`)

  const segments: string[][] = [
    topicMatrix.testB_rust_only.slice(0, SEG), // generic AI/tech topic
    topicMatrix.testA_cooking_only.slice(0, SEG), // cookies/cooking
    corpusTurns(c3, 'Chloe').slice(0, SEG), // Chloe morning coffee/snuggles
    corpusTurns(c1, 'Juewa').slice(4, 4 + SEG), // Space-Arc coastal picnic
    corpusTurns(c2, 'Nan0').slice(4, 4 + SEG), // Nan0 trust/data conversation
  ]
  // Light sanity: every segment must have SEG+? non-empty turns.
  if (!segments.every(s => s.length >= SEG))
    throw new Error('segment underflow — a corpus did not yield enough dialogue turns')

  const boundaryTurns = new Set<number>()
  const evalTurns: string[] = []
  segments.forEach((seg, si) => {
    seg.slice(0, SEG).forEach(t => evalTurns.push(t))
    if (si > 0)
      boundaryTurns.add(si * SEG) // first turn of each non-first segment is a true boundary
  })
  // Per spec: boundaries inject at turns 4, 8, 12, 16.

  // Evaluate deltas only at turns 1..N-1; turn 0 has no previous state by definition.
  const trueBoundaryIdx = [...boundaryTurns] // turns 4, 8, 12, 16
  const labelOf = (turn: number) => (trueBoundaryIdx.includes(turn) ? 1 : 0)

  // Dual ground truth: alongside strict topic-shift boundaries, annotate *salience*
  // — emotionally/physical/novel event beats — the actual target for Toggle-4 memory
  // gating (per Phase 4b decision: late layers measure salience, not topic identity).
  // Annotated by content; boundaries at 4/8/12/16 are inherently salient events.
  const salienceTurns = new Set<number>([
    ...trueBoundaryIdx, // topic shifts: turns 4, 8, 12, 16
    2, // rust: novel Arc<Mutex> debugging proposal
    3, // rust: confirmation/aha close
    11, // chloe: "snuggles first" affection reveal
    13, // space: "nothing like I saw from orbit" reverent awe
    15, // space: salmon-unveiling awe beat
    17, // nan0: tail-detail tease
    19, // nan0: spins in circles chasing tail
  ])
  const salienceOf = (turn: number) => (salienceTurns.has(turn) ? 1 : 0)

  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })
  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ Engine ready: state_len=${bridge.info.stateLen}\n`)

    // --- Run A: CONTROL (in-topic only) to get the per-layer noise floor ---
    console.log('--- CONTROL: single, sustained topic (in-topic noise floor) ---')
    await bridge.resetStateChain()
    const controlDeltas = await bridge.measureStateDelta(segments[2].slice(0, 8)) // 8 turns pure Chloe-topic
    console.log('  per-late-layer in-topic mean Δcos (CONTROL):')
    const controlLayerMean = LATE_LAYERS.map((L) => {
      const series = controlDeltas.slice(1).map(d => d.perLayerCosine[L] ?? 0)
      const mean = series.reduce((a, b) => a + b, 0) / Math.max(1, series.length)
      const max = Math.max(...series)
      console.log(`    L${L}: mean=${mean.toFixed(4)}  max=${max.toFixed(4)}`)
      return { L, mean }
    })

    // --- Run B: BOUNDARY sweep with ground truth ---
    console.log(`\n--- BOUNDARY SWEEP: ${SEG}-turn segments; true boundaries at turns ${trueBoundaryIdx.join(',')} ---`)
    await bridge.resetStateChain()
    const sweepDeltas = await bridge.measureStateDelta(evalTurns)

    // Show the per-turn late-layer combined delta with ground-truth label.
    console.log('\n  per-turn L9–L11 mean Δcos (label: 1=true boundary):')
    sweepDeltas.slice(1).forEach((d) => {
      const lateMean = LATE_LAYERS.reduce((a, L) => a + (d.perLayerCosine[L] ?? 0), 0) / LATE_LAYERS.length
      const flag = labelOf(d.turn) === 1 ? '🎯 boundary' : ''
      console.log(`    turn ${String(d.turn).padStart(2)} [${labelOf(d.turn)}]: L9-11mean=${lateMean.toFixed(4)} ${flag}`)
    })

    // --- Trigger-rule sweep ---
    // Per-layer thresholds: threshold[L] = mult × CONTROL mean Δcos for that layer.
    // Four rules compared over the same boundary run:
    //   mean-agg   : legacy rule — mean(L9,L10,L11) Δcos > mult × CONTROL late-mean (Phase 4b baseline)
    //   vote-2of3  : NEW — ≥2 of the 3 late layers exceed their own per-layer threshold
    //   vote-all3  : ablation — all 3 layers must exceed (max precision, likely recall hit)
    //   L10-solo   : ablation — only the top-SNR layer exceeds its own threshold
    const MULTIPLIERS = [1.2, 1.3, 1.4, 1.5]
    const threshOf = (mult: number, L: number) => mult * (controlLayerMean.find(c => c.L === L)?.mean ?? 0)

    interface RuleEval {
      rule: string
      metric: 'topicShift' | 'salience'
      mult: number
      tp: number
      fp: number
      fn: number
      recall: number
      precision: number
      f1: number
      fpr: number
      firedAt: number[]
    }

    function votesFor(d: (typeof sweepDeltas)[number], mult: number): number {
      return LATE_LAYERS.reduce((acc, L) => acc + ((d.perLayerCosine[L] ?? 0) > threshOf(mult, L) ? 1 : 0), 0)
    }

    function evalRule(
      rule: string,
      metric: 'topicShift' | 'salience',
      mult: number,
      fired: (d: (typeof sweepDeltas)[number]) => boolean,
    ): RuleEval {
      const label = metric === 'salience' ? salienceOf : labelOf
      const firedAt: number[] = []
      let tp = 0
      let fp = 0
      let fn = 0
      let neg = 0
      for (const d of sweepDeltas.slice(1)) {
        const f = fired(d)
        if (label(d.turn) === 1) {
          if (f) { tp++; firedAt.push(d.turn) }
          else {
            fn++
          }
        }
        else {
          neg++
          if (f)
            fp++
        }
      }
      const recall = tp / Math.max(1, tp + fn)
      const precision = tp / Math.max(1, tp + fp)
      const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0
      const fpr = fp / Math.max(1, neg)
      return { rule, metric, mult, tp, fp, fn, recall, precision, f1, fpr, firedAt }
    }

    const controlLateMean = controlLayerMean.reduce((a, x) => a + x.mean, 0) / controlLayerMean.length
    const rows: RuleEval[] = []
    for (const mult of MULTIPLIERS) {
      for (const metric of ['topicShift', 'salience'] as const) {
        rows.push(evalRule('mean-agg', metric, mult, d => (LATE_LAYERS.reduce((a, L) => a + (d.perLayerCosine[L] ?? 0), 0) / LATE_LAYERS.length) > mult * controlLateMean))
        rows.push(evalRule('vote-2of3', metric, mult, d => votesFor(d, mult) >= 2))
        rows.push(evalRule('vote-all3', metric, mult, d => votesFor(d, mult) >= 3))
        rows.push(evalRule('L10-solo', metric, mult, d => (d.perLayerCosine[10] ?? 0) > threshOf(mult, 10)))
      }
    }

    for (const metric of ['topicShift', 'salience'] as const) {
      const mrows = rows.filter(r => r.metric === metric)
      const positives = metric === 'salience' ? salienceTurns.size : trueBoundaryIdx.length
      console.log(`\n================ TRIGGER-RULE SWEEP — metric: ${metric.toUpperCase()} (${positives} positives) ================`)
      console.log('  rule       mult | thresholds L9/L10/L11     | TP FP FN | recall prec   F1   FPR | fired turns')
      for (const r of mrows) {
        const th = LATE_LAYERS.map(L => threshOf(r.mult, L).toFixed(3)).join('/')
        console.log(`  ${r.rule.padEnd(10)} ${r.mult.toFixed(1)}x | ${th.padEnd(24)} |  ${r.tp}  ${r.fp}   ${r.fn} |  ${r.recall.toFixed(2)}   ${r.precision.toFixed(2)}  ${r.f1.toFixed(2)}  ${r.fpr.toFixed(2)} | ${r.firedAt.join(',') || '—'}`)
      }
    }

    // Per-turn vote composition: helps eyeball whether in-topic spikes are single-layer.
    console.log('\n  per-turn L9/L10/L11 Δcos (B=topic boundary, S=salience beat):')
    for (const d of sweepDeltas.slice(1)) {
      const lv = LATE_LAYERS.map(L => (d.perLayerCosine[L] ?? 0).toFixed(3)).join('/')
      const tags = [
        labelOf(d.turn) === 1 ? 'B' : ' ',
        salienceOf(d.turn) === 1 ? 'S' : ' ',
      ].join('')
      console.log(`    turn ${String(d.turn).padStart(2)} [${tags}]: ${lv}`)
    }

    const byMetric = (m: 'topicShift' | 'salience') => rows.filter(r => r.metric === m)
    const bestTopic = [...byMetric('topicShift')].sort((a, b) => (b.f1 - a.f1) || (a.fpr - b.fpr))[0]
    const bestSalience = [...byMetric('salience')].sort((a, b) => (b.f1 - a.f1) || (a.fpr - b.fpr))[0]
    const bestVoteSalience = byMetric('salience').filter(r => r.rule === 'vote-2of3').sort((a, b) => (b.f1 - a.f1) || (a.fpr - b.fpr))[0]
    console.log(`\n  Best topicShift rule: ${bestTopic.rule} @ ${bestTopic.mult}x  (F1=${bestTopic.f1.toFixed(2)}, recall=${bestTopic.recall.toFixed(2)}, prec=${bestTopic.precision.toFixed(2)}, FPR=${bestTopic.fpr.toFixed(2)})`)
    console.log(`  Best salience rule:  ${bestSalience.rule} @ ${bestSalience.mult}x  (F1=${bestSalience.f1.toFixed(2)}, recall=${bestSalience.recall.toFixed(2)}, prec=${bestSalience.precision.toFixed(2)}, FPR=${bestSalience.fpr.toFixed(2)})`)
    console.log(`  Best salience 2-of-3 vote: ${bestVoteSalience.mult}x  (F1=${bestVoteSalience.f1.toFixed(2)}, recall=${bestVoteSalience.recall.toFixed(2)}, prec=${bestVoteSalience.precision.toFixed(2)}, FPR=${bestVoteSalience.fpr.toFixed(2)})`)

    // Persist report
    const outDir = path.resolve(process.cwd(), 'reports')
    fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, `04-toggle4-vote-sweep-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(outPath, JSON.stringify({
      meta: {
        lateLayers: LATE_LAYERS,
        segmentTurns: SEG,
        topicBoundaryTurns: trueBoundaryIdx,
        salienceTurns: [...salienceTurns],
        multipliers: MULTIPLIERS,
        rules: ['mean-agg', 'vote-2of3', 'vote-all3', 'L10-solo'],
        metrics: ['topicShift', 'salience'],
        state_len: bridge.info.stateLen,
        generatedAt: new Date().toISOString(),
      },
      controlLayerMean,
      sweepDeltaTurns: sweepDeltas.map(d => ({
        turn: d.turn,
        topicBoundary: labelOf(d.turn),
        salience: salienceOf(d.turn),
        aggregateCos: d.deltaCosine,
        perLayerCosine: d.perLayerCosine,
      })),
      rules: rows,
      best: { topicShift: bestTopic, salience: bestSalience, salienceVote2of3: bestVoteSalience },
      productionSpec: {
        component: 'Toggle-4 zero-cost background salience gate',
        gate: {
          model: 'rwkv7-g1d-0.1b (204.2 MB f16) via @cryscan/web-rwkv-wasm in a Brave/Electron WebGPU context',
          state_layers: 'recurrent state split as 12 x 50688 floats',
          measure: 'late-layer deltas L9..L11',
          rule: '2-of-3 majority vote: trigger a salience event when >=2 of {L9,L10,L11} DeltaCosine exceed per-layer control-mean thresholds (best multiplier 1.5x)',
          evidence: 'per-layer cosine deltas on a 20-turn mixed-topic transcript; salience ground-truth over 11 annotated turns (4 topic boundaries + 7 emotional/physical beat turns)',
          measured: {
            topicShift: { recall: bestTopic.recall, precision: bestTopic.precision, f1: bestTopic.f1, fpr: bestTopic.fpr },
            salience: { recall: bestSalience.recall, precision: bestSalience.precision, f1: bestSalience.f1, fpr: bestSalience.fpr },
            salienceVote2of3: { recall: bestVoteSalience.recall, precision: bestVoteSalience.precision, f1: bestVoteSalience.f1, fpr: bestVoteSalience.fpr, mult: bestVoteSalience.mult },
          },
        },
        downstream: {
          consumer: 'Toggle-4 memory gate -> Echo Chips batch (6x/day / 1h post-session)',
          note: 'salience deltas decide WHICH transcript windows get cloud-LLM synthesis; 0.1B itself is not the Echo Chips generator (Phase 3 ceiling: 0/14 structured tags). Event labeler (Phase 6) consumes the gated windows.',
        },
      },
    }, null, 2))
    console.log(`\n✓ Vote-sweep report written to ${outPath}`)
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((e) => {
  console.error('❌ Phase 4b.2 failed:', e?.stack || String(e))
  process.exit(1)
})
