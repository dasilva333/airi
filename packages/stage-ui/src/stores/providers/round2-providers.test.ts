import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSpeechMetadata } from './registry/speech'
import { transcriptionMetadata } from './registry/transcription'

describe('round 2 providers registry', () => {
  const fakeTranslate = vi.fn((key: string, fallback?: string) => fallback ?? key) as any
  let speechMetadata: ReturnType<typeof createSpeechMetadata>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    speechMetadata = createSpeechMetadata(fakeTranslate)
  })

  it('registers all Tier 3 and Tier 4 speech providers', () => {
    expect(speechMetadata.voicevox).toBeDefined()
    expect(speechMetadata['aivis-speech']).toBeDefined()
    expect(speechMetadata['minimax-speech']).toBeDefined()
    expect(speechMetadata['mimo-audio-speech']).toBeDefined()
    expect(speechMetadata['google-gemini-audio-speech']).toBeDefined()
  })

  it('registers mimo-audio-transcription in transcription metadata', () => {
    expect(transcriptionMetadata['mimo-audio-transcription']).toBeDefined()
    const mimoSTT = transcriptionMetadata['mimo-audio-transcription']
    expect(mimoSTT.tasks).toContain('speech-to-text')
  })

  describe('voicevox and aivis-speech', () => {
    it('provides default models and reachability validator', async () => {
      const voicevox = speechMetadata.voicevox
      expect(voicevox.requiresCredentials).toBe(false)
      const models = await voicevox.capabilities.listModels?.({})
      expect(models?.[0]?.id).toBe('default')

      const aivis = speechMetadata['aivis-speech']
      expect(aivis.requiresCredentials).toBe(false)
      const aivisModels = await aivis.capabilities.listModels?.({})
      expect(aivisModels?.[0]?.id).toBe('default')
    })
  })

  describe('minimax-speech', () => {
    it('lists models and voices', async () => {
      const minimax = speechMetadata['minimax-speech']
      const models = await minimax.capabilities.listModels?.({})
      expect(models?.map(m => m.id)).toEqual(['speech-2.8-hd', 'speech-2.8-turbo'])

      const voices = await minimax.capabilities.listVoices?.({})
      expect(voices?.length).toBeGreaterThanOrEqual(10)
      expect(voices?.some(v => v.id === 'English_Graceful_Lady')).toBe(true)
    })

    it('validates apiKey is required', async () => {
      const minimax = speechMetadata['minimax-speech']
      const invalid = await minimax.validators.validateProviderConfig({ apiKey: '' })
      expect(invalid.valid).toBe(false)

      const valid = await minimax.validators.validateProviderConfig({ apiKey: 'minimax-key' })
      expect(valid.valid).toBe(true)
    })
  })

  describe('mimo-audio', () => {
    it('lists models and voices for TTS', async () => {
      const mimoTTS = speechMetadata['mimo-audio-speech']
      const models = await mimoTTS.capabilities.listModels?.({})
      expect(models?.some(m => m.id === 'mimo-v2.5-tts')).toBe(true)

      const voices = await mimoTTS.capabilities.listVoices?.({})
      expect(voices?.some(v => v.id === 'mimo_default')).toBe(true)
    })

    it('lists models for STT', async () => {
      const mimoSTT = transcriptionMetadata['mimo-audio-transcription']
      const models = await mimoSTT.capabilities.listModels?.()
      expect(models?.some(m => m.id === 'mimo-v2-omni')).toBe(true)
    })
  })

  describe('google-gemini-audio-speech', () => {
    it('lists Gemini TTS models and 30 prebuilt voices', async () => {
      const gemini = speechMetadata['google-gemini-audio-speech']
      const models = await gemini.capabilities.listModels?.({})
      expect(models?.map(m => m.id)).toContain('gemini-2.5-flash-preview-tts')

      const voices = await gemini.capabilities.listVoices?.({})
      expect(voices?.length).toBe(30)
      expect(voices?.some(v => v.id === 'Kore')).toBe(true)
      expect(voices?.some(v => v.id === 'Zephyr')).toBe(true)
      expect(voices?.some(v => v.id === 'Puck')).toBe(true)
    })

    it('inherits API key from google-generative-ai when dedicated key is omitted', async () => {
      const gemini = speechMetadata['google-gemini-audio-speech']

      // Without any key configured
      const emptyCheck = await gemini.validators.validateProviderConfig({ apiKey: '' })
      expect(emptyCheck.valid).toBe(false)

      // Set key in google-generative-ai chat provider
      localStorage.setItem('settings/credentials/providers', JSON.stringify({
        'google-generative-ai': { apiKey: 'shared-gemini-key' },
      }))

      // Validates successfully via inheritance
      const inheritedCheck = await gemini.validators.validateProviderConfig({ apiKey: '' })
      expect(inheritedCheck.valid).toBe(true)

      // Synthesizes speech using inherited key and produces valid WAV response
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                data: 'AAAA', // 4 bytes of base64 PCM
              },
            }],
          },
        }],
      }), { status: 200 }))

      const globalFetch = globalThis.fetch
      globalThis.fetch = mockFetch
      try {
        const provider = await gemini.createProvider({ apiKey: '' })
        const speechInstance = (provider as any).speech('gemini-2.5-flash-preview-tts')
        const response = await speechInstance.fetch('http://unused', {
          method: 'POST',
          body: JSON.stringify({ input: 'Hello world', voice: 'Kore' }),
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('audio/wav')
        expect(mockFetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-goog-api-key': 'shared-gemini-key',
            }),
          }),
        )
      }
      finally {
        globalThis.fetch = globalFetch
      }
    })
  })
})
