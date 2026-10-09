<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  artistryComfyHealthCheck,
  POLLINATIONS_DEFAULT_MODELS,
  REPLICATE_IMAGEGEN_PRESETS,
} from '@proj-airi/stage-shared'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ArtPreviewModal from '../components/art-preview-modal.vue'
import AssistantBubble from '../components/assistant-bubble.vue'
import ComfyuiWorkflowModal from '../components/comfyui-workflow-modal.vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'
import { buildArtistryPromptFromPersona } from '../types'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draft = useOnboardingV3Draft()
const artistryStore = useArtistryStore()
const displayModelsStore = useDisplayModelsStore()

// --- State Bindings ---
const selectedProvider = ref<'pollinations' | 'comfyui' | 'nanobanana' | 'replicate' | 'none'>(
  (draft.state.artistryProvider as any) || 'pollinations',
)
const selectedModel = ref<string>(draft.state.artistryModel || '')
const apiKey = ref<string>(draft.state.artistryApiKey || '')
const comfyServerUrl = ref<string>(draft.state.artistryComfyServerUrl || artistryStore.comfyuiServerUrl || 'http://127.0.0.1:8188')
const visualPrompt = ref<string>(draft.state.artistryVisualPrompt || '')
const directorEnabled = ref<boolean>(draft.state.artistryDirectorEnabled !== false)
const directorTarget = ref<'assistant' | 'user'>(draft.state.artistryDirectorTarget || 'assistant')
const imageJournalToolEnabled = ref<boolean>(draft.state.artistryImageJournalToolEnabled || false)

// --- Active Vessel Context & Auto-Injection ---
const activeVesselName = computed(() => {
  const modelId = draft.state.vesselDisplayModelId
  if (!modelId)
    return 'Avatar'
  const found = displayModelsStore.displayModels.find(m => m.id === modelId)
  return found?.name || modelId
})

const hasPersonaTags = computed(() => (draft.state.customCharacterTags?.length ?? 0) > 0)

function buildPromptFromPersona(): string {
  const charName = draft.state.companionName
    || draft.state.customCharacterCardBundle?.data?.name
    || (activeVesselName.value !== 'Avatar' ? activeVesselName.value : undefined)
  return buildArtistryPromptFromPersona(
    charName,
    draft.state.customCharacterTags || [],
    draft.state.customCharacterSeries,
  )
}

function getVesselDefaultPrompt(modelId?: string): string {
  const mid = (modelId || '').toLowerCase()
  if (mid.includes('hiyori')) {
    return 'masterpiece, best quality, 1girl, hiyori, brown twin tails with blue hair ribbons, brown hair, gentle blue eyes, anime school uniform with blue ribbon tie, clean lineart, soft watercolor anime style,'
  }
  if (mid.includes('avatar') || mid.includes('vrm')) {
    return 'masterpiece, best quality, 1girl, avatarsample_a, dark hair, blue eyes, modern anime casual jacket, expressive eyes, vibrant colors,'
  }
  return 'masterpiece, best quality, 1girl, vibrant anime illustration, beautiful lighting, expressive features, clean lines,'
}

// Seed visual prompt on first load if empty or holding stale vessel file placeholders
onMounted(() => {
  const isStaleVesselDefault = /\.(zip|vrm|pmx|pmd|skel|moc3)/i.test(visualPrompt.value)
    || visualPrompt.value.includes('custom avatar')
  if (!visualPrompt.value.trim() || isStaleVesselDefault) {
    if (hasPersonaTags.value) {
      visualPrompt.value = buildPromptFromPersona()
    }
    else {
      visualPrompt.value = getVesselDefaultPrompt(draft.state.vesselDisplayModelId)
    }
    syncDraft()
  }
})

function resetToPersonaPrompt() {
  if (hasPersonaTags.value) {
    visualPrompt.value = buildPromptFromPersona()
  }
  else {
    visualPrompt.value = getVesselDefaultPrompt(draft.state.vesselDisplayModelId)
  }
  syncDraft()
}

function resetToDefaultPrompt() {
  visualPrompt.value = getVesselDefaultPrompt(draft.state.vesselDisplayModelId)
  syncDraft()
}

function appendStyle(styleTag: string) {
  const trimmed = visualPrompt.value.trim()
  if (trimmed.endsWith(',')) {
    visualPrompt.value = `${trimmed} ${styleTag}`
  }
  else if (trimmed.length > 0) {
    visualPrompt.value = `${trimmed}, ${styleTag}`
  }
  else {
    visualPrompt.value = styleTag
  }
  syncDraft()
}

// --- Providers Configuration ---
const providers = [
  {
    id: 'pollinations' as const,
    name: 'Pollinations AI',
    secondary: 'Hosted service',
    badge: '100% Free / Zero-Config',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    desc: 'Instant cloud image generation without API keys or accounts.',
    icon: 'i-solar:magic-stick-3-bold-duotone',
  },
  {
    id: 'comfyui' as const,
    name: 'ComfyUI',
    secondary: 'Your server',
    badge: 'Local Node',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    desc: 'Execute custom workflows on localhost:8188 or WSL node.',
    icon: 'i-solar:monitor-camera-bold-duotone',
  },
  {
    id: 'nanobanana' as const,
    name: 'Nano Banana',
    secondary: 'Google AI Studio',
    badge: 'Google AI Studio',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    desc: 'Native Google Gemini image synthesis models.',
    icon: 'i-solar:gallery-round-bold-duotone',
  },
  {
    id: 'replicate' as const,
    name: 'Replicate.ai',
    secondary: 'Cloud service',
    badge: 'Cloud API',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    desc: 'High-resolution LoRAs, FLUX, and specialized checkpoints.',
    icon: 'i-solar:cloud-upload-bold-duotone',
  },
  {
    id: 'none' as const,
    name: 'None',
    secondary: 'Image generation off',
    badge: 'Disabled',
    badgeColor: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
    desc: 'Bypass all image generation and visual manifestations.',
    icon: 'i-solar:forbidden-circle-bold-duotone',
  },
]

// --- Unified Model / Workflow Dropdown Options ---
const nanobananaModelOptions = [
  { label: 'Nano Banana 2 (Gemini 3.1 Flash Image)', value: 'gemini-3.1-flash-image-preview' },
  { label: 'Nano Banana Pro (Gemini 3 Pro Image)', value: 'gemini-3-pro-image-preview' },
  { label: 'Nano Banana (Gemini 2.5 Flash Image)', value: 'gemini-2.5-flash-image' },
]

const replicateModelOptions = computed(() => {
  return REPLICATE_IMAGEGEN_PRESETS.map(p => ({
    label: `${p.label} (${p.cost})`,
    value: p.id,
  }))
})

const pollinationsModelOptions = computed(() => {
  const cached = artistryStore.pollinationsCachedModels
  const list = cached.length > 0 ? cached : POLLINATIONS_DEFAULT_MODELS
  return list.map(m => ({
    label: m.id === ''
      ? 'Free Router (Pollinations Auto)'
      : (m.price ? `${m.name} (${m.price})` : m.name),
    value: m.id,
  }))
})

const comfyuiWorkflowOptions = computed(() => {
  const workflows = artistryStore.comfyuiSavedWorkflows || []
  if (workflows.length === 0) {
    return [
      { label: 'No workflows uploaded yet (Upload workflow_api.json above)', value: '' },
    ]
  }
  return workflows.map(wf => ({
    label: `${wf.name} (${Object.values(wf.exposedFields || {}).reduce((n, arr) => n + (arr?.length || 0), 0)} exposed fields)`,
    value: wf.id,
  }))
})

const currentModelOptions = computed(() => {
  if (selectedProvider.value === 'pollinations')
    return pollinationsModelOptions.value
  if (selectedProvider.value === 'comfyui')
    return comfyuiWorkflowOptions.value
  if (selectedProvider.value === 'nanobanana')
    return nanobananaModelOptions
  if (selectedProvider.value === 'replicate')
    return replicateModelOptions.value
  return []
})

// Ensure selectedModel has a sensible fallback when provider switches
watch(selectedProvider, (newProvider) => {
  if (newProvider === 'pollinations') {
    selectedModel.value = ''
  }
  else if (newProvider === 'nanobanana') {
    selectedModel.value = 'gemini-3.1-flash-image-preview'
  }
  else if (newProvider === 'replicate') {
    selectedModel.value = 'black-forest-labs/flux-schnell'
  }
  else if (newProvider === 'comfyui') {
    selectedModel.value = artistryStore.comfyuiActiveWorkflow || (artistryStore.comfyuiSavedWorkflows?.[0]?.id ?? '')
  }
  else {
    selectedModel.value = ''
  }
  syncDraft()
})

// Preload Pollinations model catalog in background if empty
onMounted(() => {
  if (artistryStore.pollinationsCachedModels.length === 0) {
    void artistryStore.fetchPollinationsModels()
  }
})

// --- ComfyUI Inline Connection & Workflow Upload ---
const connectionStatus = ref<'idle' | 'testing' | 'connected' | 'failed'>('idle')
const connectionInfo = ref('')
const isWorkflowModalOpen = ref(false)
const pendingWorkflowRaw = ref<Record<string, any> | null>(null)
const pendingWorkflowFileName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const healthCheck = (window as any)?.electron ? useElectronEventaInvoke(artistryComfyHealthCheck) : null

async function testComfyConnection() {
  connectionStatus.value = 'testing'
  connectionInfo.value = ''
  try {
    const url = comfyServerUrl.value.replace(/\/+$/, '')
    if (healthCheck) {
      const result = await healthCheck({ url })
      connectionInfo.value = `Connected — ${result.gpus || 'GPU'}${result.vramStr ? ` (${result.vramStr} VRAM)` : ''}`
      connectionStatus.value = 'connected'
    }
    else {
      const response = await fetch(`${url}/system_stats`, { method: 'GET', mode: 'cors' })
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const devices = data.devices || []
      const gpuNames = devices.map((d: any) => d.name).join(', ') || 'Connected'
      connectionInfo.value = `Connected — ${gpuNames}`
      connectionStatus.value = 'connected'
    }
  }
  catch (e: any) {
    connectionInfo.value = `Failed: ${e.message}`
    connectionStatus.value = 'failed'
  }
}

function handleComfyFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target?.result as string)
      pendingWorkflowRaw.value = json
      pendingWorkflowFileName.value = file.name
      isWorkflowModalOpen.value = true
    }
    catch (err: any) {
      connectionInfo.value = `Invalid JSON: ${err.message}`
    }
    input.value = ''
  }
  reader.readAsText(file)
}

function handleWorkflowSaved(template: any) {
  artistryStore.comfyuiActiveWorkflow = template.id
  selectedModel.value = template.id
  syncDraft()
}

// --- Preview Modal ---
const isPreviewModalOpen = ref(false)

function openPreviewModal() {
  isPreviewModalOpen.value = true
}

// --- Sync to Draft ---
function syncDraft() {
  draft.setArtistry({
    provider: selectedProvider.value,
    model: selectedModel.value,
    apiKey: apiKey.value,
    comfyServerUrl: comfyServerUrl.value,
    comfyWorkflow: selectedProvider.value === 'comfyui' ? selectedModel.value : undefined,
    visualPrompt: visualPrompt.value,
    directorEnabled: directorEnabled.value,
    directorTarget: directorTarget.value,
    imageJournalToolEnabled: imageJournalToolEnabled.value,
  })
}

onBeforeUnmount(() => {
  syncDraft()
})

function handleNext() {
  syncDraft()
  props.onNext()
}
</script>

<template>
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 pt-2 pb-5 flex flex-col gap-4']">
      <!-- Shared centered header -->
      <div :class="['flex flex-col items-center text-center gap-3 flex-shrink-0']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Artistry
          </h1>
        </div>

        <AssistantBubble
          message="Choose how I create images, and when I bring our stories to life."
          step-key="artistry"
          tone="primary"
        />
      </div>

      <!-- Two-panel workspace -->
      <div :class="['w-full max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] gap-4 lg:gap-5 items-stretch']">
        <!-- Left panel: image generation -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="100"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 min-w-0 min-h-0 flex flex-col gap-4',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <div :class="['flex items-start gap-2.5']">
            <div :class="['h-8 w-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0']">
              <div :class="['i-solar:gallery-round-bold-duotone h-4 w-4']" />
            </div>
            <div :class="['min-w-0']">
              <h2 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                Image generation
              </h2>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                Choose the service that creates your images.
              </p>
            </div>
          </div>

          <!-- Provider rows -->
          <div :class="['flex flex-col gap-2']">
            <button
              v-for="p in providers"
              :key="p.id"
              type="button"
              :class="[
                'w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer min-w-0',
                selectedProvider === p.id
                  ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/30'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="selectedProvider = p.id"
            >
              <div :class="['w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg', selectedProvider === p.id ? 'bg-primary-500/15 text-primary-500' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500']">
                <div :class="[p.icon]" />
              </div>
              <div :class="['flex-1 min-w-0']">
                <div :class="['text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate']">
                  {{ p.name }}
                </div>
                <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 truncate']">
                  {{ p.secondary }}
                </div>
              </div>
              <div :class="['w-4 h-4 rounded-full border flex items-center justify-center shrink-0', selectedProvider === p.id ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 dark:border-neutral-700']">
                <div v-if="selectedProvider === p.id" :class="['w-1.5 h-1.5 rounded-full bg-white']" />
              </div>
            </button>
          </div>

          <!-- Dynamic Contextual Credentials / Setup Row -->
          <div v-if="selectedProvider !== 'none'" :class="['pt-2 border-t border-neutral-200 dark:border-white/5 space-y-3']">
            <!-- Pollinations AI: Optional Pollen Token -->
            <div v-if="selectedProvider === 'pollinations'" :class="['space-y-1.5']">
              <div :class="['flex items-center justify-between text-xs']">
                <label :class="['font-medium text-neutral-700 dark:text-neutral-300']">
                  Pollinations API Key / Pollen Token <span :class="['text-neutral-400 text-[10px]']">(Optional)</span>
                </label>
                <span :class="['text-[10px] text-emerald-500 dark:text-emerald-400 font-mono']">✓ Free mode active without key</span>
              </div>
              <input
                v-model="apiKey"
                type="password"
                placeholder="Leave blank for 100% free mode, or enter token for FLUX/Grok"
                :class="['w-full rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:border-primary-500 focus:outline-none font-mono']"
                @input="syncDraft"
              >
            </div>

            <!-- ComfyUI: Server URL + Workflow + JSON Upload -->
            <div v-else-if="selectedProvider === 'comfyui'" :class="['space-y-3']">
              <div :class="['space-y-1.5']">
                <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">ComfyUI server:</label>
                <div :class="['flex gap-2']">
                  <input
                    v-model="comfyServerUrl"
                    type="text"
                    placeholder="http://127.0.0.1:8188"
                    :class="['flex-1 min-w-0 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:border-primary-500 focus:outline-none font-mono']"
                    @input="syncDraft"
                  >
                  <button
                    type="button"
                    :disabled="connectionStatus === 'testing'"
                    :class="['px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50']"
                    @click="testComfyConnection"
                  >
                    <div :class="[connectionStatus === 'testing' ? 'i-solar:refresh-bold animate-spin' : 'i-solar:plug-circle-bold']" />
                    <span>Test</span>
                  </button>
                </div>
              </div>

              <div :class="['space-y-1.5']">
                <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">Workflow:</label>
                <select
                  v-model="selectedModel"
                  :class="['w-full rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:border-primary-500 focus:outline-none cursor-pointer']"
                  @change="syncDraft"
                >
                  <option v-for="opt in currentModelOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <!-- Upload workflow_api.json -->
              <div :class="['space-y-1.5']">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".json"
                  class="hidden"
                  @change="handleComfyFileUpload"
                >
                <button
                  type="button"
                  :class="['w-full px-3.5 py-2 rounded-xl border border-dashed border-primary-500/50 hover:border-primary-500 bg-primary-500/5 hover:bg-primary-500/10 text-primary-600 dark:text-primary-300 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer']"
                  @click="fileInputRef?.click()"
                >
                  <div :class="['i-solar:upload-track-bold-duotone text-base']" />
                  <span>Upload workflow_api.json</span>
                </button>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
                  Use an API-format workflow exported from ComfyUI.
                </p>
              </div>

              <!-- Comfy Connection Status Banner -->
              <div v-if="connectionInfo" :class="['text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-2', connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20']">
                <div :class="[connectionStatus === 'connected' ? 'i-solar:check-circle-bold' : 'i-solar:danger-triangle-bold']" />
                <span>{{ connectionInfo }}</span>
              </div>
            </div>

            <!-- Nano Banana: Google AI Studio Key -->
            <div v-else-if="selectedProvider === 'nanobanana'" :class="['space-y-1.5']">
              <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">Google AI Studio API Key</label>
              <input
                v-model="apiKey"
                type="password"
                placeholder="AIzaSy..."
                :class="['w-full rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:border-primary-500 focus:outline-none font-mono']"
                @input="syncDraft"
              >
            </div>

            <!-- Replicate: Replicate Token -->
            <div v-else-if="selectedProvider === 'replicate'" :class="['space-y-1.5']">
              <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">Replicate API Token</label>
              <input
                v-model="apiKey"
                type="password"
                placeholder="r8_..."
                :class="['w-full rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:border-primary-500 focus:outline-none font-mono']"
                @input="syncDraft"
              >
            </div>

            <!-- Unified Model Dropdown (non-ComfyUI providers; ComfyUI has its own Workflow selector above) -->
            <div v-if="selectedProvider !== 'comfyui'" :class="['space-y-1.5 pt-1']">
              <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">
                Synthesizer Model
              </label>
              <select
                v-model="selectedModel"
                :class="['w-full rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:border-primary-500 focus:outline-none cursor-pointer']"
                @change="syncDraft"
              >
                <option v-for="opt in currentModelOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <!-- Right panel: character visual style + creation schedule -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="150"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 min-w-0 min-h-0 flex flex-col gap-4',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <div :class="['flex items-start gap-2.5']">
            <div :class="['h-8 w-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0']">
              <div :class="['i-solar:palette-bold-duotone h-4 w-4']" />
            </div>
            <div :class="['min-w-0']">
              <h2 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                Character visual style
              </h2>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                Keep your companion’s appearance consistent across generated images.
              </p>
            </div>
          </div>

          <!-- Editable prompt prefix -->
          <textarea
            v-model="visualPrompt"
            rows="6"
            :class="['w-full min-h-[150px] rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 text-xs text-neutral-800 dark:text-neutral-200 font-mono leading-relaxed focus:border-primary-500 focus:outline-none resize-y']"
            placeholder="e.g. masterpiece, best quality, 1girl, blue eyes..."
            @input="syncDraft"
          />

          <!-- Reset + Preview toolbar -->
          <div :class="['flex items-center gap-2']">
            <button
              v-if="hasPersonaTags"
              type="button"
              :class="['text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors cursor-pointer flex items-center gap-1']"
              @click="resetToPersonaPrompt"
            >
              <span>✨</span>
              <span>Reset to persona tags</span>
            </button>
            <span v-if="hasPersonaTags" :class="['text-neutral-300 dark:text-neutral-700 text-xs']">•</span>
            <button
              type="button"
              :class="['text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer']"
              @click="resetToDefaultPrompt"
            >
              ↺ Reset to avatar default
            </button>
            <span :class="['flex-1']" />
            <button
              type="button"
              :disabled="selectedProvider === 'none'"
              :class="[
                'px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer',
                selectedProvider !== 'none'
                  ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30'
                  : 'bg-neutral-200 dark:bg-white/10 text-neutral-400 cursor-not-allowed',
              ]"
              @click="openPreviewModal"
            >
              <span>🎨</span>
              <span>Preview</span>
            </button>
          </div>

          <!-- Preset Style Chips -->
          <div :class="['flex items-center gap-1.5 flex-wrap text-xs']">
            <span :class="['text-neutral-500 dark:text-neutral-400 font-semibold mr-1']">Add an aesthetic</span>
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
              @click="appendStyle('Studio Ghibli meadow lighting,')"
            >
              + Ghibli Meadow
            </button>
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
              @click="appendStyle('Cyberpunk neon rim lighting, night rain,')"
            >
              + Cyberpunk Neon
            </button>
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
              @click="appendStyle('Makoto Shinkai volumetric clouds, radiant sky,')"
            >
              + Shinkai Sky
            </button>
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
              @click="appendStyle('Cozy warm cafe interior, soft bokeh,')"
            >
              + Cozy Cafe
            </button>
          </div>

          <!-- When to create images -->
          <div :class="['border-t border-neutral-200/70 dark:border-white/10']" />

          <div :class="['flex flex-col gap-2.5']">
            <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
              When to create images
            </h3>

            <!-- Autonomous director row -->
            <div :class="['flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-white/[0.02]']">
              <div :class="['flex items-center gap-2.5 min-w-0']">
                <span :class="['text-xl shrink-0']">🎬</span>
                <div :class="['min-w-0']">
                  <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                    Autonomous director
                  </div>
                  <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                    Creates scene images and selfies as conversations unfold.
                  </p>
                </div>
              </div>

              <!-- Switch Toggle -->
              <button
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  directorEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
                ]"
                @click="directorEnabled = !directorEnabled; syncDraft()"
              >
                <span
                  :class="[
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    directorEnabled ? 'translate-x-5' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>

            <!-- Input Trigger Mode Selector (Enabled only when Director is ON) -->
            <div v-if="directorEnabled" :class="['pt-3 border-t border-neutral-200 dark:border-white/5 space-y-2']">
              <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 block']">
                Evaluation Trigger Mode
              </span>
              <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs']">
                <!-- Companion Reaction / Output (Default) -->
                <div
                  :class="[
                    'cursor-pointer p-3 rounded-xl border transition-all text-left',
                    directorTarget === 'assistant'
                      ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10'
                      : 'border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.01]',
                  ]"
                  @click="directorTarget = 'assistant'; syncDraft()"
                >
                  <div :class="['flex items-center justify-between font-bold text-neutral-900 dark:text-white']">
                    <span>🌟 Companion Reaction (Default)</span>
                    <span :class="['text-[9px] bg-primary-500/20 text-primary-600 dark:text-primary-300 px-1.5 py-0.2 rounded font-medium']">Impact Focus</span>
                  </div>
                  <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal']">
                    Evaluates what the companion replied: <code>User &rarr; LLM Reply &rarr; Director</code>. Best for natural scene reactivity.
                  </p>
                </div>

                <!-- User Input (Standard) -->
                <div
                  :class="[
                    'cursor-pointer p-3 rounded-xl border transition-all text-left',
                    directorTarget === 'user'
                      ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10'
                      : 'border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.01]',
                  ]"
                  @click="directorTarget = 'user'; syncDraft()"
                >
                  <div :class="['flex items-center justify-between font-bold text-neutral-900 dark:text-white']">
                    <span>👤 User Input</span>
                    <span :class="['text-[9px] bg-neutral-200 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.2 rounded font-medium']">Prompt Focus</span>
                  </div>
                  <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal']">
                    Evaluates user's incoming message immediately before the companion speaks.
                  </p>
                </div>
              </div>
            </div>
            <!-- Companion image creation row -->
            <div :class="['flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-white/[0.02]']">
              <div :class="['flex items-center gap-2.5 min-w-0']">
                <span :class="['text-xl shrink-0']">🖌️</span>
                <div :class="['min-w-0']">
                  <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                    Companion image creation
                  </div>
                  <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                    Lets your companion create images when you ask.
                  </p>
                </div>
              </div>

              <!-- Switch Toggle -->
              <button
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  imageJournalToolEnabled ? 'bg-purple-600' : 'bg-neutral-200 dark:bg-neutral-700',
                ]"
                @click="imageJournalToolEnabled = !imageJournalToolEnabled; syncDraft()"
              >
                <span
                  :class="[
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    imageJournalToolEnabled ? 'translate-x-5' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <ComfyuiWorkflowModal
        v-model:open="isWorkflowModalOpen"
        :raw-workflow="pendingWorkflowRaw"
        :default-name="pendingWorkflowFileName"
        @save="handleWorkflowSaved"
      />

      <ArtPreviewModal
        v-model:open="isPreviewModalOpen"
        :prompt="visualPrompt"
        :provider="selectedProvider"
        :model="selectedModel"
        :api-key="apiKey"
      />
    </div>

    <!-- Bottom Navigation Buttons -->
    <div :class="['flex items-center justify-between pt-4 px-4 sm:px-6 border-t border-neutral-200 dark:border-white/5 shrink-0']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        {{ t('onboarding.shell.previous') }}
      </button>

      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
        @click="handleNext"
      >
        {{ t('onboarding.shell.next') }}
      </button>
    </div>
  </div>
</template>
