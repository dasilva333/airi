<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RadioCardDetail from '../../../menu/radio-card-detail.vue'
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

interface Props {
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
  // We'll pass back the selection to the parent
  onSelectMode?: (mode: 'easy' | 'custom') => void
}

const props = defineProps<Props>()
const { t } = useI18n()
const selectedMode = ref<'easy' | 'custom'>('easy')

function handleNext() {
  if (props.onSelectMode) {
    props.onSelectMode(selectedMode.value)
  }
  // Standard next call
  props.onNext()
}
</script>

<template>
  <div h-full flex flex-col gap-6>
    <!-- Header with Back Button -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      flex items-center gap-2
    >
      <button outline-none @click="props.onPrevious">
        <div class="i-solar:alt-arrow-left-line-duotone h-5 w-5 transition-colors hover:text-primary-500" />
      </button>
      <h2 class="flex-1 text-center text-xl text-neutral-800 font-semibold md:text-left md:text-2xl dark:text-neutral-100">
        {{ t('settings.dialogs.onboarding.modeSelection.title') }}
      </h2>
      <div class="h-5 w-5" />
    </div>

    <!-- Mode Selection Cards -->
    <div class="flex-1 overflow-y-auto px-1">
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="100"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div relative @click="selectedMode = 'easy'">
          <div pointer-events-none absolute right-4 top-4 z-10>
            <div class="i-solar:magic-stick-3-bold-duotone h-6 w-6 text-primary-500 opacity-50" />
          </div>
          <RadioCardDetail
            id="easy"
            v-model="selectedMode"
            name="onboarding-mode"
            value="easy"
            :title="t('settings.dialogs.onboarding.modeSelection.easy.title')"
            :description="t('settings.dialogs.onboarding.modeSelection.easy.description')"
            beginner-recommended
          />
        </div>

        <div relative @click="selectedMode = 'custom'">
          <div pointer-events-none absolute right-4 top-4 z-10>
            <div class="i-solar:settings-bold-duotone h-6 w-6 text-neutral-500 opacity-50" />
          </div>
          <RadioCardDetail
            id="custom"
            v-model="selectedMode"
            name="onboarding-mode"
            value="custom"
            :title="t('settings.dialogs.onboarding.modeSelection.custom.title')"
            :description="t('settings.dialogs.onboarding.modeSelection.custom.description')"
          />
        </div>
      </div>

      <p
        v-motion
        :initial="{ opacity: 0 }"
        :enter="{ opacity: 1 }"
        :duration="500"
        :delay="300"
        class="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400"
      >
        {{ t('settings.dialogs.onboarding.modeSelection.description') }}
      </p>
    </div>

    <!-- Footer Action -->
    <Button
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="400"
      :label="t('settings.dialogs.onboarding.next')"
      @click="handleNext"
    />
  </div>
</template>
