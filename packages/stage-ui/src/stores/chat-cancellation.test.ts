import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from './chat'
import { useChatSessionStore } from './chat/session-store'
import { useLLM } from './llm'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('./modules/airi-card', () => {
  const card = {
    name: 'Airi',
    extensions: { airi: {} },
  }
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

vi.mock('./providers', () => ({
  useProvidersStore: () => ({
    getProviderInstance: vi.fn(async () => ({})),
    getProviderConfig: vi.fn(() => ({})),
    getModelsForProvider: vi.fn(() => [{ id: 'test-model', capabilities: [] }]),
  }),
}))

vi.mock('./modules/consciousness', () => ({
  useConsciousnessStore: () => ({
    activeProvider: ref('test-provider'),
    activeModel: ref('test-model'),
  }),
}))

vi.mock('./modules/vision', () => ({
  useVisionStore: () => ({
    activeProvider: null,
    activeModel: null,
    promptShimDirect: '',
  }),
}))

describe('chat cancellation lifecycle', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  it('stops in-flight generation, aborts LLM stream, and marks partial reply as aborted', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    // Ensure active session
    const sessionId = 'test-session-1'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let streamAbortSignal: AbortSignal | undefined
    let resolveStreamPromise: () => void

    // Mock stream to stay alive until abort
    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      streamAbortSignal = options.abortSignal
      // Emit first token delta with enough length to satisfy minLiteralEmitLength (>= 30 chars)
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Hello, I am processing your request right now. Please wait a moment.',
      })

      // Keep stream pending until abort or manual resolve
      await new Promise<void>((resolve) => {
        resolveStreamPromise = resolve
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    const generationStoppedSpy = vi.fn()
    chatStore.onGenerationStopped(async () => {
      generationStoppedSpy()
    })

    // Start ingestion in background
    const ingestPromise = chatStore.ingest('Hi there', { triggerOnly: false })

    // Wait for performSend to enter streaming state and start LLM stream
    await vi.waitFor(() => {
      expect(streamAbortSignal).toBeDefined()
      expect(chatStore.sending).toBe(true)
    }, { timeout: 2000 })
    expect(chatStore.canStop).toBe(true)

    // Now call stopCurrentGeneration
    await chatStore.stopCurrentGeneration(sessionId)

    // Await stream resolution and ingestion completion
    resolveStreamPromise!()
    await ingestPromise

    // Verify signal aborted
    expect(streamAbortSignal?.aborted).toBe(true)

    // Verify onGenerationStopped hook was called
    expect(generationStoppedSpy).toHaveBeenCalledTimes(1)

    // Verify chatStore state cleaned up
    expect(chatStore.sending).toBe(false)
    expect(chatStore.isSpeaking).toBe(false)

    // Verify partial message persisted with aborted: true
    const messages = chatSession.getSessionMessages(sessionId)
    const assistantMsg = messages.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect((assistantMsg as any)?.aborted).toBe(true)
    expect(assistantMsg?.content).toContain('Hello, I am processing your')
  })

  it('emits onGenerationStopped hook and resets speech when stopped after LLM stream completed', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)

    const sessionId = 'test-session-post-llm'
    chatSession.activeSessionId = sessionId

    // Simulate LLM streaming has already concluded (sending is false), but speech is active
    chatStore.sending = false
    chatStore.isSpeaking = true

    expect(chatStore.canStop).toBe(true)

    const generationStoppedSpy = vi.fn()
    chatStore.onGenerationStopped(async (context) => {
      generationStoppedSpy(context)
    })

    // User presses Stop while TTS is speaking after LLM completed
    await chatStore.stopCurrentGeneration(sessionId)

    // Verify hook emitted even though no activeSendHandles existed
    expect(generationStoppedSpy).toHaveBeenCalledTimes(1)
    expect(generationStoppedSpy).toHaveBeenCalledWith(expect.objectContaining({
      session: { id: sessionId },
    }))

    // Verify isSpeaking was reset
    expect(chatStore.isSpeaking).toBe(false)
    expect(chatStore.canStop).toBe(false)
  })

  it('relays stop request to main window when invoked from secondary window', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)

    const sessionId = 'secondary-session'
    chatSession.activeSessionId = sessionId

    // Simulate secondary window
    chatStore.isMainWindow = false

    await chatStore.stopCurrentGeneration(sessionId)

    expect(chatStore.sending).toBe(false)
  })
})
