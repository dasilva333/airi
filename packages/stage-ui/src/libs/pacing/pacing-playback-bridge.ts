import type { PlaybackItem } from '@proj-airi/pipelines-audio'

import type { AsideCandidate, Clock, PacingPlaybackMeta, ThinkingCategory } from '../../types/pacing'
import type { ThinkingAudioFingerprintParams } from './pacing-cache'
import type { TurnPacingCoordinator } from './turn-pacing-coordinator'

import { getThinkingAudio, saveThinkingAudio } from './pacing-cache'

export interface PacingCommitReceipt {
  accepted: boolean
  itemId?: string
  scheduledStartSec?: number
  scheduledEndSec?: number
  reason?: string
}

export interface PacingPlaybackScheduler<TAudio> {
  schedule: (item: PlaybackItem<TAudio>) => void
  tryCommitFiller?: (item: PlaybackItem<TAudio>, maxAdmissionLeadMs?: number) => PacingCommitReceipt
  stopByIntent?: (intentId: string, reason: string) => void
  stopAll?: (reason: string) => void
  getCurrentTime?: () => number
}

export interface PacingPlaybackBridgeOptions<TAudio> {
  coordinator: TurnPacingCoordinator
  playback: PacingPlaybackScheduler<TAudio>
  voiceParams: ThinkingAudioFingerprintParams
  decodeAudio?: (buffer: ArrayBuffer) => Promise<TAudio>
  synthesizeAudio?: (text: string, signal: AbortSignal) => Promise<ArrayBuffer>
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
  private synthesizeAudio?: (text: string, signal: AbortSignal) => Promise<ArrayBuffer>
  private clock: Clock
  private activeAbortController: AbortController | null = null

  private getIntentContext?: () => { intentId?: string, streamId?: string }

  public fillerScheduledEndTime: number = 0
  public activeFillerItemId: string | null = null
  public usedPhrases: Set<string> = new Set()

  constructor(options: PacingPlaybackBridgeOptions<TAudio>) {
    this.coordinator = options.coordinator
    this.playback = options.playback
    this.voiceParams = options.voiceParams
    this.decodeAudio = options.decodeAudio
    this.synthesizeAudio = options.synthesizeAudio
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
    let cached = await getThinkingAudio({
      ...this.voiceParams,
      text: phraseText,
    })

    if (!cached && this.synthesizeAudio) {
      // Dynamic fallback synthesis for uncached filler phrases
      const abortController = new AbortController()
      this.activeAbortController = abortController
      const budgetMs = this.coordinator.policy.maxSynthesisBudgetMs ?? 800
      let timerHandle: any = null

      try {
        const synthesisPromise = this.synthesizeAudio(phraseText, abortController.signal)
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerHandle = this.clock.setTimeout(() => {
            reject(new Error(`Filler synthesis timed out after ${budgetMs}ms`))
          }, budgetMs)
        })

        const rawBuffer = await Promise.race([synthesisPromise, timeoutPromise])
        if (rawBuffer && rawBuffer.byteLength > 0) {
          let durationSec = 1.5
          if (this.decodeAudio) {
            try {
              const decoded = await this.decodeAudio(rawBuffer)
              if (decoded && typeof (decoded as any).duration === 'number') {
                durationSec = (decoded as any).duration
              }
            }
            catch {
              // Ignore decode measurement failure, use default duration
            }
          }
          const durationMs = durationSec * 1000
          cached = {
            audio: rawBuffer,
            durationMs,
          }
          // Asynchronously persist to cache so subsequent turns are instant hits
          void saveThinkingAudio({ ...this.voiceParams, text: phraseText }, rawBuffer, durationMs).catch(() => {})
        }
      }
      catch {
        abortController.abort()
      }
      finally {
        if (timerHandle) {
          this.clock.clearTimeout(timerHandle)
        }
        if (this.activeAbortController === abortController) {
          this.activeAbortController = null
        }
      }
    }

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
    if (this.coordinator.state !== 'FILLER_ARMED' || this.coordinator.metrics.cutoffReason) {
      return false
    }

    let durationSec = (cached.durationMs || 1500) / 1000
    if (audioData && typeof (audioData as any).duration === 'number') {
      durationSec = (audioData as any).duration
    }
    const durationMs = durationSec * 1000
    const maxDurationMs = this.coordinator.policy.maxFillerDurationMs ?? 2200

    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationMs > maxDurationMs) {
      this.coordinator.notifyCacheMiss()
      return false
    }

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

    if (this.playback.tryCommitFiller) {
      const receipt = this.playback.tryCommitFiller(item, 100)
      if (!receipt.accepted) {
        this.activeFillerItemId = null
        this.coordinator.notifyCacheMiss()
        return false
      }
      if (receipt.scheduledEndSec) {
        this.fillerScheduledEndTime = receipt.scheduledEndSec
      }
    }
    else {
      this.playback.schedule(item)
    }

    this.usedPhrases.add(phraseText)
    this.coordinator.notifyFillerAudioStarted(now)
    return true
  }

  /**
   * Invoked when the coordinator transitions to FILLER_ARMED with a dynamic candidate.
   * Runs complete-clip synthesis with AbortController and maxSynthesisBudgetMs,
   * validates decoded duration, and commits atomically to playback.
   */
  public async handleDynamicAsideArmed(candidate: AsideCandidate): Promise<boolean> {
    if (this.coordinator.state !== 'FILLER_ARMED' || this.coordinator.metrics.cutoffReason) {
      return false
    }

    const now = this.clock.now()
    if (now >= candidate.expiresAtMs) {
      this.coordinator.notifyCacheMiss()
      return false
    }

    if (!this.synthesizeAudio) {
      this.coordinator.notifyCacheMiss()
      return false
    }

    const budgetMs = this.coordinator.policy.maxSynthesisBudgetMs ?? 600
    const abortController = new AbortController()
    this.activeAbortController = abortController
    const startSynthesizeAt = this.clock.now()

    let rawBuffer: ArrayBuffer
    let timerHandle: any = null

    try {
      const synthesisPromise = this.synthesizeAudio(candidate.text, abortController.signal)
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerHandle = this.clock.setTimeout(() => {
          abortController.abort(new Error('Synthesis timeout'))
          reject(new Error('Synthesis timeout'))
        }, budgetMs)
      })

      rawBuffer = await Promise.race([synthesisPromise, timeoutPromise])
    }
    catch {
      abortController.abort()
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null
      }
      this.coordinator.notifyCacheMiss()
      return false
    }
    finally {
      if (timerHandle) {
        this.clock.clearTimeout(timerHandle)
      }
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null
      }
    }

    // Post-synthesis validity checks
    if (this.coordinator.state !== 'FILLER_ARMED' || this.coordinator.metrics.cutoffReason) {
      return false
    }

    if (this.clock.now() >= candidate.expiresAtMs) {
      this.coordinator.notifyCacheMiss()
      return false
    }

    if (!rawBuffer || rawBuffer.byteLength === 0) {
      this.coordinator.notifyCacheMiss()
      return false
    }

    let audioData: TAudio
    if (this.decodeAudio) {
      try {
        audioData = await this.decodeAudio(rawBuffer)
      }
      catch {
        this.coordinator.notifyCacheMiss()
        return false
      }
    }
    else {
      audioData = rawBuffer as unknown as TAudio
    }

    // Re-check after async decode
    if (this.coordinator.state !== 'FILLER_ARMED' || this.coordinator.metrics.cutoffReason) {
      return false
    }

    // Complete-clip duration & sanity validation
    let durationSec = 1.5
    if (audioData && typeof (audioData as any).duration === 'number') {
      durationSec = (audioData as any).duration
    }

    const durationMs = durationSec * 1000
    const maxDurationMs = this.coordinator.policy.maxFillerDurationMs ?? 2200

    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationMs > maxDurationMs) {
      // Non-finite, zero, or overlong clip rejected per spec §8.2
      this.coordinator.notifyCacheMiss()
      return false
    }

    this.coordinator.metrics.prepareLatencyMs = this.clock.now() - startSynthesizeAt

    const itemId = `pacing-aside-${this.coordinator.turnId}-${candidate.cueId}-${this.clock.now()}`
    this.activeFillerItemId = itemId

    const currentTimeSec = this.playback.getCurrentTime ? this.playback.getCurrentTime() : this.clock.now() / 1000
    this.fillerScheduledEndTime = currentTimeSec + durationSec

    const meta: PacingPlaybackMeta = {
      turnId: this.coordinator.turnId,
      role: 'thinking-filler',
      generation: this.coordinator.generation,
      attemptId: candidate.cueId,
    }

    const intentCtx = this.getIntentContext?.()
    const item: PlaybackItem<TAudio> & { meta?: PacingPlaybackMeta } = {
      id: itemId,
      streamId: intentCtx?.streamId || `stream-${this.coordinator.turnId}`,
      intentId: intentCtx?.intentId || `intent-${this.coordinator.turnId}`,
      segmentId: `segment-aside-${this.coordinator.turnId}`,
      priority: 10,
      text: candidate.text,
      special: null,
      audio: audioData,
      createdAt: this.clock.now(),
      meta,
    }

    // Atomic admission
    if (this.playback.tryCommitFiller) {
      const receipt = this.playback.tryCommitFiller(item, 100)
      if (!receipt.accepted) {
        this.activeFillerItemId = null
        this.coordinator.notifyCacheMiss()
        return false
      }
      if (receipt.scheduledEndSec) {
        this.fillerScheduledEndTime = receipt.scheduledEndSec
      }
    }
    else {
      this.playback.schedule(item)
    }

    this.usedPhrases.add(candidate.text.trim())
    this.coordinator.notifyFillerAudioStarted(this.clock.now())
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
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.activeAbortController = null
    }
    this.coordinator.cancel(reason)
    this.usedPhrases.clear()
    if (this.activeFillerItemId && this.playback.stopByIntent) {
      this.playback.stopByIntent(`intent-${this.coordinator.turnId}`, reason)
      this.activeFillerItemId = null
    }
  }
}
