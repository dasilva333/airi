import type { Live2DModel } from 'pixi-live2d-display/cubism4'

import type { PixiLive2DInternalModel } from '../composables/live2d'

import { debug } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

type BroadcastChannelEvents
  = | BroadcastChannelEventShouldUpdateView
    | BroadcastChannelEventTriggerMotion
    | BroadcastChannelEventTriggerEmotion

interface BroadcastChannelEventShouldUpdateView {
  type: 'live2d-should-update-view'
  reason?: string
}

interface BroadcastChannelEventTriggerMotion {
  type: 'live2d-trigger-motion'
  group: string
  index?: number
}

interface BroadcastChannelEventTriggerEmotion {
  type: 'live2d-trigger-emotion'
  name: string
  intensity: number
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
  const triggerMotionHooks = ref(new Set<(group: string, index?: number) => void>())
  const triggerEmotionHooks = ref(new Set<(name: string, intensity: number) => void>())
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

  const onTriggerMotion = (hook: (group: string, index?: number) => void) => {
    triggerMotionHooks.value.add(hook)
    return () => {
      triggerMotionHooks.value.delete(hook)
    }
  }

  const onTriggerEmotion = (hook: (name: string, intensity: number) => void) => {
    triggerEmotionHooks.value.add(hook)
    return () => {
      triggerEmotionHooks.value.delete(hook)
    }
  }

  function resolveMotionGroupAndIndex(group: string, index?: number) {
    let resolvedGroup = group
    let resolvedIndex = index

    // 1. Search mappings to see if group is a custom display name
    let targetFileName = group
    const mappedEntry = Object.entries(motionMap.value).find(([_, displayName]) => displayName === group)
    if (mappedEntry) {
      targetFileName = mappedEntry[0]
    }

    // 2. Resolve targetFileName to the actual Live2D track group and index from availableMotions
    const targetBase = targetFileName.split(/[\\/]/).pop()?.toLowerCase()
    const matched = availableMotions.value.find((m) => {
      if (m.fileName === targetFileName)
        return true
      const mBase = m.fileName.split(/[\\/]/).pop()?.toLowerCase()
      return !!targetBase && targetBase === mBase
    })

    if (matched) {
      resolvedGroup = matched.motionName
      resolvedIndex = matched.motionIndex
    }

    return { resolvedGroup, resolvedIndex }
  }

  function triggerMotion(group: string, index?: number) {
    const { resolvedGroup, resolvedIndex } = resolveMotionGroupAndIndex(group, index)
    debug('[Live2D Store] Posting trigger-motion event via BroadcastChannel:', { group: resolvedGroup, index: resolvedIndex })
    post({ type: 'live2d-trigger-motion', group: resolvedGroup, index: resolvedIndex })
    triggerMotionHooks.value.forEach(hook => hook(resolvedGroup, resolvedIndex))
  }

  watch(data, (event) => {
    debug('[Live2D Store] Received BroadcastChannel event:', event)
    if (event?.type === 'live2d-should-update-view') {
      shouldUpdateViewHooks.value.forEach(hook => hook(event.reason))
    }
    else if (event?.type === 'live2d-trigger-motion') {
      const { resolvedGroup, resolvedIndex } = resolveMotionGroupAndIndex(event.group, event.index)
      triggerMotionHooks.value.forEach(hook => hook(resolvedGroup, resolvedIndex))
    }
    else if (event?.type === 'live2d-trigger-emotion') {
      triggerEmotionHooks.value.forEach(hook => hook(event.name, event.intensity))
      executeTriggerEmotion(event.name, event.intensity)
    }
  })

  const position = useLocalStorageManualReset<{ x: number, y: number }>('settings/live2d/position', { x: 0, y: 0 }) // position is relative to the center of the screen, units are %
  const positionInPercentageString = computed(() => ({
    x: `${position.value.x}%`,
    y: `${position.value.y}%`,
  }))
  const currentMotion = useLocalStorageManualReset<{ group: string, index?: number }>('settings/live2d/current-motion', () => ({ group: 'Idle', index: 0 }))
  const availableMotions = useLocalStorageManualReset<{ motionName: string, motionIndex: number, fileName: string, sound?: string, text?: string, language?: string }[]>('settings/live2d/available-motions', () => [])
  const motionMap = useLocalStorageManualReset<Record<string, string>>('settings/live2d/motion-map', {})
  const scale = useLocalStorageManualReset('settings/live2d/scale', 1)

  // Meta information from CDI and EXP files (In-memory refs to prevent localStorage QuotaExceededError)
  const availableExpressions = useLocalStorageManualReset<{ name: string, fileName: string }[]>('settings/live2d/available-expressions', () => [])
  const parameterMetadata = ref<{ id: string, name: string, groupId?: string, groupName?: string }[]>([])
  const emotionMappings = useLocalStorageManualReset<Record<string, string>>('settings/live2d/emotion-mappings', {})
  const modelParamReplayDisabled = useLocalStorageManualReset<Record<string, boolean>>('settings/live2d/model-param-replay-disabled', {})
  const activeExpressions = useLocalStorageManualReset<Record<string, number>>('settings/live2d/active-expressions', {})
  const expressionData = ref<Array<{ name: string, fileName: string, data: any }>>([])

  // Live2D model parameters
  const modelParameters = useLocalStorageManualReset<Record<string, number>>('settings/live2d/parameters', defaultModelParameters)

  function resetState() {
    position.reset()
    currentMotion.reset()
    availableMotions.reset()
    motionMap.reset()
    scale.reset()
    availableExpressions.reset()
    parameterMetadata.value = []
    emotionMappings.reset()
    activeExpressions.reset()
    modelParameters.reset()
    modelParamReplayDisabled.reset()
    shouldUpdateView()
  }

  function executeTriggerEmotion(emotionKey: string, intensity: number = 1) {
    // 0. Direct match against available expressions fileName
    let targetFileNames = availableExpressions.value
      .filter(e => e.fileName === emotionKey || e.fileName.toLowerCase().endsWith(emotionKey.toLowerCase()) || emotionKey.toLowerCase().endsWith(e.fileName.toLowerCase()))
      .map(e => e.fileName)

    // 1. Find all fileNames mapped to this emotionKey (explicit mapping) if no direct match
    if (targetFileNames.length === 0) {
      targetFileNames = Object.entries(emotionMappings.value)
        .filter(([_, mappedEmotion]) => mappedEmotion === emotionKey)
        .map(([fileName, _]) => fileName)
    }

    // 2. Fallback: Case-insensitive match against available expressions if no explicit mapping
    if (targetFileNames.length === 0) {
      const matched = availableExpressions.value.find(
        e => e.name.toLowerCase() === emotionKey.toLowerCase(),
      )
      if (matched) {
        targetFileNames = [matched.fileName]
      }
    }

    // 3. Smart fuzzy match using emotion keyword clusters
    if (targetFileNames.length === 0) {
      const keyLower = emotionKey.toLowerCase()
      let searchKeywords = [keyLower]

      const emotionClusters = [
        ['happy', 'smile', 'joy', 'laugh', 'glad', 'fun', '喜', '笑'],
        ['angry', 'anger', 'mad', 'frown', 'disgust', 'upset', 'hate', '怒'],
        ['sad', 'cry', 'tear', 'sorrow', 'depressed', '泣', '悲'],
        ['surprise', 'shock', 'gasp', '驚'],
        ['blush', 'shy', 'embarrass', 'red', '照', '恥'],
        ['wink', 'smug', 'proud', 'heh', 'ドヤ'],
        ['think', 'confused', 'what', '困', '思'],
        ['sleep', 'close', '眠', '閉'],
      ]

      // Broaden the search keywords if the requested emotion belongs to a cluster
      const matchedCluster = emotionClusters.find(cluster => cluster.some(k => keyLower.includes(k)))
      if (matchedCluster) {
        searchKeywords = matchedCluster
      }

      const matched = availableExpressions.value.find(
        e => searchKeywords.some(k => e.name.toLowerCase().includes(k)) || keyLower.includes(e.name.toLowerCase().replace(/\.exp3$/, '')),
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

      const targetBase = fileName.split(/[\\/]/).pop()?.toLowerCase()
      const matchedExp = availableExpressions.value.find((e) => {
        if (e.fileName === fileName)
          return true
        const eBase = e.fileName.split(/[\\/]/).pop()?.toLowerCase()
        return !!targetBase && targetBase === eBase
      })
      if (!matchedExp)
        continue

      const expEntry = expressionData.value.find((e: any) => {
        if (e.fileName === fileName)
          return true
        const eBase = e.fileName.split(/[\\/]/).pop()?.toLowerCase()
        return !!targetBase && targetBase === eBase
      })
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
  }

  return {
    position,
    positionInPercentageString,
    currentMotion,
    availableMotions,
    activeMotionText: ref<{ text: string, language?: string } | null>(null),
    motionMap,
    scale,
    availableExpressions,
    parameterMetadata,
    emotionMappings,
    activeExpressions,
    expressionData,
    modelParameters,
    modelParamReplayDisabled,

    onShouldUpdateView,
    shouldUpdateView,
    onTriggerMotion,
    triggerMotion,
    onTriggerEmotion,
    triggerEmotion(emotionKey: string, intensity: number = 1) {
      console.info('[Live2D Store] Posting trigger-emotion event via BroadcastChannel:', { emotionKey, intensity })
      post({ type: 'live2d-trigger-emotion', name: emotionKey, intensity })
      triggerEmotionHooks.value.forEach(hook => hook(emotionKey, intensity))
      return executeTriggerEmotion(emotionKey, intensity)
    },
    resetState,
    model,
  }
})
