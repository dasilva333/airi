import type { ComposerTranslation } from 'vue-i18n'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSpeechMetadata } from './speech'

const mockT = ((key: string) => key) as unknown as ComposerTranslation

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('openrouter-audio-speech provider', () => {
  const metadata = createSpeechMetadata(mockT)
  const openrouterMeta = metadata['openrouter-audio-speech']

  it('is defined in the speech registry', () => {
    expect(openrouterMeta).toBeDefined()
    expect(openrouterMeta.id).toBe('openrouter-audio-speech')
  })

  it('posts to audio/speech endpoint with mp3 response_format', async () => {
    const mockAudioData = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]) // MP3 header
    const mockFetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      const urlStr = String(url)
      if (urlStr.endsWith('audio/speech')) {
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({
          'Authorization': 'Bearer test-or-key',
          'Content-Type': 'application/json',
        })
        const body = JSON.parse(init?.body as string)
        expect(body).toEqual({
          model: 'openai/tts-1',
          input: 'Hello world',
          voice: 'alloy',
          response_format: 'mp3',
        })
        return new Response(mockAudioData, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      }
      return new Response('Not Found', { status: 404 })
    })
    vi.stubGlobal('fetch', mockFetch)

    const provider = await openrouterMeta.createProvider({
      apiKey: 'test-or-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    })

    const speech = provider.speech('openai/tts-1')
    const res = await speech.fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      body: JSON.stringify({ input: 'Hello world', voice: 'alloy' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    const buffer = await res.arrayBuffer()
    expect(new Uint8Array(buffer)).toEqual(mockAudioData)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('discovers supported_voices from catalog when querying model voices', async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('models?output_modalities=speech')) {
        return Response.json({
          data: [
            {
              id: 'cartesia/sonic',
              name: 'Sonic 2.0',
              architecture: { output_modalities: ['audio'] },
              supported_voices: ['sarah', 'michael', 'af_heart'],
            },
            {
              id: 'bytedance-seed/seed-audio-1-0',
              name: 'ByteDance Seed',
              architecture: { output_modalities: ['audio'] },
              supported_voices: null,
            },
          ],
        })
      }
      return new Response('Not Found', { status: 404 })
    })
    vi.stubGlobal('fetch', mockFetch)

    // With model-specific voices (explicit modelId argument):
    const cartesiaVoices = await openrouterMeta.capabilities.listVoices?.({ apiKey: 'k' }, 'cartesia/sonic')
    expect(cartesiaVoices).toEqual([
      { id: 'sarah', name: 'Sarah', provider: 'openrouter-audio-speech', languages: [] },
      { id: 'michael', name: 'Michael', provider: 'openrouter-audio-speech', languages: [] },
      { id: 'af_heart', name: 'Af Heart', provider: 'openrouter-audio-speech', languages: [] },
    ])

    // With model specified in config (no 2nd argument):
    const configVoices = await openrouterMeta.capabilities.listVoices?.({ apiKey: 'k', model: 'cartesia/sonic' })
    expect(configVoices).toEqual([
      { id: 'sarah', name: 'Sarah', provider: 'openrouter-audio-speech', languages: [] },
      { id: 'michael', name: 'Michael', provider: 'openrouter-audio-speech', languages: [] },
      { id: 'af_heart', name: 'Af Heart', provider: 'openrouter-audio-speech', languages: [] },
    ])

    // Model with null/empty supported_voices returns default placeholder voice:
    const seedVoices = await openrouterMeta.capabilities.listVoices?.({ apiKey: 'k' }, 'bytedance-seed/seed-audio-1-0')
    expect(seedVoices).toEqual([
      { id: 'default', name: 'Default', provider: 'openrouter-audio-speech', languages: [] },
    ])

    // Fallback to OpenAI voices when model is not found in catalog:
    const unknownVoices = await openrouterMeta.capabilities.listVoices?.({ apiKey: 'k' }, 'unknown/model')
    expect(unknownVoices?.some(v => v.id === 'alloy')).toBe(true)
  })
})
