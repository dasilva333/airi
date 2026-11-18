/**
 * MOSS TTS Web Worker entry point.
 * Speaks the Eventa inference contract for MOSS.
 * Last rebuilt: 2026-06-25T12:50:00Z
 */

import type { LoadStreamItem, MossGenerateChunk, MossGenerateRequest, MossLoadRequest } from '../../libs/inference/contract'

import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import { mossGenerateEvent, mossLoadEvent, mossUnloadEvent } from '../../libs/inference/contract'
import { createBrowserOnnxTtsRuntime } from './browser_onnx_runtime.js'

// Import NanoReaderBrowserModelStore onto globalThis
import './browser_model_store.js'
import './tokenizer_sandbox.js'

const { context } = createContext()

let runtime: any = null

defineStreamInvokeHandler(context, mossLoadEvent, toStreamHandler<MossLoadRequest, LoadStreamItem>(async ({ payload, emit, options }) => {
  const signal = options?.abortController?.signal
  const { hfToken, cpuThreads } = payload

  const onProgress = (p: any) => {
    emit({
      kind: 'progress',
      payload: {
        phase: p.phase || 'download',
        percent: p.fileCount ? Math.round((p.fileIndex / p.fileCount) * 100) : 0,
        message: p.message || '',
        file: p.fileName || '',
        loaded: p.fileIndex || 0,
        total: p.fileCount || 0,
      },
    })
  }

  // Check if client aborted
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Ensure MOSS models are downloaded/available in OPFS
  const NanoReaderBrowserModelStore = (globalThis as any).NanoReaderBrowserModelStore
  const modelSpec = await NanoReaderBrowserModelStore.ensureExternalBrowserOnnxModels({
    onProgress,
    accessToken: hfToken || '',
  })

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Initialize runtime
  if (!runtime) {
    runtime = createBrowserOnnxTtsRuntime({
      logger: (msg: string) => console.log('[MOSS Worker]', msg),
    })
  }

  await runtime.configure({
    modelPath: modelSpec.managedPath,
    threadCount: cpuThreads ?? 4,
  })

  await runtime.ensureManifestLoaded()
  await runtime.ensureSynthesisLoaded()

  const builtinVoices = Array.isArray(runtime.manifest?.builtin_voices)
    ? runtime.manifest.builtin_voices
        .filter((v: any) => v && typeof v.voice === 'string')
        .map((v: any) => ({
          id: String(v.voice),
          name: String(v.display_name || v.voice),
        }))
    : []

  emit({
    kind: 'ready',
    info: {
      device: 'wasm',
      metadata: {
        // Codec packing/detargeting is main-thread driven (AudioContext is not
        // available in a worker scope). The main thread needs the real codec
        // sample rate/channels to condition reference audio correctly.
        codecConfig: {
          sample_rate: runtime.codecMeta?.codec_config?.sample_rate ?? 48000,
          channels: runtime.codecMeta?.codec_config?.channels ?? 2,
        },
        builtinVoices,
      },
    },
  })
}))

defineStreamInvokeHandler(context, mossGenerateEvent, toStreamHandler<MossGenerateRequest, MossGenerateChunk>(async ({ payload, emit, options }) => {
  if (!runtime) {
    throw new Error('MOSS TTS worker: No model loaded.')
  }

  const signal = options?.abortController?.signal
  const { text, voiceId, samplingMode, voiceCloneMaxTokens, promptAudioWaveform, promptAudioChannels, promptAudioCodes: cachedPromptAudioCodes } = payload
  console.log('[MOSS Worker] generate request:', { voiceId, samplingMode, hasWaveform: !!promptAudioWaveform, channels: promptAudioChannels, hasCachedCodes: !!cachedPromptAudioCodes })

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  // Prepare extraVoices for custom voice clone
  const extraVoices: any[] = []
  let freshlyEncodedCodes: number[][] | undefined
  if (voiceId) {
    // NOTICE: Option 1 — raw reference bytes are decoded inside the runtime so the
    // OfflineAudioContext resampling + codec-config channel packing is the single
    // source of truth. Phase A preconditioning was applied in providers.ts before
    // these bytes were buffered. Phase B cache hits skip the codec encode entirely.
    if (cachedPromptAudioCodes && cachedPromptAudioCodes.length > 0) {
      console.log('[MOSS Worker] cache hit: using stored prompt_audio_codes, frames:', cachedPromptAudioCodes.length)
      extraVoices.push({
        voice: voiceId,
        display_name: voiceId,
        group: 'custom',
        audio_file: `${voiceId}.bin`,
        prompt_audio_codes: cachedPromptAudioCodes,
      })
    }
    else if (promptAudioWaveform && promptAudioWaveform.length > 0) {
      const waveformLength = Math.floor(promptAudioWaveform.length / (promptAudioChannels || 1))
      console.log('[MOSS Worker] cache miss: encoding planar waveform, frames:', waveformLength)
      await runtime.ensureCodecEncodeLoaded()
      const codes = await runtime.encodeReferenceAudioFromWaveform(
        promptAudioWaveform,
        waveformLength,
        promptAudioChannels || 1,
      )
      freshlyEncodedCodes = codes
      extraVoices.push({
        voice: voiceId,
        display_name: voiceId,
        group: 'custom',
        audio_file: `${voiceId}.bin`,
        prompt_audio_codes: codes,
      })
    }
  }

  runtime.setProfilingEnabled?.(true)
  await runtime.synthesizeVoiceClone({
    text,
    voiceName: voiceId,
    extraVoices,
    sampleMode: samplingMode,
    doSample: samplingMode !== 'greedy',
    streaming: false, // Generate full waveform then stream segments
    enableNormalizeTtsText: false, // done by Audio Studio / pipeline
    enableWeTextProcessing: false,
    voiceCloneMaxTextTokens: voiceCloneMaxTokens,
    onPreparedText: async () => {},
    isCancelled: () => signal?.aborted || false,
    onAudioChunk: async (chunk: any) => {
      if (signal?.aborted)
        return
      if (chunk.chunkData && chunk.chunkData[0]) {
        const channels = typeof chunk.channels === 'number' && chunk.channels > 0
          ? chunk.channels
          : chunk.chunkData.length
        emit({
          samples: chunk.chunkData[0],
          channelData: chunk.chunkData,
          channels,
          samplingRate: chunk.sampleRate || 48000,
        })
      }
    },
  })

  const profile = runtime.getProfileSnapshot?.()
  if (profile?.stages) {
    console.log('[MOSS Worker] stage timings (ms):', profile.stages)
  }

  if (freshlyEncodedCodes && freshlyEncodedCodes.length > 0) {
    emit({
      samplingRate: 0,
      kind: 'prompt-audio-codes',
      promptAudioCodes: freshlyEncodedCodes,
    })
  }
}))

defineInvokeHandler(context, mossUnloadEvent, async () => {
  runtime = null
})
