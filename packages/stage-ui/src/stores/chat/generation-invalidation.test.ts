import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useLLM } from '../llm'
import { useChatSessionStore } from './session-store'
import { useChatStreamStore } from './stream-store'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../modules/airi-card', () => {
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

describe('chat orchestrator generation invalidation contracts (S1-S3)', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  // S3.1: Generation invalidation via Stop drops non-cooperative late callbacks
  it('s3.1: drops non-cooperative late callbacks arriving after user Stop and prevents state corruption', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const chatStream = useChatStreamStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-s3-stop'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let emitTokenDelta: (text: string) => Promise<void>
    let resolveStream: () => void

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      emitTokenDelta = async (text: string) => {
        await options.onStreamEvent({
          type: 'text-delta',
          text,
        })
      }

      await new Promise<void>((resolve) => {
        resolveStream = resolve
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    // Start generation
    const ingestPromise = chatStore.ingest('Explain black holes', { triggerOnly: false }, sessionId)

    await vi.waitFor(() => {
      expect(emitTokenDelta).toBeDefined()
      expect(chatStore.sending).toBe(true)
    })

    // Emit initial valid content
    await emitTokenDelta!('Black holes are regions of spacetime where gravity is extremely strong.')
    await vi.waitFor(() => {
      expect(chatStream.streamingMessage.content).toContain('Black holes are regions of spacetime')
    })

    // User calls stopCurrentGeneration
    await chatStore.stopCurrentGeneration(sessionId)

    // Capture the persisted partial state at the exact moment of Stop
    const messagesAtStop = chatSession.getSessionMessages(sessionId)
    const partialAssistant = messagesAtStop.find(m => m.role === 'assistant')
    expect(partialAssistant).toBeDefined()
    expect((partialAssistant as any)?.aborted).toBe(true)
    const capturedPartialContent = partialAssistant?.content

    // SIMULATE NON-COOPERATIVE PROVIDER / LATE TRANSPORT CALLBACK:
    // Provider fails to honor abortSignal immediately and fires another token event
    await emitTokenDelta!(' LATE NON-COOPERATIVE TOKEN CHUNK THAT MUST BE DROPPED.')

    // Verify late chunk was completely ignored by UI stream
    expect(chatStream.streamingMessage.content).not.toContain('LATE NON-COOPERATIVE')

    // Resolve underlying stream promise and wait for ingest to settle
    resolveStream!()
    await ingestPromise

    // Verify persisted session messages were NOT corrupted or overwritten by the late callback
    const finalMessages = chatSession.getSessionMessages(sessionId)
    const finalAssistant = finalMessages.find(m => m.role === 'assistant')
    expect(finalAssistant?.content).toBe(capturedPartialContent)
    expect(finalAssistant?.content).not.toContain('LATE NON-COOPERATIVE')
    expect((finalAssistant as any)?.aborted).toBe(true)
  })

  // S3.2: Generation invalidation via Session Reset drops late callbacks without persisting
  it('s3.2: drops late callbacks arriving after session reset without persisting corrupted message', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const chatStream = useChatStreamStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-s3-reset'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let emitTokenDelta: (text: string) => Promise<void>
    let resolveStream: () => void

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      emitTokenDelta = async (text: string) => {
        await options.onStreamEvent({
          type: 'text-delta',
          text,
        })
      }

      await new Promise<void>((resolve) => {
        resolveStream = resolve
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    const ingestPromise = chatStore.ingest('Initial query before reset', { triggerOnly: false }, sessionId)

    await vi.waitFor(() => {
      expect(emitTokenDelta).toBeDefined()
      expect(chatStore.sending).toBe(true)
    })

    await emitTokenDelta!('Some preliminary content...')

    // Invalidate session generation directly (simulating session reset / purge)
    chatSession.bumpSessionGeneration(sessionId)

    // Late token delivery arrives from in-flight stream after reset
    await emitTokenDelta!(' Stray token after session generation was bumped.')

    // Complete stream
    resolveStream!()
    await ingestPromise

    // Session history must NOT have an assistant message persisted from the stale generation
    const messages = chatSession.getSessionMessages(sessionId)
    const assistantMsg = messages.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeUndefined()

    // Streaming UI state must be cleared
    expect(chatStream.streamingMessage.content).toBe('')
  })

  // S1 & S2: Navigation vs Invalidation: Navigation preserves generation validity
  it('s1 & S2: distinguishes navigation from invalidation (navigation maintains generation validity)', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const chatStream = useChatStreamStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionA = 'session-nav-a'
    const sessionB = 'session-nav-b'

    chatSession.activeSessionId = sessionA
    chatSession.setSessionMessages(sessionA, [])
    chatSession.setSessionMessages(sessionB, [])

    let emitTokenDelta: (text: string) => Promise<void>
    let resolveStream: () => void

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      emitTokenDelta = async (text: string) => {
        await options.onStreamEvent({
          type: 'text-delta',
          text,
        })
      }

      await new Promise<void>((resolve) => {
        resolveStream = resolve
      })
    })

    const ingestPromise = chatStore.ingest('Long story', { triggerOnly: false }, sessionA)

    await vi.waitFor(() => {
      expect(emitTokenDelta).toBeDefined()
    })

    await emitTokenDelta!('Chapter 1 while on Session A.')
    await vi.waitFor(() => {
      expect(chatStream.streamingMessage.content).toContain('Chapter 1')
    })

    // S1: Navigate to Session B - does NOT invalidate generation!
    chatSession.activeSessionId = sessionB
    expect(chatStream.streamingMessage.content).toBe('')

    // Emit Chapter 2 while user is viewing Session B
    await emitTokenDelta!(' Chapter 2 while viewing Session B.')

    // S2: Navigate back to Session A - restores live stream state
    chatSession.activeSessionId = sessionA
    expect(chatStream.streamingMessage.content).toContain('Chapter 1')
    expect(chatStream.streamingMessage.content).toContain('Chapter 2')

    // Finish stream
    resolveStream!()
    await ingestPromise

    // Final message in Session A has both chapters
    const historyA = chatSession.getSessionMessages(sessionA)
    const assistantA = historyA.find(m => m.role === 'assistant')
    expect(assistantA?.content).toContain('Chapter 1')
    expect(assistantA?.content).toContain('Chapter 2')
  })
})
