export type InferenceEvent
  = | { type: 'connected', at: number }
    | { type: 'reasoning', text: string, visibility: 'hidden' | 'visible', at: number }
    | { type: 'answer', text: string, at: number }
    | { type: 'special', token: string, at: number }
    | { type: 'tool', phase: 'start' | 'end', at: number }
    | { type: 'finish', reason?: string, at: number }
    | { type: 'error', error: unknown, at: number }
    | { type: 'aside-cue', candidate: AsideCandidate, at: number }

export type ThinkingCategory = 'analytical' | 'memory' | 'emotional' | 'uncertain' | 'generic'

export type PacingState
  = | 'IDLE'
    | 'DISPATCHED'
    | 'STAGING'
    | 'ANSWER_READY'
    | 'FILLER_ARMED'
    | 'FILLER_ACTIVE'
    | 'HANDOFF'
    | 'SETTLED'

export type TurnPhase = 'waiting' | 'answering' | 'draining' | 'canceled' | 'settled'

export type AttemptPhase = 'preparing' | 'ready' | 'committed' | 'playing' | 'ended' | 'discarded'

export interface AsideCandidate {
  cueId: string
  turn: {
    turnId: string
    sessionId?: string
    generation: number
  }
  source: 'explicit' | 'organic'
  text: string
  phraseKey: string
  collectedAtMs: number
  expiresAtMs: number
}

export interface PacingTurnState {
  phase: TurnPhase
  pacingClosed: boolean
  terminalSeen: boolean
  committedCount: number
  spokenCount: number
  attemptsMade: number
  nextEligibleAtMs?: number
  activeAttemptId?: string
  pendingCueId?: string
}

export interface PacingStateLogEntry {
  timestampMs: number
  relTimeMs: number
  state: PacingState
  event: string
  details?: string
}

export type CacheMissFailureReason = 'cache_not_found' | 'synthesis_timeout' | 'synthesis_failed' | 'decode_failed'

export interface CacheMissDetails {
  reason?: CacheMissFailureReason | string
  error?: string
  elapsedMs?: number
}

export interface PacingMetrics {
  turnId: string
  providerKey: string
  ttftMs?: number
  deadlineMs: number
  fillerCandidate?: ThinkingCategory
  fillerOutcome: 'none' | 'cache-miss' | 'canceled' | 'played' | 'rejected'
  fillerStartMs?: number
  fillerEndMs?: number
  answerFirstAudioMs?: number
  handoffGapMs?: number
  interrupted: boolean
  fillersSpokenCount?: number
  categoriesSpoken?: ThinkingCategory[]
  committedCount?: number
  spokenCount?: number
  pacingClosed?: boolean
  cutoffReason?: string
  cacheMissReason?: string
  cacheMissError?: string
  prepareLatencyMs?: number
  dynamicCueSource?: 'explicit' | 'organic'
  stateLog?: PacingStateLogEntry[]
  liveState?: PacingState
  nextOpportunityCountdownSec?: number
  maxFillers?: number
}

export interface PacingPlaybackMeta {
  turnId: string
  role: 'thinking-filler' | 'assistant-answer'
  generation: number
  attemptId?: string
}

export interface Clock {
  now: () => number
  setTimeout: (fn: () => void, delayMs: number) => any
  clearTimeout: (timerId: any) => void
}

export interface PacingPolicyConfig {
  enabled: boolean
  armMinMs: number
  armMaxMs: number
  maxFillerDurationMs: number
  reasoningWindowMs: number
  categoryThreshold: number
  kFast?: number
  maxFillersPerTurn?: number
  pacingIntervalMs?: number
  dynamicAsidesEnabled?: boolean
  semanticExtractorEnabled?: boolean
  dynamicAfterMs?: number
  candidateTtlMs?: number
  maxFillerSynthesisBudgetMs?: number
  maxSynthesisBudgetMs?: number
  experimentalOrganicPivots?: boolean
}

export interface ThinkingFillerPhrase {
  text: string
  category: ThinkingCategory
  enabled: boolean
}

export const DEFAULT_PACING_FILLERS: ThinkingFillerPhrase[] = [
  { text: 'Hmm...', category: 'generic', enabled: true },
  { text: 'Let me see...', category: 'generic', enabled: true },
  { text: 'Let me think about that...', category: 'generic', enabled: true },
  { text: 'Working through the steps...', category: 'analytical', enabled: true },
  { text: 'Let me calculate that...', category: 'analytical', enabled: true },
  { text: 'Let me think back...', category: 'memory', enabled: true },
  { text: 'Recalling earlier details...', category: 'memory', enabled: true },
  { text: 'I hear you, taking that in...', category: 'emotional', enabled: true },
  { text: 'Hmm, that is a tricky one...', category: 'uncertain', enabled: true },
]

export const DEFAULT_PACING_POLICY: PacingPolicyConfig = {
  enabled: false,
  armMinMs: 900,
  armMaxMs: 3500,
  maxFillerDurationMs: 2200,
  reasoningWindowMs: 900,
  categoryThreshold: 2,
  kFast: 0.5,
  maxFillersPerTurn: 3,
  pacingIntervalMs: 15000,
  dynamicAsidesEnabled: false,
  semanticExtractorEnabled: false,
  dynamicAfterMs: 15000,
  candidateTtlMs: 15000,
  maxFillerSynthesisBudgetMs: 2500,
  maxSynthesisBudgetMs: 2500,
  experimentalOrganicPivots: false,
}
