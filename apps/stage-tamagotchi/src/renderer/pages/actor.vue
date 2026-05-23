<script setup lang="ts">
import ViewControlInputs from '@proj-airi/stage-layouts/components/Layouts/ViewControls/Inputs.vue'

import { useElectronEventaContext, useElectronEventaInvoke, useElectronMouseAroundWindowBorder, useElectronMouseInElement, useElectronMouseInWindow } from '@proj-airi/electron-vueuse'
import { WhisperDock } from '@proj-airi/stage-ui/components'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings/control-strip'
import { useSettingsControlsIsland } from '@proj-airi/stage-ui/stores/settings/controls-island'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { Button } from '@proj-airi/ui'
import { refDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { electron, electronStartDraggingWindow } from '../../shared/eventa'

const backgroundStore = useBackgroundStore()
const { activeBackgroundUrl } = storeToRefs(backgroundStore)

const settingsStore = useSettings()
const { stageModelSelected, stageModelRenderer, stageViewControlsEnabled, stageViewControlsMode } = storeToRefs(settingsStore)

const controlStripStore = useSettingsControlStrip()
const { stageEnabled } = storeToRefs(controlStripStore)

const positioningStore = usePositioningStore()

const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled } = storeToRefs(controlsIslandStore)

const scale = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).scale
})

const xOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).x
})

const yOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).y
})

function handleScaleChange(val: number) {
  const current = positioningStore.getPosition(stageModelSelected.value)
  positioningStore.setPosition(stageModelSelected.value, {
    ...current,
    scale: val,
  })
}

function handleOffsetChange(val: { x: number, y: number }) {
  const current = positioningStore.getPosition(stageModelSelected.value)
  positioningStore.setPosition(stageModelSelected.value, {
    ...current,
    x: val.x,
    y: val.y,
  })
}

// WhisperDock stub tools
const tools = ref<any[]>([])
function handleSpawnStandalone() {}

// Window Dragging Handle
const context = useElectronEventaContext()
const startDraggingWindowInvoke = useElectronEventaInvoke(electronStartDraggingWindow, context.value)
function startDraggingWindow() {
  startDraggingWindowInvoke()
}

const whisperDockIsOpen = ref(false)

// Fade overlay controls on hover states
const showControls = ref(false)

// Auto-hide (fade-on-hover) for the stage window.
// When enabled, entering the window fades the character to invisible and enables click-through.
// The ControlStrip window always stays visible — only the actor stage window fades.
const setIgnoreMouseEvents = useElectronEventaInvoke(electron.window.setIgnoreMouseEvents)
const stageIsHidden = ref(false)

const { isOutside: isOutsideWindow } = useElectronMouseInWindow()
const isInsideWindow = computed(() => !isOutsideWindow.value)

// Proximity/hover detection for control regions
const dragHandleRef = ref<HTMLDivElement | null>(null)
const whisperDockWrapperRef = ref<HTMLDivElement | null>(null)
const positioningSelectorsRef = ref<HTMLDivElement | null>(null)
const positioningSliderRef = ref<HTMLDivElement | null>(null)

const { isOutside: isOutsideDragHandle } = useElectronMouseInElement(dragHandleRef)
const { isOutside: isOutsideWhisperDock } = useElectronMouseInElement(whisperDockWrapperRef)
const { isOutside: isOutsidePositioningSelectors } = useElectronMouseInElement(positioningSelectorsRef)
const { isOutside: isOutsidePositioningSlider } = useElectronMouseInElement(positioningSliderRef)

const isOverControls = computed(() => {
  return !isOutsideDragHandle.value
    || !isOutsideWhisperDock.value
    || whisperDockIsOpen.value
    || (stageViewControlsEnabled.value && controlStripStore.stageMode === 'positionMode' && (!isOutsidePositioningSelectors.value || !isOutsidePositioningSlider.value))
})

watch(
  [isInsideWindow, fadeOnHoverEnabled, stageEnabled, isOverControls],
  ([inside, fadeEnabled, stageOn, overControls]) => {
    if (!stageOn) {
      stageIsHidden.value = false
      setIgnoreMouseEvents([false, { forward: true }])
      showControls.value = false
      return
    }

    const shouldHide = fadeEnabled && inside && !overControls
    stageIsHidden.value = shouldHide
    setIgnoreMouseEvents([shouldHide, { forward: true }])
    showControls.value = inside && !shouldHide
  },
  { immediate: true },
)

const { isNearAnyBorder: isAroundWindowBorder } = useElectronMouseAroundWindowBorder({ threshold: 30 })
const isAroundWindowBorderFor250Ms = refDebounced(isAroundWindowBorder, 250)
</script>

<template>
  <div
    :class="[
      'relative h-full w-full flex flex-col overflow-hidden rounded-xl bg-transparent',
      'transition-opacity duration-300 ease-in-out',
      stageIsHidden ? 'opacity-0' : 'opacity-100',
    ]"
  >
    <div class="relative h-full w-full overflow-hidden rounded-2xl">
      <!-- Scene Background Layer -->
      <div
        v-if="activeBackgroundUrl"
        :class="[
          'absolute inset-0 z-0',
          'transition-opacity duration-500',
        ]"
        :style="{
          backgroundImage: `url(${activeBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }"
      />

      <!-- Standalone Graphics Model Scene Renderer -->
      <div class="absolute inset-0 z-10">
        <RendererStage
          :paused="!stageEnabled"
          :focus-at="{ x: 0, y: 0 }"
          :x-offset="xOffset"
          :y-offset="yOffset"
          :scale="scale"
          @scale-change="handleScaleChange"
          @offset-change="handleOffsetChange"
        />
      </div>

      <!-- Spatial Controls Overlay -->
      <Transition name="fade">
        <div v-if="stageViewControlsEnabled && controlStripStore.stageMode === 'positionMode'" class="pointer-events-none absolute left-0 top-0 z-100 h-full w-full">
          <!-- Axis Selectors (Top Left) -->
          <div ref="positioningSelectorsRef" class="pointer-events-auto absolute left-4 top-4 flex gap-1 rounded-2xl bg-neutral-100/60 p-1 backdrop-blur-md dark:bg-neutral-900/60">
            <Button
              variant="secondary-muted"
              size="sm"
              :toggled="stageViewControlsMode === 'x'"
              class="min-w-10 font-bold font-mono"
              @click="stageViewControlsMode = 'x'"
            >
              X
            </Button>
            <Button
              variant="secondary-muted"
              size="sm"
              :toggled="stageViewControlsMode === 'y'"
              class="min-w-10 font-bold font-mono"
              @click="stageViewControlsMode = 'y'"
            >
              Y
            </Button>
            <Button
              v-if="stageModelRenderer === 'vrm'"
              variant="secondary-muted"
              size="sm"
              :toggled="stageViewControlsMode === 'z'"
              class="min-w-10 font-bold font-mono"
              @click="stageViewControlsMode = 'z'"
            >
              Z
            </Button>
            <Button
              variant="secondary-muted"
              size="sm"
              :toggled="stageViewControlsMode === 'scale'"
              class="min-w-10 font-bold font-mono"
              @click="stageViewControlsMode = 'scale'"
            >
              S
            </Button>
          </div>

          <!-- Vertical Slider (Left Edge) -->
          <div ref="positioningSliderRef" class="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2">
            <ViewControlInputs :mode="stageViewControlsMode" />
          </div>
        </div>
      </Transition>

      <!-- Floating Window Drag Control (Fades on hover) -->
      <div
        ref="dragHandleRef"
        :class="[
          'pointer-events-auto absolute right-4 top-4 z-50 transition-opacity duration-300 ease-in-out',
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ]"
      >
        <button
          class="w-fit flex cursor-pointer items-center self-end justify-center border-2 border-neutral-200/60 rounded-xl border-solid bg-neutral-50/80 p-2 backdrop-blur-md transition-all transition-duration-300 transition-ease-out active:scale-95 dark:border-neutral-800/10 dark:bg-neutral-800/70 hover:transition-none"
          title="Drag to Reposition Stage"
          @mousedown="startDraggingWindow"
        >
          <div class="i-ph:arrows-out-cardinal size-5 text-neutral-800 dark:text-neutral-300" />
        </button>
      </div>

      <!-- WhisperDock horizontal input overlay -->
      <div
        ref="whisperDockWrapperRef"
        :class="[
          'absolute bottom-0 left-0 w-full h-16 z-50 transition-opacity duration-300 ease-in-out',
          (showControls || whisperDockIsOpen) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ]"
      >
        <WhisperDock
          v-model:open="whisperDockIsOpen"
          :tools="tools"
          @spawn-standalone="handleSpawnStandalone"
        />
      </div>

      <!-- Proximity Border Highlight -->
      <Transition
        enter-active-class="transition-opacity duration-250 ease-in-out"
        enter-from-class="opacity-50"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-250 ease-in-out"
        leave-from-class="opacity-100"
        leave-to-class="opacity-50"
      >
        <div v-if="isAroundWindowBorderFor250Ms" class="pointer-events-none absolute left-0 top-0 z-999 h-full w-full">
          <div
            :class="[
              'b-primary/50',
              'h-full w-full animate-flash animate-duration-3s animate-count-infinite b-4 rounded-2xl',
            ]"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: stage
</route>
