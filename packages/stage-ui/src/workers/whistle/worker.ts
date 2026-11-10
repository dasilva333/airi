/**
 * Cactus Whistle Web Worker (Speech-to-Text).
 *
 * Runs the Cactus 4.0.0 WebAssembly speech engine with Whistle weights (16.9 MB):
 * - 16 kHz mono Float32Array input
 * - Sub-20ms time-to-first-token on CPU
 * - Keyword boosting (`keywords`)
 * - Native word-level timestamps (`wordTimestamps`)
 * - Multi-language support (7 languages: en, de, fr, es, it, nl, pl)
 * - Persistent caching in CacheStorage API ('whistle-cache')
 */

const WHISTLE_CACHE_NAME = 'whistle-cache'
const CACTUS_JS_URL = 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.0.0/wasm/cactus.js'
const CACTUS_WASM_URL = 'https://huggingface.co/Cactus-Compute/cactus/resolve/main/releases/4.0.0/wasm/cactus.wasm'
const WHISTLE_WEIGHTS_URL = 'https://huggingface.co/Cactus-Compute/whistle/resolve/main/whistle.cact'

// Estimated bundle size: ~18 MB (16.9 MB weights + 1.2 MB WASM engine + 63 KB JS runtime)
const ESTIMATED_TOTAL_BYTES = 18 * 1024 * 1024

let isInitialized = false
let _cactusInstance: any = null

export interface WhistleWorkerWord {
  word: string
  start: number
  end: number
  probability?: number
}

export interface WhistleWorkerTranscribeOutput {
  text: string
  language?: string
  words?: WhistleWorkerWord[]
  ttftMs?: number
  decodeTps?: number
  latencyMs: number
}

/**
 * Downloads and caches Whistle assets in browser CacheStorage, then initializes the Cactus runtime.
 */
async function prepareWhistleAssets(
  onProgress: (ratio: number, message: string) => void,
): Promise<boolean> {
  if (typeof caches === 'undefined') {
    onProgress(1.0, 'Cache Storage API unavailable, downloading in-memory...')
  }

  let cactusJsText: string | null = null
  let wasmBinary: ArrayBuffer | null = null
  let weightsBuffer: ArrayBuffer | null = null

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(WHISTLE_CACHE_NAME)
      const jsRes = await cache.match(CACTUS_JS_URL)
      const wasmRes = await cache.match(CACTUS_WASM_URL)
      const weightsRes = await cache.match(WHISTLE_WEIGHTS_URL)

      if (jsRes && wasmRes && weightsRes) {
        onProgress(0.9, 'Loading cached Whistle assets from CacheStorage...')
        cactusJsText = await jsRes.text()
        wasmBinary = await wasmRes.arrayBuffer()
        weightsBuffer = await weightsRes.arrayBuffer()
      }
    }
    catch (cacheErr) {
      console.warn('[WhistleWorker] Cache match failed, will re-fetch:', cacheErr)
    }
  }

  // If not fully retrieved from cache, fetch from Hugging Face
  if (!cactusJsText || !wasmBinary || !weightsBuffer) {
    onProgress(0.05, 'Starting download of Whistle STT suite (18 MB)...')

    // 1. Fetch Cactus JS Runtime (~63 KB)
    onProgress(0.08, 'Downloading Cactus JS runtime (~63 KB)...')
    const jsFetch = await fetch(CACTUS_JS_URL)
    if (!jsFetch.ok) {
      throw new Error(`Failed to download Cactus JS runtime: ${jsFetch.status} ${jsFetch.statusText}`)
    }
    const jsBlob = await jsFetch.blob()
    cactusJsText = await jsBlob.text()

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(WHISTLE_CACHE_NAME)
        await cache.put(
          CACTUS_JS_URL,
          new Response(jsBlob, {
            headers: {
              'content-length': jsBlob.size.toString(),
              'content-type': 'application/javascript',
            },
          }),
        )
      }
      catch (e) {
        console.warn('[WhistleWorker] Cache put cactus.js failed:', e)
      }
    }

    // 2. Fetch Cactus WASM Engine (~1.2 MB)
    onProgress(0.12, 'Downloading Cactus WASM engine (~1.2 MB)...')
    const wasmFetch = await fetch(CACTUS_WASM_URL)
    if (!wasmFetch.ok) {
      throw new Error(`Failed to download Cactus WASM engine: ${wasmFetch.status} ${wasmFetch.statusText}`)
    }
    const wasmBlob = await wasmFetch.blob()
    wasmBinary = await wasmBlob.arrayBuffer()

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(WHISTLE_CACHE_NAME)
        await cache.put(
          CACTUS_WASM_URL,
          new Response(wasmBlob, {
            headers: {
              'content-length': wasmBlob.size.toString(),
              'content-type': 'application/wasm',
            },
          }),
        )
      }
      catch (e) {
        console.warn('[WhistleWorker] Cache put cactus.wasm failed:', e)
      }
    }

    // 3. Fetch Whistle Weights (.cact, 16.9 MB) with progressive progress
    onProgress(0.2, 'Downloading Whistle acoustic weights (16.9 MB)...')
    const weightsFetch = await fetch(WHISTLE_WEIGHTS_URL)
    if (!weightsFetch.ok || !weightsFetch.body) {
      throw new Error(`Failed to download Whistle weights: ${weightsFetch.status} ${weightsFetch.statusText}`)
    }

    const contentLength = Number(weightsFetch.headers.get('content-length')) || ESTIMATED_TOTAL_BYTES
    const reader = weightsFetch.body.getReader()
    let receivedBytes = 0
    const chunks: BlobPart[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      chunks.push(value)
      receivedBytes += value.length
      const ratio = Math.min(0.92, 0.2 + (receivedBytes / contentLength) * 0.72)
      onProgress(ratio, `Downloading Whistle STT: ${Math.round(ratio * 100)}%`)
    }

    const weightsBlob = new Blob(chunks, { type: 'application/octet-stream' })
    weightsBuffer = await weightsBlob.arrayBuffer()

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(WHISTLE_CACHE_NAME)
        await cache.put(
          WHISTLE_WEIGHTS_URL,
          new Response(weightsBlob, {
            headers: {
              'content-length': weightsBlob.size.toString(),
              'content-type': 'application/octet-stream',
            },
          }),
        )
      }
      catch (e) {
        console.warn('[WhistleWorker] Cache put whistle.cact failed:', e)
      }
    }
  }

  // 4. Instantiate Cactus WebAssembly runtime using cactus.js factory
  onProgress(0.94, 'Initializing Cactus WebAssembly runtime...')
  let createCactus: any
  try {
    createCactus = new Function(`${cactusJsText}\nreturn createCactus;`)()
  }
  catch (fnErr) {
    console.warn('[WhistleWorker] new Function evaluation failed, attempting blob module import:', fnErr)
    const blob = new Blob([`${cactusJsText}\nexport default createCactus;`], { type: 'text/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    try {
      const mod = await import(/* @vite-ignore */ blobUrl)
      createCactus = mod.default
    }
    finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  if (typeof createCactus !== 'function') {
    throw new TypeError(`Cactus factory is not a function (received ${typeof createCactus})`)
  }

  _cactusInstance = await createCactus({ wasmBinary })
  console.info('[WhistleWorker] Cactus WebAssembly engine instantiated')

  // 5. Load Whistle acoustic weights into Cactus
  onProgress(0.97, 'Loading Whistle acoustic graph into Cactus...')
  const weightsBytes = new Uint8Array(weightsBuffer)
  const weightsPtr = _cactusInstance._malloc(weightsBytes.byteLength)
  _cactusInstance.HEAPU8.set(weightsBytes, weightsPtr)
  const loadRes = _cactusInstance._cactus_load(weightsPtr, BigInt(weightsBytes.byteLength))
  _cactusInstance._free(weightsPtr)

  if (loadRes !== 0) {
    const errPtr = _cactusInstance._cactus_last_error?.()
    const errMsg = errPtr ? _cactusInstance.UTF8ToString(errPtr) : `Code ${loadRes}`
    throw new Error(`Cactus weights loading failed: ${errMsg}`)
  }

  const modelsMask = _cactusInstance._cactus_models()
  console.info('[WhistleWorker] Cactus Whistle graph loaded successfully. Models mask:', modelsMask)

  onProgress(1.0, 'Whistle STT engine ready')
  isInitialized = true
  return true
}

/**
 * Execute transcription on 16 kHz Float32Array PCM audio buffer.
 */
async function transcribeAudio(
  audioFloat32: Float32Array,
  options?: {
    language?: string
    keywords?: string[]
    wordTimestamps?: boolean
  },
): Promise<WhistleWorkerTranscribeOutput> {
  const t0 = performance.now()

  // Calculate audio stats for diagnostics
  let maxAmp = 0
  let sumSq = 0
  for (let i = 0; i < audioFloat32.length; i++) {
    const abs = Math.abs(audioFloat32[i])
    if (abs > maxAmp)
      maxAmp = abs
    sumSq += abs * abs
  }
  const rms = Math.sqrt(sumSq / (audioFloat32.length || 1))
  const durationSec = audioFloat32.length / 16000

  console.info('[WhistleWorker] Audio input received:', {
    samples: audioFloat32.length,
    durationSec: Number(durationSec.toFixed(2)),
    maxAmplitude: Number(maxAmp.toFixed(4)),
    rmsEnergy: Number(rms.toFixed(4)),
    isNearSilence: maxAmp < 0.005,
    language: options?.language || 'auto',
    keywordsCount: options?.keywords?.length || 0,
    wordTimestamps: options?.wordTimestamps ?? true,
  })

  // Ensure Cactus engine is ready
  if (!_cactusInstance || !isInitialized) {
    console.warn('[WhistleWorker] Engine not ready, preparing now...')
    await prepareWhistleAssets(() => {})
  }

  if (!_cactusInstance) {
    throw new Error('Cactus WebAssembly engine is not available')
  }

  // 1. Allocate PCM buffer in WASM memory
  const pcmBytes = new Uint8Array(audioFloat32.buffer, audioFloat32.byteOffset, audioFloat32.byteLength)
  const pcmPtr = _cactusInstance._malloc(pcmBytes.byteLength)
  _cactusInstance.HEAPU8.set(pcmBytes, pcmPtr)

  // 2. Prepare language pointer (NULL or null-terminated C string)
  let langPtr = 0
  const encoder = new TextEncoder()
  if (options?.language && options.language !== 'auto') {
    const langBytes = encoder.encode(`${options.language}\0`)
    langPtr = _cactusInstance._malloc(langBytes.byteLength)
    _cactusInstance.HEAPU8.set(langBytes, langPtr)
  }

  // 3. Prepare keywords pointer (NULL or newline-joined null-terminated C string)
  let kwPtr = 0
  if (options?.keywords && options.keywords.length > 0) {
    const kwString = `${options.keywords.join('\n')}\0`
    const kwBytes = encoder.encode(kwString)
    kwPtr = _cactusInstance._malloc(kwBytes.byteLength)
    _cactusInstance.HEAPU8.set(kwBytes, kwPtr)
  }

  // 4. Allocate output buffer (at least 65KB, or ~4KB per audio second)
  const outCapacity = Math.max(65536, Math.ceil(durationSec) * 4096)
  const outPtr = _cactusInstance._malloc(outCapacity)

  try {
    const wordTimestampsFlag = options?.wordTimestamps !== false ? 1 : 0
    console.info('[WhistleWorker] Invoking _cactus_transcribe...')

    const code = _cactusInstance._cactus_transcribe(
      pcmPtr,
      audioFloat32.length,
      langPtr,
      kwPtr,
      wordTimestampsFlag,
      outPtr,
      outCapacity,
    )

    const elapsedMs = Math.round(performance.now() - t0)

    if (code < 0) {
      const errPtr = _cactusInstance._cactus_last_error?.()
      const errMsg = errPtr ? _cactusInstance.UTF8ToString(errPtr) : `Error code ${code}`
      console.error('[WhistleWorker] _cactus_transcribe failed:', code, errMsg)
      throw new Error(`Cactus transcribe error: ${errMsg}`)
    }

    const rawJson = _cactusInstance.UTF8ToString(outPtr)
    console.info(`[WhistleWorker] Raw Cactus response received (code ${code} in ${elapsedMs}ms):`, rawJson)

    let parsed: any = {}
    if (rawJson && rawJson.trim().length > 0) {
      try {
        parsed = JSON.parse(rawJson)
      }
      catch (jsonErr) {
        console.warn('[WhistleWorker] JSON parse failed, using raw output:', jsonErr, rawJson)
        parsed = { text: rawJson }
      }
    }

    const words: WhistleWorkerWord[] = Array.isArray(parsed.words)
      ? parsed.words.map((w: any) => ({
          word: String(w.word || ''),
          start: Number(w.start) || 0,
          end: Number(w.end) || 0,
          probability: typeof w.probability === 'number'
            ? w.probability
            : (typeof w.prob === 'number' ? w.prob : undefined),
        }))
      : []

    console.info('[WhistleWorker] Transcription output parsed successfully:', {
      text: parsed.text || '',
      language: parsed.language || options?.language,
      wordsCount: words.length,
      ttftMs: parsed.ttft_ms,
      decodeTps: parsed.decode_tps,
      totalLatencyMs: elapsedMs,
    })

    return {
      text: parsed.text || '',
      language: parsed.language || options?.language,
      words,
      ttftMs: parsed.ttft_ms,
      decodeTps: parsed.decode_tps,
      latencyMs: elapsedMs,
    }
  }
  finally {
    if (pcmPtr)
      _cactusInstance._free(pcmPtr)
    if (langPtr)
      _cactusInstance._free(langPtr)
    if (kwPtr)
      _cactusInstance._free(kwPtr)
    if (outPtr)
      _cactusInstance._free(outPtr)
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, requestId, audioFloat32, language, keywords, wordTimestamps } = event.data || {}

  switch (type) {
    case 'prepare': {
      try {
        const ok = await prepareWhistleAssets((ratio, message) => {
          self.postMessage({ type: 'progress', requestId, ratio, message })
        })
        self.postMessage({ type: 'ready', requestId, ok })
      }
      catch (err: any) {
        console.error('[WhistleWorker] prepare error:', err)
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Preparation failed' })
      }
      break
    }

    case 'transcribe': {
      try {
        if (!audioFloat32 || !(audioFloat32 instanceof Float32Array)) {
          throw new Error('Invalid audioFloat32 buffer provided')
        }
        const result = await transcribeAudio(audioFloat32, {
          language,
          keywords,
          wordTimestamps,
        })
        self.postMessage({
          type: 'response',
          requestId,
          ...result,
        })
      }
      catch (err: any) {
        console.error('[WhistleWorker] transcribe error:', err)
        self.postMessage({ type: 'error', requestId, message: err?.message || 'Transcription failed' })
      }
      break
    }

    case 'ping': {
      self.postMessage({ type: 'pong', requestId, isInitialized })
      break
    }

    default:
      console.warn('[WhistleWorker] Unknown message type:', type)
      break
  }
}
