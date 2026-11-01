<script setup lang="ts">
import type { WebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'
import type { KokoroVoiceProfile } from '@proj-airi/stage-ui/stores/providers/kokoro-audio-utils'
import type { SpeechProvider } from '@xsai-ext/providers/utils'

import { detectWebGPU, getCachedWebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'
import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import {
  deleteKokoroVoiceProfile,
  deriveKokoroStyleVectorFromAudio,
  getKokoroVoiceProfiles,

  preprocessKokoroReferenceAudio,
  saveKokoroVoiceProfile,
} from '@proj-airi/stage-ui/stores/providers/kokoro-audio-utils'
import { getDefaultKokoroModel } from '@proj-airi/stage-ui/workers/kokoro/constants'
import { Button, Callout, Input, Progress, Select } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

const providerId = 'kokoro-local'
const defaultModel = 'kokoro-82m'
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { t } = useI18n()

// State for custom voice cloning
const customVoiceProfiles = ref<KokoroVoiceProfile[]>([])
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editingProfileId = ref<string | null>(null)
const editingName = ref('')

async function loadCustomVoiceProfiles() {
  customVoiceProfiles.value = await getKokoroVoiceProfiles()
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  isUploading.value = true
  const toastId = toast.loading(`Enrolling custom voice "${file.name}"...`)
  try {
    const sha256 = await computeSha256(file)
    const id = `kokoro-profile-${sha256.slice(0, 16)}`
    const rawName = file.name.replace(/\.[^/.]+$/, '')
    const name = rawName.replace(/[^\w\-\s]/g, '').trim() || 'Custom Speaker'

    const buffer = await file.arrayBuffer()
    const preprocessed = await preprocessKokoroReferenceAudio(buffer)
    const derived = await deriveKokoroStyleVectorFromAudio(preprocessed, 16000)

    const profile: KokoroVoiceProfile = {
      id,
      name,
      createdAt: Date.now(),
      sourceFilename: file.name,
      sha256,
      styleVector: Array.from(derived.styleVector),
      blendSummary: derived.blendSummary,
      detectedPitchHz: derived.detectedPitchHz,
    }

    await saveKokoroVoiceProfile(profile, file)
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    toast.success(`Voice "${name}" enrolled (${derived.blendSummary || 'Blended'})!`, { id: toastId })
  }
  catch (err) {
    console.error('Failed to save Kokoro voice profile:', err)
    toast.error(`Voice profile upload failed: ${err}`, { id: toastId })
  }
  finally {
    isUploading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

async function deleteVoiceProfile(id: string) {
  try {
    await deleteKokoroVoiceProfile(id)
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    toast.success('Voice profile deleted.')
  }
  catch (err) {
    console.error('Failed to delete Kokoro voice profile:', err)
  }
}

function startEditing(profile: KokoroVoiceProfile) {
  editingProfileId.value = profile.id
  editingName.value = profile.name
}

function cancelEditing() {
  editingProfileId.value = null
  editingName.value = ''
}

async function saveProfileName(profile: KokoroVoiceProfile) {
  if (!editingName.value.trim())
    return
  try {
    const updated = { ...profile, name: editingName.value.trim() }
    await saveKokoroVoiceProfile(updated)
    editingProfileId.value = null
    editingName.value = ''
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    toast.success('Voice profile renamed.')
  }
  catch (err) {
    console.error('Failed to update Kokoro voice profile name:', err)
  }
}

// Get available voices for Kokoro
const availableVoices = computed(() => {
  return speechStore.availableVoices[providerId] || []
})

// Get provider config
const providerConfig = computed(() => {
  return providersStore.getProviderConfig(providerId)
})

// Cached WebGPU capabilities, used to pick the default model and gate which
// WebGPU quantizations are offered. Populated by the providers store during
// initialization; read synchronously here (re-read on mount).
const webgpuCapabilities = ref<WebGPUCapabilities | null>(getCachedWebGPUCapabilities())

// Track voices loading state
const voicesLoading = ref(false)

// Track model download progress state
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadMessage = ref('')

// Get provider models from store
const providerModels = computed(() => {
  return providersStore.getModelsForProvider(providerId)
})

// Model loading state
const modelsLoading = computed(() => {
  return providersStore.isLoadingModels[providerId] || false
})

// Model computed property
const model = computed({
  get(): string {
    const currentValue = providerConfig.value?.model as string
    if (currentValue)
      return currentValue

    return getDefaultKokoroModel(webgpuCapabilities.value)
  },
  set(val: string) {
    const config = providersStore.getProviderConfig(providerId)
    config.model = val
  },
})

// Model options for the dropdown
const modelOptions = computed(() => {
  return providerModels.value.map(m => ({
    label: m.name,
    value: m.id,
  }))
})

// Generate speech with Kokoro-specific parameters
async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  try {
    const provider = await providersStore.getProviderInstance(providerId) as SpeechProvider
    if (!provider) {
      console.error('[Kokoro Playground] Failed to get provider instance')
      throw new Error('Failed to initialize speech provider')
    }

    const config = providersStore.getProviderConfig(providerId)
    const selectedModel = config.model as string | undefined || defaultModel

    const result = await speechStore.speech(
      provider,
      selectedModel,
      input,
      voiceId,
      {
        ...config,
      },
    )

    return result
  }
  catch (error) {
    console.error('[Kokoro Playground] Error generating speech:', error)
    throw error
  }
}

onMounted(async () => {
  // Check WebGPU support asynchronously to populate capabilities (fp16Supported, etc.)
  webgpuCapabilities.value = await detectWebGPU()

  try {
    voicesLoading.value = true

    // Fetch available models first
    await providersStore.fetchModelsForProvider(providerId)

    // Load custom profiles and voices
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)

    const config = providersStore.getProviderConfig(providerId)
    // Persist the default model if none is saved yet so validation passes on first visit
    if (!config.model) {
      config.model = getDefaultKokoroModel(webgpuCapabilities.value)
    }
    const metadata = providersStore.getProviderMetadata(providerId)
    const validationResult = await metadata.validators.validateProviderConfig(config)
    if (validationResult.valid) {
      // Load the initial model with progress feedback
      if (metadata.capabilities.loadModel) {
        isDownloading.value = true
        downloadProgress.value = 0
        downloadMessage.value = 'Preparing Kokoro TTS model...'
        try {
          await metadata.capabilities.loadModel(config, {
            onProgress: (p: any) => {
              if (typeof p.progress === 'number' && p.progress >= 0) {
                downloadProgress.value = Math.min(100, Math.round(p.progress))
              }
              if (p.file || p.name) {
                downloadMessage.value = `Downloading ${p.file || p.name}...`
              }
            },
          })
        }
        catch (error) {
          console.error('Failed to load initial Kokoro model:', error)
        }
        finally {
          isDownloading.value = false
        }
      }
    }
    else {
      console.error('Failed to validate Kokoro provider config', config, validationResult)
    }
  }
  finally {
    voicesLoading.value = false
  }
})

// Watch for model changes and reload model + voices
watch(model, async (newValue) => {
  if (newValue) {
    try {
      voicesLoading.value = true

      const config = providersStore.getProviderConfig(providerId)
      const metadata = providersStore.getProviderMetadata(providerId)
      const validationResult = await metadata.validators.validateProviderConfig(config)

      if (validationResult.valid && metadata.capabilities.loadModel) {
        isDownloading.value = true
        downloadProgress.value = 0
        downloadMessage.value = `Downloading ${newValue}...`
        try {
          await metadata.capabilities.loadModel(config, {
            onProgress: (p: any) => {
              if (typeof p.progress === 'number' && p.progress >= 0) {
                downloadProgress.value = Math.min(100, Math.round(p.progress))
              }
              if (p.file || p.name) {
                downloadMessage.value = `Downloading ${p.file || p.name}...`
              }
            },
          })
        }
        finally {
          isDownloading.value = false
        }

        // Then reload voices
        await speechStore.loadVoicesForProvider(providerId)
      }
    }
    catch (error) {
      console.error('[Kokoro Settings] Error in model watcher:', error)
    }
    finally {
      voicesLoading.value = false
    }
  }
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  >
    <template #voice-settings>
      <!-- Model Selection -->
      <div class="space-y-3">
        <Callout :label="t('settings.pages.providers.provider.kokoro-local.fields.field.model.label')">
          <div>
            <p>{{ t('settings.pages.providers.provider.kokoro-local.fields.field.model.description') }}</p>
          </div>
        </Callout>
        <div>
          <Select
            v-model="model"
            :options="modelOptions"
            :disabled="modelsLoading || isDownloading"
            placeholder="Choose a model..."
          />
        </div>

        <!-- Download Progress Card -->
        <div v-if="isDownloading" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-4 space-y-2">
          <div class="flex justify-between text-xs opacity-70">
            <span class="font-medium">{{ downloadMessage || `Downloading ${model}...` }}</span>
            <span class="font-mono">{{ downloadProgress }}%</span>
          </div>
          <Progress :progress="downloadProgress" class="h-2" />
        </div>

        <!-- Custom Voice Library (Voice Cloning) -->
        <div class="border border-neutral-100 rounded-xl bg-neutral-50/50 p-4 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/30">
          <div class="flex items-center justify-between">
            <h4 class="text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
              Voice Cloning Library
            </h4>
            <input
              ref="fileInput"
              type="file"
              accept="audio/wav,audio/*"
              class="hidden"
              @change="handleFileUpload"
            >
            <Button
              size="sm"
              :disabled="isUploading"
              @click="triggerUpload"
            >
              {{ isUploading ? 'Enrolling...' : 'Upload Audio Sample' }}
            </Button>
          </div>

          <p class="text-xs text-neutral-500">
            Upload a 5–30s clean voice recording (WAV or MP3) to clone a custom voice for Kokoro-82M. Enrolled voices appear immediately in the playground and chat.
          </p>

          <!-- List of voice profiles -->
          <div v-if="customVoiceProfiles.length === 0" class="h-16 flex items-center justify-center border border-neutral-200 rounded-lg border-dashed text-xs text-neutral-400 dark:border-neutral-800">
            No custom voices enrolled yet.
          </div>
          <div v-else class="max-h-48 overflow-y-auto space-y-2">
            <div
              v-for="profile in customVoiceProfiles"
              :key="profile.id"
              class="flex items-center justify-between border border-neutral-200/60 rounded-lg bg-white p-2.5 shadow-sm transition-all dark:border-neutral-800/80 hover:border-neutral-300 dark:bg-neutral-950 dark:hover:border-neutral-700"
            >
              <div class="mr-3 flex-1 space-y-0.5">
                <template v-if="editingProfileId === profile.id">
                  <Input
                    v-model="editingName"
                    size="sm"
                    class="w-full text-xs font-semibold"
                    @keyup.enter="saveProfileName(profile)"
                    @keyup.esc="cancelEditing"
                  />
                </template>
                <template v-else>
                  <div class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                    {{ profile.name }}
                  </div>
                </template>
                <div class="max-w-[220px] truncate text-[10px] text-neutral-400">
                  <span v-if="profile.blendSummary" class="text-primary-600 font-medium dark:text-primary-400">
                    {{ profile.blendSummary }}
                  </span>
                  <span v-else>
                    File: {{ profile.sourceFilename }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <template v-if="editingProfileId === profile.id">
                  <Button
                    size="sm"
                    class="hover:text-green-500"
                    @click="saveProfileName(profile)"
                  >
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    @click="cancelEditing"
                  >
                    Cancel
                  </Button>
                </template>
                <template v-else>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0"
                    @click="startEditing(profile)"
                  >
                    <div class="i-solar:pen-bold text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0 hover:text-rose-500"
                    @click="deleteVoiceProfile(profile.id)"
                  >
                    <div class="i-solar:trash-bin-trash-bold text-xs text-neutral-400 hover:text-rose-500" />
                  </Button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Replace the default playground with our standalone component -->
    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="true"
        :voices-loading="voicesLoading"
        :default-text="t('settings.pages.providers.provider.kokoro-local.playground.default-text')"
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
