import type { VRMCore } from '@pixiv/three-vrm-core'

import { ref } from 'vue'

interface EmotionState {
  expression?: {
    name: string
    value: number
    duration?: number
    curve?: (t: number) => number
  }[]
  blendDuration?: number
}

export function useVRMEmote(vrm: VRMCore) {
  const currentEmotion = ref<string | null>(null)
  const isTransitioning = ref(false)
  const transitionProgress = ref(0)
  // Only stores expressions that are part of the CURRENT emotion transition.
  // Everything else (blink, lip-sync, custom overlays) is left untouched.
  const currentExpressionValues = ref(new Map<string, number>())
  const targetExpressionValues = ref(new Map<string, number>())
  // Track which expressions the PREVIOUS emotion was managing,
  // so we can fade them out when switching emotions.
  const previouslyManagedExpressions = ref(new Set<string>())
  const resetTimeout = ref<number>()

  // Utility functions
  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t
  }

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
  }

  const clampIntensity = (value: number): number => {
    return Math.min(1, Math.max(0, value))
  }

  // Emotion states definition — values are the "full weight" targets;
  // actual applied weight is value × clamped intensity.
  // Using slightly lower values (0.7–0.8) for primary expressions to
  // prevent the "too raw / smiles too much" problem reported in #590.
  const emotionStates = new Map<string, EmotionState>([
    [
      'happy',
      {
        blendDuration: 0.4,
        expression: [
          { duration: 0.3, name: 'happy', value: 0.7 },
          { name: 'aa', value: 0.2 },
        ],
      },
    ],
    [
      'sad',
      {
        blendDuration: 0.4,
        expression: [
          { name: 'sad', value: 0.7 },
          { name: 'oh', value: 0.15 },
        ],
      },
    ],
    [
      'angry',
      {
        blendDuration: 0.3,
        expression: [
          { name: 'angry', value: 0.7 },
          { name: 'ee', value: 0.3 },
        ],
      },
    ],
    [
      'surprised',
      {
        blendDuration: 0.15,
        expression: [
          { name: 'surprised', value: 0.8 },
          { name: 'oh', value: 0.4 },
        ],
      },
    ],
    [
      'neutral',
      {
        blendDuration: 0.6,
        expression: [{ name: 'neutral', value: 1.0 }],
      },
    ],
    [
      'think',
      {
        blendDuration: 0.5,
        expression: [{ name: 'think', value: 0.7 }],
      },
    ],
    [
      'cool',
      {
        blendDuration: 0.3,
        expression: [{ name: 'Pixel glasses', value: 1.0 }],
      },
    ],
  ])

  // Expose the VRM for debugging (no megazord hack — the library handles defaults correctly)
  if (vrm.expressionManager) {
    if (typeof window !== 'undefined') {
      ;(window as any).vrm = vrm
      ;(window as any).expressionManager = vrm.expressionManager
    }
  }

  const clearResetTimeout = () => {
    if (resetTimeout.value) {
      clearTimeout(resetTimeout.value)
      resetTimeout.value = undefined
    }
  }

  const resolveExpressionName = (name: string): string | null => {
    if (!vrm.expressionManager) return null

    // Direct match
    if (vrm.expressionManager.getExpression(name)) return name

    // Case-insensitive fallback
    const lowerName = name.toLowerCase()
    const match = Object.keys(vrm.expressionManager.expressionMap).find((k) => k.toLowerCase() === lowerName)
    return match || null
  }

  const setEmotion = (emotionName: string, intensity = 1) => {
    clearResetTimeout()

    // eslint-disable-next-line no-console
    console.log('[VRMExpression] setEmotion called:', { emotionName, intensity })

    if (!emotionStates.has(emotionName)) {
      // Try to auto-register as a raw expression
      const targetName = resolveExpressionName(emotionName)
      if (targetName) {
        emotionStates.set(emotionName, {
          blendDuration: 0.3,
          expression: [{ name: targetName, value: intensity }],
        })
      } else {
        console.warn(`[VRMExpression] Emotion ${emotionName} not found and is not a valid VRM expression`)
        return
      }
    }

    const emotionState = emotionStates.get(emotionName)!
    // eslint-disable-next-line no-console
    console.log('[VRMExpression] Target state found:', emotionState)
    currentEmotion.value = emotionName
    isTransitioning.value = true
    transitionProgress.value = 0

    // Clear previous tracking
    currentExpressionValues.value.clear()
    targetExpressionValues.value.clear()

    const normalizedIntensity = clampIntensity(intensity)

    // ADDITIVE FIX: Only fade out expressions that the PREVIOUS emotion was managing.
    // Don't touch anything else (blink, lip-sync, custom overlays stay alive).
    for (const prevExprName of previouslyManagedExpressions.value) {
      const currentValue = vrm.expressionManager?.getValue(prevExprName) || 0
      currentExpressionValues.value.set(prevExprName, currentValue)
      targetExpressionValues.value.set(prevExprName, 0) // Fade out old emotions
    }

    // Set up target values for the NEW emotion's expressions
    for (const expr of emotionState.expression || []) {
      const resolvedName = resolveExpressionName(expr.name)
      if (!resolvedName) continue

      const currentValue = vrm.expressionManager?.getValue(resolvedName) || 0
      currentExpressionValues.value.set(resolvedName, currentValue)
      targetExpressionValues.value.set(resolvedName, expr.value * normalizedIntensity)
    }

    // Update the set of managed expressions for next transition
    previouslyManagedExpressions.value.clear()
    for (const expr of emotionState.expression || []) {
      const resolvedName = resolveExpressionName(expr.name)
      if (resolvedName) {
        previouslyManagedExpressions.value.add(resolvedName)
      }
    }
  }

  const setEmotionWithResetAfter = (emotionName: string, ms: number, intensity = 1) => {
    clearResetTimeout()
    setEmotion(emotionName, intensity)

    // Set timeout to reset to neutral
    resetTimeout.value = setTimeout(() => {
      setEmotion('neutral')
      resetTimeout.value = undefined
    }, ms) as unknown as number
  }

  /**
   * updateIntensity
   * Forcefully updates the intensity of the currently active emotion.
   * Useful for live-tracking interactions (e.g., tension-based reactions) where
   * we want the expression to follow a value 1:1 without its own internal blend timing.
   */
  const updateIntensity = (intensity: number) => {
    if (!currentEmotion.value) return

    const emotionState = emotionStates.get(currentEmotion.value)
    if (!emotionState) return

    const normalizedIntensity = clampIntensity(intensity)

    for (const expr of emotionState.expression || []) {
      const resolvedName = resolveExpressionName(expr.name)
      if (!resolvedName) continue

      const targetValue = expr.value * normalizedIntensity
      targetExpressionValues.value.set(resolvedName, targetValue)

      // To ensure 1:1 tracking, we sync the "current" (transition start) value to the target
      // This effectively jumps the intensity to the new value immediately, which is
      // desired when the caller (e.g. Wired Interaction) is already providing a smooth delta.
      currentExpressionValues.value.set(resolvedName, targetValue)
    }

    // Stop internal transition to ensure it doesn't override our manual update
    isTransitioning.value = false
    transitionProgress.value = 1.0
  }

  const update = (deltaTime: number) => {
    if (!currentEmotion.value) {
      if (isTransitioning.value) {
        isTransitioning.value = false
        transitionProgress.value = 0
      }
      return
    }

    const emotionState = emotionStates.get(currentEmotion.value)!
    if (isTransitioning.value) {
      const blendDuration = emotionState.blendDuration || 0.3
      transitionProgress.value += deltaTime / blendDuration
      if (transitionProgress.value >= 1.0) {
        transitionProgress.value = 1.0
        isTransitioning.value = false
      }
    }

    // ADDITIVE FIX: Only update expressions we're explicitly managing
    for (const [exprName, targetValue] of targetExpressionValues.value) {
      const startValue = currentExpressionValues.value.get(exprName) || 0
      const currentValue = lerp(startValue, targetValue, easeInOutCubic(transitionProgress.value))

      vrm.expressionManager?.setValue(exprName, currentValue)
    }
  }

  const addEmotionState = (emotionName: string, state: EmotionState) => {
    emotionStates.set(emotionName, state)
  }

  const removeEmotionState = (emotionName: string) => {
    emotionStates.delete(emotionName)
  }

  // Cleanup function
  const dispose = () => {
    clearResetTimeout()
  }

  return {
    addEmotionState,
    currentEmotion,
    dispose,
    isTransitioning,
    removeEmotionState,
    setEmotion,
    setEmotionWithResetAfter,
    update,
    updateIntensity,
  }
}
