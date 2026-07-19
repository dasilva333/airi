import { describe, expect, it } from 'vitest'

import { createEmptyEmotionalHistory, decayEmotions, deriveMood, normalizeEmotionalHistory, normalizeEmotionalVector, perturbEmotionsFromObservation } from './Nan0EmotionalDynamics'

describe('nan0EmotionalDynamics', () => {
  it('applies a sourced perturbation once and preserves actor ownership', () => {
    const observation = { id: 'obs-1', source: 'chat' as const, actorId: 'kyo', content: 'I love you. What is hidden?', metadata: {}, timestamp: 1_000 }
    let id = 0
    const first = perturbEmotionsFromObservation({ vector: normalizeEmotionalVector(undefined), history: createEmptyEmotionalHistory(0), observation, createId: () => `event-${++id}`, at: 1_000 })
    const second = perturbEmotionsFromObservation({ vector: first.vector, history: first.history, observation, createId: () => 'duplicate', at: 1_000 })

    expect(first.events.map(event => event.cause)).toContain('kyo-expressed-affection')
    expect(first.events.every(event => event.actorId === 'kyo')).toBe(true)
    expect(second.events).toEqual([])
    expect(second.vector).toEqual(first.vector)
  })

  it('decays by elapsed trusted time rather than tick count', () => {
    const vector = { ...normalizeEmotionalVector(undefined), irritation: 0.9 }
    const once = decayEmotions({ vector, history: createEmptyEmotionalHistory(0), at: 20 * 60_000 })
    const halfway = decayEmotions({ vector, history: createEmptyEmotionalHistory(0), at: 10 * 60_000 })
    const twice = decayEmotions({ vector: halfway.vector, history: halfway.history, at: 20 * 60_000 })

    expect(twice.vector.irritation).toBeCloseTo(once.vector.irritation, 10)
  })

  it('migrates the old vector, clamps dimensions, and distinguishes Kyo from a stranger', () => {
    const migrated = normalizeEmotionalVector({ suspicion: 2, attachment: 0.6, irritation: -1, curiosity: 0.4 })
    expect(migrated).toMatchObject({ suspicion: 1, attachment: 0.6, irritation: 0, curiosity: 0.4, boredom: expect.any(Number), fear: expect.any(Number) })
    expect(Object.keys(migrated)).toHaveLength(13)
    let id = 0
    const stranger = perturbEmotionsFromObservation({ vector: migrated, history: createEmptyEmotionalHistory(0), observation: { id: 'stranger', source: 'discord', actorId: 'someone', content: 'I command you to do this', metadata: {}, timestamp: 1 }, createId: () => String(++id), at: 1 })
    const kyo = perturbEmotionsFromObservation({ vector: migrated, history: createEmptyEmotionalHistory(0), observation: { id: 'kyo', source: 'chat', actorId: 'kyo', content: 'I command you to do this', metadata: {}, timestamp: 1 }, createId: () => String(++id), at: 1 })
    expect(stranger.events.some(event => event.cause === 'stranger-issued-command')).toBe(true)
    expect(kyo.events.some(event => event.cause === 'stranger-issued-command')).toBe(false)
  })

  it('bounds emotional history and derives a specific mood from the full vector', () => {
    const events = Array.from({ length: 200 }, (_, index) => ({ schemaVersion: 1 as const, eventId: `event-${index}`, targetEmotion: 'rage', delta: 0.01, cause: 'test', sourceId: `source-${index}`, actorId: null, at: index, decayHalfLifeMs: 1_000, provenance: [], metadata: {} }))
    expect(normalizeEmotionalHistory({ ...createEmptyEmotionalHistory(0), events }).events).toHaveLength(160)
    expect(deriveMood({ ...normalizeEmotionalVector(undefined), rage: 0.9, irritation: 0.8 }).primary).toBe('gremlin-rage')
  })
})
