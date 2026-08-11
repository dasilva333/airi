<script setup lang="ts">
import type { OnboardingStepNextHandler } from './types'

import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

import onboardingLogo from '../../../../assets/onboarding.avif'

import { useOnboardingStore } from '../../../../stores/onboarding'

interface Props {
  onNext: OnboardingStepNextHandler
  onSkip?: () => void
}

const props = defineProps<Props>()
const { t } = useI18n()
const onboardingStore = useOnboardingStore()

function handleSkip() {
  onboardingStore.markSetupSkipped()
  props.onSkip?.()
}
</script>

<template>
  <div class="h-full flex flex-col font-sans">
    <div class="mb-2 flex flex-1 flex-col items-center justify-center text-center md:mb-8">
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.8 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="600"
        class="relative mb-6 flex justify-center"
      >
        <div class="absolute inset-0 scale-120 transform rounded-full bg-primary-500/10 blur-2xl dark:bg-primary-400/15" />
        <img :src="onboardingLogo" class="relative z-10 h-auto max-h-[160px] w-auto object-contain drop-shadow-lg filter md:max-h-[200px]">
      </div>

      <h2
        v-motion
        :initial="{ opacity: 0, y: 15 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        class="mb-2 from-neutral-900 to-neutral-700 bg-gradient-to-r bg-clip-text text-3xl text-neutral-900 font-extrabold tracking-tight dark:from-white dark:to-neutral-300 md:text-4xl dark:text-neutral-50"
      >
        {{ t('settings.dialogs.onboarding.title') }}
      </h2>

      <p
        v-motion
        :initial="{ opacity: 0, y: 15 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="100"
        class="max-w-sm text-sm text-neutral-500 leading-relaxed md:text-base dark:text-neutral-400"
      >
        {{ t('settings.dialogs.onboarding.description') }}
      </p>
    </div>

    <div class="flex flex-row items-center justify-center gap-3">
      <Button
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="200"
        class="border-none from-primary-500 to-indigo-600 bg-gradient-to-r text-white shadow-lg shadow-primary-500/10 hover:from-primary-600 hover:to-indigo-700"
        :label="t('settings.dialogs.onboarding.start')"
        @click="props.onNext"
      />
      <Button
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="250"
        variant="ghost"
        class="text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        :label="t('settings.dialogs.onboarding.skipPermanently')"
        @click="handleSkip"
      />
    </div>
  </div>
</template>
