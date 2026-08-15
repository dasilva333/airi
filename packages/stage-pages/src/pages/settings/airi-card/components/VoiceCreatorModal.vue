<script setup lang="ts">
import { voicePresets } from '@proj-airi/stage-ui/constants/voices'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, Select } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface Props {
  modelValue: boolean
  characterName?: string
  characterGender?: 'Female' | 'Male' | string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: { baseProvider: string, baseModel: string, baseVoice: string }): void
}>()

const providersStore = useProvidersStore()
const speechStore = useSpeechStore()

const voiceForm = ref({
  name: '',
  baseProvider: 'kokoro-local',
  baseModel: '',
  baseVoice: 'af_heart',
  pitch: 1.0,
  rate: 1.0,
  filterByGender: true,
  testText: 'Hello! This is a preview of my new voice. How does it sound?',
})

const speechProviders = computed(() => {
  const list = [
    { value: 'kokoro-local', label: 'Kokoro TTS (Local)' },
    { value: 'virtual-audio-studio', label: 'Audio Studio (Saved Profiles)' },
  ]
  providersStore.configuredSpeechProvidersMetadata.forEach((meta) => {
    if (meta.id !== 'kokoro-local' && meta.id !== 'virtual-audio-studio' && meta.id !== 'speech-noop') {
      list.push({ value: meta.id, label: meta.name })
    }
  })
  return list
})

const isLoadingProviderData = ref(false)
const selectedProviderVoices = ref<any[]>([])
const selectedProviderModels = ref<any[]>([])

watch(() => voiceForm.value.baseProvider, async (newProvider) => {
  if (!newProvider || newProvider === 'kokoro-local') {
    selectedProviderVoices.value = []
    selectedProviderModels.value = []
    return
  }

  if (newProvider === 'virtual-audio-studio') {
    selectedProviderModels.value = []
    selectedProviderVoices.value = speechStore.savedVoiceProfiles
      .filter(p => p.id !== 'voice_profile_auto_preview')
      .map(p => ({
        id: p.id,
        name: p.name,
        gender: 'saved profile',
      }))
    if (selectedProviderVoices.value.length > 0) {
      voiceForm.value.baseVoice = selectedProviderVoices.value[0].id
    }
    else {
      voiceForm.value.baseVoice = ''
    }
    return
  }

  isLoadingProviderData.value = true
  try {
    await speechStore.loadVoicesForProvider(newProvider)
    await providersStore.loadModelsForConfiguredProviders()

    selectedProviderVoices.value = speechStore.availableVoices[newProvider] || []
    selectedProviderModels.value = providersStore.getModelsForProvider(newProvider) || []

    if (selectedProviderVoices.value.length > 0) {
      voiceForm.value.baseVoice = selectedProviderVoices.value[0].id
    }
    else {
      voiceForm.value.baseVoice = ''
    }

    if (selectedProviderModels.value.length > 0) {
      voiceForm.value.baseModel = selectedProviderModels.value[0].id
    }
    else {
      const config = providersStore.getProviderConfig(newProvider)
      voiceForm.value.baseModel = (config?.model as string) || ''
    }
  }
  catch (err) {
    console.error('Error loading provider models/voices:', err)
  }
  finally {
    isLoadingProviderData.value = false
  }
})

// Preset Gender Filter
const filteredVoicePresets = computed(() => {
  if (!voiceForm.value.filterByGender || !props.characterGender) {
    return voicePresets
  }
  const cleanGender = props.characterGender.toLowerCase()
  return voicePresets.filter((v) => {
    return v.gender.toLowerCase() === cleanGender
  })
})

// Initialize state
watch(() => [props.modelValue, props.characterName, props.characterGender], () => {
  if (props.modelValue) {
    const slug = props.characterName ? props.characterName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'custom'
    voiceForm.value.name = `${slug}_voice`
    voiceForm.value.baseProvider = 'kokoro-local'
    voiceForm.value.pitch = 1.0
    voiceForm.value.rate = 1.0

    if (props.characterGender) {
      const g = props.characterGender.toLowerCase()
      if (g === 'female') {
        voiceForm.value.baseVoice = 'af_heart'
        voiceForm.value.filterByGender = true
      }
      else if (g === 'male') {
        voiceForm.value.baseVoice = 'am_adam'
        voiceForm.value.filterByGender = true
      }
      else {
        voiceForm.value.filterByGender = false
      }
    }
    else {
      voiceForm.value.filterByGender = false
    }
  }
}, { immediate: true })

function handleSave() {
  if (voiceForm.value.baseProvider !== 'kokoro-local') {
    emit('save', {
      baseProvider: voiceForm.value.baseProvider,
      baseModel: voiceForm.value.baseProvider === 'virtual-audio-studio' ? 'virtual' : voiceForm.value.baseModel,
      baseVoice: voiceForm.value.baseVoice,
    })
    emit('update:modelValue', false)
    return
  }

  const profileId = `voice_profile_${voiceForm.value.name.trim()}`
  const configuredModel = (providersStore.getProviderConfig('kokoro-local')?.model as string) || 'q4'
  const newProfile = {
    id: profileId,
    name: voiceForm.value.name.trim(),
    baseProvider: 'kokoro-local',
    baseModel: configuredModel,
    baseVoice: voiceForm.value.baseVoice,
    effects: {
      pitch: voiceForm.value.pitch,
      rate: voiceForm.value.rate,
      volume: 1.0,
      asmr: 0,
      radio: 0,
      robot: 0,
      reverb: 0,
      spatial: 0,
    },
    ust: {
      enabled: true,
      mode: 'mute' as any,
      customStripChars: '*_[]()<>"\'',
      stripEmojis: true,
      tildeReplacement: '',
      autoLowercaseCapsThreshold: 2,
      autoLowercaseCapsExclude: [],
      convertBracketsToTokenFormat: true,
      customReplacements: [],
    },
  }

  speechStore.saveVoiceProfile(newProfile as any)
  toast.success(`Voice profile "${voiceForm.value.name}" created!`)
  emit('save', {
    baseProvider: 'virtual-audio-studio',
    baseModel: 'virtual',
    baseVoice: profileId,
  })
  emit('update:modelValue', false)
}

async function playVoicePreview() {
  try {
    toast.info('Synthesizing audio preview...')
    if (voiceForm.value.baseProvider === 'virtual-audio-studio') {
      const provider = await providersStore.getProviderInstance('virtual-audio-studio')
      if (!provider) {
        throw new Error('Virtual Audio Studio provider is not active.')
      }
      const audioData = await speechStore.speech(
        provider as any,
        'virtual',
        voiceForm.value.testText,
        voiceForm.value.baseVoice,
      )
      const audioUrl = URL.createObjectURL(new Blob([audioData]))
      const audio = new Audio(audioUrl)
      audio.play()
      return
    }

    const provider = await providersStore.getProviderInstance(voiceForm.value.baseProvider)
    if (!provider) {
      throw new Error(`Provider "${voiceForm.value.baseProvider}" is not active or configured. Please enable it in Settings > Providers.`)
    }
    const model = voiceForm.value.baseProvider === 'kokoro-local'
      ? ((providersStore.getProviderConfig('kokoro-local')?.model as string) || 'q4')
      : voiceForm.value.baseModel

    const audioData = await speechStore.speech(
      provider as any,
      model,
      voiceForm.value.testText,
      voiceForm.value.baseVoice,
    )
    const audioUrl = URL.createObjectURL(new Blob([audioData]))
    const audio = new Audio(audioUrl)
    audio.play()
  }
  catch (err: any) {
    console.error('[VoiceCreatorModal] Play preview error:', err)
    toast.error(err.message || 'Failed to play voice preview.')
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-[10001] m-0 max-h-[90vh] max-w-xl w-[90vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-900"
        @pointer-down-outside.prevent
      >
        <!-- Header -->
        <div class="border-b border-neutral-100 p-6 pb-4 dark:border-neutral-800 sm:p-8">
          <div class="flex items-center gap-2">
            <div class="rounded-xl bg-primary-500/10 p-2 text-primary-500 shadow-primary-500/10 shadow-sm">
              <div class="i-solar:music-notes-bold-duotone text-xl" />
            </div>
            <DialogTitle class="text-base text-neutral-800 font-bold dark:text-neutral-100">
              Configure Custom Voice
            </DialogTitle>
          </div>
        </div>

        <!-- Form fields -->
        <div class="flex flex-1 flex-col gap-5 overflow-y-auto p-6 sm:p-8">
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Voice Provider</label>
            <Select v-model="voiceForm.baseProvider" :options="speechProviders" />
          </div>
          <!-- Loading indicator -->
          <div v-if="isLoadingProviderData" class="flex items-center gap-2 border border-primary-500/20 rounded-xl bg-primary-500/5 px-4 py-2 text-xs text-primary-600 dark:text-primary-400">
            <span class="i-solar:restart-square-outline animate-spin text-base" />
            <span>Fetching speech voices and models details...</span>
          </div>

          <!-- Kokoro Specialized Controls -->
          <div v-if="voiceForm.baseProvider === 'kokoro-local'" class="flex flex-col gap-5">
            <!-- Voice Name -->
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Voice Profile Name</label>
              <input
                v-model="voiceForm.name"
                type="text"
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950/60 dark:text-neutral-200"
              >
            </div>

            <!-- Kokoro Preset Voice Grid -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Select Voice Preset</label>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-neutral-500 font-semibold">Gender Filter:</span>
                  <input
                    v-model="voiceForm.filterByGender"
                    type="checkbox"
                    class="border-neutral-300 rounded bg-white text-primary-500 dark:border-neutral-800 dark:bg-neutral-950 focus:ring-primary-500"
                  >
                </div>
              </div>

              <div class="grid grid-cols-1 max-h-[160px] gap-2 overflow-y-auto pr-1">
                <div
                  v-for="voice in filteredVoicePresets"
                  :key="voice.id"
                  :class="[
                    'flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-colors',
                    voiceForm.baseVoice === voice.id
                      ? 'border-primary-500 bg-primary-500/5'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950/40 dark:hover:bg-neutral-950/80',
                  ]"
                  @click="voiceForm.baseVoice = voice.id"
                >
                  <div class="min-w-0 flex items-center gap-2">
                    <span class="shrink-0 text-xs text-neutral-800 font-bold dark:text-neutral-200">{{ voice.name }}</span>
                    <span class="text-xs text-neutral-400 dark:text-neutral-600">—</span>
                    <span class="truncate text-[10px] text-neutral-500 italic">{{ voice.description }}</span>
                  </div>
                  <div class="ml-3 flex shrink-0 items-center gap-1.5">
                    <span class="rounded bg-neutral-200 px-1.5 py-0.5 text-[8px] text-neutral-600 font-bold uppercase dark:bg-neutral-800 dark:text-neutral-400">
                      {{ voice.gender }}
                    </span>
                    <span class="rounded bg-neutral-200 px-1.5 py-0.5 text-[8px] text-neutral-600 font-bold uppercase dark:bg-neutral-800 dark:text-neutral-400">
                      {{ voice.accent }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- DSP Sliders -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Pitch -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Pitch Shift</label>
                  <span class="text-xs text-primary-500 font-semibold">{{ voiceForm.pitch.toFixed(1) }}x</span>
                </div>
                <input
                  v-model.number="voiceForm.pitch"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  class="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
                >
              </div>

              <!-- Speed -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Speech Speed</label>
                  <span class="text-xs text-primary-500 font-semibold">{{ voiceForm.rate.toFixed(1) }}x</span>
                </div>
                <input
                  v-model.number="voiceForm.rate"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  class="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
                >
              </div>
            </div>
          </div>

          <!-- Other standard providers -->
          <div v-else class="flex flex-col gap-4">
            <!-- Voice Name -->
            <div v-if="voiceForm.baseProvider !== 'virtual-audio-studio'" class="flex flex-col gap-1.5">
              <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Voice Profile Name</label>
              <input
                v-model="voiceForm.name"
                type="text"
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950/60 dark:text-neutral-200"
              >
            </div>

            <!-- Model Select -->
            <div v-if="voiceForm.baseProvider !== 'virtual-audio-studio'" class="flex flex-col gap-1.5">
              <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Speech Model</label>
              <Select
                v-if="selectedProviderModels.length > 0"
                v-model="voiceForm.baseModel"
                :options="selectedProviderModels.map(m => ({ value: m.id, label: m.name || m.id }))"
                placeholder="Select model"
              />
              <input
                v-else
                v-model="voiceForm.baseModel"
                type="text"
                placeholder="e.g. tts-1"
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950/60 dark:text-neutral-200"
              >
            </div>

            <!-- Voice ID Select -->
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Speech Voice ID / Profile</label>
              <Select
                v-if="selectedProviderVoices.length > 0"
                v-model="voiceForm.baseVoice"
                :options="selectedProviderVoices.map(v => ({ value: v.id, label: v.gender === 'saved profile' ? v.name : `${v.name} (${v.gender})` }))"
                placeholder="Select voice"
              />
              <input
                v-else
                v-model="voiceForm.baseVoice"
                type="text"
                placeholder="e.g. alloy, bella"
                class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950/60 dark:text-neutral-200"
              >
            </div>
          </div>

          <!-- Playground -->
          <div class="flex flex-col gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800/60">
            <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Voice Playground</label>
            <div class="flex gap-2">
              <input
                v-model="voiceForm.testText"
                type="text"
                class="flex-1 border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-2 text-xs text-neutral-700 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950/60 dark:text-neutral-300"
              >
              <Button
                variant="secondary"
                class="h-[36px] flex items-center gap-1 border border-neutral-200 rounded-xl px-4 text-xs font-bold dark:border-neutral-800"
                @click="playVoicePreview"
              >
                <div i-solar:play-circle-bold-duotone class="text-sm" />
                Play
              </Button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50/50 p-6 pt-4 dark:border-neutral-800 dark:bg-black/20 sm:p-8">
          <Button
            variant="ghost"
            class="h-[36px] border border-neutral-200 rounded-xl px-4 text-xs font-bold dark:border-neutral-800"
            @click="emit('update:modelValue', false)"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            class="h-[36px] border border-primary-500/20 rounded-xl px-5 text-xs font-bold shadow-lg shadow-primary-500/10"
            @click="handleSave"
          >
            Save Voice Profile
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
