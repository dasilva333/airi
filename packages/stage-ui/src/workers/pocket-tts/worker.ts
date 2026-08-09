/**
 * Pocket TTS Web Worker entry point.
 * Speaks the Eventa inference contract for Pocket TTS.
 */

import type { LoadModelRequest, LoadStreamItem, PocketTtsGenerateChunk, PocketTtsGenerateRequest } from '../../libs/inference/contract'

import { defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import { pocketTtsGenerateEvent, pocketTtsLoadEvent } from '../../libs/inference/contract'
import { ensureExternalBrowserOnnxModels } from './pocket_model_store'
import { getOrLoadPocketSessions, synthesizePocketSpeech } from './pocket_onnx_engine'

const { context } = createContext()

let isLoaded = false
let activeLanguage = 'english_2026-04'

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
  await getOrLoadPocketSessions(activeLanguage)

  isLoaded = true
  console.info('[Pocket Worker] Pocket TTS engine successfully initialized & ready.')

  emit({
    kind: 'ready',
    info: {
      device: 'wasm',
      metadata: {
        codecConfig: {
          sample_rate: 16000,
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
  const { text, voiceId, promptAudioWaveform, promptAudioCodes: cachedPromptAudioCodes } = payload
  console.info('[Pocket Worker] Generate request:', { voiceId, textLength: text.length, hasWaveform: !!promptAudioWaveform, hasCachedCodes: !!cachedPromptAudioCodes })

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Generate synthetic sine/silent chunk or codes if initial run
  if (!cachedPromptAudioCodes && promptAudioWaveform) {
    emit({
      kind: 'prompt-audio-codes',
      promptAudioCodes: [[10, 20, 30, 40]],
    })
  }

  const sessions = await getOrLoadPocketSessions(activeLanguage)

  await synthesizePocketSpeech(
    sessions,
    text,
    (samples) => {
      emit({
        samples,
        samplingRate: 16000,
      })
    },
    signal,
  )
}))
