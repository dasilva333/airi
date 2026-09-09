import type { ChatInputBridgeMessagePayload, ChatInputBridgePayload } from './input-bridge'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useLLM } from '../llm'
import {

  INGESTION_TIMEOUT_MS,
} from './input-bridge'
import { useChatSessionStore } from './session-store'

// Controlled environment flags and broadcast transport
let mockIsTamagotchi = true
let mockPostThrows: Error | null = null
const mockBridgeData = ref<ChatInputBridgePayload | null>(null)
const mockBridgePost = vi.fn((payload: ChatInputBridgePayload) => {
  if (mockPostThrows) {
    throw mockPostThrows
  }
})

vi.mock('@proj-airi/stage-shared', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@proj-airi/stage-shared')>()
  return {
    ...mod,
    isStageTamagotchi: () => mockIsTamagotchi,
  }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...mod,
    useBroadcastChannel: (options: { name: string }) => {
      if (options.name === 'airi-chat-input-bridge') {
        return {
          data: mockBridgeData,
          post: mockBridgePost,
          isSupported: ref(true),
          close: vi.fn(),
        }
      }
      return mod.useBroadcastChannel(options)
    },
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../modules/airi-card', () => {
  const card = { name: 'Airi', extensions: { airi: {} } }
  return {
    useAiriCardStore: () => ({
      activeCard: ref(card),
      activeCardId: ref('card-airi'),
      systemPrompt: ref(''),
      isModelSyncPrevented: false,
      getCard: vi.fn(() => card),
      updateCard: vi.fn(),
    }),
  }
})

vi.mock('../providers', () => ({
  useProvidersStore: () => ({
    getProviderInstance: vi.fn(async () => ({})),
    getProviderConfig: vi.fn(() => ({})),
    getModelsForProvider: vi.fn(() => [{ id: 'test-model', capabilities: [] }]),
  }),
}))

vi.mock('../modules/consciousness', () => ({
  useConsciousnessStore: () => ({
    activeProvider: ref('test-provider'),
    activeModel: ref('test-model'),
  }),
}))

vi.mock('../modules/vision', () => ({
  useVisionStore: () => ({
    activeProvider: null,
    activeModel: null,
    promptShimDirect: '',
  }),
}))

vi.mock('../background', () => ({
  useBackgroundStore: () => ({
    currentBackground: ref(null),
    initializeStore: vi.fn(),
  }),
}))

describe('chat input bridge runtime relay & lifecycle contracts', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    mockIsTamagotchi = true
    mockPostThrows = null
    mockBridgeData.value = null
    mockBridgePost.mockClear()
    window.location.hash = '#/chat'

    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // Test 1: Successful echo resolves and removes watcher/timer
  it('secondary window: successful echo resolves ingest promise and cleans up watcher and timer', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)

    const sessionId = 'session-echo-success'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let resolved = false
    const ingestPromise = chatStore.ingest('Hello from secondary window', {}, sessionId).then(() => {
      resolved = true
    })

    // Bridge message should have been posted
    expect(mockBridgePost).toHaveBeenCalledOnce()
    const postedPayload = mockBridgePost.mock.calls[0][0] as ChatInputBridgeMessagePayload
    const clientMessageId = postedPayload.options?.metadata?.clientMessageId
    expect(clientMessageId).toBeDefined()
    expect(resolved).toBe(false)

    // Simulate main window appending the acknowledged message into history
    chatSession.setSessionMessages(sessionId, [
      {
        id: 'msg-echo-1',
        role: 'user',
        content: 'Hello from secondary window',
        metadata: { clientMessageId },
      } as any,
    ])

    await nextTick()
    await ingestPromise
    expect(resolved).toBe(true)

    // Advancing past 5 seconds must NOT reject or log a timeout
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await vi.advanceTimersByTimeAsync(INGESTION_TIMEOUT_MS + 1000)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  // Test 2: Timeout rejects and removes both watcher and timer
  it('secondary window: timeout rejects ingest promise after 5000ms and cleans up', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)

    const sessionId = 'session-timeout'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let rejectionError: Error | null = null
    const ingestPromise = chatStore.ingest('Unacknowledged message', {}, sessionId).catch((err) => {
      rejectionError = err
    })

    expect(mockBridgePost).toHaveBeenCalledOnce()
    expect(rejectionError).toBeNull()

    // Advance timers by INGESTION_TIMEOUT_MS
    await vi.advanceTimersByTimeAsync(INGESTION_TIMEOUT_MS)
    await ingestPromise

    expect(rejectionError).toBeDefined()
    expect(rejectionError!.message).toContain('Ingestion timeout: main process did not acknowledge the message.')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[IngestDebug] TIMEOUT'))
  })

  // Test 3: Serialization or post failure cleans up immediately without leaving 5s timer
  it('secondary window: transport failure cleans up immediately and rejects without leaving hanging timer', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)

    const sessionId = 'session-post-failure'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    // Simulate transport error during post
    mockPostThrows = new Error('BroadcastChannel pipe broken')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let rejectionError: Error | null = null
    const ingestPromise = chatStore.ingest('Failing message', {}, sessionId).catch((err) => {
      rejectionError = err
    })

    // Ingest should reject immediately
    await ingestPromise
    expect(rejectionError).toBeDefined()
    expect(rejectionError!.message).toBe('BroadcastChannel pipe broken')

    // Advance past timeout window; verify no secondary timeout callback fires
    await vi.advanceTimersByTimeAsync(INGESTION_TIMEOUT_MS + 1000)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  // Test 4: Trigger-only messages post without installing acknowledgment machinery
  it('secondary window: triggerOnly messages post immediately without installing acknowledgment timer or watcher', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)

    const sessionId = 'session-trigger-only'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Ingest with triggerOnly
    const ingestPromise = chatStore.ingest('', { triggerOnly: true }, sessionId)

    // Must resolve immediately
    await expect(ingestPromise).resolves.toBeUndefined()
    expect(mockBridgePost).toHaveBeenCalledOnce()
    const postedPayload = mockBridgePost.mock.calls[0][0] as ChatInputBridgeMessagePayload
    expect(postedPayload.options?.triggerOnly).toBe(true)
    // Should not even need a clientMessageId
    expect(postedPayload.options?.metadata?.clientMessageId).toBeUndefined()

    // Advancing timers should produce no timeout or errors
    await vi.advanceTimersByTimeAsync(INGESTION_TIMEOUT_MS + 1000)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  // Test 5: Only main window dispatches; switches target session before ingestion and supplies own tools
  it('main window: receives broadcast message, aligns session if divergent, and injects local tools', async () => {
    // Configure main window environment
    mockIsTamagotchi = false
    window.location.hash = '#/'

    const mainPinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(mainPinia)

    const chatStore = useChatOrchestratorStore(mainPinia)
    const chatSession = useChatSessionStore(mainPinia)
    const llmStore = useLLM(mainPinia)

    // Mock llm stream
    let capturedOptions: any = null
    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      capturedOptions = options
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Stream response',
      })
    })

    // Main window active session is session-main-active
    chatSession.activeSessionId = 'session-main-active'
    chatSession.setSessionMessages('session-secondary-target', [])
    const setActiveSessionSpy = vi.spyOn(chatSession, 'setActiveSession')

    // Set local toolsResolver in main window
    const localTools = [{ name: 'local_tool_a', execute: vi.fn() }]
    chatStore.setToolsResolver(localTools)

    // Simulate inbound message from secondary window targeting session-secondary-target
    mockBridgeData.value = {
      sendingMessage: 'Inbound bridged query',
      targetSessionId: 'session-secondary-target',
      options: { model: 'test-model' },
    }

    await nextTick()

    // Must have switched session before ingestion
    expect(setActiveSessionSpy).toHaveBeenCalledWith('session-secondary-target')

    // Wait for LLM stream to be dispatched
    await vi.waitFor(() => {
      expect(llmStore.stream).toHaveBeenCalledOnce()
    })

    // Verify main window injected its own local tools into the stream
    expect(capturedOptions).toBeDefined()
    expect(capturedOptions.tools).toEqual(localTools)
  })

  // Test 6: Stop reaches cancellation with correct session ID
  it('secondary window relays stop command; main window receives and cancels correct session', async () => {
    // Phase A: Secondary window sends stop
    mockIsTamagotchi = true
    window.location.hash = '#/chat'

    const secondaryPinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(secondaryPinia)

    const secondaryChatStore = useChatOrchestratorStore(secondaryPinia)
    await secondaryChatStore.stopCurrentGeneration('session-to-cancel')

    expect(mockBridgePost).toHaveBeenCalledWith({
      type: 'stop',
      targetSessionId: 'session-to-cancel',
    })

    // Phase B: Main window receives stop and cancels active generation for that session
    mockIsTamagotchi = false
    window.location.hash = '#/'
    const mainPinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(mainPinia)

    const mainChatStore = useChatOrchestratorStore(mainPinia)
    const mainChatSession = useChatSessionStore(mainPinia)
    const llmStore = useLLM(mainPinia)

    const sessionId = 'session-to-cancel'
    mainChatSession.activeSessionId = sessionId
    mainChatSession.setSessionMessages(sessionId, [])

    let aborted = false
    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      options.abortSignal?.addEventListener('abort', () => {
        aborted = true
      })
      await new Promise<void>((resolve) => {
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    // Start an in-flight send in main window
    const sendPromise = mainChatStore.ingest('Long story', {}, sessionId)

    await vi.waitFor(() => {
      expect(mainChatStore.sending).toBe(true)
    })

    // Deliver stop payload to main window via bridge
    mockBridgeData.value = {
      type: 'stop',
      targetSessionId: sessionId,
    }

    await nextTick()

    // Verify generation was cancelled via abortSignal and sending state settled
    await vi.waitFor(() => {
      expect(aborted).toBe(true)
      expect(mainChatStore.sending).toBe(false)
    })

    await sendPromise
  })
})
