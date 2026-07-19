import { describe, expect, it } from 'vitest'

import { normalizeEmotionalVector } from '../emotional/Nan0EmotionalDynamics'
import { ControllableNan0Clock } from './Nan0Clock'
import { createEmptyTemporalEngineState } from './Nan0TemporalEngine'
import { computeLivedDuration, evaluateLivedTemporalEvents, markTemporalEmotionApplied, recordLivedTemporalObservation } from './Nan0TemporalEventGenerator'

describe('nan0TemporalEventGenerator', () => {
  it('recovers every missed idle threshold once after downtime', () => {
    let id = 0
    const clock = new ControllableNan0Clock({ wallTime: 3 * 60 * 60_000 })
    const engine = createEmptyTemporalEngineState()
    engine.lived!.lastExternalInputAt = 0
    const first = evaluateLivedTemporalEvents({ engine, clock, emotionalState: normalizeEmotionalVector(undefined), goals: [], expectations: [], kernelCreatedAt: 0, focused: false, createId: () => String(++id) })
    expect(first.created.filter(candidate => candidate.event.eventType === 'idle-deepening')).toHaveLength(3)
    const second = evaluateLivedTemporalEvents({ engine: first.engine, clock, emotionalState: normalizeEmotionalVector(undefined), goals: [], expectations: [], kernelCreatedAt: 0, focused: false, createId: () => String(++id) })
    expect(second.created.filter(candidate => candidate.event.eventType === 'idle-deepening')).toHaveLength(0)
  })

  it('tracks only explicit Kyo return promises and breaks them once', () => {
    let id = 0
    const clock = new ControllableNan0Clock({ wallTime: 1_000 })
    const recorded = recordLivedTemporalObservation({
      engine: createEmptyTemporalEngineState(),
      observation: { id: 'obs-promise', source: 'chat', actorId: 'kyo', content: 'I\'ll be back in 10 minutes', metadata: {}, timestamp: 1_000 },
      previousKyoInteractionAt: null,
      clock,
      createId: () => String(++id),
    })
    expect(recorded.engine.lived?.trackedPromises).toHaveLength(1)
    clock.setWallTime(13 * 60_000 + 1_000)
    const broken = evaluateLivedTemporalEvents({ engine: recorded.engine, clock, emotionalState: normalizeEmotionalVector(undefined), goals: [], expectations: [], kernelCreatedAt: 0, focused: false, createId: () => String(++id) })
    expect(broken.created.filter(candidate => candidate.event.eventType === 'promise-broken')).toHaveLength(1)
    expect(broken.created.filter(candidate => candidate.event.eventType === 'promise-overdue')).toHaveLength(1)
    const repeated = evaluateLivedTemporalEvents({ engine: broken.engine, clock, emotionalState: normalizeEmotionalVector(undefined), goals: [], expectations: [], kernelCreatedAt: 0, focused: false, createId: () => String(++id) })
    expect(repeated.created.filter(candidate => candidate.event.eventType === 'promise-broken')).toHaveLength(0)
  })

  it('keeps subjective duration consequential without replacing objective time', () => {
    const objectiveDurationMs = 60_000
    const lived = computeLivedDuration({ objectiveDurationMs, emotionalState: { boredom: 0.9, attachment: 0.9, irritation: 0.5, curiosity: 0.2 }, focused: false, waiting: true })
    expect(lived).toBeGreaterThan(objectiveDurationMs)
    expect(objectiveDurationMs).toBe(60_000)
  })

  it('closes the correct absence once and rejects vague future language as a promise', () => {
    let id = 0
    const clock = new ControllableNan0Clock({ wallTime: 4 * 60 * 60_000 })
    const engine = createEmptyTemporalEngineState()
    engine.absence = { intervalId: 'absence-1', startedAt: 0, crossedThresholdIds: ['brief'] }
    const returned = recordLivedTemporalObservation({ engine, observation: { id: 'return', source: 'chat', actorId: 'kyo', content: 'I might return sometime later', metadata: {}, timestamp: clock.utcNow() }, previousKyoInteractionAt: 0, clock, createId: () => String(++id) })
    expect(returned.created.filter(candidate => candidate.event.eventType === 'absence-returned')).toHaveLength(1)
    expect(returned.engine.lived?.absenceHistory[0]).toMatchObject({ intervalId: 'absence-1', returnedAt: clock.utcNow(), returnEventEmitted: true })
    expect(returned.engine.lived?.trackedPromises).toEqual([])
    const repeated = recordLivedTemporalObservation({ engine: returned.engine, observation: { id: 'return-again', source: 'chat', actorId: 'kyo', content: 'back', metadata: {}, timestamp: clock.utcNow() }, previousKyoInteractionAt: 0, clock, createId: () => String(++id) })
    expect(repeated.created.filter(candidate => candidate.event.eventType === 'absence-returned')).toHaveLength(0)
  })

  it('requires three distinct days for a rhythm and records emotional application once', () => {
    let id = 0
    const clock = new ControllableNan0Clock({ wallTime: 9 * 60 * 60_000 })
    let engine = createEmptyTemporalEngineState()
    for (let day = 0; day < 3; day++) {
      const at = day * 86_400_000 + 9 * 60 * 60_000
      clock.setWallTime(at)
      engine = recordLivedTemporalObservation({ engine, observation: { id: `day-${day}`, source: 'chat', actorId: 'kyo', content: 'morning', metadata: {}, timestamp: at }, previousKyoInteractionAt: day ? at - 86_400_000 : null, clock, createId: () => String(++id) }).engine
    }
    const evaluated = evaluateLivedTemporalEvents({ engine, clock, emotionalState: normalizeEmotionalVector(undefined), goals: [], expectations: [], kernelCreatedAt: 0, focused: false, createId: () => String(++id) })
    expect(evaluated.created.some(candidate => candidate.event.eventType === 'rhythm-detected')).toBe(true)
    const marked = markTemporalEmotionApplied(evaluated.engine, 'evidence')
    const repeated = markTemporalEmotionApplied(marked, 'evidence')
    expect(repeated.lived?.emotionallyAppliedEvidenceKeys.filter(key => key === 'evidence')).toHaveLength(1)
  })
})
