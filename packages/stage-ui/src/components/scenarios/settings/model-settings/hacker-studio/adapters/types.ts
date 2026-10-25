import type { Ref } from 'vue'

import type { SupportedUploadMime } from '../domain/upload-validation'

export type HackerModelKind = 'vrm' | 'live2d' | 'spine'
export type HackerTextureId = string | number

export interface HackerCapabilities {
  textures: boolean
  preview: boolean
  revert: boolean
  parts: boolean
  materials: boolean
  previewGamma: boolean
  export: 'full-bundle' | 'disabled'
}

export interface HackerTexture {
  id: HackerTextureId
  name: string
  kind: string
  previewUrl: string | null
  width: number | null
  height: number | null
  owners: string[]
  hasAlpha: boolean | null
  shared: boolean
  /** Adapter-specific warning shown in the Lab (for example PMA pages). */
  hint?: string
}

export interface HackerPart {
  id: string
  name: string
  kind: string
  visible: boolean
  canFocus: boolean
}

export interface HackerMaterialControl {
  id: string
  label: string
  kind: 'range' | 'toggle'
  min?: number
  max?: number
  step?: number
  value: number | boolean
}

export interface HackerApplyMeta {
  source: 'upload' | 'generated'
  fileName?: string
}

export interface HackerExportResult {
  blob: Blob
  filename: string
}

export interface HackerAdapter {
  readonly kind: HackerModelKind
  readonly identity: string
  readonly label: string
  readonly capabilities: HackerCapabilities
  readonly ready: Ref<boolean>
  readonly textures: Ref<HackerTexture[]>
  readonly parts: Ref<HackerPart[]>
  readonly materialControls?: Ref<HackerMaterialControl[]>
  /** Singular human-readable noun for texture owners; defaults to “material”. */
  readonly ownerNoun?: string
  /** Upload formats accepted by this adapter; defaults to PNG/JPEG/WebP. */
  readonly acceptedUploadMimes?: SupportedUploadMime[]
  /** Non-null when export is temporarily unavailable (e.g. no source ZIP). */
  readonly exportUnavailableReason?: Ref<string | null>

  selectTexture?: (id: HackerTextureId) => void

  getGenerationBase: (id: HackerTextureId) => Promise<string>
  applyTexture: (id: HackerTextureId, dataUrl: string, meta: HackerApplyMeta, image?: HTMLImageElement) => Promise<void>
  restoreTexture: (id: HackerTextureId) => void
  setMaterialControl?: (id: string, value: number | boolean) => void
  setPartVisibility?: (id: string, visible: boolean) => void
  exportAsset: () => Promise<HackerExportResult>
  reset: () => void
  dispose: () => void
}
