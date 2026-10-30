<script setup lang="ts">
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { Select } from '@proj-airi/ui/components/form'
import { computed } from 'vue'

const props = defineProps<{
  firstHopModelOptions: Array<{ value: string, label: string }>
  defaultConsciousnessModelPlaceholder: string
}>()

export type RerankerProviderId = 'laya-local' | 'typesafe-ai' | 'openrouter-ai' | 'opencode-go' | 'laya' | 'typesafe_jev' | 'openrouter'

const universeRagGroundingEnabled = defineModel<boolean>('universeRagGroundingEnabled', { default: true })
const precisionRerankerEnabled = defineModel<boolean>('precisionRerankerEnabled', { default: true })
defineModel<RerankerProviderId>('selectedRerankerProvider', { default: 'laya-local' })
const system2EscalationEnabled = defineModel<boolean>('system2EscalationEnabled', { default: true })
const deepMemoryReasoningModel = defineModel<string>('deepMemoryReasoningModel', { default: 'inherit' })
const evidenceLimit = defineModel<number>('evidenceLimit', { default: 4 })
const memoryRelevanceThreshold = defineModel<number>('memoryRelevanceThreshold', { default: 0.65 })
const turn1AnaphoraEnabled = defineModel<boolean>('turn1AnaphoraEnabled', { default: true })
const timelineDatePriorityEnabled = defineModel<boolean>('timelineDatePriorityEnabled', { default: true })

const systemOneStore = useSystemOneStore()
const isSystemOneConfigured = computed(() => systemOneStore.configured)

const activeEngineName = computed(() => {
  switch (systemOneStore.activeProvider) {
    case 'laya-local':
      return systemOneStore.activeModel.includes('openjev') || systemOneStore.activeModel.includes('151m')
        ? 'Local OpenJev (151M)'
        : 'Local Laya (ModernBERT)'
    case 'typesafe-ai':
      return 'TypeSafe Jev (Direct Cloud)'
    case 'openrouter-ai':
      return 'OpenRouter Decisions'
    case 'opencode-go':
      return 'OpenCode Go Jev'
    default:
      return 'Not Configured'
  }
})

const activeEngineBadgeText = computed(() => {
  switch (systemOneStore.activeProvider) {
    case 'laya-local':
      return '100% On-Device'
    case 'typesafe-ai':
    case 'opencode-go':
      return 'Fast Cloud'
    case 'openrouter-ai':
      return 'Universal API'
    default:
      return 'Disabled'
  }
})

const activeEngineBadgeClass = computed(() => {
  switch (systemOneStore.activeProvider) {
    case 'laya-local':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'typesafe-ai':
    case 'opencode-go':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'openrouter-ai':
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
    default:
      return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400'
  }
})

const activeEngineDescription = computed(() => {
  if (!systemOneStore.configured)
    return 'Heuristic BGE-Small + BM25 keyword search is active offline as baseline.'
  return `${systemOneStore.activeModel} · Calibrated cross-encoder memory ranking.`
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

          <!-- Active Global System 1 Engine Status Card -->
          <div
            class="flex flex-col gap-2.5 transition-opacity duration-200"
            :class="{ 'opacity-40 pointer-events-none': !precisionRerankerEnabled }"
          >
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
                Active Precision Reranking Engine (Global System 1)
              </span>
              <router-link
                to="/settings/modules/system-one"
                class="flex items-center gap-1 text-[11px] text-primary-600 font-medium dark:text-primary-400 hover:underline"
              >
                <span>Configure Global Engine</span>
                <span class="i-solar:arrow-right-linear text-xs" />
              </router-link>
            </div>

            <div class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
              <div class="flex items-center gap-3">
                <div class="h-9 w-9 flex shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400">
                  <span class="i-solar:cpu-bold text-lg" />
                </div>
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                      {{ activeEngineName }}
                    </span>
                    <span
                      class="rounded px-1.5 py-0.2 text-[9px] font-bold font-mono uppercase"
                      :class="activeEngineBadgeClass"
                    >
                      {{ activeEngineBadgeText }}
                    </span>
                  </div>
                  <span class="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {{ activeEngineDescription }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span
                  v-if="isSystemOneConfigured"
                  class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-600 font-medium dark:text-emerald-400"
                >
                  <span class="i-solar:check-circle-bold text-emerald-500" />
                  Connected
                </span>
                <router-link
                  v-else
                  to="/settings/modules/system-one"
                  class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-600 font-medium dark:text-amber-400 hover:underline"
                >
                  <span class="i-solar:info-circle-bold text-amber-500" />
                  Set up System 1 →
                </router-link>
              </div>
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
