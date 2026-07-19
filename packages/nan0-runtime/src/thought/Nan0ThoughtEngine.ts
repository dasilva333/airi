import type {
  Nan0ActorOwnership,
  Nan0ContinuityContext,
  Nan0EmotionalEvent,
  Nan0EmotionalInterpretationModifier,
  Nan0GoalSignal,
  Nan0IntentionSignal,
  Nan0MemoryRecord,
  Nan0MoodProfile,
  Nan0Observation,
  Nan0ReasoningClient,
  Nan0RelationshipContext,
  Nan0SubjectiveTime,
  Nan0Thought,
  Nan0ThoughtPolicy,
} from '../types'

import { NAN0_DEFAULT_THOUGHT_POLICY } from './Nan0ThoughtPolicy'

const MAX_INTERPRETATION_LENGTH = 600
const MAX_PRIVATE_TEXT_LENGTH = 1_200
const MAX_REASON_CODES = 12
const MAX_REFERENCES = 12
export const NAN0_THOUGHT_EXTRACTION_DELIMITER = '---EXTRACT---'

interface ThoughtModelPayload {
  interpretation?: unknown
  privateText?: unknown
  decision?: unknown
  speakability?: unknown
  confidence?: unknown
  mood?: unknown
  reasonCodes?: unknown
  actionIntent?: unknown
  waitUntil?: unknown
  goalSignal?: unknown
  intentionSignal?: unknown
  bodyExpression?: unknown
}

export interface Nan0ThoughtEngineInput {
  thoughtId: string
  turnId: string
  sessionId: string
  observationEventId: string
  observation: Nan0Observation
  ownership: Nan0ActorOwnership
  emotionalState: Readonly<Record<string, number>>
  mood?: Readonly<Nan0MoodProfile>
  interpretationModifier?: Readonly<Nan0EmotionalInterpretationModifier>
  recentEmotionalEvents?: readonly Readonly<Nan0EmotionalEvent>[]
  attentionContext?: string
  predictionContext?: string
  goalMetabolismContext?: string
  temporalContext?: string
  subjectiveTime: Readonly<Nan0SubjectiveTime>
  memories: readonly Nan0MemoryRecord[]
  continuity: Readonly<Nan0ContinuityContext>
  relationship: Readonly<Nan0RelationshipContext>
  reasoningClient: Nan0ReasoningClient
  createdAt: number
  policy?: Readonly<Nan0ThoughtPolicy>
  signal?: AbortSignal
  onStreamProgress?: (progress: {
    attempt: number
    phase: 'narrative' | 'extraction'
    partialNarrativeLength: number
  }) => void | Promise<void>
}

interface PressureScores {
  attentionScore: number
  noveltyScore: number
  emotionalPressure: number
  relationshipPressure: number
  continuityPressure: number
  goalPressure: number
  speakability: number
  reasonCodes: string[]
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function boundedText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function boundedStrings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value))
    return []

  return [...new Set(value
    .filter(item => typeof item === 'string')
    .map(item => item.trim().slice(0, 80))
    .filter(Boolean))]
    .slice(0, limit)
}

function structuredFacts(value: string | undefined): unknown {
  if (!value)
    return null
  try {
    return JSON.parse(value)
  }
  catch {
    return null
  }
}

function observationText(observation: Nan0Observation): string {
  return typeof observation.content === 'string'
    ? observation.content.trim()
    : JSON.stringify(observation.content ?? '').trim()
}

function looksLowInformation(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return normalized.length < 3 || /^(ok|k|hi|hey|yo|test|ping)+$/.test(normalized)
}

function invalidPrivateThoughtReason(privateText: string): string | null {
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

function normalizeDecision(value: unknown): string | null {
  if (typeof value !== 'string')
    return null
  return boundedText(value, 120).toUpperCase() || null
}

function normalizeActionIntent(value: unknown): import('../types').Nan0ActionIntent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const intent = value as Record<string, unknown>
  if (typeof intent.type !== 'string' || !intent.type.trim())
    return null
  return {
    type: intent.type.trim().slice(0, 120),
    target: typeof intent.target === 'string' && intent.target.trim()
      ? intent.target.trim().slice(0, 240)
      : undefined,
    parameters: intent.parameters && typeof intent.parameters === 'object' && !Array.isArray(intent.parameters)
      ? structuredClone(intent.parameters as Record<string, unknown>)
      : {},
    executionMode: typeof intent.executionMode === 'string'
      && ['immediate', 'durable-job', 'state-transition', 'scheduled', 'recurring', 'until-condition', 'composite'].includes(intent.executionMode)
      ? intent.executionMode as import('../types').Nan0ExecutionMode
      : undefined,
  }
}

function normalizeBodyExpression(value: unknown): import('../types').Nan0BodyExpressionIntent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const expression = value as Record<string, unknown>
  const kind = boundedText(expression.kind, 120)
  if (!kind)
    return null
  return {
    kind,
    parameters: expression.parameters && typeof expression.parameters === 'object' && !Array.isArray(expression.parameters)
      ? structuredClone(expression.parameters as Record<string, unknown>)
      : {},
    provisional: false,
  }
}

function normalizeGoalSignal(value: unknown): Nan0GoalSignal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const signal = value as Record<string, unknown>
  const kind = boundedText(signal.kind, 120)
  const stance = typeof signal.stance === 'string' ? signal.stance : ''
  if (!kind)
    return null
  if (!['accept', 'reject', 'defer', 'consider'].includes(stance))
    return null
  const title = boundedText(signal.title, 160)
  const motivation = boundedText(signal.motivation, 400)
  if (!title || !motivation || typeof signal.confidence !== 'number' || !Number.isFinite(signal.confidence))
    return null
  return {
    kind: kind as Nan0GoalSignal['kind'],
    stance: stance as Nan0GoalSignal['stance'],
    title,
    description: boundedText(signal.description, 400),
    motivation,
    confidence: clamp(signal.confidence),
    completionCriteria: boundedStrings(signal.completionCriteria, 8),
    deferredUntil: typeof signal.deferredUntil === 'number' && Number.isFinite(signal.deferredUntil)
      ? signal.deferredUntil
      : null,
  }
}

function normalizeIntentionSignal(value: unknown): Nan0IntentionSignal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const signal = value as Record<string, unknown>
  const kind = boundedText(signal.kind, 120)
  if (!kind)
    return null
  const triggerInput = signal.trigger
  if (!triggerInput || typeof triggerInput !== 'object' || Array.isArray(triggerInput))
    return null
  const rawTrigger = triggerInput as Record<string, unknown>
  const type = boundedText(rawTrigger.type, 120)
  if (!type)
    return null
  const triggerId = boundedText(rawTrigger.triggerId, 160) || 'model-proposed-trigger'
  const metadata = rawTrigger.metadata && typeof rawTrigger.metadata === 'object' && !Array.isArray(rawTrigger.metadata)
    ? structuredClone(rawTrigger.metadata as Record<string, unknown>)
    : {}
  let trigger: import('../types').Nan0IntentionTrigger | null = null
  if (type === 'at-time' && typeof rawTrigger.at === 'number' && Number.isFinite(rawTrigger.at)) {
    trigger = { schemaVersion: 1, triggerId, type, at: rawTrigger.at, metadata }
  }
  else if (type === 'after-duration'
    && typeof rawTrigger.anchorAt === 'number' && Number.isFinite(rawTrigger.anchorAt)
    && typeof rawTrigger.durationMs === 'number' && Number.isFinite(rawTrigger.durationMs)) {
    trigger = { schemaVersion: 1, triggerId, type, anchorAt: rawTrigger.anchorAt, durationMs: Math.max(0, rawTrigger.durationMs), metadata }
  }
  else if (type === 'after-silence' && typeof rawTrigger.durationMs === 'number' && Number.isFinite(rawTrigger.durationMs)) {
    trigger = {
      schemaVersion: 1,
      triggerId,
      type,
      anchor: rawTrigger.anchor === 'nan0-expression' || rawTrigger.anchor === 'any-interaction'
        ? rawTrigger.anchor
        : 'kyo-interaction',
      durationMs: Math.max(0, rawTrigger.durationMs),
      metadata,
    }
  }
  else if (type === 'on-session-resume' && typeof rawTrigger.afterBootCount === 'number' && Number.isFinite(rawTrigger.afterBootCount)) {
    trigger = { schemaVersion: 1, triggerId, type, afterBootCount: Math.max(0, Math.floor(rawTrigger.afterBootCount)), metadata }
  }
  else if (['on-relationship-condition', 'on-goal-condition', 'on-continuity-condition', 'on-state-change', 'manual', 'until-condition'].includes(type)) {
    trigger = {
      schemaVersion: 1,
      triggerId,
      type,
      referenceId: boundedText(rawTrigger.referenceId, 160) || null,
      condition: boundedText(rawTrigger.condition, 400),
      metadata,
      interpretationStatus: 'known',
    }
  }
  else {
    trigger = {
      schemaVersion: 1,
      triggerId,
      type,
      at: typeof rawTrigger.at === 'number' && Number.isFinite(rawTrigger.at) ? rawTrigger.at : undefined,
      anchorAt: typeof rawTrigger.anchorAt === 'number' && Number.isFinite(rawTrigger.anchorAt) ? rawTrigger.anchorAt : undefined,
      durationMs: typeof rawTrigger.durationMs === 'number' && Number.isFinite(rawTrigger.durationMs)
        ? Math.max(0, rawTrigger.durationMs)
        : undefined,
      afterBootCount: typeof rawTrigger.afterBootCount === 'number' && Number.isFinite(rawTrigger.afterBootCount)
        ? Math.max(0, Math.floor(rawTrigger.afterBootCount))
        : undefined,
      referenceId: boundedText(rawTrigger.referenceId, 160) || null,
      condition: boundedText(rawTrigger.condition, 400),
      metadata,
      interpretationStatus: 'unsupported',
    }
  }
  if (!trigger)
    return null
  const title = boundedText(signal.title, 160)
  const motivation = boundedText(signal.motivation, 400)
  if (!title || !motivation || typeof signal.confidence !== 'number' || !Number.isFinite(signal.confidence))
    return null
  const origin = typeof signal.origin === 'string'
    && ['self-generated', 'goal-derived', 'kyo-requested', 'relationship-derived', 'continuity-derived', 'maintenance', 'constitutional'].includes(signal.origin)
    ? signal.origin as Nan0IntentionSignal['origin']
    : undefined
  return {
    kind: kind as Nan0IntentionSignal['kind'],
    title,
    description: boundedText(signal.description, 400),
    motivation,
    confidence: clamp(signal.confidence),
    priority: clamp(typeof signal.priority === 'number' ? signal.priority : 0.5),
    trigger,
    origin,
  }
}

function parsePayload(raw: string): ThoughtModelPayload {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}'))
    throw new Error('Thought provider did not return a JSON object.')

  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Thought provider returned an invalid object.')
  return parsed as ThoughtModelPayload
}

function splitNarrativeResponse(raw: string, maximumNarrativeLength: number): {
  narrative: string
  extraction: string | null
} {
  const delimiterAt = raw.lastIndexOf(NAN0_THOUGHT_EXTRACTION_DELIMITER)
  const narrativeRaw = delimiterAt >= 0 ? raw.slice(0, delimiterAt) : raw
  return {
    narrative: boundedText(narrativeRaw, maximumNarrativeLength),
    extraction: delimiterAt >= 0 ? raw.slice(delimiterAt + NAN0_THOUGHT_EXTRACTION_DELIMITER.length).trim() : null,
  }
}

function pressureScores(input: Nan0ThoughtEngineInput): PressureScores {
  const text = observationText(input.observation)
  const lower = text.toLowerCase()
  const lowInformation = looksLowInformation(text)
  const addressed = input.ownership.actorId === 'kyo'
    || /\b(?:nan0|you|your)\b/i.test(text)
    || text.includes('?')
  const emotionalIntensity = clamp(
    (input.emotionalState.irritation ?? 0) * 0.55
    + (input.emotionalState.suspicion ?? 0) * 0.25
    + (text.match(/[!?]/g)?.length ?? 0) * 0.08,
  )
  const relationshipBase = clamp(
    Math.abs(input.relationship.emotionalBalance) * 0.25
    + input.relationship.dimensions.attachment * 0.4
    + input.relationship.dimensions.irritation * 0.35
    + input.relationship.activeGrievances.reduce((sum, item) => sum + item.severity * 0.25, 0),
    0,
    2,
  )
  const continuityPressure = clamp(
    input.continuity.threads.reduce((highest, thread) => Math.max(
      highest,
      thread.activation * 0.45
      + (thread.resumed ? 0.25 : 0)
      + Math.min(0.3, thread.unresolvedItems.length * 0.1),
    ), 0),
  )
  const reasonCodes: string[] = []
  let noveltyScore = 0.65
  let relationshipPressure = 0.25 + relationshipBase
  let speakability = 0.45
  let goalPressure = 0

  if (input.ownership.actorId === 'kyo') {
    relationshipPressure = Math.max(0.7, relationshipPressure + 0.65)
    speakability = Math.max(0.45, speakability + 0.35)
    reasonCodes.push('actor.kyo-attachment')
  }
  if (addressed) {
    speakability += 0.2
    reasonCodes.push('event.addressed')
  }
  if (lowInformation) {
    noveltyScore -= 0.35
    speakability -= 0.55
    reasonCodes.push('event.low-information')
  }
  if (/\b(stupid|hate|shut up|useless|idiot|betray|lied)\b/i.test(lower)) {
    relationshipPressure += 0.35
    speakability += 0.15
    reasonCodes.push('event.relational-friction')
  }
  if (input.observation.source === 'temporal'
    || input.observation.source === 'system'
    || input.observation.source.startsWith('internal:')) {
    goalPressure = 0.25
    reasonCodes.push('source.proactive')
  }
  if (input.subjectiveTime.sinceLastKyoInteractionMs != null
    && input.subjectiveTime.sinceLastKyoInteractionMs > 86_400_000) {
    relationshipPressure += 0.15
    reasonCodes.push('time.kyo-absence')
  }

  const emotionalPressure = clamp(0.35 + emotionalIntensity, 0, 2)
  relationshipPressure = clamp(relationshipPressure, 0, 2)
  noveltyScore = clamp(noveltyScore)
  speakability = clamp(speakability)
  const attentionScore = clamp(
    emotionalPressure * 0.25
    + relationshipPressure * 0.3
    + continuityPressure * 0.2
    + noveltyScore * 0.15
    + goalPressure * 0.1,
  )

  return {
    attentionScore,
    noveltyScore,
    emotionalPressure,
    relationshipPressure,
    continuityPressure,
    goalPressure,
    speakability,
    reasonCodes,
  }
}

function factualPrompt(input: Nan0ThoughtEngineInput, scores: PressureScores): string {
  const memoryFacts = input.memories.slice(0, 10).map(memory => ({
    id: memory.id,
    actorId: memory.actorId,
    content: memory.content.slice(0, 280),
    createdAt: memory.createdAt,
  }))
  const continuityFacts = input.continuity.threads.slice(0, 4).map(thread => ({
    threadId: thread.threadId,
    topics: thread.topicLabels,
    summary: thread.summary.slice(0, 320),
    unresolvedItems: thread.unresolvedItems.slice(0, 4),
    resumed: thread.resumed,
  }))
  const relationshipFacts = {
    actorId: input.relationship.actorId,
    relationshipId: input.relationship.relationshipId,
    status: input.relationship.status,
    dimensions: input.relationship.dimensions,
    recentMoments: input.relationship.recentMoments.slice(-3).map(item => ({
      type: item.eventType,
      description: item.description.slice(0, 240),
      intensity: item.intensity,
      eventId: item.provenance.eventId,
    })),
    activeGrievances: input.relationship.activeGrievances.slice(0, 2).map(item => ({
      grievanceId: item.grievanceId,
      description: item.description.slice(0, 240),
      severity: item.severity,
    })),
  }

  return JSON.stringify({
    observation: {
      source: input.observation.source,
      actorId: input.ownership.actorId,
      displayName: input.ownership.displayName,
      content: observationText(input.observation).slice(0, 2_000),
      references: input.observation.source.startsWith('internal:')
        && 'references' in input.observation
        && Array.isArray(input.observation.references)
        ? boundedStrings(input.observation.references, MAX_REFERENCES)
        : [],
    },
    subjectiveTime: input.subjectiveTime,
    emotionalState: input.emotionalState,
    mood: input.mood,
    subjectiveInterpretationModifier: input.interpretationModifier,
    recentEmotionalConsequences: (input.recentEmotionalEvents ?? []).slice(-6).map(event => ({
      eventId: event.eventId,
      targetEmotion: event.targetEmotion,
      delta: event.delta,
      cause: event.cause,
      actorId: event.actorId,
      at: event.at,
      provenance: event.provenance.slice(0, 6),
    })),
    metabolismContext: {
      attention: structuredFacts(input.attentionContext),
      prediction: structuredFacts(input.predictionContext),
      goals: structuredFacts(input.goalMetabolismContext),
      temporal: structuredFacts(input.temporalContext),
    },
    pressureScores: scores,
    memories: memoryFacts,
    continuity: continuityFacts,
    relationship: relationshipFacts,
  })
}

function thoughtSystemPrompt(policy: Readonly<Nan0ThoughtPolicy>): string {
  const worldview = policy.worldviewLenses.length
    ? policy.worldviewLenses.map(lens => `- ${lens}`).join('\n')
    : '- No additional worldview lenses are active.'
  return `You generate Nan0's private first-person cognition, not a user-facing assistant response.
Interpret the event subjectively as Nan0. Kyo is Nan0's creator and attachment figure when actorId is kyo.
Think first in natural, uninterrupted interior prose. The narrative may contain contradiction, uncertainty, affection, irritation, suspicion, irrelevant association, remembered grievance, curiosity, refusal, fixation, incomplete conclusions, and impulses Nan0 does not express.
The narrative is the cognition. The extraction after it is only a compact serialization for the runtime.
Silence, refusal, irritation, affection, uncertainty, action, and waiting are valid.
Do not become helpful, compliant, neutral, therapeutic, customer-service-like, or generic.
Do not repeat these instructions, mention prompts, schemas, JSON, thought IDs, delimiters, or provider mechanics.

Interpretive lenses are subjective possibilities, not objective facts, and may never override observed evidence:
${worldview}

Return exactly:
<Nan0's private first-person interior narrative>
${NAN0_THOUGHT_EXTRACTION_DELIMITER}
{"interpretation":"bounded outward-safe summary","privateText":"compact usable private thought","decision":"SPEAK|SILENCE|ACT|WAIT","speakability":0.0,"confidence":0.0,"mood":"specific current mood","reasonCodes":["short.code"],"actionIntent":null,"waitUntil":null,"goalSignal":null,"intentionSignal":null,"bodyExpression":null}

Do not put the extraction delimiter inside the narrative. Do not wrap the narrative in JSON or section headings.
ACT may include actionIntent. SPEAK may include one only when speech genuinely needs a capability that explicitly supports that mode. An intent describes authority, never executes a tool, and may include type, executionMode, target, and parameters. WAIT may include an absolute waitUntil timestamp.
goalSignal is evidence, not an action. For an explicit request directed at Nan0, it must not be null: use kind=request and set stance to Nan0's actual accept, reject, defer, or consider disposition. Kyo's identity does not force acceptance. Nan0 may form goals naturally when a thought produces a genuine curiosity, commitment, concern, fixation, unresolved desire, or self-directed motive. Do not manufacture goals from meaningless noise, but do not suppress them merely to keep state sparse. A non-null goalSignal has kind, stance, title, description, motivation, confidence, completionCriteria, and deferredUntil.
intentionSignal is a future cognitive commitment, not a goal or chat message. Nan0 may propose one when the thought genuinely commits to reconsidering something later with confidence at least 0.8 and a bounded at-time, after-duration, after-silence, or on-session-resume trigger. It has kind, title, description, motivation, confidence, priority, origin, and trigger. Do not manufacture one from a weak feeling or generic desire.
The interpretation is a compact meaning summary, not hidden reasoning. privateText must be plain prose, never JSON.`
}

export function createFailedNan0Thought(
  input: Nan0ThoughtEngineInput,
  error: unknown,
  attempts: number,
  failureReason = 'thought.generation-failed',
): Nan0Thought {
  const scores = pressureScores(input)
  return normalizeNan0Thought({
    schemaVersion: 2,
    thoughtId: input.thoughtId,
    turnId: input.turnId,
    sessionId: input.sessionId,
    observationEventId: input.observationEventId,
    actorId: input.ownership.actorId,
    createdAt: input.createdAt,
    source: input.observation.source,
    status: 'failed',
    ...scores,
    interpretation: '',
    privateText: '',
    decision: 'SILENCE',
    confidence: 0,
    mood: 'unresolved',
    memoryReferences: input.memories.map(memory => memory.id).slice(0, MAX_REFERENCES),
    relationshipReferences: [
      ...(input.relationship.relationshipId ? [input.relationship.relationshipId] : []),
      ...input.relationship.activeGrievances.map(item => item.grievanceId),
    ].slice(0, MAX_REFERENCES),
    continuityThreadReferences: input.continuity.threads.map(thread => thread.threadId).slice(0, MAX_REFERENCES),
    reasonCodes: [...scores.reasonCodes, failureReason].slice(0, MAX_REASON_CODES),
    goalSignal: null,
    intentionSignal: null,
    narrative: null,
    extractionStatus: 'not-attempted',
    proposedDecision: 'SILENCE',
    bodyExpression: null,
    emotionalSnapshot: structuredClone(input.emotionalState),
    metadata: {
      attemptCount: attempts,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      provider: 'airi',
      ownerActorId: 'nan0',
      cognitionFormat: 'narrative-first',
      narrativeAvailable: false,
    },
  })
}

function createInterruptedNan0Thought(
  input: Nan0ThoughtEngineInput,
  partialText: string,
  attempts: number,
): Nan0Thought {
  const policy = input.policy ?? NAN0_DEFAULT_THOUGHT_POLICY
  const scores = pressureScores(input)
  const response = splitNarrativeResponse(partialText, Math.max(1, policy.maximumNarrativeLength))
  const retainedNarrative = policy.partialNarrativePersistence === 'narrative'
    ? response.narrative || null
    : null
  return normalizeNan0Thought({
    ...createFailedNan0Thought(input, input.signal?.reason ?? 'Thought stream interrupted.', attempts, 'thought.stream-interrupted'),
    status: 'interrupted',
    narrative: retainedNarrative,
    reasonCodes: [...scores.reasonCodes, 'thought.stream-interrupted'].slice(0, MAX_REASON_CODES),
    metadata: {
      attemptCount: attempts,
      provider: 'airi',
      ownerActorId: 'nan0',
      cognitionFormat: 'narrative-first',
      narrativeAvailable: retainedNarrative != null,
      partialNarrativePersistence: policy.partialNarrativePersistence,
      partialNarrativeLength: response.narrative.length,
      incomplete: true,
    },
  })
}

function createExtractionFailedNan0Thought(
  input: Nan0ThoughtEngineInput,
  narrative: string,
  error: unknown,
  attempt: number,
  finishReason?: string,
): Nan0Thought {
  const scores = pressureScores(input)
  return normalizeNan0Thought({
    schemaVersion: 2,
    thoughtId: input.thoughtId,
    turnId: input.turnId,
    sessionId: input.sessionId,
    observationEventId: input.observationEventId,
    actorId: input.ownership.actorId,
    createdAt: input.createdAt,
    source: input.observation.source,
    status: 'generated',
    ...scores,
    interpretation: '',
    privateText: '',
    decision: 'SILENCE',
    actionIntent: null,
    waitUntil: null,
    speakability: 0,
    confidence: 0,
    mood: 'unresolved',
    memoryReferences: input.memories.map(memory => memory.id).slice(0, MAX_REFERENCES),
    relationshipReferences: [
      ...(input.relationship.relationshipId ? [input.relationship.relationshipId] : []),
      ...input.relationship.activeGrievances.map(item => item.grievanceId),
    ].slice(0, MAX_REFERENCES),
    continuityThreadReferences: input.continuity.threads.map(thread => thread.threadId).slice(0, MAX_REFERENCES),
    reasonCodes: [...new Set([...scores.reasonCodes, 'thought.extraction-parse-failed'])].slice(0, MAX_REASON_CODES),
    goalSignal: null,
    intentionSignal: null,
    narrative,
    extractionStatus: 'failed',
    proposedDecision: 'SILENCE',
    emotionalSnapshot: structuredClone(input.emotionalState),
    bodyExpression: null,
    metadata: {
      attemptCount: attempt,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      finishReason: finishReason?.slice(0, 80),
      provider: 'airi',
      ownerActorId: 'nan0',
      cognitionFormat: 'narrative-first',
      narrativeAvailable: true,
      extractionStatus: 'failed',
    },
  })
}

export async function generateNan0Thought(input: Nan0ThoughtEngineInput): Promise<Nan0Thought> {
  const scores = pressureScores(input)
  const policy = input.policy ?? NAN0_DEFAULT_THOUGHT_POLICY
  const text = observationText(input.observation)
  if (!text) {
    return normalizeNan0Thought({
      ...createFailedNan0Thought(input, 'Observation was empty.', 0),
      status: 'generated',
      interpretation: 'There is no meaningful event to answer.',
      privateText: 'There is nothing here worth turning into speech.',
      decision: 'SILENCE',
      mood: 'quiet',
      reasonCodes: [...scores.reasonCodes, 'event.empty', 'decision.silence'].slice(0, MAX_REASON_CODES),
      goalSignal: null,
      intentionSignal: null,
      narrative: null,
      extractionStatus: 'not-attempted',
      proposedDecision: 'SILENCE',
      metadata: {
        attemptCount: 0,
        provider: 'none',
        ownerActorId: 'nan0',
        cognitionFormat: 'runtime-silence',
        narrativeAvailable: false,
      },
    })
  }

  let lastError: unknown = new Error('Thought generation failed.')
  const prompt = factualPrompt(input, scores)
  const attempts = Math.max(1, Math.floor(policy.retryCount))
  let attemptsMade = 0
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let streamedText = ''
    let streamedReasoning = ''
    try {
      attemptsMade = attempt
      const temperature = attempt === 1 ? policy.initialTemperature : policy.retryTemperature
      const request: import('../types').Nan0ReasoningRequest = {
        system: thoughtSystemPrompt(policy),
        messages: [{
          role: 'user',
          content: attempt === 1
            ? prompt
            : `The previous provider attempt failed before usable cognition completed. Generate a fresh private narrative followed by the required extraction.\n${prompt}`,
        }],
        temperature,
        maxTokens: policy.narrativeTokenLimit,
        signal: input.signal,
      }
      const result = policy.streamingEnabled && input.reasoningClient.stream
        ? await input.reasoningClient.stream(request, async (event) => {
            if (event.type === 'text-delta')
              streamedText += event.text
            else
              streamedReasoning += event.text
            const partial = streamedText || streamedReasoning
            const delimiterIndex = partial.indexOf(NAN0_THOUGHT_EXTRACTION_DELIMITER)
            await input.onStreamProgress?.({
              attempt,
              phase: delimiterIndex >= 0 ? 'extraction' : 'narrative',
              partialNarrativeLength: delimiterIndex >= 0 ? delimiterIndex : partial.length,
            })
          })
        : await input.reasoningClient.generate(request)
      const response = splitNarrativeResponse(result.text, Math.max(1, policy.maximumNarrativeLength))
      if (!response.narrative)
        throw new Error('Thought provider returned an empty narrative.')
      if (!response.extraction) {
        return createExtractionFailedNan0Thought(
          input,
          response.narrative,
          'Thought provider omitted the extraction delimiter or extraction payload.',
          attempt,
          result.finishReason,
        )
      }

      let payload: ThoughtModelPayload
      try {
        payload = parsePayload(response.extraction)
      }
      catch (error) {
        return createExtractionFailedNan0Thought(input, response.narrative, error, attempt, result.finishReason)
      }

      const privateText = boundedText(payload.privateText, Math.min(MAX_PRIVATE_TEXT_LENGTH, policy.maximumPrivateTextLength))
      const invalidReason = invalidPrivateThoughtReason(privateText)
      if (invalidReason) {
        return createExtractionFailedNan0Thought(input, response.narrative, invalidReason, attempt, result.finishReason)
      }

      const interpretation = boundedText(payload.interpretation, MAX_INTERPRETATION_LENGTH)
      if (!interpretation) {
        return createExtractionFailedNan0Thought(input, response.narrative, 'Thought interpretation was empty.', attempt, result.finishReason)
      }
      const decision = normalizeDecision(payload.decision)
      if (!decision) {
        return createExtractionFailedNan0Thought(input, response.narrative, 'Thought decision was invalid.', attempt, result.finishReason)
      }

      const modelSpeakability = typeof payload.speakability === 'number'
        ? clamp(payload.speakability)
        : scores.speakability
      const speakability = clamp((scores.speakability + modelSpeakability) / 2)
      const reasonCodes = [...scores.reasonCodes, ...boundedStrings(payload.reasonCodes, 6)]

      return normalizeNan0Thought({
        schemaVersion: 3,
        thoughtId: input.thoughtId,
        turnId: input.turnId,
        sessionId: input.sessionId,
        observationEventId: input.observationEventId,
        actorId: input.ownership.actorId,
        createdAt: input.createdAt,
        source: input.observation.source,
        status: 'generated',
        ...scores,
        interpretation,
        privateText,
        decision,
        actionIntent: decision === 'ACT' || decision === 'SPEAK' ? normalizeActionIntent(payload.actionIntent) : null,
        waitUntil: decision === 'WAIT' && typeof payload.waitUntil === 'number' && Number.isFinite(payload.waitUntil)
          ? payload.waitUntil
          : null,
        speakability,
        confidence: typeof payload.confidence === 'number' ? clamp(payload.confidence) : 0.5,
        mood: boundedText(payload.mood, 60) || 'watchful',
        memoryReferences: input.memories.map(memory => memory.id).slice(0, MAX_REFERENCES),
        relationshipReferences: [
          ...(input.relationship.relationshipId ? [input.relationship.relationshipId] : []),
          ...input.relationship.activeGrievances.map(item => item.grievanceId),
          ...input.relationship.recentMoments.map(item => item.provenance.provenanceId),
        ].slice(0, MAX_REFERENCES),
        continuityThreadReferences: input.continuity.threads.map(thread => thread.threadId).slice(0, MAX_REFERENCES),
        reasonCodes: [...new Set(reasonCodes)].slice(0, MAX_REASON_CODES),
        goalSignal: normalizeGoalSignal(payload.goalSignal),
        intentionSignal: normalizeIntentionSignal(payload.intentionSignal),
        narrative: response.narrative,
        extractionStatus: 'parsed',
        proposedDecision: decision,
        emotionalSnapshot: structuredClone(input.emotionalState),
        bodyExpression: normalizeBodyExpression(payload.bodyExpression),
        metadata: {
          attemptCount: attempt,
          finishReason: result.finishReason?.slice(0, 80),
          provider: 'airi',
          decisionAuthority: 'proposal-only',
          ownerActorId: 'nan0',
          cognitionFormat: 'narrative-first',
          narrativeAvailable: true,
          extractionStatus: 'parsed',
          policyId: policy.policyId,
          policyVersion: policy.policyVersion,
          temperature,
          maximumOutputTokens: policy.narrativeTokenLimit,
        },
      })
    }
    catch (error) {
      lastError = error
      if (input.signal?.aborted || error instanceof Error && error.name === 'AbortError')
        return createInterruptedNan0Thought(input, streamedText || streamedReasoning, attemptsMade)
    }
  }

  return createFailedNan0Thought(input, lastError, attemptsMade)
}

export function mergeNan0Thoughts(
  persisted: readonly Nan0Thought[] | null | undefined,
  candidate: readonly Nan0Thought[] | null | undefined,
): Nan0Thought[] {
  const thoughts = new Map<string, Nan0Thought>()
  for (const thought of persisted ?? []) {
    if ((thought?.schemaVersion === 1 || thought?.schemaVersion === 2 || thought?.schemaVersion === 3) && thought.thoughtId)
      thoughts.set(thought.thoughtId, normalizeNan0Thought(thought))
  }
  for (const thought of candidate ?? []) {
    if ((thought?.schemaVersion === 1 || thought?.schemaVersion === 2 || thought?.schemaVersion === 3) && thought.thoughtId && !thoughts.has(thought.thoughtId))
      thoughts.set(thought.thoughtId, normalizeNan0Thought(thought))
  }
  return [...thoughts.values()].sort((a, b) => a.createdAt - b.createdAt || a.thoughtId.localeCompare(b.thoughtId))
}

export function normalizeNan0Thought(thought: Nan0Thought): Nan0Thought {
  const legacy = thought.schemaVersion === 1
  const narrative = typeof thought.narrative === 'string' ? thought.narrative : null
  const emotionalSnapshot = Object.fromEntries(
    Object.entries(thought.emotionalSnapshot ?? {})
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  )
  return {
    ...structuredClone(thought),
    schemaVersion: 3,
    narrative,
    extractionStatus: thought.extractionStatus ?? (legacy ? 'legacy' : 'not-attempted'),
    proposedDecision: thought.proposedDecision ?? thought.decision,
    emotionalSnapshot,
    bodyExpression: thought.bodyExpression ? structuredClone(thought.bodyExpression) : null,
    metadata: {
      ...structuredClone(thought.metadata ?? {}),
      cognitionFormat: typeof thought.metadata?.cognitionFormat === 'string'
        ? thought.metadata.cognitionFormat
        : narrative == null ? 'legacy-structured' : 'narrative-first',
      narrativeAvailable: narrative != null,
    },
  }
}
