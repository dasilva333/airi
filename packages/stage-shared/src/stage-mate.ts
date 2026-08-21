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

export interface StageMateSetPropMacaronPayload {
  shell: string
  whip: string
  heart: string
}

export interface StageMateTriggerExpressionPayload {
  name: string
  weight?: number
  durationMs?: number
  isFixed?: boolean
}

export interface StageMateLipSyncPayload {
  rms: number
}

export interface StageMateSyncOutfitsEntry {
  name: string
  tag?: string
  meshes: string[]
}

export interface StageMateSyncOutfitsPayload {
  modelId: string
  outfits: StageMateSyncOutfitsEntry[]
  reload?: boolean
}

export interface StageMateSyncOutfitsResult {
  success: boolean
  path?: string
}

export interface StageMateSetWeaponPayload {
  enabled: boolean
  weapon: 'cat' | 'blk' | 'gray' | string
}

export interface StageMateCaptionPayload {
  text?: string
  isActive?: boolean
  speaker?: string
  clear?: boolean
}

export const electronStageMateEnsureModel = defineInvokeEventa<StageMateEnsureModelResult, StageMateEnsureModelPayload>('eventa:invoke:electron:stage-mate:ensure-model')
export const electronStageMateSaveModel = defineInvokeEventa<StageMateSaveModelResult, StageMateSaveModelPayload>('eventa:invoke:electron:stage-mate:save-model')
export const electronStageMateSyncOutfits = defineInvokeEventa<StageMateSyncOutfitsResult, StageMateSyncOutfitsPayload>('eventa:invoke:electron:stage-mate:sync-outfits')
export const electronStageMateToggleVisibility = defineInvokeEventa<void, boolean>('eventa:invoke:electron:stage-mate:toggle-visibility')
export const electronStageMateGetState = defineInvokeEventa<{ enabled: boolean, running: boolean }, void>('eventa:invoke:electron:stage-mate:get-state')
export const electronStageMateSetViewportMode = defineInvokeEventa<void, StageMateViewportMode>('eventa:invoke:electron:stage-mate:set-viewport-mode')
export const electronStageMateSetModelPosition = defineInvokeEventa<void, StageMateModelPosition>('eventa:invoke:electron:stage-mate:set-model-position')
export const electronStageMateSetPropMacaron = defineInvokeEventa<void, StageMateSetPropMacaronPayload>('eventa:invoke:electron:stage-mate:set-prop-macaron')
export const electronStageMateTriggerExpression = defineInvokeEventa<void, StageMateTriggerExpressionPayload>('eventa:invoke:electron:stage-mate:trigger-expression')
export const electronStageMateLipSync = defineInvokeEventa<void, StageMateLipSyncPayload>('eventa:invoke:electron:stage-mate:lip-sync')
export const electronStageMateSetWeapon = defineInvokeEventa<void, StageMateSetWeaponPayload>('eventa:invoke:electron:stage-mate:set-weapon')
export const electronStageMateSendCaption = defineInvokeEventa<void, StageMateCaptionPayload>('eventa:invoke:electron:stage-mate:send-caption')
