<script setup lang="ts">
import type { WebLlmLoadTarget } from '../../../../../../libs/inference/adapters/web-llm'
import type { ProgressPayload } from '../../../../../../libs/inference/protocol'
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { isWebGPUSupported } from '@proj-airi/stage-shared/webgpu'
import { FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import StepProviderConfiguration from '../../step-provider-configuration.vue'
import CompanionBubble from '../components/companion-bubble.vue'
import ProviderPickerGrid from '../components/provider-picker-grid.vue'

import { WEB_LLM_MODELS } from '../../../../../../libs/inference/constants'
import { useProvidersStore } from '../../../../../../stores/providers'
import { BrainModelPicker } from '../../../../chat'
import { useOnboardingV2Draft } from '../draft-store'
import { onboardingV2GateKey } from '../gate'

const emit = defineEmits<{
  (e: 'verified'): void
}>()

// V2 onboarding — Step 2: Consciousness (Mind / LLM Setup).
// WebLLM local hero cards with real VRAM + in-context weight download;
// full chat provider matrix with inline cloud configuration. Gate unlocks only
// after the selected brain is actually verified.

// --- Stores ---
const providersStore = useProvidersStore()
const draft = useOnboardingV2Draft()

// Principle 6: selection is local + transient draft only. The persisted
// consciousnessStore.activeProvider/activeModel are NOT committed until Step 7.
const selectedProviderId = ref(draft.state.consciousness.provider ?? '')
const selectedModelId = ref(draft.state.consciousness.model ?? '')

const { allChatProvidersMetadata, configuredChatProvidersMetadata } = storeToRefs(providersStore)

// Cloud model list is id-keyed (does not touch consciousnessStore.activeProvider).
const providerModels = computed(() => providersStore.getModelsForProvider(selectedProviderId.value))
const isLoadingActiveProviderModels = computed(() => providersStore.isLoadingModels[selectedProviderId.value] || false)

// --- Hardware detection (webllm needs WebGPU) ---
const webgpuSupported = ref(isWebGPUSupported())

// --- WebLLM in-context download ---
type DownloadState = 'idle' | 'downloading' | 'ready' | 'error'
const downloadState = ref<DownloadState>('idle')
const downloadProgress = ref(0)
const downloadStatusText = ref('')
const downloadAbort = ref<AbortController>()
const selectedLlmModel = ref<string>(WEB_LLM_MODELS[0].id)

const isWebLlmSelected = computed(() => selectedProviderId.value === 'web-llm')

// Start download as soon as WebLLM is picked (with the curated default), or when
// the user switches WebLLM model while it's the active provider.
watch([isWebLlmSelected, selectedLlmModel], ([selected]) => {
  if (selected && downloadState.value === 'idle')
    void startWebLlmDownload()
}, { immediate: true })

async function startWebLlmDownload() {
  downloadAbort.value?.abort()
  const controller = new AbortController()
  downloadAbort.value = controller
  downloadState.value = 'downloading'
  downloadProgress.value = 0
  downloadStatusText.value = 'Preparing model…'
  try {
    const { getWebLlmAdapter } = await import('../../../../../../libs/inference/adapters/web-llm')
    const adapter = await getWebLlmAdapter()

    const curated = WEB_LLM_MODELS.find(m => m.id === selectedLlmModel.value)
    const target: WebLlmLoadTarget = { modelId: selectedLlmModel.value, vramMB: curated?.vramMB }

    await adapter.loadModel(target, {
      signal: controller.signal,
      onProgress: (p: ProgressPayload) => {
        const percent = typeof p?.percent === 'number' && p.percent >= 0
          ? p.percent
          : (p && p.loaded && p.total ? (p.loaded / p.total) * 100 : 0)
        downloadProgress.value = Math.min(100, Math.max(0, percent))
        downloadStatusText.value = (p as any)?.status || (p as any)?.file || 'Downloading weight shards…'
      },
    })
    if (!controller.signal.aborted)
      downloadState.value = 'ready'
  }
  catch (err) {
    if (!controller.signal.aborted) {
      downloadState.value = 'error'
      console.error('[V2 Consciousness] WebLLM download failed:', err)
    }
  }
}

// --- Provider selection ---
const selectedChatProvider = computed<ProviderMetadata | null>(() => {
  if (isWebLlmSelected.value)
    return null
  return allChatProvidersMetadata.value.find(p => p.id === selectedProviderId.value) || null
})

const inlineConfigProvider = computed(() => {
  if (!selectedChatProvider.value)
    return null
  if (selectedChatProvider.value.requiresCredentials === false)
    return null
  const alreadyConfigured = configuredChatProvidersMetadata.value.some(p => p.id === selectedChatProvider.value!.id)
  return alreadyConfigured ? null : selectedChatProvider.value
})

function onSelectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
  selectedModelId.value = ''
  recordDraft()
  if (provider.id === 'web-llm') {
    // Kick off download immediately only if not already running/ready.
    if (downloadState.value === 'idle')
      void startWebLlmDownload()
    return
  }
  // For cloud or local non-webllm, fetch models to populate the picker (id-keyed).
  void providersStore.fetchModelsForProvider(provider.id)
}

function handleConfigured() {
  void providersStore.fetchModelsForProvider(selectedProviderId.value)
}

function handleCancelConfig() {
  selectedProviderId.value = ''
}

// --- Principle 6: record the chosen brain into the transient draft only ---
function recordDraft() {
  draft.setConsciousness({
    provider: selectedProviderId.value || undefined,
    model: selectedModelId.value || undefined,
    engine: selectedProviderId.value === 'web-llm' ? 'web-llm' : 'cloud',
  })
}

watch(selectedModelId, recordDraft)

// --- Verification gate (draft source of truth) ---
const verified = computed(() => {
  if (isWebLlmSelected.value) {
    // For the local WebGPU brain the curated model id *is* the model — no
    // separate model-list row; verification is the completed in-context load.
    return downloadState.value === 'ready'
  }
  return !!selectedProviderId.value && !!selectedModelId.value
})

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('consciousness', {
    canProceed: computed(() => verified.value),
    skipLabel: 'Skip Step',
  })
})
onBeforeUnmount(() => {
  gate?.clearGate('consciousness')
  downloadAbort.value?.abort()
})

watch(verified, (v) => {
  if (v)
    emit('verified')
})

// --- Cloud model picker ---
const cloudModelOptions = computed(() => (providerModels.value || []).map((m: any) => ({ label: m.name || m.id, value: m.id })))

const modelPlaceholder = computed(() => (isLoadingActiveProviderModels.value ? 'Loading models…' : 'Select a model'))
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-y-auto px-1 pb-2">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Consciousness
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Give AIRI a brain first — the AI character creators on later steps borrow it.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="WebLLM is pre-configured to run 100% locally on WebGPU. Pick a model size your GPU can handle — or choose one of your existing configured LLMs to move on instantly!"
    />

    <!-- Quick-Pick for Configured Brains -->
    <div
      v-if="configuredChatProvidersMetadata.length > 0"
      class="flex flex-col gap-3 border border-purple-500/30 rounded-xl bg-purple-500/10 p-4 backdrop-blur-md"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="i-solar:stars-line-bold-duotone h-4.5 w-4.5 text-purple-500" />
          <span class="text-xs text-purple-800 font-bold tracking-wide uppercase dark:text-purple-300">Quick Pick: Configured LLM Brains</span>
        </div>
        <span class="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-700 font-bold dark:text-purple-300">1-CLICK SELECTION</span>
      </div>
      <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
        You already have active AI LLM models configured in AIRI! Attach one of your existing models to this companion in 1 click:
      </p>
      <BrainModelPicker
        v-model:provider="selectedProviderId"
        v-model:model="selectedModelId"
        variant="button"
        title="Select Consciousness LLM"
        side="bottom"
        class="w-full"
      />
    </div>

    <!-- WebGPU warning when local engine unavailable -->
    <div
      v-if="!webgpuSupported"
      class="flex flex-shrink-0 items-start gap-2 border border-amber-300/60 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300"
    >
      <div class="i-solar:danger-triangle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>WebGPU isn't available on this device/browser, so the local WebLLM engine can't run here. Pick a cloud provider below — you can switch to a local brain later in Settings.</span>
    </div>

    <!-- WebLLM Local Engine -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3', !webgpuSupported ? 'opacity-60' : '']">
      <div class="flex items-center gap-2">
        <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4 text-primary-500" />
        <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Recommended: WebLLM (Local, WebGPU)</span>
        <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">FREE · LOCAL</span>
      </div>

      <div class="flex flex-col gap-2">
        <button
          v-for="model in WEB_LLM_MODELS"
          :key="model.id"
          :disabled="!webgpuSupported"
          :class="[
            'relative flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300',
            isWebLlmSelected && selectedLlmModel === model.id
              ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
              : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
            !webgpuSupported ? 'cursor-not-allowed' : '',
          ]"
          @click="() => { selectedProviderId = 'web-llm'; selectedLlmModel = model.id; selectedModelId = model.id; recordDraft() }"
        >
          <div
            class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl"
            :class="[isWebLlmSelected && selectedLlmModel === model.id ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
          >
            <div class="i-solar:cpu-bolt-bold-duotone h-6 w-6" :class="isWebLlmSelected && selectedLlmModel === model.id ? 'text-primary-500' : 'text-neutral-500'" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ model.name }}</span>
              <span
                v-if="model.id === 'Qwen3.5-4B-q4f16_1-MLC'"
                class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400"
              >
                ⭐ RECOMMENDED
              </span>
            </div>
            <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {{ model.description }}
            </p>
          </div>
          <span class="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold font-mono dark:bg-neutral-800 dark:text-neutral-300">
            ~{{ (model.vramMB / 1024).toFixed(1) }} GB VRAM
          </span>
        </button>
      </div>

      <!-- In-context download progress -->
      <div v-if="isWebLlmSelected" class="flex flex-col gap-2 border border-neutral-200/60 rounded-lg bg-neutral-50/60 p-3 dark:border-neutral-700/60 dark:bg-neutral-800/40">
        <template v-if="downloadState === 'downloading'">
          <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span class="truncate">{{ downloadStatusText }}</span>
            <span class="font-bold font-mono">{{ Math.floor(downloadProgress) }}%</span>
          </div>
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${downloadProgress}%` }" />
          </div>
        </template>
        <div v-else-if="downloadState === 'ready'" class="flex items-center gap-2 text-xs text-emerald-600 font-bold dark:text-emerald-400">
          <div class="i-solar:check-circle-bold-duotone h-4 w-4" />
          Brain cached & verified — ready to think.
        </div>
        <div v-else-if="downloadState === 'error'" class="flex items-center gap-2 text-xs text-red-600 font-bold dark:text-red-400">
          <div class="i-solar:danger-circle-bold-duotone h-4 w-4" />
          Download failed.
          <button class="underline" @click="startWebLlmDownload">
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- Cloud / Local provider matrix (reused grid primitive) -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Choose a Brain Provider</span>
      <ProviderPickerGrid
        :model-value="selectedProviderId"
        :providers="allChatProvidersMetadata"
        @select="onSelectProvider"
        @update:model-value="(id: string) => { selectedProviderId = id }"
      />
    </div>

    <!-- Inline cloud credential configuration -->
    <div v-if="inlineConfigProvider" :class="['border border-dashed border-amber-300/60 rounded-xl', 'bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/60', 'backdrop-blur-md']">
      <StepProviderConfiguration
        :selected-provider-id="inlineConfigProvider.id"
        :selected-provider="inlineConfigProvider"
        :on-next="handleConfigured"
        :on-previous="handleCancelConfig"
      />
    </div>

    <!-- Cloud model picker -->
    <div v-if="!isWebLlmSelected && selectedProviderId && providerModels.length > 0" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']">
      <FieldSelect
        v-model="selectedModelId"
        label="Model"
        :options="cloudModelOptions"
        :placeholder="modelPlaceholder"
        layout="vertical"
      />
    </div>
  </div>
</template>
