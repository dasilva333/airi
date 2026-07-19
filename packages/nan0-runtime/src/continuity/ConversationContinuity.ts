import type {
  Nan0ContinuityContext,
  Nan0ContinuityContextThread,
  Nan0ContinuityState,
  Nan0ContinuityThreadStatus,
  Nan0ContinuityUnresolvedItem,
  Nan0ConversationThread,
  Nan0ConversationTurn,
  Nan0KernelState,
  Nan0MemoryRecord,
  Nan0TimelineEvent,
} from '../types'

export const CONTINUITY_DORMANT_AFTER_MS = 5 * 60 * 1000
export const CONTINUITY_GREETING_RESUME_WINDOW_MS = 30 * 60 * 1000
export const CONTINUITY_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000
export const CONTINUITY_MAX_THREADS = 10
export const CONTINUITY_MAX_CONTEXT_THREADS = 3
export const CONTINUITY_MAX_CARRYOVER_RECORDS = 6

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'because',
  'been',
  'before',
  'being',
  'but',
  'answer',
  'can',
  'change',
  'changes',
  'continuity',
  'could',
  'did',
  'does',
  'doing',
  'for',
  'from',
  'had',
  'has',
  'have',
  'her',
  'here',
  'him',
  'his',
  'how',
  'into',
  'its',
  'just',
  'kyo',
  'like',
  'more',
  'nan0',
  'not',
  'now',
  'our',
  'out',
  'please',
  'question',
  'really',
  'remember',
  'return',
  'should',
  'something',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'topic',
  'unrelated',
  'validation',
  'retest',
  'test',
])

const TERMINAL_STATUSES = new Set<Nan0ContinuityThreadStatus>([
  'resolved',
  'abandoned',
  'superseded',
])

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function boundedText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1).trimEnd()}…`
}

export function continuityTopicLabels(text: string, limit = 10): string[] {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  return unique(tokens.filter(token => token.length >= 3 && !STOP_WORDS.has(token))).slice(0, limit)
}

function unresolvedFromInput(turn: Nan0ConversationTurn, text: string): Nan0ContinuityUnresolvedItem[] {
  const questions = text.match(/[^?]{1,280}\?/g)
  const items: Nan0ContinuityUnresolvedItem[] = questions?.length
    ? [{
        itemId: `unresolved:${turn.turnId}:question`,
        kind: 'question',
        text: boundedText(questions.at(-1)!, 300),
        actorId: turn.inputActorId,
        createdAt: turn.startedAt,
        sourceTurnId: turn.turnId,
        resolvedAt: null,
        metadata: { deterministicExtraction: true },
      }]
    : []
  if (/\b(let'?s|we should|we need to|i need to|remember to)\b/i.test(text)) {
    items.push({
      itemId: `unresolved:${turn.turnId}:intention`,
      kind: 'intention',
      text: boundedText(text, 300),
      actorId: turn.inputActorId,
      createdAt: turn.startedAt,
      sourceTurnId: turn.turnId,
      resolvedAt: null,
      metadata: { deterministicExtraction: true },
    })
  }
  return items
}

function statusRank(status: Nan0ContinuityThreadStatus): number {
  switch (status) {
    case 'superseded': return 5
    case 'abandoned': return 4
    case 'resolved': return 3
    case 'active': return 2
    case 'dormant': return 1
  }
}

function normalizeUnresolvedItems(items: Nan0ContinuityUnresolvedItem[]): Nan0ContinuityUnresolvedItem[] {
  const byId = new Map<string, Nan0ContinuityUnresolvedItem>()
  for (const item of items) {
    if (!item?.itemId)
      continue
    const current = byId.get(item.itemId)
    if (!current || (item.resolvedAt ?? 0) > (current.resolvedAt ?? 0))
      byId.set(item.itemId, { ...item, metadata: { ...item.metadata } })
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.itemId.localeCompare(b.itemId))
}

function normalizeThread(thread: Nan0ConversationThread): Nan0ConversationThread {
  return {
    ...thread,
    schemaVersion: 1,
    participantActorIds: unique(thread.participantActorIds ?? []),
    topicLabels: unique(thread.topicLabels ?? []).slice(0, 16),
    turnIds: unique(thread.turnIds ?? []),
    timelineEventIds: unique(thread.timelineEventIds ?? []),
    summary: boundedText(thread.summary ?? '', 600),
    unresolvedItems: normalizeUnresolvedItems(thread.unresolvedItems ?? []),
    importance: clamp(thread.importance ?? 0.5),
    activation: clamp(thread.activation ?? 0),
    metadata: { ...thread.metadata },
  }
}

function rebuildActiveThreadMap(threads: Nan0ConversationThread[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const thread of [...threads].sort((a, b) => a.lastActiveAt - b.lastActiveAt)) {
    if (thread.status !== 'active')
      continue
    for (const actorId of thread.participantActorIds) {
      if (actorId !== 'nan0')
        result[actorId] = thread.threadId
    }
  }
  return result
}

export function createEmptyContinuityState(): Nan0ContinuityState {
  return {
    schemaVersion: 1,
    activeThreadByActorId: {},
    threads: [],
  }
}

export function normalizeContinuityState(value: Partial<Nan0ContinuityState> | undefined): Nan0ContinuityState {
  const byId = new Map<string, Nan0ConversationThread>()
  for (const raw of value?.threads ?? []) {
    if (!raw?.threadId)
      continue
    const thread = normalizeThread(raw)
    const current = byId.get(thread.threadId)
    if (!current || thread.updatedAt > current.updatedAt
      || (thread.updatedAt === current.updatedAt && statusRank(thread.status) > statusRank(current.status))) {
      byId.set(thread.threadId, thread)
    }
  }

  const threads = [...byId.values()]
    .sort((a, b) => a.createdAt - b.createdAt || a.threadId.localeCompare(b.threadId))
  return {
    schemaVersion: 1,
    activeThreadByActorId: rebuildActiveThreadMap(threads),
    threads,
  }
}

function mergeThread(left: Nan0ConversationThread, right: Nan0ConversationThread): Nan0ConversationThread {
  const newer = right.updatedAt > left.updatedAt
    ? right
    : right.updatedAt < left.updatedAt
      ? left
      : statusRank(right.status) > statusRank(left.status) ? right : left
  return normalizeThread({
    ...newer,
    createdAt: Math.min(left.createdAt, right.createdAt),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    lastActiveAt: Math.max(left.lastActiveAt, right.lastActiveAt),
    participantActorIds: [...left.participantActorIds, ...right.participantActorIds],
    topicLabels: [...left.topicLabels, ...right.topicLabels],
    turnIds: [...left.turnIds, ...right.turnIds],
    timelineEventIds: [...left.timelineEventIds, ...right.timelineEventIds],
    unresolvedItems: [...left.unresolvedItems, ...right.unresolvedItems],
    importance: Math.max(left.importance, right.importance),
    metadata: { ...left.metadata, ...right.metadata },
  })
}

export function mergeContinuityStates(
  persisted: Nan0ContinuityState | undefined,
  candidate: Nan0ContinuityState | undefined,
): Nan0ContinuityState {
  const left = normalizeContinuityState(persisted)
  const right = normalizeContinuityState(candidate)
  const byId = new Map(left.threads.map(thread => [thread.threadId, thread]))
  for (const thread of right.threads) {
    const current = byId.get(thread.threadId)
    byId.set(thread.threadId, current ? mergeThread(current, thread) : thread)
  }
  return normalizeContinuityState({ schemaVersion: 1, threads: [...byId.values()] })
}

export function decayContinuityState(state: Nan0ContinuityState, at: number): Nan0ContinuityState {
  const threads = state.threads.map((thread) => {
    if (TERMINAL_STATUSES.has(thread.status))
      return thread
    const elapsed = Math.max(0, at - thread.lastActiveAt)
    return {
      ...thread,
      status: thread.status === 'active' && elapsed >= CONTINUITY_DORMANT_AFTER_MS
        ? 'dormant' as const
        : thread.status,
      activation: clamp(thread.importance / (1 + elapsed / CONTINUITY_DORMANT_AFTER_MS)),
    }
  })
  return normalizeContinuityState({ schemaVersion: 1, threads })
}

function isAnaphoricFollowup(text: string): boolean {
  return /\b(it|that|this|those|they|them|he|she|there|then|earlier|before|continue|why|how so|what next)\b/i.test(text)
}

function isGreeting(text: string): boolean {
  return /^(hello|hi|hey|yo|i'?m back|back again|nan0)\b/i.test(text.trim())
}

function isExplicitShift(text: string): boolean {
  return /\b(new topic|switch(?:ing)? topics?|unrelated|different question|instead)\b/i.test(text)
}

function isExplicitResume(text: string): boolean {
  return /\b(return(?:ing)? to|back to|resume)\b/i.test(text)
}

function overlapScore(labels: string[], queryTerms: string[]): number {
  if (!labels.length || !queryTerms.length)
    return 0
  const labelSet = new Set(labels)
  const matches = queryTerms.filter(term => labelSet.has(term)).length
  return matches / Math.max(1, Math.min(labels.length, queryTerms.length))
}

function eligibleThreads(state: Nan0ContinuityState, actorId: string): Nan0ConversationThread[] {
  return state.threads.filter(thread => !TERMINAL_STATUSES.has(thread.status)
    && thread.participantActorIds.includes(actorId))
}

function selectThread(
  state: Nan0ContinuityState,
  actorId: string,
  text: string,
  at: number,
): Nan0ConversationThread | undefined {
  const candidates = eligibleThreads(state, actorId)
  const terms = continuityTopicLabels(text)
  if (isExplicitShift(text) && !isExplicitResume(text))
    return undefined
  const scored = candidates
    .map(thread => ({ thread, score: overlapScore(thread.topicLabels, terms) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score
      || b.thread.activation - a.thread.activation
      || b.thread.lastActiveAt - a.thread.lastActiveAt)

  if (scored[0])
    return scored[0].thread

  const currentId = state.activeThreadByActorId[actorId]
  const current = currentId ? candidates.find(thread => thread.threadId === currentId) : undefined
  if (current && !isExplicitShift(text)) {
    if (!terms.length || isAnaphoricFollowup(text))
      return current
  }

  if (isGreeting(text)) {
    return candidates
      .filter(thread => at - thread.lastActiveAt <= CONTINUITY_GREETING_RESUME_WINDOW_MS)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]
  }
  return undefined
}

function replaceThread(state: Nan0ContinuityState, replacement: Nan0ConversationThread): Nan0ContinuityState {
  return normalizeContinuityState({
    schemaVersion: 1,
    threads: state.threads.map(thread => thread.threadId === replacement.threadId ? replacement : thread),
  })
}

function createThread(input: {
  threadId: string
  turn: Nan0ConversationTurn
  inputEvent: Nan0TimelineEvent
  text: string
  at: number
  metadata?: Record<string, unknown>
}): Nan0ConversationThread {
  const unresolvedItems = unresolvedFromInput(input.turn, input.text)
  return normalizeThread({
    schemaVersion: 1,
    threadId: input.threadId,
    status: 'active',
    createdAt: input.at,
    updatedAt: input.at,
    lastActiveAt: input.at,
    participantActorIds: unique([input.turn.inputActorId, 'nan0']),
    topicLabels: continuityTopicLabels(input.text),
    turnIds: [input.turn.turnId],
    timelineEventIds: [input.inputEvent.eventId],
    summary: boundedText(input.text, 600),
    unresolvedItems,
    importance: clamp(0.5 + (unresolvedItems.length ? 0.1 : 0)),
    activation: 1,
    metadata: {
      deterministicLinkage: true,
      source: input.turn.source,
      sessionId: input.turn.sessionId,
      ...input.metadata,
    },
  })
}

export function attachPreparedTurnToContinuity(
  original: Nan0ContinuityState,
  input: {
    createThreadId: () => string
    turn: Nan0ConversationTurn
    inputEvent: Nan0TimelineEvent
    text: string
    at: number
  },
): { continuity: Nan0ContinuityState, thread: Nan0ConversationThread, resumed: boolean } {
  let continuity = decayContinuityState(original, input.at)
  const duplicate = continuity.threads.find(thread => thread.turnIds.includes(input.turn.turnId))
  if (duplicate)
    return { continuity, thread: duplicate, resumed: false }

  const matched = selectThread(continuity, input.turn.inputActorId, input.text, input.at)
  if (!matched) {
    const priorId = continuity.activeThreadByActorId[input.turn.inputActorId]
    continuity = normalizeContinuityState({
      schemaVersion: 1,
      threads: continuity.threads.map(thread => thread.threadId === priorId && thread.status === 'active'
        ? { ...thread, status: 'dormant' as const, updatedAt: input.at }
        : thread),
    })
    const created = createThread({
      threadId: input.createThreadId(),
      turn: input.turn,
      inputEvent: input.inputEvent,
      text: input.text,
      at: input.at,
    })
    continuity = normalizeContinuityState({
      schemaVersion: 1,
      threads: [...continuity.threads, created]
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
        .slice(0, CONTINUITY_MAX_THREADS),
    })
    return { continuity, thread: created, resumed: false }
  }

  const resumed = matched.status === 'dormant'
  const unresolvedItems = unresolvedFromInput(input.turn, input.text)
  const updated = normalizeThread({
    ...matched,
    status: 'active',
    updatedAt: input.at,
    lastActiveAt: input.at,
    participantActorIds: [...matched.participantActorIds, input.turn.inputActorId, 'nan0'],
    // New observations are retrieval evidence; retain them ahead of older saturated labels.
    topicLabels: [...continuityTopicLabels(input.text), ...matched.topicLabels],
    turnIds: [...matched.turnIds, input.turn.turnId],
    timelineEventIds: [...matched.timelineEventIds, input.inputEvent.eventId],
    unresolvedItems: [...matched.unresolvedItems, ...unresolvedItems],
    importance: clamp(matched.importance + (unresolvedItems.length ? 0.05 : 0)),
    activation: 1,
    metadata: {
      ...matched.metadata,
      sessionId: input.turn.sessionId,
      reactivationCount: Number(matched.metadata.reactivationCount ?? 0) + (resumed ? 1 : 0),
      lastResumedAt: resumed ? input.at : matched.metadata.lastResumedAt,
    },
  })
  continuity = replaceThread(continuity, updated)
  return { continuity, thread: updated, resumed }
}

export function attachTerminalEventToContinuity(
  state: Nan0ContinuityState,
  input: {
    turn: Nan0ConversationTurn
    event: Nan0TimelineEvent
    actorId?: string
    content?: string
    at: number
  },
): Nan0ContinuityState {
  const thread = state.threads.find(item => item.turnIds.includes(input.turn.turnId))
  if (!thread || thread.timelineEventIds.includes(input.event.eventId))
    return state
  const promise = input.actorId === 'nan0' && input.content
    && /\b(i'?ll|i will|i promise|we should)\b/i.test(input.content)
    ? [{
        itemId: `unresolved:${input.turn.turnId}:promise`,
        kind: 'promise' as const,
        text: boundedText(input.content, 300),
        actorId: 'nan0',
        createdAt: input.event.observedAt,
        sourceTurnId: input.turn.turnId,
        resolvedAt: null,
        metadata: { deterministicExtraction: true },
      }]
    : []
  return replaceThread(state, normalizeThread({
    ...thread,
    updatedAt: input.at,
    lastActiveAt: Math.max(thread.lastActiveAt, input.event.observedAt),
    participantActorIds: input.actorId
      ? [...thread.participantActorIds, input.actorId]
      : thread.participantActorIds,
    timelineEventIds: [...thread.timelineEventIds, input.event.eventId],
    topicLabels: input.content
      ? [...continuityTopicLabels(input.content), ...thread.topicLabels]
      : thread.topicLabels,
    unresolvedItems: [...thread.unresolvedItems, ...promise],
    activation: 1,
  }))
}

export function setContinuityThreadStatus(
  state: Nan0ContinuityState,
  threadId: string,
  status: Nan0ContinuityThreadStatus,
  at: number,
): Nan0ContinuityState {
  const thread = state.threads.find(item => item.threadId === threadId)
  if (!thread)
    return state
  return replaceThread(state, { ...thread, status, updatedAt: at })
}

export function resolveContinuityItem(
  state: Nan0ContinuityState,
  threadId: string,
  itemId: string,
  at: number,
): Nan0ContinuityState {
  const thread = state.threads.find(item => item.threadId === threadId)
  if (!thread)
    return state
  return replaceThread(state, {
    ...thread,
    updatedAt: at,
    unresolvedItems: thread.unresolvedItems.map(item => item.itemId === itemId
      ? { ...item, resolvedAt: at }
      : item),
  })
}

function memoryById(memories: Nan0MemoryRecord[]): Map<string, Nan0MemoryRecord> {
  return new Map(memories.map(memory => [memory.id, memory]))
}

function carryoverForThread(
  thread: Nan0ConversationThread,
  turns: Nan0ConversationTurn[],
  memories: Nan0MemoryRecord[],
): Nan0ContinuityContextThread['recentCarryover'] {
  const byTurn = new Map(turns.map(turn => [turn.turnId, turn]))
  const byMemory = memoryById(memories)
  const result: Nan0ContinuityContextThread['recentCarryover'] = []
  for (const turnId of thread.turnIds.slice(-4)) {
    const turn = byTurn.get(turnId)
    if (!turn)
      continue
    const references = [turn.inputContentReference, turn.outputContentReference].filter(Boolean) as string[]
    for (const reference of references) {
      const memory = byMemory.get(reference)
      if (!memory)
        continue
      result.push({
        actorId: memory.actorId ?? 'unknown',
        content: boundedText(memory.content, 280),
        turnId: turn.turnId,
        thoughtId: turn.thoughtId,
      })
    }
  }
  return result.slice(-CONTINUITY_MAX_CARRYOVER_RECORDS)
}

export function continuityContextForTurn(input: {
  continuity: Nan0ContinuityState
  currentThreadId: string
  query: string
  turns: Nan0ConversationTurn[]
  memories: Nan0MemoryRecord[]
  at: number
  resumed: boolean
}): Nan0ContinuityContext {
  const continuity = decayContinuityState(input.continuity, input.at)
  const terms = continuityTopicLabels(input.query)
  const current = continuity.threads.find(thread => thread.threadId === input.currentThreadId)
  const related = continuity.threads
    .filter(thread => thread.threadId !== input.currentThreadId && !TERMINAL_STATUSES.has(thread.status))
    .map(thread => ({ thread, score: overlapScore(thread.topicLabels, terms) }))
    .filter(item => item.score > 0 && item.thread.activation >= 0.05)
    .sort((a, b) => b.score - a.score || b.thread.activation - a.thread.activation)
    .map(item => item.thread)
  const selected = [current, ...related].filter(Boolean).slice(0, CONTINUITY_MAX_CONTEXT_THREADS) as Nan0ConversationThread[]
  const emittedSummaries = new Set<string>()
  const threads = selected.map((thread) => {
    const summary = emittedSummaries.has(thread.summary) ? '' : thread.summary
    if (summary)
      emittedSummaries.add(summary)
    return {
      threadId: thread.threadId,
      status: thread.status,
      activation: thread.activation,
      topicLabels: [...thread.topicLabels],
      summary,
      unresolvedItems: thread.unresolvedItems
        .filter(item => item.resolvedAt == null)
        .slice(-3)
        .map(item => item.text),
      recentCarryover: carryoverForThread(thread, input.turns, input.memories),
      inactiveForMs: Math.max(0, input.at - thread.lastActiveAt),
      resumed: thread.threadId === input.currentThreadId && input.resumed,
    }
  })
  return {
    provider: 'conversation_continuity',
    factsOnly: true,
    currentThreadId: input.currentThreadId,
    threads,
  }
}

export function migrateLegacyContinuity(state: Nan0KernelState): Nan0KernelState {
  let continuity = normalizeContinuityState((state as Nan0KernelState & { continuity?: Nan0ContinuityState }).continuity)
  const memberTurnIds = new Set(continuity.threads.flatMap(thread => thread.turnIds))
  const memories = memoryById(state.memories)
  for (const turn of state.turns) {
    if (memberTurnIds.has(turn.turnId))
      continue
    const inputMemory = memories.get(turn.inputContentReference)
    const text = inputMemory?.content ?? ''
    const migrated = createThread({
      threadId: `thread:legacy:${turn.turnId}`,
      turn,
      inputEvent: state.timeline.events.find(event => event.eventId === turn.inputEventId) ?? {
        schemaVersion: 1,
        eventId: turn.inputEventId,
        eventType: 'input',
        actorId: turn.inputActorId,
        source: turn.source,
        sessionId: turn.sessionId,
        turnId: turn.turnId,
        thoughtId: turn.thoughtId,
        observedAt: turn.startedAt,
        recordedAt: turn.startedAt,
        sequence: turn.sequence,
        memoryReference: turn.inputContentReference,
        metadata: { continuityMigrationFallback: true },
      },
      text,
      at: turn.startedAt,
      metadata: { migratedFromTurn: true },
    })
    migrated.status = 'dormant'
    migrated.updatedAt = turn.completedAt ?? turn.startedAt
    migrated.lastActiveAt = turn.completedAt ?? turn.startedAt
    migrated.timelineEventIds = unique([turn.inputEventId, turn.outputEventId].filter(Boolean) as string[])
    migrated.participantActorIds = unique([turn.inputActorId, turn.outputActorId].filter(Boolean) as string[])
    migrated.activation = 0
    continuity = normalizeContinuityState({
      schemaVersion: 1,
      threads: [...continuity.threads, migrated],
    })
    memberTurnIds.add(turn.turnId)
  }
  return { ...state, continuity }
}
