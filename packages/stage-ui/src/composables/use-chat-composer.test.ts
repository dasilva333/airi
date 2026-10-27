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

const mockHearingConfigured = ref(true)
const mockSupportsStreamInput = ref(true)
const mockStream = ref<any>({ id: 'test-stream' })
const mockEnabled = ref(true)
const mockMicOwner = ref<string | null>('composer')
const mockTranscribeForMediaStream = vi.fn()
const mockStopStreamingTranscription = vi.fn()

vi.mock('../stores/modules/hearing', () => {
  const pendingVoiceDraft = ref('')
  return {
    useHearingStore: () => ({
      configured: mockHearingConfigured,
      autoSendEnabled: ref(false),
      autoSendDelay: ref(1000),
      micOwner: mockMicOwner,
      pendingVoiceDraft,
      takeVoiceDraft: vi.fn(() => {
        const text = pendingVoiceDraft.value
        pendingVoiceDraft.value = ''
        return text
      }),
    }),
    useHearingSpeechInputPipeline: () => ({
      supportsStreamInput: mockSupportsStreamInput,
      transcribeForMediaStream: mockTranscribeForMediaStream,
      stopStreamingTranscription: mockStopStreamingTranscription,
    }),
  }
})

vi.mock('../stores/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/settings')>()
  return {
    ...actual,
    useSettingsAudioDevice: () => ({
      stream: mockStream,
      enabled: mockEnabled,
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
    mockHearingConfigured.value = true
    mockSupportsStreamInput.value = true
    mockStream.value = { id: 'test-stream' }
    mockEnabled.value = true
    mockMicOwner.value = 'composer'
    mockTranscribeForMediaStream.mockReset()
    mockStopStreamingTranscription.mockReset()
  })

  // ROOT CAUSE:
  // The web/pocket stage pages run a page-level ambient voice loop that ingested
  // every transcript unconditionally, ignoring "send when recording stops" (autoSendEnabled).
  // With the flag off the transcript must park in the composer draft, never ingest.
  //
  // FIXED BY: Gating the page loops on autoSendEnabled and routing OFF transcripts
  // through hearing-store pendingVoiceDraft, which useChatComposer claims into messageInput.
  //
  // NOTE: These two tests run first because every useChatComposer() in this file
  // shares the module-level mock draft ref — an earlier composer's watcher would
  // atomically claim the draft before a later composer's watcher runs.
  it('claims a live page-level voice draft into the composer input', async () => {
    const { nextTick } = await import('vue')
    const { useHearingStore } = await import('../stores/modules/hearing')

    const composer = useChatComposer()
    expect(composer.messageInput.value).toBe('')

    const hearingStore = useHearingStore()
    hearingStore.pendingVoiceDraft.value = 'hello from stage mic'
    await nextTick()

    expect(composer.messageInput.value).toBe('hello from stage mic')
    expect(hearingStore.pendingVoiceDraft.value).toBe('')
  })

  it('claims a pre-existing voice draft on mount (chat opened after dictation)', async () => {
    const { useHearingStore } = await import('../stores/modules/hearing')

    const hearingStore = useHearingStore()
    hearingStore.pendingVoiceDraft.value = 'draft before mount'
    // Synchronous mount-claim runs in setup, before any watcher flush, so no
    // previously created composer can steal it.
    const composer = useChatComposer()

    expect(composer.messageInput.value).toBe('draft before mount')
    expect(hearingStore.pendingVoiceDraft.value).toBe('')
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

  // ROOT CAUSE:
  // In streaming speech recognition (such as Web Speech API), interim results are cumulative
  // (e.g. "The", "The quick", "The quick brown"). Previously, interim results were passed to
  // onSentenceEnd and appended unconditionally, causing exponential word duplication
  // ("The The quick The quick brown The quick brown fox").
  //
  // FIXED BY: Buffering live interim text separately from committed final sentences.
  // Interim updates replace the pending live buffer in-place, while onSentenceEnd commits
  // the completed sentence without duplication.
  it('updates interim transcription live in-place without cumulative duplication', async () => {
    let capturedCallbacks: {
      onInterim?: (interim: string) => void
      onSentenceEnd?: (delta: string) => void
      onSpeechEnd?: (text: string) => void
    } = {}

    mockTranscribeForMediaStream.mockImplementation(async (_stream: any, options: any) => {
      capturedCallbacks = options
    })

    const composer = useChatComposer()
    composer.messageInput.value = ''

    await composer.startListening()

    expect(mockTranscribeForMediaStream).toHaveBeenCalled()
    expect(composer.isListening.value).toBe(true)

    // User speaks: "The"
    capturedCallbacks.onInterim?.('The')
    expect(composer.messageInput.value).toBe('The')

    // Cumulative interim tick: "The quick"
    capturedCallbacks.onInterim?.('The quick')
    expect(composer.messageInput.value).toBe('The quick')

    // Cumulative interim tick: "The quick brown"
    capturedCallbacks.onInterim?.('The quick brown')
    expect(composer.messageInput.value).toBe('The quick brown')

    // Final sentence arrives: "The quick brown fox"
    capturedCallbacks.onSentenceEnd?.('The quick brown fox')
    expect(composer.messageInput.value).toBe('The quick brown fox')

    // Next sentence starts streaming interim: "jumps"
    capturedCallbacks.onInterim?.('jumps')
    expect(composer.messageInput.value).toBe('The quick brown fox jumps')

    // Next sentence interim advances: "jumps over"
    capturedCallbacks.onInterim?.('jumps over')
    expect(composer.messageInput.value).toBe('The quick brown fox jumps over')

    // Next sentence finalized: "jumps over the lazy dog"
    capturedCallbacks.onSentenceEnd?.('jumps over the lazy dog')
    expect(composer.messageInput.value).toBe('The quick brown fox jumps over the lazy dog')

    // Speech ends with final text: onSpeechEnd should not duplicate already committed final sentences
    capturedCallbacks.onSpeechEnd?.('The quick brown fox jumps over the lazy dog')
    expect(composer.messageInput.value).toBe('The quick brown fox jumps over the lazy dog')
  })

  it('preserves existing draft baseline when starting dictation', async () => {
    let capturedCallbacks: {
      onInterim?: (interim: string) => void
      onSentenceEnd?: (delta: string) => void
      onSpeechEnd?: (text: string) => void
    } = {}

    mockTranscribeForMediaStream.mockImplementation(async (_stream: any, options: any) => {
      capturedCallbacks = options
    })

    const composer = useChatComposer()
    composer.messageInput.value = 'Existing draft:'

    await composer.startListening()

    // First interim tick
    capturedCallbacks.onInterim?.('Hello')
    expect(composer.messageInput.value).toBe('Existing draft: Hello')

    // Second cumulative interim tick
    capturedCallbacks.onInterim?.('Hello world')
    expect(composer.messageInput.value).toBe('Existing draft: Hello world')

    // Final sentence
    capturedCallbacks.onSentenceEnd?.('Hello world')
    expect(composer.messageInput.value).toBe('Existing draft: Hello world')
  })
})
