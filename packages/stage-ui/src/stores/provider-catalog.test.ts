import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { providerOpenAICompatible } from '../libs/providers/providers/openai-compatible'
import { useProviderCatalogStore } from './provider-catalog'

vi.mock('../database/repos/providers.repo', () => ({
  providersRepo: {
    getAll: vi.fn(async () => ({})),
    remove: vi.fn(async () => {}),
    saveAll: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
  },
}))

vi.mock('../composables/api', () => ({
  client: {
    api: {
      providers: {
        ':id': {
          $delete: vi.fn(async () => ({ ok: true })),
          $patch: vi.fn(async () => ({ json: async () => ({}), ok: true })),
        },
        $get: vi.fn(async () => ({ json: async () => [], ok: true })),
        $post: vi.fn(async () => ({
          json: async () => ({
            config: {},
            definitionId: 'openai-compatible',
            id: 'real-id',
            name: 'OpenAI Compatible',
            validated: false,
            validationBypassed: false,
          }),
          ok: true,
        })),
      },
    },
  },
}))

describe('store provider-catalog', () => {
  beforeEach(() => {
    // creates a fresh pinia and makes it active
    // so it's automatically picked up by any useStore() call
    // without having to pass it to it: `useStore(pinia)`
    setActivePinia(createPinia())
  })

  it('add', () => {
    const store = useProviderCatalogStore()
    store.addProvider(providerOpenAICompatible.id)

    expect(Object.values(store.configs)).toHaveLength(1)
    expect(Object.values(store.configs)[0].id).toBeDefined()
    expect(Object.values(store.configs)[0].definitionId).toBe(providerOpenAICompatible.id)
    expect(Object.values(store.configs)[0].name).toBe('OpenAI Compatible')
    expect(Object.values(store.configs)[0].config).toStrictEqual({})
  })

  it('remove', () => {
    const store = useProviderCatalogStore()
    store.addProvider(providerOpenAICompatible.id)

    const providerId = Object.keys(store.configs)[0]
    store.removeProvider(providerId)

    expect(Object.values(store.configs)).toHaveLength(0)
  })
})
