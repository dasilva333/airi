import type { ChatSlices, ChatSlicesText } from '../types/chat'

const ACTOR_TOKEN_PATTERN = /^<\|ACTOR:\s*([\w-]+)\s*(?:\|>|>)$/i
const LLM_MARKER_PATTERN = /<\|[\s\S]*?\|>|<\|(?:ACT|DELAY|llm_[\w:-])[^\r\n>]*>/gi

export interface ActorSliceState {
  currentActorId?: string
  pendingStartsActor: boolean
}

interface ActorTransition {
  actorId: string
  offset: number
}

interface TextSliceRange {
  end: number
  start: number
}

export function isValidActorId(value: unknown): value is string {
  return typeof value === 'string' && /^[\w-]+$/.test(value)
}

export function parseActorToken(token: string): string | undefined {
  const match = ACTOR_TOKEN_PATTERN.exec(token)
  return match?.[1]
}

export function createActorSliceState(): ActorSliceState {
  return {
    currentActorId: undefined,
    pendingStartsActor: false,
  }
}

export function captureActorToken(state: ActorSliceState, token: string): boolean {
  const actorId = parseActorToken(token)
  if (!actorId)
    return false

  state.currentActorId = actorId
  state.pendingStartsActor = true
  return true
}

export function appendActorAwareTextSlice(slices: ChatSlices[], text: string, state: ActorSliceState): void {
  if (!text)
    return

  const actorId = isValidActorId(state.currentActorId) ? state.currentActorId : undefined
  const startsActor = actorId ? state.pendingStartsActor : undefined
  const lastSlice = slices.at(-1)

  if (lastSlice?.type === 'text' && !startsActor && lastSlice.actorId === actorId) {
    lastSlice.text += text
  }
  else {
    const slice: ChatSlicesText = {
      type: 'text',
      text,
    }

    if (actorId) {
      slice.actorId = actorId
      slice.startsActor = startsActor === true
    }

    slices.push(slice)
  }

  if (actorId)
    state.pendingStartsActor = false
}

function extractVisibleTextAndActorTransitions(rawContent: string): { text: string, transitions: ActorTransition[] } {
  const transitions: ActorTransition[] = []
  let text = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  LLM_MARKER_PATTERN.lastIndex = 0
  while ((match = LLM_MARKER_PATTERN.exec(rawContent)) !== null) {
    text += rawContent.slice(lastIndex, match.index)

    const actorId = parseActorToken(match[0])
    if (actorId) {
      transitions.push({
        actorId,
        offset: text.length,
      })
    }

    lastIndex = LLM_MARKER_PATTERN.lastIndex
  }

  text += rawContent.slice(lastIndex)
  return { text, transitions }
}

function alignTextSlices(slices: ChatSlices[], visibleText: string): Map<number, TextSliceRange> | undefined {
  const ranges = new Map<number, TextSliceRange>()
  let cursor = 0

  for (const [index, slice] of slices.entries()) {
    if (slice.type !== 'text')
      continue

    const start = visibleText.indexOf(slice.text, cursor)
    if (start < 0 || visibleText.slice(cursor, start).trim())
      return undefined

    const end = start + slice.text.length
    ranges.set(index, { start, end })
    cursor = end
  }

  if (visibleText.slice(cursor).trim())
    return undefined

  return ranges
}

/**
 * Reconstructs actor metadata for messages persisted before text slices became actor-aware.
 * The fallback intentionally returns the original slices unless every display-text slice can
 * be aligned to rawContent with only whitespace gaps, preventing speculative actor assignment.
 */
export function hydrateLegacyActorSlices(slices: ChatSlices[], rawContent?: string): ChatSlices[] {
  if (!rawContent || slices.some(slice => slice.type === 'text' && (slice.actorId !== undefined || slice.startsActor !== undefined)))
    return slices

  const { text: visibleText, transitions } = extractVisibleTextAndActorTransitions(rawContent)
  if (transitions.length === 0)
    return slices

  const ranges = alignTextSlices(slices, visibleText)
  if (!ranges)
    return slices

  const hydrated: ChatSlices[] = []
  let currentActorId: string | undefined
  let pendingStartsActor = false
  let transitionIndex = 0

  const applyTransition = (transition: ActorTransition) => {
    currentActorId = transition.actorId
    pendingStartsActor = true
    transitionIndex++
  }

  const pushText = (text: string) => {
    if (!text)
      return

    const slice: ChatSlicesText = {
      type: 'text',
      text,
    }

    if (currentActorId) {
      slice.actorId = currentActorId
      slice.startsActor = pendingStartsActor
      pendingStartsActor = false
    }

    hydrated.push(slice)
  }

  for (const [index, slice] of slices.entries()) {
    if (slice.type !== 'text') {
      hydrated.push(slice)
      continue
    }

    const range = ranges.get(index)
    if (!range)
      return slices

    while (transitions[transitionIndex]?.offset <= range.start)
      applyTransition(transitions[transitionIndex])

    if (!slice.text) {
      hydrated.push(slice)
      continue
    }

    let segmentStart = range.start
    while (transitions[transitionIndex]?.offset < range.end) {
      const transition = transitions[transitionIndex]
      const relativeStart = segmentStart - range.start
      const relativeEnd = transition.offset - range.start
      pushText(slice.text.slice(relativeStart, relativeEnd))
      segmentStart = transition.offset
      applyTransition(transition)
    }

    pushText(slice.text.slice(segmentStart - range.start))
  }

  return hydrated
}
