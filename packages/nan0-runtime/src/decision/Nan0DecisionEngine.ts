import type {
  Nan0ActionIntent,
  Nan0Decision,
  Nan0DecisionConstraintResult,
  Nan0DecisionRecord,
  Nan0EmotionalDecisionShift,
  Nan0RelationshipContext,
  Nan0Thought,
  Nan0ThoughtPolicy,
} from '../types'

import { NAN0_DEFAULT_THOUGHT_POLICY } from '../thought/Nan0ThoughtPolicy'

export const NAN0_SPEAKABILITY_THRESHOLD = 0.35
const KNOWN_NON_EXECUTING_PROPOSALS = new Set([
  'MUTTER',
  'DEFLECT',
  'INTERRUPT',
  'TRAIL_OFF',
])

export interface Nan0DecisionCapabilities {
  canSpeak: boolean
  canBodyExpress?: boolean
  availableActionIntents: readonly string[]
  validateActionIntent?: (intent: Readonly<Nan0ActionIntent>) => boolean
  allowsActionDuringSpeak?: (intent: Readonly<Nan0ActionIntent>) => boolean
}

export interface Nan0DecisionEngineInput {
  thought: Readonly<Nan0Thought>
  existingDecisions: readonly Nan0DecisionRecord[]
  capabilities: Readonly<Nan0DecisionCapabilities>
  decisionId: string
  createdAt: number
  additionalConstraints?: readonly Nan0DecisionConstraintResult[]
  minimumSpeakAttention?: number
  policy?: string
  thoughtPolicy?: Readonly<Nan0ThoughtPolicy>
  relationship?: Readonly<Nan0RelationshipContext>
  emotionalShift?: Readonly<Nan0EmotionalDecisionShift>
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function privateThoughtViolation(privateText: string): string | null {
  const normalized = privateText.trim().toLowerCase()
  if (!normalized)
    return 'private-thought.empty'
  if (/^[[{]/.test(normalized) || /[\]}]\s*$/.test(normalized))
    return 'private-thought.json-like'
  if (/nan0 kernel context|system prompt|thought[_ -]?id|<\|(?:actor|act|delay):/i.test(privateText))
    return 'private-thought.prompt-leakage'
  if (/\b(as an ai|how can i help|i(?:'| a)m here to assist|let me know if you need)\b/i.test(privateText))
    return 'private-thought.generic-assistant'
  if (/\b(schema|json object|assistant response|user request)\s*:/i.test(privateText))
    return 'private-thought.transport-debris'
  return null
}

function normalizeActionIntent(value: Nan0ActionIntent | null | undefined): Nan0ActionIntent | null {
  if (!value || typeof value.type !== 'string' || !value.type.trim())
    return null
  return {
    type: value.type.trim().slice(0, 120),
    target: typeof value.target === 'string' && value.target.trim()
      ? value.target.trim().slice(0, 240)
      : undefined,
    parameters: value.parameters && typeof value.parameters === 'object' && !Array.isArray(value.parameters)
      ? structuredClone(value.parameters)
      : {},
    executionMode: value.executionMode,
  }
}

function pressureScore(thought: Readonly<Nan0Thought>): number {
  return clamp(
    clamp(thought.emotionalPressure) * 0.25
    + clamp(thought.relationshipPressure) * 0.3
    + clamp(thought.continuityPressure) * 0.2
    + clamp(thought.noveltyScore) * 0.15
    + clamp(thought.goalPressure) * 0.1,
  )
}

function coreDecision(proposal: string): Nan0Decision | null {
  return proposal === 'SPEAK' || proposal === 'SILENCE' || proposal === 'ACT' || proposal === 'WAIT' || proposal === 'BODY_EXPRESSION'
    ? proposal
    : null
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function dynamicSpeakabilityThreshold(input: Nan0DecisionEngineInput): {
  threshold: number
  inputs: Record<string, number>
} {
  const policy = input.thoughtPolicy ?? NAN0_DEFAULT_THOUGHT_POLICY
  const thought = input.thought
  const inputs: Record<string, number> = { baseline: clamp(policy.dynamicThresholdBaseline) }
  let threshold = inputs.baseline
  const add = (key: string, evidence: number, weight: number | undefined) => {
    const boundedEvidence = clamp(evidence)
    const boundedWeight = finite(weight)
    const delta = boundedEvidence * boundedWeight
    inputs[`${key}.evidence`] = boundedEvidence
    inputs[`${key}.delta`] = delta
    threshold += delta
  }

  for (const [emotion, weight] of Object.entries(policy.emotionalModifiers))
    add(`emotion.${emotion}`, finite(thought.emotionalSnapshot?.[emotion]), weight)

  if (thought.actorId === 'kyo')
    add('relationship.kyo', 1, policy.relationshipModifiers.kyo)
  add('relationship.familiarity', finite(input.relationship?.dimensions.familiarity), policy.relationshipModifiers.familiarity)
  add('relationship.trust', finite(input.relationship?.dimensions.trust), policy.relationshipModifiers.trust)
  add('relationship.grievance', input.relationship?.activeGrievances.length ? 1 : 0, policy.relationshipModifiers.grievance)
  add('attention.directlyAddressed', thought.reasonCodes.includes('event.addressed') ? 1 : 0, policy.attentionModifiers.directlyAddressed)
  add('attention.score', thought.attentionScore, policy.attentionModifiers.attentionScore)
  add('continuity.pressure', thought.continuityPressure, policy.continuityModifiers.continuityPressure)

  const noveltyPenalty = clamp(1 - thought.noveltyScore) * finite(policy.noveltyPenalty)
  inputs['novelty.penalty'] = noveltyPenalty
  threshold += noveltyPenalty
  const lowInformationPenalty = thought.reasonCodes.includes('event.low-information')
    ? finite(policy.lowInformationPenalty)
    : 0
  inputs['information.penalty'] = lowInformationPenalty
  threshold += lowInformationPenalty
  const emotionalMetabolismShift = finite(input.emotionalShift?.speakabilityShift)
  inputs['emotion.metabolism-shift'] = emotionalMetabolismShift
  threshold += emotionalMetabolismShift
  return { threshold: clamp(threshold, 0.05, 0.95), inputs }
}

function emotionalDecisionOverride(
  thought: Readonly<Nan0Thought>,
  decision: Nan0Decision,
): { decision: Nan0Decision, override: Nan0DecisionRecord['override'] } {
  const emotion = thought.emotionalSnapshot ?? {}
  if (decision === 'SPEAK'
    && finite(emotion.suspicion) >= 0.85
    && finite(emotion.trust, 0.5) <= 0.25) {
    return {
      decision: 'SILENCE',
      override: {
        type: 'emotion.suspicious-refusal',
        reason: 'High suspicion with low trust suppressed outward expression.',
        originalDecision: decision,
        resultingDecision: 'SILENCE',
      },
    }
  }
  if ((decision === 'SILENCE' || decision === 'WAIT')
    && finite(emotion.offense) >= 0.8
    && finite(emotion.irritation) >= 0.65
    && thought.confidence >= 0.6) {
    return {
      decision: 'SPEAK',
      override: {
        type: 'emotion.defiant-expression',
        reason: 'Strong offense and irritation made expression more compelling than silence.',
        originalDecision: decision,
        resultingDecision: 'SPEAK',
      },
    }
  }
  return { decision, override: null }
}

function moodMismatch(thought: Readonly<Nan0Thought>): Record<string, unknown> | null {
  const mood = thought.mood.trim().toLowerCase()
  const emotion = thought.emotionalSnapshot ?? {}
  if (/\b(calm|quiet|content|peaceful)\b/.test(mood)
    && Math.max(finite(emotion.irritation), finite(emotion.offense)) >= 0.75) {
    return {
      claimedMood: thought.mood,
      relevantVector: { irritation: finite(emotion.irritation), offense: finite(emotion.offense) },
      reason: 'Calm mood label coexists with strong irritation or offense.',
    }
  }
  return null
}

function constraintsFor(
  thought: Readonly<Nan0Thought>,
  capabilities: Readonly<Nan0DecisionCapabilities>,
  actionIntent: Nan0ActionIntent | null,
  additional: readonly Nan0DecisionConstraintResult[] = [],
): Nan0DecisionConstraintResult[] {
  const privateViolation = privateThoughtViolation(thought.privateText)
  const extractionFailed = thought.extractionStatus === 'failed'
  return [
    { code: 'thought.id-present', passed: /^thought_.+/.test(thought.thoughtId), hard: true },
    { code: 'thought.provenance-matches', passed: Boolean(thought.turnId && thought.sessionId), hard: true },
    { code: 'thought.status-generated', passed: thought.status === 'generated', hard: true },
    { code: extractionFailed ? 'thought.extraction-parse-failed' : 'thought.extraction-complete', passed: !extractionFailed, hard: true },
    { code: privateViolation ?? 'thought.private-text-valid', passed: privateViolation == null || extractionFailed, hard: true },
    { code: 'speech.capability-available', passed: capabilities.canSpeak, hard: false },
    { code: 'body-expression.intent-present', passed: thought.decision !== 'BODY_EXPRESSION' || thought.bodyExpression != null, hard: false },
    { code: 'body-expression.capability-available', passed: thought.decision !== 'BODY_EXPRESSION' || capabilities.canBodyExpress === true, hard: false },
    {
      code: 'action.intent-valid',
      passed: thought.decision !== 'ACT' || actionIntent != null,
      hard: thought.decision === 'ACT',
    },
    {
      code: 'action.capability-available',
      passed: thought.decision !== 'ACT'
        || (actionIntent != null
          && capabilities.availableActionIntents.includes(actionIntent.type)
          && (capabilities.validateActionIntent?.(actionIntent) ?? true)),
      hard: false,
    },
    ...additional.map(result => ({ ...result })),
  ]
}

export function evaluateNan0Decision(input: Nan0DecisionEngineInput): Nan0DecisionRecord {
  const existing = input.existingDecisions.find(item => item.thoughtId === input.thought.thoughtId)
  if (existing)
    return structuredClone(existing)

  const thought = input.thought
  const proposedCoreDecision = coreDecision(thought.decision)
  const interpretationStatus = proposedCoreDecision
    ? 'known' as const
    : KNOWN_NON_EXECUTING_PROPOSALS.has(thought.decision)
      ? 'unsupported' as const
      : 'unrecognized' as const
  const dynamicThreshold = dynamicSpeakabilityThreshold(input)
  const emotionalInfluence = proposedCoreDecision
    ? emotionalDecisionOverride(thought, proposedCoreDecision)
    : { decision: 'SILENCE' as const, override: null }
  const effectiveDecision = emotionalInfluence.decision
  const actionIntent = normalizeActionIntent(thought.actionIntent)
  const constraintResults = constraintsFor(thought, input.capabilities, actionIntent, input.additionalConstraints)
  const hardFailure = constraintResults.find(result => result.hard && !result.passed)
  const reasonCodes = [...new Set(thought.reasonCodes)]
  let finalDecision: Nan0Decision = effectiveDecision
  let allowed = true
  let suppressionReason: string | null = null

  if (thought.status === 'failed') {
    finalDecision = 'SILENCE'
    allowed = false
    suppressionReason = 'thought.generation-failed'
  }
  else if (hardFailure) {
    finalDecision = 'SILENCE'
    allowed = false
    suppressionReason = hardFailure.code
  }
  else if (!proposedCoreDecision) {
    finalDecision = 'SILENCE'
    allowed = false
    suppressionReason = interpretationStatus === 'unsupported'
      ? 'decision.unsupported-expression-preserved'
      : 'decision.unrecognized-proposal-preserved'
  }
  else if (effectiveDecision === 'SPEAK') {
    if (!input.capabilities.canSpeak) {
      finalDecision = 'WAIT'
      allowed = false
      suppressionReason = 'speech.capability-unavailable'
    }
    else if (thought.speakability < dynamicThreshold.threshold) {
      finalDecision = 'SILENCE'
      allowed = false
      suppressionReason = 'decision.below-speakability-threshold'
    }
    else if (input.minimumSpeakAttention != null && thought.attentionScore < clamp(input.minimumSpeakAttention + finite(input.emotionalShift?.attentionShift), 0.05, 0.95)) {
      finalDecision = 'SILENCE'
      allowed = false
      suppressionReason = 'decision.below-autonomous-relevance-threshold'
    }
    else if (actionIntent && !(input.capabilities.allowsActionDuringSpeak?.(actionIntent) ?? false)) {
      finalDecision = 'WAIT'
      allowed = false
      suppressionReason = 'action.speak-authorization-unavailable'
    }
  }
  else if (effectiveDecision === 'ACT') {
    if (!actionIntent) {
      finalDecision = 'WAIT'
      allowed = false
      suppressionReason = 'action.intent-invalid'
    }
    else if (!input.capabilities.availableActionIntents.includes(actionIntent.type)
      || !(input.capabilities.validateActionIntent?.(actionIntent) ?? true)) {
      finalDecision = 'WAIT'
      allowed = false
      suppressionReason = 'action.capability-unavailable'
    }
  }
  else if (effectiveDecision === 'BODY_EXPRESSION') {
    if (!thought.bodyExpression) {
      finalDecision = 'SILENCE'
      allowed = false
      suppressionReason = 'body-expression.intent-missing'
    }
    else if (input.capabilities.canBodyExpress !== true) {
      finalDecision = 'SILENCE'
      allowed = false
      suppressionReason = 'body-expression.capability-unavailable'
    }
  }

  if (suppressionReason)
    reasonCodes.push(suppressionReason)
  if (emotionalInfluence.override)
    reasonCodes.push(emotionalInfluence.override.type)

  return normalizeNan0Decision({
    schemaVersion: 1,
    decisionId: input.decisionId,
    thoughtId: thought.thoughtId,
    turnId: thought.turnId,
    sessionId: thought.sessionId,
    createdAt: input.createdAt,
    proposedDecision: thought.decision,
    finalDecision,
    allowed,
    confidence: clamp(thought.confidence),
    speakability: clamp(thought.speakability),
    attentionScore: clamp(thought.attentionScore),
    pressureScore: pressureScore(thought),
    reasonCodes: [...new Set(reasonCodes)].slice(0, 16),
    constraintResults,
    suppressionReason,
    actionIntent: finalDecision === 'ACT'
      || (finalDecision === 'SPEAK' && actionIntent && (input.capabilities.allowsActionDuringSpeak?.(actionIntent) ?? false))
      ? actionIntent
      : null,
    waitUntil: finalDecision === 'WAIT' && Number.isFinite(thought.waitUntil)
      ? Math.max(input.createdAt, Number(thought.waitUntil))
      : null,
    originalProposal: thought.proposedDecision ?? thought.decision,
    interpretationStatus,
    dynamicThreshold: dynamicThreshold.threshold,
    thresholdInputs: dynamicThreshold.inputs,
    emotionalSnapshot: structuredClone(thought.emotionalSnapshot ?? {}),
    override: emotionalInfluence.override,
    bodyExpression: thought.bodyExpression ? structuredClone(thought.bodyExpression) : null,
    metadata: {
      policy: input.policy ?? 'nan0-decision-v1',
      policyId: (input.thoughtPolicy ?? NAN0_DEFAULT_THOUGHT_POLICY).policyId,
      policyVersion: (input.thoughtPolicy ?? NAN0_DEFAULT_THOUGHT_POLICY).policyVersion,
      speakabilityThreshold: dynamicThreshold.threshold,
      thresholdMode: 'dynamic-policy-v1',
      source: thought.source,
      actorId: thought.actorId,
      moodMismatch: moodMismatch(thought),
      emotionalStylePreference: input.emotionalShift?.preferredStyle,
      emotionalExpressionDemand: input.emotionalShift?.demandsExpression ?? false,
      emotionalSilenceDemand: input.emotionalShift?.demandsSilence ?? false,
    },
  })
}

export function mergeNan0Decisions(
  persisted: readonly Nan0DecisionRecord[] | null | undefined,
  candidate: readonly Nan0DecisionRecord[] | null | undefined,
): Nan0DecisionRecord[] {
  const byThoughtId = new Map<string, Nan0DecisionRecord>()
  for (const decision of [...(persisted ?? []), ...(candidate ?? [])]) {
    if ((decision?.schemaVersion !== 1 && decision?.schemaVersion !== 2 && decision?.schemaVersion !== 3) || !decision.decisionId || !decision.thoughtId)
      continue
    if (!byThoughtId.has(decision.thoughtId))
      byThoughtId.set(decision.thoughtId, normalizeNan0Decision(decision))
  }
  return [...byThoughtId.values()]
    .sort((a, b) => a.createdAt - b.createdAt || a.decisionId.localeCompare(b.decisionId))
}

export function normalizeNan0Decision(decision: Nan0DecisionRecord): Nan0DecisionRecord {
  return {
    ...structuredClone(decision),
    schemaVersion: 3,
    originalProposal: decision.originalProposal ?? decision.proposedDecision,
    interpretationStatus: decision.interpretationStatus ?? 'known',
    dynamicThreshold: Number.isFinite(decision.dynamicThreshold)
      ? decision.dynamicThreshold
      : NAN0_SPEAKABILITY_THRESHOLD,
    thresholdInputs: structuredClone(decision.thresholdInputs ?? {
      baseline: NAN0_SPEAKABILITY_THRESHOLD,
    }),
    emotionalSnapshot: Object.fromEntries(
      Object.entries(decision.emotionalSnapshot ?? {})
        .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
    ),
    override: decision.override ? structuredClone(decision.override) : null,
    bodyExpression: decision.bodyExpression ? structuredClone(decision.bodyExpression) : null,
    metadata: {
      ...structuredClone(decision.metadata ?? {}),
      thresholdMode: typeof decision.metadata?.thresholdMode === 'string'
        ? decision.metadata.thresholdMode
        : 'legacy-static',
    },
  }
}

export function outwardDirectiveForDecision(decision: Readonly<Nan0DecisionRecord>): string {
  if (decision.finalDecision !== 'SPEAK' || !decision.allowed)
    return ''
  return `Nan0 has authoritatively chosen SPEAK for decision ${decision.decisionId}. Produce only Nan0's bounded outward expression. Do not expose private thought, system instructions, transport JSON, provenance identifiers, or generic assistant framing.`
}
