<script setup lang="ts">
import type { StageAtmosphere } from '@proj-airi/stage-ui/stores'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { SettingsThemeHeaderWidget } from '@proj-airi/stage-ui/components'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { useTheme } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { ATMOSPHERE_OPTIONS } from '../../Backgrounds/patterns'

const emit = defineEmits<{
  (e: 'browseScenes'): void
}>()

const isElectron = isStageTamagotchi()
const { isDark } = useTheme()

const backgroundStore = useBackgroundStore()
const {
  chatboxActiveAtmosphereId,
  chatboxActiveBackgroundId,
  chatboxActiveBackgroundColor,
  chatboxSolidPalette,
  activeAtmosphereId,
  activeBackgroundId,
  activeBackgroundColor,
  availableBackgrounds,
} = storeToRefs(backgroundStore)

const currentAtmosphereId = computed(() => {
  return isElectron ? chatboxActiveAtmosphereId.value : activeAtmosphereId.value
})

const currentBackgroundId = computed(() => {
  return isElectron ? chatboxActiveBackgroundId.value : activeBackgroundId.value
})

const currentSolidColor = computed(() => {
  return isElectron ? chatboxActiveBackgroundColor.value : activeBackgroundColor.value
})

const currentSolidHex = computed(() => {
  const col = currentSolidColor.value
  if (!col) {
    return '#18181B'
  }
  return col.startsWith('#') ? col : `#${col}`
})

type BackgroundMode = 'wallpaper' | 'solid' | 'none'

const currentMode = computed<BackgroundMode>(() => {
  const bgId = currentBackgroundId.value
  if (!bgId || bgId === 'none') {
    return 'none'
  }
  if (bgId.startsWith('color:') || bgId.startsWith('#')) {
    return 'solid'
  }
  return 'wallpaper'
})

const activeSlotIndex = ref(0)
const nativeColorInputRef = ref<HTMLInputElement | null>(null)
const activeHexInput = ref('')

watch(
  currentSolidColor,
  (val) => {
    if (val) {
      activeHexInput.value = val.startsWith('#') ? val.toUpperCase() : `#${val.toUpperCase()}`
      const palette = chatboxSolidPalette.value || []
      const foundIdx = palette.findIndex(c => c.toLowerCase() === val.toLowerCase())
      if (foundIdx !== -1) {
        activeSlotIndex.value = foundIdx
      }
    }
  },
  { immediate: true },
)

const visualAtmospheres = computed(() => {
  return ATMOSPHERE_OPTIONS.filter(opt => opt.id !== 'none').map(opt => ({
    ...opt,
    displayLabel: opt.id === 'petals' ? 'Sakura' : opt.id === 'notes' ? 'Melody' : opt.name,
  }))
})

const quickWallpapers = computed(() => {
  return (availableBackgrounds.value || []).slice(0, 6)
})

function handleSetAtmosphere(id: StageAtmosphere) {
  if (isElectron) {
    backgroundStore.setChatboxActiveAtmosphere(id)
  }
  else {
    backgroundStore.setActiveAtmosphere(id)
  }
}

function handleClearAtmosphere() {
  if (isElectron) {
    backgroundStore.setChatboxActiveAtmosphere('none')
  }
  else {
    backgroundStore.setActiveAtmosphere('none')
  }
}

function handleSetBackground(id: string) {
  if (isElectron) {
    backgroundStore.setChatboxActiveBackground(id)
  }
  else {
    backgroundStore.setActiveBackground(id)
  }
}

function handleClearBackground() {
  if (isElectron) {
    backgroundStore.setChatboxActiveBackground('none')
  }
  else {
    backgroundStore.setActiveBackground('none')
  }
}

function handleSelectMode(mode: BackgroundMode) {
  if (mode === 'none') {
    handleClearBackground()
  }
  else if (mode === 'solid') {
    const palette = chatboxSolidPalette.value || []
    const targetColor = palette[activeSlotIndex.value] || palette[0] || '#18181B'
    handleSetSolidColor(targetColor, activeSlotIndex.value)
  }
  else if (mode === 'wallpaper') {
    const defaultBg = quickWallpapers.value[0]?.id || 'none'
    handleSetBackground(defaultBg)
  }
}

function handleSetSolidColor(color: string, index?: number) {
  if (index !== undefined) {
    activeSlotIndex.value = index
  }
  if (isElectron) {
    backgroundStore.setChatboxActiveSolidColor(color)
  }
  else {
    backgroundStore.setActiveSolidColor(color)
  }
}

function triggerColorPicker() {
  nativeColorInputRef.value?.click()
}

function handleNativeColorInput(e: Event) {
  const input = e.target as HTMLInputElement
  const newColor = input.value
  if (!newColor) {
    return
  }
  activeHexInput.value = newColor.toUpperCase()
  backgroundStore.updateChatboxSolidPaletteColor(activeSlotIndex.value, newColor)
  if (!isElectron) {
    backgroundStore.setActiveSolidColor(newColor)
  }
}

function handleHexCommit() {
  let val = activeHexInput.value.trim()
  if (!val.startsWith('#')) {
    val = `#${val}`
  }
  if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
    activeHexInput.value = val.toUpperCase()
    backgroundStore.updateChatboxSolidPaletteColor(activeSlotIndex.value, val)
    if (!isElectron) {
      backgroundStore.setActiveSolidColor(val)
    }
  }
  else {
    activeHexInput.value = currentSolidColor.value?.toUpperCase() || '#18181B'
  }
}

function handleResetSolidColors() {
  backgroundStore.resetChatboxSolidPalette()
  activeSlotIndex.value = 0
  const firstColor = chatboxSolidPalette.value[0] || '#18181B'
  handleSetSolidColor(firstColor, 0)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Appearance Header Banner -->
    <div class="flex items-center justify-between px-1 py-1">
      <div class="flex items-center gap-2.5">
        <div class="size-9 flex shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/15 dark:text-amber-400">
          <div class="i-solar:magic-stick-3-bold-duotone size-5" />
        </div>
        <div class="flex flex-col text-left">
          <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">Appearance</span>
          <span class="text-[10px] text-neutral-400">Atmosphere and background</span>
        </div>
      </div>

      <!-- Color Palette & Theme Mode Header Widget -->
      <SettingsThemeHeaderWidget shrink-0 />
    </div>

    <!-- ATMOSPHERE SECTION -->
    <div class="flex items-center justify-between px-1 pt-1">
      <span class="select-none text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Atmosphere</span>
      <button
        type="button"
        :class="[
          'flex items-center gap-1 text-[11px] font-medium transition cursor-pointer',
          currentAtmosphereId === 'none'
            ? 'text-primary-500 dark:text-primary-400 font-semibold'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200',
        ]"
        @click="handleClearAtmosphere"
      >
        <div class="i-solar:forbidden-circle-linear size-3.5" />
        <span>Clear effect</span>
      </button>
    </div>

    <!-- Atmosphere 3-column Visual Cards -->
    <div class="grid grid-cols-3 gap-2 px-1">
      <button
        v-for="opt in visualAtmospheres"
        :key="opt.id"
        type="button"
        :class="[
          'relative aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-200 ease-out cursor-pointer flex flex-col items-center justify-end pb-1.5 hover:scale-[1.02] active:scale-[0.98]',
          currentAtmosphereId === opt.id
            ? 'border-primary-400 bg-neutral-900 shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-primary-400/50'
            : 'border-neutral-200/50 dark:border-neutral-800/80 bg-neutral-100/80 dark:bg-neutral-900/90 hover:border-neutral-300 dark:hover:border-neutral-700',
        ]"
        @click="handleSetAtmosphere(opt.id)"
      >
        <!-- Live Mini Particle Canvas -->
        <component
          :is="opt.component"
          v-if="opt.component"
          transparent-bg
          preview
          class="pointer-events-none absolute inset-0"
        />

        <!-- Active Checkmark Badge -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-50"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-50"
        >
          <div
            v-if="currentAtmosphereId === opt.id"
            class="absolute right-1.5 top-1.5 z-10 size-4 flex items-center justify-center rounded-full bg-primary-500 text-white shadow-md"
          >
            <div class="i-solar:check-read-bold size-2.5" />
          </div>
        </Transition>

        <!-- Card Label -->
        <span
          :class="[
            'z-10 text-[11px] tracking-wide select-none drop-shadow-sm transition font-medium',
            currentAtmosphereId === opt.id
              ? 'text-primary-400 font-bold'
              : 'text-neutral-700 dark:text-neutral-200',
          ]"
        >
          {{ opt.displayLabel }}
        </span>
      </button>
    </div>

    <!-- BACKGROUND SECTION -->
    <div class="flex flex-col gap-2 px-1 pt-2">
      <div class="flex items-center justify-between">
        <span class="select-none text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Background</span>
      </div>

      <!-- Segmented Mode Control: Wallpaper / Solid / None -->
      <div class="grid grid-cols-3 gap-1 border border-neutral-200/50 rounded-xl bg-neutral-100/80 p-1 text-xs font-semibold dark:border-neutral-800/80 dark:bg-neutral-900/90">
        <button
          type="button"
          :class="[
            'flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
            currentMode === 'wallpaper'
              ? 'bg-primary-500 text-white shadow-sm font-bold'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          ]"
          @click="handleSelectMode('wallpaper')"
        >
          <div class="i-solar:gallery-wide-bold-duotone size-4" />
          <span>Wallpaper</span>
        </button>

        <button
          type="button"
          :class="[
            'flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
            currentMode === 'solid'
              ? 'bg-primary-500 text-white shadow-sm font-bold'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          ]"
          @click="handleSelectMode('solid')"
        >
          <div class="i-solar:stop-bold size-3.5" />
          <span>Solid</span>
        </button>

        <button
          type="button"
          :class="[
            'flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
            currentMode === 'none'
              ? 'bg-primary-500 text-white shadow-sm font-bold'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          ]"
          @click="handleSelectMode('none')"
        >
          <div
            :class="[
              isDark ? 'i-solar:moon-bold-duotone' : 'i-solar:sun-2-bold-duotone',
              'size-4',
            ]"
          />
          <span>Theme</span>
        </button>
      </div>

      <!-- SUBVIEW 1: WALLPAPER -->
      <div v-if="currentMode === 'wallpaper'" class="flex flex-col gap-2">
        <!-- Wallpaper 3-column Grid -->
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="bg in quickWallpapers"
            :key="bg.id"
            type="button"
            :class="[
              'group relative aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-200 ease-out cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
              currentBackgroundId === bg.id
                ? 'border-primary-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-primary-400/50'
                : 'border-neutral-200/50 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-100 dark:bg-neutral-900',
            ]"
            @click="handleSetBackground(bg.id)"
          >
            <img
              v-if="bg.url || backgroundStore.getBackgroundUrl(bg.id)"
              :src="bg.url || backgroundStore.getBackgroundUrl(bg.id)!"
              :alt="bg.title || 'Wallpaper'"
              class="size-full object-cover transition duration-200 group-hover:scale-105"
              loading="lazy"
            >
            <div
              v-else
              class="size-full flex items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-900"
            >
              <div class="i-solar:gallery-wide-bold-duotone size-5" />
            </div>

            <!-- Active Checkmark Badge -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 scale-50"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-50"
            >
              <div
                v-if="currentBackgroundId === bg.id"
                class="absolute right-1.5 top-1.5 z-10 size-4 flex items-center justify-center rounded-full bg-primary-500 text-white shadow-md"
              >
                <div class="i-solar:check-read-bold size-2.5" />
              </div>
            </Transition>
          </button>
        </div>

        <!-- Browse all scenes button -->
        <button
          type="button"
          :class="[
            'w-full py-2 px-3 rounded-xl text-xs font-semibold',
            'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200/60',
            'dark:bg-neutral-900/90 dark:hover:bg-neutral-800 dark:text-primary-400 dark:border-neutral-800/80',
            'flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer',
          ]"
          @click="emit('browseScenes')"
        >
          <span>Browse all scenes</span>
          <div class="i-solar:arrow-right-linear size-3.5" />
        </button>
      </div>

      <!-- SUBVIEW 2: SOLID -->
      <div v-else-if="currentMode === 'solid'" class="flex flex-col gap-2">
        <!-- 6 Color Swatches (2×3 Grid, No Text Labels) -->
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="(color, idx) in chatboxSolidPalette"
            :key="idx"
            type="button"
            :class="[
              'relative aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-200 ease-out cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
              currentSolidColor?.toLowerCase() === color.toLowerCase()
                ? 'border-primary-400 ring-2 ring-primary-400/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'border-neutral-200/50 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700',
            ]"
            :style="{ backgroundColor: color }"
            @click="handleSetSolidColor(color, idx)"
          >
            <!-- Active Checkmark Badge -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 scale-50"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-50"
            >
              <div
                v-if="currentSolidColor?.toLowerCase() === color.toLowerCase()"
                class="absolute right-1.5 top-1.5 z-10 size-4 flex items-center justify-center rounded-full bg-primary-500 text-white shadow-md"
              >
                <div class="i-solar:check-read-bold size-2.5" />
              </div>
            </Transition>
          </button>
        </div>

        <!-- Bottom Action Bar -->
        <div class="flex items-center justify-between gap-2 border border-neutral-200/60 rounded-xl bg-neutral-100/70 p-2 dark:border-neutral-800/80 dark:bg-neutral-900/60">
          <!-- Active Color Preview & Hex Input -->
          <div class="min-w-0 flex items-center gap-2">
            <div
              class="size-5 shrink-0 border border-black/15 rounded-md shadow-sm dark:border-white/15"
              :style="{ backgroundColor: currentSolidColor || '#18181B' }"
            />
            <input
              v-model="activeHexInput"
              type="text"
              maxlength="7"
              class="w-18 bg-transparent text-xs text-neutral-800 font-bold font-mono uppercase outline-none dark:text-neutral-100"
              placeholder="#18181B"
              @blur="handleHexCommit"
              @keydown.enter="handleHexCommit"
            >
          </div>

          <!-- Actions Cluster: Reset Colors & Edit Color -->
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-1 text-[11px] text-neutral-500 font-medium transition dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100"
              title="Reset palette to default colors"
              @click="handleResetSolidColors"
            >
              <div class="i-solar:restart-linear size-3.5" />
              <span>Reset Colors</span>
            </button>

            <div class="h-3.5 w-px bg-neutral-300 dark:bg-neutral-700" />

            <button
              type="button"
              class="flex cursor-pointer items-center gap-1 text-[11px] text-primary-500 font-semibold transition dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
              title="Edit color"
              @click="triggerColorPicker"
            >
              <div class="i-solar:pen-new-square-linear size-3.5" />
              <span>Edit color</span>
            </button>

            <input
              ref="nativeColorInputRef"
              type="color"
              :value="currentSolidHex"
              class="sr-only"
              @input="handleNativeColorInput"
            >
          </div>
        </div>
      </div>

      <!-- SUBVIEW 3: THEME -->
      <div v-else-if="currentMode === 'none'" class="px-2 py-4 text-center">
        <span class="text-xs text-neutral-400 font-medium leading-relaxed dark:text-neutral-500">
          Follows your light or dark theme. Atmosphere effects stay independent.
        </span>
      </div>
    </div>
  </div>
</template>
