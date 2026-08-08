<script setup lang="ts">
import type { VoiceInfo } from '../../../stores/providers'

import { FieldCheckbox, FieldSelect } from '@proj-airi/ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SpeechStreamingPlayground from './speech-streaming-playground.vue'

import { TestDummyMarker } from '../../gadgets'

const props = defineProps<{
  // Input fields
  defaultText?: string
  availableVoices: VoiceInfo[]

  // Provider-specific handlers (provided from parent)
  generateSpeech: (input: string, voice: string, useSSML: boolean) => Promise<ArrayBuffer>

  // Current state
  apiKeyConfigured?: boolean
  voicesLoading?: boolean
}>()

const { t } = useI18n()

// Playground state
const testText = ref(props.defaultText || 'Hello! This is a test of the voice synthesis.')
const isGenerating = ref(false)
const audioUrl = ref('')
const errorMessage = ref('')
const audioPlayer = ref<HTMLAudioElement | null>(null)
const useSSML = ref(false)
const ssmlText = ref('')
const selectedVoice = ref('')

const latencyMs = ref<number | null>(null)
const audioDurationSec = ref<number | null>(null)
const rtf = ref<number | null>(null)

// Watch for changes in available voices
watch(
  () => props.availableVoices,
  (newVoices) => {
    if (newVoices.length > 0 && !selectedVoice.value) {
      selectedVoice.value = newVoices[0]?.id || ''
    }
  },
  { immediate: true },
)

const voiceOptions = computed(() => {
  return props.availableVoices.map(voice => ({
    value: voice.id,
    label: voice.name,
  }))
})

// Function to generate speech
async function handleGenerateTestSpeech() {
  if ((!testText.value.trim() && !useSSML.value) || (useSSML.value && !ssmlText.value.trim()) || !selectedVoice.value)
    return

  isGenerating.value = true
  errorMessage.value = ''
  latencyMs.value = null
  audioDurationSec.value = null
  rtf.value = null

  try {
    // Stop any currently playing audio
    if (audioUrl.value) {
      stopTestAudio()
    }

    const input = useSSML.value ? ssmlText.value : testText.value

    const startTime = performance.now()
    const response = await props.generateSpeech(input, selectedVoice.value, useSSML.value)
    const endTime = performance.now()

    const elapsedMs = endTime - startTime
    latencyMs.value = Math.round(elapsedMs)

    // Decode audio duration and compute RTF
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        const ctx = new AudioContextClass()
        const decoded = await ctx.decodeAudioData(response.slice(0))
        audioDurationSec.value = decoded.duration
        rtf.value = Number((elapsedMs / (decoded.duration * 1000)).toFixed(3))
        await ctx.close()
      }
    }
    catch (e) {
      console.warn('Failed to decode audio duration for stats:', e)
    }

    // Convert the response to a blob and create an object URL
    audioUrl.value = URL.createObjectURL(new Blob([response]))

    // Play the audio
    setTimeout(() => {
      if (audioPlayer.value) {
        audioPlayer.value.play()
      }
    }, 100)
  }
  catch (error) {
    console.error('Error generating speech:', error)
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred'
  }
  finally {
    isGenerating.value = false
  }
}

// Function to stop audio playback
function stopTestAudio() {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
  }

  // Clean up the object URL to prevent memory leaks
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
}

// Clean up when component is unmounted
onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
})

// Expose public methods and state
defineExpose({
  testText,
  ssmlText,
  useSSML,
  selectedVoice,
  isGenerating,
  audioUrl,
  errorMessage,
  audioPlayer,
  generateTestSpeech: handleGenerateTestSpeech,
  stopTestAudio,
})
</script>

<template>
  <div w-full rounded-xl>
    <h2 class="mb-4 text-lg text-neutral-500 md:text-2xl dark:text-neutral-400" w-full>
      <div class="inline-flex items-center gap-4">
        <TestDummyMarker />
        <div>
          {{ t('settings.pages.providers.provider.elevenlabs.playground.title') }}
        </div>
      </div>
    </h2>
    <div flex="~ col gap-4">
      <FieldCheckbox
        v-model="useSSML"
        :label="t('settings.pages.modules.speech.sections.section.voice-settings.use-ssml.label')"
        :description="t('settings.pages.modules.speech.sections.section.voice-settings.use-ssml.description')"
      />

      <div
        v-if="useSSML"

        dark:bg-amber-900-20 dark:border-amber-800-40 border border-l-2 border-amber-200 rounded-r-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed lg:text-sm dark:text-amber-300
      >
        <div i-solar:warning-bold-duotone mr-1.5 inline-block h-4 w-4 align-middle />
        {{ t('settings.pages.modules.speech.sections.section.voice-settings.use-ssml.warning') }}
      </div>

      <template v-if="!useSSML">
        <textarea
          v-model="testText"
          :placeholder="t('settings.pages.providers.provider.elevenlabs.playground.fields.field.input.placeholder')"
          border="neutral-100 dark:neutral-800 solid 2 focus:neutral-200 dark:focus:neutral-700"
          transition="all duration-250 ease-in-out"
          bg="neutral-100 dark:neutral-800 focus:neutral-50 dark:focus:neutral-900"
          h-24 w-full rounded-lg px-3 py-2 text-sm outline-none
        />
      </template>
      <template v-else>
        <textarea
          v-model="ssmlText"
          :placeholder="t('settings.pages.modules.speech.sections.section.voice-settings.input-ssml.placeholder')"
          border="neutral-100 dark:neutral-800 solid 2 focus:neutral-200 dark:focus:neutral-700"
          transition="all duration-250 ease-in-out"
          bg="neutral-100 dark:neutral-800 focus:neutral-50 dark:focus:neutral-900"
          h-48 w-full rounded-lg px-3 py-2 text-sm font-mono outline-none
        />
      </template>

      <FieldSelect
        v-model="selectedVoice"
        :options="voiceOptions"
        :label="t('settings.pages.providers.provider.elevenlabs.playground.fields.field.voice.label')"
        :description="t('settings.pages.providers.provider.elevenlabs.playground.fields.field.voice.description')"
        layout="horizontal"
      />

      <!-- Playground actions -->
      <button
        border="neutral-800 dark:neutral-200 solid 2" transition="border duration-250 ease-in-out"
        rounded-lg px-3 text="neutral-100 dark:neutral-900" py-1.5 text-sm
        :disabled="isGenerating || voicesLoading || (!testText.trim() && !useSSML) || (useSSML && !ssmlText.trim()) || !selectedVoice || !apiKeyConfigured"
        :class="{ 'opacity-50 cursor-not-allowed': isGenerating || voicesLoading || (!testText.trim() && !useSSML) || (useSSML && !ssmlText.trim()) || !selectedVoice || !apiKeyConfigured }"
        bg="neutral-700 dark:neutral-300" @click="handleGenerateTestSpeech"
      >
        <div flex="~ row" items-center gap-2>
          <div i-solar:play-circle-bold-duotone />
          <span>{{ isGenerating ? t('settings.pages.providers.provider.elevenlabs.playground.buttons.button.test-voice.generating') : t('settings.pages.providers.provider.elevenlabs.playground.buttons.button.test-voice.label') }}</span>
        </div>
      </button>
      <!-- Error messages -->
      <div v-if="!apiKeyConfigured" class="mt-2 text-sm text-red-500">
        {{ t('settings.pages.providers.provider.elevenlabs.playground.validation.error-missing-api-key') }}
      </div>
      <div v-if="voicesLoading || !selectedVoice" class="mt-2 text-sm text-red-500">
        {{ voicesLoading ? t('settings.pages.modules.speech.sections.section.playground.select-voice.loading') : t('settings.pages.modules.speech.sections.section.playground.select-voice.required') }}
      </div>
      <div v-if="errorMessage" class="mt-2 text-sm text-red-500">
        {{ errorMessage }}
      </div>
      <audio v-if="audioUrl" ref="audioPlayer" :src="audioUrl" controls class="mt-2 w-full" />

      <div v-if="latencyMs !== null && audioDurationSec !== null" class="mt-2 flex flex-wrap gap-x-6 gap-y-2 border border-neutral-100 rounded-xl bg-neutral-50/50 p-3.5 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-400">
        <div>
          Latency: <span class="text-neutral-700 font-bold dark:text-neutral-300">{{ latencyMs }}ms</span>
        </div>
        <div>
          Duration: <span class="text-neutral-700 font-bold dark:text-neutral-300">{{ audioDurationSec.toFixed(2) }}s</span>
        </div>
        <div>
          Real-Time Factor (RTF): <span class="text-neutral-700 font-bold dark:text-neutral-300" :class="rtf !== null && rtf < 1.0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'">{{ rtf }}</span>
        </div>
      </div>

      <SpeechStreamingPlayground
        :text="testText"
        :voice="selectedVoice"
        :generate-speech="generateSpeech"
      />
    </div>
    <!-- Slot for additional provider-specific UI in the playground -->
    <slot />
  </div>
</template>
