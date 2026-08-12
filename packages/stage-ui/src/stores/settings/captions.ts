import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export type CaptionDocking = 'top' | 'bottom' | 'head' | 'none'
export type CaptionLayoutMode = 'single' | 'multi'

export const useSettingsCaptions = defineStore('settings-captions', () => {
  const showCaptions = useLocalStorageManualReset<boolean>('settings/captions/enabled', true)
  const fontSize = useLocalStorageManualReset<number>('settings/captions/font-size', 100)
  const opacity = useLocalStorageManualReset<number>('settings/captions/opacity', 20)
  const docking = useLocalStorageManualReset<CaptionDocking>('settings/captions/docking', 'none')
  const followStageVisibility = useLocalStorageManualReset<boolean>('settings/captions/follow-stage-visibility', true)
  const followStagePosition = useLocalStorageManualReset<boolean>('settings/captions/follow-stage-position', true)
  const layoutMode = useLocalStorageManualReset<CaptionLayoutMode>('settings/captions/layout-mode', 'single')
  const resetTrigger = useLocalStorageManualReset<number>('settings/captions/reset-trigger', 0)

  // Head-tethered caption plank (in-scene PIXI renderer). Independent of the
  // windowed caption above; both may run simultaneously. Live2D-only in MVP.
  const headTetheredCaptionEnabled = useLocalStorageManualReset<boolean>('settings/captions/head-tethered/enabled', false)
  const headTetheredCaptionOffset = useLocalStorageManualReset<{ x: number, y: number }>('settings/captions/head-tethered/offset', { x: 0, y: -40 })
  const headTetheredCaptionFollowStrength = useLocalStorageManualReset<number>('settings/captions/head-tethered/follow-strength', 100)

  function resetState() {
    showCaptions.reset()
    fontSize.reset()
    opacity.reset()
    docking.reset()
    followStageVisibility.reset()
    followStagePosition.reset()
    layoutMode.reset()
    resetTrigger.reset()
    headTetheredCaptionEnabled.reset()
    headTetheredCaptionOffset.reset()
    headTetheredCaptionFollowStrength.reset()
  }

  function triggerReset() {
    resetTrigger.value = Date.now()
  }

  return {
    showCaptions,
    fontSize,
    opacity,
    docking,
    followStageVisibility,
    followStagePosition,
    layoutMode,
    resetTrigger,
    headTetheredCaptionEnabled,
    headTetheredCaptionOffset,
    headTetheredCaptionFollowStrength,
    resetState,
    triggerReset,
  }
})
