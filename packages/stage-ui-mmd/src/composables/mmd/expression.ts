import type { MMD } from '@moeru/three-mmd'

import { ref } from 'vue'

/**
 * MMD morph target names for facial expressions.
 * Maps VRM-style expression names to common MMD morph target names (Japanese).
 */
const EXPRESSION_MORPH_MAP: Record<string, string[]> = {
  angry: ['怒り', '怒る'],
  happy: ['笑い', 'にこり', 'にっこり'],
  neutral: [],
  relaxed: ['にこり'],
  sad: ['悲しい', '困る'],
  surprised: ['驚き', 'びっくり'],
}

// English fallback morph names
const EXPRESSION_MORPH_MAP_EN: Record<string, string[]> = {
  angry: ['angry'],
  happy: ['smile', 'happy'],
  neutral: [],
  relaxed: ['smile'],
  sad: ['sad', 'sorrow'],
  surprised: ['surprised', 'shock'],
}

interface MorphTransition {
  targetMorphs: Map<number, number>
  progress: number
  duration: number
}

/**
 * MMD expression controller using morph targets.
 *
 * Use when:
 * - Applying facial expressions to an MMD model via morph targets
 *
 * Expects:
 * - A loaded MMD model with morph target dictionary and influences array
 */
export function useMMDEmote(mmd: MMD) {
  const currentEmotion = ref<string | null>(null)
  const transition = ref<MorphTransition | null>(null)
  const activeMorphWeights = ref(new Map<number, number>())

  function resolveMorphIndices(expressionName: string): Map<number, number> {
    const dict = mmd.mesh.morphTargetDictionary
    if (!dict) return new Map()

    const result = new Map<number, number>()

    // If it's a direct morph target name in the model, use it!
    if (dict[expressionName] != null) {
      result.set(dict[expressionName], 1.0)
      return result
    }

    // Try Japanese names first
    const jpNames = EXPRESSION_MORPH_MAP[expressionName]
    if (jpNames) {
      for (const name of jpNames) {
        if (dict[name] != null) {
          result.set(dict[name], 0.7)
          break
        }
      }
    }

    // Fallback to English names
    if (result.size === 0) {
      const enNames = EXPRESSION_MORPH_MAP_EN[expressionName]
      if (enNames) {
        for (const name of enNames) {
          if (dict[name] != null) {
            result.set(dict[name], 0.7)
            break
          }
        }
      }
    }

    return result
  }

  function setExpression(expressionName: string, intensity = 1.0, duration = 0.4) {
    console.log('[useMMDEmote] setExpression requested:', expressionName, 'intensity:', intensity)
    if (currentEmotion.value === expressionName) return

    currentEmotion.value = expressionName
    const targetMorphs = resolveMorphIndices(expressionName)
    console.log('[useMMDEmote] resolved targetMorphs:', targetMorphs)

    // Apply directly for testing to see if it bypasses any issues!
    if (mmd.mesh.morphTargetInfluences) {
      for (const [index, weight] of targetMorphs) {
        console.log('[useMMDEmote] Applying weight DIRECTLY to mesh:', index, 'weight:', weight)
        mmd.mesh.morphTargetInfluences[index] = weight
      }
    } else {
      console.warn('[useMMDEmote] mesh.morphTargetInfluences is MISSING!')
    }

    transition.value = {
      duration,
      progress: 0,
      targetMorphs,
    }
  }

  function resetExpression(duration = 0.6) {
    currentEmotion.value = null
    transition.value = {
      duration,
      progress: 0,
      targetMorphs: new Map(),
    }
  }

  function update(delta: number) {
    if (!mmd.mesh.morphTargetInfluences) return

    const t = transition.value
    if (!t) {
      // No transition active: continuously apply active morph weights to override animation mixer!
      for (const [index, weight] of activeMorphWeights.value) {
        if (mmd.mesh.morphTargetInfluences[index] != null) {
          mmd.mesh.morphTargetInfluences[index] = weight
        }
      }
      return
    }

    t.progress = Math.min(1, t.progress + delta / t.duration)
    const easedProgress = easeInOutCubic(t.progress)

    // Collect all morph indices that need updating: currently active + new targets
    const allIndices = new Set([...activeMorphWeights.value.keys(), ...t.targetMorphs.keys()])

    for (const index of allIndices) {
      const currentWeight = activeMorphWeights.value.get(index) ?? 0
      const targetWeight = t.targetMorphs.get(index) ?? 0
      const blended = lerp(currentWeight, targetWeight, easedProgress)

      if (mmd.mesh.morphTargetInfluences[index] != null) {
        mmd.mesh.morphTargetInfluences[index] = blended
      }

      if (t.progress >= 1) {
        if (targetWeight === 0) {
          // Morph is not in the new expression — remove it from the active set
          activeMorphWeights.value.delete(index)
        } else {
          activeMorphWeights.value.set(index, targetWeight)
        }
      }
    }

    if (t.progress >= 1) {
      transition.value = null
    }
  }

  return {
    currentEmotion,
    resetExpression,
    setExpression,
    update,
  }
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
