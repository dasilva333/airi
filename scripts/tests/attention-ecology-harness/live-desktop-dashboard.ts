import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

import { DesktopCaptureManager } from './engine/screen-capture.js'
import { computeImageDelta } from './engine/stage0-phash.js'
import { calculateCosineSimilarity, disposeVisionEncoder, getVisionEmbedding, loadVisionEncoder, normalizeVector } from './engine/stage1-vision-embed.js'
import { analyzeDeltaRegion, disposeOcrEngine, loadOcrEngine } from './engine/stage2-ocr.js'
import { classifyZeroShot, disposeTextEncoder, evaluateSalience, loadTextEncoder } from './engine/stage2-salience-eval.js'
import { disposeVlmForwarder, runForwarder } from './engine/stage3-vlm-forwarder.js'

const TEMP_CAPTURE_PATH = path.join(os.tmpdir(), 'airi-live-screen-capture.png')
const TEMP_PREV_PATH = path.join(os.tmpdir(), 'airi-live-screen-prev.png')

const captureManager = new DesktopCaptureManager({
  simulated: process.argv.includes('--simulate') || process.argv.includes('--fixture'),
})

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
let lastCaptureSource = captureManager.getMethodName()
let lastFixtureDesc = ''

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
let spinnerIndex = 0

interface PromotedEvent {
  timeStr: string
  windowName: string
  caption: string
}

const MAX_EVENT_STREAM = 5
const eventStream: PromotedEvent[] = []

function formatTime12h(date = new Date()): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
}

function renderProgressBar(percent: number, width = 20): string {
  const p = Math.max(0, Math.min(100, percent))
  const filled = Math.round((p / 100) * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${p.toFixed(0).padStart(3, ' ')}%`
}

function renderWarmupScreen(step: string, detail: string, percent?: number) {
  const bar = percent !== undefined ? ` ${renderProgressBar(percent, 18)}` : ''
  const ui = `\x1B[H\x1B[J`
    + `┌─────────────────────────────────────────────────────────────────────────────┐\n`
    + `│ 👁️  AIRI ATTENTION ECOLOGY :: SYSTEM WARMUP & INITIALIZATION               │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│ STATUS: ⏳ WARMING UP NEURAL & PERCEPTION PIPELINE...                        │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│                                                                             │\n`
    + `│ ─── CURRENT STEP: ${step.padEnd(57, ' ')} │\n`
    + `│    ${(detail + bar).slice(0, 72).padEnd(72, ' ')} │\n`
    + `│                                                                             │\n`
    + `│ ─── COMPONENTS ──────────────────────────────────────────────────────────── │\n`
    + `│    • Stage 0: 32x32 aHash Luma Perceptual Delta (CPU)                       │\n`
    + `│    • Stage 1: Fast CLIP Vision Model (Xenova/clip-vit-base-patch32)         │\n`
    + `│    • Stage 2: Localized Tesseract WASM OCR + Zero-Shot Salience Gate        │\n`
    + `│    • Stage 3: Vision-Language Model Forwarder (Moondream2 / Heuristic)      │\n`
    + `│                                                                             │\n`
    + `└─────────────────────────────────────────────────────────────────────────────┘\n`
  process.stdout.write(ui)
}

function renderDashboard() {
  const tickStr = String(tickCount).padStart(3, '0')
  const latencyStr = `${lastLatencyMs}ms`
  const spinner = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]
  spinnerIndex++

  const captureTag = `[${lastCaptureSource}]`

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

  const fixtureLine = lastFixtureDesc
    ? `│ 🎬 FRAME: ${lastFixtureDesc.padEnd(65, ' ')} │\n├─────────────────────────────────────────────────────────────────────────────┤\n`
    : ''

  const ui = `\x1B[H\x1B[J`
    + `┌─────────────────────────────────────────────────────────────────────────────┐\n`
    + `│ 👁️  AIRI ATTENTION ECOLOGY :: REAL-TIME MONITOR    ${captureTag.padStart(20, ' ')} ${spinner} [TICK #${tickStr}] │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│ STATUS: ${overallStatus.padEnd(46, ' ')} LATENCY: ${latencyStr.padEnd(8, ' ')} │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `${fixtureLine}`
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
    + `│ 🧠 AIRI BRAIN INGESTION :: RECENT PROMOTED EVENTS STREAM (LAST ${String(eventStream.length).padStart(1, '0')}/${MAX_EVENT_STREAM})       │\n`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `${streamBoxLines}`
    + `├─────────────────────────────────────────────────────────────────────────────┤\n`
    + `│  ⌨️  [S] Toggle Mode (Live/Sim)  │  [R] Reset Baseline  │  [Q / ^C] Exit     │\n`
    + `└─────────────────────────────────────────────────────────────────────────────┘\n`

  process.stdout.write(ui)
}

function captureDesktopScreen(): boolean {
  try {
    if (fs.existsSync(TEMP_CAPTURE_PATH)) {
      if (fs.existsSync(TEMP_PREV_PATH)) {
        fs.unlinkSync(TEMP_PREV_PATH)
      }
      fs.renameSync(TEMP_CAPTURE_PATH, TEMP_PREV_PATH)
      prevPathExists = true
    }

    const res = captureManager.capture(TEMP_CAPTURE_PATH)
    lastCaptureSource = res.method
    lastFixtureDesc = res.fixtureDesc || ''
    return res.success
  }
  catch (err: any) {
    overallStatus = `❌ CAPTURE ERROR: ${err.message || String(err)}`
    return false
  }
}

async function warmUpPipeline() {
  renderWarmupScreen('[1/4] Stage 1 CLIP Vision Model', 'Initializing weights...', 0)

  await loadVisionEncoder(
    (msg) => {
      renderWarmupScreen('[1/4] Stage 1 CLIP Vision Model', msg)
    },
    (info) => {
      const pct = info.progress ?? (info.loaded && info.total ? (info.loaded / info.total) * 100 : undefined)
      const file = info.file ? ` (${path.basename(info.file)})` : ''
      renderWarmupScreen('[1/4] Stage 1 CLIP Vision Model', `Downloading ${info.name || 'model'}${file}`, pct)
    },
  )

  renderWarmupScreen('[2/4] Stage 2 CLIP Text & Salience Model', 'Loading tokenizer & embeddings...', 30)
  await loadTextEncoder(
    (msg) => {
      renderWarmupScreen('[2/4] Stage 2 CLIP Text & Salience Model', msg)
    },
    (info) => {
      const pct = info.progress ?? (info.loaded && info.total ? (info.loaded / info.total) * 100 : undefined)
      renderWarmupScreen('[2/4] Stage 2 CLIP Text & Salience Model', `Downloading ${info.name || 'tokenizer'}`, pct)
    },
  )

  renderWarmupScreen('[3/4] Stage 2 Local WASM OCR Engine', 'Initializing Tesseract worker...', 60)
  await loadOcrEngine((m) => {
    if (m && typeof m.progress === 'number') {
      const pct = Math.round(m.progress * 100)
      renderWarmupScreen('[3/4] Stage 2 Local WASM OCR Engine', `${m.status || 'Loading traineddata'}`, pct)
    }
  })

  renderWarmupScreen('[4/4] Stage 0 Desktop Capture & Centroid', 'Capturing initial baseline...', 90)
  captureDesktopScreen()
  if (fs.existsSync(TEMP_CAPTURE_PATH)) {
    const { embedding } = await getVisionEmbedding(TEMP_CAPTURE_PATH)
    currentCentroid = embedding
    stage0Status = '⚡ BASELINE SEEDED'
    stage1Status = '💤 CENTROID ESTABLISHED'
    overallStatus = '💤 MONITORING SCREEN (0-COST IDLE)'
  }

  renderWarmupScreen('Ready', 'All engines warmed up successfully!', 100)
  await new Promise(r => setTimeout(r, 600))
}

async function runLiveTick() {
  if (isProcessing)
    return
  isProcessing = true
  tickCount++

  const captured = captureDesktopScreen()
  if (!captured) {
    overallStatus = '❌ CAPTURE FAILED'
    renderDashboard()
    isProcessing = false
    return
  }

  const startMs = Date.now()
  try {
    if (!prevPathExists || !currentCentroid) {
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
    const topScore = zeroShot.scores[topTag]?.toFixed(2) ?? '0.00'

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
      { ocrErrorPatternsMin: 2 },
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
    overallStatus = `❌ ERROR: ${err.message || String(err)}`
    renderDashboard()
  }
  finally {
    isProcessing = false
  }
}

// Pre-flight warmup sequence
await warmUpPipeline()

renderDashboard()
await runLiveTick()

const timer = setInterval(runLiveTick, 2000)

// Interactive keyboard controls
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      cleanExit()
    }
    else if (key.name === 'q') {
      cleanExit()
    }
    else if (key.name === 's') {
      const sim = captureManager.toggleSimulation()
      lastCaptureSource = captureManager.getMethodName()
      overallStatus = sim ? '🎬 SWITCHED TO SIMULATION (Test Fixtures)' : '🖥️ SWITCHED TO LIVE CAPTURE'
      renderDashboard()
    }
    else if (key.name === 'r') {
      currentCentroid = null
      prevPathExists = false
      overallStatus = '⚡ BASELINE CENTROID RESET'
      stage0Status = '⚡ RE-INITIALIZING'
      stage1Status = '💤 RE-INITIALIZING'
      renderDashboard()
    }
  })
}

async function cleanExit() {
  clearInterval(timer)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false)
  }
  process.stdout.write('\n\nShutting down engines...\n')
  try {
    await Promise.all([
      disposeVisionEncoder(),
      disposeTextEncoder(),
      disposeOcrEngine(),
      disposeVlmForwarder(),
    ])
    captureManager.dispose()
    if (fs.existsSync(TEMP_CAPTURE_PATH))
      fs.unlinkSync(TEMP_CAPTURE_PATH)
    if (fs.existsSync(TEMP_PREV_PATH))
      fs.unlinkSync(TEMP_PREV_PATH)
  }
  catch {}
  console.log('👋 Terminal Observer Dashboard stopped cleanly.')
  process.exit(0)
}

process.on('SIGINT', cleanExit)
