<script setup lang="ts">
import localforage from 'localforage'

import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, Callout, Input, Progress, Select } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'

const providerId = 'moss-nano-local'
const defaultModel = 'moss-tts-nano-100m'
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()

// State
const voicesLoading = ref(false)
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadMessage = ref('')
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const customVoiceProfiles = ref<MossVoiceProfile[]>([])
const editingProfileId = ref<string | null>(null)
const editingName = ref('')

interface MossVoiceProfile {
  id: string
  name: string
  createdAt: number
  sourceFilename: string
  sha256: string
}

// Localforage instances
const mossVoiceProfilesStore = localforage.createInstance({
  name: 'moss-voice-profiles-metadata',
})
const mossVoiceProfileBlobsStore = localforage.createInstance({
  name: 'voice-profile-blobs',
})

// Get available voices
const availableVoices = computed(() => {
  return speechStore.availableVoices[providerId] || []
})

// Get provider config
const providerConfig = computed(() => {
  return providersStore.getProviderConfig(providerId)
})

const modelsLoading = computed(() => {
  return providersStore.isLoadingModels[providerId] || false
})

const providerModels = computed(() => {
  return providersStore.getModelsForProvider(providerId)
})

const model = computed({
  get(): string {
    return (providerConfig.value?.model as string) || defaultModel
  },
  set(val: string) {
    const config = providersStore.getProviderConfig(providerId)
    if (config) {
      config.model = val
    }
  },
})

const modelOptions = computed(() => {
  return providerModels.value.map(m => ({
    label: m.name,
    value: m.id,
  }))
})

// Configuration tuning properties
const cpuThreads = computed({
  get(): number {
    return (providerConfig.value?.cpuThreads as number) ?? 4
  },
  set(val: number) {
    const config = providersStore.getProviderConfig(providerId)
    if (config) {
      config.cpuThreads = Number(val)
    }
  },
})

const attentionBackend = computed({
  get(): string {
    return (providerConfig.value?.attentionBackend as string) ?? 'sdpa'
  },
  set(val: string) {
    const config = providersStore.getProviderConfig(providerId)
    if (config) {
      config.attentionBackend = val
    }
  },
})

const samplingMode = computed({
  get(): string {
    return (providerConfig.value?.samplingMode as string) ?? 'fixed'
  },
  set(val: string) {
    const config = providersStore.getProviderConfig(providerId)
    if (config) {
      config.samplingMode = val
    }
  },
})

const voiceCloneMaxTokens = computed({
  get(): number {
    return (providerConfig.value?.voiceCloneMaxTokens as number) ?? 75
  },
  set(val: number) {
    const config = providersStore.getProviderConfig(providerId)
    if (config) {
      config.voiceCloneMaxTokens = Number(val)
    }
  },
})

const attentionBackendOptions = [
  { label: 'Scale Dot Product (SDPA)', value: 'sdpa' },
  { label: 'Eager / Manual', value: 'eager' },
]

const samplingModeOptions = [
  { label: 'Fixed (High Performance)', value: 'fixed' },
  { label: 'Dynamic (High Quality)', value: 'dynamic' },
]

// Sanitization & unique checking
function sanitizeVoiceName(name: string): string {
  return name.replace(/[^\w -]/g, '').trim()
}

function getUniqueVoiceName(name: string, existingNames: string[]): string {
  let sanitized = sanitizeVoiceName(name)
  if (!sanitized) {
    sanitized = 'Custom_Voice'
  }
  let candidate = sanitized
  let counter = 2
  while (existingNames.includes(candidate)) {
    candidate = `${sanitized} (${counter})`
    counter++
  }
  return candidate
}

async function calculateSha256(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function loadCustomVoiceProfiles() {
  const profiles: MossVoiceProfile[] = []
  await mossVoiceProfilesStore.iterate((val: MossVoiceProfile) => {
    profiles.push(val)
  })
  profiles.sort((a, b) => b.createdAt - a.createdAt)
  customVoiceProfiles.value = profiles
}

async function ensureModelLoaded() {
  const config = providersStore.getProviderConfig(providerId)
  const metadata = providersStore.getProviderMetadata(providerId)
  if (metadata?.capabilities?.loadModel) {
    isDownloading.value = true
    downloadProgress.value = 0
    downloadMessage.value = 'Checking / downloading MOSS TTS models...'
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
  }
}

async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  try {
    await ensureModelLoaded()

    const provider = await providersStore.getProviderInstance(providerId)
    if (!provider) {
      throw new Error('Failed to initialize speech provider')
    }

    const config = providersStore.getProviderConfig(providerId)
    const selectedModel = (config?.model as string) || defaultModel

    const result = await speechStore.speech(
      provider as any,
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
    console.error('[Moss Playground] Error generating speech:', error)
    throw error
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0)
    return

  const file = files[0]
  isUploading.value = true

  try {
    if (!file.name.toLowerCase().endsWith('.wav') && !file.type.startsWith('audio/')) {
      alert('Please upload a valid audio file (preferably WAV).')
      return
    }

    const existingNames = customVoiceProfiles.value.map(p => p.name)
    existingNames.push('EN Trump', 'Trump', 'EN LJS', 'LJS')

    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
    const uniqueName = getUniqueVoiceName(baseName, existingNames)
    const sha256 = await calculateSha256(file)

    const id = `voice-profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const metadata: MossVoiceProfile = {
      id,
      name: uniqueName,
      createdAt: Date.now(),
      sourceFilename: file.name,
      sha256,
    }

    await mossVoiceProfileBlobsStore.setItem(id, file)
    await mossVoiceProfilesStore.setItem(id, metadata)

    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (error) {
    console.error('Failed to upload voice profile:', error)
    alert('Failed to process and save the voice profile.')
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
    await mossVoiceProfilesStore.removeItem(id)
    await mossVoiceProfileBlobsStore.removeItem(id)
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (error) {
    console.error('Failed to delete voice profile:', error)
  }
}

function startRename(profile: MossVoiceProfile) {
  editingProfileId.value = profile.id
  editingName.value = profile.name
}

function cancelRename() {
  editingProfileId.value = null
  editingName.value = ''
}

async function saveRename(profile: MossVoiceProfile) {
  const sanitized = sanitizeVoiceName(editingName.value)
  if (!sanitized) {
    alert('Please enter a valid voice profile name.')
    return
  }

  const existingNames = customVoiceProfiles.value
    .filter(p => p.id !== profile.id)
    .map(p => p.name)
  existingNames.push('EN Trump', 'Trump', 'EN LJS', 'LJS')

  if (existingNames.includes(sanitized)) {
    alert('A voice profile with that name already exists.')
    return
  }

  try {
    const updated = {
      ...profile,
      name: sanitized,
    }
    await mossVoiceProfilesStore.setItem(profile.id, updated)
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    cancelRename()
  }
  catch (error) {
    console.error('Failed to rename voice profile:', error)
    alert('Failed to rename the voice profile.')
  }
}

onMounted(async () => {
  try {
    voicesLoading.value = true
    await providersStore.fetchModelsForProvider(providerId)
    const config = providersStore.getProviderConfig(providerId)
    if (config && !config.model) {
      config.model = defaultModel
    }
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (error) {
    console.error('Failed to load MOSS models/voices:', error)
  }
  finally {
    voicesLoading.value = false
  }
})

watch(model, async (newValue) => {
  if (newValue) {
    try {
      voicesLoading.value = true
      await speechStore.loadVoicesForProvider(providerId)
    }
    catch (error) {
      console.error('[Moss Settings] Error reloading voices:', error)
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
      <div class="space-y-6">
        <!-- Model Selection -->
        <div class="space-y-2">
          <Callout label="MOSS TTS Model">
            <div>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                Select the local MOSS-TTS-Nano parameter weights.
              </p>
            </div>
          </Callout>
          <Select
            v-model="model"
            :options="modelOptions"
            :disabled="modelsLoading || isDownloading"
            placeholder="Choose a model..."
          />

          <!-- Download Progress Card -->
          <div v-if="isDownloading" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-4 space-y-2">
            <div class="flex justify-between text-xs opacity-70">
              <span class="font-medium">{{ downloadMessage || `Downloading MOSS model...` }}</span>
              <span class="font-mono">{{ downloadProgress }}%</span>
            </div>
            <Progress :progress="downloadProgress" class="h-2" />
          </div>
        </div>

        <!-- Tuning Configurations -->
        <div class="border border-neutral-100 rounded-xl bg-neutral-50/50 p-4 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/30">
          <h4 class="text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
            Engine Configuration
          </h4>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- CPU Threads -->
            <div class="space-y-1">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">CPU Thread Count</label>
              <Input
                v-model="cpuThreads"
                type="number"
                min="1"
                max="32"
                placeholder="4"
              />
              <span class="text-[10px] text-neutral-400">Thread count for WASM fallback</span>
            </div>

            <!-- Voice Clone Max Text Tokens -->
            <div class="space-y-1">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Max Text Tokens (Clone)</label>
              <Input
                v-model="voiceCloneMaxTokens"
                type="number"
                min="10"
                max="512"
                placeholder="75"
              />
              <span class="text-[10px] text-neutral-400">Prompt length for reference audio conditioning</span>
            </div>

            <!-- Attention Backend -->
            <div class="space-y-1">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Attention Backend</label>
              <Select
                v-model="attentionBackend"
                :options="attentionBackendOptions"
              />
            </div>

            <!-- Sampling Mode -->
            <div class="space-y-1">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Sampling Mode</label>
              <Select
                v-model="samplingMode"
                :options="samplingModeOptions"
              />
            </div>
          </div>
        </div>

        <!-- Custom Voice Library -->
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
              {{ isUploading ? 'Uploading...' : 'Upload WAV File' }}
            </Button>
          </div>

          <p class="text-xs text-neutral-500">
            Upload voice reference files (WAV format recommended) to clone custom speakers. Uploaded names are sanitized to only contain alphanumeric characters, spaces, hyphens, and underscores.
          </p>

          <!-- List of voice profiles -->
          <div v-if="customVoiceProfiles.length === 0" class="h-16 flex items-center justify-center border border-neutral-200 rounded-lg border-dashed text-xs text-neutral-400 dark:border-neutral-800">
            No custom voices uploaded yet.
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
                    @keyup.enter="saveRename(profile)"
                    @keyup.esc="cancelRename"
                  />
                </template>
                <template v-else>
                  <div class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                    {{ profile.name }}
                  </div>
                </template>
                <div class="max-w-[200px] truncate text-[10px] text-neutral-400">
                  File: {{ profile.sourceFilename }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <template v-if="editingProfileId === profile.id">
                  <Button
                    size="sm"
                    class="hover:text-green-500"
                    @click="saveRename(profile)"
                  >
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    @click="cancelRename"
                  >
                    Cancel
                  </Button>
                </template>
                <template v-else>
                  <Button
                    variant="secondary"
                    size="sm"
                    class="hover:text-amber-500 dark:hover:text-amber-400"
                    @click="startRename(profile)"
                  >
                    Rename
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    class="hover:text-red-500 dark:hover:text-red-400"
                    @click="deleteVoiceProfile(profile.id)"
                  >
                    Delete
                  </Button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="true"
        :voices-loading="voicesLoading"
        default-text="Hello! This is a test of the MOSS TTS local voice cloning engine."
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
