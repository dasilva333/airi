import type { TranscriptionProvider } from '@xsai-ext/providers/utils'

import { getWhistleClient } from '../../../libs/inference/adapters/whistle-client'

/** Sample rate Whistle expects (16 kHz mono PCM). */
const WHISTLE_SAMPLE_RATE = 16000

/**
 * Resample Float32Array PCM from sourceSampleRate to 16000 Hz.
 */
function resampleTo16k(input: Float32Array, sourceSampleRate: number): Float32Array {
  if (sourceSampleRate === WHISTLE_SAMPLE_RATE)
    return input

  const ratio = sourceSampleRate / WHISTLE_SAMPLE_RATE
  const targetLength = Math.round(input.length / ratio)
  const output = new Float32Array(targetLength)

  for (let i = 0; i < targetLength; i++) {
    const sourceIdx = i * ratio
    const idxFloor = Math.floor(sourceIdx)
    const idxCeil = Math.min(input.length - 1, idxFloor + 1)
    const weight = sourceIdx - idxFloor
    output[i] = input[idxFloor] * (1 - weight) + input[idxCeil] * weight
  }

  return output
}

/**
 * Decode an audio Blob to 16 kHz mono Float32Array PCM for Whistle.
 */
async function decodeToWhistleAudio(blob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext({ sampleRate: WHISTLE_SAMPLE_RATE })
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const decoded = await audioContext.decodeAudioData(arrayBuffer)
    let mono: Float32Array

    if (decoded.numberOfChannels === 1) {
      mono = decoded.getChannelData(0)
    }
    else {
      const left = decoded.getChannelData(0)
      const right = decoded.getChannelData(1)
      mono = new Float32Array(left.length)
      for (let i = 0; i < left.length; i++)
        mono[i] = (left[i] + right[i]) / 2
    }

    const finalPcm = resampleTo16k(mono, decoded.sampleRate)

    console.info('[Whistle Local Provider] Audio file decoded:', {
      originalSampleRate: decoded.sampleRate,
      targetSampleRate: WHISTLE_SAMPLE_RATE,
      originalDurationSec: Number(decoded.duration.toFixed(2)),
      finalSamples: finalPcm.length,
      finalDurationSec: Number((finalPcm.length / WHISTLE_SAMPLE_RATE).toFixed(2)),
    })

    return finalPcm
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

        console.info('[Whistle Local Provider] Starting transcription pipeline:', {
          fileSize: file.size,
          fileType: file.type,
          language,
        })

        const audioFloat32 = await decodeToWhistleAudio(file)

        const client = getWhistleClient()
        if (!client.isReady()) {
          console.info('[Whistle Local Provider] Client not ready, running prepare...')
          await client.prepare()
        }

        const res = await client.transcribe(audioFloat32, {
          language,
          keywords: config.keywords || [],
          signal: init?.signal ?? undefined,
        })

        console.info('[Whistle Local Provider] Client transcription result:', res)

        return new Response(JSON.stringify({ text: res.text, words: res.words, latencyMs: res.latencyMs }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }),
  }
}
