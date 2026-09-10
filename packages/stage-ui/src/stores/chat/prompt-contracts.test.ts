import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useLLM } from '../llm'
import { pendingIntrusionStaging, resetIntrusionStaging, stageArtistryIntrusion, stageJournalIntrusion } from './intrusion-staging'
import { useChatSessionStore } from './session-store'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

const activeCardRef = ref<any>({
  id: 'card-airi',
  name: 'Airi',
  extensions: {
    airi: {
      groundingEnabled: false,
      groundingMemoryEnabled: false,
      groundingTopicsEnabled: false,
      groundingDirectorScratchpadEnabled: false,
      salienceGateEnabled: false,
      recentTopics: [] as Array<{ topic: string, weight: number }>,
      textJournal: {
        injectJournalContext: false,
        journalIntrusionPrompt: 'Reflect on: {journalEntryText}',
      },
      artistry: {
        injectArtistryContext: false,
        artistryIntrusionPrompt: 'Art generated: {imagePrompt}',
      },
    },
  },
})

vi.mock('../modules/airi-card', () => {
  const updateCard = vi.fn()
  return {
    useAiriCardStore: () => ({
      activeCard: activeCardRef,
      activeCardId: ref('card-airi'),
      systemPrompt: ref(''),
      isModelSyncPrevented: false,
      getCard: vi.fn(() => activeCardRef.value),
      updateCard,
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
    activeProvider: 'vision-provider',
    activeModel: 'vision-model',
    strategy: 'forward',
    promptShimDirect: '',
    promptShimForward: 'Describe this image.',
  }),
}))

vi.mock('../modules/proactivity', () => ({
  useProactivityStore: () => ({
    sensorPayload: 'Sensors: CPU 20%, Time 14:00',
    updateSensors: vi.fn(async () => {}),
  }),
}))

vi.mock('../background', () => ({
  useBackgroundStore: () => ({
    currentBackground: ref(null),
    initializeStore: vi.fn(),
  }),
}))

vi.mock('../memory-text-journal', () => ({
  useTextJournalStore: () => ({
    searchEntries: vi.fn(async () => [
      { kind: 'journal', title: 'Summer Trip', content: 'Went to the beach.' },
    ]),
  }),
}))

vi.mock('../../database/repos/director-notes.repo', () => ({
  directorNotesRepo: {
    getNotes: vi.fn(async () => [
      { createdAt: 1000, scratchpad: 'Holding a red mug in the cafe.' },
    ]),
  },
}))

vi.mock('./salience', () => ({
  useChatSalienceStore: () => ({
    probeTurn: vi.fn(async () => ({
      hot: true,
      lateLayerDeltas: [0.12, 0.34, 0.56],
      lateLayerMean: 0.34,
      controlMean: 0.1,
    })),
  }),
}))

describe('chat orchestrator prompt & grounding contracts (P1-P4, Intrusions)', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
    resetIntrusionStaging()

    // Reset card extensions
    activeCardRef.value.extensions.airi = {
      groundingEnabled: false,
      groundingMemoryEnabled: false,
      groundingTopicsEnabled: false,
      groundingDirectorScratchpadEnabled: false,
      salienceGateEnabled: false,
      recentTopics: [],
      textJournal: {
        injectJournalContext: false,
        journalIntrusionPrompt: 'Reflect on: {journalEntryText}',
      },
      artistry: {
        injectArtistryContext: false,
        artistryIntrusionPrompt: 'Art generated: {imagePrompt}',
      },
    }
  })

  function extractUserText(content: any): string {
    if (typeof content === 'string')
      return content
    if (Array.isArray(content)) {
      const textPart = content.find((p: any) => p.type === 'text')
      return textPart?.text || ''
    }
    return ''
  }

  // P1: User history insertion precedes VLM forward dispatch
  it('p1: inserts user message into session history BEFORE VLM forward inference completes', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-p1-vlm-timing'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let resolveVlm: (res: any) => void
    let vlmStarted = false

    llmStore.generate = vi.fn(async () => {
      vlmStarted = true
      return new Promise<any>((resolve) => {
        resolveVlm = resolve
      })
    })

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'I see your image!',
      })
    })

    // Ingest with image attachment in forward mode
    const ingestPromise = chatStore.ingest('Look at my pet', {
      triggerOnly: false,
      attachments: [{ type: 'image', mimeType: 'image/png', data: 'fake-base64-data' }],
    }, sessionId)

    // Wait for VLM generate call to be reached
    await vi.waitFor(() => {
      expect(vlmStarted).toBe(true)
    })

    // Assert: User message is ALREADY in session history while VLM is still awaiting!
    const historyWhileVlmPending = chatSession.getSessionMessages(sessionId)
    const userMsg = historyWhileVlmPending.find(m => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(extractUserText(userMsg?.content)).toContain('Look at my pet')

    // Release VLM forward call
    resolveVlm!({ text: 'A small calico kitten asleep on a rug.', usage: {} })
    await ingestPromise
  })

  // P2: VLM analysis is inference context, not appended to user message in history
  it('p2: injects VLM analysis into grounding prompt without mutating persisted user message', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-p2-vlm-context'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    llmStore.generate = vi.fn(async () => ({
      text: 'A sunset over the mountains with purple sky.',
      usage: {},
    } as any))

    let capturedPrimaryLlmMessages: any[] = []

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      capturedPrimaryLlmMessages = structuredClone(msgs)
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'What a beautiful sunset view!',
      })
    })

    await chatStore.ingest('What do you think?', {
      triggerOnly: false,
      attachments: [{ type: 'image', mimeType: 'image/png', data: 'sunset-image' }],
    }, sessionId)

    // 1. Persisted user message in history must NOT have VLM analysis appended to it
    const history = chatSession.getSessionMessages(sessionId)
    const userMsg = history.find(m => m.role === 'user')
    expect(userMsg).toBeDefined()
    const userText = extractUserText(userMsg?.content)
    expect(userText).toContain('What do you think?')
    expect(userText).not.toContain('A sunset over the mountains')

    // 2. Primary LLM stream options MUST contain the IMAGE ANALYSIS grounding block
    const imageAnalysisBlock = capturedPrimaryLlmMessages.find(
      (m: any) => m.role === 'system' && m.content.includes('[IMAGE ANALYSIS]'),
    )
    expect(imageAnalysisBlock).toBeDefined()
    expect(imageAnalysisBlock.content).toContain('A sunset over the mountains with purple sky.')
  })

  // P3: Forward mode failure strips images and provides unavailable analysis context
  it('p3: strips image attachments and provides unavailable-analysis context when VLM forward fails', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-p3-vlm-fail'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    // Simulate VLM inference failure
    llmStore.generate = vi.fn(async () => {
      throw new Error('500 Internal VLM Service Error')
    })

    let capturedPrimaryLlmMessages: any[] = []

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      capturedPrimaryLlmMessages = structuredClone(msgs)
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Sorry, I had trouble processing that image.',
      })
    })

    await chatStore.ingest('Check this out', {
      triggerOnly: false,
      attachments: [{ type: 'image', mimeType: 'image/png', data: 'broken-img' }],
    }, sessionId)

    // Must include unavailable error placeholder in grounding context
    const imageAnalysisBlock = capturedPrimaryLlmMessages.find(
      (m: any) => m.role === 'system' && m.content.includes('[IMAGE ANALYSIS]'),
    )
    expect(imageAnalysisBlock).toBeDefined()
    expect(imageAnalysisBlock.content).toContain('[Visual analysis unavailable due to provider error]')

    // Downstream user message passed to primary LLM must be text-only (images stripped)
    const primaryUserMsg = capturedPrimaryLlmMessages.find((m: any) => m.role === 'user')
    expect(primaryUserMsg).toBeDefined()
    expect(typeof primaryUserMsg.content === 'string' || !primaryUserMsg.content.some((part: any) => part.type === 'image_url')).toBe(true)
  })

  // P4: Grounding order preservation across all 8 sources
  it('p4: preserves deterministic order of all 8 grounding blocks (VLM -> Env -> STMM -> LTMM -> RAG -> Topics -> Scratchpad -> Salience)', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-p4-grounding-order'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    // Enable all grounding systems on card
    activeCardRef.value.extensions.airi.groundingEnabled = true
    activeCardRef.value.extensions.airi.groundingMemoryEnabled = true
    activeCardRef.value.extensions.airi.groundingTopicsEnabled = true
    activeCardRef.value.extensions.airi.groundingDirectorScratchpadEnabled = true
    activeCardRef.value.extensions.airi.salienceGateEnabled = true
    activeCardRef.value.extensions.airi.recentTopics = [
      { topic: 'Quantum Computing', weight: 0.95 },
    ]

    // 1.5 & 1.6: STMM & Lifetime memory mocks on chatSession
    chatSession.buildShortTermMemoryContext = vi.fn(() => '[DAILY MEMORY CONTINUITY]\nToday was productive.')
    chatSession.buildLifetimeMemoryContext = vi.fn(() => '[LIFETIME RECORD]\nLikes tea and coding.')

    // 0: VLM forward inference mock
    llmStore.generate = vi.fn(async () => ({
      text: 'A diagram of a qubit circuit.',
      usage: {},
    } as any))

    let capturedMessages: any[] = []

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      capturedMessages = structuredClone(msgs)
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'That circuit looks optimal.',
      })
    })

    await chatStore.ingest('Look at my diagram and tell me what you see', {
      triggerOnly: false,
      attachments: [{ type: 'image', mimeType: 'image/png', data: 'qubit-diag' }],
    }, sessionId)

    // Locate all 8 grounding system messages in the streamed prompt
    const idx0 = capturedMessages.findIndex((m: any) => m.content?.includes('[IMAGE ANALYSIS]'))
    const idx1 = capturedMessages.findIndex((m: any, i: number) => i > idx0 && m.content?.includes('[ENVIRONMENTAL AWARENESS]'))
    const idx15 = capturedMessages.findIndex((m: any) => m.content?.includes('[DAILY MEMORY CONTINUITY]'))
    const idx16 = capturedMessages.findIndex((m: any) => m.content?.includes('[LIFETIME RECORD]'))
    const idx2 = capturedMessages.findIndex((m: any) => m.content?.includes('[GROUNDED LONG-TERM MEMORIES]'))
    const idx3 = capturedMessages.findIndex((m: any) => m.content?.includes('[RECENT TOPICS]'))
    const idx4 = capturedMessages.findIndex((m: any) => m.content?.includes('[VISUAL STATE BOARD]'))
    const idx5 = capturedMessages.findIndex((m: any) => m.content?.includes('[SALIENCE TELEMETRY]'))

    expect(idx0).toBeGreaterThan(-1)
    expect(idx1).toBeGreaterThan(-1)
    expect(idx15).toBeGreaterThan(-1)
    expect(idx16).toBeGreaterThan(-1)
    expect(idx2).toBeGreaterThan(-1)
    expect(idx3).toBeGreaterThan(-1)
    expect(idx4).toBeGreaterThan(-1)
    expect(idx5).toBeGreaterThan(-1)

    // Assert exact 8-part sequence preservation: 0 < 1 < 1.5 < 1.6 < 2 < 3 < 4 < 5
    expect(idx0).toBeLessThan(idx1)
    expect(idx1).toBeLessThan(idx15)
    expect(idx15).toBeLessThan(idx16)
    expect(idx16).toBeLessThan(idx2)
    expect(idx2).toBeLessThan(idx3)
    expect(idx3).toBeLessThan(idx4)
    expect(idx4).toBeLessThan(idx5)
  })

  // Intrusions: Staging consumption & clearing
  it('consumes and clears staged journal intrusion before model inference begins', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-intrusions-staging'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    // Enable journal intrusion on card
    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Airi Journal Thoughts: {journalEntryText}',
    }

    // Stage pending journal entry
    stageJournalIntrusion({
      entryText: 'Had a wonderful stroll by the river today.',
      timestamp: Date.now() - 120000,
    })

    expect(pendingIntrusionStaging.journal).toBeDefined()

    let capturedMessages: any[] = []
    let stagingClearedBeforeStream = false

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      // ASSERT: At the moment llmStore.stream is called, staging must ALREADY be cleared!
      stagingClearedBeforeStream = pendingIntrusionStaging.journal === undefined
      capturedMessages = structuredClone(msgs)
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'I remember our walk by the river.',
      })
    })

    await chatStore.ingest('How are you feeling?', { triggerOnly: false }, sessionId)

    // 1. The journal text was injected into context
    const journalBlock = capturedMessages.find(
      (m: any) => m.role === 'system' && m.content?.includes('Had a wonderful stroll by the river today.'),
    )
    expect(journalBlock).toBeDefined()

    // 2. Pending staging was cleared before stream began
    expect(stagingClearedBeforeStream).toBe(true)
    expect(pendingIntrusionStaging.journal).toBeUndefined()
  })

  it('clears staged journal intrusion even when entryText is empty string (preserving baseline staging parity)', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-intrusions-empty-entry'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect empty: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: '',
      timestamp: Date.now(),
    })

    expect(pendingIntrusionStaging.journal).toBeDefined()

    let stagingClearedBeforeStream = false
    let capturedMessages: any[] = []

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      stagingClearedBeforeStream = pendingIntrusionStaging.journal === undefined
      capturedMessages = structuredClone(msgs)
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Empty staging cleared successfully.',
      })
    })

    await chatStore.ingest('Hello', { triggerOnly: false }, sessionId)

    // 1. Staging was cleared before stream began despite empty entry text
    expect(stagingClearedBeforeStream).toBe(true)
    expect(pendingIntrusionStaging.journal).toBeUndefined()

    // 2. Formatted prompt was injected into system message
    const journalBlock = capturedMessages.find(
      (m: any) => m.role === 'system' && m.content?.includes('Reflect empty:'),
    )
    expect(journalBlock).toBeDefined()
  })

  it('rolls back leased journal intrusion if model inference fails', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-intrusions-rollback'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: 'Important thought to retain on failure',
      timestamp: 1234567,
    })

    expect(pendingIntrusionStaging.journal).toBeDefined()

    // Simulate model inference failing with a provider error
    llmStore.stream = vi.fn(async () => {
      throw new Error('503 Service Unavailable: Model overloaded')
    })

    await expect(chatStore.ingest('Hello?', { triggerOnly: false }, sessionId)).rejects.toThrow('503 Service Unavailable')

    // ASSERT: Staging was restored to pending staging on failure
    expect(pendingIntrusionStaging.journal).toBeDefined()
    expect(pendingIntrusionStaging.journal?.entryText).toBe('Important thought to retain on failure')
  })

  it('commits and permanently clears leased journal intrusion after successful model response', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-intrusions-commit'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: 'Delivered journal entry',
      timestamp: 1234567,
    })

    expect(pendingIntrusionStaging.journal).toBeDefined()

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'I read your journal and I understand.',
      })
    })

    await chatStore.ingest('Hello', { triggerOnly: false }, sessionId)

    // ASSERT: After successful stream, lease is committed and staging is permanently consumed
    expect(pendingIntrusionStaging.journal).toBeUndefined()
  })

  it('preserves card dreamState when model inference fails and clears it on success', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)
    const { useAiriCardStore } = await import('../modules/airi-card')
    const cardStore = useAiriCardStore()

    const sessionId = 'session-dream-preservation'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.dreamState = {
      injectDreamContext: true,
      dreamIntrusionPrompt: 'Dreaming of: {insertEchoChips}',
      pendingDreamChips: ['cosmic nebula', 'floating city'],
      pendingDreamTimestamp: Date.now() - 60000,
    }

    // 1. Turn fails -> dreamState should NOT be cleared from card
    llmStore.stream = vi.fn(async () => {
      throw new Error('Inference connection reset')
    })

    await expect(chatStore.ingest('Wake up', { triggerOnly: false }, sessionId)).rejects.toThrow('Inference connection reset')

    // Assert updateCard was NOT called to clear dream chips on failure
    expect(cardStore.updateCard).not.toHaveBeenCalled()
    expect(activeCardRef.value.extensions.airi.dreamState.pendingDreamChips).toEqual(['cosmic nebula', 'floating city'])

    // 2. Turn succeeds -> dreamState is cleared via cardStore.updateCard
    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'I woke up remembering the cosmic nebula.',
      })
    })

    await chatStore.ingest('Wake up now', { triggerOnly: false }, sessionId)

    expect(cardStore.updateCard).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        extensions: expect.objectContaining({
          airi: expect.objectContaining({
            dreamState: expect.objectContaining({
              pendingDreamChips: undefined,
              pendingDreamTimestamp: undefined,
            }),
          }),
        }),
      }),
    )
  })

  it('rolls back artistry intrusion on stream failure and commits on stream success', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-artistry-lifecycle'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.artistry = {
      injectArtistryContext: true,
      artistryIntrusionPrompt: 'Artwork reaction: {imagePrompt}',
    }

    stageArtistryIntrusion({
      prompt: 'Neon cybernetic cityscape at twilight',
      timestamp: Date.now(),
    })

    expect(pendingIntrusionStaging.artistry).toBeDefined()

    // 1. First attempt fails
    llmStore.stream = vi.fn(async () => {
      throw new Error('503 Overloaded')
    })

    await expect(chatStore.ingest('Look at my art', { triggerOnly: false }, sessionId)).rejects.toThrow('503 Overloaded')

    // Staging was restored to pending
    expect(pendingIntrusionStaging.artistry).toBeDefined()
    expect(pendingIntrusionStaging.artistry?.prompt).toBe('Neon cybernetic cityscape at twilight')

    // 2. Second attempt succeeds
    let injectedPrompt = ''
    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      const sys = msgs.find((m: any) => m.role === 'system' && m.content?.includes('Artwork reaction: Neon cybernetic cityscape at twilight'))
      injectedPrompt = sys?.content || ''
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'The cybernetic cityscape looks incredible!',
      })
    })

    await chatStore.ingest('Look at my art retry', { triggerOnly: false }, sessionId)

    expect(injectedPrompt).toContain('Artwork reaction: Neon cybernetic cityscape at twilight')
    expect(pendingIntrusionStaging.artistry).toBeUndefined()
  })

  it('hands off restored intrusion to the next queued message when first message fails', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-queue-handoff'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: 'Handoff to next send on error',
      timestamp: Date.now(),
    })

    let callCount = 0
    let secondCallSystemPrompt = ''

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      callCount++
      if (callCount === 1) {
        throw new Error('500 Internal Server Error')
      }
      const sysMsg = msgs.find((m: any) => m.role === 'system' && m.content?.includes('Handoff to next send on error'))
      secondCallSystemPrompt = sysMsg?.content || ''
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'Recovered on second turn!',
      })
    })

    // Queue first send (will fail)
    const p1 = chatStore.ingest('First message', { triggerOnly: false }, sessionId)
    // Queue second send (queued behind first)
    const p2 = chatStore.ingest('Second message', { triggerOnly: false }, sessionId)

    await expect(p1).rejects.toThrow('500 Internal Server Error')
    await p2

    expect(secondCallSystemPrompt).toContain('Handoff to next send on error')
    expect(pendingIntrusionStaging.journal).toBeUndefined()
  })

  it('rolls back intrusion when user stops generation before any tokens stream', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-stop-empty'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: 'Keep this on empty stop',
      timestamp: Date.now(),
    })

    llmStore.stream = vi.fn(async () => {
      // User clicks stop before any tokens arrive
      await chatStore.stopCurrentGeneration(sessionId)
      const err = new Error('Generation stopped by user')
      err.name = 'AbortError'
      throw err
    })

    await chatStore.ingest('Hi', { triggerOnly: false }, sessionId)

    // Staging was rolled back because no tokens were emitted
    expect(pendingIntrusionStaging.journal).toBeDefined()
    expect(pendingIntrusionStaging.journal?.entryText).toBe('Keep this on empty stop')
  })

  it('commits intrusion when user stops generation after partial tokens stream', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-stop-partial'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: 'Consumed because partial text was spoken',
      timestamp: Date.now(),
    })

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      // Stream partial token first
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'I read your journal and started thinking...',
      })
      // User clicks stop after receiving partial text
      await chatStore.stopCurrentGeneration(sessionId)
      const err = new Error('Generation stopped by user')
      err.name = 'AbortError'
      throw err
    })

    await chatStore.ingest('Hi', { triggerOnly: false }, sessionId)

    // Staging was committed because partial text was persisted
    expect(pendingIntrusionStaging.journal).toBeUndefined()
  })

  it('retains intrusion context across multi-hop bridged steps and commits only after final step', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-multihop-intrusion'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    activeCardRef.value.extensions.airi.textJournal = {
      injectJournalContext: true,
      journalIntrusionPrompt: 'Reflect: {journalEntryText}',
    }

    stageJournalIntrusion({
      entryText: 'Multi-hop journal memory',
      timestamp: Date.now(),
    })

    const dummyTool = {
      type: 'function' as const,
      function: {
        name: 'search_notes',
        description: 'Search personal notes',
        parameters: { type: 'object', properties: {} },
      },
      execute: async () => 'Found 1 note about walking',
    }

    let hopCount = 0
    const hopPrompts: string[] = []

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      hopCount++
      const sys = msgs.find((m: any) => m.role === 'system' && m.content?.includes('Multi-hop journal memory'))
      hopPrompts.push(sys?.content || '')

      if (hopCount === 1) {
        // Step 1: LLM outputs a bridged tool marker with arguments to trigger step 2
        await options.onStreamEvent({
          type: 'text-delta',
          text: '[call_tool:search_notes, query: "walking"]',
        })
      }
      else {
        // Step 2: Final response text
        await options.onStreamEvent({
          type: 'text-delta',
          text: 'Found the note and reflected on our walk.',
        })
      }
    })

    await chatStore.ingest('Find notes', { triggerOnly: false, tools: [dummyTool] }, sessionId)

    // Verify both hops received the intrusion context
    expect(hopCount).toBe(2)
    expect(hopPrompts[0]).toContain('Multi-hop journal memory')
    expect(hopPrompts[1]).toContain('Multi-hop journal memory')

    // Staging is committed only after the whole turn completes
    expect(pendingIntrusionStaging.journal).toBeUndefined()
  })
})
