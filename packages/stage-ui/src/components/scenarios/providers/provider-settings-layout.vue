<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  providerName: string
  providerIcon?: string
  providerIconColor?: string
  onBack?: () => void
  consoleUrl?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div flex="~ col gap-3">
    <div flex="~ row" items-center justify-between gap-4>
      <div min-w-0 flex-1>
        <h1 class="text-xl text-neutral-800 font-semibold dark:text-neutral-200">
          {{ providerName }}
        </h1>
        <a
          v-if="consoleUrl"
          :href="consoleUrl"
          target="_blank" rel="noopener noreferrer"
          class="mt-1 inline-flex items-center gap-1 text-xs text-primary-500 dark:text-primary-400 hover:underline"
        >
          {{ t('settings.pages.providers.common.getApiKey') }}
          <div class="i-solar:arrow-right-up-bold-duotone shrink-0 text-sm" />
        </a>
      </div>
    </div>
    <slot />
  </div>
  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
    size-60
  >
    <div text="60" :class="providerIcon || providerIconColor" />
  </div>
</template>
