/**
 * Stage 3 — Cactus Mirage Vision Coprocessor (Node Runner).
 *
 * Runs the Cactus 4.0.0 WebAssembly vision engine with Mirage weights (22 MB):
 * - Fast CPU scene reasoning, natural language captioning, UI bounding boxes,
 *   and OCR extraction in ~1.0-1.5s on CPU.
 * - Deprecates legacy Moondream2 (~1.5GB ONNX, 6s latency).
 * - Utilizes shared attention formatting from @proj-airi/stage-shared/attention.
 */

import type { MirageVisionResult } from '@proj-airi/stage-shared/attention'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import sharp from 'sharp'

import { mirageResultToVisualEvent, parseMirageOutput } from '@proj-airi/stage-shared/attention'

const CACTUS_JS_URL = 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.0.0/wasm/cactus.js'
const CACTUS_WASM_URL = 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.0.0/wasm/cactus.wasm'
const MIRAGE_WEIGHTS_URL = 'https://huggingface.co/Cactus-Compute/mirage/resolve/main/mirage.cact'

const CACHE_DIR = path.join(os.homedir(), '.cache', 'needle3')

let cactusInstance: any = null
let isInitialized = false
let initPromise: Promise<void> | null = null

async function ensureFileCached(fileName: string, url: string, onLog?: (msg: string) => void): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  const filePath = path.join(CACHE_DIR, fileName)
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    return filePath
  }

  onLog?.(`Downloading ${fileName} from Hugging Face...`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download ${fileName}: ${res.status} ${res.statusText}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(filePath, buf)
  onLog?.(`Saved ${fileName} (${(buf.length / 1024 / 1024).toFixed(1)} MB) to ${filePath}`)
  return filePath
}

/**
 * Loads Cactus WASM engine and loads Mirage weights into memory.
 */
export async function loadMirageEngine(onLog?: (msg: string) => void): Promise<void> {
  if (isInitialized && cactusInstance) {
    return
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    onLog?.('Initializing Cactus Mirage vision engine...')

    const [jsPath, wasmPath, weightsPath] = await Promise.all([
      ensureFileCached('cactus.js', CACTUS_JS_URL, onLog),
      ensureFileCached('cactus.wasm', CACTUS_WASM_URL, onLog),
      ensureFileCached('mirage.cact', MIRAGE_WEIGHTS_URL, onLog),
    ])

    const wasmBinary = fs.readFileSync(wasmPath)
    // Dynamic import / require of Cactus factory
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const cactusModuleFactory = require(jsPath)

    const instance = await cactusModuleFactory({ wasmBinary })
    const weightsBuffer = fs.readFileSync(weightsPath)

    const weightsPtr = instance._malloc(weightsBuffer.byteLength)
    instance.HEAPU8.set(new Uint8Array(weightsBuffer), weightsPtr)

    const loadRes = instance._cactus_load(weightsPtr, BigInt(weightsBuffer.byteLength))
    instance._free(weightsPtr)

    if (loadRes !== 0) {
      const errPtr = instance._cactus_last_error?.()
      const errMsg = errPtr ? instance.UTF8ToString(errPtr) : `Code ${loadRes}`
      throw new Error(`Cactus Mirage weights loading failed: ${errMsg}`)
    }

    cactusInstance = instance
    isInitialized = true
    onLog?.('Cactus Mirage 4.0.0 engine ready (22 MB WASM)')
  })()

  await initPromise
}

export interface MirageForwarderResult {
  result: MirageVisionResult
  summary: string
  latencyMs: number
}

/**
 * Runs Cactus Mirage describe on the screenshot file.
 */
export async function runMirageForwarder(
  imagePath: string,
  activeWindow = 'Desktop',
  theme = 'light',
  prompt?: string,
): Promise<MirageForwarderResult> {
  if (!cactusInstance || !isInitialized) {
    await loadMirageEngine()
  }

  const targetWidth = 384
  const targetHeight = 384

  // Decode to raw 384x384 RGB buffer using sharp
  const { data } = await sharp(imagePath)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const rgbPtr = cactusInstance._malloc(data.byteLength)
  cactusInstance.HEAPU8.set(data, rgbPtr)

  let promptPtr = 0
  if (prompt) {
    const encoder = new TextEncoder()
    const promptBytes = encoder.encode(`${prompt}\0`)
    promptPtr = cactusInstance._malloc(promptBytes.byteLength)
    cactusInstance.HEAPU8.set(promptBytes, promptPtr)
  }

  const outCapacity = 65536
  const outPtr = cactusInstance._malloc(outCapacity)

  const t0 = performance.now()
  let rawJson = ''
  try {
    const code = cactusInstance._cactus_describe(
      rgbPtr,
      targetWidth,
      targetHeight,
      promptPtr,
      0, // optionsPtr
      0, // flags
      outPtr,
      outCapacity,
    )

    if (code >= 0) {
      rawJson = cactusInstance.UTF8ToString(outPtr)
    }
  }
  finally {
    cactusInstance._free(rgbPtr)
    cactusInstance._free(outPtr)
    if (promptPtr) {
      cactusInstance._free(promptPtr)
    }
  }

  const latencyMs = Math.round(performance.now() - t0)
  const visionResult = parseMirageOutput(rawJson, latencyMs)
  const summary = mirageResultToVisualEvent(visionResult, activeWindow, theme)

  return {
    result: visionResult,
    summary,
    latencyMs,
  }
}

export function disposeMirageEngine(): void {
  cactusInstance = null
  isInitialized = false
  initPromise = null
}
