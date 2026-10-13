import { describe, expect, it } from 'vitest'

import { buildWidgetExportManifest } from './export'

describe('buildWidgetExportManifest', () => {
  it('formats a valid export manifest from mounted widget', () => {
    const manifest = buildWidgetExportManifest({
      id: 'test-widget-1',
      title: 'Strawberry Pet',
      path: '/workspace/pet.ts',
      sourcePath: '/workspace/pet.ts',
      sourceCode: 'export default function mount() {}',
      code: 'function mount() {}',
      surface: 'panel',
      state: { loves: 42 },
      mountedAt: 12345678,
    })

    expect(manifest.version).toBe('1.0')
    expect(manifest.id).toBe('test-widget-1')
    expect(manifest.title).toBe('Strawberry Pet')
    expect(manifest.surface).toBe('panel')
    expect(manifest.state).toEqual({ loves: 42 })
    expect(manifest.sourceCode).toBe('export default function mount() {}')
    expect(manifest.code).toBe('function mount() {}')
    expect(manifest.scope).toBe('global')
    expect(typeof manifest.exportedAt).toBe('number')
  })

  it('falls back to file path basename when title is missing', () => {
    const manifest = buildWidgetExportManifest({
      id: 'test-widget-2',
      path: '/workspace/haven_pos.js',
      code: 'console.log("hello")',
      mountedAt: 1000,
    })

    expect(manifest.title).toBe('haven_pos')
    expect(manifest.state).toEqual({})
    expect(manifest.surface).toBe('panel')
  })
})
