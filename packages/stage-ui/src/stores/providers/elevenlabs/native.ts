import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'
import type { UnElevenLabsOptions } from 'unspeech'

export interface NativeElevenLabsOptions {
  voiceSettings?: UnElevenLabsOptions['voiceSettings']
}

/**
 * Creates a native ElevenLabs speech provider that bypasses unspeech / OpenAI format standards.
 *
 * xsai's `generateSpeech` strictly assumes OpenAI's `/v1/audio/speech` JSON payload shape.
 * However, the native ElevenLabs API requires:
 * 1. `{voice_id}` in the URL instead of the JSON body.
 * 2. `text` instead of `input`, and `model_id` instead of `model`.
 * 3. Proprietary `voice_settings` for tuning.
 *
 * To bridge this without a custom proxy server, we must intercept the payload via a custom `fetch`.
 */
export function createNativeElevenLabsProvider(
  apiKey: string,
  baseUrl: string,
  baseVoiceSettings?: UnElevenLabsOptions['voiceSettings'],
): SpeechProviderWithExtraOptions<string, NativeElevenLabsOptions> {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '')

  return {
    speech: (model: string, options?: NativeElevenLabsOptions) => {
      const nativeFetch: typeof globalThis.fetch = async (_url, init) => {
        const body = JSON.parse((init?.body as string) || '{}') as {
          input?: string
          voice?: string
          model?: string
        }

        const voiceId = encodeURIComponent(body.voice ?? '')
        const text = body.input ?? ''
        const modelId = model.replace(/^elevenlabs\//, '')

        // Priority: per-request options > provider-level config > hardcoded defaults
        const voiceSettings = options?.voiceSettings ?? baseVoiceSettings ?? { similarityBoost: 0.75, stability: 0.5 }

        return globalThis.fetch(`${normalizedBaseUrl}/text-to-speech/${voiceId}`, {
          body: JSON.stringify({
            model_id: modelId,
            text,
            voice_settings: {
              similarity_boost: voiceSettings.similarityBoost ?? 0.75,
              stability: voiceSettings.stability ?? 0.5,
              style: voiceSettings.style,
              use_speaker_boost: voiceSettings.useSpeakerBoost,
            },
          }),
          headers: {
            accept: 'audio/mpeg',
            'content-type': 'application/json',
            'xi-api-key': apiKey,
          },
          method: 'POST',
        })
      }

      return {
        apiKey,
        baseURL: normalizedBaseUrl,
        fetch: nativeFetch,
        model: `elevenlabs/${model}`,
      }
    },
  }
}
