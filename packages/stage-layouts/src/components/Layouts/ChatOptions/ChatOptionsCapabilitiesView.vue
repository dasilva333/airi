<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const isAutoSuggestionsEnabled = useLocalStorage('airi:producer:auto-suggestions-enabled', false)

function handleToggleAutoSuggestions() {
  isAutoSuggestionsEnabled.value = !isAutoSuggestionsEnabled.value
}

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const isHeartbeatsEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.heartbeats?.enabled ?? false
})

function handleToggleHeartbeats() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isHeartbeatsEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        heartbeats: {
          ...activeCard.value.extensions?.airi?.heartbeats,
          enabled: !current,
        },
      },
    },
  } as any)
}

const isScreenWatchingEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.screenWatching?.enabled ?? false
})

function handleToggleScreenWatching() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isScreenWatchingEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        screenWatching: {
          ...activeCard.value.extensions?.airi?.screenWatching,
          enabled: !current,
        },
      },
    },
  } as any)
}

const isDreamStateEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.dreamState?.enabled ?? false
})

function handleToggleDreamState() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isDreamStateEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        dreamState: {
          ...activeCard.value.extensions?.airi?.dreamState,
          enabled: !current,
        },
      },
    },
  } as any)
}

const isAutonomousArtistryEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

function handleToggleVisualNovel() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isAutonomousArtistryEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          autonomousEnabled: !current,
        },
      },
    },
  } as any)
}

const systemOneStore = useSystemOneStore()
const isSystemOneConfigured = computed(() => systemOneStore.configured)

const isMultiBubbleEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.acting?.cadence?.multiBubbleEnabled ?? false
})

function handleToggleMultiBubble() {
  if (!activeCardId.value || !activeCard.value || !isSystemOneConfigured.value)
    return
  const current = isMultiBubbleEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        acting: {
          ...activeCard.value.extensions?.airi?.acting,
          cadence: {
            ...activeCard.value.extensions?.airi?.acting?.cadence,
            multiBubbleEnabled: !current,
          },
        },
      },
    },
  } as any)
}

const isStickersEnabled = computed(() => {
  return (activeCard.value?.extensions?.airi?.acting?.stickerWidgetsEnabled ?? false)
    || ((activeCard.value?.extensions?.airi?.acting?.activeStickerIds?.length ?? 0) > 0)
})

function handleToggleStickers() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isStickersEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        acting: {
          ...activeCard.value.extensions?.airi?.acting,
          stickerWidgetsEnabled: !current,
        },
      },
    },
  } as any)
}

const isAutoCuesEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.acting?.autoCuesEnabled ?? false
})

function handleToggleAutoCues() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isAutoCuesEnabled.value
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        acting: {
          ...activeCard.value.extensions?.airi?.acting,
          autoCuesEnabled: !current,
        },
      },
    },
  } as any)
}

const isCognitivePipelineEnabled = computed(() => {
  const airiExt = activeCard.value?.extensions?.airi as any
  const cognition = airiExt?.modules?.cognition ?? airiExt?.cognition
  return cognition?.enabled ?? false
})

function handleToggleCognitivePipeline() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = isCognitivePipelineEnabled.value
  const willEnable = !current
  const extAiri = activeCard.value.extensions?.airi as any
  const existingProcessor = extAiri?.modules?.cognition?.processor
    ?? extAiri?.cognition?.processor
    ?? extAiri?.firstHopProcessor

  // 2-for-1 combo: when enabling, ensure processor is 'local_nan0' (if none or unset)
  const targetProcessor = willEnable
    ? (existingProcessor && existingProcessor !== 'none' ? existingProcessor : 'local_nan0')
    : (existingProcessor ?? 'local_nan0')

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...extAiri,
        firstHopProcessor: targetProcessor,
        cognition: {
          ...extAiri?.cognition,
          enabled: willEnable,
          processor: targetProcessor,
        },
        modules: {
          ...extAiri?.modules,
          cognition: {
            ...extAiri?.modules?.cognition,
            enabled: willEnable,
            processor: targetProcessor,
          },
        },
      },
    },
  } as any)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Header Banner -->
    <div class="mb-1 flex items-center gap-3 px-1 py-1">
      <div class="size-10 flex shrink-0 items-center justify-center border border-primary-500/20 rounded-xl bg-primary-500/15 text-primary-500 dark:bg-primary-500/20">
        <div class="i-solar:heart-pulse-bold-duotone size-6" />
      </div>
      <div class="flex flex-col">
        <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">Core Capabilities</span>
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500">Heartbeats, watching, cues, stickers</span>
      </div>
    </div>

    <!-- Toggle: Heartbeats -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleHeartbeats"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isHeartbeatsEnabled
            ? 'text-primary-500 i-solar:heart-pulse-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:heart-pulse-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Heartbeats</span>
          <span class="text-[9px] text-neutral-400">Activates character periodically</span>
        </div>
      </div>
      <div
        :class="isHeartbeatsEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isHeartbeatsEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Screen Watching -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleScreenWatching"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isScreenWatchingEnabled
            ? 'text-primary-500 i-solar:eye-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:eye-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Screen Watching</span>
          <span class="text-[9px] text-neutral-400">Visual event-driven commentary</span>
        </div>
      </div>
      <div
        :class="isScreenWatchingEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isScreenWatchingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Dreams -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleDreamState"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isDreamStateEnabled
            ? 'text-indigo-500 i-solar:sleeping-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:sleeping-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Dreams</span>
          <span class="text-[9px] text-neutral-400">Offline memory consolidation</span>
        </div>
      </div>
      <div
        :class="isDreamStateEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isDreamStateEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Visual Novel -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleVisualNovel"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isAutonomousArtistryEnabled
            ? 'text-primary-500 i-solar:gallery-wide-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-wide-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Visual Novel</span>
          <span class="text-[9px] text-neutral-400">Generates a new image for every turn</span>
        </div>
      </div>
      <div
        :class="isAutonomousArtistryEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isAutonomousArtistryEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Auto Suggestions -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleAutoSuggestions"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isAutoSuggestionsEnabled
            ? 'text-amber-500 i-solar:magic-stick-3-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:magic-stick-3-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Auto Suggestions</span>
          <span class="text-[9px] text-neutral-400">Generates reply choices after each turn</span>
        </div>
      </div>
      <div
        :class="isAutoSuggestionsEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isAutoSuggestionsEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Multi-bubble delivery -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      :class="{ 'opacity-60': !isSystemOneConfigured }"
      @click="handleToggleMultiBubble"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isMultiBubbleEnabled && isSystemOneConfigured
            ? 'text-primary-500 i-solar:chat-round-dots-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:chat-round-dots-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Multi-bubble delivery</span>
          <span class="text-[9px] text-neutral-400">{{ isSystemOneConfigured ? 'Delivers replies in smaller bubbles with natural pauses' : 'Set up System-1 to enable' }}</span>
        </div>
      </div>
      <div
        :class="isMultiBubbleEnabled && isSystemOneConfigured ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isMultiBubbleEnabled && isSystemOneConfigured ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Reaction Stickers -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleStickers"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isStickersEnabled
            ? 'text-pink-500 i-solar:sticker-smile-square-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:sticker-smile-square-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Reaction Stickers</span>
          <span class="text-[9px] text-neutral-400">Emit inline chibi reaction stickers</span>
        </div>
      </div>
      <div
        :class="isStickersEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isStickersEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Autonomous Cues (System-1 Interceptor) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleAutoCues"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isAutoCuesEnabled
            ? 'text-sky-500 i-solar:bolt-circle-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:bolt-circle-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Autonomous Cues</span>
          <span class="text-[9px] text-neutral-400">System-1 dialogue emotion & gestures</span>
        </div>
      </div>
      <div
        :class="isAutoCuesEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isAutoCuesEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>

    <!-- Toggle: Nan0 Affective Mind (Two-Hop Monologue & Emotion Engine) -->
    <div
      class="w-full flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="handleToggleCognitivePipeline"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="size-4.5"
          :class="isCognitivePipelineEnabled
            ? 'text-violet-500 i-solar:brain-bold-duotone'
            : 'text-neutral-400 dark:text-neutral-500 i-solar:brain-linear'"
        />
        <div class="flex flex-col">
          <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Nan0 Affective Mind</span>
          <span class="text-[9px] text-neutral-400">Deliberates inner monologue with reactive emotional states</span>
        </div>
      </div>
      <div
        :class="isCognitivePipelineEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
        class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
      >
        <span
          :class="isCognitivePipelineEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
          class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </div>
    </div>
  </div>
</template>
