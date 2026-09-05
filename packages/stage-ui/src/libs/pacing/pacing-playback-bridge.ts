import type { PlaybackItem } from '@proj-airi/pipelines-audio'

import type { Clock, PacingPlaybackMeta, ThinkingCategory } from '../../types/pacing'
import type { ThinkingAudioFingerprintParams } from './pacing-cache'
import type { TurnPacingCoordinator } from './turn-pacing-coordinator'

import { getThinkingAudio } from './pacing-cache'

export interface PacingPlaybackScheduler<TAudio> {
  schedule: (item: PlaybackItem<TAudio>) => void
  stopByIntent?: (intentId: string, reason: string) => void
  stopAll?: (reason: string) => void
  getCurrentTime?: () => number
}

export interface PacingPlaybackBridgeOptions<TAudio> {
  coordinator: TurnPacingCoordinator
  playback: PacingPlaybackScheduler<TAudio>
  voiceParams: ThinkingAudioFingerprintParams
  decodeAudio?: (buffer: ArrayBuffer) => Promise<TAudio>
  clock?: Clock
  getIntentContext?: () => { intentId?: string, streamId?: string }
}

export interface ThinkingFillerCandidate {
  category: ThinkingCategory
  text: string
  enabled: boolean
}

/**
 * Deterministically resolves the best matching enabled filler phrase for a detected category.
 * Priority: Exact category match -> 'generic' fallback -> Any enabled filler.
 */
export function resolveFillerCandidate(
  fillers: ThinkingFillerCandidate[],
  category: ThinkingCategory,
  usedPhrases?: Set<string>,
): string | null {
  const enabled = fillers.filter(f => f.enabled && f.text?.trim())
  if (enabled.length === 0)
    return null

  // Filter out phrases already spoken in this turn, enforcing strict deduplication
  const pool = usedPhrases && usedPhrases.size > 0
    ? enabled.filter(f => !usedPhrases.has(f.text.trim()))
    : enabled

  if (pool.length === 0)
    return null

  // 1. Direct match for category
  const matches = pool.filter(f => f.category === category)
  if (matches.length > 0) {
    const picked = matches[Math.floor(Math.random() * matches.length)]
    return picked.text.trim()
  }

  // 2. Fallback to generic
  const generics = pool.filter(f => f.category === 'generic')
  if (generics.length > 0) {
    const picked = generics[Math.floor(Math.random() * generics.length)]
    return picked.text.trim()
  }

  // 3. Fallback to any enabled filler in pool
  const picked = pool[Math.floor(Math.random() * pool.length)]
  return picked.text.trim()
}

export class PacingPlaybackBridge<TAudio = AudioBuffer> {
  private coordinator: TurnPacingCoordinator
  private playback: PacingPlaybackScheduler<TAudio>
  private voiceParams: ThinkingAudioFingerprintParams
  private decodeAudio?: (buffer: ArrayBuffer) => Promise<TAudio>
  private clock: Clock

  private getIntentContext?: () => { intentId?: string, streamId?: string }

  public fillerScheduledEndTime: number = 0
  public activeFillerItemId: string | null = null
  public usedPhrases: Set<string> = new Set()

  constructor(options: PacingPlaybackBridgeOptions<TAudio>) {
    this.coordinator = options.coordinator
    this.playback = options.playback
    this.voiceParams = options.voiceParams
    this.decodeAudio = options.decodeAudio
    this.getIntentContext = options.getIntentContext
    this.clock = options.clock ?? {
      now: () => Date.now(),
      setTimeout: (fn, delay) => setTimeout(fn, delay),
      clearTimeout: id => clearTimeout(id),
    }
  }

  /**
   * Invoked when the coordinator transitions to FILLER_ARMED.
   * Attempts instant cache retrieval. On hit, decodes and schedules the filler.
   * On miss, instantly notifies the coordinator to degrade cleanly to normal answer speech.
   */
  public async handleFillerArmed(category: ThinkingCategory = 'generic', customText?: string): Promise<boolean> {
    const phraseText = customText || this.voiceParams.text || category
    const cached = await getThinkingAudio({
      ...this.voiceParams,
      text: phraseText,
    })

    if (!cached) {
      this.coordinator.notifyCacheMiss()
      return false
    }

    const now = this.clock.now()
    const itemId = `pacing-filler-${this.coordinator.turnId}-${now}`
    this.activeFillerItemId = itemId

    let audioData: TAudio
    if (this.decodeAudio) {
      try {
        audioData = await this.decodeAudio(cached.audio)
      }
      catch {
        this.coordinator.notifyCacheMiss()
        return false
      }
    }
    else {
      audioData = cached.audio as unknown as TAudio
    }

    // Check if turn was settled or answer arrived while decoding
    if (this.coordinator.state !== 'FILLER_ARMED') {
      return false
    }

    const durationSec = (cached.durationMs || 1500) / 1000
    const currentTimeSec = this.playback.getCurrentTime ? this.playback.getCurrentTime() : now / 1000
    this.fillerScheduledEndTime = currentTimeSec + durationSec

    const meta: PacingPlaybackMeta = {
      turnId: this.coordinator.turnId,
      role: 'thinking-filler',
      generation: this.coordinator.generation,
    }

    const intentCtx = this.getIntentContext?.()
    const item: PlaybackItem<TAudio> & { meta?: PacingPlaybackMeta } = {
      id: itemId,
      streamId: intentCtx?.streamId || `stream-${this.coordinator.turnId}`,
      intentId: intentCtx?.intentId || `intent-${this.coordinator.turnId}`,
      segmentId: `segment-filler-${this.coordinator.turnId}`,
      priority: 10,
      text: phraseText,
      special: null,
      audio: audioData,
      createdAt: now,
      meta,
    }

    this.usedPhrases.add(phraseText)
    this.coordinator.notifyFillerAudioStarted(now)
    this.playback.schedule(item)
    return true
  }

  /**
   * Invoked when filler audio actually begins playback.
   */
  public handleFillerStarted(at: number = this.clock.now()): void {
    if (this.coordinator.state === 'FILLER_ARMED') {
      this.coordinator.notifyFillerAudioStarted(at)
    }
  }

  /**
   * Schedules or sequences the primary LLM answer audio.
   * If a filler is actively playing, enforces the zero-gap handoff invariant.
   * If a filler was armed but not yet playing, cancels the filler and schedules answer immediately.
   */
  public scheduleAnswerAudio(answerItem: PlaybackItem<TAudio>): void {
    const now = this.clock.now()
    this.coordinator.notifyAnswerAudioScheduled(now)

    // Preempt armed filler if it hasn't started playing yet
    if (this.activeFillerItemId && this.coordinator.state === 'ANSWER_READY') {
      this.activeFillerItemId = null
    }

    this.playback.schedule(answerItem)
  }

  /**
   * Handles filler playback conclusion, transitioning the coordinator into HANDOFF.
   */
  public handleFillerEnded(): void {
    const now = this.clock.now()
    this.activeFillerItemId = null
    this.coordinator.notifyFillerAudioEnded(now)
  }

  /**
   * Cancels any active filler playback on barge-in or turn cancellation.
   */
  public cancel(reason: string): void {
    this.coordinator.cancel(reason)
    this.usedPhrases.clear()
    if (this.activeFillerItemId && this.playback.stopByIntent) {
      this.playback.stopByIntent(`intent-${this.coordinator.turnId}`, reason)
      this.activeFillerItemId = null
    }
  }
}
