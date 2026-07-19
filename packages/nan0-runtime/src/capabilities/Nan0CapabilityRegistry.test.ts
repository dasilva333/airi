import type { Nan0ActionIntentRecord, Nan0CapabilityDefinition, Nan0DecisionRecord } from '../types'

import { describe, expect, it } from 'vitest'

import { Nan0CapabilityRegistry } from './Nan0CapabilityRegistry'

function policy(kind: Nan0CapabilityDefinition['defaultTimeoutPolicy']['kind'] = 'action-specific-timeout') {
  return { schemaVersion: 1 as const, policyId: `test.${kind}`, kind, durationMs: kind === 'no-active-timeout' ? null : 60_000, deadline: null, condition: null, metadata: {} }
}

function capability(overrides: Partial<Nan0CapabilityDefinition> = {}): Nan0CapabilityDefinition {
  return {
    capabilityId: 'test.noop',
    description: 'Safe test no-op.',
    acceptedParameters: (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as any).safe === true),
    supportedExecutionModes: ['immediate'],
    permissionRequirements: [],
    canRunDuringSpeak: false,
    requiresAct: true,
    defaultTimeoutPolicy: policy(),
    maximumActiveDurationMs: 60_000,
    supportsResume: false,
    supportsCancellation: true,
    supportsProgress: false,
    resultType: 'none',
    sideEffects: [],
    constitutionalConstraints: ['test-only'],
    availability: 'available',
    toolNames: ['test_noop'],
    ...overrides,
  }
}

function decision(overrides: Partial<Nan0DecisionRecord> = {}): Nan0DecisionRecord {
  return {
    schemaVersion: 1,
    decisionId: 'decision-1',
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    sessionId: 'session-1',
    createdAt: 10,
    proposedDecision: 'ACT',
    finalDecision: 'ACT',
    allowed: true,
    confidence: 1,
    speakability: 0,
    attentionScore: 1,
    pressureScore: 1,
    reasonCodes: [],
    constraintResults: [],
    suppressionReason: null,
    actionIntent: { type: 'test.noop', parameters: { safe: true }, executionMode: 'immediate' },
    waitUntil: null,
    metadata: {},
    ...overrides,
  }
}

function action(overrides: Partial<Nan0ActionIntentRecord> = {}): Nan0ActionIntentRecord {
  return {
    schemaVersion: 1,
    actionIntentId: 'action-1',
    decisionId: 'decision-1',
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    capabilityId: 'test.noop',
    executionMode: 'immediate',
    requestedAt: 10,
    parameters: { safe: true },
    timeoutPolicy: policy(),
    deadline: null,
    resumePolicy: 'never',
    interruptPolicy: 'cancel',
    status: 'authorized',
    metadata: {},
    ...overrides,
  }
}

describe('nan0 capability registry and action authority', () => {
  it('rejects unknown and unavailable capabilities', () => {
    const registry = new Nan0CapabilityRegistry([capability({ capabilityId: 'test.off', availability: 'unavailable' })])
    expect(registry.validate('unknown.future', {}, 'immediate')).toBeNull()
    expect(registry.validate('test.off', { safe: true }, 'immediate')).toBeNull()
  })

  it('validates parameters before authorizing', () => {
    const registry = new Nan0CapabilityRegistry([capability()])
    expect(registry.validate('test.noop', { safe: false }, 'immediate')).toBeNull()
    expect(registry.validate('test.noop', { safe: true }, 'immediate')?.capabilityId).toBe('test.noop')
  })

  it('supports multiple declared execution modes without Decision Engine branches', () => {
    const registry = new Nan0CapabilityRegistry([capability({ supportedExecutionModes: ['immediate', 'durable-job', 'state-transition'] })])
    expect(registry.validate('test.noop', { safe: true }, 'durable-job')).not.toBeNull()
    expect(registry.validate('test.noop', { safe: true }, 'scheduled')).toBeNull()
  })

  it('produces bounded authority for one matching persisted ACT', () => {
    const registry = new Nan0CapabilityRegistry([capability()])
    expect(registry.authorityFor(action(), decision())).toEqual({
      schemaVersion: 1,
      actionIntentId: 'action-1',
      decisionId: 'decision-1',
      thoughtId: 'thought-1',
      turnId: 'turn-1',
      capabilityId: 'test.noop',
      executionMode: 'immediate',
      lifecyclePolicyId: 'test.action-specific-timeout',
      parameters: { safe: true },
      authorizedToolNames: ['test_noop'],
    })
  })

  it('supports explicitly declared capability authority during SPEAK', () => {
    const registry = new Nan0CapabilityRegistry([capability({ canRunDuringSpeak: true, requiresAct: false })])
    const speakDecision = decision({ finalDecision: 'SPEAK', proposedDecision: 'SPEAK' })
    expect(registry.authorityFor(action(), speakDecision)?.authorizedToolNames).toEqual(['test_noop'])
  })

  it.each([
    { action: { thoughtId: 'thought-forged' }, decision: {} },
    { action: { decisionId: 'decision-forged' }, decision: {} },
    { action: { turnId: 'turn-forged' }, decision: {} },
    { action: { capabilityId: 'unknown.future' }, decision: {} },
    { action: {}, decision: { finalDecision: 'SPEAK' as const } },
  ])('blocks mismatched or forged provenance %#', ({ action: actionOverrides, decision: decisionOverrides }) => {
    const registry = new Nan0CapabilityRegistry([capability()])
    expect(registry.authorityFor(action(actionOverrides), decision(decisionOverrides))).toBeNull()
  })

  it('allows state transitions to declare no active computation timeout', () => {
    const definition = capability({
      capabilityId: 'sleep.enter',
      supportedExecutionModes: ['state-transition'],
      defaultTimeoutPolicy: policy('no-active-timeout'),
    })
    expect(definition.defaultTimeoutPolicy.durationMs).toBeNull()
  })

  it('allows durable jobs to own a capability-specific timeout', () => {
    const definition = capability({
      capabilityId: 'art.generate',
      supportedExecutionModes: ['durable-job'],
      defaultTimeoutPolicy: { ...policy(), durationMs: 1_800_000 },
      supportsResume: true,
      supportsProgress: true,
    })
    expect(definition.defaultTimeoutPolicy.durationMs).toBe(1_800_000)
    expect(definition.supportsResume).toBe(true)
  })
})
