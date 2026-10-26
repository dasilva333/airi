<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useTheme } from '@proj-airi/ui'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, toRef, watch } from 'vue'
// Ported stores & states for Popovers

import SelfiesPopover from './popovers/SelfiesPopover.vue'

import { useControlStripAction } from '../../../composables/use-control-strip-action'
import { useControlStripButtonPresentation } from '../../../composables/use-control-strip-button-presentation'
import { installMateSpeechDevtoolsHook, useControlStripCaptionRelay } from '../../../composables/use-control-strip-caption-relay'
import { useControlStripDrag } from '../../../composables/use-control-strip-drag'
import { useControlStripGeometry } from '../../../composables/use-control-strip-geometry'
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

const activePopover = ref<string | null>(null)

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

// Shell geometry: auto-hide tab state, hover expansion, popover placement, strip
// length and container positioning. `activePopover` stays owned here — the
// Electron window-bounds contract depends on it.
const {
  autoHideMode,
  isFullyExpanded,
  onContainerMouseEnter,
  onContainerMouseLeave,
  handleContainerClick,
  autoHideTabClasses,
  popoverPlacement,
  containerStyle,
} = useControlStripGeometry({
  mode: toRef(props, 'mode'),
  orientation,
  dockedEdge,
  collapsed,
  activePopover,
  activeButtons,
  backgroundTint,
  isElectron,
  position,
})

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

// Single-owner relay for `airi-caption-overlay` -> Stage-Mate. The devtools hook
// ships with it so the two cannot drift apart.
useControlStripCaptionRelay({ isElectron })
installMateSpeechDevtoolsHook()

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

// Drag / perpendicular-click session. Electron mouse drag is delegated to the host
// through `control-strip:drag-start`; touch keeps direct set-bounds.
// `onDragging` / `onDragEnd` stay internal: they are bound to window listeners
// inside the composable, not to template handlers.
const { isDragging, onDragStart } = useControlStripDrag({
  mode: toRef(props, 'mode'),
  collapsed,
  position,
  isElectron,
  toggleOrientation,
})

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
