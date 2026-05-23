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

// NOTICE: Bump this version string whenever DEFAULT_BUTTONS IDs or structure change significantly.
// Stale localStorage data (from old code shapes) will be discarded and replaced with fresh defaults.
const BUTTONS_CATALOG_VERSION = 'v4'

const DEFAULT_BUTTONS: ControlStripButton[] = [
  { id: 'chat', enabled: true, label: 'Chat Toggle', icon: 'i-solar:chat-line-linear' },
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
  { id: 'gemini-voice', enabled: false, label: 'Cycle Speakers', icon: 'i-solar:user-speak-linear' },
  { id: 'gemini-schedule', enabled: false, label: 'Respect Schedule', icon: 'i-solar:calendar-linear' },
  { id: 'gemini-grounding', enabled: false, label: 'Google Search Grounding', icon: 'i-solar:global-linear' },
]

export const useSettingsControlStrip = defineStore('settings-control-strip', () => {
  const orientation = useLocalStorageManualReset<'vertical' | 'horizontal'>('settings/control-strip/orientation', 'vertical')
  const stageMode = useLocalStorageManualReset<'positionMode' | 'dragMode' | 'tactileMode' | 'orbitMode'>('settings/control-strip/stage-mode', 'orbitMode')
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

  // NOTICE: buttons uses useLocalStorage directly (not the ManualReset wrapper) because
  // useLocalStorageManualReset has a shallow watcher that doesn't reliably propagate
  // array-reference replacements back to localStorage in the Electron multi-window context.
  // useLocalStorage owns its own serialization watcher and is the source of truth.
  const buttons = useLocalStorage<ControlStripButton[]>('settings/control-strip/buttons', DEFAULT_BUTTONS)

  // On first load, check if stored data is from a stale catalog version.
  // If so, wipe it and start fresh with DEFAULT_BUTTONS rather than silently
  // producing a partial/broken state from old code shapes.
  const storedVersion = localStorage.getItem('settings/control-strip/buttons-version')
  if (storedVersion !== BUTTONS_CATALOG_VERSION) {
    buttons.value = [...DEFAULT_BUTTONS]
    localStorage.setItem('settings/control-strip/buttons-version', BUTTONS_CATALOG_VERSION)
  }
  else if (Array.isArray(buttons.value)) {
    // Version matches: merge carefully, preserving user's enabled states and custom order.
    // NOTICE: We validate against ALL_KNOWN_IDS (DEFAULT_BUTTONS + full CUSTOMIZER_CATALOG)
    // because users can enable catalog items (like always-on-top) that aren't in DEFAULT_BUTTONS.
    // Previously this only checked DEFAULT_BUTTONS, which stripped user-added catalog items on reload.
    const allCatalogItems = CUSTOMIZER_CATALOG.flatMap(g => g.items)
    const allKnownIds = new Set([
      ...DEFAULT_BUTTONS.map(b => b.id),
      ...allCatalogItems.map(i => i.id),
    ])

    let changed = false
    const existing = [...buttons.value]

    // 1. Remove buttons whose IDs no longer exist in either DEFAULT_BUTTONS or the catalog
    const filtered = existing.filter(btn => allKnownIds.has(btn.id))
    if (filtered.length !== existing.length)
      changed = true

    // 2. Sync icons/labels from DEFAULT_BUTTONS or catalog; preserve user's enabled state
    const updated = filtered.map((btn) => {
      const def = DEFAULT_BUTTONS.find(d => d.id === btn.id)
      const catalogDef = allCatalogItems.find(c => c.id === btn.id)
      const canonical = def || catalogDef
      if (canonical && (btn.icon !== canonical.icon || btn.label !== canonical.label)) {
        changed = true
        return { ...btn, icon: canonical.icon, label: canonical.label }
      }
      return btn
    })

    // 3. Append any DEFAULT_BUTTONS entries not yet in the user's list
    for (const def of DEFAULT_BUTTONS) {
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
    buttons.value = [...DEFAULT_BUTTONS]
    localStorage.setItem('settings/control-strip/buttons-version', BUTTONS_CATALOG_VERSION)
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
    toggleOrientation,
    cycleStageMode,
    cycleInteractionMode: cycleStageMode,
    resetButtons,
    resetState,
  }
})
