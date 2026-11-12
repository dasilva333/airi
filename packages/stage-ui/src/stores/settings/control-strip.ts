import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { CUSTOMIZER_CATALOG } from '../../constants/control-customizer'

export interface ControlStripButton {
  id: string
  enabled: boolean
  label: string
  icon: string
}

export type ControlStripPreset = 'Desktop' | 'Basic' | 'Fun' | 'Custom'
export type TrayControlStripPreset = 'Basic' | 'Fun' | 'Custom'

// CRITICAL NOTICE: Bumping BUTTONS_CATALOG_VERSION will COMPLETELY WIPE every user's custom control strip button arrangement and force-reset them to defaults.
// * DO NOT bump this version simply for adding new button IDs or changing defaults.
// * The automatic merge logic below will safely append new defaults to existing user lists without wiping their custom states.
// * ONLY bump this version if there is a severe, incompatible breaking change in the data structure itself (e.g. data schema type changes) where old layouts are fundamentally broken.
const BUTTONS_CATALOG_VERSION = 'v5'

export const DEFAULT_BUTTONS: ControlStripButton[] = [
  { id: 'chat', enabled: true, label: 'Chat Toggle', icon: 'i-solar:chat-line-linear' },
  { id: 'actor-characters', enabled: true, label: 'Characters', icon: 'i-solar:users-group-rounded-outline' },
  { id: 'mic', enabled: true, label: 'Microphone Toggle', icon: 'i-solar:muted-linear' },
  { id: 'stage', enabled: true, label: 'Actor Stage', icon: 'i-solar:clapperboard-play-bold-duotone' },
  { id: 'stage-atmosphere', enabled: true, label: 'Stage & Chat Theme', icon: 'i-solar:magic-stick-3-linear' },
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
  { id: 'actor-selfies', enabled: false, label: 'Selfies', icon: 'i-solar:camera-linear' },
  { id: 'actor-macaron', enabled: false, label: 'Macaron Floatie', icon: 'i-solar:donut-bold-duotone' },
  { id: 'workspace', enabled: true, label: 'Workspace', icon: 'i-solar:code-square-linear' },
  { id: 'actor-all-emotions', enabled: true, label: 'All Emotions', icon: 'i-solar:emoji-funny-square-linear' },
  { id: 'actor-vfx', enabled: true, label: 'VFX & Auras', icon: 'i-solar:fire-linear' },
  { id: 'actor-motion-playground', enabled: true, label: 'Motion', icon: 'i-solar:walking-round-linear' },
]

export const DEFAULT_MOBILE_BUTTONS: ControlStripButton[] = [
  { id: 'chat', enabled: true, label: 'Chat Toggle', icon: 'i-solar:chat-line-linear' },
  { id: 'viewport-cycle-modes', enabled: true, label: 'Cycle Viewport Modes', icon: 'i-solar:cursor-linear' },
  { id: 'head-tethered-caption', enabled: true, label: 'Head-Tethered Caption', icon: 'i-solar:chat-round-line-linear' },
  { id: 'actor-motion-playground', enabled: true, label: 'Motion', icon: 'i-solar:walking-round-linear' },
  { id: 'actor-motions', enabled: true, label: 'Motions', icon: 'i-solar:running-2-linear' },
  { id: 'actor-all-emotions', enabled: true, label: 'All Emotions', icon: 'i-solar:emoji-funny-square-linear' },
  { id: 'actor-vfx', enabled: true, label: 'VFX & Auras', icon: 'i-solar:fire-linear' },
  { id: 'actor-selfies', enabled: true, label: 'Selfies', icon: 'i-solar:camera-linear' },
  // NOTICE (mobile deprecations, no version bump — the keyed merge handles
  // existing users): 'stage-atmosphere' (Stage Theme) is consolidated into
  // Quick Settings > Appearance; 'actor-wardrobe' (WEAR) stays in the catalog
  // but is no longer a default while it has no outfits to show. Previous
  // defaults ('theme-mode', 'actor-characters', 'actor-avatars', 'workspace')
  // remain valid catalog entries for existing strips.
]

export function getDefaultControlStripButtons(): ControlStripButton[] {
  return isStageTamagotchi() ? DEFAULT_BUTTONS : DEFAULT_MOBILE_BUTTONS
}

export const DEFAULT_BASIC_TRAY_BUTTONS: ControlStripButton[] = [
  { id: 'mic', enabled: true, label: 'Mic', icon: 'i-solar:microphone-3-bold' },
  { id: 'gemini-tts', enabled: true, label: 'Voice', icon: 'i-solar:volume-loud-bold' },
  { id: 'chat', enabled: true, label: 'TTS', icon: 'i-solar:chat-round-line-bold' },
  { id: 'gemini-witness', enabled: true, label: 'Vision', icon: 'i-solar:eye-bold' },
  { id: 'stage', enabled: true, label: 'Stage', icon: 'i-solar:box-bold' },
  { id: 'always-on-top', enabled: true, label: 'Sleep', icon: 'i-solar:moon-bold' },
  { id: 'actor-wardrobe', enabled: true, label: 'Outfit', icon: 'i-solar:t-shirt-bold' },
  { id: 'actor-motion-playground', enabled: true, label: 'Motion', icon: 'i-solar:running-round-bold' },
  { id: 'actor-all-emotions', enabled: true, label: 'Emotion', icon: 'i-solar:smile-circle-bold' },
  { id: 'actor-vfx', enabled: true, label: 'FX / Aura', icon: 'i-solar:stars-minimalistic-bold' },
  { id: 'caption', enabled: true, label: 'Record', icon: 'i-solar:record-circle-bold' },
]

export const DEFAULT_FUN_TRAY_BUTTONS: ControlStripButton[] = [
  { id: 'actor-wardrobe', enabled: true, label: 'Outfit', icon: 'i-solar:t-shirt-bold' },
  { id: 'actor-motion-playground', enabled: true, label: 'Motion', icon: 'i-solar:running-round-bold' },
  { id: 'actor-all-emotions', enabled: true, label: 'Emotion', icon: 'i-solar:smile-circle-bold' },
  { id: 'actor-vfx', enabled: true, label: 'FX / Aura', icon: 'i-solar:stars-minimalistic-bold' },
  { id: 'actor-motions', enabled: true, label: 'Dance', icon: 'i-solar:music-note-2-bold' },
  { id: 'actor-gunslinger', enabled: true, label: 'Arcade', icon: 'i-solar:gamepad-bold' },
  { id: 'actor-selfies', enabled: true, label: 'Selfie', icon: 'i-solar:camera-bold' },
  { id: 'stage-atmosphere', enabled: true, label: 'Stage FX', icon: 'i-solar:magic-stick-3-bold' },
  { id: 'actor-characters', enabled: true, label: 'Cast', icon: 'i-solar:users-group-rounded-bold' },
  { id: 'actor-macaron', enabled: true, label: 'Macaron', icon: 'i-solar:donut-bold-duotone' },
  { id: 'viewport-tactile', enabled: true, label: 'Tactile', icon: 'i-solar:heart-bold' },
]

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
  const stageDisabled = ref(false)
  const stageMateEnabled = useLocalStorageManualReset<boolean>('settings/stage-mate-enabled', false)
  const chatOpen = useLocalStorageManualReset<boolean>('settings/chat-open', !isStageTamagotchi())
  const captionOpen = useLocalStorageManualReset<boolean>('settings/caption-open', false)

  // Web default: chat is open by default on web/mobile stages.
  // Existing web sessions that had the legacy 'false' default are initialized to true once.
  if (!isStageTamagotchi() && typeof localStorage !== 'undefined') {
    if (localStorage.getItem('settings/control-strip/web-chat-defaulted') !== 'true') {
      chatOpen.value = true
      localStorage.setItem('settings/control-strip/web-chat-defaulted', 'true')
    }
  }
  const workspaceOpen = useLocalStorageManualReset<boolean>('settings/control-strip/workspace-open', false)
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
  const isValidMobileVersion = !isStageTamagotchi() && (storedVersion === 'v4-mobile' || storedVersion === 'v5-mobile')

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

    // On mobile/web, drop any legacy 'gemini-session' button slot. It used to
    // migrate into 'stage-atmosphere', but Stage Theme is deprecated on
    // mobile (consolidated into Quick Settings > Appearance), so there is
    // nothing to migrate it into. Also ensure 'chat' is present on the strip.
    if (!isStageTamagotchi()) {
      const geminiIdx = existing.findIndex(btn => btn.id === 'gemini-session')
      if (geminiIdx !== -1) {
        existing.splice(geminiIdx, 1)
        changed = true
      }
      if (!existing.some(btn => btn.id === 'chat')) {
        existing.unshift({
          id: 'chat',
          enabled: true,
          label: 'Chat Toggle',
          icon: 'i-solar:chat-line-linear',
        })
        changed = true
      }
    }
    else if (!existing.some(btn => btn.id === 'stage-atmosphere')) {
      // On desktop, add 'stage-atmosphere' right after 'stage' if missing
      const stageIdx = existing.findIndex(btn => btn.id === 'stage')
      const insertAt = stageIdx !== -1 ? stageIdx + 1 : existing.length
      existing.splice(insertAt, 0, {
        id: 'stage-atmosphere',
        enabled: true,
        label: 'Stage & Chat Theme',
        icon: 'i-solar:magic-stick-3-linear',
      })
      changed = true
    }

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

  // Presets & Multi-surface Control Strip Management
  const trayPreset = useLocalStorage<TrayControlStripPreset>('settings/control-strip/tray-preset', 'Basic')
  const customizerPreset = useLocalStorage<ControlStripPreset>('settings/control-strip/customizer-preset', 'Desktop')

  const basicButtons = useLocalStorage<ControlStripButton[]>('settings/control-strip/presets/basic', () => DEFAULT_BASIC_TRAY_BUTTONS.map(b => ({ ...b })))
  const funButtons = useLocalStorage<ControlStripButton[]>('settings/control-strip/presets/fun', () => DEFAULT_FUN_TRAY_BUTTONS.map(b => ({ ...b })))
  const customButtons = useLocalStorage<ControlStripButton[]>('settings/control-strip/presets/custom', () => DEFAULT_BASIC_TRAY_BUTTONS.map(b => ({ ...b })))

  interface ControlStripSyncSignal {
    type: string
    preset?: string
  }

  const { data: syncSignal, post: broadcastSync } = useBroadcastChannel<ControlStripSyncSignal, ControlStripSyncSignal>({
    name: 'airi:control-strip-sync',
  })

  watch(syncSignal, (signal) => {
    if (!signal)
      return
    try {
      if (signal.type === 'buttons-sync' || signal.type === 'preset-sync') {
        const storedCustom = localStorage.getItem('settings/control-strip/presets/custom')
        if (storedCustom)
          customButtons.value = JSON.parse(storedCustom)

        const storedBasic = localStorage.getItem('settings/control-strip/presets/basic')
        if (storedBasic)
          basicButtons.value = JSON.parse(storedBasic)

        const storedFun = localStorage.getItem('settings/control-strip/presets/fun')
        if (storedFun)
          funButtons.value = JSON.parse(storedFun)

        const storedDesktop = localStorage.getItem('settings/control-strip/buttons')
        if (storedDesktop)
          buttons.value = JSON.parse(storedDesktop)

        const storedTrayPreset = localStorage.getItem('settings/control-strip/tray-preset')
        if (storedTrayPreset) {
          const parsed = JSON.parse(storedTrayPreset) as TrayControlStripPreset
          if (['Basic', 'Fun', 'Custom'].includes(parsed))
            trayPreset.value = parsed
        }

        const storedCustomizerPreset = localStorage.getItem('settings/control-strip/customizer-preset')
        if (storedCustomizerPreset) {
          const parsed = JSON.parse(storedCustomizerPreset) as ControlStripPreset
          if (['Desktop', 'Basic', 'Fun', 'Custom'].includes(parsed))
            customizerPreset.value = parsed
        }
      }
    }
    catch (e) {
      console.warn('[control-strip] cross-window sync error:', e)
    }
  })

  const activeTrayButtons = computed<ControlStripButton[]>(() => {
    switch (trayPreset.value) {
      case 'Fun':
        return funButtons.value
      case 'Custom':
        return customButtons.value
      case 'Basic':
      default:
        return basicButtons.value
    }
  })

  const editingButtons = computed<ControlStripButton[]>({
    get() {
      switch (customizerPreset.value) {
        case 'Basic':
          return basicButtons.value
        case 'Fun':
          return funButtons.value
        case 'Custom':
          return customButtons.value
        case 'Desktop':
        default:
          return buttons.value
      }
    },
    set(val) {
      switch (customizerPreset.value) {
        case 'Basic':
          basicButtons.value = val
          break
        case 'Fun':
          funButtons.value = val
          break
        case 'Custom':
          customButtons.value = val
          break
        case 'Desktop':
        default:
          buttons.value = val
          break
      }
      broadcastSync({ type: 'buttons-sync', preset: customizerPreset.value })
    },
  })

  function setCustomizerPreset(preset: ControlStripPreset) {
    customizerPreset.value = preset
    broadcastSync({ type: 'preset-sync', preset })
  }

  function setTrayPreset(preset: TrayControlStripPreset) {
    trayPreset.value = preset
    broadcastSync({ type: 'preset-sync', preset })
  }

  function resetPreset(preset: ControlStripPreset) {
    switch (preset) {
      case 'Basic':
        basicButtons.value = DEFAULT_BASIC_TRAY_BUTTONS.map(b => ({ ...b }))
        break
      case 'Fun':
        funButtons.value = DEFAULT_FUN_TRAY_BUTTONS.map(b => ({ ...b }))
        break
      case 'Custom':
        customButtons.value = DEFAULT_BASIC_TRAY_BUTTONS.map(b => ({ ...b }))
        break
      case 'Desktop':
      default:
        resetButtons()
        break
    }
    broadcastSync({ type: 'buttons-sync', preset })
  }

  function resetState() {
    orientation.reset()
    stageMode.reset()
    isAdvancedPositioningOpen.reset()
    stageEnabled.reset()
    stageMateEnabled.reset()
    chatOpen.reset()
    captionOpen.reset()
    workspaceOpen.reset()
    resetButtons()
    resetPreset('Basic')
    resetPreset('Fun')
    resetPreset('Custom')
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
    stageDisabled,
    stageMateEnabled,
    chatOpen,
    captionOpen,
    workspaceOpen,
    buttons,
    trayPreset,
    customizerPreset,
    basicButtons,
    funButtons,
    customButtons,
    activeTrayButtons,
    editingButtons,
    setCustomizerPreset,
    setTrayPreset,
    resetPreset,
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
