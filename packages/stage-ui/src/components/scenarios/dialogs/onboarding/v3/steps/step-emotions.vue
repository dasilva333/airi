<script setup lang="ts">
import type { EmotionStudioSyncPayload } from '../../../../acting/EmotionCalibrationStudio.vue'

import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EmotionCalibrationStudio from '../../../../acting/EmotionCalibrationStudio.vue'

import { resolvePersona } from '../composables/useStarterCardCommit'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draft = useOnboardingV3Draft()

// --- Thin wrapper: draft owns persistence, studio owns the cockpit ---
const activeModelId = computed(() => draft.state.vesselDisplayModelId || 'preset-live2d-2')

// Character persona (never the user): AI-creator bundle first, then the
// canonical cross-source resolver (import / starter preset / default).
const bundleData = computed(() => {
  const b = draft.state.customCharacterCardBundle as any
  return b?.data || b
})

const characterPersona = computed(() => {
  if (bundleData.value?.personality || bundleData.value?.description) {
    return {
      name: draft.state.companionName || bundleData.value?.name || 'Companion',
      personality: bundleData.value?.personality || '',
      description: bundleData.value?.description || '',
      scenario: bundleData.value?.scenario || '',
      systemPrompt: bundleData.value?.system_prompt || bundleData.value?.systemPrompt || '',
    }
  }
  const resolved = resolvePersona(draft.state, draft.state.userName || 'Friend')
  return {
    name: resolved.nickname || resolved.name || 'Companion',
    personality: resolved.personality || '',
    description: resolved.description || '',
    scenario: resolved.scenario || '',
    systemPrompt: resolved.systemPrompt || '',
  }
})

const lastSync = ref<EmotionStudioSyncPayload | null>(null)

function handleStudioSync(payload: EmotionStudioSyncPayload) {
  lastSync.value = payload
  draft.setEmotions({
    emotionsCurated: payload.emotionsCurated,
    expressionMappings: payload.expressionMappings,
    actingModelExpressionPrompt: payload.actingModelExpressionPrompt,
    cueAllowlist: payload.cueAllowlist,
    compiledWhitelist: payload.compiledWhitelist,
  })
}

onBeforeUnmount(() => {
  if (lastSync.value) {
    draft.setEmotions({
      emotionsCurated: lastSync.value.emotionsCurated,
      expressionMappings: lastSync.value.expressionMappings,
      actingModelExpressionPrompt: lastSync.value.actingModelExpressionPrompt,
      cueAllowlist: lastSync.value.cueAllowlist,
      compiledWhitelist: lastSync.value.compiledWhitelist,
    })
  }
})

function handleContinue() {
  if (lastSync.value) {
    draft.setEmotions({
      emotionsCurated: lastSync.value.emotionsCurated,
      expressionMappings: lastSync.value.expressionMappings,
      actingModelExpressionPrompt: lastSync.value.actingModelExpressionPrompt,
      cueAllowlist: lastSync.value.cueAllowlist,
      compiledWhitelist: lastSync.value.compiledWhitelist,
    })
  }
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col gap-3.5 py-2 my-auto animate-fadeIn select-none']">
    <!-- Top Header -->
    <div>
      <div :class="['flex items-center gap-2 text-xs text-neutral-400 mb-0.5']">
        <span :class="['text-primary-500 dark:text-primary-400 font-medium']">{{ t('onboarding.steps.emotions.label') }}</span>
        <span>• {{ t('onboarding.steps.emotions.subtitle') }}</span>
      </div>
      <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        {{ t('onboarding.steps.emotions.title') }}
      </h2>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
        {{ t('onboarding.steps.emotions.description') }}
      </p>
    </div>

    <EmotionCalibrationStudio
      :model-id="activeModelId"
      :initial-mappings="draft.state.expressionMappings"
      :initial-directives="draft.state.actingModelExpressionPrompt"
      :initial-calibrated="draft.state.emotionsCurated"
      :companion-name="characterPersona.name"
      :persona-personality="characterPersona.personality"
      :persona-description="characterPersona.description"
      :persona-scenario="characterPersona.scenario"
      :persona-system-prompt="characterPersona.systemPrompt"
      finish-context="onboarding"
      stage-update-reason="onboarding-v3-emotions"
      @sync="handleStudioSync"
      @finish="handleContinue"
    />

    <!-- Bottom Navigation Bar -->
    <div :class="['flex items-center justify-between pt-2.5 border-t border-neutral-200/60 dark:border-white/5 shrink-0']">
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        {{ t('onboarding.shell.previous') }}
      </button>

      <div :class="['text-[11px] text-neutral-400 hidden sm:block']">
        {{ t('onboarding.ui.changes-automatically-saved-to-companion-draft') }}
      </div>

      <div :class="['flex items-center gap-2.5']">
        <button
          type="button"
          :class="['px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
          @click="props.onNext"
        >
          {{ t('onboarding.shell.skip') }}
        </button>

        <button
          type="button"
          :class="['px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer flex items-center gap-2']"
          @click="handleContinue"
        >
          <span>{{ t('onboarding.shell.next') }}</span>
          <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
        </button>
      </div>
    </div>
  </div>
</template>
