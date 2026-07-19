import { describe, expect, it } from 'vitest'

import { normalizeEmotionalVector } from '../emotional/Nan0EmotionalDynamics'
import { createEmptyPredictionState, expirePredictions, normalizePredictionState, processAttendedObservation } from './Nan0PredictionEngine'

describe('nan0PredictionEngine', () => {
  it('forms and confirms serializable expectations only from attended pattern evidence', () => {
    let id = 0
    const state = {
      ...createEmptyPredictionState(),
      patterns: [{
        schemaVersion: 1 as const,
        patternId: 'pattern-1',
        patternType: 'sequence' as const,
        actorId: 'kyo',
        antecedent: 'opens project',
        consequent: 'runs tests',
        occurrences: 3,
        confidence: 0.7,
        detectedAt: 1,
        lastOccurrenceAt: 1,
        evidenceObservationIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        isActive: true,
      }],
    }
    const formed = processAttendedObservation({
      state,
      observation: { id: 'attended-1', source: 'chat', actorId: 'kyo', content: 'opens project', metadata: {}, timestamp: 10 },
      emotionalState: normalizeEmotionalVector(undefined),
      createId: () => String(++id),
      at: 10,
    })
    expect(formed.formed).toHaveLength(1)
    expect(formed.formed[0].confirmationPattern).toEqual({ source: 'runs', flags: 'i' })
    expect(() => JSON.stringify(formed.state)).not.toThrow()

    const confirmed = processAttendedObservation({
      state: formed.state,
      observation: { id: 'attended-2', source: 'chat', actorId: 'kyo', content: 'runs tests now', metadata: {}, timestamp: 20 },
      emotionalState: normalizeEmotionalVector(undefined),
      createId: () => String(++id),
      at: 20,
    })
    expect(confirmed.confirmed[0]?.status).toBe('confirmed')
    expect(confirmed.emotionalImpact.smugness).toBeGreaterThan(0)
  })

  it('requires minimum pattern evidence and safely drops malformed persisted matchers', () => {
    const normalized = normalizePredictionState({
      ...createEmptyPredictionState(),
      expectations: [{ schemaVersion: 1, expectationId: 'bad', type: 'actor-behavior', description: 'bad regex', status: 'active', actorId: 'kyo', expectedOutcome: 'test', confirmationPattern: { source: '[', flags: 'i' }, violationPattern: null, formedFromObservationId: 'obs', formedFromPatternId: 'weak', formedAt: 1, expectedBy: 2, expiresAt: 3, confidence: 0.5, priorConfirmations: 0, priorViolations: 0, relatedGoalIds: [], evidenceObservationIds: [], metadata: {} }],
      patterns: [{ schemaVersion: 1, patternId: 'weak', patternType: 'sequence', actorId: 'kyo', antecedent: 'opens project', consequent: 'runs tests', occurrences: 2, confidence: 0.9, detectedAt: 1, lastOccurrenceAt: 1, evidenceObservationIds: ['a', 'b', 'c', 'd'], isActive: true }],
    })
    expect(normalized.expectations[0].confirmationPattern).toBeNull()
    const result = processAttendedObservation({ state: normalized, observation: { id: 'next', source: 'chat', actorId: 'kyo', content: 'opens project', metadata: {}, timestamp: 2 }, emotionalState: normalizeEmotionalVector(undefined), createId: () => 'id', at: 2 })
    expect(result.formed).toEqual([])
  })

  it('records violation surprise, revises a belief to abandonment, and expires stale expectations', () => {
    const state = normalizePredictionState({
      ...createEmptyPredictionState(),
      patterns: [{ schemaVersion: 1, patternId: 'pattern', patternType: 'sequence', actorId: 'kyo', antecedent: 'opens project', consequent: 'runs tests', occurrences: 3, confidence: 0.7, detectedAt: 1, lastOccurrenceAt: 1, evidenceObservationIds: ['a', 'b', 'c', 'd', 'e', 'f'], isActive: true }],
      expectations: [{ schemaVersion: 1, expectationId: 'expectation', type: 'actor-behavior', description: 'Kyo runs tests', status: 'active', actorId: 'kyo', expectedOutcome: 'runs tests', confirmationPattern: { source: 'runs tests', flags: 'i' }, violationPattern: { source: 'never', flags: 'i' }, formedFromObservationId: 'formed', formedFromPatternId: 'pattern', formedAt: 1, expectedBy: 5, expiresAt: 20, confidence: 0.8, priorConfirmations: 0, priorViolations: 0, relatedGoalIds: [], evidenceObservationIds: [], metadata: {} }],
      beliefs: [{ schemaVersion: 1, beliefId: 'belief', description: 'sequence', subject: 'opens project', predicate: 'runs tests', actorId: 'kyo', confidence: 0.25, uncertainty: 0.75, confirmingEvidence: 1, violatingEvidence: 2, formedAt: 1, lastUpdatedAt: 1, formedFromPatternId: 'pattern', evidenceObservationIds: [], status: 'active' }],
    })
    let id = 0
    const violated = processAttendedObservation({ state, observation: { id: 'violation', source: 'chat', actorId: 'kyo', content: 'never today', metadata: {}, timestamp: 6 }, emotionalState: normalizeEmotionalVector(undefined), createId: () => String(++id), at: 6 })
    expect(violated.violated).toHaveLength(1)
    expect(violated.internalObservations[0]?.observation.source).toBe('internal:prediction-violation')
    expect(violated.state.recentSurprises).toHaveLength(1)
    expect(violated.state.beliefs.find(item => item.beliefId === 'belief')?.status).toBe('abandoned')

    const expiring = normalizePredictionState({ ...createEmptyPredictionState(), expectations: [{ ...state.expectations[0], expectationId: 'expire', violationPattern: null, expiresAt: 7 }] })
    expect(expirePredictions(expiring, 7).expired[0]?.status).toBe('expired')
  })
})
