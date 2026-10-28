import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { Tool } from '@xsai/shared-chat'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyTwoWayServerWebSearchHandshake } from './llm'
import { useAiriCardStore } from './modules/airi-card'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

describe('applyTwoWayServerWebSearchHandshake', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  const mockLocalMcpSearchTool: Tool = {
    type: 'function',
    function: {
      name: 'mcp__open_websearch__search',
      description: 'Local MCP search',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    },
  } as unknown as Tool

  const mockOtherTool: Tool = {
    type: 'function',
    function: {
      name: 'take_screenshot',
      description: 'Take screenshot',
      parameters: { type: 'object', properties: {} },
    },
  } as unknown as Tool

  function setActiveCardWithTools(allowedTools: string[]) {
    const cardStore = useAiriCardStore()
    const cardId = 'test-card'
    cardStore.cards.set(cardId, {
      extensions: {
        airi: {
          generation: {
            known: {
              allowedTools,
            },
          },
        },
      },
    } as any)
    cardStore.activeCardId = cardId
  }

  it('preserves persona boundary: does NOT inject server search when card lacks web_search permission', () => {
    setActiveCardWithTools(['take_screenshot'])

    const chatProvider = { id: 'deepseek' } as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://api.deepseek.com' }

    const result = applyTwoWayServerWebSearchHandshake(
      [mockOtherTool],
      chatConfig,
      chatProvider,
      'deepseek-chat',
      { serverWebSearch: true },
    )

    expect(result).toHaveLength(1)
    expect((result![0] as any).function?.name).toBe('take_screenshot')
  })

  it('injects DeepSeek server search tool and strips local MCP search when card allows web_search', () => {
    setActiveCardWithTools(['web_search', 'take_screenshot'])

    const chatProvider = { id: 'deepseek' } as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://api.deepseek.com' }

    const result = applyTwoWayServerWebSearchHandshake(
      [mockLocalMcpSearchTool, mockOtherTool],
      chatConfig,
      chatProvider,
      'deepseek-chat',
      { serverWebSearch: true },
    )

    expect(result).toHaveLength(2)
    // Non-search tool preserved
    expect((result![0] as any).function?.name).toBe('take_screenshot')
    // Server tool injected with name and function schema
    expect((result![1] as any).name).toBe('web_search')
    expect((result![1] as any).function?.name).toBe('web_search')
    expect((result![1] as any).function?.parameters).toBeDefined()
  })

  it('injects OpenRouter hosted web search when provider is openrouter', () => {
    setActiveCardWithTools(['web_search'])

    const chatProvider = { id: 'openrouter' } as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://openrouter.ai/api/v1' }

    const result = applyTwoWayServerWebSearchHandshake(
      [mockLocalMcpSearchTool],
      chatConfig,
      chatProvider,
      'deepseek/deepseek-v4-flash',
      { serverWebSearch: true },
    )

    expect(result).toHaveLength(1)
    expect((result![0] as any).name).toBe('openrouter:web_search')
    expect((result![0] as any).function?.name).toBe('openrouter:web_search')
  })

  it('injects web_search tool with proper name and function schema for opencode-go', () => {
    setActiveCardWithTools(['web_search'])

    const chatProvider = { id: 'opencode-go' } as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://opencode.ai/zen/go/v1/' }

    const result = applyTwoWayServerWebSearchHandshake(
      [mockLocalMcpSearchTool],
      chatConfig,
      chatProvider,
      'deepseek-v4.1-flash',
      { serverWebSearch: true },
    )

    expect(result).toHaveLength(1)
    expect((result![0] as any).name).toBe('web_search')
    expect((result![0] as any).function?.name).toBe('web_search')
    expect((result![0] as any).function?.description).toBeDefined()
    expect(typeof (result![0] as any).execute).toBe('function')
  })

  it('reads serverWebSearch flag from localStorage favorite preset when not explicitly passed in options', () => {
    setActiveCardWithTools(['web_search'])

    localStorage.setItem(
      'airi:chat-model-favorites',
      JSON.stringify([
        {
          id: 'fav-1',
          name: 'DeepSeek Flash Search',
          provider: 'deepseek',
          model: 'deepseek-chat',
          serverWebSearch: true,
        },
      ]),
    )

    const chatProvider = { id: 'deepseek' } as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://api.deepseek.com' }

    const result = applyTwoWayServerWebSearchHandshake(
      undefined,
      chatConfig,
      chatProvider,
      'deepseek-chat',
      undefined,
    )

    expect(result).toHaveLength(1)
    expect((result![0] as any).name).toBe('web_search')
    expect((result![0] as any).function?.name).toBe('web_search')
  })

  it('injects OpenRouter hosted web search when provider has no id but baseURL is openrouter.ai', () => {
    setActiveCardWithTools(['web_search'])

    // ChatProvider created via createOpenRouter does not carry an id property
    const chatProvider = {} as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://openrouter.ai/api/v1' }

    const result = applyTwoWayServerWebSearchHandshake(
      [mockLocalMcpSearchTool],
      chatConfig,
      chatProvider,
      'deepseek/deepseek-v4-flash',
      undefined,
    )

    expect(result).toHaveLength(1)
    expect((result![0] as any).name).toBe('openrouter:web_search')
    expect((result![0] as any).function?.name).toBe('openrouter:web_search')
  })

  it('does NOT inject server search tool when serverWebSearch is false', () => {
    setActiveCardWithTools(['web_search'])

    const chatProvider = { id: 'deepseek' } as unknown as ChatProvider
    const chatConfig = { baseURL: 'https://api.deepseek.com' }

    const result = applyTwoWayServerWebSearchHandshake(
      [mockLocalMcpSearchTool],
      chatConfig,
      chatProvider,
      'deepseek-chat',
      { serverWebSearch: false },
    )

    expect(result).toHaveLength(1)
    expect((result![0] as any).function?.name).toBe('mcp__open_websearch__search')
  })
})
