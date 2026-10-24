<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useOnboardingStore } from '../../../stores/onboarding'

// Responsive setup nudge: stacked ≤568px, sidekick 569–767px, 3-column ≥768px.
// Pure CSS bands (arbitrary variants) — no JS breakpoint gate, so it renders
// sensibly in every shell that hosts a composer.
const consciousnessStore = useConsciousnessStore()
const { configured: isChatConfigured } = storeToRefs(consciousnessStore)
const onboardingStore = useOnboardingStore()

let router: ReturnType<typeof useRouter> | undefined
try {
  router = useRouter()
}
catch {
  // router might not be installed in all contexts
}

function openSetupWizard() {
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
}

function openProviderSettings() {
  router?.push('/settings/providers/chat').catch(() => {})
}

function openFreeAi() {
  router?.push({ path: '/settings', query: { freeAi: 'open' } }).catch(() => {})
}
</script>

<template>
  <div
    v-if="!isChatConfigured"
    :class="[
      'pointer-events-auto w-full overflow-hidden rounded-3xl border',
      'border-amber-300/70 dark:border-amber-500/30',
      'bg-amber-50/95 dark:bg-neutral-900/95',
      'shadow-xl shadow-black/10 backdrop-blur-xl',
    ]"
  >
    <div
      :class="[
        'grid gap-2 p-3',
        'grid-cols-2',
        'min-[569px]:grid-cols-[1.1fr_1fr]',
        'min-[768px]:grid-cols-3',
      ]"
    >
      <!-- Header: title row (stacked) / left rail (sidekick) / full head (3-col) -->
      <div
        :class="[
          'flex items-center gap-2.5 px-1',
          'col-span-2',
          'min-[569px]:col-span-1 min-[569px]:row-span-3 min-[569px]:flex-col min-[569px]:items-start min-[569px]:justify-center min-[569px]:gap-1.5',
          'min-[768px]:col-span-3 min-[768px]:row-span-1 min-[768px]:flex-row min-[768px]:items-center',
        ]"
      >
        <div
          :class="[
            'size-9 flex shrink-0 items-center justify-center rounded-full',
            'bg-amber-500/15 text-amber-500 dark:text-amber-400',
          ]"
        >
          <div class="i-solar:cpu-bolt-bold-duotone size-5" />
        </div>
        <div class="min-w-0">
          <div class="truncate text-[17px] text-neutral-900 font-bold leading-tight dark:text-neutral-50">
            Let&rsquo;s get you connected
          </div>
          <div class="text-[13px] text-neutral-500 leading-snug hidden min-[569px]:block dark:text-neutral-400">
            Choose how you&rsquo;d like to set up your companion.
          </div>
        </div>
      </div>

      <!-- Setup Wizard hero -->
      <button
        type="button"
        title="Guided companion setup"
        :class="[
          'w-full flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99]',
          'bg-cyan-500 text-white shadow-md shadow-cyan-500/25 hover:bg-cyan-400',
          'col-span-2',
          'min-[569px]:col-span-1',
        ]"
        @click="openSetupWizard"
      >
        <div class="size-11 flex shrink-0 items-center justify-center rounded-full bg-cyan-700/40 min-[768px]:hidden">
          <div class="i-solar:magic-stick-3-bold-duotone size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[15px] font-bold leading-tight min-[768px]:whitespace-normal">
            Setup Wizard
          </div>
          <div class="truncate text-[13px] text-white/80 leading-snug min-[768px]:hidden">
            Guided companion setup
          </div>
          <div class="text-[13px] text-white/80 leading-snug hidden min-[768px]:block">
            Guided setup for your whole companion.
          </div>
        </div>
        <div class="i-solar:alt-arrow-right-linear size-5 shrink-0 opacity-80" />
      </button>

      <!-- AI providers -->
      <button
        type="button"
        title="Choose and configure a chat provider"
        :class="[
          'w-full flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99]',
          'border-neutral-200/80 bg-white/80 hover:bg-white dark:border-neutral-700/60 dark:bg-white/5 dark:hover:bg-white/10',
          'col-span-1',
        ]"
        @click="openProviderSettings"
      >
        <div
          :class="[
            'size-10 flex shrink-0 items-center justify-center rounded-full',
            'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
            'min-[768px]:hidden',
          ]"
        >
          <div class="i-solar:server-square-bold-duotone size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[15px] text-neutral-900 font-bold leading-tight dark:text-neutral-50 min-[768px]:hidden">
            Directory
          </div>
          <div class="truncate text-[15px] text-neutral-900 font-bold leading-tight hidden min-[768px]:block min-[768px]:whitespace-normal dark:text-neutral-50">
            Browse AI providers
          </div>
          <div class="truncate text-[13px] text-neutral-500 leading-snug hidden min-[569px]:block dark:text-neutral-400 min-[768px]:hidden">
            Chat LLM directory
          </div>
          <div class="text-[13px] text-neutral-500 leading-snug hidden min-[768px]:block dark:text-neutral-400">
            Choose and configure a chat provider.
          </div>
        </div>
        <div class="i-solar:alt-arrow-right-linear size-4 shrink-0 text-neutral-400" />
      </button>

      <!-- Free AI -->
      <button
        type="button"
        title="Find on-device models and free cloud options"
        :class="[
          'w-full flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99]',
          'border-neutral-200/80 bg-white/80 hover:bg-white dark:border-neutral-700/60 dark:bg-white/5 dark:hover:bg-white/10',
          'col-span-1',
        ]"
        @click="openFreeAi"
      >
        <div
          :class="[
            'size-10 flex shrink-0 items-center justify-center rounded-full',
            'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
            'min-[768px]:hidden',
          ]"
        >
          <div class="i-solar:stars-line-bold-duotone size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[15px] text-neutral-900 font-bold leading-tight dark:text-neutral-50 min-[768px]:hidden">
            Free AI
          </div>
          <div class="truncate text-[15px] text-neutral-900 font-bold leading-tight hidden min-[768px]:block min-[768px]:whitespace-normal dark:text-neutral-50">
            Explore Free AI
          </div>
          <div class="truncate text-[13px] text-neutral-500 leading-snug hidden min-[569px]:block dark:text-neutral-400 min-[768px]:hidden">
            Find free chat providers
          </div>
          <div class="text-[13px] text-neutral-500 leading-snug hidden min-[768px]:block dark:text-neutral-400">
            Find on-device models and free cloud options.
          </div>
        </div>
        <div class="i-solar:alt-arrow-down-linear size-4 shrink-0 text-neutral-400" />
      </button>
    </div>
  </div>
</template>
