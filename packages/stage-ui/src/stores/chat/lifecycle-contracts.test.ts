import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useLLM } from '../llm'
import { useChatSessionStore } from './session-store'

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

describe('chat orchestrator lifecycle contracts and hook traces', () => {
  let pinia: ReturnType<typeof createTestingPinia>
  let cleanups: Array<() => void> = []

  beforeEach(() => {
    cleanups = []
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup()
    }
    cleanups = []
  })

  // Branch 1: Ordinary Successful Turn
  it('emits hooks in deterministic sequence for ordinary successful turn', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-lifecycle-normal'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const hookTrace: string[] = []

    cleanups.push(chatStore.onBeforeMessageComposed(async () => {
      hookTrace.push('beforeMessageComposed')
    }))
    cleanups.push(chatStore.onAfterMessageComposed(async () => {
      hookTrace.push('afterMessageComposed')
    }))
    cleanups.push(chatStore.onBeforeSend(async () => {
      hookTrace.push('beforeSend')
    }))
    cleanups.push(chatStore.onTokenLiteral(async () => {
      hookTrace.push('tokenLiteral')
    }))
    cleanups.push(chatStore.onStreamEnd(async () => {
      hookTrace.push('streamEnd')
    }))
    cleanups.push(chatStore.onAssistantResponseEnd(async () => {
      hookTrace.push('assistantResponseEnd')
    }))
    cleanups.push(chatStore.onAfterSend(async () => {
      hookTrace.push('afterSend')
    }))
    cleanups.push(chatStore.onAssistantMessage(async () => {
      hookTrace.push('assistantMessage')
    }))
    cleanups.push(chatStore.onChatTurnComplete(async () => {
      hookTrace.push('chatTurnComplete')
    }))

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'This is a complete sentence that exceeds thirty characters for speech literals.',
      })
    })

    await chatStore.ingest('Hello Airi', { triggerOnly: false }, sessionId)

    // Verify ordering: beforeMessageComposed -> afterMessageComposed -> beforeSend -> tokenLiteral -> streamEnd -> assistantResponseEnd -> afterSend -> assistantMessage -> chatTurnComplete
    expect(hookTrace[0]).toBe('beforeMessageComposed')
    expect(hookTrace[1]).toBe('afterMessageComposed')
    expect(hookTrace[2]).toBe('beforeSend')
    expect(hookTrace).toContain('tokenLiteral')
    const lastSix = hookTrace.slice(-5)
    expect(lastSix).toEqual([
      'streamEnd',
      'assistantResponseEnd',
      'afterSend',
      'assistantMessage',
      'chatTurnComplete',
    ])
  })

  // Branch 2: User Stop with Active Handle
  it('emits generationStopped before streamEnd on user Stop and suppresses post-send hooks', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-lifecycle-stop'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const hookTrace: string[] = []

    cleanups.push(chatStore.onBeforeMessageComposed(async () => {
      hookTrace.push('beforeMessageComposed')
    }))
    cleanups.push(chatStore.onGenerationStopped(async () => {
      hookTrace.push('generationStopped')
    }))
    cleanups.push(chatStore.onStreamEnd(async () => {
      hookTrace.push('streamEnd')
    }))
    cleanups.push(chatStore.onAssistantResponseEnd(async () => {
      hookTrace.push('assistantResponseEnd')
    }))
    cleanups.push(chatStore.onAfterSend(async () => {
      hookTrace.push('afterSend')
    }))
    cleanups.push(chatStore.onChatTurnComplete(async () => {
      hookTrace.push('chatTurnComplete')
    }))

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Stream starts and then will be interrupted.',
      })
      await new Promise<void>((_resolve, reject) => {
        // Real fetch/transport stream rejects with AbortError when signal fires
        options.abortSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'))
        }, { once: true })
      })
    })

    const ingestPromise = chatStore.ingest('Start stream', { triggerOnly: false }, sessionId)

    await vi.waitFor(() => {
      expect(chatStore.sending).toBe(true)
    })

    await chatStore.stopCurrentGeneration(sessionId)
    await ingestPromise

    // generationStopped MUST precede streamEnd and assistantResponseEnd
    expect(hookTrace).toEqual([
      'beforeMessageComposed',
      'generationStopped',
      'streamEnd',
      'assistantResponseEnd',
    ])

    // Must NOT manufacture normal completion hooks
    expect(hookTrace).not.toContain('afterSend')
    expect(hookTrace).not.toContain('chatTurnComplete')
  })

  // Branch 3: Exact NO_REPLY Sentinel
  it('suppresses speech and completion hooks when model yields NO_REPLY sentinel', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-lifecycle-noreply'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const hookTrace: string[] = []

    cleanups.push(chatStore.onBeforeMessageComposed(async () => {
      hookTrace.push('beforeMessageComposed')
    }))
    cleanups.push(chatStore.onAfterMessageComposed(async () => {
      hookTrace.push('afterMessageComposed')
    }))
    cleanups.push(chatStore.onBeforeSend(async () => {
      hookTrace.push('beforeSend')
    }))
    cleanups.push(chatStore.onTokenLiteral(async () => {
      hookTrace.push('tokenLiteral')
    }))
    cleanups.push(chatStore.onStreamEnd(async () => {
      hookTrace.push('streamEnd')
    }))
    cleanups.push(chatStore.onAssistantResponseEnd(async () => {
      hookTrace.push('assistantResponseEnd')
    }))
    cleanups.push(chatStore.onChatTurnComplete(async () => {
      hookTrace.push('chatTurnComplete')
    }))

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: '[NO_REPLY]',
      })
    })

    await chatStore.ingest('Idle check', { triggerOnly: false }, sessionId)

    // Only streamEnd is emitted; assistantResponseEnd and chatTurnComplete are suppressed
    expect(hookTrace).toEqual([
      'beforeMessageComposed',
      'afterMessageComposed',
      'beforeSend',
      'streamEnd',
    ])
    expect(hookTrace).not.toContain('tokenLiteral')
    expect(hookTrace).not.toContain('assistantResponseEnd')
    expect(hookTrace).not.toContain('chatTurnComplete')

    // Session history persists the silent representation
    const messages = chatSession.getSessionMessages(sessionId)
    const assistantMsg = messages.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg?.content).toBe('NO_REPLY')
    expect(assistantMsg?.slices).toEqual([])
  })

  // Branch 4: Provider Failure
  it('formats Markdown error card and emits error-bearing chatTurnComplete on provider failure', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-lifecycle-error'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let capturedTurnCompleteData: any
    cleanups.push(chatStore.onChatTurnComplete(async (data) => {
      capturedTurnCompleteData = data
    }))

    llmStore.stream = vi.fn(async () => {
      const error: any = new Error('401 Unauthorized: Invalid API key')
      error.response = { status: 401, error: { message: 'Incorrect API key provided' } }
      throw error
    })

    // Active send must reject on genuine provider failure
    await expect(chatStore.ingest('Failing query', { triggerOnly: false }, sessionId)).rejects.toThrow('401 Unauthorized')

    // chatTurnComplete must be emitted with error details in output
    expect(capturedTurnCompleteData).toBeDefined()
    expect(capturedTurnCompleteData.output?.error).toBeDefined()
    expect(capturedTurnCompleteData.output?.error?.message).toContain('401 Unauthorized')

    // Message history contains the formatted error card
    const messages = chatSession.getSessionMessages(sessionId)
    const errorAssistant = messages.find(m => m.role === 'assistant')
    expect(errorAssistant).toBeDefined()
    expect(errorAssistant?.content).toContain('⚠️ **Chat Generation Failed**')
    expect(errorAssistant?.content).toContain('401 Unauthorized')
    expect(errorAssistant?.content).toContain('Brain Picker')
  })

  // Branch 5: triggerOnly option
  it('does not insert user message into history when triggerOnly is true', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-lifecycle-triggeronly'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Proactive response to system trigger without user prompt in transcript.',
      })
    })

    await chatStore.ingest('INTERNAL_HEARTBEAT_TRIGGER', { triggerOnly: true }, sessionId)

    const messages = chatSession.getSessionMessages(sessionId)
    // No user message was persisted
    const userMsg = messages.find(m => m.role === 'user')
    expect(userMsg).toBeUndefined()

    // Assistant reply was generated and persisted
    const assistantMsg = messages.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg?.content).toContain('Proactive response to system trigger')
  })
})
