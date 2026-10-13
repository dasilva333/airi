import { describe, expect, it } from 'vitest'

import { parseWidgetImportManifest } from './import'

describe('parseWidgetImportManifest', () => {
  it('parses a valid manifest JSON string correctly', () => {
    const raw = JSON.stringify({
      version: '1.0',
      id: 'widget-custom-123',
      title: 'Haven Dialogue 🌸',
      scope: 'global',
      surface: 'widget',
      target: 'window',
      position: { x: 450, y: 200 },
      state: { count: 12 },
      sourcePath: '/workspace/haven.ts',
      sourceCode: 'export default function mount() {}',
      code: 'function mount() {}',
      exportedAt: 1700000000000,
    })

    const result = parseWidgetImportManifest(raw)

    expect(result.id).toBe('widget-custom-123')
    expect(result.title).toBe('Haven Dialogue 🌸')
    expect(result.surface).toBe('widget')
    expect(result.target).toBe('window')
    expect(result.position).toEqual({ x: 450, y: 200 })
    expect(result.state).toEqual({ count: 12 })
    expect(result.path).toBe('/workspace/haven.js')
    expect(result.sourcePath).toBe('/workspace/haven.ts')
    expect(result.sourceCode).toBe('export default function mount() {}')
    expect(result.code).toBe('function mount() {}')
    expect(result.scope).toBe('global')
    expect(result.isMounted).toBe(false)
  })

  it('falls back code to sourceCode when compiled code is empty', () => {
    const manifest = {
      title: 'Simple Counter',
      sourcePath: '/workspace/counter.ts',
      sourceCode: 'export default function mount({ container }) {}',
    }

    const result = parseWidgetImportManifest(manifest)

    expect(result.title).toBe('Simple Counter')
    expect(result.code).toBe('export default function mount({ container }) {}')
    expect(result.path).toBe('/workspace/counter.js')
    expect(result.sourcePath).toBe('/workspace/counter.ts')
    expect(result.id).toMatch(/^widget-/)
    expect(result.surface).toBe('panel')
    expect(result.target).toBe('sidepanel')
  })

  it('derives workspace path from title slug when paths are omitted', () => {
    const manifest = {
      title: 'Arona Lean Tracker',
      code: 'console.log("tracker")',
    }

    const result = parseWidgetImportManifest(manifest)

    expect(result.title).toBe('Arona Lean Tracker')
    expect(result.path).toBe('/workspace/arona_lean_tracker.js')
    expect(result.surface).toBe('panel')
    expect(result.state).toEqual({})
  })

  it('throws an error on malformed JSON string', () => {
    expect(() => parseWidgetImportManifest('{ invalid json')).toThrow(/Failed to parse widget manifest JSON/)
  })

  it('throws an error when both code and sourceCode are missing', () => {
    expect(() => parseWidgetImportManifest({ title: 'Empty Widget' })).toThrow(/missing code or sourceCode/)
  })
})
