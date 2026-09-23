import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { ChatHistoryItem } from '../types/chat'
import type { DreamMoodShift, EchoChip, EchoChipType, PCLClaim } from '../types/echo-chip'

import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import * as v from 'valibot'

import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { echoChipsRepo } from '../database/repos/echo-chips.repo'
import { layeredMemory } from '../libs/search/layered-memory'
import { useAuthStore } from './auth'
import { useChatSessionStore } from './chat/session-store'
import { useLLM } from './llm'
import { useAiriCardStore } from './modules/airi-card'
import { useConsciousnessStore } from './modules/consciousness'
import { useProvidersStore } from './providers'

const ChipSchema = v.object({
  content: v.string(),
  type: v.picklist(['mood', 'flavor', 'journal_candidate']),
  relevanceScore: v.number(),
  evidence_indices: v.optional(v.array(v.number())),
})

const ClaimSchema = v.object({
  subject: v.string(),
  predicate: v.string(),
  object: v.string(),
  action: v.picklist(['new', 'reinforce', 'update', 'invalidate']),
  date: v.optional(v.string()),
})

const MoodShiftSchema = v.object({
  valence: v.number(),
  arousal: v.number(),
  sentiment: v.string(),
})

const ArtifactsSchema = v.object({
  pills: v.array(ChipSchema),
  claims: v.optional(v.array(ClaimSchema)),
  mood_shift: v.optional(MoodShiftSchema),
})

const DEFAULT_FIRST_DREAM_LOOKBACK_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_WINDOW_MESSAGES = 80

interface SynthesizeEchoOptions {
  fromTimestamp?: number | null
  toTimestamp?: number
  maxMessages?: number
  fallbackLookbackMs?: number
  force?: boolean
  universeId?: string
  sessionId?: string
  richness?: 'minimal' | 'balanced' | 'lush'
}

interface WindowMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

function sanitizeChatContent(text: string) {
  return text
    .replace(/<\|ACT:[^>]*\|>/g, ' ')
    .replace(/<\|[^>]+\|>/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractPartText(part: any): string {
  if (!part)
    return ''
  if (typeof part === 'string')
    return part
  if (typeof part.text === 'string')
    return part.text
  if (typeof part.input === 'string')
    return part.input
  if (typeof part.output === 'string')
    return part.output
  return ''
}

function extractMessageText(message: ChatHistoryItem): string {
  if (message.role === 'assistant' && Array.isArray((message as any).slices)) {
    const sliceText = (message as any).slices.filter((slice: any) => slice?.type === 'text' && typeof slice.text === 'string').map((slice: any) => slice.text).join(' ')

    if (sliceText.trim())
      return sanitizeChatContent(sliceText)
  }

  const content = (message as any).content
  if (typeof content === 'string')
    return sanitizeChatContent(content)

  if (Array.isArray(content)) {
    return sanitizeChatContent(content.map(extractPartText).join(' '))
  }

  return ''
}

function normalizeChipType(input: any): EchoChipType {
  const raw = String(input || '').toLowerCase().trim()
  if (!raw)
    return 'flavor'
  if (raw.includes('mood'))
    return 'mood'
  if (raw.includes('journal') || raw.includes('event'))
    return 'journal_candidate'
  return 'flavor'
}

export const useEchoesStore = defineStore('echo-chips', () => {
  const { userId } = storeToRefs(useAuthStore())
  const { cards, activeCardId } = storeToRefs(useAiriCardStore())
  const { activeProvider: globalProviderId, activeModel: globalModelId } = storeToRefs(useConsciousnessStore())
  const providersStore = useProvidersStore()
  const llmStore = useLLM()
  const chatSessionStore = useChatSessionStore()

  const chips = ref<EchoChip[]>([])
  const loading = ref(false)
  const initializedForUserId = ref<string | null>(null)

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  const sortedChips = computed(() => {
    const targetCharacterId = activeCardId.value
    const activeSessionId = targetCharacterId
      ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    return [...chips.value]
      .filter(c => (c.universeId || 'global') === currentUniverseId)
      .sort((a, b) => b.createdAt - a.createdAt)
  })

  async function load() {
    const currentUserId = getCurrentUserId()
    if (initializedForUserId.value === currentUserId)
      return

    loading.value = true
    try {
      const raw = await echoChipsRepo.getAll(currentUserId) ?? []
      chips.value = raw.map(c => ({
        id: c.id,
        userId: c.userId || currentUserId,
        characterId: c.characterId,
        date: c.date,
        content: c.content,
        type: (c.type || 'flavor') as EchoChipType,
        relevanceScore: typeof c.relevanceScore === 'number' ? c.relevanceScore : 0.8,
        evidenceIndices: c.evidenceIndices || [],
        citedText: c.citedText || [],
        claims: c.claims || [],
        moodShift: c.moodShift,
        createdAt: c.createdAt || Date.now(),
        universeId: c.universeId,
        sessionId: c.sessionId,
      }))
      initializedForUserId.value = currentUserId
    }
    finally {
      loading.value = false
    }
  }

  async function persist(nextChips: EchoChip[]) {
    const currentUserId = getCurrentUserId()
    const serialized = JSON.parse(JSON.stringify(nextChips))
    await echoChipsRepo.saveAll(currentUserId, serialized)
    chips.value = nextChips
    initializedForUserId.value = currentUserId

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('echo-chips-updated', {
        detail: {
          userId: currentUserId,
          count: nextChips.length,
        },
      }))
    }
  }

  function getCharacterChips(characterId: string) {
    return sortedChips.value.filter(chip => chip.characterId === characterId)
  }

  async function collectWindowMessages(characterId: string, options?: SynthesizeEchoOptions) {
    const currentUserId = getCurrentUserId()
    const index = await chatSessionsRepo.getIndex(currentUserId)
    const characterSessions = index?.characters?.[characterId]
    if (!characterSessions)
      return [] as WindowMessage[]

    const chatSessionStore = useChatSessionStore()
    const activeSessionId = options?.sessionId !== undefined
      ? options.sessionId
      : (characterId
          ? (chatSessionStore.getCharacterIndex(characterId)?.activeSessionId || chatSessionStore.activeSessionId)
          : chatSessionStore.activeSessionId)
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const resolvedUniverseId = options?.universeId !== undefined ? options.universeId : (activeSessionMeta?.universeId || 'global')

    const toTimestamp = options?.toTimestamp ?? Date.now()
    const fromTimestamp = options?.fromTimestamp ?? Math.max(0, toTimestamp - (options?.fallbackLookbackMs ?? DEFAULT_FIRST_DREAM_LOOKBACK_MS))
    const maxMessages = options?.maxMessages ?? DEFAULT_MAX_WINDOW_MESSAGES

    const sessionMetas = Object.values(characterSessions.sessions || {})
      .filter(s => (s.universeId || 'global') === resolvedUniverseId)
    const sessionRecords = await Promise.all(sessionMetas.map(meta => chatSessionsRepo.getSession(meta.sessionId)))

    const messages: WindowMessage[] = []
    for (const session of sessionRecords) {
      if (!session?.messages)
        continue

      for (const message of session.messages) {
        if (message.role !== 'user' && message.role !== 'assistant')
          continue

        const createdAt = typeof message.createdAt === 'number' ? message.createdAt : session.meta.updatedAt
        if (createdAt <= fromTimestamp || createdAt > toTimestamp)
          continue

        const content = extractMessageText(message)
        if (!content)
          continue

        messages.push({
          role: message.role,
          content,
          createdAt,
        })
      }
    }

    return messages
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-maxMessages)
  }

  async function synthesizeForCharacter(characterId: string, options?: SynthesizeEchoOptions) {
    const card = cards.value.get(characterId)
    if (!card)
      throw new Error(`Character ${characterId} not found for echo synthesis.`)

    const windowMessages = await collectWindowMessages(characterId, options)
    if (windowMessages.length === 0)
      throw new Error(`No raw chat window found for character ${characterId} in the requested dream range.`)

    loading.value = true
    try {
      const richness = options?.richness || 'balanced'
      let countInstruction = 'Extract 3-5 semantic Echo Chips'
      let focusInstruction = 'Prefer durable motifs, emotional shifts, distinctive rituals, or memorable turns. Ignore pure greetings, microphone tests, or generic filler.'

      if (richness === 'minimal') {
        countInstruction = 'Extract 1-3 high-impact, pivotal Echo Chips'
        focusInstruction = 'Focus strictly on critical turning points, major topic shifts, or explicit user preferences.'
      }
      else if (richness === 'lush') {
        countInstruction = 'Extract 5-8 deeply evocative Echo Chips'
        focusInstruction = 'Capture subtle atmospheric tones, subtext, recurring idioms, emotional nuances, and relational cadence.'
      }

      // --- Semantic Anchor Retrieval: "Turn as a Query" ---
      const earliestWindowTime = windowMessages[0]?.createdAt ?? 0
      const latestWindowTime = windowMessages[windowMessages.length - 1]?.createdAt ?? Date.now()

      const activeSessionId = options?.sessionId !== undefined
        ? options.sessionId
        : (characterId
            ? (chatSessionStore.getCharacterIndex(characterId)?.activeSessionId || chatSessionStore.activeSessionId)
            : chatSessionStore.activeSessionId)
      const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
      const resolvedUniverseId = options?.universeId !== undefined ? options.universeId : (activeSessionMeta?.universeId || 'global')
      const resolvedSessionId = options?.sessionId !== undefined ? options.sessionId : activeSessionId

      let historicalAnchors: Array<{ id: string, layer: string, date: string, text: string }> = []
      try {
        const turnQuery = windowMessages.slice(-4).map(m => m.content).join(' ').slice(0, 200).trim()
        if (turnQuery) {
          const searchResults = await layeredMemory.search(turnQuery, 6, characterId, {
            universeId: resolvedUniverseId,
          })
          if (Array.isArray(searchResults)) {
            historicalAnchors = searchResults
              .filter((res: any) => {
                const resTime = res.timestamp || (res.date ? new Date(res.date).getTime() : 0)
                if (resTime >= earliestWindowTime && resTime <= latestWindowTime)
                  return false
                return true
              })
              .slice(0, 3)
              .map((res: any) => ({
                id: res.id,
                layer: res.layer || 'memory',
                date: res.date || 'Historical',
                text: res.observed_text || res.fact || res.subject || '',
              }))
          }
        }
      }
      catch (err) {
        console.warn('[Echo Synthesis] Historical anchor search failed or skipped:', err)
      }

      // Format lines with explicit numbers for evidence_indices
      const lines: string[] = []
      windowMessages.forEach((message, index) => {
        const iso = new Date(message.createdAt).toISOString()
        const speaker = message.role === 'user' ? 'User' : card.name
        lines.push(`Line ${index}: [${iso}] ${speaker}: ${message.content}`)
      })

      const anchorStartIndex = windowMessages.length
      if (historicalAnchors.length > 0) {
        historicalAnchors.forEach((anchor, i) => {
          lines.push(`Line ${anchorStartIndex + i}: [${anchor.date}] [Anchor: ${anchor.layer}] ${anchor.text}`)
        })
      }

      const evidenceWindow = lines.join('\n')

      const prompt = `
${countInstruction} from the following conversation evidence window and historical memory anchors.
These are for a character memory-stream; avoid clinical labels and generic chatter.

Requirements:
1. CONTENT: Use 2-5 word evocative bursts for user-facing recall (e.g. "Dogs know tricks", "Gaming as stress relief").
2. TYPE: Identify whether each pill is a "mood", "flavor" (trait/preference), or "journal_candidate" (noteworthy milestone worth preserving in permanent journal).
3. RELEVANCE: Provide a relevanceScore from 0.0 to 1.0.
4. EVIDENCE: Use evidence_indices to reference the line numbers that inspired the chip.
5. CLAIMS: Extract 1-3 atomic PCL belief triples as "claims" about the world, user, or character:
   - subject: entity name (e.g. "User", "${card.name}")
   - predicate: relationship or attribute verb (e.g. "likes", "hates", "plans_to", "fears", "visited")
   - object: target concept, detail, or preference
   - action: "new" (new observation), "reinforce" (confirmed ongoing belief), "update" (changed/superseded belief), or "invalidate" (disproven/outdated).
6. MOOD SHIFT: Provide an emotional exhaust "mood_shift":
   - valence: -1.0 (gloomy/somber) to 1.0 (joyful/warm)
   - arousal: -1.0 (calm/peaceful) to 1.0 (excited/alert)
   - sentiment: 1-2 words describing the companion's waking afterglow feeling (e.g. "wistful", "tender", "amused", "flustered").
7. FOCUS: ${focusInstruction}

Evidence Window & Context:
${evidenceWindow}

Output a JSON object with "pills", "claims", and "mood_shift".
`
      const providerId = card.extensions?.airi?.modules?.consciousness?.provider || globalProviderId.value
      const modelId = card.extensions?.airi?.modules?.consciousness?.model || globalModelId.value

      if (!providerId || !modelId)
        throw new Error('No provider/model configured for echo synthesis.')

      if (!options?.force && !providersStore.configuredProviders[providerId]) {
        // eslint-disable-next-line no-console
        console.log(`[Echo Synthesis] Aborted: Provider "${providerId}" is offline/unconfigured.`)
        return []
      }

      const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
      if (!provider)
        throw new Error(`Failed to resolve provider instance for "${providerId}".`)

      const res = await llmStore.generateObject(modelId, provider, {
        messages: [{ role: 'user', content: prompt }],
        schema: ArtifactsSchema,
        normalize: (parsed: any) => {
          if (Array.isArray(parsed.pills)) {
            parsed.pills = parsed.pills.map((p: any) => ({
              ...p,
              content: p.content || p.pill || p.text || 'Untitled',
              type: normalizeChipType(p.type || p.category || (p.mood ? 'mood' : 'flavor')),
              relevanceScore: typeof p.relevanceScore === 'number' ? p.relevanceScore : 0.8,
              evidence_indices: Array.isArray(p.evidence_indices)
                ? p.evidence_indices.filter((value: unknown) => typeof value === 'number')
                : [],
            }))
          }
          if (Array.isArray(parsed.claims)) {
            parsed.claims = parsed.claims.map((c: any) => ({
              subject: String(c.subject || '').trim() || 'Unknown',
              predicate: String(c.predicate || '').trim() || 'related_to',
              object: String(c.object || '').trim() || 'Unknown',
              action: ['new', 'reinforce', 'update', 'invalidate'].includes(c.action) ? c.action : 'new',
              date: c.date ? String(c.date) : undefined,
            }))
          }
          if (parsed.mood_shift && typeof parsed.mood_shift === 'object') {
            parsed.mood_shift = {
              valence: typeof parsed.mood_shift.valence === 'number' ? Math.max(-1, Math.min(1, parsed.mood_shift.valence)) : 0,
              arousal: typeof parsed.mood_shift.arousal === 'number' ? Math.max(-1, Math.min(1, parsed.mood_shift.arousal)) : 0,
              sentiment: String(parsed.mood_shift.sentiment || 'neutral').trim(),
            }
          }
          return parsed
        },
      })

      await load()
      const now = Date.now()
      const anchorTimestamp = options?.toTimestamp ?? windowMessages[windowMessages.length - 1]?.createdAt ?? now
      const anchorDate = new Date(anchorTimestamp).toISOString().slice(0, 10)

      const parsedClaims: PCLClaim[] = Array.isArray(res.claims) ? res.claims : []
      const parsedMoodShift: DreamMoodShift | undefined = res.mood_shift && typeof res.mood_shift === 'object' ? res.mood_shift : undefined

      const newChips: EchoChip[] = res.pills.map((p: any) => {
        const citedText = (p.evidence_indices || [])
          .map((idx: number) => lines[idx])
          .filter(Boolean)

        return {
          id: nanoid(),
          userId: getCurrentUserId(),
          characterId,
          date: anchorDate,
          content: p.content,
          type: normalizeChipType(p.type),
          relevanceScore: p.relevanceScore,
          evidenceIndices: p.evidence_indices || [],
          citedText,
          claims: parsedClaims,
          moodShift: parsedMoodShift,
          createdAt: now,
          universeId: resolvedUniverseId,
          sessionId: resolvedSessionId,
        }
      })

      await persist([...newChips, ...chips.value])

      return newChips
    }
    catch (err) {
      console.group('Echo Synthesis Critical Failure')
      console.error('Error Object:', err)
      if (err instanceof Error)
        console.error('Stack:', err.stack)
      console.groupEnd()
      throw err
    }
    finally {
      loading.value = false
    }
  }

  async function deleteChip(id: string) {
    const nextChips = chips.value.filter(c => c.id !== id)
    await persist(nextChips)
  }

  return {
    chips: sortedChips,
    loading,
    load,
    getCharacterChips,
    synthesizeForCharacter,
    deleteChip,
    persist,
  }
})
