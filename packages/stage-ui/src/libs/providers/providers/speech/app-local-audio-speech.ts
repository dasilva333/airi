import type { ProviderMetadata } from '../../../../stores/providers/types'

import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { isStageTamagotchi } from '@proj-airi/stage-shared'

// Inline Eventa definitions to decouple package from the app
export const electronGetNativeTtsVoices = defineInvokeEventa<any[]>('eventa:invoke:electron:speech:get-native-tts-voices')
export const electronGenerateNativeTts = defineInvokeEventa<ArrayBuffer | null, { text: string, voiceId?: string }>('eventa:invoke:electron:speech:generate-native-tts')

// Helper to get Eventa context in renderer
function getEventaInvokers() {
  const win = window as any
  if (typeof window !== 'undefined' && win.electron?.ipcRenderer) {
    const { context } = createContext(win.electron.ipcRenderer as any)
    return {
      getVoices: defineInvoke(context, electronGetNativeTtsVoices),
      generateTts: defineInvoke(context, electronGenerateNativeTts),
    }
  }
  return null
}

const definition: ProviderMetadata = {
  id: 'app-local-audio-speech',
  category: 'speech',
  tasks: ['text-to-speech', 'tts'],
  nameKey: 'settings.pages.providers.provider.app-local-audio-speech.title',
  name: 'App (Local)',
  descriptionKey: 'settings.pages.providers.provider.app-local-audio-speech.description',
  description: 'Native TTS - Uses operating system\'s built-in text-to-speech engine',
  icon: 'i-solar:volume-loud-bold-duotone',
  isAvailableBy: isStageTamagotchi,
  pricing: 'free',
  deployment: 'local',
  defaultOptions: () => ({
    deviceId: '',
    sampleRate: 24000,
  }),
  createProvider: async (_config: any) => {
    return {
      speech: (model: string, _extraOptions?: any) => {
        return {
          baseURL: 'http://app-local-speech.invalid/v1/',
          model: model || 'app-local-tts',
          headers: {},
          fetch: async (_url: string | URL | Request, options?: RequestInit) => {
            const invokers = getEventaInvokers()
            if (!invokers) {
              throw new Error('Electron context not available')
            }

            let text = ''
            let voiceId = ''
            try {
              const body = JSON.parse(options?.body as string)
              text = body.input || ''
              voiceId = body.voice || ''
            }
            catch (e) {
              console.error('[App Local Speech] Failed to parse request body:', e)
            }

            if (!text) {
              return new Response(new ArrayBuffer(0), {
                headers: { 'Content-Type': 'audio/wav' },
              })
            }

            // Generate native speech WAV buffer from main process
            const arrayBuffer = await invokers.generateTts({
              text,
              voiceId,
            })

            const responseBuffer = arrayBuffer || new ArrayBuffer(0)
            return new Response(responseBuffer, {
              headers: { 'Content-Type': 'audio/wav' },
            })
          },
        }
      },
    } as any
  },
  capabilities: {
    listVoices: async () => {
      const invokers = getEventaInvokers()
      if (!invokers)
        return []
      try {
        const rawVoices = await invokers.getVoices() || []
        return rawVoices.map((voice: any) => ({
          id: voice.id,
          name: voice.name,
          provider: 'app-local-audio-speech',
          languages: [{
            code: voice.lang,
            title: voice.lang,
          }],
          description: `${voice.name} (${voice.lang})`,
          gender: voice.gender ? voice.gender.toLowerCase() : 'neutral',
        }))
      }
      catch (error) {
        console.error('[App Local Speech] Failed to fetch native voices:', error)
        return []
      }
    },
    listModels: async () => {
      return [{
        id: 'web-speech-api',
        name: 'Web Speech API',
        provider: 'app-local-audio-speech',
        description: 'System built-in text-to-speech',
      }]
    },
  },
  validators: {
    validateProviderConfig: () => {
      return {
        errors: [],
        reason: '',
        valid: true,
      }
    },
  },
}

export default definition
export { definition as appLocalAudioSpeech }
