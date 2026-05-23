import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useSettingsControlsIsland = defineStore('settings-controls-island', () => {
  const allowVisibleOnAllWorkspaces = useLocalStorageManualReset<boolean>('settings/allow-visible-on-all-workspaces', true)
  const alwaysOnTop = useLocalStorageManualReset<boolean>('settings/always-on-top', true)
  const controlsIslandIconSize = useLocalStorageManualReset<'auto' | 'large' | 'small'>('settings/controls-island/icon-size', 'auto')

  // NOTICE: Same localStorage key as apps/stage-tamagotchi/src/renderer/stores/controls-island.ts.
  // Both stores share this key so ControlStrip.vue (packages/) can reactively read the value
  // without crossing the monorepo app→package import boundary.
  const fadeOnHoverEnabled = useLocalStorage<boolean>('controls-island/fade-on-hover-enabled', false)

  function resetState() {
    allowVisibleOnAllWorkspaces.reset()
    alwaysOnTop.value = true
    controlsIslandIconSize.reset()
  }

  return {
    allowVisibleOnAllWorkspaces,
    alwaysOnTop,
    controlsIslandIconSize,
    fadeOnHoverEnabled,
    resetState,
  }
})
