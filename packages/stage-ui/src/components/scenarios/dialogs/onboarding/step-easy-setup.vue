<script setup lang="ts">
import { Button, Input } from '@proj-airi/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

const props = defineProps<{
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}>()

const { t } = useI18n()

// OpenRouter State
const openRouterKey = ref('')

// Deepgram State
const senseKey = ref('')

function handleNext() {
  props.onNext({
    deepgram: senseKey.value.trim(),
    openrouter: openRouterKey.value.trim(),
  })
}

const canGoNext = computed(() => {
  return !!openRouterKey.value.trim() && !!senseKey.value.trim()
})
</script>

<template>
  <div h-full flex flex-col gap-6>
    <!-- Header -->
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
        {{ t('settings.dialogs.onboarding.senseSetup.title') }}
      </h2>
      <div class="h-5 w-5" />
    </div>

    <p
      v-motion
      :initial="{ opacity: 0 }"
      :enter="{ opacity: 1 }"
      :duration="500"
      :delay="100"
      class="text-sm text-neutral-500 dark:text-neutral-400"
    >
      {{ t('settings.dialogs.onboarding.senseSetup.description') }}
    </p>

    <!-- Sense Sections -->
    <div class="flex flex-1 flex-col gap-8 overflow-y-auto px-1 py-2">
      <!-- Consciousness Section -->
      <section
        v-motion
        :initial="{ opacity: 0, x: -20 }"
        :enter="{ opacity: 1, x: 0 }"
        :duration="500"
        :delay="200"
        class="flex flex-col gap-3"
      >
        <div flex items-center gap-2>
          <div class="i-solar:plain-bold-duotone h-6 w-6 text-primary-500" />
          <h3 class="text-lg text-neutral-700 font-medium dark:text-neutral-200">
            {{ t('settings.dialogs.onboarding.senseSetup.consciousness') }}
          </h3>
        </div>
        <div class="border border-neutral-100 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div flex flex-col gap-1>
                <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">OpenRouter (Free)</span>
                <span class="max-w-md text-xs text-neutral-500 line-height-relaxed">
                  {{ t('settings.dialogs.onboarding.senseSetup.openRouterSubtext') }}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                class="shrink-0"
                as="a"
                href="https://openrouter.ai/keys"
                target="_blank"
              >
                <template #icon>
                  <div class="i-simple-icons:openrouter h-4 w-4" />
                </template>
                {{ t('settings.dialogs.onboarding.senseSetup.getOpenRouterKey') }}
              </Button>
            </div>

            <!-- Key Input -->
            <div flex flex-col gap-2>
              <label class="text-[10px] text-neutral-400 font-semibold tracking-widest uppercase">
                {{ t('settings.dialogs.onboarding.apiKey') }}
              </label>
              <Input
                v-model="openRouterKey"
                type="password"
                placeholder="sk-or-..."
                variant="primary-dimmed"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Speech & Hearing Section -->
      <section
        v-motion
        :initial="{ opacity: 0, x: -20 }"
        :enter="{ opacity: 1, x: 0 }"
        :duration="500"
        :delay="300"
        class="flex flex-col gap-3"
      >
        <div flex items-center gap-2>
          <div class="i-solar:soundwave-bold-duotone h-6 w-6 text-primary-500" />
          <h3 class="text-lg text-neutral-700 font-medium dark:text-neutral-200">
            {{ t('settings.dialogs.onboarding.senseSetup.speech') }}
          </h3>
        </div>
        <div class="border border-neutral-100 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div flex flex-col gap-5>
            <!-- Deepgram Action Row -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div flex flex-col gap-1>
                <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">Deepgram</span>
                <span class="max-w-md text-xs text-neutral-500 line-height-relaxed">
                  {{ t('settings.dialogs.onboarding.senseSetup.deepgramSubtext') }}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                class="shrink-0"
                as="a"
                href="https://console.deepgram.com/"
                target="_blank"
              >
                <template #icon>
                  <div class="i-simple-icons:deepgram h-4 w-4" />
                </template>
                {{ t('settings.dialogs.onboarding.senseSetup.getDeepgramKey') }}
              </Button>
            </div>

            <!-- Key Input -->
            <div flex flex-col gap-2>
              <label class="text-[10px] text-neutral-400 font-semibold tracking-widest uppercase">
                {{ t('settings.dialogs.onboarding.senseSetup.senseKey') }}
              </label>
              <Input
                v-model="senseKey"
                type="password"
                placeholder="dg_..."
                variant="primary-dimmed"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Footer Action -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="400"
    >
      <Button
        block
        :disabled="!canGoNext"
        :label="t('settings.dialogs.onboarding.next')"
        @click="handleNext"
      />
    </div>
  </div>
</template>
