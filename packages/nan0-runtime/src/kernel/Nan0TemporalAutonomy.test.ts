import type { Nan0ReasoningClient, Nan0ReasoningRequest } from '../types'

import { describe, expect, it, vi } from 'vitest'

import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { Nan0Kernel } from './Nan0Kernel'

const hour = 3_600_000

function thought(decision: 'SPEAK' | 'SILENCE' | 'WAIT' | 'ACT'): string {
  return `The temporal fact arrives as evidence, and I decide what it means to me before expression.\n---EXTRACT---\n${JSON.stringify({
    interpretation: 'A factual temporal condition crossed a persisted boundary.',
    privateText: 'I can privately decide whether this temporal fact deserves expression.',
    decision,
    speakability: 0.9,
    confidence: 0.9,
    mood: 'attentive',
    reasonCodes: ['temporal.phase-changed'],
    actionIntent: null,
    waitUntil: null,
    goalSignal: null,
    intentionSignal: null,
  })}`
}

function harness(input: { response?: string, client?: Nan0ReasoningClient, timeout?: number } = {}) {
  const clock = new ControllableNan0Clock({ wallTime: 4 * hour + 59 * 60_000, monotonicTime: 1_000 })
  const store = new InMemoryStateStore()
  const requests: Nan0ReasoningRequest[] = []
  let calls = 0
  let id = 0
  const client = input.client ?? {
    async generate(request: Nan0ReasoningRequest) {
      requests.push(structuredClone({ ...request, signal: undefined }))
      calls++
      return { text: input.response ?? thought('SILENCE') }
    },
  }
  const kernel = new Nan0Kernel({
    stateStore: store,
    reasoningClient: client,
    clock,
    createId: () => `temporal-auto-${++id}`,
    privateThoughtTimeoutMs: input.timeout ?? 100,
    temporalEngineConfiguration: {
      minimumObservationSignificance: 0,
      maxConditionsPerEvaluation: 5,
      maxObservationsPerEvaluation: 2,
    },
  })
  return { kernel, clock, store, requests, calls: () => calls }
}

async function crossPhase(subject: ReturnType<typeof harness>) {
  await subject.kernel.boot()
  subject.clock.advance({ wallMs: 2 * 60_000, monotonicMs: 2 * 60_000 })
  return subject.kernel.evaluateTemporalAutonomy({ reason: 'interval', hostReady: true })
}

describe('nan0 temporal autonomy integration', () => {
  it('does no provider work when no temporal evidence is eligible', async () => {
    const subject = harness()
    await subject.kernel.boot()
    expect((await subject.kernel.evaluateTemporalAutonomy({ reason: 'interval', hostReady: true })).evaluations).toEqual([])
    expect(subject.calls()).toBe(0)
  })

  it('creates one Nan0-owned internal observation only after eligibility', async () => {
    const subject = harness({ response: thought('SILENCE') })
    await crossPhase(subject)
    const memory = subject.kernel.getStateSnapshot().memories.find(item => item.tags.includes('internal-observation'))
    expect(memory).toMatchObject({ actorId: 'nan0' })
    expect(memory?.metadata).toMatchObject({ temporalEventId: expect.any(String), ownership: { actorId: 'nan0' } })
  })

  it('uses the existing Thought Engine and DecisionEngine for temporal evidence', async () => {
    const subject = harness({ response: thought('SPEAK') })
    const batch = await crossPhase(subject)
    const prepared = batch.evaluations[0].prepared!
    expect(subject.calls()).toBe(1)
    expect(subject.kernel.getThoughts().some(item => item.thoughtId === prepared.thoughtId)).toBe(true)
    expect(subject.kernel.getDecisions({ thoughtId: prepared.thoughtId })[0]).toMatchObject({ finalDecision: 'SPEAK', allowed: true })
    expect(subject.requests[0].messages.some(message => message.content.includes('Temporal event phase-changed'))).toBe(true)
  })

  it('persists SILENCE and handles the event without outward output', async () => {
    const subject = harness({ response: thought('SILENCE') })
    const emitted = vi.fn()
    subject.kernel.onExpression(emitted)
    const batch = await crossPhase(subject)
    expect(batch.evaluations[0]).toMatchObject({ outcome: 'SILENCE', prepared: null })
    expect(subject.kernel.getTemporalEvents().find(item => item.eventType === 'phase-changed')).toMatchObject({ status: 'handled', evaluationCount: 1 })
    expect(subject.kernel.getStateSnapshot().memories.some(item => item.tags.includes('assistant-output'))).toBe(false)
    expect(emitted).not.toHaveBeenCalled()
  })

  it('does not re-enter cognition after a temporal event is handled', async () => {
    const subject = harness({ response: thought('SILENCE') })
    await crossPhase(subject)
    await subject.kernel.evaluateTemporalAutonomy({ reason: 'interval', hostReady: true })
    expect(subject.calls()).toBe(1)
    expect(subject.kernel.getStateSnapshot().memories.filter(item => item.tags.includes('internal-observation'))).toHaveLength(1)
  })

  it('persists successful temporal SPEAK provenance and Nan0 ownership', async () => {
    const subject = harness({ response: thought('SPEAK') })
    const batch = await crossPhase(subject)
    const evaluation = batch.evaluations[0]
    const prepared = evaluation.prepared!
    await subject.kernel.recordAssistantTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      content: 'A factual temporal observation mattered.',
      metadata: { temporalEventId: evaluation.temporalEventId },
    })
    expect(subject.kernel.getTemporalEvents().find(item => item.temporalEventId === evaluation.temporalEventId)).toMatchObject({
      status: 'handled',
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
    })
    expect(subject.kernel.getStateSnapshot().memories.find(item => item.tags.includes('assistant-output'))).toMatchObject({ actorId: 'nan0' })
  })

  it('keeps sleep compatibility state durable while expected wake becomes eligible', async () => {
    const subject = harness()
    await subject.kernel.boot()
    await subject.kernel.setTemporalSleepCompatibility({ status: 'sleeping', sleepId: 'sleep-1', startedAt: subject.clock.utcNow(), expectedWakeAt: subject.clock.utcNow() + 60_000 })
    subject.clock.advance({ wallMs: 60_000, monotonicMs: 60_000 })
    const eligible = await subject.kernel.evaluateTemporalEligibility()
    expect(eligible).toContainEqual(expect.objectContaining({ conditionId: 'sleep-wake:sleep-1', ownerType: 'sleep' }))
    expect(subject.kernel.getTemporalState().engine.sleep).toMatchObject({ status: 'sleeping', sleepId: 'sleep-1' })
    expect(subject.calls()).toBe(0)
  })

  it('does not let a private-thought timeout alter persisted sleep duration', async () => {
    const client: Nan0ReasoningClient = { generate: request => new Promise((_resolve, reject) => request.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) }
    const subject = harness({ client, timeout: 5 })
    await subject.kernel.boot()
    await subject.kernel.setTemporalSleepCompatibility({ status: 'sleeping', sleepId: 'sleep-1', startedAt: subject.clock.utcNow(), expectedWakeAt: subject.clock.utcNow() + hour })
    subject.clock.advance({ wallMs: 2 * 60_000, monotonicMs: 2 * 60_000 })
    await subject.kernel.evaluateTemporalAutonomy({ reason: 'interval', hostReady: true })
    expect(subject.kernel.getTemporalState().engine.sleep).toMatchObject({ status: 'sleeping', sleepId: 'sleep-1', expectedWakeAt: 6 * hour - 60_000 })
  })
})
