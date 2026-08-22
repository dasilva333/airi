import type { ChatStreamEvent } from '../types/chat'
import type { TextJournalEntry, TextJournalEntrySource } from '../types/text-journal'

import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import * as v from 'valibot'

import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { echoChipsRepo } from '../database/repos/echo-chips.repo'
import { lifetimeMemoryRepo } from '../database/repos/lifetime-memory.repo'
import { shortTermMemoryRepo } from '../database/repos/short-term-memory.repo'
import { textJournalRepo } from '../database/repos/text-journal.repo'
import { layeredMemory } from '../libs/search/layered-memory'
import { useAuthStore } from './auth'
import { CHAT_STREAM_CHANNEL_NAME } from './chat/constants'
import { stageJournalIntrusion } from './chat/intrusion-staging'
import { useChatSessionStore } from './chat/session-store'
import { useEventLogStore } from './event-log'
import { useLLM } from './llm'
import { useAiriCardStore } from './modules/airi-card'
import { useProvidersStore } from './providers'

function normalizeEntry(entry: TextJournalEntry): TextJournalEntry {
  return {
    id: String(entry.id),
    userId: String(entry.userId),
    characterId: String(entry.characterId),
    characterName: String(entry.characterName),
    title: String(entry.title ?? ''),
    content: String(entry.content ?? ''),
    source: entry.source ?? 'tool',
    type: entry.type ?? 'message',

    // FSRS
    stability: Number(entry.stability ?? 0),
    difficulty: Number(entry.difficulty ?? 0),
    elapsed_days: Number(entry.elapsed_days ?? 0),
    scheduled_days: Number(entry.scheduled_days ?? 0),
    last_review: Number(entry.last_review ?? entry.createdAt ?? Date.now()),
    surprise: entry.surprise !== undefined ? Number(entry.surprise) : undefined,

    // Search
    embedding: Array.isArray(entry.embedding) ? entry.embedding : undefined,
    version: entry.version,

    createdAt: Number.isFinite(entry.createdAt) ? Number(entry.createdAt) : Date.now(),
    updatedAt: Number.isFinite(entry.updatedAt) ? Number(entry.updatedAt) : Date.now(),
    universeId: entry.universeId,
    sessionId: entry.sessionId,
  }
}

function normalizeEntries(entries: TextJournalEntry[]) {
  return entries.map(normalizeEntry)
}

export const useTextJournalStore = defineStore('text-journal', () => {
  const { userId } = storeToRefs(useAuthStore())
  const { activeCard, activeCardId, cards } = storeToRefs(useAiriCardStore())

  const { post: broadcastStreamEvent, data: incomingStreamEvent } = useBroadcastChannel<ChatStreamEvent, ChatStreamEvent>({ name: CHAT_STREAM_CHANNEL_NAME })

  // BroadcastChannel for cross-window intrusion staging
  const { post: postIntrusionStaging } = useBroadcastChannel<
    { type: 'journal' | 'artistry', data: any },
    { type: 'journal' | 'artistry', data: any }
  >({ name: 'airi-intrusion-staging' })

  const entries = ref<TextJournalEntry[]>([])
  const loading = ref(false)
  const initializedForUserId = ref<string | null>(null)

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  const sortedEntries = computed(() => {
    const chatSessionStore = useChatSessionStore()
    const targetCharacterId = activeCardId.value
    const activeSessionId = targetCharacterId
      ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    return [...entries.value]
      .filter(e => (e.universeId || 'global') === currentUniverseId)
      .sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt)
  })

  async function load(force = false) {
    const currentUserId = getCurrentUserId()
    if ((!force && initializedForUserId.value === currentUserId) || loading.value)
      return

    loading.value = true
    try {
      entries.value = normalizeEntries(await textJournalRepo.getAll(currentUserId) ?? [])

      // Initialize layered memory index
      await layeredMemory.init()

      initializedForUserId.value = currentUserId

      // Fire-and-forget background indexing
      backgroundIndexAll().catch(err => console.error('text_journal: background search indexing failed:', err))
    }
    finally {
      loading.value = false
    }
  }

  function extractTextContent(content: any): string {
    if (typeof content === 'string')
      return content
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (typeof part === 'string')
          return part
        if (part && typeof part === 'object' && 'text' in part)
          return String(part.text ?? '')
        return ''
      }).join('')
    }
    return ''
  }

  async function backgroundIndexAll() {
    const userId = getCurrentUserId()
    const cardId = activeCardId.value
    if (!userId || !cardId)
      return

    const chatSessionStore = useChatSessionStore()
    const activeSessionId = cardId
      ? (chatSessionStore.getCharacterIndex(cardId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    // 1. LTMM
    const ltmm = entries.value.filter(e => e.characterId === cardId && (e.universeId || 'global') === currentUniverseId).map(e => ({
      id: e.id,
      characterId: cardId,
      fact: e.content,
      kind: 'ltmm_entry',
      timestamp: new Date(e.createdAt).toISOString(),
      source: e.source,
      embedding: e.embedding,
    }))

    // 2. STMM
    let stmm: any[] = []
    try {
      const stmmRaw = await shortTermMemoryRepo.getAll(userId) ?? []
      stmm = stmmRaw.filter(b => b.characterId === cardId && (b.universeId || 'global') === currentUniverseId).map(b => ({
        id: b.id,
        characterId: cardId,
        fact: b.summary,
        kind: 'stmm_block',
        timestamp: b.date,
        source: b.source || 'stmm',
      }))
    }
    catch (err) {
      console.error('[TextJournal:Index] Failed to load STMM for indexing:', err)
    }

    // 3. Raw (Deduplicated entire corpus of all sessions)
    const raw: any[] = []
    try {
      const index = await chatSessionsRepo.getIndex(userId)
      if (index && index.characters[cardId]) {
        const characterSessions = index.characters[cardId]
        const sessions = Object.values(characterSessions.sessions)
          .filter(s => (s.universeId || 'global') === currentUniverseId)

        const uniqueRaw = new Map<string, any>()

        for (const s of sessions) {
          const session = await chatSessionsRepo.getSession(s.sessionId)
          if (session) {
            for (const m of session.messages) {
              if (m.role === 'user' || m.role === 'assistant') {
                const text = extractTextContent(m.content).trim()
                if (text.length > 10) {
                  if (!uniqueRaw.has(text)) {
                    uniqueRaw.set(text, {
                      id: m.id,
                      characterId: cardId,
                      fact: text,
                      kind: 'raw_turn',
                      timestamp: new Date(m.createdAt || Date.now()).toISOString(),
                      source: `chat:${s.sessionId}`,
                    })
                  }
                }
              }
            }
          }
        }
        raw.push(...uniqueRaw.values())
      }
    }
    catch (err) {
      console.error('[TextJournal:Index] Failed to load Chat Sessions for indexing:', err)
    }

    // 4. Echo Chips (Dreamstate)
    let echoes: any[] = []
    try {
      const echoRaw = await echoChipsRepo.getAll(userId) ?? []
      echoes = echoRaw.filter(c => c.characterId === cardId && (c.universeId || 'global') === currentUniverseId).map(c => ({
        id: c.id,
        characterId: cardId,
        fact: c.content,
        kind: 'echo_chip',
        timestamp: new Date(c.createdAt || Date.now()).toISOString(),
        source: `echo:${c.type}`,
      }))
    }
    catch (err) {
      console.error('[TextJournal:Index] Failed to load Echo Chips for indexing:', err)
    }

    // 5. Lifetime Memory (Eternal Thread)
    const lifetime: any[] = []
    try {
      const lifetimeRaw = await lifetimeMemoryRepo.getByCharacter(cardId, currentUniverseId)
      if (lifetimeRaw) {
        lifetime.push({
          id: lifetimeRaw.id,
          characterId: cardId,
          fact: lifetimeRaw.distilledContent,
          kind: 'lifetime_entry',
          timestamp: new Date(lifetimeRaw.updatedAt || Date.now()).toISOString(),
          source: 'lifetime',
        })
      }
    }
    catch (err) {
      console.error('[TextJournal:Index] Failed to load Lifetime Memory for indexing:', err)
    }

    console.info(`[TextJournal:Index] Indexing counts for ${cardId} in universe ${currentUniverseId}: LTMM=${ltmm.length}, STMM=${stmm.length}, Raw=${raw.length}, Echoes=${echoes.length}, Lifetime=${lifetime.length}`)

    await layeredMemory.indexDocuments([...ltmm, ...stmm, ...raw, ...echoes, ...lifetime])
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
    universeId?: string
    sessionId?: string
  }) {
    try {
      await load()
    }
    catch (err) {
      throw new Error(`text_journal: failed to load entries before creating: ${err instanceof Error ? err.message : String(err)}`)
    }

    const targetCard = input.characterId
      ? cards.value.get(input.characterId)
      : activeCard.value

    if (!targetCard)
      throw new Error('No active character is available for text_journal.create.')

    const currentUserId = getCurrentUserId()
    const now = Date.now()
    const chatSessionStore = useChatSessionStore()
    const targetCharacterId = input.characterId ?? activeCardId.value ?? ''
    const activeSessionId = input.sessionId !== undefined
      ? input.sessionId
      : (targetCharacterId
          ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
          : chatSessionStore.activeSessionId)
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)

    const resolvedUniverseId = input.universeId !== undefined ? input.universeId : (activeSessionMeta?.universeId || 'global')
    const resolvedSessionId = input.sessionId !== undefined ? input.sessionId : activeSessionId

    const nextEntry: TextJournalEntry = {
      id: nanoid(),
      userId: currentUserId,
      characterId: input.characterId ?? activeCardId.value ?? '',
      characterName: targetCard.name,
      title: (input.title?.trim() || 'Journal Entry'),
      content: input.content.trim(),
      source: input.source ?? 'tool',
      universeId: resolvedUniverseId,
      sessionId: resolvedSessionId,

      // FSRS
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      last_review: now,

      createdAt: now,
      updatedAt: now,
    }

    if (!nextEntry.characterId)
      throw new Error('Active character could not be resolved for text journal entry creation.')

    // NOTICE: Deduplicate rapid duplicate createEntry calls (e.g. native tool call + fallback marker bridge double-firing)
    const recentDuplicate = entries.value.find(e =>
      e.characterId === nextEntry.characterId
      && e.title === nextEntry.title
      && e.content === nextEntry.content
      && Math.abs(now - (e.createdAt || 0)) <= 5000,
    )
    if (recentDuplicate) {
      console.warn('[TextJournal] Deduplicated rapid duplicate createEntry call:', nextEntry.title)
      return recentDuplicate
    }

    // Hook: If journal intrusion is enabled, stage the pending journal entry via BroadcastChannel + local call
    const injectJournalContext = targetCard.extensions?.airi?.textJournal?.injectJournalContext
    console.warn('[TextJournal Debug] injectJournalContext value:', injectJournalContext)
    if (injectJournalContext) {
      const stagingData = {
        entryText: nextEntry.content,
        timestamp: nextEntry.createdAt,
      }
      // Stage locally (works if createEntry runs in the same window as performSend, e.g. in-band tool call)
      stageJournalIntrusion(stagingData)
      // Broadcast to all windows (works if createEntry runs in a different window, e.g. out-of-band journal moment)
      postIntrusionStaging({ type: 'journal' as const, data: stagingData })
      console.warn('[TextJournal Debug] Staged pendingJournalMoment via local + broadcast:', nextEntry.content.substring(0, 50))
    }

    const nextEntries = [nextEntry, ...entries.value]
    try {
      await persist(nextEntries)

      // Emit event to Event Ledger
      const eventLogStore = useEventLogStore()
      void eventLogStore.appendEvent({
        category: 'memory',
        type: 'text_journal',
        source: nextEntry.characterName || 'AIRI',
        textSummary: `Saved text journal entry: "${nextEntry.title}"`,
        payload: {
          id: nextEntry.id,
          title: nextEntry.title,
          source: nextEntry.source,
          characterId: nextEntry.characterId,
        },
        inspectable: true,
      })
    }
    catch (err) {
      throw new Error(`text_journal: failed to persist new entry "${nextEntry.title}": ${err instanceof Error ? err.message : String(err)}`)
    }
    return nextEntry
  }

  async function seedActiveCharacterEntry() {
    const targetCard = activeCard.value
    if (!targetCard)
      throw new Error('No active character is available to seed the text journal.')

    return await createEntry({
      title: 'Seeded Journal Entry',
      source: 'seed',
      content: [
        `This is a seeded long-term journal entry for ${targetCard.name}.`,
        'It exists to verify that text_journal.create is wired, persisted, and scoped to the active character.',
      ].join('\n\n'),
    })
  }

  async function searchEntries(input: {
    query: string
    limit?: number
    characterId?: string
  }) {
    try {
      await load()
    }
    catch (err) {
      throw new Error(`text_journal: failed to load entries before searching: ${err instanceof Error ? err.message : String(err)}`)
    }

    const query = input.query.trim()
    if (!query)
      return []

    const targetCharacterId = input.characterId ?? activeCardId.value
    const results = await layeredMemory.search(query, input.limit ?? 3, targetCharacterId)

    // Log search results for developer review
    console.log(`[TextJournal:Search] Query: "${query}" | Results:`, results)

    // For now, map layered results back to the most relevant TextJournalEntry if it exists,
    // or provide surrogate entries for STMM/Raw.
    return results.map((res) => {
      const existing = entries.value.find(e => e.id === res.id)
      if (existing) {
        return {
          ...existing,
          kind: res.kind,
        }
      }

      // Surrogate entry for STMM/Raw context
      return {
        id: res.id,
        userId: getCurrentUserId(),
        characterId: input.characterId ?? activeCardId.value ?? '',
        characterName: activeCard.value?.name ?? 'Unknown',
        title: `[${res.kind.toUpperCase()}] Memory`,
        content: res.content,
        kind: res.kind,
        source: res.source ?? 'tool',
        type: 'message',
        createdAt: new Date(res.timestamp).getTime(),
        updatedAt: new Date(res.timestamp).getTime(),
      } as TextJournalEntry & { kind: string }
    })
  }

  watch(incomingStreamEvent, (event) => {
    if (!event)
      return
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
    promptTemplate?: string
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
    const cardStore = useAiriCardStore()
    const { activeCard, activeCardId } = storeToRefs(cardStore)

    if (!activeCard.value || !activeCardId.value) {
      console.error('[JournalMoment] No active character found.')
      throw new Error('No active character')
    }

    const chatProvider = await providersStore.getProviderInstance(input.providerId) as any
    if (!chatProvider) {
      console.error(`[JournalMoment] Provider not found: ${input.providerId}`)
      throw new Error(`Provider not found: ${input.providerId}`)
    }

    // Resolve system prompt and context snapshot
    const chatContext = (await import('./chat/context-store')).useChatContextStore()
    const proactivityStore = (await import('./proactivity')).useProactivityStore()
    const { buildSystemPrompt } = await import('./modules/airi-card')

    const baseSystemPrompt = buildSystemPrompt(activeCard.value)

    // Environmental/Grounding context
    const contextsSnapshot = chatContext.getContextsSnapshot()
    const groundingEnabled = activeCard.value?.extensions?.airi?.groundingEnabled
    const sensorPayload = groundingEnabled ? proactivityStore.sensorPayload : ''

    let contextContent = ''
    if (Object.keys(contextsSnapshot).length > 0) {
      contextContent += 'These are the contextual information retrieved or on-demand updated from other modules:\n'
        + `${Object.entries(contextsSnapshot).map(([key, value]) => `Module ${key}: ${JSON.stringify(value)}`).join('\n')}\n`
    }

    if (sensorPayload) {
      contextContent += `${contextContent ? '\n---\n' : ''
      }[ENVIRONMENTAL AWARENESS]\n`
      + `The following telemetry describes your current environmental context. `
      + `Use it to stay grounded in the user's reality and inform your response. `
      + `You may reference specific values (like time or active applications) if relevant `
      + `to the conversation, but avoid a dry, technical recitation of the data.\n`
      + `---\n`
      + `${sensorPayload}\n`
    }

    // Build the system messages list
    const systemMessages: any[] = []
    if (baseSystemPrompt) {
      systemMessages.push({ role: 'system', content: baseSystemPrompt })
    }
    if (contextContent.trim()) {
      systemMessages.push({ role: 'system', content: contextContent.trim() })
    }

    // Format chat history turns accurately preserving raw tokens (RawContent)
    const formattedHistory = input.messages.map((m) => {
      let content = m.role === 'assistant' ? (m.rawContent || m.content) : m.content
      if (Array.isArray(content)) {
        content = content.map((part: any) => {
          if (typeof part === 'string')
            return part
          if (part && typeof part === 'object') {
            if ('text' in part)
              return String(part.text ?? '')
            if ('input' in part)
              return String(part.input ?? '')
            if ('output' in part)
              return String(part.output ?? '')
          }
          return ''
        }).join('')
      }
      return {
        role: m.role,
        content: String(content || ''),
      }
    })

    let instructionSuffix = ''
    if (input.promptTemplate) {
      const additionalIns = input.instructions ? `\nAdditional Instructions: ${input.instructions}\n` : ''
      instructionSuffix = input.promptTemplate
        .replaceAll('{characterName}', activeCard.value.name)
        .replaceAll('{instructions}', additionalIns)
    }
    else {
      instructionSuffix = `You are a cognitive memory system. Write a journal entry about the preceding conversation history in the first person as ${activeCard.value.name}. Reflect on the highlights, jokes, and relationship dynamics.
${input.instructions ? `\nAdditional Instructions: ${input.instructions}\n` : ''}`
    }

    // Always append the fixed JSON schema rules at the end to ensure syntax stability
    instructionSuffix += `\n\nReturn a JSON object with 'title' and 'content' for your journal entry. Ensure you strictly output in this JSON schema format:
{
  "title": "A short, narrative title for the journal entry",
  "content": "The actual journal entry content written in ${activeCard.value.name}'s natural voice."
}`

    const inputMessages = [
      ...systemMessages,
      ...formattedHistory,
      { role: 'user', content: instructionSuffix },
    ]

    console.log('[JournalMoment] Calling LLM generateObject with cache-aligned context...', {
      messagesCount: inputMessages.length,
    })
    try {
      const res = await llmStore.generateObject<{ title: string, content: string }>(
        input.modelId,
        chatProvider,
        {
          messages: inputMessages,
          schema: v.object({
            title: v.string(),
            content: v.string(),
          }),
        },
      )
      const object = res as unknown as { title: string, content: string }
      console.log('[JournalMoment] LLM returned object:', object)

      return await createEntry({
        title: object.title,
        content: object.content,
        characterId: activeCardId.value,
        source: 'user', // Manual trigger
      })
    }
    catch (err) {
      console.error('[JournalMoment] LLM or createEntry failed:', err)
      throw err
    }
  }

  return {
    entries: sortedEntries,
    loading,
    load,
    createEntry,
    seedActiveCharacterEntry,
    searchEntries,
    backgroundIndexAll,
    persist,
    createJournalMoment,
  }
})
