/**
 * Local Laya (System 1 Decision Engine) In-Browser & Local Runtime.
 *
 * Runs tozp/laya-onnx (quantized ModernBERT-large backbone, 421M parameter RLCD model)
 * via onnxruntime-web / WASM with multi-threaded SIMD execution.
 */

import { AutoTokenizer } from '@huggingface/transformers'

import * as ort from 'onnxruntime-web'

import { LAYA_CACHE_NAME } from './cache-utils'

export const LAYA_HF_REPO = 'tozp/laya-onnx'
export const LAYA_INT8_MODEL_FILE = 'model_int8.onnx'
export const LAYA_FP16_MODEL_FILE = 'model_fp16.onnx'

export const LAYA_BUNDLE_FILES = [
  LAYA_INT8_MODEL_FILE,
  'tokenizer.json',
  'tokenizer_config.json',
  'rl_agent_config.json',
] as const

const round4 = (x: number) => Math.round(x * 1e4) / 1e4

export interface LayaDownloadProgress {
  file: string
  loaded: number
  total: number
  percentage: number
}

/**
 * Check if the Laya model is downloaded and ready in CacheStorage.
 */
export async function isLayaDownloaded(precision: 'int8' | 'fp16' = 'int8'): Promise<boolean> {
  if (typeof caches === 'undefined')
    return false

  try {
    const has = await caches.has(LAYA_CACHE_NAME)
    if (!has)
      return false
    const cache = await caches.open(LAYA_CACHE_NAME)
    const targetFile = precision === 'fp16' ? LAYA_FP16_MODEL_FILE : LAYA_INT8_MODEL_FILE
    const fileUrl = `https://huggingface.co/${LAYA_HF_REPO}/resolve/main/${targetFile}`
    const match = await cache.match(fileUrl)
    if (!match)
      return false

    const contentLength = Number(match.headers.get('content-length')) || 0
    if (contentLength > 0)
      return contentLength > 50_000_000

    const blob = await match.clone().blob()
    return blob.size > 50_000_000
  }
  catch {
    return false
  }
}

/**
 * Download Laya ONNX model bundle from Hugging Face into CacheStorage.
 */
export async function downloadLayaModel(options?: {
  precision?: 'int8' | 'fp16'
  onProgress?: (progress: LayaDownloadProgress) => void
}): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new TypeError('Cache Storage API is not supported in this environment.')
  }

  const precision = options?.precision ?? 'int8'
  const modelFile = precision === 'fp16' ? LAYA_FP16_MODEL_FILE : LAYA_INT8_MODEL_FILE
  const filesToDownload = [
    modelFile,
    'tokenizer.json',
    'tokenizer_config.json',
    'rl_agent_config.json',
  ]

  const cache = await caches.open(LAYA_CACHE_NAME)

  for (const fileName of filesToDownload) {
    const fileUrl = `https://huggingface.co/${LAYA_HF_REPO}/resolve/main/${fileName}`
    const cacheMatch = await cache.match(fileUrl)

    if (cacheMatch) {
      if (fileName.endsWith('.onnx')) {
        const cl = Number(cacheMatch.headers.get('content-length')) || 0
        let size = cl
        if (size <= 0) {
          const b = await cacheMatch.clone().blob()
          size = b.size
        }
        if (size < 50_000_000) {
          console.warn(`[LayaEngine] Existing cache entry for ${fileName} is truncated (${size} bytes). Evicting...`)
          await cache.delete(fileUrl)
        }
        else {
          options?.onProgress?.({
            file: fileName,
            loaded: size,
            total: size,
            percentage: 100,
          })
          continue
        }
      }
      else {
        options?.onProgress?.({
          file: fileName,
          loaded: 1,
          total: 1,
          percentage: 100,
        })
        continue
      }
    }

    const response = await fetch(fileUrl, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${fileName}: HTTP ${response.status} ${response.statusText}`)
    }

    const contentLength = Number(response.headers.get('content-length')) || 0
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      chunks.push(value)
      receivedBytes += value.length
      const percentage = contentLength > 0
        ? Math.min(100, Math.round((receivedBytes / contentLength) * 100))
        : 0

      options?.onProgress?.({
        file: fileName,
        loaded: receivedBytes,
        total: contentLength,
        percentage,
      })
    }

    if (contentLength > 0 && receivedBytes < contentLength) {
      throw new Error(`Download of ${fileName} was interrupted: received ${receivedBytes} of ${contentLength} bytes.`)
    }

    const fullBlob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' })
    const cachedResponse = new Response(fullBlob, {
      headers: {
        'content-length': String(receivedBytes),
        'content-type': 'application/octet-stream',
      },
    })
    await cache.put(fileUrl, cachedResponse)
  }
}

/**
 * Delete downloaded Laya model from CacheStorage.
 */
export async function deleteLayaModel(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await caches.delete(LAYA_CACHE_NAME)
  }
}

// ---------------------------------------------------------------------------
// Sequence Building & Inference Runtime
// ---------------------------------------------------------------------------

export const QTYPES: Record<string, number> = { choice: 0, score: 1, noul: 2 }

function toInternal(q: any) {
  let crit = q.criteria
  if (q.type === 'choice' && Array.isArray(crit)) {
    crit = Object.fromEntries(crit.map((c: string) => [c, null]))
  }
  return {
    t: q.type,
    ins: typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions),
    crit,
  }
}

function renderOptions(q: any): string[] {
  if (q.t === 'choice') {
    return Object.entries(q.crit).map(([k, v]) => (v ? `${k}: ${v}` : k))
  }
  if (q.t === 'score') {
    return (q.crit as string[]).map((c: string, i: number) => `level ${i}: ${c}`)
  }
  const c = q.crit ?? {}
  return [`false: ${c.false || 'no, the statement does not hold'}`, `true: ${c.true || 'yes, the statement holds'}`]
}

function pyJsonDumps(v: any): string {
  if (v === null || v === undefined)
    return 'null'
  if (typeof v === 'string')
    return JSON.stringify(v)
  if (typeof v === 'number')
    return Number.isInteger(v) ? String(v) : JSON.stringify(v)
  if (typeof v === 'boolean')
    return v ? 'true' : 'false'
  if (Array.isArray(v))
    return `[${v.map(pyJsonDumps).join(', ')}]`
  return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyJsonDumps(x)}`).join(', ')}}`
}

function serializeState(state: any): string {
  return typeof state === 'string' ? state : pyJsonDumps(state)
}

function softmax(z: number[]): number[] {
  const zmax = Math.max(...z)
  const e = z.map(v => Math.exp(v - zmax))
  const sum = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / sum)
}

function confidenceFromProbs(p: number[]): number {
  const k = p.length
  if (k < 2)
    return 1
  let ent = 0
  for (const x of p)
    ent -= x * Math.log(Math.max(x, 1e-12))
  return 1 - ent / Math.log(k)
}

export const DEFAULT_TEMPERATURES: Record<string, number> = {
  'choice:2': 1.9063563346862793,
  'choice:3-5': 1.7601518630981445,
  'choice:6-10': 1.0000158548355103,
  'choice:11+': 0.10058280825614929,
  'score:3-5': 1.2514300346374512,
  'noul:2': 1.983399510383606,
}

function tempBucket(qtype: string, k: number): string {
  const size = k <= 2 ? '2' : k <= 5 ? '3-5' : k <= 10 ? '6-10' : '11+'
  return `${qtype}:${size}`
}

// In-memory active singleton session
let activeSession: ort.InferenceSession | null = null
let activeSessionPrecision: 'int8' | 'fp16' | null = null
let activeTokenizer: any = null
let loadSessionPromise: Promise<ort.InferenceSession> | null = null
let loadTokenizerPromise: Promise<any> | null = null

// Serial async execution queue for ONNX Runtime WASM session.run
let layaSessionRunLock: Promise<unknown> = Promise.resolve()

/**
 * Execute a task with exclusive ownership of the Laya ONNX inference session.
 * Prevents re-entrancy and concurrent session.run memory corruption in WebAssembly.
 */
export async function withLayaSessionLock<T>(task: () => Promise<T>, timeoutMs = 15000): Promise<T> {
  let release: () => void
  const nextLock = new Promise<void>((resolve) => {
    release = resolve
  })
  const previousLock = layaSessionRunLock
  layaSessionRunLock = nextLock

  await previousLock.catch(() => {})

  try {
    let timer: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`[LayaEngine] Inference session.run timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    return await Promise.race([task(), timeoutPromise]).finally(() => clearTimeout(timer))
  }
  finally {
    release!()
  }
}

/**
 * Configure ONNX Runtime WebAssembly environment.
 * Ensures CDN wasm paths are set and numThreads is safely capped to 1
 * when crossOriginIsolated is unavailable.
 */
export function ensureOrtConfigured(): void {
  if (typeof ort === 'undefined' || !ort.env?.wasm)
    return

  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'
  const isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
  ort.env.wasm.numThreads = isCrossOriginIsolated ? Math.min(4, typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4) : 1
  ort.env.wasm.simd = true
  ort.env.wasm.proxy = false
}

// Ensure ORT is configured upon module load
ensureOrtConfigured()

/**
 * Reset in-memory active Laya ONNX session.
 */
export async function resetLayaSession(): Promise<void> {
  if (activeSession) {
    try {
      await (activeSession as any).release?.()
    }
    catch (e) {
      console.warn('[LayaEngine] Error releasing ONNX session:', e)
    }
  }
  activeSession = null
  activeSessionPrecision = null
  loadSessionPromise = null
}

/**
 * Load the active Laya ONNX session from CacheStorage or network.
 * Guaranteed singleton promise ensures only one model is loaded/compiled into WASM at a time.
 */
export async function loadLayaSession(precision: 'int8' | 'fp16' = 'int8'): Promise<ort.InferenceSession> {
  if (activeSession && activeSessionPrecision === precision)
    return activeSession

  if (loadSessionPromise)
    return loadSessionPromise

  loadSessionPromise = (async () => {
    try {
      ensureOrtConfigured()

      const targetFile = precision === 'fp16' ? LAYA_FP16_MODEL_FILE : LAYA_INT8_MODEL_FILE
      const fileUrl = `https://huggingface.co/${LAYA_HF_REPO}/resolve/main/${targetFile}`

      let buffer: ArrayBuffer

      if (typeof caches !== 'undefined') {
        const cache = await caches.open(LAYA_CACHE_NAME)
        const match = await cache.match(fileUrl)
        if (match) {
          buffer = await match.arrayBuffer()
          // Integrity check: if buffer is truncated (< 50MB), evict and re-download
          if (buffer.byteLength < 50_000_000) {
            console.warn(`[LayaEngine] Cached model buffer is truncated (${buffer.byteLength} bytes). Evicting from cache and re-downloading...`)
            await cache.delete(fileUrl)
            await downloadLayaModel({ precision })
            const reMatch = await cache.match(fileUrl)
            if (!reMatch)
              throw new Error('Failed to retrieve freshly downloaded Laya model from cache.')
            buffer = await reMatch.arrayBuffer()
          }
        }
        else {
          // Auto-download if not cached
          console.info(`[LayaEngine] Model not cached. Starting download of ${targetFile}...`)
          await downloadLayaModel({ precision })
          const downloadedMatch = await cache.match(fileUrl)
          if (!downloadedMatch)
            throw new Error('Failed to retrieve downloaded Laya model from cache.')
          buffer = await downloadedMatch.arrayBuffer()
        }
      }
      else {
        const res = await fetch(fileUrl)
        buffer = await res.arrayBuffer()
      }

      console.info(`[LayaEngine] Instantiating ONNX session for ${targetFile} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB, threads=${ort.env.wasm?.numThreads}, simd=${ort.env.wasm?.simd})...`)

      const modelBytes = new Uint8Array(buffer)

      activeSession = await ort.InferenceSession.create(modelBytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
      activeSessionPrecision = precision

      console.info(`[LayaEngine] ✅ ONNX session successfully created for ${targetFile}.`)
      return activeSession
    }
    finally {
      loadSessionPromise = null
    }
  })()

  return loadSessionPromise
}

/**
 * Load the ModernBERT tokenizer for Laya.
 */
export async function loadLayaTokenizer(): Promise<any> {
  if (activeTokenizer)
    return activeTokenizer

  if (loadTokenizerPromise)
    return loadTokenizerPromise

  loadTokenizerPromise = (async () => {
    try {
      activeTokenizer = await AutoTokenizer.from_pretrained(LAYA_HF_REPO)
      return activeTokenizer
    }
    finally {
      loadTokenizerPromise = null
    }
  })()

  return loadTokenizerPromise
}

/**
 * Execute Laya System 1 decision on state + questions.
 */
export async function runLayaSystemOne(
  state: any,
  questions: Record<string, any>,
  precision: 'int8' | 'fp16' = 'int8',
): Promise<{
  model: string
  answers: Record<string, any>
  usage: { input_tokens: number, output_tokens: number }
  latency_ms: number
}> {
  const startTime = performance.now()
  const qids = Object.keys(questions)
  if (qids.length === 0)
    throw new Error('runLayaSystemOne: at least one question is required')

  console.info(`[LayaEngine] Step 1/4: Initializing ONNX session (${precision}) & tokenizer...`)
  const [session, tokenizer] = await Promise.all([
    loadLayaSession(precision),
    loadLayaTokenizer(),
  ])

  console.info(`[LayaEngine] Step 2/4: Building sequence tokens for ${qids.length} questions...`)
  const clsId = tokenizer.cls_token_id ?? 50281
  const sepId = tokenizer.sep_token_id ?? 50282
  const maskId = tokenizer.mask_token_id ?? 50284
  const padId = tokenizer.pad_token_id ?? 50283
  const maxLen = 512
  const headMaxLen = 192

  const encodeText = (txt: string): number[] => {
    const out = tokenizer(txt, { add_special_tokens: false })
    const data = out.input_ids.ort_tensor?.cpuData || out.input_ids.data
    return Array.from(data, (v: any) => Number(v))
  }

  const items = qids.map((qid) => {
    const q = toInternal(questions[qid])
    const opts = renderOptions(q)
    const scrub = (s: string) => s.split('[MASK]').join(' ')
    let headIds = encodeText(`${q.t} question: ${scrub(q.ins)}`)
    let optIds = opts.map(o => [maskId, ...encodeText(` ${scrub(o)}`).slice(0, 48)])
    const total = (xs: number[][]) => xs.reduce((s, o) => s + o.length, 0)
    let optBudget = headMaxLen - total(optIds)

    if (optBudget < 16) {
      const per = Math.max(4, Math.floor((headMaxLen - 16) / Math.max(1, optIds.length)))
      optIds = optIds.map(o => o.slice(0, per))
      optBudget = headMaxLen - total(optIds)
    }

    headIds = headIds.slice(0, Math.max(8, optBudget))
    const seq = [clsId, ...headIds, sepId]
    const markers: number[] = []

    for (const o of optIds) {
      markers.push(seq.length)
      seq.push(...o)
    }
    seq.push(sepId)
    const room = Math.max(0, maxLen - seq.length - 1)
    const st = encodeText(scrub(serializeState(state))).slice(0, room)
    seq.push(...st, sepId)

    return {
      q,
      ids: seq.slice(0, maxLen),
      markers: markers.filter(m => m < maxLen),
      qtype: QTYPES[q.t] ?? 0,
    }
  })

  const n = items.length
  // tozp/laya-onnx ModernBERT backbone has static sequence length 512 in attention reshape operators
  const L = maxLen
  const K = Math.max(...items.map(it => it.markers.length))

  const inputIds = new BigInt64Array(n * L).fill(BigInt(padId))
  const attention = new BigInt64Array(n * L)
  const markerPos = new BigInt64Array(n * K)
  const markerMask = new Uint8Array(n * K)
  const qtype = new BigInt64Array(n)
  let nTokens = 0

  items.forEach((it, i) => {
    it.ids.forEach((v, j) => {
      inputIds[i * L + j] = BigInt(v)
      attention[i * L + j] = 1n
    })
    nTokens += it.ids.length
    it.markers.forEach((m, j) => {
      markerPos[i * K + j] = BigInt(m)
      markerMask[i * K + j] = 1
    })
    qtype[i] = BigInt(it.qtype)
  })

  console.info(`[LayaEngine] Step 3/4: Executing ONNX session.run (batch=${n}, seqLen=${L}, maxMarkers=${K})...`)
  const inputTensor = new ort.Tensor('int64', inputIds, [n, L])
  const attentionTensor = new ort.Tensor('int64', attention, [n, L])
  const markerPosTensor = new ort.Tensor('int64', markerPos, [n, K])
  const markerMaskTensor = new ort.Tensor('bool', markerMask, [n, K])
  const qtypeTensor = new ort.Tensor('int64', qtype, [n])

  let out: Record<string, ort.Tensor> | null = null
  try {
    out = await withLayaSessionLock(async () => {
      return await session.run({
        input_ids: inputTensor,
        attention_mask: attentionTensor,
        marker_pos: markerPosTensor,
        marker_mask: markerMaskTensor,
        qtype: qtypeTensor,
      })
    }, 15000)
  }
  finally {
    inputTensor.dispose?.()
    attentionTensor.dispose?.()
    markerPosTensor.dispose?.()
    markerMaskTensor.dispose?.()
    qtypeTensor.dispose?.()
  }

  const answers: Record<string, any> = {}
  try {
    console.info(`[LayaEngine] Step 4/4: Decoding logits and applying temperature scaling (keys: ${Object.keys(out).join(', ')})...`)
    const logitsTensor = out.logits || (out as any).output
    const logits = logitsTensor?.data

    if (logits instanceof Float32Array) {
      items.forEach((it, r) => {
        const qid = qids[r]
        const k = it.markers.length
        const slice = Array.from(logits.subarray(r * K, r * K + k))
        const temp = DEFAULT_TEMPERATURES[tempBucket(it.q.t, k)] ?? 1.0
        const p = softmax(slice.map(v => v / temp))
        const q = it.q

        if (q.t === 'choice') {
          const keys = Object.keys(q.crit)
          const best = p.indexOf(Math.max(...p))
          answers[qid] = {
            type: 'choice',
            choice: keys[best] || 'unknown',
            probabilities: Object.fromEntries(keys.map((kk, idx) => [kk, round4(p[idx] ?? 0)])),
            confidence: round4(confidenceFromProbs(p)),
          }
        }
        else if (q.t === 'score') {
          answers[qid] = {
            type: 'score',
            score: round4(p.reduce((s, v, idx) => s + idx * v, 0)),
            probabilities: Object.fromEntries(p.map((v, idx) => [String(idx), round4(v)])),
            confidence: round4(confidenceFromProbs(p)),
          }
        }
        else {
          answers[qid] = {
            type: 'noul',
            noul: round4(p[1] ?? 0),
            confidence: round4(confidenceFromProbs(p)),
          }
        }
      })
    }
  }
  finally {
    if (out) {
      for (const tensor of Object.values(out)) {
        (tensor as any)?.dispose?.()
      }
    }
  }

  const latencyMs = Math.round(performance.now() - startTime)
  console.info(`[LayaEngine] ✅ Classification completed in ${latencyMs}ms (${nTokens} tokens).`)

  return {
    model: `laya-${precision}`,
    answers,
    usage: { input_tokens: nTokens, output_tokens: 0 },
    latency_ms: latencyMs,
  }
}
