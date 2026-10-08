<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  onNext: () => void
  onQuickStart?: () => void
  onSkip?: () => void
}>()

const { t } = useI18n()

const showSkipConfirmation = ref(false)

const featurePills = computed(() => [
  {
    icon: 'i-solar:cpu-bolt-bold-duotone',
    label: t('onboarding.steps.welcome.pills.webgpu'),
    iconColor: 'text-[#0086AD] dark:text-cyan-400',
  },
  {
    icon: 'i-solar:shield-check-bold-duotone',
    label: t('onboarding.steps.welcome.pills.offline'),
    iconColor: 'text-[#10B981] dark:text-emerald-400',
  },
  {
    icon: 'i-solar:magic-stick-3-bold-duotone',
    label: t('onboarding.steps.welcome.pills.souls'),
    iconColor: 'text-[#8B5CF6] dark:text-purple-400',
  },
])

function confirmCloseToTray() {
  showSkipConfirmation.value = false
  props.onSkip?.()
}
</script>

<template>
  <div :class="['w-full max-w-[720px] flex flex-col items-center justify-center select-none py-4 text-center']">
    <!-- Top Header Brand Icon Tile (104px x 104px, radius 26px) -->
    <div
      v-motion
      :initial="{ opacity: 0, scale: 0.9 }"
      :enter="{ opacity: 1, scale: 1 }"
      :duration="400"
      :class="['relative']"
    >
      <div
        :class="[
          'w-[104px] h-[104px] rounded-[26px] flex items-center justify-center border border-[#BAE6FD]/80 dark:border-cyan-400/20',
          'bg-gradient-to-br from-[#E0F2FE]/80 via-[#F0F9FF]/60 to-[#F3E8FF]/60 dark:from-cyan-950/40 dark:via-sky-950/20 dark:to-indigo-950/30 shadow-md shadow-sky-500/5',
        ]"
      >
        <div :class="['i-solar:magic-stick-3-bold-duotone h-12 w-12 text-[#0086AD] dark:text-cyan-400']" />
      </div>
    </div>

    <!-- Title & Subtitle (Hero Tile -> Heading = 24px, Heading -> Subtitle = 12px) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="100"
      :class="['text-center mt-6']"
    >
      <h1 :class="['text-[40px] font-bold leading-[1.15] text-[#142333] dark:text-white tracking-tight']">
        {{ t('onboarding.steps.welcome.heroTitle') }}
      </h1>
      <p :class="['mt-3 text-[20px] font-medium leading-[1.4] text-[#50657D] dark:text-neutral-400']">
        {{ t('onboarding.steps.welcome.heroSubtitle') }}
      </p>
    </div>

    <!-- Companion Greeting Card (Subtitle -> Card = 28px) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="200"
      :class="[
        'w-full max-w-[720px] mt-7 flex items-center text-left px-7 py-6 rounded-[20px]',
        'bg-white dark:bg-neutral-900/80 border border-[#D8E6EF] dark:border-white/10 shadow-[0_10px_24px_rgba(37,76,108,0.07)]',
      ]"
    >
      <!-- Companion Avatar Badge -->
      <div
        :class="[
          'h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full',
          'bg-[#EDF2F6] dark:bg-cyan-950/50 border border-[#D8E6EF] dark:border-cyan-800/40 text-[#0086AD] dark:text-cyan-400 shadow-xs',
        ]"
      >
        <div :class="['i-solar:emoji-funny-circle-bold h-7 w-7']" />
      </div>

      <!-- Vertical Divider -->
      <div :class="['h-10 w-px bg-[#D8E6EF] dark:bg-white/10 mx-5 shrink-0']" />

      <!-- Greeting Text (18px, weight 400, line-height 1.55, #30465C) -->
      <div :class="['text-[18px] font-normal leading-[1.55] text-[#30465C] dark:text-neutral-200']">
        {{ t('onboarding.steps.welcome.companionQuote') }}
      </div>
    </div>

    <!-- Feature Chips (Card -> Chips = 24px, Space between chips = 12px) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="300"
      :class="['mt-6 flex flex-wrap items-center justify-center gap-3 w-full']"
    >
      <div
        v-for="pill in featurePills"
        :key="pill.label"
        :class="[
          'h-[42px] px-5 rounded-full flex items-center gap-2 whitespace-nowrap transition-colors',
          'bg-[#EDF2F6] dark:bg-white/5 border border-[#D8E6EF]/70 dark:border-white/10 text-[#30465C] dark:text-neutral-200',
        ]"
      >
        <div :class="[pill.icon, pill.iconColor, 'h-[19px] w-[19px] shrink-0']" />
        <span :class="['text-[14px] font-semibold tracking-normal']">{{ pill.label }}</span>
      </div>
    </div>

    <!-- Action Buttons (Chips -> Buttons = 32px) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="400"
      :class="['mt-8 flex flex-col items-center w-full max-w-[480px]']"
    >
      <div :class="['flex items-center justify-center gap-[14px] w-full']">
        <!-- Quick Start (Primary Button, #007FA3, height 54px, radius 14px) -->
        <button
          v-if="props.onQuickStart"
          type="button"
          :class="[
            'flex-1 h-[54px] rounded-[14px] px-7 text-[16px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer',
            'bg-[#007FA3] hover:bg-[#006F8F] text-white shadow-md shadow-[#007FA3]/20 active:scale-[0.98]',
          ]"
          @click="props.onQuickStart"
        >
          <div :class="['i-solar:bolt-bold text-white h-4.5 w-4.5']" />
          <span>Quick start</span>
          <span :class="['font-normal opacity-85 text-[14px] ml-1']">≈ 1 min</span>
        </button>

        <!-- Guided Setup (Secondary Button, outline #007FA3, height 54px, radius 14px) -->
        <button
          type="button"
          :class="[
            'flex-1 h-[54px] rounded-[14px] px-7 text-[16px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer',
            'border-2 border-[#007FA3] text-[#007FA3] dark:text-cyan-400 dark:border-cyan-400 bg-white dark:bg-white/5 hover:bg-[#007FA3]/5 active:scale-[0.98]',
          ]"
          @click="props.onNext"
        >
          <span>{{ t('onboarding.steps.welcome.actions.guidedSetup') }}</span>
          <div :class="['i-solar:alt-arrow-right-line-duotone h-4.5 w-4.5']" />
        </button>
      </div>

      <!-- Set up later (Buttons -> Link = 20px, 15px, muted slate, underlined) -->
      <button
        type="button"
        :class="['mt-5 text-[15px] font-normal text-[#50657D] hover:text-[#142333] dark:text-neutral-400 dark:hover:text-white underline underline-offset-4 cursor-pointer transition-colors']"
        @click="showSkipConfirmation = true"
      >
        {{ t('onboarding.steps.welcome.actions.setupLater') }}
      </button>
    </div>

    <!-- Skip Later Confirmation Modal Dialog -->
    <div
      v-if="showSkipConfirmation"
      :class="['fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn']"
    >
      <div :class="['relative max-w-sm w-full rounded-2xl border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#10101c] p-6 text-center shadow-2xl space-y-4']">
        <div :class="['mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-500/30 bg-primary-950/20 text-primary-400 shadow-inner']">
          <div :class="['i-solar:tray-bold-duotone h-8 w-8']" />
        </div>

        <div>
          <h3 :class="['text-base font-bold text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.welcome.dialog.savedTitle') }}
          </h3>
          <p :class="['mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed']">
            {{ t('onboarding.steps.welcome.dialog.savedDescription') }}
          </p>
          <div :class="['mt-3 rounded-xl border border-primary-500/30 bg-primary-500/10 dark:bg-primary-950/30 px-3.5 py-2 text-xs font-semibold text-primary-600 dark:text-primary-300 flex items-center justify-center gap-2']">
            <div :class="['i-solar:cursor-square-bold-duotone h-4 w-4']" />
            <span>{{ t('onboarding.steps.welcome.dialog.trayItem') }}</span>
          </div>
        </div>

        <div :class="['flex items-center gap-3 pt-2']">
          <button
            type="button"
            :class="['flex-1 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-4 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors cursor-pointer']"
            @click="showSkipConfirmation = false"
          >
            {{ t('onboarding.steps.welcome.dialog.continue') }}
          </button>
          <button
            type="button"
            :class="['flex-1 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-500 transition-colors shadow-md shadow-primary-600/30 cursor-pointer']"
            @click="confirmCloseToTray"
          >
            {{ t('onboarding.steps.welcome.dialog.closeToTray') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
