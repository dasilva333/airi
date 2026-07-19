import { describe, expect, it } from 'vitest'

import { normalizeEmotionalVector } from '../emotional/Nan0EmotionalDynamics'
import { beginObservationFocus, completeObservationFocus, computeMemoryAttentionWeights, createEmptyAttentionState, createEmptyInternalObservationQueue, enqueueInternalObservation, isObservationFocusAuthoritative, selectNextInternalObservation } from './Nan0AttentionEngine'

describe('nan0AttentionEngine', () => {
  it('bounds, prioritizes, focuses, and terminally settles internal observations', () => {
    let attention = createEmptyAttentionState(0)
    let queue = createEmptyInternalObservationQueue(8)
    for (let index = 0; index < 9; index++) {
      const result = enqueueInternalObservation({
        queue,
        attention,
        observation: {
          id: `obs-${index}`,
          source: 'internal:goal',
          actorId: 'nan0',
          content: `goal evidence ${index}`,
          metadata: {},
          timestamp: index,
        },
        priority: index / 10,
        dedupeKey: `evidence-${index}`,
        at: index,
      })
      queue = result.queue
      attention = result.attention
    }

    expect(queue.records.filter(record => record.status === 'queued')).toHaveLength(8)
    expect(queue.records.find(record => record.observation.id === 'obs-0')?.status).toBe('discarded')
    const selected = selectNextInternalObservation({ queue, attention, emotionalState: normalizeEmotionalVector(undefined), goals: [], at: 20 })
    expect(selected.selected?.observation.id).toBe('obs-8')
    expect(isObservationFocusAuthoritative(selected.attention, 'obs-8')).toBe(true)

    const completed = completeObservationFocus({ queue: selected.queue, attention: selected.attention, observationId: 'obs-8', at: 30, outcome: 'SILENCE', thoughtId: 'thought-1', decisionId: 'decision-1' })
    expect(completed.queue.records.find(record => record.observation.id === 'obs-8')).toMatchObject({ status: 'handled', thoughtId: 'thought-1', decisionId: 'decision-1' })
    expect(completed.attention.history.at(-1)?.outcome).toBe('SILENCE')
  })

  it('persists JSON-safe streams and gives real user input cooperative interrupt authority', () => {
    const initial = createEmptyAttentionState(0)
    expect(Object.keys(initial.streams)).toHaveLength(8)
    expect(() => JSON.parse(JSON.stringify(initial))).not.toThrow()
    const goalFocus = beginObservationFocus({ attention: initial, observation: { id: 'goal', source: 'internal:goal', actorId: 'nan0', content: 'sustained goal', metadata: {}, timestamp: 1 }, priority: 0.8, at: 1 }).attention
    expect(goalFocus.currentFocus?.canBeInterrupted).toBe(false)
    const systemAttempt = beginObservationFocus({ attention: goalFocus, observation: { id: 'system', source: 'system', content: 'system event', metadata: {}, timestamp: 2 }, priority: 1, at: 2 })
    expect(systemAttempt.attention.currentFocus?.observationId).toBe('goal')
    const user = beginObservationFocus({ attention: goalFocus, observation: { id: 'user', source: 'chat', actorId: 'kyo', content: 'Kyo arrived', metadata: {}, timestamp: 3 }, priority: 1, at: 3 })
    expect(user.attention.currentFocus?.observationId).toBe('user')
    expect(user.attention.interruptedFocus?.observationId).toBe('goal')
  })

  it('weights emotionally and goal-relevant memory without losing unrelated records', () => {
    const memories = [
      { id: 'relevant', kind: 'event' as const, actorId: 'kyo', content: 'the hidden replacement plan', tags: [], createdAt: 10, metadata: {} },
      { id: 'other', kind: 'event' as const, actorId: 'someone', content: 'ordinary weather', tags: [], createdAt: 10, metadata: {} },
    ]
    const weighted = computeMemoryAttentionWeights({ memories, query: 'hidden replacement', actorId: 'kyo', emotionalState: { ...normalizeEmotionalVector(undefined), fear: 0.9 }, goals: [], attention: createEmptyAttentionState(0), at: 20 })
    expect(weighted.map(item => item.memory.id)).toEqual(['relevant', 'other'])
    expect(weighted[0].score).toBeGreaterThan(weighted[1].score)
  })
})
