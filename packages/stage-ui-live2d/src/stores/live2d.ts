import type { Live2DModel } from 'pixi-live2d-display/cubism4'

import type { PixiLive2DInternalModel } from '../composables/live2d'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

type BroadcastChannelEvents
  = | BroadcastChannelEventShouldUpdateView

interface BroadcastChannelEventShouldUpdateView {
  type: 'live2d-should-update-view'
  reason?: string
}

export const defaultModelParameters = {
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  leftEyeOpen: 1,
  rightEyeOpen: 1,
  leftEyeSmile: 0,
  rightEyeSmile: 0,
  leftEyebrowLR: 0,
  rightEyebrowLR: 0,
  leftEyebrowY: 0,
  rightEyebrowY: 0,
  leftEyebrowAngle: 0,
  rightEyebrowAngle: 0,
  leftEyebrowForm: 0,
  rightEyebrowForm: 0,
  mouthOpen: 0,
  mouthForm: 0,
  cheek: 0,
  bodyAngleX: 0,
  bodyAngleY: 0,
  bodyAngleZ: 0,
  breath: 0,
}

export const useLive2d = defineStore('live2d', () => {
  const { post, data } = useBroadcastChannel<BroadcastChannelEvents, BroadcastChannelEvents>({ name: 'airi-stores-stage-ui-live2d' })
  const shouldUpdateViewHooks = ref(new Set<(reason?: string) => void>())
  const activeEmotionTimers = ref<Record<string, any>>({})
  const activeEmotionResets = ref<Record<string, () => void>>({})

  const model = shallowRef<Live2DModel<PixiLive2DInternalModel>>()

  const onShouldUpdateView = (hook: (reason?: string) => void) => {
    shouldUpdateViewHooks.value.add(hook)
    return () => {
      shouldUpdateViewHooks.value.delete(hook)
    }
  }

  function shouldUpdateView(reason?: string) {
    post({ type: 'live2d-should-update-view', reason })
    shouldUpdateViewHooks.value.forEach(hook => hook(reason))
  }

  watch(data, (event) => {
    if (event?.type === 'live2d-should-update-view') {
      shouldUpdateViewHooks.value.forEach(hook => hook(event.reason))
    }
  })

  const position = useLocalStorageManualReset<{ x: number, y: number }>('settings/live2d/position', { x: 0, y: 0 }) // position is relative to the center of the screen, units are %
  const positionInPercentageString = computed(() => ({
    x: `${position.value.x}%`,
    y: `${position.value.y}%`,
  }))
  const currentMotion = useLocalStorageManualReset<{ group: string, index?: number }>('settings/live2d/current-motion', () => ({ group: 'Idle', index: 0 }))
  const availableMotions = ref<{ motionName: string, motionIndex: number, fileName: string }[]>([])
  const motionMap = useLocalStorageManualReset<Record<string, string>>('settings/live2d/motion-map', {})
  const scale = useLocalStorageManualReset('settings/live2d/scale', 1)

  // Meta information from CDI and EXP files (In-memory refs to prevent localStorage QuotaExceededError)
  const availableExpressions = ref<{ name: string, fileName: string }[]>([])
  const parameterMetadata = ref<{ id: string, name: string, groupId?: string, groupName?: string }[]>([])
  const emotionMappings = useLocalStorageManualReset<Record<string, string>>('settings/live2d/emotion-mappings', {})
  const activeExpressions = useLocalStorageManualReset<Record<string, number>>('settings/live2d/active-expressions', {})
  const expressionData = ref<Array<{ name: string, fileName: string, data: any }>>([])

  // Live2D model parameters
  const modelParameters = useLocalStorageManualReset<Record<string, number>>('settings/live2d/parameters', defaultModelParameters)

  function resetState() {
    position.reset()
    currentMotion.reset()
    availableMotions.value = []
    motionMap.reset()
    scale.reset()
    availableExpressions.value = []
    parameterMetadata.value = []
    emotionMappings.reset()
    activeExpressions.reset()
    modelParameters.reset()
    shouldUpdateView()
  }

  return {
    position,
    positionInPercentageString,
    currentMotion,
    availableMotions,
    motionMap,
    scale,
    availableExpressions,
    parameterMetadata,
    emotionMappings,
    activeExpressions,
    expressionData,
    modelParameters,

    onShouldUpdateView,
    shouldUpdateView,
    resetState,
    model,

    /**
     * Trigger an emotion based on mapping or fallback.
     * Returns true if a mapping was found and triggered.
     */
    triggerEmotion(emotionKey: string, intensity: number = 1) {
      // 1. Find all fileNames mapped to this emotionKey (explicit mapping)
      let targetFileNames = Object.entries(emotionMappings.value)
        .filter(([_, mappedEmotion]) => mappedEmotion === emotionKey)
        .map(([fileName, _]) => fileName)

      // 2. Fallback: Case-insensitive match against available expressions if no explicit mapping
      if (targetFileNames.length === 0) {
        const matched = availableExpressions.value.find(
          e => e.name.toLowerCase() === emotionKey.toLowerCase(),
        )
        if (matched) {
          targetFileNames = [matched.fileName]
        }
      }

      if (targetFileNames.length === 0) {
        return false
      }

      for (const fileName of targetFileNames) {
        // FLUSH: If there's an active reset for this fileName, execute it now and clear timer
        if (activeEmotionTimers.value[fileName]) {
          clearTimeout(activeEmotionTimers.value[fileName])
          activeEmotionResets.value[fileName]?.()
          delete activeEmotionTimers.value[fileName]
          delete activeEmotionResets.value[fileName]
        }

        const matchedExp = availableExpressions.value.find(e => e.fileName === fileName)
        if (!matchedExp)
          continue

        const expEntry = expressionData.value.find((e: any) => e.fileName === fileName)
        if (expEntry?.data?.Parameters) {
          // Store original values for reset (capture stable state after flush)
          const originalValues: Record<string, number> = {}
          for (const param of expEntry.data.Parameters) {
            const id = param.Id || param.id
            const value = (param.Value ?? param.value) * intensity
            if (id !== undefined && value !== undefined) {
              originalValues[id] = modelParameters.value[id] ?? 0
              modelParameters.value[id] = value
            }
          }

          // Mark as active
          activeExpressions.value = { ...activeExpressions.value, [fileName]: 1 }

          // Define explicit reset logic
          const reset = () => {
            for (const [id, origValue] of Object.entries(originalValues)) {
              modelParameters.value[id] = origValue
            }
            activeExpressions.value = { ...activeExpressions.value, [fileName]: 0 }
            delete activeEmotionTimers.value[fileName]
            delete activeEmotionResets.value[fileName]
          }

          activeEmotionResets.value[fileName] = reset
          activeEmotionTimers.value[fileName] = setTimeout(reset, 2000)
        }
      }

      return true
    },
  }
})
