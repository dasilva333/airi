/**
 * MOSS TTS reference-audio conditioning utilities.
 *
 * Extracted from `providers.ts` during the Phase 1 provider-store registry
 * restructure. These helpers are used exclusively by the `moss-nano-local`
 * speech provider to preprocess user-supplied voice-clone reference audio
 * before it is sent to the codec worker.
 *
 * NOTICE: `preprocessMossReferenceAudio` consolidates the divergent decode
 * path — see browser_onnx_runtime.js `decodeAudioToWaveform` for the parallel
 * in-runtime implementation. The two must stay in lockstep on sample-rate,
 * channel packing, and frame sizing. Any change here must be mirrored there
 * until both paths converge on one.
 */

let mossAdapter: any = null

/**
 * Singleton accessor for the MOSS adapter, lazily created on first use.
 */
export async function getMossAdapterInstance() {
  if (!mossAdapter) {
    const { createMossAdapter } = await import('../../libs/inference/adapters/moss')
    mossAdapter = createMossAdapter()
  }
  return mossAdapter
}

export interface MossReferencePreprocessOptions {
  silenceThresholdDb: number
  paddingMs: number
  fadeMs: number
  targetPeakDb: number
  minDurationMs: number
  maxDurationMs: number
}

const MOSS_REFERENCE_PREPROCESS_DEFAULTS: MossReferencePreprocessOptions = {
  silenceThresholdDb: -45,
  paddingMs: 150,
  fadeMs: 50,
  targetPeakDb: -3,
  minDurationMs: 1000,
  maxDurationMs: 15000,
}

/**
 * Decode raw audio bytes, resample to the codec target via a real
 * OfflineAudioContext render (Web Audio is main-thread only), then condition the
 * signal (silence trim / duration clamp / peak normalize) and return a
 * channel-planar Float32Array suitable for the codec encoder.
 */
export async function preprocessMossReferenceAudio(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number,
  targetChannels: number,
  options?: Partial<MossReferencePreprocessOptions>,
): Promise<Float32Array> {
  const opts = { ...MOSS_REFERENCE_PREPROCESS_DEFAULTS, ...options }
  const AudioContextClass = typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null
  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this environment.')
  }

  // 1. Decode + resample using a real OfflineAudioContext render (browsers do NOT
  //    reliably honor the {sampleRate} constructor hint on AudioContext).
  const decodeCtx = new AudioContextClass()
  let renderedAudio: AudioBuffer
  try {
    const decodedAudio = await decodeCtx.decodeAudioData(arrayBuffer.slice(0))
    if (decodedAudio.sampleRate === targetSampleRate && decodedAudio.numberOfChannels === targetChannels) {
      renderedAudio = decodedAudio
    }
    else {
      const frameCount = Math.max(1, Math.ceil(decodedAudio.duration * targetSampleRate))
      const OfflineContextClass = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext
      if (!OfflineContextClass) {
        throw new Error('OfflineAudioContext is not supported in this environment.')
      }
      const offlineCtx = new OfflineContextClass(targetChannels, frameCount, targetSampleRate)
      const source = offlineCtx.createBufferSource()
      source.buffer = decodedAudio
      source.connect(offlineCtx.destination)
      source.start(0)
      renderedAudio = await offlineCtx.startRendering()
    }
  }
  finally {
    await decodeCtx.close().catch(() => {})
  }

  // 2. Pack channels into channel-planar layout expected by the codec encoder.
  const waveformLength = renderedAudio.length
  const planarWaveform = new Float32Array(targetChannels * waveformLength)
  for (let c = 0; c < targetChannels; c++) {
    const src = renderedAudio.getChannelData(Math.min(c, renderedAudio.numberOfChannels - 1))
    planarWaveform.set(src, c * waveformLength)
  }

  // 3. Signal conditioning (frame-domain, sample-rate & channel aware).
  return conditionMossPlanarWaveform(planarWaveform, waveformLength, targetChannels, targetSampleRate, opts)
}

/**
 * Trim silence, clamp duration, apply edge fades, and peak-normalize a
 * channel-planar reference waveform. All frame logic is computed on real samples
 * so the conditioning is correct regardless of target sample-rate.
 */
function conditionMossPlanarWaveform(
  planar: Float32Array,
  waveformLength: number,
  channels: number,
  sampleRate: number,
  opts: MossReferencePreprocessOptions,
): Float32Array {
  if (waveformLength === 0)
    return planar

  const frameMs = 25
  const frameSize = Math.max(1, Math.round(sampleRate * frameMs / 1000))
  const fadeSamples = Math.max(1, Math.round(sampleRate * opts.fadeMs / 1000))
  const paddingFrames = Math.max(0, Math.round(opts.paddingMs / frameMs))
  const minFrames = Math.max(1, Math.round(sampleRate * opts.minDurationMs / 1000 / frameSize))
  const maxFrames = Math.max(minFrames, Math.round(sampleRate * opts.maxDurationMs / 1000 / frameSize))

  const numFrames = Math.max(1, Math.floor(waveformLength / frameSize))
  const frameRmsDb = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    const frameStart = f * frameSize
    const frameEnd = Math.min(frameStart + frameSize, waveformLength)
    let sumSquares = 0
    let count = 0
    for (let c = 0; c < channels; c++) {
      const chBase = c * waveformLength
      for (let i = frameStart; i < frameEnd; i++) {
        const s = planar[chBase + i]
        sumSquares += s * s
        count++
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0
    frameRmsDb[f] = rms > 0 ? 20 * Math.log10(rms) : -Infinity
  }

  let firstActive = 0
  while (firstActive < numFrames && frameRmsDb[firstActive] < opts.silenceThresholdDb)
    firstActive++
  let lastActive = numFrames - 1
  while (lastActive >= 0 && frameRmsDb[lastActive] < opts.silenceThresholdDb)
    lastActive--

  if (firstActive >= numFrames || lastActive < firstActive) {
    return peakNormalizeMossPlanar(planar, channels, opts.targetPeakDb)
  }

  let startFrame = Math.max(0, firstActive - paddingFrames)
  let endFrame = Math.min(numFrames - 1, lastActive + paddingFrames)

  const activeFrames = endFrame - startFrame + 1
  if (activeFrames > maxFrames) {
    endFrame = Math.min(numFrames - 1, startFrame + maxFrames - 1)
  }
  else if (activeFrames < minFrames) {
    const deficit = minFrames - activeFrames
    startFrame = Math.max(0, startFrame - Math.floor(deficit / 2))
    endFrame = Math.min(numFrames - 1, startFrame + minFrames - 1)
  }

  const startSample = startFrame * frameSize
  const endSample = Math.min(waveformLength, (endFrame + 1) * frameSize)
  const trimmedLength = endSample - startSample

  const out = new Float32Array(channels * trimmedLength)
  for (let c = 0; c < channels; c++) {
    const srcBase = c * waveformLength
    out.set(planar.subarray(srcBase + startSample, srcBase + endSample), c * trimmedLength)
  }

  applyMossEdgeFadePlanar(out, trimmedLength, channels, fadeSamples)
  return peakNormalizeMossPlanar(out, channels, opts.targetPeakDb)
}

function peakNormalizeMossPlanar(planar: Float32Array, channels: number, targetPeakDb: number): Float32Array {
  let peak = 0
  for (let i = 0; i < planar.length; i++) {
    const a = Math.abs(planar[i])
    if (a > peak)
      peak = a
  }
  if (peak <= 0)
    return planar

  const targetPeak = 10 ** (targetPeakDb / 20)
  const gain = targetPeak / peak
  if (gain >= 0.98 && gain <= 1.02)
    return planar

  const out = new Float32Array(planar.length)
  for (let i = 0; i < planar.length; i++)
    out[i] = Math.max(-1, Math.min(1, planar[i] * gain))
  return out
}

function applyMossEdgeFadePlanar(planar: Float32Array, waveformLength: number, channels: number, fadeSamples: number): void {
  const fadeCount = Math.min(fadeSamples, Math.floor(waveformLength / 2))
  for (let c = 0; c < channels; c++) {
    const base = c * waveformLength
    for (let i = 0; i < fadeCount; i++) {
      const t = i / fadeCount
      planar[base + i] *= t
      planar[base + (waveformLength - 1 - i)] *= (1 - t)
    }
  }
}
