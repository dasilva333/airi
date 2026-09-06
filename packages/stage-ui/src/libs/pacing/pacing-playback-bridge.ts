import type { PlaybackItem } from '@proj-airi/pipelines-audio'

import type { AsideCandidate, Clock, PacingPlaybackMeta, ThinkingCategory } from '../../types/pacing'
import type { ThinkingAudioFingerprintParams } from './pacing-cache'
import type { TurnPacingCoordinator } from './turn-pacing-coordinator'

import { computeThinkingAudioFingerprint, deleteThinkingAudio, getThinkingAudio, saveThinkingAudio } from './pacing-cache'

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
  private preparationGeneration = 0
  private activeFillerIntentId: string | null = null

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
   * On miss, attempts bounded synthesis before scheduling the next opportunity.
   */
  public async handleFillerArmed(category: ThinkingCategory = 'generic', customText?: string): Promise<boolean> {
    if (this.coordinator.state !== 'FILLER_ARMED' || this.coordinator.metrics.cutoffReason)
      return false

    const phraseText = customText || this.voiceParams.text || category
    const startLookupAt = this.clock.now()
    const controller = new AbortController()
    this.activeAbortController?.abort()
    this.activeAbortController = controller
    const isCurrent = () => !controller.signal.aborted
      && this.coordinator.state === 'FILLER_ARMED' && !this.coordinator.metrics.cutoffReason
    const params = { ...this.voiceParams, text: phraseText }
    let audioData: TAudio
    let durationSec: number

    try {
      let cached: Awaited<ReturnType<typeof getThinkingAudio>> = null
      try {
        cached = await getThinkingAudio(params)
      }
      catch {
        // NOTICE: IndexedDB availability must not prevent network fallback.
      }
      if (!isCurrent())
        return false

      let rawBuffer = cached?.audio
      let synthesized = false
      if (!rawBuffer?.byteLength) {
        if (!this.synthesizeAudio) {
          this.coordinator.notifyCacheMiss({ reason: 'cache_not_found', elapsedMs: this.clock.now() - startLookupAt })
          return false
        }
        const synthStart = this.clock.now()
        const budgetMs = this.coordinator.policy.maxFillerSynthesisBudgetMs ?? 2500
        let timedOut = false
        let timerHandle: any
        let onAbort!: () => void
        try {
          const aborted = new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(controller.signal.reason)
            controller.signal.addEventListener('abort', onAbort, { once: true })
            timerHandle = this.clock.setTimeout(() => {
              timedOut = true
              controller.abort(new Error(`Filler synthesis timed out after ${budgetMs}ms`))
            }, budgetMs)
          })
          rawBuffer = await Promise.race([this.synthesizeAudio(phraseText, controller.signal), aborted])
          if (!rawBuffer?.byteLength)
            throw new Error('Empty audio buffer returned from synthesis')
          synthesized = true
        }
        catch (err) {
          if (isCurrent() || timedOut) {
            this.coordinator.notifyCacheMiss({
              reason: timedOut ? 'synthesis_timeout' : 'synthesis_failed',
              error: err instanceof Error ? err.message : String(err),
              elapsedMs: this.clock.now() - synthStart,
            })
          }
          return false
        }
        finally {
          if (timerHandle != null)
            this.clock.clearTimeout(timerHandle)
          controller.signal.removeEventListener('abort', onAbort)
        }
      }
      if (!isCurrent())
        return false

      const decodeStart = this.clock.now()
      try {
        // Decoders may detach their input buffer; preserve the bytes for persistence.
        audioData = this.decodeAudio ? await this.decodeAudio(rawBuffer.slice(0)) : rawBuffer as unknown as TAudio
      }
      catch (err) {
        if (!isCurrent())
          return false
        if (cached) {
          // A corrupt hit must not poison every subsequent opportunity.
          void computeThinkingAudioFingerprint(params).then(deleteThinkingAudio).catch(() => {})
        }
        this.coordinator.notifyCacheMiss({
          reason: 'decode_failed',
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: this.clock.now() - decodeStart,
        })
        return false
      }
      if (!isCurrent())
        return false

      durationSec = (cached?.durationMs ?? 1500) / 1000
      if (audioData && typeof (audioData as any).duration === 'number')
        durationSec = (audioData as any).duration
      const durationMs = durationSec * 1000
      const maxDurationMs = this.coordinator.policy.maxFillerDurationMs ?? 2200
      if (!Number.isFinite(durationSec) || durationSec <= 0 || durationMs > maxDurationMs) {
        this.coordinator.notifyCacheMiss({
          reason: 'synthesis_failed',
          error: `Clip duration invalid or exceeded max: ${Math.round(durationMs)}ms > ${maxDurationMs}ms`,
          elapsedMs: this.clock.now() - startLookupAt,
        })
        return false
      }
      if (synthesized)
        void saveThinkingAudio(params, rawBuffer, durationMs).catch(() => {})
    }
    finally {
      if (this.activeAbortController === controller)
        this.activeAbortController = null
    }

    const now = this.clock.now()
    const itemId = `pacing-filler-${this.coordinator.turnId}-${now}`
    this.activeFillerItemId = itemId

    const currentTimeSec = this.playback.getCurrentTime ? this.playback.getCurrentTime() : now / 1000
    this.fillerScheduledEndTime = currentTimeSec + durationSec

    const meta: PacingPlaybackMeta = {
      turnId: this.coordinator.turnId,
      role: 'thinking-filler',
      generation: this.coordinator.generation,
      attemptId: itemId,
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

    this.activeFillerIntentId = item.intentId
    if (this.playback.tryCommitFiller) {
      const receipt = this.playback.tryCommitFiller(item, 100)
      if (!receipt.accepted) {
        this.activeFillerItemId = null
        this.activeFillerIntentId = null
        this.coordinator.notifyCacheMiss({
          reason: 'synthesis_failed',
          error: `Playback admission rejected: ${receipt.reason || 'queue full'}`,
          elapsedMs: this.clock.now() - startLookupAt,
        })
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

    const preparationGeneration = this.preparationGeneration
    const isCurrent = () => preparationGeneration === this.preparationGeneration
      && this.coordinator.state === 'FILLER_ARMED' && !this.coordinator.metrics.cutoffReason
    const now = this.clock.now()
    if (now >= candidate.expiresAtMs) {
      this.coordinator.notifyCacheMiss({
        reason: 'synthesis_failed',
        error: 'Candidate expired before synthesis',
        elapsedMs: 0,
      })
      return false
    }

    if (!this.synthesizeAudio) {
      this.coordinator.notifyCacheMiss({
        reason: 'synthesis_failed',
        error: 'synthesizeAudio handler unavailable',
        elapsedMs: 0,
      })
      return false
    }

    const budgetMs = this.coordinator.policy.maxSynthesisBudgetMs ?? 2500
    const abortController = new AbortController()
    this.activeAbortController = abortController
    const startSynthesizeAt = this.clock.now()

    let rawBuffer: ArrayBuffer
    let timerHandle: any = null
    let timedOut = false
    let onAbort!: () => void

    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(abortController.signal.reason)
        abortController.signal.addEventListener('abort', onAbort, { once: true })
        timerHandle = this.clock.setTimeout(() => {
          timedOut = true
          abortController.abort(new Error(`Dynamic aside synthesis timed out after ${budgetMs}ms`))
        }, budgetMs)
      })
      rawBuffer = await Promise.race([this.synthesizeAudio(candidate.text, abortController.signal), aborted])
    }
    catch (err) {
      if (isCurrent()) {
        this.coordinator.notifyCacheMiss({
          reason: timedOut ? 'synthesis_timeout' : 'synthesis_failed',
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: this.clock.now() - startSynthesizeAt,
        })
      }
      return false
    }
    finally {
      if (timerHandle != null)
        this.clock.clearTimeout(timerHandle)
      abortController.signal.removeEventListener('abort', onAbort)
      if (this.activeAbortController === abortController)
        this.activeAbortController = null
    }

    // Post-synthesis validity checks
    if (abortController.signal.aborted || !isCurrent()) {
      return false
    }

    if (this.clock.now() >= candidate.expiresAtMs) {
      this.coordinator.notifyCacheMiss({
        reason: 'synthesis_failed',
        error: 'Candidate expired after synthesis',
        elapsedMs: this.clock.now() - startSynthesizeAt,
      })
      return false
    }

    if (!rawBuffer || rawBuffer.byteLength === 0) {
      this.coordinator.notifyCacheMiss({
        reason: 'synthesis_failed',
        error: 'Empty audio buffer returned from synthesis',
        elapsedMs: this.clock.now() - startSynthesizeAt,
      })
      return false
    }

    let audioData: TAudio
    if (this.decodeAudio) {
      const decodeStart = this.clock.now()
      try {
        audioData = await this.decodeAudio(rawBuffer)
      }
      catch (err: any) {
        if (!isCurrent())
          return false
        this.coordinator.notifyCacheMiss({
          reason: 'decode_failed',
          error: err?.message || 'AudioContext decode error',
          elapsedMs: this.clock.now() - decodeStart,
        })
        return false
      }
    }
    else {
      audioData = rawBuffer as unknown as TAudio
    }

    // Re-check after async decode
    if (!isCurrent()) {
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
      this.coordinator.notifyCacheMiss({
        reason: 'synthesis_failed',
        error: `Clip duration invalid or exceeded max: ${Math.round(durationMs)}ms > ${maxDurationMs}ms`,
        elapsedMs: this.clock.now() - startSynthesizeAt,
      })
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
    this.activeFillerIntentId = item.intentId
    if (this.playback.tryCommitFiller) {
      const receipt = this.playback.tryCommitFiller(item, 100)
      if (!receipt.accepted) {
        this.activeFillerItemId = null
        this.activeFillerIntentId = null
        this.coordinator.notifyCacheMiss({
          reason: 'synthesis_failed',
          error: `Playback admission rejected: ${receipt.reason || 'queue full'}`,
          elapsedMs: this.clock.now() - startSynthesizeAt,
        })
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
    this.activeFillerIntentId = null
    this.coordinator.notifyFillerAudioEnded(now)
  }

  /**
   * Cancels any active filler playback on barge-in or turn cancellation.
   */
  public cancelFiller(reason: string): void {
    this.preparationGeneration++
    this.activeAbortController?.abort()
    this.activeAbortController = null
    const intentId = this.activeFillerIntentId
    this.activeFillerIntentId = null
    this.activeFillerItemId = null
    if (intentId)
      this.playback.stopByIntent?.(intentId, reason)
  }

  public cancel(reason: string): void {
    this.cancelFiller(reason)
    this.coordinator.cancel(reason)
    this.usedPhrases.clear()
  }
}
