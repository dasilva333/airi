import { describe, expect, it, vi } from 'vitest'

import {
  applyVoicevoxParameters,
  fetchEngineVersion,
  fetchSpeakers,
  synthesizeSpeech,
} from './engine'

describe('voicevox engine', () => {
  it('applies synthesis parameters to audio query in place', () => {
    const query = {
      intonationScale: 1,
      pitchScale: 0,
      speedScale: 1,
      volumeScale: 1,
    }

    applyVoicevoxParameters(query, {
      speed: 1.2,
      pitch: 0.1,
      intonation: 1.5,
      volume: 0.8,
    })

    expect(query.speedScale).toBe(1.2)
    expect(query.pitchScale).toBe(0.1)
    expect(query.intonationScale).toBe(1.5)
    expect(query.volumeScale).toBe(0.8)
  })

  it('fetches engine version and unquotes string', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('"0.14.4"', { status: 200 }))

    const version = await fetchEngineVersion('http://localhost:50021', { fetch: mockFetch })
    expect(version).toBe('0.14.4')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:50021/version' }),
      expect.anything(),
    )
  })

  it('fetches speakers list and parses styles', async () => {
    const mockSpeakers = [
      {
        name: '四国めたん',
        speaker_uuid: 'uuid-1',
        styles: [
          { id: 2, name: 'ノーマル' },
          { id: 0, name: 'あまあま' },
        ],
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockSpeakers), { status: 200 }),
    )

    const speakers = await fetchSpeakers('http://localhost:50021', { fetch: mockFetch })
    expect(speakers).toEqual(mockSpeakers)
  })

  it('synthesizes speech with two-step audio_query and synthesis endpoints', async () => {
    const mockAudioQuery = {
      intonationScale: 1,
      pitchScale: 0,
      speedScale: 1,
      volumeScale: 1,
      accent_phrases: [],
    }

    const mockWavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]) // "RIFF"

    const mockFetch = vi.fn()
      .mockImplementationOnce(async (url: URL) => {
        expect(url.pathname).toBe('/audio_query')
        expect(url.searchParams.get('speaker')).toBe('2')
        expect(url.searchParams.get('text')).toBe('こんにちは')
        return new Response(JSON.stringify(mockAudioQuery), { status: 200 })
      })
      .mockImplementationOnce(async (url: URL, init: RequestInit) => {
        expect(url.pathname).toBe('/synthesis')
        expect(url.searchParams.get('speaker')).toBe('2')
        const body = JSON.parse(init.body as string)
        expect(body.speedScale).toBe(1.2)
        return new Response(mockWavBytes.buffer, { status: 200 })
      })

    const wav = await synthesizeSpeech(
      'http://localhost:50021',
      {
        styleId: '2',
        text: 'こんにちは',
        parameters: { speed: 1.2 },
      },
      { fetch: mockFetch },
    )

    expect(new Uint8Array(wav)).toEqual(mockWavBytes)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
