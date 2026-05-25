import { defineStore } from 'pinia'
import { toRef } from 'vue'

import { useSettingsCaptions } from './captions'
import { useSettingsChat } from './chat'
import { useSettingsControlStrip } from './control-strip'
import { useSettingsControlsIsland } from './controls-island'
import { useSettingsGeneral } from './general'
import { useSettingsLive2d } from './live2d'
import { useSettingsStageModel } from './stage-model'
import { useSettingsTheme } from './theme'

// Export sub-stores
export * from './audio-device'
export * from './chat'
export * from './control-strip'
export * from './controls-island'
export * from './general'
export * from './live2d'
export * from './stage-model'
export * from './theme'
// Export constants
export { DEFAULT_THEME_COLORS_HUE } from './theme'

/**
 * Unified settings store for backward compatibility.
 * This aggregates all sub-stores into one interface.
 *
 * @deprecated Use individual setting stores (useSettingsCore, useSettingsTheme, etc.) instead.
 * This store exists only for backward compatibility and will be removed in a future version.
 */
export const useSettings = defineStore('settings', () => {
  const chat = useSettingsChat()
  const general = useSettingsGeneral()
  const stageModel = useSettingsStageModel()
  const live2d = useSettingsLive2d()
  const theme = useSettingsTheme()
  const controlsIsland = useSettingsControlsIsland()
  const controlStrip = useSettingsControlStrip()
  const captions = useSettingsCaptions()

  async function resetState() {
    await stageModel.resetState()
    chat.resetState()
    general.resetState()
    live2d.resetState()
    theme.resetState()
    controlsIsland.resetState()
    controlStrip.resetState()
    captions.resetState()
  }

  return {
    // UI settings
    allowVisibleOnAllWorkspaces: toRef(controlsIsland, 'allowVisibleOnAllWorkspaces'),
    alwaysOnTop: toRef(controlsIsland, 'alwaysOnTop'),
    applyPrimaryColorFrom: theme.applyPrimaryColorFrom,
    captionDocking: toRef(captions, 'docking'),
    captionFollowStage: toRef(captions, 'followStage'),
    captionFontSize: toRef(captions, 'fontSize'),
    captionLayoutMode: toRef(captions, 'layoutMode'),
    captionOpacity: toRef(captions, 'opacity'),
    captionResetTrigger: toRef(captions, 'resetTrigger'),
    controlStripButtons: toRef(controlStrip, 'buttons'),
    controlStripInteractionMode: toRef(controlStrip, 'interactionMode'),

    // Control Strip settings
    controlStripOrientation: toRef(controlStrip, 'orientation'),
    controlStripStageEnabled: toRef(controlStrip, 'stageEnabled'),
    controlStripStageMode: toRef(controlStrip, 'stageMode'),
    controlsIslandIconSize: toRef(controlsIsland, 'controlsIslandIconSize'),
    // Core settings
    disableTransitions: toRef(general, 'disableTransitions'),
    initializeStageModel: stageModel.initializeStageModel,
    isColorSelectedForPrimary: theme.isColorSelectedForPrimary,
    language: toRef(general, 'language'),
    lastReloadReason: toRef(stageModel, 'lastReloadReason'),
    live2dAutoBlinkEnabled: toRef(live2d, 'live2dAutoBlinkEnabled'),

    // Live2D settings
    live2dDisableFocus: toRef(live2d, 'live2dDisableFocus'),
    live2dForceAutoBlinkEnabled: toRef(live2d, 'live2dForceAutoBlinkEnabled'),
    live2dIdleAnimationEnabled: toRef(live2d, 'live2dIdleAnimationEnabled'),
    live2dMaxFps: toRef(live2d, 'live2dMaxFps'),
    live2dShadowEnabled: toRef(live2d, 'live2dShadowEnabled'),
    mmdTextureMap: toRef(stageModel, 'mmdTextureMap'),
    remoteSyncEnabled: toRef(general, 'remoteSyncEnabled'),
    resetState,
    sendMode: toRef(chat, 'sendMode'),

    // Methods
    setThemeColorsHue: theme.setThemeColorsHue,

    // Caption settings
    showCaptions: toRef(captions, 'showCaptions'),

    // Stage model settings
    stageModelRenderer: toRef(stageModel, 'stageModelRenderer'),
    stageModelSelected: toRef(stageModel, 'stageModelSelected'),
    stageModelSelectedDisplayModel: toRef(stageModel, 'stageModelSelectedDisplayModel'),
    stageModelSelectedFile: toRef(stageModel, 'stageModelSelectedFile'),
    stageModelSelectedUrl: toRef(stageModel, 'stageModelSelectedUrl'),
    stageViewControlsEnabled: toRef(stageModel, 'stageViewControlsEnabled'),
    stageViewControlsMode: toRef(stageModel, 'stageViewControlsMode'),
    streamIdleTimeoutMs: toRef(chat, 'streamIdleTimeoutMs'),

    // Theme settings
    themeColorsHue: toRef(theme, 'themeColorsHue'),
    themeColorsHueDynamic: toRef(theme, 'themeColorsHueDynamic'),
    triggerCaptionReset: captions.triggerReset,
    updateStageModel: stageModel.updateStageModel,
    usePageSpecificTransitions: toRef(general, 'usePageSpecificTransitions'),
    websocketSecureEnabled: toRef(general, 'websocketSecureEnabled'),
  }
})
