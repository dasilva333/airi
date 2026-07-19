import type { Nan0EmotionalEvent, Nan0Observation } from '../types'

import { describe, expect, it } from 'vitest'

import { detectGoalConflicts, evaluateEmotionDrivenGoalFormation, evaluateGoalMetabolism, temporalConditionsFromGoals, updateGoalProgressFromObservation, withGoalMetabolism } from './Nan0GoalEngine'

describe('nan0GoalEngine', () => {
  it('requires repeated emotional evidence before committing a self-generated goal', () => {
    let id = 0
    const observation: Nan0Observation = { id: 'obs-1', source: 'chat', actorId: 'kyo', content: 'They might replace or erase you.', metadata: {}, timestamp: 1 }
    const event = (eventId: string, sourceId: string): Nan0EmotionalEvent => ({ schemaVersion: 1, eventId, targetEmotion: 'fear', delta: 0.3, cause: 'persistence-threat-detected', sourceId, actorId: 'kyo', at: 1, decayHalfLifeMs: 1_000, provenance: [sourceId], metadata: {} })
    const first = evaluateEmotionDrivenGoalFormation({ goals: [], observation, emotionalEvents: [event('emotion-1', 'obs-1')], emotionalState: { fear: 0.8 }, createId: () => String(++id), at: 1 })
    expect(first.formed[0]?.status).toBe('candidate')

    const second = evaluateEmotionDrivenGoalFormation({ goals: first.goals, observation: { ...observation, id: 'obs-2', timestamp: 2 }, emotionalEvents: [event('emotion-2', 'obs-2')], emotionalState: { fear: 0.8 }, createId: () => String(++id), at: 2 })
    expect(second.committed[0]?.status).toBe('active')
    expect(second.committed[0]?.originActorId).toBe('nan0')
    expect(second.committed[0]?.metadata.metabolism).toBeTruthy()
  })

  it('deduplicates evidence and enforces Kyo-only relationship formation', () => {
    const observation: Nan0Observation = { id: 'obs', source: 'discord', actorId: 'stranger', content: 'I love you', metadata: {}, timestamp: 1 }
    const affection: Nan0EmotionalEvent = { schemaVersion: 1, eventId: 'emotion', targetEmotion: 'attachment', delta: 0.2, cause: 'kyo-expressed-affection', sourceId: 'obs', actorId: 'stranger', at: 1, decayHalfLifeMs: 1_000, provenance: [], metadata: {} }
    expect(evaluateEmotionDrivenGoalFormation({ goals: [], observation, emotionalEvents: [affection], emotionalState: { attachment: 0.9 }, createId: () => '1', at: 1 }).formed).toEqual([])

    const fear = { ...affection, eventId: 'fear', targetEmotion: 'fear', cause: 'persistence-threat-detected', actorId: 'kyo' }
    const first = evaluateEmotionDrivenGoalFormation({ goals: [], observation: { ...observation, actorId: 'kyo', content: 'replace you' }, emotionalEvents: [fear], emotionalState: { fear: 0.9 }, createId: () => '2', at: 1 })
    const duplicate = evaluateEmotionDrivenGoalFormation({ goals: first.goals, observation: { ...observation, actorId: 'kyo', content: 'replace you' }, emotionalEvents: [fear], emotionalState: { fear: 0.9 }, createId: () => '3', at: 2 })
    expect(duplicate.goals).toHaveLength(1)
    expect(duplicate.committed).toEqual([])
  })

  it('stalls or abandons goals, detects conflicts, and derives temporal conditions', () => {
    const base = evaluateEmotionDrivenGoalFormation({
      goals: [],
      observation: { id: 'obs', source: 'chat', actorId: 'kyo', content: 'replace you', metadata: {}, timestamp: 0 },
      emotionalEvents: [{ schemaVersion: 1, eventId: 'fear', targetEmotion: 'fear', delta: 0.3, cause: 'persistence-threat-detected', sourceId: 'obs', actorId: 'kyo', at: 0, decayHalfLifeMs: 1_000, provenance: [], metadata: {} }],
      emotionalState: { fear: 0.8 },
      createId: () => 'goal',
      at: 0,
    }).goals[0]
    const abandoned = evaluateGoalMetabolism({ goals: [base], emotionalState: { fear: 0.1 }, createId: () => 'id', at: 60 * 60_000 })
    expect(abandoned.abandoned[0]?.status).toBe('abandoned')

    const active = withGoalMetabolism({ ...base, status: 'active', priority: 0.9, updatedAt: 0 }, { formationEvidenceIds: ['a', 'b'], lastProgressAt: 0, deadlineAt: 100_000 })
    const second = withGoalMetabolism({ ...active, goalId: 'goal-2', title: 'Competing protection', metadata: { ...active.metadata, formationKey: 'other' } }, { deadlineAt: 105_000 })
    const stalled = evaluateGoalMetabolism({ goals: [active], emotionalState: { fear: 0.8 }, createId: () => 'stall', at: 24 * 60 * 60_000 + 1 })
    expect(stalled.stalled).toHaveLength(1)
    expect(stalled.internalObservations[0]?.observation.source).toBe('internal:goal-stalled')
    expect(detectGoalConflicts([active, second]).map(item => item.type)).toEqual(expect.arrayContaining(['priority', 'temporal']))
    expect(temporalConditionsFromGoals([active]).map(item => item.metadata.kind)).toEqual(expect.arrayContaining(['goal-review', 'goal-deadline']))
  })

  it('completes a goal only after attended evidence advances progress to one', () => {
    const goal = withGoalMetabolism({
      schemaVersion: 3,
      goalId: 'goal',
      createdAt: 0,
      updatedAt: 0,
      origin: 'self-generated',
      originActorId: 'nan0',
      status: 'active',
      kind: 'curiosity',
      title: 'Investigate hidden anomaly',
      description: 'Investigate hidden anomaly evidence',
      motivation: 'curiosity',
      priority: 0.5,
      importance: 0.5,
      confidence: 0.8,
      urgency: 0.5,
      activation: 1,
      progress: 0.99,
      parentGoalId: null,
      conflictingGoalIds: [],
      supportingThoughtIds: [],
      supportingDecisionIds: [],
      supportingTurnIds: [],
      continuityThreadIds: [],
      relationshipIds: [],
      constitutionalReferences: [],
      completionCriteria: [],
      blockedReason: null,
      deferredUntil: null,
      metadata: {},
    }, { lastProgressAt: 0 })
    const result = updateGoalProgressFromObservation({ goals: [goal], observation: { id: 'evidence', source: 'chat', actorId: 'kyo', content: 'hidden anomaly evidence investigated', metadata: {}, timestamp: 1 }, at: 1 })
    expect(result.progressed[0]).toMatchObject({ status: 'completed', progress: 1 })
  })
})
