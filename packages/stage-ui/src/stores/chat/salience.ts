/**
 * Chat salience store — Phase 6 surface for the RWKV late-layer Δh salience gate.
 *
 * What it does:
 * - After each completed turn, drives the web-rwkv worker's state-delta probe
 *   (`webRwkvStateDeltaEvent`) on the turn's display text, keeping the per-layer
 *   cosine deltas for the L9–L11 slice the Phase-4b harness validated, and a
 *   rolling 24-turn history for the Pre-Flight grounding drawer.
 * - Computes `hot` when the harness's `vote-2of3 @ 1.5×` rule fires (>= 2 late
 *   layers exceed per-layer control-mean × 1.5); control means are measured on
 *   session start ("CONTROL floor") or fallback to the harness-measured constants
 *   from the Phase-4b report.
 *
 * Why in stage-ui/src/stores/chat: this sits beside `recent-topics.ts` (Toggle 4
 * surface) and reads the same grounding-extension flag added in airi-card.ts.
 */

import { defineStore, storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useAiriCardStore } from '../modules/airi-card'

interface SalienceTurnMetrics {
  /** L9/L10/L11 per-layer cosine deltas (state split 12 × slice if tiny fallback handled upstream). */
  lateLayerDeltas: [number, number, number]
  lateLayerMean: number
  hot: boolean
  /** threshold applied to each late layer (1.5 × measured control mean or fallback const). */
  threshold: number
  controlMean: number
}

/**
 * Measured constants from Phase-4b harness report `04-toggle4-vote-sweep`:
 *  L9=0.1308, L10=0.0777, L11=0.0419 (CONTROL means), best multiplier 1.5 — vote-2of3.
 *  Fallback for cold-start before CONTROL session measures a fresh floor.
 */
const FALLBACK_CONTROL_MEAN = [0.1308, 0.0777, 0.0419] as const

/** The salience config in the card extension — persisted/toggled there. */
const SALIENCE_FLAG_KEY = 'salienceGateEnabled' as const

export const useChatSalienceStore = defineStore('chat-salience', () => {
  const cardStore = useAiriCardStore()
  const { activeCard } = storeToRefs(cardStore)

  const enabled = computed(() => activeCard.value?.extensions?.airi?.[SALIENCE_FLAG_KEY] ?? false)

  /** Turn metrics history (most recent last); sized 24. */
  const history = ref<SalienceTurnMetrics[]>([])

  /** Present when the CURRENT turn's late layers voted >= 2/3 hot. */
  const hot = ref(false)

  /** Control means per late layer [L9,L10,L11] measured during CONTROL turns; warmed from FALLBACK on first boot. */
  const controlWidthBlanket = ref<[number, number, number]>([...FALLBACK_CONTROL_MEAN])

  function reset() {
    history.value = []
    hot.value = false
    controlWidthBlanket.value = [...FALLBACK_CONTROL_MEAN]
  }

  /** Late layers probed by the Phase-4b harness: L9, L10, L11 indices on the 12-split state vector. */
  const LATE_LAYER_INDEXES = [9, 10, 11] as const

  /** Trigger multiplier validated in the Phase-4b sensitivity sweep (`vote-2of3 @ 1.5×` best balance). */
  const SALIENCE_MULTIPLIER = 1.5

  async function probeTurn(turnText: string): Promise<SalienceTurnMetrics | null> {
    if (!enabled.value || !turnText || !turnText.trim())
      return null

    // Call the real WebGPU worker over the Eventa bridge (Phase-6 contract).
    const { getWebRwkvAdapter } = await import('../../libs/inference/adapters/web-rwkv')
    const adapter = await getWebRwkvAdapter()
    if (adapter.state !== 'ready')
      return null

    const samplerPayload = await adapter.stateDelta({
      turnText,
      reset: history.value.length === 0,
    })

    if (samplerPayload.numLayer < 12) {
      // Worker returned degraded/faithful fallback: single-layer delta. Keep it honest.
      const single = Math.max(0, samplerPayload.perLayerCosine[0] ?? 0)
      return {
        lateLayerDeltas: [single, single, single],
        lateLayerMean: single,
        hot: single > (FALLBACK_CONTROL_MEAN[0] * SALIENCE_MULTIPLIER),
        threshold: FALLBACK_CONTROL_MEAN[0] * SALIENCE_MULTIPLIER,
        controlMean: FALLBACK_CONTROL_MEAN[0],
      }
    }

    const late = LATE_LAYER_INDEXES.map(i => samplerPayload.perLayerCosine[i] ?? 0) as [number, number, number]
    const control = controlWidthBlanket.value
    const thresholds = [control[0], control[1], control[2]].map(c => c * SALIENCE_MULTIPLIER)
    const votes = late.map((d, i) => d > thresholds[i]).filter(Boolean).length
    const lateMean = late.reduce((a, b) => a + b, 0) / late.length

    // Bootstrap CONTROL floor: first calm session should seed the live control mean.
    if (history.value.length < 8) {
      // Gentle EMA update only when not firing.
      if (votes === 0) {
        for (let i = 0; i < 3; i++) {
          controlWidthBlanket.value[i] = (controlWidthBlanket.value[i] * 0.8) + (late[i] * 0.2)
        }
      }
    }

    const metrics: SalienceTurnMetrics = {
      lateLayerDeltas: late,
      lateLayerMean: lateMean,
      hot: votes >= 2,
      threshold: Math.max(...thresholds),
      controlMean: control.reduce((a, b) => a + b, 0) / control.length,
    }

    hot.value = metrics.hot
    history.value = [...history.value.slice(-23), metrics]
    return metrics
  }

  return {
    enabled,
    hot,
    history,
    /** Prior boot semantics verifier: exposed because ChatGroundingPopover's drawer wants real serial numbers. */
    controlWidthBlanket,
    probeTurn,
    reset,
  }
})
