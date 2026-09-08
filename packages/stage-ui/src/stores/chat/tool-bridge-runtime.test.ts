import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('chat orchestrator bridged tool loop runtime contracts', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  // Contract 1: Monolith outer bridged loop terminates at exactly 5 rounds
  it('bounds outer bridged inference loop to at most 5 rounds when model endlessly calls tools', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-tool-bound'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let streamInvocationCount = 0
    const toolExecutions: string[] = []

    const mockTool = {
      type: 'function',
      function: {
        name: 'test_search',
        description: 'Mock search tool',
        parameters: { type: 'object', properties: { query: { type: 'string' } } },
      },
      execute: async (args: any) => {
        toolExecutions.push(args.query || 'default')
        return `Result for ${args.query}`
      },
    }

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      streamInvocationCount++
      // On every single round, output a bridged tool marker
      await options.onStreamEvent({
        type: 'text-delta',
        text: `<|test_search:query="step_${streamInvocationCount}"|>`,
      })
    })

    await chatStore.ingest('Run endless searches', {
      triggerOnly: false,
      tools: [mockTool as any],
    }, sessionId)

    // Must execute exactly 5 outer rounds, no 6th round!
    expect(streamInvocationCount).toBe(5)
    expect(toolExecutions.length).toBe(5)
    expect(toolExecutions).toEqual(['step_1', 'step_2', 'step_3', 'step_4', 'step_5'])
  })

  // Contract 2: Normal response without bridged marker exits early after 1 round
  it('exits tool loop early on round 1 when response contains no bridged tool markers', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-tool-early-exit'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let streamCount = 0
    const mockTool = {
      type: 'function',
      function: { name: 'calculator', parameters: {} },
      execute: vi.fn(),
    }

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      streamCount++
      await options.onStreamEvent({
        type: 'text-delta',
        text: 'The answer is 42, no tools needed.',
      })
    })

    await chatStore.ingest('What is 6 times 7?', {
      triggerOnly: false,
      tools: [mockTool as any],
    }, sessionId)

    expect(streamCount).toBe(1)
    expect(mockTool.execute).not.toHaveBeenCalled()
  })

  // Contract 3: Tool results settle and associate with generated call IDs across follow-up
  it('associates tool results with generated call IDs and passes prior tool history in round 2', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-tool-followup'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    let round = 0
    let round2ReceivedMessages: any[] = []

    const mockTool = {
      type: 'function',
      function: { name: 'get_weather', parameters: {} },
      execute: async (args: any) => {
        return `Weather in ${args.city} is sunny 22C`
      },
    }

    llmStore.stream = vi.fn(async (_model, _provider, msgs, options) => {
      round++
      if (round === 1) {
        // Round 1 outputs tool marker
        await options.onStreamEvent({
          type: 'text-delta',
          text: `Checking weather: <|get_weather:city="Tokyo"|>`,
        })
      }
      else if (round === 2) {
        round2ReceivedMessages = JSON.parse(JSON.stringify(msgs))
        await options.onStreamEvent({
          type: 'text-delta',
          text: 'It is sunny and 22C in Tokyo right now!',
        })
      }
    })

    await chatStore.ingest('How is Tokyo weather?', {
      triggerOnly: false,
      tools: [mockTool as any],
    }, sessionId)

    expect(round).toBe(2)

    // Round 2 request must contain assistant tool call and tool result message
    const assistantMsgInRound2 = round2ReceivedMessages.find((m: any) => m.role === 'assistant' && m.tool_calls?.length)
    expect(assistantMsgInRound2).toBeDefined()
    const generatedCallId = assistantMsgInRound2.tool_calls[0].id
    expect(generatedCallId).toBeDefined()
    expect(generatedCallId).toMatch(/^bridge-/)

    const toolResultMsg = round2ReceivedMessages.find((m: any) => m.role === 'tool')
    expect(toolResultMsg).toBeDefined()
    expect(toolResultMsg.content).toContain('Weather in Tokyo is sunny 22C')
    expect(toolResultMsg.tool_call_id).toBe(generatedCallId)

    // Final persisted history has assistant message with tool slices
    const history = chatSession.getSessionMessages(sessionId)
    const assistantMsg = history.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const toolCallSlice = assistantMsg?.slices.find(s => s.type === 'tool-call')
    expect(toolCallSlice).toBeDefined()
    expect(toolCallSlice?.state).toBe('done')
    expect(toolCallSlice?.result).toContain('sunny 22C')
    expect((toolCallSlice as any)?.toolCall?.id).toBe(generatedCallId)
  })

  // Contract 4: Multi-dialect marker recognition
  it('bridges tool calls across different marker dialects (<|...|>, [call_tool:...], <tool_call>)', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-tool-dialects'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const executedTools: string[] = []
    const tools = [
      {
        type: 'function',
        function: { name: 'tool_alpha' },
        execute: async () => { executedTools.push('alpha'); return 'alpha_ok' },
      },
    ]

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      if (executedTools.length === 0) {
        // Dialect: <tool_call>tool_alpha(query="test")</tool_call>
        await options.onStreamEvent({
          type: 'text-delta',
          text: '<tool_call>tool_alpha(query="test")</tool_call>',
        })
      }
      else {
        await options.onStreamEvent({
          type: 'text-delta',
          text: 'Dialect test complete.',
        })
      }
    })

    await chatStore.ingest('Run dialect test', {
      triggerOnly: false,
      tools: tools as any,
    }, sessionId)

    expect(executedTools).toContain('alpha')
  })

  // Contract 5: Parity with baseline for malformed marker recovery
  it('does not consume malformed tool markers and recovers to bridge subsequent valid markers', async () => {
    const chatStore = useChatOrchestratorStore(pinia)
    const chatSession = useChatSessionStore(pinia)
    const llmStore = useLLM(pinia)

    const sessionId = 'session-tool-malformed-recovery'
    chatSession.activeSessionId = sessionId
    chatSession.setSessionMessages(sessionId, [])

    const executedTools: string[] = []
    const tools = [
      {
        type: 'function',
        function: { name: 'tool_valid' },
        execute: async () => { executedTools.push('valid'); return 'valid_ok' },
      },
    ]

    llmStore.stream = vi.fn(async (_model, _provider, _msgs, options) => {
      if (executedTools.length === 0) {
        // Stream malformed tool marker followed by valid tool marker
        await options.onStreamEvent({
          type: 'text-delta',
          text: '<tool_call>{"name": unquoted_broken}</tool_call> <|tool_valid:param="val"|>',
        })
      }
      else {
        await options.onStreamEvent({
          type: 'text-delta',
          text: 'Finished tool execution.',
        })
      }
    })

    await chatStore.ingest('Test malformed recovery', {
      triggerOnly: false,
      tools: tools as any,
    }, sessionId)

    expect(executedTools).toEqual(['valid'])

    // Assert that the malformed marker remains unconsumed in the round 2 context and assistant message,
    // protecting against regressions where malformed markers are incorrectly stripped from inference loops.
    const round2ReceivedMessages = (llmStore.stream as any).mock.calls[1][2]
    const round2AssistantMsg = round2ReceivedMessages.find((m: any) => m.role === 'assistant')
    expect(round2AssistantMsg).toBeDefined()
    expect(round2AssistantMsg.content).toContain('<tool_call>{"name": unquoted_broken}</tool_call>')

    const history = chatSession.getSessionMessages(sessionId)
    const assistantMsg = history.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect((assistantMsg as any)?.rawContent).toContain('<tool_call>{"name": unquoted_broken}</tool_call>')
    expect((assistantMsg as any)?.categorization?.reasoning).toContain('{"name": unquoted_broken}')
    expect(assistantMsg?.content).toBe('Finished tool execution.')
  })
})
