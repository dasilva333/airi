import { defineInvokeEventa } from '@moeru/eventa'

export interface StageMateEnsureModelPayload {
  modelId: string
  modelName?: string
}

export interface StageMateEnsureModelResult {
  status: 'ready' | 'need_binary'
  path?: string
}

export interface StageMateSaveModelPayload {
  modelId: string
  modelName?: string
  data: Uint8Array | number[]
}

export interface StageMateSaveModelResult {
  success: boolean
  path: string
}

export const electronStageMateEnsureModel = defineInvokeEventa<StageMateEnsureModelResult, StageMateEnsureModelPayload>('eventa:invoke:electron:stage-mate:ensure-model')
export const electronStageMateSaveModel = defineInvokeEventa<StageMateSaveModelResult, StageMateSaveModelPayload>('eventa:invoke:electron:stage-mate:save-model')
export const electronStageMateToggleVisibility = defineInvokeEventa<void, boolean>('eventa:invoke:electron:stage-mate:toggle-visibility')
export const electronStageMateGetState = defineInvokeEventa<{ enabled: boolean, running: boolean }, void>('eventa:invoke:electron:stage-mate:get-state')
