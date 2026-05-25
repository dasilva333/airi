<script setup lang="ts">
import ViewControlInputs from '@proj-airi/stage-layouts/components/Layouts/ViewControls/Inputs.vue'

import { useElectronEventaContext, useElectronEventaInvoke, useElectronMouseAroundWindowBorder, useElectronMouseInElement, useElectronMouseInWindow } from '@proj-airi/electron-vueuse'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { WhisperDock } from '@proj-airi/stage-ui/components'
import { ControlStrip } from '@proj-airi/stage-ui/components/scenarios/layout'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useLive2d } from '@proj-airi/stage-ui/stores/live2d'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings/audio-device'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings/control-strip'
import { useSettingsControlsIsland } from '@proj-airi/stage-ui/stores/settings/controls-island'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { Button } from '@proj-airi/ui'
import { refDebounced, useColorMode } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  electron,
  electronApplySizePreset,
  electronAppQuit,
  electronCaptionSyncDocking,
  electronCaptionToggleVisibility,
  electronControlStripSyncState,
  electronCustomizerToggleVisibility,
  electronOpenChat,
  electronOpenSettings,
  electronStageSetAlwaysOnTop,
  electronStageToggleVisibility,
  electronStartDraggingWindow,
} from '../../shared/eventa'
import { builtinTools } from '../stores/tools/builtin'
import { useWindowStore } from '../stores/window'

const backgroundStore = useBackgroundStore()
const { activeBackgroundUrl } = storeToRefs(backgroundStore)

const settingsStore = useSettings()
const { stageModelSelected, stageModelRenderer, stageViewControlsEnabled, stageViewControlsMode, alwaysOnTop } = storeToRefs(settingsStore)

const controlStripStore = useSettingsControlStrip()
const { stageEnabled, captionOpen, collapsed } = storeToRefs(controlStripStore)

const positioningStore = usePositioningStore()

const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled } = storeToRefs(controlsIslandStore)

// Control strip invoke handlers
const colorMode = useColorMode()
const toggleCaptionVisibility = useElectronEventaInvoke(electronCaptionToggleVisibility)
const toggleCustomizerVisibility = useElectronEventaInvoke(electronCustomizerToggleVisibility)
const quitApp = useElectronEventaInvoke(electronAppQuit)
const syncCaptionDocking = useElectronEventaInvoke(electronCaptionSyncDocking)
const openChat = useElectronEventaInvoke(electronOpenChat)
const openSettings = useElectronEventaInvoke(electronOpenSettings)
const toggleStageVisibility = useElectronEventaInvoke(electronStageToggleVisibility)
const applySizePresetInvoke = useElectronEventaInvoke(electronApplySizePreset)
const syncControlStripState = useElectronEventaInvoke(electronControlStripSyncState)
const setIgnoreMouseEventsInvoke = useElectronEventaInvoke(electron.window.setIgnoreMouseEvents)
const setAlwaysOnTopInvoke = useElectronEventaInvoke(electronStageSetAlwaysOnTop)

// Control strip state
const activePopover = ref<string | null>(null)
const lastPlacement = ref<'left' | 'right' | 'top' | 'bottom' | null>(null)
const lastOrientation = ref<'vertical' | 'horizontal'>('vertical')

const activeButtons = computed(() => {
  return controlStripStore.buttons.filter((btn: any) => btn.enabled)
})

const stripLength = computed(() => {
  if (collapsed.value) {
    return 60
  }
  const N = activeButtons.value.length
  return N === 0 ? 60 : 60 + 46 * N
})

// Chat/LLM stores for control strip actions
const settingsAudioDeviceStore = useSettingsAudioDevice()
const liveSessionStore = useLiveSessionStore()
const cardStore = useAiriCardStore()
const { activeCard } = storeToRefs(cardStore)
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const modelStore = useModelStore()
const vrmIdleAnimation = toRef(modelStore as any, 'vrmIdleAnimation')
const { live2dLookAtX, live2dLookAtY } = storeToRefs(useWindowStore())

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
const stageIsHidden = ref(false)

const { isOutside: isOutsideWindow } = useElectronMouseInWindow()
const isInsideWindow = computed(() => !isOutsideWindow.value)

// Proximity/hover detection for control regions
const dragHandleRef = ref<HTMLDivElement | null>(null)
const whisperDockWrapperRef = ref<HTMLDivElement | null>(null)
const positioningSelectorsRef = ref<HTMLDivElement | null>(null)
const positioningSliderRef = ref<HTMLDivElement | null>(null)
const controlStripWrapperRef = ref<HTMLDivElement | null>(null)

const { isOutside: isOutsideDragHandle } = useElectronMouseInElement(dragHandleRef)
const { isOutside: isOutsideWhisperDock } = useElectronMouseInElement(whisperDockWrapperRef)
const { isOutside: isOutsidePositioningSelectors } = useElectronMouseInElement(positioningSelectorsRef)
const { isOutside: isOutsidePositioningSlider } = useElectronMouseInElement(positioningSliderRef)
const { isOutside: isOutsideControlStrip } = useElectronMouseInElement(controlStripWrapperRef)

const isOverControls = computed(() => {
  return !isOutsideDragHandle.value
    || !isOutsideWhisperDock.value
    || whisperDockIsOpen.value
    || !isOutsideControlStrip.value
    || (stageViewControlsEnabled.value && controlStripStore.stageMode === 'positionMode' && (!isOutsidePositioningSelectors.value || !isOutsidePositioningSlider.value))
})

watch(
  [isInsideWindow, fadeOnHoverEnabled, stageEnabled, isOverControls],
  ([inside, fadeEnabled, stageOn, overControls]) => {
    if (!stageOn) {
      stageIsHidden.value = false
      setIgnoreMouseEventsInvoke([false, { forward: true }])
      showControls.value = false
      return
    }

    const shouldHide = fadeEnabled && inside && !overControls
    stageIsHidden.value = shouldHide
    setIgnoreMouseEventsInvoke([shouldHide, { forward: true }])
    showControls.value = inside && !shouldHide
  },
  { immediate: true },
)

const { isNearAnyBorder: isAroundWindowBorder } = useElectronMouseAroundWindowBorder({ threshold: 30 })
const isAroundWindowBorderFor250Ms = refDebounced(isAroundWindowBorder, 250)

// ===== Control Strip Logic (moved from index.vue) =====

watch(stageEnabled, (val) => {
  toggleStageVisibility(val)
}, { immediate: true })

watch(captionOpen, (val) => {
  toggleCaptionVisibility(val)
}, { immediate: true })

// Treat stage and caption as partners when captionFollowStage is enabled
watch(stageEnabled, (newVal) => {
  if (settingsStore.captionFollowStage) {
    if (captionOpen.value !== newVal) {
      captionOpen.value = newVal
    }
  }
})

watch(captionOpen, (newVal) => {
  if (settingsStore.captionFollowStage) {
    if (stageEnabled.value !== newVal) {
      controlStripStore.stageEnabled = newVal
    }
  }
})

watch(() => settingsStore.captionFollowStage, (newVal) => {
  if (newVal) {
    if (captionOpen.value !== stageEnabled.value) {
      captionOpen.value = stageEnabled.value
    }
  }
})

async function applyBoundsUpdate(nextPopover: string | null, nextPlacement: 'left' | 'right' | 'top' | 'bottom') {
  // NOTE: Window resizing is intentionally disabled since the control strip
  // is now an overlay within the stage window. The window should maintain its
  // stage dimensions to avoid clipping the character. Only sync state.
  activePopover.value = nextPopover
  lastPlacement.value = nextPlacement
  lastOrientation.value = controlStripStore.orientation
}

watch([stripLength, () => controlStripStore.orientation], async ([_newLength, newOrientation]) => {
  if (activePopover.value) {
    await applyBoundsUpdate(activePopover.value, lastPlacement.value || 'bottom')
  }
  else {
    lastOrientation.value = newOrientation
  }
})

watch(
  [activePopover, lastPlacement, () => controlStripStore.orientation, stripLength],
  async ([popover, placement, orient, len]) => {
    await syncControlStripState({
      activePopover: popover,
      lastPlacement: placement || 'bottom',
      orientation: orient || 'vertical',
      stripLength: len,
    })
  },
  { immediate: true },
)

async function handleApplySizePreset(e: Event) {
  const { target, preset } = (e as CustomEvent).detail
  await applySizePresetInvoke({ target, preset })
}

function cycleAnimation() {
  if (stageModelRenderer.value === 'mmd') {
    const mmdStore = useMmd()
    const allKeys = mmdStore.availableMotions
    if (allKeys.length === 0) {
      toast.error('No MMD motions available', { id: 'animation-cycle' })
      return
    }
    const currentKey = mmdStore.currentMotion
    const currentIndex = allKeys.indexOf(currentKey)
    const nextIndex = (currentIndex + 1) % allKeys.length
    const nextAnimation = allKeys[nextIndex]

    mmdStore.currentMotion = nextAnimation
    toast.info(`Cycling MMD: ${nextAnimation}`, { id: 'animation-cycle' })
    return
  }

  const cardIdleAnimations = activeCard.value?.extensions?.airi?.acting?.idleAnimations || []
  const allKeys = customVrmAnimationsStore.animationKeys
  const hasCardSubset = cardIdleAnimations.length > 0

  if (cardIdleAnimations.length === 1) {
    const currentKey = cardIdleAnimations[0]
    const currentIndex = allKeys.indexOf(currentKey)
    const nextIndex = (currentIndex + 1) % allKeys.length
    const nextAnimation = allKeys[nextIndex]

    if (activeCard.value?.extensions?.airi?.acting) {
      activeCard.value.extensions.airi.acting.idleAnimations = [nextAnimation]
    }
    toast.info(`Character Fixed: ${customVrmAnimationsStore.animationLabelByKey[nextAnimation] || nextAnimation}`, { id: 'animation-cycle' })
    return
  }

  const keys = hasCardSubset ? cardIdleAnimations.filter(k => allKeys.includes(k)) : allKeys
  const finalKeys = keys.length > 0 ? keys : allKeys

  const currentKey = vrmIdleAnimation.value
  const currentIndex = finalKeys.indexOf(currentKey)
  const nextIndex = (currentIndex + 1) % finalKeys.length
  const nextAnimation = finalKeys[nextIndex]

  vrmIdleAnimation.value = nextAnimation
  toast.info(`Cycling: ${customVrmAnimationsStore.animationLabelByKey[nextAnimation] || nextAnimation}`, { id: 'animation-cycle' })
}

function handleControlStripAction(e: Event) {
  const action = (e as CustomEvent).detail.action
  console.info(`[Actor Page] [Control Strip Action] Received action: "${action}"`)
  if (action === 'chat') {
    controlStripStore.chatOpen = !controlStripStore.chatOpen
    openChat(controlStripStore.chatOpen)
  }
  else if (action === 'settings') {
    openSettings()
  }
  else if (action === 'caption') {
    controlStripStore.captionOpen = !controlStripStore.captionOpen
  }
  else if (action === 'mic') {
    settingsAudioDeviceStore.enabled = !settingsAudioDeviceStore.enabled
  }
  else if (action === 'stage') {
    controlStripStore.stageEnabled = !controlStripStore.stageEnabled
  }
  else if (action === 'gemini-session') {
    liveSessionStore.toggle()
  }
  else if (action === 'always-on-top') {
    alwaysOnTop.value = !alwaysOnTop.value
    setAlwaysOnTopInvoke(alwaysOnTop.value)
  }
  else if (action === 'theme-mode') {
    colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
  }
  else if (action === 'caption-follow-stage') {
    settingsStore.captionFollowStage = !settingsStore.captionFollowStage
  }
  else if (action === 'caption-docking') {
    const next = settingsStore.captionDocking === 'top' ? 'bottom' : 'top'
    settingsStore.captionDocking = next
    syncCaptionDocking(next)
  }
  else if (action === 'caption-layout-mode') {
    settingsStore.captionLayoutMode = settingsStore.captionLayoutMode === 'single' ? 'multi' : 'single'
  }
  else if (action === 'exit-app') {
    quitApp()
  }
  else if (action === 'viewport-tactile') {
    modelStore.interactionMode = 'tactile'
    stageViewControlsEnabled.value = false
    controlStripStore.stageMode = 'tactileMode'
  }
  else if (action === 'viewport-drag') {
    modelStore.interactionMode = 'tactile'
    stageViewControlsEnabled.value = true
    controlStripStore.stageMode = 'dragMode'
  }
  else if (action === 'viewport-positioning') {
    modelStore.interactionMode = 'tactile'
    stageViewControlsEnabled.value = true
    controlStripStore.stageMode = 'positionMode'
  }
  else if (action === 'viewport-orbit') {
    modelStore.interactionMode = 'orbit'
    stageViewControlsEnabled.value = false
    controlStripStore.stageMode = 'orbitMode'
  }
  else if (action === 'viewport-cycle-modes') {
    controlStripStore.cycleStageMode()
    const mode = controlStripStore.stageMode
    if (mode === 'tactileMode') {
      modelStore.interactionMode = 'tactile'
      stageViewControlsEnabled.value = false
    }
    else if (mode === 'dragMode') {
      modelStore.interactionMode = 'tactile'
      stageViewControlsEnabled.value = true
    }
    else if (mode === 'positionMode') {
      modelStore.interactionMode = 'tactile'
      stageViewControlsEnabled.value = true
    }
    else if (mode === 'orbitMode') {
      modelStore.interactionMode = 'orbit'
      stageViewControlsEnabled.value = false
    }
  }
  else if (action === 'viewport-auto-hide') {
    fadeOnHoverEnabled.value = !fadeOnHoverEnabled.value
  }
  else if (action === 'viewport-reset-coordinates') {
    const key = stageModelSelected.value
    positioningStore.setPosition(key, { x: 0, y: 0, scale: 1 })
    if (stageModelRenderer.value === 'live2d') {
      const live2dStore = useLive2d()
      live2dStore.resetState()
    }
    else {
      modelStore.modelOffset = { x: 0, y: 0, z: 0 }
      modelStore.cameraDistance = modelStore.modelSize.z * 10
    }
  }
  else if (action === 'actor-idle-animations') {
    cycleAnimation()
  }
}

async function handleOpenCustomizer(e?: Event) {
  const group = (e as CustomEvent)?.detail?.group
  await toggleCustomizerVisibility({ enabled: true, group })
}

function handleOpenSettings(e: Event) {
  const route = (e as CustomEvent).detail?.route
  openSettings({ route })
}

onMounted(async () => {
  const chatStore = useChatOrchestratorStore()
  chatStore.setToolsResolver(builtinTools)
  tools.value = await builtinTools()

  // Initialize orientation from main process config
  lastOrientation.value = controlStripStore.orientation

  if (typeof window !== 'undefined') {
    window.addEventListener('control-strip:action', handleControlStripAction as EventListener)
    window.addEventListener('control-strip:open-customizer', handleOpenCustomizer as EventListener)
    window.addEventListener('control-strip:open-settings', handleOpenSettings as EventListener)
    window.addEventListener('control-strip:drag-start', () => {
      startDraggingWindow()
    })
    window.addEventListener('control-strip:popover-changed', async (e: Event) => {
      const { activePopover: nextPopover, placement: nextPlacement } = (e as CustomEvent).detail
      await applyBoundsUpdate(nextPopover, nextPlacement)
    })
    window.addEventListener('control-strip:apply-size-preset', handleApplySizePreset as EventListener)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('control-strip:action', handleControlStripAction as EventListener)
    window.removeEventListener('control-strip:open-customizer', handleOpenCustomizer as EventListener)
    window.removeEventListener('control-strip:open-settings', handleOpenSettings as EventListener)
    window.removeEventListener('control-strip:apply-size-preset', handleApplySizePreset as EventListener)
  }
})
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
          :focus-at="{ x: live2dLookAtX, y: live2dLookAtY }"
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

      <!-- Floating Modular Control Strip Overlay -->
      <div ref="controlStripWrapperRef" class="pointer-events-none absolute inset-0 z-50 overflow-hidden">
        <ControlStrip />
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
