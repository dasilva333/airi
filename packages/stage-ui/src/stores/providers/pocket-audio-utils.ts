/**
 * Pocket TTS reference-audio conditioning utilities.
 *
 * Provides a singleton accessor for the Pocket TTS adapter and reference audio
 * preprocessing helpers (decoding, resample to 16kHz, silence trimming, peak normalization).
 */

let pocketTtsAdapter: any = null

/**
 * Singleton accessor for the Pocket TTS adapter, lazily created on first use.
 */
export async function getPocketTtsAdapterInstance() {
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

const POCKET_REFERENCE_PREPROCESS_DEFAULTS: PocketReferencePreprocessOptions = {
  silenceThresholdDb: -45,
  paddingMs: 150,
  fadeMs: 50,
  targetPeakDb: -3,
  minDurationMs: 1000,
  maxDurationMs: 15000,
}

/**
 * Decode raw audio bytes, resample to target rate via OfflineAudioContext,
 * trim silence, and normalize peak amplitude for Pocket TTS voice cloning.
 */
export async function preprocessPocketReferenceAudio(
  arrayBuffer: ArrayBuffer,
  targetSampleRate = 16000,
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

  const rawSamples = renderedAudio.getChannelData(0)
  if (rawSamples.length === 0) {
    throw new Error('Preprocessed audio contained 0 samples.')
  }

  // Peak normalization & silence threshold trimming
  const thresholdRatio = 10 ** (opts.silenceThresholdDb / 20)
  let startIdx = 0
  while (startIdx < rawSamples.length && Math.abs(rawSamples[startIdx]) < thresholdRatio) {
    startIdx++
  }
  let endIdx = rawSamples.length - 1
  while (endIdx > startIdx && Math.abs(rawSamples[endIdx]) < thresholdRatio) {
    endIdx--
  }

  if (startIdx >= endIdx) {
    startIdx = 0
    endIdx = rawSamples.length - 1
  }

  const paddingSamples = Math.round((opts.paddingMs / 1000) * targetSampleRate)
  const paddedStart = Math.max(0, startIdx - paddingSamples)
  const paddedEnd = Math.min(rawSamples.length, endIdx + 1 + paddingSamples)

  let sliced = rawSamples.subarray(paddedStart, paddedEnd)

  const minSamples = Math.round((opts.minDurationMs / 1000) * targetSampleRate)
  const maxSamples = Math.round((opts.maxDurationMs / 1000) * targetSampleRate)
  if (sliced.length < minSamples) {
    sliced = rawSamples.subarray(0, Math.min(rawSamples.length, maxSamples))
  }
  else if (sliced.length > maxSamples) {
    sliced = sliced.subarray(0, maxSamples)
  }

  // Peak normalization to targetPeakDb
  let maxAbs = 0
  for (let i = 0; i < sliced.length; i++) {
    const val = Math.abs(sliced[i])
    if (val > maxAbs)
      maxAbs = val
  }

  const result = new Float32Array(sliced.length)
  if (maxAbs > 1e-6) {
    const targetPeakRatio = 10 ** (opts.targetPeakDb / 20)
    const scale = targetPeakRatio / maxAbs
    for (let i = 0; i < sliced.length; i++) {
      result[i] = sliced[i] * scale
    }
  }
  else {
    result.set(sliced)
  }

  return result
}
