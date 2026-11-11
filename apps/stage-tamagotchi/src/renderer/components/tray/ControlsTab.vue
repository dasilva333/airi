<script setup lang="ts">
import { computed, ref } from 'vue'

type PresetType = 'Basic' | 'Fun' | 'Custom'
const activePreset = ref<PresetType>('Basic')

interface ControlTile {
  id: string
  label: string
  status: string
  icon: string
  active?: boolean
  highlightColor?: string
}

// 1. Basic preset: Full 11 original controls
const basicTiles = ref<ControlTile[]>([
  { id: 'mic', label: 'Mic', status: 'On', icon: 'i-solar:microphone-3-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'voice', label: 'Voice', status: '80%', icon: 'i-solar:volume-loud-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'tts', label: 'TTS', status: 'On', icon: 'i-solar:chat-round-line-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'vision', label: 'Vision', status: 'On', icon: 'i-solar:eye-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'stage', label: 'Stage', status: 'Hidden', icon: 'i-solar:box-bold', active: false },
  { id: 'sleep', label: 'Sleep', status: 'Off', icon: 'i-solar:moon-bold', active: false },
  { id: 'outfit', label: 'Outfit', status: 'Airi Maid', icon: 'i-solar:t-shirt-bold', active: true },
  { id: 'motion', label: 'Motion', status: 'Auto', icon: 'i-solar:running-round-bold', active: true },
  { id: 'emotion', label: 'Emotion', status: 'Natural', icon: 'i-solar:smile-circle-bold', active: true },
  { id: 'fx', label: 'FX / Aura', status: 'On', icon: 'i-solar:stars-minimalistic-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'record', label: 'Record', status: 'Off', icon: 'i-solar:record-circle-bold', active: false },
])

// 2. Fun preset: 11 expressive & playful controls
const funTiles = ref<ControlTile[]>([
  { id: 'outfit', label: 'Outfit', status: 'Airi Maid', icon: 'i-solar:t-shirt-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'motion', label: 'Motion', status: 'Auto', icon: 'i-solar:running-round-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'emotion', label: 'Emotion', status: 'Natural', icon: 'i-solar:smile-circle-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'fx', label: 'FX / Aura', status: 'On', icon: 'i-solar:stars-minimalistic-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'dance', label: 'Dance', status: 'Ready', icon: 'i-solar:music-note-2-bold', active: false },
  { id: 'arcade', label: 'Arcade', status: 'Backseat', icon: 'i-solar:gamepad-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'selfie', label: 'Selfie', status: 'Snap', icon: 'i-solar:camera-bold', active: false },
  { id: 'party', label: 'Cheer', status: 'Ready', icon: 'i-solar:confetti-bold', active: false },
  { id: 'voice_pitch', label: 'Voice FX', status: 'Sweet', icon: 'i-solar:tuning-bold', active: true },
  { id: 'minigame', label: 'Tamagotchi', status: 'Active', icon: 'i-solar:ghost-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'headpat', label: 'Tactile', status: 'Touch', icon: 'i-solar:heart-bold', active: false },
])

// 3. Custom preset: User customizable controls
const customTiles = ref<ControlTile[]>([
  { id: 'mic', label: 'Mic', status: 'On', icon: 'i-solar:microphone-3-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'voice', label: 'Voice', status: '80%', icon: 'i-solar:volume-loud-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'tts', label: 'TTS', status: 'On', icon: 'i-solar:chat-round-line-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'vision', label: 'Vision', status: 'On', icon: 'i-solar:eye-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'stage', label: 'Stage', status: 'Hidden', icon: 'i-solar:box-bold', active: false },
  { id: 'sleep', label: 'Sleep', status: 'Off', icon: 'i-solar:moon-bold', active: false },
  { id: 'outfit', label: 'Outfit', status: 'Airi Maid', icon: 'i-solar:t-shirt-bold', active: true },
  { id: 'motion', label: 'Motion', status: 'Auto', icon: 'i-solar:running-round-bold', active: true },
  { id: 'emotion', label: 'Emotion', status: 'Natural', icon: 'i-solar:smile-circle-bold', active: true },
  { id: 'fx', label: 'FX / Aura', status: 'On', icon: 'i-solar:stars-minimalistic-bold', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' },
  { id: 'record', label: 'Record', status: 'Off', icon: 'i-solar:record-circle-bold', active: false },
])

const currentTiles = computed(() => {
  if (activePreset.value === 'Fun')
    return funTiles.value
  if (activePreset.value === 'Custom')
    return customTiles.value
  return basicTiles.value
})

function toggleTile(tile: ControlTile) {
  tile.active = !tile.active
  if (tile.id === 'stage') {
    tile.status = tile.active ? 'Visible' : 'Hidden'
  }
  else if (tile.id === 'sleep') {
    tile.status = tile.active ? 'On' : 'Off'
  }
  else if (tile.id === 'record') {
    tile.status = tile.active ? 'Rec' : 'Off'
  }
}

function handleCustomize() {
  activePreset.value = 'Custom'
}
</script>

<template>
  <div class="h-full flex flex-col space-y-2.5">
    <!-- Header banner -->
    <div
      :class="[
        'flex items-center justify-between',
        'px-1 py-0.5',
      ]"
    >
      <div>
        <div class="flex items-center gap-1.5 text-xs text-neutral-800 font-bold dark:text-neutral-100">
          <div class="i-solar:widget-2-bold text-sm text-primary-500" />
          Quick Controls
        </div>
        <div class="text-[10px] text-neutral-500 dark:text-neutral-400">
          Your custom tray controls from Control Strip.
        </div>
      </div>
      <button
        type="button"
        :class="[
          'px-2 py-1 rounded-lg text-[10px] font-semibold',
          'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700',
          'text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700',
          'transition flex items-center gap-1 cursor-pointer',
        ]"
        @click="handleCustomize"
      >
        <div class="i-solar:pen-new-square-linear text-xs" />
        Customize...
      </button>
    </div>

    <!-- Four-column, three-row responsive-density control grid (12 tiles total) -->
    <div
      :class="[
        'grid grid-cols-4 gap-2',
      ]"
    >
      <!-- Standard Tiles (11 tiles) -->
      <button
        v-for="tile in currentTiles"
        :key="tile.id"
        type="button"
        :class="[
          'flex flex-col items-center justify-center',
          'p-2 rounded-xl border transition group min-h-[84px] min-w-0',
          tile.active
            ? 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 shadow-sm'
            : 'bg-neutral-50/70 dark:bg-neutral-900/40 border-neutral-200/50 dark:border-neutral-800/50 opacity-70',
        ]"
        @click="toggleTile(tile)"
      >
        <div
          :class="[
            'w-9 h-9 rounded-lg flex items-center justify-center transition mb-1',
            tile.active && tile.highlightColor
              ? tile.highlightColor
              : tile.active
                ? 'text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-700'
                : 'text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800',
          ]"
        >
          <div :class="[tile.icon, 'text-lg']" />
        </div>
        <span class="w-full truncate text-center text-[10px] text-neutral-700 font-bold leading-tight dark:text-neutral-200">
          {{ tile.label }}
        </span>
        <span
          :class="[
            'text-[10px] font-mono leading-tight mt-1 truncate w-full text-center',
            tile.active ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-neutral-400',
          ]"
        >
          {{ tile.status }}
        </span>
      </button>

      <!-- 12th Tile: + Add Button (completes the 4-column x 3-row layout) -->
      <button
        type="button"
        :class="[
          'flex flex-col items-center justify-center',
          'p-2 rounded-xl border border-dashed min-h-[84px] min-w-0',
          'border-neutral-300 dark:border-neutral-700 hover:border-primary-500',
          'bg-neutral-50/50 dark:bg-neutral-900/30 text-neutral-400 hover:text-primary-500',
          'transition group cursor-pointer',
        ]"
        @click="handleCustomize"
      >
        <div class="mb-1 h-7 w-7 flex items-center justify-center rounded-lg text-neutral-400 group-hover:text-primary-500">
          <div class="i-solar:add-circle-bold text-base" />
        </div>
        <span class="text-[10px] font-medium leading-tight">Add</span>
        <span class="mt-0.5 text-[8px] text-neutral-400 leading-tight">+</span>
      </button>
    </div>

    <!-- Bottom Preset Bar -->
    <div
      :class="[
        'mt-auto p-2 rounded-xl',
        'bg-neutral-50 dark:bg-neutral-900/60',
        'border border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between text-xs',
      ]"
    >
      <div class="flex items-center gap-1.5">
        <div class="i-solar:layers-bold text-xs text-neutral-400" />
        <span class="text-[11px] text-neutral-600 font-medium dark:text-neutral-300">Quick Controls Preset</span>
      </div>

      <!-- 3-Button Segmented Preset Switcher: Basic | Fun | Custom -->
      <div
        :class="[
          'flex items-center p-0.5 rounded-lg',
          'bg-neutral-200/70 dark:bg-neutral-800/80',
          'border border-neutral-200/60 dark:border-neutral-700/60',
        ]"
      >
        <button
          v-for="preset in (['Basic', 'Fun', 'Custom'] as const)"
          :key="preset"
          type="button"
          :class="[
            'px-2.5 py-0.5 rounded-md transition text-[10px] font-medium cursor-pointer',
            activePreset === preset
              ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 font-semibold shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="activePreset = preset"
        >
          {{ preset }}
        </button>
      </div>
    </div>
  </div>
</template>
