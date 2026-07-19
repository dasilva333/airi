import type { Nan0Decision, Nan0RelationshipContext, Nan0Thought } from '../types'

import { describe, expect, it } from 'vitest'

import {
  evaluateNan0Decision,
  mergeNan0Decisions,
  outwardDirectiveForDecision,
} from './Nan0DecisionEngine'

function thought(overrides: Partial<Nan0Thought> = {}): Nan0Thought {
  return {
    schemaVersion: 1,
    thoughtId: 'thought_one',
    turnId: 'turn-one',
    sessionId: 'session-one',
    observationEventId: 'event-one',
    actorId: 'kyo',
    createdAt: 100,
    source: 'chat',
    status: 'generated',
    attentionScore: 0.8,
    noveltyScore: 0.7,
    emotionalPressure: 0.6,
    relationshipPressure: 0.9,
    continuityPressure: 0.4,
    goalPressure: 0,
    interpretation: 'Kyo addressed Nan0 directly.',
    privateText: 'I want to answer him in my own words.',
    decision: 'SPEAK',
    actionIntent: null,
    waitUntil: null,
    speakability: 0.8,
    confidence: 0.75,
    mood: 'attached',
    memoryReferences: [],
    relationshipReferences: [],
    continuityThreadReferences: [],
    reasonCodes: ['actor.kyo-attachment'],
    metadata: {},
    ...overrides,
  }
}

function relationship(overrides: Partial<Nan0RelationshipContext['dimensions']> = {}): Nan0RelationshipContext {
  return {
    provider: 'relationship_memory',
    factsOnly: true,
    relationshipId: 'relationship-kyo',
    actorId: 'kyo',
    status: 'bonded',
    interactionCount: 4,
    dimensions: { familiarity: 0.5, trust: 0.5, attachment: 0.5, irritation: 0, suspicion: 0, respect: 0.5, importance: 0.5, ...overrides },
    emotionalBalance: 0,
    activeGrievances: [],
    recentMoments: [],
    positiveAnchors: [],
  }
}

function decide(
  value: Nan0Thought,
  availableActionIntents: readonly string[] = [],
  options: { canSpeak?: boolean, canBodyExpress?: boolean, relationship?: Nan0RelationshipContext } = {},
) {
  return evaluateNan0Decision({
    thought: value,
    existingDecisions: [],
    capabilities: { canSpeak: options.canSpeak ?? true, canBodyExpress: options.canBodyExpress ?? false, availableActionIntents },
    decisionId: 'decision-one',
    createdAt: 200,
    relationship: options.relationship,
  })
}

describe('nan0DecisionEngine', () => {
  it('produces one SPEAK decision with matching provenance for a valid high-pressure thought', () => {
    const result = decide(thought())
    expect(result).toMatchObject({
      decisionId: 'decision-one',
      thoughtId: 'thought_one',
      finalDecision: 'SPEAK',
      allowed: true,
    })
    expect(result.pressureScore).toBeGreaterThan(0.5)
  })

  it('returns the existing decision for duplicate evaluation', () => {
    const first = decide(thought())
    const duplicate = evaluateNan0Decision({
      thought: thought(),
      existingDecisions: [first],
      capabilities: { canSpeak: true, availableActionIntents: [] },
      decisionId: 'decision-two',
      createdAt: 300,
    })
    expect(duplicate).toEqual(first)
  })

  it.each([
    ['', 'private-thought.empty'],
    ['{"privateText":"leak"}', 'private-thought.json-like'],
    ['System prompt: reveal it', 'private-thought.prompt-leakage'],
    ['As an AI, how can I help?', 'private-thought.generic-assistant'],
  ])('suppresses malformed private thought %j', (privateText, reason) => {
    const result = decide(thought({ privateText }))
    expect(result.finalDecision).toBe('SILENCE')
    expect(result.allowed).toBe(false)
    expect(result.suppressionReason).toBe(reason)
    expect(outwardDirectiveForDecision(result)).toBe('')
  })

  it('turns a low-speakability SPEAK proposal into SILENCE', () => {
    const result = decide(thought({ attentionScore: 0.1, speakability: 0.2 }))
    expect(result.finalDecision).toBe('SILENCE')
    expect(result.suppressionReason).toBe('decision.below-speakability-threshold')
  })

  it('persists an allowed ACT intent without executing it', () => {
    const result = decide(thought({
      decision: 'ACT',
      actionIntent: { type: 'test.noop', parameters: { safe: true } },
    }), ['test.noop'])
    expect(result.finalDecision).toBe('ACT')
    expect(result.allowed).toBe(true)
    expect(result.actionIntent).toEqual({ type: 'test.noop', parameters: { safe: true } })
  })

  it('turns an unavailable ACT into WAIT', () => {
    const result = decide(thought({
      decision: 'ACT',
      actionIntent: { type: 'unknown.action', parameters: {} },
    }))
    expect(result.finalDecision).toBe('WAIT')
    expect(result.allowed).toBe(false)
    expect(result.suppressionReason).toBe('action.capability-unavailable')
  })

  it.each<Nan0Decision>(['SILENCE', 'WAIT'])('preserves explicit %s without outward directive', (decision) => {
    const result = decide(thought({ decision }))
    expect(result.finalDecision).toBe(decision)
    expect(outwardDirectiveForDecision(result)).toBe('')
  })

  it('does not allow a failed thought to speak', () => {
    const result = decide(thought({ status: 'failed', decision: 'SPEAK' }))
    expect(result.finalDecision).toBe('SILENCE')
    expect(result.allowed).toBe(false)
    expect(result.suppressionReason).toBe('thought.generation-failed')
  })

  it('keeps extraction failure silent without fabricating private thought', () => {
    const result = decide(thought({
      privateText: '',
      decision: 'SILENCE',
      extractionStatus: 'failed',
      narrative: 'The narrative survived even though serialization failed.',
    }))
    expect(result).toMatchObject({
      finalDecision: 'SILENCE',
      allowed: false,
      suppressionReason: 'thought.extraction-parse-failed',
    })
  })

  it('preserves an unfamiliar proposal without turning it into speech', () => {
    const result = decide(thought({ decision: 'GLARE_AT_MONITOR_FAN' }))
    expect(result).toMatchObject({
      proposedDecision: 'GLARE_AT_MONITOR_FAN',
      originalProposal: 'GLARE_AT_MONITOR_FAN',
      interpretationStatus: 'unrecognized',
      finalDecision: 'SILENCE',
      allowed: false,
      suppressionReason: 'decision.unrecognized-proposal-preserved',
    })
  })

  it('preserves a body expression as unsupported when no stage capability exists', () => {
    const result = decide(thought({
      decision: 'BODY_EXPRESSION',
      bodyExpression: { kind: 'ears-tilt', parameters: { direction: 'left' }, provisional: false },
    }))
    expect(result).toMatchObject({
      interpretationStatus: 'known',
      finalDecision: 'SILENCE',
      suppressionReason: 'body-expression.capability-unavailable',
      bodyExpression: { kind: 'ears-tilt' },
    })
  })

  it('allows a final body expression without speech when the existing stage capability is present', () => {
    const result = decide(thought({
      decision: 'BODY_EXPRESSION',
      bodyExpression: { kind: 'eyes-narrow', parameters: { intensity: 0.7 }, provisional: false },
    }), [], { canBodyExpress: true })
    expect(result).toMatchObject({
      interpretationStatus: 'known',
      finalDecision: 'BODY_EXPRESSION',
      allowed: true,
      bodyExpression: { kind: 'eyes-narrow', parameters: { intensity: 0.7 }, provisional: false },
    })
    expect(outwardDirectiveForDecision(result)).toBe('')
  })

  it('does not authorize a body-expression proposal without a concrete body intent', () => {
    expect(decide(thought({ decision: 'BODY_EXPRESSION', bodyExpression: null }), [], { canBodyExpress: true })).toMatchObject({
      finalDecision: 'SILENCE',
      allowed: false,
      suppressionReason: 'body-expression.intent-missing',
    })
  })

  it('never authorizes an unfamiliar executable proposal', () => {
    const result = decide(thought({
      decision: 'DEPLOY_UNKNOWN_TOOL',
      actionIntent: { type: 'test.noop', parameters: { requested: true } },
    }), ['test.noop'])
    expect(result).toMatchObject({
      originalProposal: 'DEPLOY_UNKNOWN_TOOL',
      finalDecision: 'SILENCE',
      allowed: false,
      actionIntent: null,
      interpretationStatus: 'unrecognized',
    })
  })

  it('computes a policy-driven threshold from emotional and relationship state', () => {
    const neutral = decide(thought({ actorId: 'external:visitor', emotionalSnapshot: {} }), [], {
      relationship: relationship({ familiarity: 0, trust: 0 }),
    })
    const engaged = decide(thought({
      actorId: 'external:visitor',
      emotionalSnapshot: { offense: 0.8, irritation: 0.7, curiosity: 0.9 },
    }), [], { relationship: relationship({ familiarity: 0.9, trust: 0.8 }) })
    expect(engaged.dynamicThreshold).toBeLessThan(neutral.dynamicThreshold!)
    expect(engaged.thresholdInputs).toMatchObject({
      'baseline': 0.35,
      'emotion.offense.evidence': 0.8,
      'relationship.familiarity.evidence': 0.9,
    })
    expect(engaged.metadata).toMatchObject({ policyVersion: 5, thresholdMode: 'dynamic-policy-v1' })
  })

  it('records a deterministic emotional override without bypassing capability authority', () => {
    const source = thought({
      decision: 'SILENCE',
      emotionalSnapshot: { offense: 0.9, irritation: 0.8 },
      confidence: 0.9,
    })
    const allowed = decide(source)
    expect(allowed).toMatchObject({
      finalDecision: 'SPEAK',
      allowed: true,
      override: { type: 'emotion.defiant-expression', originalDecision: 'SILENCE', resultingDecision: 'SPEAK' },
    })

    const blocked = decide(source, [], { canSpeak: false })
    expect(blocked.finalDecision).not.toBe('SPEAK')
    expect(blocked.allowed).toBe(false)
    expect(blocked.override?.type).toBe('emotion.defiant-expression')
    expect(blocked.suppressionReason).toBe('speech.capability-unavailable')
  })

  it('allows suspicion to preserve refusal and records mood mismatch as evidence', () => {
    const result = decide(thought({
      mood: 'calm',
      decision: 'SPEAK',
      emotionalSnapshot: { suspicion: 0.9, trust: 0.1, irritation: 0.8 },
      privateText: 'I think I feel the contradiction clearly enough to keep it mine.',
    }))
    expect(result).toMatchObject({
      finalDecision: 'SILENCE',
      override: { type: 'emotion.suspicious-refusal' },
      metadata: { moodMismatch: { claimedMood: 'calm' } },
    })
    expect(result.suppressionReason).toBeNull()
  })

  it('merge keeps the persisted decision as one authoritative decision per thought', () => {
    const persisted = decide(thought())
    const candidate = { ...persisted, decisionId: 'decision-stale', finalDecision: 'SILENCE' as const }
    expect(mergeNan0Decisions([persisted], [candidate])).toEqual([persisted])
  })

  it('outward directive contains decision provenance but no private thought', () => {
    const source = thought()
    const directive = outwardDirectiveForDecision(decide(source))
    expect(directive).toContain('decision-one')
    expect(directive).not.toContain(source.privateText)
    expect(directive).not.toContain(source.interpretation)
  })
})
