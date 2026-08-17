import { defineInvokeEventa } from '@moeru/eventa'

export type StageMateViewportMode = 'tactileMode' | 'dragMode' | 'positionMode' | 'orbitMode'

export interface StageMateEnsureModelPayload {
  modelId: string
  modelName?: string
  position?: { x: number, y: number, scale?: number }
}

export interface StageMateEnsureModelResult {
  status: 'ready' | 'need_binary'
  path?: string
}

export interface StageMateSaveModelPayload {
  modelId: string
  modelName?: string
  data: Uint8Array | number[]
  position?: { x: number, y: number, scale?: number }
}

export interface StageMateSaveModelResult {
  success: boolean
  path: string
}

export interface StageMateModelPosition {
  modelId: string
  x: number
  y: number
  scale?: number
}

export interface StageMateWindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export const electronStageMateEnsureModel = defineInvokeEventa<StageMateEnsureModelResult, StageMateEnsureModelPayload>('eventa:invoke:electron:stage-mate:ensure-model')
export const electronStageMateSaveModel = defineInvokeEventa<StageMateSaveModelResult, StageMateSaveModelPayload>('eventa:invoke:electron:stage-mate:save-model')
export const electronStageMateToggleVisibility = defineInvokeEventa<void, boolean>('eventa:invoke:electron:stage-mate:toggle-visibility')
export const electronStageMateGetState = defineInvokeEventa<{ enabled: boolean, running: boolean }, void>('eventa:invoke:electron:stage-mate:get-state')
export const electronStageMateSetViewportMode = defineInvokeEventa<void, StageMateViewportMode>('eventa:invoke:electron:stage-mate:set-viewport-mode')
export const electronStageMateSetModelPosition = defineInvokeEventa<void, StageMateModelPosition>('eventa:invoke:electron:stage-mate:set-model-position')
