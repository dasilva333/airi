import { detectWebGPU } from '@proj-airi/stage-shared/webgpu'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NativeAI } from '../../../libs/native-ai'
import { localEngineMetadata } from './local-engines'

vi.mock('@proj-airi/stage-shared', () => ({
  isApplePlatform: () => false,
  isStageTamagotchi: () => false,
  isStageWeb: () => true,
}))

vi.mock('@proj-airi/stage-shared/webgpu', () => ({
  detectWebGPU: vi.fn(async () => ({ fp16Supported: true })),
  isWebGPUSupported: vi.fn(() => true),
}))

vi.mock('../../../libs/inference', () => ({
  createLocalVisionAdapter: vi.fn(() => ({
    captionImage: () => {},
    loadModel: () => {},
    state: 'x',
    deviceLossCount: 0,
    terminate: () => {},
  })),
  getMirageClient: vi.fn(() => ({
    isReady: () => true,
    isPreparing: () => false,
    prepare: async () => true,
    analyzeFrame: async () => ({}),
    detectTarget: async () => null,
    terminate: () => {},
  })),
  DEFAULT_LOCAL_VISION_MODEL: '',
  LOCAL_VISION_MODELS: [{ id: 'm', name: 'M', description: 'd' }],
}))

vi.mock('../../../libs/inference/constants', () => ({
  DEFAULT_WEB_LLM_MODEL: 'default-llm',
  DEFAULT_WEB_RWKV_MODEL: 'default-rwkv',
  WEB_LLM_MODELS: [{ id: 'curated', name: 'C', description: 'D', fp16: false }],
  WEB_RWKV_MODELS: [{ id: 'r', name: 'R', badge: 'b', description: 'd' }],
}))

vi.mock('../../../libs/native-ai', () => ({
  NativeAI: { isNative: vi.fn(() => true), isModelCached: vi.fn(async () => true) },
}))

vi.mock('../apple-core-ai', () => ({
  createAppleCoreAIChatProvider: vi.fn(async () => ({})),
  DEFAULT_APPLE_CORE_AI_MODEL: '',
}))

/**
 * Surface the local vision factory builds on top of the compute adapter:
 * caption/load entry points, computed lifecycle + device-loss state, and a
 * teardown hook. `ProviderMetadata` types `createProvider` as the xsai
 * request-builder union (`chat`/`embed`/`systemOne`/…), which carries none of
 * these — an `in` check can only drop members from that union, never add the
 * vision extras — so the surface is asserted through a type guard instead.
 */
interface LocalVisionProvider {
  captionImage: (...args: unknown[]) => unknown
  loadModel: (...args: unknown[]) => unknown
  /** Computed wrapper around the adapter lifecycle string. */
  state: { value: unknown }
  /** Computed wrapper around the adapter WebGPU device-loss counter. */
  deviceLossCount: { value: unknown }
  terminate: () => unknown
}

function isLocalVisionProvider(provider: unknown): provider is LocalVisionProvider {
  if (typeof provider !== 'object' || provider === null)
    return false

  return 'captionImage' in provider
    && typeof provider.captionImage === 'function'
    && 'loadModel' in provider
    && typeof provider.loadModel === 'function'
    && 'state' in provider
    && 'deviceLossCount' in provider
    && 'terminate' in provider
    && typeof provider.terminate === 'function'
}

vi.mock('../moondream', () => ({ createMoondreamChatProvider: vi.fn(async () => ({})) }))
vi.mock('../web-llm', () => ({ createWebLlmChatProvider: vi.fn(async () => ({})) }))
vi.mock('../web-rwkv', () => ({ createWebRwkvChatProvider: vi.fn(async () => ({})) }))

describe('localEngineMetadata', () => {
  it('exposes all entries', () => {
    expect(Object.keys(localEngineMetadata).sort()).toEqual([
      'apple-core-ai',
      'blip-local',
      'mirage-local',
      'moondream-local',
      'web-llm',
      'web-rwkv',
    ])
  })

  it('runs isAvailableBy for all', () => {
    for (const m of Object.values(localEngineMetadata)) {
      expect(typeof m.isAvailableBy?.()).toBe('boolean')
    }
  })

  it('defaultOptions for all', () => {
    for (const m of Object.values(localEngineMetadata)) {
      expect(m.defaultOptions?.()).toBeTruthy()
    }
  })

  it('createProvider for all', async () => {
    for (const m of Object.values(localEngineMetadata)) {
      const p = await m.createProvider?.({ model: 'x' } as Record<string, unknown>)
      expect(p).toBeTruthy()
    }
  })

  it('reads blip provider computed state', async () => {
    const m = localEngineMetadata['blip-local']
    const p = await m.createProvider!({ model: 'm' } as Record<string, unknown>)
    expect(isLocalVisionProvider(p)).toBe(true)
    if (!isLocalVisionProvider(p))
      throw new Error('blip-local did not expose the local vision adapter surface')

    // `state` / `deviceLossCount` are Vue computed refs over adapter state, so
    // they unwrap through `.value` rather than being plain fields.
    expect(p.state.value).toBe('x')
    expect(p.deviceLossCount.value).toBe(0)
    expect(() => p.terminate()).not.toThrow()
  })

  it('listModels for all', async () => {
    for (const m of Object.values(localEngineMetadata)) {
      const models = await m.capabilities?.listModels?.({ model: 'custom-x', modelUrl: 'http://u', modelLib: '' } as Record<string, unknown>)
      expect(Array.isArray(models)).toBe(true)
    }
  })

  it('web-rwkv listModels custom push branch', async () => {
    const m = localEngineMetadata['web-rwkv']
    const models = await m.capabilities!.listModels!({ model: 'http://custom' } as Record<string, unknown>)
    expect(models.some(x => x.id === 'http://custom')).toBe(true)
  })

  it('web-llm listModels fp16 false branch', async () => {
    vi.mocked(detectWebGPU).mockResolvedValueOnce({ fp16Supported: false } as never)
    const m = localEngineMetadata['web-llm']
    const models = await m.capabilities!.listModels!({} as Record<string, unknown>)
    expect(Array.isArray(models)).toBe(true)
  })

  it('web-llm listModels custom push branch', async () => {
    const m = localEngineMetadata['web-llm']
    const models = await m.capabilities!.listModels!({ model: 'custom-id', modelUrl: 'http://u' } as Record<string, unknown>)
    expect(models.some(x => x.id === 'custom-id')).toBe(true)
  })

  it('validators', async () => {
    const rwkv = localEngineMetadata['web-rwkv']
    expect((await rwkv.validators!.validateProviderConfig!({ model: '' } as Record<string, unknown>)).valid).toBe(true)
    expect((await rwkv.validators!.validateProviderConfig!({ model: 'u' } as Record<string, unknown>)).valid).toBe(true)

    const llm = localEngineMetadata['web-llm']
    expect((await llm.validators!.validateProviderConfig!({ model: '' } as Record<string, unknown>)).valid).toBe(true)
    expect((await llm.validators!.validateProviderConfig!({ model: 'custom-id', modelUrl: 'http://u', modelLib: '' } as Record<string, unknown>)).valid).toBe(false)
    expect((await llm.validators!.validateProviderConfig!({ model: 'custom-id', modelUrl: 'http://u', modelLib: 'lib' } as Record<string, unknown>)).valid).toBe(true)
    expect((await llm.validators!.validateProviderConfig!({ model: 'curated' } as Record<string, unknown>)).valid).toBe(true)

    const blip = localEngineMetadata['blip-local']
    expect((await blip.validators!.validateProviderConfig!({ model: '' } as Record<string, unknown>)).valid).toBe(false)
    expect((await blip.validators!.validateProviderConfig!({ model: 'm' } as Record<string, unknown>)).valid).toBe(true)
    const apple = localEngineMetadata['apple-core-ai']
    expect((await apple.validators!.validateProviderConfig!({ model: '' } as Record<string, unknown>)).valid).toBe(false)
    vi.mocked(NativeAI.isNative).mockReturnValueOnce(false)
    expect((await apple.validators!.validateProviderConfig!({ model: 'm' } as Record<string, unknown>)).valid).toBe(false)

    vi.mocked(NativeAI.isNative).mockReturnValue(true)
    vi.mocked(NativeAI.isModelCached).mockResolvedValueOnce(false)
    expect((await apple.validators!.validateProviderConfig!({ model: 'm' } as Record<string, unknown>)).valid).toBe(false)

    vi.mocked(NativeAI.isModelCached).mockResolvedValueOnce(true)
    expect((await apple.validators!.validateProviderConfig!({ model: 'm' } as Record<string, unknown>)).valid).toBe(true)
  })
})

afterEach(() => vi.unstubAllGlobals())
