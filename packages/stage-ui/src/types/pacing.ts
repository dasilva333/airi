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
  answerFirstAudioMs?: number
  handoffGapMs?: number
  interrupted: boolean
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
}
