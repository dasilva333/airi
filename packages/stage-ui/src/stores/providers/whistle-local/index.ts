import type { TranscriptionProvider } from '@xsai-ext/providers/utils'

import { getWhistleClient } from '../../../libs/inference/adapters/whistle-client'

/** Sample rate Whistle expects (16 kHz mono PCM). */
const WHISTLE_SAMPLE_RATE = 16000

/**
 * Decode an audio Blob to 16 kHz mono Float32Array PCM for Whistle.
 */
async function decodeToWhistleAudio(blob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext({ sampleRate: WHISTLE_SAMPLE_RATE })
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const decoded = await audioContext.decodeAudioData(arrayBuffer)
    if (decoded.numberOfChannels === 1)
      return decoded.getChannelData(0)

    const left = decoded.getChannelData(0)
    const right = decoded.getChannelData(1)
    const mono = new Float32Array(left.length)
    for (let i = 0; i < left.length; i++)
      mono[i] = (left[i] + right[i]) / 2
    return mono
  }
  finally {
    await audioContext.close()
  }
}

export interface WhistleLocalProviderConfig {
  language?: string
  keywords?: string[]
}

/**
 * Local Whistle transcription provider.
 *
 * Runs ultra-fast on-device ASR using Cactus Whistle (16.9 MB):
 * - Sub-20ms time-to-first-token on CPU
 * - 16 kHz mono Float32Array audio input
 * - Keyword biasing support
 */
export function createWhistleLocalTranscriptionProvider(config: WhistleLocalProviderConfig = {}): TranscriptionProvider {
  const defaultLanguage = config.language || 'en'

  return {
    transcription: model => ({
      baseURL: 'http://whistle-local/v1/',
      model: model || 'whistle-base',
      headers: {},
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        const formData = init?.body as FormData
        const file = formData?.get('file') as Blob | null
        if (!file)
          throw new Error('No audio file provided for transcription.')

        const language = (formData?.get('language') as string) || defaultLanguage
        const audioFloat32 = await decodeToWhistleAudio(file)

        const client = getWhistleClient()
        if (!client.isReady()) {
          await client.prepare()
        }

        const res = await client.transcribe(audioFloat32, {
          language,
          keywords: config.keywords || [],
          signal: init?.signal ?? undefined,
        })

        return new Response(JSON.stringify({ text: res.text }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }),
  }
}
