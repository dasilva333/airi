<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  artistryComfyHealthCheck,
  POLLINATIONS_DEFAULT_MODELS,
  REPLICATE_IMAGEGEN_PRESETS,
} from '@proj-airi/stage-shared'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { computed, onMounted, ref, watch } from 'vue'

import ArtPreviewModal from '../components/art-preview-modal.vue'
import ComfyuiWorkflowModal from '../components/comfyui-workflow-modal.vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

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

// Seed visual prompt on first load if empty
onMounted(() => {
  if (!visualPrompt.value.trim()) {
    visualPrompt.value = getVesselDefaultPrompt(draft.state.vesselDisplayModelId)
    syncDraft()
  }
})

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
    badge: '100% Free / Zero-Config',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    desc: 'Instant cloud image generation without API keys or accounts.',
    icon: 'i-solar:magic-stick-3-bold-duotone',
  },
  {
    id: 'comfyui' as const,
    name: 'ComfyUI (Local)',
    badge: 'Local Node',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    desc: 'Execute custom workflows on localhost:8188 or WSL node.',
    icon: 'i-solar:monitor-camera-bold-duotone',
  },
  {
    id: 'nanobanana' as const,
    name: 'Nano Banana',
    badge: 'Google AI Studio',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    desc: 'Native Google Gemini image synthesis models.',
    icon: 'i-solar:gallery-round-bold-duotone',
  },
  {
    id: 'replicate' as const,
    name: 'Replicate.ai',
    badge: 'Cloud API',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    desc: 'High-resolution LoRAs, FLUX, and specialized checkpoints.',
    icon: 'i-solar:cloud-upload-bold-duotone',
  },
  {
    id: 'none' as const,
    name: 'None (Disabled)',
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

function handleNext() {
  syncDraft()
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col justify-between flex-1 space-y-4 my-auto animate-fadeIn select-none']">
    <!-- Top Header -->
    <div>
      <div :class="['flex items-center gap-2 text-xs text-neutral-400 mb-0.5']">
        <span :class="['text-primary-500 dark:text-primary-400 font-medium']">Visual Creative Studio</span>
        <span>• Engine & Appearance Blueprint</span>
      </div>
      <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        Artistry & Visual Synthesis
      </h2>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
        Configure your image generation engine, character appearance prefix, and autonomous scene director.
      </p>
    </div>

    <!-- Scrollable Workspace Container -->
    <div :class="['space-y-4 overflow-y-auto max-h-[58vh] pr-1.5 custom-scrollbar']">
      <!-- 1. BACKEND PROVIDER & DYNAMIC SETUP ROW -->
      <div :class="['rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4.5 space-y-4 shadow-sm']">
        <div :class="['flex items-center justify-between']">
          <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2']">
            <span>🎨</span> Image Generation Backend & Engine
          </span>
          <span :class="['text-[10px] text-neutral-400']">Global Synthesizer</span>
        </div>

        <!-- Provider Selection Horizontal Grid -->
        <div :class="['grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs']">
          <div
            v-for="p in providers"
            :key="p.id"
            :class="[
              'cursor-pointer p-3 rounded-xl border transition-all text-left flex flex-col justify-between',
              selectedProvider === p.id
                ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10 shadow-sm'
                : 'border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.01] hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="selectedProvider = p.id"
          >
            <div>
              <div :class="['flex items-center justify-between gap-1']">
                <div :class="[p.icon, 'text-lg', selectedProvider === p.id ? 'text-primary-500' : 'text-neutral-400']" />
                <div v-if="selectedProvider === p.id" :class="['i-solar:check-circle-bold text-primary-500 text-sm shrink-0']" />
              </div>
              <div :class="['text-xs font-bold mt-2 text-neutral-900 dark:text-neutral-100 line-clamp-1']">
                {{ p.name }}
              </div>
              <span :class="['mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium border', p.badgeColor]">
                {{ p.badge }}
              </span>
            </div>
          </div>
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

          <!-- ComfyUI: Server URL + Health Test + Workflow JSON Uploader -->
          <div v-else-if="selectedProvider === 'comfyui'" :class="['space-y-3']">
            <div :class="['grid grid-cols-1 sm:grid-cols-12 gap-3 items-end']">
              <div :class="['sm:col-span-7 space-y-1']">
                <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">ComfyUI Server URL</label>
                <div :class="['flex gap-2']">
                  <input
                    v-model="comfyServerUrl"
                    type="text"
                    placeholder="http://127.0.0.1:8188"
                    :class="['flex-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:border-primary-500 focus:outline-none font-mono']"
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

              <!-- Upload workflow_api.json Button -->
              <div :class="['sm:col-span-5']">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".json"
                  class="hidden"
                  @change="handleComfyFileUpload"
                >
                <button
                  type="button"
                  :class="['w-full px-3.5 py-2.5 rounded-xl border border-dashed border-primary-500/50 hover:border-primary-500 bg-primary-500/5 hover:bg-primary-500/10 text-primary-600 dark:text-primary-300 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer']"
                  @click="fileInputRef?.click()"
                >
                  <div :class="['i-solar:upload-track-bold-duotone text-base']" />
                  <span>Upload workflow_api.json</span>
                </button>
              </div>
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

          <!-- Unified Model / Active Workflow Dropdown -->
          <div :class="['space-y-1.5 pt-1']">
            <label :class="['text-xs font-medium text-neutral-700 dark:text-neutral-300 block']">
              {{ selectedProvider === 'comfyui' ? 'Active Workflow Template' : 'Synthesizer Model' }}
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

      <!-- 2. CHARACTER VISUAL STYLE & LIVE PREVIEW -->
      <div :class="['rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4.5 space-y-3 shadow-sm']">
        <div :class="['flex items-center justify-between']">
          <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2']">
            <span>👗</span> Character Visual Style & LoRA Prefix
          </span>
          <span :class="['text-[10px] bg-primary-500/10 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-500/20 font-medium']">
            ✨ Auto-injected from {{ activeVesselName }}
          </span>
        </div>
        <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal']">
          Pre-pended to every image generation prompt for consistent character appearance, hair, eye color, and art style across generated scenes and selfies.
        </p>

        <!-- Prompt Field with Bottom Right Preview Button -->
        <div :class="['relative']">
          <textarea
            v-model="visualPrompt"
            rows="3"
            :class="['w-full rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 pb-10 text-xs text-neutral-800 dark:text-neutral-200 font-mono leading-relaxed focus:border-primary-500 focus:outline-none resize-none']"
            placeholder="e.g. masterpiece, best quality, 1girl, blue eyes..."
            @input="syncDraft"
          />
          <div :class="['absolute bottom-2.5 left-3 right-3 flex items-center justify-between']">
            <button
              type="button"
              :class="['text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer']"
              @click="resetToDefaultPrompt"
            >
              ↺ Reset to Vessel Default
            </button>
            <button
              type="button"
              :disabled="selectedProvider === 'none'"
              :class="[
                'px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer',
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
        </div>

        <!-- Preset Style Chips -->
        <div :class="['flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]']">
          <span :class="['text-neutral-400 mr-1']">Add Aesthetic:</span>
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
      </div>

      <!-- 3. CINEMATIC AUTONOMY (AUTONOMOUS DIRECTOR) -->
      <div :class="['rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4.5 space-y-3.5 shadow-sm']">
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3']">
            <span :class="['text-2xl mt-0.5']">🎬</span>
            <div>
              <div :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
                <span>Cinematic Autonomy (Autonomous Director)</span>
                <span :class="['text-[9px] bg-primary-500/10 text-primary-500 dark:text-primary-400 px-2 py-0.5 rounded-full border border-primary-500/20 font-medium']">
                  Background Loop
                </span>
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 max-w-xl leading-normal']">
                A parallel 2nd-LLM evaluator that analyzes ongoing conversation and autonomously synthesizes background imagery and selfies during emotional story climaxes.
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
      </div>

      <!-- 4. IN-CHARACTER GENERATION TOOL (IMAGE_JOURNAL) -->
      <div :class="['rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4.5 space-y-3 shadow-sm']">
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3']">
            <span :class="['text-2xl mt-0.5']">🖌️</span>
            <div>
              <div :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
                <span>In-Character Generation Tool</span>
                <span :class="['text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 font-semibold']">
                  image_journal
                </span>
                <span :class="['text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium']">
                  Direct Tool Call
                </span>
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl leading-normal']">
                Equips your companion with the direct <code>image_journal</code> tool schema so they can actively paint illustrations or take selfies on request. When disabled, the autonomous Director can still paint background scenes, but the companion's prompt context remains completely pristine without tool schema pollution.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <button
            type="button"
            :class="[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1',
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

    <!-- Bottom Navigation Buttons -->
    <div :class="['flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-white/5']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        ← Previous
      </button>

      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
        @click="handleNext"
      >
        Next Step →
      </button>
    </div>
  </div>
</template>
