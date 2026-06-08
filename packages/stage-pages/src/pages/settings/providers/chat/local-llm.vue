<script setup lang="ts">
import { defineEventa, defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import {
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

// Inlined Eventa contracts from eventa.ts
const electronLocalLlmGetStatus = defineInvokeEventa<any>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmGetDownloadedModels = defineInvokeEventa<string[]>('eventa:invoke:electron:local-llm:get-downloaded-models')
const electronLocalLlmDownloadModel = defineInvokeEventa<void, { modelId: string, repo: string, filename: string }>('eventa:invoke:electron:local-llm:download-model')
const electronLocalLlmDeleteModel = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:delete-model')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')
const electronLocalLlmCancelDownload = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:cancel-download')
const electronLocalLlmProgressEvent = defineEventa<any>('eventa:event:electron:local-llm:progress')

const providerId = 'local-llm'
const router = useRouter()
const providersStore = useProvidersStore()

// Recommended catalog
const baseCatalog = [
  {
    id: 'qwen-1.5b',
    name: 'Qwen 2.5 1.5B (Recommended)',
    description: 'Fast, compact, and runs perfectly on CPU or any machine.',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: '0.96 GB',
  },
  {
    id: 'llama-3b',
    name: 'Llama 3.2 3B',
    description: 'Highly capable conversational model. Best on modern machines with 8GB+ RAM.',
    repo: 'Bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '2.02 GB',
  },
]

// Custom models state from localStorage
const customModels = ref<any[]>([])
const customUrl = ref('')
const importError = ref('')

// Reactive catalog combining built-in and custom models
const catalog = computed(() => [
  ...baseCatalog,
  ...customModels.value,
])

function loadCustomModels() {
  try {
    const stored = localStorage.getItem('airi_local_llm_custom_models')
    if (stored) {
      customModels.value = JSON.parse(stored)
    }
  }
  catch (err) {
    console.error('[Local LLM Settings] Failed to load custom models:', err)
  }
}

function saveCustomModels() {
  try {
    localStorage.setItem('airi_local_llm_custom_models', JSON.stringify(customModels.value))
  }
  catch (err) {
    console.error('[Local LLM Settings] Failed to save custom models:', err)
  }
}

async function handleImportModel() {
  importError.value = ''
  const rawUrl = customUrl.value.trim()
  if (!rawUrl) {
    importError.value = 'Please enter a URL'
    return
  }

  let parsed: { repo: string, filename: string } | null = null

  try {
    let cleanUrl = rawUrl
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`
    }
    const url = new URL(cleanUrl)
    if (url.hostname.includes('huggingface.co')) {
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        const repo = `${pathParts[0]}/${pathParts[1]}`

        // Check show_file_info query param
        const showFileInfo = url.searchParams.get('show_file_info')
        if (showFileInfo && showFileInfo.endsWith('.gguf')) {
          parsed = { repo, filename: showFileInfo }
        }
        // Check resolve/blob path
        else if (pathParts.length >= 5 && (pathParts[2] === 'resolve' || pathParts[2] === 'blob')) {
          const filename = pathParts.slice(4).join('/')
          if (filename.endsWith('.gguf')) {
            parsed = { repo, filename }
          }
        }
      }
    }
  }
  catch {
    // Ignore URL parse error, handled by null check below
  }

  if (!parsed) {
    importError.value = 'Invalid Hugging Face model URL. Provide a resolve/blob link or repository link with a file selected (e.g. https://huggingface.co/unsloth/gemma-3-270m-it-GGUF?show_file_info=gemma-3-270m-it-F16.gguf)'
    return
  }

  const { repo, filename } = parsed

  // Extract base filename if there are subfolders, to keep the local filesystem structure simple
  const lastSlashIndex = filename.lastIndexOf('/')
  const baseFilename = lastSlashIndex !== -1 ? filename.slice(lastSlashIndex + 1) : filename

  const modelId = `custom-${repo.replace('/', '-')}-${baseFilename}`.toLowerCase().replace(/[^a-z0-9-_]/g, '')

  // Check if it already exists
  const exists = catalog.value.some(m => m.id === modelId || m.filename === baseFilename)
  if (exists) {
    importError.value = 'This model is already in your catalog.'
    return
  }

  let sizeStr = 'Custom Size'
  try {
    const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`
    const response = await fetch(downloadUrl, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10)
      if (!Number.isNaN(bytes)) {
        sizeStr = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      }
    }
  }
  catch (err) {
    console.warn('Failed to fetch model size via HEAD request:', err)
  }

  const newModel = {
    id: modelId,
    name: baseFilename.replace('.gguf', '').replace(/[-_]/g, ' '),
    description: `Custom model imported from Hugging Face repository ${repo}.`,
    repo,
    filename: baseFilename,
    size: sizeStr,
    isCustom: true,
  }

  customModels.value.push(newModel)
  saveCustomModels()
  customUrl.value = ''
}

function handleRemoveCustomModel(id: string) {
  customModels.value = customModels.value.filter(m => m.id !== id)
  saveCustomModels()
}

// State variables
const runnerStatus = ref<any>({
  state: 'idle',
  binaryExists: false,
  activeModel: null,
  port: 39000,
  error: '',
})
const downloadedModels = ref<string[]>([])
const downloadProgress = ref<any>(null)
const isCancelling = ref(false)
const isStartingServer = ref(false)
let statusPollInterval: any = null

// Setup IPC context
function getInvokers() {
  if (typeof window !== 'undefined') {
    const context = getElectronEventaContext()
    if (context) {
      return {
        getStatus: defineInvoke(context, electronLocalLlmGetStatus),
        getDownloaded: defineInvoke(context, electronLocalLlmGetDownloadedModels),
        download: defineInvoke(context, electronLocalLlmDownloadModel),
        deleteModel: defineInvoke(context, electronLocalLlmDeleteModel),
        startServer: defineInvoke(context, electronLocalLlmStartServer),
        stopServer: defineInvoke(context, electronLocalLlmStopServer),
        cancelDownload: defineInvoke(context, electronLocalLlmCancelDownload),
      }
    }
  }
  return null
}

async function refreshState() {
  const api = getInvokers()
  if (!api)
    return
  try {
    const status = await api.getStatus()
    if (status) {
      runnerStatus.value = status
      if (status.state === 'running') {
        providersStore.forceProviderConfigured(providerId)
      }
      if (status.downloadProgress !== undefined) {
        downloadProgress.value = status.downloadProgress
      }
    }

    const downloaded = await api.getDownloaded()
    if (downloaded)
      downloadedModels.value = downloaded
  }
  catch (err) {
    console.error('[Local LLM Settings] Failed to refresh state:', err)
  }
}

// Download handler
async function handleDownload(model: any) {
  const api = getInvokers()
  if (!api)
    return
  try {
    downloadProgress.value = {
      modelId: model.id,
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      speedMb: 0,
    }
    await api.download({
      modelId: model.id,
      repo: model.repo,
      filename: model.filename,
    })
  }
  catch (err: any) {
    console.error('[Local LLM Settings] Download error:', err)
  }
}

// Cancel download handler
async function handleCancelDownload() {
  const api = getInvokers()
  if (!api)
    return
  try {
    isCancelling.value = true
    await api.cancelDownload()
    downloadProgress.value = null
    await refreshState()
  }
  catch (err) {
    console.error('[Local LLM Settings] Cancel download error:', err)
  }
  finally {
    isCancelling.value = false
  }
}

// Delete handler
async function handleDelete(filename: string) {
  const api = getInvokers()
  if (!api)
    return
  try {
    await api.deleteModel({ modelId: filename })
    await refreshState()
  }
  catch (err) {
    console.error('[Local LLM Settings] Delete error:', err)
  }
}

// Start server handler
async function handleStartServer(filename: string) {
  const api = getInvokers()
  if (!api || isStartingServer.value)
    return
  try {
    isStartingServer.value = true
    await api.startServer({ modelId: filename })
    providersStore.forceProviderConfigured(providerId)
    await refreshState()
  }
  catch (err) {
    console.error('[Local LLM Settings] Start server error:', err)
  }
  finally {
    isStartingServer.value = false
  }
}

// Stop server handler
async function handleStopServer() {
  const api = getInvokers()
  if (!api)
    return
  try {
    // Immediately clear local models and mark unconfigured in store
    const runtimeState = providersStore.providerRuntimeState[providerId]
    if (runtimeState) {
      runtimeState.models = []
      runtimeState.isConfigured = false
    }

    await api.stopServer()
    await refreshState()
  }
  catch (err) {
    console.error('[Local LLM Settings] Stop server error:', err)
  }
}

function onProgress(event: any) {
  console.log('[Local LLM Settings UI] Received progress event:', event)
  const progress = event?.body
  if (!progress)
    return
  downloadProgress.value = progress
  if (progress.status === 'completed' || progress.status === 'failed') {
    const delay = isCancelling.value ? 0 : 3000
    setTimeout(() => {
      downloadProgress.value = null
      refreshState()
    }, delay)
  }
}

watch(() => runnerStatus.value?.state, async (newState, oldState) => {
  if (newState === 'running' && oldState !== 'running') {
    await providersStore.fetchModelsForProvider(providerId)
    await providersStore.validateProvider(providerId, { force: true })
  }
})

onMounted(() => {
  providersStore.initializeProvider(providerId)
  providersStore.forceProviderConfigured(providerId)
  loadCustomModels()
  refreshState()

  // Listen to download progress
  if (typeof window !== 'undefined') {
    const context = getElectronEventaContext()
    console.log('[Local LLM Settings UI] Eventa context in onMounted:', context)
    if (context) {
      context.on(electronLocalLlmProgressEvent, onProgress)
      console.log('[Local LLM Settings UI] Registered progress listener on context')
    }

    // Auto-open devtools for debugging settings window console logs
    const win = window as any
    if (win.electron?.ipcRenderer) {
      win.electron.ipcRenderer.invoke('eventa:invoke:electron:windows:settings:devtools:open').catch(() => {})
    }
  }

  // Poll runner status
  statusPollInterval = setInterval(refreshState, 3000)
})

onUnmounted(() => {
  if (statusPollInterval)
    clearInterval(statusPollInterval)
  if (typeof window !== 'undefined') {
    const context = getElectronEventaContext()
    if (context) {
      context.off(electronLocalLlmProgressEvent, onProgress)
    }
  }
})
</script>

<template>
  <ProviderSettingsLayout
    provider-name="App (Local LLM)"
    provider-icon-color="text-amber-500"
    :on-back="() => router.back()"
  >
    <ProviderSettingsContainer>
      <!-- Server Error Alert -->
      <div v-if="runnerStatus.error" :class="['rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500 font-medium']">
        Error: {{ runnerStatus.error }}
      </div>

      <!-- Import Custom Model Settings -->
      <ProviderBasicSettings
        title="Import Custom GGUF Model"
        description="Add any custom GGUF model directly from Hugging Face by copying and pasting its resolve or blob URL."
      >
        <div :class="['flex flex-col gap-3 mt-3']">
          <div :class="['flex gap-2']">
            <input
              v-model="customUrl"
              type="text"
              placeholder="https://huggingface.co/username/repo/resolve/main/model.gguf"
              :class="['flex-1 px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 text-neutral-900 dark:text-neutral-100']"
            >
            <button
              :class="['px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition shrink-0']"
              @click="handleImportModel"
            >
              Import
            </button>
          </div>
          <p v-if="importError" :class="['text-xs text-red-500 font-medium']">
            {{ importError }}
          </p>
        </div>
      </ProviderBasicSettings>

      <!-- Model Catalog Settings -->
      <ProviderBasicSettings
        title="Model Catalog"
        description="Download optimized models from Hugging Face. The files will be cached locally on your device."
      >
        <div :class="['flex flex-col gap-4 mt-3']">
          <div
            v-for="model in catalog"
            :key="model.id"
            :class="['flex flex-col gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50']"
          >
            <div :class="['flex justify-between items-start']">
              <div>
                <h4 :class="['font-bold text-base']">
                  {{ model.name }}
                </h4>
                <p :class="['text-xs text-neutral-400 mt-0.5']">
                  {{ model.description }}
                </p>
                <div :class="['flex gap-2 mt-2']">
                  <span :class="['px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-500']">GGUF</span>
                  <span :class="['px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-400']">{{ model.size }}</span>
                  <span v-if="runnerStatus.activeModel === model.filename && runnerStatus.state === 'running'" :class="['px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-green-500/10 text-green-500 border border-green-500/20']">Port: {{ runnerStatus.port }}</span>
                </div>
              </div>

              <!-- Action buttons -->
              <div :class="['flex items-center gap-2']">
                <button
                  v-if="!downloadedModels.includes(model.filename) && (!downloadProgress || downloadProgress.modelId !== model.id)"
                  :class="['px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition']"
                  :disabled="!!downloadProgress"
                  @click="handleDownload(model)"
                >
                  Download
                </button>
                <div v-else-if="downloadProgress && downloadProgress.modelId === model.id" :class="['flex gap-2']">
                  <button
                    disabled
                    :class="['px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 rounded-lg text-sm font-semibold cursor-not-allowed flex items-center gap-1.5']"
                  >
                    <div class="i-solar:refresh-line-duotone animate-spin text-sm" />
                    {{ isCancelling ? 'Cancelling...' : `Downloading (${downloadProgress.progress}%)` }}
                  </button>
                  <button
                    v-if="!isCancelling"
                    :class="['px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-semibold transition']"
                    @click="handleCancelDownload"
                  >
                    Cancel
                  </button>
                </div>
                <div v-else :class="['flex gap-2']">
                  <button
                    v-if="runnerStatus.activeModel !== model.filename"
                    :class="['px-3.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition', (isStartingServer || runnerStatus.state === 'starting') && 'opacity-50 cursor-not-allowed']"
                    :disabled="isStartingServer || runnerStatus.state === 'starting'"
                    @click="handleStartServer(model.filename)"
                  >
                    Load & Run
                  </button>
                  <button
                    v-if="runnerStatus.activeModel !== model.filename"
                    :class="['px-2.5 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-red-500 hover:bg-red-500/10 rounded-lg text-sm transition']"
                    @click="handleDelete(model.filename)"
                  >
                    Delete
                  </button>
                  <span
                    v-else-if="runnerStatus.state === 'starting'"
                    :class="['px-3 py-1.5 bg-amber-500/10 text-amber-500 font-semibold rounded-lg text-sm border border-amber-500/20 flex items-center gap-1.5 animate-pulse']"
                  >
                    <div class="i-solar:refresh-line-duotone animate-spin text-sm" />
                    Server Starting...
                  </span>
                  <div v-else :class="['flex items-center gap-2']">
                    <span
                      :class="['px-3 py-1.5 bg-green-500/10 text-green-500 font-semibold rounded-lg text-sm border border-green-500/20']"
                    >
                      Active
                    </span>
                    <button
                      :class="['px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-semibold transition border border-red-500/20']"
                      @click="handleStopServer"
                    >
                      Stop Server
                    </button>
                  </div>
                </div>

                <!-- Remove custom model from catalog list -->
                <button
                  v-if="model.isCustom && runnerStatus.activeModel !== model.filename"
                  :class="['p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-red-500 rounded-lg transition']"
                  title="Remove from Catalog"
                  @click="handleRemoveCustomModel(model.id)"
                >
                  <div :class="['i-solar:trash-bin-trash-bold-duotone text-xl']" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </ProviderBasicSettings>
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
