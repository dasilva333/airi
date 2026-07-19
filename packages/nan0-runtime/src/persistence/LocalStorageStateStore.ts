import type { Nan0Clock, Nan0KernelState, Nan0StateStore } from '../types'

import {
  mergeAttentionStates,
  mergeInternalObservationQueues,
  normalizeAttentionState,
  normalizeInternalObservationQueue,
} from '../attention/Nan0AttentionEngine'
import {
  createEmptyContinuityState,
  mergeContinuityStates,
  normalizeContinuityState,
} from '../continuity/ConversationContinuity'
import { mergeNan0Decisions } from '../decision/Nan0DecisionEngine'
import { mergeEmotionalHistories, normalizeEmotionalHistory } from '../emotional/Nan0EmotionalDynamics'
import { mergeNan0Goals } from '../goals/Nan0Goals'
import { mergeHeartbeatRuntimeStates, normalizeHeartbeatRuntimeState } from '../heartbeat/Nan0HeartbeatEngine'
import { mergePendingIntentionStates, normalizePendingIntentionState } from '../intentions/Nan0PendingIntentions'
import { mergeActionIntents, mergeComputationAttempts } from '../lifecycle/Nan0Lifecycle'
import { mergePredictionStates, normalizePredictionState } from '../prediction/Nan0PredictionEngine'
import {
  createEmptyRelationshipState,
  mergeRelationshipStates,
  normalizeRelationshipState,
} from '../relationship/RelationshipMemory'
import { SystemNan0Clock } from '../temporal/Nan0Clock'
import { mergeTemporalStates, normalizeTemporalState } from '../temporal/Nan0Temporal'
import { mergeNan0Thoughts } from '../thought/Nan0ThoughtEngine'
import { mergeCognitionPolicyIdentity, normalizeCognitionPolicyIdentity } from '../thought/Nan0ThoughtPolicy'
import {
  createEmptyTimelineState,
  mergeConversationTurns,
  mergeTimelineStates,
  normalizeConversationTurns,
  normalizeTimelineState,
} from '../timeline/SessionTimeline'

export interface Nan0StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface LocalStorageStateStoreOptions {
  storage?: Nan0StorageLike
  clock?: Nan0Clock
  diagnostic?: (event: string, details: Record<string, unknown>) => void
}

function emotionalVector(value: Nan0KernelState['emotionalState'] | null | undefined): Nan0KernelState['emotionalState'] {
  return Object.fromEntries(
    Object.entries(value ?? {})
      .filter((entry): entry is [string, number] => Boolean(entry[0]) && Number.isFinite(entry[1])),
  )
}

function mergeEmotionalState(
  persisted: Nan0KernelState,
  candidate: Nan0KernelState,
): Pick<Nan0KernelState, 'emotionalState' | 'emotionalStateSchemaVersion' | 'emotionalStateRevision'> {
  const persistedRevision = Math.max(0, Math.floor(persisted.emotionalStateRevision ?? 0))
  const candidateRevision = Math.max(0, Math.floor(candidate.emotionalStateRevision ?? 0))
  const persistedVector = emotionalVector(persisted.emotionalState)
  const candidateVector = emotionalVector(candidate.emotionalState)
  return {
    emotionalStateSchemaVersion: 1,
    emotionalStateRevision: Math.max(persistedRevision, candidateRevision),
    emotionalState: candidateRevision >= persistedRevision
      ? { ...persistedVector, ...candidateVector }
      : { ...candidateVector, ...persistedVector },
  }
}

export function mergeNan0States(
  persisted: Nan0KernelState | null,
  candidate: Nan0KernelState,
  clock: Nan0Clock = new SystemNan0Clock(),
): Nan0KernelState {
  if (!persisted) {
    return {
      ...candidate,
      schemaVersion: 2,
      revision: (candidate.revision ?? 0) + 1,
      emotionalState: emotionalVector(candidate.emotionalState),
      emotionalStateSchemaVersion: 1,
      emotionalStateRevision: Math.max(0, Math.floor(candidate.emotionalStateRevision ?? 0)),
      emotionalHistory: normalizeEmotionalHistory(candidate.emotionalHistory, candidate.createdAt),
      attention: normalizeAttentionState(candidate.attention, candidate.createdAt),
      prediction: normalizePredictionState(candidate.prediction),
      internalObservations: normalizeInternalObservationQueue(candidate.internalObservations),
      heartbeat: normalizeHeartbeatRuntimeState(candidate.heartbeat),
      cognitionPolicy: normalizeCognitionPolicyIdentity(candidate.cognitionPolicy, candidate.createdAt),
      thoughts: mergeNan0Thoughts([], candidate.thoughts),
      decisions: mergeNan0Decisions([], candidate.decisions),
      goals: mergeNan0Goals([], candidate.goals),
      pendingIntentions: normalizePendingIntentionState(candidate.pendingIntentions, candidate.createdAt),
      computations: mergeComputationAttempts([], candidate.computations),
      actionIntents: mergeActionIntents([], candidate.actionIntents),
      turns: normalizeConversationTurns(candidate.turns),
      timeline: normalizeTimelineState(candidate.timeline),
      temporal: normalizeTemporalState(candidate.temporal, clock, candidate.createdAt),
      continuity: normalizeContinuityState(candidate.continuity),
      relationships: normalizeRelationshipState(candidate.relationships, candidate.createdAt),
    }
  }

  const memories = [...persisted.memories]
  const persistedMemoryIds = new Set(memories.map(memory => memory.id))
  for (const memory of candidate.memories) {
    if (!persistedMemoryIds.has(memory.id)) {
      memories.push(memory)
      persistedMemoryIds.add(memory.id)
    }
  }

  return {
    ...candidate,
    schemaVersion: 2,
    revision: Math.max(persisted.revision ?? 0, candidate.revision ?? 0) + 1,
    bootCount: Math.max(persisted.bootCount, candidate.bootCount),
    createdAt: Math.min(persisted.createdAt, candidate.createdAt),
    updatedAt: Math.max(persisted.updatedAt, candidate.updatedAt),
    ...mergeEmotionalState(persisted, candidate),
    emotionalHistory: mergeEmotionalHistories(persisted.emotionalHistory, candidate.emotionalHistory, Math.min(persisted.createdAt, candidate.createdAt)),
    attention: mergeAttentionStates(persisted.attention, candidate.attention, Math.min(persisted.createdAt, candidate.createdAt)),
    prediction: mergePredictionStates(persisted.prediction, candidate.prediction),
    internalObservations: mergeInternalObservationQueues(persisted.internalObservations, candidate.internalObservations),
    heartbeat: mergeHeartbeatRuntimeStates(persisted.heartbeat, candidate.heartbeat),
    cognitionPolicy: mergeCognitionPolicyIdentity(
      persisted.cognitionPolicy,
      candidate.cognitionPolicy,
      Math.min(persisted.createdAt, candidate.createdAt),
    ),
    identity: {
      actors: {
        ...candidate.identity.actors,
        ...persisted.identity.actors,
      },
      aliases: {
        ...candidate.identity.aliases,
        ...persisted.identity.aliases,
      },
    },
    memories,
    thoughts: mergeNan0Thoughts(persisted.thoughts, candidate.thoughts),
    decisions: mergeNan0Decisions(persisted.decisions, candidate.decisions),
    goals: mergeNan0Goals(persisted.goals, candidate.goals),
    pendingIntentions: mergePendingIntentionStates(persisted.pendingIntentions, candidate.pendingIntentions, Math.min(persisted.createdAt, candidate.createdAt)),
    computations: mergeComputationAttempts(persisted.computations, candidate.computations),
    actionIntents: mergeActionIntents(persisted.actionIntents, candidate.actionIntents),
    turns: mergeConversationTurns(persisted.turns, candidate.turns),
    timeline: mergeTimelineStates(persisted.timeline, candidate.timeline),
    temporal: mergeTemporalStates(persisted.temporal, candidate.temporal, clock, Math.min(persisted.createdAt, candidate.createdAt)),
    continuity: mergeContinuityStates(persisted.continuity, candidate.continuity),
    relationships: mergeRelationshipStates(
      normalizeRelationshipState(persisted.relationships, persisted.createdAt),
      normalizeRelationshipState(candidate.relationships, candidate.createdAt),
    ),
  }
}

export class LocalStorageStateStore implements Nan0StateStore {
  private readonly storage: Nan0StorageLike | undefined
  private readonly clock: Nan0Clock

  constructor(
    private readonly key = 'nan0/kernel-state/v1',
    private readonly options: LocalStorageStateStoreOptions = {},
  ) {
    this.storage = options.storage ?? globalThis.localStorage
    this.clock = options.clock ?? new SystemNan0Clock()
  }

  async load(): Promise<Nan0KernelState | null> {
    const raw = this.storage?.getItem(this.key)
    if (!raw)
      return null

    const parsed = JSON.parse(raw) as Nan0KernelState
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)
      throw new Error(`Unsupported Nan0 state schema: ${String(parsed.schemaVersion)}`)

    const state = {
      ...parsed,
      schemaVersion: 2 as const,
      revision: parsed.revision ?? 0,
      emotionalState: emotionalVector(parsed.emotionalState),
      emotionalStateSchemaVersion: 1 as const,
      emotionalStateRevision: Math.max(0, Math.floor(parsed.emotionalStateRevision ?? 0)),
      emotionalHistory: normalizeEmotionalHistory(parsed.emotionalHistory, parsed.createdAt),
      attention: normalizeAttentionState(parsed.attention, parsed.createdAt),
      prediction: normalizePredictionState(parsed.prediction),
      internalObservations: normalizeInternalObservationQueue(parsed.internalObservations),
      heartbeat: normalizeHeartbeatRuntimeState(parsed.heartbeat),
      cognitionPolicy: normalizeCognitionPolicyIdentity(parsed.cognitionPolicy, parsed.createdAt),
      thoughts: mergeNan0Thoughts([], parsed.thoughts),
      decisions: mergeNan0Decisions([], parsed.decisions),
      goals: mergeNan0Goals([], parsed.goals),
      pendingIntentions: normalizePendingIntentionState(parsed.pendingIntentions, parsed.createdAt),
      computations: mergeComputationAttempts([], parsed.computations),
      actionIntents: mergeActionIntents([], parsed.actionIntents),
      turns: normalizeConversationTurns(parsed.turns),
      timeline: parsed.timeline
        ? normalizeTimelineState(parsed.timeline)
        : createEmptyTimelineState(),
      temporal: normalizeTemporalState(parsed.temporal, this.clock, parsed.createdAt),
      continuity: parsed.continuity
        ? normalizeContinuityState(parsed.continuity)
        : createEmptyContinuityState(),
      relationships: parsed.relationships
        ? normalizeRelationshipState(parsed.relationships, parsed.createdAt)
        : createEmptyRelationshipState(parsed.createdAt),
    }
    this.options.diagnostic?.('state.load', {
      revision: state.revision,
      memoryCount: state.memories.length,
      thoughtCount: state.thoughts.length,
      decisionCount: state.decisions.length,
      goalCount: state.goals.length,
      pendingIntentionCount: state.pendingIntentions.intentions.length,
      computationCount: state.computations.length,
      actionIntentCount: state.actionIntents.length,
      turnCount: state.turns.length,
      timelineEventCount: state.timeline.events.length,
      continuityThreadCount: state.continuity.threads.length,
      relationshipCount: Object.keys(state.relationships.records).length,
      bootCount: state.bootCount,
      temporalRevision: state.temporal.revision,
      temporalEventCount: state.temporal.engine.events.length,
      clockAdjustmentCount: state.temporal.detectedClockAdjustments.length,
    })
    return state
  }

  async save(state: Nan0KernelState): Promise<Nan0KernelState> {
    if (!this.storage)
      throw new Error('localStorage is unavailable in this runtime.')

    const before = await this.load()
    const merged = mergeNan0States(before, state, this.clock)
    this.storage.setItem(this.key, JSON.stringify(merged))
    this.options.diagnostic?.('state.save', {
      previousRevision: before?.revision ?? 0,
      revision: merged.revision,
      candidateMemoryCount: state.memories.length,
      previousMemoryCount: before?.memories.length ?? 0,
      memoryCount: merged.memories.length,
      thoughtCount: merged.thoughts.length,
      decisionCount: merged.decisions.length,
      goalCount: merged.goals.length,
      pendingIntentionCount: merged.pendingIntentions.intentions.length,
      turnCount: merged.turns.length,
      timelineEventCount: merged.timeline.events.length,
      continuityThreadCount: merged.continuity.threads.length,
      relationshipCount: Object.keys(merged.relationships.records).length,
      thoughtId: merged.lastThoughtId,
      temporalRevision: merged.temporal.revision,
      temporalEventCount: merged.temporal.engine.events.length,
      clockAdjustmentCount: merged.temporal.detectedClockAdjustments.length,
    })
    return structuredClone(merged)
  }
}
