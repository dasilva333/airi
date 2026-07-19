import type { Nan0Thought } from '../types'

import { describe, expect, it, vi } from 'vitest'

import {
  classifyNan0DiagnosticResult,
  classifyNan0OutputDuplicate,
  createNan0KernelObservatory,
  resolveNan0KernelObservatoryConfiguration,
  serializeNan0DiagnosticJsonl,
} from './Nan0KernelObservatory'

function thought(overrides: Partial<Nan0Thought> = {}): Nan0Thought {
  return {
    schemaVersion: 3,
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    sessionId: 'session-1',
    observationEventId: 'observation-1',
    actorId: 'kyo',
    createdAt: 1_000,
    source: 'chat',
    status: 'generated',
    attentionScore: 0.8,
    noveltyScore: 0.7,
    emotionalPressure: 0.4,
    relationshipPressure: 0.2,
    continuityPressure: 0.3,
    goalPressure: 0.1,
    interpretation: 'Kyo returned after a meaningful absence.',
    privateText: 'This raw private thought must stay private by default.',
    narrative: 'This raw narrative must also stay private by default.',
    decision: 'SILENCE',
    speakability: 0.4,
    confidence: 0.9,
    mood: 'watchful',
    memoryReferences: [],
    relationshipReferences: [],
    continuityThreadReferences: [],
    reasonCodes: ['temporal.actor-returned'],
    metadata: {},
    ...overrides,
  }
}

describe('nan0KernelObservatory', () => {
  it('resolves diagnostics as opt-in with private thoughts disabled by default', () => {
    expect(resolveNan0KernelObservatoryConfiguration({})).toMatchObject({
      enabled: false,
      console: false,
      jsonl: false,
      privateThoughts: false,
      verbose: false,
      logDirectory: 'logs',
    })
    expect(resolveNan0KernelObservatoryConfiguration({
      NAN0_DEBUG: 'true',
      NAN0_DEBUG_CONSOLE: 'false',
      NAN0_DEBUG_JSONL: 'true',
      NAN0_DEBUG_PRIVATE_THOUGHTS: 'true',
      NAN0_DEBUG_VERBOSE: 'yes',
      NAN0_DEBUG_LOG_DIR: 'diagnostics',
    })).toMatchObject({
      enabled: true,
      console: false,
      jsonl: true,
      privateThoughts: true,
      verbose: true,
      logDirectory: 'diagnostics',
    })
  })

  it.each([
    [{ outcome: 'SPEAK' }, 'SPEAK'],
    [{ outcome: 'SILENCE' }, 'CHOSEN_SILENCE'],
    [{ outcome: 'WAIT' }, 'WAIT'],
    [{ outcome: 'ACT' }, 'ACT'],
    [{ outcome: 'BODY_EXPRESSION' }, 'BODY_EXPRESSION'],
    [{}, 'NO_COGNITION'],
    [{ outcome: 'idle' }, 'NO_COGNITION'],
    [{ outcome: 'skipped' }, 'SUPPRESSED_SILENCE'],
    [{ outcome: 'provider-failure' }, 'FAILURE_SILENCE'],
    [{ thought: { status: 'failed', decision: 'SILENCE' } }, 'FAILURE_SILENCE'],
    [{ thought: { status: 'interrupted', decision: 'SILENCE' } }, 'STALE'],
    [{ decision: { finalDecision: 'SPEAK', allowed: false, suppressionReason: 'authority' } }, 'SUPPRESSED_SILENCE'],
  ] as const)('classifies %o as %s', (input, expected) => {
    expect(classifyNan0DiagnosticResult(input)).toBe(expected)
  })

  it('emits correlated structured events and completes a heartbeat tick exactly once', async () => {
    const batches: unknown[][] = []
    let nextId = 0
    const observatory = createNan0KernelObservatory({
      configuration: { enabled: true },
      createId: () => String(++nextId),
      now: () => 2_000,
      sink: { async write(events) { batches.push([...events]) } },
    })

    const created = observatory.emit({
      event: 'thought.generated',
      sessionId: 'session-1',
      heartbeatTickId: 'tick-1',
      observationId: 'observation-1',
      decisionId: 'decision-1',
      provenance: { origin: 'heartbeat' },
      privateThought: thought(),
      reasonCodes: ['thought.generated'],
    })
    const firstTerminal = observatory.completeHeartbeatTick({
      heartbeatTickId: 'tick-1',
      result: 'CHOSEN_SILENCE',
      sessionId: 'session-1',
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
      turnId: 'turn-1',
    })
    const duplicateTerminal = observatory.completeHeartbeatTick({
      heartbeatTickId: 'tick-1',
      result: 'FAILURE_SILENCE',
    })
    await observatory.flush()

    expect(created).toMatchObject({
      schemaVersion: 1,
      eventId: 'diagnostic_1',
      timestamp: 2_000,
      sessionId: 'session-1',
      heartbeatTickId: 'tick-1',
      observationId: 'observation-1',
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
      turnId: 'turn-1',
      source: 'chat',
      provenance: { origin: 'heartbeat' },
    })
    expect(firstTerminal?.result).toBe('CHOSEN_SILENCE')
    expect(duplicateTerminal).toBeNull()
    expect(batches.flat().filter(event => (event as { event: string }).event === 'heartbeat.tick.completed')).toHaveLength(1)
  })

  it('exposes only a summary by default and gates full private text explicitly', () => {
    const hidden = createNan0KernelObservatory({ configuration: { enabled: true } }).emit({
      event: 'thought.generated',
      privateThought: thought(),
      details: {
        privateText: 'must be removed',
        narrative: 'must be removed',
        authorizationToken: 'must be redacted',
      },
    })
    expect(hidden?.privateSummary).toBe('Kyo returned after a meaningful absence.')
    expect(hidden).not.toHaveProperty('privateText')
    expect(hidden?.details).toEqual({ authorizationToken: '[redacted]' })

    const exposed = createNan0KernelObservatory({
      configuration: { enabled: true, privateThoughts: true },
    }).emit({ event: 'thought.generated', privateThought: thought() })
    expect(exposed?.privateText).toBe('This raw narrative must also stay private by default.')
  })

  it('serializes one parseable JSON object per line', () => {
    const event = createNan0KernelObservatory({
      configuration: { enabled: true },
      createId: () => 'jsonl',
      now: () => 3_000,
    }).emit({ event: 'observation.created', observationId: 'observation-1' })
    const line = serializeNan0DiagnosticJsonl(event!)
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toMatchObject({
      eventId: 'diagnostic_jsonl',
      event: 'observation.created',
      observationId: 'observation-1',
    })
  })

  it('contains sink failures without throwing into cognition or recursively logging them', async () => {
    const sink = { write: vi.fn(async () => { throw new Error('disk unavailable') }) }
    const diagnosticConsole = { info: vi.fn(), error: vi.fn() }
    const observatory = createNan0KernelObservatory({
      configuration: { enabled: true, batchSize: 1 },
      sink,
      console: diagnosticConsole,
    })

    expect(() => observatory.emit({ event: 'thought.started' })).not.toThrow()
    expect(() => observatory.emit({ event: 'thought.generated' })).not.toThrow()
    await expect(observatory.flush()).resolves.toBeUndefined()
    expect(sink.write).toHaveBeenCalledTimes(2)
    expect(diagnosticConsole.error).toHaveBeenCalledOnce()
  })

  it('distinguishes logging, finish-emission, and generation duplicates', () => {
    const base = {
      eventId: 'event-1',
      generationId: 'generation-1',
      sessionId: 'session-1',
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
      turnId: 'turn-1',
    }
    expect(classifyNan0OutputDuplicate(base, base)).toBe('duplicate-logging')
    expect(classifyNan0OutputDuplicate(base, { ...base, eventId: 'event-2' })).toBe('duplicate-finish-emission')
    expect(classifyNan0OutputDuplicate(base, { ...base, eventId: 'event-3', generationId: 'generation-2' })).toBe('duplicate-generation')
    expect(classifyNan0OutputDuplicate(base, { ...base, eventId: 'event-4', generationId: 'generation-3', thoughtId: 'thought-2' })).toBe('distinct-output')
  })
})
