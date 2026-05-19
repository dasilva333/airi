import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { ChatHistoryItem } from '../types/chat'
import type { EchoChip, EchoChipType } from '../types/echo-chip'

import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import * as v from 'valibot'

import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { echoChipsRepo } from '../database/repos/echo-chips.repo'
import { useAuthStore } from './auth'
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

const ArtifactsSchema = v.object({
  pills: v.array(ChipSchema),
})

const DEFAULT_FIRST_DREAM_LOOKBACK_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_WINDOW_MESSAGES = 80

interface SynthesizeEchoOptions {
  fromTimestamp?: number | null
  toTimestamp?: number
  maxMessages?: number
  fallbackLookbackMs?: number
  force?: boolean
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
  const { cards } = storeToRefs(useAiriCardStore())
  const { activeProvider: globalProviderId, activeModel: globalModelId } = storeToRefs(useConsciousnessStore())
  const providersStore = useProvidersStore()
  const llmStore = useLLM()

  const chips = ref<EchoChip[]>([])
  const loading = ref(false)
  const initializedForUserId = ref<string | null>(null)

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  const sortedChips = computed(() => {
    return [...chips.value].sort((a, b) => b.createdAt - a.createdAt)
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
        createdAt: c.createdAt || Date.now(),
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

    const toTimestamp = options?.toTimestamp ?? Date.now()
    const fromTimestamp = options?.fromTimestamp ?? Math.max(0, toTimestamp - (options?.fallbackLookbackMs ?? DEFAULT_FIRST_DREAM_LOOKBACK_MS))
    const maxMessages = options?.maxMessages ?? DEFAULT_MAX_WINDOW_MESSAGES

    const sessionMetas = Object.values(characterSessions.sessions || {})
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
      const evidenceWindow = windowMessages
        .map((message, index) => {
          const iso = new Date(message.createdAt).toISOString()
          const speaker = message.role === 'user' ? 'User' : card.name
          return `${index}: [${iso}] ${speaker}: ${message.content}`
        })
        .join('\n')

      const prompt = `
Extract 3-5 semantic Echo Chips from the following raw conversation evidence window.
These are for a character memory-stream; avoid clinical labels and generic chatter.

Requirements:
1. CONTENT: Use 2-5 word evocative bursts (e.g. "Dogs know tricks", "Gaming as stress relief").
2. TYPE: Identify whether each chip is a "mood", "flavor" (trait/fact), or "journal_candidate" (noteworthy moment worth preserving).
3. RELEVANCE: Provide a relevanceScore from 0.0 to 1.0.
4. EVIDENCE: Use evidence_indices to point at the most relevant lines from the evidence window.
5. FOCUS: Prefer durable motifs, emotional shifts, distinctive rituals, or memorable turns. Ignore pure greetings, microphone tests, or generic filler.

Evidence Window:
${evidenceWindow}

Output a JSON object with a "pills" array.
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
          return parsed
        },
      })

      await load()
      const now = Date.now()
      const anchorTimestamp = options?.toTimestamp ?? windowMessages[windowMessages.length - 1]?.createdAt ?? now
      const anchorDate = new Date(anchorTimestamp).toISOString().slice(0, 10)
      const newChips: EchoChip[] = res.pills.map((p: any) => ({
        id: nanoid(),
        userId: getCurrentUserId(),
        characterId,
        date: anchorDate,
        content: p.content,
        type: normalizeChipType(p.type),
        relevanceScore: p.relevanceScore,
        evidenceIndices: p.evidence_indices || [],
        createdAt: now,
      }))

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

  return {
    chips: sortedChips,
    loading,
    load,
    getCharacterChips,
    synthesizeForCharacter,
  }
})
