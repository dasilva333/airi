<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  tabName?: string
  tabIcon?: string
  error?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'retry'): void
}>()

const { t } = useI18n()

const loadingTitle = computed(() => {
  if (props.tabName) {
    return t('settings.pages.card.loading_tab', { tab: props.tabName }, `Loading ${props.tabName}...`)
  }
  return t('settings.pages.card.loading_tab', { tab: 'settings' }, 'Loading settings...')
})

const errorTitle = computed(() => {
  if (props.tabName) {
    return t('settings.pages.card.loading_tab_failed', { tab: props.tabName }, `Failed to load ${props.tabName}`)
  }
  return t('settings.pages.card.loading_tab_failed', { tab: 'tab' }, 'Failed to load tab')
})
</script>

<template>
  <div class="w-full flex flex-col items-center justify-center px-4 py-12 transition-all">
    <!-- Error State -->
    <div
      v-if="error"
      class="max-w-md w-full flex flex-col items-center border border-red-200 rounded-2xl bg-red-50/60 p-6 text-center shadow-sm dark:border-red-900/40 dark:bg-red-950/20"
    >
      <div class="i-solar:danger-triangle-bold-duotone mb-2 text-3xl text-red-500" />
      <h3 class="mb-1 text-sm text-red-900 font-semibold dark:text-red-200">
        {{ errorTitle }}
      </h3>
      <p class="mb-4 break-words text-xs text-red-600 dark:text-red-400">
        {{ error }}
      </p>
      <Button
        variant="secondary"
        icon="i-solar:restart-bold"
        :label="t('settings.retry', 'Retry')"
        size="sm"
        @click="emit('retry')"
      />
    </div>

    <!-- Inline Loading State -->
    <div
      v-else
      class="max-w-md w-full flex flex-col items-center text-center"
    >
      <!-- Central Animated Spinner with Tab Icon -->
      <div class="relative mb-4 size-14 flex items-center justify-center">
        <!-- Spinning Outer Ring -->
        <div class="size-full animate-spin border-3 border-primary-500/20 border-t-primary-500 rounded-full" />
        <!-- Centered Tab Icon -->
        <div
          v-if="tabIcon"
          :class="[tabIcon, 'absolute text-xl text-primary-500 dark:text-primary-400']"
        />
        <div
          v-else
          class="i-solar:settings-minimalistic-bold-duotone absolute text-xl text-primary-500 dark:text-primary-400"
        />
      </div>

      <!-- Tab Title and Status Message -->
      <h3 class="mb-1 text-sm text-neutral-800 font-medium dark:text-neutral-200">
        {{ loadingTitle }}
      </h3>
      <p class="mb-6 text-xs text-neutral-400 dark:text-neutral-500">
        {{ t('settings.pages.card.loading_tab_subtitle', 'Preparing configuration fields and options') }}
      </p>

      <!-- Inline Shimmer Placeholder Skeletons -->
      <div class="w-full flex flex-col gap-3.5 border border-neutral-200/60 rounded-xl bg-neutral-100/40 p-4 dark:border-neutral-800/60 dark:bg-neutral-900/30">
        <div class="flex items-center gap-2">
          <div class="size-3.5 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div class="h-3 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div class="h-9 w-full animate-pulse rounded-lg bg-neutral-200/70 dark:bg-neutral-800/70" />
        <div class="mt-1 flex items-center gap-2">
          <div class="size-3.5 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div class="h-3 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div class="h-9 w-full animate-pulse rounded-lg bg-neutral-200/70 dark:bg-neutral-800/70" />
      </div>
    </div>
  </div>
</template>
