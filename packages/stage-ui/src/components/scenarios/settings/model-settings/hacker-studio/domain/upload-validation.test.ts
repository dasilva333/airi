import { describe, expect, it } from 'vitest'

import { buildUploadNotices, inferImageMime } from './upload-validation'

describe('hacker-studio: upload validation characterization', () => {
  it('accepts the three supported MIME types', () => {
    expect(inferImageMime({ type: 'image/png', name: 'x' })).toBe('image/png')
    expect(inferImageMime({ type: 'image/jpeg', name: 'x' })).toBe('image/jpeg')
    expect(inferImageMime({ type: 'image/webp', name: 'x' })).toBe('image/webp')
  })

  it('falls back to the filename extension when MIME is missing', () => {
    expect(inferImageMime({ type: '', name: 'texture.PNG' })).toBe('image/png')
    expect(inferImageMime({ type: '', name: 'texture.jpeg' })).toBe('image/jpeg')
    expect(inferImageMime({ type: '', name: 'texture.webp' })).toBe('image/webp')
  })

  it('rejects unsupported files', () => {
    expect(inferImageMime({ type: 'image/gif', name: 'x.gif' })).toBeNull()
    expect(inferImageMime({ type: '', name: 'texture.bmp' })).toBeNull()
    expect(inferImageMime({ type: 'image/jpg', name: 'texture.jpg' })).toBe('image/jpeg')
  })

  it('returns no notices for a matching PNG with the same alpha state', () => {
    expect(buildUploadNotices(
      { width: 2048, height: 2048, hasAlpha: true, mime: 'image/png' },
      { width: 2048, height: 2048, hasAlpha: true },
    )).toBeNull()
  })

  it('warns on dimension mismatch without blocking', () => {
    expect(buildUploadNotices(
      { width: 1254, height: 1254, hasAlpha: true, mime: 'image/png' },
      { width: 4096, height: 4096, hasAlpha: true },
    )).toEqual({
      dimension: 'Dimensions 1254×1254 differ from the original 4096×4096; UVs will stretch.',
    })
  })

  it('warns when the upload loses transparency', () => {
    expect(buildUploadNotices(
      { width: 4096, height: 4096, hasAlpha: false, mime: 'image/png' },
      { width: 4096, height: 4096, hasAlpha: true },
    )).toEqual({
      transparency: 'This upload has no transparency, but the original texture does; cut-out areas may fill in.',
    })
  })

  it('warns on non-PNG formats', () => {
    expect(buildUploadNotices(
      { width: 4096, height: 4096, hasAlpha: false, mime: 'image/jpeg' },
      { width: 4096, height: 4096, hasAlpha: false },
    )).toEqual({
      format: 'PNG is recommended; JPEG and WebP can lose alpha or quality.',
    })
  })

  it('emits all applicable notices in stable order', () => {
    expect(buildUploadNotices(
      { width: 1024, height: 1024, hasAlpha: false, mime: 'image/webp' },
      { width: 2048, height: 2048, hasAlpha: true },
    )).toEqual({
      dimension: 'Dimensions 1024×1024 differ from the original 2048×2048; UVs will stretch.',
      transparency: 'This upload has no transparency, but the original texture does; cut-out areas may fill in.',
      format: 'PNG is recommended; JPEG and WebP can lose alpha or quality.',
    })
  })

  it('does not warn about dimensions when the original size is unknown', () => {
    expect(buildUploadNotices(
      { width: 1024, height: 1024, hasAlpha: true, mime: 'image/png' },
      { width: null, height: null, hasAlpha: true },
    )).toBeNull()
  })

  it('does not warn about transparency when the original had none', () => {
    expect(buildUploadNotices(
      { width: 4096, height: 4096, hasAlpha: false, mime: 'image/png' },
      { width: 4096, height: 4096, hasAlpha: false },
    )).toBeNull()
  })
})
