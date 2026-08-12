import { defineStore } from 'pinia'
import { toRef } from 'vue'

import { useSettingsCaptions } from './captions'
import { useSettingsChat } from './chat'
import { useSettingsControlStrip } from './control-strip'
import { useSettingsControlsIsland } from './controls-island'
import { useSettingsGeneral } from './general'
import { useSettingsLive2d } from './live2d'
import { useSettingsSpine } from './spine'
import { useSettingsStageModel } from './stage-model'
import { useSettingsTheme } from './theme'
import { useSettingsUserProfile } from './user-profile'

// Export sub-stores
export * from './audio-device'
export * from './chat'
export * from './control-strip'
export * from './controls-island'
export * from './general'
export * from './live2d'
export * from './spine'
export * from './stage-model'
export * from './theme'
// Export constants
export { DEFAULT_THEME_COLORS_HUE } from './theme'
export * from './user-profile'

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
  const spine = useSettingsSpine()

  const userProfile = useSettingsUserProfile()

  async function resetState() {
    await stageModel.resetState()
    chat.resetState()
    general.resetState()
    live2d.resetState()
    theme.resetState()
    controlsIsland.resetState()
    controlStrip.resetState()
    captions.resetState()
    spine.resetState()
    userProfile.resetState()
  }

  return {
    // Core settings
    disableTransitions: toRef(general, 'disableTransitions'),
    usePageSpecificTransitions: toRef(general, 'usePageSpecificTransitions'),
    language: toRef(general, 'language'),
    remoteSyncEnabled: toRef(general, 'remoteSyncEnabled'),
    websocketSecureEnabled: toRef(general, 'websocketSecureEnabled'),
    sendMode: toRef(chat, 'sendMode'),
    streamIdleTimeoutMs: toRef(chat, 'streamIdleTimeoutMs'),

    // Stage model settings
    stageModelRenderer: toRef(stageModel, 'stageModelRenderer'),
    stageModelSelected: toRef(stageModel, 'stageModelSelected'),
    stageModelSelectedUrl: toRef(stageModel, 'stageModelSelectedUrl'),
    stageModelSelectedFile: toRef(stageModel, 'stageModelSelectedFile'),
    stageModelSelectedDisplayModel: toRef(stageModel, 'stageModelSelectedDisplayModel'),
    stageViewControlsEnabled: toRef(stageModel, 'stageViewControlsEnabled'),
    stageViewControlsMode: toRef(stageModel, 'stageViewControlsMode'),
    lastReloadReason: toRef(stageModel, 'lastReloadReason'),
    mmdTextureMap: toRef(stageModel, 'mmdTextureMap'),

    // Live2D settings
    live2dDisableFocus: toRef(live2d, 'live2dDisableFocus'),
    live2dFollowSpeed: toRef(live2d, 'live2dFollowSpeed'),
    live2dIdleAnimationEnabled: toRef(live2d, 'live2dIdleAnimationEnabled'),
    live2dAutoBlinkEnabled: toRef(live2d, 'live2dAutoBlinkEnabled'),
    live2dForceAutoBlinkEnabled: toRef(live2d, 'live2dForceAutoBlinkEnabled'),
    live2dShadowEnabled: toRef(live2d, 'live2dShadowEnabled'),
    live2dMaxFps: toRef(live2d, 'live2dMaxFps'),

    // Spine settings
    spineDefaultMixDuration: toRef(spine, 'spineDefaultMixDuration'),
    spineIdleAnimationEnabled: toRef(spine, 'spineIdleAnimationEnabled'),
    spineMaxFps: toRef(spine, 'spineMaxFps'),
    spineRenderScale: toRef(spine, 'spineRenderScale'),

    // Theme settings
    themeColorsHue: toRef(theme, 'themeColorsHue'),
    themeColorsHueDynamic: toRef(theme, 'themeColorsHueDynamic'),

    // UI settings
    allowVisibleOnAllWorkspaces: toRef(controlsIsland, 'allowVisibleOnAllWorkspaces'),
    alwaysOnTop: toRef(controlsIsland, 'alwaysOnTop'),
    controlsIslandIconSize: toRef(controlsIsland, 'controlsIslandIconSize'),

    // Control Strip settings
    controlStripOrientation: toRef(controlStrip, 'orientation'),
    controlStripInteractionMode: toRef(controlStrip, 'interactionMode'),
    controlStripStageMode: toRef(controlStrip, 'stageMode'),
    controlStripStageEnabled: toRef(controlStrip, 'stageEnabled'),
    controlStripButtons: toRef(controlStrip, 'buttons'),

    // Caption settings
    showCaptions: toRef(captions, 'showCaptions'),
    captionFontSize: toRef(captions, 'fontSize'),
    captionOpacity: toRef(captions, 'opacity'),
    captionDocking: toRef(captions, 'docking'),
    captionFollowStageVisibility: toRef(captions, 'followStageVisibility'),
    captionFollowStagePosition: toRef(captions, 'followStagePosition'),
    captionLayoutMode: toRef(captions, 'layoutMode'),
    captionResetTrigger: toRef(captions, 'resetTrigger'),
    triggerCaptionReset: captions.triggerReset,

    // Head-tethered caption (in-scene plank). Independent of the windowed caption.
    headTetheredCaptionEnabled: toRef(captions, 'headTetheredCaptionEnabled'),
    headTetheredCaptionOffset: toRef(captions, 'headTetheredCaptionOffset'),
    headTetheredCaptionFollowStrength: toRef(captions, 'headTetheredCaptionFollowStrength'),

    // Methods
    setThemeColorsHue: theme.setThemeColorsHue,
    applyPrimaryColorFrom: theme.applyPrimaryColorFrom,
    isColorSelectedForPrimary: theme.isColorSelectedForPrimary,
    initializeStageModel: stageModel.initializeStageModel,
    updateStageModel: stageModel.updateStageModel,
    resetState,
  }
})
