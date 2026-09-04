<script setup lang="ts">
import type { VoiceInfo } from '@proj-airi/stage-ui/stores/providers'
import type { SpeechProvider } from '@xsai-ext/providers/utils'

import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { FieldRange, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface SpeechExpressionTag {
  tag: string
  category?: string
  description?: string
  example?: string
}

const { t } = useI18n()
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)

const providerId = 'airi-audio-server'
const defaultModel = 'omnivoice-tts'
const defaultBaseUrl = 'http://127.0.0.1:8095/v1/'

const defaultVoiceSettings = {
  speed: 1.0,
}

// Speed slider ref
const speed = ref<number>(
  (providers.value[providerId] as any)?.voiceSettings?.speed
  || (providers.value[providerId] as any)?.speed
  || defaultVoiceSettings.speed,
)

// Active Model
const model = computed<string>({
  get: () => (providers.value[providerId]?.model as string) || defaultModel,
  set: (value: string) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

// Active Voice
const voice = computed<string>({
  get: () => (providers.value[providerId]?.voice as string) || '',
  set: (value: string) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].voice = value
  },
})

// Discovered runtime state
const isCheckingHealth = ref(false)
const serverOnline = ref<boolean | null>(null)
const serverError = ref('')
const discoveredModels = ref<Array<{ id: string, name: string, description?: string }>>([])
const discoveredVoices = ref<Array<{ id: string, name: string, description?: string, type?: string, previewURL?: string }>>([])
const expressionTags = ref<SpeechExpressionTag[]>([])

const baseUrl = computed<string>(() => {
  const url = (providers.value[providerId]?.baseUrl as string) || defaultBaseUrl
  return url.endsWith('/') ? url : `${url}/`
})

// Quick Start copy helper
const copiedStep = ref<number | null>(null)
function copyCommand(cmd: string, stepIndex: number) {
  if (typeof navigator !== 'undefined') {
    navigator.clipboard.writeText(cmd)
    copiedStep.value = stepIndex
    setTimeout(() => {
      if (copiedStep.value === stepIndex)
        copiedStep.value = null
    }, 2000)
  }
}

async function checkServerStatus() {
  isCheckingHealth.value = true
  serverError.value = ''
  try {
    const rawUrl = baseUrl.value
    const rootUrl = rawUrl.replace(/\/v1\/?$/, '/')

    // 1. Health / Models check
    const modelsRes = await fetch(`${rawUrl}models`).catch(() => null)
    const healthRes = await fetch(`${rootUrl}health`).catch(() => null)

    if ((modelsRes && modelsRes.ok) || (healthRes && healthRes.ok)) {
      serverOnline.value = true
    }
    else {
      serverOnline.value = false
      serverError.value = 'Server did not respond on configured port. Is airi-audio-server running?'
    }

    // 2. Query models
    if (modelsRes && modelsRes.ok) {
      const data = await modelsRes.json()
      const list = Array.isArray(data?.data) ? data.data : []
      if (list.length > 0) {
        discoveredModels.value = list.map((m: any) => ({
          id: m.id,
          name: m.name || m.display_name || m.id,
          description: m.description,
        }))
      }
    }

    // 3. Query voices
    const voicesRes = await fetch(`${rawUrl}voices`).catch(() => null)
    if (voicesRes && voicesRes.ok) {
      const data = await voicesRes.json()
      const list = Array.isArray(data?.voices) ? data.voices : []
      discoveredVoices.value = list.map((v: any) => ({
        id: v.voice_id || v.id || v.name,
        name: v.name || v.voice_id || v.id,
        description: v.description,
        type: v.type,
        previewURL: v.preview_url || v.preview_audio_url,
      }))
      if (!voice.value && discoveredVoices.value.length > 0) {
        voice.value = discoveredVoices.value[0].id
      }
    }

    // 4. Query capabilities (paralinguistic tags)
    const capEndpoints = [
      `${rawUrl}capabilities`,
      `${rootUrl}capabilities`,
      `${rootUrl}chatterbox/capabilities`,
    ]
    for (const endpoint of capEndpoints) {
      try {
        const capRes = await fetch(endpoint)
        if (capRes.ok) {
          const capData = await capRes.json()
          const tags = capData?.speech?.expressionTags || capData?.expressionTags
          if (Array.isArray(tags) && tags.length > 0) {
            expressionTags.value = tags
            break
          }
          if (Array.isArray(capData?.tags) && capData.tags.length > 0) {
            expressionTags.value = capData.tags.map((t: string) => ({ tag: t }))
            break
          }
        }
      }
      catch {}
    }
  }
  catch (err) {
    serverOnline.value = false
    serverError.value = (err as Error).message
  }
  finally {
    isCheckingHealth.value = false
  }
}

// Fallback Voice Catalog
const fallbackVoices: VoiceInfo[] = [
  { id: 'omnivoice-default', name: 'OmniVoice Default (Female Warm)', provider: providerId, languages: [{ code: 'en-US', title: 'English' }] },
  { id: 'female-calm', name: 'Female Calm', provider: providerId, languages: [{ code: 'en-US', title: 'English' }] },
  { id: 'male-deep', name: 'Male Deep', provider: providerId, languages: [{ code: 'en-US', title: 'English' }] },
  { id: 'anime-girl', name: 'Anime Girl (Energetic)', provider: providerId, languages: [{ code: 'en-US', title: 'English' }] },
  { id: 'chatterbox-default', name: 'Chatterbox Default', provider: providerId, languages: [{ code: 'en-US', title: 'English' }] },
]

const availableVoices = computed<VoiceInfo[]>(() => {
  if (discoveredVoices.value.length > 0) {
    return discoveredVoices.value.map(v => ({
      id: v.id,
      name: v.name,
      provider: providerId,
      languages: [{ code: 'en-US', title: 'English' }],
      description: v.description,
      previewURL: v.previewURL,
    }))
  }
  const storeVoices = speechStore.availableVoices[providerId] || []
  if (storeVoices.length > 0) {
    return storeVoices
  }
  return fallbackVoices
})

const defaultModelOptions = [
  { value: 'omnivoice-tts', label: 'OmniVoice Q8_0 (Recommended)' },
  { value: 'higgs-audio-tts', label: 'Higgs Audio v3 TTS Q8_0' },
  { value: 'fish-audio-tts', label: 'Fish Audio S2 Pro Q8_0' },
  { value: 'chatterbox-tts', label: 'Chatterbox TTS Q8_0' },
  { value: 'moss-tts', label: 'MOSS TTS Local v1.5 Q8_0' },
]

const modelOptions = computed(() => {
  if (discoveredModels.value.length > 0) {
    return discoveredModels.value.map(m => ({
      value: m.id,
      label: m.name,
    }))
  }
  return defaultModelOptions
})

// Watch speed slider changes
watch(speed, async () => {
  if (!providers.value[providerId])
    providers.value[providerId] = {}
  ;(providers.value[providerId] as any).speed = speed.value
  ;(providers.value[providerId] as any).voiceSettings = {
    ...defaultVoiceSettings,
    speed: speed.value,
  }
})

// Re-check server on baseUrl change
watch(() => providers.value[providerId]?.baseUrl, () => {
  checkServerStatus()
})

onMounted(() => {
  if (!providers.value[providerId]) {
    providers.value[providerId] = {}
  }
  if (!providers.value[providerId].baseUrl) {
    providers.value[providerId].baseUrl = defaultBaseUrl
  }
  if (!providers.value[providerId].model) {
    providers.value[providerId].model = defaultModel
  }
  checkServerStatus()
})

// Generate speech via speechStore
async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  const provider = await providersStore.getProviderInstance<SpeechProvider<string>>(providerId)
  if (!provider) {
    throw new Error('Failed to initialize AIRI Audio Server provider instance')
  }

  const providerConfig = providersStore.getProviderConfig(providerId)
  const modelToUse = model.value || defaultModel

  return await speechStore.speech(
    provider,
    modelToUse,
    input,
    voiceId || voice.value || 'omnivoice-default',
    {
      ...providerConfig,
      ...defaultVoiceSettings,
      speed: speed.value,
    },
  )
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Hero / Repository Introduction Card -->
    <div class="relative overflow-hidden border border-amber-500/20 rounded-2xl from-amber-500/10 via-neutral-100 to-neutral-50 bg-gradient-to-br p-6 dark:from-amber-950/20 dark:via-neutral-900/60 dark:to-neutral-900">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="h-12 w-12 flex items-center justify-center border border-amber-500/30 rounded-xl bg-amber-500/20 text-amber-500 shadow-sm">
            <span class="i-solar:server-square-bold-duotone text-2xl" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg text-neutral-900 font-bold dark:text-white">
                AIRI Audio Server
              </h2>
              <span class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-600 font-semibold dark:text-amber-400">
                audio.cpp C++ Engine
              </span>
            </div>
            <p class="text-xs text-neutral-600 dark:text-neutral-400">
              High-performance, zero-Python local audio microservice supporting OmniVoice, Higgs v3, Fish Audio, and Chatterbox.
            </p>
          </div>
        </div>

        <!-- GitHub Repo CTA Link -->
        <a
          href="https://github.com/dasilva333/airi-audio-server"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex cursor-pointer items-center justify-center gap-2 border border-neutral-300 rounded-xl bg-white px-4 py-2 text-xs text-neutral-800 font-semibold shadow-sm transition-all dark:border-neutral-700 hover:border-amber-500 dark:bg-neutral-800 dark:text-neutral-200 hover:shadow-md dark:hover:border-amber-400"
        >
          <span class="i-simple-icons:github text-sm" />
          <span>View on GitHub</span>
          <span class="i-solar:arrow-right-up-linear text-xs text-neutral-400" />
        </a>
      </div>

      <!-- Quick Start Accordion / Guide -->
      <div class="mt-4 border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60">
        <span class="text-[11px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
          Quick Setup Guide (Local Machine)
        </span>
        <div class="grid grid-cols-1 mt-2 gap-2 lg:grid-cols-4 md:grid-cols-2">
          <!-- Step 1 -->
          <div class="flex flex-col justify-between border border-neutral-200/80 rounded-xl bg-white/70 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/70">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-amber-600 font-bold dark:text-amber-400">1. Clone Repository</span>
              <button
                class="cursor-pointer text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                @click="copyCommand('git clone https://github.com/dasilva333/airi-audio-server.git', 1)"
              >
                {{ copiedStep === 1 ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <code class="mt-1 block truncate rounded bg-neutral-100 p-1 text-[10px] text-neutral-700 font-mono dark:bg-neutral-800 dark:text-neutral-300">
              git clone https://github.com/dasilva333/airi-audio-server.git
            </code>
          </div>

          <!-- Step 2 -->
          <div class="flex flex-col justify-between border border-neutral-200/80 rounded-xl bg-white/70 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/70">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-amber-600 font-bold dark:text-amber-400">2. Install Dependencies</span>
              <button
                class="cursor-pointer text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                @click="copyCommand('install.bat', 2)"
              >
                {{ copiedStep === 2 ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <code class="mt-1 block truncate rounded bg-neutral-100 p-1 text-[10px] text-neutral-700 font-mono dark:bg-neutral-800 dark:text-neutral-300">
              install.bat (or npm install)
            </code>
          </div>

          <!-- Step 3 -->
          <div class="flex flex-col justify-between border border-neutral-200/80 rounded-xl bg-white/70 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/70">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-amber-600 font-bold dark:text-amber-400">3. Download Models</span>
              <button
                class="cursor-pointer text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                @click="copyCommand('npm run setup', 3)"
              >
                {{ copiedStep === 3 ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <code class="mt-1 block truncate rounded bg-neutral-100 p-1 text-[10px] text-neutral-700 font-mono dark:bg-neutral-800 dark:text-neutral-300">
              npm run setup
            </code>
          </div>

          <!-- Step 4 -->
          <div class="flex flex-col justify-between border border-neutral-200/80 rounded-xl bg-white/70 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/70">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-amber-600 font-bold dark:text-amber-400">4. Run Server (Port 8095)</span>
              <button
                class="cursor-pointer text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                @click="copyCommand('npm start', 4)"
              >
                {{ copiedStep === 4 ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <code class="mt-1 block truncate rounded bg-neutral-100 p-1 text-[10px] text-neutral-700 font-mono dark:bg-neutral-800 dark:text-neutral-300">
              npm start
            </code>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Connection Status Banner -->
    <div
      :class="[
        'flex items-center justify-between p-3.5 rounded-xl border text-xs transition-all duration-200',
        serverOnline === true
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
          : serverOnline === false
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            : 'bg-neutral-100 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400',
      ]"
    >
      <div class="flex items-center gap-2.5">
        <span
          :class="[
            'h-2.5 w-2.5 rounded-full shrink-0',
            serverOnline === true
              ? 'bg-emerald-500 animate-pulse'
              : serverOnline === false
                ? 'bg-amber-500'
                : 'bg-neutral-400',
          ]"
        />
        <div class="flex flex-col">
          <span class="font-bold">
            {{
              serverOnline === true
                ? 'AIRI Audio Server Connected'
                : serverOnline === false
                  ? 'Server Offline or Unreachable'
                  : 'Checking Connection...'
            }}
          </span>
          <span class="text-[11px] opacity-80">
            {{
              serverOnline === true
                ? `${discoveredModels.length} models detected, ${discoveredVoices.length} voices available on ${baseUrl}`
                : serverError || 'Ensure npm start is running on http://127.0.0.1:8095'
            }}
          </span>
        </div>
      </div>
      <button
        :disabled="isCheckingHealth"
        class="inline-flex cursor-pointer items-center gap-1 border border-current/20 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 hover:bg-current/10 disabled:opacity-50"
        @click="checkServerStatus"
      >
        <span :class="['i-solar:restart-bold text-xs', isCheckingHealth ? 'animate-spin' : '']" />
        <span>Recheck</span>
      </button>
    </div>

    <!-- Provider Settings: Two Column Layout (Basic + Voice on Left, Playground on Right) -->
    <SpeechProviderSettings
      :provider-id="providerId"
      default-model="omnivoice-tts"
      :additional-settings="defaultVoiceSettings"
    >
      <!-- Voice Settings Slot (Left Column) -->
      <template #voice-settings>
        <FieldSelect
          v-model="model"
          label="Active Model"
          description="Select the neural speech model (audio.cpp CUDA / CPU engine)"
          :options="modelOptions"
        />

        <FieldRange
          v-model="speed"
          :label="t('settings.pages.providers.provider.common.fields.field.speed.label')"
          :description="`Playback speed multiplier: ${speed.toFixed(2)}x`"
          :min="0.5"
          :max="2.0"
          :step="0.05"
        />

        <!-- Paralinguistic Expression Tags Preview -->
        <div v-if="expressionTags.length > 0" class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
              Expression Tags
            </span>
            <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-600 font-semibold dark:text-amber-400">
              {{ expressionTags.length }} Tags
            </span>
          </div>
          <p class="mt-1 text-[11px] text-neutral-500 leading-snug">
            Tagged vocalizations supported by active model (/v1/capabilities):
          </p>
          <div class="mt-2.5 flex flex-wrap gap-1">
            <span
              v-for="item in expressionTags"
              :key="item.tag"
              class="shadow-2xs dark:border-neutral-750 border border-neutral-200/80 rounded bg-white px-1.5 py-0.5 text-[10px] text-neutral-700 font-mono dark:bg-neutral-800 dark:text-neutral-300"
              :title="item.description || item.tag"
            >
              {{ item.tag }}
            </span>
          </div>
        </div>
      </template>

      <!-- Playground Slot (Right Column) -->
      <template #playground>
        <SpeechPlayground
          :available-voices="availableVoices"
          :generate-speech="handleGenerateSpeech"
          :api-key-configured="true"
          :voices-loading="isCheckingHealth"
          default-text="Hello! This is a real-time speech synthesis test powered by AIRI Audio Server."
        />
      </template>
    </SpeechProviderSettings>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
