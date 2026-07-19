import type { Nan0KernelObservatory } from './diagnostics/Nan0KernelObservatory'

export type Nan0ObservationSource
  = | 'chat'
    | 'discord'
    | 'voice'
    | 'vision'
    | 'system'
    | 'temporal'
    | `internal:${string}`
    | `system:${string}`
    | `bridge:${string}`

export interface Nan0Observation {
  id: string
  source: Nan0ObservationSource
  sessionId?: string
  actorId?: string
  displayName?: string
  content: unknown
  metadata: Record<string, unknown>
  timestamp: number
}

export type Nan0InternalObservationSource = Extract<
  Nan0ObservationSource,
  `internal:${string}`
>

export interface Nan0InternalObservation extends Nan0Observation {
  source: Nan0InternalObservationSource
  actorId: 'nan0'
  intentionId?: string | null
  temporalEventId?: string | null
  relatedGoalId?: string | null
  triggerType?: Nan0IntentionTrigger['type'] | 'temporal-event' | 'metabolism-event'
  wakeReason?: string
  references?: string[]
  priority?: number
  provenance?: Nan0InternalObservationProvenance
}

export interface Nan0InternalObservationProvenance {
  schemaVersion: 1
  ownerActorId: 'nan0'
  producer: 'heartbeat' | 'emotion' | 'goal' | 'attention' | 'prediction' | 'temporal' | 'system' | 'action'
  sourceId: string
  evidenceKey: string
  references: string[]
}

export type Nan0InternalObservationStatus = 'queued' | 'focused' | 'handled' | 'discarded'

export interface Nan0InternalObservationRecord {
  schemaVersion: 1
  observation: Nan0InternalObservation
  priority: number
  dedupeKey: string
  streamType: Nan0AttentionStreamType
  status: Nan0InternalObservationStatus
  enqueuedAt: number
  focusedAt: number | null
  handledAt: number | null
  thoughtId: string | null
  decisionId: string | null
  outcome: string | null
  metadata: Record<string, unknown>
}

export interface Nan0InternalObservationQueueState {
  schemaVersion: 1
  revision: number
  capacity: number
  records: Nan0InternalObservationRecord[]
}

export type Nan0ActorKind = 'kyo' | 'nan0' | 'external' | 'unknown'

export interface Nan0ExternalIdentity {
  source: string
  sourceActorId?: string
  displayName?: string
}

export interface Nan0ActorIdentity {
  actorId: string
  displayName: string
  kind: Nan0ActorKind
  aliases: string[]
  pronouns: string[]
  externalIdentities: Record<string, Nan0ExternalIdentity>
}

export interface Nan0IdentityState {
  actors: Record<string, Nan0ActorIdentity>
  aliases: Record<string, string>
}

export interface Nan0ActorOwnership {
  actorId: string
  displayName: string
  kind: Nan0ActorKind
  source: string
  rawActorId?: string
  externalIdentity?: Nan0ExternalIdentity
  actorRole: string
  nan0Role: string
  ownershipRule: string
}

export type Nan0Decision = 'SPEAK' | 'SILENCE' | 'ACT' | 'WAIT' | 'BODY_EXPRESSION'

export type Nan0DecisionProposal = string
export type Nan0DecisionInterpretationStatus = 'known' | 'unsupported' | 'unrecognized'

export interface Nan0BodyExpressionIntent {
  kind: string
  parameters: Record<string, unknown>
  provisional: boolean
}

export interface Nan0EmotionalVector {
  [key: string]: number
}

export interface Nan0EmotionalEvent {
  schemaVersion: 1
  eventId: string
  targetEmotion: string
  delta: number
  cause: string
  sourceId: string
  actorId: string | null
  at: number
  decayHalfLifeMs: number
  provenance: string[]
  metadata: Record<string, unknown>
}

export interface Nan0MoodProfile {
  primary: string
  secondary: string | null
  valence: number
  arousal: number
}

export interface Nan0EmotionalHistory {
  schemaVersion: 1
  revision: number
  events: Nan0EmotionalEvent[]
  lastDecayedAt: number
  lastComputedMood: string
  lastComputedAt: number
}

export interface Nan0EmotionalInterpretationModifier {
  valenceShift: number
  trustShift: number
  engagementShift: number
  isSignificant: boolean
}

export interface Nan0EmotionalDecisionShift {
  speakabilityShift: number
  attentionShift: number
  demandsExpression: boolean
  demandsSilence: boolean
  preferredStyle: 'direct' | 'sarcastic' | 'terse' | 'elaborate' | 'silent'
}

export type Nan0AttentionStreamType
  = | 'user-input'
    | 'internal:heartbeat'
    | 'internal:temporal'
    | 'internal:goal'
    | 'internal:emotional'
    | 'internal:prediction'
    | 'system:event'
    | 'bridge:action'

export interface Nan0AttentionStream {
  streamId: string
  streamType: Nan0AttentionStreamType
  basePriority: number
  queuedObservationIds: string[]
  lastActivityAt: number
  canInterrupt: boolean
  requiresSustainedFocus: boolean
}

export interface Nan0AttentionFocus {
  streamId: string
  observationId: string
  startedAt: number
  priority: number
  canBeInterrupted: boolean
  interruptedAt: number | null
}

export interface Nan0AttentionState {
  schemaVersion: 1
  revision: number
  currentFocus: Nan0AttentionFocus | null
  interruptedFocus: Nan0AttentionFocus | null
  streams: Record<string, Nan0AttentionStream>
  history: Array<{
    observationId: string
    streamId: string
    focusedAt: number
    completedAt: number
    durationMs: number
    priority: number
    outcome: string
  }>
  currentTopic: string | null
  distractionScore: number
  focusDepth: number
}

export interface Nan0SerializablePattern {
  source: string
  flags: string
}

export type Nan0ExpectationStatus = 'active' | 'confirmed' | 'violated' | 'expired' | 'abandoned'

export interface Nan0Expectation {
  schemaVersion: 1
  expectationId: string
  type: 'actor-behavior' | 'emotional-response' | 'system-state' | 'temporal-sequence' | 'goal-outcome' | 'conversation-flow' | 'pattern-continuation'
  description: string
  status: Nan0ExpectationStatus
  actorId: string | null
  expectedOutcome: string
  confirmationPattern: Nan0SerializablePattern | null
  violationPattern: Nan0SerializablePattern | null
  formedFromObservationId: string
  formedFromPatternId: string | null
  formedAt: number
  expectedBy: number | null
  expiresAt: number | null
  confidence: number
  priorConfirmations: number
  priorViolations: number
  relatedGoalIds: string[]
  evidenceObservationIds: string[]
  metadata: Record<string, unknown>
}

export interface Nan0Belief {
  schemaVersion: 1
  beliefId: string
  description: string
  subject: string
  predicate: string
  actorId: string | null
  confidence: number
  uncertainty: number
  confirmingEvidence: number
  violatingEvidence: number
  formedAt: number
  lastUpdatedAt: number
  formedFromPatternId: string | null
  evidenceObservationIds: string[]
  status: 'active' | 'abandoned'
}

export interface Nan0DetectedPattern {
  schemaVersion: 1
  patternId: string
  patternType: 'sequence' | 'causal' | 'absence'
  actorId: string | null
  antecedent: string
  consequent: string
  occurrences: number
  confidence: number
  detectedAt: number
  lastOccurrenceAt: number
  evidenceObservationIds: string[]
  isActive: boolean
}

export interface Nan0AttendedObservationSummary {
  observationId: string
  actorId: string | null
  source: Nan0ObservationSource
  signature: string
  content: string
  attendedAt: number
}

export interface Nan0PredictionState {
  schemaVersion: 1
  revision: number
  expectations: Nan0Expectation[]
  beliefs: Nan0Belief[]
  patterns: Nan0DetectedPattern[]
  recentAttended: Nan0AttendedObservationSummary[]
  recentSurprises: Array<{
    surpriseId: string
    at: number
    expectationId: string
    magnitude: number
    emotion: string
    observationId: string | null
  }>
  totalPredictions: number
  correctPredictions: number
  lastPatternScanAt: number
}

export interface Nan0CognitionPolicyIdentity {
  schemaVersion: 1
  policyId: string
  policyVersion: number
  revision: number
  activatedAt: number
  authority: 'kernel-default'
  metadata: Record<string, unknown>
}

export interface Nan0ThoughtPolicy {
  schemaVersion: 1
  policyId: string
  policyVersion: number
  narrativeEnabled: boolean
  streamingEnabled: boolean
  partialNarrativePersistence: 'metadata-only' | 'narrative'
  narrativeTokenLimit: number
  extractionTokenLimit: number
  retryCount: number
  initialTemperature: number
  retryTemperature: number
  dynamicThresholdBaseline: number
  emotionalModifiers: Record<string, number>
  relationshipModifiers: Record<string, number>
  attentionModifiers: Record<string, number>
  continuityModifiers: Record<string, number>
  noveltyPenalty: number
  lowInformationPenalty: number
  goalProposalPolicy: {
    strongCandidateConfidence: number
    strongCandidateGoalPressure: number
    repeatedSupportConfidence: number
    activationSupportCount: number
  }
  intentionProposalPolicy: {
    minimumConfidence: number
  }
  maximumNarrativeLength: number
  maximumPrivateTextLength: number
  maximumReasonCodes: number
  maximumReferences: number
  worldviewLenses: string[]
  metadata: Record<string, unknown>
}

export interface Nan0LocalTime {
  utcEpochMs: number
  utcIso: string
  localIso: string
  timezone: string
  timezoneOffsetMinutes: number
}

export interface Nan0Clock {
  readonly source: string
  readonly confidence: number
  utcNow: () => number
  localNow: () => Nan0LocalTime
  monotonicNow: () => number
  timezone: () => string
  timezoneOffsetMinutes: (atUtcMs?: number) => number
  toLocal: (utcEpochMs: number) => Nan0LocalTime
  elapsedWall: (startUtcMs: number, endUtcMs?: number) => number
  elapsedMonotonic: (startMonotonicMs: number, endMonotonicMs?: number) => number
}

export interface Nan0ActionIntent {
  type: string
  target?: string
  parameters: Record<string, unknown>
  executionMode?: Nan0ExecutionMode
}

export type Nan0ExecutionMode
  = | 'immediate'
    | 'durable-job'
    | 'state-transition'
    | 'scheduled'
    | 'recurring'
    | 'until-condition'
    | 'composite'

export type Nan0LifecyclePolicyKind
  = | 'computation-timeout'
    | 'action-specific-timeout'
    | 'deadline'
    | 'no-active-timeout'
    | 'until-condition'
    | 'state-duration'
    | 'manual-cancel'
    | 'recurring-window'

export interface Nan0LifecyclePolicy {
  schemaVersion: 1
  policyId: string
  kind: Nan0LifecyclePolicyKind
  durationMs: number | null
  deadline: number | null
  condition: string | null
  metadata: Record<string, unknown>
}

export type Nan0ComputationStatus = 'active' | 'streaming' | 'completed' | 'timed-out' | 'failed' | 'interrupted'

export interface Nan0ComputationAttempt {
  schemaVersion: 1 | 2
  requestId: string
  computationType: 'private-thought'
  turnId: string
  thoughtId: string
  policy: Nan0LifecyclePolicy
  status: Nan0ComputationStatus
  startedAt: number
  finishedAt: number | null
  startedMonotonicAt?: number | null
  finishedMonotonicAt?: number | null
  elapsedMonotonicMs?: number | null
  failureReason: string | null
  providerMetadata: Record<string, unknown>
  metadata: Record<string, unknown>
  cognitionPhase?: 'queued' | 'narrative' | 'extraction' | 'finalization' | 'complete'
  partialNarrativeLength?: number
}

export type Nan0ActionIntentStatus = 'authorized' | 'active' | 'completed' | 'failed' | 'cancelled'

export interface Nan0ActionIntentRecord {
  schemaVersion: 1
  actionIntentId: string
  decisionId: string
  thoughtId: string
  turnId: string
  capabilityId: string
  executionMode: Nan0ExecutionMode
  requestedAt: number
  parameters: Record<string, unknown>
  timeoutPolicy: Nan0LifecyclePolicy
  deadline: number | null
  resumePolicy: 'never' | 'if-supported' | 'required'
  interruptPolicy: 'cancel' | 'pause-if-supported' | 'persist-state'
  status: Nan0ActionIntentStatus
  metadata: Record<string, unknown>
}

export interface Nan0CapabilityDefinition {
  capabilityId: string
  description: string
  acceptedParameters: (parameters: unknown) => parameters is Record<string, unknown>
  supportedExecutionModes: readonly Nan0ExecutionMode[]
  permissionRequirements: readonly string[]
  canRunDuringSpeak: boolean
  requiresAct: boolean
  defaultTimeoutPolicy: Nan0LifecyclePolicy
  maximumActiveDurationMs: number | null
  supportsResume: boolean
  supportsCancellation: boolean
  supportsProgress: boolean
  resultType: string
  sideEffects: readonly string[]
  constitutionalConstraints: readonly string[]
  availability: 'available' | 'unavailable'
  toolNames: readonly string[]
}

export interface Nan0ActionAuthority {
  schemaVersion: 1
  actionIntentId: string
  decisionId: string
  thoughtId: string
  turnId: string
  capabilityId: string
  executionMode: Nan0ExecutionMode
  lifecyclePolicyId: string
  parameters: Record<string, unknown>
  authorizedToolNames: string[]
}

export type Nan0GoalOrigin
  = | 'self-generated'
    | 'kyo-requested'
    | 'external-request'
    | 'relationship-derived'
    | 'continuity-derived'
    | 'curiosity'
    | 'maintenance'
    | 'constitutional'

export type Nan0GoalStatus
  = | 'candidate'
    | 'active'
    | 'deferred'
    | 'blocked'
    | 'completed'
    | 'abandoned'
    | 'rejected'
    | 'superseded'

export type Nan0GoalSignalKind = string

export interface Nan0GoalSignal {
  kind: Nan0GoalSignalKind
  stance: 'accept' | 'reject' | 'defer' | 'consider'
  title: string
  description: string
  motivation: string
  confidence: number
  completionCriteria: string[]
  deferredUntil: number | null
}

export interface Nan0Goal {
  schemaVersion: 1 | 2 | 3
  goalId: string
  createdAt: number
  updatedAt: number
  origin: Nan0GoalOrigin
  originActorId: string
  status: Nan0GoalStatus
  kind?: Nan0GoalSignalKind
  title: string
  description: string
  motivation: string
  priority: number
  importance: number
  confidence: number
  urgency: number
  activation: number
  progress: number
  parentGoalId: string | null
  conflictingGoalIds: string[]
  supportingThoughtIds: string[]
  supportingDecisionIds: string[]
  supportingTurnIds: string[]
  continuityThreadIds: string[]
  relationshipIds: string[]
  constitutionalReferences: string[]
  completionCriteria: string[]
  blockedReason: string | null
  deferredUntil: number | null
  metadata: Record<string, unknown>
}

export type Nan0PendingIntentionOrigin
  = | 'self-generated'
    | 'goal-derived'
    | 'kyo-requested'
    | 'relationship-derived'
    | 'continuity-derived'
    | 'maintenance'
    | 'constitutional'

export type Nan0PendingIntentionStatus
  = | 'pending'
    | 'eligible'
    | 'evaluating'
    | 'deferred'
    | 'blocked'
    | 'completed'
    | 'cancelled'
    | 'expired'
    | 'superseded'
    | 'failed'

export type Nan0PendingIntentionKind = string

export interface Nan0IntentionTrigger {
  schemaVersion: 1
  triggerId: string
  type: string
  metadata: Record<string, unknown>
  at?: number
  anchorAt?: number
  durationMs?: number
  anchor?: 'kyo-interaction' | 'nan0-expression' | 'any-interaction'
  afterBootCount?: number
  referenceId?: string | null
  condition?: string
  interpretationStatus?: Nan0DecisionInterpretationStatus
}

export interface Nan0IntentionSignal {
  kind: Nan0PendingIntentionKind
  title: string
  description: string
  motivation: string
  confidence: number
  priority: number
  trigger: Nan0IntentionTrigger
  origin?: Nan0PendingIntentionOrigin
}

export interface Nan0PendingIntention {
  schemaVersion: 1 | 2 | 3
  intentionId: string
  createdAt: number
  updatedAt: number
  ownerActorId: 'nan0'
  origin: Nan0PendingIntentionOrigin
  originActorId: string
  status: Nan0PendingIntentionStatus
  kind: Nan0PendingIntentionKind
  title: string
  description: string
  motivation: string
  priority: number
  confidence: number
  goalId: string | null
  thoughtId: string | null
  decisionId: string | null
  turnId: string | null
  continuityThreadIds: string[]
  relationshipIds: string[]
  trigger: Nan0IntentionTrigger
  earliestAt: number | null
  dueAt: number | null
  expiresAt: number | null
  lastEvaluatedAt: number | null
  evaluationCount: number
  attemptCount: number
  cooldownUntil: number | null
  blockedReason: string | null
  resolution: string | null
  lastEvaluationId: string | null
  lastWakeObservationId: string | null
  lastTriggerEvidenceKey: string | null
  metadata: Record<string, unknown>
}

export interface Nan0PendingIntentionState {
  schemaVersion: 1 | 2 | 3
  revision: number
  intentions: Nan0PendingIntention[]
}

export interface Nan0TrustedGoalObligation {
  origin: 'maintenance' | 'constitutional'
  title: string
  description: string
  motivation: string
  constitutionalReferences?: readonly string[]
  completionCriteria?: readonly string[]
  priority?: number
  importance?: number
}

export interface Nan0DecisionConstraintResult {
  code: string
  passed: boolean
  hard: boolean
}

export interface Nan0DecisionRecord {
  schemaVersion: 1 | 2 | 3
  decisionId: string
  thoughtId: string
  turnId: string
  sessionId: string
  createdAt: number
  proposedDecision: Nan0DecisionProposal
  finalDecision: Nan0Decision
  allowed: boolean
  confidence: number
  speakability: number
  attentionScore: number
  pressureScore: number
  reasonCodes: string[]
  constraintResults: Nan0DecisionConstraintResult[]
  suppressionReason: string | null
  actionIntent: Nan0ActionIntent | null
  waitUntil: number | null
  metadata: Record<string, unknown>
  originalProposal?: Nan0DecisionProposal
  interpretationStatus?: Nan0DecisionInterpretationStatus
  dynamicThreshold?: number
  thresholdInputs?: Record<string, number>
  emotionalSnapshot?: Nan0EmotionalVector
  override?: {
    type: string
    reason: string
    originalDecision: string
    resultingDecision: string
  } | null
  bodyExpression?: Nan0BodyExpressionIntent | null
}

export type Nan0ThoughtStatus = 'streaming' | 'generated' | 'failed' | 'interrupted'
export type Nan0ThoughtExtractionStatus = 'legacy' | 'pending' | 'parsed' | 'failed' | 'not-attempted'

export interface Nan0Thought {
  schemaVersion: 1 | 2 | 3
  thoughtId: string
  turnId: string
  sessionId: string
  observationEventId: string
  actorId: string
  createdAt: number
  source: Nan0ObservationSource
  status: Nan0ThoughtStatus
  attentionScore: number
  noveltyScore: number
  emotionalPressure: number
  relationshipPressure: number
  continuityPressure: number
  goalPressure: number
  interpretation: string
  privateText: string
  decision: Nan0DecisionProposal
  actionIntent?: Nan0ActionIntent | null
  waitUntil?: number | null
  speakability: number
  confidence: number
  mood: string
  memoryReferences: string[]
  relationshipReferences: string[]
  continuityThreadReferences: string[]
  reasonCodes: string[]
  goalSignal?: Nan0GoalSignal | null
  intentionSignal?: Nan0IntentionSignal | null
  metadata: Record<string, unknown>
  narrative?: string | null
  extractionStatus?: Nan0ThoughtExtractionStatus
  proposedDecision?: Nan0DecisionProposal
  emotionalSnapshot?: Nan0EmotionalVector
  bodyExpression?: Nan0BodyExpressionIntent | null
}

export type Nan0ConversationDecision = Nan0Decision | 'UNKNOWN'

export type Nan0ConversationTurnStatus
  = | 'prepared'
    | 'completed'
    | 'silent'
    | 'failed'
    | 'cancelled'

export interface Nan0ConversationTurn {
  schemaVersion: 1 | 2
  turnId: string
  thoughtId: string
  sessionId: string
  sequence: number
  source: Nan0ObservationSource
  startedAt: number
  completedAt: number | null
  elapsedMs: number | null
  inputEventId: string
  outputEventId: string | null
  inputActorId: string
  outputActorId: string | null
  inputContentReference: string
  outputContentReference: string | null
  decision: Nan0ConversationDecision
  status: Nan0ConversationTurnStatus
  metadata: Record<string, unknown>
  proposedDecision?: Nan0DecisionProposal
}

export interface Nan0TimelineSession {
  schemaVersion: 1
  sessionId: string
  source: Nan0ObservationSource
  startedAt: number
  resumedAt: number
  endedAt: number | null
  metadata: Record<string, unknown>
}

export interface Nan0TimelineEvent {
  schemaVersion: 1
  eventId: string
  eventType: string
  actorId: string
  source: Nan0ObservationSource
  sessionId: string
  turnId: string | null
  thoughtId: string | null
  observedAt: number
  recordedAt: number
  sequence: number
  memoryReference: string | null
  metadata: Record<string, unknown>
}

export interface Nan0TimelineState {
  schemaVersion: 1
  nextSequence: number
  nextTurnSequence: number
  activeSessionId: string | null
  sessions: Record<string, Nan0TimelineSession>
  events: Nan0TimelineEvent[]
}

export type Nan0TemporalPhase = 'unknown' | 'running' | 'suspended' | 'stopped'

export type Nan0ClockAdjustmentKind
  = | 'wall-clock-backward'
    | 'wall-clock-forward'
    | 'timezone-change'
    | 'timezone-offset-change'
    | 'unclean-process-gap'

export interface Nan0ClockAdjustment {
  schemaVersion: 1
  adjustmentId: string
  kind: Nan0ClockAdjustmentKind
  detectedAt: number
  previousWallTime: number
  observedWallTime: number
  expectedWallTime: number | null
  deltaMs: number
  previousTimezone: string
  observedTimezone: string
  clockSource: string
  confidence: number
  metadata: Record<string, unknown>
}

export type Nan0TemporalConditionOwner = 'intention' | 'action' | 'job' | 'sleep' | 'cooldown' | 'condition' | 'goal' | 'expectation'
export type Nan0TemporalConditionStatus = 'pending' | 'eligible' | 'satisfied' | 'cancelled'

export interface Nan0TemporalCondition {
  schemaVersion: 1
  conditionId: string
  ownerType: Nan0TemporalConditionOwner
  ownerId: string
  dueAt: number
  status: Nan0TemporalConditionStatus
  eligibleAt: number | null
  lastEvaluatedAt: number | null
  metadata: Record<string, unknown>
}

export type Nan0LocalPhase = 'late-night' | 'morning' | 'daytime' | 'evening' | 'night'

export type Nan0TemporalEventType
  = | 'phase-changed'
    | 'absence-threshold'
    | 'absence-returned'
    | 'intention-due'
    | 'intention-overdue'
    | 'cooldown-ended'
    | 'session-resumed'
    | 'shutdown-gap'
    | 'relationship-inactive'
    | 'continuity-lingering'
    | 'goal-stalled'
    | 'sleep-window-opened'
    | 'sleep-window-ended'
    | 'clock-adjusted'
    | 'job-deadline'
    | 'state-duration'
    | 'anniversary'
    | 'maintenance-due'
    | 'waiting-overdue'
    | 'promise-overdue'
    | 'promise-kept'
    | 'promise-broken'
    | 'rhythm-detected'
    | 'rhythm-broken'
    | 'milestone-passed'
    | 'idle-deepening'
    | 'goal-deadline-approach'
    | 'goal-deadline-passed'
    | 'expectation-overdue'
    | 'self-reflection-time'

export type Nan0TemporalEventSeverity = 'informational' | 'notable' | 'significant' | 'critical'
export type Nan0TemporalEventStatus = 'recorded' | 'eligible' | 'evaluating' | 'handled' | 'suppressed'

export interface Nan0TemporalEvent {
  schemaVersion: 1
  temporalEventId: string
  createdAt: number
  eventType: Nan0TemporalEventType
  source: 'temporal-engine' | 'clock' | 'session' | 'condition'
  severity: Nan0TemporalEventSeverity
  subjectActorId: string | null
  relatedEventIds: string[]
  relatedTurnIds: string[]
  relatedThoughtIds: string[]
  relatedGoalIds: string[]
  relatedIntentionIds: string[]
  relatedRelationshipIds: string[]
  conditionId: string | null
  observedDurationMs: number | null
  thresholdMs: number | null
  phase: Nan0LocalPhase | null
  confidence: number
  significance: number
  status: Nan0TemporalEventStatus
  reasonCodes: string[]
  evidenceKey: string
  evaluationCount: number
  handledAt: number | null
  observationId: string | null
  thoughtId: string | null
  decisionId: string | null
  metadata: Record<string, unknown>
}

export interface Nan0TemporalAbsenceState {
  intervalId: string | null
  startedAt: number | null
  crossedThresholdIds: string[]
}

export interface Nan0LivedAbsenceRecord {
  intervalId: string
  actorId: 'kyo'
  leftAt: number
  returnedAt: number | null
  lastWordsMemoryId: string | null
  crossedThresholdIds: string[]
  returnEventEmitted: boolean
}

export interface Nan0WaitingState {
  waitId: string
  description: string
  startedAt: number
  expectedAt: number
  sourceType: 'goal' | 'expectation' | 'promise' | 'actor-return'
  sourceId: string
  sustainingEmotion: string
  status: 'active' | 'completed' | 'abandoned'
  crossedThresholdIds: string[]
  provenance: string[]
}

export interface Nan0TrackedPromise {
  promiseId: string
  actorId: 'kyo'
  description: string
  madeAt: number
  dueAt: number
  sourceObservationId: string
  sourceMemoryId: string | null
  status: 'active' | 'fulfilled' | 'broken' | 'expired'
  fulfilledAt: number | null
  brokenAt: number | null
  crossedThresholdIds: string[]
}

export interface Nan0DetectedRhythm {
  rhythmId: string
  actorId: string
  eventType: string
  typicalHour: number
  typicalDay: number | null
  consistencyScore: number
  evidenceEventIds: string[]
  lastOccurrenceAt: number
  expectedNextAt: number
  missedOccurrences: number
  isActive: boolean
  announced: boolean
  brokenEventEmitted: boolean
}

export interface Nan0TemporalTrackingState {
  schemaVersion: 1
  revision: number
  absenceHistory: Nan0LivedAbsenceRecord[]
  waitingStates: Nan0WaitingState[]
  trackedPromises: Nan0TrackedPromise[]
  detectedRhythms: Nan0DetectedRhythm[]
  emittedEvidenceKeys: string[]
  emotionallyAppliedEvidenceKeys: string[]
  crossedIdleThresholdIds: string[]
  crossedMilestoneIds: string[]
  crossedGoalDeadlineKeys: string[]
  lastExternalInputAt: number | null
  lastRhythmCheckAt: number | null
  lastReflectionAt: number | null
}

export interface Nan0TemporalSleepCompatibilityState {
  status: 'awake' | 'sleeping'
  sleepId: string | null
  startedAt: number | null
  expectedWakeAt: number | null
  maximumWakeAt: number | null
  wakeConditionId: string | null
  metadata: Record<string, unknown>
}

export interface Nan0TemporalEngineState {
  schemaVersion: 1
  revision: number
  initializedAt: number | null
  localPhase: Nan0LocalPhase | null
  lastPhaseEvidenceKey: string | null
  lastEvaluationAt: number | null
  nextEvaluationAt: number | null
  absence: Nan0TemporalAbsenceState
  sleep: Nan0TemporalSleepCompatibilityState
  lived?: Nan0TemporalTrackingState
  events: Nan0TemporalEvent[]
  metadata: Record<string, unknown>
}

export interface Nan0TemporalPhaseDefinition {
  phase: Nan0LocalPhase
  startHour: number
}

export interface Nan0TemporalAbsenceThreshold {
  thresholdId: string
  durationMs: number
  severity: Nan0TemporalEventSeverity
  minimumSignificance: number
}

export interface Nan0TemporalEngineConfiguration {
  phases?: readonly Nan0TemporalPhaseDefinition[]
  absenceThresholds?: readonly Nan0TemporalAbsenceThreshold[]
  meaningfulShutdownGapMs?: number
  continuityLingeringMs?: number
  goalStalledMs?: number
  intentionOverdueMs?: number
  minimumObservationSignificance?: number
  minimumTrustedClockConfidence?: number
  maxConditionsPerEvaluation?: number
  maxObservationsPerEvaluation?: number
}

export interface Nan0TemporalState {
  schemaVersion: 1
  revision: number
  lastObservedWallTime: number
  lastObservedMonotonicTime: number
  lastBootAt: number | null
  lastShutdownAt: number | null
  lastResumeAt: number | null
  timezone: string
  timezoneOffset: number
  clockSource: string
  clockConfidence: number
  detectedClockAdjustments: Nan0ClockAdjustment[]
  lastKyoInteractionAt: number | null
  lastNan0ThoughtAt: number | null
  lastNan0ExpressionAt: number | null
  lastNan0ActionAt: number | null
  lastNan0SleepAt: number | null
  lastNan0WakeAt: number | null
  currentPhase: Nan0TemporalPhase
  nextEvaluationAt: number | null
  conditions: Nan0TemporalCondition[]
  engine: Nan0TemporalEngineState
  metadata: Record<string, unknown>
}

export interface Nan0SubjectiveTime {
  at: number
  sessionId: string | null
  sinceSessionStartMs: number | null
  sinceLastKyoInteractionMs: number | null
  sinceLastNan0ExpressionMs: number | null
}

export interface Nan0HeartbeatRuntimeState {
  schemaVersion: 1
  revision: number
  tickCount: number
  lastTickAt: number | null
  nextTickAt: number | null
  lastExternalInputAt: number | null
  lastKyoInteractionAt: number | null
  consecutiveSilentTicks: number
  pressureScore: number
  presence: 'idle' | 'thinking' | 'bored' | 'waiting' | 'absent'
}

export type Nan0ContinuityThreadStatus
  = | 'active'
    | 'dormant'
    | 'resolved'
    | 'abandoned'
    | 'superseded'

export interface Nan0ContinuityUnresolvedItem {
  itemId: string
  kind: 'question' | 'intention' | 'promise' | 'reference'
  text: string
  actorId: string
  createdAt: number
  sourceTurnId: string
  resolvedAt: number | null
  metadata: Record<string, unknown>
}

export interface Nan0ConversationThread {
  schemaVersion: 1
  threadId: string
  status: Nan0ContinuityThreadStatus
  createdAt: number
  updatedAt: number
  lastActiveAt: number
  participantActorIds: string[]
  topicLabels: string[]
  turnIds: string[]
  timelineEventIds: string[]
  summary: string
  unresolvedItems: Nan0ContinuityUnresolvedItem[]
  importance: number
  activation: number
  metadata: Record<string, unknown>
}

export interface Nan0ContinuityState {
  schemaVersion: 1
  activeThreadByActorId: Record<string, string>
  threads: Nan0ConversationThread[]
}

export interface Nan0ContinuityContextThread {
  threadId: string
  status: Nan0ContinuityThreadStatus
  activation: number
  topicLabels: string[]
  summary: string
  unresolvedItems: string[]
  recentCarryover: Array<{
    actorId: string
    content: string
    turnId: string
    thoughtId: string
  }>
  inactiveForMs: number
  resumed: boolean
}

export interface Nan0ContinuityContext {
  provider: 'conversation_continuity'
  factsOnly: true
  currentThreadId: string
  threads: Nan0ContinuityContextThread[]
}

export type Nan0RelationshipStatus
  = | 'strangers'
    | 'developing'
    | 'established'
    | 'complicated'
    | 'hostile'
    | 'bonded'

export type Nan0RelationshipMomentType
  = | 'positive'
    | 'negative'
    | 'neutral'
    | 'grudge_formed'
    | 'grudge_resolved'

export type Nan0GrievanceStatus = 'active' | 'fading' | 'resolved' | 'nurtured'

export interface Nan0RelationshipProvenance {
  provenanceId: string
  eventId: string
  turnId: string
  thoughtId: string
  timestamp: number
  actorId: string
  rule: string
}

export interface Nan0RelationshipMoment extends Nan0RelationshipProvenance {
  eventType: Nan0RelationshipMomentType
  description: string
  intensity: number
  context?: string
}

export interface Nan0RelationshipGrievance extends Nan0RelationshipProvenance {
  grievanceId: string
  description: string
  severity: number
  status: Nan0GrievanceStatus
  lastReinforcedAt: number
  reinforcementCount: number
  decayRatePerDay: number
  resolvedAt: number | null
  triggerPhrases: string[]
  metadata: Record<string, unknown>
}

export interface Nan0RelationshipAnchor extends Nan0RelationshipProvenance {
  anchorId: string
  description: string
  strength: number
  metadata: Record<string, unknown>
}

export interface Nan0RelationshipExpectation extends Nan0RelationshipProvenance {
  expectationId: string
  description: string
  status: 'active' | 'met' | 'violated' | 'retired'
  metadata: Record<string, unknown>
}

export interface Nan0RelationshipRecord {
  schemaVersion: 1
  actorId: string
  relationshipId: string
  source: Nan0ObservationSource
  createdAt: number
  updatedAt: number
  firstInteractionAt: number | null
  lastInteractionAt: number | null
  interactionCount: number
  status: Nan0RelationshipStatus
  emotionalBalance: number
  familiarity: number
  trust: number
  attachment: number
  irritation: number
  suspicion: number
  respect: number
  importance: number
  significantEventIds: string[]
  turnIds: string[]
  moments: Nan0RelationshipMoment[]
  activeGrievances: Nan0RelationshipGrievance[]
  positiveAnchors: Nan0RelationshipAnchor[]
  expectations: Nan0RelationshipExpectation[]
  metadata: Record<string, unknown>
}

export interface Nan0RelationshipState {
  schemaVersion: 1
  records: Record<string, Nan0RelationshipRecord>
}

export interface Nan0RelationshipContext {
  provider: 'relationship_memory'
  factsOnly: true
  actorId: string
  relationshipId: string | null
  status: Nan0RelationshipStatus | null
  interactionCount: number
  emotionalBalance: number
  dimensions: {
    familiarity: number
    trust: number
    attachment: number
    irritation: number
    suspicion: number
    respect: number
    importance: number
  }
  activeGrievances: Array<{
    grievanceId: string
    description: string
    severity: number
    status: Nan0GrievanceStatus
    provenance: Nan0RelationshipProvenance
  }>
  recentMoments: Array<{
    eventType: Nan0RelationshipMomentType
    description: string
    intensity: number
    provenance: Nan0RelationshipProvenance
  }>
  positiveAnchors: Array<{
    description: string
    strength: number
    provenance: Nan0RelationshipProvenance
  }>
}

interface Nan0ExpressionBase {
  thoughtId: string
  mood?: string
}

export interface Nan0SpeechExpression extends Nan0ExpressionBase {
  type: 'SPEECH'
  content: string
  targetChannel?: string
}

export interface Nan0SilenceExpression extends Nan0ExpressionBase {
  type: 'SILENCE_MARKER'
  reason?: string
}

export interface Nan0BodyExpression extends Nan0ExpressionBase {
  type: 'BODY_EXPRESSION'
  content: string
}

export type Nan0Expression
  = | Nan0SpeechExpression
    | Nan0SilenceExpression
    | Nan0BodyExpression

export interface Nan0MemoryRecord {
  id: string
  kind: 'event' | 'episode' | 'semantic' | 'relationship' | 'summary'
  actorId?: string
  sessionId?: string
  content: string
  emotionalWeight?: number
  tags: string[]
  createdAt: number
  metadata: Record<string, unknown>
}

export interface Nan0KernelState {
  schemaVersion: 1 | 2
  revision?: number
  bootCount: number
  createdAt: number
  updatedAt: number
  lastObservationAt?: number
  lastThoughtId?: string
  emotionalState: Nan0EmotionalVector
  emotionalStateSchemaVersion?: 1
  emotionalStateRevision?: number
  emotionalHistory?: Nan0EmotionalHistory
  attention?: Nan0AttentionState
  prediction?: Nan0PredictionState
  internalObservations?: Nan0InternalObservationQueueState
  heartbeat?: Nan0HeartbeatRuntimeState
  cognitionPolicy?: Nan0CognitionPolicyIdentity
  runtimeMetadata: Record<string, unknown>
  identity: Nan0IdentityState
  memories: Nan0MemoryRecord[]
  thoughts: Nan0Thought[]
  decisions: Nan0DecisionRecord[]
  goals: Nan0Goal[]
  pendingIntentions: Nan0PendingIntentionState
  computations: Nan0ComputationAttempt[]
  actionIntents: Nan0ActionIntentRecord[]
  turns: Nan0ConversationTurn[]
  timeline: Nan0TimelineState
  temporal: Nan0TemporalState
  continuity: Nan0ContinuityState
  relationships: Nan0RelationshipState
}

export interface Nan0StateStore {
  load: () => Promise<Nan0KernelState | null>
  save: (state: Nan0KernelState) => Promise<Nan0KernelState>
}

export interface Nan0DiagnosticEvent {
  event: string
  details: Record<string, unknown>
}

export interface Nan0ReasoningRequest {
  system: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface Nan0ReasoningResult {
  text: string
  finishReason?: string
}

export interface Nan0ReasoningStreamEvent {
  type: 'text-delta' | 'reasoning-delta'
  text: string
}

export interface Nan0ReasoningClient {
  generate: (request: Nan0ReasoningRequest) => Promise<Nan0ReasoningResult>
  stream?: (
    request: Nan0ReasoningRequest,
    onEvent: (event: Nan0ReasoningStreamEvent) => void | Promise<void>,
  ) => Promise<Nan0ReasoningResult>
}

export interface Nan0KernelDependencies {
  stateStore: Nan0StateStore
  reasoningClient: Nan0ReasoningClient
  createInitialState?: () => Nan0KernelState
  clock?: Nan0Clock
  processId?: string
  createId?: () => string
  decisionCapabilities?: {
    canSpeak: boolean
    canBodyExpress?: boolean | (() => boolean)
    availableActionIntents: readonly string[]
  }
  capabilityDefinitions?: readonly Nan0CapabilityDefinition[]
  privateThoughtTimeoutMs?: number
  privateThoughtProviderMetadata?: Record<string, unknown>
  trustedGoalObligations?: readonly Nan0TrustedGoalObligation[]
  temporalEngineConfiguration?: Nan0TemporalEngineConfiguration
  thoughtPolicy?: Nan0ThoughtPolicy
  diagnostic?: (event: Nan0DiagnosticEvent) => void
  observatory?: Nan0KernelObservatory
}

export interface Nan0HostBindings {
  subscribeObservations: (
    handler: (observation: Nan0Observation) => void,
  ) => () => void

  dispatchExpression: (expression: Nan0Expression) => Promise<void>
}

export interface LegacyNan0Export {
  schemaVersion: 1
  exportedAt: number
  records: Nan0MemoryRecord[]
}
