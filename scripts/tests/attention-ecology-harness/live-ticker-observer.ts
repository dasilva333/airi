import path from 'node:path'

import { computeImageDelta } from './engine/stage0-phash.js'
import { calculateCosineSimilarity, disposeVisionEncoder, getVisionEmbedding, normalizeVector } from './engine/stage1-vision-embed.js'
import { analyzeDeltaRegion, disposeOcrEngine } from './engine/stage2-ocr.js'
import { classifyZeroShot, disposeTextEncoder, evaluateSalience } from './engine/stage2-salience-eval.js'
import { disposeVlmForwarder, runForwarder } from './engine/stage3-vlm-forwarder.js'

const FIXTURES_DIR = path.resolve(import.meta.dirname, 'test-screenshots')

const TEST_CYCLES = [
  { id: '01', name: '01-static-editor.png', desc: 'Baseline Work Centroid v0 (VS Code)' },
  { id: '02', name: '02-static-editor-cursor.png', desc: 'Static Micro-Change (Stage 0 Filtered)' },
  { id: '03', name: '03-window-switch-term.png', desc: 'Context Switch to Terminal (Stage 1 Novelty Spike)' },
  { id: '04', name: '04-term-error-stack.png', desc: 'Terminal Error Cascade (Stage 2 OCR Promoted)' },
  { id: '05a', name: '05a-browser-video-frame1.png', desc: 'Browser Video Stream Baseline' },
  { id: '05b', name: '05b-browser-video-frame2.png', desc: 'Browser Video Drift (Stage 1 Centroid Muted)' },
]

console.log('='.repeat(80))
console.log('  👁️  ATTENTION ECOLOGY GUARD: LIVE TERMINAL OBSERVER & TELEMETRY')
console.log('='.repeat(80))
console.log('  Mode: Continuous Live Ticker over Seeded Benchmark Cycle')
console.log('  Press Ctrl+C to stop.\n')

let tickCount = 0
let prevPath: string | null = null
let currentCentroid: Float32Array | null = null

async function runTick() {
  tickCount++
  const item = TEST_CYCLES[(tickCount - 1) % TEST_CYCLES.length]
  const currentPath = path.join(FIXTURES_DIR, item.name)

  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  console.log(`[${timestamp}] --- TICK #${tickCount} | Frame: ${item.name} (${item.desc}) ---`)

  const startMs = Date.now()

  // Stage 0: aHash delta
  if (!prevPath || !currentCentroid) {
    const { embedding } = await getVisionEmbedding(currentPath)
    currentCentroid = embedding
    prevPath = currentPath
    console.log(`  ├─ Verdict:       ⚡ BASELINE SEEDED (Centroid Established)`)
    console.log(`  └─ Total Latency: ${Date.now() - startMs}ms\n`)
    return
  }

  const stage0 = await computeImageDelta(prevPath, currentPath, 0.005)
  prevPath = currentPath

  if (!stage0.hasChanged) {
    console.log(`  ├─ Verdict:       💤 IGNORED (0-COST FILTERED)`)
    console.log(`  ├─ Stage 0 aHash: norm=${stage0.normalizedDistance.toFixed(4)} < 0.0050`)
    console.log(`  └─ Total Latency: ${Date.now() - startMs}ms\n`)
    return
  }

  // Stage 1: CLIP embedding
  const { embedding } = await getVisionEmbedding(currentPath)
  let novelty = 0.0
  if (currentCentroid) {
    const similarity = calculateCosineSimilarity(embedding, currentCentroid)
    novelty = Math.max(0, 1 - similarity)
  }

  // Stage 2: OCR and salience
  const zeroShot = await classifyZeroShot(embedding)
  const ocrEvidence = await analyzeDeltaRegion(prevPath, currentPath)
  const salience = evaluateSalience(
    `live-ticker-${tickCount}`,
    novelty,
    ocrEvidence,
    zeroShot,
    0.0,
    { ocrErrorPatternsMin: 2, interestKeywordsMin: 1 },
  )

  const totalMs = Date.now() - startMs
  const decisionBadge = salience.decision === 'PROMOTE'
    ? (ocrEvidence.errorPatternHits >= 2 ? '🚨 PROMOTED (ERROR CASCADE)' : `🎯 PROMOTED (INTEREST: ${ocrEvidence.interestKeywords.join(', ')})`)
    : salience.decision === 'NOTE'
      ? '📝 NOTE (WINDOW / CONTEXT SHIFT)'
      : '💤 IGNORED (QUIET FRAME)'

  console.log(`  ├─ Verdict:       ${decisionBadge}`)
  console.log(`  ├─ Stage 0 aHash: norm=${stage0.normalizedDistance.toFixed(4)} (CHANGED)`)
  console.log(`  ├─ Stage 1 CLIP:  novelty=${novelty.toFixed(4)} (threshold: 0.0200) | Top: ${zeroShot.topLabel}`)
  console.log(`  ├─ Stage 2 OCR:   errorHits=${ocrEvidence.errorPatternHits} | interestHits=${ocrEvidence.interestKeywordHits} [${ocrEvidence.interestKeywords.join(', ')}]`)
  console.log(`  └─ Total Latency: ${totalMs}ms`)

  if (salience.decision === 'PROMOTE') {
    console.log('\n  ┌────────────────────────────────────────────────────────────┐')
    console.log('  │  SYNTHESIZING PROMOTION PACKET & VISUAL EVENT SUMMARY...  │')
    console.log('  └────────────────────────────────────────────────────────────┘')
    const summaryResult = await runForwarder(currentPath, zeroShot, ocrEvidence)
    console.log(summaryResult.summary)
  }
  else {
    if (currentCentroid && novelty > 0.01) {
      const blended = new Float32Array(embedding.length)
      for (let i = 0; i < embedding.length; i++) {
        blended[i] = currentCentroid[i] * 0.8 + embedding[i] * 0.2
      }
      currentCentroid = normalizeVector(blended)
    }
  }

  console.log('')
}

// Run immediately, then repeat every 2.5 seconds
await runTick()
const interval = setInterval(async () => {
  try {
    await runTick()
  }
  catch (err) {
    console.error('Error in live ticker tick:', err)
  }
}, 2500)

process.on('SIGINT', async () => {
  clearInterval(interval)
  try {
    await Promise.all([
      disposeVisionEncoder(),
      disposeTextEncoder(),
      disposeOcrEngine(),
      disposeVlmForwarder(),
    ])
  }
  catch {}
  console.log('\n👋 Observer stopped. Clean teardown complete.')
  process.exit(0)
})
