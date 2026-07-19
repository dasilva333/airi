import type {
  Nan0CapabilityDefinition,
  Nan0PendingIntention,
  Nan0ReasoningClient,
  Nan0ReasoningRequest,
} from '../types'

import { describe, expect, it, vi } from 'vitest'

import { normalizePendingIntention } from '../intentions/Nan0PendingIntentions'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { Nan0Kernel } from './Nan0Kernel'

function modelThought(decision: 'SPEAK' | 'SILENCE' | 'WAIT' | 'ACT', overrides: Record<string, unknown> = {}): string {
  return `The due intention returns to my attention, and I reconsider it as my own thought.\n---EXTRACT---\n${JSON.stringify({
    interpretation: 'A due intention deserves a bounded private reconsideration.',
    privateText: 'I can decide whether this still deserves expression.',
    decision,
    speakability: 0.9,
    confidence: 0.9,
    mood: 'deliberate',
    reasonCodes: ['intention.follow-up-due'],
    actionIntent: null,
    waitUntil: null,
    goalSignal: null,
    intentionSignal: null,
    ...overrides,
  })}`
}

function pending(at: number, overrides: Partial<Nan0PendingIntention> = {}): Nan0PendingIntention {
  return normalizePendingIntention({
    schemaVersion: 1,
    intentionId: 'intention-due',
    createdAt: at - 1_000,
    updatedAt: at - 1_000,
    ownerActorId: 'nan0',
    origin: 'self-generated',
    originActorId: 'nan0',
    status: 'pending',
    kind: 'follow-up',
    title: 'Revisit the unfinished thought',
    description: 'Consider whether the unfinished thought still matters.',
    motivation: 'It was explicitly deferred.',
    priority: 0.8,
    confidence: 0.9,
    goalId: null,
    thoughtId: null,
    decisionId: null,
    turnId: null,
    continuityThreadIds: [],
    relationshipIds: [],
    trigger: { schemaVersion: 1, triggerId: 'trigger-due', type: 'at-time', at, metadata: {} },
    earliestAt: at - 1_000,
    dueAt: at,
    expiresAt: null,
    lastEvaluatedAt: null,
    evaluationCount: 0,
    attemptCount: 0,
    cooldownUntil: null,
    blockedReason: null,
    resolution: null,
    lastEvaluationId: null,
    lastWakeObservationId: null,
    lastTriggerEvidenceKey: null,
    metadata: { maxAttempts: 3 },
    ...overrides,
  }, at)
}

function availableCapability(): Nan0CapabilityDefinition {
  return {
    capabilityId: 'test.prepare',
    description: 'Persist-only test capability.',
    acceptedParameters: (value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'),
    supportedExecutionModes: ['immediate'],
    permissionRequirements: [],
    canRunDuringSpeak: false,
    requiresAct: true,
    defaultTimeoutPolicy: { schemaVersion: 1, policyId: 'test', kind: 'action-specific-timeout', durationMs: 1_000, deadline: null, condition: null, metadata: {} },
    maximumActiveDurationMs: 1_000,
    supportsResume: false,
    supportsCancellation: true,
    supportsProgress: false,
    resultType: 'none',
    sideEffects: [],
    constitutionalConstraints: [],
    availability: 'available',
    toolNames: [],
  }
}

function harness(input: {
  responses?: string[]
  client?: Nan0ReasoningClient
  store?: InMemoryStateStore
  clock?: ControllableNan0Clock
  capabilities?: Nan0CapabilityDefinition[]
  timeout?: number
} = {}) {
  const clock = input.clock ?? new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 1_000 })
  const store = input.store ?? new InMemoryStateStore()
  const requests: Nan0ReasoningRequest[] = []
  const responses = [...(input.responses ?? [modelThought('SPEAK')])]
  let calls = 0
  let id = 0
  const client = input.client ?? {
    async generate(request: Nan0ReasoningRequest) {
      requests.push(structuredClone({ ...request, signal: undefined }))
      calls++
      return { text: responses.shift() ?? modelThought('SILENCE') }
    },
  }
  const kernel = new Nan0Kernel({
    stateStore: store,
    reasoningClient: client,
    clock,
    createId: () => `auto-${++id}`,
    privateThoughtTimeoutMs: input.timeout ?? 100,
    capabilityDefinitions: input.capabilities,
  })
  return { kernel, store, clock, requests, calls: () => calls }
}

async function installDue(subject: ReturnType<typeof harness>, overrides: Partial<Nan0PendingIntention> = {}) {
  await subject.kernel.boot()
  await subject.kernel.upsertPendingIntention(pending(subject.clock.utcNow(), overrides))
}

describe('nan0 autonomous cognition path', () => {
  it('creates one Nan0-owned internal observation for a due intention', async () => {
    const subject = harness({ responses: [modelThought('SPEAK')] })
    await installDue(subject)
    const result = await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    const memory = subject.kernel.getStateSnapshot().memories.find(item => item.tags.includes('internal-observation'))
    expect(result.evaluations).toHaveLength(1)
    expect(memory).toMatchObject({ actorId: 'nan0' })
    expect(memory?.metadata.ownership).toMatchObject({ actorId: 'nan0' })
  })

  it('makes no provider call for a not-yet-due intention', async () => {
    const subject = harness()
    await installDue(subject, { dueAt: 20_000, trigger: { schemaVersion: 1, triggerId: 'future', type: 'at-time', at: 20_000, metadata: {} } })
    const result = await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    expect(result.evaluations).toEqual([])
    expect(subject.calls()).toBe(0)
  })

  it('produces no random cognition or speech when no intention is eligible', async () => {
    const subject = harness()
    await subject.kernel.boot()
    const emitted = vi.fn()
    subject.kernel.onExpression(emitted)
    await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    expect(subject.calls()).toBe(0)
    expect(emitted).not.toHaveBeenCalled()
  })

  it('does not duplicate a wake observation while an expression is pending', async () => {
    const subject = harness({ responses: [modelThought('SPEAK')] })
    await installDue(subject)
    await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    expect(subject.kernel.getStateSnapshot().memories.filter(item => item.tags.includes('internal-observation'))).toHaveLength(1)
    expect(subject.calls()).toBe(1)
  })

  it('persists SILENCE without an outward expression or assistant memory', async () => {
    const subject = harness({ responses: [modelThought('SILENCE')] })
    await installDue(subject)
    const result = await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    expect(result.evaluations[0]).toMatchObject({ outcome: 'SILENCE', prepared: null })
    expect(subject.kernel.getStateSnapshot().memories.some(item => item.tags.includes('assistant-output'))).toBe(false)
  })

  it('persists WAIT with a future cooldown and no immediate loop', async () => {
    const subject = harness({ responses: [modelThought('WAIT', { waitUntil: 30_000 })] })
    await installDue(subject)
    await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    const saved = subject.kernel.getPendingIntentions()[0]
    expect(saved).toMatchObject({ status: 'deferred', cooldownUntil: 310_000 })
    expect((await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })).evaluations).toEqual([])
  })

  it('returns SPEAK only with persisted thought and decision provenance', async () => {
    const subject = harness({ responses: [modelThought('SPEAK')] })
    await installDue(subject)
    const result = await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    const prepared = result.evaluations[0].prepared!
    expect(subject.kernel.getThoughts().some(item => item.thoughtId === prepared.thoughtId)).toBe(true)
    expect(subject.kernel.getDecisions({ thoughtId: prepared.thoughtId })[0].decisionId).toBe(prepared.decision.decisionId)
  })

  it('persists ACT authority but executes no capability', async () => {
    const subject = harness({
      responses: [modelThought('ACT', { actionIntent: { type: 'test.prepare', parameters: { safe: true }, executionMode: 'immediate' } })],
      capabilities: [availableCapability()],
    })
    await installDue(subject)
    const result = await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    expect(result.evaluations[0].outcome).toBe('ACT')
    expect(subject.kernel.getStateSnapshot().actionIntents).toHaveLength(1)
    expect(subject.kernel.getStateSnapshot().actionIntents[0].status).toBe('authorized')
  })

  it('preserves the intention and increments one attempt after provider timeout', async () => {
    const client: Nan0ReasoningClient = { generate: request => new Promise((_resolve, reject) => request.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) }
    const subject = harness({ client, timeout: 5 })
    await installDue(subject)
    await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    expect(subject.kernel.getPendingIntentions()[0]).toMatchObject({ status: 'deferred', attemptCount: 1, evaluationCount: 1 })
  })

  it('completes a successful autonomous expression and owns output as Nan0', async () => {
    const subject = harness({ responses: [modelThought('SPEAK')] })
    await installDue(subject)
    const batch = await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    const prepared = batch.evaluations[0].prepared!
    await subject.kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, decisionId: prepared.decision.decisionId, content: 'A bounded autonomous line.' })
    expect(subject.kernel.getPendingIntentions()[0].status).toBe('completed')
    expect(subject.kernel.getStateSnapshot().memories.find(item => item.tags.includes('assistant-output'))).toMatchObject({ actorId: 'nan0' })
  })

  it('supplies linked continuity and relationship context to internal thought', async () => {
    const subject = harness({ responses: [modelThought('SPEAK'), modelThought('SPEAK')] })
    await subject.kernel.boot()
    const external = await subject.kernel.prepareTurn({ id: 'kyo-obs', source: 'chat', sessionId: 'session-context', actorId: 'kyo', displayName: 'Kyo', content: 'Remember the ceramics promise?', metadata: {}, timestamp: 9_000 })
    await subject.kernel.recordAssistantTurn({ turnId: external.turnId, thoughtId: external.thoughtId, decisionId: external.decision.decisionId, content: 'I remember.' })
    const relationshipId = Object.values(subject.kernel.getStateSnapshot().relationships.records)[0].relationshipId
    await subject.kernel.upsertPendingIntention(pending(subject.clock.utcNow(), { continuityThreadIds: [external.threadId], relationshipIds: [relationshipId], origin: 'relationship-derived', originActorId: 'kyo' }))
    await subject.kernel.evaluatePendingIntentions({ reason: 'interval', hostReady: true })
    const serialized = JSON.stringify(subject.requests[1])
    expect(serialized).toContain(external.threadId)
    expect(serialized).toContain(relationshipId)
  })

  it('reloads one pending resume intention and wakes it once after restart', async () => {
    const store = new InMemoryStateStore()
    const first = harness({ store, responses: [modelThought('SILENCE')] })
    await first.kernel.boot()
    await first.kernel.upsertPendingIntention(pending(first.clock.utcNow(), {
      trigger: { schemaVersion: 1, triggerId: 'resume', type: 'on-session-resume', afterBootCount: first.kernel.getStateSnapshot().bootCount, metadata: {} },
      dueAt: null,
    }))
    await first.kernel.shutdown()
    const second = harness({ store, clock: first.clock, responses: [modelThought('SILENCE')] })
    await second.kernel.boot()
    await second.kernel.evaluatePendingIntentions({ reason: 'session-resume', hostReady: true })
    await second.kernel.evaluatePendingIntentions({ reason: 'session-resume', hostReady: true })
    expect(second.kernel.getPendingIntentions()).toHaveLength(1)
    expect(second.kernel.getStateSnapshot().memories.filter(item => item.tags.includes('internal-observation'))).toHaveLength(1)
  })
})
