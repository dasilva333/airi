import type { ChatHistoryItem, ChatStreamEvent } from '../../types/chat'
import type { ChatSessionMeta, ChatSessionRecord, ChatSessionsExport, ChatSessionsIndex } from '../../types/chat-session'

import { useBroadcastChannel, watchDebounced } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { client } from '../../composables/api'
import { stripMarkers } from '../../composables/response-categoriser'
import { useLocalFirstRequest } from '../../composables/use-local-first'
import { chatSessionsRepo } from '../../database/repos/chat-sessions.repo'
import { useAuthStore } from '../auth'
import { useMemoryLifetimeStore } from '../memory-lifetime'
import { useShortTermMemoryStore } from '../memory-short-term'
import { useAiriCardStore } from '../modules/airi-card'
import { useSettingsGeneral } from '../settings'
import { CHAT_STREAM_CHANNEL_NAME } from './constants'
import { mergeLoadedSessionMessages } from './session-message-merge'

export const useChatSessionStore = defineStore('chat-session', () => {
  const { userId, isAuthenticated } = storeToRefs(useAuthStore())
  const { activeCardId, systemPrompt } = storeToRefs(useAiriCardStore())
  const { remoteSyncEnabled } = storeToRefs(useSettingsGeneral())
  const shortTermMemory = useShortTermMemoryStore()
  const lifetimeMemory = useMemoryLifetimeStore()

  // NOTICE: This BroadcastChannel reuses the same channel as context-bridge to notify
  // other windows (e.g. chatbox) that session data changed and they should reload from DB.
  const { post: broadcastStreamEvent, data: incomingSessionUpdate } = useBroadcastChannel<ChatStreamEvent, ChatStreamEvent>({ name: CHAT_STREAM_CHANNEL_NAME })

  const activeSessionId = ref<string>('')
  const sessionMessages = ref<Record<string, ChatHistoryItem[]>>({})
  const sessionMetas = ref<Record<string, ChatSessionMeta>>({})
  const sessionGenerations = ref<Record<string, number>>({})
  const index = ref<ChatSessionsIndex | null>(null)

  const ready = ref(false)
  const isReady = computed(() => ready.value)
  const initializing = ref(false)
  let initializePromise: Promise<void> | null = null

  let persistQueue = Promise.resolve()
  let syncQueue = Promise.resolve()
  const loadedSessions = new Set<string>()
  const loadingSessions = new Map<string, Promise<void>>()
  let ensuringSessionPromise: Promise<void> | null = null

  // I know this nu uh, better than loading all language on rehypeShiki
  const codeBlockSystemPrompt = '- For any programming code block, always specify the programming language that supported on @shikijs/rehype on the rendered markdown, eg. ```python ... ```\n'
  const mathSyntaxSystemPrompt = '- For any math equation, use LaTeX format, eg: $ x^3 $, always escape dollar sign outside math equation\n'
  const shortTermMemoryBlockLimit = 3

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  function getCurrentCharacterId() {
    return activeCardId.value || 'default'
  }

  function enqueuePersist(task: () => Promise<void>) {
    persistQueue = persistQueue.then(task, task)
    return persistQueue
  }

  function enqueueSync(task: () => Promise<void>) {
    syncQueue = syncQueue.then(task, task)
    return syncQueue
  }

  function snapshotMessages(messages: ChatHistoryItem[]) {
    return JSON.parse(JSON.stringify(messages)) as ChatHistoryItem[]
  }

  function extractMessageContent(message: ChatHistoryItem) {
    if (typeof message.content === 'string')
      return message.content
    if (Array.isArray(message.content)) {
      return message.content.map((part) => {
        if (typeof part === 'string')
          return part
        if (part && typeof part === 'object' && 'text' in part)
          return String(part.text ?? '')
        return ''
      }).join('')
    }
    return ''
  }

  function ensureSessionMessageIds(sessionId: string) {
    const current = sessionMessages.value[sessionId] ?? []
    let changed = false
    const next = current.map((message) => {
      if (message.id)
        return message
      changed = true
      return {
        ...message,
        id: nanoid(),
      }
    })

    if (changed) {
      sessionMessages.value[sessionId] = next
      // NOTICE: We do NOT persist here to avoid infinite loops,
      // but we return the modified array.
    }
    return next
  }

  function buildSyncMessages(messages: ChatHistoryItem[]) {
    return messages.map(message => ({
      id: message.id ?? nanoid(),
      role: message.role,
      // NOTICE: Strip orchestration tokens before syncing to remote server.
      // The local DB retains rawContent for LLM inference, but remote consumers
      // should only see clean, display-friendly content.
      content: stripMarkers(extractMessageContent(message)),
      createdAt: message.createdAt,
    }))
  }

  async function syncSessionToRemote(sessionId: string) {
    let cachedRecord: ChatSessionRecord | null | undefined
    const request = useLocalFirstRequest({
      local: async () => {
        cachedRecord = await chatSessionsRepo.getSession(sessionId)
        return cachedRecord
      },
      remote: async () => {
        if (!cachedRecord)
          cachedRecord = await chatSessionsRepo.getSession(sessionId)
        if (!cachedRecord)
          return cachedRecord

        const members: Array<
          | { type: 'user', userId: string }
          | { type: 'character', characterId: string }
        > = [
          { type: 'user', userId: userId.value },
        ]

        if (cachedRecord.meta.characterId && cachedRecord.meta.characterId !== 'default') {
          members.push({
            type: 'character',
            characterId: cachedRecord.meta.characterId,
          })
        }

        const normalizedMessages = cachedRecord.messages.map(message => message.id ? message : { ...message, id: nanoid() })
        if (normalizedMessages.some((message, index) => cachedRecord?.messages[index]?.id !== message.id)) {
          cachedRecord = {
            ...cachedRecord,
            messages: normalizedMessages,
          }
          await chatSessionsRepo.saveSession(sessionId, cachedRecord)
        }

        const res = await client.api.chats.sync.$post({
          json: {
            chat: {
              id: cachedRecord.meta.sessionId,
              type: 'group',
              title: cachedRecord.meta.title,
              createdAt: cachedRecord.meta.createdAt,
              updatedAt: cachedRecord.meta.updatedAt,
            },
            members,
            messages: buildSyncMessages(cachedRecord.messages),
          },
        })

        if (!res.ok)
          throw new Error('Failed to sync chat session')
        return cachedRecord
      },
      allowRemote: () => remoteSyncEnabled.value && isAuthenticated.value,
      lazy: true,
    })

    await request.execute()
  }

  function scheduleSync(sessionId: string) {
    if (!remoteSyncEnabled.value)
      return

    void enqueueSync(async () => {
      try {
        await syncSessionToRemote(sessionId)
      }
      catch (error) {
        console.warn('Failed to sync chat session', error)
      }
    })
  }

  function buildShortTermMemoryContext(characterId: string) {
    const blocks = shortTermMemory.getCharacterBlocks(characterId).slice(0, shortTermMemoryBlockLimit)
    if (blocks.length === 0)
      return ''

    return [
      '[Short-Term Memory]',
      'The following daily continuity blocks were distilled from recent chat history for this active character.',
      'Use them as hidden continuity context for the current session.',
      ...blocks.map(block => `Date: ${block.date}\n${block.summary}`),
    ].join('\n\n')
  }

  function buildLifetimeMemoryContext(characterId: string) {
    const artifact = lifetimeMemory.artifacts.get(characterId)
    const distilledContent = artifact?.distilledContent?.trim()
    if (!distilledContent)
      return ''

    return [
      '[Lifetime Artifact]',
      'The following distilled long-horizon continuity block represents the durable relationship context for this active character.',
      'Use it as hidden continuity context alongside recent short-term memory.',
      distilledContent,
    ].join('\n\n')
  }

  function generateInitialMessageFromPrompt(prompt: string, characterId = getCurrentCharacterId()) {
    const shortTermContext = buildShortTermMemoryContext(characterId)
    const lifetimeContext = buildLifetimeMemoryContext(characterId)
    const content = [
      codeBlockSystemPrompt + mathSyntaxSystemPrompt + prompt,
      shortTermContext,
      lifetimeContext,
    ].filter(Boolean).join('\n\n')

    return {
      role: 'system',
      content,
      id: nanoid(),
      createdAt: Date.now(),
    } satisfies ChatHistoryItem
  }

  function generateInitialMessage() {
    return generateInitialMessageFromPrompt(systemPrompt.value, getCurrentCharacterId())
  }

  function ensureGeneration(sessionId: string) {
    if (sessionGenerations.value[sessionId] === undefined)
      sessionGenerations.value[sessionId] = 0
  }

  async function loadIndexForUser(currentUserId: string) {
    const stored = await chatSessionsRepo.getIndex(currentUserId)
    index.value = stored ?? {
      userId: currentUserId,
      characters: {},
    }
  }

  function getCharacterIndex(characterId: string) {
    if (!index.value)
      return null
    return index.value.characters[characterId] ?? null
  }

  async function persistIndex() {
    if (!index.value)
      return
    const snapshot = JSON.parse(JSON.stringify(index.value)) as ChatSessionsIndex
    await enqueuePersist(async () => {
      await chatSessionsRepo.saveIndex(snapshot)
      broadcastStreamEvent({ type: 'index-refreshed', userId: snapshot.userId })
    })
  }

  async function persistSession(sessionId: string) {
    const meta = sessionMetas.value[sessionId]
    if (!meta)
      return
    const messages = snapshotMessages(ensureSessionMessageIds(sessionId))
    const now = Date.now()
    const updatedMeta: ChatSessionMeta = {
      ...meta,
      messageCount: messages.length,
      updatedAt: now,
    }

    sessionMetas.value[sessionId] = updatedMeta
    const characterIndex = index.value?.characters[meta.characterId]
    if (characterIndex)
      characterIndex.sessions[sessionId] = updatedMeta

    const record: ChatSessionRecord = {
      meta: updatedMeta,
      messages,
    }

    await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))
    await persistIndex()
    scheduleSync(sessionId)
  }

  function persistSessionMessages(sessionId: string) {
    void persistSession(sessionId)
  }

  async function setSessionMessages(sessionId: string, next: ChatHistoryItem[]) {
    const prev = sessionMessages.value[sessionId] ?? []
    const prevIds = new Set(prev.map(m => m.id).filter(Boolean))

    // 1. Assign IDs to all messages in the new array first
    const nextWithIds = next.map(msg => ({
      ...msg,
      id: msg.id ?? nanoid(),
    }))

    // 2. Set the store value
    sessionMessages.value[sessionId] = nextWithIds

    // 3. Broadcast ONLY truly new messages based on stable IDs
    for (const msg of nextWithIds) {
      if (msg.id && !prevIds.has(msg.id)) {
        console.log(`[ChatStore] Adding message to history (setSessionMessages):`, {
          id: msg.id,
          role: msg.role,
          createdAt: msg.createdAt,
          contentPreview: typeof msg.content === 'string' ? msg.content.slice(0, 60) : '[Complex Content]',
          source: (msg as any).metadata?.source ?? 'unknown',
          metadata: (msg as any).metadata,
        })
        broadcastStreamEvent({ type: 'session-updated', sessionId, message: JSON.parse(JSON.stringify(msg)) })
      }
    }

    // 4. Persist
    await persistSession(sessionId)

    // 5. Broadcast session-refreshed if any previous messages were removed
    const removedAny = prev.some(m => m.id && !nextWithIds.some(n => n.id === m.id))
    if (removedAny) {
      broadcastStreamEvent({ type: 'session-refreshed', sessionId })
    }
  }

  function inscribeTurn(message: ChatHistoryItem, sessionId = activeSessionId.value) {
    if (!sessionId)
      return
    const current = sessionMessages.value[sessionId] ?? []
    sessionMessages.value[sessionId] = [...current, message]
    void persistSession(sessionId)

    console.log(`[ChatStore] Inscribing turn in session ${sessionId}:`, {
      id: message.id,
      role: message.role,
      createdAt: message.createdAt,
      contentPreview: typeof message.content === 'string' ? message.content.slice(0, 60) : '[Complex Content]',
      source: (message as any).metadata?.source ?? 'unknown',
      metadata: (message as any).metadata,
    })

    // NOTICE: Broadcast the actual message payload so other windows can apply it directly
    // without waiting for the DB write to complete (avoids race condition).
    broadcastStreamEvent({ type: 'session-updated', sessionId, message: JSON.parse(JSON.stringify(message)) })
  }

  async function loadSession(sessionId: string, force = false) {
    if (!force && loadedSessions.has(sessionId))
      return
    if (loadingSessions.has(sessionId)) {
      await loadingSessions.get(sessionId)
      return
    }

    const loadPromise = (async () => {
      const stored = await chatSessionsRepo.getSession(sessionId)
      if (stored) {
        const currentMessages = sessionMessages.value[sessionId] ?? []
        const mergedMessages = force
          ? stored.messages
          : mergeLoadedSessionMessages(stored.messages, currentMessages)

        // Ensure the meta messageCount is correct and up to date
        const actualCount = mergedMessages.length
        let needsPersist = mergedMessages !== stored.messages

        if (stored.meta.messageCount !== actualCount) {
          stored.meta.messageCount = actualCount
          needsPersist = true
        }

        sessionMetas.value[sessionId] = stored.meta
        sessionMessages.value[sessionId] = mergedMessages
        ensureGeneration(sessionId)

        if (needsPersist)
          await persistSession(sessionId)
      }
      loadedSessions.add(sessionId)
    })()

    loadingSessions.set(sessionId, loadPromise)
    await loadPromise
    loadingSessions.delete(sessionId)
  }

  async function createSession(characterId: string, options?: { setActive?: boolean, messages?: ChatHistoryItem[], title?: string }) {
    const currentUserId = getCurrentUserId()
    const sessionId = nanoid()
    const now = Date.now()
    const initialMessages = options?.messages?.length ? options.messages : [generateInitialMessage()]
    const meta: ChatSessionMeta = {
      sessionId,
      userId: currentUserId,
      characterId,
      title: options?.title,
      messageCount: initialMessages.length,
      createdAt: now,
      updatedAt: now,
    }

    sessionMetas.value[sessionId] = meta
    sessionMessages.value[sessionId] = initialMessages
    ensureGeneration(sessionId)

    if (!index.value)
      index.value = { userId: currentUserId, characters: {} }

    const characterIndex = index.value.characters[characterId] ?? {
      activeSessionId: sessionId,
      sessions: {},
    }
    characterIndex.sessions[sessionId] = meta
    if (options?.setActive !== false)
      characterIndex.activeSessionId = sessionId
    index.value.characters[characterId] = characterIndex

    const record: ChatSessionRecord = { meta, messages: initialMessages }
    await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))
    await persistIndex()
    scheduleSync(sessionId)

    if (options?.setActive !== false)
      activeSessionId.value = sessionId

    return sessionId
  }

  async function ensureActiveSessionForCharacter() {
    if (ensuringSessionPromise)
      return ensuringSessionPromise

    ensuringSessionPromise = (async () => {
      const currentUserId = getCurrentUserId()
      const characterId = getCurrentCharacterId()

      console.info('[ChatSession] ensureActiveSessionForCharacter:start', {
        currentUserId,
        characterId,
        activeSessionId: activeSessionId.value,
      })

      if (!index.value || index.value.userId !== currentUserId)
        await loadIndexForUser(currentUserId)

      await lifetimeMemory.loadForCharacter(characterId)

      const characterIndex = getCharacterIndex(characterId)
      if (!characterIndex) {
        console.info('[ChatSession] no character index, creating session', { characterId })
        await createSession(characterId)
        return
      }

      if (!characterIndex.activeSessionId) {
        console.info('[ChatSession] character has no active session, creating session', { characterId })
        await createSession(characterId)
        return
      }

      let activeId = characterIndex.activeSessionId
      await loadSession(activeId)

      // RECOVERY BRIDGE: If active session is unregistered/orphaned, or completely empty/corrupted, switch to the most populated one.
      const isSessionRegistered = !!characterIndex.sessions[activeId]
      const currentMessages = sessionMessages.value[activeId] ?? []
      if (!isSessionRegistered || currentMessages.length === 0) {
        const otherSessionIds = Object.keys(characterIndex.sessions).filter(id => id !== activeId)
        if (otherSessionIds.length > 0) {
          console.info('[ChatSession] RECOVERY BRIDGE: Active session is empty/unregistered, checking candidates...', { characterId, count: otherSessionIds.length })
          let bestId = activeId
          let maxCount = currentMessages.length

          for (const otherId of otherSessionIds) {
            await loadSession(otherId)
            const count = sessionMessages.value[otherId]?.length ?? 0
            if (count > maxCount) {
              maxCount = count
              bestId = otherId
            }
          }

          if (bestId !== activeId) {
            console.info('[ChatSession] RECOVERY BRIDGE: Switching to populated session', { from: activeId, to: bestId, messageCount: maxCount })
            activeId = bestId
            characterIndex.activeSessionId = bestId
            await persistIndex()
          }
        }
      }

      activeSessionId.value = activeId
      ensureSession(activeId)

      // NOTICE: Ensure prompt is up to date immediately after card-switch context is resolved.
      await refreshActiveSystemMessage({
        sessionId: activeId,
        characterId,
        prompt: systemPrompt.value,
      })

      console.info('[ChatSession] ensureActiveSessionForCharacter:resolved', {
        characterId,
        activeSessionId: activeSessionId.value,
        messageCount: sessionMessages.value[activeSessionId.value]?.length ?? 0,
        allLoadedSessions: Array.from(loadedSessions),
      })
    })()

    try {
      await ensuringSessionPromise
    }
    finally {
      ensuringSessionPromise = null
    }
  }

  async function initialize() {
    if (ready.value)
      return
    if (initializePromise)
      return initializePromise
    initializing.value = true
    initializePromise = (async () => {
      console.info('[ChatSession] initialize:start')
      await shortTermMemory.load()

      // 1. Resolve the active character session
      await ensureActiveSessionForCharacter()
      ready.value = true

      // 2. RECOVERY BRIDGE: Check if there are orphaned messages in the phantom session ('')
      // and merge them into the now-resolved active session.
      const phantomMessages = sessionMessages.value[''] || []
      const activeId = activeSessionId.value
      if (phantomMessages.length > 0 && activeId && activeId !== '') {
        const filteredPhantom = phantomMessages.filter(m => m.role !== 'system')
        if (filteredPhantom.length > 0) {
          console.info('[ChatSession] RECOVERY: Merging orphaned messages into active session', {
            count: filteredPhantom.length,
            targetSession: activeId,
          })
          const current = sessionMessages.value[activeId] ?? []
          sessionMessages.value[activeId] = [...current, ...filteredPhantom]
          sessionMessages.value[''] = [] // Clear the phantom
          await persistSession(activeId)
        }
      }

      console.info('[ChatSession] initialize:complete', {
        activeSessionId: activeId,
        ready: ready.value,
      })
    })()

    try {
      await initializePromise
    }
    finally {
      initializePromise = null
      initializing.value = false
    }
  }

  function ensureSession(sessionId: string) {
    ensureGeneration(sessionId)
    if (loadingSessions.has(sessionId)) {
      console.info(`[ChatSession] ensureSession skipped for ${sessionId} because it is currently loading`)
      return
    }
    if (!sessionMessages.value[sessionId] || sessionMessages.value[sessionId].length === 0) {
      const meta = sessionMetas.value[sessionId]
      if (meta && (meta.messageCount || 0) > 0) {
        console.warn(`[ChatSession] ensureSession skipped for ${sessionId}: meta indicates ${meta.messageCount} messages exist but memory is empty.`)
        return
      }
      sessionMessages.value[sessionId] = [generateInitialMessage()]
      void persistSession(sessionId)
    }
  }

  const messages = computed<ChatHistoryItem[]>({
    get: () => {
      if (!activeSessionId.value)
        return []
      return sessionMessages.value[activeSessionId.value] ?? []
    },
    set: (value) => {
      if (!activeSessionId.value)
        return
      sessionMessages.value[activeSessionId.value] = value
      void persistSession(activeSessionId.value)
    },
  })

  function setActiveSession(sessionId: string) {
    console.info('[ChatSession] setActiveSession', {
      from: activeSessionId.value,
      to: sessionId,
      characterId: getCurrentCharacterId(),
    })
    activeSessionId.value = sessionId
    ensureSession(sessionId)

    const characterId = getCurrentCharacterId()
    const characterIndex = index.value?.characters[characterId]
    if (characterIndex) {
      characterIndex.activeSessionId = sessionId
      void persistIndex()
    }

    if (ready.value)
      void loadSession(sessionId)
  }

  function cleanupMessages(sessionId = activeSessionId.value) {
    ensureGeneration(sessionId)
    sessionGenerations.value[sessionId] += 1
    setSessionMessages(sessionId, [generateInitialMessage()])
  }

  /**
   * Refreshes all persona-related system messages in a session to reflect
   * current character settings without resetting the chat history.
   * This ensures that even mid-chat system injections remain consistent with the Acting tab.
   */
  async function refreshActiveSystemMessage(options?: { sessionId?: string, characterId?: string, prompt?: string, force?: boolean }) {
    const sessionId = options?.sessionId ?? activeSessionId.value
    if (!sessionId || !ready.value)
      return

    const meta = sessionMetas.value[sessionId]
    if (!meta)
      return

    // NOTICE: Strict integrity check to prevent cross-session prompt pollution.
    const targetCharacterId = options?.characterId ?? activeCardId.value
    if (meta.characterId !== targetCharacterId) {
      console.warn('[ChatSession] Skipping prompt refresh: session characterId mismatch', {
        sessionId,
        sessionCharacterId: meta.characterId,
        targetCharacterId,
      })
      return
    }

    const currentMessages = sessionMessages.value[sessionId]
    if (!currentMessages || currentMessages.length === 0)
      return

    const nextSystemMessage = options?.prompt
      ? generateInitialMessageFromPrompt(options.prompt, targetCharacterId)
      : generateInitialMessage()

    let changed = false
    const nextContent = extractMessageContent(nextSystemMessage)

    const personaIndices: number[] = []
    const nextMessagesBase = currentMessages.map((msg, index) => {
      if (msg.role !== 'system')
        return msg

      const content = extractMessageContent(msg)
      const isContext = content.startsWith('These are the contextual information retrieved')
        || content.startsWith('[ENVIRONMENTAL AWARENESS]')
        || content.includes('[CONTEXT_AWARENESS]')

      if (isContext)
        return msg

      // This is a Persona block
      personaIndices.push(index)
      return msg
    })

    // Determine which persona blocks to keep: Index 0 and the Last one.
    const headIndex = personaIndices[0]
    const tailIndex = personaIndices.length > 1 ? personaIndices[personaIndices.length - 1] : -1

    const finalMessages: ChatHistoryItem[] = []
    for (let i = 0; i < nextMessagesBase.length; i++) {
      const msg = nextMessagesBase[i]

      // If it's a Persona block, check if it's Head or Tail
      if (personaIndices.includes(i)) {
        if (i === headIndex || i === tailIndex) {
          const content = extractMessageContent(msg)
          if (options?.force || content !== nextContent) {
            changed = true
            finalMessages.push({
              ...nextSystemMessage,
              id: msg.id ?? nanoid(),
              createdAt: msg.createdAt,
            })
            continue
          }
        }
        else {
          // Prune intermediate persona blocks
          changed = true
          continue
        }
      }

      finalMessages.push(msg)
    }

    if (changed) {
      console.info('[ChatSession] Successfully refreshed and pruned persona system messages', {
        sessionId,
        characterId: targetCharacterId,
        originalCount: currentMessages.length,
        newCount: finalMessages.length,
        personaCount: personaIndices.length,
      })
      await setSessionMessages(sessionId, finalMessages)
      broadcastStreamEvent({ type: 'session-refreshed', sessionId })
    }
    else {
      console.debug('[ChatSession] No stale persona messages found to refresh', { sessionId })
    }
  }

  function getAllSessions() {
    return JSON.parse(JSON.stringify(sessionMessages.value)) as Record<string, ChatHistoryItem[]>
  }

  async function resetAllSessions() {
    const currentUserId = getCurrentUserId()
    const characterId = getCurrentCharacterId()
    const sessionIds = new Set<string>()

    if (index.value?.userId === currentUserId) {
      for (const character of Object.values(index.value.characters)) {
        for (const sessionId of Object.keys(character.sessions))
          sessionIds.add(sessionId)
      }
    }

    for (const sessionId of sessionIds)
      await enqueuePersist(() => chatSessionsRepo.deleteSession(sessionId))

    sessionMessages.value = {}
    sessionMetas.value = {}
    sessionGenerations.value = {}
    loadedSessions.clear()
    loadingSessions.clear()

    index.value = {
      userId: currentUserId,
      characters: {},
    }

    await createSession(characterId)
  }

  function getSessionMessages(sessionId: string) {
    if (ready.value)
      void loadSession(sessionId)
    return sessionMessages.value[sessionId] ?? []
  }

  function getSessionGeneration(sessionId: string) {
    ensureGeneration(sessionId)
    return sessionGenerations.value[sessionId] ?? 0
  }

  function bumpSessionGeneration(sessionId: string) {
    ensureGeneration(sessionId)
    sessionGenerations.value[sessionId] += 1
    return sessionGenerations.value[sessionId]
  }

  function getSessionGenerationValue(sessionId?: string) {
    const target = sessionId ?? activeSessionId.value
    return getSessionGeneration(target)
  }

  async function forkSession(options: { fromSessionId: string, atIndex?: number, reason?: string, hidden?: boolean }) {
    const characterId = getCurrentCharacterId()
    const parentMessages = getSessionMessages(options.fromSessionId)
    const forkIndex = options.atIndex ?? parentMessages.length
    const nextMessages = JSON.parse(JSON.stringify(parentMessages.slice(0, forkIndex)))
    return await createSession(characterId, { setActive: false, messages: nextMessages })
  }

  async function deleteSession(sessionId: string) {
    let characterId = sessionMetas.value[sessionId]?.characterId
    if (!characterId && index.value) {
      for (const [id, charIndex] of Object.entries(index.value.characters)) {
        if (charIndex.sessions && charIndex.sessions[sessionId]) {
          characterId = id
          break
        }
      }
    }

    if (!characterId)
      return

    await enqueuePersist(() => chatSessionsRepo.deleteSession(sessionId))

    delete sessionMessages.value[sessionId]
    delete sessionMetas.value[sessionId]
    delete sessionGenerations.value[sessionId]
    loadedSessions.delete(sessionId)

    const characterIndex = index.value?.characters[characterId]
    if (characterIndex) {
      delete characterIndex.sessions[sessionId]
      if (characterIndex.activeSessionId === sessionId) {
        const remaining = Object.keys(characterIndex.sessions)
        if (remaining.length > 0) {
          setActiveSession(remaining[0])
        }
        else {
          await createSession(characterId)
        }
      }
      await persistIndex()
    }

    broadcastStreamEvent({ type: 'session-deleted', sessionId })
  }

  async function deleteMessage(messageId: string, sessionId = activeSessionId.value) {
    if (!sessionId)
      return
    const current = sessionMessages.value[sessionId] ?? []
    const next = current.filter(msg => msg.id !== messageId)
    if (next.length !== current.length) {
      sessionMessages.value[sessionId] = next
      await persistSession(sessionId)
      broadcastStreamEvent({ type: 'session-refreshed', sessionId })
    }
  }

  async function deleteMessagesFromHere(messageId: string, sessionId = activeSessionId.value) {
    if (!sessionId)
      return
    const current = sessionMessages.value[sessionId] ?? []
    const index = current.findIndex(msg => msg.id === messageId)
    if (index !== -1) {
      const next = current.slice(0, index + 1)
      sessionMessages.value[sessionId] = next
      await persistSession(sessionId)
      broadcastStreamEvent({ type: 'session-refreshed', sessionId })
    }
  }

  async function exportSessions(): Promise<ChatSessionsExport> {
    if (!ready.value)
      await initialize()

    if (!index.value) {
      return {
        format: 'chat-sessions-index:v1',
        index: { userId: getCurrentUserId(), characters: {} },
        sessions: {},
      }
    }

    const sessions: Record<string, ChatSessionRecord> = {}
    for (const character of Object.values(index.value.characters)) {
      for (const sessionId of Object.keys(character.sessions)) {
        const stored = await chatSessionsRepo.getSession(sessionId)
        if (stored) {
          sessions[sessionId] = stored
          continue
        }
        const meta = sessionMetas.value[sessionId]
        const messages = sessionMessages.value[sessionId]
        if (meta && messages)
          sessions[sessionId] = { meta, messages }
      }
    }

    return {
      format: 'chat-sessions-index:v1',
      index: index.value,
      sessions,
    }
  }

  async function importSessions(payload: ChatSessionsExport) {
    if (payload.format !== 'chat-sessions-index:v1')
      return

    const totalSessions = Object.entries(payload.sessions).length
    const toastId = toast.loading(`Importing Chat History (0/${totalSessions})...`)
    console.info(`[ChatSession] Starting import of ${totalSessions} sessions`)

    index.value = payload.index
    sessionMessages.value = {}
    sessionMetas.value = {}
    sessionGenerations.value = {}
    loadedSessions.clear()
    loadingSessions.clear()

    await enqueuePersist(() => chatSessionsRepo.saveIndex(payload.index))

    let processedCount = 0
    for (const [sessionId, record] of Object.entries(payload.sessions)) {
      // Force recalculation of message count on import to ensure total integrity
      record.meta.messageCount = record.messages.length

      sessionMetas.value[sessionId] = record.meta
      sessionMessages.value[sessionId] = record.messages
      ensureGeneration(sessionId)
      await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))

      processedCount++
      if (processedCount % 10 === 0 || processedCount === totalSessions) {
        toast.loading(`Importing Chat History (${processedCount}/${totalSessions})...`, { id: toastId })
        console.info(`[ChatSession] Imported ${processedCount}/${totalSessions} sessions...`)
      }
    }

    toast.success(`Successfully imported ${totalSessions} sessions!`, { id: toastId })
    console.info(`[ChatSession] Import complete. Total: ${totalSessions}`)

    await ensureActiveSessionForCharacter()
  }

  watch([userId, activeCardId], ([nextUserId, nextCardId], [prevUserId, prevCardId]) => {
    if (!ready.value)
      return
    console.info('[ChatSession] watcher:userId+activeCardId', {
      prevUserId,
      nextUserId,
      prevCardId,
      nextCardId,
      activeSessionId: activeSessionId.value,
    })
    void ensureActiveSessionForCharacter()
  })

  // NOTICE: Synchronize character settings (systemPrompt) with the active session
  // by hot-swapping the root system message content.
  watchDebounced(systemPrompt, () => {
    if (!ready.value)
      return
    refreshActiveSystemMessage({ force: true })
  }, { debounce: 300 })

  watch(
    () => lifetimeMemory.artifacts.get(activeCardId.value || 'default')?.updatedAt ?? 0,
    () => {
      if (!ready.value)
        return
      refreshActiveSystemMessage()
    },
  )

  watch(activeSessionId, async (nextId) => {
    if (!nextId || !ready.value)
      return
    await loadSession(nextId)
    ensureSession(nextId)
  })

  // NOTICE: Cross-window sync receiver. When another window (e.g. main stage)
  // inscribes a turn (STT input, proactive message), it broadcasts a session-updated
  // event with the message payload. We apply it directly to the local store to avoid
  // race conditions with async DB persistence.
  watch(incomingSessionUpdate, (event) => {
    if (!event)
      return
    if (event.type === 'session-refreshed') {
      console.info('[ChatSession] Cross-window session-refreshed, reloading session', { sessionId: event.sessionId })
      void loadSession(event.sessionId, true)
      return
    }
    if (event.type === 'index-refreshed') {
      const currentUserId = getCurrentUserId()
      if (event.userId === currentUserId) {
        console.info('[ChatSession] Cross-window index-refreshed, reloading index')
        loadIndexForUser(currentUserId).then(() => {
          void ensureActiveSessionForCharacter()
        })
      }
      return
    }
    if (event.type === 'session-deleted') {
      const { sessionId } = event
      console.info('[ChatSession] Cross-window session-deleted, clearing session from memory', { sessionId })
      delete sessionMessages.value[sessionId]
      delete sessionMetas.value[sessionId]
      delete sessionGenerations.value[sessionId]
      loadedSessions.delete(sessionId)
      return
    }
    if (event.type !== 'session-updated')
      return

    if (!ready.value)
      return

    const { sessionId, message } = event
    const current = sessionMessages.value[sessionId] ?? []
    // Deduplicate by message id if present
    if (message.id && current.some(m => m.id === message.id)) {
      console.log(`[ChatStore] Cross-window session-updated DEDUPLICATED message:`, {
        id: message.id,
        role: message.role,
        contentPreview: typeof message.content === 'string' ? message.content.slice(0, 60) : '[Complex Content]',
      })
      return
    }

    console.log(`[ChatStore] Cross-window session-updated ADDING message:`, {
      id: message.id,
      role: message.role,
      createdAt: message.createdAt,
      contentPreview: typeof message.content === 'string' ? message.content.slice(0, 60) : '[Complex Content]',
      source: (message as any).metadata?.source ?? 'unknown',
      metadata: (message as any).metadata,
    })
    console.log(`[IngestDebug] Cross-window ADDING message payload stringified:`, JSON.stringify(message))

    const nextMessages = [...current, message]
    sessionMessages.value[sessionId] = nextMessages
    console.log(`[IngestDebug] Updated sessionMessages in memory. Count is now: ${sessionMessages.value[sessionId].length}`)

    // Reactively update local metadata count and timestamp in other windows
    const meta = sessionMetas.value[sessionId]
    if (meta) {
      meta.messageCount = nextMessages.length
      meta.updatedAt = Date.now()
    }
    const characterId = meta?.characterId || getCurrentCharacterId()
    const characterIndex = index.value?.characters[characterId]
    if (characterIndex && characterIndex.sessions[sessionId]) {
      characterIndex.sessions[sessionId].messageCount = nextMessages.length
      characterIndex.sessions[sessionId].updatedAt = Date.now()
    }
  })
  // void initialize()

  return {
    ready,
    isReady,
    initialize,

    activeSessionId,
    messages,

    createSession,
    setActiveSession,
    cleanupMessages,
    getAllSessions,
    resetAllSessions,
    getCharacterIndex,

    ensureSession,
    setSessionMessages,
    persistSessionMessages,
    getSessionMessages,
    sessionMessages,
    sessionMetas,
    getSessionGeneration,
    bumpSessionGeneration,
    getSessionGenerationValue,

    deleteSession,
    deleteMessage,
    deleteMessagesFromHere,
    forkSession,
    inscribeTurn,
    exportSessions,
    importSessions,
    refreshActiveSystemMessage,
  }
})
