import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export type CaptionDocking = 'top' | 'bottom'
export type CaptionLayoutMode = 'single' | 'multi'

export const useSettingsCaptions = defineStore('settings-captions', () => {
  const showCaptions = useLocalStorageManualReset<boolean>('settings/captions/enabled', true)
  const fontSize = useLocalStorageManualReset<number>('settings/captions/font-size', 100)
  const opacity = useLocalStorageManualReset<number>('settings/captions/opacity', 20)
  const docking = useLocalStorageManualReset<CaptionDocking>('settings/captions/docking', 'bottom')
  const followStage = useLocalStorageManualReset<boolean>('settings/captions/follow-stage', false)
  const layoutMode = useLocalStorageManualReset<CaptionLayoutMode>('settings/captions/layout-mode', 'single')
  const resetTrigger = useLocalStorageManualReset<number>('settings/captions/reset-trigger', 0)

  function resetState() {
    showCaptions.reset()
    fontSize.reset()
    opacity.reset()
    docking.reset()
    followStage.reset()
    layoutMode.reset()
    resetTrigger.reset()
  }

  function triggerReset() {
    resetTrigger.value = Date.now()
  }

  return {
    docking,
    followStage,
    fontSize,
    layoutMode,
    opacity,
    resetState,
    resetTrigger,
    showCaptions,
    triggerReset,
  }
})
