<script setup lang="ts">
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { onClickOutside, useColorMode } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, toRef, watch } from 'vue'
// Ported stores & states for Popovers

import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useLiveSessionStore } from '../../../stores/modules/live-session'
import { useSettings } from '../../../stores/settings'
import { useSettingsAudioDevice } from '../../../stores/settings/audio-device'
import { useSettingsControlStrip } from '../../../stores/settings/control-strip'
import { useSettingsControlsIsland } from '../../../stores/settings/controls-island'

const settingsStore = useSettings()
const colorMode = useColorMode()
const controlStripStore = useSettingsControlStrip()
const { orientation, buttons, stageEnabled, chatOpen, captionOpen, backgroundTint, stageMode, collapsed } = storeToRefs(controlStripStore)

// Filter for active buttons
const activeButtons = computed(() => {
  return buttons.value.filter(btn => btn.enabled)
})

// Persistent dragging position, defaults to top-right layout bounds
const position = useLocalStorageManualReset<{ x: number, y: number }>('settings/control-strip/position', { x: 20, y: 150 })

const settingsAudioDeviceStore = useSettingsAudioDevice()
const { enabled: micEnabled } = storeToRefs(settingsAudioDeviceStore)

const liveSessionStore = useLiveSessionStore()
const { powerState } = storeToRefs(liveSessionStore)

const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled, alwaysOnTop } = storeToRefs(controlsIslandStore)

const cardStore = useAiriCardStore()
const { cards, activeCard, activeCardId } = storeToRefs(cardStore)

const modelStore = useModelStore()
const { activeExpressions } = storeToRefs(modelStore)
const vrmIdleAnimation = toRef(modelStore as any, 'vrmIdleAnimation')

const live2dStore = useLive2d()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const activePopover = ref<string | null>(null)
const hoveredButtonId = ref<string | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const wardrobeFilter = ref<'all' | 'base' | 'overlay'>('all')

onClickOutside(popoverRef, () => {
  activePopover.value = null
})

const PRESETS = [
  { name: 'mini', icon: 'i-solar:minimize-square-3-linear', label: 'Mini' },
  { name: 'medium', icon: 'i-solar:maximize-square-2-linear', label: 'Medium' },
  { name: 'large', icon: 'i-solar:maximize-square-3-linear', label: 'Large' },
  { name: 'full', icon: 'i-solar:screencast-linear', label: 'Full' },
] as const

function openPresetPopover(btnId: string) {
  if (btnId === 'stage') {
    activePopover.value = 'stage-preset'
  }
  else if (btnId === 'chat') {
    activePopover.value = 'chat-preset'
  }
  else {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
    }
  }
}

function applySizePreset(target: 'actor' | 'chat', preset: 'mini' | 'medium' | 'large' | 'full') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:apply-size-preset', {
      detail: { target, preset },
    }))
  }
  activePopover.value = null
}

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

const popoverPlacement = computed(() => {
  if (typeof window === 'undefined')
    return 'bottom'

  const screenX = window.screenX || 0
  const screenY = window.screenY || 0
  const screenWidth = window.screen?.width || window.innerWidth
  const screenHeight = window.screen?.height || window.innerHeight

  if (orientation.value === 'vertical') {
    return screenX < screenWidth / 2 ? 'right' : 'left'
  }
  else {
    return screenY < screenHeight / 2 ? 'bottom' : 'top'
  }
})

const stripLength = computed(() => {
  if (collapsed.value) {
    return 60
  }
  const N = activeButtons.value.length
  return N === 0 ? 60 : 60 + 46 * N
})

const containerStyle = computed(() => {
  if (isElectron.value) {
    const styles: Record<string, string> = {
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
    if (activePopover.value) {
      if (orientation.value === 'vertical') {
        const windowHeight = Math.max(336, stripLength.value)
        styles.top = `${(windowHeight - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'right') {
          styles.left = '0px'
        }
        else {
          styles.left = '268px'
        }
      }
      else {
        const windowWidth = Math.max(336, stripLength.value)
        styles.left = `${(windowWidth - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'bottom') {
          styles.top = '0px'
        }
        else {
          styles.top = '280px'
        }
      }
    }
    else {
      styles.left = '0px'
      styles.top = '0px'
    }
    return styles
  }
  else {
    return {
      top: `${position.value.y}px`,
      right: `${position.value.x}px`,
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
  }
})

watch(activePopover, (newVal) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:popover-changed', {
      detail: {
        activePopover: newVal,
        placement: popoverPlacement.value,
      },
    }))
  }
})

const ACT_EMOTIONS = [
  { key: 'happy', emoji: '😊' },
  { key: 'sad', emoji: '😢' },
  { key: 'angry', emoji: '😠' },
  { key: 'surprised', emoji: '😲' },
  { key: 'neutral', emoji: '😐' },
  { key: 'think', emoji: '🤔' },
  { key: 'cool', emoji: '😎' },
] as const

const wardrobeItems = computed(() => {
  const outfits = activeCard.value?.extensions?.airi?.outfits || []
  return outfits.filter(item => wardrobeFilter.value === 'all' || item.type === wardrobeFilter.value)
})

function isOutfitActive(outfitId: string) {
  const outfit = activeCard.value?.extensions?.airi?.outfits?.find(o => o.id === outfitId)
  if (!outfit)
    return false
  return Object.entries(outfit.expressions).every(([name, weight]) => {
    return Math.abs((activeExpressions.value[name] || 0) - weight) < 0.05
  })
}

const availableMotions = computed(() => {
  if (settingsStore.stageModelRenderer === 'vrm') {
    return customVrmAnimationsStore.animationKeys.map(key => ({
      key,
      label: customVrmAnimationsStore.animationLabelByKey[key] || key,
    }))
  }
  if (settingsStore.stageModelRenderer === 'live2d') {
    return (live2dStore.availableMotions || []).map(motion => ({
      key: `${motion.motionName}:${motion.motionIndex}`,
      label: `${motion.motionName} (${motion.motionIndex})`,
      raw: motion,
    }))
  }
  return []
})

const availableAllExpressions = computed(() => {
  if (settingsStore.stageModelRenderer === 'vrm') {
    return modelStore.availableExpressions.map(name => ({
      name,
      isActive: (modelStore.activeExpressions[name] || 0) > 0,
    }))
  }
  if (settingsStore.stageModelRenderer === 'live2d') {
    return (live2dStore.availableExpressions || []).map(exp => ({
      name: exp.name,
      isActive: (live2dStore.activeExpressions[exp.fileName] || 0) > 0,
    }))
  }
  return []
})

function playMotion(motion: any) {
  if (settingsStore.stageModelRenderer === 'vrm') {
    vrmIdleAnimation.value = motion.key
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    live2dStore.currentMotion = {
      group: motion.raw.motionName,
      index: motion.raw.motionIndex,
    }
  }
}

function triggerEmotion(emotion: string) {
  if (typeof (window as any).testEmotion === 'function') {
    ;(window as any).testEmotion(emotion)
  }
}

function triggerRandomEmotion() {
  const random = ACT_EMOTIONS[Math.floor(Math.random() * ACT_EMOTIONS.length)]
  triggerEmotion(random.key)
}

function triggerExpression(name: string) {
  if (settingsStore.stageModelRenderer === 'vrm') {
    const current = modelStore.activeExpressions[name] || 0
    const next = current > 0 ? 0 : 1
    modelStore.activeExpressions = { ...modelStore.activeExpressions, [name]: next }
  }
  else if (settingsStore.stageModelRenderer === 'live2d') {
    live2dStore.triggerEmotion(name)
  }
}

function triggerWardrobeItem(id: string) {
  cardStore.applyOutfit(id)
}

function handleViewGallery() {
  if (activeCardId.value) {
    window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
      detail: { route: `/settings/airi-card?cardId=${activeCardId.value}&tab=gallery` },
    }))
    activePopover.value = null
  }
}

function handleManageProfiles() {
  window.dispatchEvent(new CustomEvent('control-strip:open-settings', {
    detail: { route: '/settings/airi-card' },
  }))
  activePopover.value = null
}

const geminiDotClasses = computed(() => {
  if (powerState.value === 'busy') {
    return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse'
  }
  if (powerState.value === 'active') {
    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
  }
  if (powerState.value === 'connecting') {
    return 'bg-sky-400 animate-pulse'
  }
  if (powerState.value === 'ambient') {
    return 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]'
  }
  return 'bg-neutral-400/50'
})

// Dragging states
const isDragging = ref(false)
let isMouseDown = false
let startMouseX = 0
let startMouseY = 0
let startPosX = 0
let startPosY = 0
let dragDistance = 0

function onDragStart(e: MouseEvent | TouchEvent) {
  if ('button' in e && e.button !== 0)
    return

  isMouseDown = true
  dragDistance = 0

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  startMouseX = clientX
  startMouseY = clientY
  startPosX = position.value.x
  startPosY = position.value.y

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onDragging)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragging, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }
}

function onDragging(e: MouseEvent | TouchEvent) {
  if (!isMouseDown)
    return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const diffX = clientX - startMouseX
  const diffY = clientY - startMouseY
  dragDistance = Math.sqrt(diffX * diffX + diffY * diffY)

  if (dragDistance >= 4) {
    isDragging.value = true
  }

  if (isElectron.value) {
    if (dragDistance >= 4) {
      cleanupDragListeners()
      isMouseDown = false
      isDragging.value = false
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('control-strip:drag-start'))
      }
    }
  }
  else {
    if (isDragging.value) {
      const deltaX = startMouseX - clientX
      const deltaY = startMouseY - clientY
      position.value.x = Math.max(10, Math.min(window.innerWidth - 80, startPosX + deltaX))
      position.value.y = Math.max(10, Math.min(window.innerHeight - 300, startPosY + deltaY))
    }
  }
}

let clickTimer: NodeJS.Timeout | null = null

function handlePerpendicularClick() {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    collapsed.value = !collapsed.value
  }
  else {
    clickTimer = setTimeout(() => {
      clickTimer = null
      toggleOrientation()
    }, 250)
  }
}

function onDragEnd() {
  const wasDown = isMouseDown
  const wasDragging = isDragging.value
  cleanupDragListeners()
  isMouseDown = false
  isDragging.value = false

  if (wasDown && !wasDragging) {
    handlePerpendicularClick()
  }
}

function cleanupDragListeners() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', onDragging)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDragging)
    window.removeEventListener('touchend', onDragEnd)
  }
}

function handleAction(actionId: string) {
  console.info(`[Control Strip] Button clicked: "${actionId}".`)

  const menuButtons = ['actor-characters', 'actor-wardrobe', 'actor-expressions', 'actor-motions', 'actor-all-emotions']
  if (menuButtons.includes(actionId)) {
    if (activePopover.value === actionId) {
      activePopover.value = null
    }
    else {
      activePopover.value = actionId
    }
    return
  }

  activePopover.value = null

  if (actionId === 'layout') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
    }
    return
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:action', { detail: { action: actionId } }))
  }
}

function handleRightClick(e: MouseEvent) {
  e.preventDefault()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
  }
}

function toggleOrientation() {
  controlStripStore.toggleOrientation()
}

function getButtonIcon(btnId: string, defaultIcon: string): string {
  if (btnId === 'theme-mode') {
    return colorMode.value === 'light' ? 'i-solar:moon-linear' : 'i-solar:sun-linear'
  }
  if (btnId === 'caption-docking') {
    return settingsStore.captionDocking === 'top' ? 'i-solar:align-top-line-duotone' : 'i-solar:align-bottom-line-duotone'
  }
  if (btnId === 'caption-layout-mode') {
    return settingsStore.captionLayoutMode === 'multi' ? 'i-solar:layers-linear' : 'i-solar:window-frame-linear'
  }
  return defaultIcon
}

function getButtonTitle(btnId: string, defaultLabel: string): string {
  if (btnId === 'chat') {
    return `Chat Toggle: ${chatOpen.value ? 'Open (Green)' : 'Closed (Red)'}`
  }
  if (btnId === 'stage') {
    return `Actor Stage: ${stageEnabled.value ? 'Visible (Green)' : 'Hidden (Red)'}`
  }
  if (btnId === 'mic') {
    return `Microphone: ${micEnabled.value ? 'Active (Green)' : 'Muted (Red)'}`
  }
  if (btnId === 'caption') {
    return `Captions: ${captionOpen.value ? 'Active (Green)' : 'Disabled (Red)'}`
  }
  if (btnId === 'gemini-session') {
    const stateLabels: Record<string, string> = {
      off: 'Disconnected (Gray)',
      connecting: 'Connecting (Sky Blue)',
      active: 'Listening / Idle (Red)',
      busy: 'Transmitting / Speaking (Purple)',
      ambient: 'Witness Mode Active (Amber)',
    }
    return `Speech Session: ${stateLabels[powerState.value] || 'Disconnected (Gray)'}`
  }
  if (btnId === 'caption-docking') {
    return `Caption Docking: ${settingsStore.captionDocking === 'bottom' ? 'Bottom (Amber)' : 'Top (Sky Blue)'}`
  }
  if (btnId === 'caption-layout-mode') {
    return `Caption Layout: ${settingsStore.captionLayoutMode === 'multi' ? 'Multi-line History (Indigo)' : 'Standard Bubble (Teal)'}`
  }
  if (btnId === 'caption-follow-stage') {
    return `Caption Follow Stage: ${settingsStore.captionFollowStage ? 'Active (Green)' : 'Detached (Red)'}`
  }
  return defaultLabel
}

function getShortLabel(btnId: string): string {
  const map: Record<string, string> = {
    'chat': 'Chat',
    'mic': 'Mic',
    'stage': 'Stage',
    'caption': 'CC',
    'gemini-session': 'Live',
    'settings': 'Set',
    'layout': 'Edit',
    'viewport-auto-hide': 'Hide',
    'always-on-top': 'Pin',
    'viewport-tactile': 'Touch',
    'viewport-drag': 'Drag',
    'viewport-positioning': 'Pos',
    'viewport-orbit': 'Orbit',
    'viewport-cycle-modes': 'Modes',
    'viewport-reset-coordinates': 'Reset',
    'actor-idle-animations': 'Anim',
    'actor-characters': 'Char',
    'actor-wardrobe': 'Wear',
    'actor-expressions': 'Expr',
    'actor-motions': 'Move',
    'actor-all-emotions': 'Mood',
    'theme-mode': 'Color',
    'caption-docking': 'Dock',
    'caption-layout-mode': 'Rows',
    'caption-follow-stage': 'Sync',
    'exit-app': 'Quit',
  }
  return map[btnId] || btnId.substring(0, 4)
}
</script>

<template>
  <div
    :class="[
      'absolute pointer-events-auto select-none',
      'bg-neutral-100/30 dark:bg-neutral-900/40',
      'backdrop-blur-xl border border-white/20 dark:border-neutral-800/60',
      'shadow-2xl shadow-black/10 rounded-full',
      'transition-all duration-300 ease-out',
      isDragging ? 'scale-102 border-primary-500/30 shadow-primary-500/5' : '',
      orientation === 'vertical' ? 'flex flex-col items-center py-3 px-2 gap-2.5 w-14' : 'flex flex-row items-center px-3 py-2 gap-2.5 h-14',
    ]"
    :style="containerStyle"
    @contextmenu="handleRightClick"
  >
    <!-- TOP/LEFT ENDCAP: Perpendicular Drag & Layout Handle -->
    <button
      :class="[
        'flex items-center justify-center',
        'w-9 h-9 rounded-full',
        'bg-white/10 hover:bg-white/25 dark:bg-white/5 dark:hover:bg-white/15',
        'border border-white/10 dark:border-white/5',
        'text-neutral-700 dark:text-neutral-300',
        'transition-all duration-200 active:scale-90',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      ]"
      title="Drag to Reposition | Double Click to Collapse/Expand | Click to Toggle Layout"
      @mousedown="onDragStart"
      @touchstart="onDragStart"
      @click.stop
    >
      <span
        :class="[
          'text-lg transition-transform duration-300',
          collapsed ? 'i-solar:widget-linear scale-105' : (orientation === 'vertical' ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear'),
        ]"
      />
    </button>

    <!-- CORE INTERACTIVE BUTTONS -->
    <div
      v-if="!collapsed"
      :class="[
        orientation === 'vertical' ? 'flex flex-col items-center gap-2.5' : 'flex flex-row items-center gap-2.5',
      ]"
    >
      <button
        v-for="btn in activeButtons"
        :key="btn.id"
        :class="[
          'relative flex items-center justify-center overflow-hidden',
          'w-9 h-9 rounded-full border border-white/15 dark:border-white/5',
          'bg-white/15 hover:bg-white/25 dark:bg-white/5 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200',
          'transition-all duration-200 hover:scale-105 active:scale-90 cursor-pointer',
        ]"
        :title="getButtonTitle(btn.id, btn.label)"
        @mouseenter="hoveredButtonId = btn.id"
        @mouseleave="hoveredButtonId = null"
        @click="handleAction(btn.id)"
        @contextmenu.prevent.stop="openPresetPopover(btn.id)"
      >
        <!-- Icon fades out on hover -->
        <span
          :class="[
            getButtonIcon(btn.id, btn.icon),
            'text-lg absolute transition-all duration-200 ease-in-out',
            hoveredButtonId === btn.id ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
          ]"
        />

        <!-- Short label fades in on hover -->
        <span
          :class="[
            'text-[9px] font-extrabold uppercase tracking-wider text-center px-0.5 leading-none absolute transition-all duration-200 ease-in-out',
            hoveredButtonId === btn.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          ]"
        >
          {{ getShortLabel(btn.id) }}
        </span>

        <!-- Status dot badge for Stage (Actor Stage) -->
        <span
          v-if="btn.id === 'stage'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Chat (Chat Toggle) -->
        <span
          v-if="btn.id === 'chat'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            chatOpen ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Microphone (Microphone Toggle) -->
        <span
          v-if="btn.id === 'mic'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            micEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Captions (CC Toggle) -->
        <span
          v-if="btn.id === 'caption'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            captionOpen ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Gemini Session (Sparkle Toggle) -->
        <span
          v-if="btn.id === 'gemini-session'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-300',
            geminiDotClasses,
          ]"
        />

        <!-- Status dot badge for Auto-Hide toggle -->
        <span
          v-if="btn.id === 'viewport-auto-hide'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            fadeOnHoverEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Always-on-Top toggle -->
        <span
          v-if="btn.id === 'always-on-top'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            alwaysOnTop ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Tactile Mode -->
        <span
          v-if="btn.id === 'viewport-tactile'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'tactileMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Drag Mode -->
        <span
          v-if="btn.id === 'viewport-drag'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'dragMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Positioning Mode -->
        <span
          v-if="btn.id === 'viewport-positioning'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'positionMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Orbit Mode -->
        <span
          v-if="btn.id === 'viewport-orbit'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'orbitMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-follow-stage -->
        <span
          v-if="btn.id === 'caption-follow-stage'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionFollowStage ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for theme-mode -->
        <span
          v-if="btn.id === 'theme-mode'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            colorMode === 'dark' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-docking -->
        <span
          v-if="btn.id === 'caption-docking'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionDocking === 'bottom' ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]',
          ]"
        />

        <!-- Status dot badge for caption-layout-mode -->
        <span
          v-if="btn.id === 'caption-layout-mode'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionLayoutMode === 'multi' ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]' : 'bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]',
          ]"
        />
      </button>
    </div>

    <!-- POPOVERS -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      leave-to-class="opacity-0 translate-y-2 scale-95"
    >
      <div
        v-if="activePopover"
        ref="popoverRef"
        :class="[
          'absolute z-50 bg-neutral-100/90 dark:bg-neutral-900/95 border border-neutral-200/50 dark:border-neutral-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-3 text-neutral-800 dark:text-neutral-200',
          popoverPlacement === 'bottom' ? 'top-full mt-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'top' ? 'bottom-full mb-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'right' ? 'left-full ml-3 top-1/2 -translate-y-1/2' : '',
          popoverPlacement === 'left' ? 'right-full mr-3 top-1/2 -translate-y-1/2' : '',
          'w-64 max-w-xs',
        ]"
        @click.stop
      >
        <!-- STAGE PRESETS POPOVER -->
        <div v-if="activePopover === 'stage-preset'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Stage Size Presets</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2 py-1">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              class="flex flex-col cursor-pointer items-center justify-center gap-1.5 border border-neutral-200/50 rounded-xl bg-neutral-50/50 px-2 py-3 text-xs text-neutral-700 font-semibold transition-all duration-200 active:scale-95 dark:border-neutral-800/20 hover:border-sky-400/50 dark:bg-neutral-800/40 hover:bg-sky-500/10 dark:text-neutral-300 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-300"
              @click="applySizePreset('actor', p.name)"
            >
              <span :class="[p.icon, 'text-lg']" />
              <span>{{ p.label }}</span>
            </button>
          </div>
        </div>

        <!-- CHAT PRESETS POPOVER -->
        <div v-if="activePopover === 'chat-preset'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Chat Size Presets</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2 py-1">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              class="flex flex-col cursor-pointer items-center justify-center gap-1.5 border border-neutral-200/50 rounded-xl bg-neutral-50/50 px-2 py-3 text-xs text-neutral-700 font-semibold transition-all duration-200 active:scale-95 dark:border-neutral-800/20 hover:border-sky-400/50 dark:bg-neutral-800/40 hover:bg-sky-500/10 dark:text-neutral-300 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-300"
              @click="applySizePreset('chat', p.name)"
            >
              <span :class="[p.icon, 'text-lg']" />
              <span>{{ p.label }}</span>
            </button>
          </div>
        </div>

        <!-- CHARACTERS POPOVER -->
        <div v-if="activePopover === 'actor-characters'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Characters</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>
          <div class="max-h-48 flex flex-col gap-1.5 overflow-y-auto py-1 scrollbar-thin">
            <button
              v-for="[id, card] in cards"
              :key="id"
              :class="[
                'w-full flex items-center gap-2 cursor-pointer border rounded-xl px-3 py-2 text-left text-xs transition-all duration-200',
                id === activeCardId
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-600 dark:text-sky-300'
                  : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
              ]"
              @click="cardStore.activateCard(id); activePopover = null"
            >
              <div class="w-4 flex flex-shrink-0 items-center justify-center">
                <span v-if="id === activeCardId" class="i-solar:check-circle-bold text-sm text-sky-500" />
              </div>
              <span class="truncate font-medium">{{ card.name }}</span>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <button
              class="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-600 font-semibold transition-colors hover:bg-sky-500/20 dark:text-sky-400"
              @click="handleViewGallery"
            >
              <span class="i-solar:gallery-linear text-sm" />
              Gallery
            </button>
            <button
              class="flex items-center justify-center gap-1.5 rounded-xl bg-purple-500/10 px-2 py-1.5 text-[11px] text-purple-600 font-semibold transition-colors hover:bg-purple-500/20 dark:text-purple-400"
              @click="handleManageProfiles"
            >
              <span class="i-solar:settings-outline text-sm" />
              Profiles
            </button>
          </div>
        </div>

        <!-- WARDROBE POPOVER -->
        <div v-if="activePopover === 'actor-wardrobe'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Wardrobe</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <template v-if="settingsStore.stageModelRenderer === 'mmd' || settingsStore.stageModelRenderer === 'spine'">
            <div class="flex flex-col items-center justify-center py-6 text-center opacity-60">
              <span class="i-solar:shield-warning-outline animate-pulse text-2xl text-amber-500" />
              <span class="mt-2 text-xs font-medium">Not supported for {{ settingsStore.stageModelRenderer.toUpperCase() }}</span>
              <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">Please use the Controls Island.</span>
            </div>
          </template>
          <template v-else>
            <!-- 3-Column Outfit Grid -->
            <div class="max-h-40 overflow-y-auto py-1 scrollbar-thin">
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="item in wardrobeItems"
                  :key="item.id"
                  :class="[
                    'relative flex flex-col items-center justify-center p-2 rounded-xl border border-solid transition-all duration-200 cursor-pointer',
                    isOutfitActive(item.id)
                      ? item.type === 'base'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-600 dark:text-amber-400'
                        : 'bg-sky-500/20 border-sky-400 text-sky-600 dark:text-sky-400 ring-2 ring-sky-400/40'
                      : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                  ]"
                  :title="item.name"
                  @click="triggerWardrobeItem(item.id)"
                >
                  <span
                    :class="[
                      'text-xl mb-1',
                      item.type === 'base' ? 'text-amber-500' : 'text-sky-400',
                      item.icon || 'i-solar:t-shirt-outline',
                    ]"
                  />
                  <span class="w-full truncate text-center text-[9px]">{{ item.name }}</span>
                </button>

                <!-- Empty state if no outfits -->
                <div
                  v-if="wardrobeItems.length === 0"
                  class="col-span-3 flex flex-col items-center justify-center py-6 text-center opacity-40"
                >
                  <span class="i-solar:t-shirt-outline text-2xl" />
                  <span class="mt-1 text-[10px]">No outfits found</span>
                </div>
              </div>
            </div>

            <!-- Filters Row -->
            <div class="grid grid-cols-3 gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <button
                :class="[
                  'flex items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                  wardrobeFilter === 'base'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-400/30'
                    : 'bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="wardrobeFilter = wardrobeFilter === 'base' ? 'all' : 'base'"
              >
                Base
              </button>
              <button
                :class="[
                  'flex items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                  wardrobeFilter === 'overlay'
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold border border-sky-400/30'
                    : 'bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="wardrobeFilter = wardrobeFilter === 'overlay' ? 'all' : 'overlay'"
              >
                Overlay
              </button>
              <button
                :class="[
                  'flex items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                  wardrobeFilter === 'all'
                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold border border-purple-400/30'
                    : 'bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="wardrobeFilter = 'all'"
              >
                All
              </button>
            </div>
          </template>
        </div>

        <!-- EXPRESSIONS POPOVER -->
        <div v-if="activePopover === 'actor-expressions'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Expressions</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <div class="grid grid-cols-4 justify-items-center gap-2 py-1">
            <button
              v-for="emotion in ACT_EMOTIONS"
              :key="emotion.key"
              class="h-10 w-10 flex cursor-pointer items-center justify-center border border-neutral-200/50 rounded-xl bg-neutral-50/50 text-lg transition-all dark:border-neutral-800/20 dark:bg-neutral-800/40 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
              :title="emotion.key"
              @click="triggerEmotion(emotion.key)"
            >
              {{ emotion.emoji }}
            </button>

            <!-- Random Button -->
            <button
              class="h-10 w-10 flex cursor-pointer items-center justify-center border border-amber-400/30 rounded-xl bg-amber-500/10 text-lg text-amber-500 transition-all hover:bg-amber-500/20"
              title="Random"
              @click="triggerRandomEmotion"
            >
              <span class="i-solar:shuffle-linear" />
            </button>
          </div>
        </div>

        <!-- MOTIONS POPOVER -->
        <div v-if="activePopover === 'actor-motions'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Motions</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <template v-if="settingsStore.stageModelRenderer === 'mmd' || settingsStore.stageModelRenderer === 'spine'">
            <div class="flex flex-col items-center justify-center py-6 text-center opacity-60">
              <span class="i-solar:shield-warning-outline animate-pulse text-2xl text-amber-500" />
              <span class="mt-2 text-xs font-medium">Not supported for {{ settingsStore.stageModelRenderer.toUpperCase() }}</span>
              <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">Please use the Controls Island.</span>
            </div>
          </template>
          <template v-else>
            <div class="max-h-48 flex flex-col gap-1.5 overflow-y-auto py-1 scrollbar-thin">
              <button
                v-for="motion in availableMotions"
                :key="motion.key"
                :class="[
                  'w-full cursor-pointer border rounded-xl px-3 py-2 text-left text-xs transition-all duration-200',
                  (settingsStore.stageModelRenderer === 'vrm' && vrmIdleAnimation === motion.key)
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-600 dark:text-amber-300 font-semibold'
                    : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                ]"
                @click="playMotion(motion)"
              >
                <div class="flex items-center justify-between">
                  <span class="mr-2 truncate font-medium">{{ motion.label }}</span>
                  <span
                    v-if="settingsStore.stageModelRenderer === 'vrm' && vrmIdleAnimation === motion.key"
                    class="i-solar:check-circle-bold flex-shrink-0 text-sm text-amber-500"
                  />
                </div>
              </button>

              <div
                v-if="availableMotions.length === 0"
                class="flex flex-col items-center justify-center py-6 text-center opacity-40"
              >
                <span class="i-solar:magic-stick-3-bold-duotone text-2xl" />
                <span class="mt-1 text-[10px]">No motions available</span>
              </div>
            </div>
          </template>
        </div>

        <!-- ALL EMOTIONS POPOVER -->
        <div v-if="activePopover === 'actor-all-emotions'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">All Emotions</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <template v-if="settingsStore.stageModelRenderer === 'mmd' || settingsStore.stageModelRenderer === 'spine'">
            <div class="flex flex-col items-center justify-center py-6 text-center opacity-60">
              <span class="i-solar:shield-warning-outline animate-pulse text-2xl text-amber-500" />
              <span class="mt-2 text-xs font-medium">Not supported for {{ settingsStore.stageModelRenderer.toUpperCase() }}</span>
              <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">Please use the Controls Island.</span>
            </div>
          </template>
          <template v-else>
            <div class="max-h-48 flex flex-col gap-1 overflow-y-auto py-1 scrollbar-thin">
              <button
                v-for="exp in availableAllExpressions"
                :key="exp.name"
                :class="[
                  'w-full cursor-pointer border rounded-xl px-2.5 py-1.5 text-left text-xs transition-all duration-200',
                  exp.isActive
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-600 dark:text-purple-300 font-semibold'
                    : 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-800/20 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                ]"
                @click="triggerExpression(exp.name)"
              >
                <div class="flex items-center justify-between">
                  <span class="mr-2 truncate font-medium">{{ exp.name }}</span>
                  <span
                    v-if="exp.isActive"
                    class="i-solar:check-circle-bold flex-shrink-0 text-sm text-purple-500"
                  />
                </div>
              </button>

              <div
                v-if="availableAllExpressions.length === 0"
                class="flex flex-col items-center justify-center py-6 text-center opacity-40"
              >
                <span class="i-solar:emoji-funny-square-linear text-2xl" />
                <span class="mt-1 text-[10px]">No expressions available</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}
</style>
