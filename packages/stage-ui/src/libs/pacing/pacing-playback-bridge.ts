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
}

export class PacingPlaybackBridge<TAudio = AudioBuffer> {
  private coordinator: TurnPacingCoordinator
  private playback: PacingPlaybackScheduler<TAudio>
  private voiceParams: ThinkingAudioFingerprintParams
  private decodeAudio?: (buffer: ArrayBuffer) => Promise<TAudio>
  private clock: Clock

  public fillerScheduledEndTime: number = 0
  public activeFillerItemId: string | null = null

  constructor(options: PacingPlaybackBridgeOptions<TAudio>) {
    this.coordinator = options.coordinator
    this.playback = options.playback
    this.voiceParams = options.voiceParams
    this.decodeAudio = options.decodeAudio
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
  public async handleFillerArmed(category: ThinkingCategory = 'generic'): Promise<boolean> {
    const cached = await getThinkingAudio({
      ...this.voiceParams,
      // Use category or custom text as needed
      text: this.voiceParams.text || category,
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

    const item: PlaybackItem<TAudio> & { meta?: PacingPlaybackMeta } = {
      id: itemId,
      streamId: `stream-${this.coordinator.turnId}`,
      intentId: `intent-${this.coordinator.turnId}`,
      segmentId: `segment-filler-${this.coordinator.turnId}`,
      priority: 10,
      text: this.voiceParams.text || category,
      special: null,
      audio: audioData,
      createdAt: now,
      meta,
    }

    this.coordinator.notifyFillerAudioStarted(now)
    this.playback.schedule(item)
    return true
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
    if (this.activeFillerItemId && this.playback.stopByIntent) {
      this.playback.stopByIntent(`intent-${this.coordinator.turnId}`, reason)
      this.activeFillerItemId = null
    }
  }
}
