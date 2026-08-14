<script setup lang="ts">
import type { WebLlmLoadTarget } from '../../../../../../libs/inference/adapters/web-llm'
import type { ProgressPayload } from '../../../../../../libs/inference/protocol'
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { isWebGPUSupported } from '@proj-airi/stage-shared/webgpu'
import { storeToRefs } from 'pinia'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

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
// 1. Zero fallback arrays — pure dynamic models from API.
// 2. Streamlined credentials input (API Key + Base URL).
// 3. 4-Item Model Section:
//    - Item 1: Selected Model Input Box (editable for custom/unlisted models).
//    - Item 2: Models Dropdown (populated live, shows 'No Models Found' if empty).
//    - Item 3: 'Get Models' manual trigger button.
//    - Item 4: Connection Probe with 🟠 Connecting -> 🟡 Inferencing -> 🟢 Verified states.

// --- Stores ---
const providersStore = useProvidersStore()
const draft = useOnboardingV2Draft()

// Principle 6: selection is local + transient draft only. The persisted
// consciousnessStore.activeProvider/activeModel are NOT committed until Step 7.
const selectedProviderId = ref(draft.state.consciousness.provider ?? '')
const selectedModelId = ref(draft.state.consciousness.model ?? '')

const { allChatProvidersMetadata, configuredChatProvidersMetadata } = storeToRefs(providersStore)

// Cloud model list is id-keyed and queries live providerRuntimeState.
const providerModels = computed(() => {
  if (!selectedProviderId.value)
    return []
  return providersStore.getModelsForProvider(selectedProviderId.value)
})

const isLoadingActiveProviderModels = computed(() => providersStore.isLoadingModels[selectedProviderId.value] || false)

// --- Hardware detection (webllm needs WebGPU) ---
const webgpuSupported = ref(false)
onMounted(async () => {
  webgpuSupported.value = await isWebGPUSupported()
})

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
watch([isWebLlmSelected, selectedLlmModel, webgpuSupported], ([selected, , gpuOk]) => {
  if (selected && downloadState.value === 'idle' && gpuOk)
    void startWebLlmDownload()
}, { immediate: true })

const downloadErrorMessage = ref('')

async function startWebLlmDownload() {
  downloadAbort.value?.abort()
  const controller = new AbortController()
  downloadAbort.value = controller
  downloadState.value = 'downloading'
  downloadProgress.value = 0
  downloadStatusText.value = 'Preparing model…'
  downloadErrorMessage.value = ''
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
    if (!controller.signal.aborted) {
      downloadState.value = 'ready'
      toast.success('Local WebLLM brain ready!')
    }
  }
  catch (err) {
    if (!controller.signal.aborted) {
      downloadState.value = 'error'
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      downloadErrorMessage.value = msg
      console.error('[V2 Consciousness] WebLLM download failed:', msg, err)
    }
  }
}

// --- Provider selection & Inline Configuration State ---
const apiKeyInput = ref('')
const baseUrlInput = ref('')
const showApiKey = ref(false)
const showBaseUrl = ref(false)
const isSavingConfig = ref(false)

const selectedChatProvider = computed<ProviderMetadata | null>(() => {
  if (isWebLlmSelected.value)
    return null
  return allChatProvidersMetadata.value.find(p => p.id === selectedProviderId.value) || null
})

const isProviderConfigured = computed(() => {
  if (!selectedChatProvider.value)
    return false
  if (selectedChatProvider.value.requiresCredentials === false)
    return true
  return configuredChatProvidersMetadata.value.some(p => p.id === selectedChatProvider.value!.id)
})

const inlineConfigProvider = computed(() => {
  if (!selectedChatProvider.value)
    return null
  if (selectedChatProvider.value.requiresCredentials === false)
    return null
  return isProviderConfigured.value ? null : selectedChatProvider.value
})

const actionTargetRef = ref<HTMLElement | null>(null)

function scrollToTarget() {
  nextTick(() => {
    setTimeout(() => {
      actionTargetRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  })
}

function getApiKeyPlaceholder(providerId: string): string {
  const map: Record<string, string> = {
    'google-generative-ai': 'AIzaSy...',
    'openrouter-ai': 'sk-or-v1-...',
    'openai': 'sk-...',
    'anthropic': 'sk-ant-api...',
    'deepseek': 'sk-...',
    'mistral-ai': 'mis-...',
    'groq': 'gsk_...',
    'together-ai': 'togetherapi-...',
    'xai': 'xai-...',
  }
  return map[providerId] || 'Enter API Key'
}

function onSelectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
  selectedModelId.value = ''
  probeState.value = 'idle'
  probeErrorMessage.value = ''
  probeResponseMessage.value = ''

  apiKeyInput.value = (providersStore.providers[provider.id]?.apiKey as string) || ''
  const defaultOpts = provider.defaultOptions?.() || {}
  baseUrlInput.value = (providersStore.providers[provider.id]?.baseUrl as string) || (defaultOpts as any).baseUrl || ''
  recordDraft()

  if (provider.id === 'web-llm') {
    if (downloadState.value === 'idle' && webgpuSupported.value)
      void startWebLlmDownload()
    return
  }

  // Zero-credential or pre-configured providers query live models immediately
  if (provider.requiresCredentials === false || isProviderConfigured.value) {
    if (provider.requiresCredentials === false) {
      providersStore.markProviderAdded(provider.id)
    }
    void fetchLiveModels()
  }

  scrollToTarget()
}

async function fetchLiveModels() {
  if (!selectedProviderId.value)
    return

  try {
    const models = await providersStore.fetchModelsForProvider(selectedProviderId.value)
    if (models && models.length > 0 && !selectedModelId.value) {
      selectedModelId.value = models[0].id
      recordDraft()
    }
  }
  catch (err: any) {
    console.warn('[Step 2 Consciousness] fetchModelsForProvider failed:', err)
  }
}

async function saveAndConnectInline() {
  if (!selectedProviderId.value || !apiKeyInput.value.trim())
    return

  isSavingConfig.value = true
  try {
    const configToSave: Record<string, unknown> = {
      apiKey: apiKeyInput.value.trim(),
    }
    if (baseUrlInput.value.trim()) {
      configToSave.baseUrl = baseUrlInput.value.trim()
    }

    providersStore.providers[selectedProviderId.value] = {
      ...providersStore.providers[selectedProviderId.value],
      ...configToSave,
    }
    providersStore.markProviderAdded(selectedProviderId.value)

    await fetchLiveModels()
    toast.success(`${selectedChatProvider.value?.name || 'Provider'} connected!`)
    scrollToTarget()
  }
  catch (err: any) {
    console.error('[Step 2 Save Credentials Error]:', err)
    toast.error(err?.message || 'Failed to connect provider')
  }
  finally {
    isSavingConfig.value = false
  }
}

function handleCancelConfig() {
  selectedProviderId.value = ''
  selectedModelId.value = ''
  apiKeyInput.value = ''
  baseUrlInput.value = ''
  probeState.value = 'idle'
  recordDraft()
}

// When a model is selected from the dropdown, fill the editable text input box (Item 1)
function onSelectModelFromDropdown(e: Event) {
  const target = e.target as HTMLSelectElement
  if (target && target.value) {
    selectedModelId.value = target.value
    probeState.value = 'idle'
    recordDraft()
  }
}

// --- Live Connection Test Probe with 4 States: idle -> connecting -> inferencing -> verified/error ---
type ProbeState = 'idle' | 'connecting' | 'inferencing' | 'verified' | 'error'
const probeState = ref<ProbeState>('idle')
const probeResponseMessage = ref('')
const probeErrorMessage = ref('')

async function testBrainConnection() {
  if (probeState.value === 'connecting' || probeState.value === 'inferencing' || !selectedProviderId.value || !selectedModelId.value.trim())
    return

  probeState.value = 'connecting'
  probeErrorMessage.value = ''
  probeResponseMessage.value = ''

  try {
    const providerInstance = await providersStore.getProviderInstance(selectedProviderId.value)
    if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
      throw new Error(`Provider "${selectedProviderId.value}" does not expose chat completions.`)
    }

    // Advance to inferencing phase
    probeState.value = 'inferencing'

    const { generateText } = await import('@xsai/generate-text')
    const result = await generateText({
      ...(providerInstance as any).chat(selectedModelId.value.trim()),
      messages: [{ role: 'user', content: 'Say "Ready to assist!" in under 5 words.' }],
    })

    if (result && result.text) {
      probeState.value = 'verified'
      probeResponseMessage.value = result.text.trim()
      toast.success('Brain connection verified!')
      emit('verified')
    }
    else {
      throw new Error('Empty response received from LLM.')
    }
  }
  catch (err: any) {
    console.error('[Step 2 Consciousness] Probe failed:', err)
    probeState.value = 'error'
    probeErrorMessage.value = err?.message || 'Connection test failed. Check API key, model ID, and network.'
    toast.error(probeErrorMessage.value)
  }
}

// --- Principle 6: record the chosen brain into the transient draft only ---
function recordDraft() {
  draft.setConsciousness({
    provider: selectedProviderId.value || undefined,
    model: selectedModelId.value?.trim() || undefined,
    engine: selectedProviderId.value === 'web-llm' ? 'web-llm' : 'cloud',
  })
}

watch(selectedModelId, (val) => {
  if (val) {
    if (probeState.value === 'error')
      probeState.value = 'idle'
  }
  recordDraft()
})

// --- Verification gate (draft source of truth) ---
const verified = computed(() => {
  if (isWebLlmSelected.value) {
    return downloadState.value === 'ready'
  }
  return probeState.value === 'verified' || (!!selectedProviderId.value && !!selectedModelId.value.trim())
})

const showSkipWarning = ref(false)

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('consciousness', {
    canProceed: computed(() => verified.value),
    skipLabel: 'Skip Step',
    hint: 'Configure an AI model & test connection to unlock Next.',
    onSkip: () => {
      if (verified.value)
        return true
      showSkipWarning.value = true
      return false
    },
  })
})
onBeforeUnmount(() => {
  gate?.clearGate('consciousness')
  downloadAbort.value?.abort()
})

function confirmSkipAnyway() {
  showSkipWarning.value = false
  gate?.requestNext?.()
}

watch(verified, (v) => {
  if (v)
    emit('verified')
})
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-y-auto px-1 pb-2">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Consciousness
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Give AIRI a brain first — character creation borrows it to reason and respond.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="Pick an AI brain for your companion. Connect a free provider, configure your preferred cloud API (OpenRouter, Gemini, OpenAI, Claude), or run local WebLLM on WebGPU!"
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
      <span>WebGPU isn't available on mobile WebKit or this browser. Pick a free or cloud provider below (e.g. OpenRouter, Gemini, Pollinations, MiMo) to power your companion.</span>
    </div>

    <!-- WebLLM Local Engine -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3', !webgpuSupported ? 'opacity-60' : '']">
      <div class="flex items-center gap-2">
        <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4 text-primary-500" />
        <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Local WebLLM (WebGPU Engine)</span>
        <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">OFFLINE · LOCAL</span>
      </div>

      <div class="grid grid-cols-1 gap-2">
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
        <div v-else-if="downloadState === 'error'" class="flex flex-col gap-1 text-xs text-red-600 dark:text-red-400">
          <div class="flex items-center gap-2 font-bold">
            <div class="i-solar:danger-circle-bold-duotone h-4 w-4" />
            Download failed.
            <button class="underline" @click="startWebLlmDownload">
              Retry
            </button>
          </div>
          <span v-if="downloadErrorMessage" class="break-all text-[11px] text-neutral-500 dark:text-neutral-400">
            {{ downloadErrorMessage }}
          </span>
        </div>
      </div>
    </div>

    <!-- Cloud / Local provider matrix (reused grid primitive, sorted alphabetically) -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <div class="flex items-center justify-between">
        <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Choose an AI Brain Provider</span>
        <span class="text-[10px] text-neutral-400">Alphabetical · Tap to select</span>
      </div>
      <ProviderPickerGrid
        :model-value="selectedProviderId"
        :providers="allChatProvidersMetadata"
        @select="onSelectProvider"
        @update:model-value="(id: string) => { selectedProviderId = id }"
      />
    </div>

    <!-- Anchor for smooth scroll -->
    <div ref="actionTargetRef" class="flex flex-col scroll-mt-4 gap-3">
      <!-- Streamlined Modern Inline Credentials Card (only when credentials required and not yet configured) -->
      <div
        v-if="inlineConfigProvider"
        class="border border-neutral-200/60 rounded-xl bg-white/70 p-4 shadow-sm backdrop-blur-md space-y-3 dark:border-neutral-800/80 dark:bg-neutral-900/70"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="h-8 w-8 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
              <div :class="[inlineConfigProvider.iconColor || inlineConfigProvider.icon || 'i-solar:shield-keyhole-bold-duotone', 'h-5 w-5']" />
            </div>
            <div>
              <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                Configure {{ inlineConfigProvider.name }}
              </h4>
              <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                Enter your API credentials to load AI models.
              </p>
            </div>
          </div>

          <a
            v-if="inlineConfigProvider.consoleUrl"
            :href="inlineConfigProvider.consoleUrl"
            target="_blank"
            class="flex items-center gap-1 text-[11px] text-primary-500 font-semibold hover:underline"
          >
            <span>Get Key</span>
            <div class="i-solar:square-top-down-bold h-3.5 w-3.5" />
          </a>
        </div>

        <!-- API Key Field -->
        <div class="space-y-1.5">
          <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
            API Key <span class="text-red-500">*</span>
          </label>
          <div class="relative flex items-center">
            <input
              v-model="apiKeyInput"
              :type="showApiKey ? 'text' : 'password'"
              :placeholder="getApiKeyPlaceholder(inlineConfigProvider.id)"
              class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 pr-10 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
              @keydown.enter="saveAndConnectInline"
            >
            <button
              type="button"
              class="absolute right-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              @click="showApiKey = !showApiKey"
            >
              <div :class="showApiKey ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold'" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Collapsible Base URL for custom endpoints -->
        <div class="space-y-1">
          <button
            type="button"
            class="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            @click="showBaseUrl = !showBaseUrl"
          >
            <div :class="showBaseUrl ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone'" class="h-3.5 w-3.5" />
            <span>Advanced: Custom Base URL</span>
          </button>
          <div v-if="showBaseUrl" class="pt-1">
            <input
              v-model="baseUrlInput"
              type="text"
              placeholder="https://api.example.com/v1"
              class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
            >
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            class="border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-600 font-semibold dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="handleCancelConfig"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="!apiKeyInput.trim() || isSavingConfig"
            class="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs text-white font-bold shadow-md transition active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
            @click="saveAndConnectInline"
          >
            <div v-if="isSavingConfig" class="i-solar:restart-square-bold h-3.5 w-3.5 animate-spin" />
            <span>{{ isSavingConfig ? 'Connecting…' : 'Save & Connect' }}</span>
          </button>
        </div>
      </div>

      <!-- The 4-Item Model Section: Text Input, Dropdown, Get Models Trigger, Rich Probe -->
      <div
        v-if="!isWebLlmSelected && selectedProviderId && (isProviderConfigured || selectedChatProvider?.requiresCredentials === false)"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md space-y-4']"
      >
        <!-- Section Header -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-500 font-bold uppercase dark:text-neutral-400">Model Selection & Test</span>
          <span v-if="selectedChatProvider" class="text-[11px] text-neutral-400 font-semibold">
            {{ selectedChatProvider.name }}
          </span>
        </div>

        <!-- Item 1: Selected Model Input Box (Editable for custom/unlisted models) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Active Model ID <span class="text-red-500">*</span>
            </label>
            <span class="text-[10px] text-neutral-400">Type directly or pick below</span>
          </div>
          <input
            v-model="selectedModelId"
            type="text"
            placeholder="e.g. gemini-2.5-flash, gpt-4o-mini, mistral-large-latest"
            class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
          >
        </div>

        <!-- Item 2 & Item 3: Models Dropdown + Get Models Trigger -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Discovered Models
            </label>
            <button
              type="button"
              :disabled="isLoadingActiveProviderModels"
              class="flex items-center gap-1 text-[11px] text-primary-500 font-bold hover:underline disabled:opacity-50"
              @click="fetchLiveModels"
            >
              <div :class="[isLoadingActiveProviderModels ? 'animate-spin' : '', 'i-solar:restart-square-bold h-3.5 w-3.5']" />
              <span>{{ isLoadingActiveProviderModels ? 'Querying API…' : 'Get Models' }}</span>
            </button>
          </div>

          <div class="relative flex items-center">
            <select
              :disabled="isLoadingActiveProviderModels || providerModels.length === 0"
              :value="selectedModelId"
              class="w-full appearance-none border border-neutral-200 rounded-lg bg-white px-3 py-2 pr-8 text-xs text-neutral-800 outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100 disabled:opacity-60"
              @change="onSelectModelFromDropdown"
            >
              <option value="" disabled selected>
                {{ isLoadingActiveProviderModels ? 'Querying API models…' : (providerModels.length > 0 ? 'Select a discovered model' : 'No Models Found') }}
              </option>
              <option
                v-for="model in providerModels"
                :key="model.id"
                :value="model.id"
              >
                {{ model.name || model.id }}
              </option>
            </select>
            <div class="pointer-events-none absolute right-2.5 text-neutral-400">
              <div class="i-solar:alt-arrow-down-line-duotone h-4 w-4" />
            </div>
          </div>
        </div>

        <!-- Item 4: Live Probe Connection Test with 🟠 -> 🟡 -> 🟢 / 🔴 States -->
        <div class="flex flex-col gap-2.5 border-t border-neutral-200/50 pt-3 dark:border-neutral-800/50">
          <div class="flex items-center justify-between gap-2">
            <button
              :disabled="probeState === 'connecting' || probeState === 'inferencing' || !selectedModelId.trim()"
              class="flex items-center gap-2 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-700 font-semibold shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-50 dark:hover:bg-neutral-700"
              @click="testBrainConnection"
            >
              <div v-if="probeState === 'connecting' || probeState === 'inferencing'" class="i-solar:restart-square-bold h-4 w-4 animate-spin text-primary-500" />
              <div v-else class="i-solar:plain-bold-duotone h-4 w-4 text-primary-500" />
              <span>{{ probeState === 'connecting' || probeState === 'inferencing' ? 'Testing…' : 'Test Brain Connection' }}</span>
            </button>

            <!-- Rich Progress Dot & Status -->
            <div class="flex items-center gap-1.5 text-xs font-semibold">
              <!-- 🟠 Connecting -->
              <template v-if="probeState === 'connecting'">
                <span class="relative h-2.5 w-2.5 flex">
                  <span class="absolute h-full w-full inline-flex animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span class="relative h-2.5 w-2.5 inline-flex rounded-full bg-amber-500" />
                </span>
                <span class="text-amber-600 dark:text-amber-400">Connecting…</span>
              </template>

              <!-- 🟡 Inferencing -->
              <template v-else-if="probeState === 'inferencing'">
                <span class="relative h-2.5 w-2.5 flex">
                  <span class="absolute h-full w-full inline-flex animate-ping rounded-full bg-yellow-400 opacity-75" />
                  <span class="relative h-2.5 w-2.5 inline-flex rounded-full bg-yellow-500" />
                </span>
                <span class="text-yellow-600 dark:text-yellow-400">Inferencing…</span>
              </template>

              <!-- 🟢 Verified -->
              <template v-else-if="probeState === 'verified'">
                <span class="relative h-2.5 w-2.5 flex">
                  <span class="relative h-2.5 w-2.5 inline-flex rounded-full bg-emerald-500" />
                </span>
                <span class="text-emerald-600 dark:text-emerald-400">Verified</span>
              </template>

              <!-- 🔴 Error -->
              <template v-else-if="probeState === 'error'">
                <span class="relative h-2.5 w-2.5 flex">
                  <span class="relative h-2.5 w-2.5 inline-flex rounded-full bg-red-500" />
                </span>
                <span class="text-red-600 dark:text-red-400">Failed</span>
              </template>
            </div>
          </div>

          <!-- Verified Response Bubble -->
          <div
            v-if="probeState === 'verified' && probeResponseMessage"
            class="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <div class="i-solar:chat-round-dots-bold-duotone h-4 w-4 flex-shrink-0 text-emerald-500" />
            <span class="truncate italic">"{{ probeResponseMessage }}"</span>
          </div>

          <!-- Error Details Banner -->
          <div
            v-else-if="probeState === 'error' && probeErrorMessage"
            class="flex items-start gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400"
          >
            <div class="i-solar:danger-triangle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div class="min-w-0 flex-1">
              <span class="font-bold">Test Failed:</span>
              <p class="mt-0.5 break-all text-[11px] leading-snug">
                {{ probeErrorMessage }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Skip Warning Guard Modal -->
    <div
      v-if="showSkipWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div class="max-w-sm w-full border border-neutral-200 rounded-2xl bg-white p-5 shadow-2xl space-y-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="flex items-center gap-3 text-amber-500">
          <div class="i-solar:danger-triangle-bold-duotone text-2xl" />
          <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
            Proceed Without an AI Brain?
          </h3>
        </div>
        <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
          Without an active AI model, your companion will not be able to talk, think, or reply to your voice and chat messages.
        </p>
        <div class="flex flex-col gap-2 pt-2">
          <button
            class="w-full rounded-xl bg-primary-500 py-2.5 text-xs text-white font-bold shadow-md transition hover:bg-primary-600"
            @click="showSkipWarning = false"
          >
            Stay & Configure Brain (Recommended)
          </button>
          <button
            class="w-full border border-neutral-200 rounded-xl py-2 text-xs text-neutral-500 font-semibold transition dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            @click="confirmSkipAnyway"
          >
            Skip Anyway (Configure Later in Settings)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
