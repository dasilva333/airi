import fs from 'node:fs'

import { execSync } from 'node:child_process'

import { computeImageDelta } from './engine/stage0-phash.js'
import { calculateCosineSimilarity, getVisionEmbedding, normalizeVector } from './engine/stage1-vision-embed.js'
import { analyzeDeltaRegion } from './engine/stage2-ocr.js'
import { classifyZeroShot, evaluateSalience } from './engine/stage2-salience-eval.js'
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
let overallStatus = '💤 MONITORING SCREEN (0-COST IDLE)'
let lastLatencyMs = 0

interface PromotedEvent {
  timeStr: string
  windowName: string
  caption: string
}

const MAX_EVENT_STREAM = 5
const eventStream: PromotedEvent[] = []

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

function formatTime12h(date = new Date()): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
}

function renderDashboard() {
  const tickStr = String(tickCount).padStart(3, '0')
  const latencyStr = `${lastLatencyMs}ms`

  let streamBoxLines = ''
  if (eventStream.length === 0) {
    streamBoxLines = `│  [No promoted events yet - waiting for high-salience screen activity...]   │\n`
  }
  else {
    const formattedBlocks: string[] = []
    for (const evt of eventStream.slice(-MAX_EVENT_STREAM)) {
      const headerLine = `[${evt.timeStr}] ${evt.windowName}`
      const capLine1 = `└─► ${evt.caption.slice(0, 68)}`
      const capLine2 = evt.caption.length > 68 ? `    ${evt.caption.slice(68, 136)}` : ''

      formattedBlocks.push(`│  ${headerLine.padEnd(73, ' ')}  │`)
      formattedBlocks.push(`│  ${capLine1.padEnd(73, ' ')}  │`)
      if (capLine2) {
        formattedBlocks.push(`│  ${capLine2.padEnd(73, ' ')}  │`)
      }
    }
    streamBoxLines = `${formattedBlocks.join('\n')}\n`
  }

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
    + `│ 🧠 AIRI BRAIN INGESTION :: RECENT PROMOTED EVENTS STREAM (LAST ${eventStream.length}/${MAX_EVENT_STREAM})       │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `${streamBoxLines}`
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

    // Stage 1: CLIP Embedding & Novelty + Zero-Shot Tags
    const { embedding } = await getVisionEmbedding(TEMP_CAPTURE_PATH)
    let novelty = 0.0
    if (currentCentroid) {
      const similarity = calculateCosineSimilarity(embedding, currentCentroid)
      novelty = Math.max(0, 1 - similarity)
    }

    const zeroShot = await classifyZeroShot(embedding)
    const topTag = zeroShot.topLabel
    const topScore = zeroShot.scores[topTag].toFixed(2)

    stage1Status = novelty > 0.02
      ? `🎯 [NOVELTY SPIKE] novelty=${novelty.toFixed(4)} │ Tag: ${topTag} (${topScore})`
      : `📝 [STABLE NOVELTY] novelty=${novelty.toFixed(4)} │ Tag: ${topTag} (${topScore})`

    const ocrEvidence = await analyzeDeltaRegion(TEMP_PREV_PATH, TEMP_CAPTURE_PATH)

    const salience = evaluateSalience(
      `dashboard-tick-${tickCount}`,
      novelty,
      ocrEvidence,
      zeroShot,
      0.0,
      { clipNovelty: 0.02, ocrErrorPatternsMin: 2, redAlertRatio: 0.05 },
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
        zeroShot,
        ocrEvidence,
      )
      const roundedVlmMs = Math.round(summaryResult.vlmMs)
      stage3Status = `📷 [VLM OK] Summary Synthesized (${roundedVlmMs}ms) [Tick #${tickCount}]`

      // Extract window name and VLM caption tag
      const summaryLines = summaryResult.summary.split('\n')
      const windowLine = summaryLines.find(l => l.startsWith('Active Window:')) || 'Active Window: Desktop'
      const captionLine = summaryLines.find(l => l.startsWith('Screen Content Tags:')) || ''

      const windowName = windowLine.replace('Active Window:', '').replace(' mode)', ')').trim().slice(0, 24)
      const caption = captionLine.replace('Screen Content Tags:', '').trim()

      eventStream.push({
        timeStr: formatTime12h(),
        windowName,
        caption: caption || 'Visual scene updated.',
      })
      if (eventStream.length > MAX_EVENT_STREAM) {
        eventStream.shift()
      }

      // Persist payload to JSONL file
      try {
        const logPath = path.resolve(import.meta.dirname, 'promoted-events.jsonl')
        const entry = JSON.stringify({
          tick: tickCount,
          timestamp: new Date().toISOString(),
          timeStr: formatTime12h(),
          novelty,
          topTag,
          windowName,
          caption,
          ocrHits: ocrEvidence.errorPatternHits,
          ocrPatterns: ocrEvidence.errorPatterns,
          vlmMs: roundedVlmMs,
        })
        fs.appendFileSync(logPath, `${entry}\n`, 'utf-8')
      }
      catch (e) {
        console.error('Failed to append JSONL log:', e)
      }
    }
    else {
      overallStatus = novelty > 0.02 ? '📝 CONTEXT SHIFT RECORDED IN DIARY' : '💤 NO PROMOTION EVENT'
      if (!stage3Status.includes('VLM OK')) {
        stage3Status = '💤 IDLE (No VLM Pass Required)'
      }
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
