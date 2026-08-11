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
import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../../../../stores/providers'
import { onboardingV2GateKey } from '../gate'

const emit = defineEmits<{
  (e: 'verified'): void
}>()

// V2 onboarding — Step 2: Consciousness (Mind / LLM Setup).
// WebLLM local hero cards with real VRAM + in-context weight download;
// full chat provider matrix with inline cloud configuration. Gate unlocks only
// after the selected brain is actually verified.

// --- Stores ---
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const airiCardStore = useAiriCardStore()

const { activeProvider, activeModel, providerModels, isLoadingActiveProviderModels } = storeToRefs(consciousnessStore)
const { allChatProvidersMetadata, configuredChatProvidersMetadata } = storeToRefs(providersStore)

// --- Hardware detection (webllm needs WebGPU) ---
const webgpuSupported = ref(isWebGPUSupported())

// --- WebLLM in-context download ---
type DownloadState = 'idle' | 'downloading' | 'ready' | 'error'
const downloadState = ref<DownloadState>('idle')
const downloadProgress = ref(0)
const downloadStatusText = ref('')
const downloadAbort = ref<AbortController>()
const selectedLlmModel = ref<string>(WEB_LLM_MODELS[0].id)

const isWebLlmSelected = computed(() => activeProvider.value === 'web-llm')

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
const selectedCloudProviderId = ref('')

const selectedChatProvider = computed<ProviderMetadata | null>(() => {
  if (isWebLlmSelected.value)
    return null
  return allChatProvidersMetadata.value.find(p => p.id === activeProvider.value) || null
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
  activeProvider.value = provider.id
  selectedCloudProviderId.value = provider.id
  // Selecting a new brain invalidates prior verification until re-verified.
  consciousnessStore.resetModelSelection()
  if (provider.id === 'web-llm') {
    // Kick off download immediately only if not already running/ready.
    if (downloadState.value === 'idle')
      void startWebLlmDownload()
    return
  }
  // For cloud or local non-webllm, fetch models to populate the picker.
  void consciousnessStore.loadModelsForProvider(provider.id)
}

function handleConfigured() {
  void consciousnessStore.loadModelsForProvider(activeProvider.value)
}

// --- Card ↔ store sync (Step 4/5 borrow this brain) ---
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

watch([activeProvider, activeModel], ([provider, model]) => {
  if (!activeCardId.value || !provider || !model)
    return
  const card = activeCard.value
  if (!card)
    return
  const existing = (card as any).extensions?.airi?.modules?.consciousness
  if (existing?.provider === provider && existing?.model === model)
    return
  void airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...(card as any).extensions,
      airi: {
        ...(card as any).extensions?.airi,
        modules: {
          ...(card as any).extensions?.airi?.modules,
          consciousness: {
            ...existing,
            provider,
            model,
          },
        },
      },
    },
  } as any)
})

// --- Verification gate ---
const verified = computed(() => {
  if (isWebLlmSelected.value)
    return downloadState.value === 'ready' && !!activeModel.value
  return !!activeProvider.value && !!activeModel.value
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
      message="WebLLM is pre-configured to run 100% locally on WebGPU. Pick a model size your GPU can handle — it'll download and compile right here before we move on!"
    />

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
          @click="() => { activeProvider = 'web-llm'; selectedLlmModel = model.id }"
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
        :model-value="isWebLlmSelected ? 'web-llm' : selectedCloudProviderId"
        :providers="allChatProvidersMetadata"
        @select="onSelectProvider"
        @update:model-value="(id: string) => { selectedCloudProviderId = id }"
      />
    </div>

    <!-- Inline cloud credential configuration -->
    <div v-if="inlineConfigProvider" :class="['border border-dashed border-amber-300/60 rounded-xl', 'bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/60', 'backdrop-blur-md']">
      <StepProviderConfiguration
        :selected-provider-id="inlineConfigProvider.id"
        :selected-provider="inlineConfigProvider"
        :on-next="handleConfigured"
        :on-previous="() => {}"
      />
    </div>

    <!-- Cloud model picker -->
    <div v-if="!isWebLlmSelected && activeProvider && providerModels.length > 0" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']">
      <FieldSelect
        v-model="activeModel"
        label="Model"
        :options="cloudModelOptions"
        :placeholder="modelPlaceholder"
        layout="vertical"
      />
    </div>
  </div>
</template>
