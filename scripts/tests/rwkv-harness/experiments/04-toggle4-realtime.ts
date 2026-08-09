/**
 * Phase 4b.2: L9–L11 SNR-gated Toggle-4 spike trigger + boundary-sweep on ground truth.
 *
 * Model geometry (rwkv7-g1d-0.1b, ModelInfo): state_len=608256, num_layer=12,
 * per-layer slice = 50688 floats. Late layers L9–L11 showed the best topic-shift
 * SNR (quiet in-topic floor, strong relative spike) in the per-layer breakdown.
 *
 * This experiment:
 *   (A) CONTROL  — a single unbroken topic segment (candidate3 morning-snuggle turns):
 *                  establishes the per-layer in-topic noise floor (mean Δcos) with
 *                  zero real boundaries, so threshold×mean must keep FP=0 here.
 *   (B) BOUNDARY — 5 consecutive 4-turn segments on genuinely different topics
 *                  (rust, cooking, Chloe-coffee, Space-Arc picnic, Nan0 trust):
 *                  true boundaries at turns 4, 8, 12, 16; all other turns in-topic.
 *                  The L9–L11 gated trigger is swept over multipliers 1.2–1.5 of the
 *                  CONTROL per-layer mean; we report recall/precision/F1/FPR.
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

    // --- Threshold sweep ---
    const MULTIPLIERS = [1.2, 1.3, 1.4, 1.5]
    const sweepRows: Array<{ mult: number, tp: number, fp: number, fn: number, recall: number, precision: number, f1: number, fpr: number, firedAt: number[] }> = []
    for (const mult of MULTIPLIERS) {
      // Trigger when the mean late-layer delta exceeds mult × CONTROL mean for that layer average.
      const controlMeanLate = controlLayerMean.reduce((a, x) => a + x.mean, 0) / controlLayerMean.length
      const threshold = mult * controlMeanLate
      const firedAt: number[] = []
      let tp = 0
      let fp = 0
      let fn = 0
      let neg = 0
      for (const d of sweepDeltas.slice(1)) {
        const lateMean = LATE_LAYERS.reduce((a, L) => a + (d.perLayerCosine[L] ?? 0), 0) / LATE_LAYERS.length
        const fired = lateMean > threshold
        if (labelOf(d.turn) === 1) {
          if (fired) { tp++; firedAt.push(d.turn) }
          else {
            fn++
          }
        }
        else {
          neg++
          if (fired)
            fp++
        }
      }
      const recall = tp / Math.max(1, tp + fn)
      const precision = tp / Math.max(1, tp + fp)
      const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0
      const fpr = fp / Math.max(1, neg)
      sweepRows.push({ mult, tp, fp, fn, recall, precision, f1, fpr, firedAt })
    }

    console.log('\n================ THRESHOLD SWEEP (trigger = L9–L11 mean Δcos > mult × CONTROL mean) ================')
    console.log('  mult  | threshold |   TP FP FN | recall prec   F1   FPR | fired boundary turns')
    for (const r of sweepRows) {
      const controlMeanLate = controlLayerMean.reduce((a, x) => a + x.mean, 0) / controlLayerMean.length
      const thr = (r.mult * controlMeanLate).toFixed(4)
      console.log(`  ${r.mult.toFixed(1)}x |  ${thr}   |    ${r.tp}  ${r.fp}   ${r.fn} |  ${r.recall.toFixed(2)}   ${r.precision.toFixed(2)}  ${r.f1.toFixed(2)}  ${r.fpr.toFixed(2)} | ${r.firedAt.join(',') || '—'}`)
    }

    const best = [...sweepRows].sort((a, b) => (b.f1 - a.f1) || (a.fpr - b.fpr))[0]
    console.log(`\n  Best operating point: ${best.mult}x  (F1=${best.f1.toFixed(2)}, recall=${best.recall.toFixed(2)}, FPR=${best.fpr.toFixed(2)})`)

    // Persist report
    const outDir = path.resolve(process.cwd(), 'reports')
    fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, `04-toggle4-boundary-sweep-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(outPath, JSON.stringify({
      meta: {
        lateLayers: LATE_LAYERS,
        segmentTurns: SEG,
        boundaries: trueBoundaryIdx,
        multipliers: MULTIPLIERS,
        state_len: bridge.info.stateLen,
        generatedAt: new Date().toISOString(),
      },
      controlLayerMean,
      sweepDeltaTurns: sweepDeltas.map(d => ({
        turn: d.turn,
        label: labelOf(d.turn),
        aggregateCos: d.deltaCosine,
        perLayerCosine: d.perLayerCosine,
      })),
      sweep: sweepRows,
      best,
    }, null, 2))
    console.log(`\n✓ Sweep report written to ${outPath}`)
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((e) => {
  console.error('❌ Phase 4b.2 failed:', e?.stack || String(e))
  process.exit(1)
})
