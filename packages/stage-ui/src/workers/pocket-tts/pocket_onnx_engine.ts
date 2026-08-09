/**
 * Pocket TTS ONNX WebAssembly Runtime Engine.
 *
 * Faithful port of KevinAHM's pocket-tts-onnx reference runtime
 * (`pocket_tts_onnx.py` / web-demo `inference-worker.js`):
 *
 *   text → SentencePiece tokens → text_conditioner → [1, T, 1024] embeddings
 *   voice audio (24kHz) → mimi_encoder → [1, V, 1024] voice embedding
 *   flow_lm_main prefill (voice, then per-chunk text; `sequence` stays empty)
 *   per frame: flow_lm_main(sequence=prev latent) → conditioning [1, 1024]
 *              → flow_lm_flow LSD integration → 32-dim acoustic latent
 *              → mimi_decoder(latent=[1, F, 32]) → F × 1920 PCM @ 24kHz
 *
 * NOTICE: `flow_lm_main` does NOT emit latents directly — its `conditioning`
 * output must pass through the stateless `flow_lm_flow` graph (flow matching)
 * before it can feed `mimi_decoder`'s `latent` input.
 */

import type { PocketTtsVoiceEmbedding } from '../../libs/inference/contract'

import * as ort from 'onnxruntime-web'

import { ensureSentencePieceModule, readOpfsFileBlob } from './pocket_model_store'

// Set ONNX WASM SIMD CDN assets & thread count
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'
ort.env.wasm.numThreads = 2

const INTERNAL_ROOT_DIR_NAME = 'pocket-tts-browser-model-store'

/**
 * KevinAHM's self-contained emscripten SentencePiece ESM (fs/Buffer shims inlined).
 * The HF Space serves it as `text/plain`, which cross-origin `import()` rejects, so
 * it is prefetched into OPFS at load time and imported here via a `blob:` URL with a
 * JS MIME type. Cached in OPFS for offline reuse.
 */
const SENTENCEPIECE_JS_FILE_NAME = 'sentencepiece.js'

// Sampling & scheduling constants from the reference runtime
const EOS_LOGIT_THRESHOLD = -4.0
const MAX_FRAMES_PER_CHUNK = 500
const SAMPLING_TEMPERATURE = 0.7
const LSD_STEPS = 1
const FIRST_DECODE_FRAMES = 3
const NORMAL_DECODE_FRAMES = 12
const TEXT_CHUNK_GAP_SEC = 0.25

export interface StateManifestItem {
  input_name: string
  output_name: string
  dtype: 'bool' | 'float32' | 'int64'
  fill: 'ones' | 'zeros' | 'empty' | 'nan'
  shape: number[]
}

export interface PocketBundleManifest {
  sample_rate: number
  samples_per_frame: number
  latent_dim: number
  frame_rate: number
  conditioning_dim?: number
  max_token_per_chunk?: number
  tokenizer_file?: string
  insert_bos_before_voice?: boolean
  bos_before_voice_file?: string
  model_recommended_frames_after_eos?: number | null
  pad_with_spaces_for_short_inputs?: boolean
  remove_semicolons?: boolean
  mimi_state_manifest?: StateManifestItem[]
  flow_lm_state_manifest?: StateManifestItem[]
  predefined_voices?: string[]
}

export interface PocketEngineSessions {
  langFolder: string
  flowLm: ort.InferenceSession
  flowLmFlow: ort.InferenceSession
  mimiDecoder: ort.InferenceSession
  mimiEncoder: ort.InferenceSession
  textConditioner: ort.InferenceSession
  bundle: PocketBundleManifest
  bosBeforeVoice?: { data: Float32Array, shape: number[] }
}

const activeSessions: Record<string, PocketEngineSessions> = {}

async function readOpfsFileUint8Array(langFolder: string, fileName: string): Promise<Uint8Array> {
  const opfsRoot = await navigator.storage.getDirectory()
  const appDir = await opfsRoot.getDirectoryHandle(INTERNAL_ROOT_DIR_NAME)
  const langDir = await appDir.getDirectoryHandle(langFolder)
  const fileHandle = await langDir.getFileHandle(fileName)
  const file = await fileHandle.getFile()
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}

async function readOpfsJson<T>(langFolder: string, fileName: string): Promise<T> {
  const bytes = await readOpfsFileUint8Array(langFolder, fileName)
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text) as T
}

function parseNpyFloat32(buffer: ArrayBuffer): { data: Float32Array, shape: number[] } {
  const view = new DataView(buffer)
  const magic = new Uint8Array(buffer, 0, 6)
  const expected = [0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59] // \x93NUMPY
  for (let i = 0; i < expected.length; i++) {
    if (magic[i] !== expected[i])
      throw new Error('Invalid NPY magic header')
  }
  const major = view.getUint8(6)
  const headerLen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true)
  const headerOffset = major === 1 ? 10 : 12
  const headerText = new TextDecoder().decode(new Uint8Array(buffer, headerOffset, headerLen))
  const shapeMatch = headerText.match(/\(\s*([0-9,\s]+)\)/)
  if (!shapeMatch)
    throw new Error('Could not parse NPY shape')
  const shape = shapeMatch[1]
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => Number.parseInt(part, 10))
  const dataOffset = headerOffset + headerLen
  // NOTICE: slice+copy — `new Float32Array(buffer, dataOffset)` would throw on misaligned offsets
  return { data: new Float32Array(buffer.slice(dataOffset)), shape }
}

export async function getOrLoadPocketSessions(langFolder: string): Promise<PocketEngineSessions> {
  if (activeSessions[langFolder]) {
    return activeSessions[langFolder]
  }

  console.info(`[Pocket ONNX Engine] Reading Int8 ONNX model ArrayBuffers from OPFS for "${langFolder}"...`)

  const [bundle, flowLmBytes, flowLmFlowBytes, mimiDecBytes, mimiEncBytes, textCondBytes] = await Promise.all([
    readOpfsJson<PocketBundleManifest>(langFolder, 'bundle.json'),
    readOpfsFileUint8Array(langFolder, 'flow_lm_main_int8.onnx'),
    readOpfsFileUint8Array(langFolder, 'flow_lm_flow_int8.onnx'),
    readOpfsFileUint8Array(langFolder, 'mimi_decoder_int8.onnx'),
    readOpfsFileUint8Array(langFolder, 'mimi_encoder_int8.onnx'),
    readOpfsFileUint8Array(langFolder, 'text_conditioner_int8.onnx'),
  ])

  let bosBeforeVoice: PocketEngineSessions['bosBeforeVoice']
  if (bundle.insert_bos_before_voice && bundle.bos_before_voice_file) {
    try {
      const bosBytes = await readOpfsFileUint8Array(langFolder, bundle.bos_before_voice_file)
      bosBeforeVoice = parseNpyFloat32(bosBytes.buffer as ArrayBuffer)
    }
    catch (err) {
      console.warn('[Pocket ONNX Engine] Failed to parse bos_before_voice.npy — continuing without it:', err)
    }
  }

  console.info(`[Pocket ONNX Engine] Instantiating ONNX WASM sessions (FlowLM: ${flowLmBytes.length}B, Flow: ${flowLmFlowBytes.length}B, MimiDecoder: ${mimiDecBytes.length}B)...`)

  const sessionOptions: ort.InferenceSession.SessionOptions = {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  }

  const [flowLm, flowLmFlow, mimiDecoder, mimiEncoder, textConditioner] = await Promise.all([
    ort.InferenceSession.create(flowLmBytes, sessionOptions),
    ort.InferenceSession.create(flowLmFlowBytes, sessionOptions),
    ort.InferenceSession.create(mimiDecBytes, sessionOptions),
    ort.InferenceSession.create(mimiEncBytes, sessionOptions),
    ort.InferenceSession.create(textCondBytes, sessionOptions),
  ])

  console.info(`[Pocket ONNX Engine] ✅ All 5 ONNX WASM sessions initialized successfully for "${langFolder}".`)

  const sessions: PocketEngineSessions = {
    langFolder,
    flowLm,
    flowLmFlow,
    mimiDecoder,
    mimiEncoder,
    textConditioner,
    bundle,
    bosBeforeVoice,
  }

  activeSessions[langFolder] = sessions
  return sessions
}

// ---------------------------------------------------------------------------
// SentencePiece tokenizer (tokenizer.model from OPFS, WASM module from CDN)
// ---------------------------------------------------------------------------

interface SentencePieceProcessorLike {
  loadFromB64StringModel: (b64: string) => Promise<void>
  encodeIds: (text: string) => number[]
  decodeIds: (ids: number[]) => string
}

let sentencePieceModulePromise: Promise<any> | null = null
const tokenizerCache: Record<string, Promise<SentencePieceProcessorLike>> = {}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK_SIZE = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  return btoa(binary)
}

async function getSentencePieceModule(): Promise<any> {
  sentencePieceModulePromise ??= (async () => {
    // Ensure the module is in OPFS, then import it via a same-origin blob URL so
    // the browser accepts its MIME type (HF serves the raw file as text/plain).
    await ensureSentencePieceModule()
    const blob = await readOpfsFileBlob(SENTENCEPIECE_JS_FILE_NAME, 'text/javascript')
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await import(/* @vite-ignore */ objectUrl)
    }
    finally {
      URL.revokeObjectURL(objectUrl)
    }
  })()
  return sentencePieceModulePromise
}

async function getPocketTokenizer(langFolder: string, tokenizerFile: string): Promise<SentencePieceProcessorLike> {
  tokenizerCache[langFolder] ??= (async () => {
    const spModule = await getSentencePieceModule()
    const modelBytes = await readOpfsFileUint8Array(langFolder, tokenizerFile)
    const processor: SentencePieceProcessorLike = new spModule.SentencePieceProcessor()
    await processor.loadFromB64StringModel(uint8ArrayToBase64(modelBytes))
    return processor
  })()
  try {
    return await tokenizerCache[langFolder]
  }
  catch (err) {
    // Don't poison the cache with a rejected promise (e.g. transient CDN failure)
    delete tokenizerCache[langFolder]
    sentencePieceModulePromise = null
    throw new Error(`[Pocket ONNX Engine] Failed to load SentencePiece tokenizer: ${err}`)
  }
}

// ---------------------------------------------------------------------------
// Streaming state tensors (KV caches, conv states, counters)
// ---------------------------------------------------------------------------

function createTensorFromStateSpec(spec: StateManifestItem): ort.Tensor {
  const shape = spec.shape || [1]
  const totalElements = shape.reduce((a, b) => a * b, 1)

  if (spec.dtype === 'bool') {
    const data = new Uint8Array(totalElements)
    if (spec.fill === 'ones')
      data.fill(1)
    return new ort.Tensor('bool', data, shape)
  }

  if (spec.dtype === 'int64') {
    return new ort.Tensor('int64', new BigInt64Array(totalElements), shape)
  }

  const data = new Float32Array(totalElements)
  if (spec.fill === 'nan')
    data.fill(Number.NaN)
  return new ort.Tensor('float32', data, shape)
}

function initStateFromManifest(manifest: StateManifestItem[]): Record<string, ort.Tensor> {
  const state: Record<string, ort.Tensor> = {}
  for (const spec of manifest)
    state[spec.input_name] = createTensorFromStateSpec(spec)
  return state
}

function updateStateFromManifestOutputs(
  state: Record<string, ort.Tensor>,
  results: ort.InferenceSession.OnnxValueMapType,
  manifest: StateManifestItem[],
): void {
  for (const spec of manifest) {
    const out = results[spec.output_name]
    if (out)
      state[spec.input_name] = out
  }
}

// ---------------------------------------------------------------------------
// Text preparation & chunking (reference: prepareTextPrompt / splitIntoBestSentences)
// ---------------------------------------------------------------------------

function prepareTextPrompt(text: string, bundle: PocketBundleManifest): { text: string, framesAfterEos: number } {
  let prompt = text.trim().replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ')
  if (!prompt)
    throw new Error('Text cannot be empty')
  if (bundle.remove_semicolons)
    prompt = prompt.replace(/;/g, ',')

  const wordCount = prompt.split(/\s+/).filter(Boolean).length
  let framesAfterEos = wordCount <= 4 ? 3 : 1
  if (bundle.model_recommended_frames_after_eos != null)
    framesAfterEos = Number(bundle.model_recommended_frames_after_eos)

  if (!/[A-ZÀ-Þ]/.test(prompt[0]))
    prompt = prompt[0].toUpperCase() + prompt.slice(1)
  if (/[0-9A-Za-zÀ-ÿ]/.test(prompt[prompt.length - 1]))
    prompt += '.'
  if (bundle.pad_with_spaces_for_short_inputs && wordCount < 5)
    prompt = `        ${prompt}`
  return { text: prompt, framesAfterEos }
}

const SENTENCE_SPLIT_RE = /[^.!?]+[.!?]+|[^.!?]+$/g

function splitTextIntoChunks(preparedText: string, tokenizer: SentencePieceProcessorLike, maxTokens: number): string[] {
  const sentences = preparedText.match(SENTENCE_SPLIT_RE)?.map(s => s.trim()).filter(Boolean) ?? []
  if (sentences.length === 0)
    return [preparedText]

  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const sentenceTokenCount = tokenizer.encodeIds(sentence).length

    // Over-long sentence: split by decoding token slices (reference behavior)
    if (sentenceTokenCount > maxTokens) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      const ids = tokenizer.encodeIds(sentence)
      for (let i = 0; i < ids.length; i += maxTokens) {
        const piece = tokenizer.decodeIds(ids.slice(i, i + maxTokens)).trim()
        if (piece)
          chunks.push(piece)
      }
      continue
    }

    if (!currentChunk) {
      currentChunk = sentence
      continue
    }

    const combined = `${currentChunk} ${sentence}`
    if (tokenizer.encodeIds(combined).length > maxTokens) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    }
    else {
      currentChunk = combined
    }
  }

  if (currentChunk)
    chunks.push(currentChunk.trim())
  return chunks
}

// ---------------------------------------------------------------------------
// Voice conditioning (mimi_encoder → flow_lm_main voice prefill)
// ---------------------------------------------------------------------------

/**
 * Encode a 24kHz mono reference waveform into a speaker-projected voice
 * embedding `[1, V, 1024]` via mimi_encoder.
 */
export async function encodePocketVoiceEmbedding(
  sessions: PocketEngineSessions,
  audio: Float32Array,
): Promise<PocketTtsVoiceEmbedding> {
  const input = new ort.Tensor('float32', audio, [1, 1, audio.length])
  const outputs = await sessions.mimiEncoder.run({ audio: input })
  const embeddings = outputs[sessions.mimiEncoder.outputNames[0]]

  let dims = embeddings.dims.slice()
  while (dims.length > 3 && dims[0] === 1)
    dims = dims.slice(1)
  if (dims.length < 3)
    dims = [1, dims[0], dims[1]]

  console.info(`[Pocket ONNX Engine] Voice embedding encoded: [${dims.join(' × ')}]`)
  return { data: new Float32Array(embeddings.data as Float32Array), dims }
}

/**
 * Prime the Flow-LM KV state with the voice embedding (BOS-before-voice
 * prepended when the bundle requires it). Ran once per voice; the resulting
 * state is shallow-cloned per text chunk.
 */
async function buildVoiceConditionedFlowState(
  sessions: PocketEngineSessions,
  voiceEmbedding: PocketTtsVoiceEmbedding,
): Promise<Record<string, ort.Tensor>> {
  const { bundle } = sessions
  const latentDim = bundle.latent_dim || 32
  const state = initStateFromManifest(bundle.flow_lm_state_manifest || [])

  let data = voiceEmbedding.data
  const dims = voiceEmbedding.dims.slice()

  if (bundle.insert_bos_before_voice && sessions.bosBeforeVoice) {
    const bos = sessions.bosBeforeVoice
    const merged = new Float32Array(bos.data.length + data.length)
    merged.set(bos.data, 0)
    merged.set(data, bos.data.length)
    data = merged
    dims[1] += bos.shape[1]
  }

  const result = await sessions.flowLm.run({
    sequence: new ort.Tensor('float32', new Float32Array(0), [1, 0, latentDim]),
    text_embeddings: new ort.Tensor('float32', data, dims),
    ...state,
  })
  updateStateFromManifestOutputs(state, result, bundle.flow_lm_state_manifest || [])
  return state
}

// ---------------------------------------------------------------------------
// Autoregressive synthesis
// ---------------------------------------------------------------------------

function fillGaussianNoise(data: Float32Array, std: number): void {
  // Box–Muller
  for (let i = 0; i < data.length; i += 2) {
    let u = 0
    let v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    const magnitude = Math.sqrt(-2.0 * Math.log(u)) * std
    data[i] = magnitude * Math.cos(2.0 * Math.PI * v)
    if (i + 1 < data.length)
      data[i + 1] = magnitude * Math.sin(2.0 * Math.PI * v)
  }
}

/**
 * Generate speech Float32Array PCM samples (24kHz) using stateful ONNX sessions.
 */
export async function synthesizePocketSpeech(
  sessions: PocketEngineSessions,
  text: string,
  voiceEmbedding: PocketTtsVoiceEmbedding | null,
  onChunk: (samples: Float32Array) => void,
  signal?: AbortSignal,
): Promise<Float32Array> {
  const { bundle } = sessions
  const sampleRate = bundle.sample_rate || 24000
  const latentDim = bundle.latent_dim || 32
  const conditioningDim = bundle.conditioning_dim || 1024
  const maxTokensPerChunk = bundle.max_token_per_chunk || 50
  const flowManifest = bundle.flow_lm_state_manifest || []
  const mimiManifest = bundle.mimi_state_manifest || []

  console.info(`[Pocket ONNX Engine] Synthesizing speech for text (${text.length} chars)...`)

  const tokenizer = await getPocketTokenizer(sessions.langFolder, bundle.tokenizer_file || 'tokenizer.model')
  const { text: preparedText, framesAfterEos } = prepareTextPrompt(text, bundle)
  const textChunks = splitTextIntoChunks(preparedText, tokenizer, maxTokensPerChunk)

  // Voice-conditioned base state, primed once and reused (read-only) per chunk
  let baseFlowState: Record<string, ort.Tensor>
  if (voiceEmbedding) {
    baseFlowState = await buildVoiceConditionedFlowState(sessions, voiceEmbedding)
  }
  else {
    console.warn('[Pocket ONNX Engine] No voice embedding supplied — running WITHOUT voice conditioning. Upload a reference voice for intelligible output.')
    baseFlowState = initStateFromManifest(flowManifest)
  }

  // Precompute flow-matching (LSD) timestep tensors: x += flow_dir * dt per step
  const lsdDt = 1.0 / LSD_STEPS
  const stBuffers: Array<{ s: ort.Tensor, t: ort.Tensor }> = []
  for (let j = 0; j < LSD_STEPS; j++) {
    const s = j / LSD_STEPS
    stBuffers.push({
      s: new ort.Tensor('float32', new Float32Array([s]), [1, 1]),
      t: new ort.Tensor('float32', new Float32Array([s + lsdDt]), [1, 1]),
    })
  }

  const chunks: Float32Array[] = []
  const pushChunk = (pcm: Float32Array) => {
    chunks.push(pcm)
    onChunk(pcm)
  }

  let mimiState = initStateFromManifest(mimiManifest)
  let flowState: Record<string, ort.Tensor> = { ...baseFlowState }
  let isFirstAudioChunk = true

  for (let chunkIdx = 0; chunkIdx < textChunks.length; chunkIdx++) {
    if (signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')

    // Reference runtime resets both stateful graphs between text chunks
    if (chunkIdx > 0) {
      flowState = { ...baseFlowState }
      mimiState = initStateFromManifest(mimiManifest)
      pushChunk(new Float32Array(Math.max(1, Math.floor(TEXT_CHUNK_GAP_SEC * sampleRate))))
    }

    const tokenIds = tokenizer.encodeIds(textChunks[chunkIdx])
    const tokenTensor = new ort.Tensor('int64', BigInt64Array.from(tokenIds, id => BigInt(id)), [1, tokenIds.length])
    const condOut = await sessions.textConditioner.run({ token_ids: tokenTensor })
    let textEmb = condOut[sessions.textConditioner.outputNames[0]]
    if (textEmb.dims.length === 2) {
      textEmb = new ort.Tensor('float32', new Float32Array(textEmb.data as Float32Array), [1, textEmb.dims[0], textEmb.dims[1]])
    }

    // Text prefill: empty `sequence` primes the KV state with text embeddings
    const emptySeq = new ort.Tensor('float32', new Float32Array(0), [1, 0, latentDim])
    const emptyText = new ort.Tensor('float32', new Float32Array(0), [1, 0, conditioningDim])
    const prefillOut = await sessions.flowLm.run({ sequence: emptySeq, text_embeddings: textEmb, ...flowState })
    updateStateFromManifestOutputs(flowState, prefillOut, flowManifest)

    // AR frame loop — a NaN `sequence` frame selects the learned BOS embedding in-graph
    let currentLatent = new ort.Tensor('float32', new Float32Array(latentDim).fill(Number.NaN), [1, 1, latentDim])
    let eosStep: number | null = null
    const latents: Float32Array[] = []
    let decodedFrames = 0

    for (let step = 0; step < MAX_FRAMES_PER_CHUNK; step++) {
      if (signal?.aborted)
        throw new DOMException('Aborted', 'AbortError')
      // Yield to the event loop periodically so abort/streaming stays responsive
      if (step > 0 && step % 4 === 0)
        await new Promise(r => setTimeout(r, 0))

      const arOut = await sessions.flowLm.run({ sequence: currentLatent, text_embeddings: emptyText, ...flowState })
      const conditioning = arOut[sessions.flowLm.outputNames[0]]
      const eosLogit = (arOut[sessions.flowLm.outputNames[1]].data as Float32Array)[0]
      updateStateFromManifestOutputs(flowState, arOut, flowManifest)

      if (eosLogit > EOS_LOGIT_THRESHOLD && eosStep == null)
        eosStep = step
      const shouldStop = eosStep != null && step >= eosStep + framesAfterEos

      // Flow matching: integrate noise → acoustic latent under `conditioning`
      const latentData = new Float32Array(latentDim)
      fillGaussianNoise(latentData, Math.sqrt(SAMPLING_TEMPERATURE))
      for (const { s, t } of stBuffers) {
        const flowOut = await sessions.flowLmFlow.run({
          c: conditioning,
          s,
          t,
          x: new ort.Tensor('float32', latentData, [1, latentDim]),
        })
        const flowDir = flowOut[sessions.flowLmFlow.outputNames[0]].data as Float32Array
        for (let i = 0; i < latentDim; i++)
          latentData[i] += flowDir[i] * lsdDt
      }

      latents.push(latentData)
      currentLatent = new ort.Tensor('float32', latentData, [1, 1, latentDim])

      // Decode policy: small first chunk for low TTFB, steady chunks after, flush on EOS
      const pending = latents.length - decodedFrames
      let decodeSize = 0
      if (shouldStop)
        decodeSize = pending
      else if (isFirstAudioChunk && pending >= FIRST_DECODE_FRAMES)
        decodeSize = FIRST_DECODE_FRAMES
      else if (pending >= NORMAL_DECODE_FRAMES)
        decodeSize = NORMAL_DECODE_FRAMES

      if (decodeSize > 0) {
        const packed = new Float32Array(decodeSize * latentDim)
        for (let f = 0; f < decodeSize; f++)
          packed.set(latents[decodedFrames + f], f * latentDim)

        const decOut = await sessions.mimiDecoder.run({
          latent: new ort.Tensor('float32', packed, [1, decodeSize, latentDim]),
          ...mimiState,
        })
        updateStateFromManifestOutputs(mimiState, decOut, mimiManifest)
        decodedFrames += decodeSize

        pushChunk(new Float32Array(decOut[sessions.mimiDecoder.outputNames[0]].data as Float32Array))
        isFirstAudioChunk = false
      }

      if (shouldStop)
        break
    }

    // Flush leftover frames when the frame cap was hit without EOS
    if (decodedFrames < latents.length) {
      const remaining = latents.length - decodedFrames
      const packed = new Float32Array(remaining * latentDim)
      for (let f = 0; f < remaining; f++)
        packed.set(latents[decodedFrames + f], f * latentDim)

      const decOut = await sessions.mimiDecoder.run({
        latent: new ort.Tensor('float32', packed, [1, remaining, latentDim]),
        ...mimiState,
      })
      updateStateFromManifestOutputs(mimiState, decOut, mimiManifest)
      pushChunk(new Float32Array(decOut[sessions.mimiDecoder.outputNames[0]].data as Float32Array))
    }
  }

  let totalLength = 0
  for (const c of chunks)
    totalLength += c.length
  const fullAudio = new Float32Array(totalLength)
  let writeOffset = 0
  for (const c of chunks) {
    fullAudio.set(c, writeOffset)
    writeOffset += c.length
  }

  console.info(`[Pocket ONNX Engine] Neural synthesis complete. Total ${sampleRate}Hz PCM samples generated: ${fullAudio.length} (~${(fullAudio.length / sampleRate).toFixed(2)}s)`)
  return fullAudio
}
