<script setup lang="ts">
import type { CognitionProcessorId } from '@proj-airi/stage-ui/stores/nan0-config'

import { NAN0_PROCESSOR_ID } from '@proj-airi/stage-ui/stores/nan0-config'
import { Select } from '@proj-airi/ui/components/form'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  consciousnessProviderOptions: { value: string, label: string }[]
  consciousnessModelOptions: { value: string, label: string }[]
  firstHopModelOptions: { value: string, label: string }[]
  defaultConsciousnessModelPlaceholder: string
  defaultFirstHopModelPlaceholder: string
  consciousnessProviderActive: boolean
  firstHopProviderActive: boolean
}>()

const cognitivePipelineEnabled = defineModel<boolean>('cognitivePipelineEnabled', { required: true })
const firstHopProcessor = defineModel<CognitionProcessorId>('firstHopProcessor', { required: true })
const selectedFirstHopProvider = defineModel<string>('selectedFirstHopProvider', { required: true })
const selectedFirstHopModel = defineModel<string>('selectedFirstHopModel', { required: true })
const selectedConsciousnessProvider = defineModel<string>('selectedConsciousnessProvider', { required: true })
const selectedConsciousnessModel = defineModel<string>('selectedConsciousnessModel', { required: true })

const { t } = useI18n()
const processorOptions = computed(() => [
  { value: 'none', label: t('settings.pages.card.creation.cognition.processor.none') },
  { value: NAN0_PROCESSOR_ID, label: t('settings.pages.card.creation.cognition.processor.nan0') },
])
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <p class="mb-5 text-sm text-neutral-500 dark:text-neutral-400">
      {{ t('settings.pages.card.creation.cognition.description') }}
    </p>

    <div class="ml-auto mr-auto w-90% flex flex-col gap-6">
      <div class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
        <div class="flex flex-col select-none gap-1">
          <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">
            {{ t('settings.pages.card.creation.cognition.enabled.label') }}
          </span>
          <span class="text-[10px] text-neutral-500 leading-normal dark:text-neutral-400">
            {{ t('settings.pages.card.creation.cognition.enabled.description') }}
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

      <div
        :class="[
          'flex flex-col gap-5 transition-opacity duration-200',
          !cognitivePipelineEnabled && 'pointer-events-none opacity-40',
        ]"
      >
        <div class="flex flex-col gap-2">
          <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <div class="i-lucide:cpu" />
            {{ t('settings.pages.card.creation.cognition.processor.label') }}
          </label>
          <Select
            v-model="firstHopProcessor"
            :options="processorOptions"
            class="w-full"
          />
          <p class="text-[10px] text-neutral-500 italic dark:text-neutral-400">
            {{ t('settings.pages.card.creation.cognition.processor.description') }}
          </p>
        </div>

        <div
          v-if="firstHopProcessor === NAN0_PROCESSOR_ID"
          class="border border-primary-200 rounded-xl bg-primary-50/60 p-4 text-xs text-primary-900 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-100"
        >
          <div class="mb-1 flex items-center gap-2 font-semibold">
            <div class="i-lucide:brain-circuit" />
            {{ t('settings.pages.card.creation.cognition.nan0.title') }}
          </div>
          <p class="leading-relaxed">
            {{ t('settings.pages.card.creation.cognition.nan0.description') }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <div class="i-lucide:brain" />
              {{ t('settings.pages.card.creation.cognition.first_provider') }}
            </label>
            <Select
              v-model="selectedFirstHopProvider"
              :options="consciousnessProviderOptions"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <div class="i-lucide:ghost" />
              {{ t('settings.pages.card.creation.cognition.first_model') }}
            </label>
            <Select
              v-if="firstHopModelOptions.length > 0"
              v-model="selectedFirstHopModel"
              :options="firstHopModelOptions"
              :placeholder="defaultFirstHopModelPlaceholder"
              :disabled="!selectedFirstHopProvider && !firstHopProviderActive"
              class="w-full"
            />
            <input
              v-else
              v-model="selectedFirstHopModel"
              type="text"
              :disabled="!selectedFirstHopProvider && !firstHopProviderActive"
              class="w-full border border-neutral-200 rounded-lg border-solid bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-800 shadow-sm outline-none dark:border-neutral-800 focus:border-primary-300 dark:bg-neutral-950 focus:bg-neutral-50 dark:text-neutral-200 dark:focus:border-primary-400/50 dark:focus:bg-neutral-900"
              :placeholder="t('settings.pages.card.creation.cognition.model_placeholder')"
            >
          </div>

          <div class="flex flex-col gap-2">
            <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <div class="i-lucide:messages-square" />
              {{ t('settings.pages.card.creation.cognition.second_provider') }}
            </label>
            <Select
              v-model="selectedConsciousnessProvider"
              :options="consciousnessProviderOptions"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="flex flex-row items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <div class="i-lucide:message-square" />
              {{ t('settings.pages.card.creation.cognition.second_model') }}
            </label>
            <Select
              v-model="selectedConsciousnessModel"
              :options="consciousnessModelOptions"
              :placeholder="defaultConsciousnessModelPlaceholder"
              :disabled="!selectedConsciousnessProvider && !consciousnessProviderActive"
              class="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
