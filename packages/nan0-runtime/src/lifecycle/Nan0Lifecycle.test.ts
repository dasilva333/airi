import type { Nan0ActionIntentRecord, Nan0Observation, Nan0ReasoningClient } from '../types'

import { describe, expect, it, vi } from 'vitest'

import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { mergeActionIntents, mergeComputationAttempts, privateThoughtTimeoutPolicy } from './Nan0Lifecycle'

const observation: Nan0Observation = {
  id: 'observation-timeout',
  source: 'chat',
  sessionId: 'session-timeout',
  actorId: 'kyo',
  displayName: 'Kyo',
  content: 'Stay bounded.',
  metadata: {},
  timestamp: 100,
}

function successThought() {
  return `I can feel the response forming while the computation remains bounded.\n---EXTRACT---\n${JSON.stringify({
    interpretation: 'Kyo expects a bounded response.',
    privateText: 'I will decide without leaking this thought.',
    decision: 'SPEAK',
    speakability: 0.8,
    confidence: 0.8,
    mood: 'watchful',
    reasonCodes: ['test.success'],
    actionIntent: null,
    waitUntil: null,
    goalSignal: null,
  })}`
}

function kernel(client: Nan0ReasoningClient, store = new InMemoryStateStore(), timeout = 10) {
  let id = 0
  const clock = new ControllableNan0Clock({ wallTime: 1_000, monotonicTime: 1_000 })
  return new Nan0Kernel({
    stateStore: store,
    reasoningClient: client,
    privateThoughtTimeoutMs: timeout,
    privateThoughtProviderMetadata: { providerId: 'safe-provider', model: 'safe-model' },
    createId: () => `lifecycle-${++id}`,
    clock,
  })
}

function hangingClient(onAbort = vi.fn()): Nan0ReasoningClient {
  return {
    generate: request => new Promise((_resolve, reject) => {
      request.signal?.addEventListener('abort', () => {
        onAbort()
        reject(request.signal?.reason ?? new Error('aborted'))
      }, { once: true })
    }),
  }
}

function longLivedAction(overrides: Partial<Nan0ActionIntentRecord> = {}): Nan0ActionIntentRecord {
  return {
    schemaVersion: 1,
    actionIntentId: 'action-sleep',
    decisionId: 'decision-sleep',
    thoughtId: 'thought-sleep',
    turnId: 'turn-sleep',
    capabilityId: 'sleep.enter',
    executionMode: 'state-transition',
    requestedAt: 10,
    parameters: { expectedWakeAt: 86_400_000 },
    timeoutPolicy: { schemaVersion: 1, policyId: 'sleep.state', kind: 'state-duration', durationMs: null, deadline: 86_400_000, condition: null, metadata: {} },
    deadline: 86_400_000,
    resumePolicy: 'required',
    interruptPolicy: 'persist-state',
    status: 'active',
    metadata: { stateReference: 'state-sleep' },
    ...overrides,
  }
}

describe('bounded Nan0 computation lifecycle', () => {
  it('aborts stalled private thought and terminalizes without speech, goal, or action', async () => {
    const aborted = vi.fn()
    const generate = vi.fn(hangingClient(aborted).generate)
    const subject = kernel({ generate })
    await subject.boot()
    const prepared = await subject.prepareTurn(observation)
    const state = subject.getStateSnapshot()

    expect(aborted).toHaveBeenCalledOnce()
    expect(generate).toHaveBeenCalledOnce()
    expect(prepared.thought.status).toBe('failed')
    expect(prepared.decision.finalDecision).toBe('SILENCE')
    expect(state.computations).toHaveLength(1)
    expect(state.computations[0]).toMatchObject({
      status: 'timed-out',
      failureReason: 'thought.computation-timeout',
      providerMetadata: { providerId: 'safe-provider', model: 'safe-model' },
    })
    expect(state.turns[0].status).toBe('failed')
    expect(state.memories.filter(memory => memory.actorId === 'nan0')).toHaveLength(0)
    expect(state.goals).toHaveLength(0)
    expect(state.actionIntents).toHaveLength(0)
  })

  it('remains usable for the next turn after a timeout', async () => {
    let call = 0
    const client: Nan0ReasoningClient = {
      generate(request) {
        if (call++ === 0)
          return hangingClient().generate(request)
        return Promise.resolve({ text: successThought() })
      },
    }
    const subject = kernel(client)
    await subject.boot()
    await subject.prepareTurn(observation)
    const next = await subject.prepareTurn({ ...observation, id: 'observation-next', timestamp: 200 })
    expect(next.thought.status).toBe('generated')
  })

  it('does not recover a computation still active in the current owner', async () => {
    const subject = kernel(hangingClient(), new InMemoryStateStore(), 30)
    await subject.boot()
    const pending = subject.prepareTurn(observation)
    await Promise.resolve()
    await Promise.resolve()
    expect(await subject.recoverInterruptedPreparedTurns()).toBe(0)
    await pending
  })

  it('recovers an interrupted prepared turn once after restart without fabricating cognition', async () => {
    const sourceStore = new InMemoryStateStore()
    const source = kernel(hangingClient(), sourceStore, 30)
    await source.boot()
    const pending = source.prepareTurn(observation)
    await Promise.resolve()
    await Promise.resolve()
    const snapshot = await sourceStore.load()
    expect(snapshot?.turns[0].status).toBe('prepared')

    const restartStore = new InMemoryStateStore()
    await restartStore.save(snapshot!)
    const restarted = kernel({ generate: async () => ({ text: successThought() }) }, restartStore)
    await restarted.boot()
    const once = restarted.getStateSnapshot()
    expect(once.turns[0].status).toBe('failed')
    expect(once.computations[0].status).toBe('interrupted')
    expect(once.thoughts).toHaveLength(0)
    expect(once.goals).toHaveLength(0)
    expect(once.timeline.events.filter(event => event.eventType === 'turn-failed')).toHaveLength(1)
    expect(await restarted.recoverInterruptedPreparedTurns()).toBe(0)
    expect(restarted.getStateSnapshot().timeline.events.filter(event => event.eventType === 'turn-failed')).toHaveLength(1)
    await pending
  })

  it('does not let a computation timeout delete persisted sleep or durable-job state', () => {
    const sleep = longLivedAction()
    const art = longLivedAction({
      actionIntentId: 'action-art',
      capabilityId: 'art.generate',
      executionMode: 'durable-job',
      timeoutPolicy: { schemaVersion: 1, policyId: 'art.job', kind: 'action-specific-timeout', durationMs: 1_800_000, deadline: null, condition: null, metadata: {} },
      metadata: { jobReference: 'job-art' },
    })
    const merged = mergeActionIntents([sleep, art], [])
    expect(merged).toEqual([art, sleep])
    expect(sleep.timeoutPolicy.kind).toBe('state-duration')
    expect(art.timeoutPolicy.durationMs).toBeGreaterThan(privateThoughtTimeoutPolicy().durationMs!)
  })

  it('keeps completed and cancelled actions terminal against stale writers', () => {
    const stale = longLivedAction({ status: 'active' })
    const completed = longLivedAction({ status: 'completed' })
    expect(mergeActionIntents([completed], [stale])[0].status).toBe('completed')
    const cancelled = longLivedAction({ status: 'cancelled' })
    expect(mergeActionIntents([cancelled], [stale])[0].status).toBe('cancelled')
  })

  it('merges duplicate timeout completion idempotently', () => {
    const timedOut = {
      schemaVersion: 1 as const,
      requestId: 'request-1',
      computationType: 'private-thought' as const,
      turnId: 'turn-1',
      thoughtId: 'thought-1',
      policy: privateThoughtTimeoutPolicy(10),
      status: 'timed-out' as const,
      startedAt: 1,
      finishedAt: 11,
      failureReason: 'thought.computation-timeout',
      providerMetadata: {},
      metadata: {},
    }
    expect(mergeComputationAttempts([timedOut], [timedOut])).toEqual([{
      ...timedOut,
      schemaVersion: 2,
      cognitionPhase: 'complete',
      partialNarrativeLength: 0,
    }])
  })

  it('keeps streamed progress monotonic and never lets stale progress replace a terminal computation', () => {
    const active = {
      schemaVersion: 2 as const,
      requestId: 'request-stream',
      computationType: 'private-thought' as const,
      turnId: 'turn-stream',
      thoughtId: 'thought-stream',
      policy: privateThoughtTimeoutPolicy(),
      status: 'active' as const,
      startedAt: 1,
      finishedAt: null,
      failureReason: null,
      providerMetadata: {},
      metadata: {},
      cognitionPhase: 'narrative' as const,
      partialNarrativeLength: 0,
    }
    const streaming = { ...active, status: 'streaming' as const, partialNarrativeLength: 160 }
    const stale = { ...streaming, partialNarrativeLength: 80 }
    const completed = { ...streaming, status: 'completed' as const, cognitionPhase: 'complete' as const, finishedAt: 5 }

    expect(mergeComputationAttempts([active], [streaming])[0]).toMatchObject({ status: 'streaming', partialNarrativeLength: 160 })
    expect(mergeComputationAttempts([streaming], [stale])[0].partialNarrativeLength).toBe(160)
    expect(mergeComputationAttempts([completed], [streaming])[0].status).toBe('completed')
  })

  it('permits durable deadlines far beyond private computation timeout', () => {
    const now = 1_000
    const intentionPolicy = { schemaVersion: 1 as const, policyId: 'future.deadline', kind: 'deadline' as const, durationMs: null, deadline: now + 86_400_000, condition: null, metadata: {} }
    expect(intentionPolicy.deadline! - now).toBeGreaterThan(privateThoughtTimeoutPolicy().durationMs!)
  })

  it('booting persisted long-lived state triggers no provider computation', async () => {
    const calls = vi.fn()
    const store = new InMemoryStateStore()
    const seed = kernel({ generate: async () => ({ text: successThought() }) }, store)
    await seed.boot()
    await store.save({ ...seed.getStateSnapshot(), actionIntents: [longLivedAction()] })
    const restarted = kernel({ generate: async () => { calls(); return { text: successThought() } } }, store)
    await restarted.boot()
    expect(calls).not.toHaveBeenCalled()
    expect(restarted.getStateSnapshot().actionIntents[0].status).toBe('active')
  })
})
