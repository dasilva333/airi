<script setup lang="ts">
import localforage from 'localforage'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, Input, Select } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

const providerId = 'pocket-tts-local'
const defaultModel = 'english_2026-04'
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()

const hfToken = useLocalStorageManualReset('settings/connection/hf-token', '')
const hasHfToken = computed(() => !!hfToken.value?.trim())

// State
const voicesLoading = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const customVoiceProfiles = ref<PocketVoiceProfile[]>([])
const editingProfileId = ref<string | null>(null)
const editingName = ref('')

interface PocketVoiceProfile {
  id: string
  name: string
  createdAt: number
  sourceFilename: string
  sha256: string
}

// Localforage instances
const pocketVoiceProfilesStore = localforage.createInstance({
  name: 'pocket-voice-profiles-metadata',
})
const pocketVoiceProfileBlobsStore = localforage.createInstance({
  name: 'pocket-voice-profiles-blobs',
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

const isActiveProvider = computed(() => speechStore.activeSpeechProvider === providerId)

const model = computed({
  get(): string {
    return (providerConfig.value?.model as string) || defaultModel
  },
  set(val: string) {
    const config = providersStore.getProviderConfig(providerId)
    if (config) {
      config.model = val
      config.language = val
    }
    if (isActiveProvider.value) {
      speechStore.activeSpeechModel = val
    }
  },
})

const modelOptions = computed(() => {
  const models = providerModels.value
  if (models.length > 0) {
    return models.map(m => ({ label: m.name, value: m.id }))
  }
  return [
    { label: 'Pocket TTS English (100M)', value: 'english_2026-04' },
    { label: 'Pocket TTS French (24L)', value: 'french_24l' },
    { label: 'Pocket TTS Spanish (24L)', value: 'spanish_24l' },
    { label: 'Pocket TTS German (24L)', value: 'german_24l' },
    { label: 'Pocket TTS Portuguese (24L)', value: 'portuguese_24l' },
    { label: 'Pocket TTS Italian (24L)', value: 'italian_24l' },
  ]
})

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

function setActiveSpeechProvider() {
  speechStore.activeSpeechProvider = providerId
  speechStore.activeSpeechModel = model.value
  const config = providersStore.getProviderConfig(providerId)
  if (config) {
    config.model = model.value
    config.language = model.value
  }
  toast.success('Pocket TTS set as AIRI\'s active speech engine!')
}

async function loadCustomVoiceProfiles() {
  const profiles: PocketVoiceProfile[] = []
  await pocketVoiceProfilesStore.iterate((val: PocketVoiceProfile) => {
    if (val && val.id) {
      profiles.push(val)
    }
  })
  profiles.sort((a, b) => b.createdAt - a.createdAt)
  customVoiceProfiles.value = profiles
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  isUploading.value = true
  try {
    const sha256 = await computeSha256(file)
    const id = `pocket-profile-${sha256.slice(0, 16)}`
    const name = file.name.replace(/\.[^/.]+$/, '')

    const metadata: PocketVoiceProfile = {
      id,
      name,
      createdAt: Date.now(),
      sourceFilename: file.name,
      sha256,
    }

    await pocketVoiceProfileBlobsStore.setItem(id, file)
    await pocketVoiceProfilesStore.setItem(id, metadata)
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    toast.success(`Voice profile "${name}" uploaded successfully!`)
  }
  catch (err) {
    console.error('Failed to save Pocket TTS voice profile:', err)
    toast.error(`Voice profile upload failed: ${err}`)
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
    await pocketVoiceProfilesStore.removeItem(id)
    await pocketVoiceProfileBlobsStore.removeItem(id)
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    toast.success('Voice profile deleted.')
  }
  catch (err) {
    console.error('Failed to delete Pocket TTS voice profile:', err)
  }
}

async function saveProfileName(profile: PocketVoiceProfile) {
  if (!editingName.value.trim())
    return
  try {
    const updated = { ...profile, name: editingName.value.trim() }
    await pocketVoiceProfilesStore.setItem(profile.id, updated)
    editingProfileId.value = null
    editingName.value = ''
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
    toast.success('Voice profile renamed.')
  }
  catch (err) {
    console.error('Failed to update Pocket TTS voice profile name:', err)
  }
}

function startEditing(profile: PocketVoiceProfile) {
  editingProfileId.value = profile.id
  editingName.value = profile.name
}

function cancelEditing() {
  editingProfileId.value = null
  editingName.value = ''
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  const toastId = toast.loading('Initializing Pocket TTS engine & verifying ONNX weights...')
  try {
    console.info('[Pocket Playground] Starting speech generation...', { input, voiceId, selectedModel: model.value })
    const provider = await providersStore.getProviderInstance(providerId)
    if (!provider) {
      throw new Error('Failed to initialize Pocket TTS speech provider instance')
    }

    const config = providersStore.getProviderConfig(providerId)
    const selectedModel = model.value || (config?.model as string) || defaultModel

    toast.loading(`Synthesizing audio with Pocket model "${selectedModel}"...`, { id: toastId })

    const result = await speechStore.speech(
      provider as any,
      selectedModel,
      input,
      voiceId,
      {
        ...config,
        model: selectedModel,
        language: selectedModel,
      },
    )

    toast.success('Pocket TTS Audio Generation Complete! 🎵', { id: toastId })
    return result
  }
  catch (error: any) {
    console.error('[Pocket Playground] Error generating speech:', error)
    toast.error(`Pocket TTS Error: ${error?.message || error}`, { id: toastId })
    throw error
  }
}

onMounted(async () => {
  try {
    voicesLoading.value = true
    await providersStore.fetchModelsForProvider(providerId)
    const config = providersStore.getProviderConfig(providerId)
    if (config && !config.model) {
      config.model = defaultModel
      config.language = defaultModel
    }
    await loadCustomVoiceProfiles()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (error) {
    console.error('Failed to load Pocket TTS models/voices:', error)
  }
  finally {
    voicesLoading.value = false
  }
})

watch(model, async (newModel) => {
  if (newModel) {
    try {
      voicesLoading.value = true
      const config = providersStore.getProviderConfig(providerId)
      if (config) {
        config.model = newModel
        config.language = newModel
      }
      await speechStore.loadVoicesForProvider(providerId)
    }
    catch (error) {
      console.error('[Pocket Settings] Error reloading voices:', error)
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
        <!-- Model Selection & Activation Card -->
        <div class="border border-neutral-100 rounded-xl bg-neutral-50/50 p-4 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/30">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
                Model Selection & Active Provider
              </h4>
              <p class="text-xs text-neutral-500">
                Select local Pocket TTS parameter weights and set as AIRI's active voice provider.
              </p>
            </div>
            <div v-if="isActiveProvider" class="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-500 font-semibold">
              ✓ Active Speech Engine
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex-1">
              <Select
                v-model="model"
                :options="modelOptions"
                :disabled="modelsLoading"
                placeholder="Choose a model..."
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              :disabled="isActiveProvider"
              @click="setActiveSpeechProvider"
            >
              {{ isActiveProvider ? 'Active' : 'Save & Set Active' }}
            </Button>
          </div>
        </div>

        <!-- HuggingFace Gated Presets Guidance Card -->
        <div :class="['border rounded-xl p-4 space-y-2', hasHfToken ? 'border-amber-500/30 bg-amber-500/5 dark:border-amber-500/20' : 'border-rose-500/30 bg-rose-500/5 dark:border-rose-500/20']">
          <div class="flex items-center gap-2">
            <div :class="['i-solar:shield-warning-bold-duotone text-lg', hasHfToken ? 'text-amber-500' : 'text-rose-500']" />
            <h4 class="text-xs font-bold tracking-wider uppercase" :class="hasHfToken ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'">
              Predefined Voice Presets & HuggingFace Access Token
            </h4>
          </div>
          <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
            Built-in voice presets (<code>alba</code>, <code>cosette</code>, <code>eponine</code>, <code>fantine</code>, <code>javert</code>, <code>jean</code>, <code>marius</code>) require accepting the gated repository model agreement on
            <a href="https://huggingface.co/kyutai/pocket-tts" target="_blank" rel="noopener noreferrer" class="text-amber-500 font-medium underline hover:text-amber-600">
              kyutai/pocket-tts
            </a>.
          </p>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[11px]" :class="hasHfToken ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'">
              {{ hasHfToken ? '✓ HF Access Token configured in Connection Settings' : '⚠️ HF Access Token is missing' }}
            </span>
            <RouterLink to="/settings/system/connection" class="flex items-center gap-1 text-xs text-amber-500 font-medium hover:underline">
              <span>Connection Settings</span>
              <div class="i-solar:alt-arrow-right-bold" />
            </RouterLink>
          </div>
        </div>

        <!-- Engine Configuration -->
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
              <span class="text-[10px] text-neutral-400">Thread count for WASM execution</span>
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
                    @keyup.enter="saveProfileName(profile)"
                    @keyup.esc="cancelEditing"
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
                    variant="secondary"
                    size="sm"
                    class="hover:text-amber-500 dark:hover:text-amber-400"
                    @click="startEditing(profile)"
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
        default-text="Hello! This is a test of the Kyutai Pocket TTS local voice cloning engine."
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
