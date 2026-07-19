import type {
  Nan0ConversationTurn,
  Nan0KernelState,
  Nan0MemoryRecord,
  Nan0ObservationSource,
  Nan0SubjectiveTime,
  Nan0TimelineEvent,
  Nan0TimelineSession,
  Nan0TimelineState,
} from '../types'

const LEGACY_SESSION_ID = 'legacy'

function asSource(value: unknown): Nan0ObservationSource {
  switch (value) {
    case 'chat':
    case 'discord':
    case 'voice':
    case 'vision':
    case 'system':
    case 'temporal':
      return value
    default:
      return 'system'
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function turnStatusRank(turn: Nan0ConversationTurn): number {
  switch (turn.status) {
    case 'completed':
    case 'silent':
      return 3
    case 'failed':
    case 'cancelled':
      return 2
    case 'prepared':
      return 1
  }
}

export function createEmptyTimelineState(): Nan0TimelineState {
  return {
    schemaVersion: 1,
    nextSequence: 1,
    nextTurnSequence: 1,
    activeSessionId: null,
    sessions: {},
    events: [],
  }
}

export function normalizeTimelineState(value: Partial<Nan0TimelineState> | undefined): Nan0TimelineState {
  const eventById = new Map<string, Nan0TimelineEvent>()
  for (const event of value?.events ?? []) {
    if (!event?.eventId || eventById.has(event.eventId))
      continue
    eventById.set(event.eventId, { ...event, schemaVersion: 1 })
  }

  const events = [...eventById.values()]
    .sort((a, b) => a.sequence - b.sequence
      || a.observedAt - b.observedAt
      || a.recordedAt - b.recordedAt
      || a.eventId.localeCompare(b.eventId))
    .map((event, index) => ({ ...event, sequence: index + 1 }))

  return {
    schemaVersion: 1,
    nextSequence: events.length + 1,
    nextTurnSequence: Math.max(1, value?.nextTurnSequence ?? 1),
    activeSessionId: value?.activeSessionId ?? null,
    sessions: { ...value?.sessions },
    events,
  }
}

export function normalizeConversationTurns(turns: Nan0ConversationTurn[] | undefined): Nan0ConversationTurn[] {
  const turnById = new Map<string, Nan0ConversationTurn>()
  for (const turn of turns ?? []) {
    if (!turn?.turnId)
      continue
    const current = turnById.get(turn.turnId)
    if (!current || turnStatusRank(turn) > turnStatusRank(current)
      || (turnStatusRank(turn) === turnStatusRank(current)
        && (turn.completedAt ?? 0) > (current.completedAt ?? 0))) {
      turnById.set(turn.turnId, {
        ...turn,
        schemaVersion: 2,
        proposedDecision: turn.proposedDecision
          ?? (typeof turn.metadata?.proposedDecision === 'string' ? turn.metadata.proposedDecision : undefined),
      })
    }
  }

  return [...turnById.values()]
    .sort((a, b) => a.sequence - b.sequence || a.startedAt - b.startedAt || a.turnId.localeCompare(b.turnId))
    .map((turn, index) => ({ ...turn, sequence: index + 1 }))
}

export function mergeTimelineStates(
  persisted: Nan0TimelineState | undefined,
  candidate: Nan0TimelineState | undefined,
): Nan0TimelineState {
  const left = normalizeTimelineState(persisted)
  const right = normalizeTimelineState(candidate)
  const sessions: Record<string, Nan0TimelineSession> = { ...left.sessions }

  for (const [sessionId, session] of Object.entries(right.sessions)) {
    const current = sessions[sessionId]
    sessions[sessionId] = current
      ? {
          ...session,
          startedAt: Math.min(current.startedAt, session.startedAt),
          resumedAt: Math.max(current.resumedAt, session.resumedAt),
          endedAt: Math.max(current.endedAt ?? 0, session.endedAt ?? 0) || null,
          metadata: { ...current.metadata, ...session.metadata },
        }
      : session
  }

  const merged = normalizeTimelineState({
    schemaVersion: 1,
    nextSequence: Math.max(left.nextSequence, right.nextSequence),
    nextTurnSequence: Math.max(left.nextTurnSequence, right.nextTurnSequence),
    activeSessionId: right.activeSessionId ?? left.activeSessionId,
    sessions,
    events: [...left.events, ...right.events],
  })
  merged.nextTurnSequence = Math.max(left.nextTurnSequence, right.nextTurnSequence)
  return merged
}

export function mergeConversationTurns(
  persisted: Nan0ConversationTurn[] | undefined,
  candidate: Nan0ConversationTurn[] | undefined,
): Nan0ConversationTurn[] {
  return normalizeConversationTurns([...(persisted ?? []), ...(candidate ?? [])])
}

export function ensureTimelineSession(
  timeline: Nan0TimelineState,
  input: {
    sessionId: string
    source: Nan0ObservationSource
    observedAt: number
    metadata?: Record<string, unknown>
  },
): Nan0TimelineState {
  const current = timeline.sessions[input.sessionId]
  const session: Nan0TimelineSession = current
    ? {
        ...current,
        startedAt: Math.min(current.startedAt, input.observedAt),
        resumedAt: Math.max(current.resumedAt, input.observedAt),
        metadata: { ...current.metadata, ...input.metadata },
      }
    : {
        schemaVersion: 1,
        sessionId: input.sessionId,
        source: input.source,
        startedAt: input.observedAt,
        resumedAt: input.observedAt,
        endedAt: null,
        metadata: { ...input.metadata },
      }

  return {
    ...timeline,
    activeSessionId: input.sessionId,
    sessions: {
      ...timeline.sessions,
      [input.sessionId]: session,
    },
  }
}

export function appendTimelineEvent(
  timeline: Nan0TimelineState,
  input: Omit<Nan0TimelineEvent, 'schemaVersion' | 'sequence'>,
): { timeline: Nan0TimelineState, event: Nan0TimelineEvent } {
  const existing = timeline.events.find(event => event.eventId === input.eventId)
  if (existing)
    return { timeline, event: existing }

  const event: Nan0TimelineEvent = {
    ...input,
    schemaVersion: 1,
    sequence: timeline.nextSequence,
  }
  return {
    event,
    timeline: {
      ...timeline,
      nextSequence: timeline.nextSequence + 1,
      events: [...timeline.events, event],
    },
  }
}

function memorySource(memory: Nan0MemoryRecord): Nan0ObservationSource {
  return asSource((memory.metadata.ownership as any)?.source ?? memory.tags[0])
}

function memorySessionId(memory: Nan0MemoryRecord): string {
  return memory.sessionId
    ?? stringValue(memory.metadata.sessionId)
    ?? LEGACY_SESSION_ID
}

function memoryThoughtId(memory: Nan0MemoryRecord): string | null {
  return stringValue(memory.metadata.thoughtId) ?? null
}

function isOutputMemory(memory: Nan0MemoryRecord): boolean {
  return memory.tags.includes('assistant-output') || memory.tags.includes('nan0-expression')
}

function isInputMemory(memory: Nan0MemoryRecord): boolean {
  return memory.tags.includes('user-input')
}

export function migrateLegacyTimeline(state: Nan0KernelState): Nan0KernelState {
  let timeline = normalizeTimelineState(state.timeline)
  let turns = normalizeConversationTurns(state.turns)
  const orderedMemories = [...state.memories]
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))

  for (const memory of orderedMemories) {
    const sessionId = memorySessionId(memory)
    const source = memorySource(memory)
    timeline = ensureTimelineSession(timeline, {
      sessionId,
      source,
      observedAt: memory.createdAt,
      metadata: { migratedFromMemory: true },
    })

    if (timeline.events.some(event => event.memoryReference === memory.id))
      continue

    const eventId = `event:${memory.id}`
    const thoughtId = memoryThoughtId(memory)
    const appended = appendTimelineEvent(timeline, {
      eventId,
      eventType: isOutputMemory(memory) ? 'output' : isInputMemory(memory) ? 'input' : 'legacy-memory',
      actorId: isOutputMemory(memory) ? 'nan0' : memory.actorId ?? 'unknown',
      source,
      sessionId,
      turnId: null,
      thoughtId,
      observedAt: memory.createdAt,
      recordedAt: memory.createdAt,
      memoryReference: memory.id,
      metadata: {
        migratedFromMemory: true,
        tags: [...memory.tags],
      },
    })
    timeline = appended.timeline
  }

  const eventsByMemory = new Map(
    timeline.events
      .filter(event => event.memoryReference)
      .map(event => [event.memoryReference as string, event]),
  )
  const outputsByThought = new Map<string, Nan0MemoryRecord>()
  for (const memory of orderedMemories) {
    const thoughtId = memoryThoughtId(memory)
    if (thoughtId && isOutputMemory(memory) && memory.actorId === 'nan0' && !outputsByThought.has(thoughtId))
      outputsByThought.set(thoughtId, memory)
  }

  for (const input of orderedMemories) {
    const thoughtId = memoryThoughtId(input)
    if (!thoughtId || !isInputMemory(input) || input.actorId === 'nan0')
      continue
    if (turns.some(turn => turn.thoughtId === thoughtId))
      continue

    const output = outputsByThought.get(thoughtId)
    const inputEvent = eventsByMemory.get(input.id)
    const outputEvent = output ? eventsByMemory.get(output.id) : undefined
    if (!output || !inputEvent || !outputEvent)
      continue

    const turnId = `turn:${thoughtId}`
    turns = normalizeConversationTurns([...turns, {
      schemaVersion: 1,
      turnId,
      thoughtId,
      sessionId: inputEvent.sessionId,
      sequence: timeline.nextTurnSequence,
      source: inputEvent.source,
      startedAt: input.createdAt,
      completedAt: output.createdAt,
      elapsedMs: Math.max(0, output.createdAt - input.createdAt),
      inputEventId: inputEvent.eventId,
      outputEventId: outputEvent.eventId,
      inputActorId: input.actorId ?? 'unknown',
      outputActorId: 'nan0',
      inputContentReference: input.id,
      outputContentReference: output.id,
      decision: 'SPEAK',
      status: 'completed',
      metadata: { migratedFromMemories: true },
    }])
    timeline = {
      ...timeline,
      nextTurnSequence: turns.length + 1,
      events: timeline.events.map(event => event.eventId === inputEvent.eventId || event.eventId === outputEvent.eventId
        ? { ...event, turnId }
        : event),
    }
  }

  return {
    ...state,
    turns,
    timeline: {
      ...timeline,
      nextTurnSequence: turns.length + 1,
    },
  }
}

export function timelineEvents(
  timeline: Nan0TimelineState,
  filter: { sessionId?: string, actorId?: string } = {},
): Nan0TimelineEvent[] {
  return timeline.events
    .filter(event => !filter.sessionId || event.sessionId === filter.sessionId)
    .filter(event => !filter.actorId || event.actorId === filter.actorId)
    .sort((a, b) => a.sequence - b.sequence || a.eventId.localeCompare(b.eventId))
    .map(event => structuredClone(event))
}

export function elapsedBetweenEvents(first: Nan0TimelineEvent, second: Nan0TimelineEvent): number {
  return Math.max(0, second.observedAt - first.observedAt)
}

export function subjectiveTime(
  timeline: Nan0TimelineState,
  at: number,
  sessionId: string | null = timeline.activeSessionId,
): Nan0SubjectiveTime {
  const events = timelineEvents(timeline, sessionId ? { sessionId } : {})
  const session = sessionId ? timeline.sessions[sessionId] : undefined
  const lastKyo = [...events].reverse().find(event => event.actorId === 'kyo')
  const lastNan0 = [...events].reverse().find(event => event.actorId === 'nan0'
    && (event.eventType === 'output' || event.eventType === 'silence'))

  return {
    at,
    sessionId,
    sinceSessionStartMs: session ? Math.max(0, at - session.startedAt) : null,
    sinceLastKyoInteractionMs: lastKyo ? Math.max(0, at - lastKyo.observedAt) : null,
    sinceLastNan0ExpressionMs: lastNan0 ? Math.max(0, at - lastNan0.observedAt) : null,
  }
}
