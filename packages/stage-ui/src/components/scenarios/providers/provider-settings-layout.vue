<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  providerName?: string
  providerDescription?: string
  providerIcon?: string
  providerIconColor?: string
  providerIconImage?: string
  deployment?: 'local' | 'cloud'
  pricing?: 'free' | 'paid'
  beginnerRecommended?: boolean
  consoleUrl?: string
  onBack?: () => void
}>()

const { t } = useI18n()
</script>

<template>
  <div flex="~ col gap-4">
    <!-- Rich Provider Hero Header -->
    <div
      flex="~ col gap-3"
      class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/60"
    >
      <div flex="~ row items-center justify-between gap-4" wrap>
        <div flex="~ row items-center gap-3.5" min-w-0 flex-1>
          <!-- Provider Icon -->
          <div
            flex items-center justify-center shrink-0 rounded-xl p-2.5
            class="bg-neutral-100 dark:bg-neutral-800/80"
          >
            <img
              v-if="providerIconImage"
              :src="providerIconImage"
              :alt="providerName"
              class="h-8 w-8 object-contain"
            >
            <div
              v-else
              :class="[providerIcon || 'i-solar:box-minimalistic-bold-duotone', providerIconColor || 'text-primary-500']"
              class="text-3xl"
            />
          </div>

          <div flex="~ col gap-1" min-w-0 flex-1>
            <div flex="~ row items-center gap-2 wrap">
              <h1 class="text-xl text-neutral-800 font-bold dark:text-neutral-100">
                {{ providerName || 'Provider Settings' }}
              </h1>

              <!-- Badges -->
              <span
                v-if="deployment"
                class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                :class="deployment === 'local' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'"
              >
                {{ deployment }}
              </span>

              <span
                v-if="pricing"
                class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                :class="pricing === 'free' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'"
              >
                {{ pricing }}
              </span>

              <span
                v-if="beginnerRecommended"
                class="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] text-primary-600 font-bold tracking-wider uppercase dark:text-primary-300"
              >
                Suggested
              </span>
            </div>

            <!-- Description -->
            <p v-if="providerDescription" class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              {{ providerDescription }}
            </p>
          </div>
        </div>

        <!-- Get API Key Console Action -->
        <a
          v-if="consoleUrl"
          :href="consoleUrl"
          target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-xl bg-primary-500/10 px-3.5 py-2 text-xs text-primary-600 font-semibold transition-colors dark:bg-primary-500/20 hover:bg-primary-500/20 dark:text-primary-300 dark:hover:bg-primary-500/30"
        >
          <span>{{ t('settings.pages.providers.common.getApiKey') || 'Get API Key' }}</span>
          <div class="i-solar:arrow-right-up-bold-duotone shrink-0 text-sm" />
        </a>
      </div>
    </div>

    <!-- Main Provider Form Container -->
    <slot />
  </div>

  <!-- Background Watermark Icon -->
  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
    size-60
  >
    <div text="60" :class="providerIcon || providerIconColor || 'i-solar:box-minimalistic-bold-duotone'" />
  </div>
</template>
