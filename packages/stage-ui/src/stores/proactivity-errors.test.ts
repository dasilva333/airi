import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEventLogStore } from './event-log'
import { useLLM } from './llm'
import { useAiriCardStore } from './modules/airi-card'
import { useConsciousnessStore } from './modules/consciousness'
import { useProactivityStore } from './proactivity'
import { useProvidersStore } from './providers'

vi.mock('@proj-airi/electron-vueuse', () => ({
  useElectronEventaInvoke: () => () => {},
}))

vi.mock('@proj-airi/stage-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@proj-airi/stage-shared')>()
  return {
    ...actual,
    debug: vi.fn(),
    isWithinSchedule: vi.fn(() => true),
    sensorsGetActiveWindow: vi.fn(),
    sensorsGetActiveWindowHistory: vi.fn(() => []),
    sensorsGetIdleTime: vi.fn(() => 0),
    sensorsGetLocalTime: vi.fn(() => '12:00'),
    sensorsGetSystemLoad: vi.fn(),
    sensorsGetVolumeLevel: vi.fn(() => 50),
    sensorsSetTrackingEnabled: vi.fn(),
  }
})

vi.mock('../database/repos/chat-sessions.repo', () => ({
  chatSessionsRepo: {
    getIndex: vi.fn(() => ({ characters: {} })),
    getSession: vi.fn(async () => null),
  },
}))

vi.mock('../database/storage', () => ({
  storage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('proactivity heartbeat error logging in event log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }))

    const airiCardStore = useAiriCardStore()
    ;(airiCardStore as any).activeCard = {
      name: 'Airi',
      extensions: {
        airi: {
          heartbeats: {
            enabled: true,
            respectSchedule: false,
            pauseWhenAfk: false,
            prompt: 'Test directive',
          },
        },
      },
    }
    airiCardStore.activeCardId = 'airi-card-1'

    const consciousnessStore = useConsciousnessStore()
    consciousnessStore.activeProvider = 'ollama'
    consciousnessStore.activeModel = 'llama3'
  })

  it('logs heartbeat_failed when provider is not configured or offline', async () => {
    const proactivityStore = useProactivityStore()
    const providersStore = useProvidersStore()
    const eventLogStore = useEventLogStore()

    // Configured providers does not include ollama
    ;(providersStore as any).configuredProviders = {}
    proactivityStore.lastHeartbeatTime = 0

    await proactivityStore.evaluateHeartbeat({ force: false })

    expect(eventLogStore.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'proactivity',
        type: 'heartbeat_failed',
        source: 'Airi',
        payload: expect.objectContaining({
          provider: 'ollama',
          reason: 'provider_unconfigured_or_offline',
        }),
      }),
    )
  })

  it('logs heartbeat_failed when LLM generation throws an error (e.g. 429 rate limit or timeout)', async () => {
    const proactivityStore = useProactivityStore()
    const providersStore = useProvidersStore()
    const eventLogStore = useEventLogStore()
    const llmStore = useLLM()

    ;(providersStore as any).configuredProviders = {
      ollama: { id: 'ollama', name: 'Ollama' },
    }
    providersStore.getProviderInstance = vi.fn(async () => ({
      provider: 'ollama',
    })) as any

    vi.spyOn(llmStore, 'generate').mockRejectedValue(new Error('429 Too Many Requests: rate limit exceeded'))

    await proactivityStore.evaluateHeartbeat({ force: true })

    expect(eventLogStore.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'proactivity',
        type: 'heartbeat_failed',
        source: 'Airi',
        textSummary: 'Proactive heartbeat failed: 429 Too Many Requests: rate limit exceeded',
        payload: expect.objectContaining({
          provider: 'ollama',
          model: 'llama3',
          error: '429 Too Many Requests: rate limit exceeded',
        }),
      }),
    )
  })
})
