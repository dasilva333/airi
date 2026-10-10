<script setup lang="ts">
import type { ReasoningMode } from '@proj-airi/stage-ui/libs/providers/reasoning'

import { getSupportedReasoningModes, REASONING_MODE_LABELS } from '@proj-airi/stage-ui/libs/providers/reasoning'
import { Select } from '@proj-airi/ui/components/form'
import { computed } from 'vue'

defineProps<{
  consciousnessProviderOptions: { value: string, label: string }[]
  consciousnessModelOptions: { value: string, label: string }[]
  firstHopModelOptions: { value: string, label: string }[]
  defaultConsciousnessModelPlaceholder: string
  defaultFirstHopModelPlaceholder: string
}>()

const emit = defineEmits<{
  navigateToLab: []
  navigateToMemory: []
}>()

const cognitivePipelineEnabled = defineModel<boolean>('cognitivePipelineEnabled', { required: true })
const firstHopProcessor = defineModel<'none' | 'local_nan0' | 'universe_rag'>('firstHopProcessor', { required: true })
const selectedFirstHopProvider = defineModel<string>('selectedFirstHopProvider', { required: true })
const selectedFirstHopModel = defineModel<string>('selectedFirstHopModel', { required: true })
const selectedConsciousnessProvider = defineModel<string>('selectedConsciousnessProvider', { required: true })
const selectedConsciousnessModel = defineModel<string>('selectedConsciousnessModel', { required: true })
const selectedFirstHopReasoning = defineModel<ReasoningMode>('selectedFirstHopReasoning', { required: true })
const selectedConsciousnessReasoning = defineModel<ReasoningMode>('selectedConsciousnessReasoning', { required: true })

function toReasoningOptions(provider: string) {
  return getSupportedReasoningModes(provider).map(mode => ({ value: mode, label: REASONING_MODE_LABELS[mode] }))
}

const firstHopReasoningOptions = computed(() => toReasoningOptions(selectedFirstHopProvider.value))
const consciousnessReasoningOptions = computed(() => toReasoningOptions(selectedConsciousnessProvider.value))

const processorOptions = [
  { value: 'none', label: 'None (Direct Proxy / Raw Prompt)' },
  { value: 'local_nan0', label: 'Nan0 Local Engine (Emotional & Attention Rules)' },
  { value: 'universe_rag', label: 'Universe RAG++ (Epistemic Memory & Grounding)' },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Master Pipeline Toggle -->
    <div class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div class="flex flex-col select-none gap-1">
        <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">
          Cognitive Pipeline (Two-Hop Routing)
        </span>
        <span class="text-[10px] text-neutral-500 leading-normal dark:text-neutral-400">
          Intercept and enrich user messages with a dedicated monologue stage before generating outward speech.
        </span>
      </div>
      <label class="relative inline-flex cursor-pointer items-center">
        <input
          v-model="cognitivePipelineEnabled"
          type="checkbox"
          class="peer sr-only"
        >
        <div class="dark:bg-neutral-850 h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:border after:border-gray-300 dark:border-neutral-700 after:rounded-full after:bg-white peer-checked:bg-primary-600 peer-focus:outline-none after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
      </label>
    </div>

    <!-- Settings Block -->
    <div
      class="flex flex-col gap-5 transition-opacity duration-200"
      :class="{ 'opacity-40 pointer-events-none': !cognitivePipelineEnabled }"
    >
      <!-- First-Hop Processor -->
      <div class="flex flex-col gap-2">
        <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <div i-lucide:cpu />
          1st-Hop Processor
        </label>
        <Select
          v-model="firstHopProcessor"
          :options="processorOptions"
          class="w-full"
        />
        <p class="text-[10px] text-neutral-500 italic dark:text-neutral-400">
          None passes raw text directly to the 1st LLM (ideal for external proxies like Hermes). Nan0 Local executes emotional and attention logic. Universe RAG++ activates epistemic memory retrieval.
        </p>
      </div>

      <!-- Nan0 Local Engine Active Callout -->
      <div
        v-if="firstHopProcessor === 'local_nan0'"
        class="flex items-start justify-between border border-primary-200/80 rounded-xl bg-primary-50/50 p-3.5 dark:border-primary-900/40 dark:bg-primary-950/20"
      >
        <div class="flex items-start gap-2.5">
          <div class="i-solar:shield-check-bold-duotone mt-0.5 shrink-0 text-lg text-primary-500" />
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-primary-900 font-semibold dark:text-primary-200">
              Nan0 Local Cognition Engine Active
            </span>
            <p class="text-[11px] text-primary-700/80 dark:text-primary-300/80">
              Emotional dynamics, pragmatic trigger receptors, and relationship memory are enabled. Use the <strong>Affect</strong>, <strong>Triggers</strong>, and <strong>Playground</strong> segments above.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs text-primary-600 font-medium hover:bg-primary-500/20 dark:text-primary-300"
          @click="emit('navigateToLab')"
        >
          Open Lab →
        </button>
      </div>

      <!-- Universe RAG++ Active Callout ⭐ -->
      <div
        v-else-if="firstHopProcessor === 'universe_rag'"
        class="flex items-start justify-between border border-primary-200/80 rounded-xl bg-primary-50/50 p-3.5 dark:border-primary-900/40 dark:bg-primary-950/20"
      >
        <div class="flex items-start gap-2.5">
          <div class="i-solar:database-bold-duotone mt-0.5 shrink-0 text-lg text-primary-500" />
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-primary-900 font-semibold dark:text-primary-200">
              Universe RAG++ Epistemic Grounding Active
            </span>
            <p class="text-[11px] text-primary-700/80 dark:text-primary-300/80">
              1st-Hop intercepts input turns to retrieve relevant episodic facts, dated journal entries, and cross-session entity dossiers before outward speech generation.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs text-primary-600 font-medium hover:bg-primary-500/20 dark:text-primary-300"
          @click="emit('navigateToMemory')"
        >
          Memory Settings →
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- 1st LLM (Thoughts) -->
        <div class="flex flex-col gap-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div i-lucide:brain />
            1st LLM Provider (Thoughts)
          </label>
          <Select
            v-model="selectedFirstHopProvider"
            :options="consciousnessProviderOptions"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div i-lucide:brain />
            1st LLM Model
          </label>
          <Select
            v-model="selectedFirstHopModel"
            :options="firstHopModelOptions"
            :placeholder="defaultFirstHopModelPlaceholder"
            class="w-full"
          />
        </div>

        <div v-if="firstHopReasoningOptions.length > 0" class="flex flex-col gap-2 sm:col-span-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div i-lucide:lightbulb />
            1st LLM Reasoning
          </label>
          <Select
            v-model="selectedFirstHopReasoning"
            :options="firstHopReasoningOptions"
            class="w-full"
          />
        </div>

        <!-- 2nd LLM (Speech) -->
        <div class="flex flex-col gap-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div i-lucide:sparkles />
            2nd LLM Provider (Outward Speech)
          </label>
          <Select
            v-model="selectedConsciousnessProvider"
            :options="consciousnessProviderOptions"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div i-lucide:sparkles />
            2nd LLM Model
          </label>
          <Select
            v-model="selectedConsciousnessModel"
            :options="consciousnessModelOptions"
            :placeholder="defaultConsciousnessModelPlaceholder"
            class="w-full"
          />
        </div>

        <div v-if="consciousnessReasoningOptions.length > 0" class="flex flex-col gap-2 sm:col-span-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div i-lucide:lightbulb />
            2nd LLM Reasoning
          </label>
          <Select
            v-model="selectedConsciousnessReasoning"
            :options="consciousnessReasoningOptions"
            class="w-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>
