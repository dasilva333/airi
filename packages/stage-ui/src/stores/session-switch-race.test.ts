import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from './chat'
import { useChatSessionStore } from './chat/session-store'
import { useChatStreamStore } from './chat/stream-store'
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

describe('session switching during active generation', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  it('does not leak streaming tokens into the newly selected session and commits messages to the originating session', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const chatStream = useChatStreamStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionA = 'session-alpha'
    const sessionB = 'session-beta'

    chatSession.activeSessionId = sessionA
    chatSession.setSessionMessages(sessionA, [])
    chatSession.setSessionMessages(sessionB, [])

    let emitTokenDelta: (text: string) => Promise<void>
    let endStream: () => void

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      emitTokenDelta = async (text: string) => {
        await options.onStreamEvent({
          type: 'text-delta',
          text,
        })
      }

      await new Promise<void>((resolve) => {
        endStream = resolve
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    // Ingest user message in Session A
    const ingestPromise = chatStore.ingest('Tell me a story', { triggerOnly: false }, sessionA)

    // Wait for LLM stream to start
    await vi.waitFor(() => {
      expect(emitTokenDelta).toBeDefined()
      expect(chatStore.sending).toBe(true)
    }, { timeout: 2000 })

    // Emit first chunk while Session A is in foreground
    await emitTokenDelta!('First paragraph of story with enough length to pass minLiteralEmitLength threshold.')

    // UI in Session A displays streaming content
    await vi.waitFor(() => {
      expect(chatStream.streamingMessage.content).toContain('First paragraph of story')
    }, { timeout: 2000 })

    // Now user switches to Session B
    chatSession.activeSessionId = sessionB

    // Verify Session B immediately has a clean, empty streamingMessage
    expect(chatStream.streamingMessage.content).toBe('')
    expect(chatStream.streamingMessage.slices).toEqual([])

    // Emit second chunk for Session A while Session B is active in the foreground
    await emitTokenDelta!(' Second paragraph continuing the tale while user is in Session B.')

    // Verify Session B's UI does NOT leak tokens from Session A
    expect(chatStream.streamingMessage.content).toBe('')
    expect(chatStream.streamingMessage.slices).toEqual([])

    // Finish Session A's LLM stream
    endStream!()
    await ingestPromise

    // Verify that Session A has user message and completed assistant reply
    const messagesA = chatSession.getSessionMessages(sessionA)
    const userMsgA = messagesA.find(m => m.role === 'user')
    const assistantMsgA = messagesA.find(m => m.role === 'assistant')

    expect(userMsgA).toBeDefined()
    expect(userMsgA?.content).toContain('Tell me a story')

    expect(assistantMsgA).toBeDefined()
    expect(assistantMsgA?.content).toContain('First paragraph of story')
    expect(assistantMsgA?.content).toContain('Second paragraph continuing the tale')

    // Verify that Session B remains completely untouched
    const messagesB = chatSession.getSessionMessages(sessionB)
    expect(messagesB.length).toBe(0)
  })

  it('restores in-flight streamingMessage when switching back to a session that is still generating', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const chatStream = useChatStreamStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionA = 'session-a-resync'
    const sessionB = 'session-b-idle'

    chatSession.activeSessionId = sessionA
    chatSession.setSessionMessages(sessionA, [])
    chatSession.setSessionMessages(sessionB, [])

    let emitTokenDelta: (text: string) => Promise<void>
    let endStream: () => void

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      emitTokenDelta = async (text: string) => {
        await options.onStreamEvent({
          type: 'text-delta',
          text,
        })
      }

      await new Promise<void>((resolve) => {
        endStream = resolve
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    const ingestPromise = chatStore.ingest('Explain quantum physics', { triggerOnly: false }, sessionA)

    await vi.waitFor(() => {
      expect(emitTokenDelta).toBeDefined()
    }, { timeout: 2000 })

    await emitTokenDelta!('Quantum entanglement is a phenomenon where particles become correlated.')
    await vi.waitFor(() => {
      expect(chatStream.streamingMessage.content).toContain('Quantum entanglement')
    }, { timeout: 2000 })

    // Switch to Session B
    chatSession.activeSessionId = sessionB
    expect(chatStream.streamingMessage.content).toBe('')

    // Switch back to Session A while stream is still running
    chatSession.activeSessionId = sessionA

    // Verify streamingMessage was restored from the in-flight send handle!
    expect(chatStream.streamingMessage.content).toContain('Quantum entanglement')

    // Emit more tokens now that Session A is back in foreground
    await emitTokenDelta!(' When measured, the state of one instantly determines the other.')
    await vi.waitFor(() => {
      expect(chatStream.streamingMessage.content).toContain('When measured, the state of one')
    }, { timeout: 2000 })

    endStream!()
    await ingestPromise

    const messagesA = chatSession.getSessionMessages(sessionA)
    const assistantMsgA = messagesA.find(m => m.role === 'assistant')
    expect(assistantMsgA).toBeDefined()
    expect(assistantMsgA?.content).toContain('instantly determines the other')
  })
})
