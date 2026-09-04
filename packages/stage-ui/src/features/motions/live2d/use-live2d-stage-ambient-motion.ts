import type { Pose } from '@proj-airi/model-driver-magic-live2d'
import type { MagicModel } from '@proj-airi/motion-driver-magic'
import type { MaybeRefOrGetter } from 'vue'

import { createDriver } from '@proj-airi/model-driver-magic-live2d'
import { fit } from '@proj-airi/motion-driver-magic'
import {
  defaultLive2DBreathControlOptions,
  defaultLive2DMotionControlDynamics,
  useLive2DMotionControl,
} from '@proj-airi/stage-ui-live2d/stores'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

import { useSpeakingStore } from '../../../stores/audio'
import { live2dMotionMagicProfiles } from './profiles'
import { useLive2DMotionMagicSettings } from './settings'
import { toTrainingSequence } from './use-live2d-motion-magic'
import { applyLive2DMotionViewTarget, defaultLive2DMotionViewTargetState } from './view-target'

// In-memory model cache to prevent re-fitting on every component mount/unmount
let cachedIdleModel: MagicModel | undefined
let cachedSpeakingModel: MagicModel | undefined

function getOrCreateModels() {
  if (!cachedIdleModel) {
    const idleSeq = toTrainingSequence(live2dMotionMagicProfiles['idle-calm'].dataset, 30)
    cachedIdleModel = fit(idleSeq, {
      method: 'ar-hmm',
      stateCount: 5,
      order: 12,
      ridge: 0.003,
      iterations: 6,
    })
  }

  if (!cachedSpeakingModel) {
    const speakingSeq = toTrainingSequence(live2dMotionMagicProfiles['speaking-excited'].dataset, 30)
    cachedSpeakingModel = fit(speakingSeq, {
      method: 'ar-hmm',
      stateCount: 5,
      order: 12,
      ridge: 0.003,
      iterations: 6,
    })
  }

  return { idleModel: cachedIdleModel, speakingModel: cachedSpeakingModel }
}

export interface UseLive2DStageAmbientMotionOptions {
  modelId?: MaybeRefOrGetter<string | undefined>
}

/**
 * Orchestrates dynamic autoregressive ambient motion (AR-HMM) for Live2D models on stage.
 *
 * Smoothly switches between:
 * - Idle state (`!nowSpeaking`): gentle breathing and micro-saccades (`idle-calm`).
 * - Speaking state (`nowSpeaking`): expressive head tilts, nods, and body shifts (`speaking-excited`).
 */
export function useLive2DStageAmbientMotion(options?: UseLive2DStageAmbientMotionOptions) {
  const ownerId = 'stage-live2d-ambient-motion'
  const magicSettings = useLive2DMotionMagicSettings()
  const speakingStore = useSpeakingStore()
  const motionControl = useLive2DMotionControl()

  const isEnabled = computed(() => magicSettings.isModelEnabled(toValue(options?.modelId)))
  const previewTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const isPreviewing = ref(false)

  const isSpeaking = computed(() => (magicSettings.speechDynamicsEnabled && speakingStore.nowSpeaking) || isPreviewing.value)

  let isRunning = false

  const driver = createDriver<number | undefined>({
    target: {
      apply: (pose) => {
        const intensity = magicSettings.intensity
        const scaledPose: Pose = intensity === 1
          ? pose
          : {
              ...pose,
              headX: pose.headX * intensity,
              headY: pose.headY * intensity,
              headZ: pose.headZ * intensity,
              bodyX: pose.bodyX * intensity,
              bodyY: pose.bodyY * intensity,
              bodyZ: pose.bodyZ * intensity,
              eyeX: pose.eyeX * intensity,
              eyeY: pose.eyeY * intensity,
            }

        const finalPose = magicSettings.forceViewTarget
          ? applyLive2DMotionViewTarget(scaledPose, defaultLive2DMotionViewTargetState)
          : scaledPose

        motionControl.setPose(ownerId, finalPose, defaultLive2DMotionControlDynamics)
      },
      release: () => {
        motionControl.release(ownerId)
      },
    },
    generateOptions: () => ({ noiseScale: 0.8 }),
    skipMouthOpen: () => magicSettings.skipMouthOpen,
  })

  function start() {
    if (isRunning)
      return

    try {
      const { idleModel, speakingModel } = getOrCreateModels()
      const initialModel = isSpeaking.value ? speakingModel : idleModel
      driver.start(initialModel.toGenerator({ seed: Math.floor(Math.random() * 100000) }))
      motionControl.setBreath(ownerId, defaultLive2DBreathControlOptions)
      isRunning = true
    }
    catch (err) {
      console.error('[Live2D Ambient Motion] Failed to start:', err)
    }
  }

  function stop() {
    if (!isRunning)
      return

    driver.stop()
    motionControl.release(ownerId)
    motionControl.releaseBreath(ownerId)
    isRunning = false
  }

  function updateGenerator() {
    if (!isRunning)
      return

    try {
      const { idleModel, speakingModel } = getOrCreateModels()
      const targetModel = isSpeaking.value ? speakingModel : idleModel
      driver.replace(targetModel.toGenerator({ seed: Math.floor(Math.random() * 100000) }))
    }
    catch (err) {
      console.error('[Live2D Ambient Motion] Failed to switch generator:', err)
    }
  }

  function triggerPreview(durationMs = 3000) {
    if (previewTimer.value) {
      clearTimeout(previewTimer.value)
      previewTimer.value = null
    }

    isPreviewing.value = true
    previewTimer.value = setTimeout(() => {
      isPreviewing.value = false
      previewTimer.value = null
    }, durationMs)
  }

  watch(isEnabled, (enabled) => {
    if (enabled)
      start()
    else
      stop()
  }, { immediate: true })

  watch(isSpeaking, () => {
    if (isRunning)
      updateGenerator()
  })

  onScopeDispose(() => {
    if (previewTimer.value)
      clearTimeout(previewTimer.value)
    stop()
  })

  return {
    isEnabled,
    isSpeaking,
    isPreviewing,
    triggerPreview,
  }
}
