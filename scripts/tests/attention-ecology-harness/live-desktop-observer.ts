import fs from 'node:fs'

import { execSync } from 'node:child_process'

import { computeImageDelta } from './engine/stage0-phash.js'
import { calculateCosineSimilarity, getVisionEmbedding, normalizeVector } from './engine/stage1-vision-embed.js'
import { analyzeDeltaRegion } from './engine/stage2-ocr.js'
import { evaluateSalience } from './engine/stage2-salience-eval.js'
import { disposeVlmForwarder, runForwarder } from './engine/stage3-vlm-forwarder.js'

const TEMP_CAPTURE_PATH = '/tmp/airi-live-screen-capture.png'
const TEMP_PREV_PATH = '/tmp/airi-live-screen-prev.png'

console.log('='.repeat(80))
console.log('  🖥️  ATTENTION ECOLOGY GUARD: LIVE REAL-TIME DESKTOP SCREEN OBSERVER')
console.log('='.repeat(80))
console.log('  Capturing live macOS screen via screencapture (-x) every 2.0 seconds.')
console.log('  Switch windows, run terminal commands, or trigger errors to observe live events.')
console.log('  Press Ctrl+C to stop.\n')

let tickCount = 0
let currentCentroid: Float32Array | null = null
let isProcessing = false
let prevPathExists = false

function captureDesktopScreen(): boolean {
  try {
    if (fs.existsSync(TEMP_CAPTURE_PATH)) {
      if (fs.existsSync(TEMP_PREV_PATH)) {
        fs.unlinkSync(TEMP_PREV_PATH)
      }
      fs.renameSync(TEMP_CAPTURE_PATH, TEMP_PREV_PATH)
      prevPathExists = true
    }
    // High-speed silent screen capture using macOS native screencapture utility
    execSync(`screencapture -x ${TEMP_CAPTURE_PATH}`, { stdio: 'ignore' })
    return true
  }
  catch (err) {
    console.error('Failed to capture screen:', err)
    return false
  }
}

async function runLiveTick() {
  if (isProcessing)
    return
  isProcessing = true
  tickCount++

  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  const captured = captureDesktopScreen()
  if (!captured) {
    isProcessing = false
    return
  }

  const startMs = Date.now()
  try {
    // Stage 0: aHash delta
    if (!prevPathExists) {
      const { embedding } = await getVisionEmbedding(TEMP_CAPTURE_PATH)
      currentCentroid = embedding
      console.log(`[${timestamp}] Ticker #${tickCount} | BASELINE SEEDED (Centroid Established)`)
      isProcessing = false
      return
    }

    const stage0 = await computeImageDelta(TEMP_PREV_PATH, TEMP_CAPTURE_PATH, 0.005)
    if (!stage0.hasChanged) {
      console.log(`[${timestamp}] Ticker #${tickCount} | Latency: ${Date.now() - startMs}ms | 💤 IGNORED (0-COST STATIC FRAME - aHash norm=${stage0.normalizedDistance.toFixed(4)})`)
      isProcessing = false
      return
    }

    // Stage 1: CLIP Embedding & Novelty
    const { embedding } = await getVisionEmbedding(TEMP_CAPTURE_PATH)
    let novelty = 0.0
    if (currentCentroid) {
      const similarity = calculateCosineSimilarity(embedding, currentCentroid)
      novelty = Math.max(0, 1 - similarity)
    }

    // Stage 2: OCR Error Gate
    const ocrEvidence = await analyzeDeltaRegion(TEMP_PREV_PATH, TEMP_CAPTURE_PATH)

    const salience = evaluateSalience(
      `live-tick-${tickCount}`,
      novelty,
      ocrEvidence,
      { scores: { terminal_error: 0, terminal_normal: 0, code_editor: 0, video_player: 0 }, topLabel: 'code_editor', errorMargin: 0 },
      0.0,
      { clipNovelty: 0.02, ocrHits: 2, redAlertRatio: 0.05 },
    )

    const totalMs = Date.now() - startMs
    const decisionBadge = salience.decision === 'PROMOTE'
      ? '🚨 PROMOTED (HIGH SALIENCE ERROR / CASCADE)'
      : salience.decision === 'NOTE'
        ? '📝 NOTE (WINDOW / CONTEXT SHIFT)'
        : '💤 IGNORED (QUIET FRAME)'

    console.log(`[${timestamp}] Ticker #${tickCount} | Latency: ${totalMs}ms | ${decisionBadge}`)
    console.log(`  ├─ Stage 0 aHash:  norm=${stage0.normalizedDistance.toFixed(4)} (CHANGED)`)
    console.log(`  ├─ Stage 1 CLIP:   novelty=${novelty.toFixed(4)} (threshold: 0.0200)`)
    console.log(`  └─ Stage 2 OCR:    errorHits=${ocrEvidence.errorPatternHits} (${ocrEvidence.errorPatternHits >= 2 ? 'PROMOTED' : 'QUIET'})`)

    if (salience.decision === 'PROMOTE') {
      console.log('\n  ┌────────────────────────────────────────────────────────────┐')
      console.log('  │  🚨 HIGH SALIENCE EVENT PROMOTED - SYNTHESIZING SUMMARY...  │')
      console.log('  └────────────────────────────────────────────────────────────┘')
      const summaryResult = await runForwarder(
        TEMP_CAPTURE_PATH,
        { scores: { terminal_error: 0, terminal_normal: 0, code_editor: 0, video_player: 0 }, topLabel: 'code_editor', errorMargin: 0 },
        ocrEvidence,
      )
      console.log(summaryResult.summary)
      console.log('')
    }
    else {
      // Update centroid on quiet shift
      if (currentCentroid && novelty > 0.01) {
        const blended = new Float32Array(embedding.length)
        for (let i = 0; i < embedding.length; i++) {
          blended[i] = currentCentroid[i] * 0.8 + embedding[i] * 0.2
        }
        currentCentroid = normalizeVector(blended)
      }
    }
  }
  catch (err: any) {
    console.error(`[${timestamp}] Tick #${tickCount} error:`, err.message || err)
  }
  finally {
    isProcessing = false
  }
}

// Initial tick
await runLiveTick()

// Loop every 2000ms
const timer = setInterval(runLiveTick, 2000)

process.on('SIGINT', () => {
  clearInterval(timer)
  disposeVlmForwarder()
  try {
    if (fs.existsSync(TEMP_CAPTURE_PATH))
      fs.unlinkSync(TEMP_CAPTURE_PATH)
    if (fs.existsSync(TEMP_PREV_PATH))
      fs.unlinkSync(TEMP_PREV_PATH)
  }
  catch {}
  console.log('\n👋 Live Desktop Observer stopped cleanly. Cleanup complete.')
  process.exit(0)
})
