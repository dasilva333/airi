import type { WebSocketEventInputs } from '@proj-airi/server-sdk'
import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { CommonContentPart, Message, ToolMessage } from '@xsai/shared-chat'

import type { ChatAssistantMessage, ChatSlices, ChatStreamEventContext } from '../types/chat'
import type { StreamEvent, StreamOptions } from './llm'

import { debug, healMozibake } from '@proj-airi/stage-shared'
import { createQueue } from '@proj-airi/stream-kit'
import { useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { reactive, ref, toRaw, watch } from 'vue'

import { useAnalytics } from '../composables'
import { createLlmJsonInterceptor } from '../composables/llm-json-interceptor'
import { useLlmmarkerParser } from '../composables/llm-marker-parser'
import { categorizeResponse, createStreamingCategorizer } from '../composables/response-categoriser'
// Import Intrusion Prompts defaults
import {
  DEFAULT_ARTISTRY_INTRUSION_PROMPT,
  DEFAULT_DREAM_INTRUSION_PROMPT,
  DEFAULT_JOURNAL_INTRUSION_PROMPT,
} from '../constants/prompts/character-defaults'
import { useCompactionStore } from './chat/compaction'
import { createDatetimeContext, createEternalRecordContext, createExpressionsContext, createScenesContext, createStickersContext } from './chat/context-providers'
import { useChatContextStore } from './chat/context-store'
import { createChatHooks } from './chat/hooks'
import { clearArtistryStaging, clearJournalStaging, pendingIntrusionStaging, stageArtistryIntrusion, stageJournalIntrusion } from './chat/intrusion-staging'
import { useChatSessionStore } from './chat/session-store'
import { useChatStreamStore } from './chat/stream-store'
import { useLLM } from './llm'
import { useTextJournalStore } from './memory-text-journal'
import { useAiriCardStore } from './modules/airi-card'
import { useAutonomousArtistryStore } from './modules/artistry-autonomous'
import { useConsciousnessStore } from './modules/consciousness'
import { useLiveSessionStore } from './modules/live-session'
import { useVisionStore } from './modules/vision'
import { useProactivityStore } from './proactivity'
import { useProvidersStore } from './providers'
import { useSettingsChat } from './settings/chat'

export interface SendOptions {
  model?: string
  chatProvider?: string | ChatProvider
  providerConfig?: Record<string, unknown>
  attachments?: { type: 'image', data: string, mimeType: string, fileName?: string, size?: number, url?: string }[]
  tools?: StreamOptions['tools']
  input?: WebSocketEventInputs
  /**
   * If true, the orchestrator will only ingest the user message into the session
   * and skip triggering the assistant's response.
   */
  skipAssistant?: boolean
  /**
   * If true, the orchestrator will skip adding a new user message
   * and just trigger inference on the existing history.
   */
  triggerOnly?: boolean
  /**
   * Optional metadata to attach to the user message (e.g. source platform info).
   */
  metadata?: Record<string, any>
}

interface ForkOptions {
  fromSessionId?: string
  atIndex?: number
  reason?: string
  hidden?: boolean
}

interface QueuedSend {
  sendingMessage: string
  options: SendOptions
  generation: number
  sessionId: string
  cancelled?: boolean
  deferred: {
    resolve: () => void
    reject: (error: unknown) => void
  }
}

// NOTICE: gated to DEV builds to avoid console spam during streaming in production.
const chatLog = import.meta.env.DEV ? debug.bind(null, '[ChatDebug]') : () => {}

// NOTICE: The hooks event bus is intentionally a module-level singleton, NOT created
// inside the defineStore setup function. During Vite HMR, Pinia re-runs the store's
// setup function which would create a new hooks instance. Long-lived components like
// Stage.vue that subscribed to the old hooks would be stranded on a defunct event bus,
// causing LLM responses to stop reaching the TTS pipeline ("chat text visible, no audio").
// Keeping hooks at module scope ensures listeners survive store re-instantiation.
const hooks = createChatHooks()

export const useChatOrchestratorStore = defineStore('chat-orchestrator', () => {
  const llmStore = useLLM()
  const providersStore = useProvidersStore()
  const consciousnessStore = useConsciousnessStore()
  const visionStore = useVisionStore()
  const airiCardStore = useAiriCardStore()
  const artistryAutonomousStore = useAutonomousArtistryStore()
  const settingsChat = useSettingsChat()
  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
  const { activeCard, activeCardId } = storeToRefs(airiCardStore)
  const { trackFirstMessage } = useAnalytics()

  const chatSession = useChatSessionStore()
  const chatStream = useChatStreamStore()
  const chatContext = useChatContextStore()
  const { activeSessionId } = storeToRefs(chatSession)
  const { streamingMessage } = storeToRefs(chatStream)

  const isMainWindow = typeof window !== 'undefined'
    && (window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#')

  const isChatWindow = typeof window !== 'undefined'
    && window.location.hash.startsWith('#/chat')

  const shouldListenToCaptions = isMainWindow || isChatWindow

  const { data: broadcastedInput, post: postInput } = useBroadcastChannel<
    {
      sendingMessage: string
      options?: any
      targetSessionId?: string
    },
    {
      sendingMessage: string
      options?: any
      targetSessionId?: string
    }
  >({ name: 'airi-chat-input-bridge' })

  // Cross-window intrusion staging channel
  const { data: intrusionBroadcast } = useBroadcastChannel<
    { type: 'journal' | 'artistry', data: any },
    { type: 'journal' | 'artistry', data: any }
  >({ name: 'airi-intrusion-staging' })

  const toolsResolver = ref<any>(null)

  function setToolsResolver(resolver: any) {
    toolsResolver.value = resolver
  }

  const activeSpokenText = ref('')
  const activeSpokenColor = ref('')

  if (isMainWindow) {
    watch(broadcastedInput, (payload) => {
      if (payload) {
        chatLog('Received broadcasted chat input from secondary window:', payload)
        ingest(payload.sendingMessage, {
          ...payload.options,
          tools: toolsResolver.value,
        }, payload.targetSessionId)
      }
    })

    // Listen for cross-window intrusion staging from secondary window
    watch(intrusionBroadcast, (payload) => {
      if (payload?.type === 'journal') {
        stageJournalIntrusion(payload.data, true)
      }
      else if (payload?.type === 'artistry') {
        stageArtistryIntrusion(payload.data, true)
      }
    })
  }

  if (shouldListenToCaptions) {
    // Single Inter-Window IPC Listeners for real-time spoken sentence highlighting
    const { data: captionData } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })
    const { data: sessionUpdate } = useBroadcastChannel<any, any>({ name: 'airi-chat-stream' })

    watch(captionData, (event) => {
      if (event?.type === 'caption-assistant') {
        const activeSegment = event.segments.find((s: any) => s.isActive)
        if (activeSegment) {
          activeSpokenText.value = activeSegment.text
          activeSpokenColor.value = activeSegment.color
        }
        else {
          activeSpokenText.value = ''
          activeSpokenColor.value = ''
        }
      }
    })

    watch(sessionUpdate, (event) => {
      if (event?.type === 'session-updated' && event.message?.role === 'user') {
        activeSpokenText.value = ''
        activeSpokenColor.value = ''
      }
    })
  }

  const sending = ref(false)
  const pendingQueuedSends = ref<QueuedSend[]>([])

  const sendQueue = createQueue<QueuedSend>({
    handlers: [
      async ({ data }) => {
        const { sendingMessage, options, generation, deferred, sessionId, cancelled } = data

        if (cancelled)
          return

        if (chatSession.getSessionGeneration(sessionId) !== generation) {
          deferred.reject(new Error('Chat session was reset before send could start'))
          return
        }

        try {
          await performSend(sendingMessage, options, generation, sessionId)
          deferred.resolve()
        }
        catch (error) {
          deferred.reject(error)
        }
      },
    ],
  })

  sendQueue.on('enqueue', (queuedSend) => {
    pendingQueuedSends.value = [...pendingQueuedSends.value, queuedSend]
  })

  sendQueue.on('dequeue', (queuedSend) => {
    pendingQueuedSends.value = pendingQueuedSends.value.filter(item => item !== queuedSend)
  })

  async function performSend(
    rawSendingMessage: string,
    options: SendOptions,
    generation: number,
    sessionId: string,
  ) {
    const isSentinel = rawSendingMessage === 'INVOKE_CHARACTER_FIRST'
    const sendingMessage = isSentinel ? '' : rawSendingMessage
    let finalAttachments = options.attachments ? [...options.attachments] : []
    chatLog('performSend starting with message:', rawSendingMessage)

    let bridgedSteps = 0
    let needsBridgedFollowUp = false

    if (!options.triggerOnly && !sendingMessage && !finalAttachments.length)
      return

    chatSession.ensureSession(sessionId)

    // Execute history compaction if limit has been reached
    const compactionStore = useCompactionStore()
    if (compactionStore.shouldCompact(sessionId)) {
      await compactionStore.executeCompaction(sessionId)
    }

    // Check if it's a VLM turn and Forward mode is enabled
    const hasImageAttachment = finalAttachments.some(a => a.type === 'image')
    const isVlmForwardTurn = !!(hasImageAttachment && visionStore.activeProvider && visionStore.activeModel && visionStore.strategy === 'forward')

    // Holds the VLM-generated image analysis text when forward mode is active.
    // Populated below and later injected as a system grounding message — never
    // concatenated into sendingMessage so the user's chat bubble stays clean.
    let vlmImageAnalysis: string | null = null

    if (isVlmForwardTurn) {
      chatLog('[Vision] VLM Forward mode activated. Invoking VLM first to describe image.', {
        provider: visionStore.activeProvider,
        model: visionStore.activeModel,
      })

      try {
        const vlmProvider = await providersStore.getProviderInstance(visionStore.activeProvider) as any

        // Construct trimmed chat history message array for VLM context
        const currentMessages = chatSession.getSessionMessages(sessionId)
        const systemMessage = currentMessages.find(m => m.role === 'system')
        const historyWithoutSystem = currentMessages.filter(m => m.role !== 'system')
        const trimmedHistory = historyWithoutSystem.slice(-6)

        // Compile VLM user message parts: user prompt shim text + optional message + image(s)
        const vlmUserContentParts: CommonContentPart[] = [
          { type: 'text', text: visionStore.promptShimForward || 'Describe the image.' },
        ]
        if (sendingMessage) {
          vlmUserContentParts.push({ type: 'text', text: sendingMessage })
        }
        for (const attachment of finalAttachments) {
          if (attachment.type === 'image') {
            vlmUserContentParts.push({
              type: 'image_url' as const,
              image_url: {
                url: `data:${attachment.mimeType};base64,${attachment.data}`,
              },
            })
          }
        }

        const vlmUserMessage = {
          role: 'user' as const,
          content: vlmUserContentParts,
        }

        const vlmMessages = systemMessage
          ? [systemMessage, ...trimmedHistory, vlmUserMessage]
          : [...trimmedHistory, vlmUserMessage]

        chatLog('[Vision] Sending request to VLM model...', visionStore.activeModel)
        const vlmResponse = await llmStore.generate(
          visionStore.activeModel,
          vlmProvider,
          vlmMessages as any,
          { vision: true },
        )

        vlmImageAnalysis = vlmResponse.text || null
        chatLog('[Vision] Received VLM analysis:', vlmImageAnalysis)

        // Strip the image attachments so the primary LLM turn is text-only.
        // sendingMessage is NOT mutated — the analysis is injected via groundingMessages
        // downstream, keeping the user's visible chat bubble clean.
        finalAttachments = finalAttachments.filter(a => a.type !== 'image')
      }
      catch (err) {
        // Contained failure: log and continue. Do NOT mutate sendingMessage or rethrow.
        // The outer ingest() must not reject from a VLM hop failure — that would
        // incorrectly trigger the "Draft Restored" toast in the UI.
        console.error('[Vision] VLM analysis failed during forward hop, continuing without image context:', err)
        finalAttachments = finalAttachments.filter(a => a.type !== 'image')
      }
    }

    // Inject current datetime context before composing the message
    chatContext.ingestContextMessage(createDatetimeContext())
    chatContext.ingestContextMessage(createStickersContext())
    chatContext.ingestContextMessage(createScenesContext())

    // Skip expressions context if user cleared expression acting prompts
    const acting = activeCard.value?.extensions?.airi?.acting
    const hasExpressionPrompts = !acting || (acting.modelExpressionPrompt !== '' && acting.speechExpressionPrompt !== '')
    if (hasExpressionPrompts) {
      chatContext.ingestContextMessage(createExpressionsContext())
    }

    const eternalRecordContext = createEternalRecordContext(activeCard.value?.extensions?.airi?.eternal_record)
    if (eternalRecordContext) {
      chatContext.ingestContextMessage(eternalRecordContext)
    }

    const sendingCreatedAt = Date.now()
    const streamingMessageContext: ChatStreamEventContext = {
      message: { role: 'user', content: sendingMessage, createdAt: sendingCreatedAt, id: nanoid(), ...options.metadata },
      contexts: chatContext.getContextsSnapshot(),
      composedMessage: [],
      input: options.input,
    }

    const isStaleGeneration = () => chatSession.getSessionGeneration(sessionId) !== generation
    const shouldAbort = () => isStaleGeneration()
    if (shouldAbort())
      return

    const isForegroundSession = () => sessionId === activeSessionId.value

    const buildingMessage: ChatAssistantMessage = reactive({
      role: 'assistant',
      content: '',
      slices: [],
      tool_results: [],
      createdAt: Date.now(),
      id: nanoid(),
    })

    streamingMessageContext.assistantMessageId = buildingMessage.id
    streamingMessageContext.assistantMessageCreatedAt = buildingMessage.createdAt

    const updateUI = () => {
      if (isForegroundSession()) {
        streamingMessage.value = JSON.parse(JSON.stringify(buildingMessage))
      }
    }

    updateUI()
    trackFirstMessage()

    const proactivityStore = useProactivityStore()
    proactivityStore.incrementMetric('chat')
    let streamIdleTimeout: ReturnType<typeof setTimeout> | undefined

    let fullText = ''
    let rawFullText = ''
    try {
      sending.value = true
      let effectiveModel = options.model || activeModel.value
      let effectiveProviderId = typeof options.chatProvider === 'string'
        ? options.chatProvider
        : activeProvider.value
      let effectiveProvider: any = typeof options.chatProvider === 'string'
        ? await providersStore.getProviderInstance(options.chatProvider)
        : (options.chatProvider || await providersStore.getProviderInstance(activeProvider.value))
      let effectiveConfig = options.providerConfig
      let effectiveTools = options.tools || toolsResolver.value

      const isVlmTurn = !!(finalAttachments && finalAttachments.some(a => a.type === 'image') && visionStore.activeProvider && visionStore.activeModel)
      let promptShimText = ''
      if (isVlmTurn) {
        chatLog('Vision handover activated. Replacing main LLM with Vision VLM.', {
          provider: visionStore.activeProvider,
          model: visionStore.activeModel,
        })
        effectiveModel = visionStore.activeModel
        effectiveProviderId = visionStore.activeProvider
        effectiveProvider = await providersStore.getProviderInstance(visionStore.activeProvider)
        effectiveConfig = providersStore.getProviderConfig(visionStore.activeProvider)
        promptShimText = visionStore.promptShimDirect || ''
        effectiveTools = undefined // Vision models often do not support tools, and we only need them for direct reply
      }

      const userText = promptShimText
        ? `${promptShimText}\n\n${sendingMessage}`
        : sendingMessage

      const inferenceContentParts: CommonContentPart[] = [{ type: 'text', text: userText }]
      const historicalContentParts: CommonContentPart[] = [{ type: 'text', text: sendingMessage }]

      if (finalAttachments) {
        for (const attachment of finalAttachments) {
          if (attachment.type === 'image') {
            const imagePart = {
              type: 'image_url' as const,
              image_url: {
                url: `data:${attachment.mimeType};base64,${attachment.data}`,
              },
            }
            inferenceContentParts.push(imagePart)
            historicalContentParts.push(imagePart)
          }
        }
      }

      const inferenceContent = inferenceContentParts.length > 1 ? inferenceContentParts : userText
      const historicalContent = historicalContentParts.length > 1 ? historicalContentParts : sendingMessage
      if (!streamingMessageContext.input) {
        streamingMessageContext.input = {
          type: 'input:text',
          data: {
            text: sendingMessage,
          },
        }
      }

      if (shouldAbort())
        return

      const userMessageId = nanoid()
      const sessionMessagesForSend = chatSession.getSessionMessages(sessionId)

      if (!options.triggerOnly) {
        const historicalUserMessage = { role: 'user' as const, content: historicalContent, createdAt: sendingCreatedAt, id: userMessageId, ...options.metadata }
        const nextMessages = [...sessionMessagesForSend, historicalUserMessage]
        chatSession.setSessionMessages(sessionId, nextMessages)
      }

      if (options.skipAssistant) {
        chatLog('skipAssistant is true, ending ingest.')
        return
      }

      // NOTICE: Emit before-message-composed so Stage.vue can flush the speech pipeline,
      // cancel stale intents, reset lip sync, and clear captions before the new turn starts.
      await hooks.emitBeforeMessageComposedHooks(sendingMessage, streamingMessageContext)

      // --- AUTONOMOUS ARTISTRY HOOK ---
      // Trigger now only if in user-centric mode. Assistant-centric runs after response is complete.
      const autonomousTarget = activeCard.value?.extensions?.airi?.artistry?.autonomousTarget || 'user'
      if (autonomousTarget === 'user' && !options.triggerOnly) {
        void artistryAutonomousStore.runArtistTask(sendingMessage, sessionMessagesForSend as any)
      }
      // --------------------------------

      const inferenceUserMessage = options.triggerOnly
        ? null
        : { role: 'user' as const, content: inferenceContent, createdAt: sendingCreatedAt, id: userMessageId }

      let inferenceMessages: any[] = []

      // --- Grounding Injection ---
      // If grounding/sensors or memory is enabled, we sync and inject context payloads as system messages.
      const groundingMessages: any[] = []

      // 0. VLM Image Analysis (Forward Mode)
      // Injected unconditionally when a VLM forward hop produced a result — no toggle required.
      // This keeps the analysis out of the user's chat bubble (sendingMessage is untouched)
      // while still giving the primary LLM full visual context for its response.
      if (vlmImageAnalysis) {
        groundingMessages.push({
          role: 'system',
          content: `[IMAGE ANALYSIS]\nThe user attached an image. The following is an objective visual description generated by a vision model to inform your response. React naturally as the character — do not narrate or reference this block directly:\n---\n${vlmImageAnalysis}`,
        })
        chatLog('[Vision] VLM image analysis injected into grounding context.')
      }

      // 1. System Sensors Telemetry
      if (activeCard.value?.extensions?.airi?.groundingEnabled) {
        chatLog('Grounding active. Syncing sensors...')
        await proactivityStore.updateSensors()

        const sensorPayload = proactivityStore.sensorPayload
        groundingMessages.push({
          role: 'system',
          content: `[ENVIRONMENTAL AWARENESS]\nThe following telemetry describes your current environmental context. Use it to stay grounded in the user's reality and inform your response. You may reference specific values (like time or active applications) if relevant to the conversation, but avoid a dry, technical recitation of the data.\n---\n${sensorPayload}`,
        })
      }

      // 2. RAG Universe Memory Injection
      if (activeCard.value?.extensions?.airi?.groundingMemoryEnabled && !options.triggerOnly && typeof sendingMessage === 'string' && sendingMessage.trim().length > 3) {
        chatLog('Grounding Memory active. Fetching semantic query matches...')
        try {
          const textJournalStore = useTextJournalStore()
          const results = await textJournalStore.searchEntries({
            query: sendingMessage,
            limit: 3,
            characterId: activeCardId.value,
          })
          if (results && results.length > 0) {
            const memoriesFormatted = results.map(r => `[${(r.kind || 'Journal').toUpperCase()}] ${r.title || 'Memory'}\n${r.content}`).join('\n\n')
            groundingMessages.push({
              role: 'system',
              content: `[GROUNDED LONG-TERM MEMORIES]\nThe following long-term memory records from your history were retrieved based on the user's latest query. Use these memories to inform your response and maintain context continuity. Keep references to them natural and contextual:\n---\n${memoriesFormatted}`,
            })
            chatLog('Grounding Memory payload injected into inference step.')
          }
        }
        catch (err) {
          console.error('[ChatStore] Failed to query semantic memories during ingest:', err)
        }
      }

      // 3. Grounding Recent Topics Injection
      if (activeCard.value?.extensions?.airi?.groundingTopicsEnabled && activeCard.value?.extensions?.airi?.recentTopics?.length) {
        const topicsFormatted = activeCard.value.extensions.airi.recentTopics
          .map(t => `${t.topic} (weight: ${t.weight.toFixed(2)})`)
          .join(', ')
        groundingMessages.push({
          role: 'system',
          content: `[RECENT TOPICS]\nYou have the following topics and conceptual threads active in your recent memory. Use them to maintain awareness of what has been discussed lately:\n---\n${topicsFormatted}`,
        })
      }

      // 4. Grounding Visual Scene State (Director's Scratchpad) Injection
      if (activeCard.value?.extensions?.airi?.groundingDirectorScratchpadEnabled) {
        try {
          const { directorNotesRepo } = await import('../database/repos/director-notes.repo')
          const notes = await directorNotesRepo.getNotes(sessionId)
          if (notes && notes.length > 0) {
            const sortedNotes = [...notes].sort((a, b) => b.createdAt - a.createdAt)
            const lastNoteWithScratchpad = sortedNotes.find(n => !!n.scratchpad)
            if (lastNoteWithScratchpad && lastNoteWithScratchpad.scratchpad) {
              groundingMessages.push({
                role: 'system',
                content: `[VISUAL STATE BOARD]\nThe following telemetry describes your current visual and spatial context, managed by the Director. Use this description to remain verbally aligned with your current surroundings, outfit, or held items. Keep references natural and contextual:\n---\n${lastNoteWithScratchpad.scratchpad}`,
              })
              chatLog('Grounding Director Scratchpad injected into inference step.')
            }
          }
        }
        catch (err) {
          console.error('[ChatStore] Failed to query director notes during scratchpad grounding:', err)
        }
      }

      // Splice them into the message list!
      if (groundingMessages.length > 0) {
        if (options.triggerOnly) {
          const nextInferenceMessages = [...sessionMessagesForSend]
          nextInferenceMessages.splice(sessionMessagesForSend.length - 1, 0, ...groundingMessages)
          inferenceMessages = nextInferenceMessages
        }
        else {
          const nextInferenceMessages = [...sessionMessagesForSend, inferenceUserMessage]
          nextInferenceMessages.splice(sessionMessagesForSend.length, 0, ...groundingMessages)
          inferenceMessages = nextInferenceMessages
        }
      }
      else {
        if (options.triggerOnly) {
          inferenceMessages = [...sessionMessagesForSend]
        }
        else {
          inferenceMessages = [...sessionMessagesForSend, inferenceUserMessage]
        }
      }
      // ----------------------------

      // For VLM turns, trim history to save context/tokens.
      // Rule: System Message + last 6 conversation messages + current user input.
      if (isVlmTurn) {
        const systemMessage = inferenceMessages.find(m => m.role === 'system')
        const historyWithoutSystem = inferenceMessages.filter(m => m.role !== 'system' && (!inferenceUserMessage || m !== inferenceUserMessage))
        const trimmedHistory = historyWithoutSystem.slice(-6)

        inferenceMessages = systemMessage
          ? [systemMessage, ...trimmedHistory]
          : [...trimmedHistory]

        if (inferenceUserMessage) {
          inferenceMessages.push(inferenceUserMessage)
        }

        chatLog(`[ChatDebug] VLM turn detected. Trimmed history from ${sessionMessagesForSend.length + 1} to ${inferenceMessages.length} messages.`)
      }

      const categorizer = createStreamingCategorizer(effectiveProviderId)
      let streamPosition = 0

      const createLiteralInterceptor = () => createLlmJsonInterceptor({
        onText: async (text) => {
          if (shouldAbort())
            return

          categorizer.consume(text)

          const speechOnly = categorizer.filterToSpeech(text, streamPosition)
          streamPosition += text.length

          const cardFallback = activeCard.value?.extensions?.airi?.generation?.known?.reasoningFallback
          const current = categorizer.getCurrent()
          if (current) {
            const finalSpeech = current.speech || (cardFallback !== false && current.reasoning ? current.reasoning : '')
             ;(buildingMessage as any).categorization = {
              speech: finalSpeech,
              reasoning: current.reasoning,
            }
          }

          if (speechOnly.trim()) {
            buildingMessage.content += speechOnly
            turnSpeechContent += speechOnly

            await hooks.emitTokenLiteralHooks(speechOnly, streamingMessageContext)

            const lastSlice = (buildingMessage as any).slices.at(-1)
            if (lastSlice?.type === 'text') {
              lastSlice.text += speechOnly
            }
            else {
              ;(buildingMessage as any).slices.push({
                type: 'text',
                text: speechOnly,
              })
            }
          }
          updateUI()
        },
        onJson: async (json) => {
          if (shouldAbort())
            return

          await hooks.emitWidgetHooks(json, streamingMessageContext)
        },
      })

      let literalInterceptor = createLiteralInterceptor()

      /**
       * Evaluates a potential tool marker string.
       * RETURNS: Info about the match and whether it was successfully bridged as a tool call.
       */
      function tryParseLenientJson(json: string): any {
        let sanitized = json.trim()
        if (!sanitized)
          return {}

        // Handle unclosed quotes at the end of the string
        const openQuotes = (sanitized.match(/"/g) || []).length
        if (openQuotes % 2 !== 0) {
          sanitized += '"'
        }

        // Handle missing closing braces/brackets
        const openBraces = (sanitized.match(/\{/g) || []).length
        const closeBraces = (sanitized.match(/\}/g) || []).length
        for (let i = 0; i < openBraces - closeBraces; i++) {
          sanitized += '}'
        }

        const openBrackets = (sanitized.match(/\[/g) || []).length
        const closeBrackets = (sanitized.match(/\]/g) || []).length
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          sanitized += ']'
        }

        try {
          return JSON.parse(sanitized)
        }
        catch (e) {
          // If still failing, try one last desperation fix: remove the last key if it looks truncated
          try {
            const desperation = `${sanitized.replace(/,\s*"[\w-]+"[:\s]*"[^"]*$/g, '')}}`
            return JSON.parse(desperation)
          }
          catch {
            throw e
          }
        }
      }

      async function tryBridgeMarker(input: string): Promise<{ matchedText: string, bridged: boolean }> {
        chatLog('tryBridgeMarker evaluating input (partial):', input.trim().substring(0, 100))
        // Supports: <|tool:args|>, [call_tool:tool, args], and hybrid <|tool:args</tool_call>
        // Use non-greedy match and NO start-of-line anchor to allow finding markers within blocks.
        const match = input.match(/<\|([\w-]+):([^|]*?)(?:\|>|<\/tool_call>|$)/)
          || input.match(/\[call_tool:([\w-]+),\s*([^\]]*?)(?:\]|<\/tool_call>|$)/)
          || input.match(/<tool_call>([\w-]+)\((.*?)\)<\/tool_call>/s)
          || input.match(/<tool_call>(\{.*?\})<\/tool_call>/s)

        if (!match)
          return { matchedText: '', bridged: false }

        const matchedMarkerText = match[0]
        let toolName: string
        let argsRaw: string

        // check if it's the JSON flavor: <tool_call>{"name": "...", "arguments": "..."}</tool_call>
        const potentialJson = (match[1] || '').trim()
        if (potentialJson.startsWith('{')) {
          try {
            const parsed = tryParseLenientJson(potentialJson)
            toolName = parsed.name
            argsRaw = typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments)
          }
          catch (e) {
            console.error('[ChatDebug] Failed to parse JSON tool call tag:', e)
            return { matchedText: '', bridged: false }
          }
        }
        else {
          toolName = match[1]
          argsRaw = match[2] || ''
        }

        const resolvedTools = typeof options.tools === 'function' ? await options.tools() : options.tools
        const tool = resolvedTools?.find(t => (t.function?.name || (t as any).name) === toolName)

        if (!tool) {
          chatLog(`[ChatDebug] Marker found but tool not executable/found in this context: ${toolName}`)
          return { matchedText: matchedMarkerText, bridged: false }
        }

        chatLog(`Bridging marker to tool call: ${toolName}`)
        try {
          const args: Record<string, any> = {}
          // NOTICE: We allow unclosed quotes at the end of the string (?:'|$) to handle truncation gracefully.
          // We use a non-capturing group (?:...) for the alternatives to keep the group indexes for key/valDouble/etc consistent.
          const kvRegex = /(?:^|[, \n\t]+)\s*([\w-]+)\s*[:=]\s*(?:"([^"]*)(?:"|$)|'([^']*)(?:'|$)|(\d+(?:\.\d+)?)|(true|false)|(\{.*(?:\}|$)|\[.*(?:\]|$)))/g
          let kvMatch

          while ((kvMatch = kvRegex.exec(argsRaw)) !== null) {
            const [, key, valDouble, valSingle, valNum, valBool, valComplex] = kvMatch
            if (valDouble !== undefined) {
              args[key] = valDouble
            }
            else if (valSingle !== undefined) {
              args[key] = valSingle
            }
            else if (valNum !== undefined) {
              args[key] = Number.parseFloat(valNum)
            }
            else if (valBool !== undefined) {
              args[key] = valBool === 'true'
            }
            else if (valComplex !== undefined) {
              try {
                // Try to sanitize and parse complex JSON-like objects
                const sanitized = valComplex
                  .replace(/'/g, '"')
                  .trim()

                // If it looks truncated (starts with { but doesn't end with }), try to close it
                let toParse = sanitized
                if (toParse.startsWith('{') && !toParse.endsWith('}'))
                  toParse += '}'
                if (toParse.startsWith('[') && !toParse.endsWith(']'))
                  toParse += ']'

                args[key] = JSON.parse(toParse)
              }
              catch {
                args[key] = valComplex
              }
            }
          }

          if (Object.keys(args).length === 0) {
            try {
              let cleaned = argsRaw.trim().replace(/^\{/, '').replace(/\}$/, '').replace(/(\w+):/g, '"$1":').replace(/'/g, '"')
              if (argsRaw.trim().startsWith('{') && !cleaned.endsWith('}'))
                cleaned += '"}' // Guessing it ended inside a string
              Object.assign(args, JSON.parse(`{${cleaned}}`))
            }
            catch {}
          }

          if (Object.keys(args).length > 0) {
            toolCallQueue.enqueue({
              type: 'tool-call',
              toolCall: {
                id: `bridge-${nanoid()}`,
                index: 0,
                type: 'function',
                function: {
                  name: toolName,
                  arguments: JSON.stringify(args),
                },
              } as any,
              bridged: true,
            })

            // Strip the EXPLICIT matched marker text (not the whole input) from the raw accumulator
            fullText = fullText.replace(matchedMarkerText, '')

            return { matchedText: matchedMarkerText, bridged: true }
          }
        }
        catch (err) {
          console.error('[ChatDebug] Failed to bridge marker:', err)
        }
        return { matchedText: matchedMarkerText, bridged: false }
      }

      const toolCallQueue = createQueue<ChatSlices>({
        handlers: [
          async (ctx) => {
            if (shouldAbort())
              return

            if (ctx.data.type === 'tool-call') {
              ;(buildingMessage.slices as any).push({
                ...ctx.data,
                state: 'executing',
              })
              updateUI()

              // Manuel execution for bridged tool calls
              if ((ctx.data as any).bridged) {
                const toolCall = (ctx.data as any).toolCall
                const resolvedTools = typeof options.tools === 'function' ? await options.tools() : options.tools
                const tool = resolvedTools?.find(t => (t.function?.name || (t as any).name) === toolCall.function.name)

                if (tool && (tool as any).execute) {
                  chatLog(`Manually executing bridged tool: ${toolCall.function.name}`)
                  try {
                    const parsedArgs = tryParseLenientJson(toolCall.function.arguments)
                    const result = await (tool as any).execute(parsedArgs)
                    toolCallQueue.enqueue({
                      type: 'tool-call-result',
                      id: toolCall.id,
                      result: (typeof result === 'string' ? result : JSON.stringify(result)) as any,
                    })
                  }
                  catch (err) {
                    console.error(`[ChatDebug] Bridged tool execution failed: ${toolCall.function.name}`, err)
                    toolCallQueue.enqueue({
                      type: 'tool-call-result',
                      id: toolCall.id,
                      result: `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                  }
                }
                else {
                  debug(`[ChatDebug] Tool not found or not executable: ${toolCall.function.name}`)
                  toolCallQueue.enqueue({
                    type: 'tool-call-result',
                    id: toolCall.id,
                    result: `Error: Tool "${toolCall.function.name}" not found or not executable.`,
                  })
                }
              }

              return
            }

            if (ctx.data.type === 'tool-call-result') {
              const resultData = ctx.data as any
              buildingMessage.tool_results.push(resultData)

              const slice = buildingMessage.slices.find((s: any) => {
                if (s.type !== 'tool-call')
                  return false
                const tc = s.toolCall as any
                return tc.id === resultData.id || tc.toolCallId === resultData.id
              })
              if (slice && slice.type === 'tool-call') {
                slice.state = ctx.data.result?.toString().toLowerCase().includes('failed') ? 'error' : 'done'
                slice.result = ctx.data.result
              }

              updateUI()
            }
          },
        ],
      })

      let turnSpeechContent = ''
      let turnRawContent = ''
      const bridgedTurnsHistory: { content: string, rawContent?: string, tool_calls?: any[], tool_results: any[] }[] = []

      while (bridgedSteps < 5) {
        bridgedSteps++
        needsBridgedFollowUp = false
        turnSpeechContent = ''
        turnRawContent = ''

        chatLog(`[ChatDebug] Starting inference step ${bridgedSteps}`)

        const createParser = () => useLlmmarkerParser({
          onLiteral: async (text) => {
            chatLog('onLiteral:', text)
            if (shouldAbort())
              return

            // Catch hallucinated markers - Loop to handle multiple markers in one delta
            let currentText = text
            let lastMatch: { matchedText: string, bridged: boolean }
            while ((lastMatch = await tryBridgeMarker(currentText)).matchedText !== '') {
              currentText = currentText.replace(lastMatch.matchedText, '')
              if (lastMatch.bridged)
                needsBridgedFollowUp = true
            }

            if (currentText.trim()) {
              await literalInterceptor.consume(currentText)
            }
          },
          onSpecial: async (special) => {
            chatLog('onSpecial:', special)
            if (shouldAbort())
              return

            // Use the refactored tryBridgeMarker which returns the match info
            const bridgeResult = await tryBridgeMarker(special)
            if (bridgeResult.bridged) {
              needsBridgedFollowUp = true
              return
            }

            await hooks.emitTokenSpecialHooks(special, streamingMessageContext)
          },

          onEnd: async (_parserText) => {
            chatLog('parser.onEnd triggered with parserText length:', _parserText.length)
            if (isStaleGeneration())
              return

            const cardFallback = activeCard.value?.extensions?.airi?.generation?.known?.reasoningFallback
            const finalCategorization = categorizeResponse(fullText, effectiveProviderId, { reasoningFallback: cardFallback !== false })

            ;(buildingMessage as any).categorization = {
              speech: finalCategorization.speech,
              reasoning: finalCategorization.reasoning || ((buildingMessage as any).categorization?.reasoning ?? ''),
            }

            if (buildingMessage.content !== finalCategorization.speech) {
              buildingMessage.content = finalCategorization.speech
            }

            updateUI()
          },
          minLiteralEmitLength: 24,
        })

        let parser = createParser()

        let noReplyBuffer = ''
        let isCheckingNoReply = true

        // Reconstruct messages for this turn using the segmented bridgedTurnsHistory.
        const cleanMessageContent = (content: any): any => {
          if (typeof content === 'string') {
            // Regex to find markdown image patterns: ![Title](url)
            return content.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, title) => {
              return `Image Generated: ${title || 'Autonomous Scene'}`
            })
          }
          if (Array.isArray(content)) {
            return content.map((part) => {
              if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
                return {
                  ...part,
                  text: cleanMessageContent(part.text),
                }
              }
              return part
            })
          }
          return content
        }

        let newMessages = inferenceMessages.map((msg: any) => {
          const { context: _context, id: _id, createdAt: _createdAt, ...withoutContext } = msg
          const rawMessage = toRaw(withoutContext)

          if (rawMessage.role === 'assistant') {
            const { slices: _slices, tool_results: _toolResults, categorization: _categorization, rawContent: _rawContent, ...rest } = rawMessage as ChatAssistantMessage
            // NOTICE: Prefer rawContent (full LLM output with orchestration tokens) over
            // content (display-friendly, stripped). This prevents the model from "forgetting"
            // to use ACTOR/ACT/DELAY tokens as conversation history grows.
            const inferenceContent = (rawMessage as ChatAssistantMessage).rawContent || rest.content
            return { ...toRaw(rest), content: cleanMessageContent(inferenceContent) }
          }

          return { ...rawMessage, content: cleanMessageContent(rawMessage.content) }
        })

        // Inject all previously completed bridged turns into newMessages history
        for (const turn of bridgedTurnsHistory) {
          newMessages.push({
            role: 'assistant',
            content: cleanMessageContent(turn.rawContent || turn.content),
            tool_calls: turn.tool_calls,
          })
          for (const res of turn.tool_results) {
            newMessages.push({
              role: 'tool',
              tool_call_id: res.id,
              content: typeof res.result === 'string' ? cleanMessageContent(res.result) : JSON.stringify(res.result),
            })
          }
        }

        const contextsSnapshot = chatContext.getContextsSnapshot()
        const groundingEnabled = activeCard.value?.extensions?.airi?.groundingEnabled
        const sensorPayload = groundingEnabled ? proactivityStore.sensorPayload : ''

        // Check for Dating Sim Climax triggers (Victory/Defeat) to inject instructions dynamically
        let climaxPrompt = ''
        try {
          const datingSim = (await import('@proj-airi/stage-ui/stores/dating-sim')).useDatingSimStore()
          const msgs = chatSession.messages || []
          const turns = msgs.filter((m: any) => m.role === 'assistant').length
          if (datingSim.enabled && datingSim.settings.gameMode === 'goal_driven') {
            const pos = datingSim.getVariable('positiveScore')
            const neg = datingSim.getVariable('negativeScore')
            const maxScore = datingSim.settings.maxScore
            const maxTurns = datingSim.settings.maxTurns
            const isWin = pos >= maxScore || ((turns + 1) >= maxTurns && pos > neg)
            const isLoss = neg >= maxScore || ((turns + 1) >= maxTurns && neg >= pos)

            if (isWin || isLoss) {
              const climaxState = isWin ? 'VICTORY' : 'DEFEAT'
              climaxPrompt = `[DATING SIM CLIMAX RESOLUTION]
The Dating Sim session has ended. The user has achieved the climax state: ${climaxState}.
Final metrics: Intimacy Connection: ${pos}/${maxScore}, Tension/Friction: ${neg}/${maxScore}, Turns Elapsed: ${turns + 1}/${maxTurns}.

You must now react to this outcome and provide a rich, narrative-driven climax reaction to resolve this storyline/arc. Break standard reply length limits if necessary to provide a complete, satisfying story resolution. Do not generate choices, suggestions, or prompt instructions anymore.`
            }
          }
        }
        catch (e) {
          debug('[ChatOrchestrator] Failed to evaluate Dating Sim climax state injection', e)
        }

        // Evaluate Introspective Context Injections
        const dreamState = activeCard.value?.extensions?.airi?.dreamState
        const textJournal = activeCard.value?.extensions?.airi?.textJournal
        const artistry = activeCard.value?.extensions?.airi?.artistry

        // Read pending intrusion data from module-level staging (populated via BroadcastChannel or local call)
        const pendingJournal = pendingIntrusionStaging.journal ? toRaw(pendingIntrusionStaging.journal) : undefined
        const pendingArtistry = pendingIntrusionStaging.artistry ? toRaw(pendingIntrusionStaging.artistry) : undefined

        debug('[Chat Debug] performSend evaluation:', {
          activeCardId: activeCardId.value,
          dreamStateInject: dreamState?.injectDreamContext,
          journalStateInject: textJournal?.injectJournalContext,
          artistryStateInject: artistry?.injectArtistryContext,
          hasPendingJournal: !!pendingJournal,
          pendingJournalContent: pendingJournal?.entryText?.substring(0, 50),
        })

        let dreamPrompt = ''
        if (dreamState?.injectDreamContext && dreamState?.pendingDreamChips && dreamState.pendingDreamChips.length > 0) {
          const elapsedMinutes = Math.max(1, Math.round((Date.now() - (dreamState.pendingDreamTimestamp || Date.now())) / 60000))
          const template = dreamState.dreamIntrusionPrompt || DEFAULT_DREAM_INTRUSION_PROMPT
          const chipsText = dreamState.pendingDreamChips.join(', ')
          dreamPrompt = template
            .replace('{timeToDream}', String(elapsedMinutes))
            .replace('{insertEchoChips}', chipsText)
        }

        let journalPrompt = ''
        if (textJournal?.injectJournalContext && pendingJournal) {
          debug('[Journal Debug] Evaluating journal injection from staging:', pendingJournal)
          const elapsedMinutes = Math.max(1, Math.round((Date.now() - pendingJournal.timestamp) / 60000))
          const template = textJournal.journalIntrusionPrompt || DEFAULT_JOURNAL_INTRUSION_PROMPT
          journalPrompt = template
            .replace('{timeSinceJournal}', String(elapsedMinutes))
            .replace('{journalEntryText}', pendingJournal.entryText)
        }

        let artistryPrompt = ''
        if (artistry?.injectArtistryContext && pendingArtistry) {
          const template = artistry.artistryIntrusionPrompt || DEFAULT_ARTISTRY_INTRUSION_PROMPT
          artistryPrompt = template
            .replace('{imagePrompt}', pendingArtistry.prompt)
        }

        if (Object.keys(contextsSnapshot).length > 0 || sensorPayload || climaxPrompt || dreamPrompt || journalPrompt || artistryPrompt) {
          const system = newMessages.slice(0, 1)
          const afterSystem = newMessages.slice(1, newMessages.length)

          let contextContent = ''
          if (Object.keys(contextsSnapshot).length > 0) {
            contextContent += 'These are the contextual information retrieved or on-demand updated from other modules:\n'
              + `${Object.entries(contextsSnapshot).map(([key, messages]) => {
                const messageTexts = messages
                  .map(m => m && typeof m === 'object' && 'text' in m ? m.text : String(m))
                  .filter(Boolean)
                return `Module ${key}:\n${messageTexts.map(t => `- ${t}`).join('\n')}`
              }).join('\n')}\n`
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

          if (climaxPrompt) {
            contextContent += `${contextContent ? '\n---\n' : ''}${climaxPrompt}\n`
          }

          if (dreamPrompt) {
            contextContent += `${contextContent ? '\n---\n' : ''}[INSPECTIVE DREAM STATE]\n${dreamPrompt}\n`
          }

          if (journalPrompt) {
            contextContent += `${contextContent ? '\n---\n' : ''}[INSPECTIVE JOURNAL REFLECTION]\n${journalPrompt}\n`
          }

          if (artistryPrompt) {
            contextContent += `${contextContent ? '\n---\n' : ''}[INSPECTIVE ARTWORK AWARENESS]\n${artistryPrompt}\n`
          }

          debug('[Chat Debug] Combined contextContent to inject:', contextContent.trim())

          newMessages = [
            ...system,
            {
              role: 'system',
              content: contextContent.trim(),
            },
            ...afterSystem,
          ]

          // Clear pending states immediately so they only trigger for this turn
          if (journalPrompt) {
            clearJournalStaging()
          }
          if (artistryPrompt) {
            clearArtistryStaging()
          }

          if (activeCard.value && dreamPrompt && dreamState) {
            void airiCardStore.updateCard((activeCard.value as any).id, {
              ...toRaw(activeCard.value),
              extensions: {
                ...activeCard.value.extensions,
                airi: {
                  ...activeCard.value.extensions?.airi,
                  dreamState: {
                    ...dreamState,
                    pendingDreamChips: undefined,
                    pendingDreamTimestamp: undefined,
                  },
                },
              },
            })
          }
        }

        // Evaluate Decoupled Two-Hop Cognition Pipeline
        const cognitionConfig = (activeCard.value?.extensions?.airi as any)?.modules?.cognition
        if (cognitionConfig?.enabled && bridgedSteps === 1) {
          const firstHopProviderId = cognitionConfig.provider
          const firstHopModelId = cognitionConfig.model
          const processorMode = cognitionConfig.processor || 'none'

          if (firstHopProviderId && firstHopModelId) {
            chatLog('[Cognition] Executing 1st-Hop pre-pass thoughts...', {
              provider: firstHopProviderId,
              model: firstHopModelId,
              processor: processorMode,
            })

            try {
              const firstHopProvider = await providersStore.getProviderInstance(firstHopProviderId)
              const firstHopConfig = providersStore.getProviderConfig(firstHopProviderId)
              const headers = (firstHopConfig?.headers || {}) as Record<string, string>

              // Build the output guidance instructions for the 1st-Hop LLM
              let firstHopSystemPrompt = ''
              if (processorMode === 'local_nan0') {
                // Kyo's local rules engine instructions (System Prompt for Nan0 private thoughts)
                firstHopSystemPrompt = `[COGNITIVE PROCESSOR: NAN0 LOCAL]
You are the inner thoughts, attention processor, and emotional monologue generator for the character.
Generate a thought log matching the strict Nan0 token-delimited formatting schema:
[ATTENTION] score
[EMOTION] state
[MONOLOGUE]
Your subconscious monologue.
[DECISION] SPEAK or SILENCE`
              }
              else {
                // Pass-through proxy/default instructions
                firstHopSystemPrompt = cognitionConfig.outputGuidance || `[COGNITIVE PROCESSOR]
You are the inner thoughts, attention processor, and emotional monologue generator for the character.
Analyze the conversation history and the latest user message. Generate a concise inner monologue detailing your emotional state, attention highlights, memories to fetch, and immediate conversational directives.
Format your output as a raw thought log.`
              }

              const firstHopMessages = [
                { role: 'system', content: firstHopSystemPrompt },
                ...newMessages.filter(m => m.role !== 'system'),
              ]

              const firstHopResponse = await llmStore.generate(
                firstHopModelId,
                firstHopProvider as any,
                firstHopMessages as Message[],
                {
                  headers,
                  temperature: 0.7,
                },
              )

              const rawOutput = firstHopResponse.text || ''
              chatLog('[Cognition] Raw 1st-Hop output:', rawOutput)

              let monologueText = ''
              if (processorMode === 'local_nan0') {
                // TODO (Kyo Integration):
                // 1. Run local metabonomics, relationships, and emotional baseline decays first.
                // 2. Parse rawOutput matching the strict token format ([EMOTION], [ATTENTION], [MONOLOGUE], [DECISION]).
                // 3. Extract the inner monologue content to assign to monologueText.
                // 4. Update the character's active emotion and physics levels in the card store.
                // 5. If [DECISION] is SILENCE, abort/silence the assistant turn here.

                // Placeholder parse:
                const monologueMatch = rawOutput.match(/\[MONOLOGUE\]\s*([\s\S]*?)(?:\[DECISION\]|$)/i)
                monologueText = monologueMatch ? monologueMatch[1].trim() : rawOutput
              }
              else {
                // Pass-through: Treat the entire output as the monologue
                monologueText = rawOutput
              }

              if (monologueText.trim()) {
                // Inject the monologue as a system instruction before sending to 2nd LLM
                const system = newMessages.slice(0, 1)
                const afterSystem = newMessages.slice(1)

                newMessages = [
                  ...system,
                  {
                    role: 'system',
                    content: `[INTERNAL MONOLOGUE & ATTENTION DIRECTIVE]\n${monologueText.trim()}`,
                  },
                  ...afterSystem,
                ]
              }
            }
            catch (err) {
              console.error('[Cognition] 1st-Hop pre-pass failed, continuing to 2nd-Hop:', err)
            }
          }
        }

        streamingMessageContext.composedMessage = newMessages as Message[]

        await hooks.emitAfterMessageComposedHooks(sendingMessage, streamingMessageContext)
        await hooks.emitBeforeSendHooks(sendingMessage, streamingMessageContext)

        const headers = (effectiveConfig?.headers || {}) as Record<string, string>
        const generationConfig = activeCard.value?.extensions?.airi?.generation
        const generationKnown = generationConfig?.enabled ? generationConfig.known : undefined
        const abortController = new AbortController()

        const clearStreamIdleTimeout = () => {
          if (streamIdleTimeout)
            clearTimeout(streamIdleTimeout)
        }
        const resetStreamIdleTimeout = () => {
          clearStreamIdleTimeout()
          streamIdleTimeout = setTimeout(() => {
            abortController.abort(new Error('Stream idle timeout exceeded'))
          }, settingsChat.streamIdleTimeoutMs)
        }

        if (shouldAbort())
          return

        resetStreamIdleTimeout()

        const providerModels = providersStore.getModelsForProvider(effectiveProviderId)
        const currentModel = providerModels.find(m => m.id === effectiveModel)
        const isVisionSupported = isVlmTurn || (currentModel?.capabilities?.includes('vision') || false)

        debug(`[ChatDebug] Model: ${effectiveModel}, Provider: ${effectiveProviderId}, Vision Supported: ${isVisionSupported}`)

        await llmStore.stream(effectiveModel, effectiveProvider, newMessages as Message[], {
          headers,
          tools: effectiveTools,
          temperature: generationKnown?.temperature,
          top_p: generationKnown?.topP,
          max_tokens: generationKnown?.maxTokens,
          contextWidth: generationKnown?.contextWidth,
          vision: isVisionSupported,
          requestOverrides: generationConfig?.enabled ? generationConfig.advanced : undefined,
          abortSignal: abortController.signal,
          waitForTools: true,
          onStreamEvent: async (event: StreamEvent) => {
            resetStreamIdleTimeout()
            switch (event.type) {
              case 'tool-call':
                await parser.end()
                await literalInterceptor.end()
                // Re-create the parser and interceptor so that subsequent text-delta calls are not ignored
                parser = createParser()
                literalInterceptor = createLiteralInterceptor()
                toolCallQueue.enqueue({
                  type: 'tool-call',
                  toolCall: event,
                })
                break
              case 'tool-result':
                toolCallQueue.enqueue({
                  type: 'tool-call-result',
                  id: event.toolCallId,
                  result: event.result,
                })
                break
              case 'text-delta': {
                const healedText = healMozibake(event.text)
                // chatLog('text-delta:', healedText)
                fullText += healedText
                rawFullText += healedText
                turnRawContent += healedText
                ;(window as any).electron?.ipcRenderer?.send('llm-raw-output', {
                  type: 'delta',
                  text: healedText,
                  sessionId,
                })

                if (isCheckingNoReply) {
                  noReplyBuffer += healedText
                  const target1 = 'NO_REPLY'
                  const target2 = '[NO_REPLY]'

                  if (target1.startsWith(noReplyBuffer.trimStart()) || target2.startsWith(noReplyBuffer.trimStart())) {
                    // Still perfectly matches the silence sentinel prefix, hold it in buffer
                    break
                  }
                  else {
                    // Diverged from silence sentinel. Release buffer and stop checking.
                    isCheckingNoReply = false
                    await parser.consume(noReplyBuffer)
                    noReplyBuffer = ''
                    break
                  }
                }

                await parser.consume(healedText)
                break
              }
              case 'reasoning-delta': {
                const healedText = healMozibake(event.text)
                if (!(buildingMessage as any).categorization) {
                  ;(buildingMessage as any).categorization = { speech: '', reasoning: '' }
                }
                ;(buildingMessage as any).categorization.reasoning += healedText
                updateUI()
                break
              }
              case 'finish':
                chatLog('Stream finished. Reason:', (event as any).finishReason, 'rawFullText length:', rawFullText.length)
                ;(window as any).electron?.ipcRenderer?.send('llm-raw-output', {
                  type: 'full',
                  text: rawFullText,
                  sessionId,
                })

                // Fallback for Dating Sim: if stream finishes, choices are empty, AND AA is disabled,
                // regenerate choices via the standalone path. When AA is on, the Director pipeline
                // owns choice generation from turn 1+ — don't race with it.
                import('@proj-airi/stage-ui/stores/dating-sim').then(({ useDatingSimStore }) => {
                  const store = useDatingSimStore()
                  const aaEnabled = activeCard.value?.extensions?.airi?.artistry?.autonomousEnabled ?? false
                  if (store.enabled && store.choices.length === 0 && !aaEnabled) {
                    store.generateLiveChoices()
                  }
                }).catch(() => {})
                break
              case 'usage':
                chatLog('usage report:', event.usage)
                const liveSession = useLiveSessionStore()
                liveSession.recordInferenceUsage(event.usage.total_tokens || event.usage.totalTokenCount || event.usage.totalUsage || 0)
                break
              case 'error':
                throw event.error ?? new Error('Stream error')
            }
          },
        })

        if (isCheckingNoReply && noReplyBuffer.trim().length > 0) {
          const rawTrimmed = (rawFullText || '').trim()
          if (rawTrimmed !== 'NO_REPLY' && rawTrimmed !== '[NO_REPLY]') {
            await parser.consume(noReplyBuffer)
          }
        }

        clearStreamIdleTimeout()
        await parser.end()
        await literalInterceptor.end()

        // Wait for all tools (bridged or native) to finish processing for this turn
        await new Promise<void>((resolve) => {
          if (toolCallQueue.length() === 0)
            return resolve()
          toolCallQueue.on('drain', () => resolve())
        })

        // Final attempt to bridge any unclosed markers in the full accumulated text for THIS turn
        if (fullText.includes('<|') || fullText.includes('[call_tool:') || fullText.includes('<tool_call>')) {
          chatLog('Scanning for unclosed tool calls in fullText accumulator')
          let lastRecovered: { matchedText: string, bridged: boolean }
          while ((lastRecovered = await tryBridgeMarker(fullText)).matchedText !== '') {
            chatLog('Successfully processed marker from turn end:', lastRecovered.matchedText, 'Bridged:', lastRecovered.bridged)

            if (lastRecovered.bridged) {
              needsBridgedFollowUp = true
              // Wait for EACH bridged tool to finish so results are ready for Turn 2/3
              await new Promise<void>((resolve) => {
                if (toolCallQueue.length() === 0)
                  return resolve()
                toolCallQueue.on('drain', () => resolve())
              })
            }
            else {
              // If not bridged, we still need to strip it from fullText to avoid infinite loop
              fullText = fullText.replace(lastRecovered.matchedText, '')
            }
          }
        }

        // Commit this turn to history before potentially starting the next turn step
        const currentTurnResults = buildingMessage.tool_results.filter(res =>
          !bridgedTurnsHistory.some(prev => prev.tool_results.some(p => p.id === res.id)),
        )

        bridgedTurnsHistory.push({
          content: turnSpeechContent,
          rawContent: turnRawContent,
          tool_calls: buildingMessage.slices
            .filter(s => s.type === 'tool-call' && currentTurnResults.some(r => r.id === (s as any).toolCall?.id))
            .map(s => (s as any).toolCall),
          tool_results: [...currentTurnResults],
        })

        // Terminal condition check: if no more bridged tools requested a follow-up, we exit
        if (!needsBridgedFollowUp) {
          chatLog('[ChatDebug] No bridged follow-up requested, exiting turn loop.')
          break
        }

        chatLog(`[ChatDebug] Bridged tool(s) executed, triggering turn step ${bridgedSteps + 1}`)
      }

      // Turn loop ended
      const cardFallback = activeCard.value?.extensions?.airi?.generation?.known?.reasoningFallback
      const fallbackActive = cardFallback !== false
      const speechText = typeof buildingMessage.content === 'string' ? buildingMessage.content : ''
      if (!speechText.trim() && (buildingMessage as any).categorization?.reasoning?.trim() && fallbackActive) {
        const fallbackText = (buildingMessage as any).categorization.reasoning
        buildingMessage.content = fallbackText
        fullText = fallbackText
        rawFullText = fallbackText
        if (!(buildingMessage as any).categorization) {
          ;(buildingMessage as any).categorization = { speech: '', reasoning: '' }
        }
        ;(buildingMessage as any).categorization.speech = fallbackText

        // Check if there is no text slice to display, and add one if missing
        const textSlice = buildingMessage.slices.find(s => s.type === 'text')
        if (textSlice && textSlice.type === 'text') {
          textSlice.text = fallbackText
        }
        else {
          buildingMessage.slices.push({
            type: 'text',
            text: fallbackText,
          })
        }
        updateUI()
      }

      // --- NO_REPLY Guard ---
      // If the model explicitly chose to remain silent, we abort downstream processing.
      if ((rawFullText || '').trim() === 'NO_REPLY' || (rawFullText || '').trim() === '[NO_REPLY]') {
        chatLog('[ChatDebug] AI decided to remain silent via NO_REPLY sentinel. Aborting turn completion hooks.')

        if (!isStaleGeneration()) {
          const currentMessages = chatSession.getSessionMessages(sessionId)
          chatSession.setSessionMessages(sessionId, [
            ...currentMessages,
            {
              ...toRaw(buildingMessage),
              role: 'assistant',
              content: 'NO_REPLY',
              rawContent: 'NO_REPLY',
              slices: [],
            } as any,
          ])
        }

        if (isForegroundSession()) {
          streamingMessage.value = { role: 'assistant', content: '', slices: [], tool_results: [] }
        }
        await hooks.emitStreamEndHooks(streamingMessageContext)
        return
      }
      // ----------------------

      // Check if we have any meaningful content to persist
      const hasSlices = buildingMessage.slices.length > 0
      const hasReasoning = !!(buildingMessage as any).categorization?.reasoning?.trim()
      const hasRawOutput = !!rawFullText?.trim()

      if (!isStaleGeneration() && (hasSlices || hasReasoning || hasRawOutput)) {
        // NOTICE: Persist the full raw LLM output (including orchestration tokens like
        // <|ACTOR:|>, <|ACT:|>, <|DELAY:|>) so past turns fed back to the LLM retain
        // the tokens. This prevents behavioral drift where the model stops using tokens
        // because it never sees them in its own history.
        ;(buildingMessage as any).rawContent = rawFullText
        const currentMessages = chatSession.getSessionMessages(sessionId)
        chatSession.setSessionMessages(sessionId, [...currentMessages, toRaw(buildingMessage)])
      }

      // Finalize hooks and analytics
      await hooks.emitStreamEndHooks(streamingMessageContext)
      await hooks.emitAssistantResponseEndHooks(fullText, streamingMessageContext)
      await hooks.emitAfterSendHooks(sendingMessage, streamingMessageContext)
      await hooks.emitAssistantMessageHooks({ ...buildingMessage }, fullText, streamingMessageContext)
      await hooks.emitChatTurnCompleteHooks({
        output: { ...buildingMessage },
        outputText: fullText,
        toolCalls: sessionMessagesForSend.filter(msg => msg.role === 'tool') as ToolMessage[],
      }, streamingMessageContext)

      // --- AUTONOMOUS ARTISTRY HOOK (ASSISTANT-CENTRIC) ---
      const artistry = activeCard.value?.extensions?.airi?.artistry
      if (artistry?.autonomousEnabled && artistry?.autonomousTarget === 'assistant') {
        void artistryAutonomousStore.runArtistTask(fullText, sessionMessagesForSend as any)
      }
      // ---------------------------------------------------

      if (isForegroundSession()) {
        streamingMessage.value = { role: 'assistant', content: '', slices: [], tool_results: [] }
      }
    }
    catch (error: any) {
      console.error('Error sending message:', { sessionId, generation, error })

      let errorMessage = 'An unknown error occurred.'
      let technicalDetail = ''

      if (error && typeof error === 'object') {
        errorMessage = error.message || 'An object error occurred.'

        // Handle XSAIError or similar with response/data info
        try {
          const detail = error.response || error.data || error.body || (error.cause as any)?.response
          if (detail) {
            technicalDetail = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)
          }

          // Best effort: if message itself contains JSON (common in 429s), extract it
          if (errorMessage.includes('{') && errorMessage.includes('}')) {
            const potentialJson = errorMessage.substring(errorMessage.indexOf('{'), errorMessage.lastIndexOf('}') + 1)
            try {
              const parsed = JSON.parse(potentialJson)
              technicalDetail = JSON.stringify(parsed, null, 2)
              // Strip the JSON from the main message for cleaner display
              errorMessage = errorMessage.replace(potentialJson, '').trim()
            }
            catch {}
          }
        }
        catch {}
      }
      else {
        errorMessage = String(error)
      }

      const fullErrorDisplay = `⚠️ **Chat Error**\n\n${errorMessage}${technicalDetail ? `\n\n**Technical Details**:\n\`\`\`json\n${technicalDetail}\n\`\`\`` : ''}`

      // Display in UI: Update content for history AND slices for immediate rendering
      buildingMessage.content += `${buildingMessage.content ? '\n\n' : ''}${fullErrorDisplay}`
      buildingMessage.slices.push({
        type: 'text',
        text: fullErrorDisplay,
      })

      updateUI()

      // Persist to session history if not stale
      if (!isStaleGeneration()) {
        const currentMessages = chatSession.getSessionMessages(sessionId)
        chatSession.setSessionMessages(sessionId, [...currentMessages, { ...toRaw(buildingMessage) }])
      }

      // Emit turn complete with error so downstream consumers (e.g. Discord outbound)
      // can detect and relay failures instead of silently swallowing them.
      try {
        await hooks.emitChatTurnCompleteHooks({
          output: { ...buildingMessage, error: { message: errorMessage, detail: technicalDetail } } as any,
          outputText: String(buildingMessage.content || ''),
          toolCalls: [],
        } as any, streamingMessageContext)
      }
      catch (hookErr) {
        console.error('Error in turn-complete hooks (error path):', hookErr)
      }

      throw error
    }
    finally {
      if (streamIdleTimeout)
        clearTimeout(streamIdleTimeout)
      sending.value = false
    }
  }

  async function ingest(
    sendingMessage: string,
    options: SendOptions = {},
    targetSessionId?: string,
  ) {
    const sessionId = targetSessionId || activeSessionId.value
    chatLog('Ingesting message:', { sendingMessage, sessionId, sending: sending.value })

    if (!isMainWindow) {
      if (options.triggerOnly) {
        debug(`[IngestDebug] Secondary window ingesting with triggerOnly. Bypassing verification loop.`)
        postInput({
          sendingMessage,
          options: {
            ...options,
            chatProvider: typeof options.chatProvider === 'string' ? options.chatProvider : undefined,
            tools: undefined,
          },
          targetSessionId: sessionId,
        })
        return Promise.resolve()
      }

      const clientMessageId = nanoid()
      debug(`[IngestDebug] Secondary window ingesting. clientMessageId: ${clientMessageId}. Target session: ${sessionId}`)
      const metadata = { ...options.metadata, clientMessageId }

      return new Promise<void>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let stopWatch: (() => void) | null = null

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          if (stopWatch) {
            stopWatch()
            stopWatch = null
          }
        }

        // Wait up to 5 seconds for the message to be sync-broadcasted back
        timeoutId = setTimeout(() => {
          cleanup()
          console.error(`[IngestDebug] TIMEOUT waiting for clientMessageId: ${clientMessageId}`)
          reject(new Error('Ingestion timeout: main process did not acknowledge the message.'))
        }, 5000)

        stopWatch = watch(
          () => {
            const msgs = chatSession.getSessionMessages(sessionId)
            debug(`[IngestDebug] Watcher getter ran. Target messages count: ${msgs.length}`)
            return msgs
          },
          (messages) => {
            debug(`[IngestDebug] Watcher callback triggered. Messages length: ${messages.length}`)
            const found = messages.some((m) => {
              const clientMsgId = (m as any).clientMessageId || (m as any).metadata?.clientMessageId
              const matched = clientMsgId === clientMessageId
              debug(`[IngestDebug] Checking msg in history:`, { id: m.id, role: m.role, clientMsgId, matched })
              return matched
            })
            if (found) {
              debug(`[IngestDebug] Found matching clientMessageId: ${clientMessageId}! Resolving promise.`)
              cleanup()
              resolve()
            }
          },
          { immediate: true, deep: true },
        )

        postInput({
          sendingMessage,
          options: {
            ...options,
            chatProvider: typeof options.chatProvider === 'string' ? options.chatProvider : undefined,
            tools: undefined,
            metadata,
          },
          targetSessionId: sessionId,
        })
      })
    }

    const liveSessionStore = useLiveSessionStore()
    if (liveSessionStore.isActive) {
      chatLog('Gemini Live is active in main window. Routing text through Live Session.')
      liveSessionStore.sendText(sendingMessage)
      return Promise.resolve()
    }

    const generation = chatSession.getSessionGeneration(sessionId)

    return new Promise<void>((resolve, reject) => {
      sendQueue.enqueue({
        sendingMessage,
        options,
        generation,
        sessionId,
        deferred: { resolve, reject },
      })
    })
  }

  async function ingestOnFork(
    sendingMessage: string,
    options: SendOptions,
    forkOptions?: ForkOptions,
  ) {
    const baseSessionId = forkOptions?.fromSessionId ?? activeSessionId.value
    if (!forkOptions)
      return ingest(sendingMessage, options, baseSessionId)

    const forkSessionId = await chatSession.forkSession({
      fromSessionId: baseSessionId,
      atIndex: forkOptions.atIndex,
      reason: forkOptions.reason,
      hidden: forkOptions.hidden,
    })
    return ingest(sendingMessage, options, forkSessionId || baseSessionId)
  }

  function cancelPendingSends(sessionId?: string) {
    for (const queued of pendingQueuedSends.value) {
      if (sessionId && queued.sessionId !== sessionId)
        continue

      queued.cancelled = true
      queued.deferred.reject(new Error('Chat session was reset before send could start'))
    }

    pendingQueuedSends.value = sessionId
      ? pendingQueuedSends.value.filter(item => item.sessionId !== sessionId)
      : []
  }

  return {
    sending,
    streamingMessage,

    activeSpokenText,
    activeSpokenColor,

    isMainWindow,
    toolsResolver,
    setToolsResolver,

    ingest,
    ingestOnFork,
    cancelPendingSends,

    clearHooks: hooks.clearHooks,

    emitBeforeMessageComposedHooks: hooks.emitBeforeMessageComposedHooks,
    emitAfterMessageComposedHooks: hooks.emitAfterMessageComposedHooks,
    emitBeforeSendHooks: hooks.emitBeforeSendHooks,
    emitAfterSendHooks: hooks.emitAfterSendHooks,
    emitTokenLiteralHooks: hooks.emitTokenLiteralHooks,
    emitTokenSpecialHooks: hooks.emitTokenSpecialHooks,
    emitStreamEndHooks: hooks.emitStreamEndHooks,
    emitAssistantResponseEndHooks: hooks.emitAssistantResponseEndHooks,
    emitAssistantMessageHooks: hooks.emitAssistantMessageHooks,
    emitChatTurnCompleteHooks: hooks.emitChatTurnCompleteHooks,

    onBeforeMessageComposed: hooks.onBeforeMessageComposed,
    onAfterMessageComposed: hooks.onAfterMessageComposed,
    onBeforeSend: hooks.onBeforeSend,
    onAfterSend: hooks.onAfterSend,
    onTokenLiteral: hooks.onTokenLiteral,
    onTokenSpecial: hooks.onTokenSpecial,
    onStreamEnd: hooks.onStreamEnd,
    onAssistantResponseEnd: hooks.onAssistantResponseEnd,
    onAssistantMessage: hooks.onAssistantMessage,
    onChatTurnComplete: hooks.onChatTurnComplete,
    onWidget: hooks.onWidget,
  }
})
