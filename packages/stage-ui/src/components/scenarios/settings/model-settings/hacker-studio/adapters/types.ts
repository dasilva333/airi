import type { Ref } from 'vue'

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
}

export interface HackerPart {
  id: string
  name: string
  kind: string
  visible: boolean
  canFocus: boolean
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

  getGenerationBase: (id: HackerTextureId) => Promise<string>
  applyTexture: (id: HackerTextureId, dataUrl: string, meta: HackerApplyMeta) => Promise<void>
  restoreTexture: (id: HackerTextureId) => void
  setPartVisibility?: (id: string, visible: boolean) => void
  exportAsset: () => Promise<HackerExportResult>
  reset: () => void
  dispose: () => void
}
