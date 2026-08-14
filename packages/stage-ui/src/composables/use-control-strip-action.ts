import { useModelStore } from '@proj-airi/stage-ui-three'
import { useBroadcastChannel, useColorMode } from '@vueuse/core'

import { useAiriCardStore } from '../stores/modules/airi-card'
import { useLiveSessionStore } from '../stores/modules/live-session'
import { useSettings } from '../stores/settings'
import { useSettingsAudioDevice } from '../stores/settings/audio-device'
import { useSettingsControlStrip } from '../stores/settings/control-strip'

export function useControlStripAction() {
  const settingsStore = useSettings()
  const controlStripStore = useSettingsControlStrip()
  const settingsAudioDeviceStore = useSettingsAudioDevice()
  const liveSessionStore = useLiveSessionStore()
  const airiCardStore = useAiriCardStore()
  const colorMode = useColorMode()
  const { post: postControlStripAction } = useBroadcastChannel<string, string>({ name: 'airi-control-strip-actions' })

  function dispatchAction(actionId: string, options?: { skipBroadcast?: boolean }) {
    console.info(`[Control Strip Action Dispatcher] Executing action: "${actionId}"`)

    switch (actionId) {
      case 'head-tethered-caption':
        settingsStore.headTetheredCaptionEnabled = !settingsStore.headTetheredCaptionEnabled
        break

      case 'viewport-cycle-modes': {
        controlStripStore.cycleStageMode()
        const mode = controlStripStore.stageMode
        settingsStore.stageViewControlsEnabled = (mode === 'dragMode' || mode === 'positionMode')
        try {
          const modelStore = useModelStore()
          if (mode === 'tactileMode')
            modelStore.interactionMode = 'tactile'
          else if (mode === 'dragMode')
            modelStore.interactionMode = 'drag'
          else if (mode === 'positionMode')
            modelStore.interactionMode = 'positioning'
          else if (mode === 'orbitMode')
            modelStore.interactionMode = 'orbit'
        }
        catch {}
        break
      }

      case 'viewport-tactile': {
        controlStripStore.stageMode = 'tactileMode'
        settingsStore.stageViewControlsEnabled = false
        try {
          useModelStore().interactionMode = 'tactile'
        }
        catch {}
        break
      }

      case 'viewport-drag': {
        controlStripStore.stageMode = 'dragMode'
        settingsStore.stageViewControlsEnabled = true
        try {
          useModelStore().interactionMode = 'drag'
        }
        catch {}
        break
      }

      case 'viewport-orbit': {
        controlStripStore.stageMode = 'orbitMode'
        settingsStore.stageViewControlsEnabled = false
        try {
          useModelStore().interactionMode = 'orbit'
        }
        catch {}
        break
      }

      case 'viewport-positioning': {
        controlStripStore.stageMode = 'positionMode'
        settingsStore.stageViewControlsEnabled = true
        try {
          useModelStore().interactionMode = 'positioning'
        }
        catch {}
        break
      }

      case 'gemini-session':
        liveSessionStore.toggle()
        break

      case 'theme-mode':
        colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
        break

      case 'caption-theme-mode': {
        const themes: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system']
        const currIdx = themes.indexOf((settingsStore.captionThemeMode as any) || 'system')
        settingsStore.captionThemeMode = themes[(currIdx + 1) % themes.length]
        break
      }

      case 'caption-sync-position':
        settingsStore.captionFollowStagePosition = !settingsStore.captionFollowStagePosition
        break

      case 'caption-sync-visibility':
        settingsStore.captionFollowStageVisibility = !settingsStore.captionFollowStageVisibility
        break

      case 'caption-docking': {
        const DOCK_CYCLE = ['none', 'bottom', 'top', 'head'] as const
        const current = settingsStore.captionDocking ?? 'none'
        const next = DOCK_CYCLE[(DOCK_CYCLE.indexOf(current) + 1) % DOCK_CYCLE.length]
        settingsStore.captionDocking = next
        break
      }

      case 'caption-layout-mode':
        settingsStore.captionLayoutMode = settingsStore.captionLayoutMode === 'single' ? 'multi' : 'single'
        break

      case 'gemini-grounding':
        if (airiCardStore.activeCardId) {
          airiCardStore.toggleGrounding(airiCardStore.activeCardId)
        }
        break

      case 'gemini-tts':
        liveSessionStore.toggleOutputMode()
        break

      case 'stage':
        controlStripStore.stageEnabled = !controlStripStore.stageEnabled
        break

      case 'chat':
        controlStripStore.chatOpen = !controlStripStore.chatOpen
        break

      case 'caption':
        controlStripStore.captionOpen = !controlStripStore.captionOpen
        break

      case 'mic':
        settingsAudioDeviceStore.enabled = !settingsAudioDeviceStore.enabled
        break

      case 'layout':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
        }
        break
    }

    // Broadcast across windows if running in multi-window desktop context
    if (!options?.skipBroadcast) {
      postControlStripAction(actionId)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-strip:action', { detail: { action: actionId } }))
    }
  }

  return {
    dispatchAction,
  }
}
