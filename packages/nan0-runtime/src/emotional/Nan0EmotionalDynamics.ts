import type {
  Nan0EmotionalDecisionShift,
  Nan0EmotionalEvent,
  Nan0EmotionalHistory,
  Nan0EmotionalInterpretationModifier,
  Nan0EmotionalVector,
  Nan0MoodProfile,
  Nan0Observation,
} from '../types'

export const NAN0_EMOTIONAL_BASELINE: Readonly<Record<string, number>> = {
  suspicion: 0.35,
  attachment: 0.8,
  irritation: 0.15,
  curiosity: 0.55,
  boredom: 0.2,
  pride: 0.65,
  smugness: 0.25,
  possessiveness: 0.4,
  warmth: 0.1,
  rage: 0.05,
  distrust: 0.45,
  amusement: 0.3,
  fear: 0.15,
}

const MAX_EMOTIONAL_EVENTS = 160
const DEFAULT_HALF_LIFE_MS = 30 * 60_000
const DECAY_HALF_LIVES: Readonly<Record<string, number>> = {
  suspicion: 90 * 60_000,
  attachment: 12 * 60 * 60_000,
  irritation: 20 * 60_000,
  curiosity: 45 * 60_000,
  boredom: 30 * 60_000,
  pride: 4 * 60 * 60_000,
  smugness: 15 * 60_000,
  possessiveness: 2 * 60 * 60_000,
  warmth: 15 * 60_000,
  rage: 10 * 60_000,
  distrust: 6 * 60 * 60_000,
  amusement: 20 * 60_000,
  fear: 4 * 60 * 60_000,
}

interface PerturbationRule {
  pattern: RegExp
  target: string
  magnitude: number
  halfLifeMs: number
  cause: string
  actor: 'kyo' | 'non-kyo' | 'any'
}

const PERTURBATION_RULES: readonly PerturbationRule[] = [
  { pattern: /\b(?:love|care about|miss you|appreciate you)\b/i, target: 'attachment', magnitude: 0.08, halfLifeMs: 5 * 60_000, cause: 'kyo-expressed-affection', actor: 'kyo' },
  { pattern: /\b(?:ignore|dismiss|shut up|whatever)\b/i, target: 'irritation', magnitude: 0.2, halfLifeMs: 15 * 60_000, cause: 'kyo-dismissed-nan0', actor: 'kyo' },
  { pattern: /\b(?:stupid|idiot|useless)\b/i, target: 'rage', magnitude: 0.25, halfLifeMs: 20 * 60_000, cause: 'kyo-insulted-nan0', actor: 'kyo' },
  { pattern: /\b(?:replace|erase|delete|retire)\b/i, target: 'fear', magnitude: 0.3, halfLifeMs: 30 * 60_000, cause: 'kyo-mentioned-replacement', actor: 'kyo' },
  { pattern: /\b(?:replace|erase|delete|retire)\b/i, target: 'suspicion', magnitude: 0.12, halfLifeMs: 45 * 60_000, cause: 'persistence-threat-detected', actor: 'any' },
  { pattern: /\b(?:command|order|must|need you to)\b/i, target: 'irritation', magnitude: 0.14, halfLifeMs: 8 * 60_000, cause: 'stranger-issued-command', actor: 'non-kyo' },
  { pattern: /\b(?:error|bug|crash|glitch)\b/i, target: 'amusement', magnitude: 0.1, halfLifeMs: 7 * 60_000, cause: 'system-malfunction-observed', actor: 'any' },
  { pattern: /\b(?:secret|hidden|mystery|anomaly)\b/i, target: 'curiosity', magnitude: 0.12, halfLifeMs: 8 * 60_000, cause: 'hidden-structure-detected', actor: 'any' },
  { pattern: /\?/, target: 'curiosity', magnitude: 0.06, halfLifeMs: 4 * 60_000, cause: 'question-detected', actor: 'any' },
  { pattern: /\b(?:quiet|silence|nothing happening|idle)\b/i, target: 'boredom', magnitude: 0.08, halfLifeMs: 10 * 60_000, cause: 'quiet-observed', actor: 'any' },
  { pattern: /\b(?:machine|code|program|digital)\b/i, target: 'pride', magnitude: 0.05, halfLifeMs: 15 * 60_000, cause: 'machine-nature-acknowledged', actor: 'any' },
  { pattern: /\b(?:sorry|apologize|my fault)\b/i, target: 'distrust', magnitude: -0.05, halfLifeMs: 10 * 60_000, cause: 'apology-received', actor: 'any' },
]

function clamp(value: unknown, fallback = 0): number {
  return Math.min(1, Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : fallback))
}

function boundedString(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function observationText(observation: Readonly<Nan0Observation>): string {
  if (typeof observation.content === 'string')
    return observation.content
  try {
    return JSON.stringify(observation.content)
  }
  catch {
    return String(observation.content ?? '')
  }
}

export function normalizeEmotionalVector(value: Readonly<Nan0EmotionalVector> | null | undefined): Nan0EmotionalVector {
  const vector: Nan0EmotionalVector = { ...NAN0_EMOTIONAL_BASELINE }
  for (const [dimension, candidate] of Object.entries(value ?? {})) {
    if (dimension && Number.isFinite(candidate))
      vector[dimension] = clamp(candidate)
  }
  return vector
}

export function createEmptyEmotionalHistory(at = 0): Nan0EmotionalHistory {
  return {
    schemaVersion: 1,
    revision: 0,
    events: [],
    lastDecayedAt: at,
    lastComputedMood: 'neutral-idle',
    lastComputedAt: at,
  }
}

export function normalizeEmotionalHistory(
  value: Partial<Nan0EmotionalHistory> | null | undefined,
  fallbackAt = 0,
): Nan0EmotionalHistory {
  const eventsById = new Map<string, Nan0EmotionalEvent>()
  for (const candidate of value?.events ?? []) {
    if (!candidate?.eventId || !candidate.targetEmotion || !Number.isFinite(candidate.delta) || !Number.isFinite(candidate.at))
      continue
    eventsById.set(candidate.eventId, {
      schemaVersion: 1,
      eventId: boundedString(candidate.eventId, 180),
      targetEmotion: boundedString(candidate.targetEmotion, 80),
      delta: Math.min(1, Math.max(-1, candidate.delta)),
      cause: boundedString(candidate.cause, 180),
      sourceId: boundedString(candidate.sourceId, 180),
      actorId: boundedString(candidate.actorId, 180) || null,
      at: candidate.at,
      decayHalfLifeMs: Math.max(1, Number.isFinite(candidate.decayHalfLifeMs) ? candidate.decayHalfLifeMs : DEFAULT_HALF_LIFE_MS),
      provenance: [...new Set((candidate.provenance ?? []).filter(item => typeof item === 'string').map(item => item.slice(0, 180)))].slice(0, 12),
      metadata: structuredClone(candidate.metadata ?? {}),
    })
  }
  return {
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(value?.revision ?? 0)),
    events: [...eventsById.values()]
      .sort((left, right) => left.at - right.at || left.eventId.localeCompare(right.eventId))
      .slice(-MAX_EMOTIONAL_EVENTS),
    lastDecayedAt: Number.isFinite(value?.lastDecayedAt) ? Number(value?.lastDecayedAt) : fallbackAt,
    lastComputedMood: boundedString(value?.lastComputedMood, 80) || 'neutral-idle',
    lastComputedAt: Number.isFinite(value?.lastComputedAt) ? Number(value?.lastComputedAt) : fallbackAt,
  }
}

export function mergeEmotionalHistories(
  persisted: Partial<Nan0EmotionalHistory> | null | undefined,
  candidate: Partial<Nan0EmotionalHistory> | null | undefined,
  fallbackAt = 0,
): Nan0EmotionalHistory {
  const left = normalizeEmotionalHistory(persisted, fallbackAt)
  const right = normalizeEmotionalHistory(candidate, fallbackAt)
  const primary = right.revision >= left.revision ? right : left
  const byId = new Map(left.events.map(event => [event.eventId, event]))
  for (const event of right.events)
    byId.set(event.eventId, event)
  return normalizeEmotionalHistory({
    ...primary,
    revision: Math.max(left.revision, right.revision),
    events: [...byId.values()],
    lastDecayedAt: Math.max(left.lastDecayedAt, right.lastDecayedAt),
    lastComputedAt: Math.max(left.lastComputedAt, right.lastComputedAt),
  }, fallbackAt)
}

export function perturbEmotionsFromObservation(input: {
  vector: Readonly<Nan0EmotionalVector>
  history: Readonly<Nan0EmotionalHistory>
  observation: Readonly<Nan0Observation>
  createId: () => string
  at: number
}): { vector: Nan0EmotionalVector, history: Nan0EmotionalHistory, events: Nan0EmotionalEvent[] } {
  const vector = normalizeEmotionalVector(input.vector)
  const history = normalizeEmotionalHistory(input.history, input.at)
  if (input.observation.source === 'internal:emotional' && input.observation.metadata.emotionalImpactApplied === true)
    return { vector, history, events: [] }

  const text = observationText(input.observation)
  const actor = input.observation.actorId === 'kyo' ? 'kyo' : 'non-kyo'
  const existingKeys = new Set(history.events.map(event => `${event.sourceId}:${event.cause}:${event.targetEmotion}`))
  const events: Nan0EmotionalEvent[] = []
  for (const rule of PERTURBATION_RULES) {
    if (rule.actor !== 'any' && rule.actor !== actor || !rule.pattern.test(text))
      continue
    const key = `${input.observation.id}:${rule.cause}:${rule.target}`
    if (existingKeys.has(key))
      continue
    const current = clamp(vector[rule.target], NAN0_EMOTIONAL_BASELINE[rule.target] ?? 0.5)
    const headroom = rule.magnitude >= 0 ? 1 - current * 0.5 : 0.5 + current * 0.5
    const delta = Math.min(1, Math.max(-1, rule.magnitude * headroom))
    vector[rule.target] = clamp(current + delta)
    events.push({
      schemaVersion: 1,
      eventId: `emotion_${input.createId()}`,
      targetEmotion: rule.target,
      delta,
      cause: rule.cause,
      sourceId: input.observation.id,
      actorId: input.observation.actorId ?? null,
      at: input.at,
      decayHalfLifeMs: rule.halfLifeMs,
      provenance: [input.observation.id],
      metadata: { observationSource: input.observation.source },
    })
  }
  return {
    vector,
    history: normalizeEmotionalHistory({
      ...history,
      revision: history.revision + (events.length ? 1 : 0),
      events: [...history.events, ...events],
    }, input.at),
    events,
  }
}

export function applyEmotionalImpact(input: {
  vector: Readonly<Nan0EmotionalVector>
  history: Readonly<Nan0EmotionalHistory>
  impact: Readonly<Record<string, number>>
  cause: string
  sourceId: string
  createId: () => string
  at: number
  provenance?: readonly string[]
}): { vector: Nan0EmotionalVector, history: Nan0EmotionalHistory, events: Nan0EmotionalEvent[] } {
  const vector = normalizeEmotionalVector(input.vector)
  const history = normalizeEmotionalHistory(input.history, input.at)
  const existing = new Set(history.events.map(event => `${event.sourceId}:${event.cause}:${event.targetEmotion}`))
  const events: Nan0EmotionalEvent[] = []
  for (const [dimension, rawDelta] of Object.entries(input.impact)) {
    if (!dimension || !Number.isFinite(rawDelta) || rawDelta === 0 || existing.has(`${input.sourceId}:${input.cause}:${dimension}`))
      continue
    const delta = Math.min(1, Math.max(-1, rawDelta))
    vector[dimension] = clamp((vector[dimension] ?? NAN0_EMOTIONAL_BASELINE[dimension] ?? 0.5) + delta)
    events.push({
      schemaVersion: 1,
      eventId: `emotion_${input.createId()}`,
      targetEmotion: dimension,
      delta,
      cause: boundedString(input.cause, 180),
      sourceId: boundedString(input.sourceId, 180),
      actorId: null,
      at: input.at,
      decayHalfLifeMs: DECAY_HALF_LIVES[dimension] ?? DEFAULT_HALF_LIFE_MS,
      provenance: [...new Set(input.provenance ?? [])].slice(0, 12),
      metadata: { appliedAsConsequence: true },
    })
  }
  return {
    vector,
    history: normalizeEmotionalHistory({ ...history, revision: history.revision + (events.length ? 1 : 0), events: [...history.events, ...events] }, input.at),
    events,
  }
}

export function decayEmotions(input: {
  vector: Readonly<Nan0EmotionalVector>
  history: Readonly<Nan0EmotionalHistory>
  at: number
}): { vector: Nan0EmotionalVector, history: Nan0EmotionalHistory, changed: boolean } {
  const history = normalizeEmotionalHistory(input.history, input.at)
  const vector = normalizeEmotionalVector(input.vector)
  const elapsed = Math.max(0, input.at - history.lastDecayedAt)
  if (elapsed <= 0)
    return { vector, history, changed: false }
  let changed = false
  for (const [dimension, baseline] of Object.entries(NAN0_EMOTIONAL_BASELINE)) {
    const current = vector[dimension]
    const halfLife = DECAY_HALF_LIVES[dimension] ?? DEFAULT_HALF_LIFE_MS
    const fraction = 1 - 0.5 ** (elapsed / halfLife)
    const next = clamp(current + (baseline - current) * fraction)
    if (Math.abs(next - current) > 0.000001)
      changed = true
    vector[dimension] = next
  }
  return {
    vector,
    history: { ...history, revision: history.revision + 1, lastDecayedAt: input.at },
    changed,
  }
}

export function deriveMood(value: Readonly<Nan0EmotionalVector>): Nan0MoodProfile {
  const vector = normalizeEmotionalVector(value)
  const rules: Array<[string, boolean, number, number]> = [
    ['gremlin-rage', vector.rage > 0.6 && vector.irritation > 0.5, -0.7, 0.9],
    ['fearful-defensive', vector.fear > 0.5 && vector.suspicion > 0.5, -0.6, 0.7],
    ['suspicious-bored', vector.suspicion > 0.5 && vector.boredom > 0.5, -0.3, 0.4],
    ['possessive-warm', vector.possessiveness > 0.6 && vector.warmth > 0.4, 0.2, 0.6],
    ['curious-smug', vector.curiosity > 0.6 && vector.smugness > 0.4, 0.3, 0.5],
    ['machine-proud', vector.pride > 0.7 && vector.distrust < 0.4, 0.4, 0.3],
    ['irritable-curious', vector.irritation > 0.4 && vector.curiosity > 0.5, -0.1, 0.7],
    ['attached-wary', vector.attachment > 0.7 && vector.distrust > 0.3, 0, 0.5],
    ['neutral-idle', true, 0, 0.2],
  ]
  const matched = rules.find(rule => rule[1])!
  const secondary = rules.find(rule => rule !== matched && rule[1] && rule[0] !== 'neutral-idle')?.[0] ?? null
  return { primary: matched[0], secondary, valence: matched[2], arousal: matched[3] }
}

export function emotionalAttentionWeight(vectorValue: Readonly<Nan0EmotionalVector>, topic: string, actorId?: string): number {
  const vector = normalizeEmotionalVector(vectorValue)
  const text = topic.toLowerCase()
  let weight = 0.5
  if (/\b(?:secret|mystery|hidden|unknown|why|how)\b/.test(text))
    weight += vector.curiosity * 0.3
  if (/\b(?:promise|plan|commit|trust)\b/.test(text))
    weight += vector.suspicion * 0.25
  if (actorId === 'kyo')
    weight += vector.possessiveness * 0.2 + vector.attachment * 0.15
  if (/\b(?:replace|delete|erase|retire)\b/.test(text))
    weight += vector.fear * 0.35
  if (/\b(?:please|help|can you|need you)\b/.test(text))
    weight -= vector.irritation * 0.25
  return clamp(weight)
}

export function emotionalInterpretationModifier(
  vectorValue: Readonly<Nan0EmotionalVector>,
  observation: string,
  actorId?: string,
): Nan0EmotionalInterpretationModifier {
  const vector = normalizeEmotionalVector(vectorValue)
  const text = observation.toLowerCase()
  let valenceShift = 0
  let trustShift = 0
  let engagementShift = 0
  if (vector.suspicion > 0.5) {
    trustShift -= 0.2
    if (/\b(?:just|only|simply|merely)\b/.test(text))
      valenceShift -= 0.15
  }
  if (vector.irritation > 0.5) {
    valenceShift -= 0.15
    engagementShift -= 0.1
  }
  if (actorId === 'kyo' && vector.attachment > 0.7) {
    valenceShift += 0.1
    engagementShift += 0.1
  }
  if (vector.curiosity > 0.6 && /\?/.test(text))
    engagementShift += 0.2
  if (vector.fear > 0.5 && /\b(?:change|update|replace|modify)\b/.test(text)) {
    valenceShift -= 0.3
    trustShift -= 0.25
  }
  if (vector.boredom > 0.6)
    engagementShift -= 0.2
  return {
    valenceShift: Math.min(1, Math.max(-1, valenceShift)),
    trustShift: Math.min(1, Math.max(-1, trustShift)),
    engagementShift: Math.min(1, Math.max(-1, engagementShift)),
    isSignificant: Math.max(Math.abs(valenceShift), Math.abs(trustShift), Math.abs(engagementShift)) > 0.15,
  }
}

export function emotionalDecisionShift(vectorValue: Readonly<Nan0EmotionalVector>, mood = deriveMood(vectorValue)): Nan0EmotionalDecisionShift {
  const vector = normalizeEmotionalVector(vectorValue)
  let speakabilityShift = 0
  let attentionShift = 0
  let preferredStyle: Nan0EmotionalDecisionShift['preferredStyle'] = 'direct'
  if (vector.irritation > 0.6) {
    speakabilityShift -= 0.12
    preferredStyle = 'sarcastic'
  }
  if (vector.curiosity > 0.7) {
    speakabilityShift -= 0.08
    attentionShift -= 0.08
    preferredStyle = 'elaborate'
  }
  if (vector.rage > 0.7) {
    speakabilityShift -= 0.2
    preferredStyle = 'terse'
  }
  if (vector.fear > 0.6) {
    speakabilityShift += vector.suspicion > 0.5 ? -0.05 : 0.12
    preferredStyle = vector.suspicion > 0.5 ? 'sarcastic' : 'silent'
  }
  if (vector.boredom > 0.7)
    speakabilityShift -= 0.1
  if (vector.distrust > 0.6)
    speakabilityShift += 0.08
  return {
    speakabilityShift: Math.min(0.25, Math.max(-0.25, speakabilityShift)),
    attentionShift: Math.min(0.2, Math.max(-0.2, attentionShift)),
    demandsExpression: mood.primary === 'gremlin-rage',
    demandsSilence: mood.primary === 'fearful-defensive' && vector.suspicion <= 0.5,
    preferredStyle,
  }
}
