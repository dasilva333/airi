import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from '../stores/chat'
import { useChatSessionStore } from '../stores/chat/session-store'
import { useChatComposer } from './use-chat-composer'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../stores/modules/airi-card', () => {
  const card = {
    name: 'Airi',
    extensions: { airi: {} },
  }
  return {
    buildSystemPrompt: () => '',
    useAiriCardStore: () => ({
      activeCard: ref(card),
      activeCardId: ref('card-airi'),
      systemPrompt: ref(''),
      isModelSyncPrevented: false,
    }),
  }
})

vi.mock('../stores/providers', () => ({
  useProvidersStore: () => ({
    getProviderInstance: vi.fn(async () => ({})),
    getProviderConfig: vi.fn(() => ({})),
    getModelsForProvider: vi.fn(() => [{ id: 'test-model', capabilities: [] }]),
    providerMetadata: {},
  }),
}))

vi.mock('../stores/modules/vision', () => ({
  useVisionStore: () => ({
    activeProvider: null,
    activeModel: null,
    promptShimDirect: '',
  }),
}))

vi.mock('../stores/modules/consciousness', () => ({
  useConsciousnessStore: () => ({
    activeProvider: ref('test-provider'),
    activeModel: ref('test-model'),
  }),
}))

vi.mock('../stores/modules/hearing', () => ({
  useHearingStore: () => ({
    configured: ref(false),
    autoSendEnabled: ref(false),
    autoSendDelay: ref(1000),
  }),
  useHearingSpeechInputPipeline: () => ({
    supportsStreamInput: ref(false),
    transcribeForMediaStream: vi.fn(),
    stopStreamingTranscription: vi.fn(),
  }),
}))

vi.mock('../stores/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/settings')>()
  return {
    ...actual,
    useSettingsAudioDevice: () => ({
      stream: ref(null),
      enabled: ref(false),
      askPermission: vi.fn(),
      startStream: vi.fn(),
    }),
  }
})

describe('use-chat-composer: parity with desktop send & stop controls', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  // ROOT CAUSE:
  // In the landscape web stage and mobile sheet, useChatComposer previously only exposed
  // `sending` and did not track `isSpeaking` or `canStop`. When the LLM finished streaming
  // text tokens, `sending` flipped to false even though TTS speech was actively playing,
  // causing the Stop button to immediately disappear and leaving the user with no way to
  // stop speaking from the composer.
  //
  // FIXED BY: Exposing `canStop` and `isSpeaking` from useChatComposer, which mirrors Desktop's
  // `canStop = computed(() => sending.value || isSpeaking.value)`.
  it('exposes canStop and isSpeaking tracking active speech even when sending is false', () => {
    const chatOrchestrator = useChatOrchestratorStore(pinia)
    chatOrchestrator.sending = false
    chatOrchestrator.isSpeaking = true

    const composer = useChatComposer()

    expect(composer.isSpeaking.value).toBe(true)
    expect(composer.canStop.value).toBe(true)

    chatOrchestrator.isSpeaking = false
    expect(composer.isSpeaking.value).toBe(false)
    expect(composer.canStop.value).toBe(false)
  })

  // ROOT CAUSE:
  // In desktop, clicking the stop button calls stopCurrentGeneration to halt speech.
  // We ensure stopGeneration from useChatComposer delegates to stopCurrentGeneration.
  it('delegates stopGeneration to chatOrchestrator.stopCurrentGeneration', async () => {
    const chatOrchestrator = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    chatSession.activeSessionId = 'session-123'

    const stopSpy = vi.spyOn(chatOrchestrator, 'stopCurrentGeneration').mockResolvedValue(undefined as any)

    const composer = useChatComposer()
    await composer.stopGeneration()

    expect(stopSpy).toHaveBeenCalledWith('session-123')
  })

  // ROOT CAUSE:
  // When a user sent a subsequent message while the character was still speaking the prior reply,
  // the prior speech would continue overlapping unless explicitly stopped. In desktop, sending
  // a new message interrupts the previous speech turn.
  //
  // FIXED BY: Invoking stopCurrentGeneration before ingest in handleSend when canStop is true.
  it('stops in-flight generation or active speech before sending a subsequent message', async () => {
    const chatOrchestrator = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    chatSession.activeSessionId = 'session-123'

    chatOrchestrator.isSpeaking = true
    chatOrchestrator.sending = false

    const callOrder: string[] = []
    vi.spyOn(chatOrchestrator, 'stopCurrentGeneration').mockImplementation(async () => {
      callOrder.push('stopCurrentGeneration')
      chatOrchestrator.isSpeaking = false
    })
    vi.spyOn(chatOrchestrator, 'ingest').mockImplementation(async () => {
      callOrder.push('ingest')
    })

    const composer = useChatComposer()
    composer.messageInput.value = 'New follow-up message'

    await composer.handleSend()

    expect(callOrder).toEqual(['stopCurrentGeneration', 'ingest'])
    expect(composer.messageInput.value).toBe('')
  })
})
