/**
 * Pocket TTS Web Worker entry point.
 * Speaks the Eventa inference contract for Pocket TTS.
 */

import type { LoadModelRequest, LoadStreamItem, PocketTtsGenerateChunk, PocketTtsGenerateRequest, PocketTtsVoiceEmbedding } from '../../libs/inference/contract'

import { defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import { pocketTtsGenerateEvent, pocketTtsLoadEvent } from '../../libs/inference/contract'
import { ensureExternalBrowserOnnxModels } from './pocket_model_store'
import { encodePocketVoiceEmbedding, getOrLoadPocketSessions, synthesizePocketSpeech } from './pocket_onnx_engine'

const { context } = createContext()

let isLoaded = false
let activeLanguage = 'english_2026-04'

// In-worker voice embedding cache, keyed by `${language}:${voiceId}` — each
// language bundle ships its own mimi_encoder weights, so embeddings are not
// portable across languages.
let cachedVoice: { key: string, embedding: PocketTtsVoiceEmbedding } | null = null

defineStreamInvokeHandler(context, pocketTtsLoadEvent, toStreamHandler<LoadModelRequest, LoadStreamItem>(async ({ payload, emit, options }) => {
  const signal = options?.abortController?.signal
  const { hfToken } = payload
  activeLanguage = payload.language || payload.model || 'english_2026-04'

  console.info(`[Pocket Worker] Load model request received for language/model: "${activeLanguage}"`)

  const onProgress = (p: any) => {
    console.info(`[Pocket Worker] Download progress: ${p.message} (${p.percent || 0}%)`)
    emit({
      kind: 'progress',
      payload: {
        phase: p.phase || 'download',
        percent: p.percent || (p.fileCount ? Math.round((p.fileIndex / p.fileCount) * 100) : 0),
        message: p.message || '',
        file: p.fileName || '',
        loaded: p.fileIndex || 0,
        total: p.fileCount || 0,
      },
    })
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Ensure Pocket TTS models are downloaded/available in OPFS
  console.info('[Pocket Worker] Verifying OPFS storage...')
  await ensureExternalBrowserOnnxModels({
    language: activeLanguage,
    onProgress,
    accessToken: hfToken || '',
  })

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Pre-load ONNX WASM sessions in worker
  console.info('[Pocket Worker] Initializing ONNX WASM sessions...')
  const sessions = await getOrLoadPocketSessions(activeLanguage)

  isLoaded = true
  console.info('[Pocket Worker] Pocket TTS engine successfully initialized & ready.')

  emit({
    kind: 'ready',
    info: {
      device: 'wasm',
      metadata: {
        codecConfig: {
          sample_rate: sessions.bundle.sample_rate || 24000,
          channels: 1,
        },
      },
    },
  })
}))

defineStreamInvokeHandler(context, pocketTtsGenerateEvent, toStreamHandler<PocketTtsGenerateRequest, PocketTtsGenerateChunk>(async ({ payload, emit, options }) => {
  if (!isLoaded) {
    throw new Error('Pocket TTS worker: No model loaded.')
  }

  const signal = options?.abortController?.signal
  const { text, voiceId, promptAudioWaveform } = payload
  const voiceCacheKey = `${activeLanguage}:${voiceId}`
  console.info('[Pocket Worker] Generate request:', { voiceId, textLength: text.length, hasWaveform: !!promptAudioWaveform, hasCachedEmbedding: !!payload.promptVoiceEmbedding })

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const sessions = await getOrLoadPocketSessions(activeLanguage)

  // Resolve voice conditioning: IndexedDB-cached embedding > worker cache > fresh encode
  let voiceEmbedding = payload.promptVoiceEmbedding
    ?? (cachedVoice?.key === voiceCacheKey ? cachedVoice.embedding : undefined)

  if (!voiceEmbedding && promptAudioWaveform) {
    console.info('[Pocket Worker] Encoding reference waveform through Mimi encoder (24kHz mono)...')
    voiceEmbedding = await encodePocketVoiceEmbedding(sessions, promptAudioWaveform)
    cachedVoice = { key: voiceCacheKey, embedding: voiceEmbedding }
    // Harvested by the adapter for persistent IndexedDB caching
    emit({
      kind: 'voice-embedding',
      voiceEmbedding,
    })
  }

  const samplingRate = sessions.bundle.sample_rate || 24000

  await synthesizePocketSpeech(
    sessions,
    text,
    voiceEmbedding ?? null,
    (samples) => {
      emit({
        samples,
        samplingRate,
      })
    },
    signal,
  )
}))
