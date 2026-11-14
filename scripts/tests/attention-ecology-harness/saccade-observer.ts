import type { SpatialCandidate, TripwireQuestion } from '../../../packages/stage-ui/src/libs/attention/index.ts'

import process from 'node:process'
import readline from 'node:readline'

import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import sharp from 'sharp'

import { generateText } from '@xsai/generate-text'
import { createWorker } from 'tesseract.js'

import {
  assembleObservationPayload,
  computeFovealCropRect,
  decomposeMacroFrame,
  runBudgetedMicroOcr,
  triageSystemOne,
  TRIPWIRE_PRESETS,
} from '../../../packages/stage-ui/src/libs/attention/index.ts'
import { providerOpenCodeGo } from '../../../packages/stage-ui/src/libs/providers/providers/opencode-go/index.ts'
import { computePerceptualHash, hammingDistance } from './engine/stage0-phash.js'
import { calculateCosineSimilarity, getVisionEmbedding, loadVisionEncoder } from './engine/stage1-vision-embed.js'
import { disposeMirageEngine, loadMirageEngine, runMirageForwarder } from './engine/stage3-mirage.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..', '..')

function loadEnvFallback() {
  const envPath = join(REPO_ROOT, '.env')
  if (!existsSync(envPath))
    return
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx <= 0)
      continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key])
      process.env[key] = val
  }
}

const execFileAsync = promisify(execFile)

type ResolutionTier = 'native' | 'medium' | 'low'
type OcrBudgetTier = 'low' | 'medium' | 'high'
type TripwireMode = 'auto' | 'video' | 'error' | 'chat' | 'novelty'

const RESOLUTION_TIERS: { id: ResolutionTier, label: string, size?: number }[] = [
  { id: 'native', label: 'Native' },
  { id: 'medium', label: 'Medium (768px)', size: 768 },
  { id: 'low', label: 'Low (384px)', size: 384 },
]

const OCR_BUDGET_TIERS: { id: OcrBudgetTier, label: string, ms: number }[] = [
  { id: 'low', label: 'Low (1000ms)', ms: 1000 },
  { id: 'medium', label: 'Medium (2500ms)', ms: 2500 },
  { id: 'high', label: 'High (5000ms)', ms: 5000 },
]

const TRIPWIRE_MODES: { id: TripwireMode, label: string }[] = [
  { id: 'auto', label: 'Auto (All 4)' },
  { id: 'video', label: 'Video' },
  { id: 'error', label: 'Error' },
  { id: 'chat', label: 'Chat' },
  { id: 'novelty', label: 'Novelty' },
]

interface CliArgs {
  imagePath?: string
  intervalMs: number
  fovealPadPx: number
  sensitivity: number
  once: boolean
  noGate: boolean
  llm: boolean
  llmModel: string
  systemOneModel: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    intervalMs: 3000,
    fovealPadPx: 300,
    sensitivity: 0.65,
    once: false,
    noGate: false,
    llm: false,
    llmModel: process.env.OPENCODE_GO_LLM_MODEL || process.env.OPENCODE_GO_MODEL || 'deepseek-v4.1-flash',
    systemOneModel: process.env.OPENCODE_GO_S1_MODEL || 'jev-1.13-free',
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--image' && argv[i + 1]) {
      args.imagePath = argv[++i]
    }
    else if (a === '--interval' && argv[i + 1]) {
      args.intervalMs = Number.parseInt(argv[++i], 10) || 3000
    }
    else if (a === '--pad' && argv[i + 1]) {
      args.fovealPadPx = Number.parseInt(argv[++i], 10) || 300
    }
    else if (a === '--sensitivity' && argv[i + 1]) {
      args.sensitivity = Number.parseFloat(argv[++i]) || 0.65
    }
    else if (a === '--once') {
      args.once = true
    }
    else if (a === '--no-gate') {
      args.noGate = true
    }
    else if (a === '--llm') {
      args.llm = true
    }
    else if (a === '--llm-model' && argv[i + 1]) {
      args.llmModel = argv[++i]
    }
    else if (a === '--s1-model' && argv[i + 1]) {
      args.systemOneModel = argv[++i]
    }
  }

  return args
}

function renderAsciiBoxMap(candidates: SpatialCandidate[], winnerId?: string): string {
  const width = 64
  const height = 16
  const grid: string[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '))

  for (let x = 0; x < width; x++) {
    grid[0][x] = '-'
    grid[height - 1][x] = '-'
  }
  for (let y = 0; y < height; y++) {
    grid[y][0] = '|'
    grid[y][width - 1] = '|'
  }
  grid[0][0] = '+'
  grid[0][width - 1] = '+'
  grid[height - 1][0] = '+'
  grid[height - 1][width - 1] = '+'

  for (const cand of candidates.slice(0, 12)) {
    const [x1, y1, x2, y2] = cand.bbox
    const gx1 = Math.max(1, Math.min(width - 2, Math.floor((x1 / 1000) * (width - 2)) + 1))
    const gy1 = Math.max(1, Math.min(height - 2, Math.floor((y1 / 1000) * (height - 2)) + 1))
    const gx2 = Math.max(gx1 + 1, Math.min(width - 2, Math.floor((x2 / 1000) * (width - 2)) + 1))
    const gy2 = Math.max(gy1 + 1, Math.min(height - 2, Math.floor((y2 / 1000) * (height - 2)) + 1))

    const isWinner = cand.id === winnerId
    const borderH = isWinner ? '=' : '.'
    const borderV = isWinner ? '#' : ':'

    for (let x = gx1; x <= gx2; x++) {
      grid[gy1][x] = borderH
      grid[gy2][x] = borderH
    }
    for (let y = gy1; y <= gy2; y++) {
      grid[y][gx1] = borderV
      grid[y][gx2] = borderV
    }

    const tag = `${cand.id}${isWinner ? '*' : ''}`
    for (let k = 0; k < tag.length && gx1 + 1 + k < width - 1; k++) {
      grid[gy1][gx1 + 1 + k] = tag[k]
    }
  }

  return grid.map(row => row.join('')).join('\n')
}

async function captureDesktopFrame(tempDir: string): Promise<string> {
  const outPath = join(tempDir, `frame-${Date.now()}.png`)
  await execFileAsync('screencapture', ['-x', outPath])
  return outPath
}

interface RuntimeState {
  gateEnabled: boolean
  resolutionIdx: number
  budgetIdx: number
  tripwireIdx: number
  llmEnabled: boolean
  forceNextTick: boolean
  prevHash?: bigint
  centroidEmbedding?: number[]
}

function resolveQuestions(mode: TripwireMode): TripwireQuestion[] {
  if (mode === 'auto')
    return TRIPWIRE_PRESETS
  const found = TRIPWIRE_PRESETS.find(p => p.id === mode)
  return found ? [found] : TRIPWIRE_PRESETS
}

async function runSingleTick(
  imagePath: string,
  tempDir: string,
  ocrWorker: Awaited<ReturnType<typeof createWorker>>,
  openCodeProvider: ReturnType<typeof providerOpenCodeGo.createProvider> | null,
  args: CliArgs,
  state: RuntimeState,
  tickNumber: number,
) {
  const tickStart = performance.now()
  const imgBuffer = await readFile(imagePath)
  const meta = await sharp(imgBuffer).metadata()
  const imgW = meta.width || 1920
  const imgH = meta.height || 1080

  const resTier = RESOLUTION_TIERS[state.resolutionIdx]
  const budgetTier = OCR_BUDGET_TIERS[state.budgetIdx]
  const tripwireMode = TRIPWIRE_MODES[state.tripwireIdx]

  const headerControls = `[Controls] (g) Gate: ${state.gateEnabled ? 'ON' : 'OFF'} | (r) Res: ${resTier.label} | (b) OCR: ${budgetTier.label} | (q) Tripwire: ${tripwireMode.label} | (l) LLM: ${state.llmEnabled ? 'ON' : 'OFF'} | (Space) Force`

  // Stage 0 + Stage 1 Pre-Gate (pHash + CLIP Novelty)
  const forced = state.forceNextTick
  state.forceNextTick = false
  let phashMs = 0
  let clipMs = 0
  let phashDist = 0
  let clipSim = 1.0

  if (state.gateEnabled && !forced) {
    const p0 = performance.now()
    const currHash = await computePerceptualHash(imagePath)
    phashMs = Math.round(performance.now() - p0)
    if (state.prevHash !== undefined) {
      phashDist = hammingDistance(state.prevHash, currHash.bits)
      if (phashDist <= 2) {
        console.clear()
        console.log(`=== AIRI Saccade & Foveal CLI Observer (Tick #${tickNumber}) ===`)
        console.log(headerControls)
        console.log(`Stage 0 Gate: STATIC (pHash Δ=${phashDist} bits in ${phashMs}ms) — skipped Phases 1–4. Press [Space] to force.`)
        return
      }
    }
    state.prevHash = currHash.bits

    const c0 = performance.now()
    const emb = await getVisionEmbedding(imagePath)
    clipMs = Math.round(performance.now() - c0)
    if (state.centroidEmbedding) {
      clipSim = calculateCosineSimilarity(state.centroidEmbedding, emb.embedding)
      // Update rolling centroid
      state.centroidEmbedding = state.centroidEmbedding.map((v, i) => v * 0.7 + emb.embedding[i] * 0.3)
      if (clipSim >= 0.985) {
        console.clear()
        console.log(`=== AIRI Saccade & Foveal CLI Observer (Tick #${tickNumber}) ===`)
        console.log(headerControls)
        console.log(`Stage 1 Gate: LOW NOVELTY (pHash Δ=${phashDist}, CLIP sim=${clipSim.toFixed(4)} in ${clipMs}ms) — skipped Phases 1–4. Press [Space] to force.`)
        return
      }
    }
    else {
      state.centroidEmbedding = emb.embedding
    }
  }

  // Phase 1: Macro Decomposition via Cactus Mirage
  const macroOptions = resTier.size
    ? { isNative: false, targetWidth: resTier.size, targetHeight: resTier.size }
    : { isNative: true }

  const macroRes = await runMirageForwarder(imagePath, 'Desktop', 'dark', undefined, macroOptions)
  const candidates = decomposeMacroFrame({
    objects: macroRes.result.objects,
    text: macroRes.result.textItems,
  })
  const macroMs = macroRes.latencyMs

  // Phase 2: Budgeted Micro-OCR
  const ocrResult = await runBudgetedMicroOcr({
    candidates,
    budgetMs: budgetTier.ms,
    cropAndRecognize: async (cand) => {
      const [x1, y1, x2, y2] = cand.bbox
      const left = Math.max(0, Math.floor((x1 / 1000) * imgW))
      const top = Math.max(0, Math.floor((y1 / 1000) * imgH))
      const width = Math.max(16, Math.min(imgW - left, Math.floor(((x2 - x1) / 1000) * imgW)))
      const height = Math.max(16, Math.min(imgH - top, Math.floor(((y2 - y1) / 1000) * imgH)))

      const targetH = Math.min(140, height)
      const cropBuf = await sharp(imgBuffer)
        .extract({ left, top, width, height })
        .resize({ height: targetH, withoutEnlargement: true })
        .png()
        .toBuffer()

      const rec = await ocrWorker.recognize(cropBuf)
      return {
        ocrText: String(rec?.data?.text || '').trim().replace(/[\r\n]+/g, ' '),
        confidence: typeof rec?.data?.confidence === 'number' ? Math.round(rec.data.confidence) : 0,
      }
    },
  })

  // Phase 3: System-1 Triage (Batched multi-question or focused preset via OpenCode Go, fallback to local heuristic)
  const activeQuestions = resolveQuestions(tripwireMode.id)
  const triage = await triageSystemOne({
    verifiedCandidates: ocrResult.results,
    allCandidates: candidates,
    questions: activeQuestions,
    sensitivityThreshold: args.sensitivity,
    executeSystemOne: openCodeProvider
      ? (statePayload, schema) => (openCodeProvider as any).systemOne(statePayload, schema, args.systemOneModel)
      : undefined,
  })

  // Phase 4: Foveal Context Extraction (1:1 Crop + Mirage Describe)
  let fovealMs = 0
  let fovealDimensions: { width: number, height: number } | undefined
  let fovealSceneDescription = '(Skipped — System-1 did not trigger)'

  if (triage.winningCandidate && (triage.triggered || forced || args.once)) {
    const rect = computeFovealCropRect(triage.winningCandidate.bbox, imgW, imgH, args.fovealPadPx)
    fovealDimensions = { width: rect.sw, height: rect.sh }
    const fovealPath = join(tempDir, `foveal-${Date.now()}.png`)
    await sharp(imgBuffer)
      .extract({ left: rect.sx, top: rect.sy, width: rect.sw, height: rect.sh })
      .png()
      .toFile(fovealPath)

    const fovRes = await runMirageForwarder(
      fovealPath,
      'Desktop',
      'dark',
      'Describe the primary visual subject, media player, and activity in this focused region.',
      { isNative: true },
    )
    fovealMs = fovRes.latencyMs
    fovealSceneDescription = fovRes.result.reasoning
      || fovRes.result.ocrText
      || `${fovRes.result.sceneSetting || 'desktop'} (${fovRes.result.sceneStyle || 'ui'})`
  }

  const payload = assembleObservationPayload({
    windowTitle: `Desktop (${imgW}x${imgH})`,
    triage,
    fovealDimensions,
    fovealSceneDescription,
    verifiedCandidates: ocrResult.results,
    totalCandidatesCount: candidates.length,
  })

  // Phase 5 (Optional): LLM Character Commentary via OpenCode Go
  let llmMs = 0
  let commentaryText = ''
  if (state.llmEnabled && openCodeProvider && (triage.triggered || forced || args.once)) {
    const l0 = performance.now()
    try {
      const chatRes = await generateText({
        ...(openCodeProvider as any).chat(args.llmModel),
        messages: [
          {
            role: 'system',
            content: 'You are a perceptive AI desktop companion. React naturally in 1–2 concise sentences to the real-time screen observation below.',
          },
          {
            role: 'user',
            content: payload,
          },
        ],
      })
      commentaryText = chatRes.text?.trim() || '(empty response)'
    }
    catch (err: any) {
      commentaryText = `[LLM Error] ${err?.message || err}`
    }
    llmMs = Math.round(performance.now() - l0)
  }

  const totalMs = Math.round(performance.now() - tickStart)

  console.clear()
  console.log(`=== AIRI Saccade & Foveal CLI Observer (Tick #${tickNumber}) ===`)
  console.log(headerControls)
  console.log(`Frame: ${imgW}x${imgH} (${macroRes.resolution}) | Candidates: ${candidates.length} | Verified: ${ocrResult.results.length} (${ocrResult.exitReason})`)
  console.log(`Gate -> pHash: ${phashMs}ms (Δ=${phashDist}) | CLIP: ${clipMs}ms (sim=${clipSim.toFixed(3)}) | S1: ${triage.usedFallback ? 'Heuristic' : `OpenCode Go (${args.systemOneModel})`}`)
  console.log(`Phases -> Macro: ${macroMs}ms | Micro-OCR: ${ocrResult.elapsedMs}ms | System-1: ${triage.latencyMs}ms | Foveal: ${fovealMs}ms | LLM: ${llmMs}ms | Total: ${totalMs}ms`)
  console.log('')
  console.log(renderAsciiBoxMap(candidates, triage.winningCandidate?.id))
  console.log('')
  console.log(payload)
  if (commentaryText) {
    console.log('')
    console.log(`[COMPANION COMMENTARY (${args.llmModel} · ${llmMs}ms)]`)
    console.log(commentaryText)
  }
}

async function main() {
  loadEnvFallback()
  const args = parseArgs(process.argv.slice(2))
  const tempDir = await mkdtemp(join(tmpdir(), 'airi-saccade-'))

  const apiKey = process.env.OPENCODE_GO_API_KEY || process.env.OPENCODE_API_KEY || ''
  const baseUrl = process.env.OPENCODE_GO_BASE_URL || 'https://opencode.ai/zen/go/v1/'
  const openCodeProvider = apiKey ? providerOpenCodeGo.createProvider({ apiKey, baseUrl }) : null

  console.log(`[saccade-observer] Initializing Tesseract OCR, CLIP, Cactus Mirage, and System-1 (${openCodeProvider ? `OpenCode Go: ${args.systemOneModel}` : 'Local Heuristic'})...`)
  const [ocrWorker] = await Promise.all([
    createWorker('eng', 1, { cachePath: join(__dirname, '.cache') }),
    loadMirageEngine(msg => console.log(`[Mirage] ${msg}`)),
    args.noGate ? Promise.resolve() : loadVisionEncoder(msg => console.log(`[CLIP] ${msg}`)),
  ])

  const state: RuntimeState = {
    gateEnabled: !args.noGate,
    resolutionIdx: 0, // Native
    budgetIdx: 0, // Low (1000ms)
    tripwireIdx: 0, // Auto (All 4)
    llmEnabled: args.llm, // OFF by default
    forceNextTick: args.once,
  }

  let running = true
  if (process.stdin.isTTY && !args.once) {
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.on('keypress', (_str, key) => {
      if (!key)
        return
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        running = false
        return
      }
      if (key.name === 'g') {
        state.gateEnabled = !state.gateEnabled
      }
      else if (key.name === 'r') {
        state.resolutionIdx = (state.resolutionIdx + 1) % RESOLUTION_TIERS.length
      }
      else if (key.name === 'b') {
        state.budgetIdx = (state.budgetIdx + 1) % OCR_BUDGET_TIERS.length
      }
      else if (key.name === 'q') {
        state.tripwireIdx = (state.tripwireIdx + 1) % TRIPWIRE_MODES.length
      }
      else if (key.name === 'l') {
        state.llmEnabled = !state.llmEnabled
      }
      else if (key.name === 'space') {
        state.forceNextTick = true
      }
    })
  }

  let tick = 0
  try {
    do {
      if (!running)
        break
      tick++
      const targetPath = args.imagePath || (await captureDesktopFrame(tempDir))
      await runSingleTick(targetPath, tempDir, ocrWorker, openCodeProvider, args, state, tick)
      if (!args.once && running) {
        await new Promise(resolve => setTimeout(resolve, args.intervalMs))
      }
    } while (!args.once && running)
  }
  finally {
    if (process.stdin.isTTY && !args.once) {
      process.stdin.setRawMode(false)
    }
    await ocrWorker.terminate()
    disposeMirageEngine()
    await rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('[saccade-observer] Fatal error:', err)
  process.exit(1)
})
