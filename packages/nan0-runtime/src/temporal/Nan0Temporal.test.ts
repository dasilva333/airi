import type {
  Nan0Clock,
  Nan0KernelState,
  Nan0Observation,
  Nan0ReasoningClient,
  Nan0TemporalCondition,
} from '../types'

import { describe, expect, it, vi } from 'vitest'

import { createEmptyContinuityState } from '../continuity/ConversationContinuity'
import { createDefaultIdentityState } from '../identity/ActorIdentity'
import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { mergeNan0States } from '../persistence/LocalStorageStateStore'
import { createEmptyRelationshipState } from '../relationship/RelationshipMemory'
import { appendTimelineEvent, createEmptyTimelineState } from '../timeline/SessionTimeline'
import { ControllableNan0Clock } from './Nan0Clock'
import {
  createEmptyTemporalState,
  evaluateTemporalConditions,
  mergeTemporalStates,
  observeTemporalClock,
  persistedElapsedMs,
  registerTemporalCondition,
} from './Nan0Temporal'

const thoughtResult = `I notice time passing through the evidence without pretending it commands an action.\n---EXTRACT---\n${JSON.stringify({
  interpretation: 'Kyo shared a temporal observation.',
  privateText: 'I notice the passage of time without inventing an action.',
  decision: 'SPEAK',
  speakability: 0.8,
  confidence: 0.8,
  mood: 'attentive',
  reasonCodes: ['temporal.test'],
  actionIntent: null,
  goalSignal: null,
})}`

const observation: Nan0Observation = {
  id: 'observation-temporal',
  source: 'chat',
  sessionId: 'session-temporal',
  actorId: 'kyo',
  displayName: 'Kyo',
  content: 'How long has it been?',
  metadata: {},
  timestamp: 10_000,
}

function condition(overrides: Partial<Nan0TemporalCondition> = {}): Nan0TemporalCondition {
  return {
    schemaVersion: 1,
    conditionId: 'condition-1',
    ownerType: 'intention',
    ownerId: 'intention-1',
    dueAt: 20_000,
    status: 'pending',
    eligibleAt: null,
    lastEvaluatedAt: null,
    metadata: {},
    ...overrides,
  }
}

function state(clock: Nan0Clock, overrides: Partial<Nan0KernelState> = {}): Nan0KernelState {
  return {
    schemaVersion: 1,
    revision: 1,
    bootCount: 1,
    createdAt: 1,
    updatedAt: 1,
    emotionalState: {},
    runtimeMetadata: {},
    identity: createDefaultIdentityState(),
    memories: [],
    thoughts: [],
    decisions: [],
    goals: [],
    pendingIntentions: overrides.pendingIntentions ?? { schemaVersion: 1, revision: 0, intentions: [] },
    computations: [],
    actionIntents: [],
    turns: [],
    timeline: createEmptyTimelineState(),
    temporal: createEmptyTemporalState(clock, 1),
    continuity: createEmptyContinuityState(),
    relationships: createEmptyRelationshipState(1),
    ...overrides,
  }
}

function kernel(input: {
  clock: ControllableNan0Clock
  store?: InMemoryStateStore
  client?: Nan0ReasoningClient
  processId?: string
  timeout?: number
}) {
  let id = 0
  const calls = vi.fn()
  const client = input.client ?? {
    async generate() {
      calls()
      return { text: thoughtResult }
    },
  }
  return {
    calls,
    kernel: new Nan0Kernel({
      clock: input.clock,
      processId: input.processId ?? 'process-test',
      stateStore: input.store ?? new InMemoryStateStore(),
      reasoningClient: client,
      privateThoughtTimeoutMs: input.timeout,
      createId: () => `temporal-${++id}`,
    }),
  }
}

describe('nan0 temporal foundation', () => {
  it('uses a deterministic injected clock for UTC, local time, and conversion', () => {
    const clock = new ControllableNan0Clock({ wallTime: 1_000, monotonicTime: 50, timezone: 'Test/West', timezoneOffsetMinutes: -360 })
    expect(clock.utcNow()).toBe(1_000)
    expect(clock.localNow()).toMatchObject({ utcEpochMs: 1_000, timezone: 'Test/West', timezoneOffsetMinutes: -360 })
    clock.advance({ wallMs: 500, monotonicMs: 20 })
    expect(clock.utcNow()).toBe(1_500)
    expect(clock.monotonicNow()).toBe(70)
  })

  it('measures active-process duration with monotonic time', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100 })
    clock.advance({ wallMs: 1_000, monotonicMs: 250 })
    expect(clock.elapsedMonotonic(100)).toBe(250)
  })

  it('calculates elapsed wall time across simulated shutdown', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000 })
    clock.advance({ wallMs: 86_400_000, monotonicMs: 0 })
    expect(persistedElapsedMs(clock, 10_000)).toBe(86_400_000)
  })

  it('keeps computation timeout duration monotonic when wall time moves backward', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100 })
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => { markStarted = resolve })
    const client: Nan0ReasoningClient = {
      generate: request => new Promise((_resolve, reject) => {
        markStarted()
        request.signal?.addEventListener('abort', () => reject(request.signal?.reason), { once: true })
      }),
    }
    const subject = kernel({ clock, client, timeout: 5 }).kernel
    await subject.boot()
    const pending = subject.prepareTurn(observation)
    await started
    clock.advance({ wallMs: -5_000, monotonicMs: 25 })
    await pending
    const computation = subject.getStateSnapshot().computations[0]
    expect(computation.status).toBe('timed-out')
    expect(computation.elapsedMonotonicMs).toBe(25)
    expect(computation.finishedAt).toBeLessThan(computation.startedAt)
  })

  it('records a significant backward wall-clock jump', () => {
    const clock = new ControllableNan0Clock({ wallTime: 20_000, monotonicTime: 100 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'one', createAdjustmentId: () => 'boot' })
    clock.advance({ wallMs: -10_000, monotonicMs: 100 })
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'one', createAdjustmentId: () => 'backward' })
    expect(temporal.detectedClockAdjustments).toContainEqual(expect.objectContaining({ adjustmentId: 'backward', kind: 'wall-clock-backward' }))
  })

  it('records unexpected forward wall movement relative to monotonic process time', () => {
    const clock = new ControllableNan0Clock({ wallTime: 20_000, monotonicTime: 100 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'one', createAdjustmentId: () => 'boot' })
    clock.advance({ wallMs: 60_000, monotonicMs: 100 })
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'one', createAdjustmentId: () => 'forward' })
    expect(temporal.detectedClockAdjustments).toContainEqual(expect.objectContaining({ adjustmentId: 'forward', kind: 'wall-clock-forward', deltaMs: 59_900 }))
  })

  it('records a timezone change without reordering timeline sequence', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100, timezone: 'Zone/A', timezoneOffsetMinutes: -360 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'one', createAdjustmentId: () => 'boot' })
    let timeline = createEmptyTimelineState()
    timeline = appendTimelineEvent(timeline, { eventId: 'a', eventType: 'input', actorId: 'kyo', source: 'chat', sessionId: 's', turnId: null, thoughtId: null, observedAt: 10, recordedAt: 10, memoryReference: null, metadata: {} }).timeline
    timeline = appendTimelineEvent(timeline, { eventId: 'b', eventType: 'output', actorId: 'nan0', source: 'chat', sessionId: 's', turnId: null, thoughtId: null, observedAt: 20, recordedAt: 20, memoryReference: null, metadata: {} }).timeline
    clock.setTimezone('Zone/B', -300)
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'one', createAdjustmentId: () => `adjust-${temporal.detectedClockAdjustments.length}` })
    expect(timeline.events.map(event => [event.eventId, event.sequence])).toEqual([['a', 1], ['b', 2]])
    expect(temporal.detectedClockAdjustments.map(item => item.kind)).toEqual(expect.arrayContaining(['timezone-change', 'timezone-offset-change']))
  })

  it('preserves UTC elapsed duration across a daylight-saving offset transition', () => {
    const clock = new ControllableNan0Clock({ wallTime: 0, timezone: 'Test/DST', timezoneOffsetMinutes: -360 })
    const startedAt = clock.utcNow()
    clock.advance({ wallMs: 7_200_000 })
    clock.setTimezone('Test/DST', -300)
    expect(persistedElapsedMs(clock, startedAt)).toBe(7_200_000)
    expect(clock.localNow().timezoneOffsetMinutes).toBe(-300)
  })

  it('preserves last Kyo interaction across shutdown and restart', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100 })
    const store = new InMemoryStateStore()
    const first = kernel({ clock, store, processId: 'first' }).kernel
    await first.boot()
    await first.prepareTurn(observation)
    await first.shutdown()
    clock.advance({ wallMs: 60_000, monotonicMs: 0 })
    const second = kernel({ clock, store, processId: 'second' }).kernel
    await second.boot()
    expect(second.getTemporalState()).toMatchObject({
      lastKyoInteractionAt: observation.timestamp,
      lastShutdownAt: 10_000,
      lastBootAt: 70_000,
      lastResumeAt: 70_000,
      currentPhase: 'running',
    })
  })

  it('preserves last Nan0 thought and expression across restart', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100 })
    const store = new InMemoryStateStore()
    const first = kernel({ clock, store, processId: 'first' }).kernel
    await first.boot()
    const prepared = await first.prepareTurn(observation)
    clock.set(11_000)
    await first.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Time remained factual.', timestamp: 11_000 })
    const before = first.getTemporalState()
    await first.shutdown()
    const second = kernel({ clock, store, processId: 'second' }).kernel
    await second.boot()
    expect(second.getTemporalState()).toMatchObject({ lastNan0ThoughtAt: before.lastNan0ThoughtAt, lastNan0ExpressionAt: 11_000 })
  })

  it('allows persisted sleep duration to exceed computation timeout safely', () => {
    const clock = new ControllableNan0Clock({ wallTime: 0 })
    let temporal = registerTemporalCondition(createEmptyTemporalState(clock), condition({ ownerType: 'sleep', ownerId: 'sleep-1', dueAt: 3_600_000, metadata: { startedAt: 0 } }))
    clock.advance({ wallMs: 180_000 })
    temporal = evaluateTemporalConditions(temporal, { clock, processId: 'one', createAdjustmentId: () => 'none' }).temporal
    expect(temporal.conditions[0].status).toBe('pending')
    expect(persistedElapsedMs(clock, 0)).toBeGreaterThan(90_000)
  })

  it('keeps a long-lived job pending through unrelated clock checks', () => {
    const clock = new ControllableNan0Clock({ wallTime: 1_000 })
    let temporal = registerTemporalCondition(createEmptyTemporalState(clock), condition({ ownerType: 'job', ownerId: 'art-job', dueAt: 1_801_000 }))
    clock.advance({ wallMs: 90_001, monotonicMs: 90_001 })
    temporal = evaluateTemporalConditions(temporal, { clock, processId: 'one', createAdjustmentId: () => 'none' }).temporal
    expect(temporal.conditions[0]).toMatchObject({ ownerId: 'art-job', status: 'pending' })
  })

  it('keeps a future intention not due and retains nextEvaluationAt', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000 })
    const temporal = registerTemporalCondition(createEmptyTemporalState(clock), condition({ dueAt: 20_000 }))
    const evaluated = evaluateTemporalConditions(temporal, { clock, processId: 'one', createAdjustmentId: () => 'none' })
    expect(evaluated.eligible).toEqual([])
    expect(evaluated.temporal.conditions[0].status).toBe('pending')
    expect(evaluated.temporal.nextEvaluationAt).toBe(20_000)
  })

  it('makes an overdue intention eligible exactly once', () => {
    const clock = new ControllableNan0Clock({ wallTime: 30_000 })
    const temporal = registerTemporalCondition(createEmptyTemporalState(clock), condition({ dueAt: 20_000 }))
    const once = evaluateTemporalConditions(temporal, { clock, processId: 'one', createAdjustmentId: () => 'none' })
    const twice = evaluateTemporalConditions(once.temporal, { clock, processId: 'one', createAdjustmentId: () => 'none' })
    expect(once.eligible.map(item => item.conditionId)).toEqual(['condition-1'])
    expect(twice.eligible).toEqual([])
  })

  it('evaluates an idle scheduler without provider work', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000 })
    const subject = kernel({ clock })
    await subject.kernel.boot()
    await subject.kernel.registerTemporalCondition(condition({ dueAt: 20_000 }))
    expect(await subject.kernel.evaluateTemporalEligibility()).toEqual([])
    expect(subject.calls).not.toHaveBeenCalled()
  })

  it('performs one bounded no-provider evaluation when the kernel resumes', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100 })
    const subject = kernel({ clock })
    await subject.kernel.boot()
    await subject.kernel.registerTemporalCondition(condition({ dueAt: 20_000 }))
    await subject.kernel.suspend()
    clock.advance({ wallMs: 15_000, monotonicMs: 15_000 })
    expect((await subject.kernel.resume()).map(item => item.conditionId)).toEqual(['condition-1'])
    expect(subject.kernel.getTemporalState()).toMatchObject({ currentPhase: 'running', lastResumeAt: 25_000 })
    expect(subject.calls).not.toHaveBeenCalled()
  })

  it('evaluates overdue restart conditions once in bounded deterministic order', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 30_000 })
    const store = new InMemoryStateStore()
    let temporal = createEmptyTemporalState(clock, 1)
    temporal = registerTemporalCondition(temporal, condition({ conditionId: 'b', dueAt: 20_000 }))
    temporal = registerTemporalCondition(temporal, condition({ conditionId: 'a', dueAt: 20_000 }))
    temporal = registerTemporalCondition(temporal, condition({ conditionId: 'c', dueAt: 40_000 }))
    await store.save(state(clock, { temporal }))
    const subject = kernel({ clock, store, processId: 'restart' }).kernel
    await subject.boot()
    expect(subject.getTemporalState().conditions.map(item => [item.conditionId, item.status])).toEqual([['a', 'eligible'], ['b', 'eligible'], ['c', 'pending']])
    expect(await subject.evaluateTemporalEligibility()).toEqual([])
  })

  it('does not allow a read-only snapshot consumer to mutate authoritative temporal state', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000 })
    const subject = kernel({ clock }).kernel
    await subject.boot()
    const snapshot = subject.getStateSnapshot() as Nan0KernelState
    snapshot.temporal.lastKyoInteractionAt = 1
    expect(subject.getTemporalState().lastKyoInteractionAt).toBeNull()
  })

  it('prevents a stale writer from rolling temporal markers backward', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10_000 })
    const current = { ...createEmptyTemporalState(clock), revision: 5, lastKyoInteractionAt: 9_000 }
    const stale = { ...createEmptyTemporalState(clock), revision: 4, lastKyoInteractionAt: 1_000 }
    expect(mergeTemporalStates(current, stale, clock, 1).lastKyoInteractionAt).toBe(9_000)
    expect(mergeNan0States(state(clock, { temporal: current }), state(clock, { temporal: stale }), clock).temporal.lastKyoInteractionAt).toBe(9_000)
  })

  it('accepts a future external hardware clock through the same interface', () => {
    class HardwareClock implements Nan0Clock {
      readonly source = 'hardware-rtc'
      readonly confidence = 0.95
      utcNow = () => 5_000
      localNow = () => this.toLocal(this.utcNow())
      monotonicNow = () => 10
      timezone = () => 'UTC'
      timezoneOffsetMinutes = () => 0
      toLocal = (utcEpochMs: number) => ({ utcEpochMs, utcIso: new Date(utcEpochMs).toISOString(), localIso: new Date(utcEpochMs).toISOString(), timezone: 'UTC', timezoneOffsetMinutes: 0 })
      elapsedWall = (start: number, end = this.utcNow()) => end - start
      elapsedMonotonic = (start: number, end = this.monotonicNow()) => end - start
    }
    expect(createEmptyTemporalState(new HardwareClock()).clockSource).toBe('hardware-rtc')
  })

  it('never turns a direct temporal eligibility event into speech', async () => {
    const clock = new ControllableNan0Clock({ wallTime: 30_000 })
    const subject = kernel({ clock })
    const expressions = vi.fn()
    subject.kernel.onExpression(expressions)
    await subject.kernel.boot()
    await subject.kernel.registerTemporalCondition(condition({ dueAt: 20_000 }))
    expect((await subject.kernel.evaluateTemporalEligibility()).map(item => item.conditionId)).toEqual(['condition-1'])
    expect(subject.calls).not.toHaveBeenCalled()
    expect(expressions).not.toHaveBeenCalled()
  })

  it('keeps timeline sequence authoritative under a clock discontinuity', () => {
    const clock = new ControllableNan0Clock({ wallTime: 20_000, monotonicTime: 100 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'one', createAdjustmentId: () => 'boot' })
    let timeline = createEmptyTimelineState()
    timeline = appendTimelineEvent(timeline, { eventId: 'experienced-first', eventType: 'input', actorId: 'kyo', source: 'chat', sessionId: 's', turnId: null, thoughtId: null, observedAt: 20_000, recordedAt: 20_000, memoryReference: null, metadata: {} }).timeline
    clock.advance({ wallMs: -10_000, monotonicMs: 100 })
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'one', createAdjustmentId: () => 'backward' })
    timeline = appendTimelineEvent(timeline, { eventId: 'experienced-second', eventType: 'temporal-check', actorId: 'nan0', source: 'temporal', sessionId: 's', turnId: null, thoughtId: null, observedAt: 10_000, recordedAt: 10_000, memoryReference: null, metadata: { adjustmentId: 'backward' } }).timeline
    expect(timeline.events.map(event => event.eventId)).toEqual(['experienced-first', 'experienced-second'])
    expect(timeline.events.map(event => event.sequence)).toEqual([1, 2])
    expect(temporal.detectedClockAdjustments.at(-1)?.kind).toBe('wall-clock-backward')
  })
})
