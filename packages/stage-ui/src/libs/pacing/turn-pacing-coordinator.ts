import type {
  Clock,
  InferenceEvent,
  PacingMetrics,
  PacingPolicyConfig,
  PacingState,
  ThinkingCategory,
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
  onArmFiller?: (category: ThinkingCategory, deadlineMs: number) => void
  onCancelFiller?: (reason: string) => void
  onSettled?: (metrics: PacingMetrics) => void
}

export class TurnPacingCoordinator {
  public state: PacingState = 'IDLE'
  public turnId: string
  public generation: number
  public providerKey: string
  public policy: PacingPolicyConfig
  private clock: Clock
  private classifier?: BoundedCategoryClassifier

  private t0: number = 0
  private deadlineMs: number = 1800
  private timerHandle: any = null
  private fillerCandidate: ThinkingCategory = 'generic'
  private answerAudioScheduled: boolean = false
  private fillerAttempted: boolean = false

  public metrics: PacingMetrics
  private onArmFiller?: (category: ThinkingCategory, deadlineMs: number) => void
  private onCancelFiller?: (reason: string) => void
  private onSettled?: (metrics: PacingMetrics) => void

  constructor(options: TurnPacingCoordinatorOptions) {
    this.turnId = options.turnId
    this.generation = options.generation
    this.providerKey = options.providerKey
    this.policy = options.policy
    this.classifier = options.classifier ?? new BoundedCategoryClassifier(this.policy)
    this.onArmFiller = options.onArmFiller
    this.onCancelFiller = options.onCancelFiller
    this.onSettled = options.onSettled
    this.clock = options.clock ?? {
      now: () => Date.now(),
      setTimeout: (fn, delay) => setTimeout(fn, delay),
      clearTimeout: id => clearTimeout(id),
    }

    this.deadlineMs = this.calculateDeadline(options.historicalTtftSamples ?? [])
    this.metrics = {
      turnId: this.turnId,
      providerKey: this.providerKey,
      deadlineMs: this.deadlineMs,
      fillerOutcome: 'none',
      interrupted: false,
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
    deadline = Math.max(minD, Math.min(maxD, deadline))

    // Empirical 10th percentile floor when enough samples exist
    if (samples.length >= 20) {
      const p10Index = Math.floor(sorted.length * 0.1)
      const p10 = sorted[Math.min(p10Index, sorted.length - 1)]
      deadline = Math.max(deadline, p10)
    }

    return Math.round(deadline)
  }

  public dispatch(): void {
    if (this.state !== 'IDLE')
      return

    this.t0 = this.clock.now()
    this.state = 'DISPATCHED'

    // First tick transition to STAGING
    this.state = 'STAGING'

    // If disabled by policy or ultra-fast, stay in STAGING without arm timer
    if (!this.policy.enabled || this.deadlineMs <= 0) {
      return
    }

    this.timerHandle = this.clock.setTimeout(() => {
      this.onDeadlineElapsed()
    }, this.deadlineMs)
  }

  public onInferenceEvent(event: InferenceEvent, eventGen: number = this.generation): void {
    if (eventGen !== this.generation)
      return
    if (this.state === 'SETTLED')
      return

    switch (event.type) {
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

  private onDeadlineElapsed(): void {
    this.timerHandle = null
    if (this.state !== 'STAGING')
      return
    if (this.answerAudioScheduled || this.fillerAttempted)
      return

    if (this.classifier) {
      const flushed = this.classifier.flush()
      if (flushed.category !== 'generic') {
        this.replaceCandidate(flushed.category)
      }
    }

    this.state = 'FILLER_ARMED'
    this.fillerAttempted = true
    this.metrics.fillerCandidate = this.fillerCandidate
    this.metrics.fillerOutcome = 'none' // Will be updated to played, cache-miss, or canceled
    this.onArmFiller?.(this.fillerCandidate, this.deadlineMs)
  }

  private onAnswerLiteralReceived(at: number): void {
    if (!this.metrics.ttftMs) {
      this.metrics.ttftMs = at - this.t0
    }

    if (this.state === 'STAGING') {
      if (this.timerHandle) {
        this.clock.clearTimeout(this.timerHandle)
        this.timerHandle = null
      }
      this.state = 'ANSWER_READY'
      return
    }

    if (this.state === 'FILLER_ARMED') {
      // Answer arrived before filler audio started -> cancel filler!
      this.state = 'ANSWER_READY'
      this.metrics.fillerOutcome = 'canceled'
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
    this.metrics.fillerStartMs = at - this.t0
    this.metrics.fillerOutcome = 'played'
  }

  public notifyFillerAudioEnded(_at: number = this.clock.now()): void {
    if (this.state !== 'FILLER_ACTIVE')
      return
    this.state = 'HANDOFF'
  }

  public notifyAnswerAudioScheduled(at: number = this.clock.now()): void {
    this.answerAudioScheduled = true
    if (!this.metrics.answerFirstAudioMs) {
      this.metrics.answerFirstAudioMs = at - this.t0
    }

    // Calculate handoff gap if filler was played
    if (this.metrics.fillerStartMs && this.metrics.answerFirstAudioMs) {
      this.metrics.handoffGapMs = this.metrics.answerFirstAudioMs - this.metrics.fillerStartMs
    }

    // If filler is still in FILLER_ARMED (not started), answer audio preempts and rejects filler
    if (this.state === 'FILLER_ARMED') {
      this.state = 'ANSWER_READY'
      this.metrics.fillerOutcome = 'rejected'
      this.onCancelFiller?.('answer-scheduled')
    }
  }

  public notifyCacheMiss(): void {
    if (this.state === 'FILLER_ARMED') {
      this.metrics.fillerOutcome = 'cache-miss'
      this.state = 'ANSWER_READY'
    }
  }

  public cancel(reason: string, gen: number = this.generation): void {
    if (gen !== this.generation)
      return
    if (this.state === 'SETTLED')
      return

    if (this.timerHandle) {
      this.clock.clearTimeout(this.timerHandle)
      this.timerHandle = null
    }

    if (this.state === 'FILLER_ARMED') {
      this.metrics.fillerOutcome = 'canceled'
    }

    this.metrics.interrupted = true
    this.state = 'SETTLED'
    this.onCancelFiller?.(reason)
    this.onSettled?.(this.metrics)
  }

  public async onAssistantEnd(): Promise<void> {
    if (this.state === 'SETTLED')
      return

    if (this.timerHandle) {
      this.clock.clearTimeout(this.timerHandle)
      this.timerHandle = null
    }

    this.state = 'SETTLED'
    this.onSettled?.(this.metrics)
  }
}
