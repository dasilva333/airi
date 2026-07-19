import type { Nan0HeartbeatTerminalResult } from '../diagnostics/Nan0KernelObservatory'
import type { Nan0HeartbeatRuntimeState } from '../types'

export type Nan0HeartbeatWakeReason = 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual' | 'external-input'

export interface Nan0HeartbeatEvaluationContext {
  heartbeatTickId: string
  tickNumber: number
  startedAt: number
}

export interface Nan0HeartbeatEvaluationResult {
  nextEvaluationAt: number | null
  result?: Nan0HeartbeatTerminalResult
  sessionId?: string | null
  observationId?: string | null
  thoughtId?: string | null
  decisionId?: string | null
  turnId?: string | null
  source?: string | null
  provenance?: unknown
  failureLayer?: string | null
  reasonCodes?: string[]
  observationCount?: number
  queuedObservationCount?: number
  mood?: string
}

export interface Nan0HeartbeatEngineOptions {
  evaluate: (reason: Nan0HeartbeatWakeReason, context: Nan0HeartbeatEvaluationContext) => Promise<Nan0HeartbeatEvaluationResult>
  isHostReady: () => boolean
  now?: () => number
  random?: () => number
  baseIntervalMs?: number
  minimumIntervalMs?: number
  maximumIntervalMs?: number
  jitterRatio?: number
  setTimeout?: typeof globalThis.setTimeout
  clearTimeout?: typeof globalThis.clearTimeout
  onError?: (error: unknown) => void
  diagnostic?: (event: string, details: Record<string, unknown>) => void
  createTickId?: () => string
}

export interface Nan0HeartbeatEngine {
  start: () => void
  notify: (reason: Exclude<Nan0HeartbeatWakeReason, 'interval' | 'session-resume'>) => void
  stop: () => void
  getNextEvaluationAt: () => number | null
  get running(): boolean
}

function finitePositive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function createEmptyHeartbeatRuntimeState(): Nan0HeartbeatRuntimeState {
  return {
    schemaVersion: 1,
    revision: 0,
    tickCount: 0,
    lastTickAt: null,
    nextTickAt: null,
    lastExternalInputAt: null,
    lastKyoInteractionAt: null,
    consecutiveSilentTicks: 0,
    pressureScore: 0,
    presence: 'idle',
  }
}

export function normalizeHeartbeatRuntimeState(
  value: Partial<Nan0HeartbeatRuntimeState> | null | undefined,
): Nan0HeartbeatRuntimeState {
  const base = createEmptyHeartbeatRuntimeState()
  const timestamp = (candidate: unknown): number | null => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
  return {
    ...base,
    ...value,
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(typeof value?.revision === 'number' && Number.isFinite(value.revision) ? value.revision : 0)),
    tickCount: Math.max(0, Math.floor(typeof value?.tickCount === 'number' && Number.isFinite(value.tickCount) ? value.tickCount : 0)),
    lastTickAt: timestamp(value?.lastTickAt),
    nextTickAt: timestamp(value?.nextTickAt),
    lastExternalInputAt: timestamp(value?.lastExternalInputAt),
    lastKyoInteractionAt: timestamp(value?.lastKyoInteractionAt),
    consecutiveSilentTicks: Math.max(0, Math.floor(typeof value?.consecutiveSilentTicks === 'number' && Number.isFinite(value.consecutiveSilentTicks) ? value.consecutiveSilentTicks : 0)),
    pressureScore: Math.min(1, Math.max(0, typeof value?.pressureScore === 'number' && Number.isFinite(value.pressureScore) ? value.pressureScore : 0)),
    presence: ['idle', 'thinking', 'bored', 'waiting', 'absent'].includes(value?.presence ?? '') ? value!.presence! : 'idle',
  }
}

export function mergeHeartbeatRuntimeStates(
  persisted: Partial<Nan0HeartbeatRuntimeState> | null | undefined,
  candidate: Partial<Nan0HeartbeatRuntimeState> | null | undefined,
): Nan0HeartbeatRuntimeState {
  const left = normalizeHeartbeatRuntimeState(persisted)
  const right = normalizeHeartbeatRuntimeState(candidate)
  const primary = right.revision >= left.revision ? right : left
  return normalizeHeartbeatRuntimeState({
    ...primary,
    revision: Math.max(left.revision, right.revision),
    tickCount: Math.max(left.tickCount, right.tickCount),
    lastTickAt: Math.max(left.lastTickAt ?? 0, right.lastTickAt ?? 0) || null,
    lastExternalInputAt: Math.max(left.lastExternalInputAt ?? 0, right.lastExternalInputAt ?? 0) || null,
    lastKyoInteractionAt: Math.max(left.lastKyoInteractionAt ?? 0, right.lastKyoInteractionAt ?? 0) || null,
  })
}

function reasonRank(reason: Nan0HeartbeatWakeReason): number {
  switch (reason) {
    case 'manual': return 6
    case 'external-input': return 5
    case 'turn-complete': return 4
    case 'state-change': return 3
    case 'session-resume': return 2
    case 'interval': return 1
  }
}

/**
 * Schedules cognition evaluations only. Provider calls, session inscription, TTS,
 * and output remain owned by the host's existing thought-to-output pipeline.
 */
export function createNan0HeartbeatEngine(options: Nan0HeartbeatEngineOptions): Nan0HeartbeatEngine {
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const scheduleTimeout = options.setTimeout ?? globalThis.setTimeout
  const cancelTimeout = options.clearTimeout ?? globalThis.clearTimeout
  const minimumIntervalMs = Math.max(250, finitePositive(options.minimumIntervalMs, 2_000))
  const maximumIntervalMs = Math.max(minimumIntervalMs, finitePositive(options.maximumIntervalMs, 60_000))
  const baseIntervalMs = Math.min(maximumIntervalMs, Math.max(minimumIntervalMs, finitePositive(options.baseIntervalMs, 10_000)))
  const jitterRatio = Math.min(0.5, Math.max(0, typeof options.jitterRatio === 'number' && Number.isFinite(options.jitterRatio) ? options.jitterRatio : 0.15))
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null
  let evaluation: Promise<void> | null = null
  let pendingReason: Nan0HeartbeatWakeReason | null = null
  let nextEvaluationAt: number | null = null
  let started = false
  let generation = 0
  let tickNumber = 0
  const completedTickIds = new Set<string>()

  const diagnostic = (event: string, details: Record<string, unknown>): void => {
    try {
      options.diagnostic?.(event, details)
    }
    catch {
      // Diagnostics are deliberately unable to alter scheduler behavior.
    }
  }

  const nextTickContext = (): Nan0HeartbeatEvaluationContext => {
    tickNumber += 1
    return {
      heartbeatTickId: `tick_${options.createTickId?.() ?? `${now()}-${tickNumber}`}`,
      tickNumber,
      startedAt: now(),
    }
  }

  const completeTick = (
    context: Nan0HeartbeatEvaluationContext,
    reason: Nan0HeartbeatWakeReason,
    result: Nan0HeartbeatEvaluationResult,
  ): void => {
    if (completedTickIds.has(context.heartbeatTickId))
      return
    completedTickIds.add(context.heartbeatTickId)
    if (completedTickIds.size > 1_024)
      completedTickIds.delete(completedTickIds.values().next().value!)
    diagnostic('heartbeat.tick.completed', {
      ...context,
      reason,
      result: result.result ?? 'NO_COGNITION',
      nextEvaluationAt: result.nextEvaluationAt,
      sessionId: result.sessionId ?? null,
      observationId: result.observationId ?? null,
      thoughtId: result.thoughtId ?? null,
      decisionId: result.decisionId ?? null,
      turnId: result.turnId ?? null,
      source: result.source ?? null,
      provenance: result.provenance ?? null,
      failureLayer: result.failureLayer ?? null,
      reasonCodes: result.reasonCodes ?? [],
      observationCount: result.observationCount ?? (result.observationId ? 1 : 0),
      queuedObservationCount: result.queuedObservationCount ?? 0,
      mood: result.mood ?? 'unknown',
      elapsedMs: Math.max(0, now() - context.startedAt),
    })
  }

  const reportError = (error: unknown): void => {
    try {
      options.onError?.(error)
    }
    catch {
      // Host error reporting must not alter scheduler completion.
    }
  }

  const cancelTimer = () => {
    if (timer != null)
      cancelTimeout(timer)
    timer = null
  }

  const jitteredDelay = (): number => {
    const unit = Math.min(1, Math.max(0, random()))
    const factor = 1 + (unit * 2 - 1) * jitterRatio
    return Math.min(maximumIntervalMs, Math.max(minimumIntervalMs, Math.round(baseIntervalMs * factor)))
  }

  const schedule = () => {
    if (!started)
      return
    cancelTimer()
    const scheduledAt = nextEvaluationAt == null
      ? now() + jitteredDelay()
      : Math.min(nextEvaluationAt, now() + jitteredDelay())
    const delay = Math.min(maximumIntervalMs, Math.max(minimumIntervalMs, scheduledAt - now()))
    const scheduledGeneration = generation
    timer = scheduleTimeout(() => {
      timer = null
      if (started && scheduledGeneration === generation)
        run('interval')
    }, delay)
  }

  const queueReason = (reason: Nan0HeartbeatWakeReason) => {
    if (pendingReason == null || reasonRank(reason) > reasonRank(pendingReason))
      pendingReason = reason
  }

  const run = (reason: Nan0HeartbeatWakeReason, force = false): void => {
    if (!started)
      return
    if (evaluation) {
      queueReason(reason)
      return
    }
    if (!force && reason === 'interval' && nextEvaluationAt != null && now() < nextEvaluationAt) {
      schedule()
      return
    }
    const context = nextTickContext()
    diagnostic('heartbeat.tick.started', { ...context, reason, nextEvaluationAt })
    let hostReady = false
    try {
      hostReady = options.isHostReady()
    }
    catch (error) {
      completeTick(context, reason, {
        nextEvaluationAt,
        result: 'FAILURE_SILENCE',
        failureLayer: 'host-readiness',
        reasonCodes: ['heartbeat.host-readiness-failed'],
      })
      reportError(error)
      schedule()
      return
    }
    if (!hostReady) {
      const result: Nan0HeartbeatEvaluationResult = {
        nextEvaluationAt,
        result: 'SUPPRESSED_SILENCE',
        failureLayer: 'host-readiness',
        reasonCodes: ['heartbeat.host-not-ready'],
      }
      diagnostic('heartbeat.tick.skipped', { ...context, reason, cause: 'host-not-ready' })
      completeTick(context, reason, result)
      schedule()
      return
    }
    const runGeneration = generation
    evaluation = Promise.resolve()
      .then(() => options.evaluate(reason, context))
      .then((result) => {
        if (started && runGeneration === generation)
          nextEvaluationAt = result.nextEvaluationAt
        completeTick(context, reason, result)
      })
      .catch((error) => {
        completeTick(context, reason, {
          nextEvaluationAt,
          result: 'FAILURE_SILENCE',
          failureLayer: 'heartbeat-evaluation',
          reasonCodes: ['heartbeat.evaluation-failed'],
        })
        reportError(error)
      })
      .finally(() => {
        evaluation = null
        if (!started || runGeneration !== generation)
          return
        const queued = pendingReason
        pendingReason = null
        if (queued)
          run(queued, true)
        else
          schedule()
      })
  }

  return {
    start() {
      if (started)
        return
      started = true
      generation += 1
      diagnostic('heartbeat.started', { generation, baseIntervalMs, minimumIntervalMs, maximumIntervalMs })
      run('session-resume', true)
    },
    notify(reason) {
      if (!started)
        return
      cancelTimer()
      run(reason, true)
    },
    stop() {
      if (!started)
        return
      started = false
      generation += 1
      pendingReason = null
      nextEvaluationAt = null
      cancelTimer()
      diagnostic('heartbeat.stopped', { generation })
    },
    getNextEvaluationAt() {
      return nextEvaluationAt
    },
    get running() {
      return started
    },
  }
}
