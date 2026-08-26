import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { Message } from '@xsai/shared-chat'

import type { ChatHistoryItem } from '../types/chat'
import type { ChatSessionsIndex } from '../types/chat-session'
import type { ShortTermMemoryBlock } from '../types/short-term-memory'
import type { AiriCard } from './modules/airi-card'

import { estimateTokens } from '@proj-airi/stage-shared'
import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { chatSessionsRepo } from '../database/repos/chat-sessions.repo'
import { shortTermMemoryRepo } from '../database/repos/short-term-memory.repo'
import { useAuthStore } from './auth'
import { useChatSessionStore } from './chat/session-store'
import { useLLM } from './llm'
import { useAiriCardStore } from './modules/airi-card'
import { useConsciousnessStore } from './modules/consciousness'
import { useLiveSessionStore } from './modules/live-session'
import { useProvidersStore } from './providers'

interface RebuildResult {
  created: number
  updated: number
  skipped: number
}

interface DayBucket {
  date: string
  lines: string[]
  messageCount: number
  sessionIds: Set<string>
}

const MAX_SOURCE_CHARS_PER_DAY = 24000

function normalizeBlock(block: ShortTermMemoryBlock): ShortTermMemoryBlock {
  return {
    id: String(block.id),
    userId: String(block.userId),
    characterId: String(block.characterId),
    characterName: String(block.characterName),
    date: String(block.date),
    source: block.source === 'automatic' ? 'automatic' : 'rebuilt',
    summary: String(block.summary ?? ''),
    estimatedTokens: Number.isFinite(block.estimatedTokens) ? Number(block.estimatedTokens) : estimateTokens(String(block.summary ?? '')),
    messageCount: Number.isFinite(block.messageCount) ? Number(block.messageCount) : 0,
    sessionCount: Number.isFinite(block.sessionCount) ? Number(block.sessionCount) : 0,
    createdAt: Number.isFinite(block.createdAt) ? Number(block.createdAt) : Date.now(),
    updatedAt: Number.isFinite(block.updatedAt) ? Number(block.updatedAt) : Date.now(),
    universeId: block.universeId,
    sessionId: block.sessionId,
  }
}

function normalizeBlocks(blocks: ShortTermMemoryBlock[]) {
  return blocks.map(normalizeBlock)
}

function formatLocalDayKey(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function extractMessageText(message: ChatHistoryItem) {
  if (typeof message.content === 'string')
    return message.content.trim()

  if (Array.isArray(message.content)) {
    return message.content.map((part) => {
      if (typeof part === 'string')
        return part
      if (part && typeof part === 'object' && 'text' in part)
        return String(part.text ?? '')
      return ''
    }).join('').trim()
  }

  return ''
}

function buildCharacterSummaryContext(card: AiriCard) {
  const sections = [
    `Name: ${card.name}`,
    card.nickname?.trim() ? `Nickname: ${card.nickname.trim()}` : '',
    card.description?.trim() ? `Description: ${card.description.trim()}` : '',
    card.systemPrompt?.trim() ? `System Prompt:\n${card.systemPrompt.trim()}` : '',
    card.postHistoryInstructions?.trim() ? `Summary / Memory Instructions:\n${card.postHistoryInstructions.trim()}` : '',
  ].filter(Boolean)

  return sections.join('\n\n')
}

function buildSummarizerMessages(
  card: AiriCard,
  date: string,
  transcript: string,
  targetTokensPerDay: number,
): Message[] {
  return [
    {
      role: 'system',
      content: [
        'You summarize one local-calendar day of chat history into a compact short-term memory block for future session continuity.',
        'Write concise markdown only.',
        'Use the same main language(s) as the chat history for the summary.',
        'Focus on salient events, emotional tone shifts, promises or plans, preferences, facts worth remembering, and unresolved threads.',
        'Do not roleplay. Do not embellish. Do not invent facts. Do not quote large chunks of dialogue.',
        `Aim for roughly ${targetTokensPerDay} tokens or less unless the day is unusually dense.`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Character context:\n${buildCharacterSummaryContext(card)}`,
        `Date: ${date}`,
        'Transcript:',
        transcript,
        'Produce a single dense markdown summary block that future sessions can load as hidden continuity context.',
      ].join('\n\n'),
    },
  ]
}

function getYesterdayLocalDayKey() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return formatLocalDayKey(yesterday.getTime())
}

export const useShortTermMemoryStore = defineStore('short-term-memory', () => {
  const { userId } = storeToRefs(useAuthStore())
  const { cards, activeCardId } = storeToRefs(useAiriCardStore())
  const { activeProvider, activeModel } = storeToRefs(useConsciousnessStore())
  const providersStore = useProvidersStore()
  const llmStore = useLLM()

  const blocks = ref<ShortTermMemoryBlock[]>([])
  const loading = ref(false)
  const rebuilding = ref(false)
  const rebuildProgress = ref('')
  const error = ref<string | null>(null)
  const initializedForUserId = ref<string | null>(null)

  const sortedBlocks = computed(() => {
    const chatSessionStore = useChatSessionStore()
    const targetCharacterId = activeCardId.value
    const activeSessionId = targetCharacterId
      ? (chatSessionStore.getCharacterIndex(targetCharacterId)?.activeSessionId || chatSessionStore.activeSessionId)
      : chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = activeSessionMeta?.universeId || 'global'

    return [...blocks.value]
      .filter(b => (b.universeId || 'global') === currentUniverseId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)
  })

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  function getCharacterBlocks(characterId: string) {
    return sortedBlocks.value.filter(block => block.characterId === characterId)
  }

  function searchBlocks(input: {
    query: string
    limit?: number
    characterId?: string
  }) {
    const normalizedQuery = input.query.trim().toLowerCase()
    if (!normalizedQuery)
      return []

    const targetCharacterId = input.characterId ?? activeCardId.value ?? ''
    const scopedBlocks = sortedBlocks.value.filter(block => !targetCharacterId || block.characterId === targetCharacterId)

    return scopedBlocks
      .map((block) => {
        const summary = block.summary.toLowerCase()
        const characterName = block.characterName.toLowerCase()
        const date = block.date.toLowerCase()

        let score = 0
        if (summary.includes(normalizedQuery))
          score += 3
        if (characterName.includes(normalizedQuery))
          score += 1
        if (date.includes(normalizedQuery))
          score += 1

        return {
          block,
          score,
        }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.block.date.localeCompare(a.block.date) || b.block.updatedAt - a.block.updatedAt)
      .slice(0, Math.max(1, Math.min(input.limit ?? 5, 10)))
      .map(item => item.block)
  }

  const { data: stmSyncSignal, post: broadcastStmSync } = useBroadcastChannel({ name: 'airi:short-term-memory-sync' })

  watch(stmSyncSignal, (val) => {
    if (val) {
      console.log('[ShortTermMemory] Received short-term memory sync signal, reloading...')
      void load(true, true)
    }
  })

  async function load(force = false, silent = false) {
    const currentUserId = getCurrentUserId()
    if ((!force && initializedForUserId.value === currentUserId) || loading.value)
      return

    if (!silent)
      loading.value = true
    error.value = null

    try {
      blocks.value = normalizeBlocks(await shortTermMemoryRepo.getAll(currentUserId) ?? [])
      initializedForUserId.value = currentUserId
    }
    catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : String(loadError)
      throw loadError
    }
    finally {
      if (!silent)
        loading.value = false
    }
  }

  async function persist(nextBlocks: ShortTermMemoryBlock[]) {
    const currentUserId = getCurrentUserId()
    const snapshot = normalizeBlocks(JSON.parse(JSON.stringify(nextBlocks)) as ShortTermMemoryBlock[])

    try {
      await shortTermMemoryRepo.saveAll(currentUserId, snapshot)
      blocks.value = snapshot
      initializedForUserId.value = currentUserId
      broadcastStmSync(Date.now())
    }
    catch (persistError) {
      console.error('[ShortTermMemory] Failed to persist short-term blocks.', {
        userId: currentUserId,
        blockCount: snapshot.length,
        firstBlock: snapshot[0],
        lastBlock: snapshot.at(-1),
        error: persistError,
      })
      throw persistError
    }
  }

  async function collectCharacterDayBuckets(characterId: string, universeId = 'global') {
    const currentUserId = getCurrentUserId()
    const index = await chatSessionsRepo.getIndex(currentUserId) as ChatSessionsIndex | null
    const characterIndex = index?.characters?.[characterId]
    if (!characterIndex)
      return []

    const buckets = new Map<string, DayBucket>()
    const sessionIds = Object.keys(characterIndex.sessions)

    for (const sessionId of sessionIds) {
      const meta = characterIndex.sessions[sessionId]
      if ((meta.universeId || 'global') !== universeId)
        continue

      const record = await chatSessionsRepo.getSession(sessionId)
      if (!record)
        continue

      for (const message of record.messages) {
        if ((message.role !== 'user' && message.role !== 'assistant') || !message.createdAt)
          continue

        const content = extractMessageText(message)
        if (!content)
          continue

        const card = cards.value.get(characterId)
        const roleLabel = message.role === 'user' ? 'User' : card?.name || 'Assistant'
        const date = formatLocalDayKey(message.createdAt)
        const bucket = buckets.get(date) ?? {
          date,
          lines: [],
          messageCount: 0,
          sessionIds: new Set<string>(),
        }

        bucket.lines.push(`${roleLabel}: ${content}`)
        bucket.messageCount += 1
        bucket.sessionIds.add(sessionId)
        buckets.set(date, bucket)
      }
    }

    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  async function summarizeBucket(
    characterId: string,
    card: AiriCard,
    provider: ChatProvider,
    modelId: string,
    bucket: DayBucket,
    source: ShortTermMemoryBlock['source'],
    options?: { tokenBudgetPerDay?: number, universeId?: string, sessionId?: string },
  ) {
    const transcript = bucket.lines.join('\n').slice(0, MAX_SOURCE_CHARS_PER_DAY)
    if (!transcript.trim())
      return null

    const budget = options?.tokenBudgetPerDay ?? card?.extensions?.airi?.shortTermMemory?.tokenBudgetPerDay ?? 1000
    const response = await llmStore.generate(modelId, provider, buildSummarizerMessages(
      card,
      bucket.date,
      transcript,
      budget,
    ))
    useLiveSessionStore().recordInferenceUsage(response.usage)

    const summary = (response.text || '').trim()
    if (!summary)
      return null

    const currentUserId = getCurrentUserId()
    const chatSessionStore = useChatSessionStore()
    const activeSessionId = options?.sessionId !== undefined
      ? options.sessionId
      : (characterId
          ? (chatSessionStore.getCharacterIndex(characterId)?.activeSessionId || chatSessionStore.activeSessionId)
          : chatSessionStore.activeSessionId)
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)

    const resolvedUniverseId = options?.universeId !== undefined ? options.universeId : (activeSessionMeta?.universeId || 'global')
    const resolvedSessionId = options?.sessionId !== undefined ? options.sessionId : activeSessionId

    const existingBlock = blocks.value.find(block => block.userId === currentUserId && block.characterId === characterId && block.date === bucket.date && (block.universeId || 'global') === resolvedUniverseId)
    const now = Date.now()

    return {
      id: existingBlock?.id ?? nanoid(),
      userId: currentUserId,
      characterId,
      characterName: card.name,
      date: bucket.date,
      source,
      summary,
      estimatedTokens: estimateTokens(summary),
      messageCount: bucket.messageCount,
      sessionCount: bucket.sessionIds.size,
      createdAt: existingBlock?.createdAt ?? now,
      updatedAt: now,
      universeId: resolvedUniverseId,
      sessionId: resolvedSessionId,
    } satisfies ShortTermMemoryBlock
  }

  async function rebuildFromHistory(characterId: string, options?: { tokenBudgetPerDay?: number, universeId?: string }) {
    await load()

    const card = cards.value.get(characterId)
    if (!card)
      throw new Error('Selected character could not be resolved for short-term rebuild.')

    const providerId = card.extensions?.airi?.modules?.consciousness?.provider || activeProvider.value
    const modelId = card.extensions?.airi?.modules?.consciousness?.model || activeModel.value
    if (!providerId || !modelId)
      throw new Error('No chat provider/model is available for short-term rebuild.')

    const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
    if (!provider)
      throw new Error(`Failed to resolve provider instance for "${providerId}".`)

    rebuilding.value = true
    error.value = null
    rebuildProgress.value = 'Loading chat history...'

    const chatSessionStore = useChatSessionStore()
    const activeSessionId = chatSessionStore.getCharacterIndex(characterId)?.activeSessionId || chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = options?.universeId !== undefined ? options.universeId : (activeSessionMeta?.universeId || 'global')

    try {
      const currentUserId = getCurrentUserId()
      const days = await collectCharacterDayBuckets(characterId, currentUniverseId)

      if (days.length === 0)
        return { created: 0, updated: 0, skipped: 0 } satisfies RebuildResult

      const nextBlocks = [...blocks.value]
      let created = 0
      let updated = 0
      let skipped = 0

      for (const [index, bucket] of days.entries()) {
        rebuildProgress.value = `Summarizing ${bucket.date} (${index + 1} / ${days.length})...`

        // NOTICE: rebuild is deliberately capped per day to prevent one pathological chat day
        // from exploding prompt size and stalling the whole recovery pass.
        const nextBlock = await summarizeBucket(characterId, card, provider, modelId, bucket, 'rebuilt', { ...options, universeId: currentUniverseId })
        if (!nextBlock) {
          skipped += 1
          continue
        }

        const existingIndex = nextBlocks.findIndex(block => block.userId === currentUserId && block.characterId === characterId && block.date === bucket.date && (block.universeId || 'global') === currentUniverseId)

        if (existingIndex >= 0) {
          nextBlocks.splice(existingIndex, 1, nextBlock)
          updated += 1
        }
        else {
          nextBlocks.push(nextBlock)
          created += 1
        }

        // NOTICE: persist each completed block immediately so long rebuilds don't lose all
        // progress if a later day or IndexedDB write fails.
        await persist(nextBlocks)
      }
      return { created, updated, skipped } satisfies RebuildResult
    }
    catch (rebuildError) {
      error.value = rebuildError instanceof Error ? rebuildError.message : String(rebuildError)
      throw rebuildError
    }
    finally {
      rebuilding.value = false
      rebuildProgress.value = ''
    }
  }

  async function rebuildToday(characterId: string, options?: { tokenBudgetPerDay?: number, universeId?: string }): Promise<boolean> {
    await load()

    const card = cards.value.get(characterId)
    if (!card)
      throw new Error('Selected character could not be resolved for rebuild today.')

    const providerId = card.extensions?.airi?.modules?.consciousness?.provider || activeProvider.value
    const modelId = card.extensions?.airi?.modules?.consciousness?.model || activeModel.value
    if (!providerId || !modelId)
      throw new Error('No chat provider/model is available for rebuild today.')

    const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
    if (!provider)
      throw new Error(`Failed to resolve provider instance for "${providerId}".`)

    rebuilding.value = true
    error.value = null
    const targetDate = formatLocalDayKey(Date.now())
    rebuildProgress.value = `Summarizing today (${targetDate})...`

    const chatSessionStore = useChatSessionStore()
    const activeSessionId = chatSessionStore.getCharacterIndex(characterId)?.activeSessionId || chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = options?.universeId !== undefined ? options.universeId : (activeSessionMeta?.universeId || 'global')

    try {
      const dayBucket = (await collectCharacterDayBuckets(characterId, currentUniverseId)).find(bucket => bucket.date === targetDate)
      if (!dayBucket) {
        throw new Error(`No messages found for today (${targetDate}) to summarize.`)
      }

      const nextBlock = await summarizeBucket(characterId, card, provider, modelId, dayBucket, 'rebuilt', { ...options, universeId: currentUniverseId })
      if (!nextBlock)
        return false

      const currentUserId = getCurrentUserId()
      const nextBlocks = [...blocks.value]
      const existingIndex = nextBlocks.findIndex(block => block.userId === currentUserId && block.characterId === characterId && block.date === targetDate && (block.universeId || 'global') === currentUniverseId)

      if (existingIndex >= 0) {
        nextBlocks.splice(existingIndex, 1, nextBlock)
      }
      else {
        nextBlocks.push(nextBlock)
      }

      await persist(nextBlocks)
      return true
    }
    catch (rebuildError) {
      error.value = rebuildError instanceof Error ? rebuildError.message : String(rebuildError)
      throw rebuildError
    }
    finally {
      rebuilding.value = false
      rebuildProgress.value = ''
    }
  }

  const runningEnsure = new Map<string, Promise<boolean>>()

  async function ensureYesterdayBlock(characterId: string, options?: { tokenBudgetPerDay?: number, universeId?: string }) {
    const chatSessionStore = useChatSessionStore()
    const activeSessionId = chatSessionStore.getCharacterIndex(characterId)?.activeSessionId || chatSessionStore.activeSessionId
    const activeSessionMeta = chatSessionStore.getSessionMeta(activeSessionId)
    const currentUniverseId = options?.universeId !== undefined ? options.universeId : (activeSessionMeta?.universeId || 'global')

    const key = `${characterId}:${currentUniverseId}`
    if (runningEnsure.has(key)) {
      return runningEnsure.get(key)!
    }

    const promise = (async () => {
      await load()

      const card = cards.value.get(characterId)
      if (!card)
        return false

      const targetDate = getYesterdayLocalDayKey()
      const existingBlock = blocks.value.find(block => block.characterId === characterId && block.date === targetDate && (block.universeId || 'global') === currentUniverseId)
      if (existingBlock)
        return false

      const providerId = card.extensions?.airi?.modules?.consciousness?.provider || activeProvider.value
      const modelId = card.extensions?.airi?.modules?.consciousness?.model || activeModel.value
      if (!providerId || !modelId)
        return false

      const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
      if (!provider)
        return false

      const dayBucket = (await collectCharacterDayBuckets(characterId, currentUniverseId)).find(bucket => bucket.date === targetDate)
      if (!dayBucket)
        return false

      const nextBlock = await summarizeBucket(characterId, card, provider, modelId, dayBucket, 'automatic', { ...options, universeId: currentUniverseId })
      if (!nextBlock)
        return false

      await persist([...blocks.value, nextBlock])
      return true
    })()

    runningEnsure.set(key, promise)
    try {
      return await promise
    }
    finally {
      runningEnsure.delete(key)
    }
  }

  return {
    activeCardId,
    blocks: sortedBlocks,
    loading,
    rebuilding,
    rebuildProgress,
    error,
    load,
    getCharacterBlocks,
    searchBlocks,
    rebuildFromHistory,
    rebuildToday,
    ensureYesterdayBlock,
    summarizeBucket,
    persist,
  }
})
