import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

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

// Reactive hearing mock: useHearingStore() returns the shared reactive state
// itself shaped like a real Pinia setup store (ref-valued properties), so the
// composable's storeToRefs unwraps refs correctly instead of double-wrapping
// a plain object. Reset per-test in beforeEach below.
const hearingMockState = reactive({
  configured: ref(true),
  autoSendEnabled: ref(false),
  autoSendDelay: ref(1000),
  voiceInputMode: ref('dictation'),
  isTranscribing: ref(false),
  tapToTalk: ref(true),
  vadThreshold: ref(0.6),
  micOwner: ref<string | null>('composer'),
  activeTranscriptionProvider: ref('browser-web-speech-api'),
  pendingVoiceDraft: ref(''),
})
const mockTakeVoiceDraft = vi.fn(() => {
  const text = hearingMockState.pendingVoiceDraft
  hearingMockState.pendingVoiceDraft = ''
  return text
})
Object.assign(hearingMockState, { takeVoiceDraft: mockTakeVoiceDraft })
const mockSupportsStreamInput = ref(true)
const mockStream = ref<any>({ id: 'test-stream' })
const mockEnabled = ref(true)
const mockTranscribeForMediaStream = vi.fn()
const mockStopStreamingTranscription = vi.fn()

function resetHearingMock() {
  hearingMockState.configured = true
  hearingMockState.autoSendEnabled = false
  hearingMockState.autoSendDelay = 1000
  hearingMockState.voiceInputMode = 'dictation'
  hearingMockState.isTranscribing = false
  hearingMockState.tapToTalk = true
  hearingMockState.vadThreshold = 0.6
  hearingMockState.micOwner = 'composer'
  hearingMockState.activeTranscriptionProvider = 'browser-web-speech-api'
  hearingMockState.pendingVoiceDraft = ''
}

vi.mock('../stores/modules/hearing', () => ({
  useHearingStore: () => hearingMockState,
  useHearingSpeechInputPipeline: () => ({
    supportsStreamInput: mockSupportsStreamInput,
    transcribeForMediaStream: mockTranscribeForMediaStream,
    stopStreamingTranscription: mockStopStreamingTranscription,
  }),
}))

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
    resetHearingMock()
    mockSupportsStreamInput.value = true
    mockStream.value = { id: 'test-stream' }
    mockEnabled.value = true
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
    hearingStore.pendingVoiceDraft = 'hello from stage mic'
    await nextTick()

    expect(composer.messageInput.value).toBe('hello from stage mic')
    expect(hearingStore.pendingVoiceDraft).toBe('')
  })

  it('claims a pre-existing voice draft on mount (chat opened after dictation)', async () => {
    const { useHearingStore } = await import('../stores/modules/hearing')

    const hearingStore = useHearingStore()
    hearingStore.pendingVoiceDraft = 'draft before mount'
    // Synchronous mount-claim runs in setup, before any watcher flush, so no
    // previously created composer can steal it.
    const composer = useChatComposer()

    expect(composer.messageInput.value).toBe('draft before mount')
    expect(hearingStore.pendingVoiceDraft).toBe('')
  })

  // ROOT CAUSE:
  // The Web Speech provider hot-restarts recognition after every final
  // (continuous=true default), so tap-to-talk could never mute the mic on
  // speech end — muting depended entirely on the VAD side-channel.
  //
  // FIXED BY: Passing continuous:false for tap-to-talk single-shot sessions
  // so the provider ends itself after the final, plus cold-mic teardown in
  // onSpeechEnd. Gate off defers to the provider default (stays hot).
  it('requests non-continuous recognition for tap-to-talk single-shot sessions', async () => {
    let capturedOptions: any = {}
    mockTranscribeForMediaStream.mockImplementation(async (_stream: any, options: any) => {
      capturedOptions = options
    })

    const composer = useChatComposer()
    await composer.startListening()

    expect(mockTranscribeForMediaStream).toHaveBeenCalled()
    expect(composer.isListening.value).toBe(true)
    expect(capturedOptions.providerOptions).toEqual({ continuous: false })
  })

  it('leaves recognition continuous when tap-to-talk is off', async () => {
    hearingMockState.tapToTalk = false
    let capturedOptions: any = {}
    mockTranscribeForMediaStream.mockImplementation(async (_stream: any, options: any) => {
      capturedOptions = options
    })

    const composer = useChatComposer()
    await composer.startListening()

    expect(mockTranscribeForMediaStream).toHaveBeenCalled()
    expect(capturedOptions.providerOptions).toBeUndefined()
  })

  // ROOT CAUSE:
  // The landscape ChatArea mic toggles the ambient master switch
  // (micOwner='ambient'), not a composer tap — so an owner-gated single-shot
  // never fired and the provider hot-restarted forever with tap-to-talk on.
  //
  // FIXED BY: Basing single-shot on tapToTalk alone. Every activation with the
  // gate on is one utterance, regardless of owner.
  it('treats the ambient master-switch tap as single-shot when tap-to-talk is on', async () => {
    hearingMockState.micOwner = null
    let capturedOptions: any = {}
    mockTranscribeForMediaStream.mockImplementation(async (_stream: any, options: any) => {
      capturedOptions = options
    })

    const composer = useChatComposer()
    await composer.startListening()

    expect(capturedOptions.providerOptions).toEqual({ continuous: false })

    await capturedOptions.onSpeechEnd('ambient final')
    expect(composer.messageInput.value).toBe('ambient final')
    expect(composer.isListening.value).toBe(false)
    expect(mockStopStreamingTranscription).toHaveBeenCalled()
  })

  // ROOT CAUSE:
  // When a single-shot session ends itself (provider onend without restart),
  // the composer still showed hot (isListening stuck true, mic authority held)
  // because teardown only ran through the VAD path.
  //
  // FIXED BY: Cold-mic teardown (stopListening + releaseMicAuthority) in
  // onSpeechEnd for single-shot sessions, before the send/draft handling.
  it('goes cold when a single-shot session ends itself', async () => {
    let capturedOptions: any = {}
    mockTranscribeForMediaStream.mockImplementation(async (_stream: any, options: any) => {
      capturedOptions = options
    })

    const composer = useChatComposer()
    await composer.startListening()
    expect(composer.isListening.value).toBe(true)

    // Provider ends itself after the final (non-continuous onend). Auto-send
    // is off in the mock, so the transcript parks in the input.
    await capturedOptions.onSpeechEnd('final words')

    expect(composer.messageInput.value).toBe('final words')
    expect(composer.isListening.value).toBe(false)
    expect(mockStopStreamingTranscription).toHaveBeenCalled()
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
