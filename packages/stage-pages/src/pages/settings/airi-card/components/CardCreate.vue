<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <!-- Style from ui/InputFile component, may be centralized later -->
  <div
    :class="[
      'relative flex flex-col cursor-pointer items-center justify-center p-6 rounded-xl border-2 border-solid transition-all duration-300 opacity-95',
      'border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/30',
      'hover:border-primary-300 dark:hover:border-primary-700 hover:bg-white/80 dark:hover:bg-neutral-900/40 hover:scale-100 hover:opacity-100 hover:shadow-md dark:hover:shadow-lg',
    ]"
  >
    <div
      i-solar:add-square-line-duotone
      :class="['mb-4 text-5xl text-neutral-400 dark:text-neutral-500']"
    />
    <p :class="['font-medium text-neutral-600 dark:text-neutral-300']">
      {{ t('settings.pages.card.create_card') }}
    </p>
  </div>
</template>
