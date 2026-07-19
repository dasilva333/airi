import type {
  Nan0AttentionFocus,
  Nan0AttentionState,
  Nan0AttentionStream,
  Nan0AttentionStreamType,
  Nan0EmotionalVector,
  Nan0Goal,
  Nan0InternalObservation,
  Nan0InternalObservationQueueState,
  Nan0InternalObservationRecord,
  Nan0MemoryRecord,
  Nan0Observation,
} from '../types'

import { emotionalAttentionWeight, normalizeEmotionalVector } from '../emotional/Nan0EmotionalDynamics'

const DEFAULT_QUEUE_CAPACITY = 64
const MAX_ATTENTION_HISTORY = 128
const MAX_QUEUE_RECORDS = 192

const STREAM_DEFINITIONS: ReadonlyArray<Omit<Nan0AttentionStream, 'streamId' | 'queuedObservationIds' | 'lastActivityAt'>> = [
  { streamType: 'user-input', basePriority: 0.65, canInterrupt: true, requiresSustainedFocus: false },
  { streamType: 'internal:heartbeat', basePriority: 0.3, canInterrupt: false, requiresSustainedFocus: false },
  { streamType: 'internal:temporal', basePriority: 0.7, canInterrupt: true, requiresSustainedFocus: false },
  { streamType: 'internal:goal', basePriority: 0.55, canInterrupt: false, requiresSustainedFocus: true },
  { streamType: 'internal:emotional', basePriority: 0.45, canInterrupt: false, requiresSustainedFocus: false },
  { streamType: 'internal:prediction', basePriority: 0.6, canInterrupt: true, requiresSustainedFocus: false },
  { streamType: 'system:event', basePriority: 0.85, canInterrupt: true, requiresSustainedFocus: false },
  { streamType: 'bridge:action', basePriority: 0.6, canInterrupt: true, requiresSustainedFocus: false },
]

function clamp(value: unknown, fallback = 0): number {
  return Math.min(1, Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : fallback))
}

function bounded(value: unknown, limit = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function streamId(type: Nan0AttentionStreamType): string {
  return `attention:${type}`
}

export function attentionStreamTypeForObservation(observation: Readonly<Nan0Observation>): Nan0AttentionStreamType {
  const explicit = observation.metadata.attentionStream
  if (typeof explicit === 'string' && STREAM_DEFINITIONS.some(item => item.streamType === explicit))
    return explicit as Nan0AttentionStreamType
  if (observation.source === 'system' || observation.source.startsWith('system:'))
    return 'system:event'
  if (observation.source.startsWith('bridge:'))
    return 'bridge:action'
  if (observation.source.startsWith('internal:temporal'))
    return 'internal:temporal'
  if (observation.source.startsWith('internal:goal'))
    return 'internal:goal'
  if (observation.source.startsWith('internal:emotional'))
    return 'internal:emotional'
  if (observation.source.startsWith('internal:prediction'))
    return 'internal:prediction'
  if (observation.source.startsWith('internal:'))
    return 'internal:heartbeat'
  return 'user-input'
}

export function createEmptyAttentionState(at = 0): Nan0AttentionState {
  const streams: Record<string, Nan0AttentionStream> = {}
  for (const definition of STREAM_DEFINITIONS) {
    const id = streamId(definition.streamType)
    streams[id] = { ...definition, streamId: id, queuedObservationIds: [], lastActivityAt: at }
  }
  return {
    schemaVersion: 1,
    revision: 0,
    currentFocus: null,
    interruptedFocus: null,
    streams,
    history: [],
    currentTopic: null,
    distractionScore: 0,
    focusDepth: 0,
  }
}

function normalizeFocus(value: Partial<Nan0AttentionFocus> | null | undefined): Nan0AttentionFocus | null {
  if (!value?.streamId || !value.observationId || !Number.isFinite(value.startedAt))
    return null
  return {
    streamId: bounded(value.streamId),
    observationId: bounded(value.observationId),
    startedAt: Number(value.startedAt),
    priority: clamp(value.priority, 0.5),
    canBeInterrupted: value.canBeInterrupted !== false,
    interruptedAt: Number.isFinite(value.interruptedAt) ? Number(value.interruptedAt) : null,
  }
}

export function normalizeAttentionState(
  value: Partial<Nan0AttentionState> | null | undefined,
  fallbackAt = 0,
): Nan0AttentionState {
  const base = createEmptyAttentionState(fallbackAt)
  const streams = structuredClone(base.streams)
  for (const candidate of Object.values(value?.streams ?? {})) {
    if (!candidate?.streamId || !STREAM_DEFINITIONS.some(item => item.streamType === candidate.streamType))
      continue
    const definition = STREAM_DEFINITIONS.find(item => item.streamType === candidate.streamType)!
    streams[candidate.streamId] = {
      ...definition,
      ...structuredClone(candidate),
      streamId: bounded(candidate.streamId),
      basePriority: clamp(candidate.basePriority, definition.basePriority),
      queuedObservationIds: [...new Set((candidate.queuedObservationIds ?? []).map(id => bounded(id)).filter(Boolean))].slice(-DEFAULT_QUEUE_CAPACITY),
      lastActivityAt: Number.isFinite(candidate.lastActivityAt) ? Number(candidate.lastActivityAt) : fallbackAt,
      canInterrupt: candidate.canInterrupt !== false,
      requiresSustainedFocus: candidate.requiresSustainedFocus === true,
    }
  }
  const history = (value?.history ?? [])
    .filter(item => item?.observationId && item.streamId && Number.isFinite(item.focusedAt) && Number.isFinite(item.completedAt))
    .map(item => ({
      observationId: bounded(item.observationId),
      streamId: bounded(item.streamId),
      focusedAt: Number(item.focusedAt),
      completedAt: Number(item.completedAt),
      durationMs: Math.max(0, Number(item.durationMs) || Number(item.completedAt) - Number(item.focusedAt)),
      priority: clamp(item.priority, 0.5),
      outcome: bounded(item.outcome, 80) || 'unknown',
    }))
    .sort((left, right) => left.completedAt - right.completedAt || left.observationId.localeCompare(right.observationId))
    .slice(-MAX_ATTENTION_HISTORY)
  return {
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(value?.revision ?? 0)),
    currentFocus: normalizeFocus(value?.currentFocus),
    interruptedFocus: normalizeFocus(value?.interruptedFocus),
    streams,
    history,
    currentTopic: bounded(value?.currentTopic, 120) || null,
    distractionScore: clamp(value?.distractionScore),
    focusDepth: clamp(value?.focusDepth),
  }
}

export function mergeAttentionStates(
  persisted: Partial<Nan0AttentionState> | null | undefined,
  candidate: Partial<Nan0AttentionState> | null | undefined,
  fallbackAt = 0,
): Nan0AttentionState {
  const left = normalizeAttentionState(persisted, fallbackAt)
  const right = normalizeAttentionState(candidate, fallbackAt)
  const primary = right.revision >= left.revision ? right : left
  const secondary = primary === right ? left : right
  const streams: Record<string, Nan0AttentionStream> = {}
  for (const id of new Set([...Object.keys(secondary.streams), ...Object.keys(primary.streams)])) {
    const older = secondary.streams[id]
    const newer = primary.streams[id]
    if (!newer) {
      streams[id] = structuredClone(older)
      continue
    }
    streams[id] = {
      ...structuredClone(older ?? newer),
      ...structuredClone(newer),
      queuedObservationIds: [...new Set([...(older?.queuedObservationIds ?? []), ...newer.queuedObservationIds])].slice(-DEFAULT_QUEUE_CAPACITY),
      lastActivityAt: Math.max(older?.lastActivityAt ?? 0, newer.lastActivityAt),
    }
  }
  const historyByObservation = new Map(left.history.map(item => [item.observationId, item]))
  for (const item of right.history) {
    const existing = historyByObservation.get(item.observationId)
    if (!existing || item.completedAt >= existing.completedAt)
      historyByObservation.set(item.observationId, item)
  }
  return normalizeAttentionState({
    ...secondary,
    ...primary,
    revision: Math.max(left.revision, right.revision),
    streams,
    history: [...historyByObservation.values()],
  }, fallbackAt)
}

export function createEmptyInternalObservationQueue(capacity = DEFAULT_QUEUE_CAPACITY): Nan0InternalObservationQueueState {
  return { schemaVersion: 1, revision: 0, capacity: Math.max(8, Math.min(256, Math.floor(capacity))), records: [] }
}

function observationRecordStatusRank(status: Nan0InternalObservationRecord['status']): number {
  return status === 'handled' || status === 'discarded' ? 3 : status === 'focused' ? 2 : 1
}

export function normalizeInternalObservationQueue(
  value: Partial<Nan0InternalObservationQueueState> | null | undefined,
): Nan0InternalObservationQueueState {
  const capacity = Math.max(8, Math.min(256, Math.floor(value?.capacity ?? DEFAULT_QUEUE_CAPACITY)))
  const byId = new Map<string, Nan0InternalObservationRecord>()
  for (const candidate of value?.records ?? []) {
    const observation = candidate?.observation
    if (!observation?.id || !observation.source?.startsWith('internal:') || observation.actorId !== 'nan0')
      continue
    const record: Nan0InternalObservationRecord = {
      schemaVersion: 1,
      observation: {
        ...structuredClone(observation),
        actorId: 'nan0',
        metadata: structuredClone(observation.metadata ?? {}),
        timestamp: Number.isFinite(observation.timestamp) ? observation.timestamp : 0,
        priority: clamp(observation.priority ?? candidate.priority, 0.5),
      },
      priority: clamp(candidate.priority, 0.5),
      dedupeKey: bounded(candidate.dedupeKey, 240) || observation.id,
      streamType: STREAM_DEFINITIONS.some(item => item.streamType === candidate.streamType)
        ? candidate.streamType
        : attentionStreamTypeForObservation(observation),
      status: ['queued', 'focused', 'handled', 'discarded'].includes(candidate.status) ? candidate.status : 'queued',
      enqueuedAt: Number.isFinite(candidate.enqueuedAt) ? Number(candidate.enqueuedAt) : observation.timestamp,
      focusedAt: Number.isFinite(candidate.focusedAt) ? Number(candidate.focusedAt) : null,
      handledAt: Number.isFinite(candidate.handledAt) ? Number(candidate.handledAt) : null,
      thoughtId: bounded(candidate.thoughtId) || null,
      decisionId: bounded(candidate.decisionId) || null,
      outcome: bounded(candidate.outcome, 80) || null,
      metadata: structuredClone(candidate.metadata ?? {}),
    }
    const existing = byId.get(observation.id)
    if (!existing || observationRecordStatusRank(record.status) >= observationRecordStatusRank(existing.status))
      byId.set(observation.id, record)
  }
  const records = [...byId.values()]
    .sort((left, right) => left.enqueuedAt - right.enqueuedAt || left.observation.id.localeCompare(right.observation.id))
  const terminal = records.filter(record => record.status === 'handled' || record.status === 'discarded').slice(-Math.max(capacity, 64))
  const active = records.filter(record => record.status === 'queued' || record.status === 'focused').slice(-capacity)
  return {
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(value?.revision ?? 0)),
    capacity,
    records: [...terminal, ...active]
      .sort((left, right) => left.enqueuedAt - right.enqueuedAt || left.observation.id.localeCompare(right.observation.id))
      .slice(-MAX_QUEUE_RECORDS),
  }
}

export function mergeInternalObservationQueues(
  persisted: Partial<Nan0InternalObservationQueueState> | null | undefined,
  candidate: Partial<Nan0InternalObservationQueueState> | null | undefined,
): Nan0InternalObservationQueueState {
  const left = normalizeInternalObservationQueue(persisted)
  const right = normalizeInternalObservationQueue(candidate)
  const byId = new Map(left.records.map(record => [record.observation.id, record]))
  for (const record of right.records) {
    const existing = byId.get(record.observation.id)
    if (!existing || observationRecordStatusRank(record.status) > observationRecordStatusRank(existing.status)
      || observationRecordStatusRank(record.status) === observationRecordStatusRank(existing.status) && (record.handledAt ?? record.focusedAt ?? record.enqueuedAt) >= (existing.handledAt ?? existing.focusedAt ?? existing.enqueuedAt)) {
      byId.set(record.observation.id, record)
    }
  }
  return normalizeInternalObservationQueue({
    schemaVersion: 1,
    revision: Math.max(left.revision, right.revision),
    capacity: Math.max(left.capacity, right.capacity),
    records: [...byId.values()],
  })
}

export function scoreObservationPriority(input: {
  observation: Readonly<Nan0Observation>
  stream: Readonly<Nan0AttentionStream>
  emotionalState: Readonly<Nan0EmotionalVector>
  goals: readonly Nan0Goal[]
  currentTopic: string | null
  requestedPriority?: number
}): number {
  const text = typeof input.observation.content === 'string' ? input.observation.content : JSON.stringify(input.observation.content)
  let score = input.stream.basePriority * 0.55 + clamp(input.requestedPriority, input.stream.basePriority) * 0.45
  score += (emotionalAttentionWeight(input.emotionalState, text, input.observation.actorId) - 0.5) * 0.35
  const lower = text.toLowerCase()
  const terms = new Set(lower.match(/[a-z0-9]{4,}/g) ?? [])
  for (const goal of input.goals.filter(goal => goal.status === 'active' || goal.status === 'candidate')) {
    const goalTerms = new Set(`${goal.title} ${goal.description}`.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
    const overlap = [...goalTerms].filter(term => terms.has(term)).length
    if (overlap)
      score += Math.min(0.25, overlap * 0.05 + goal.importance * 0.08)
  }
  if (input.currentTopic && lower.includes(input.currentTopic.toLowerCase()))
    score += 0.08
  return clamp(score)
}

export function enqueueInternalObservation(input: {
  queue: Readonly<Nan0InternalObservationQueueState>
  attention: Readonly<Nan0AttentionState>
  observation: Nan0InternalObservation
  priority: number
  dedupeKey: string
  streamType?: Nan0AttentionStreamType
  at: number
}): { queue: Nan0InternalObservationQueueState, attention: Nan0AttentionState, enqueued: boolean, discardedObservationId: string | null } {
  let queue = normalizeInternalObservationQueue(input.queue)
  let attention = normalizeAttentionState(input.attention, input.at)
  const duplicate = queue.records.find(record => record.dedupeKey === input.dedupeKey && record.status !== 'discarded')
  if (duplicate)
    return { queue, attention, enqueued: false, discardedObservationId: null }

  const streamType = input.streamType ?? attentionStreamTypeForObservation(input.observation)
  const id = streamId(streamType)
  const stream = attention.streams[id]
  const record: Nan0InternalObservationRecord = {
    schemaVersion: 1,
    observation: { ...structuredClone(input.observation), actorId: 'nan0', priority: clamp(input.priority), metadata: structuredClone(input.observation.metadata ?? {}) },
    priority: clamp(input.priority),
    dedupeKey: bounded(input.dedupeKey, 240) || input.observation.id,
    streamType,
    status: 'queued',
    enqueuedAt: input.at,
    focusedAt: null,
    handledAt: null,
    thoughtId: null,
    decisionId: null,
    outcome: null,
    metadata: {},
  }
  const queued = queue.records.filter(item => item.status === 'queued')
  let discardedObservationId: string | null = null
  if (queued.length >= queue.capacity) {
    const discard = [...queued].sort((left, right) => left.priority - right.priority || left.enqueuedAt - right.enqueuedAt)[0]
    discardedObservationId = discard.observation.id
    queue = {
      ...queue,
      records: queue.records.map(item => item.observation.id === discard.observation.id
        ? { ...item, status: 'discarded' as const, handledAt: input.at, outcome: 'queue-overflow' }
        : item),
    }
    for (const existing of Object.values(attention.streams))
      existing.queuedObservationIds = existing.queuedObservationIds.filter(observationId => observationId !== discard.observation.id)
  }
  queue = normalizeInternalObservationQueue({ ...queue, revision: queue.revision + 1, records: [...queue.records, record] })
  attention = normalizeAttentionState({
    ...attention,
    revision: attention.revision + 1,
    streams: {
      ...attention.streams,
      [id]: {
        ...stream,
        queuedObservationIds: [...stream.queuedObservationIds, input.observation.id],
        lastActivityAt: input.at,
      },
    },
  }, input.at)
  return { queue, attention, enqueued: true, discardedObservationId }
}

export function beginObservationFocus(input: {
  attention: Readonly<Nan0AttentionState>
  observation: Readonly<Nan0Observation>
  priority: number
  at: number
}): { attention: Nan0AttentionState, interruptedObservationId: string | null } {
  const attention = normalizeAttentionState(input.attention, input.at)
  const streamType = attentionStreamTypeForObservation(input.observation)
  const id = streamId(streamType)
  const stream = attention.streams[id]
  const current = attention.currentFocus
  const canInterrupt = !current
    || streamType === 'user-input'
    || current.canBeInterrupted && input.priority >= current.priority + 0.2
  if (current && !canInterrupt)
    return { attention, interruptedObservationId: null }
  const nextFocus: Nan0AttentionFocus = {
    streamId: id,
    observationId: input.observation.id,
    startedAt: input.at,
    priority: clamp(input.priority),
    canBeInterrupted: !stream.requiresSustainedFocus,
    interruptedAt: null,
  }
  return {
    attention: normalizeAttentionState({
      ...attention,
      revision: attention.revision + 1,
      currentFocus: nextFocus,
      interruptedFocus: current ? { ...current, interruptedAt: input.at } : attention.interruptedFocus,
      distractionScore: current ? clamp(attention.distractionScore + 0.15) : attention.distractionScore,
      currentTopic: extractTopic(input.observation),
      streams: {
        ...attention.streams,
        [id]: { ...stream, lastActivityAt: input.at, queuedObservationIds: stream.queuedObservationIds.filter(item => item !== input.observation.id) },
      },
    }, input.at),
    interruptedObservationId: current?.observationId ?? null,
  }
}

export function selectNextInternalObservation(input: {
  queue: Readonly<Nan0InternalObservationQueueState>
  attention: Readonly<Nan0AttentionState>
  emotionalState: Readonly<Nan0EmotionalVector>
  goals: readonly Nan0Goal[]
  at: number
}): { queue: Nan0InternalObservationQueueState, attention: Nan0AttentionState, selected: Nan0InternalObservationRecord | null } {
  let queue = normalizeInternalObservationQueue(input.queue)
  let attention = normalizeAttentionState(input.attention, input.at)
  const candidates = queue.records
    .filter(record => record.status === 'queued')
    .map(record => ({
      record,
      score: scoreObservationPriority({
        observation: record.observation,
        stream: attention.streams[streamId(record.streamType)],
        emotionalState: input.emotionalState,
        goals: input.goals,
        currentTopic: attention.currentTopic,
        requestedPriority: record.priority,
      }),
    }))
    .sort((left, right) => right.score - left.score || left.record.enqueuedAt - right.record.enqueuedAt || left.record.observation.id.localeCompare(right.record.observation.id))
  const winner = candidates[0]
  if (!winner)
    return { queue, attention, selected: null }
  const focus = beginObservationFocus({ attention, observation: winner.record.observation, priority: winner.score, at: input.at })
  attention = focus.attention
  if (attention.currentFocus?.observationId !== winner.record.observation.id)
    return { queue, attention, selected: null }
  queue = normalizeInternalObservationQueue({
    ...queue,
    revision: queue.revision + 1,
    records: queue.records.map(record => record.observation.id === winner.record.observation.id
      ? { ...record, status: 'focused' as const, focusedAt: input.at, priority: winner.score }
      : record),
  })
  return {
    queue,
    attention,
    selected: queue.records.find(record => record.observation.id === winner.record.observation.id) ?? null,
  }
}

export function completeObservationFocus(input: {
  queue: Readonly<Nan0InternalObservationQueueState>
  attention: Readonly<Nan0AttentionState>
  observationId: string
  at: number
  outcome: string
  thoughtId?: string | null
  decisionId?: string | null
}): { queue: Nan0InternalObservationQueueState, attention: Nan0AttentionState } {
  let queue = normalizeInternalObservationQueue(input.queue)
  let attention = normalizeAttentionState(input.attention, input.at)
  const focus = attention.currentFocus?.observationId === input.observationId ? attention.currentFocus : null
  if (!focus && attention.currentFocus)
    return { queue, attention }
  queue = normalizeInternalObservationQueue({
    ...queue,
    revision: queue.revision + 1,
    records: queue.records.map(record => record.observation.id === input.observationId
      ? { ...record, status: 'handled' as const, handledAt: input.at, outcome: bounded(input.outcome, 80), thoughtId: input.thoughtId ?? null, decisionId: input.decisionId ?? null }
      : record),
  })
  const history = focus
    ? [...attention.history, {
        observationId: input.observationId,
        streamId: focus.streamId,
        focusedAt: focus.startedAt,
        completedAt: input.at,
        durationMs: Math.max(0, input.at - focus.startedAt),
        priority: focus.priority,
        outcome: bounded(input.outcome, 80),
      }]
    : attention.history
  const resume = attention.interruptedFocus
  attention = normalizeAttentionState({
    ...attention,
    revision: attention.revision + 1,
    currentFocus: resume ? { ...resume, interruptedAt: null, startedAt: input.at } : null,
    interruptedFocus: null,
    history,
    focusDepth: focus ? clamp(attention.focusDepth * 0.65 + (input.outcome === 'SPEAK' || input.outcome === 'SILENCE' ? 0.35 : 0.2)) : attention.focusDepth,
    distractionScore: clamp(attention.distractionScore * 0.85),
  }, input.at)
  return { queue, attention }
}

export function isObservationFocusAuthoritative(attention: Readonly<Nan0AttentionState>, observationId: string): boolean {
  const normalized = normalizeAttentionState(attention)
  return normalized.currentFocus == null || normalized.currentFocus.observationId === observationId
}

function extractTopic(observation: Readonly<Nan0Observation>): string | null {
  const text = typeof observation.content === 'string' ? observation.content : ''
  const tokens = text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []
  return tokens.find(token => !['this', 'that', 'with', 'from', 'have', 'will', 'your', 'about'].includes(token))?.slice(0, 80) ?? null
}

export function computeMemoryAttentionWeights(input: {
  memories: readonly Nan0MemoryRecord[]
  query: string
  actorId?: string
  emotionalState: Readonly<Nan0EmotionalVector>
  goals: readonly Nan0Goal[]
  attention: Readonly<Nan0AttentionState>
  at: number
}): Array<{ memory: Nan0MemoryRecord, score: number }> {
  const emotionalState = normalizeEmotionalVector(input.emotionalState)
  const queryTerms = new Set(input.query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
  return input.memories.map((memory) => {
    const content = memory.content.toLowerCase()
    let score = input.actorId && memory.actorId === input.actorId ? 1.5 : 0
    for (const term of queryTerms) {
      if (content.includes(term))
        score += 1
    }
    score += emotionalAttentionWeight(emotionalState, memory.content, memory.actorId) * 0.8
    score += Math.max(0, memory.emotionalWeight ?? 0)
    if (input.attention.currentTopic && content.includes(input.attention.currentTopic.toLowerCase()))
      score += 0.75
    for (const goal of input.goals.filter(goal => goal.status === 'active')) {
      const goalTerms = goal.title.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []
      if (goalTerms.some(term => content.includes(term)))
        score += goal.importance * 0.5
    }
    const age = Math.max(0, input.at - memory.createdAt)
    score += 0.5 ** (age / (7 * 86_400_000)) * 0.25
    return { memory, score }
  }).filter(item => item.score > 0).sort((left, right) => right.score - left.score || right.memory.createdAt - left.memory.createdAt || left.memory.id.localeCompare(right.memory.id))
}

export function composeAttentionContext(
  attentionValue: Readonly<Nan0AttentionState>,
  queueValue: Readonly<Nan0InternalObservationQueueState>,
): string {
  const attention = normalizeAttentionState(attentionValue)
  const queue = normalizeInternalObservationQueue(queueValue)
  const queued = queue.records.filter(record => record.status === 'queued')
    .sort((left, right) => right.priority - left.priority || left.enqueuedAt - right.enqueuedAt)
    .slice(0, 4)
    .map(record => ({ observationId: record.observation.id, stream: record.streamType, priority: record.priority, source: record.observation.source }))
  return JSON.stringify({
    provider: 'nan0_attention',
    factsOnly: true,
    currentFocus: attention.currentFocus
      ? { observationId: attention.currentFocus.observationId, streamId: attention.currentFocus.streamId, priority: attention.currentFocus.priority }
      : null,
    currentTopic: attention.currentTopic,
    focusDepth: attention.focusDepth,
    distractionScore: attention.distractionScore,
    queued,
  })
}
