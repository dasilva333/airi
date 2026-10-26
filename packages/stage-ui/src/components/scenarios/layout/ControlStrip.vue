<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useTheme } from '@proj-airi/ui'
import { onClickOutside, useBroadcastChannel } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
// Ported stores & states for Popovers

import SelfiesPopover from './popovers/SelfiesPopover.vue'

import { useControlStripAction } from '../../../composables/use-control-strip-action'
import { useControlStripButtonPresentation } from '../../../composables/use-control-strip-button-presentation'
import { useControlStripSelfie } from '../../../composables/use-control-strip-selfie'
import { CUSTOMIZER_CATALOG } from '../../../constants'
import { useBackgroundStore } from '../../../stores/background'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useLiveSessionStore } from '../../../stores/modules/live-session'
// ── Voice Switch Popover — state & helpers ─────────────────────────────────
import { useSettings } from '../../../stores/settings'
import { useSettingsAudioDevice } from '../../../stores/settings/audio-device'
import { useSettingsControlStrip } from '../../../stores/settings/control-strip'
import { useSettingsControlsIsland } from '../../../stores/settings/controls-island'
import { useSettingsStageModel } from '../../../stores/settings/stage-model'
import { STRIP_POPOVER_COMPONENTS } from './popovers/registry'

const props = withDefaults(defineProps<{
  mode?: 'desktop' | 'mobile'
}>(), {
  mode: 'desktop',
})

const { dispatchAction } = useControlStripAction()
const settingsStore = useSettings()
const stageModelSettings = useSettingsStageModel()
const { gunslingerStance } = storeToRefs(stageModelSettings)

console.log('[ControlStrip.vue] Setup loaded with Selfie feature support')
const { themeMode, isDark } = useTheme()
const controlStripStore = useSettingsControlStrip()
const { orientation, buttons, stageEnabled, stageMateEnabled, chatOpen, captionOpen, backgroundTint, collapsed, dockedEdge, selfieIncludeBg } = storeToRefs(controlStripStore)
const isHoveredHandle = ref(false)

const autoHideMode = computed(() => dockedEdge.value !== null)

const activePopover = ref<string | null>(null)

// Auto-hide Tab hover states
const hoverExpanded = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const isFullyExpanded = computed(() => {
  if (autoHideMode.value) {
    return !collapsed.value || hoverExpanded.value || activePopover.value !== null
  }
  return !collapsed.value
})

function onContainerMouseEnter() {
  if (autoHideMode.value && collapsed.value) {
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value)
      hoverTimer.value = null
    }
    hoverExpanded.value = true
  }
}

function onContainerMouseLeave() {
  if (autoHideMode.value && collapsed.value) {
    if (hoverTimer.value)
      clearTimeout(hoverTimer.value)
    hoverTimer.value = setTimeout(() => {
      hoverExpanded.value = false
    }, 400)
  }
}

const autoHideTabClasses = computed(() => {
  if (!autoHideMode.value || isFullyExpanded.value) {
    return ''
  }
  const edge = dockedEdge.value
  const base = 'transition-transform duration-300 ease-out'

  if (edge === 'left') {
    return `${base} rounded-r-full rounded-l-none border-l-0 -translate-x-[calc(100%-14px)]`
  }
  if (edge === 'right') {
    return `${base} rounded-l-full rounded-r-none border-r-0 translate-x-[calc(100%-14px)]`
  }
  if (edge === 'top') {
    return `${base} rounded-b-full rounded-t-none border-t-0 -translate-y-[calc(100%-14px)]`
  }
  if (edge === 'bottom') {
    return `${base} rounded-t-full rounded-b-none border-b-0 translate-y-[calc(100%-14px)]`
  }
  return ''
})

const isSandboxAllowed = computed(() => {
  const tools = cardStore.activeCard?.extensions?.airi?.generation?.known?.allowedTools
  return Boolean(tools && (tools.includes('bash') || tools.includes('mcp_bash')))
})

// Filter for active buttons
const activeButtons = computed(() => {
  const isMobile = props.mode === 'mobile'
  const allCatalog = CUSTOMIZER_CATALOG.flatMap(g => g.items)
  const desktopOnlyMap = new Map(allCatalog.map(i => [i.id, !!i.desktopOnly]))

  return buttons.value.filter((btn) => {
    if (!btn.enabled)
      return false
    if (isMobile && desktopOnlyMap.get(btn.id))
      return false
    if (btn.id === 'workspace' && !isSandboxAllowed.value)
      return false
    return true
  })
})

// One descriptor per button (icon, colour, tooltip, hover label, status dot).
// Replaces four if-chains and 21 inline badge branches; see
// constants/control-strip-labels.ts for the resolvers and their parity tests.
const { presentation: buttonPresentation } = useControlStripButtonPresentation({
  buttons: activeButtons,
  context: () => ({
    themeMode: themeMode.value,
    isDark: isDark.value,
    stageTamagotchi: isStageTamagotchi(),
    workspaceOpen: controlStripStore.workspaceOpen,
    stageDisabled: controlStripStore.stageDisabled,
    stageEnabled: stageEnabled.value,
    stageMateEnabled: stageMateEnabled.value,
    chatOpen: chatOpen.value,
    captionOpen: captionOpen.value,
    interactionMode: settingsStore.controlStripInteractionMode,
    stageMode: controlStripStore.stageMode,
    captionDocking: settingsStore.captionDocking ?? 'none',
    captionLayoutMode: settingsStore.captionLayoutMode,
    captionFollowStagePosition: settingsStore.captionFollowStagePosition,
    captionFollowStageVisibility: settingsStore.captionFollowStageVisibility,
    headTetheredCaptionEnabled: settingsStore.headTetheredCaptionEnabled,
    micEnabled: micEnabled.value,
    powerState: powerState.value,
    fadeOnHoverEnabled: fadeOnHoverEnabled.value,
    alwaysOnTop: alwaysOnTop.value,
    gunslingerStance: stageModelSettings.gunslingerStance,
    activeAtmosphereId: activeAtmosphereId.value,
    activeBackgroundId: activeBackgroundId.value,
    chatboxActiveAtmosphereId: chatboxActiveAtmosphereId.value,
    chatboxActiveBackgroundId: chatboxActiveBackgroundId.value,
  }),
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
const { activeCard, activeCardId } = storeToRefs(cardStore)

// Background & Atmosphere state & actions
const backgroundStore = useBackgroundStore()
const {
  activeAtmosphereId,
  activeBackgroundId,
  chatboxActiveAtmosphereId,
  chatboxActiveBackgroundId,
} = storeToRefs(backgroundStore)

// Selfie capture + viewfinder channel ownership stays in the shell: exactly one
// listener per app, and the viewfinder contract is driven by `activePopover`.
const { selfies, selfieCountdown, triggerSelfie, selectSelfieBackground } = useControlStripSelfie({
  activeCardId,
  activePopover,
  selfieIncludeBg,
  getCharacterSelfies: characterId => backgroundStore.getCharacterJournalEntries(characterId),
  updateCardBackground: (characterId, bgId) => {
    const card = activeCard.value
    if (!card)
      return
    cardStore.updateCard(characterId, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions.airi,
          modules: {
            ...card.extensions.airi.modules,
            activeBackgroundId: bgId,
          },
        },
      },
    } as any)
  },
})

const hoveredButtonId = ref<string | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

let lastDispatchedStance: string | null = null
watch(gunslingerStance, async (stance) => {
  if (stance === lastDispatchedStance)
    return
  lastDispatchedStance = stance
  if (isElectron.value) {
    try {
      const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
      const { electronStageMateSetWeapon } = await import('@proj-airi/stage-shared')
      const setWeapon = useElectronEventaInvoke(electronStageMateSetWeapon)
      await setWeapon({
        enabled: stance !== 'off',
        weapon: stance,
      })
    }
    catch (err) {
      console.warn('Failed to dispatch gunslinger weapon to Stage-Mate:', err)
    }
  }
}, { immediate: true })

interface CaptionSegment { text: string, color: string, actorId: string, isActive?: boolean }
type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string }
    | { type: 'caption-assistant', segments: CaptionSegment[] }

const { data: captionChannelData } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({ name: 'airi-caption-overlay' })
watch(captionChannelData, async (event) => {
  if (!isElectron.value || !event)
    return
  try {
    const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
    const { electronStageMateSendCaption } = await import('@proj-airi/stage-shared')
    const sendCaption = useElectronEventaInvoke(electronStageMateSendCaption)

    if (event.type === 'caption-assistant') {
      const active = event.segments?.find(s => s.isActive)
      if (active && active.text?.trim()) {
        await sendCaption({
          text: active.text,
          isActive: true,
          speaker: active.actorId || 'assistant',
        })
      }
    }
  }
  catch (err) {
    console.warn('Failed to relay caption to Stage-Mate:', err)
  }
})

if (typeof window !== 'undefined') {
  (window as any).__AIRI_DEVTOOLS_MATE_SPEECH__ = async (text: string) => {
    const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
    const { electronStageMateSendCaption } = await import('@proj-airi/stage-shared')
    const sendCaption = useElectronEventaInvoke(electronStageMateSendCaption)
    return await sendCaption({ text, isActive: true, speaker: 'AIRI' })
  }
}

onClickOutside(popoverRef, (event) => {
  const target = event.target as HTMLElement
  if (target && target.closest('.control-strip-btn')) {
    return
  }
  activePopover.value = null
})

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

const popoverPlacement = computed(() => {
  if (props.mode === 'mobile') {
    return dockedEdge.value === 'left' ? 'right' : 'left'
  }
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
  if (!isFullyExpanded.value) {
    return 52
  }
  const N = activeButtons.value.length
  return N === 0 ? 52 : 52 + 44 * N
})

const containerStyle = computed(() => {
  if (props.mode === 'mobile') {
    const styles: Record<string, string> = {
      top: '50%',
      transform: 'translateY(-50%)',
    }
    if (dockedEdge.value === 'left') {
      styles.left = '0px'
    }
    else {
      styles.right = '0px'
    }
    return styles
  }
  if (isElectron.value) {
    const styles: Record<string, string> = {
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
    if (activePopover.value) {
      if (orientation.value === 'vertical') {
        const windowHeight = Math.max(500, stripLength.value)
        styles.top = `${(windowHeight - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'right') {
          styles.left = '0px'
        }
        else {
          styles.left = '276px'
        }
      }
      else {
        const windowWidth = Math.max(500, stripLength.value)
        styles.left = `${(windowWidth - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'bottom') {
          styles.top = '0px'
        }
        else {
          styles.top = '452px'
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

// Dragging states
const isDragging = ref(false)
let isMouseDown = false
let startMouseX = 0
let startMouseY = 0
let startPosX = 0
let startPosY = 0
let dragDistance = 0
let isTouchEventState = false
let startTouchScreenX = 0
let startTouchScreenY = 0
let startWindowBounds: { x: number, y: number, width: number, height: number } | null = null

async function onDragStart(e: MouseEvent | TouchEvent) {
  if (props.mode === 'mobile') {
    collapsed.value = !collapsed.value
    return
  }

  if ('button' in e && e.button !== 0)
    return

  isMouseDown = true
  dragDistance = 0
  isTouchEventState = 'touches' in e

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  startMouseX = clientX
  startMouseY = clientY
  startPosX = position.value.x
  startPosY = position.value.y

  if (isTouchEventState && isElectron.value) {
    const touch = (e as TouchEvent).touches[0]
    startTouchScreenX = touch.screenX
    startTouchScreenY = touch.screenY
    try {
      startWindowBounds = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:get-bounds')
    }
    catch (err) {
      console.error('Failed to get bounds for touch drag:', err)
      startWindowBounds = null
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onDragging)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragging, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }
}

async function onDragging(e: MouseEvent | TouchEvent) {
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
    if (isTouchEventState) {
      if (dragDistance >= 4 && startWindowBounds) {
        const touch = (e as TouchEvent).touches[0]
        const deltaX = touch.screenX - startTouchScreenX
        const deltaY = touch.screenY - startTouchScreenY
        try {
          await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:set-bounds', [{
            x: Math.round(startWindowBounds.x + deltaX),
            y: Math.round(startWindowBounds.y + deltaY),
            width: startWindowBounds.width,
            height: startWindowBounds.height,
          }])
        }
        catch (err) {
          console.error('Failed to set bounds on touch drag:', err)
        }
      }
    }
    else {
      if (dragDistance >= 4) {
        cleanupDragListeners()
        isMouseDown = false
        isDragging.value = false
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('control-strip:drag-start'))
        }
      }
    }
  }
  else {
    if (isDragging.value) {
      const deltaX = startMouseX - clientX
      const deltaY = startMouseY - clientY
      position.value.x = Math.max(10, Math.min(window.innerWidth - 72, startPosX + deltaX))
      position.value.y = Math.max(10, Math.min(window.innerHeight - 300, startPosY + deltaY))
    }
  }
}

let clickTimer: NodeJS.Timeout | null = null

function handlePerpendicularClick() {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    toggleOrientation()
  }
  else {
    clickTimer = setTimeout(() => {
      clickTimer = null
      collapsed.value = !collapsed.value
    }, 250)
  }
}

function onDragEnd() {
  const wasDown = isMouseDown
  const wasDragging = isDragging.value
  cleanupDragListeners()
  isMouseDown = false
  isDragging.value = false
  isTouchEventState = false
  startWindowBounds = null

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

  const menuButtons = ['actor-characters', 'actor-avatars', 'actor-wardrobe', 'actor-motions', 'actor-motion-playground', 'actor-all-emotions', 'actor-vfx', 'actor-selfies', 'actor-macaron', 'gemini-voice', 'stage-atmosphere']
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
  dispatchAction(actionId)
}

function handleRightClick(e: MouseEvent) {
  e.preventDefault()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
  }
}

function handleContainerClick() {
  if (autoHideMode.value && !isFullyExpanded.value) {
    collapsed.value = false
  }
}

function toggleOrientation() {
  if (props.mode === 'mobile')
    return
  controlStripStore.toggleOrientation()
}
</script>

<template>
  <div
    :class="[
      'absolute pointer-events-auto select-none',
      props.mode === 'mobile' ? 'z-45' : '',
      'bg-white/95 dark:bg-neutral-900/85',
      'backdrop-blur-xl border border-neutral-300/80 dark:border-neutral-800/80',
      'shadow-2xl shadow-black/10 rounded-full',
      isDragging ? 'scale-102 border-primary-500/30 shadow-primary-500/5' : '',
      orientation === 'vertical' ? 'flex flex-col items-center py-2 px-1 gap-2 w-12' : 'flex flex-row items-center px-2 py-1 gap-2 h-12',
      autoHideTabClasses,
    ]"
    :style="containerStyle"
    @click="handleContainerClick"
    @contextmenu="handleRightClick"
    @mouseenter="onContainerMouseEnter"
    @mouseleave="onContainerMouseLeave"
  >
    <!-- AUTO-HIDE TAB HANDLE -->
    <div
      v-if="autoHideMode && !isFullyExpanded"
      class="h-9 w-9 flex cursor-pointer items-center justify-center text-neutral-800 dark:text-neutral-100"
      title="Click to Pin Control Strip"
      @click="collapsed = false"
    >
      <span
        :class="[
          'text-2xl transition-all duration-200',
          (dockedEdge === 'left' || dockedEdge === 'right') ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear',
          dockedEdge === 'right' ? 'rotate-180' : '',
          dockedEdge === 'bottom' ? 'rotate-180' : '',
        ]"
      />
    </div>

    <!-- TOP/LEFT ENDCAP: Perpendicular Drag & Layout Handle -->
    <button
      v-else
      :class="[
        'relative flex items-center justify-center overflow-hidden',
        'w-9 h-9 rounded-full',
        'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20',
        'border border-neutral-200 dark:border-white/10',
        'text-neutral-800 dark:text-neutral-100',
        'transition-all duration-200',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      ]"
      title="Drag to Reposition | Click to Collapse/Expand | Double Click to Toggle Layout"
      @mousedown="onDragStart"
      @touchstart="onDragStart"
      @mouseenter="isHoveredHandle = true"
      @mouseleave="isHoveredHandle = false"
      @click.stop
    >
      <!-- Icon fades out on hover -->
      <span
        :class="[
          'text-lg absolute transition-all duration-200 ease-in-out',
          collapsed ? 'i-ph:dots-six-bold scale-110' : (orientation === 'vertical' ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear'),
          isHoveredHandle ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
        ]"
      />

      <!-- Short label fades in on hover -->
      <span
        :class="[
          'text-[9px] font-extrabold uppercase tracking-wider text-center px-0.5 leading-none absolute transition-all duration-200 ease-in-out',
          isHoveredHandle ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
        ]"
      >
        {{ collapsed ? 'Show' : 'Hide' }}
      </span>
    </button>

    <!-- CORE INTERACTIVE BUTTONS -->
    <div
      v-if="isFullyExpanded"
      :class="[
        orientation === 'vertical' ? 'flex flex-col items-center gap-2' : 'flex flex-row items-center gap-2',
      ]"
    >
      <button
        v-for="btn in buttonPresentation"
        :key="btn.id"
        :class="[
          'relative flex items-center justify-center overflow-hidden',
          'w-9 h-9 rounded-full border border-neutral-200 dark:border-white/10',
          'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20 text-neutral-800 dark:text-neutral-100',
          'transition-all duration-200 hover:scale-105 cursor-pointer control-strip-btn shadow-sm',
          btn.id === 'stage' && controlStripStore.stageDisabled ? 'opacity-40 grayscale cursor-not-allowed' : '',
          activePopover === btn.id ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-transparent dark:ring-primary-400 bg-primary-500/15' : '',
        ]"
        :title="btn.title"
        @mouseenter="hoveredButtonId = btn.id"
        @mouseleave="hoveredButtonId = null"
        @click="handleAction(btn.id)"
        @contextmenu.prevent.stop="openPresetPopover(btn.id)"
      >
        <!-- Icon fades out on hover -->
        <span
          :class="[
            btn.icon,
            btn.iconColor,
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
          {{ btn.shortLabel }}
        </span>

        <!-- Status dot: single descriptor-driven badge (was 21 inline branches) -->
        <span v-if="btn.dot" :class="btn.dot" />
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
          'absolute z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-3 text-neutral-800 dark:text-neutral-200',
          popoverPlacement === 'bottom' ? 'top-full mt-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'top' ? 'bottom-full mb-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'right' ? 'left-full ml-3 top-1/2 -translate-y-1/2' : '',
          popoverPlacement === 'left' ? 'right-full mr-3 top-1/2 -translate-y-1/2' : '',
          activePopover === 'actor-motion-playground'
            ? 'w-[360px] sm:w-[380px] max-w-[92vw] max-h-[85vh] overflow-y-auto scrollbar-thin'
            : 'w-64 max-w-xs max-h-[440px] overflow-y-auto scrollbar-thin',
        ]"
        @click.stop
      >
        <!-- REGISTRY-DRIVEN POPOVERS (extracted so far) -->
        <component
          :is="STRIP_POPOVER_COMPONENTS[activePopover as string]"
          v-if="activePopover && STRIP_POPOVER_COMPONENTS[activePopover]"
          @close="activePopover = null"
        />

        <!-- Selfies stays shell-rendered: it needs the capture channel, which must
             stay single-owner. The cast covers useControlStripSelfie typing its
             provider as `{ type: string }`, dropping id/url/title. -->
        <SelfiesPopover
          v-if="activePopover === 'actor-selfies'"
          :selfies="selfies as any"
          :countdown="selfieCountdown"
          @take-selfie="triggerSelfie"
          @select-background="selectSelfieBackground"
          @close="activePopover = null"
        />
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
