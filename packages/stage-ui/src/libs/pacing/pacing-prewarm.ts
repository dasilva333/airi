import type { ThinkingFillerPhrase } from '../../types/pacing'

import {
  createThinkingAudioFingerprintParams,
  getThinkingAudio,
  saveThinkingAudio,
} from './pacing-cache'

export interface PrewarmVoiceConfig {
  provider: string
  model: string
  voiceId: string
  pitch?: number
  rate?: number
  language?: string
}

export interface PrewarmProgressEvent {
  completed: number
  total: number
  currentText: string
  status: 'cached' | 'synthesizing' | 'success' | 'error'
  error?: string
}

/**
 * Checks whether a thinking audio clip is already present in localforage.
 */
export async function isThinkingAudioCached(
  voice: PrewarmVoiceConfig,
  text: string,
): Promise<boolean> {
  const params = createThinkingAudioFingerprintParams(voice, text)
  const result = await getThinkingAudio(params)
  return Boolean(result && result.audio && result.audio.byteLength > 0)
}

/**
 * Estimates or decodes the duration in milliseconds of an audio ArrayBuffer.
 */
export async function decodeOrEstimateAudioDurationMs(buffer: ArrayBuffer): Promise<number> {
  if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      const decoded = await ctx.decodeAudioData(buffer.slice(0))
      const durationMs = Math.round(decoded.duration * 1000)
      void ctx.close()
      return Math.max(200, durationMs)
    }
    catch {
      // Fallback to estimation if audio decoding is unsupported or failed
    }
  }

  // Fallback heuristic: assumes ~128kbps = 16kB/s
  const estimatedSec = buffer.byteLength / 16000
  return Math.min(3000, Math.max(500, Math.round(estimatedSec * 1000)))
}

/**
 * Pre-warms thinking fillers by checking the cache and synthesizing missing phrases.
 */
export async function prewarmThinkingFillers(options: {
  phrases: ThinkingFillerPhrase[]
  voice: PrewarmVoiceConfig
  synthesize: (text: string) => Promise<ArrayBuffer>
  onProgress?: (event: PrewarmProgressEvent) => void
  signal?: AbortSignal
}): Promise<{ succeeded: number, cached: number, failed: number, errors: string[] }> {
  const { phrases, voice, synthesize, onProgress, signal } = options

  const enabledPhrases = phrases.filter(p => p.enabled && p.text.trim())
  const total = enabledPhrases.length
  let completed = 0
  let succeeded = 0
  let cached = 0
  let failed = 0
  const errors: string[] = []

  for (const phrase of enabledPhrases) {
    if (signal?.aborted) {
      break
    }

    const text = phrase.text.trim()
    const params = createThinkingAudioFingerprintParams(voice, text)

    try {
      // 1. Check if already cached
      const existing = await getThinkingAudio(params)
      if (existing && existing.audio && existing.audio.byteLength > 0) {
        completed++
        cached++
        onProgress?.({
          completed,
          total,
          currentText: text,
          status: 'cached',
        })
        continue
      }

      // 2. Synthesize missing phrase
      onProgress?.({
        completed,
        total,
        currentText: text,
        status: 'synthesizing',
      })

      const buffer = await synthesize(text)
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('TTS returned empty audio buffer')
      }

      const durationMs = await decodeOrEstimateAudioDurationMs(buffer)
      await saveThinkingAudio(params, buffer, durationMs)

      completed++
      succeeded++
      onProgress?.({
        completed,
        total,
        currentText: text,
        status: 'success',
      })
    }
    catch (err) {
      completed++
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`"${text}": ${msg}`)
      onProgress?.({
        completed,
        total,
        currentText: text,
        status: 'error',
        error: msg,
      })
    }
  }

  return { succeeded, cached, failed, errors }
}
