<script setup lang="ts">
import type { ReasoningMode } from '@proj-airi/stage-ui/libs/providers/reasoning'

import { BrainModelPicker } from '@proj-airi/stage-ui/components/scenarios/chat'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { FieldCheckbox, FieldInput, FieldTextArea, Select } from '@proj-airi/ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { isThinkingPresetActive, THINKING_PRESETS, toggleThinkingPreset } from './generation-thinking-presets'

const props = defineProps<{
  providerOptions?: { value: string, label: string }[]
  modelOptions?: { value: string, label: string }[]
  providerPlaceholder: string
  modelPlaceholder: string
  systemPrompt?: string
  cardName?: string
}>()

const emit = defineEmits<{
  (e: 'sparkle-click', fieldId: string): void
}>()

const consciousnessProvider = defineModel<string>('consciousnessProvider', { required: true })
const consciousnessModel = defineModel<string>('consciousnessModel', { required: true })
const consciousnessReasoningMode = defineModel<ReasoningMode>('consciousnessReasoningMode', { required: true })
const generationEnabled = defineModel<boolean>('generationEnabled', { required: true })
const generationProvider = defineModel<string>('generationProvider', { required: true })
const generationModel = defineModel<string>('generationModel', { required: true })
const generationMaxTokens = defineModel<number | undefined>('generationMaxTokens', { required: true })
const generationTemperature = defineModel<number | undefined>('generationTemperature', { required: true })
const generationTopP = defineModel<number | undefined>('generationTopP', { required: true })
const generationContextWidth = defineModel<number | undefined>('generationContextWidth', { required: true })
const generationAdvancedJson = defineModel<string>('generationAdvancedJson', { required: true })
const generationReasoningFallback = defineModel<boolean>('generationReasoningFallback', { required: true })
const cardPostHistoryInstructions = defineModel<string>('cardPostHistoryInstructions', { required: true })
const compactionStrategy = defineModel<string>('compactionStrategy', { required: true })
const compactionMinKeepTurns = defineModel<number | undefined>('compactionMinKeepTurns', { required: true })
const { t } = useI18n()
const providersStore = useProvidersStore()

// Keep generationProvider and generationModel in sync with consciousness
watch([consciousnessProvider, consciousnessModel], ([cp, cm]) => {
  if (cp)
    generationProvider.value = cp
  if (cm)
    generationModel.value = cm
}, { immediate: true })

// Live Generation Test Probe State
const probeOpen = ref(true)
const testPrompt = ref('Say hello in character and introduce yourself in one short sentence.')
const probeRunning = ref(false)
const probeStatus = ref<'idle' | 'running' | 'success' | 'error'>('idle')
const probeDurationMs = ref<number | null>(null)
const probeResponseText = ref('')
const probeReasoningText = ref('')
const probeTokenUsage = ref<{ prompt?: number, completion?: number, reasoning?: number } | null>(null)
const probeErrorMessage = ref('')
const showReasoningAccordion = ref(false)

async function runTestProbe() {
  if (probeRunning.value)
    return

  const effectiveProvider = consciousnessProvider.value || generationProvider.value || props.providerPlaceholder
  const effectiveModel = consciousnessModel.value || generationModel.value || props.modelPlaceholder

  if (!effectiveProvider || effectiveProvider === 'None' || !effectiveModel || effectiveModel === 'None') {
    probeStatus.value = 'error'
    probeErrorMessage.value = 'No valid AI provider or model selected. Please select a Consciousness LLM above.'
    return
  }

  probeRunning.value = true
  probeStatus.value = 'running'
  probeErrorMessage.value = ''
  probeResponseText.value = ''
  probeReasoningText.value = ''
  probeTokenUsage.value = null
  const startTime = performance.now()

  try {
    const providerInstance = await providersStore.getProviderInstance(effectiveProvider)
    if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
      throw new Error(`Provider "${effectiveProvider}" does not expose chat completions.`)
    }

    let advancedOverrides: Record<string, unknown> = {}
    if (generationAdvancedJson.value && generationAdvancedJson.value.trim()) {
      try {
        advancedOverrides = JSON.parse(generationAdvancedJson.value)
      }
      catch (jsonErr: any) {
        throw new Error(`Advanced JSON is malformed: ${jsonErr.message}`)
      }
    }

    const { generateText } = await import('@xsai/generate-text')
    const chatConfig = (providerInstance as any).chat(effectiveModel)

    const messages = [
      ...(props.systemPrompt?.trim() ? [{ role: 'system' as const, content: props.systemPrompt.trim() }] : []),
      { role: 'user' as const, content: testPrompt.value.trim() || 'Hello!' },
    ]

    const result = await generateText({
      ...chatConfig,
      ...advancedOverrides,
      messages,
      temperature: generationTemperature.value,
      top_p: generationTopP.value,
      max_tokens: generationMaxTokens.value || 300,
    })

    const elapsed = Math.round(performance.now() - startTime)
    probeDurationMs.value = elapsed

    const rawReasoning = result.reasoningText
      || (result as any).reasoning
      || (result as any).reasoning_content
      || (result.messages?.length && ((result.messages[result.messages.length - 1] as any)?.reasoning_content || (result.messages[result.messages.length - 1] as any)?.reasoning))
      || ''

    let speechText = result.text?.trim() || ''

    // Reasoning Fallback check: if speech is empty and reasoningFallback is true, use reasoning as speech
    if (!speechText && rawReasoning && generationReasoningFallback.value !== false) {
      speechText = String(rawReasoning).trim()
    }

    probeResponseText.value = speechText
    probeReasoningText.value = rawReasoning ? String(rawReasoning).trim() : ''

    const promptTokens = (result.usage as any)?.prompt_tokens || (result.usage as any)?.input_tokens
    const completionTokens = (result.usage as any)?.completion_tokens || (result.usage as any)?.output_tokens
    const reasoningTokens = (result.usage as any)?.completion_tokens_details?.reasoning_tokens || (result.usage as any)?.reasoning_tokens

    if (promptTokens || completionTokens) {
      probeTokenUsage.value = {
        prompt: promptTokens,
        completion: completionTokens,
        reasoning: reasoningTokens,
      }
    }

    probeStatus.value = 'success'
  }
  catch (err: any) {
    console.error('[GenerationTab] Test Probe failed:', err)
    probeStatus.value = 'error'
    probeErrorMessage.value = err?.message || String(err)
  }
  finally {
    probeRunning.value = false
  }
}

function updateGlobalContextMap() {
  if (!generationContextWidth.value || !generationProvider.value || !generationModel.value)
    return

  try {
    const rawMap = localStorage.getItem('airi:context-width-map')
    const map = rawMap ? JSON.parse(rawMap) : {}

    if (!map[generationProvider.value]) {
      map[generationProvider.value] = {}
    }

    map[generationProvider.value][generationModel.value] = generationContextWidth.value
    localStorage.setItem('airi:context-width-map', JSON.stringify(map))
  }
  catch (err) {
    console.error('[CardCreationTabGeneration] Failed to update global context map:', err)
  }
}

function onSelectThinkingPreset(presetValue: Record<string, unknown>) {
  generationAdvancedJson.value = toggleThinkingPreset(generationAdvancedJson.value, presetValue)
}

watch([generationContextWidth, generationProvider, generationModel], () => {
  updateGlobalContextMap()
})
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <p class="mb-3">
      Tune character consciousness and response generation. Select the companion's primary brain model, or customize sampling parameters and thinking modes.
    </p>

    <!-- Top Headline Anchor: Consciousness (LLM) Picker -->
    <div class="mx-auto mb-6 w-90% flex flex-col gap-2 border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-center justify-between">
        <label class="flex flex-row items-center gap-2 text-sm text-neutral-700 font-semibold dark:text-neutral-200">
          <div i-lucide:brain class="text-primary-500" />
          Consciousness (LLM)
        </label>
        <span class="text-xs text-neutral-400">
          Primary brain engine for this character
        </span>
      </div>

      <BrainModelPicker
        v-model:provider="consciousnessProvider"
        v-model:model="consciousnessModel"
        v-model:reasoning-mode="consciousnessReasoningMode"
        variant="button"
        title="Select Consciousness LLM"
        side="bottom"
        class="w-full"
      />
    </div>

    <div class="mx-auto mb-6 w-90% border border-amber-200 rounded-xl bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      Keys that work for one provider or model may be ignored or rejected by another. Start simple, and treat these as character-specific generation defaults rather than guaranteed cross-provider behavior.
    </div>

    <div class="mx-auto mb-6 w-90% flex flex-col gap-4">
      <FieldCheckbox
        v-model="generationEnabled"
        label="Override global sampling & thinking parameters"
        description="When disabled, this character uses the Consciousness LLM with global default temperature and token limits."
      />
      <FieldCheckbox
        v-model="generationReasoningFallback"
        label="Fall back to reasoning on empty speech"
        description="If the model outputs everything inside reasoning tags (leaving speech empty), use the reasoning text as the spoken content."
        :disabled="!generationEnabled"
      />
    </div>

    <div class="input-list ml-auto mr-auto w-90% flex flex-row flex-wrap justify-start gap-8" :class="[!generationEnabled ? 'pointer-events-none opacity-50' : '']">
      <FieldInput
        v-model="generationMaxTokens"
        class="field-block"
        label="Max Tokens"
        description="Cap the model's reply length for this character."
        type="number"
        placeholder="500"
      />

      <FieldInput
        v-model="generationTemperature"
        class="field-block"
        label="Temperature"
        description="Higher values are more random; lower values are more deterministic."
        type="number"
        placeholder="0.8"
      />

      <FieldInput
        v-model="generationTopP"
        class="field-block"
        label="Top P"
        description="Nucleus sampling cutoff for this character's replies."
        type="number"
        placeholder="0.9"
      />

      <FieldInput
        v-model="generationContextWidth"
        class="field-block"
        label="Context Width (Compaction Threshold)"
        description="The token threshold that triggers history compaction and drives the visual context meter."
        type="number"
        placeholder="4096"
      />

      <div class="field-block">
        <label class="mb-2 flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <div i-solar:tuning-square-bold-duotone />
          Compaction Strategy
        </label>
        <Select
          v-model="compactionStrategy"
          :options="[
            { value: 'none', label: 'None (Disabled)' },
            { value: 'prune', label: 'Prune History Only' },
            { value: 'distill', label: 'Distill & Summarize (Premium)' },
          ]"
          class="w-full"
        />
      </div>

      <FieldInput
        v-model="compactionMinKeepTurns"
        class="field-block"
        label="Compaction Preservation Window"
        description="The number of recent messages to always keep un-compacted."
        type="number"
        placeholder="15"
      />

      <div class="advanced-block">
        <label class="flex flex-col gap-4">
          <div>
            <div class="flex items-center gap-1 text-sm font-medium">
              {{ t('settings.pages.card.posthistoryinstructions') }}
              <span class="text-red-500">*</span>
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.pages.card.creation.fields_info.posthistoryinstructions') }}
            </div>
          </div>
          <div class="relative w-full">
            <textarea
              v-model="cardPostHistoryInstructions"
              rows="6"
              :placeholder="t('settings.pages.card.posthistoryinstructions')"
              class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-9 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
            />
            <button
              type="button"
              style="position: absolute; top: 8px; right: 8px; z-index: 50; display: flex; height: 32px; width: 32px; align-items: center; justify-content: center; border-radius: 8px; border: none; cursor: pointer; background: transparent;"
              class="text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
              title="Optimize with AI"
              @click.prevent="emit('sparkle-click', 'postHistoryInstructions')"
            >
              <span i-ph:sparkle class="i-ph:sparkle animate-pulse text-lg" style="display: inline-block; width: 1.2em; height: 1.2em;" />
            </button>
          </div>
        </label>
      </div>

      <FieldTextArea
        v-model="generationAdvancedJson"
        class="advanced-block"
        label="Advanced JSON"
        description="Optional raw request fields for provider-specific tuning. These keys are merged into the outbound request when Generation is enabled."
        placeholder="{&#10;  &quot;thinking&quot;: { &quot;type&quot;: &quot;disabled&quot; }&#10;}"
        :rows="8"
      />

      <div class="advanced-block mb-2 flex flex-col gap-2 -mt-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
            Disable thinking variants:
          </span>
          <button
            v-for="preset in THINKING_PRESETS"
            :key="preset.label"
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono transition-all cursor-pointer select-none active:scale-95',
              isThinkingPresetActive(generationAdvancedJson, preset.value)
                ? 'border-primary-500/80 bg-primary-50 font-semibold text-primary-700 shadow-sm dark:border-primary-400/80 dark:bg-primary-950/60 dark:text-primary-300'
                : 'border-neutral-200/80 bg-neutral-100/70 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/80',
            ]"
            :title="preset.description"
            @click="onSelectThinkingPreset(preset.value)"
          >
            <div :class="[isThinkingPresetActive(generationAdvancedJson, preset.value) ? 'i-lucide:check text-primary-600 dark:text-primary-400' : 'i-lucide:code-2 opacity-60', 'text-xs']" />
            <span>{{ preset.label }}</span>
          </button>
        </div>

        <div class="flex items-start gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <div i-lucide:info class="mt-0.5 shrink-0 text-amber-500/80 dark:text-amber-400/80" />
          <span>Different variants are provided; they might not work when used depending on the provider or model.</span>
        </div>
      </div>

      <!-- Test Generation Probe Section -->
      <div class="advanced-block mt-4 flex flex-col gap-3 border border-primary-500/25 rounded-2xl bg-primary-500/5 p-4 transition-all dark:border-primary-400/25 dark:bg-primary-500/5">
        <div class="flex cursor-pointer items-center justify-between" @click="probeOpen = !probeOpen">
          <div class="flex items-center gap-2">
            <div class="i-solar:play-circle-bold-duotone text-lg text-primary-500" />
            <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">Live Generation Test Probe</span>
            <span class="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-semibold dark:text-primary-300">
              Instant Validation
            </span>
          </div>
          <button type="button" class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <div :class="[probeOpen ? 'i-solar:alt-arrow-up-linear' : 'i-solar:alt-arrow-down-linear', 'text-base']" />
          </button>
        </div>

        <div v-show="probeOpen" class="flex flex-col gap-3 pt-1">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Test current draft settings (temperature, top_p, advanced JSON, reasoning fallback) with this character's persona prompt without leaving the editor.
          </p>

          <!-- Input and Run Button -->
          <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div class="relative flex-1">
              <input
                v-model="testPrompt"
                type="text"
                placeholder="Enter test prompt (e.g. Say hello in character)..."
                :disabled="probeRunning"
                class="w-full border border-neutral-200 rounded-xl bg-white px-3 py-2 text-xs text-neutral-800 outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-100"
                @keydown.enter.prevent="runTestProbe"
              >
            </div>
            <button
              type="button"
              :disabled="probeRunning"
              class="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs text-white font-semibold shadow-sm transition active:scale-95 hover:bg-primary-600 disabled:opacity-50"
              @click="runTestProbe"
            >
              <div :class="[probeRunning ? 'i-solar:restart-square-bold animate-spin' : 'i-solar:play-bold', 'text-sm']" />
              <span>{{ probeRunning ? 'Probing...' : 'Run Probe' }}</span>
            </button>
          </div>

          <!-- Telemetry Info -->
          <div v-if="probeStatus !== 'idle'" class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 text-[11px] font-mono">
              <span class="rounded bg-neutral-200/60 px-1.5 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                Target: {{ generationProvider || props.providerPlaceholder || 'Default' }} / {{ generationModel || props.modelPlaceholder || 'Default' }}
              </span>
              <span v-if="probeDurationMs !== null" class="rounded bg-primary-500/10 px-1.5 py-0.5 text-primary-600 font-bold dark:text-primary-400">
                ⏱️ {{ probeDurationMs }}ms
              </span>
              <span v-if="probeTokenUsage?.completion" class="rounded bg-neutral-200/60 px-1.5 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                Tokens: {{ probeTokenUsage.completion }} out / {{ probeTokenUsage.prompt || '?' }} in
              </span>
            </div>

            <div class="flex items-center gap-1">
              <span v-if="probeStatus === 'running'" class="flex items-center gap-1.5 text-amber-500 font-medium">
                <span class="relative h-2 w-2 flex">
                  <span class="absolute h-full w-full inline-flex animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span class="relative h-2 w-2 inline-flex rounded-full bg-amber-500" />
                </span>
                Querying LLM...
              </span>
              <span v-else-if="probeStatus === 'success'" class="flex items-center gap-1 text-emerald-600 font-medium dark:text-emerald-400">
                <div class="i-solar:check-circle-bold text-sm" /> Verified Response
              </span>
              <span v-else-if="probeStatus === 'error'" class="flex items-center gap-1 text-red-500 font-medium">
                <div class="i-solar:close-circle-bold text-sm" /> Probe Failed
              </span>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="probeStatus === 'error' && probeErrorMessage" class="border border-red-500/20 rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
            <div class="flex items-start gap-2">
              <div class="i-solar:danger-triangle-bold-duotone mt-0.5 shrink-0 text-base text-red-500" />
              <div class="min-w-0 flex-1 break-words text-[11px] font-mono">
                {{ probeErrorMessage }}
              </div>
            </div>
          </div>

          <!-- Reasoning Block (if reasoning present) -->
          <div v-if="probeReasoningText" class="overflow-hidden border border-neutral-200/80 rounded-xl bg-neutral-100/60 dark:border-neutral-800 dark:bg-neutral-900/60">
            <button
              type="button"
              class="w-full flex items-center justify-between p-2.5 text-left text-xs text-neutral-600 font-semibold hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:bg-neutral-800/40"
              @click="showReasoningAccordion = !showReasoningAccordion"
            >
              <div class="flex items-center gap-1.5">
                <div class="i-solar:cpu-bolt-bold-duotone text-sm text-primary-500" />
                <span>Reasoning Output ({{ probeReasoningText.length }} chars)</span>
              </div>
              <div :class="[showReasoningAccordion ? 'i-solar:alt-arrow-up-linear' : 'i-solar:alt-arrow-down-linear', 'text-xs']" />
            </button>
            <div v-show="showReasoningAccordion" class="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-neutral-200/50 p-3 text-[11px] text-neutral-600 leading-relaxed font-mono dark:border-neutral-800/50 dark:text-neutral-300">
              {{ probeReasoningText }}
            </div>
          </div>

          <!-- Response Text Output -->
          <div v-if="probeResponseText" class="border border-neutral-200/80 rounded-xl bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div class="mb-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Character Response Preview
            </div>
            <p class="whitespace-pre-wrap text-xs text-neutral-800 leading-relaxed dark:text-neutral-100">
              {{ probeResponseText }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-list > * {
  min-width: 45%;
}

.field-block {
  width: 45%;
}

.advanced-block {
  width: 100%;
}

@media (max-width: 641px) {
  .input-list > * {
    min-width: unset;
    width: 100%;
  }

  .field-block {
    width: 100%;
  }
}
</style>
