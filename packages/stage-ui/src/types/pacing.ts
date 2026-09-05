export type InferenceEvent
  = | { type: 'connected', at: number }
    | { type: 'reasoning', text: string, visibility: 'hidden' | 'visible', at: number }
    | { type: 'answer', text: string, at: number }
    | { type: 'special', token: string, at: number }
    | { type: 'tool', phase: 'start' | 'end', at: number }
    | { type: 'finish', reason?: string, at: number }
    | { type: 'error', error: unknown, at: number }

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
}

export interface PacingPlaybackMeta {
  turnId: string
  role: 'thinking-filler' | 'assistant-answer'
  generation: number
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
  armMinMs: 1200,
  armMaxMs: 3500,
  maxFillerDurationMs: 1200,
  reasoningWindowMs: 900,
  categoryThreshold: 1,
  kFast: 0.5,
}
