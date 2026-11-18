/**
 * Pocket TTS reference-audio conditioning utilities.
 *
 * Provides a singleton accessor for the Pocket TTS adapter and reference audio
 * preprocessing helpers (decoding, resample to 24kHz — the mimi_encoder input
 * rate — silence trimming, peak normalization).
 */

import type { PocketTtsAdapter } from '../../libs/inference/adapters/pocket-tts'
import type { PocketTtsVoiceEmbedding } from '../../libs/inference/contract'

import { conditionMossPlanarWaveform, MOSS_REFERENCE_PREPROCESS_DEFAULTS } from './moss-audio-utils'

export const POCKET_EMBEDDING_CONDITIONING_VERSION = 2

export function isValidPocketVoiceEmbedding(
  emb: unknown,
  expectedDim = 1024,
): emb is PocketTtsVoiceEmbedding {
  if (!emb || typeof emb !== 'object')
    return false
  const candidate = emb as { data?: unknown, dims?: unknown }
  const data = candidate.data
  const dims = candidate.dims
  if (!(data instanceof Float32Array) || data.length === 0)
    return false
  if (!Array.isArray(dims) || dims.length !== 3)
    return false
  const [batch, frames, dim] = dims
  if (batch !== 1 || !Number.isInteger(frames) || frames <= 0 || dim !== expectedDim)
    return false
  return data.length === frames * dim
}

let pocketTtsAdapter: PocketTtsAdapter | null = null

/**
 * Singleton accessor for the Pocket TTS adapter, lazily created on first use.
 */
export async function getPocketTtsAdapterInstance(): Promise<PocketTtsAdapter> {
  if (!pocketTtsAdapter) {
    const { createPocketTtsAdapter } = await import('../../libs/inference/adapters/pocket-tts')
    pocketTtsAdapter = createPocketTtsAdapter()
  }
  return pocketTtsAdapter
}

export interface PocketReferencePreprocessOptions {
  silenceThresholdDb: number
  paddingMs: number
  fadeMs: number
  targetPeakDb: number
  minDurationMs: number
  maxDurationMs: number
}

export const POCKET_REFERENCE_PREPROCESS_DEFAULTS: PocketReferencePreprocessOptions = {
  ...MOSS_REFERENCE_PREPROCESS_DEFAULTS,
}

/**
 * Decode raw audio bytes, resample to target rate via OfflineAudioContext,
 * trim silence, and normalize peak amplitude for Pocket TTS voice cloning.
 */
export async function preprocessPocketReferenceAudio(
  arrayBuffer: ArrayBuffer,
  targetSampleRate = 24000,
  targetChannels = 1,
  options?: Partial<PocketReferencePreprocessOptions>,
): Promise<Float32Array> {
  const opts = { ...POCKET_REFERENCE_PREPROCESS_DEFAULTS, ...options }
  const AudioContextClass = typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null
  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this environment.')
  }

  const decodeCtx = new AudioContextClass()
  let renderedAudio: AudioBuffer

  try {
    const originalAudio = await decodeCtx.decodeAudioData(arrayBuffer.slice(0))
    const totalSamples = Math.ceil(originalAudio.duration * targetSampleRate)
    const OfflineCtxClass = typeof window !== 'undefined'
      ? (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)
      : null
    if (!OfflineCtxClass) {
      throw new Error('OfflineAudioContext is not supported in this environment.')
    }

    const offlineCtx = new OfflineCtxClass(
      targetChannels,
      Math.max(1, totalSamples),
      targetSampleRate,
    )
    const source = offlineCtx.createBufferSource()
    source.buffer = originalAudio
    source.connect(offlineCtx.destination)
    source.start(0)
    renderedAudio = await offlineCtx.startRendering()
  }
  finally {
    if (decodeCtx.state !== 'closed' && typeof decodeCtx.close === 'function') {
      await decodeCtx.close().catch(() => {})
    }
  }

  const waveformLength = renderedAudio.length
  const planarWaveform = new Float32Array(waveformLength * targetChannels)
  for (let c = 0; c < targetChannels; c++) {
    planarWaveform.set(renderedAudio.getChannelData(c), c * waveformLength)
  }
  return conditionMossPlanarWaveform(
    planarWaveform,
    waveformLength,
    targetChannels,
    targetSampleRate,
    opts,
  )
}
