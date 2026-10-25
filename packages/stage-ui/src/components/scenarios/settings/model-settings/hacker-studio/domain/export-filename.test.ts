import { describe, expect, it } from 'vitest'

import {
  buildExportFileName,
  exportTimestamp,
  modelNameFromUrl,
  resolveModelBaseName,
  sanitizeModelBaseName,
} from './export-filename'

describe('hacker-studio: export filename characterization', () => {
  it('strips paths, queries, fragments, and model extensions', () => {
    expect(sanitizeModelBaseName('/tmp/models/AvatarSample_A.vrm?download=1#x')).toBe('AvatarSample_A')
    expect(sanitizeModelBaseName('C:\\models\\avatar.glb')).toBe('avatar')
  })

  it('removes display-model/preset prefixes and invalid filename characters', () => {
    expect(sanitizeModelBaseName('preset-vrm-2')).toBe('vrm-2')
    expect(sanitizeModelBaseName('display-model-cool')).toBe('cool')
    // Characterization: '?' is treated as a query delimiter even mid-name.
    expect(sanitizeModelBaseName('My: Avatar? *Name*')).toBe('My_Avatar')
  })

  it('decodes URI components and collapses whitespace/underscores', () => {
    expect(sanitizeModelBaseName('My%20Avatar%20.vrm')).toBe('My_Avatar')
    expect(sanitizeModelBaseName('  a   b  ')).toBe('a_b')
    expect(sanitizeModelBaseName('._name_.')).toBe('name')
  })

  it('caps the base name at 64 characters', () => {
    expect(sanitizeModelBaseName('a'.repeat(100))).toHaveLength(64)
  })

  it('extracts URL basenames but ignores blob and data URLs', () => {
    expect(modelNameFromUrl('https://example.com/models/avatar.vrm?x=1')).toBe('avatar.vrm')
    expect(modelNameFromUrl('blob:http://localhost/abc')).toBe('')
    expect(modelNameFromUrl('data:model/vrm;base64,AAAA')).toBe('')
  })

  it('resolves source names in the documented precedence order', () => {
    expect(resolveModelBaseName({ metaName: 'Meta', metaTitle: 'Title', displayModelName: 'Display' })).toBe('Meta')
    expect(resolveModelBaseName({ metaTitle: 'Title', displayModelName: 'Display' })).toBe('Title')
    expect(resolveModelBaseName({ displayModelName: 'Display', displayModelFileName: 'file.vrm' })).toBe('Display')
    expect(resolveModelBaseName({ displayModelFileName: 'file.vrm', selectedFileName: 'selected.vrm' })).toBe('file')
    expect(resolveModelBaseName({ selectedFileName: 'selected.vrm', selectedUrl: 'https://x/url.vrm' })).toBe('selected')
    expect(resolveModelBaseName({ selectedUrl: 'https://x/url.vrm', cardName: 'Card' })).toBe('url')
    expect(resolveModelBaseName({ cardName: 'Card', selectedModelId: 'preset-id' })).toBe('Card')
    expect(resolveModelBaseName({ selectedModelId: 'preset-id' })).toBe('id')
    expect(resolveModelBaseName({})).toBe('Avatar')
  })

  it('formats a deterministic local timestamp', () => {
    expect(exportTimestamp(new Date(2026, 9, 25, 9, 20))).toBe('20261025-0920')
    expect(exportTimestamp(new Date(2026, 0, 2, 3, 4))).toBe('20260102-0304')
  })

  it('builds the adapter-compatible filename pattern', () => {
    expect(buildExportFileName({ metaName: 'AvatarSample_A' }, new Date(2026, 9, 25, 9, 20))).toBe('AvatarSample_A_VHACK_20261025-0920.vrm')
    expect(buildExportFileName({}, new Date(2026, 9, 25, 9, 20), 'zip')).toBe('Avatar_VHACK_20261025-0920.zip')
  })
})
