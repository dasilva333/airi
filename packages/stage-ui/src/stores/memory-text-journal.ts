import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import * as v from 'valibot'
import { computed, ref, watch } from 'vue'
import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { shortTermMemoryRepo } from '../database/repos/short-term-memory.repo'
import { textJournalRepo } from '../database/repos/text-journal.repo'
import { layeredMemory } from '../libs/search/layered-memory'
import type { ChatStreamEvent } from '../types/chat'
import type { TextJournalEntry, TextJournalEntrySource } from '../types/text-journal'
import { useAuthStore } from './auth'
import { CHAT_STREAM_CHANNEL_NAME } from './chat/constants'
import { useLLM } from './llm'
import { useAiriCardStore } from './modules/airi-card'
import { useProvidersStore } from './providers'

function normalizeEntry(entry: TextJournalEntry): TextJournalEntry {
  return {
    characterId: String(entry.characterId),
    characterName: String(entry.characterName),
    content: String(entry.content ?? ''),

    createdAt: Number.isFinite(entry.createdAt) ? Number(entry.createdAt) : Date.now(),
    difficulty: Number(entry.difficulty ?? 0),
    elapsed_days: Number(entry.elapsed_days ?? 0),

    // Search
    embedding: Array.isArray(entry.embedding) ? entry.embedding : undefined,
    id: String(entry.id),
    last_review: Number(entry.last_review ?? entry.createdAt ?? Date.now()),
    scheduled_days: Number(entry.scheduled_days ?? 0),
    source: entry.source ?? 'tool',

    // FSRS
    stability: Number(entry.stability ?? 0),
    surprise: entry.surprise !== undefined ? Number(entry.surprise) : undefined,
    title: String(entry.title ?? ''),
    type: entry.type ?? 'message',
    updatedAt: Number.isFinite(entry.updatedAt) ? Number(entry.updatedAt) : Date.now(),
    userId: String(entry.userId),
    version: entry.version,
  }
}

function normalizeEntries(entries: TextJournalEntry[]) {
  return entries.map(normalizeEntry)
}

export const useTextJournalStore = defineStore('text-journal', () => {
  const { userId } = storeToRefs(useAuthStore())
  const { activeCard, activeCardId, cards } = storeToRefs(useAiriCardStore())

  const { post: broadcastStreamEvent, data: incomingStreamEvent } = useBroadcastChannel<
    ChatStreamEvent,
    ChatStreamEvent
  >({ name: CHAT_STREAM_CHANNEL_NAME })

  const entries = ref<TextJournalEntry[]>([])
  const loading = ref(false)
  const initializedForUserId = ref<string | null>(null)

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  const sortedEntries = computed(() => {
    return [...entries.value].sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt)
  })

  async function load(force = false) {
    const currentUserId = getCurrentUserId()
    if ((!force && initializedForUserId.value === currentUserId) || loading.value) return

    loading.value = true
    try {
      entries.value = normalizeEntries((await textJournalRepo.getAll(currentUserId)) ?? [])

      // Initialize layered memory index
      await layeredMemory.init()

      initializedForUserId.value = currentUserId

      // Fire-and-forget background indexing
      backgroundIndexAll().catch((err) => console.error('text_journal: background search indexing failed:', err))
    } finally {
      loading.value = false
    }
  }

  async function backgroundIndexAll() {
    const userId = getCurrentUserId()
    const cardId = activeCardId.value
    if (!userId || !cardId) return

    // 1. LTMM
    const ltmm = entries.value
      .filter((e) => e.characterId === cardId)
      .map((e) => ({
        fact: e.content,
        id: e.id,
        kind: 'ltmm_entry',
        source: e.source,
        timestamp: new Date(e.createdAt).toISOString(),
      }))

    // 2. STMM
    const stmmRaw = (await shortTermMemoryRepo.getAll(userId)) ?? []
    const stmm = stmmRaw
      .filter((b) => b.characterId === cardId)
      .map((b) => ({
        fact: b.summary,
        id: b.id,
        kind: 'stmm_block',
        source: b.source,
        timestamp: b.date,
      }))

    // 3. Raw (Sampling recent sessions)
    const index = await chatSessionsRepo.getIndex(userId)
    const raw: any[] = []
    if (index && index.characters[cardId]) {
      const characterSessions = index.characters[cardId]
      const sessions = Object.values(characterSessions.sessions)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5) // Last 5 sessions

      for (const s of sessions) {
        const session = await chatSessionsRepo.getSession(s.sessionId)
        if (session) {
          for (const m of session.messages) {
            if (m.role === 'user' || m.role === 'assistant') {
              const text = typeof m.content === 'string' ? m.content : ''
              if (text.length > 40) {
                raw.push({
                  fact: text,
                  id: m.id,
                  kind: 'raw_turn',
                  source: `chat:${s.sessionId}`,
                  timestamp: new Date(m.createdAt || Date.now()).toISOString(),
                })
              }
            }
          }
        }
      }
    }

    await layeredMemory.indexDocuments([...ltmm, ...stmm, ...raw])
  }

  async function persist(nextEntries: TextJournalEntry[]) {
    const currentUserId = getCurrentUserId()
    const snapshot = normalizeEntries(JSON.parse(JSON.stringify(nextEntries)) as TextJournalEntry[])
    await textJournalRepo.saveAll(currentUserId, snapshot)
    entries.value = snapshot
    initializedForUserId.value = currentUserId
    broadcastStreamEvent({ type: 'journal-refreshed', userId: currentUserId })
  }

  async function createEntry(input: {
    title?: string
    content: string
    source?: TextJournalEntrySource
    characterId?: string
  }) {
    try {
      await load()
    } catch (err) {
      throw new Error(
        `text_journal: failed to load entries before creating: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const targetCard = input.characterId ? cards.value.get(input.characterId) : activeCard.value

    if (!targetCard) throw new Error('No active character is available for text_journal.create.')

    const currentUserId = getCurrentUserId()
    const now = Date.now()
    const nextEntry: TextJournalEntry = {
      characterId: input.characterId ?? activeCardId.value ?? '',
      characterName: targetCard.name,
      content: input.content.trim(),

      createdAt: now,
      difficulty: 0,
      elapsed_days: 0,
      id: nanoid(),
      last_review: now,
      scheduled_days: 0,
      source: input.source ?? 'tool',

      // FSRS
      stability: 0,
      title: input.title?.trim() || 'Journal Entry',
      updatedAt: now,
      userId: currentUserId,
    }

    if (!nextEntry.characterId)
      throw new Error('Active character could not be resolved for text journal entry creation.')

    const nextEntries = [nextEntry, ...entries.value]
    try {
      await persist(nextEntries)
    } catch (err) {
      throw new Error(
        `text_journal: failed to persist new entry "${nextEntry.title}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    return nextEntry
  }

  async function seedActiveCharacterEntry() {
    const targetCard = activeCard.value
    if (!targetCard) throw new Error('No active character is available to seed the text journal.')

    return await createEntry({
      content: [
        `This is a seeded long-term journal entry for ${targetCard.name}.`,
        'It exists to verify that text_journal.create is wired, persisted, and scoped to the active character.',
      ].join('\n\n'),
      source: 'seed',
      title: 'Seeded Journal Entry',
    })
  }

  async function searchEntries(input: { query: string; limit?: number; characterId?: string }) {
    try {
      await load()
    } catch (err) {
      throw new Error(
        `text_journal: failed to load entries before searching: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const query = input.query.trim()
    if (!query) return []

    const results = await layeredMemory.search(query, input.limit ?? 3)

    // Log search results for developer review
    console.log(`[TextJournal:Search] Query: "${query}" | Results:`, results)

    // For now, map layered results back to the most relevant TextJournalEntry if it exists,
    // or provide surrogate entries for STMM/Raw.
    return results.map((res) => {
      const existing = entries.value.find((e) => e.id === res.id)
      if (existing) {
        return {
          ...existing,
          kind: res.kind,
        }
      }

      // Surrogate entry for STMM/Raw context
      return {
        characterId: input.characterId ?? activeCardId.value ?? '',
        characterName: activeCard.value?.name ?? 'Unknown',
        content: res.content,
        createdAt: new Date(res.timestamp).getTime(),
        id: res.id,
        kind: res.kind,
        source: 'tool',
        title: `[${res.kind.toUpperCase()}] Memory`,
        type: 'message',
        updatedAt: new Date(res.timestamp).getTime(),
        userId: getCurrentUserId(),
      } as TextJournalEntry & { kind: string }
    })
  }

  watch(incomingStreamEvent, (event) => {
    if (!event) return
    if (event.type === 'journal-refreshed') {
      const currentUserId = getCurrentUserId()
      if (event.userId === currentUserId) {
        console.info('[TextJournal] Cross-window journal-refreshed, reloading LTMM entries')
        void load(true)
      }
    }
  })

  async function createJournalMoment(input: {
    messages: any[]
    instructions?: string
    modelId: string
    providerId: string
  }) {
    console.log('[JournalMoment] Starting creation...', {
      messageCount: input.messages.length,
      modelId: input.modelId,
      providerId: input.providerId,
    })
    const providersStore = useProvidersStore()
    const llmStore = useLLM()
    const { activeCard, activeCardId } = storeToRefs(useAiriCardStore())

    if (!activeCard.value || !activeCardId.value) {
      console.error('[JournalMoment] No active character found.')
      throw new Error('No active character')
    }

    const chatProvider = (await providersStore.getProviderInstance(input.providerId)) as any
    if (!chatProvider) {
      console.error(`[JournalMoment] Provider not found: ${input.providerId}`)
      throw new Error(`Provider not found: ${input.providerId}`)
    }

    const historyText = input.messages
      .map((m) => {
        const role = m.role === 'user' ? 'User' : (activeCard.value?.name ?? 'Assistant')
        const content = typeof m.content === 'string' ? m.content : ''
        return `${role}: ${content}`
      })
      .join('\n')

    const prompt = `You are ${activeCard.value.name}. Write a journal entry about the following conversation history.\n\n${input.instructions ? `Additional Instructions: ${input.instructions}\n\n` : ''}History:\n${historyText}\n\nReturn a JSON object with 'title' and 'content' for your journal entry. Write it in the first person as ${activeCard.value.name}.`

    console.log('[JournalMoment] Calling LLM generateObject...')
    try {
      const res = await llmStore.generateObject<{ title: string; content: string }>(input.modelId, chatProvider, {
        messages: [{ content: prompt, role: 'user' }],
        schema: v.object({
          content: v.string(),
          title: v.string(),
        }),
      })
      const object = res as unknown as { title: string; content: string }
      console.log('[JournalMoment] LLM returned object:', object)

      return await createEntry({
        characterId: activeCardId.value,
        content: object.content,
        source: 'user', // Manual trigger
        title: object.title,
      })
    } catch (err) {
      console.error('[JournalMoment] LLM or createEntry failed:', err)
      throw err
    }
  }

  return {
    backgroundIndexAll,
    createEntry,
    createJournalMoment,
    entries: sortedEntries,
    load,
    loading,
    persist,
    searchEntries,
    seedActiveCharacterEntry,
  }
})
