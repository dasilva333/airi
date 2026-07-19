import type { Nan0DecisionRecord, Nan0Thought } from '../types'

export type Nan0HeartbeatTerminalResult
  = | 'SPEAK'
    | 'CHOSEN_SILENCE'
    | 'NO_COGNITION'
    | 'SUPPRESSED_SILENCE'
    | 'WAIT'
    | 'ACT'
    | 'BODY_EXPRESSION'
    | 'STALE'
    | 'FAILURE_SILENCE'

export interface Nan0KernelObservatoryConfiguration {
  enabled: boolean
  console: boolean
  jsonl: boolean
  privateThoughts: boolean
  verbose: boolean
  logDirectory: string
  bufferCapacity: number
  batchSize: number
}

export interface Nan0KernelDiagnosticEvent {
  schemaVersion: 1
  eventId: string
  timestamp: number
  event: string
  sessionId: string | null
  heartbeatTickId: string | null
  observationId: string | null
  thoughtId: string | null
  decisionId: string | null
  turnId: string | null
  source: string | null
  provenance: unknown
  result: Nan0HeartbeatTerminalResult | null
  failureLayer: string | null
  reasonCodes: string[]
  privateSummary?: string
  privateText?: string
  details: Record<string, unknown>
}

export interface Nan0KernelDiagnosticInput {
  event: string
  timestamp?: number
  sessionId?: string | null
  heartbeatTickId?: string | null
  observationId?: string | null
  thoughtId?: string | null
  decisionId?: string | null
  turnId?: string | null
  source?: string | null
  provenance?: unknown
  result?: Nan0HeartbeatTerminalResult | null
  failureLayer?: string | null
  reasonCodes?: readonly string[]
  privateThought?: Readonly<Nan0Thought> | null
  details?: Record<string, unknown>
}

export interface Nan0KernelDiagnosticSink {
  write: (events: readonly Nan0KernelDiagnosticEvent[]) => Promise<void>
}

export interface Nan0KernelObservatory {
  emit: (input: Nan0KernelDiagnosticInput) => Nan0KernelDiagnosticEvent | null
  completeHeartbeatTick: (input: Omit<Nan0KernelDiagnosticInput, 'event'> & {
    heartbeatTickId: string
    result: Nan0HeartbeatTerminalResult
  }) => Nan0KernelDiagnosticEvent | null
  configure: (configuration: Partial<Nan0KernelObservatoryConfiguration>) => void
  flush: () => Promise<void>
}

export interface Nan0DiagnosticClassificationInput {
  observationId?: string | null
  outcome?: 'SPEAK' | 'SILENCE' | 'WAIT' | 'ACT' | 'BODY_EXPRESSION' | 'provider-failure' | 'idle' | 'skipped'
  thought?: Pick<Nan0Thought, 'status' | 'decision'> | null
  decision?: Pick<Nan0DecisionRecord, 'finalDecision' | 'allowed' | 'suppressionReason'> | null
  failureLayer?: string | null
}

export interface Nan0OutputEmissionIdentity {
  eventId: string
  generationId: string
  sessionId: string
  thoughtId?: string | null
  decisionId?: string | null
  turnId?: string | null
}

export type Nan0OutputDuplicateClassification
  = | 'duplicate-logging'
    | 'duplicate-finish-emission'
    | 'duplicate-generation'
    | 'distinct-output'

export function classifyNan0OutputDuplicate(
  previous: Readonly<Nan0OutputEmissionIdentity>,
  current: Readonly<Nan0OutputEmissionIdentity>,
): Nan0OutputDuplicateClassification {
  if (previous.eventId === current.eventId)
    return 'duplicate-logging'
  if (previous.generationId === current.generationId)
    return 'duplicate-finish-emission'
  const sameProvenance = previous.sessionId === current.sessionId
    && previous.thoughtId != null
    && previous.thoughtId === current.thoughtId
    && previous.decisionId === current.decisionId
    && previous.turnId === current.turnId
  return sameProvenance ? 'duplicate-generation' : 'distinct-output'
}

const SECRET_KEY = /api[-_]?key|authorization|credential|password|secret|token/i
const MAX_STRING_LENGTH = 4_000
const MAX_PRIVATE_TEXT_LENGTH = 24_000
const MAX_REASON_CODES = 24
const DEFAULT_BUFFER_CAPACITY = 256
const DEFAULT_BATCH_SIZE = 32

export const NAN0_DEFAULT_OBSERVATORY_CONFIGURATION: Nan0KernelObservatoryConfiguration = {
  enabled: false,
  console: false,
  jsonl: false,
  privateThoughts: false,
  verbose: false,
  logDirectory: 'logs',
  bufferCapacity: DEFAULT_BUFFER_CAPACITY,
  batchSize: DEFAULT_BATCH_SIZE,
}

function booleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean')
    return value
  if (typeof value !== 'string')
    return fallback
  if (['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase()))
    return true
  if (['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase()))
    return false
  return fallback
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(1, Math.floor(parsed)))
    : fallback
}

export function resolveNan0KernelObservatoryConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): Nan0KernelObservatoryConfiguration {
  const enabled = booleanFlag(environment.NAN0_DEBUG, false)
  return {
    enabled,
    console: enabled && booleanFlag(environment.NAN0_DEBUG_CONSOLE, true),
    jsonl: enabled && booleanFlag(environment.NAN0_DEBUG_JSONL, true),
    privateThoughts: enabled && booleanFlag(environment.NAN0_DEBUG_PRIVATE_THOUGHTS, false),
    verbose: enabled && booleanFlag(environment.NAN0_DEBUG_VERBOSE, false),
    logDirectory: environment.NAN0_DEBUG_LOG_DIR?.trim() || 'logs',
    bufferCapacity: positiveInteger(environment.NAN0_DEBUG_BUFFER_CAPACITY, DEFAULT_BUFFER_CAPACITY, 2_048),
    batchSize: positiveInteger(environment.NAN0_DEBUG_BATCH_SIZE, DEFAULT_BATCH_SIZE, 128),
  }
}

function bounded(value: string, maximum = MAX_STRING_LENGTH): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum)}…`
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function reasonCodes(value: unknown): string[] {
  if (!Array.isArray(value))
    return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => bounded(item, 240)))].slice(0, MAX_REASON_CODES)
}

function terminalResult(value: unknown): Nan0HeartbeatTerminalResult | null {
  return [
    'SPEAK',
    'CHOSEN_SILENCE',
    'NO_COGNITION',
    'SUPPRESSED_SILENCE',
    'WAIT',
    'ACT',
    'BODY_EXPRESSION',
    'STALE',
    'FAILURE_SILENCE',
  ].includes(String(value))
    ? value as Nan0HeartbeatTerminalResult
    : null
}

function jsonSafe(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value == null || typeof value === 'boolean')
    return value
  if (typeof value === 'string')
    return bounded(value)
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint')
    return value.toString()
  if (typeof value !== 'object')
    return String(value)
  if (depth >= 7)
    return '[depth-limited]'
  if (seen.has(value))
    return '[circular]'
  seen.add(value)
  if (Array.isArray(value))
    return value.slice(0, 128).map(item => jsonSafe(item, seen, depth + 1))
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(record)
      .slice(0, 160)
      .map(([key, item]) => [key, SECRET_KEY.test(key) ? '[redacted]' : jsonSafe(item, seen, depth + 1)]),
  )
}

function detailsRecord(value: unknown): Record<string, unknown> {
  const safe = jsonSafe(value)
  return safe && typeof safe === 'object' && !Array.isArray(safe)
    ? safe as Record<string, unknown>
    : {}
}

function thoughtSummary(thought: Readonly<Nan0Thought>): string {
  return bounded(thought.interpretation.trim() || `Thought ${thought.status}; mood ${thought.mood}.`, 800)
}

function thoughtText(thought: Readonly<Nan0Thought>): string {
  return bounded((thought.narrative ?? thought.privateText).trim(), MAX_PRIVATE_TEXT_LENGTH)
}

export function classifyNan0DiagnosticResult(input: Nan0DiagnosticClassificationInput): Nan0HeartbeatTerminalResult {
  if (input.failureLayer || input.outcome === 'provider-failure' || input.thought?.status === 'failed')
    return 'FAILURE_SILENCE'
  if (input.thought?.status === 'interrupted'
    || input.decision?.suppressionReason === 'attention.focus-authoritative'
    || input.decision?.suppressionReason === 'thought.interrupted-before-completion') {
    return 'STALE'
  }
  if (input.outcome === 'skipped')
    return 'SUPPRESSED_SILENCE'
  if (input.outcome === 'idle' || (!input.outcome && !input.observationId && !input.thought && !input.decision))
    return 'NO_COGNITION'

  const finalDecision = input.decision?.finalDecision ?? input.outcome
  const allowed = input.decision?.allowed ?? true
  if (!allowed)
    return 'SUPPRESSED_SILENCE'
  switch (finalDecision) {
    case 'SPEAK': return 'SPEAK'
    case 'SILENCE': return 'CHOSEN_SILENCE'
    case 'WAIT': return 'WAIT'
    case 'ACT': return 'ACT'
    case 'BODY_EXPRESSION': return 'BODY_EXPRESSION'
    default: return 'NO_COGNITION'
  }
}

function timestampLabel(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23)
}

export function formatNan0DiagnosticConsoleLine(
  event: Readonly<Nan0KernelDiagnosticEvent>,
  verbose: boolean,
): string | null {
  if (!verbose) {
    if (event.event === 'heartbeat.started' || event.event === 'heartbeat.stopped')
      return `[Nan0 HB] ${event.event === 'heartbeat.started' ? 'started' : 'stopped'}`
    if (event.event !== 'heartbeat.tick.completed')
      return null
    const tick = event.details.tickNumber ?? event.heartbeatTickId ?? 'unknown'
    const observationCount = event.details.observationCount ?? (event.observationId ? 1 : 0)
    const queue = event.details.queuedObservationCount ?? 0
    const mood = event.details.mood ?? 'unknown'
    return `[Nan0 HB] tick=${tick} result=${event.result ?? 'NO_COGNITION'} obs=${observationCount} queue=${queue} mood=${mood}`
  }

  const context = {
    eventId: event.eventId,
    tickId: event.heartbeatTickId,
    sessionId: event.sessionId,
    observationId: event.observationId,
    thoughtId: event.thoughtId,
    decisionId: event.decisionId,
    turnId: event.turnId,
    result: event.result,
    failureLayer: event.failureLayer,
    reasonCodes: event.reasonCodes,
    privateSummary: event.privateSummary,
    privateText: event.privateText,
    ...event.details,
  }
  return `[Nan0][${timestampLabel(event.timestamp)}][${event.event}] ${JSON.stringify(context)}`
}

export function serializeNan0DiagnosticJsonl(event: Readonly<Nan0KernelDiagnosticEvent>): string {
  return JSON.stringify(event)
}

export function createNan0KernelObservatory(options: {
  configuration?: Partial<Nan0KernelObservatoryConfiguration>
  sink?: Nan0KernelDiagnosticSink
  now?: () => number
  createId?: () => string
  console?: Pick<Console, 'info' | 'error'>
} = {}): Nan0KernelObservatory {
  let configuration: Nan0KernelObservatoryConfiguration = {
    ...NAN0_DEFAULT_OBSERVATORY_CONFIGURATION,
    ...options.configuration,
  }
  const sink = options.sink
  const now = options.now ?? Date.now
  const createId = options.createId ?? (() => globalThis.crypto?.randomUUID?.() ?? `${now()}-${Math.random().toString(36).slice(2)}`)
  const output = options.console ?? console
  const queue: Nan0KernelDiagnosticEvent[] = []
  const completedTickIds = new Set<string>()
  let scheduled = false
  let draining: Promise<void> | null = null
  let sinkFailureReported = false
  let overflowReported = false

  const drain = async (): Promise<void> => {
    if (!sink || draining)
      return draining ?? Promise.resolve()
    scheduled = false
    draining = (async () => {
      while (queue.length) {
        const batch = queue.splice(0, configuration.batchSize)
        try {
          await sink.write(batch)
        }
        catch (error) {
          if (!sinkFailureReported) {
            sinkFailureReported = true
            output.error(`[Nan0 Observatory] Diagnostic sink failed; cognition continues without blocking: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    })().finally(() => {
      draining = null
      if (queue.length)
        scheduleDrain()
    })
    return draining
  }

  const scheduleDrain = (): void => {
    if (!sink || scheduled || draining)
      return
    scheduled = true
    queueMicrotask(() => void drain())
  }

  const enqueue = (event: Nan0KernelDiagnosticEvent): void => {
    if (!sink)
      return
    if (queue.length >= configuration.bufferCapacity) {
      queue.splice(0, queue.length - configuration.bufferCapacity + 1)
      if (!overflowReported) {
        overflowReported = true
        output.error('[Nan0 Observatory] Diagnostic buffer overflowed; oldest diagnostic events were discarded.')
      }
    }
    queue.push(event)
    scheduleDrain()
  }

  const emit = (input: Nan0KernelDiagnosticInput): Nan0KernelDiagnosticEvent | null => {
    if (!configuration.enabled)
      return null
    const rawDetails = input.details ?? {}
    const tickId = input.heartbeatTickId ?? asString(rawDetails.heartbeatTickId) ?? asString(rawDetails.tickId)
    if (input.event === 'heartbeat.tick.completed' && tickId) {
      if (completedTickIds.has(tickId))
        return null
      completedTickIds.add(tickId)
      if (completedTickIds.size > 1_024)
        completedTickIds.delete(completedTickIds.values().next().value!)
    }
    const thought = input.privateThought ?? null
    const safeDetails = detailsRecord(rawDetails)
    delete safeDetails.privateThought
    delete safeDetails.privateText
    delete safeDetails.narrative
    const event: Nan0KernelDiagnosticEvent = {
      schemaVersion: 1,
      eventId: `diagnostic_${createId()}`,
      timestamp: input.timestamp ?? now(),
      event: bounded(input.event, 180),
      sessionId: input.sessionId ?? asString(rawDetails.sessionId),
      heartbeatTickId: tickId,
      observationId: input.observationId ?? asString(rawDetails.observationId),
      thoughtId: input.thoughtId ?? asString(rawDetails.thoughtId) ?? thought?.thoughtId ?? null,
      decisionId: input.decisionId ?? asString(rawDetails.decisionId),
      turnId: input.turnId ?? asString(rawDetails.turnId) ?? thought?.turnId ?? null,
      source: input.source ?? asString(rawDetails.source) ?? thought?.source ?? null,
      provenance: jsonSafe(input.provenance ?? rawDetails.provenance ?? null),
      result: input.result ?? terminalResult(rawDetails.result),
      failureLayer: input.failureLayer ?? asString(rawDetails.failureLayer),
      reasonCodes: reasonCodes(input.reasonCodes ?? rawDetails.reasonCodes),
      ...(thought ? { privateSummary: thoughtSummary(thought) } : {}),
      ...(thought && configuration.privateThoughts ? { privateText: thoughtText(thought) } : {}),
      details: safeDetails,
    }
    if (configuration.console) {
      const line = formatNan0DiagnosticConsoleLine(event, configuration.verbose)
      if (line)
        output.info(line)
    }
    enqueue(event)
    return event
  }

  return {
    emit,
    completeHeartbeatTick(input) {
      return emit({ ...input, event: 'heartbeat.tick.completed' })
    },
    configure(next) {
      configuration = {
        ...configuration,
        ...next,
        bufferCapacity: positiveInteger(next.bufferCapacity ?? configuration.bufferCapacity, configuration.bufferCapacity, 2_048),
        batchSize: positiveInteger(next.batchSize ?? configuration.batchSize, configuration.batchSize, 128),
      }
      if (queue.length > configuration.bufferCapacity)
        queue.splice(0, queue.length - configuration.bufferCapacity)
    },
    async flush() {
      while (queue.length || draining) {
        await drain()
        if (draining)
          await draining
      }
    },
  }
}
