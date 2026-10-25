/**
 * Pure upload validation policy for Hacker Studio.
 *
 * Image decoding and alpha sampling stay in the presentation adapter; this
 * module owns the format acceptance and warning contract that must remain
 * identical across VRM/Live2D/Spine.
 */

export type SupportedUploadMime = 'image/png' | 'image/jpeg' | 'image/webp'

export interface UploadFileLike {
  type?: string | null
  name?: string | null
}

export interface UploadImageMeta {
  width: number
  height: number
  hasAlpha: boolean
  mime: SupportedUploadMime
}

export interface OriginalTextureMeta {
  width?: number | null
  height?: number | null
  hasAlpha: boolean
}

export interface UploadNotice {
  dimension?: string
  transparency?: string
  format?: string
}

export function inferImageMime(file: UploadFileLike): SupportedUploadMime | null {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/png' || type === 'image/jpeg' || type === 'image/webp')
    return type
  const name = file.name || ''
  if (/\.png$/i.test(name))
    return 'image/png'
  if (/\.jpe?g$/i.test(name))
    return 'image/jpeg'
  if (/\.webp$/i.test(name))
    return 'image/webp'
  return null
}

export function buildUploadNotices(
  upload: UploadImageMeta,
  original: OriginalTextureMeta,
): UploadNotice | null {
  const notices: UploadNotice = {}

  if (
    original.width
    && original.height
    && (original.width !== upload.width || original.height !== upload.height)
  ) {
    notices.dimension = `Dimensions ${upload.width}×${upload.height} differ from the original ${original.width}×${original.height}; UVs will stretch.`
  }

  if (original.hasAlpha && !upload.hasAlpha) {
    notices.transparency = 'This upload has no transparency, but the original texture does; cut-out areas may fill in.'
  }

  if (upload.mime !== 'image/png')
    notices.format = 'PNG is recommended; JPEG and WebP can lose alpha or quality.'

  return Object.keys(notices).length ? notices : null
}
