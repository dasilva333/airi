import type { UseQueueReturn } from '@proj-airi/stream-kit'

import type { Emotion, EmotionPayload } from '../constants/emotions'

import { sleep } from '@moeru/std'
import { debug } from '@proj-airi/stage-shared'
import { createQueue } from '@proj-airi/stream-kit'

import { EMOTION_VALUES } from '../constants/emotions'
import { useAiriCardStore } from '../stores/modules/airi-card'

export function useSpecialTokenQueue(emotionsQueue: UseQueueReturn<EmotionPayload>) {
  const normalizeEmotionName = (value: string): Emotion | string => {
    const trimmed = value.trim()
    const lower = trimmed.toLowerCase()
    // If it matches a known emotion enum value, return the standard key
    if (EMOTION_VALUES.includes(lower as Emotion))
      return lower as Emotion
    // Otherwise return the original casing (needed for VRMA filenames)
    return trimmed
  }

  const normalizeIntensity = (value: unknown): number => {
    if (typeof value !== 'number' || Number.isNaN(value))
      return 1
    return Math.min(1, Math.max(0, value))
  }

  function extractEmotions(payload: any): EmotionPayload[] {
    const results: EmotionPayload[] = []

    // 1. Emotion object or string
    if (payload?.emotion && typeof payload.emotion === 'object' && !Array.isArray(payload.emotion)) {
      if (typeof payload.emotion.name === 'string') {
        const normalized = normalizeEmotionName(payload.emotion.name)
        if (normalized) {
          const intensity = normalizeIntensity(payload.emotion.intensity)
          results.push({ name: normalized, intensity })
        }
      }
    }
    else if (typeof payload?.emotion === 'string') {
      const normalized = normalizeEmotionName(payload.emotion)
      if (normalized) {
        results.push({ name: normalized, intensity: 1 })
      }
    }

    // 2. Motion string
    if (typeof payload?.motion === 'string') {
      const normalized = normalizeEmotionName(payload.motion)
      if (normalized && !results.some(r => r.name === normalized)) {
        results.push({ name: normalized, intensity: 1 })
      }
    }

    return results
  }

  function parseActEmotion(content: string) {
    const match = /<\|ACT\s*(?::\s*)?([\s\S]*?)(?:\|>|>)/i.exec(content)
    if (!match)
      return { ok: false, emotions: [] as EmotionPayload[] }

    const payloadText = match[1].trim()
    let emotions: EmotionPayload[] = []

    // Attempt 1: Strict JSON parse
    try {
      const payload = JSON.parse(payloadText)
      emotions = extractEmotions(payload)
    }
    catch {
      // Attempt 2: Try wrapping in braces if missing
      if (!payloadText.startsWith('{')) {
        try {
          const wrapped = JSON.parse(`{${payloadText}}`)
          emotions = extractEmotions(wrapped)
        }
        catch { /* continue to fallback */ }
      }
    }

    // Attempt 3: Regex fallback for raw key-value pairs
    if (emotions.length === 0) {
      const emotionMatch = /"?(?:emotion|motion)"?\s*[:=]\s*(?:\{?[\s\S]*?"name"\s*[:=]\s*)?(?:"([^"]+)"|'([^']+)'|([^"}\s,]+))/gi
      let m
      while ((m = emotionMatch.exec(payloadText)) !== null) {
        const name = m[1] || m[2] || m[3]
        const normalized = normalizeEmotionName(name)
        if (normalized && !emotions.some(e => e.name === normalized)) {
          const intensityMatch = /"?intensity"?\s*[:=]\s*([\d.]+)/i.exec(payloadText)
          const intensity = intensityMatch ? normalizeIntensity(Number.parseFloat(intensityMatch[1])) : 1
          emotions.push({ name: normalized, intensity })
        }
      }
    }

    return { ok: emotions.length > 0, emotions }
  }

  return createQueue<string>({
    handlers: [
      async (ctx) => {
        // 1. Check for Delay
        const delayMs = parseDelay(ctx.data)
        if (delayMs !== null) {
          ctx.emit('delay', delayMs)
          await sleep(delayMs)
          return
        }

        // 2. Check for Emotion/Motion
        const actParsed = parseActEmotion(ctx.data)
        if (actParsed.ok) {
          for (const emotion of actParsed.emotions) {
            debug('[Queue] Dispatching ACT payload:', emotion)
            ctx.emit('emotion', emotion)
            emotionsQueue.enqueue(emotion)
          }
        }

        // 3. Check for Actor/Concept swap
        const actorId = parseActor(ctx.data)
        if (actorId) {
          debug('[Queue] Dispatching ACTOR swap:', actorId)
          ctx.emit('actor', actorId)
        }
      },
    ],
  })
}

export function normalizeDelayMs(rawDelay: number): number {
  if (Number.isNaN(rawDelay) || rawDelay <= 0)
    return 0

  let ms: number
  // If >= 50, caller passed milliseconds (e.g. 800, 1000, 2500)
  if (rawDelay >= 50) {
    ms = rawDelay
  }
  // Otherwise, caller passed seconds / decimals (e.g. 0.5, 1, 2.5, 3)
  else {
    ms = rawDelay * 1000
  }

  // Safety ceiling: Cap any single pause at 10 seconds max so runaway values never freeze the queue
  return Math.min(ms, 10000)
}

export function parseDelay(content: string) {
  const match = /<\|DELAY:\s*([\d.]+)\s*(?:\|>|>)/i.exec(content)
  if (!match)
    return null
  const delay = Number.parseFloat(match[1])
  return normalizeDelayMs(delay)
}

export function parseActor(content: string) {
  const match = /<\|ACTOR:\s*([\w-]+)\s*(?:\|>|>)/i.exec(content)
  if (!match)
    return null
  return match[1].trim()
}

const actorColors = new Map<string, string>()

export function getActorColor(id: string): string {
  try {
    const cardStore = useAiriCardStore()
    const activeCard = cardStore.activeCard
    const assets = activeCard?.extensions?.airi?.visual_assets
    if (assets && assets[id]?.textColor) {
      return assets[id].textColor
    }
  }
  catch (e) {
    // Pinia not initialized
  }

  if (!actorColors.has(id)) {
    // Generate a stable, vibrant HSL color from the actor ID
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }

    const h = Math.abs(hash) % 360
    // We lock saturation and lightness into high ranges (90-100% sat, 70-80% light)
    // This ensures the text is always bright, punchy, and readable against dark backgrounds.
    const s = 90 + (Math.abs(hash >> 8) % 10)
    const l = 70 + (Math.abs(hash >> 16) % 10)

    const color = `hsl(${h}, ${s}%, ${l}%)`
    actorColors.set(id, color)
  }
  return actorColors.get(id)!
}
