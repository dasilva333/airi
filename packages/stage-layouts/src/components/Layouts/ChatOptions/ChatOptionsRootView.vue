<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  showChatLayout?: boolean
  hasApplyChatPreset?: boolean
}>(), {
  showChatLayout: true,
  hasApplyChatPreset: false,
})

const emit = defineEmits<{
  (e: 'navigate', view: 'capabilities' | 'tools' | 'injections' | 'memories' | 'appearance' | 'staging' | 'voice'): void
  (e: 'applyPreset', preset: 'mini' | 'medium' | 'large' | 'full'): void
  (e: 'openAllSettings'): void
}>()

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

// --- Image Spawn Mode ---
const currentSpawnMode = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.spawnMode ?? 'bg'
})

const isAutonomousArtistryEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

const hasImageJournalTool = computed(() => {
  const allowed = activeCard.value?.extensions?.airi?.generation?.known?.allowedTools
  return allowed === undefined || allowed.includes('image_journal')
})

const showImageSpawnMode = computed(() => {
  return isAutonomousArtistryEnabled.value || hasImageJournalTool.value
})

function handleSetSpawnMode(mode: 'bg' | 'widget' | 'inline') {
  if (!activeCardId.value || !activeCard.value)
    return
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          spawnMode: mode,
        },
      },
    },
  } as any)
}

function handleApplyPreset(preset: 'mini' | 'medium' | 'large' | 'full') {
  emit('applyPreset', preset)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- Section: Image Spawn Mode -->
    <template v-if="showImageSpawnMode">
      <div class="select-none px-2 pt-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Image Spawn Mode
      </div>
      <div class="mx-1 mb-1 flex gap-0.5 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-900">
        <button
          v-for="mode in (['bg', 'widget', 'inline'] as const)"
          :key="mode"
          :class="[
            'flex-1 py-1 text-[10px] font-bold rounded-md transition-all text-center whitespace-nowrap cursor-pointer',
            currentSpawnMode === mode
              ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="handleSetSpawnMode(mode)"
        >
          {{ mode === 'bg' ? 'Background' : mode === 'widget' ? 'Widget' : 'Inline' }}
        </button>
      </div>
    </template>

    <!-- Section: Chat Layout (Shown if enabled) -->
    <template v-if="props.showChatLayout && props.hasApplyChatPreset">
      <div class="select-none px-2 pt-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Chat Layout
      </div>
      <div class="mx-1 mb-1.5 flex border border-neutral-200/20 rounded-lg bg-neutral-100 p-0.5 divide-x divide-neutral-200/50 dark:border-neutral-800/30 dark:bg-neutral-900 dark:divide-neutral-800/80">
        <button
          v-for="preset in (['mini', 'medium', 'large', 'full'] as const)"
          :key="preset"
          class="flex-1 cursor-pointer rounded-md py-1 text-center text-[10px] text-neutral-600 font-bold transition-all active:scale-95 hover:bg-white/45 dark:text-neutral-400 hover:text-primary-500 dark:hover:bg-neutral-800/40 dark:hover:text-primary-400"
          @click="handleApplyPreset(preset)"
        >
          {{ preset === 'medium' ? 'Med.' : preset.charAt(0).toUpperCase() + preset.slice(1) }}
        </button>
      </div>
    </template>

    <!-- Divider -->
    <div class="mx-1 my-1 border-t border-neutral-200/30 dark:border-neutral-800/40" />

    <!-- Category Navigation Links -->
    <!-- 1. Core Capabilities -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'capabilities')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:heart-pulse-bold-duotone size-5 text-primary-500" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Core Capabilities</span>
          <span class="text-[9px] text-neutral-400">Heartbeats, watching, cues, stickers</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- 2. Tools & Workstation -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'tools')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:laptop-minimalistic-bold-duotone size-5 text-sky-500" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Tools & Workstation</span>
          <span class="text-[9px] text-neutral-400">Terminal, files, web, screenshots</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- 3. Context Injections -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'injections')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:database-bold-duotone size-5 text-amber-500" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Context Injections</span>
          <span class="text-[9px] text-neutral-400">Sensors, memory and reflections</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- 3.5. Memories -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'memories')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:history-bold-duotone size-5 text-indigo-500 dark:text-indigo-400" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Memories</span>
          <span class="text-[9px] text-neutral-400">Sessions, daily summaries, search &amp; storage</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- 4. Appearance -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'appearance')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:magic-stick-3-bold-duotone size-5 text-amber-500" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Appearance</span>
          <span class="text-[9px] text-neutral-400">Atmosphere and wallpaper</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- 5. Cast & Staging -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'staging')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:masks-bold-duotone size-5 text-purple-500" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Cast & Staging</span>
          <span class="text-[9px] text-neutral-400">Character colors and styling</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- 6. Voice & Audio -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('navigate', 'voice')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:volume-loud-bold-duotone size-5 text-emerald-500" />
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">Voice & Audio</span>
          <span class="text-[9px] text-neutral-400">Playback and speech generation</span>
        </div>
      </div>
      <div class="i-solar:alt-arrow-right-linear size-4 text-neutral-400" />
    </button>

    <!-- Divider -->
    <div class="mx-1 my-1 border-t border-neutral-200/30 dark:border-neutral-800/40" />

    <!-- All Settings -->
    <button
      type="button"
      class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
      @click="emit('openAllSettings')"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:tuning-2-linear size-5 text-neutral-500 dark:text-neutral-400" />
        <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">All settings</span>
      </div>
      <div class="i-solar:arrow-right-linear size-4 text-neutral-400" />
    </button>
  </div>
</template>
