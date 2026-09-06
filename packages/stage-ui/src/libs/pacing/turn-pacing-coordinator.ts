import type {
  AsideCandidate,
  CacheMissDetails,
  Clock,
  InferenceEvent,
  PacingMetrics,
  PacingPolicyConfig,
  PacingState,
  PacingStateLogEntry,
  ThinkingCategory,
  TurnPhase,
} from '../../types/pacing'

import { BoundedCategoryClassifier } from './category-classifier'

export interface TurnPacingCoordinatorOptions {
  turnId: string
  generation: number
  providerKey: string
  policy: PacingPolicyConfig
  clock?: Clock
  historicalTtftSamples?: number[]
  classifier?: BoundedCategoryClassifier
  onArmFiller?: (category: ThinkingCategory, deadlineMs: number, candidate?: AsideCandidate) => void
  onArmDynamicAside?: (candidate: AsideCandidate, budgetMs: number) => void
  onCancelFiller?: (reason: string) => void
  onSettled?: (metrics: PacingMetrics) => void
  onStateChange?: (state: PacingState, log: PacingStateLogEntry[], nextEligibleInMs?: number) => void
}

export class TurnPacingCoordinator {
  public state: PacingState = 'IDLE'
  public turnPhase: TurnPhase = 'waiting'
  public pacingClosed: boolean = false
  public terminalSeen: boolean = false
  public committedCount: number = 0
  public spokenCount: number = 0
  public attemptsMade: number = 0
  public nextEligibleAtMs?: number
  public activeAttemptId?: string
  public pendingCandidate: AsideCandidate | null = null
  public stateLog: PacingStateLogEntry[] = []

  public turnId: string
  public generation: number
  public providerKey: string
  public policy: PacingPolicyConfig
  private clock: Clock
  private classifier?: BoundedCategoryClassifier

  private t0: number = 0
  private deadlineMs: number = 1800
  private timerHandle: any = null
  private intervalTimerHandle: any = null
  private fillerCandidate: ThinkingCategory = 'generic'
  private answerAudioScheduled: boolean = false
  private fillerAttempted: boolean = false
  private fillersSpokenCount: number = 0
  private usedCategories: Set<ThinkingCategory> = new Set()

  public metrics: PacingMetrics
  private onArmFiller?: (category: ThinkingCategory, deadlineMs: number, candidate?: AsideCandidate) => void
  private onArmDynamicAside?: (candidate: AsideCandidate, budgetMs: number) => void
  private onCancelFiller?: (reason: string) => void
  private onSettled?: (metrics: PacingMetrics) => void
  private onStateChange?: (state: PacingState, log: PacingStateLogEntry[], nextEligibleInMs?: number) => void

  constructor(options: TurnPacingCoordinatorOptions) {
    this.turnId = options.turnId
    this.generation = options.generation
    this.providerKey = options.providerKey
    this.policy = options.policy
    this.classifier = options.classifier ?? new BoundedCategoryClassifier(this.policy)
    this.onArmFiller = options.onArmFiller
    this.onArmDynamicAside = options.onArmDynamicAside
    this.onCancelFiller = options.onCancelFiller
    this.onSettled = options.onSettled
    this.onStateChange = options.onStateChange
    this.clock = options.clock ?? {
      now: () => Date.now(),
      setTimeout: (fn, delay) => setTimeout(fn, delay),
      clearTimeout: id => clearTimeout(id),
    }

    this.turnPhase = 'waiting'
    this.pacingClosed = false
    this.terminalSeen = false
    this.committedCount = 0
    this.spokenCount = 0
    this.attemptsMade = 0
    this.pendingCandidate = null

    this.deadlineMs = this.calculateDeadline(options.historicalTtftSamples ?? [])
    this.metrics = {
      turnId: this.turnId,
      providerKey: this.providerKey,
      deadlineMs: this.deadlineMs,
      fillerOutcome: 'none',
      interrupted: false,
      fillersSpokenCount: 0,
      categoriesSpoken: [],
      committedCount: 0,
      spokenCount: 0,
      pacingClosed: false,
    }
  }

  public calculateDeadline(samples: number[]): number {
    const minD = this.policy.armMinMs ?? 900
    const maxD = this.policy.armMaxMs ?? 3500
    const kFast = this.policy.kFast ?? 0.5

    if (samples.length === 0) {
      return Math.min(Math.max(1800, minD), maxD)
    }

    // Check ultra-fast heuristic: if p90 <= 700ms, effectively disable by setting above max or disabling
    const sorted = [...samples].sort((a, b) => a - b)
    const p90Index = Math.floor(sorted.length * 0.9)
    const p90 = sorted[Math.min(p90Index, sorted.length - 1)]
    if (p90 <= 700) {
      return -1 // Sentinel for disabled ultra-fast model
    }

    // Bounded EMA
    let mu = sorted[0]
    let d = 0
    const alpha = 2 / (Math.min(Math.max(samples.length, 8), 32) + 1)
    const beta = 0.2

    for (const x of samples) {
      mu = alpha * x + (1 - alpha) * mu
      d = beta * Math.abs(x - mu) + (1 - beta) * d
    }

    let deadline = mu - kFast * d

    // Empirical 10th percentile floor when enough samples exist
    if (samples.length >= 20) {
      const p10Index = Math.floor(sorted.length * 0.1)
      const p10 = sorted[Math.min(p10Index, sorted.length - 1)]
      deadline = Math.max(deadline, p10)
    }

    deadline = Math.max(minD, Math.min(maxD, deadline))
    return Math.round(deadline)
  }

  public logStateEvent(event: string, details?: string): void {
    const now = this.clock.now()
    const relTimeMs = this.t0 > 0 ? now - this.t0 : 0
    const entry: PacingStateLogEntry = {
      timestampMs: now,
      relTimeMs,
      state: this.state,
      event,
      details,
    }
    this.stateLog.push(entry)
    this.metrics.stateLog = [...this.stateLog]
    this.metrics.liveState = this.state
    this.metrics.committedCount = this.committedCount
    this.metrics.spokenCount = this.spokenCount
    this.metrics.fillersSpokenCount = this.fillersSpokenCount
    this.metrics.maxFillers = this.policy.maxFillersPerTurn ?? 3
    if (this.nextEligibleAtMs && this.nextEligibleAtMs > now) {
      this.metrics.nextOpportunityCountdownSec = Math.max(0, Math.ceil((this.nextEligibleAtMs - now) / 1000))
    }
    else {
      this.metrics.nextOpportunityCountdownSec = undefined
    }

    const nextIn = (this.nextEligibleAtMs && this.nextEligibleAtMs > now) ? (this.nextEligibleAtMs - now) : undefined
    this.onStateChange?.(this.state, this.stateLog, nextIn)
  }

  public dispatch(): void {
    if (this.state !== 'IDLE')
      return

    this.t0 = this.clock.now()
    this.state = 'DISPATCHED'
    this.state = 'STAGING'

    // If disabled by policy, return
    if (!this.policy.enabled) {
      return
    }

    if (this.deadlineMs <= 0) {
      // Ultra-fast model: do not schedule initial arm deadline, but schedule repeat interval timer
      // in case the model encounters a deep reasoning stall or unexpected delay.
      const intervalMs = this.policy.pacingIntervalMs ?? 15000
      this.nextEligibleAtMs = this.t0 + intervalMs
      this.logStateEvent('Ultra-fast model: initial filler bypassed', `Next interval in ${Math.round(intervalMs / 1000)}s`)
      this.intervalTimerHandle = this.clock.setTimeout(() => {
        this.onIntervalFlushElapsed()
      }, intervalMs)
      return
    }

    this.logStateEvent('Turn dispatched ➔ Staging initial deadline', `Deadline: ${this.deadlineMs}ms`)
    this.timerHandle = this.clock.setTimeout(() => {
      this.onDeadlineElapsed()
    }, this.deadlineMs)
  }

  public submitAsideCandidate(candidate: AsideCandidate, gen: number = this.generation): boolean {
    if (gen !== this.generation)
      return false
    if (this.pacingClosed || this.state === 'SETTLED' || this.state === 'ANSWER_READY')
      return false

    const now = this.clock.now()
    if (now >= candidate.expiresAtMs)
      return false

    // Check existing pending candidate
    if (this.pendingCandidate) {
      const existingStillFresh = now < this.pendingCandidate.expiresAtMs
      if (existingStillFresh && this.pendingCandidate.source === 'explicit' && candidate.source === 'organic') {
        // An organic cue cannot displace a fresh explicit cue
        return false
      }
    }

    this.pendingCandidate = candidate
    return true
  }

  public getPendingAsideCandidate(): AsideCandidate | null {
    if (!this.pendingCandidate)
      return null
    const now = this.clock.now()
    if (now >= this.pendingCandidate.expiresAtMs) {
      this.pendingCandidate = null
      return null
    }
    return this.pendingCandidate
  }

  public clearPendingCandidate(): void {
    this.pendingCandidate = null
  }

  public onInferenceEvent(event: InferenceEvent, eventGen: number = this.generation): void {
    if (eventGen !== this.generation)
      return
    if (this.state === 'SETTLED')
      return

    switch (event.type) {
      case 'aside-cue': {
        this.submitAsideCandidate(event.candidate, eventGen)
        break
      }

      case 'reasoning': {
        if (event.visibility === 'hidden') {
          if (this.classifier) {
            const result = this.classifier.consume(event.text)
            if (result.category !== 'generic') {
              this.replaceCandidate(result.category)
            }
          }
        }
        break
      }

      case 'answer': {
        this.onAnswerLiteralReceived(event.at)
        break
      }

      case 'error': {
        this.cancel('inference-error')
        break
      }

      case 'finish': {
        void this.onAssistantEnd()
        break
      }
    }
  }

  public replaceCandidate(category: ThinkingCategory): void {
    if (this.state === 'STAGING' || this.state === 'FILLER_ARMED') {
      this.fillerCandidate = category
      this.metrics.fillerCandidate = category
    }
  }

  private clearAllTimers(): void {
    if (this.timerHandle) {
      this.clock.clearTimeout(this.timerHandle)
      this.timerHandle = null
    }
    if (this.intervalTimerHandle) {
      this.clock.clearTimeout(this.intervalTimerHandle)
      this.intervalTimerHandle = null
    }
  }

  private onDeadlineElapsed(): void {
    this.timerHandle = null
    if (this.pacingClosed || this.state !== 'STAGING')
      return
    if (this.answerAudioScheduled || this.fillerAttempted)
      return

    const maxFillers = this.policy.maxFillersPerTurn ?? 3
    if (this.committedCount >= maxFillers) {
      this.pacingClosed = true
      this.metrics.pacingClosed = true
      return
    }

    const maxAttempts = 2 * maxFillers
    if (this.attemptsMade >= maxAttempts) {
      return
    }

    let catToArm: ThinkingCategory = this.fillerCandidate
    if (this.classifier) {
      const top = this.classifier.getTopCategoryExcluding(this.usedCategories)
      if (top) {
        catToArm = top
      }
    }

    this.attemptsMade++
    this.state = 'FILLER_ARMED'
    this.fillerAttempted = true
    this.usedCategories.add(catToArm)
    this.committedCount++
    this.metrics.committedCount = this.committedCount
    this.metrics.categoriesSpoken = Array.from(this.usedCategories)
    this.metrics.fillerCandidate = catToArm
    this.metrics.fillerOutcome = 'none'

    if (this.committedCount >= maxFillers) {
      this.pacingClosed = true
      this.metrics.pacingClosed = true
    }

    this.logStateEvent(`Armed initial filler [${catToArm}]`, `Deadline: ${this.deadlineMs}ms`)
    this.onArmFiller?.(catToArm, this.deadlineMs)
  }

  private onIntervalFlushElapsed(): void {
    this.intervalTimerHandle = null
    if (this.pacingClosed || this.state !== 'STAGING')
      return
    if (this.answerAudioScheduled)
      return

    const maxFillers = this.policy.maxFillersPerTurn ?? 3
    if (this.committedCount >= maxFillers) {
      this.pacingClosed = true
      this.metrics.pacingClosed = true
      return
    }

    const maxAttempts = 2 * maxFillers
    if (this.attemptsMade >= maxAttempts) {
      return
    }

    const now = this.clock.now()
    const dynamicAfterMs = this.policy.dynamicAfterMs ?? 15000
    const timeSinceT0 = now - this.t0

    // Priority 1: Dynamic Explicit Aside (<think_aloud>)
    const candidate = this.getPendingAsideCandidate()
    if (
      this.policy.dynamicAsidesEnabled
      && timeSinceT0 >= dynamicAfterMs
      && candidate
      && candidate.source === 'explicit'
    ) {
      this.attemptsMade++
      this.pendingCandidate = null // Consumed atomically
      this.state = 'FILLER_ARMED'
      this.fillerAttempted = true
      this.committedCount++
      this.metrics.committedCount = this.committedCount
      this.metrics.dynamicCueSource = 'explicit'
      this.metrics.fillerCandidate = 'generic'
      this.metrics.fillerOutcome = 'none'

      if (this.committedCount >= maxFillers) {
        this.pacingClosed = true
        this.metrics.pacingClosed = true
      }

      this.logStateEvent(`Armed dynamic aside [explicit]`, `"${candidate.text.slice(0, 24)}"`)
      const budgetMs = this.policy.maxSynthesisBudgetMs ?? 2500
      if (this.onArmDynamicAside) {
        this.onArmDynamicAside(candidate, budgetMs)
      }
      else {
        this.onArmFiller?.('generic', budgetMs, candidate)
      }
      return
    }

    // Priority 2: Organic Pivot
    if (
      this.policy.experimentalOrganicPivots
      && timeSinceT0 >= dynamicAfterMs
      && candidate
      && candidate.source === 'organic'
    ) {
      this.attemptsMade++
      this.pendingCandidate = null // Consumed atomically
      this.state = 'FILLER_ARMED'
      this.fillerAttempted = true
      this.committedCount++
      this.metrics.committedCount = this.committedCount
      this.metrics.dynamicCueSource = 'organic'
      this.metrics.fillerCandidate = 'generic'
      this.metrics.fillerOutcome = 'none'

      if (this.committedCount >= maxFillers) {
        this.pacingClosed = true
        this.metrics.pacingClosed = true
      }

      this.logStateEvent(`Armed dynamic aside [organic]`, `"${candidate.text.slice(0, 24)}"`)
      const budgetMs = this.policy.maxSynthesisBudgetMs ?? 2500
      if (this.onArmDynamicAside) {
        this.onArmDynamicAside(candidate, budgetMs)
      }
      else {
        this.onArmFiller?.('generic', budgetMs, candidate)
      }
      return
    }

    // Priority 3: Cached Category Winner (falls back to generic phrase pool)
    let nextCat: ThinkingCategory | null = null
    if (this.classifier) {
      nextCat = this.classifier.getTopCategoryExcluding(this.usedCategories)
    }

    if (!nextCat) {
      nextCat = 'generic'
    }

    this.attemptsMade++
    this.state = 'FILLER_ARMED'
    this.usedCategories.add(nextCat)
    this.committedCount++
    this.metrics.committedCount = this.committedCount
    this.metrics.categoriesSpoken = Array.from(this.usedCategories)
    this.metrics.fillerCandidate = nextCat
    this.metrics.fillerOutcome = 'none'

    if (this.committedCount >= maxFillers) {
      this.pacingClosed = true
      this.metrics.pacingClosed = true
    }

    this.logStateEvent(`Armed interval filler [${nextCat}]`, `Opportunity ${this.committedCount}/${maxFillers}`)
    const intervalMs = this.policy.pacingIntervalMs ?? 15000
    this.onArmFiller?.(nextCat, intervalMs)
  }

  private onAnswerLiteralReceived(at: number): void {
    if (!this.metrics.ttftMs) {
      this.metrics.ttftMs = at - this.t0
    }

    this.pacingClosed = true
    this.metrics.pacingClosed = true
    this.metrics.cutoffReason = 'answer-literal'
    this.turnPhase = 'answering'
    this.clearPendingCandidate()
    this.clearAllTimers()

    if (this.state === 'STAGING') {
      this.state = 'ANSWER_READY'
      this.logStateEvent('Answer literal received ➔ Pacing closed')
      return
    }

    if (this.state === 'FILLER_ARMED') {
      // Answer arrived before filler audio started -> cancel filler!
      this.state = 'ANSWER_READY'
      this.metrics.fillerOutcome = 'canceled'
      this.logStateEvent('Answer arrived ➔ Preempted armed filler')
      this.onCancelFiller?.('answer-arrived')
      return
    }

    if (this.state === 'FILLER_ACTIVE') {
      // Filler is actively speaking; answer literal continues normally, queue behind filler
    }
  }

  public notifyFillerAudioStarted(at: number = this.clock.now()): void {
    if (this.state !== 'FILLER_ARMED') {
      this.metrics.fillerOutcome = 'rejected'
      return
    }

    this.state = 'FILLER_ACTIVE'
    this.spokenCount++
    this.fillersSpokenCount++
    this.metrics.spokenCount = this.spokenCount
    this.metrics.fillersSpokenCount = this.fillersSpokenCount
    this.metrics.fillerStartMs = at - this.t0
    this.metrics.fillerOutcome = 'played'
    this.logStateEvent('Filler playback started', `Spoken count: ${this.fillersSpokenCount}`)
  }

  public notifyFillerAudioEnded(at: number = this.clock.now()): void {
    if (this.state !== 'FILLER_ACTIVE')
      return

    this.metrics.fillerEndMs = at - this.t0
    if (this.metrics.answerFirstAudioMs != null) {
      this.metrics.handoffGapMs = this.metrics.answerFirstAudioMs - this.metrics.fillerEndMs
    }

    const maxFillers = this.policy.maxFillersPerTurn ?? 3
    if (!this.pacingClosed && !this.answerAudioScheduled && this.committedCount < maxFillers) {
      this.state = 'STAGING'
      this.classifier?.resetWindow()
      const intervalMs = this.policy.pacingIntervalMs ?? 15000
      this.nextEligibleAtMs = at + intervalMs
      this.intervalTimerHandle = this.clock.setTimeout(() => {
        this.onIntervalFlushElapsed()
      }, intervalMs)
      this.logStateEvent('Filler playback ended ➔ Scheduled next interval', `+${Math.round(intervalMs / 1000)}s`)
    }
    else {
      this.state = 'HANDOFF'
      this.logStateEvent('Filler playback ended ➔ Handoff to answer')
      if (this.answerAudioScheduled) {
        this.onSettled?.(this.metrics)
      }
    }
  }

  public notifyAnswerAudioScheduled(at: number = this.clock.now()): void {
    if (this.answerAudioScheduled)
      return

    this.answerAudioScheduled = true
    this.pacingClosed = true
    this.metrics.pacingClosed = true
    this.clearPendingCandidate()
    this.clearAllTimers()

    if (!this.metrics.answerFirstAudioMs) {
      this.metrics.answerFirstAudioMs = at - this.t0
    }

    // Calculate handoff gap if filler was played
    if (this.metrics.fillerEndMs != null && this.metrics.answerFirstAudioMs != null) {
      this.metrics.handoffGapMs = this.metrics.answerFirstAudioMs - this.metrics.fillerEndMs
    }

    // If filler is still in FILLER_ARMED (not started), answer audio preempts and rejects filler
    if (this.state === 'FILLER_ARMED') {
      this.state = 'ANSWER_READY'
      this.metrics.fillerOutcome = 'rejected'
      this.onCancelFiller?.('answer-scheduled')
    }

    this.logStateEvent('Answer audio scheduled ➔ Pacing closed')

    if (this.state === 'SETTLED' || this.state === 'HANDOFF') {
      this.onSettled?.(this.metrics)
    }
  }

  public notifyCacheMiss(details?: CacheMissDetails): void {
    if (this.state === 'FILLER_ARMED') {
      this.metrics.fillerOutcome = 'cache-miss'
      if (details?.reason) {
        this.metrics.cacheMissReason = details.reason
        this.metrics.cutoffReason = details.reason
      }
      if (details?.error) {
        this.metrics.cacheMissError = details.error
      }

      // Rollback committedCount since filler was not committed to audio playback
      if (this.committedCount > 0) {
        this.committedCount--
        this.metrics.committedCount = this.committedCount
      }

      if (this.metrics.fillerCandidate) {
        this.usedCategories.delete(this.metrics.fillerCandidate)
        this.metrics.categoriesSpoken = Array.from(this.usedCategories)
      }

      const maxFillers = this.policy.maxFillersPerTurn ?? 3
      if (this.committedCount < maxFillers && !this.answerAudioScheduled && this.turnPhase !== 'answering') {
        this.pacingClosed = false
        this.metrics.pacingClosed = false
      }

      const maxAttempts = 2 * maxFillers
      // If we haven't exhausted attempts and answer hasn't arrived, remain in STAGING and schedule next interval
      if (!this.pacingClosed && this.attemptsMade < maxAttempts && !this.answerAudioScheduled && this.turnPhase !== 'answering') {
        this.state = 'STAGING'
        const baseIntervalMs = this.policy.pacingIntervalMs ?? 15000
        // NOTICE: For the initial filler attempt (attemptsMade <= 1 with 0 committed), use an adaptive
        // faster retry (5s) instead of leaping 15s into the future, so that mid-length CoT turns (5-12s)
        // have a chance to evaluate subsequent filler opportunities or synthesized audio.
        const intervalMs = (this.attemptsMade <= 1 && this.committedCount === 0)
          ? Math.min(5000, baseIntervalMs)
          : baseIntervalMs
        this.nextEligibleAtMs = this.clock.now() + intervalMs
        if (this.intervalTimerHandle) {
          this.clock.clearTimeout(this.intervalTimerHandle)
        }
        this.intervalTimerHandle = this.clock.setTimeout(() => {
          this.onIntervalFlushElapsed()
        }, intervalMs)

        const reasonTag = details?.reason
          ? `[${details.reason}${details.elapsedMs != null ? ` · ${details.elapsedMs}ms` : ''}]`
          : 'Cache miss / timeout'
        const errorDetail = details?.error ? `${details.error} ➔ ` : ''
        this.logStateEvent(`${reasonTag} ➔ Rescheduled next opportunity`, `${errorDetail}+${Math.round(intervalMs / 1000)}s`)
      }
      else {
        this.state = 'ANSWER_READY'
        const reasonTag = details?.reason
          ? `[${details.reason}${details.elapsedMs != null ? ` · ${details.elapsedMs}ms` : ''}] `
          : ''
        const errorDetail = details?.error ? ` (${details.error})` : ''
        this.logStateEvent(`Cache miss (attempts exhausted)`, `${reasonTag}${errorDetail}`.trim() || undefined)
      }
    }
  }

  public cancel(reason: string, gen: number = this.generation): void {
    if (gen !== this.generation)
      return
    if (this.state === 'SETTLED')
      return

    this.pacingClosed = true
    this.metrics.pacingClosed = true
    this.metrics.cutoffReason = reason
    this.turnPhase = 'canceled'
    this.clearPendingCandidate()
    this.clearAllTimers()

    if (this.state === 'FILLER_ARMED') {
      this.metrics.fillerOutcome = 'canceled'
    }

    this.metrics.interrupted = true
    this.state = 'SETTLED'
    this.logStateEvent(`Pacing canceled: ${reason}`)
    this.onCancelFiller?.(reason)
    this.onSettled?.(this.metrics)
  }

  public async onAssistantEnd(): Promise<void> {
    if (this.state === 'SETTLED')
      return

    this.terminalSeen = true
    this.pacingClosed = true
    this.metrics.pacingClosed = true
    this.turnPhase = 'draining'
    this.clearPendingCandidate()
    this.clearAllTimers()

    this.state = 'SETTLED'
    this.turnPhase = 'settled'
    this.onSettled?.(this.metrics)
  }
}
