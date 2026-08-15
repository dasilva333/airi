import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { CUSTOMIZER_CATALOG } from '../../constants/control-customizer'

export interface ControlStripButton {
  id: string
  enabled: boolean
  label: string
  icon: string
}

// CRITICAL NOTICE: Bumping BUTTONS_CATALOG_VERSION will COMPLETELY WIPE every user's custom control strip button arrangement and force-reset them to defaults.
// * DO NOT bump this version simply for adding new button IDs or changing defaults.
// * The automatic merge logic below will safely append new defaults to existing user lists without wiping their custom states.
// * ONLY bump this version if there is a severe, incompatible breaking change in the data structure itself (e.g. data schema type changes) where old layouts are fundamentally broken.
const BUTTONS_CATALOG_VERSION = 'v4'

export const DEFAULT_BUTTONS: ControlStripButton[] = [
  { id: 'chat', enabled: true, label: 'Chat Toggle', icon: 'i-solar:chat-line-linear' },
  { id: 'actor-characters', enabled: true, label: 'Characters', icon: 'i-solar:users-group-rounded-outline' },
  { id: 'mic', enabled: true, label: 'Microphone Toggle', icon: 'i-solar:muted-linear' },
  { id: 'stage', enabled: true, label: 'Actor Stage', icon: 'i-solar:clapperboard-play-bold-duotone' },
  { id: 'caption', enabled: true, label: 'Captions', icon: 'i-ph:closed-captioning-duotone' },
  { id: 'gemini-session', enabled: true, label: 'Toggle Speech Session', icon: 'i-ph:sparkle' },
  { id: 'settings', enabled: true, label: 'Settings', icon: 'i-solar:settings-linear' },
  { id: 'layout', enabled: true, label: 'Customize Control Strip', icon: 'i-solar:widget-linear' },
  { id: 'viewport-auto-hide', enabled: true, label: 'Auto Hide / Always Show', icon: 'i-ph:eye-slash' },
  { id: 'gemini-witness', enabled: false, label: 'Witness Vision Mode', icon: 'i-solar:camera-linear' },
  { id: 'gemini-frequency', enabled: false, label: 'Proactive Interval', icon: 'i-solar:clock-circle-linear' },
  { id: 'gemini-tts', enabled: false, label: 'TTS Output Toggle', icon: 'i-solar:volume-loud-linear' },
  { id: 'gemini-voice', enabled: false, label: 'Voice Switch', icon: 'i-solar:user-speak-linear' },
  { id: 'gemini-schedule', enabled: false, label: 'Respect Schedule', icon: 'i-solar:calendar-linear' },
  { id: 'gemini-grounding', enabled: false, label: 'Google Search Grounding', icon: 'i-solar:global-linear' },
  { id: 'actor-selfies', enabled: false, label: 'Selfies', icon: 'i-solar:camera-bold-duotone' },
]

export const DEFAULT_MOBILE_BUTTONS: ControlStripButton[] = [
  { id: 'viewport-cycle-modes', enabled: true, label: 'Cycle Viewport Modes', icon: 'i-solar:cursor-bold-duotone' },
  { id: 'head-tethered-caption', enabled: true, label: 'Head-Tethered Caption', icon: 'i-solar:chat-round-call-bold-duotone' },
  { id: 'theme-mode', enabled: true, label: 'Theme Mode', icon: 'i-solar:sun-2-bold-duotone' },
  { id: 'actor-characters', enabled: true, label: 'Characters', icon: 'i-solar:users-group-rounded-outline' },
  { id: 'actor-avatars', enabled: true, label: 'Avatars', icon: 'i-solar:user-bold-duotone' },
  { id: 'actor-expressions', enabled: true, label: 'Expressions (Facial)', icon: 'i-solar:mask-happly-outline' },
  { id: 'gemini-session', enabled: true, label: 'Active Session', icon: 'i-ph:sparkle' },
  { id: 'actor-wardrobe', enabled: true, label: 'Wardrobe (Outfits)', icon: 'i-solar:t-shirt-outline' },
]

export function getDefaultControlStripButtons(): ControlStripButton[] {
  return isStageTamagotchi() ? DEFAULT_BUTTONS : DEFAULT_MOBILE_BUTTONS
}

export const useSettingsControlStrip = defineStore('settings-control-strip', () => {
  const orientation = useLocalStorageManualReset<'vertical' | 'horizontal'>('settings/control-strip/orientation', 'vertical')
  const stageMode = useLocalStorageManualReset<'positionMode' | 'dragMode' | 'tactileMode' | 'orbitMode'>('settings/control-strip/stage-mode', 'tactileMode')
  const interactionMode = computed({
    get: () => {
      const mode = stageMode.value
      if (mode === 'tactileMode')
        return 'tactile'
      if (mode === 'dragMode')
        return 'drag'
      if (mode === 'positionMode')
        return 'positioning'
      return 'orbit'
    },
    set: (val: 'tactile' | 'drag' | 'positioning' | 'orbit') => {
      if (val === 'tactile')
        stageMode.value = 'tactileMode'
      else if (val === 'drag')
        stageMode.value = 'dragMode'
      else if (val === 'positioning')
        stageMode.value = 'positionMode'
      else stageMode.value = 'orbitMode'
    },
  })
  const isAdvancedPositioningOpen = useLocalStorageManualReset<boolean>('settings/control-strip/advanced-positioning-open', false)
  const stageEnabled = useLocalStorageManualReset<boolean>('settings/stage-enabled', true)
  const chatOpen = useLocalStorageManualReset<boolean>('settings/chat-open', false)
  const captionOpen = useLocalStorageManualReset<boolean>('settings/caption-open', false)
  const backgroundTint = useLocalStorageManualReset<string>('settings/control-strip/background-tint', '#171717')
  const collapsed = useLocalStorageManualReset<boolean>('settings/control-strip/collapsed', false)
  const dockedEdge = useLocalStorageManualReset<'left' | 'right' | 'top' | 'bottom'>('settings/control-strip/docked-edge', 'right')
  const selfieIncludeBg = useLocalStorageManualReset<boolean>('settings/control-strip/selfie-include-bg', true)

  const defaultButtons = getDefaultControlStripButtons()
  const expectedVersion = isStageTamagotchi() ? BUTTONS_CATALOG_VERSION : `${BUTTONS_CATALOG_VERSION}-mobile`

  // NOTICE: buttons uses useLocalStorage directly (not the ManualReset wrapper) because
  // useLocalStorageManualReset has a shallow watcher that doesn't reliably propagate
  // array-reference replacements back to localStorage in the Electron multi-window context.
  // useLocalStorage owns its own serialization watcher and is the source of truth.
  const buttons = useLocalStorage<ControlStripButton[]>('settings/control-strip/buttons', defaultButtons)

  // On first load, check if stored data is from a stale catalog version or different platform.
  // Desktop preserves existing 'v4' and 'v5' configs without wiping user layouts.
  const storedVersion = localStorage.getItem('settings/control-strip/buttons-version')
  const isValidDesktopVersion = isStageTamagotchi() && (storedVersion === 'v4' || storedVersion === 'v5')
  const isValidMobileVersion = !isStageTamagotchi() && storedVersion === 'v4-mobile'

  if (!isValidDesktopVersion && !isValidMobileVersion) {
    buttons.value = [...defaultButtons]
    localStorage.setItem('settings/control-strip/buttons-version', expectedVersion)
  }
  else if (Array.isArray(buttons.value)) {
    // Version matches: merge carefully, preserving user's enabled states and custom order.
    // NOTICE: We validate against ALL_KNOWN_IDS (defaultButtons + full CUSTOMIZER_CATALOG)
    // because users can enable catalog items (like always-on-top) that aren't in defaultButtons.
    const allCatalogItems = CUSTOMIZER_CATALOG.flatMap(g => g.items)
    const allKnownIds = new Set([
      ...defaultButtons.map(b => b.id),
      ...allCatalogItems.map(i => i.id),
    ])

    let changed = false
    const existing = [...buttons.value]

    // 1. Remove buttons whose IDs no longer exist in either defaultButtons or the catalog
    const filtered = existing.filter(btn => allKnownIds.has(btn.id))
    if (filtered.length !== existing.length)
      changed = true

    // 2. Sync icons/labels from defaultButtons or catalog; preserve user's enabled state
    const updated = filtered.map((btn) => {
      const def = defaultButtons.find(d => d.id === btn.id)
      const catalogDef = allCatalogItems.find(c => c.id === btn.id)
      const canonical = def || catalogDef
      if (canonical && (btn.icon !== canonical.icon || btn.label !== canonical.label)) {
        changed = true
        return { ...btn, icon: canonical.icon, label: canonical.label }
      }
      return btn
    })

    // 3. Append any defaultButtons entries not yet in the user's list
    for (const def of defaultButtons) {
      if (!updated.some(btn => btn.id === def.id)) {
        updated.push({ ...def })
        changed = true
      }
    }

    if (changed)
      buttons.value = updated
  }

  function toggleOrientation() {
    orientation.value = orientation.value === 'vertical' ? 'horizontal' : 'vertical'
  }

  function cycleStageMode() {
    if (stageMode.value === 'tactileMode') {
      stageMode.value = 'dragMode'
    }
    else if (stageMode.value === 'dragMode') {
      stageMode.value = 'positionMode'
    }
    else if (stageMode.value === 'positionMode') {
      stageMode.value = 'orbitMode'
    }
    else {
      stageMode.value = 'tactileMode'
    }
  }

  function resetButtons() {
    const defaultButtons = getDefaultControlStripButtons()
    buttons.value = [...defaultButtons]
    const expectedVersion = isStageTamagotchi() ? BUTTONS_CATALOG_VERSION : `${BUTTONS_CATALOG_VERSION}-mobile`
    localStorage.setItem('settings/control-strip/buttons-version', expectedVersion)
  }

  function resetState() {
    orientation.reset()
    stageMode.reset()
    isAdvancedPositioningOpen.reset()
    stageEnabled.reset()
    chatOpen.reset()
    captionOpen.reset()
    resetButtons()
    backgroundTint.reset()
    collapsed.reset()
    selfieIncludeBg.reset()
  }

  return {
    orientation,
    stageMode,
    interactionMode,
    isAdvancedPositioningOpen,
    stageEnabled,
    chatOpen,
    captionOpen,
    buttons,
    backgroundTint,
    collapsed,
    dockedEdge,
    selfieIncludeBg,
    toggleOrientation,
    cycleStageMode,
    cycleInteractionMode: cycleStageMode,
    resetButtons,
    resetState,
  }
})
