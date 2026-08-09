/**
 * Vision workload registry (proposal §10 — Vision Settings, Ticker Controls
 * & Upstream Orchestrator Alignment).
 *
 * Upstream defines 4 continuous VLM workloads (`screen:interpret`,
 * `screen:understand`, `screen:ocr`, `screen:ui-automation`); AIRI registers
 * `screen:attention-ecology-guard` as a 5th, $0-cost option that executes the
 * local cascading salience gate (Stage 0 aHash -> Stage 1 CLIP novelty ->
 * Stage 2 tesseract.js OCR error gate) to filter static/idle ticks before any
 * cloud/WebGPU VLM cost is incurred.
 */

import { computed, ref } from 'vue'

export type VisionWorkloadKind = 'cloud-vlm' | 'attention-guard'
export type VisionWorkloadCost = 'cloud' | 'local-gpu' | '0-cost'

export interface VisionWorkloadDescriptor {
  /** Stable workload id, e.g. `screen:attention-ecology-guard`. */
  id: string
  /** UI label (devtools workload selector). */
  label: string
  description: string
  cost: VisionWorkloadCost
  kind: VisionWorkloadKind
  icon?: string
}

export const ATTENTION_GUARD_WORKLOAD_ID = 'screen:attention-ecology-guard'

export const VISION_WORKLOADS: VisionWorkloadDescriptor[] = [
  {
    id: 'screen:interpret',
    label: 'Interpret',
    description: 'Summarize what is on screen and relevant UI state.',
    cost: 'cloud',
    kind: 'cloud-vlm',
  },
  {
    id: 'screen:understand',
    label: 'Understand',
    description: 'Explain screen intent and key tasks.',
    cost: 'cloud',
    kind: 'cloud-vlm',
  },
  {
    id: 'screen:ocr',
    label: 'OCR',
    description: 'Extract readable text from the screen.',
    cost: 'cloud',
    kind: 'cloud-vlm',
  },
  {
    id: 'screen:ui-automation',
    label: 'UI Automation',
    description: 'Identify actionable UI buttons/inputs.',
    cost: 'cloud',
    kind: 'cloud-vlm',
  },
  {
    id: ATTENTION_GUARD_WORKLOAD_ID,
    label: 'Attention Ecology Guard (0-Cost)',
    description: 'Local cascading salience gate: change detection -> CLIP novelty -> OCR error gate -> promotion. Static ticks are filtered at 0 cost.',
    cost: '0-cost',
    kind: 'attention-guard',
    icon: 'i-solar:eye-closed-line-duotone',
  },
] as const

export function useVisionWorkloads() {
  const selectedWorkloadId = ref<string>(ATTENTION_GUARD_WORKLOAD_ID)

  const selectedWorkload = computed(() => VISION_WORKLOADS.find(w => w.id === selectedWorkloadId.value))

  const isGuardWorkload = computed(() => selectedWorkload.value?.kind === 'attention-guard')

  return {
    VISION_WORKLOADS,
    selectedWorkloadId,
    selectedWorkload,
    isGuardWorkload,
  }
}
