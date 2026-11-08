import type { ChatProvider } from '@xsai-ext/providers/utils'

import { describe, expect, it } from 'vitest'
import { parse } from 'zod/v4/core'

import { isKeylessProvider, isOptionalKeyProvider, keylessOrOptionalKey } from '../../types'
import { getDefinedProvider } from '../registry'
import { providerKilo } from './index'

const translate = (key: string) => key

describe('providerKilo', () => {
  it('registers Kilo in the provider registry', () => {
    expect(getDefinedProvider('kilo')).toEqual(providerKilo)
  })

  it('fills the default base URL and empty apiKey when user provides nothing', async () => {
    const schema = await providerKilo.createProviderConfig({ t: translate })

    expect(parse(schema, {})).toEqual({
      apiKey: '',
      baseUrl: 'https://api.kilo.ai/api/gateway/v1',
    })
  })

  it('allows overriding base URL while keeping empty apiKey', async () => {
    const schema = await providerKilo.createProviderConfig({ t: translate })

    expect(parse(schema, { baseUrl: 'https://custom.kilo.ai/v1/' })).toEqual({
      apiKey: '',
      baseUrl: 'https://custom.kilo.ai/v1/',
    })
  })

  it('creates an OpenAI-compatible provider with Kilo defaults', async () => {
    const provider = await providerKilo.createProvider({
      apiKey: '',
      baseUrl: 'https://api.kilo.ai/api/gateway/v1',
    })

    expect((provider as ChatProvider).chat('kilo-auto/free')).toMatchObject({
      apiKey: '',
      baseURL: 'https://api.kilo.ai/api/gateway/v1',
      model: 'kilo-auto/free',
    })
  })

  it('always requires validation (keyless but connectivity check)', () => {
    expect(providerKilo.validationRequiredWhen?.({})).toBe(true)
    expect(providerKilo.validationRequiredWhen?.({ apiKey: 'custom-key' })).toBe(true)
  })

  it('runs keyless but accepts an optional key', () => {
    expect(providerKilo.requiresCredentials).toEqual({ optional: true })
    expect(providerKilo.business!({ t: translate }).pricing).toBe('free')
    expect(isOptionalKeyProvider(providerKilo.requiresCredentials)).toBe(true)
    expect(isKeylessProvider(providerKilo.requiresCredentials)).toBe(false)
    expect(keylessOrOptionalKey(providerKilo.requiresCredentials)).toBe(true)
  })

  it('lists every gateway free model once the live listing is used', async () => {
    const config = { apiKey: '', baseUrl: 'https://api.kilo.ai/api/gateway/v1' }
    const provider = await providerKilo.createProvider(config)
    const models = await providerKilo.extraMethods?.listModels?.(config, provider)

    // Live listing takes precedence: at least the gateway's isFree models surface.
    expect((models ?? []).length).toBeGreaterThanOrEqual(12)
    // The 4 free models with no :free suffix used to be dropped by the id filter.
    for (const id of ['kilo-auto/free', 'openrouter/free', 'reflection/beam-free', 'stealth/glyph-cluster']) {
      expect((models ?? []).some(m => m.id === id)).toBe(true)
    }
    // Presets never duplicate a live row.
    const ids = (models ?? []).map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps preset metadata when a live row matches a preset id', async () => {
    const config = { apiKey: '', baseUrl: 'https://api.kilo.ai/api/gateway/v1' }
    const provider = await providerKilo.createProvider(config)
    const models = await providerKilo.extraMethods?.listModels?.(config, provider)
    const dots = (models ?? []).find(m => m.id === 'dots-studio/dots-3-note-preview:free')

    expect(dots?.name).toBe('Dots3-Note Preview')
    expect(dots?.contextLength).toBe(512_000)
  })

  it('falls back to the preset list when the live fetch fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
    try {
      const config = { apiKey: '', baseUrl: 'https://api.kilo.ai/api/gateway/v1' }
      const provider = await providerKilo.createProvider(config)
      const models = await providerKilo.extraMethods?.listModels?.(config, provider)

      expect((models ?? []).length).toBeGreaterThan(0)
      // The fallback is the gateway's isFree set: the four suffix-less free
      // entries must be present, and no paid/stale ID may survive.
      const ids = (models ?? []).map(m => m.id)
      expect(ids).toEqual(expect.arrayContaining(['kilo-auto/free', 'reflection/beam-free', 'openrouter/free', 'stealth/glyph-cluster']))
      expect(ids).toEqual(
        expect.not.arrayContaining(['kilo-auto', 'poolside/laguna-m.1:free', 'poolside/laguna-xs.2:free', 'stepfun/step-3.7-flash:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3.5-content-safety:free', 'xingchen-agi/xing4.0-29b-a4b:free', 'thinkingmachines/inkling-small:free', 'poolside/laguna-s-2.1:free', 'poolside/laguna-xs-2.1:free', 'liquid/lfm-2.5-2.6b:free']),
      )
    }
    finally {
      globalThis.fetch = originalFetch
    }
  })
})
