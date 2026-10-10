<script setup lang="ts">
import { downloadLayaModel, formatBytes, getLayaCacheSize, isLayaDownloaded } from '@proj-airi/stage-ui/libs/inference'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Progress } from '@proj-airi/ui'
import { Select } from '@proj-airi/ui/components/form'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  firstHopModelOptions: Array<{ value: string, label: string }>
  defaultConsciousnessModelPlaceholder: string
}>()

export type RerankerProviderId = 'laya-local' | 'typesafe-ai' | 'openrouter-ai' | 'opencode-go' | 'laya' | 'typesafe_jev' | 'openrouter'

const universeRagGroundingEnabled = defineModel<boolean>('universeRagGroundingEnabled', { default: true })
const precisionRerankerEnabled = defineModel<boolean>('precisionRerankerEnabled', { default: true })
const selectedRerankerProvider = defineModel<RerankerProviderId>('selectedRerankerProvider', { default: 'laya-local' })
const system2EscalationEnabled = defineModel<boolean>('system2EscalationEnabled', { default: true })
const deepMemoryReasoningModel = defineModel<string>('deepMemoryReasoningModel', { default: 'inherit' })
const evidenceLimit = defineModel<number>('evidenceLimit', { default: 4 })
const memoryRelevanceThreshold = defineModel<number>('memoryRelevanceThreshold', { default: 0.65 })
const turn1AnaphoraEnabled = defineModel<boolean>('turn1AnaphoraEnabled', { default: true })
const timelineDatePriorityEnabled = defineModel<boolean>('timelineDatePriorityEnabled', { default: true })

const providersStore = useProvidersStore()
const isLayaCached = ref(false)
const layaCacheSize = ref(0)
const isDownloadingLaya = ref(false)
const layaProgress = ref(0)
const layaDownloadError = ref('')

const isTypeSafeConfigured = computed(() => Boolean(providersStore.configuredProviders['typesafe-ai']))
const isOpenRouterConfigured = computed(() => Boolean(providersStore.configuredProviders['openrouter-ai']))

const activeReranker = computed<'laya-local' | 'typesafe-ai' | 'openrouter-ai'>({
  get() {
    if (selectedRerankerProvider.value === 'laya' || selectedRerankerProvider.value === 'laya-local')
      return 'laya-local'
    if (selectedRerankerProvider.value === 'typesafe_jev' || selectedRerankerProvider.value === 'typesafe-ai')
      return 'typesafe-ai'
    return 'openrouter-ai'
  },
  set(val) {
    selectedRerankerProvider.value = val
  },
})

async function checkLayaCache() {
  try {
    isLayaCached.value = await isLayaDownloaded('int8')
    layaCacheSize.value = await getLayaCacheSize()
  }
  catch (e) {
    console.warn('[CognitionSubTabMemory] Cache check error:', e)
  }
}

async function handleDownloadLaya() {
  if (isDownloadingLaya.value)
    return

  isDownloadingLaya.value = true
  layaProgress.value = 0
  layaDownloadError.value = ''

  try {
    await downloadLayaModel({
      precision: 'int8',
      onProgress: (p) => {
        layaProgress.value = p.percentage
      },
    })
    await checkLayaCache()
    providersStore.forceProviderConfigured('laya-local')
  }
  catch (err: any) {
    console.error('[CognitionSubTabMemory] Failed to download Laya:', err)
    layaDownloadError.value = err?.message || 'Download failed'
  }
  finally {
    isDownloadingLaya.value = false
  }
}

onMounted(() => {
  checkLayaCache()
})

const deepMemoryModelOptions = computed(() => [
  { value: 'inherit', label: `Inherit Main Model (${props.defaultConsciousnessModelPlaceholder || 'Default'})` },
  ...props.firstHopModelOptions,
])
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Master Grounding Switch -->
    <div class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div class="flex flex-col select-none gap-1">
        <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">
          In-Flight Memory Grounding (Universe RAG++)
        </span>
        <span class="text-[10px] text-neutral-500 leading-normal dark:text-neutral-400">
          Retrieves relevant past facts, dated journal entries, and episodic recaps from layered memory to ground ongoing conversational turns.
        </span>
      </div>
      <label class="relative inline-flex cursor-pointer items-center">
        <input
          v-model="universeRagGroundingEnabled"
          type="checkbox"
          class="peer sr-only"
        >
        <div class="dark:bg-neutral-850 h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:border after:border-gray-300 dark:border-neutral-700 after:rounded-full after:bg-white peer-checked:bg-primary-600 peer-focus:outline-none after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
      </label>
    </div>

    <div
      class="flex flex-col gap-5 transition-opacity duration-200"
      :class="{ 'opacity-40 pointer-events-none': !universeRagGroundingEnabled }"
    >
      <!-- 1. Semantic Search Strategy -->
      <div class="border border-neutral-200/80 rounded-xl bg-white/70 p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        <div class="flex flex-col gap-4">
          <!-- Section Header & Precision Booster Toggle -->
          <div class="flex items-start justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <div class="flex items-start gap-2.5">
              <span class="i-solar:radar-2-bold-duotone mt-0.5 text-base text-primary-500" />
              <div class="flex flex-col gap-0.5">
                <label class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  Semantic Search Strategy & Precision Booster
                </label>
                <span class="text-[10px] text-neutral-400">
                  Re-scores candidate memories with a cross-encoder model to ensure the most accurate memories surface first.
                </span>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="precisionRerankerEnabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="dark:bg-neutral-850 h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:border after:border-gray-300 dark:border-neutral-700 after:rounded-full after:bg-white peer-checked:bg-primary-600 peer-focus:outline-none after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>

          <!-- 3 Side-by-Side Provider Selection Cards -->
          <div
            class="flex flex-col gap-3 transition-opacity duration-200"
            :class="{ 'opacity-40 pointer-events-none': !precisionRerankerEnabled }"
          >
            <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
              Select Precision Reranking Engine:
            </span>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <!-- Provider 1: Local Laya (ONNX) -->
              <button
                type="button"
                :class="[
                  'flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-150',
                  activeReranker === 'laya-local'
                    ? 'border-primary-500 bg-primary-50/40 text-primary-900 shadow-sm dark:bg-primary-950/30 dark:text-primary-200'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                ]"
                @click="activeReranker = 'laya-local'"
              >
                <div class="w-full flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-semibold">
                    <span class="i-solar:laptop-bold-duotone text-primary-500" />
                    <span>Local Laya</span>
                  </div>
                  <span class="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] text-emerald-600 font-bold font-mono dark:text-emerald-400">100% PRIVATE</span>
                </div>
                <p class="text-[10px] text-neutral-500 leading-snug dark:text-neutral-400">
                  High-speed on-device ModernBERT ONNX model running locally via WebGPU/WASM.
                </p>

                <!-- Dynamic Cache / Download Status Area -->
                <div class="mt-auto w-full border-t border-neutral-100 pt-2 dark:border-neutral-800">
                  <span
                    v-if="isLayaCached"
                    class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600 font-medium dark:text-emerald-400"
                  >
                    <span class="i-solar:check-circle-bold text-emerald-500" />
                    Ready Offline ({{ formatBytes(layaCacheSize) }})
                  </span>

                  <div v-else class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between gap-1">
                      <span class="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium dark:text-amber-400">
                        <span class="i-solar:info-circle-bold" />
                        Not Downloaded
                      </span>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded bg-primary-600 px-2 py-0.5 text-[10px] text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                        :disabled="isDownloadingLaya"
                        @click.stop="handleDownloadLaya"
                      >
                        <span v-if="isDownloadingLaya" class="i-solar:restart-bold animate-spin text-[10px]" />
                        <span v-else class="i-solar:download-square-bold text-[10px]" />
                        <span>{{ isDownloadingLaya ? `${layaProgress}%` : 'Download Weights' }}</span>
                      </button>
                    </div>
                    <Progress v-if="isDownloadingLaya" :progress="layaProgress" class="h-1.5" />
                    <span v-if="layaDownloadError" class="text-[9px] text-red-500">
                      {{ layaDownloadError }}
                    </span>
                  </div>
                </div>
              </button>

              <!-- Provider 2: TypeSafe Jev (Cloud) -->
              <button
                type="button"
                :class="[
                  'flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-150',
                  activeReranker === 'typesafe-ai'
                    ? 'border-primary-500 bg-primary-50/40 text-primary-900 shadow-sm dark:bg-primary-950/30 dark:text-primary-200'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                ]"
                @click="activeReranker = 'typesafe-ai'"
              >
                <div class="w-full flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-semibold">
                    <span class="i-solar:bolt-bold-duotone text-amber-500" />
                    <span>TypeSafe Jev</span>
                  </div>
                  <span class="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] text-amber-600 font-bold font-mono dark:text-amber-400">FAST CLOUD</span>
                </div>
                <p class="text-[10px] text-neutral-500 leading-snug dark:text-neutral-400">
                  High-speed decision classifier via REST API endpoint (~440ms p50).
                </p>

                <!-- Dynamic TypeSafe AI Configured Status -->
                <div class="mt-auto w-full border-t border-neutral-100 pt-2 dark:border-neutral-800">
                  <span
                    v-if="isTypeSafeConfigured"
                    class="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-[10px] text-neutral-700 font-medium dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    <span class="i-solar:key-minimalistic-bold text-amber-500" />
                    API Key Configured (Connected)
                  </span>
                  <router-link
                    v-else
                    to="/settings/providers/system1/typesafe-ai"
                    class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600 font-medium dark:text-amber-400 hover:underline"
                    @click.stop
                  >
                    <span class="i-solar:key-minimalistic-bold text-amber-500" />
                    Configure API Key →
                  </router-link>
                </div>
              </button>

              <!-- Provider 3: OpenRouter (Cloud) -->
              <button
                type="button"
                :class="[
                  'flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-150',
                  activeReranker === 'openrouter-ai'
                    ? 'border-primary-500 bg-primary-50/40 text-primary-900 shadow-sm dark:bg-primary-950/30 dark:text-primary-200'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                ]"
                @click="activeReranker = 'openrouter-ai'"
              >
                <div class="w-full flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-semibold">
                    <span class="i-solar:cloud-bold-duotone text-indigo-500" />
                    <span>OpenRouter</span>
                  </div>
                  <span class="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[9px] text-indigo-600 font-bold font-mono dark:text-indigo-400">UNIVERSAL</span>
                </div>
                <p class="text-[10px] text-neutral-500 leading-snug dark:text-neutral-400">
                  Universal cloud gateway connecting to any hosted cross-encoder model.
                </p>

                <!-- Dynamic OpenRouter Configured Status -->
                <div class="mt-auto w-full border-t border-neutral-100 pt-2 dark:border-neutral-800">
                  <span
                    v-if="isOpenRouterConfigured"
                    class="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-[10px] text-neutral-700 font-medium dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    <span class="i-solar:shield-check-bold text-indigo-500" />
                    Using Global Account Key
                  </span>
                  <router-link
                    v-else
                    to="/settings/providers/openrouter-ai"
                    class="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-600 font-medium dark:text-indigo-400 hover:underline"
                    @click.stop
                  >
                    <span class="i-solar:key-minimalistic-bold text-indigo-500" />
                    Configure Account Key →
                  </router-link>
                </div>
              </button>
            </div>
          </div>

          <!-- Subtle Offline Baseline Footer Note -->
          <div class="flex items-center gap-2 rounded-lg bg-neutral-50/60 px-3 py-2 text-[11px] text-neutral-500 dark:bg-neutral-950/30 dark:text-neutral-400">
            <span class="i-solar:bolt-circle-bold shrink-0 text-sm text-amber-500" />
            <span>
              <strong>Offline Baseline:</strong> Built-in local search (BGE-Small + BM25) is always active 100% offline at zero token cost, providing reliable fallback even with boosters disabled.
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Deep Memory Reasoning -->
      <div class="border border-neutral-200/80 rounded-xl bg-white/70 p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        <div class="flex flex-col gap-4">
          <!-- Header with Pill Toggle -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="i-solar:brain-bold-duotone text-base text-primary-500" />
              <div class="flex flex-col">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  Deep Memory Reasoning
                </span>
                <span class="text-[10px] text-neutral-400">
                  Analyzes multi-step questions, dates, and connected memories before the character speaks
                </span>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="system2EscalationEnabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="dark:bg-neutral-850 h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:border after:border-gray-300 dark:border-neutral-700 after:rounded-full after:bg-white peer-checked:bg-primary-600 peer-focus:outline-none after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>

          <!-- Plain English Explanation Box -->
          <div class="flex items-start gap-2.5 border border-primary-100 rounded-lg bg-primary-50/40 p-3 text-xs text-primary-900 dark:border-primary-900/30 dark:bg-primary-950/20 dark:text-primary-200">
            <span class="i-solar:info-circle-bold mt-0.5 shrink-0 text-sm text-primary-500" />
            <p class="leading-relaxed">
              When you ask about tricky things like relative dates (<em>"Where did we go last Tuesday?"</em>) or connected events across different conversations, AIRI takes a quick private moment to verify the facts first. This prevents made-up answers and hallucinations.
            </p>
          </div>

          <!-- Dedicated Reasoning Model Picker -->
          <div
            class="flex flex-col gap-2 border-t border-neutral-100 pt-3 transition-opacity duration-200 dark:border-neutral-800"
            :class="{ 'opacity-40 pointer-events-none': !system2EscalationEnabled }"
          >
            <label class="flex flex-row items-center gap-2 text-xs text-neutral-700 font-medium dark:text-neutral-300">
              <div class="i-solar:cpu-bold text-primary-500" />
              Reasoning Model (Brain for Memory Analysis)
            </label>
            <Select
              v-model="deepMemoryReasoningModel"
              :options="deepMemoryModelOptions"
              class="w-full"
            />
            <p class="text-[10px] text-neutral-400 italic">
              Choose which model handles multi-step memory verification. Inherit uses the character's main model.
            </p>
          </div>
        </div>
      </div>

      <!-- 3. Search Budgets & Context Window Horizons -->
      <div class="border border-neutral-200/80 rounded-xl bg-white/70 p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <span class="i-solar:tuning-2-bold-duotone text-base text-primary-500" />
            <label class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
              Search Budgets & Context Window Horizons
            </label>
          </div>

          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <!-- Evidence Limit Slider -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-neutral-700 font-medium dark:text-neutral-300">Context Evidence Limit</span>
                <span class="text-[11px] text-primary-600 font-mono dark:text-primary-400">{{ evidenceLimit }} cards</span>
              </div>
              <input
                v-model.number="evidenceLimit"
                type="range"
                min="1"
                max="10"
                step="1"
                class="h-1.5 w-full cursor-pointer accent-primary-500"
              >
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span>1 (Terse)</span>
                <span>4 (Balanced)</span>
                <span>10 (Exhaustive)</span>
              </div>
            </div>

            <!-- Relevance Threshold Slider -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-neutral-700 font-medium dark:text-neutral-300">Relevance Cutoff Threshold</span>
                <span class="text-[11px] text-primary-600 font-mono dark:text-primary-400">{{ Math.round(memoryRelevanceThreshold * 100) }}%</span>
              </div>
              <input
                v-model.number="memoryRelevanceThreshold"
                type="range"
                min="0.30"
                max="0.90"
                step="0.05"
                class="h-1.5 w-full cursor-pointer accent-primary-500"
              >
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span>30% (Wide Recall)</span>
                <span>65% (Standard)</span>
                <span>90% (Strict)</span>
              </div>
            </div>
          </div>

          <!-- Upgraded Pill Switches for Anaphora & Timeline Priority -->
          <div class="grid grid-cols-1 gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2 dark:border-neutral-800">
            <!-- Turn-1 Anaphora Window -->
            <div class="flex items-center justify-between border border-neutral-100 rounded-lg bg-neutral-50/50 p-3 dark:border-neutral-800/60 dark:bg-neutral-950/30">
              <div class="flex flex-col gap-0.5 pr-2">
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-200">Turn-1 Anaphora Window</span>
                <span class="text-[10px] text-neutral-500 leading-snug dark:text-neutral-400">Binds preceding dialogue turn to resolve pronouns ("he", "she", "that place")</span>
              </div>
              <label class="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  v-model="turn1AnaphoraEnabled"
                  type="checkbox"
                  class="peer sr-only"
                >
                <div class="dark:bg-neutral-850 h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:border after:border-gray-300 dark:border-neutral-700 after:rounded-full after:bg-white peer-checked:bg-primary-600 peer-focus:outline-none after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>

            <!-- Timeline Date Priority -->
            <div class="flex items-center justify-between border border-neutral-100 rounded-lg bg-neutral-50/50 p-3 dark:border-neutral-800/60 dark:bg-neutral-950/30">
              <div class="flex flex-col gap-0.5 pr-2">
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-200">Timeline Date Priority</span>
                <span class="text-[10px] text-neutral-500 leading-snug dark:text-neutral-400">Always reserves space for exact calendar dates so timeline questions never miss the day</span>
              </div>
              <label class="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  v-model="timelineDatePriorityEnabled"
                  type="checkbox"
                  class="peer sr-only"
                >
                <div class="dark:bg-neutral-850 h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:border after:border-gray-300 dark:border-neutral-700 after:rounded-full after:bg-white peer-checked:bg-primary-600 peer-focus:outline-none after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
