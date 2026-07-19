import type { Nan0PreparedTurn } from '@proj-airi/nan0-runtime'

import { describe, expect, it } from 'vitest'

import { toAutonomyEvaluationProxy, toPreparedTurnProxy, toTemporalAutonomyEvaluationProxy } from './nan0-bridge'

function preparedTurn(): Nan0PreparedTurn {
  return {
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    sessionId: 'session-1',
    inputEventId: 'event-1',
    threadId: 'thread-1',
    systemContext: '[NAN0 KERNEL CONTEXT]\nBounded outward directive.',
    thought: {
      privateText: 'This must stay in the owner renderer.',
      interpretation: 'Bounded interpretation.',
      metadata: { hidden: 'owner-only' },
    },
    decision: {
      decisionId: 'decision-1',
      finalDecision: 'SPEAK',
      allowed: true,
      confidence: 0.8,
      speakability: 0.9,
      attentionScore: 0.7,
      pressureScore: 0.6,
      reasonCodes: ['kyo-addressed'],
      suppressionReason: null,
      actionIntent: null,
      waitUntil: null,
    },
  } as unknown as Nan0PreparedTurn
}

describe('nan0 renderer bridge', () => {
  it('exposes only the final decision and bounded outward directive', () => {
    const prepared = preparedTurn()
    const proxy = toPreparedTurnProxy(prepared)
    const serialized = JSON.stringify(proxy)

    expect(proxy).toEqual({
      thoughtId: 'thought-1',
      turnId: 'turn-1',
      sessionId: 'session-1',
      inputEventId: 'event-1',
      threadId: 'thread-1',
      outwardDirective: '[NAN0 KERNEL CONTEXT]\nBounded outward directive.',
      actionAuthority: null,
      decision: {
        decisionId: 'decision-1',
        finalDecision: 'SPEAK',
        allowed: true,
        confidence: 0.8,
        speakability: 0.9,
        attentionScore: 0.7,
        pressureScore: 0.6,
        reasonCodes: ['kyo-addressed'],
        suppressionReason: null,
        actionIntent: null,
        waitUntil: null,
        bodyExpression: null,
      },
    })
    expect(serialized).not.toContain('privateText')
    expect(serialized).not.toContain('This must stay')
    expect(serialized).not.toContain('owner-only')
    expect(serialized).not.toContain('interpretation')
  })

  it('crosses only bounded body-expression kind and intensity', () => {
    const prepared = preparedTurn()
    prepared.decision.finalDecision = 'BODY_EXPRESSION'
    prepared.decision.bodyExpression = {
      kind: 'eyes-narrow',
      parameters: { intensity: 2, privateAssociation: 'must-not-cross' },
      provisional: false,
    }
    const proxy = toPreparedTurnProxy(prepared)

    expect(proxy.decision.bodyExpression).toEqual({ kind: 'eyes-narrow', intensity: 1 })
    expect(JSON.stringify(proxy)).not.toContain('privateAssociation')
  })

  it('copies reason codes so the executor cannot mutate the owner decision', () => {
    const prepared = preparedTurn()
    const proxy = toPreparedTurnProxy(prepared)
    proxy.decision.reasonCodes.push('executor-change')

    expect(prepared.decision.reasonCodes).toEqual(['kyo-addressed'])
  })

  it('transmits only bounded action authority and clones sanitized parameters', () => {
    const prepared = preparedTurn()
    prepared.actionAuthority = {
      schemaVersion: 1,
      actionIntentId: 'action-1',
      decisionId: 'decision-1',
      thoughtId: 'thought-1',
      turnId: 'turn-1',
      capabilityId: 'test.noop',
      executionMode: 'immediate',
      lifecyclePolicyId: 'test.immediate',
      parameters: { safe: true },
      authorizedToolNames: ['test_noop'],
    }
    const proxy = toPreparedTurnProxy(prepared)
    proxy.actionAuthority!.parameters.safe = false

    expect(prepared.actionAuthority.parameters).toEqual({ safe: true })
    expect(JSON.stringify(proxy)).not.toContain('privateText')
    expect(proxy.actionAuthority).toMatchObject({
      actionIntentId: 'action-1',
      capabilityId: 'test.noop',
      lifecyclePolicyId: 'test.immediate',
      authorizedToolNames: ['test_noop'],
    })
  })

  it('never sends a private autonomous thought across the owner bridge', () => {
    const proxy = toAutonomyEvaluationProxy({
      nextEvaluationAt: null,
      evaluations: [{
        intentionId: 'intention-1',
        evaluationId: 'evaluation-1',
        observationId: 'observation-1',
        prepared: preparedTurn(),
        outcome: 'SPEAK',
        nextEvaluationAt: null,
      }],
    })
    const serialized = JSON.stringify(proxy)
    expect(serialized).toContain('intention-1')
    expect(serialized).not.toContain('privateText')
    expect(serialized).not.toContain('This must stay')
    expect(serialized).not.toContain('interpretation')
  })

  it('sends temporal provenance without exposing the private temporal thought', () => {
    const proxy = toTemporalAutonomyEvaluationProxy({
      nextEvaluationAt: 42_000,
      evaluations: [{
        temporalEventId: 'temporal-1',
        observationId: 'observation-temporal-1',
        prepared: preparedTurn(),
        outcome: 'SPEAK',
        nextEvaluationAt: 42_000,
      }],
    })
    const serialized = JSON.stringify(proxy)

    expect(proxy.evaluations[0]).toMatchObject({
      temporalEventId: 'temporal-1',
      observationId: 'observation-temporal-1',
      outcome: 'SPEAK',
    })
    expect(serialized).not.toContain('privateText')
    expect(serialized).not.toContain('This must stay')
    expect(serialized).not.toContain('interpretation')
  })
})
