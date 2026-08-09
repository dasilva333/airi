import fs from 'node:fs'

import { execSync } from 'node:child_process'

import { computeImageDelta } from './engine/stage0-phash.js'
import { calculateCosineSimilarity, getVisionEmbedding, normalizeVector } from './engine/stage1-vision-embed.js'
import { analyzeDeltaRegion } from './engine/stage2-ocr.js'
import { evaluateSalience } from './engine/stage2-salience-eval.js'
import { disposeVlmForwarder, runForwarder } from './engine/stage3-vlm-forwarder.js'

const TEMP_CAPTURE_PATH = '/tmp/airi-live-screen-capture.png'
const TEMP_PREV_PATH = '/tmp/airi-live-screen-prev.png'

let tickCount = 0
let currentCentroid: Float32Array | null = null
let isProcessing = false
let prevPathExists = false

let stage0Status = '💤 INITIALIZING'
let stage1Status = '💤 INITIALIZING'
let stage2Status = '🟢 0/2 QUIET'
let stage3Status = '💤 IDLE'
let currentSummary = 'IDLE / NO PROMOTION EVENT YET'
let currentReaction = 'Waiting for high-salience screen events...'
let overallStatus = '💤 MONITORING SCREEN (0-COST IDLE)'
let lastLatencyMs = 0

function captureDesktopScreen(): boolean {
  try {
    if (fs.existsSync(TEMP_CAPTURE_PATH)) {
      if (fs.existsSync(TEMP_PREV_PATH)) {
        fs.unlinkSync(TEMP_PREV_PATH)
      }
      fs.renameSync(TEMP_CAPTURE_PATH, TEMP_PREV_PATH)
      prevPathExists = true
    }
    execSync(`screencapture -x ${TEMP_CAPTURE_PATH}`, { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
}

function renderDashboard() {
  const tickStr = String(tickCount).padStart(3, '0')
  const latencyStr = `${lastLatencyMs}ms`
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)

  const ui = `\x1B[H\x1B[J`
    + `┌─────────────────────────────────────────────────────────────────────────────┐\n`
    + `│ 👁️  AIRI ATTENTION ECOLOGY :: REAL-TIME DESKTOP MONITOR       [TICK #${tickStr}]   │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│ STATUS: ${overallStatus.padEnd(46, ' ')} LATENCY: ${latencyStr.padEnd(8, ' ')} │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│                                                                             │\n`
    + `│ ─── STAGE 0: Perceptual Hash (aHash \\mu s) ──────────────────────────────── │\n`
    + `│    ${stage0Status.padEnd(72, ' ')} │\n`
    + `│                                                                             │\n`
    + `│ ─── STAGE 1: Fast CLIP Vision Embed (WebGPU / WASM) ─────────────────────── │\n`
    + `│    ${stage1Status.padEnd(72, ' ')} │\n`
    + `│                                                                             │\n`
    + `│ ─── STAGE 2: Localized WASM OCR Error Gate ──────────────────────────────── │\n`
    + `│    ${stage2Status.padEnd(72, ' ')} │\n`
    + `│                                                                             │\n`
    + `│ ─── STAGE 3: WebGPU VLM Semantic Forwarder (Moondream2) ─────────────────── │\n`
    + `│    ${stage3Status.padEnd(72, ' ')} │\n`
    + `│                                                                             │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│ 🧠 AIRI CHARACTER BRAIN :: ACTIVE INGESTION PAYLOAD   [${timestamp}]         │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `${currentSummary.split('\n').map(l => `│  ${l.padEnd(73, ' ')}  │`).join('\n')}\n`
    + `│                                                                             │\n`
    + `│ 💬 REACTION: ${currentReaction.padEnd(61, ' ')}  │\n`
    + `└─────────────────────────────────────────────────────────────────────────────┘\n`

  process.stdout.write(ui)
}

async function runLiveTick() {
  if (isProcessing)
    return
  isProcessing = true
  tickCount++

  const captured = captureDesktopScreen()
  if (!captured) {
    isProcessing = false
    return
  }

  const startMs = Date.now()
  try {
    if (!prevPathExists) {
      const { embedding } = await getVisionEmbedding(TEMP_CAPTURE_PATH)
      currentCentroid = embedding
      stage0Status = '⚡ BASELINE SEEDED'
      stage1Status = '💤 CENTROID ESTABLISHED'
      overallStatus = '💤 INITIALIZED (BASELINE ESTABLISHED)'
      lastLatencyMs = Date.now() - startMs
      renderDashboard()
      isProcessing = false
      return
    }

    const stage0 = await computeImageDelta(TEMP_PREV_PATH, TEMP_CAPTURE_PATH, 0.005)
    if (!stage0.hasChanged) {
      stage0Status = `💤 [STATIC] norm=${stage0.normalizedDistance.toFixed(4)} < 0.0050`
      stage1Status = '💤 SKIPPED (0-Cost Stage 0 Filter)'
      stage2Status = '🟢 SKIPPED'
      stage3Status = '💤 SKIPPED'
      overallStatus = '💤 IGNORED (0-COST STATIC FRAME)'
      lastLatencyMs = Date.now() - startMs
      renderDashboard()
      isProcessing = false
      return
    }

    stage0Status = `⚡ [CHANGED] norm=${stage0.normalizedDistance.toFixed(4)} (Proceeding to Stage 1)`

    const { embedding } = await getVisionEmbedding(TEMP_CAPTURE_PATH)
    let novelty = 0.0
    if (currentCentroid) {
      const similarity = calculateCosineSimilarity(embedding, currentCentroid)
      novelty = Math.max(0, 1 - similarity)
    }

    stage1Status = novelty > 0.02
      ? `🎯 [NOVELTY SPIKE] novelty=${novelty.toFixed(4)} (Visual Trajectory Shift)`
      : `📝 [STABLE NOVELTY] novelty=${novelty.toFixed(4)}`

    const ocrEvidence = await analyzeDeltaRegion(TEMP_PREV_PATH, TEMP_CAPTURE_PATH)

    const salience = evaluateSalience(
      `dashboard-tick-${tickCount}`,
      novelty,
      ocrEvidence,
      { scores: { terminal_error: 0, terminal_normal: 0, code_editor: 0, video_player: 0 }, topLabel: 'code_editor', errorMargin: 0 },
      0.0,
      { clipNovelty: 0.02, ocrHits: 2, redAlertRatio: 0.05 },
    )

    stage2Status = ocrEvidence.errorPatternHits >= 2
      ? `🚨 [PROMOTED] errorHits=${ocrEvidence.errorPatternHits}/2 (${ocrEvidence.errorPatterns.join(', ')})`
      : `🟢 [QUIET] errorHits=${ocrEvidence.errorPatternHits}/2`

    if (salience.decision === 'PROMOTE') {
      overallStatus = '🚨 HIGH SALIENCE EVENT PROMOTED'
      stage3Status = '📷 [VLM RUNNING] Synthesizing Visual Event Summary...'
      renderDashboard()

      const summaryResult = await runForwarder(
        TEMP_CAPTURE_PATH,
        { scores: { terminal_error: 0, terminal_normal: 0, code_editor: 0, video_player: 0 }, topLabel: 'code_editor', errorMargin: 0 },
        ocrEvidence,
      )
      currentSummary = summaryResult.summary
      stage3Status = `📷 [VLM OK] Summary Synthesized (${summaryResult.vlmMs}ms)`
      currentReaction = `AIRI: "I noticed a visual error event on your screen! Handling..."`
    }
    else {
      overallStatus = novelty > 0.02 ? '📝 CONTEXT SHIFT RECORDED IN DIARY' : '💤 NO PROMOTION EVENT'
      stage3Status = '💤 IDLE (No VLM Pass Required)'
      if (currentCentroid && novelty > 0.01) {
        const blended = new Float32Array(embedding.length)
        for (let i = 0; i < embedding.length; i++) {
          blended[i] = currentCentroid[i] * 0.8 + embedding[i] * 0.2
        }
        currentCentroid = normalizeVector(blended)
      }
    }

    lastLatencyMs = Date.now() - startMs
    renderDashboard()
  }
  catch (err: any) {
    overallStatus = `❌ ERROR: ${err.message || err}`
    renderDashboard()
  }
  finally {
    isProcessing = false
  }
}

// Initial render
renderDashboard()
await runLiveTick()

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
  console.log('\n👋 Terminal Observer Dashboard stopped cleanly.')
  process.exit(0)
})
