<script setup lang="ts">
/**
 * Stage theme popover — atmosphere particles and quick wallpapers.
 *
 * Self-serving: owns the background store reads/writes and the stage-vs-chatbox
 * target toggle. On desktop it can retarget the chatbox surface; on web/pocket
 * the switcher is hidden and it acts on the stage only, as before.
 */
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import StripPopover from '../StripPopover.vue'

import { ATMOSPHERE_PRESETS } from '../../../../constants/atmosphere'
import { useBackgroundStore } from '../../../../stores/background'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const backgroundStore = useBackgroundStore()
const {
  activeAtmosphereId,
  activeBackgroundId,
  availableBackgrounds,
  chatboxActiveAtmosphereId,
  chatboxActiveBackgroundId,
} = storeToRefs(backgroundStore)

const themeTarget = ref<'stage' | 'chatbox'>('stage')

const effectiveThemeAtmosphereId = computed(() => {
  return themeTarget.value === 'stage'
    ? activeAtmosphereId.value
    : chatboxActiveAtmosphereId.value
})

const effectiveThemeBackgroundId = computed(() => {
  return themeTarget.value === 'stage'
    ? activeBackgroundId.value
    : chatboxActiveBackgroundId.value
})

function handleSetAtmosphere(presetId: any) {
  if (themeTarget.value === 'stage') {
    backgroundStore.setActiveAtmosphere(presetId)
  }
  else {
    backgroundStore.setChatboxActiveAtmosphere(presetId)
  }
}

function handleSetBackground(bgId: string) {
  if (themeTarget.value === 'stage') {
    backgroundStore.setActiveBackground(bgId)
  }
  else {
    backgroundStore.setChatboxActiveBackground(bgId)
  }
}

const miniBackgrounds = computed(() => {
  return availableBackgrounds.value.slice(0, 5).map(bg => ({
    ...bg,
    resolvedUrl: bg.url || backgroundStore.getBackgroundUrl(bg.id) || '',
  }))
})

function openSceneSettings() {
  emit('close')
  void router.push('/settings/scene')
}
</script>

<template>
  <StripPopover title="Stage Theme" gap="2.5" header-padding="1.5" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
        <div class="flex items-center gap-1.5">
          <span class="i-solar:magic-stick-3-bold-duotone text-sm text-amber-500" />
          <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">
            {{ isStageTamagotchi() ? 'Theme & Atmosphere' : 'Stage Theme' }}
          </span>
        </div>
        <button class="cursor-pointer text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="emit('close')">
          <span class="i-solar:close-circle-outline text-lg" />
        </button>
      </div>
    </template>

    <!-- Target Surface Segmented Switcher (Desktop only: Stage vs Chatbox) -->
    <div v-if="isStageTamagotchi()" class="grid grid-cols-2 gap-1 rounded-xl bg-neutral-200/50 p-1 dark:bg-neutral-800/50">
      <button
        :class="[
          'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
          themeTarget === 'stage'
            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
        ]"
        @click="themeTarget = 'stage'"
      >
        <span class="i-solar:clapperboard-play-bold-duotone text-xs text-amber-500" />
        <span>Stage</span>
      </button>
      <button
        :class="[
          'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
          themeTarget === 'chatbox'
            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
        ]"
        @click="themeTarget = 'chatbox'"
      >
        <span class="i-solar:chat-line-bold text-xs text-amber-500" />
        <span>Chatbox</span>
      </button>
    </div>

    <!-- Section 1: Animated Atmosphere Particles -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Animated Atmosphere</span>
        <span v-if="isStageTamagotchi()" class="text-[9px] text-amber-600 font-medium dark:text-amber-400">
          Target: {{ themeTarget === 'stage' ? 'Stage' : 'Chatbox' }}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="preset in ATMOSPHERE_PRESETS"
          :key="preset.id"
          :class="[
            'flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all duration-150 cursor-pointer text-xs',
            effectiveThemeAtmosphereId === preset.id
              ? 'border-amber-400/80 bg-amber-500/15 text-amber-600 dark:text-amber-300 font-semibold ring-1 ring-amber-400/40'
              : 'border-neutral-200/60 dark:border-neutral-800/80 bg-neutral-200/20 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/70',
          ]"
          @click="handleSetAtmosphere(preset.id as any)"
        >
          <span :class="[preset.icon, 'text-sm shrink-0', effectiveThemeAtmosphereId === preset.id ? 'text-amber-500' : 'text-neutral-400']" />
          <span class="truncate text-[11px]">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <!-- Section 2: Quick Wallpaper (Up to 6 options) -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Wallpaper</span>
        <button
          class="flex cursor-pointer items-center gap-0.5 text-[10px] text-amber-500 font-medium hover:text-amber-400"
          @click="openSceneSettings"
        >
          <span>All Scenes</span>
          <span class="i-solar:arrow-right-linear text-[10px]" />
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <!-- Tile 1: None (Clean / Transparent) -->
        <button
          :class="[
            'group relative aspect-video rounded-xl border overflow-hidden flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all duration-150',
            effectiveThemeBackgroundId === 'none'
              ? 'border-amber-400/80 ring-2 ring-amber-400/40 bg-amber-500/10'
              : 'border-neutral-200/60 dark:border-neutral-800/80 bg-neutral-200/30 dark:bg-neutral-800/40 hover:bg-neutral-200/50',
          ]"
          title="None (Clean Stencil Only)"
          @click="handleSetBackground('none')"
        >
          <span class="i-solar:eye-closed-linear text-sm text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
          <span class="text-[9px] text-neutral-500 font-medium">None</span>
        </button>

        <!-- Tiles 2-6: Up to 5 recent backgrounds -->
        <button
          v-for="bg in miniBackgrounds"
          :key="bg.id"
          :class="[
            'group relative aspect-video rounded-xl border overflow-hidden cursor-pointer transition-all duration-150',
            effectiveThemeBackgroundId === bg.id
              ? 'border-amber-400/80 ring-2 ring-amber-400/40'
              : 'border-neutral-200/60 dark:border-neutral-800/80 hover:ring-1 hover:ring-amber-400/40',
          ]"
          :title="bg.title"
          @click="handleSetBackground(bg.id)"
        >
          <img
            v-if="bg.resolvedUrl"
            :src="bg.resolvedUrl"
            :alt="bg.title"
            class="h-full w-full object-cover"
            loading="lazy"
          >
          <div v-else class="h-full w-full flex items-center justify-center bg-neutral-200 text-[9px] text-neutral-400 dark:bg-neutral-800">
            <span class="i-solar:gallery-linear text-sm" />
          </div>
          <div class="absolute inset-x-0 bottom-0 truncate from-black/80 via-black/40 to-transparent bg-gradient-to-t p-1 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {{ bg.title }}
          </div>
        </button>
      </div>
    </div>
  </StripPopover>
</template>
