<script setup lang="ts">
import {
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import {
  clearOpenJevCache,
  downloadLayaModel,
  formatBytes,
  getDecisionModelSpec,
  getOpenJevCacheSize,
  isLayaDownloaded,
  OPENJEV_MODEL_SPECS,
  resetLayaSession,
  runLayaSystemOne,
} from '@proj-airi/stage-ui/libs/inference'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldCheckbox, Progress, Select } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const providerId = 'openjev-local'
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
      || 'heman10x/rlcd-modernbert-151m'
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

// NOTICE: the values are persisted selection keys (provider config and
// `systemOneStore.activeModel`), not download sources; they pick the
// model architecture and precision. The weights come from getDecisionModelSpec().
const modelOptions = [
  {
    label: `OpenJev Base INT8 (${OPENJEV_MODEL_SPECS.int8.approxSizeMb} MB - Fast, CPU Recommended)`,
    value: 'heman10x/rlcd-modernbert-151m',
  },
  {
    label: `OpenJev Base FP16 (${OPENJEV_MODEL_SPECS.fp16.approxSizeMb} MB - WebGPU Recommended)`,
    value: 'heman10x/rlcd-modernbert-151m-fp16',
  },
]

const activeSpec = computed(() => getDecisionModelSpec(model.value))

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
    isCached.value = await isLayaDownloaded(precision, model.value)
    cacheSizeBytes.value = await getOpenJevCacheSize()
  }
  catch (err) {
    console.warn('[OpenJevLocal] Failed to check cache status:', err)
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
      modelId: model.value,
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
    console.error('[OpenJevLocal] Download failed:', err)
    downloadError.value = err?.message || 'Failed to download model bundle.'
  }
  finally {
    isDownloading.value = false
  }
}

async function handleClearCache() {
  try {
    resetLayaSession()
    await clearOpenJevCache()
    await checkCache()
  }
  catch (err: any) {
    console.error('[OpenJevLocal] Failed to clear cache:', err)
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
      model: model.value,
    })
    diagnosticResult.value = res
    diagnosticLatency.value = res.latency_ms
    await checkCache()
  }
  catch (err: any) {
    console.error('[OpenJevLocal] Diagnostic failed:', err)
    if (err?.stack) {
      console.error('[OpenJevLocal] Stack trace:', err.stack)
    }
    const stackSnippet = err?.stack ? `\n\nStack trace:\n${err.stack}` : ''
    if (typeof err === 'number') {
      diagnosticError.value = `WASM/ONNX runtime internal exception (pointer code ${err}). WebAssembly session failed to initialize. Check DevTools console for detailed WebAssembly logs.`
    }
    else if (err?.name === 'TimeoutError' || (err?.message && (err.message.includes('TimeoutError') || err.message.includes('timed out')))) {
      diagnosticError.value = `Inference timed out. ${enableWebGpu.value ? 'WebGPU execution timed out. Try switching to CPU WASM mode or using FP16 weights.' : 'CPU WASM execution timed out. The model may need more time or a faster thread pool.'}`
    }
    else {
      diagnosticError.value = `${err?.message || String(err) || 'Execution error during diagnostic test.'}${stackSnippet}`
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
    :provider-name="providerMetadata?.localizedName || 'OpenJev (On-Device)'"
    :provider-description="providerMetadata?.localizedDescription || 'Client-side lightweight ModernBERT-base (151M) System 1 decision engine via WebGPU/WASM'"
    provider-icon="i-solar:bolt-bold-duotone"
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
                :href="`https://huggingface.co/${activeSpec.repo}`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-primary-600 font-mono dark:text-primary-400 hover:underline"
              >
                {{ activeSpec.repo }}
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

        <!-- Download Action / Progress -->
        <div class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800/60">
          <div v-if="isDownloading" class="space-y-2">
            <div class="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <span class="flex items-center gap-1.5 font-mono">
                <div class="i-solar:cloud-download-bold animate-bounce text-primary-500" />
                {{ downloadFile || 'Downloading model...' }}
              </span>
              <span class="font-bold">{{ downloadProgress }}%</span>
            </div>
            <Progress :progress="downloadProgress" class="h-2" />
            <div class="flex justify-between text-[10px] text-neutral-400">
              <span>{{ formatBytes(downloadBytesLoaded) }} loaded</span>
              <span v-if="downloadBytesTotal > 0">{{ formatBytes(downloadBytesTotal) }} total</span>
            </div>
          </div>

          <div v-if="downloadError" class="border border-red-500/20 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
            <div class="flex items-start gap-2">
              <div class="i-solar:danger-triangle-bold shrink-0 text-sm" />
              <span>{{ downloadError }}</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              v-if="!isCached"
              :disabled="isDownloading"
              class="flex items-center gap-1.5"
              @click="handleDownload"
            >
              <div v-if="isDownloading" class="i-solar:restart-bold animate-spin text-sm" />
              <div v-else class="i-solar:cloud-download-bold text-sm" />
              <span>{{ isDownloading ? 'Downloading Model Bundle...' : `Download & Cache (${activeSpec.approxSizeMb} MB)` }}</span>
            </Button>

            <Button
              v-else
              variant="secondary"
              class="flex items-center gap-1.5"
              @click="handleClearCache"
            >
              <div class="i-solar:trash-bin-trash-bold text-sm text-red-500" />
              <span>Evict Model from Cache</span>
            </Button>

            <Button
              v-if="isCached && activeProvider !== providerId"
              variant="secondary"
              class="flex items-center gap-1.5"
              @click="handleSetActiveProvider"
            >
              <div class="i-solar:check-circle-bold text-sm text-emerald-500" />
              <span>Set as Active System 1 Engine</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Live Diagnostics Test Card -->
      <div class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800/60">
          <div>
            <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:test-tube-bold-duotone text-lg text-primary-500" />
              <span>Live Diagnostic & Output Verification</span>
            </h3>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Executes real zero-shot triage and classification passes against the downloaded OpenJev weights.
            </p>
          </div>

          <div v-if="diagnosticLatency !== null" class="flex items-center gap-1.5 text-xs text-emerald-600 font-bold font-mono dark:text-emerald-400">
            <div class="i-solar:stopwatch-bold" />
            <span>{{ diagnosticLatency }} ms</span>
          </div>
        </div>

        <!-- Test Payload Fields -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              State Payload (JSON or Text)
            </label>
            <textarea
              v-model="testStateJson"
              rows="6"
              class="w-full border border-neutral-200 rounded-xl bg-white p-3 text-xs font-mono dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950 focus:outline-none"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
              Questions Definition (Choice / Score / Noul)
            </label>
            <textarea
              v-model="testQuestionsJson"
              rows="6"
              class="w-full border border-neutral-200 rounded-xl bg-white p-3 text-xs font-mono dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-950 focus:outline-none"
            />
          </div>
        </div>

        <div v-if="diagnosticError" class="border border-red-500/20 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          <div class="flex items-start gap-2">
            <div class="i-solar:danger-triangle-bold shrink-0 text-sm" />
            <span>{{ diagnosticError }}</span>
          </div>
        </div>

        <div v-if="diagnosticResult" class="border border-emerald-500/20 rounded-xl bg-emerald-500/5 p-4 space-y-2 dark:bg-emerald-500/10">
          <div class="flex items-center justify-between text-xs text-emerald-700 font-bold dark:text-emerald-300">
            <span>Inference Result (Model: {{ diagnosticResult.model }})</span>
            <span>Usage: {{ diagnosticResult.usage?.input_tokens ?? 0 }} tokens</span>
          </div>
          <pre class="max-h-60 overflow-auto text-xs text-neutral-800 font-mono dark:text-neutral-200">{{ JSON.stringify(diagnosticResult.answers, null, 2) }}</pre>
        </div>

        <div>
          <Button
            :disabled="isRunningDiagnostic || !isCached"
            class="flex items-center gap-1.5"
            @click="handleRunDiagnostic"
          >
            <div v-if="isRunningDiagnostic" class="i-solar:restart-bold animate-spin text-sm" />
            <div v-else class="i-solar:play-bold text-sm" />
            <span>{{ isRunningDiagnostic ? 'Running Diagnostic Pass...' : (isCached ? 'Run Diagnostic Test' : 'Download Model to Test') }}</span>
          </Button>
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
