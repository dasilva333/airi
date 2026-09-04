import type { Live2DMotionMagicProfileId } from './profiles'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { watch } from 'vue'

import { defaultLive2DMotionMagicProfileId, live2dMotionMagicProfiles } from './profiles'

const profileId = useLocalStorageManualReset('settings/live2d/magic/profile', defaultLive2DMotionMagicProfileId)
const skipMouthOpen = useLocalStorageManualReset('settings/live2d/magic/skip-mouth-open', true)
const forceViewTarget = useLocalStorageManualReset('settings/live2d/magic/force-view-target', true)

const enabled = useLocalStorageManualReset<boolean>('settings/live2d/magic/enabled', false)
const enabledModels = useLocalStorageManualReset<Record<string, boolean>>('settings/live2d/magic/enabled-models', {})
const speechDynamicsEnabled = useLocalStorageManualReset<boolean>('settings/live2d/magic/speech-dynamics-enabled', true)
const intensity = useLocalStorageManualReset<number>('settings/live2d/magic/intensity', 1.0)

function isKnownProfileId(value: unknown): value is Live2DMotionMagicProfileId {
  return typeof value === 'string' && Object.hasOwn(live2dMotionMagicProfiles, value)
}

watch(profileId, (value) => {
  // Persisted settings can outlive bundled profiles. Restore the default before runtime consumers
  // use the ID to access the profile registry.
  if (!isKnownProfileId(value))
    profileId.value = defaultLive2DMotionMagicProfileId
}, { flush: 'sync', immediate: true })

/** Persists production settings for the MAGIC Live2D motion driver. */
export const useLive2DMotionMagicSettings = defineStore('settings-live2d-motion-magic', () => {
  function isModelEnabled(modelId?: string): boolean {
    if (modelId && modelId in enabledModels.value)
      return Boolean(enabledModels.value[modelId])
    return enabled.value
  }

  function setModelEnabled(modelId: string | undefined, value: boolean) {
    if (modelId && modelId !== 'global') {
      enabledModels.value = { ...enabledModels.value, [modelId]: value }
    }
    else {
      enabled.value = value
    }
  }

  function resetState() {
    enabled.reset()
    enabledModels.reset()
    speechDynamicsEnabled.reset()
    intensity.reset()
    profileId.value = defaultLive2DMotionMagicProfileId
    skipMouthOpen.value = true
    forceViewTarget.value = true
  }

  return {
    enabled,
    enabledModels,
    speechDynamicsEnabled,
    intensity,
    isModelEnabled,
    setModelEnabled,
    profileId,
    skipMouthOpen,
    forceViewTarget,
    resetState,
  }
})
