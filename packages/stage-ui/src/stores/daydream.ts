import type { SubconsciousBeat } from '../libs/inference/adapters/needle-client'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SubconsciousVibe = 'affectionate' | 'flustered' | 'playful' | 'tense' | 'melancholy' | 'routine'

export interface DaydreamChip {
  id: string
  characterId: string
  universeId?: string
  sessionId?: string
  text: string
  type: 'flavor' | 'mood' | 'milestone'
  salienceScore: number
  turnNumber: number
  createdAt: number
}

export const useDaydreamStore = defineStore('daydream', () => {
  const activeVibe = ref<SubconsciousVibe>('routine')
  const latestInnerThought = ref<string | null>(null)
  const chips = ref<DaydreamChip[]>([])
  const turnCounter = ref(0)
  const lastPromotedTurn = ref(-999)

  const MAX_ACTIVE_CHIPS = 12

  /**
   * Word token overlap similarity (0.0 to 1.0).
   */
  function computeSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
    if (!wordsA.size || !wordsB.size)
      return 0

    let intersection = 0
    for (const w of wordsA) {
      if (wordsB.has(w))
        intersection++
    }
    return (2 * intersection) / (wordsA.size + wordsB.size)
  }

  /**
   * Cadence Governor: Ingests a subconscious beat and determines whether to promote its daydream chip.
   * Enforces:
   * 1. Salience score threshold: score >= 0.72
   * 2. Deduplication & Semantic distance: similarity > 0.60 suppresses redundant chip
   * 3. Cadence pacer: max 1 chip per turn; avg 1 chip every 2–3 turns (unless score >= 0.92)
   * 4. Sliding window: capped at MAX_ACTIVE_CHIPS
   */
  function recordBeat(
    beat: SubconsciousBeat,
    characterId: string,
    universeId?: string,
    sessionId?: string,
  ): DaydreamChip | null {
    turnCounter.value++
    const currentTurn = turnCounter.value

    if (beat.vibe) {
      activeVibe.value = beat.vibe
    }
    if (beat.inner_thought) {
      latestInnerThought.value = beat.inner_thought
    }

    if (!beat.daydream_chip || !beat.daydream_chip.text) {
      return null
    }

    const { text, type = 'flavor', salience_score: salienceScore = 0 } = beat.daydream_chip

    // 1. Salience Score Threshold
    if (salienceScore < 0.72) {
      return null
    }

    // 2. Deduplication & Semantic Distance against recent chips
    const recent = chips.value.slice(-10)
    for (const existing of recent) {
      if (computeSimilarity(existing.text, text) > 0.60) {
        existing.createdAt = Date.now()
        existing.salienceScore = Math.max(existing.salienceScore, salienceScore)
        return null
      }
    }

    // 3. Cadence Pacer: Breakthrough milestone exception (>=0.92) or turn gap >= 2
    const isBreakthrough = salienceScore >= 0.92
    const turnsSinceLast = currentTurn - lastPromotedTurn.value

    if (!isBreakthrough && turnsSinceLast < 2) {
      return null
    }

    // Promoted!
    lastPromotedTurn.value = currentTurn
    const newChip: DaydreamChip = {
      id: `daydream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      characterId,
      universeId,
      sessionId,
      text: text.trim(),
      type,
      salienceScore,
      turnNumber: currentTurn,
      createdAt: Date.now(),
    }

    chips.value.push(newChip)
    if (chips.value.length > MAX_ACTIVE_CHIPS) {
      chips.value.shift()
    }

    return newChip
  }

  function getSessionChips(characterId: string, universeId?: string, sessionId?: string): DaydreamChip[] {
    return chips.value.filter(c =>
      c.characterId === characterId
      && (!universeId || c.universeId === universeId || !c.universeId)
      && (!sessionId || c.sessionId === sessionId || !c.sessionId),
    )
  }

  function clear(): void {
    chips.value = []
    activeVibe.value = 'routine'
    latestInnerThought.value = null
    turnCounter.value = 0
    lastPromotedTurn.value = -999
  }

  return {
    activeVibe,
    latestInnerThought,
    chips,
    turnCounter,
    lastPromotedTurn,
    recordBeat,
    getSessionChips,
    clear,
  }
})
