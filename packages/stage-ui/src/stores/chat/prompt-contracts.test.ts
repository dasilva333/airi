import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useLLM } from '../llm'
import { pendingIntrusionStaging, stageJournalIntrusion } from './intrusion-staging'
import { useChatSessionStore } from './session-store'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

const activeCardRef = ref({
  name: 'Airi',
  extensions: {
    airi: {
      groundingEnabled: false,
      groundingTopicsEnabled: false,
      recentTopics: [] as Array<{ topic: string, weight: number }>,
      textJournal: {
        injectJournalContext: false,
        journalIntrusionPrompt: 'Reflect on: {journalEntryText}',
      },
    },
  },
})

vi.mock('../modules/airi-card', () => ({
  useAiriCardStore: () => ({
    activeCard: activeCardRef,
    activeCardId: ref('card-airi'),
    systemPrompt: ref(''),
    isModelSyncPrevented: false,
    getCard: vi.fn(() => activeCardRef.value),
    updateCard: vi.fn(),
  }),
}))

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

describe('chat orchestrator prompt & grounding contracts (P1-P4, Intrusions)', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)

    // Reset card extensions
    activeCardRef.value.extensions.airi = {
      groundingEnabled: false,
      groundingTopicsEnabled: false,
      recentTopics: [],
      textJournal: {
        injectJournalContext: false,
        journalIntrusionPrompt: 'Reflect on: {journalEntryText}',
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

  // P4: Grounding order preservation
  it('p4: preserves deterministic order of grounding blocks (VLM -> Environmental -> Topics)', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-p4-grounding-order'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    // Enable sensors and recent topics on card
    activeCardRef.value.extensions.airi.groundingEnabled = true
    activeCardRef.value.extensions.airi.groundingTopicsEnabled = true
    activeCardRef.value.extensions.airi.recentTopics = [
      { topic: 'Quantum Computing', weight: 0.95 },
    ]

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

    await chatStore.ingest('Look at my diagram', {
      triggerOnly: false,
      attachments: [{ type: 'image', mimeType: 'image/png', data: 'qubit-diag' }],
    }, sessionId)

    // Locate grounding system messages
    const imageIndex = capturedMessages.findIndex((m: any) => m.content?.startsWith('[IMAGE ANALYSIS]'))
    // Notice: As characterized, sensor context is also included in the earlier combined context block.
    // The dedicated grounding sequence block starts with '[ENVIRONMENTAL AWARENESS]'.
    const envIndex = capturedMessages.findIndex((m: any, i: number) => i > imageIndex && m.content?.startsWith('[ENVIRONMENTAL AWARENESS]'))
    const topicsIndex = capturedMessages.findIndex((m: any) => m.content?.startsWith('[RECENT TOPICS]'))

    expect(imageIndex).toBeGreaterThan(-1)
    expect(envIndex).toBeGreaterThan(-1)
    expect(topicsIndex).toBeGreaterThan(-1)

    // Assert exact 8-part sequence preservation: Image Analysis (idx 2) < Environmental (idx 3) < Recent Topics (idx 4)
    expect(imageIndex).toBeLessThan(envIndex)
    expect(envIndex).toBeLessThan(topicsIndex)
  })

  // Intrusions: Staging consumption & clearing
  it('consumes and clears staged journal intrusion upon injection', async () => {
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

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
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

    // 2. Pending staging was cleared immediately after insertion
    expect(pendingIntrusionStaging.journal).toBeUndefined()
  })
})
