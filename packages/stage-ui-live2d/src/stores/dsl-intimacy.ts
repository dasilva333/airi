/**
 * Dedicated DSL intimacy: raw, model-author-native score (0..100k+) keyed by model id.
 *
 * Owned by stage-ui-live2d (not the dating-sim store) so the DSL's absolute gates and
 * Bonus arithmetic stay faithful to manifest values. The project never polls this; the
 * UI reads it when it needs the normalized (0-100) projection via `dslIntimacyDisplay`.
 */

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

/** Hard ceiling observed in creator manifests (Flandre ladder tops at 73,850; buffer to 100,000). */
export const DSL_INTIMACY_MAX = 100_000

export const useDslIntimacyStore = defineStore('live2d-dsl-intimacy', () => {
  // Raw scores per Live2D model id. Persisted via localStorage so it survives sessions,
  // unlike the ephemeral VarFloats heap.
  const rawIntimacyByModel = useLocalStorageManualReset<Record<string, number>>('settings/live2d/dsl-intimacy', {})

  function getRaw(modelId: string | undefined): number {
    if (!modelId)
      return 0
    return rawIntimacyByModel.value[modelId] ?? 0
  }

  /** Add a delta (can be negative), clamped at 0 floor and DSL_INTIMACY_MAX ceiling. */
  function add(modelId: string | undefined, delta: number): number {
    if (!modelId)
      return 0
    const next = Math.max(0, Math.min(DSL_INTIMACY_MAX, getRaw(modelId) + delta))
    rawIntimacyByModel.value = { ...rawIntimacyByModel.value, [modelId]: next }
    return next
  }

  function set(modelId: string | undefined, value: number): number {
    if (!modelId)
      return 0
    const next = Math.max(0, Math.min(DSL_INTIMACY_MAX, value))
    rawIntimacyByModel.value = { ...rawIntimacyByModel.value, [modelId]: next }
    return next
  }

  /** Normalized 0–100 projection for HUD display. Never feeds back into gates. */
  function toDisplay(modelId: string | undefined): number {
    return Math.round((getRaw(modelId) / DSL_INTIMACY_MAX) * 100)
  }

  const displayByModel = computed(() => {
    const out: Record<string, number> = {}
    for (const id of Object.keys(rawIntimacyByModel.value))
      out[id] = Math.round(((rawIntimacyByModel.value[id] ?? 0) / DSL_INTIMACY_MAX) * 100)
    return out
  })

  function reset() {
    rawIntimacyByModel.reset()
  }

  return {
    rawIntimacyByModel,
    displayByModel,
    getRaw,
    add,
    set,
    toDisplay,
    reset,
  }
})
