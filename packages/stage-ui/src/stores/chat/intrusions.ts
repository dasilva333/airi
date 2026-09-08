import {
  DEFAULT_ARTISTRY_INTRUSION_PROMPT,
  DEFAULT_DREAM_INTRUSION_PROMPT,
  DEFAULT_JOURNAL_INTRUSION_PROMPT,
} from '../../constants/prompts/character-defaults'

export interface ClimaxInput {
  enabled?: boolean
  gameMode?: string
  positiveScore?: number
  negativeScore?: number
  maxScore?: number
  maxTurns?: number
  assistantTurnCount?: number
}

export interface DreamIntrusionInput {
  injectDreamContext?: boolean
  pendingDreamChips?: string[]
  pendingDreamTimestamp?: number
  template?: string
  nowMs?: number
}

export interface JournalIntrusionInput {
  injectJournalContext?: boolean
  entryText?: string
  timestamp?: number
  template?: string
  nowMs?: number
}

export interface ArtistryIntrusionInput {
  injectArtistryContext?: boolean
  prompt?: string
  template?: string
}

/**
 * Pure helper for evaluating Dating Sim goal-driven win/loss conditions
 * and formatting the climax resolution prompt.
 */
export function formatClimaxPrompt(input: ClimaxInput): string {
  if (!input.enabled || input.gameMode !== 'goal_driven')
    return ''

  const pos = input.positiveScore ?? 0
  const neg = input.negativeScore ?? 0
  const maxScore = input.maxScore ?? 0
  const maxTurns = input.maxTurns ?? 0
  const turns = input.assistantTurnCount ?? 0

  const isWin = pos >= maxScore || ((turns + 1) >= maxTurns && pos > neg)
  const isLoss = neg >= maxScore || ((turns + 1) >= maxTurns && neg >= pos)

  if (!isWin && !isLoss)
    return ''

  const climaxState = isWin ? 'VICTORY' : 'DEFEAT'
  return `[DATING SIM CLIMAX RESOLUTION]
The Dating Sim session has ended. The user has achieved the climax state: ${climaxState}.
Final metrics: Intimacy Connection: ${pos}/${maxScore}, Tension/Friction: ${neg}/${maxScore}, Turns Elapsed: ${turns + 1}/${maxTurns}.

You must now react to this outcome and provide a rich, narrative-driven climax reaction to resolve this storyline/arc. Break standard reply length limits if necessary to provide a complete, satisfying story resolution. Do not generate choices, suggestions, or prompt instructions anymore.`
}

/**
 * Pure helper for interpolating dream introspection prompt template.
 */
export function formatDreamPrompt(input: DreamIntrusionInput): string {
  if (!input.injectDreamContext || !input.pendingDreamChips || input.pendingDreamChips.length === 0)
    return ''

  const now = input.nowMs ?? Date.now()
  const elapsedMinutes = Math.max(1, Math.round((now - (input.pendingDreamTimestamp || now)) / 60000))
  const template = input.template || DEFAULT_DREAM_INTRUSION_PROMPT
  const chipsText = input.pendingDreamChips.join(', ')

  return template
    .replace('{timeToDream}', String(elapsedMinutes))
    .replace('{insertEchoChips}', chipsText)
}

/**
 * Pure helper for interpolating text journal intrusion prompt template.
 */
export function formatJournalPrompt(input: JournalIntrusionInput): string {
  if (!input.injectJournalContext || !input.entryText)
    return ''

  const now = input.nowMs ?? Date.now()
  const elapsedMinutes = Math.max(1, Math.round((now - (input.timestamp ?? now)) / 60000))
  const template = input.template || DEFAULT_JOURNAL_INTRUSION_PROMPT

  return template
    .replace('{timeSinceJournal}', String(elapsedMinutes))
    .replace('{journalEntryText}', input.entryText)
}

/**
 * Pure helper for interpolating artistry intrusion prompt template.
 */
export function formatArtistryPrompt(input: ArtistryIntrusionInput): string {
  if (!input.injectArtistryContext || !input.prompt)
    return ''

  const template = input.template || DEFAULT_ARTISTRY_INTRUSION_PROMPT

  return template
    .replace('{imagePrompt}', input.prompt)
}
