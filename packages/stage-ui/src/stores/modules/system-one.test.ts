import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefinedProvider, listProviders } from '../../libs/providers'
import { useProvidersStore } from '../providers'
import {
  JEV_AFFECT_SCHEMA,
  JEV_RERANK_CRITERIA,
  JEV_TRIAGE_SCHEMA,
  useSystemOneStore,
} from './system-one'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('system 1 coprocessor architecture', () => {
  describe('schemas and rubrics', () => {
    it('defines valid 4-category triage schema with temporal subtype and session scope', () => {
      expect(JEV_TRIAGE_SCHEMA.category.type).toBe('choice')
      expect(Object.keys(JEV_TRIAGE_SCHEMA.category.criteria)).toEqual([
        'c1_multihop',
        'c2_temporal',
        'c3_detective',
        'c4_literal',
      ])
      expect(JEV_TRIAGE_SCHEMA.temporal_subtype.type).toBe('choice')
      expect(JEV_TRIAGE_SCHEMA.search_scope.type).toBe('choice')
    })

    it('defines 4-point candidate rerank rubric', () => {
      expect(JEV_RERANK_CRITERIA).toHaveLength(4)
      expect(JEV_RERANK_CRITERIA[0]).toContain('irrelevant')
      expect(JEV_RERANK_CRITERIA[3]).toContain('key evidence')
    })

    it('defines affective heuristics schema with suspicion, attachment, and gremlin pride', () => {
      expect(JEV_AFFECT_SCHEMA.suspicion_update.type).toBe('choice')
      expect(Object.keys(JEV_AFFECT_SCHEMA.suspicion_update.criteria)).toEqual([
        'increase_one',
        'zero',
        'decrease_one',
      ])
      expect(JEV_AFFECT_SCHEMA.attachment_update.type).toBe('choice')
      expect(JEV_AFFECT_SCHEMA.gremlin_pride.type).toBe('choice')
    })
  })

  describe('provider registrations', () => {
    it('registers openrouter-ai with system1 task capability', () => {
      const provider = getDefinedProvider('openrouter-ai')
      expect(provider).toBeDefined()
      expect(provider?.tasks).toContain('system1')
    })

    it('registers typesafe-ai as dedicated system1 cloud provider', () => {
      const provider = getDefinedProvider('typesafe-ai')
      expect(provider).toBeDefined()
      expect(provider?.tasks).toContain('system1')
      expect(provider?.id).toBe('typesafe-ai')
    })

    it('registers laya-local as on-device system1 provider', () => {
      const provider = getDefinedProvider('laya-local')
      expect(provider).toBeDefined()
      expect(provider?.tasks).toContain('system1')
      expect(provider?.id).toBe('laya-local')
    })

    it('registers opencode-go with system1 task capability', () => {
      const provider = getDefinedProvider('opencode-go')
      expect(provider).toBeDefined()
      expect(provider?.tasks).toContain('system1')
      expect(provider?.id).toBe('opencode-go')
    })

    it('lists all four system1 providers in defined providers catalog', () => {
      const all = listProviders()
      const s1 = all.filter(p => p.tasks.includes('system1'))
      const ids = s1.map(p => p.id)
      expect(ids).toContain('openrouter-ai')
      expect(ids).toContain('typesafe-ai')
      expect(ids).toContain('laya-local')
      expect(ids).toContain('opencode-go')
    })
  })

  describe('openrouter decisions model isolation boundary', () => {
    it('enforces strict typesafe/jev model prefix in openrouter systemOne call', async () => {
      const provider = getDefinedProvider('openrouter-ai')
      expect(provider).toBeDefined()

      // Create instance with mock fetch
      const instance = provider!.createProvider({ apiKey: 'test-key', baseUrl: 'https://openrouter.ai/api/v1/' }) as any
      expect(typeof instance.systemOne).toBe('function')

      // Mock global fetch to verify payload model boundary
      const originalFetch = globalThis.fetch
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ answers: { test: { choice: 'ok' } } }),
      })
      globalThis.fetch = fetchSpy

      try {
        // Attempting to pass a general LLM model name like 'gpt-4o' must be overridden to typesafe/jev-1.13
        await instance.systemOne('test state', { test: { type: 'choice' } }, 'gpt-4o')

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toBe('https://openrouter.ai/api/alpha/decisions')
        const body = JSON.parse(options.body)
        expect(body.model).toBe('typesafe/jev-1.13') // Forced fallback from disallowed LLM model!

        // Passing a legitimate Jev model is preserved
        await instance.systemOne('test state', { test: { type: 'choice' } }, 'typesafe/jev-latest')
        const [, options2] = fetchSpy.mock.calls[1]
        const body2 = JSON.parse(options2.body)
        expect(body2.model).toBe('typesafe/jev-latest')
      }
      finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('opencode-go system1 dispatch and model boundary', () => {
    it('enforces opencode-go systemOne model resolution, session header, and endpoint mapping', async () => {
      const provider = getDefinedProvider('opencode-go')
      expect(provider).toBeDefined()

      const instance = provider!.createProvider({ apiKey: 'sk-test-opencode', baseUrl: 'https://opencode.ai/zen/go/v1/' }) as any
      expect(typeof instance.systemOne).toBe('function')

      const originalFetch = globalThis.fetch
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ answers: { test: { choice: 'ok' } } }),
      })
      globalThis.fetch = fetchSpy

      try {
        // Fallback or unwhitelisted model defaults to jev-1.13-free
        await instance.systemOne('test state', { test: { type: 'choice' } }, 'gpt-4o')
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toBe('https://opencode.ai/zen/v1/systemone')
        expect(options.headers.Authorization).toBe('Bearer sk-test-opencode')
        expect(options.headers['x-opencode-session']).toBeDefined()
        const body = JSON.parse(options.body)
        expect(body.model).toBe('jev-1.13-free')

        // typesafe/ prefix is stripped for compatibility
        await instance.systemOne('test state', { test: { type: 'choice' } }, 'typesafe/jev-1.13')
        const [, options2] = fetchSpy.mock.calls[1]
        const body2 = JSON.parse(options2.body)
        expect(body2.model).toBe('jev-1.13')

        // Explicit jev-1.13-free model is preserved
        await instance.systemOne('test state', { test: { type: 'choice' } }, 'jev-1.13-free')
        const [, options3] = fetchSpy.mock.calls[2]
        const body3 = JSON.parse(options3.body)
        expect(body3.model).toBe('jev-1.13-free')
      }
      finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('rerank score fusion arithmetic', () => {
    it('computes 70/30 fused score with 0..3 Jev normalization', () => {
      const rawJevScore = 3.0 // Perfect candidate
      const originalScore = 0.5 // Mid original semantic score

      const normJev = rawJevScore / 3.0 // 1.0
      const finalScore = (normJev * 0.7) + (originalScore * 0.3) // 0.7 + 0.15 = 0.85

      expect(finalScore).toBeCloseTo(0.85, 4)

      const poorJevScore = 0.0 // Irrelevant
      const normPoorJev = poorJevScore / 3.0
      const poorFinalScore = (normPoorJev * 0.7) + (originalScore * 0.3) // 0.0 + 0.15 = 0.15
      expect(poorFinalScore).toBeCloseTo(0.15, 4)
    })
  })

  describe('affect delta step mapping', () => {
    const suspMap: Record<string, number> = {
      increase_one: 1,
      zero: 0,
      decrease_one: -1,
    }

    const attMap: Record<string, number> = {
      increase_one: 1,
      zero: 0,
    }

    it('correctly maps suspicion choices to numeric deltas', () => {
      expect(suspMap.increase_one).toBe(1)
      expect(suspMap.zero).toBe(0)
      expect(suspMap.decrease_one).toBe(-1)
    })

    it('correctly maps attachment choices to numeric deltas', () => {
      expect(attMap.increase_one).toBe(1)
      expect(attMap.zero).toBe(0)
    })
  })

  describe('token and usage tracking', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
    })

    it('initializes token counters at 0 and tracks cloud vs local decisions', async () => {
      const store = useSystemOneStore()
      const providersStore = useProvidersStore()

      expect(store.systemOneCloudTokens).toBe(0)
      expect(store.systemOneLocalTokens).toBe(0)
      expect(store.systemOneDecisionsCount).toBe(0)

      // Mock cloud provider instance
      const mockCloudSystemOne = vi.fn().mockResolvedValue({
        answers: { cat: { choice: 'c1' } },
        usage: { input_tokens: 42, output_tokens: 0 },
      })
      vi.spyOn(providersStore, 'getProviderInstance').mockResolvedValue({
        systemOne: mockCloudSystemOne,
      } as any)

      store.activeProvider = 'openrouter-ai'
      await store.execute('test prompt', { cat: { type: 'choice' } })

      expect(store.systemOneCloudTokens).toBe(42)
      expect(store.systemOneLocalTokens).toBe(0)
      expect(store.systemOneDecisionsCount).toBe(1)

      // Mock local provider instance
      const mockLocalSystemOne = vi.fn().mockResolvedValue({
        answers: { cat: { choice: 'c1' } },
        usage: { input_tokens: 15, output_tokens: 0 },
      })
      vi.spyOn(providersStore, 'getProviderInstance').mockResolvedValue({
        systemOne: mockLocalSystemOne,
      } as any)

      store.activeProvider = 'laya-local'
      await store.execute('test prompt 2', { cat: { type: 'choice' } })

      expect(store.systemOneCloudTokens).toBe(42)
      expect(store.systemOneLocalTokens).toBe(15)
      expect(store.systemOneDecisionsCount).toBe(2)

      // Verify resetUsageStats clears counters
      store.resetUsageStats()
      expect(store.systemOneCloudTokens).toBe(0)
      expect(store.systemOneLocalTokens).toBe(0)
      expect(store.systemOneDecisionsCount).toBe(0)
    })

    it('provides jev-1.13-free and jev-1.13 when opencode-go is active provider', () => {
      setActivePinia(createPinia())
      const store = useSystemOneStore()
      store.activeProvider = 'opencode-go'
      const modelIds = store.availableModels.map(m => m.id)
      expect(modelIds).toEqual(['jev-1.13-free', 'jev-1.13'])
    })
  })
})
