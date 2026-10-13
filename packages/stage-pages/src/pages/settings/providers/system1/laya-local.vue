<script setup lang="ts">
import {
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import {
  clearLayaCache,
  downloadLayaModel,
  formatBytes,
  getLayaCacheSize,
  isLayaDownloaded,
  LAYA_HF_REPO,
  resetLayaSession,
  runLayaSystemOne,
} from '@proj-airi/stage-ui/libs/inference'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldCheckbox, Progress, Select } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const providerId = 'laya-local'
const providersStore = useProvidersStore()
const systemOneStore = useSystemOneStore()
const router = useRouter()
const { activeProvider } = storeToRefs(systemOneStore)
const { providers } = storeToRefs(providersStore)

// Provider metadata
const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))
const providerConfig = computed(() => providersStore.getProviderConfig(providerId))

// Selected model
const model = computed({
  get(): string {
    return (providers.value[providerId]?.model as string)
      || (providerConfig.value?.model as string)
      || 'tozp/laya-onnx'
  },
  set(val: string) {
    if (!providers.value[providerId]) {
      providers.value[providerId] = {}
    }
    providers.value[providerId].model = val
    if (activeProvider.value === providerId) {
      systemOneStore.activeModel = val
    }
    if (!val.includes('fp16')) {
      providers.value[providerId].enableWebGpu = false
    }
    checkCache()
  },
})

// Whether the currently selected model supports WebGPU acceleration
const isWebGpuSupportedForModel = computed(() => model.value.includes('fp16'))

// WebGPU Acceleration Toggle (restricted to FP16; INT8 is CPU WASM only)
const enableWebGpu = computed({
  get(): boolean {
    if (!isWebGpuSupportedForModel.value)
      return false
    return Boolean(
      providers.value[providerId]?.enableWebGpu
      ?? providerConfig.value?.enableWebGpu
      ?? false,
    )
  },
  set(val: boolean) {
    if (!providers.value[providerId]) {
      providers.value[providerId] = {}
    }
    providers.value[providerId].enableWebGpu = isWebGpuSupportedForModel.value ? val : false
  },
})

const modelOptions = [
  {
    label: 'tozp/laya-onnx (INT8 Quantized, 424 MB - CPU Recommended)',
    value: 'tozp/laya-onnx',
  },
  {
    label: 'tozp/laya-onnx-fp16 (FP16 Full Precision, 843 MB - CPU)',
    value: 'tozp/laya-onnx-fp16',
  },
]

// Cache & Download state
const isCheckingCache = ref(true)
const isCached = ref(false)
const cacheSizeBytes = ref(0)
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadFile = ref('')
const downloadBytesLoaded = ref(0)
const downloadBytesTotal = ref(0)
const downloadError = ref('')

async function checkCache() {
  isCheckingCache.value = true
  try {
    const precision = model.value.includes('fp16') ? 'fp16' : 'int8'
    isCached.value = await isLayaDownloaded(precision)
    cacheSizeBytes.value = await getLayaCacheSize()
  }
  catch (err) {
    console.warn('[LayaLocal] Failed to check cache status:', err)
  }
  finally {
    isCheckingCache.value = false
  }
}

async function handleDownload() {
  if (isDownloading.value)
    return

  isDownloading.value = true
  downloadProgress.value = 0
  downloadFile.value = ''
  downloadError.value = ''
  downloadBytesLoaded.value = 0
  downloadBytesTotal.value = 0

  try {
    const precision = model.value.includes('fp16') ? 'fp16' : 'int8'
    await downloadLayaModel({
      precision,
      onProgress: (p) => {
        downloadFile.value = p.file
        downloadProgress.value = p.percentage
        downloadBytesLoaded.value = p.loaded
        downloadBytesTotal.value = p.total
      },
    })
    await checkCache()
    providersStore.forceProviderConfigured(providerId)
  }
  catch (err: any) {
    console.error('[LayaLocal] Download failed:', err)
    downloadError.value = err?.message || 'Failed to download model bundle.'
  }
  finally {
    isDownloading.value = false
  }
}

async function handleClearCache() {
  try {
    resetLayaSession()
    await clearLayaCache()
    await checkCache()
  }
  catch (err: any) {
    console.error('[LayaLocal] Failed to clear cache:', err)
  }
}

function handleSetActiveProvider() {
  activeProvider.value = providerId
  systemOneStore.activeModel = model.value
  router.push('/settings/modules/system-one')
}

// Interactive Diagnostic State
const isRunningDiagnostic = ref(false)
const diagnosticResult = ref<any>(null)
const diagnosticError = ref('')
const diagnosticLatency = ref<number | null>(null)

const testStateJson = ref(JSON.stringify({
  scene: 'desktop',
  user_intent: 'greeting',
  companion_status: 'attentive',
  last_interaction_delta_sec: 12,
}, null, 2))

const testQuestionsJson = ref(JSON.stringify({
  triage: {
    type: 'choice',
    instructions: 'Classify the incoming interaction query category for memory retrieval triage.',
    criteria: ['literal', 'temporal', 'multihop', 'detective'],
  },
  valence: {
    type: 'score',
    instructions: 'Evaluate the emotional positive valence of the interaction from 0 (cold/negative) to 3 (enthusiastic).',
    criteria: ['negative', 'neutral', 'warm', 'enthusiastic'],
  },
  proactive_engagement: {
    type: 'noul',
    instructions: 'Should AIRI proactively ask a follow-up inquiry based on current context?',
    criteria: {
      false: 'No, wait for user input',
      true: 'Yes, companion should initiate',
    },
  },
}, null, 2))

async function handleRunDiagnostic() {
  if (isRunningDiagnostic.value)
    return

  isRunningDiagnostic.value = true
  diagnosticResult.value = null
  diagnosticError.value = ''
  diagnosticLatency.value = null

  try {
    let parsedState: any
    let parsedQuestions: any

    try {
      parsedState = JSON.parse(testStateJson.value)
    }
    catch {
      parsedState = testStateJson.value
    }

    try {
      parsedQuestions = JSON.parse(testQuestionsJson.value)
    }
    catch (e: any) {
      throw new Error(`Invalid Questions JSON: ${e.message}`)
    }

    const precision = model.value.includes('fp16') ? 'fp16' : 'int8'
    const res = await runLayaSystemOne(parsedState, parsedQuestions, precision, {
      useWebGpu: enableWebGpu.value,
    })
    diagnosticResult.value = res
    diagnosticLatency.value = res.latency_ms
    await checkCache()
  }
  catch (err: any) {
    console.error('[LayaLocal] Diagnostic failed:', err)
    if (typeof err === 'number') {
      diagnosticError.value = `WASM/ONNX runtime internal exception (pointer code ${err}). WebAssembly session failed to initialize. Check DevTools console for detailed WebAssembly logs.`
    }
    else if (err?.name === 'TimeoutError' || (err?.message && (err.message.includes('TimeoutError') || err.message.includes('timed out')))) {
      diagnosticError.value = `Inference timed out. ${enableWebGpu.value ? 'WebGPU execution timed out. Try switching to CPU WASM mode or using FP16 weights.' : 'CPU WASM execution timed out. The model may need more time or a faster thread pool.'}`
    }
    else {
      diagnosticError.value = err?.message || String(err) || 'Execution error during diagnostic test.'
    }
  }
  finally {
    isRunningDiagnostic.value = false
  }
}

onMounted(async () => {
  await checkCache()
})

watch(model, () => {
  checkCache()
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'Local Laya (On-Device)'"
    :provider-description="providerMetadata?.localizedDescription || 'Client-side ModernBERT System 1 classification running locally via WebGPU/WASM'"
    provider-icon="i-solar:laptop-minimalistic-bold-duotone"
    deployment="local"
    pricing="free"
    :beginner-recommended="true"
  >
    <ProviderSettingsContainer>
      <!-- Model Selection & Cache Management Card -->
      <div class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <div class="flex flex-col justify-between gap-3 border-b border-neutral-100 pb-3 sm:flex-row sm:items-center dark:border-neutral-800/60">
          <div>
            <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:disk-bold-duotone text-lg text-primary-500" />
              <span>Model Weight Distribution & Precision</span>
            </h3>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Hugging Face repository:
              <a
                :href="`https://huggingface.co/${LAYA_HF_REPO}`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-primary-600 font-mono dark:text-primary-400 hover:underline"
              >
                {{ LAYA_HF_REPO }}
                <div class="i-solar:arrow-right-up-linear text-[10px]" />
              </a>
            </p>
          </div>

          <!-- Cache Status Pill -->
          <div class="flex items-center gap-2">
            <span
              v-if="isCached"
              class="inline-flex items-center gap-1.5 border border-emerald-500/20 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 font-semibold dark:text-emerald-400"
            >
              <div class="i-solar:check-circle-bold text-sm" />
              Cached & Ready ({{ formatBytes(cacheSizeBytes) }})
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 border border-amber-500/20 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-600 font-semibold dark:text-amber-400"
            >
              <div class="i-solar:info-circle-bold text-sm" />
              Not Downloaded
            </span>
          </div>
        </div>

        <!-- Model Select -->
        <div class="space-y-2">
          <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
            Select Quantization Target
          </label>
          <Select
            v-model="model"
            :options="modelOptions"
            :disabled="isDownloading"
          />
        </div>

        <!-- WebGPU Acceleration Toggle -->
        <div class="border-t border-neutral-100 pt-3 dark:border-neutral-800/60">
          <FieldCheckbox
            v-model="enableWebGpu"
            :disabled="!isWebGpuSupportedForModel"
            label="Experimental WebGPU Acceleration"
            :description="isWebGpuSupportedForModel
              ? 'Attempt to execute ONNX operators on WebGPU first, falling back to CPU WASM. Default: Off (CPU WASM).'
              : 'WebGPU is unsupported on INT8 quantized weights. Switch to FP16 to enable WebGPU acceleration.'"
          />
          <p class="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
            <span class="text-primary-600 font-semibold dark:text-primary-400">Tip:</span>
            {{ isWebGpuSupportedForModel
              ? 'WebGPU delivers the best speedup (~5x faster) when paired with the FP16 model.'
              : 'The INT8 model is strictly optimized for CPU WASM SIMD execution. WebGPU operators for INT8 quantized tensors are not supported and will time out.' }}
          </p>
        </div>

        <!-- Download / Cache Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div class="flex items-center gap-2">
            <Button
              :disabled="isDownloading"
              @click="handleDownload"
            >
              <div v-if="isDownloading" class="i-solar:restart-bold animate-spin text-sm" />
              <div v-else class="i-solar:download-square-bold text-sm" />
              <span>{{ isDownloading ? 'Downloading Model...' : isCached ? 'Re-download Weights' : 'Download Model Bundle' }}</span>
            </Button>

            <Button
              v-if="isCached"
              variant="secondary"
              class="hover:text-red-500 dark:hover:text-red-400"
              :disabled="isDownloading"
              @click="handleClearCache"
            >
              <div class="i-solar:trash-bin-trash-bold text-sm" />
              <span>Clear Cache</span>
            </Button>
          </div>

          <Button
            variant="secondary"
            class="text-xs"
            @click="handleSetActiveProvider"
          >
            <div class="i-solar:check-read-bold text-sm" />
            <span>Open System 1 Studio</span>
          </Button>
        </div>

        <!-- Download Progress Bar -->
        <div v-if="isDownloading" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-4 space-y-2">
          <div class="flex justify-between text-xs opacity-80">
            <span class="max-w-[70%] truncate text-[11px] font-medium font-mono">
              {{ downloadFile ? `Downloading ${downloadFile}...` : 'Preparing download stream...' }}
            </span>
            <span class="font-bold font-mono">{{ downloadProgress }}%</span>
          </div>
          <Progress :progress="downloadProgress" class="h-2" />
          <div v-if="downloadBytesTotal > 0" class="flex justify-between text-[10px] text-neutral-400 font-mono">
            <span>{{ formatBytes(downloadBytesLoaded) }}</span>
            <span>{{ formatBytes(downloadBytesTotal) }}</span>
          </div>
        </div>

        <!-- Download Error -->
        <div v-if="downloadError" class="border border-red-500/30 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 font-mono dark:text-red-400">
          {{ downloadError }}
        </div>
      </div>

      <!-- Diagnostic Playground Card -->
      <div class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800/60">
          <div>
            <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:play-stream-bold-duotone text-lg text-primary-500" />
              <span>System 1 Interactive Diagnostic & Latency Benchmark</span>
            </h3>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Execute a single-pass ModernBERT forward inference run to verify on-device throughput and real measured execution latency.
            </p>
          </div>

          <div v-if="diagnosticLatency !== null" class="border border-primary-500/20 rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs text-primary-600 font-bold font-mono dark:text-primary-400">
            {{ diagnosticLatency }} ms
          </div>
        </div>

        <!-- Input Grid -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Perceptual State (JSON or string)
            </label>
            <textarea
              v-model="testStateJson"
              rows="8"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-800 font-mono dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Candidate Questions & Criteria (JSON)
            </label>
            <textarea
              v-model="testQuestionsJson"
              rows="8"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-800 font-mono dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <Button
            size="sm"
            class="px-4 py-2 text-xs"
            :disabled="isRunningDiagnostic"
            @click="handleRunDiagnostic"
          >
            <div v-if="isRunningDiagnostic" class="i-solar:restart-bold animate-spin text-sm" />
            <div v-else class="i-solar:play-bold text-sm" />
            <span>{{ isRunningDiagnostic ? 'Executing ONNX Run...' : 'Run Diagnostic Classification' }}</span>
          </Button>

          <span class="text-[11px] text-neutral-400">
            {{ enableWebGpu ? 'Executes via onnxruntime-web WebGPU (with WASM fallback)' : 'Executes via onnxruntime-web WASM SIMD (Multi-threaded CPU)' }}
          </span>
        </div>

        <!-- Diagnostic Error -->
        <div v-if="diagnosticError" class="border border-red-500/30 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 font-mono dark:text-red-400">
          {{ diagnosticError }}
        </div>

        <!-- Diagnostic Results Output -->
        <div v-if="diagnosticResult" class="border border-neutral-200 rounded-xl bg-neutral-50 p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/60 pb-2 dark:border-neutral-800/60">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Classification Outputs:</span>
              <span class="rounded bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 font-mono dark:bg-neutral-800 dark:text-neutral-400">
                Model: {{ diagnosticResult.model }}
              </span>
              <span class="border border-primary-500/20 rounded bg-primary-500/10 px-2 py-0.5 text-[11px] text-primary-600 font-bold font-mono dark:text-primary-400">
                ⚡ {{ diagnosticResult.latency_ms ?? diagnosticLatency }} ms
              </span>
            </div>
            <span class="text-[11px] text-neutral-400 font-mono">
              Tokens: {{ diagnosticResult.usage?.input_tokens ?? 0 }} in
            </span>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div
              v-for="(ans, qid) in diagnosticResult.answers"
              :key="qid"
              class="border border-neutral-200/80 rounded-lg bg-white p-3 space-y-1.5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs text-neutral-700 font-bold capitalize dark:text-neutral-300">{{ qid }}</span>
                <span class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[10px] text-primary-600 font-mono dark:text-primary-400">
                  {{ ans.type }}
                </span>
              </div>

              <div v-if="ans.type === 'choice'" class="space-y-1">
                <div class="text-sm text-primary-600 font-black dark:text-primary-400">
                  {{ ans.choice }}
                </div>
                <div class="text-[10px] text-neutral-400">
                  Confidence: {{ Math.round((ans.confidence || 0) * 100) }}%
                </div>
              </div>

              <div v-else-if="ans.type === 'score'" class="space-y-1">
                <div class="text-sm text-primary-600 font-black dark:text-primary-400">
                  Score: {{ ans.score }} / 3.0
                </div>
                <div class="text-[10px] text-neutral-400">
                  Confidence: {{ Math.round((ans.confidence || 0) * 100) }}%
                </div>
              </div>

              <div v-else-if="ans.type === 'noul'" class="space-y-1">
                <div class="text-sm text-primary-600 font-black dark:text-primary-400">
                  {{ ans.noul >= 0.5 ? 'TRUE' : 'FALSE' }} ({{ (ans.noul * 100).toFixed(1) }}%)
                </div>
                <div class="text-[10px] text-neutral-400">
                  Confidence: {{ Math.round((ans.confidence || 0) * 100) }}%
                </div>
              </div>

              <!-- Probabilities distribution -->
              <div v-if="ans.probabilities" class="border-t border-neutral-100 pt-1 space-y-0.5 dark:border-neutral-800">
                <div
                  v-for="(prob, opt) in ans.probabilities"
                  :key="opt"
                  class="flex justify-between text-[10px] text-neutral-500 font-mono"
                >
                  <span class="max-w-[120px] truncate">{{ opt }}:</span>
                  <span>{{ (Number(prob) * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  subtitleKey: settings.pages.providers.title
  stageTransition:
    name: slide
</route>
