import type { ProviderMetadata } from '../stores/providers/types'
import type { CatalogNodeItem } from './settings-catalog'

import { describe, expect, it } from 'vitest'

import { convertCatalogItemToSearchItem, convertProviderMetadataToSearchItem, rankSearchResults, searchMatchTier, staticIndex } from './settings-search-index'

describe('settings-search-index', () => {
  describe('convertCatalogItemToSearchItem', () => {
    it('returns null for hub/root items', () => {
      expect(convertCatalogItemToSearchItem({ id: 'hub', label: 'Hub', order: 0, parentId: null })).toBeNull()
      expect(convertCatalogItemToSearchItem({ id: 'x', label: 'X', kind: 'root', order: 0, parentId: null })).toBeNull()
    })

    it('maps area/tool/parent-based categories', () => {
      const base = { id: 'a', label: 'Label', order: 0, parentId: null as string | null }
      const cases: Array<[Partial<CatalogNodeItem>, string]> = [
        [{ kind: 'area' }, 'Primary Page'],
        [{ kind: 'tool' }, 'Developer Tools'],
        [{ parentId: 'area-modules' }, 'Modules'],
        [{ parentId: 'area-system' }, 'System Preferences'],
        [{ parentId: 'area-models' }, 'Companion Avatars'],
        [{ parentId: 'area-memory' }, 'Memory Systems'],
        [{ parentId: 'prov-cat-chat' }, 'Providers (Chat)'],
        [{ parentId: 'prov-cat-speech' }, 'Providers (Speech)'],
        [{ parentId: 'prov-cat-stt' }, 'Providers (Hearing)'],
        [{ parentId: 'prov-cat-artistry' }, 'Providers (Artistry)'],
        [{ parentId: 'prov-cat-motion' }, 'Providers (Motion)'],
        [{ parentId: 'prov-cat-cloud' }, 'Providers (Cloud)'],
      ]
      for (const [patch, cat] of cases) {
        const item = convertCatalogItemToSearchItem({ ...base, ...patch } as CatalogNodeItem)
        expect(item?.category).toBe(cat)
      }
    })

    it('defaults clusterGroup or Settings category', () => {
      const item = convertCatalogItemToSearchItem({ id: 'x', label: 'X', clusterGroup: 'MyGroup', order: 0, parentId: null })
      expect(item?.category).toBe('MyGroup')
      const item2 = convertCatalogItemToSearchItem({ id: 'x', label: 'X', order: 0, parentId: null })
      expect(item2?.category).toBe('Settings')
    })

    it('cleans CJK characters from category', () => {
      const item = convertCatalogItemToSearchItem({ id: 'x', label: 'X', clusterGroup: '设置 Settings', order: 0, parentId: null })
      expect(item?.category).toBe('Settings')
    })

    it('keeps category when cleaning yields empty', () => {
      const item = convertCatalogItemToSearchItem({ id: 'x', label: 'X', clusterGroup: '设置', order: 0, parentId: null })
      expect(item?.category).toBe('设置')
    })

    it('builds keywords, route, icon defaults', () => {
      const item = convertCatalogItemToSearchItem({
        id: 'foo',
        label: 'Foo',
        shortLabel: 'F',
        description: 'desc',
        route: '/a/b',
        keywords: ['k1', ''],
        order: 0,
        parentId: null,
      })
      expect(item?.id).toBe('foo')
      expect(item?.title).toBe('Foo')
      expect(item?.description).toBe('desc')
      expect(item?.to).toBe('/a/b')
      expect(item?.icon).toBe('i-solar:settings-bold-duotone')
      expect(item?.keywords).toEqual(['foo', 'Foo', 'F', 'a', 'b', 'k1'])
    })

    it('uses defaults when route/icon missing', () => {
      const item = convertCatalogItemToSearchItem({ id: 'x', label: 'X', order: 0, parentId: null })
      expect(item?.to).toBe('/settings')
      expect(item?.icon).toBe('i-solar:settings-bold-duotone')
      expect(item?.keywords).toEqual(['x', 'X'])
    })
  })

  describe('convertProviderMetadataToSearchItem', () => {
    const base: ProviderMetadata = {
      id: 'p',
      category: 'chat',
      tasks: ['t'],
      nameKey: 'n',
      name: 'Provider',
      descriptionKey: 'd',
      description: 'desc',
      createProvider: () => ({ systemOne: async () => ({ answers: {}, raw: '' }) }),
      capabilities: {},
      validators: {
        validateProviderConfig: () => ({ errors: [], reason: '', valid: true }),
      },
    }

    it('maps known categories', () => {
      const cats = ['chat', 'speech', 'transcription', 'embed', 'vision', 'artistry', 'motion', 'cloud'] as const
      for (const c of cats) {
        const item = convertProviderMetadataToSearchItem({ ...base, category: c } as ProviderMetadata)
        const expected = c === 'transcription' ? 'Hearing' : c === 'embed' ? 'Embedding' : c.charAt(0).toUpperCase() + c.slice(1)
        expect(item.category).toBe(`Providers (${expected})`)
      }
    })

    it('falls back for unknown category', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, category: 'system1' } as ProviderMetadata)
      expect(item.category).toBe('Providers (system1)')
    })

    it('handles blip-local and vision route category', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, id: 'blip-local', category: 'vision' })
      expect(item.to).toBe('/settings/providers/chat/blip-local')
    })

    it('transcription route category', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, category: 'transcription' })
      expect(item.to).toBe('/settings/providers/transcription/p')
    })

    it('default route category', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, category: 'chat' })
      expect(item.to).toBe('/settings/providers/chat/p')
    })

    it('description and icon fallbacks', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, description: '', deployment: 'local' })
      expect(item.description).toBe('Provider chat provider')
      expect(item.icon).toBe('i-solar:cpu-bold-duotone')
      const item2 = convertProviderMetadataToSearchItem({ ...base, description: 'x', icon: 'ic', deployment: 'cloud' })
      expect(item2.description).toBe('x')
      expect(item2.icon).toBe('ic')
    })

    it('cloud icon default', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, deployment: 'cloud', icon: undefined })
      expect(item.icon).toBe('i-solar:cloud-bold-duotone')
    })

    it('keywords include tasks', () => {
      const item = convertProviderMetadataToSearchItem({ ...base, deployment: 'local', tasks: ['a', 'b'] })
      expect(item.keywords).toEqual(['p', 'Provider', 'chat', 'local', 'a', 'b'])
    })
  })

  describe('staticIndex', () => {
    it('is an array', () => {
      expect(Array.isArray(staticIndex)).toBe(true)
    })
  })

  describe('rankSearchResults', () => {
    const item = (patch: Partial<{ id: string, title: string, to: string, keywords: string[], description: string }>) => ({
      id: 'x',
      title: 'X',
      category: 'Settings',
      to: '/x',
      ...patch,
    })

    it('tiers title > id/route > keyword > description-only', () => {
      expect(searchMatchTier(item({ title: 'Ming 3.0 TTS' }), 'ming')).toBe(0)
      expect(searchMatchTier(item({ id: 'prov-ming3-local' }), 'ming')).toBe(1)
      expect(searchMatchTier(item({ to: '/settings/providers/speech/ming3-local' }), 'ming')).toBe(1)
      expect(searchMatchTier(item({ keywords: ['something-ming'] }), 'ming')).toBe(2)
      expect(searchMatchTier(item({ description: 'incoming streams' }), 'ming')).toBe(3)
    })

    it('sorts exact provider matches above substring noise, stably', () => {
      const noiseA = item({ id: 'a', title: 'Hearing', description: 'live streaming audio' })
      const noiseB = item({ id: 'b', title: 'Discord Bot', description: 'incoming voice events' })
      const exact = item({ id: 'prov-ming3-local', title: 'Ming 3.0 TTS', to: '/settings/providers/speech/ming3-local' })
      const ranked = rankSearchResults([noiseA, noiseB, exact], 'ming')
      expect(ranked[0]).toBe(exact)
      // Stable within a tier: original relative order preserved.
      expect(ranked.slice(1)).toEqual([noiseA, noiseB])
    })
  })
})
