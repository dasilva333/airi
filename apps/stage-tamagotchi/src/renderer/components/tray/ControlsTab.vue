<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useControlStripAction } from '@proj-airi/stage-ui/composables/use-control-strip-action'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import {
  useSettingsAudioDevice,
  useSettingsControlStrip,
  useSettingsStageModel,
} from '@proj-airi/stage-ui/stores/settings'
import { useSettingsControlsIsland } from '@proj-airi/stage-ui/stores/settings/controls-island'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { electronCustomizerToggleVisibility } from '../../../shared/eventa'

const controlStripStore = useSettingsControlStrip()
const settingsAudioDeviceStore = useSettingsAudioDevice()
const stageModelSettings = useSettingsStageModel()
const controlsIslandStore = useSettingsControlsIsland()
const liveSessionStore = useLiveSessionStore()
const { dispatchAction } = useControlStripAction()

const { trayPreset, activeTrayButtons } = storeToRefs(controlStripStore)
const toggleCustomizerRpc = useElectronEventaInvoke(electronCustomizerToggleVisibility)

interface ControlTile {
  id: string
  label: string
  status: string
  icon: string
  active?: boolean
  highlightColor?: string
}

function getTileStatus(id: string): { status: string, active: boolean, highlightColor?: string } {
  switch (id) {
    case 'mic': {
      const active = settingsAudioDeviceStore.enabled
      return {
        status: active ? 'On' : 'Off',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'gemini-tts':
    case 'voice': {
      const isGemini = liveSessionStore.outputMode === 'gemini'
      return {
        status: isGemini ? 'Gemini' : 'TTS',
        active: true,
        highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400',
      }
    }
    case 'chat': {
      const active = controlStripStore.chatOpen
      return {
        status: active ? 'Open' : 'Closed',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'stage': {
      const active = controlStripStore.stageEnabled
      return {
        status: active ? 'Visible' : 'Hidden',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'always-on-top':
    case 'sleep': {
      const active = controlsIslandStore.alwaysOnTop
      return {
        status: active ? 'Pinned' : 'Normal',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'caption': {
      const active = controlStripStore.captionOpen
      return {
        status: active ? 'On' : 'Off',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'actor-gunslinger':
    case 'arcade': {
      const stance = stageModelSettings.gunslingerStance
      const active = stance !== 'off'
      return {
        status: active ? stance : 'Off',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'viewport-tactile': {
      const active = controlStripStore.stageMode === 'tactileMode'
      return {
        status: 'Touch',
        active,
        highlightColor: active ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' : undefined,
      }
    }
    case 'actor-wardrobe':
      return { status: 'Airi Maid', active: true }
    case 'actor-motion-playground':
      return { status: 'Auto', active: true }
    case 'actor-all-emotions':
      return { status: 'Natural', active: true }
    case 'actor-vfx':
      return { status: 'Aura', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' }
    case 'actor-motions':
      return { status: 'Dance', active: false }
    case 'actor-selfies':
      return { status: 'Snap', active: false }
    case 'stage-atmosphere':
      return { status: 'Theme', active: true }
    case 'actor-characters':
      return { status: 'Cast', active: true }
    case 'actor-macaron':
      return { status: 'Active', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' }
    case 'gemini-witness':
    case 'vision':
      return { status: 'On', active: true, highlightColor: 'text-primary-600 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-400' }
    default:
      return { status: 'Ready', active: false }
  }
}

const currentTiles = computed<ControlTile[]>(() => {
  return activeTrayButtons.value
    .filter(btn => btn.enabled)
    .slice(0, 11)
    .map((btn) => {
      const state = getTileStatus(btn.id)
      return {
        id: btn.id,
        label: btn.label,
        icon: btn.icon,
        status: state.status,
        active: state.active,
        highlightColor: state.highlightColor,
      }
    })
})

function handleTileClick(tile: ControlTile) {
  dispatchAction(tile.id)
}

function handleCustomize() {
  controlStripStore.setTrayPreset('Custom')
  controlStripStore.setCustomizerPreset('Custom')
  void toggleCustomizerRpc({ enabled: true, preset: 'Custom' })
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
          'flex flex-col items-center justify-center cursor-pointer',
          'p-2 rounded-xl border transition group min-h-[84px] min-w-0',
          tile.active
            ? 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 shadow-sm'
            : 'bg-neutral-50/70 dark:bg-neutral-900/40 border-neutral-200/50 dark:border-neutral-800/50 opacity-70',
        ]"
        @click="handleTileClick(tile)"
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
            trayPreset === preset
              ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 font-semibold shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="controlStripStore.setTrayPreset(preset)"
        >
          {{ preset }}
        </button>
      </div>
    </div>
  </div>
</template>
